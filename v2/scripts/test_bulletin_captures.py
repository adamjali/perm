#!/usr/bin/env python3
"""Tests for measure_bulletin_captures.py. Offline: no archive, no database."""
from __future__ import annotations

import pathlib
import sys

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import measure_bulletin_captures as mc  # noqa: E402

failures: list[str] = []


def check(label: str, cond: bool, detail: str = "") -> None:
    print(f"  {'PASS' if cond else 'FAIL'}  {label}{': ' + detail if detail and not cond else ''}")
    if not cond:
        failures.append(label)


def main() -> int:
    # --- the day a capture fell on, in Eastern time -------------------------
    check("a 3 AM UTC capture in January is the evening before in Eastern time",
          mc.eastern_date("20250110030000") == "2025-01-09", mc.eastern_date("20250110030000"))
    check("and in July too, under daylight time",
          mc.eastern_date("20250710030000") == "2025-07-09", mc.eastern_date("20250710030000"))
    check("an afternoon capture keeps its day",
          mc.eastern_date("20250710190000") == "2025-07-10")

    # --- grouping the archive's index by bulletin ---------------------------
    base = "https://travel.state.gov/content/travel/en/legal/visa-law0/visa-bulletin/2015/"
    rows = [
        ["k", "20141215000000", base + "visa-bulletin-for-january-2015.html", "text/html", "200"],
        ["k", "20141209000000", base + "visa-bulletin-for-january-2015.html", "text/html", "200"],
        ["k", "20141209000000", base + "2015.html", "text/html", "200"],
        ["k", "20141209000000", base + "visa-bulletin-for-smarch-2015.html", "text/html", "200"],
    ]
    months = mc.captures_by_month(rows)
    check("only bulletin pages are kept, keyed by the bulletin's own month",
          list(months) == ["2015-01"], str(list(months)))
    check("captures are oldest first",
          [ts for ts, _ in months["2015-01"]] == ["20141209000000", "20141215000000"])

    # --- a capture counts only when it is the bulletin, with charts --------
    jan15 = (HERE / "__fixtures__" / "visa-bulletin-2015-01.html").read_text()
    stub = "<html><head><title>Visa Bulletin For January 2015</title></head><body>Coming soon</body></html>"
    served = {"20141209000000": stub, "20141215000000": jan15}
    fetch = lambda url, attempts=3: served[url.split("/web/")[1].split("/")[0]]  # noqa: E731
    hit = mc.first_real_capture("2015-01", months["2015-01"], fetch)
    check("an early capture without charts is passed over for the next",
          hit is not None and hit[0] == "20141215000000", str(hit))
    check("a page for a different month is never counted",
          mc.first_real_capture("2015-02", months["2015-01"], fetch) is None)
    check("gives up after the capture limit rather than walking every capture",
          mc.first_real_capture("2015-01", [("20141209000000", "u")] * 5, lambda u, attempts=3: stub) is None)

    # --- the table it writes ------------------------------------------------
    body = mc.render_ts([{"month": "2015-01", "captured": "2014-12-15"}], "2026-09-26")
    check("the table names its measurement day and imports the shape it fills",
          'BULLETIN_CAPTURES_MEASURED = "2026-09-26"' in body
          and 'import type { FirstCapture } from "@/lib/bulletinRelease";' in body
          and '{ month: "2015-01", captured: "2014-12-15" },' in body)

    # --- a partial re-run adds to the table --------------------------------
    import tempfile
    with tempfile.TemporaryDirectory() as d:
        f = pathlib.Path(d) / "t.ts"
        f.write_text(mc.render_ts([{"month": "2015-01", "captured": "2014-12-15"},
                                   {"month": "2015-02", "captured": "2015-01-09"}], "2026-09-26"))
        old = mc.read_table(f)
        check("an earlier table reads back row for row", old == [
            {"month": "2015-01", "captured": "2014-12-15"}, {"month": "2015-02", "captured": "2015-01-09"}], str(old))
        merged = mc.merge_rows(old, [{"month": "2015-02", "captured": "2015-01-08"},
                                     {"month": "2014-12", "captured": "2014-11-10"}])
        check("merging keeps old months, replaces re-measured ones, and sorts",
              [r["month"] for r in merged] == ["2014-12", "2015-01", "2015-02"]
              and merged[2]["captured"] == "2015-01-08", str(merged))
    check("a missing table reads as empty", mc.read_table(pathlib.Path("/nonexistent/t.ts")) == [])

    print(f"\n  {len(failures)} failure(s)")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
