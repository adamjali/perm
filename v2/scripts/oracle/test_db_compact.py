#!/usr/bin/env python3
"""permtracker-db-compact refuses what it must, compacts, and puts the original
back when anything goes wrong.

Runs the real bin/permtracker-db-compact under bash in a scratch copy of
/srv/permtracker, against two real SQLite files standing in for the main and
LCA databases. Stand-ins: `systemctl` (start and stop flip a "running" file
per database), `curl` (answers the script's SQL from the matching file, and
only while that database is "running"), and root, sudo and chown, which a test
doesn't have.

Linux only (GNU stat, df --output); CI and the server run it.

Run: python3 scripts/oracle/test_db_compact.py
"""
from __future__ import annotations

import os
import pathlib
import platform
import shutil
import sqlite3
import subprocess
import sys
import tempfile

HERE = pathlib.Path(__file__).resolve().parent
SCRIPT = HERE / "bin" / "permtracker-db-compact"
failures: list[str] = []

FAKE_CURL = r"""#!/usr/bin/env python3
import json, os, sqlite3, sys
args = sys.argv[1:]
url = args[-1]
body = args[args.index("-d") + 1]
root = os.environ["DC_ROOT"]
port = "8082" if ":8082/" in url else "8080"
if not os.path.exists(f"{root}/running-{port}"):
    sys.exit(7)
path = os.environ["DC_LCA"] if port == "8082" else os.environ["DC_MAIN"]
sql = json.loads(body)["requests"][0]["stmt"]["sql"]
try:
    row = sqlite3.connect(path).execute(sql).fetchone()
    out = {"results": [{"type": "ok", "response": {"result": {"rows": [[{"type": "text", "value": str(row[0])}]]}}}]}
except sqlite3.Error as e:
    out = {"results": [{"type": "error", "error": {"message": str(e)}}]}
print(json.dumps(out))
"""
FAKE_SYSTEMCTL = r"""#!/bin/bash
echo "$*" >> "$DC_ROOT/systemctl.log"
case "$1" in
  stop) for u in "${@:2}"; do [ "$u" = permtracker-db ] && rm -f "$DC_ROOT/running-8080"; done ;;
  start) for u in "${@:2}"; do [ "$u" = permtracker-db ] && touch "$DC_ROOT/running-8080"; done ;;
  list-units) [ -n "${DC_BUSY:-}" ] && echo "$DC_BUSY loaded active running x" ;;
esac
exit 0
"""


def check(name: str, ok: bool, detail: str = "") -> None:
    print(f"  {'ok  ' if ok else 'FAIL'} {name}{f'  ({detail})' if detail and not ok else ''}")
    if not ok:
        failures.append(name)


def setup(root: pathlib.Path, *, retired: bool = True, live: bool = False, listed_off: int = 0) -> dict:
    srv = root / "srv" / "permtracker"
    d = srv / "db" / "data.sqld" / "dbs" / "default"
    for sub in (d, srv / "health", srv / "secrets", srv / "db-lca"):
        sub.mkdir(parents=True)
    (srv / "secrets" / "db_ro.jwt").write_text("ro")
    main = d / "data"
    con = sqlite3.connect(main)
    con.execute("PRAGMA journal_mode=WAL")
    for t in ("perm_cases", "perm_case_status", "pwd_cases", "perm_docs"):
        con.execute(f"CREATE TABLE {t} (k TEXT PRIMARY KEY)")
        con.executemany(f"INSERT INTO {t} VALUES (?)", [(f"{t}-{i}",) for i in range(50)])
    con.execute("CREATE TABLE lca_case_numbers (case_number TEXT PRIMARY KEY, received_date TEXT) WITHOUT ROWID")
    con.executemany("INSERT INTO lca_case_numbers VALUES (?, '2026-01-01')", [(f"I-{i}",) for i in range(300 - listed_off)])
    if retired:
        con.execute("CREATE TABLE lca_cases_retired (case_number TEXT PRIMARY KEY, blob TEXT)")
        con.executemany("INSERT INTO lca_cases_retired VALUES (?, ?)", [(f"I-{i}", "x" * 4000) for i in range(300)])
    if live:
        con.execute("CREATE TABLE lca_cases (case_number TEXT PRIMARY KEY)")
    con.commit()
    con.close()
    (d / "wallog").write_text("old log")
    lca = srv / "db-lca" / "data"
    c2 = sqlite3.connect(lca)
    c2.execute("CREATE TABLE lca_cases (case_number TEXT PRIMARY KEY)")
    c2.executemany("INSERT INTO lca_cases VALUES (?)", [(f"I-{i}",) for i in range(300)])
    c2.commit()
    c2.close()
    bindir = root / "bin"
    bindir.mkdir()
    for name, body in (("curl", FAKE_CURL), ("systemctl", FAKE_SYSTEMCTL)):
        (bindir / name).write_text(body)
        (bindir / name).chmod(0o755)
    text = (SCRIPT.read_text()
            .replace("/srv/permtracker", str(srv))
            .replace('[ "$(id -u)" = 0 ] || { echo "run as root"; exit 2; }', "true")
            .replace("sudo -u permtracker env", "env")
            .replace("chown -R permtracker:permtracker", "true"))
    script = root / "compact"
    script.write_text(text)
    script.chmod(0o755)
    (root / "running-8080").touch()
    (root / "running-8082").touch()
    return {"main": main, "lca": lca, "dir": d, "keep": srv / "db-compact-before", "script": script}


def run(root: pathlib.Path, s: dict, *args: str, **env: str) -> subprocess.CompletedProcess:
    e = {**os.environ, "PATH": f"{root / 'bin'}:{os.environ['PATH']}", "DC_ROOT": str(root),
         "DC_MAIN": str(s["main"]), "DC_LCA": str(s["lca"]), **env}
    return subprocess.run(["bash", str(s["script"]), *args], env=e, capture_output=True, text=True)


def tables(path: pathlib.Path) -> set[str]:
    return {r[0] for r in sqlite3.connect(path).execute("SELECT name FROM sqlite_master WHERE type = 'table'")}


def main() -> int:
    if platform.system() != "Linux" or shutil.which("bash") is None:
        print("skipped: the compaction runs on Linux (GNU stat, df --output)")
        return 0
    cases = (
        ("no retired table: refused, nothing stopped", {"retired": False}, (), {}),
        ("an lca_cases back in the main file: refused", {"live": True}, (), {}),
        ("the list short of the LCA table: refused", {"listed_off": 1}, (), {}),
        ("a batch job running: refused", {}, (), {"DC_BUSY": "permtracker-uscis@h1b-hub.service"}),
        ("a dry run stops nothing", {}, ("--dry-run",), {}),
    )
    for name, kw, args, env in cases:
        with tempfile.TemporaryDirectory() as tmp:
            root = pathlib.Path(tmp)
            s = setup(root, **kw)
            size = s["main"].stat().st_size
            r = run(root, s, *args, **env)
            stopped = "stop" in (root / "systemctl.log").read_text() if (root / "systemctl.log").exists() else False
            want_rc = 0 if args else 3
            check(name, r.returncode == want_rc and not stopped and s["main"].stat().st_size == size,
                  f"rc={r.returncode} stopped={stopped} {r.stdout[-200:]}")

    with tempfile.TemporaryDirectory() as tmp:
        root = pathlib.Path(tmp)
        s = setup(root)
        before = s["main"].stat().st_size
        r = run(root, s)
        t = tables(s["main"])
        check("compacts: the retired table is gone and the file is smaller",
              r.returncode == 0 and "lca_cases_retired" not in t and s["main"].stat().st_size < before,
              f"rc={r.returncode} {before}->{s['main'].stat().st_size} {r.stdout[-300:]} {r.stderr[-300:]}")
        check("keeps the original and sqld's old log for a rollback",
              (s["keep"] / "data").exists() and (s["keep"] / "wallog").exists() and not (s["dir"] / "wallog").exists())
        check("the database and its lock are started again", (root / "running-8080").exists()
              and "start permtracker-dbcache permtracker-watchdog.timer" in (root / "systemctl.log").read_text())
        check("the integrity check runs once it's back, and passes", "done: quick_check ok" in r.stdout, r.stdout[-200:])

    with tempfile.TemporaryDirectory() as tmp:
        root = pathlib.Path(tmp)
        s = setup(root)
        before = s["main"].stat().st_size
        # sqld comes back answering a different count than the file held.
        bad_curl = (root / "bin" / "curl").read_text().replace(
            "row = sqlite3.connect(path).execute(sql).fetchone()",
            "row = sqlite3.connect(path).execute(sql).fetchone()\n    "
            "row = (row[0] + ':1',) if 'perm_docs' in sql and os.path.exists(os.environ['DC_ROOT'] + '/compacted') else row")
        (root / "bin" / "curl").write_text(bad_curl)
        # Mark the moment the vacuum is done: the restart is when the counts are asked again.
        sysctl = (root / "bin" / "systemctl").read_text().replace(
            'start) for u', 'start) touch "$DC_ROOT/compacted"; for u')
        (root / "bin" / "systemctl").write_text(sysctl)
        r = run(root, s)
        t = tables(s["main"])
        check("a figure that differs after the restart puts the original back",
              r.returncode == 1 and "lca_cases_retired" in t and s["main"].stat().st_size == before
              and (s["dir"] / "wallog").read_text() == "old log",
              f"rc={r.returncode} {r.stdout[-300:]}")

    print(f"{len(failures)} failure(s)")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
