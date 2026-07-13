#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Entry point — kept as a top-level app.py (not a package) so `python app.py`
and start.bat keep working unchanged. All routes/logic live in server/."""
import sys, os, webbrowser, threading, time

_BASE   = os.path.dirname(os.path.abspath(__file__))
_WHEELS = os.path.join(_BASE, 'wheels')
if os.path.isdir(_WHEELS) and _WHEELS not in sys.path:
    sys.path.insert(0, _WHEELS)

from server import create_app, init_db

app = create_app()

if __name__=='__main__':
    port=int(os.environ.get('PORT',8080))
    init_db()
    def open_browser():
        time.sleep(1.5); webbrowser.open('http://127.0.0.1:{}'.format(port))
    threading.Thread(target=open_browser,daemon=True).start()
    print("="*50)
    print("  Team Manager v3")
    print("  http://127.0.0.1:{}".format(port))
    print("  admin/admin123 | zhangsan/123456")
    print("="*50)
    app.run(host='0.0.0.0',port=port,debug=False)
