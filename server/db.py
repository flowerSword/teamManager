# -*- coding: utf-8 -*-
"""SQLite connection handling, schema/migrations, and small row helpers."""
import os, sqlite3, hashlib
from flask import g

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH  = os.path.join(BASE_DIR, 'data', 'teammanager.db')
os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)


def get_db():
    if 'db' not in g:
        g.db = sqlite3.connect(DB_PATH)
        g.db.row_factory = sqlite3.Row
        g.db.execute("PRAGMA journal_mode=WAL")
        g.db.execute("PRAGMA foreign_keys=ON")
    return g.db


def close_db(e=None):
    db = g.pop('db', None)
    if db: db.close()


def hash_pw(pw): return hashlib.sha256(pw.encode()).hexdigest()


def r2d(r): return dict(r) if r else None
def rs(rows): return [dict(r) for r in rows]


# 8:00-24:00 built-in schedules, with lunch break 12:30-14:00 and dinner break 17:30-19:00
DEFAULT_PLAN_TEMPLATES = [
    ('标准日程（1小时制）', [
        ('08:00','09:00','工作'), ('09:00','10:00','工作'), ('10:00','11:00','工作'),
        ('11:00','12:00','工作'), ('12:00','12:30','工作'), ('12:30','14:00','午休'),
        ('14:00','15:00','工作'), ('15:00','16:00','工作'), ('16:00','17:00','工作'),
        ('17:00','17:30','工作'), ('17:30','19:00','晚休'),
        ('19:00','20:00','工作'), ('20:00','21:00','工作'), ('21:00','22:00','工作'),
        ('22:00','23:00','工作'), ('23:00','24:00','工作'),
    ]),
    ('标准日程（2小时制）', [
        ('08:00','10:00','工作'), ('10:00','12:00','工作'), ('12:00','12:30','工作'),
        ('12:30','14:00','午休'), ('14:00','16:00','工作'), ('16:00','17:30','工作'),
        ('17:30','19:00','晚休'), ('19:00','21:00','工作'), ('21:00','23:00','工作'),
        ('23:00','24:00','工作'),
    ]),
]


def seed_default_plan_templates(db, member_id):
    for name, slots in DEFAULT_PLAN_TEMPLATES:
        tid = db.execute("INSERT INTO plan_templates(member_id,name) VALUES(?,?)",(member_id,name)).lastrowid
        for i,(st,et,content) in enumerate(slots):
            db.execute("INSERT INTO plan_template_slots(template_id,start_time,end_time,default_content,sort_order) VALUES(?,?,?,?,?)",
                (tid,st,et,content,i))


def init_db():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    db = sqlite3.connect(DB_PATH)
    db.executescript("""
PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL, username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL DEFAULT '',
    email TEXT, phone TEXT, role TEXT DEFAULT 'DEVELOPER',
    group_name TEXT, is_admin INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    employee_no TEXT,
    created_at TEXT DEFAULT (datetime('now','localtime'))
);
CREATE TABLE IF NOT EXISTS check_ins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    member_id INTEGER NOT NULL REFERENCES members(id),
    check_date TEXT NOT NULL, check_in_time TEXT,
    status TEXT DEFAULT 'PRESENT', remark TEXT,
    created_at TEXT DEFAULT (datetime('now','localtime')),
    UNIQUE(member_id, check_date)
);
CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL, description TEXT,
    task_type TEXT DEFAULT 'REQUIREMENT',
    status TEXT DEFAULT 'PENDING', priority TEXT DEFAULT 'MEDIUM',
    severity TEXT, issue_type TEXT,
    assignee_id INTEGER, assignee_name TEXT,
    reporter_name TEXT, group_name TEXT,
    plan_start_date TEXT, plan_end_date TEXT, actual_end_date TEXT,
    delivery_month TEXT, progress INTEGER DEFAULT 0,
    has_risk INTEGER DEFAULT 0, risk_description TEXT,
    version TEXT, module TEXT, location TEXT,
    estimated_days INTEGER DEFAULT 0,
    parent_task_id INTEGER,
    created_by INTEGER,
    created_at TEXT DEFAULT (datetime('now','localtime')),
    updated_at TEXT DEFAULT (datetime('now','localtime'))
);
CREATE TABLE IF NOT EXISTS task_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    member_id INTEGER NOT NULL, member_name TEXT,
    log_date TEXT NOT NULL, content TEXT NOT NULL,
    progress_snapshot INTEGER, status_snapshot TEXT,
    hours REAL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now','localtime'))
);
CREATE TABLE IF NOT EXISTS system_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT DEFAULT (datetime('now','localtime'))
);
CREATE TABLE IF NOT EXISTS plan_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    member_id INTEGER NOT NULL REFERENCES members(id),
    name TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now','localtime'))
);
CREATE TABLE IF NOT EXISTS plan_template_slots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    template_id INTEGER NOT NULL REFERENCES plan_templates(id) ON DELETE CASCADE,
    start_time TEXT NOT NULL, end_time TEXT NOT NULL,
    default_content TEXT, sort_order INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS daily_plans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    member_id INTEGER NOT NULL REFERENCES members(id),
    plan_date TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now','localtime')),
    UNIQUE(member_id, plan_date)
);
CREATE TABLE IF NOT EXISTS daily_plan_slots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    daily_plan_id INTEGER NOT NULL REFERENCES daily_plans(id) ON DELETE CASCADE,
    start_time TEXT NOT NULL, end_time TEXT NOT NULL,
    content TEXT, task_id INTEGER, sort_order INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS overtime_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    member_id INTEGER NOT NULL REFERENCES members(id),
    employee_no TEXT, member_name TEXT,
    start_date TEXT NOT NULL, start_time TEXT NOT NULL,
    end_date TEXT NOT NULL, end_time TEXT NOT NULL,
    rest_start_time TEXT, rest_end_time TEXT,
    overtime_type TEXT NOT NULL,
    reason TEXT,
    locked INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now','localtime')),
    updated_at TEXT DEFAULT (datetime('now','localtime'))
);
CREATE TABLE IF NOT EXISTS overtime_attachments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    overtime_id INTEGER NOT NULL REFERENCES overtime_requests(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    mimetype TEXT,
    size INTEGER,
    data BLOB NOT NULL,
    created_at TEXT DEFAULT (datetime('now','localtime'))
);
CREATE TABLE IF NOT EXISTS plan_reminders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    member_id INTEGER NOT NULL REFERENCES members(id),
    content TEXT NOT NULL,
    due_date TEXT NOT NULL,
    remind_days INTEGER DEFAULT 2,
    status TEXT DEFAULT 'PENDING',
    created_at TEXT DEFAULT (datetime('now','localtime'))
);
CREATE TABLE IF NOT EXISTS groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    created_at TEXT DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS idx_ci ON check_ins(member_id, check_date);
CREATE INDEX IF NOT EXISTS idx_tg ON tasks(group_name);
CREATE INDEX IF NOT EXISTS idx_ta ON tasks(assignee_id);
CREATE INDEX IF NOT EXISTS idx_tt ON tasks(task_type);
CREATE INDEX IF NOT EXISTS idx_lt ON task_logs(task_id);
CREATE INDEX IF NOT EXISTS idx_lm ON task_logs(member_id);
CREATE INDEX IF NOT EXISTS idx_pt ON plan_templates(member_id);
CREATE INDEX IF NOT EXISTS idx_pts ON plan_template_slots(template_id);
CREATE INDEX IF NOT EXISTS idx_dp ON daily_plans(member_id, plan_date);
CREATE INDEX IF NOT EXISTS idx_dps ON daily_plan_slots(daily_plan_id);
CREATE INDEX IF NOT EXISTS idx_pr ON plan_reminders(member_id, due_date);
CREATE INDEX IF NOT EXISTS idx_ot ON overtime_requests(member_id, start_date);
CREATE INDEX IF NOT EXISTS idx_ota ON overtime_attachments(overtime_id);
""")
    # Migration: add estimated_days if not exists
    try:
        db.execute("ALTER TABLE tasks ADD COLUMN estimated_days INTEGER DEFAULT 0")
        db.commit()
    except: pass
    try:
        db.execute("ALTER TABLE tasks ADD COLUMN parent_task_id INTEGER")
        db.commit()
    except: pass
    try:
        db.execute("ALTER TABLE tasks ADD COLUMN requirement_no TEXT")
        db.commit()
    except: pass
    try:
        db.execute("ALTER TABLE tasks ADD COLUMN issue_no TEXT")
        db.commit()
    except: pass
    # Migration: add ip_address to check_ins
    try:
        db.execute("ALTER TABLE check_ins ADD COLUMN ip_address TEXT")
        db.commit()
    except: pass
    try:
        db.execute("ALTER TABLE task_logs ADD COLUMN hours REAL DEFAULT 0")
        db.commit()
    except: pass
    try:
        db.execute("ALTER TABLE daily_plan_slots ADD COLUMN completed INTEGER DEFAULT 0")
        db.commit()
    except: pass
    try:
        db.execute("ALTER TABLE daily_plan_slots ADD COLUMN progress INTEGER")
        db.commit()
    except: pass
    try:
        db.execute("ALTER TABLE daily_plan_slots ADD COLUMN hours REAL DEFAULT 0")
        db.commit()
    except: pass
    try:
        db.execute("ALTER TABLE members ADD COLUMN employee_no TEXT")
        db.commit()
    except: pass
    try:
        db.execute("ALTER TABLE members ADD COLUMN can_cross_group INTEGER DEFAULT 0")
        db.commit()
    except: pass
    try:
        db.execute("ALTER TABLE tasks ADD COLUMN project_name TEXT")
        db.commit()
    except: pass
    try:
        admin_pw = hash_pw('admin123')
        default_pw = hash_pw('123456')
        db.execute("INSERT OR IGNORE INTO members(name,username,password,role,group_name,is_admin) VALUES(?,?,?,?,?,?)",
                   ('管理员','admin',admin_pw,'ADMIN','研发一组',1))
        # Migration: if admin group_name is empty, set it to the first active non-admin member's group
        admin_row = db.execute("SELECT group_name FROM members WHERE username='admin'").fetchone()
        if not admin_row or not admin_row[0]:
            first_group = db.execute("SELECT group_name FROM members WHERE is_active=1 AND is_admin=0 AND group_name!='' LIMIT 1").fetchone()
            if first_group:
                db.execute("UPDATE members SET group_name=? WHERE username='admin'", (first_group[0],))
        for row in [('张三','zhangsan','研发一组','LEADER'),
                    ('李四','lisi','研发一组','DEVELOPER'),
                    ('王五','wangwu','研发一组','DEVELOPER'),
                    ('赵六','zhaoliu','研发一组','TESTER')]:
            db.execute("INSERT OR IGNORE INTO members(name,username,password,role,group_name,is_admin) VALUES(?,?,?,?,?,0)",
                       (row[0],row[1],default_pw,row[3],row[2]))
        db.commit()
        # default late threshold: 09:00
        db.execute("INSERT OR IGNORE INTO system_config(key,value) VALUES('late_threshold','09:00')")
        db.commit()
    except: pass
    # Migration: seed built-in daily-plan templates (once) for members who have none yet
    try:
        seeded = db.execute("SELECT value FROM system_config WHERE key='seeded_default_plan_templates'").fetchone()
        if not seeded:
            rows = db.execute("SELECT id FROM members WHERE id NOT IN (SELECT DISTINCT member_id FROM plan_templates)").fetchall()
            for row in rows:
                seed_default_plan_templates(db, row[0])
            db.execute("INSERT OR IGNORE INTO system_config(key,value) VALUES('seeded_default_plan_templates','1')")
            db.commit()
    except: pass
    # Migration: seed built-in groups (once) + self-heal any group_name in use that's missing a groups row
    try:
        seeded = db.execute("SELECT value FROM system_config WHERE key='seeded_default_groups'").fetchone()
        if not seeded:
            for gname in ('研发一组','研发二组','测试组','产品组'):
                db.execute("INSERT OR IGNORE INTO groups(name) VALUES(?)", (gname,))
            db.execute("INSERT OR IGNORE INTO system_config(key,value) VALUES('seeded_default_groups','1')")
        for row in db.execute("SELECT DISTINCT group_name FROM members WHERE group_name IS NOT NULL AND group_name!=''").fetchall():
            db.execute("INSERT OR IGNORE INTO groups(name) VALUES(?)", (row[0],))
        db.commit()
    except: pass
    # Migration: seed a best-effort CN public holiday calendar (once) for the Gantt
    # weekend/holiday markers. Dates are approximate/for reference only — admins can
    # freely add/edit/remove them from 配置管理 once the State Council publishes the
    # official schedule for a given year (esp. years not yet announced).
    try:
        seeded = db.execute("SELECT value FROM system_config WHERE key='cn_holidays'").fetchone()
        if not seeded:
            import json as _json
            default_holidays = {
                '2024-01-01':'元旦','2024-02-10':'春节','2024-02-11':'春节','2024-02-12':'春节',
                '2024-02-13':'春节','2024-02-14':'春节','2024-02-15':'春节','2024-02-16':'春节','2024-02-17':'春节',
                '2024-04-04':'清明节','2024-04-05':'清明节','2024-04-06':'清明节',
                '2024-05-01':'劳动节','2024-05-02':'劳动节','2024-05-03':'劳动节','2024-05-04':'劳动节','2024-05-05':'劳动节',
                '2024-06-08':'端午节','2024-06-09':'端午节','2024-06-10':'端午节',
                '2024-09-15':'中秋节','2024-09-16':'中秋节','2024-09-17':'中秋节',
                '2024-10-01':'国庆节','2024-10-02':'国庆节','2024-10-03':'国庆节','2024-10-04':'国庆节',
                '2024-10-05':'国庆节','2024-10-06':'国庆节','2024-10-07':'国庆节',
                '2025-01-01':'元旦',
                '2025-01-28':'春节','2025-01-29':'春节','2025-01-30':'春节','2025-01-31':'春节',
                '2025-02-01':'春节','2025-02-02':'春节','2025-02-03':'春节','2025-02-04':'春节',
                '2025-04-04':'清明节','2025-04-05':'清明节','2025-04-06':'清明节',
                '2025-05-01':'劳动节','2025-05-02':'劳动节','2025-05-03':'劳动节','2025-05-04':'劳动节','2025-05-05':'劳动节',
                '2025-05-31':'端午节','2025-06-01':'端午节','2025-06-02':'端午节',
                '2025-10-01':'国庆节','2025-10-02':'国庆节','2025-10-03':'国庆节','2025-10-04':'国庆节',
                '2025-10-05':'国庆节','2025-10-06':'中秋节','2025-10-07':'国庆节','2025-10-08':'国庆节',
                '2026-01-01':'元旦',
                '2026-02-16':'春节','2026-02-17':'春节','2026-02-18':'春节','2026-02-19':'春节',
                '2026-02-20':'春节','2026-02-21':'春节','2026-02-22':'春节',
                '2026-04-04':'清明节','2026-04-05':'清明节','2026-04-06':'清明节',
                '2026-05-01':'劳动节','2026-05-02':'劳动节','2026-05-03':'劳动节','2026-05-04':'劳动节','2026-05-05':'劳动节',
                '2026-06-19':'端午节','2026-06-20':'端午节','2026-06-21':'端午节',
                '2026-09-25':'中秋节','2026-09-26':'中秋节','2026-09-27':'中秋节',
                '2026-10-01':'国庆节','2026-10-02':'国庆节','2026-10-03':'国庆节','2026-10-04':'国庆节',
                '2026-10-05':'国庆节','2026-10-06':'国庆节','2026-10-07':'国庆节',
            }
            db.execute("INSERT OR IGNORE INTO system_config(key,value,updated_at) VALUES('cn_holidays',?,datetime('now','localtime'))",
                       (_json.dumps(default_holidays, ensure_ascii=False),))
            db.commit()
    except: pass
    db.close()
