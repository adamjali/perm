#!/usr/bin/env python3
"""State's site closed to scripts on Nov 2 2026: each reader warns and exits 0, and says why.

adoption.state.gov now sends every page to travel.state.gov, which answers scripts with a 403. The
visa issuance, NVC timeframes and visa wait-time readers each failed their runs on Nov 3 (a red
3 AM workflow and a failed server job that emailed the owner) for something no code can fix. Each
now prints a warning, records an ok run with the reason, and notes it on its freshness row while
the data's own date keeps ageing (lib_db.restamp_note), so the health check warns and then fails.

Run: python3 scripts/test_state_closed.py
"""
from __future__ import annotations

import io
import pathlib
import sys
import urllib.error

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import lib_db  # noqa: E402
from lib_gov_data import STATE_CLOSED, state_refused  # noqa: E402

FAILED: list[str] = []


def check(name: str, ok: bool, detail: str = "") -> None:
    print(("ok   " if ok else "FAIL ") + name + (f": {detail}" if detail and not ok else ""))
    if not ok:
        FAILED.append(name)


def http(code: int, url: str, location: str | None = None) -> urllib.error.HTTPError:
    headers = {"Location": location} if location else {}
    return urllib.error.HTTPError(url, code, "x", headers, io.BytesIO(b""))  # type: ignore[arg-type]


class FakeDb:
    """Just enough of lib_db.Database for restamp_note and record_run."""

    def __init__(self, row=None):
        self.row = row
        self.writes: list[list] = []

    def execute(self, sql, args=None):
        if sql.lstrip().upper().startswith("SELECT"):
            rows = [[{"type": "text", "value": str(v)} for v in self.row]] if self.row else []
            return {"response": {"result": {"cols": [{"name": c} for c in ("as_of", "source", "cadence", "max_age_days")], "rows": rows}}}
        self.writes.append([sql, args])
        return {"response": {"result": {"cols": [], "rows": [], "affected_row_count": 1}}}


def main() -> int:
    travel = "https://travel.state.gov/content/travel/en/404.html"
    check("a 403 is State refusing", state_refused(http(403, travel)))
    check("a 404 after the redirect is State refusing", state_refused(http(404, travel)))
    check("a 404 elsewhere isn't", not state_refused(http(404, "https://adoption.state.gov/x.html")))
    check("a 500 isn't", not state_refused(http(500, travel)))
    robots = "https://adoption.state.gov/robots.txt"
    check("a redirect to travel.state.gov is State refusing (robots.txt, Nov 3 2026)", state_refused(http(302, robots, travel)))
    check("a redirect within adoption.state.gov isn't", not state_refused(http(302, robots, "https://adoption.state.gov/x.html")))
    check("a redirect with no Location isn't", not state_refused(http(302, robots)))
    check("a dropped connection isn't", not state_refused(urllib.error.URLError("reset")))

    db = FakeDb(("2026-10-26", "State NVC Timeframes", "weekly", 21))
    ok = lib_db.restamp_note(db, "nvc-timeframes", "why")  # type: ignore[arg-type]
    insert = next((w for w in db.writes if "INSERT OR REPLACE INTO data_freshness" in w[0]), None)
    check("the note keeps the data's own date and budget", ok and insert and insert[1][1] == "2026-10-26" and insert[1][6] == 21, str(insert))
    check("the note says why", insert and insert[1][5] == "why", str(insert))
    check("no row, nothing noted", lib_db.restamp_note(FakeDb(None), "nope", "why") is False)  # type: ignore[arg-type]

    # Each reader, with State refusing: exit 0 and the warning, writing nothing (--dry-run).
    import ingest_nvc_timeframes as nvc
    import ingest_visa_issuances as iss
    import ingest_visa_wait_times as waits
    from ingest_state_news import ALL_REDIRECTED

    def refuse(*_a, **_k):
        raise http(403, travel)

    def redirected(*_a, **_k):
        raise waits.Refusal(f"no new-site server answered: all 5 {ALL_REDIRECTED}, which refuses scripts")

    for name, module, attr, raiser in (
        ("NVC timeframes", nvc, "fetch", refuse),
        ("visa issuances", iss, "fetch", refuse),
        ("visa wait times", waits, "read_page", redirected),
    ):
        saved, argv, out = getattr(module, attr), sys.argv, io.StringIO()
        setattr(module, attr, raiser)
        sys.argv, real = [name, "--dry-run"], sys.stdout
        sys.stdout = out
        try:
            rc = module.main()
        finally:
            setattr(module, attr, saved)
            sys.argv, sys.stdout = argv, real
        check(f"{name}: State refusing exits 0", rc == 0, f"rc={rc}")
        check(f"{name}: and warns why", "::warning::" in out.getvalue() and STATE_CLOSED in out.getvalue(), out.getvalue()[-300:])

    # Anything else still fails the run.
    saved = nvc.fetch
    nvc.fetch = lambda *_a, **_k: (_ for _ in ()).throw(http(500, "https://adoption.state.gov/x"))
    sys.argv, argv = ["nvc", "--dry-run"], sys.argv
    try:
        nvc.main()
        check("a 500 still raises", False)
    except urllib.error.HTTPError:
        check("a 500 still raises", True)
    finally:
        nvc.fetch, sys.argv = saved, argv

    print(f"\n{len(FAILED)} failed" if FAILED else "\nall passed")
    return 1 if FAILED else 0


if __name__ == "__main__":
    sys.exit(main())
