# -*- coding: utf-8 -*-
"""App factory. Wires together the DB layer and every feature blueprint.

NOTE: the `wheels/` vendored-dependency directory must already be on sys.path
before this package is imported (the root app.py entry point does this) —
Flask/openpyxl are not pip-installed, only available via wheels/.
"""
import os, time
from flask import Flask, send_file, make_response

from .db import DB_PATH, BASE_DIR, init_db, close_db  # noqa: F401  (re-exported for app.py)

STATIC = os.path.join(BASE_DIR, 'static')


def create_app():
    app = Flask(__name__, static_folder=STATIC, static_url_path='/static')
    app.secret_key = 'team-mgr-2025-v3'
    app.config['SEND_FILE_MAX_AGE_DEFAULT'] = 0  # disable static file cache

    app.teardown_appcontext(close_db)

    @app.after_request
    def cors(r):
        r.headers['Access-Control-Allow-Origin']='*'
        r.headers['Access-Control-Allow-Methods']='GET,POST,PUT,DELETE,OPTIONS'
        r.headers['Access-Control-Allow-Headers']='Content-Type'
        return r

    @app.route('/api/<path:p>', methods=['OPTIONS'])
    def opt(p): return '',204

    @app.route('/')
    def spa():
        resp = make_response(send_file(os.path.join(STATIC,'index.html')))
        resp.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
        resp.headers['Pragma'] = 'no-cache'
        resp.headers['Expires'] = '0'
        resp.headers['ETag'] = str(int(time.time()))
        return resp

    from .auth import auth_bp
    from .members import members_bp
    from .overtime import overtime_bp
    from .checkin import checkin_bp
    from .tasks import tasks_bp
    from .dayplan import dayplan_bp
    from .stats import stats_bp
    from .config_routes import config_bp

    for bp in (auth_bp, members_bp, overtime_bp, checkin_bp, tasks_bp, dayplan_bp, stats_bp, config_bp):
        app.register_blueprint(bp)

    return app
