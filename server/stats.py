# -*- coding: utf-8 -*-
"""Cross-task statistics: on-time delivery rate and per-member time allocation."""
import calendar
from collections import defaultdict
from flask import Blueprint, request, jsonify
from .db import get_db, r2d, rs
from .utils import workdays, current_user, login_required

stats_bp = Blueprint('stats', __name__)


@stats_bp.route('/api/stats/delivery')
@login_required
def delivery_stats():
    """
    Delivery performance per member.
    Returns on-time rate, delivered count, late count, sorted by on_time_rate desc.
    member_ids: comma-separated, optional filter
    """
    u = current_user()
    gn = request.args.get('group_name', u.get('group_name',''))
    if not u['is_admin'] and u['group_name']!=gn: return jsonify({'error':'无权限'}),403
    start = request.args.get('startMonth', '')
    end   = request.args.get('endMonth', '')
    member_ids_param = request.args.get('member_ids', '')  # "1,2,3" or ""

    db = get_db()
    # Base query: REQUIREMENT/QUALITY tasks in range
    if u['is_admin']:
        base = "task_type IN ('REQUIREMENT','QUALITY') AND group_name=?"
        params = [gn]
    else:
        base = "task_type IN ('REQUIREMENT','QUALITY') AND group_name=?"
        params = [gn]

    if start: base += " AND delivery_month>=?"; params.append(start)
    if end:   base += " AND delivery_month<=?"; params.append(end)

    tasks = rs(db.execute(f"SELECT * FROM tasks WHERE {base}", params).fetchall())

    # Non-admins are always locked to their own data; admins may filter by member_ids
    if not u['is_admin']:
        tasks = [t for t in tasks if t.get('assignee_id') == u['id']]
    elif member_ids_param:
        selected_mids = set(int(x) for x in member_ids_param.split(',') if x.strip().isdigit())
        tasks = [t for t in tasks if t.get('assignee_id') in selected_mids]

    # Group by assignee
    member_tasks = defaultdict(list)
    for t in tasks:
        mid = t.get('assignee_id')
        if mid:
            member_tasks[mid].append(t)

    results = []
    for mid, mtasks in member_tasks.items():
        name = next((t['assignee_name'] for t in mtasks if t['assignee_name']), str(mid))
        delivered = [t for t in mtasks if t['status'] == 'DELIVERED']
        total     = len(mtasks)
        d_count   = len(delivered)
        # On time = delivered AND actual_end_date <= plan_end_date
        on_time   = sum(1 for t in delivered
                        if t.get('actual_end_date') and t.get('plan_end_date')
                        and t['actual_end_date'] <= t['plan_end_date'])
        late_del  = d_count - on_time
        on_time_rate = round(on_time / d_count * 100, 1) if d_count > 0 else 0.0
        results.append({
            'memberId':     mid,
            'memberName':   name,
            'total':        total,
            'delivered':    d_count,
            'onTime':       on_time,
            'lateDelivery': late_del,
            'inProgress':   sum(1 for t in mtasks if t['status'] in ('IN_PROGRESS','TESTING','PENDING')),
            'onTimeRate':   on_time_rate,
        })

    # Sort by on_time_rate desc, then delivered desc
    results.sort(key=lambda x: (-x['onTimeRate'], -x['delivered']))
    return jsonify({'members': results, 'top3': results[:3]})


@stats_bp.route('/api/stats/timelog')
@login_required
def timelog_stats():
    """
    Per-member time allocation: hours spent per task, per task type, per day.
    Non-admins are locked to their own data; admins may pass any member_id.
    """
    u = current_user()
    member_id = request.args.get('member_id', type=int)
    if not u['is_admin']:
        member_id = u['id']
    if not member_id:
        return jsonify({'error':'member_id 不能为空'}), 400

    db = get_db()
    member = r2d(db.execute("SELECT id,name FROM members WHERE id=?", (member_id,)).fetchone())
    if not member: return jsonify({'error':'成员不存在'}), 404

    start = request.args.get('startMonth', '')
    end   = request.args.get('endMonth', '') or start

    q = """SELECT l.task_id,l.log_date,l.hours,t.title as task_title,t.task_type
           FROM task_logs l JOIN tasks t ON l.task_id=t.id WHERE l.member_id=?"""
    params = [member_id]
    if start: q += " AND l.log_date>=?"; params.append(start+'-01')
    if end:
        ey, em = map(int, end.split('-'))
        q += " AND l.log_date<=?"; params.append("{}-{:02d}".format(end, calendar.monthrange(ey,em)[1]))
    rows = rs(db.execute(q, params).fetchall())

    by_task = {}
    by_type = {}
    by_date = {}
    total_hours = 0.0
    for r in rows:
        h = r.get('hours') or 0.0
        total_hours += h
        tid = r['task_id']
        if tid not in by_task:
            by_task[tid] = {'taskId': tid, 'title': r['task_title'], 'taskType': r['task_type'], 'hours': 0.0, 'logCount': 0}
        by_task[tid]['hours'] += h
        by_task[tid]['logCount'] += 1
        by_type[r['task_type']] = by_type.get(r['task_type'], 0.0) + h
        by_date[r['log_date']] = by_date.get(r['log_date'], 0.0) + h

    task_list = sorted(by_task.values(), key=lambda x: -x['hours'])
    for t in task_list: t['hours'] = round(t['hours'], 2)
    by_type = {k: round(v, 2) for k, v in by_type.items()}
    by_date = {k: round(v, 2) for k, v in by_date.items()}

    total_wd = 0
    if start:
        sy, sm = map(int, start.split('-'))
        ey, em = map(int, end.split('-'))
        y, m = sy, sm
        while (y, m) <= (ey, em):
            total_wd += workdays(y, m)
            m += 1
            if m > 12: m = 1; y += 1

    return jsonify({
        'memberId': member_id, 'memberName': member['name'],
        'startMonth': start, 'endMonth': end,
        'totalHours': round(total_hours, 2),
        'totalWorkDays': total_wd,
        'avgHoursPerWorkday': round(total_hours/total_wd, 2) if total_wd else 0,
        'byTask': task_list,
        'byType': by_type,
        'byDate': by_date,
    })
