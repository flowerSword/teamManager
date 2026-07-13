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

`app.py` (~27 lines) is a thin entry point only — it prepends `wheels/` to `sys.path`, then imports and runs the `server` package. All Flask routes/logic live in **`server/`**, a package of feature-based modules registered as Blueprints from `server/__init__.py:create_app()`. The frontend is split the same way: `static/index.html` is now a small shell (~77 lines) that loads `static/css/style.css` and a sequence of plain `static/js/<feature>.js` `<script>` tags — no bundler, no `npm install`, still zero build step. This split (both backend and frontend) happened in a refactor from an original single-file `app.py`/`index.html`; see "Backend file layout" and "Frontend file layout" below for what lives where.

**Storage:** SQLite at `data/teammanager.db`, created automatically on first run. Schema is defined and migrated inside `init_db()` (in `server/db.py`). WAL mode and foreign keys are enabled on every connection. Migrations are additive `ALTER TABLE` statements wrapped in bare `try/except: pass` — an old `data/teammanager.db` from a previous version is auto-upgraded in place the moment the new `app.py` starts; no manual migration step, no separate tool needed. Preserve this pattern for any future schema change instead of introducing a new migration mechanism.

### Backend file layout (`server/`)

- `db.py` — `DB_PATH`, `get_db()`/`close_db()` (per-request SQLite connection via Flask `g`), `hash_pw()`, `r2d()`/`rs()` row helpers, full schema + all migrations in `init_db()`, `seed_default_plan_templates()`.
- `utils.py` — `today()`/`now_str()`/`workdays()`, `auto_risk()`, `STATUS_ZH`/`TYPE_ZH` label maps, `current_user()`, `login_required`/`admin_required` decorators, `LOCAL_IPV4`/`get_local_ipv4()`.
- `excel.py` — shared `openpyxl` formatting helpers (`mkhdr`, `rf`, `title_cell`) used by every `/api/export/*` route.
- `config_routes.py` — `/api/config`, `/api/myip`, plus `get_config()`/`set_config()`/`detect_status()` (the late-arrival threshold logic `checkin.py` depends on).
- `auth.py`, `members.py`, `overtime.py`, `checkin.py`, `tasks.py`, `dayplan.py`, `stats.py` — one Blueprint per feature domain, routes unprefixed (full `/api/...` paths declared explicitly per route, mirroring the original).
- Import direction is strictly one-way: blueprint modules import from `db.py`/`utils.py`/`excel.py`/`config_routes.py`; those never import a blueprint. No circular imports.
- `wheels/` must be on `sys.path` **before** `server` is imported anywhere (Flask/openpyxl aren't pip-installed) — only `app.py` does this, so always run through `app.py`, never `python -m server` directly.

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

**Check-in time gate:** Non-admin members cannot create a check-in for today before 04:00 server time (`checkin()` in `server/checkin.py`, member branch) — returns 403. Admin-entered check-ins (any date/time/status) are exempt.

**Progress-log backdating limit:** `add_log()` in `server/tasks.py` rejects `log_date` older than `today - 3 days` for non-admins (400). Admins are exempt and can backfill any historical date.

**Auto-risk logic:** `auto_risk()` is called on every task create/update. A task past its `plan_end_date` is always force-flagged `has_risk=1` regardless of user choice. Otherwise, risk is only auto-computed when the user has manually set `has_risk=1`: flags within 1 day of `plan_end_date` with progress < 80%. A user-selected "no risk" is respected (not overridden) as long as the task isn't overdue.

**Excel export:** Uses `openpyxl` (bundled). Export routes are `/api/export/checkin/<gn>`, `/api/export/tasks/<gn>`, and `/api/export/overtime` (`year` + optional `month`; without `month` it produces one workbook with a sheet per month of that year, `wb.create_sheet` per month rather than reusing the default active sheet). `/api/export/overtime` is `@admin_required` (unlike the checkin/task exports, which are `@login_required` + manual group check): a 普通管理员's export is force-scoped to `u['group_name']` (any `groups` param they send is ignored server-side), while the super admin (`username=='admin'`) may pass a comma-separated `groups` param to merge specific groups into one file, or omit it for all groups — resolved via a `JOIN members` on `overtime_requests.member_id` since that table has no `group_name` column of its own.

## Frontend Architecture

Vanilla JS SPA, no build step, no framework, no external dependencies — now split across plain `<script src>` files instead of one inline block.

### Frontend file layout (`static/js/`, loaded in this exact order from `index.html`)

1. `core.js` — globals (`ME`, `PAGE`), `ICO` icon SVGs, `api()`/`GET`/`POST`/`PUT`/`DEL`, appearance/theme system, `toast`/`esc`/date helpers, status/type badge tables, pagination, `sha256hex()`, login/logout/`checkAuth()`, `initApp()`/`autoCheckIn()`, `buildNav()`/`showPage()`/`toggleViewMode()`, `openModal()`/`closeModal()`, the generic multi-select dropdown helper.
2. `dashboard.js` — admin + member dashboard (`renderAdminDash`, `renderMemberDash`).
3. `checkin.js` — `renderMyCi`, `renderCi` (admin check-in management).
4. `tasks.js` — task list/modal/log-panel + the member's own Gantt page (`renderMyTasks`, `renderTasks`, `renderGantt`, etc.).
5. `team.js` — `renderTeamView` (member read-only) + `renderTeam` (admin member CRUD page).
6. `reports.js` — `renderReports` (report center, all tabs).
7. `profile.js` — `renderProfile` (change password / self profile edit).
8. `member-view.js` — `renderMemberView` (admin per-person task+log drill-down).
9. `admin-gantt.js` — `renderAdminGantt` (multi-member Gantt).
10. `dayplan.js` — `renderDayPlan`, templates, reminders.
11. `overtime.js` — `renderOvertime`.
12. `progress.js` — `renderProgress` (进展记录: day/week/month/year timeline of the current user's own task-progress logs; replaced the old `monthly.js` monthly-calendar page).
13. `help.js` — `renderHelp`.
14. `boot.js` — **must load last**: just `initAppearance();checkAuth();`.

**Why load order matters:** these are classical (non-`module`, non-`defer`) scripts, so they execute synchronously in the order they appear in `index.html`. Function declarations and top-level `let`/`const` in any file become available on `window` the instant that file finishes executing — cross-file references (e.g. `showPage()` in `core.js` calling `renderOvertime()` from `overtime.js`) work fine because by the time any of these are actually *called* (user interaction, or the final `checkAuth()` in `boot.js`), every file has already loaded. The one hard rule: nothing may be invoked at a script's own top level before its dependencies have loaded — that's why `boot.js` (which kicks off the whole app) is last. When adding a new page, add its file before `boot.js`; order among the other 12 doesn't matter.

CSS lives in `static/css/style.css` (was previously an inline `<style>` block).

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
- `/api/tasks/progress` — the current user's own task-progress-log timeline for an arbitrary `[start,end]` date range (`sort=asc|desc`); always self-scoped, no `member_id` param — returns raw sorted `logs` plus `byType`/`byDate` pivot aggregates. Powers the day/week/month/year "进展记录" page (granularity and range navigation are computed client-side; the backend only knows about a plain date range)
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
- `/api/export/overtime` — Excel overtime export, admin-only; `month` given → single sheet for that month, omitted → one sheet per month (Jan-Dec) of `year`; regular admins are locked to their own group, super admin can pass `groups` to combine specific groups or omit for all
- `/api/export/progress` — Excel export of the current user's own progress logs for `[start,end]`; two sheets (raw log list + by-task-type pivot), same self-scoping as `/api/tasks/progress`

## Key Conventions

- `r2d(row)` (in `server/db.py`) converts a `sqlite3.Row` to a dict; `rs(rows)` converts a list of rows.
- `task_where(u)` (local to `server/tasks.py`) builds a WHERE clause that scopes to `group_name` for non-admins and `1=1` for admins.
- `can_edit(u, task)` (local to `server/tasks.py`) returns True if the user is admin, the assignee, or the creator.
- Migrations run inline in `init_db()` (`server/db.py`) via `ALTER TABLE … ADD COLUMN` wrapped in bare `except: pass`.
- The `wheels/` directory is prepended to `sys.path` in `app.py`, before the `server` package is imported — never import `server` (or `flask`/`openpyxl`) without that happening first.
- Task type values: `REQUIREMENT`, `ISSUE`, `ONSITE`, `OTHER`.
- Task status values: `PENDING`, `IN_PROGRESS`, `TESTING`, `DELIVERED`, `CANCELLED`, `OPEN`, `RESOLVED`, `CLOSED`, `REJECTED`, `ONGOING`, `COMPLETED`.
- When a task is set to a completed status without `actual_end_date`, the backend auto-sets it to today and progress to 100.
- Static files have cache disabled globally (`SEND_FILE_MAX_AGE_DEFAULT=0`) plus explicit no-cache headers on the SPA route.
