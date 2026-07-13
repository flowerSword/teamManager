# -*- coding: utf-8 -*-
"""Check-in: single/bulk check-in, per-day/per-member/group/annual views, Excel export."""
import calendar, datetime, io
from collections import Counter
from flask import Blueprint, request, jsonify, send_file
from openpyxl import Workbook
from .db import get_db, r2d, rs
from .utils import today, now_str, workdays, current_user, login_required, admin_required, LOCAL_IPV4
from .config_routes import detect_status
from .excel import mkhdr, title_cell

checkin_bp = Blueprint('checkin', __name__)


@checkin_bp.route('/api/checkin', methods=['POST'])
@login_required
def checkin():
    u = current_user(); d = request.json or {}
    mid = int(d.get('memberId', u['id']))
    is_admin = u['is_admin']
    # Members can only check in for themselves
    if not is_admin and mid != u['id']: mid = u['id']

    dt     = d.get('date', today())
    remark = d.get('remark', '')
    db     = get_db()

    # Determine check_in_time and status
    existing = r2d(db.execute("SELECT * FROM check_ins WHERE member_id=? AND check_date=?",(mid,dt)).fetchone())

    if is_admin:
        # Admin can set explicit time and status
        explicit_time   = d.get('check_in_time')   # HH:MM or None
        explicit_status = d.get('status')           # explicit override
        if explicit_time:
            ci_time = "{} {}".format(dt, explicit_time)
            status  = explicit_status or detect_status(explicit_time)
        elif explicit_status:
            # Admin sets status directly (e.g. ABSENT/LEAVE) without time
            ci_time = "{} {}".format(dt, now_str()[11:16]) if dt == today() else (existing or {}).get('check_in_time') or ''
            status  = explicit_status
        else:
            # 管理员自己签到（不传 status 也不传时间）：按当前时间自动判断是否迟到
            ci_time = now_str() if dt == today() else (existing or {}).get('check_in_time') or ''
            status  = explicit_status or detect_status(now_str()[11:16])
    else:
        # Member: time is always server-side NOW (only for today)
        if dt != today():
            # Member cannot check in for other dates
            return jsonify({'error': '只能为今天签到，历史日期请联系管理员修改'}), 403
        if existing:
            # Already checked in today — re-check keeps original time, just updates status/remark if needed
            ci_time = existing['check_in_time'] or now_str()
            # Use existing time to re-evaluate late status if no explicit status
            status  = d.get('status') or detect_status(ci_time[11:16] if ci_time else '00:00')
        else:
            now_hm = now_str()[11:16]
            if now_hm < '04:00':
                return jsonify({'error': '凌晨4点后才能签到今日出勤，请稍后再试'}), 403
            ci_time = now_str()
            # Auto-detect PRESENT vs LATE; member cannot choose these two — only LEAVE/REMOTE/ABSENT allowed as override
            requested = d.get('status', '')
            if requested in ('LEAVE', 'REMOTE', 'ABSENT'):
                status = requested
            else:
                status = detect_status(ci_time[11:16])

    # IP：优先使用前端传来的（前端通过 /api/myip 获取），其次服务器检测
    client_ip = d.get('clientIp','').strip()
    if not client_ip:
        raw_ip = (request.headers.get('X-Forwarded-For','').split(',')[0].strip()
                  or request.headers.get('X-Real-IP','')
                  or request.remote_addr or '')
        if raw_ip.startswith('::ffff:'):
            raw_ip = raw_ip[7:]
        if raw_ip in ('::1', '127.0.0.1'):
            client_ip = LOCAL_IPV4
        else:
            client_ip = raw_ip

    db.execute("""INSERT INTO check_ins(member_id,check_date,check_in_time,status,remark,ip_address) VALUES(?,?,?,?,?,?)
        ON CONFLICT(member_id,check_date) DO UPDATE SET status=excluded.status,
        remark=excluded.remark,check_in_time=excluded.check_in_time,ip_address=excluded.ip_address""",
               (mid, dt, ci_time, status, remark, client_ip))
    db.commit()
    return jsonify(r2d(db.execute("SELECT * FROM check_ins WHERE member_id=? AND check_date=?",(mid,dt)).fetchone()))


@checkin_bp.route('/api/checkin/bulk', methods=['POST'])
@admin_required
def bulk_checkin():
    """Admin bulk check-in: submit a list of {memberId, status, check_in_time, remark}"""
    d    = request.json or {}
    dt   = d.get('date', today())
    rows = d.get('records', [])   # [{memberId, status, check_in_time?, remark?}]
    db   = get_db()
    results = []
    for rec in rows:
        mid    = int(rec.get('memberId'))
        status = rec.get('status', 'PRESENT')
        ci_t   = rec.get('check_in_time')   # HH:MM
        remark = rec.get('remark', '')
        if ci_t:
            ci_time = "{} {}".format(dt, ci_t)
            # re-evaluate late only if status not explicitly set to LEAVE/ABSENT/REMOTE
            if status not in ('LEAVE','ABSENT','REMOTE'):
                status = detect_status(ci_t)
        else:
            ci_time = "{} 09:00:00".format(dt)
        db.execute("""INSERT INTO check_ins(member_id,check_date,check_in_time,status,remark) VALUES(?,?,?,?,?)
            ON CONFLICT(member_id,check_date) DO UPDATE SET status=excluded.status,
            remark=excluded.remark,check_in_time=excluded.check_in_time""",
                   (mid, dt, ci_time, status, remark))
        results.append({'memberId': mid, 'status': status})
    db.commit()
    return jsonify({'ok': True, 'count': len(results), 'records': results})


@checkin_bp.route('/api/checkin/today')
@login_required
def checkin_today():
    u = current_user()
    row = get_db().execute("SELECT * FROM check_ins WHERE member_id=? AND check_date=?",(u['id'],today())).fetchone()
    return jsonify(r2d(row))


@checkin_bp.route('/api/checkin/day/<dt>')
@admin_required
def checkin_day(dt):
    """Get all check-ins for a given date (admin only)."""
    gn  = request.args.get('group_name')
    db  = get_db()
    if gn:
        rows = rs(db.execute("""SELECT c.*,m.name as member_name,m.group_name FROM check_ins c
            JOIN members m ON c.member_id=m.id WHERE c.check_date=? AND m.group_name=? ORDER BY m.id""",(dt,gn)).fetchall())
    else:
        rows = rs(db.execute("""SELECT c.*,m.name as member_name,m.group_name FROM check_ins c
            JOIN members m ON c.member_id=m.id WHERE c.check_date=? ORDER BY m.id""",(dt,)).fetchall())
    return jsonify(rows)


@checkin_bp.route('/api/checkin/summary/group/<gn>')
@login_required
def ci_summary(gn):
    u=current_user()
    if not u['is_admin'] and u['group_name']!=gn: return jsonify({'error':'无权限'}),403
    yr=int(request.args.get('year',datetime.date.today().year))
    mo=int(request.args.get('month',datetime.date.today().month))
    s="{}-{:02d}-01".format(yr,mo); e="{}-{:02d}-{:02d}".format(yr,mo,calendar.monthrange(yr,mo)[1])
    db=get_db()
    members=rs(db.execute("SELECT * FROM members WHERE group_name=? AND is_active=1 ORDER BY id",(gn,)).fetchall())
    sums=[]
    for m in members:
        rows=rs(db.execute("SELECT * FROM check_ins WHERE member_id=? AND check_date>=? AND check_date<=? ORDER BY check_date",(m['id'],s,e)).fetchall())
        cnt=Counter(r['status'] for r in rows)
        sums.append({'memberId':m['id'],'memberName':m['name'],'presentDays':cnt.get('PRESENT',0),
            'absentDays':cnt.get('ABSENT',0),'lateDays':cnt.get('LATE',0),
            'leaveDays':cnt.get('LEAVE',0),'remoteDays':cnt.get('REMOTE',0),'checkIns':rows})
    return jsonify({'groupName':gn,'year':yr,'month':mo,'totalWorkDays':workdays(yr,mo),'memberCount':len(members),'members':sums})


@checkin_bp.route('/api/checkin/summary/annual/<gn>')
@login_required
def ci_annual(gn):
    u=current_user()
    if not u['is_admin'] and u['group_name']!=gn: return jsonify({'error':'无权限'}),403
    yr=int(request.args.get('year',datetime.date.today().year))
    db=get_db()
    if u['is_admin']:
        members=rs(db.execute("SELECT * FROM members WHERE group_name=? AND is_active=1",(gn,)).fetchall())
    else:
        members=rs(db.execute("SELECT * FROM members WHERE id=? AND is_active=1",(u['id'],)).fetchall())
    monthly=[]
    for mo in range(1,13):
        s="{}-{:02d}-01".format(yr,mo); e="{}-{:02d}-{:02d}".format(yr,mo,calendar.monthrange(yr,mo)[1])
        sums=[]
        for mem in members:
            rows=rs(db.execute("SELECT * FROM check_ins WHERE member_id=? AND check_date>=? AND check_date<=?",(mem['id'],s,e)).fetchall())
            cnt=Counter(r['status'] for r in rows)
            sums.append({'memberId':mem['id'],'memberName':mem['name'],'presentDays':cnt.get('PRESENT',0),'remoteDays':cnt.get('REMOTE',0),'absentDays':cnt.get('ABSENT',0),'checkIns':rows})
        monthly.append({'month':mo,'year':yr,'totalWorkDays':workdays(yr,mo),'memberCount':len(members),'members':sums})
    return jsonify({'groupName':gn,'year':yr,'monthlyData':monthly})


@checkin_bp.route('/api/checkin/member/<int:mid>')
@admin_required
def checkin_member_records(mid):
    """Get all checkin records for a member in a given year/month."""
    from datetime import datetime as dt_cls
    year=int(request.args.get('year',dt_cls.now().year))
    month=int(request.args.get('month',dt_cls.now().month))
    s=f'{year}-{month:02d}-01'
    last_day=calendar.monthrange(year,month)[1]
    e=f'{year}-{month:02d}-{last_day:02d}'
    rows=get_db().execute(
        "SELECT * FROM check_ins WHERE member_id=? AND check_date>=? AND check_date<=? ORDER BY check_date",
        (mid,s,e)).fetchall()
    return jsonify(rs(rows))


@checkin_bp.route('/api/checkin/today_all')
@admin_required
def checkin_today_all():
    """Get today's check-in for all members in a group (admin only)."""
    gn = request.args.get('group_name', current_user()['group_name'])
    db = get_db()
    members = rs(db.execute("SELECT id,name,role FROM members WHERE group_name=? AND is_active=1 ORDER BY id",(gn,)).fetchall())
    today_str = today()
    result = []
    for m in members:
        ci = r2d(db.execute("SELECT * FROM check_ins WHERE member_id=? AND check_date=?",(m['id'],today_str)).fetchone())
        result.append({
            'memberId': m['id'],
            'memberName': m['name'],
            'role': m['role'],
            'status': ci['status'] if ci else None,
            'check_in_time': ci['check_in_time'] if ci else None,
            'remark': ci['remark'] if ci else None,
            'ip_address': ci['ip_address'] if ci else None,
        })
    return jsonify(result)


@checkin_bp.route('/api/export/checkin/<gn>')
@login_required
def exp_ci(gn):
    u=current_user()
    if not u['is_admin'] and u['group_name']!=gn: return jsonify({'error':'无权限'}),403
    yr=int(request.args.get('year',datetime.date.today().year))
    mo=int(request.args.get('month',datetime.date.today().month))
    s="{}-{:02d}-01".format(yr,mo); e="{}-{:02d}-{:02d}".format(yr,mo,calendar.monthrange(yr,mo)[1])
    db=get_db(); members=rs(db.execute("SELECT * FROM members WHERE group_name=? AND is_active=1 ORDER BY id",(gn,)).fetchall())
    wd=workdays(yr,mo); wb=Workbook(); ws=wb.active; ws.title="{}年{}月签到".format(yr,mo)
    title_cell(ws,"{} {}年{}月 签到报表".format(gn,yr,mo),9)
    mkhdr(ws,3,['姓名','工作日','出勤','缺勤','迟到','请假','远程','出勤率','备注'],[14,8,8,8,8,8,8,10,20])
    for m in members:
        rows=rs(db.execute("SELECT status FROM check_ins WHERE member_id=? AND check_date>=? AND check_date<=?",(m['id'],s,e)).fetchall())
        cnt=Counter(r['status'] for r in rows)
        p=cnt.get('PRESENT',0); rv=cnt.get('REMOTE',0)
        ws.append([m['name'],wd,p,cnt.get('ABSENT',0),cnt.get('LATE',0),cnt.get('LEAVE',0),rv,
                   "{:.1f}%".format((p+rv)/wd*100) if wd else "0%",''])
    buf=io.BytesIO(); wb.save(buf); buf.seek(0)
    return send_file(buf,mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                     as_attachment=True,download_name="{}_签到_{}.xlsx".format(gn,yr))
