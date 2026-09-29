#!/usr/bin/env python3
"""The nightly prune (lib_housekeeping.py), against real in-memory SQLite.

Each check runs the real DELETE, so a wrong comparison (a LIKE wildcard, a
day code compared as text, seconds against milliseconds) fails here rather
than deleting the wrong rows on the server.

Run: python3 scripts/test_housekeeping.py   (exit 1 on any failure)
"""
from __future__ import annotations

import datetime
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import lib_housekeeping as hk  # noqa: E402
from lib_sqlite_shim import SqliteTurso  # noqa: E402

failures: list[str] = []


def check(name: str, ok: bool, detail: str = "") -> None:
    print(f"  {'ok  ' if ok else 'FAIL'} {name}" + (f"  ({detail})" if detail and not ok else ""))
    if not ok:
        failures.append(name)


TODAY = datetime.date(2026, 9, 29)


def ms(d: datetime.date) -> int:
    return int(datetime.datetime.combine(d, datetime.time(12), tzinfo=datetime.timezone.utc).timestamp() * 1000)


def fresh_db() -> SqliteTurso:
    db = SqliteTurso()
    db.script([
        "CREATE TABLE perm_docs (key TEXT PRIMARY KEY, json TEXT, computed_at INTEGER)",
        "CREATE TABLE perm_serial_misses (day_code INTEGER NOT NULL, serial INTEGER NOT NULL, "
        "misses INTEGER NOT NULL DEFAULT 1, last_probed_at INTEGER NOT NULL, PRIMARY KEY (day_code, serial))",
        "CREATE TABLE ingest_runs (id INTEGER PRIMARY KEY AUTOINCREMENT, script TEXT, status TEXT, "
        "rows_written INTEGER, note TEXT, started_at INTEGER, finished_at INTEGER)",
        "CREATE TABLE sweep_runs (id INTEGER PRIMARY KEY AUTOINCREMENT, started_at INTEGER NOT NULL)",
    ])
    return db


def keys(db) -> set[str]:
    return {r[0] for r in db.conn.execute("SELECT key FROM perm_docs")}


def run() -> None:
    check("day code of 2026-09-29 is 26272", hk.day_code(TODAY) == 26272)
    check("day code of 2026-01-01 is 26001", hk.day_code(datetime.date(2026, 1, 1)) == 26001)

    db = fresh_db()
    old = (TODAY - datetime.timedelta(days=hk.COUNTER_KEEP_DAYS + 1)).isoformat()
    kept = (TODAY - datetime.timedelta(days=hk.COUNTER_KEEP_DAYS - 1)).isoformat()
    for prefix in hk.DAILY_COUNTER_PREFIXES:
        for day in (old, kept):
            db.execute("INSERT INTO perm_docs VALUES (?, '1', 0)", [f"{prefix}{day}"])
    # Look-alikes that must survive: a shared doc, a key with the prefix but no
    # date, and a prefix that is only a LIKE-pattern match ("_" is a wildcard).
    for k in ("live_census", "discovery_budget_notes", f"discoveryXbudget_{old}", f"xdiscovery_budget_{old}"):
        db.execute("INSERT INTO perm_docs VALUES (?, '{}', 0)", [k])

    old_code = hk.day_code(TODAY - datetime.timedelta(days=hk.SERIAL_MISS_KEEP_DAYS + 1))
    new_code = hk.day_code(TODAY - datetime.timedelta(days=hk.SERIAL_MISS_KEEP_DAYS - 1))
    last_year = 25360  # 2025-12-26: YYDDD must compare as a number across the year
    for code in (old_code, new_code, last_year):
        db.execute("INSERT INTO perm_serial_misses VALUES (?, 1, 3, 0)", [code])

    for table in ("ingest_runs", "sweep_runs"):
        for d in (TODAY - datetime.timedelta(days=hk.RUN_LOG_KEEP_DAYS + 1),
                  TODAY - datetime.timedelta(days=hk.RUN_LOG_KEEP_DAYS - 1)):
            db.execute(f"INSERT INTO {table} (started_at) VALUES (?)", [ms(d)])

    out = hk.prune(db, TODAY)
    k = keys(db)
    check("every per-day counter past the horizon is deleted",
          not any(key.endswith(old) and key.split(old)[0] in hk.DAILY_COUNTER_PREFIXES for key in k), str(sorted(k)))
    check("every per-day counter inside the horizon is kept",
          all(f"{p}{kept}" in k for p in hk.DAILY_COUNTER_PREFIXES))
    check("look-alike keys survive", {"live_census", "discovery_budget_notes",
                                      f"discoveryXbudget_{old}", f"xdiscovery_budget_{old}"} <= k)
    check("counts what it deleted", out["daily_counters"] == len(hk.DAILY_COUNTER_PREFIXES), str(out))

    codes = {r[0] for r in db.conn.execute("SELECT day_code FROM perm_serial_misses")}
    check("serial misses past the horizon go, recent ones stay", codes == {new_code}, str(codes))
    check("the gap sweep's 90-day window sits inside the kept range", hk.SERIAL_MISS_KEEP_DAYS >= 90)
    check("the lookup-demand check's 30 days sit inside the kept counters", hk.COUNTER_KEEP_DAYS >= 31)

    for table in ("ingest_runs", "sweep_runs"):
        n = db.conn.execute(f"SELECT count(*) FROM {table}").fetchone()[0]
        check(f"{table}: one old row deleted, the recent one kept", n == 1 and out[table] == 1, f"{n} {out}")

    out2 = hk.prune(db, TODAY)
    check("a second run deletes nothing", sum(out2.values()) == 0, str(out2))


def probe() -> None:
    """The checks must go red when the prune compares the wrong way."""
    global failures
    src = pathlib.Path(hk.__file__).read_text()
    mutations = {
        "LIKE instead of an exact prefix": src.replace(
            '"DELETE FROM perm_docs WHERE substr(key, 1, ?) = ? "',
            '"DELETE FROM perm_docs WHERE (? > 0 OR 1) AND key LIKE ? || \'%\' "'),
        "seconds against milliseconds": src.replace(".timestamp() * 1000)", ".timestamp())"),
    }
    for name, text in mutations.items():
        assert text != src, f"probe {name!r} did not change the file"
        ns: dict = {"__name__": "hk_probe"}
        exec(compile(text, "hk_probe", "exec"), ns)
        saved_hk, saved = hk.__dict__.copy(), failures
        hk.__dict__.update({k: v for k, v in ns.items() if not k.startswith("__")})
        failures = []
        print(f"  (probe: {name})")
        run()
        caught = bool(failures)
        hk.__dict__.clear()
        hk.__dict__.update(saved_hk)
        failures = saved
        check(f"probe caught: {name}", caught)


if __name__ == "__main__":
    print("nightly prune:")
    run()
    print("probes (each must be caught):")
    probe()
    print(f"{len(failures)} failure(s)")
    sys.exit(1 if failures else 0)
