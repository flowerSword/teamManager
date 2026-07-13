# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the Application

```bash
# Linux/macOS
python app.py

# Windows
start.bat
```

The server starts at `http://127.0.0.1:8080` (port overridable via `PORT` env var) and auto-opens a browser tab after 1.5s. All dependencies are bundled in `wheels/` — no `pip install` needed.

Default credentials: `admin / admin123`, regular members use `123456`.

There is no test suite.

## Architecture

This is a **single-file Flask application** (`app.py`, ~1544 lines) with a bundled SPA frontend (`static/index.html`, ~3378 lines).

**Storage:** SQLite at `data/teammanager.db`, created automatically on first run. Schema is defined and migrated inside `init_db()`. WAL mode and foreign keys are enabled on every connection.

**DB tables:**
- `members` — users with role (`DEVELOPER`/`TESTER`/`LEADER`/`ADMIN`), group, `is_admin` flag, and `employee_no` (used by overtime requests)
- `check_ins` — daily attendance per member; statuses: `PRESENT`, `LATE`, `ABSENT`, `LEAVE`, `REMOTE`; `ip_address` column records the client LAN IP
- `tasks` — requirements/issues/onsite/other tasks with progress, risk, dates, and subtask support via `parent_task_id`
- `task_logs` — progress diary entries per task, snapshots task status/progress at log time, includes `hours` for time tracking
- `system_config` — key/value store (e.g. `late_threshold` for auto-LATE detection)
- `plan_templates` / `plan_template_slots` — reusable daily-plan time-slot templates per member
- `daily_plans` / `daily_plan_slots` — per-member per-day plan; each slot can link to a `task_id` and carries `completed`/`progress`/`hours` — checking a slot complete posts a `task_logs` entry and updates the linked task's progress
- `plan_reminders` — deadline reminders (`due_date`, `remind_days`) surfaced on the daily-plan page when within the reminder window or overdue
- `overtime_requests` — overtime submissions (member snapshot of `employee_no`/`member_name`, time range, rest period, `overtime_type`); `locked` flag freezes a row from all edits (including admin) until explicitly unlocked

**Auth:** Session-based (`flask.session`). Passwords stored as SHA-256 hex digest. The secret key is hardcoded (`team-mgr-2025-v3`). Login accepts either plaintext or pre-hashed passwords via `hashed: true` in the request body.

**Access control:** Two decorators — `@login_required` and `@admin_required`. Non-admin users are scoped to their own `group_name` throughout most queries. Overtime records are the exception — `/api/overtime` returns all members' records for the month regardless of group, but edit/delete is restricted to the owner (or admin) and only while `locked=0`.

**Check-in time gate:** Non-admin members cannot create a check-in for today before 04:00 server time (`checkin()` in `app.py`, member branch) — returns 403. Admin-entered check-ins (any date/time/status) are exempt.

**Auto-risk logic:** `auto_risk()` is called on every task create/update. A task past its `plan_end_date` is always force-flagged `has_risk=1` regardless of user choice. Otherwise, risk is only auto-computed when the user has manually set `has_risk=1`: flags within 1 day of `plan_end_date` with progress < 80%. A user-selected "no risk" is respected (not overridden) as long as the task isn't overdue.

**Excel export:** Uses `openpyxl` (bundled). Export routes are `/api/export/checkin/<gn>` and `/api/export/tasks/<gn>`.

## Frontend Architecture

`static/index.html` is a single-file vanilla JS SPA with no build step, no framework, and no external dependencies.

**Key globals:**
- `ME` — current user object (set after login)
- `PAGE` — active page name string
- `VIEW_MODE` — `'admin'` | `'member'` toggle for admin users to switch perspective

**API layer:** `api(path, opts)` wraps `fetch` against relative `/api/` paths. Convenience aliases: `GET(p)`, `POST(p, d)`, `PUT(p, d)`, `DEL(p)`.

**Passwords:** SHA-256 is implemented in pure JS (`sha256hex()`). Passwords are hashed client-side before sending, with `hashed: true` in the request body.

**Navigation:** `showPage(name)` renders a view; each view has a corresponding `render<ViewName>()` function.

**UI utilities:**
- `openModal(title, body, onSave, wide)` — shared modal dialog
- `toast(msg, type)` — transient notification (`'ok'` / `'err'`)
- `esc(s)` — HTML escape
- `sbadge(s)` / `tbadge(t)` — status/type badge renderer using lookup tables `SZ`/`SC` and `TZ`/`TC`

**Theme system:** 8 named color themes (`dark-blue` default, `dark-purple`, `dark-green`, `dark-red`, `carbon`, `ocean`, `forest`, `sunset`) applied via CSS custom properties on `:root`. Selected theme and background image are persisted in `localStorage` as `tm_theme` and `tm_bg`. Theme settings UI is admin-only.

**Check-in IP:** On login, the frontend calls `/api/myip` to get its LAN IP and caches it in `CLIENT_IP`. This value is sent as `clientIp` on every check-in. The server falls back to the machine's own LAN IP (`LOCAL_IPV4`) when the connection comes from localhost.

## API Surface

All routes are prefixed `/api/`. Key groupings:
- `/api/auth/*` — login, logout, me, change_password
- `/api/members` — CRUD (admin: all members; member: own group only)
- `/api/members/active` — active members list
- `/api/members/<id>` DELETE — **soft delete** (sets `is_active=0`)
- `/api/members/<id>/delete` DELETE — **hard delete** (removes member and all associated records)
- `/api/checkin` POST — single check-in (member: today only; admin: any date/status)
- `/api/checkin/bulk` POST — admin bulk check-in for multiple members
- `/api/checkin/today` — current user's today status
- `/api/checkin/today_all` — all members' today status for a group (admin)
- `/api/checkin/day/<dt>` — all check-ins for a date (admin)
- `/api/checkin/member/<id>` — single member's monthly records (admin)
- `/api/checkin/summary/group/<gn>` — monthly attendance summary
- `/api/checkin/summary/annual/<gn>` — annual attendance summary
- `/api/tasks` — CRUD, filterable by `type` query param
- `/api/tasks/mine` — current user's tasks
- `/api/tasks/risk` — tasks with `has_risk=1` or past deadline
- `/api/tasks/today_todo` — tasks spanning today (active, not completed)
- `/api/tasks/monthly_view` — tasks active in a month with daily log counts
- `/api/tasks/gantt` — Gantt for a single member
- `/api/tasks/gantt_multi` — Gantt for multiple members (admin)
- `/api/tasks/by_member` — tasks grouped by member with logs attached (admin)
- `/api/tasks/<id>/subtasks` — child tasks of a given `parent_task_id`
- `/api/tasks/stats/<gn>` — delivery count by month/status
- `/api/tasks/<id>/logs` — task progress diary (GET/POST)
- `/api/tasks/logs/mine` — current user's recent logs
- `/api/stats/delivery` — on-time delivery rate per member (REQUIREMENT tasks only; on-time = `actual_end_date <= plan_end_date`)
- `/api/stats/timelog` — a member's hours breakdown by task/type/date for a month range
- `/api/plan/templates` — CRUD for the current user's daily-plan templates
- `/api/plan/day/<dt>` / `/api/plan/day` POST — get/save a day's plan slots
- `/api/plan/day/apply_template` POST — generate a day's slots from a template
- `/api/plan/history` — slot-count summary of saved plans for a month
- `/api/plan/reminders` — CRUD for deadline reminders
- `/api/overtime` — GET (all members, filterable by `month`) / POST (submit, always as self)
- `/api/overtime/<id>` — PUT/DELETE, only when unlocked and owner or admin
- `/api/overtime/<id>/lock` POST — admin-only lock/unlock toggle; blocks all edits while locked
- `/api/config` — system configuration (admin write, all read)
- `/api/myip` — returns client IP as seen by the server
- `/api/export/checkin/<gn>` — Excel attendance export
- `/api/export/tasks/<gn>` — Excel task export

## Key Conventions

- `r2d(row)` converts a `sqlite3.Row` to a dict; `rs(rows)` converts a list of rows.
- `task_where(u)` builds a WHERE clause that scopes to `group_name` for non-admins and `1=1` for admins.
- `can_edit(u, task)` returns True if the user is admin, the assignee, or the creator.
- Migrations run inline in `init_db()` via `ALTER TABLE … ADD COLUMN` wrapped in bare `except: pass`.
- The `wheels/` directory is prepended to `sys.path` at module load — never import from it explicitly.
- Task type values: `REQUIREMENT`, `ISSUE`, `ONSITE`, `OTHER`.
- Task status values: `PENDING`, `IN_PROGRESS`, `TESTING`, `DELIVERED`, `CANCELLED`, `OPEN`, `RESOLVED`, `CLOSED`, `REJECTED`, `ONGOING`, `COMPLETED`.
- When a task is set to a completed status without `actual_end_date`, the backend auto-sets it to today and progress to 100.
- Static files have cache disabled globally (`SEND_FILE_MAX_AGE_DEFAULT=0`) plus explicit no-cache headers on the SPA route.
