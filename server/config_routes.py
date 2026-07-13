# -*- coding: utf-8 -*-
"""System config (/api/config) and /api/myip. Also home of get_config/set_config/
detect_status, which checkin.py depends on for the late-arrival threshold."""
from flask import Blueprint, request, jsonify
from .db import get_db
from .utils import now_str, login_required, admin_required

config_bp = Blueprint('config', __name__)


def get_config(key, default=''):
    row = get_db().execute("SELECT value FROM system_config WHERE key=?",(key,)).fetchone()
    return row['value'] if row else default


def set_config(key, value):
    db = get_db()
    db.execute("INSERT INTO system_config(key,value,updated_at) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at",
               (key, value, now_str()))
    db.commit()


def detect_status(check_time_str):
    """Auto-detect PRESENT vs LATE based on late_threshold config. check_time_str is HH:MM:SS or HH:MM"""
    threshold = get_config('late_threshold', '09:00')
    try:
        ct = check_time_str[:5]   # HH:MM
        return 'LATE' if ct > threshold else 'PRESENT'
    except:
        return 'PRESENT'


@config_bp.route('/api/config', methods=['GET'])
@login_required
def get_all_config():
    rows = get_db().execute("SELECT key,value FROM system_config").fetchall()
    return jsonify({r['key']: r['value'] for r in rows})


@config_bp.route('/api/config', methods=['POST'])
@admin_required
def update_config():
    d = request.json or {}
    for key, value in d.items():
        set_config(key, str(value))
    return jsonify({'ok': True})


@config_bp.route('/api/myip')
def my_ip():
    """返回服务器看到的客户端 IP（局域网直连时即为真实 IPv4）"""
    ip = (request.headers.get('X-Forwarded-For','').split(',')[0].strip()
          or request.headers.get('X-Real-IP','')
          or request.remote_addr or '')
    # 剥离 IPv6 映射前缀
    if ip.startswith('::ffff:'):
        ip = ip[7:]
    return jsonify({'ip': ip})
