# -*- coding: utf-8 -*-
"""Member CRUD (soft/hard delete)."""
from flask import Blueprint, request, jsonify
from .db import get_db, r2d, rs, hash_pw, seed_default_plan_templates
from .utils import current_user, login_required, admin_required

members_bp = Blueprint('members', __name__)


@members_bp.route('/api/members')
@login_required
def list_members():
    u=current_user(); db=get_db()
    if u['is_admin']:
        rows=db.execute("SELECT id,name,username,email,phone,role,group_name,is_admin,is_active,employee_no,created_at FROM members ORDER BY id").fetchall()
    else:
        rows=db.execute("SELECT id,name,username,email,phone,role,group_name,is_admin,is_active,employee_no,created_at FROM members WHERE group_name=? AND is_active=1 ORDER BY id",(u['group_name'],)).fetchall()
    return jsonify(rs(rows))


@members_bp.route('/api/members/active')
@login_required
def active_members():
    u=current_user(); db=get_db()
    if u['is_admin']:
        rows=db.execute("SELECT id,name,username,role,group_name,is_admin FROM members WHERE is_active=1 ORDER BY id").fetchall()
    else:
        rows=db.execute("SELECT id,name,username,role,group_name,is_admin FROM members WHERE group_name=? AND is_active=1 ORDER BY id",(u['group_name'],)).fetchall()
    return jsonify(rs(rows))


@members_bp.route('/api/members', methods=['POST'])
@admin_required
def add_member():
    d=request.json; db=get_db()
    raw=d.get('password','123456'); pw_store=hash_pw(raw) if d.get('pw_plain') else (raw if len(raw)==64 else hash_pw(raw))
    c=db.execute("INSERT INTO members(name,username,password,email,phone,role,group_name,is_admin,is_active,employee_no) VALUES(?,?,?,?,?,?,?,?,?,?)",
        (d['name'],d['username'],pw_store,d.get('email'),d.get('phone'),
         d.get('role','DEVELOPER'),d.get('group_name'),1 if d.get('is_admin') else 0,1 if d.get('is_active',True) else 0,
         d.get('employee_no')))
    seed_default_plan_templates(db, c.lastrowid)
    db.commit()
    row=db.execute("SELECT id,name,username,email,phone,role,group_name,is_admin,is_active,employee_no FROM members WHERE id=?",(c.lastrowid,)).fetchone()
    return jsonify(r2d(row)),201


@members_bp.route('/api/members/<int:mid>', methods=['PUT'])
@login_required
def upd_member(mid):
    u=current_user(); d=request.json; db=get_db()
    if not u['is_admin']:
        if mid!=u['id']: return jsonify({'error':'无权限'}),403
        db.execute("UPDATE members SET email=?,phone=? WHERE id=?",(d.get('email'),d.get('phone'),mid))
    else:
        db.execute("UPDATE members SET name=?,username=?,email=?,phone=?,role=?,group_name=?,is_admin=?,is_active=?,employee_no=? WHERE id=?",
            (d['name'],d['username'],d.get('email'),d.get('phone'),d.get('role','DEVELOPER'),
             d.get('group_name'),1 if d.get('is_admin') else 0,1 if d.get('is_active',True) else 0,d.get('employee_no'),mid))
        if d.get('password'):
            raw2=d['password']; pw2=hash_pw(raw2) if d.get('pw_plain') else (raw2 if len(raw2)==64 else hash_pw(raw2))
            db.execute("UPDATE members SET password=? WHERE id=?",(pw2,mid))
    db.commit()
    row=db.execute("SELECT id,name,username,email,phone,role,group_name,is_admin,is_active,employee_no FROM members WHERE id=?",(mid,)).fetchone()
    return jsonify(r2d(row)) if row else ('',404)


@members_bp.route('/api/members/<int:mid>', methods=['DELETE'])
@admin_required
def del_member(mid):
    u=current_user(); db=get_db()
    target=r2d(db.execute("SELECT * FROM members WHERE id=?",(mid,)).fetchone())
    if not target: return '',404
    # 只有 username='admin' 的超级管理员不可操作；普通管理员可被停用
    if target.get('username')=='admin': return jsonify({'error':'超级管理员账号不可停用'}),403
    # 非超级管理员不能操作同级管理员（可选：这里允许任意管理员互相停用）
    db.execute("UPDATE members SET is_active=0 WHERE id=?",(mid,)); db.commit(); return '',204


@members_bp.route('/api/members/<int:mid>/delete', methods=['DELETE'])
@admin_required
def hard_del_member(mid):
    """Hard delete a member - removes all their data."""
    db=get_db()
    target=r2d(db.execute("SELECT * FROM members WHERE id=?",(mid,)).fetchone())
    if not target: return '',404
    if target.get('username')=='admin': return jsonify({'error':'超级管理员账号不可删除'}),403
    # 删除关联数据
    db.execute("DELETE FROM check_ins WHERE member_id=?",(mid,))
    db.execute("DELETE FROM task_logs WHERE member_id=?",(mid,))
    # 任务：把 assignee 清空，不删任务本身
    db.execute("UPDATE tasks SET assignee_id=NULL,assignee_name='（已删除）' WHERE assignee_id=?",(mid,))
    db.execute("DELETE FROM members WHERE id=?",(mid,))
    db.commit()
    return jsonify({'ok':True})
