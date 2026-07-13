# -*- coding: utf-8 -*-
"""Daily plan templates, daily plan slots, and deadline reminders."""
import datetime
from flask import Blueprint, request, jsonify
from .db import get_db, r2d, rs
from .utils import today, current_user, login_required

dayplan_bp = Blueprint('dayplan', __name__)


def _plan_template_row(db, tpl):
    slots=rs(db.execute("SELECT * FROM plan_template_slots WHERE template_id=? ORDER BY sort_order,id",(tpl['id'],)).fetchall())
    tpl['slots']=slots
    return tpl


@dayplan_bp.route('/api/plan/templates')
@login_required
def list_plan_templates():
    u=current_user(); db=get_db()
    rows=rs(db.execute("SELECT * FROM plan_templates WHERE member_id=? ORDER BY id",(u['id'],)).fetchall())
    return jsonify([_plan_template_row(db,r) for r in rows])


@dayplan_bp.route('/api/plan/templates', methods=['POST'])
@login_required
def add_plan_template():
    u=current_user(); db=get_db(); d=request.json or {}
    name=(d.get('name') or '').strip()
    if not name: return jsonify({'error':'模板名称不能为空'}),400
    c=db.execute("INSERT INTO plan_templates(member_id,name) VALUES(?,?)",(u['id'],name))
    tid=c.lastrowid
    for i,s in enumerate(d.get('slots') or []):
        db.execute("INSERT INTO plan_template_slots(template_id,start_time,end_time,default_content,sort_order) VALUES(?,?,?,?,?)",
            (tid,s.get('start_time'),s.get('end_time'),s.get('default_content'),i))
    db.commit()
    return jsonify(_plan_template_row(db,r2d(db.execute("SELECT * FROM plan_templates WHERE id=?",(tid,)).fetchone()))),201


@dayplan_bp.route('/api/plan/templates/<int:tpl_id>', methods=['PUT'])
@login_required
def upd_plan_template(tpl_id):
    u=current_user(); db=get_db()
    existing=r2d(db.execute("SELECT * FROM plan_templates WHERE id=?",(tpl_id,)).fetchone())
    if not existing: return ('',404)
    if existing['member_id']!=u['id']: return jsonify({'error':'无权限'}),403
    d=request.json or {}
    name=(d.get('name') or '').strip()
    if not name: return jsonify({'error':'模板名称不能为空'}),400
    db.execute("UPDATE plan_templates SET name=? WHERE id=?",(name,tpl_id))
    db.execute("DELETE FROM plan_template_slots WHERE template_id=?",(tpl_id,))
    for i,s in enumerate(d.get('slots') or []):
        db.execute("INSERT INTO plan_template_slots(template_id,start_time,end_time,default_content,sort_order) VALUES(?,?,?,?,?)",
            (tpl_id,s.get('start_time'),s.get('end_time'),s.get('default_content'),i))
    db.commit()
    return jsonify(_plan_template_row(db,r2d(db.execute("SELECT * FROM plan_templates WHERE id=?",(tpl_id,)).fetchone())))


@dayplan_bp.route('/api/plan/templates/<int:tpl_id>', methods=['DELETE'])
@login_required
def del_plan_template(tpl_id):
    u=current_user(); db=get_db()
    existing=r2d(db.execute("SELECT * FROM plan_templates WHERE id=?",(tpl_id,)).fetchone())
    if not existing: return ('',404)
    if existing['member_id']!=u['id']: return jsonify({'error':'无权限'}),403
    db.execute("DELETE FROM plan_templates WHERE id=?",(tpl_id,)); db.commit()
    return '',204


def _active_reminders_for_date(db, member_id, plan_date):
    """Reminders relevant to planning `plan_date`: within their remind window
    (due_date - remind_days .. due_date), or overdue and still pending."""
    rows=rs(db.execute("SELECT * FROM plan_reminders WHERE member_id=? AND status='PENDING' ORDER BY due_date,id",(member_id,)).fetchall())
    d=datetime.date.fromisoformat(plan_date)
    out=[]
    for r in rows:
        due=datetime.date.fromisoformat(r['due_date'])
        days_left=(due-d).days
        r['days_left']=days_left
        if d>due:
            r['is_overdue']=True
            out.append(r)
        elif due-datetime.timedelta(days=int(r.get('remind_days') or 0))<=d<=due:
            r['is_overdue']=False
            out.append(r)
    return out


def _get_daily_plan(db, member_id, plan_date):
    plan=r2d(db.execute("SELECT * FROM daily_plans WHERE member_id=? AND plan_date=?",(member_id,plan_date)).fetchone())
    reminders=_active_reminders_for_date(db,member_id,plan_date)
    if not plan: return {'date':plan_date,'slots':[],'reminders':reminders}
    slots=rs(db.execute("SELECT * FROM daily_plan_slots WHERE daily_plan_id=? ORDER BY sort_order,id",(plan['id'],)).fetchall())
    plan['date']=plan['plan_date']; plan['slots']=slots; plan['reminders']=reminders
    return plan


@dayplan_bp.route('/api/plan/day/<dt>')
@login_required
def get_daily_plan(dt):
    u=current_user()
    return jsonify(_get_daily_plan(get_db(),u['id'],dt))


@dayplan_bp.route('/api/plan/reminders')
@login_required
def list_plan_reminders():
    u=current_user(); db=get_db()
    status=request.args.get('status')
    if status:
        rows=rs(db.execute("SELECT * FROM plan_reminders WHERE member_id=? AND status=? ORDER BY due_date,id",(u['id'],status)).fetchall())
    else:
        rows=rs(db.execute("SELECT * FROM plan_reminders WHERE member_id=? ORDER BY due_date,id",(u['id'],)).fetchall())
    return jsonify(rows)


@dayplan_bp.route('/api/plan/reminders', methods=['POST'])
@login_required
def add_plan_reminder():
    u=current_user(); db=get_db(); d=request.json or {}
    content=(d.get('content') or '').strip()
    due_date=d.get('due_date')
    if not content: return jsonify({'error':'事项内容不能为空'}),400
    if not due_date: return jsonify({'error':'截止日期不能为空'}),400
    remind_days=int(d.get('remind_days') or 2)
    c=db.execute("INSERT INTO plan_reminders(member_id,content,due_date,remind_days) VALUES(?,?,?,?)",
        (u['id'],content,due_date,remind_days))
    db.commit()
    return jsonify(r2d(db.execute("SELECT * FROM plan_reminders WHERE id=?",(c.lastrowid,)).fetchone())),201


@dayplan_bp.route('/api/plan/reminders/<int:rid>', methods=['PUT'])
@login_required
def upd_plan_reminder(rid):
    u=current_user(); db=get_db()
    existing=r2d(db.execute("SELECT * FROM plan_reminders WHERE id=?",(rid,)).fetchone())
    if not existing: return ('',404)
    if existing['member_id']!=u['id']: return jsonify({'error':'无权限'}),403
    d=request.json or {}
    content=(d.get('content') if d.get('content') is not None else existing['content']).strip()
    due_date=d.get('due_date') or existing['due_date']
    remind_days=int(d.get('remind_days') if d.get('remind_days') is not None else existing['remind_days'])
    status=d.get('status') or existing['status']
    if not content: return jsonify({'error':'事项内容不能为空'}),400
    db.execute("UPDATE plan_reminders SET content=?,due_date=?,remind_days=?,status=? WHERE id=?",
        (content,due_date,remind_days,status,rid))
    db.commit()
    return jsonify(r2d(db.execute("SELECT * FROM plan_reminders WHERE id=?",(rid,)).fetchone()))


@dayplan_bp.route('/api/plan/reminders/<int:rid>', methods=['DELETE'])
@login_required
def del_plan_reminder(rid):
    u=current_user(); db=get_db()
    existing=r2d(db.execute("SELECT * FROM plan_reminders WHERE id=?",(rid,)).fetchone())
    if not existing: return ('',404)
    if existing['member_id']!=u['id']: return jsonify({'error':'无权限'}),403
    db.execute("DELETE FROM plan_reminders WHERE id=?",(rid,)); db.commit()
    return '',204


@dayplan_bp.route('/api/plan/history')
@login_required
def plan_history():
    u=current_user(); db=get_db()
    month=request.args.get('month') or today()[:7]
    rows=db.execute("""SELECT dp.plan_date as plan_date, COUNT(s.id) as slot_count
        FROM daily_plans dp LEFT JOIN daily_plan_slots s ON s.daily_plan_id=dp.id
        WHERE dp.member_id=? AND dp.plan_date LIKE ?
        GROUP BY dp.id ORDER BY dp.plan_date DESC""",(u['id'],month+'%')).fetchall()
    return jsonify(rs(rows))


def _save_daily_plan_slots(db, member_id, plan_date, slots):
    row=db.execute("SELECT id FROM daily_plans WHERE member_id=? AND plan_date=?",(member_id,plan_date)).fetchone()
    if row:
        plan_id=row['id']
    else:
        plan_id=db.execute("INSERT INTO daily_plans(member_id,plan_date) VALUES(?,?)",(member_id,plan_date)).lastrowid
    db.execute("DELETE FROM daily_plan_slots WHERE daily_plan_id=?",(plan_id,))
    for i,s in enumerate(slots or []):
        db.execute("""INSERT INTO daily_plan_slots(daily_plan_id,start_time,end_time,content,task_id,sort_order,completed,progress,hours)
            VALUES(?,?,?,?,?,?,?,?,?)""",
            (plan_id,s.get('start_time'),s.get('end_time'),s.get('content'),s.get('task_id') or None,i,
             s.get('completed') or 0, s.get('progress'), s.get('hours') or 0))
    db.commit()
    return plan_id


@dayplan_bp.route('/api/plan/day', methods=['POST'])
@login_required
def save_daily_plan():
    u=current_user(); db=get_db(); d=request.json or {}
    plan_date=d.get('date')
    if not plan_date: return jsonify({'error':'日期不能为空'}),400
    _save_daily_plan_slots(db,u['id'],plan_date,d.get('slots'))
    return jsonify(_get_daily_plan(db,u['id'],plan_date))


@dayplan_bp.route('/api/plan/day/apply_template', methods=['POST'])
@login_required
def apply_plan_template():
    u=current_user(); db=get_db(); d=request.json or {}
    plan_date=d.get('date'); tpl_id=d.get('template_id')
    if not plan_date or not tpl_id: return jsonify({'error':'参数缺失'}),400
    tpl=r2d(db.execute("SELECT * FROM plan_templates WHERE id=?",(tpl_id,)).fetchone())
    if not tpl or tpl['member_id']!=u['id']: return jsonify({'error':'无权限'}),403
    tpl_slots=rs(db.execute("SELECT * FROM plan_template_slots WHERE template_id=? ORDER BY sort_order,id",(tpl_id,)).fetchall())
    slots=[{'start_time':s['start_time'],'end_time':s['end_time'],'content':s.get('default_content'),'task_id':None} for s in tpl_slots]
    _save_daily_plan_slots(db,u['id'],plan_date,slots)
    return jsonify(_get_daily_plan(db,u['id'],plan_date))
