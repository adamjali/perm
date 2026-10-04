#!/usr/bin/env python3
"""The watchdog restarts what stopped answering, and nothing else.

Runs the real bin/permtracker-watchdog under bash against stand-ins for curl
and systemctl, in a scratch copy of /srv/permtracker. Two cases from Oct 3
2026, when a deploy's warm-up filled the app, nginx answered every check with
its instant 503 "busy" reply, and the watchdog restarted nginx mid-deploy:

* a full app is not a dead nginx: nginx's own check passes, so nothing restarts;
* while a deploy runs, even a really dead nginx waits for the deploy to end.

Linux only (the script uses bash 4 arrays and GNU stat); CI and the server run it.

Run: python3 scripts/oracle/test_watchdog.py
"""
from __future__ import annotations

import os
import pathlib
import platform
import shutil
import subprocess
import sys
import tempfile
import time

HERE = pathlib.Path(__file__).resolve().parent
SCRIPT = HERE / "bin" / "permtracker-watchdog"
failures: list[str] = []

# A curl that answers like the server does. NGINX_ALIVE / APP_VIA_NGINX choose
# what port 8081 says; the database, both live copies and the tunnel answer.
FAKE_CURL = r"""#!/bin/bash
url="${@: -1}"
case "$url" in
  *:8080/v2/pipeline) echo '{"results":[{"type":"ok"},{"type":"ok"},{"type":"ok"}]}'; exit 0 ;;
  *:8081/__pt/nginx-alive) [ "${NGINX_ALIVE:-1}" = 1 ] && exit 0 || exit 7 ;;
  *:8081/*) [ "${APP_VIA_NGINX:-1}" = 1 ] && exit 0 || exit 22 ;;
  *:3001/api/health|*:3011/api/health) exit 0 ;;
  *) exit 0 ;;
esac
"""
FAKE_SYSTEMCTL = r"""#!/bin/bash
case "$1" in
  is-active) case "$3" in permtracker-web@blue|permtracker-web@blue2) exit 0 ;; *) exit 3 ;; esac ;;
  is-enabled) exit 1 ;;
  restart) echo "$2" >> "$WD_ROOT/restarts" ;;
esac
exit 0
"""


def check(name: str, ok: bool, detail: str = "") -> None:
    print(f"  {'ok  ' if ok else 'FAIL'} {name}{f'  ({detail})' if detail and not ok else ''}")
    if not ok:
        failures.append(name)


def setup(root: pathlib.Path) -> pathlib.Path:
    srv = root / "srv" / "permtracker"
    for d in ("health", "secrets", "app/env"):
        (srv / d).mkdir(parents=True)
    (srv / "secrets" / "db_ro.jwt").write_text("ro")
    (srv / "secrets" / "db_rw.jwt").write_text("rw")
    (srv / "app" / "active").write_text("blue")
    (srv / "app" / "env" / "blue.env").write_text("PORT=3001\n")
    (srv / "app" / "env" / "blue2.env").write_text("PORT=3011\n")
    bindir = root / "bin"
    bindir.mkdir()
    for name, body in (("curl", FAKE_CURL), ("systemctl", FAKE_SYSTEMCTL)):
        (bindir / name).write_text(body)
        (bindir / name).chmod(0o755)
    script = root / "watchdog"
    script.write_text(SCRIPT.read_text().replace("/srv/permtracker", str(srv)))
    script.chmod(0o755)
    return srv


def run(root: pathlib.Path, times: int, **env: str) -> list[str]:
    e = {**os.environ, "PATH": f"{root / 'bin'}:{os.environ['PATH']}", "WD_ROOT": str(root), **env}
    for _ in range(times):
        subprocess.run(["bash", str(root / "watchdog")], env=e, check=True, capture_output=True)
    path = root / "restarts"
    return path.read_text().split() if path.exists() else []


def main() -> int:
    if platform.system() != "Linux" or shutil.which("bash") is None:
        print("skipped: the watchdog runs on Linux (bash 4 arrays, GNU stat)")
        return 0
    with tempfile.TemporaryDirectory() as tmp:
        root = pathlib.Path(tmp)
        setup(root)
        got = run(root, 4, NGINX_ALIVE="1", APP_VIA_NGINX="0")
        check("a full app is not a dead nginx: nothing restarts", got == [], str(got))

    with tempfile.TemporaryDirectory() as tmp:
        root = pathlib.Path(tmp)
        srv = setup(root)
        (srv / "health" / "deploying").write_text(str(int(time.time())))
        got = run(root, 4, NGINX_ALIVE="0", APP_VIA_NGINX="0")
        check("while a deploy runs, a dead nginx waits", got == [], str(got))
        (srv / "health" / "deploying").unlink()
        got = run(root, 3, NGINX_ALIVE="0", APP_VIA_NGINX="0")
        check("after the deploy, three failed checks restart nginx", got == ["nginx"], str(got))

    with tempfile.TemporaryDirectory() as tmp:
        root = pathlib.Path(tmp)
        srv = setup(root)
        stale = srv / "health" / "deploying"
        stale.write_text("0")
        old = time.time() - 3600
        os.utime(stale, (old, old))
        got = run(root, 3, NGINX_ALIVE="0", APP_VIA_NGINX="0")
        check("a marker an hour old is a deploy that died, and is ignored", got == ["nginx"], str(got))

    print(f"{len(failures)} failure(s)")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
