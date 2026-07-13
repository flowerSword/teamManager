# -*- coding: utf-8 -*-
"""Overtime requests: CRUD, lock/unlock, and Excel export."""
import io, datetime
from flask import Blueprint, request, jsonify, send_file
from openpyxl import Workbook
from .db import get_db, r2d, rs
from .utils import today, now_str, current_user, login_required, admin_required
from .excel import mkhdr, title_cell

overtime_bp = Blueprint('overtime', __name__)


def _can_edit_overtime(u, row):
    return (not row['locked']) and (u['is_admin'] or row['member_id']==u['id'])


@overtime_bp.route('/api/overtime')
@login_required
def list_overtime():
    db=get_db()
    month=request.args.get('month') or today()[:7]
    rows=rs(db.execute("SELECT * FROM overtime_requests WHERE start_date LIKE ? ORDER BY start_date,id",(month+'%',)).fetchall())
    return jsonify(rows)


@overtime_bp.route('/api/overtime', methods=['POST'])
@login_required
def add_overtime():
    u=current_user(); d=request.json or {}; db=get_db()
    employee_no=d.get('employee_no') or u.get('employee_no')
    start_date=d.get('start_date'); start_time=d.get('start_time')
    end_date=d.get('end_date'); end_time=d.get('end_time')
    overtime_type=d.get('overtime_type')
    if not (employee_no and start_date and start_time and end_date and end_time and overtime_type):
        return jsonify({'error':'请填写完整的必填项'}),400
    if overtime_type not in ('转加班费','转调休'):
        return jsonify({'error':'加班类型不合法'}),400
    c=db.execute("""INSERT INTO overtime_requests(member_id,employee_no,member_name,start_date,start_time,end_date,end_time,
        rest_start_time,rest_end_time,overtime_type,reason) VALUES(?,?,?,?,?,?,?,?,?,?,?)""",
        (u['id'],employee_no,u['name'],start_date,start_time,end_date,end_time,
         d.get('rest_start_time'),d.get('rest_end_time'),overtime_type,d.get('reason')))
    db.commit()
    return jsonify(r2d(db.execute("SELECT * FROM overtime_requests WHERE id=?",(c.lastrowid,)).fetchone())),201


@overtime_bp.route('/api/overtime/<int:oid>', methods=['PUT'])
@login_required
def upd_overtime(oid):
    u=current_user(); d=request.json or {}; db=get_db()
    row=r2d(db.execute("SELECT * FROM overtime_requests WHERE id=?",(oid,)).fetchone())
    if not row: return '',404
    if not _can_edit_overtime(u,row): return jsonify({'error':'无权限'}),403
    start_date=d.get('start_date') or row['start_date']; start_time=d.get('start_time') or row['start_time']
    end_date=d.get('end_date') or row['end_date']; end_time=d.get('end_time') or row['end_time']
    overtime_type=d.get('overtime_type') or row['overtime_type']
    if overtime_type not in ('转加班费','转调休'):
        return jsonify({'error':'加班类型不合法'}),400
    db.execute("""UPDATE overtime_requests SET start_date=?,start_time=?,end_date=?,end_time=?,
        rest_start_time=?,rest_end_time=?,overtime_type=?,reason=?,updated_at=? WHERE id=?""",
        (start_date,start_time,end_date,end_time,
         d.get('rest_start_time',row.get('rest_start_time')),d.get('rest_end_time',row.get('rest_end_time')),
         overtime_type,d.get('reason',row.get('reason')),now_str(),oid))
    db.commit()
    return jsonify(r2d(db.execute("SELECT * FROM overtime_requests WHERE id=?",(oid,)).fetchone()))


@overtime_bp.route('/api/overtime/<int:oid>', methods=['DELETE'])
@login_required
def del_overtime(oid):
    u=current_user(); db=get_db()
    row=r2d(db.execute("SELECT * FROM overtime_requests WHERE id=?",(oid,)).fetchone())
    if not row: return '',404
    if not _can_edit_overtime(u,row): return jsonify({'error':'无权限'}),403
    db.execute("DELETE FROM overtime_requests WHERE id=?",(oid,)); db.commit()
    return '',204


@overtime_bp.route('/api/overtime/<int:oid>/lock', methods=['POST'])
@admin_required
def lock_overtime(oid):
    d=request.json or {}; db=get_db()
    row=db.execute("SELECT id FROM overtime_requests WHERE id=?",(oid,)).fetchone()
    if not row: return '',404
    db.execute("UPDATE overtime_requests SET locked=?,updated_at=? WHERE id=?",
        (1 if d.get('locked') else 0,now_str(),oid))
    db.commit()
    return jsonify(r2d(db.execute("SELECT * FROM overtime_requests WHERE id=?",(oid,)).fetchone()))


@overtime_bp.route('/api/export/overtime')
@admin_required
def exp_overtime():
    """Export overtime records to Excel. With `month`: single-month, one sheet.
    Without `month` (year only): whole year, one sheet per month (Jan-Dec).
    Group scope: 超级管理员(admin) may pass `groups` (comma-separated group names) to combine
    selected groups into one file, or omit it to export all groups. 普通管理员 are always
    locked to their own group_name, regardless of any `groups` param sent."""
    u=current_user()
    yr=int(request.args.get('year',datetime.date.today().year))
    mo=request.args.get('month')
    is_super=(u.get('username')=='admin')
    if is_super:
        raw_groups=[g.strip() for g in request.args.get('groups','').split(',') if g.strip()]
        group_list=raw_groups  # empty = all groups
        scope_label='全部组' if not group_list else '、'.join(group_list)
    else:
        group_list=[u.get('group_name') or '']
        scope_label=u.get('group_name') or ''
    db=get_db()
    headers=['所属组','工号','姓名','开始日期','开始时间','结束日期','结束时间','休息开始','休息结束','类型','理由','状态']
    widths=[12,12,10,12,10,12,10,10,10,10,26,10]
    wb=Workbook(); wb.remove(wb.active)
    months=[int(mo)] if mo else list(range(1,13))
    for m in months:
        month_str="{}-{:02d}".format(yr,m)
        sql="""SELECT o.*, m.group_name AS grp FROM overtime_requests o
               JOIN members m ON m.id=o.member_id WHERE o.start_date LIKE ?"""
        params=[month_str+'%']
        if group_list:
            sql+=" AND m.group_name IN ({})".format(','.join('?'*len(group_list)))
            params+=group_list
        sql+=" ORDER BY o.start_date,o.id"
        rows=rs(db.execute(sql,params).fetchall())
        ws=wb.create_sheet(title="{}年{}月".format(yr,m))
        title_cell(ws,"加班记录 {}年{}月（{}）".format(yr,m,scope_label),len(headers))
        mkhdr(ws,3,headers,widths)
        for r in rows:
            ws.append([r.get('grp') or '',r.get('employee_no') or '',r.get('member_name') or '',r['start_date'],r['start_time'],
                       r['end_date'],r['end_time'],r.get('rest_start_time') or '',r.get('rest_end_time') or '',
                       r.get('overtime_type') or '',r.get('reason') or '',
                       '已锁定' if r.get('locked') else '未锁定'])
    buf=io.BytesIO(); wb.save(buf); buf.seek(0)
    fname="加班记录_{}_{}-{:02d}.xlsx".format(scope_label,yr,int(mo)) if mo else "加班记录_{}_{}.xlsx".format(scope_label,yr)
    return send_file(buf,mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                     as_attachment=True,download_name=fname)
