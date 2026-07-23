# -*- coding: utf-8 -*-
"""Cross-cutting helpers: date/time, auth decorators, risk logic, LAN IP detection."""
import socket, datetime
from functools import wraps
from flask import session, jsonify, request
from .db import get_db, r2d


def get_local_ipv4():
    """获取本机局域网 IPv4 地址"""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(('8.8.8.8', 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return '127.0.0.1'

LOCAL_IPV4 = get_local_ipv4()  # 启动时获取一次，如 10.21.230.243


def today(): return datetime.date.today().isoformat()
def now_str(): return datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')


def workdays(year, month):
    import calendar
    return sum(1 for d in range(1, calendar.monthrange(year,month)[1]+1)
               if datetime.date(year,month,d).weekday()<5)


def auto_risk(d):
    done = ('DELIVERED','COMPLETED','RESOLVED','CLOSED','REJECTED','CANCELLED')
    if d.get('status') in done: return d
    t=today(); pe=d.get('plan_end_date') or ''; prog=int(d.get('progress',0) or 0)
    if pe and pe < t:
        # 已超期：无论用户是否选择"无风险"，都强制标记
        d['has_risk']=1
        if not d.get('risk_description'): d['risk_description']='已超过计划截止日期'
    elif int(d.get('has_risk') or 0)==1:
        # 用户手动选择"有风险"时才做临近截止的自动判断，阈值 1 天
        warn=(datetime.date.today()+datetime.timedelta(days=1)).isoformat()
        if pe and pe<=warn and prog<80:
            if not d.get('risk_description'): d['risk_description']='临近截止，进度不足80%'
    else:
        # 用户选择"无风险"且未超期：尊重选择，不涉及风险描述
        d['risk_description']=None
    return d


STATUS_ZH={'PENDING':'待处理','IN_PROGRESS':'进行中','TESTING':'测试中',
           'DELIVERED':'已交付','CANCELLED':'已取消','OPEN':'待处理',
           'RESOLVED':'已解决','CLOSED':'已关闭','REJECTED':'已拒绝',
           'ONGOING':'进行中','COMPLETED':'已完成'}
TYPE_ZH={'REQUIREMENT':'需求','ISSUE':'问题单','ONSITE':'现场支撑','OTHER':'其他事务','QUALITY':'质量深耕'}


def current_user():
    uid=session.get('user_id')
    if not uid: return None
    row=get_db().execute("SELECT * FROM members WHERE id=? AND is_active=1",(uid,)).fetchone()
    u=r2d(row)
    # 管理员在前端切换到"成员视图"时，请求会带上 X-View-Mode: member —
    # 此时把该管理员当作普通成员处理，所有依据 is_admin 做的可见范围判断随之收窄，
    # 而不只是前端换了一套菜单/页面（否则管理员账号在"成员视图"下仍会读到全组织数据）。
    if u and u.get('is_admin') and request.headers.get('X-View-Mode')=='member':
        u=dict(u); u['is_admin']=0
    return u


def login_required(f):
    @wraps(f)
    def dec(*a,**k):
        if not session.get('user_id'): return jsonify({'error':'未登录','code':401}),401
        return f(*a,**k)
    return dec


def admin_required(f):
    @wraps(f)
    def dec(*a,**k):
        u=current_user()
        if not u or not u.get('is_admin'): return jsonify({'error':'权限不足','code':403}),403
        return f(*a,**k)
    return dec
