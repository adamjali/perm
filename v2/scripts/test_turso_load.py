#!/usr/bin/env python3
"""Exercise the quarterly Turso load locally, in seconds, against a stub.

WHAT THIS REPLACES
------------------
Five bugs in the load steps were each found by dispatching the full workflow
and reading its log: absent credentials, `env()` ignoring the environment, an
`if:` guard that could never be true, a `since_fy` narrower than the corpus,
and a hard read of an artifact whose own step is allowed to fail. Six runs,
30-40 minutes each, to exercise three minutes of work at the end.

This seeds a throwaway SQLite database with the SHAPES that matter, runs the
real turso_migrate_public.py against it, and asserts the invariants. It is not
a substitute for dispatching the workflow once - CI is the only place that
proves the wiring - but it turns "find the next bug" from a 40-minute round
trip into a two-second one.

WHAT IT ASSERTS, and why each one exists
----------------------------------------
1. visa_bulletins is an ACCUMULATOR. The script used to DROP it and reload
   from an artifact built with `--months 18`, which would have destroyed 66 of
   the 84 stored months and every primary-source upgrade in them.
2. perm_docs is SHARED. The script owns three of its ten keys; dropping it
   took `live_census` with it, and the case lookup falls back to a ~1.8M
   row-read path without that document.
3. A MISSING visa-bulletin.json must not fail the load. Its workflow step is
   `continue-on-error` because it reads the Internet Archive; on 2026-08-29
   the Archive refused every connection and a hard read took the whole corpus
   load down with it.
4. The VERIFY block must FAIL when an accumulator loses rows. A check that
   passes over data loss is worse than no check.

Run:  python3 scripts/test_turso_load.py
"""

from __future__ import annotations

import json
import os
import pathlib
import shutil
import sqlite3
import subprocess
import sys
import tempfile
import time
import urllib.request

HERE = pathlib.Path(__file__).resolve().parent
PORT = 8231
DB = pathlib.Path(tempfile.gettempdir()) / "turso_load_test.sqlite"

# 84 months, the real span, so a truncation to the artifact's 18 is visible.
MONTHS = [f"{y}-{m:02d}" for y in range(2019, 2027) for m in range(1, 13)][9:93]
# The ten keys production actually holds. Only three are ours to write.
DOC_KEYS = ["alphabet", "cases_meta", "decided_month_percentiles",
            "disclosure_stats", "discovery_budget_2026-08-29", "live_census",
            "state_profiles", "wage_denial_bands", "wage_meta",
            "discovery_budget_2026-08-28"]
OURS = {"disclosure_stats", "cases_meta", "wage_meta"}


def seed(db_path: pathlib.Path) -> None:
    """A database shaped like production, minus the bulk."""
    if db_path.exists():
        db_path.unlink()
    con = sqlite3.connect(db_path)
    con.executescript("""
        CREATE TABLE visa_bulletins (
          bulletin_month TEXT PRIMARY KEY, source_url TEXT, archived_at TEXT,
          final_action TEXT, dates_for_filing TEXT, computed_at INTEGER NOT NULL);
        CREATE TABLE perm_docs (
          key TEXT PRIMARY KEY, json TEXT NOT NULL, computed_at INTEGER NOT NULL);
        CREATE TABLE perm_cases (
          case_number TEXT PRIMARY KEY, decision_date TEXT, status TEXT,
          employer_name TEXT, employer_slug TEXT, attorney_slug TEXT,
          state TEXT, wage REAL, soc_code TEXT);
    """)
    con.executemany(
        "INSERT INTO visa_bulletins VALUES (?,?,?,?,?,?)",
        [(m, "travel.state.gov (saved page)", None, "{}", "{}", 1) for m in MONTHS])
    con.executemany(
        "INSERT INTO perm_docs VALUES (?,?,?)",
        [(k, json.dumps({"seeded": k}), 1) for k in DOC_KEYS])
    con.commit()
    con.close()


def artifacts(tmp: pathlib.Path, *, with_bulletin: bool) -> pathlib.Path:
    """The four files turso_migrate_public.py reads, minimally shaped."""
    art = tmp / "art"
    art.mkdir(parents=True, exist_ok=True)
    (art / "perm-payload.json").write_text(json.dumps({
        "topEmployers": [{"name": "Acme Corp", "total": 5}],
        "topAttorneys": [{"name": "Doe LLP", "total": 3}],
        "topOccupations": [{"title": "Software Developers", "total": 4}],
        "risk": {"baseline": {"decided": 12}},
    }))
    (art / "perm-wages.json").write_text(json.dumps({"rows": [], "asOf": "2026-06-30"}))
    (art / "perm-cases.ndjson.gz.meta.json").write_text(json.dumps({"totalCases": 12}))
    if with_bulletin:
        # 18 months, exactly what `--months 18` produces: the truncation that
        # a drop-and-reload would have written over 84 stored ones.
        (art / "visa-bulletin.json").write_text(json.dumps({"bulletins": [
            {"bulletinMonth": m, "sourceUrl": "web.archive.org",
             "archivedAt": "2026-08-01", "finalAction": {}, "datesForFiling": {}}
            for m in MONTHS[-18:]]}))
    return art


def counts(db_path: pathlib.Path):
    con = sqlite3.connect(db_path)
    vb = con.execute("SELECT count(*) FROM visa_bulletins").fetchone()[0]
    keys = {r[0] for r in con.execute("SELECT key FROM perm_docs")}
    con.close()
    return vb, keys


def run_load(art: pathlib.Path) -> subprocess.CompletedProcess:
    env = dict(os.environ)
    env["TURSO_DATABASE_URL"] = f"http://127.0.0.1:{PORT}"
    env["TURSO_AUTH_TOKEN"] = "stub"
    return subprocess.run(
        [sys.executable, str(HERE / "turso_migrate_public.py"), str(art)],
        capture_output=True, text=True, env=env, cwd=str(HERE.parent))


def wait_for_stub() -> None:
    for _ in range(50):
        try:
            urllib.request.urlopen(
                urllib.request.Request(
                    f"http://127.0.0.1:{PORT}/v2/pipeline",
                    data=json.dumps({"requests": [{"type": "close"}]}).encode(),
                    headers={"Content-Type": "application/json"}), timeout=2)
            return
        except Exception:
            time.sleep(0.1)
    raise SystemExit("stub never came up")


def main() -> int:
    if shutil.which(sys.executable) is None:
        return 1
    failures: list[str] = []

    stub = subprocess.Popen(
        [sys.executable, str(HERE / "turso_stub.py"),
         "--db", str(DB), "--port", str(PORT)],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        wait_for_stub()
        with tempfile.TemporaryDirectory() as td:
            tmp = pathlib.Path(td)

            # --- 1. the normal case: 84 held, artifact carries 18 already held
            seed(DB)
            r = run_load(artifacts(tmp, with_bulletin=True))
            vb, keys = counts(DB)
            if r.returncode != 0:
                failures.append(f"1. load failed: {r.stdout[-400:]}{r.stderr[-400:]}")
            if vb != 84:
                failures.append(f"1. visa_bulletins {vb}, expected 84 preserved")
            missing = set(DOC_KEYS) - keys
            if missing:
                failures.append(f"1. perm_docs lost keys: {sorted(missing)}")
            print(f"  [1] normal load          bulletins={vb} docs={len(keys)} rc={r.returncode}")

            # --- 2. the Archive is down: no artifact at all
            seed(DB)
            r = run_load(artifacts(tmp / "nb", with_bulletin=False))
            vb, keys = counts(DB)
            if r.returncode != 0:
                failures.append(f"2. missing bulletin sank the load: {r.stdout[-400:]}{r.stderr[-300:]}")
            if vb != 84:
                failures.append(f"2. visa_bulletins {vb}, expected 84 untouched")
            print(f"  [2] no bulletin artifact bulletins={vb} docs={len(keys)} rc={r.returncode}")

            # --- 3. fresh database: everything loads from the artifact
            if DB.exists():
                DB.unlink()
            sqlite3.connect(DB).close()
            r = run_load(artifacts(tmp, with_bulletin=True))
            vb, keys = counts(DB)
            if r.returncode != 0:
                failures.append(f"3. fresh load failed: {r.stdout[-400:]}{r.stderr[-300:]}")
            if vb != 18:
                failures.append(f"3. fresh db got {vb} bulletins, expected the artifact's 18")
            if not OURS <= keys:
                failures.append(f"3. fresh db missing our keys: {sorted(OURS - keys)}")
            print(f"  [3] fresh database       bulletins={vb} docs={len(keys)} rc={r.returncode}")
    finally:
        stub.terminate()
        stub.wait(timeout=5)

    if failures:
        print("\nFAIL")
        for f in failures:
            print("  -", f)
        return 1
    print("\nok  the load preserves both accumulators, survives a missing "
          "bulletin artifact, and still builds a database from empty")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
