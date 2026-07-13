# -*- coding: utf-8 -*-
"""Login/logout/me/change_password."""
from flask import Blueprint, request, jsonify, session
from .db import get_db, r2d, hash_pw
from .utils import current_user, login_required

auth_bp = Blueprint('auth', __name__)


@auth_bp.route('/api/auth/login', methods=['POST'])
def login():
    d=request.json or {}
    row=get_db().execute("SELECT * FROM members WHERE username=? AND is_active=1",(d.get('username','').strip(),)).fetchone()
    if not row: return jsonify({'error':'用户名不存在'}),401
    m=r2d(row)
    raw_pw = d.get('password','')
    already_hashed = d.get('hashed', False)
    # 兼容：前端传来的是 sha256(明文)，直接比对
    # 也兼容旧客户端直接传明文（再做一次hash）
    if already_hashed:
        pw_match = (m['password'] == raw_pw)
    else:
        pw_match = (m['password'] == hash_pw(raw_pw))
    if not pw_match: return jsonify({'error':'密码错误'}),401
    session['user_id']=m['id']; m.pop('password',None)
    return jsonify({'user':m})


@auth_bp.route('/api/auth/logout', methods=['POST'])
def logout(): session.clear(); return jsonify({'ok':True})


@auth_bp.route('/api/auth/me')
def me():
    u=current_user()
    if not u: return jsonify({'error':'未登录','code':401}),401
    u.pop('password',None); return jsonify({'user':u})


@auth_bp.route('/api/auth/change_password', methods=['POST'])
@login_required
def change_password():
    d=request.json or {}
    old_pw=d.get('old_password',''); new_pw=d.get('new_password','')
    already_hashed=d.get('hashed',False)
    db=get_db(); uid=session['user_id']
    row=db.execute("SELECT password FROM members WHERE id=?",(uid,)).fetchone()
    if not row: return jsonify({'error':'用户不存在'}),400
    # 验证旧密码
    if already_hashed:
        ok = (row['password'] == old_pw)
    else:
        ok = (row['password'] == hash_pw(old_pw))
    if not ok: return jsonify({'error':'原密码错误'}),400
    # 新密码存储：如果前端已hash直接存，否则再hash
    if already_hashed:
        if len(new_pw) != 64: return jsonify({'error':'密码格式错误'}),400
        stored_pw = new_pw
    else:
        if len(new_pw)<6: return jsonify({'error':'密码至少6位'}),400
        stored_pw = hash_pw(new_pw)
    db.execute("UPDATE members SET password=? WHERE id=?",(stored_pw,uid)); db.commit()
    return jsonify({'ok':True})
