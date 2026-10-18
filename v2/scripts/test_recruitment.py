#!/usr/bin/env python3
"""recruitment_summary from a handful of rows: steps and notice methods counted
per case, one paper under several spellings counted once per case, the lead
times by the ingest's own percentile, and a row with no record left out."""
from __future__ import annotations

import json
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import build_recruitment as br  # noqa: E402

FAILED: list[str] = []


def check(name: str, got, want) -> None:
    ok = got == want
    print(f"{'ok  ' if ok else 'FAIL'} {name}: {got!r}" + ("" if ok else f" (want {want!r})"))
    if not ok:
        FAILED.append(name)


def row(**over) -> dict:
    base = {"case_number": "G-1", "received_date": "2025-04-20", "decision_date": "2026-05-01", "state": "WA",
            "job_order_start": "2025-01-05", "job_order_end": "2025-02-04", "ad1": "2025-01-05", "ad2": "2025-01-12",
            "paper1": "The Seattle Times", "paper2": "SEATTLE TIMES", "ad_type": "Newspaper of General Circulation",
            "sunday_edition": "Y", "recr_steps": json.dumps({"job_search_website": ["2025-01-06", "2025-02-06"]}),
            "notice": "posted,electronic"}
    base.update(over)
    return base


def main() -> int:
    doc = br.summarise([
        row(),
        row(case_number="G-2", state="CA", paper1="San Francisco Chronicle", paper2="San Francisco Chronicle",
            recr_steps=None, notice="posted", received_date="2025-03-06"),
    ])
    steps = {s["id"]: s["n"] for s in doc["steps"]}
    notice = {m["id"]: m["n"] for m in doc["notice"]}
    check("cases with a record", doc["cases"], 2)
    check("a step counted once per case", steps["job_search_website"], 1)
    check("every step listed, used or not", len(doc["steps"]), 10)
    check("notice methods", (notice["posted"], notice["electronic"]), (2, 1))
    check("one paper under two spellings, once per case",
          [(p["key"], p["n"]) for p in doc["papers"]], [("san francisco chronicle", 1), ("seattle times", 1)])
    check("each state's own papers", sorted(doc["byState"]), ["CA", "WA"])
    check("first step to filing, by the ingest's percentile", doc["lead"]["firstStep"]["p50"], 82)
    check("the newest decision dates the doc", doc["asOf"], "2026-05-01")
    print(f"{len(FAILED)} failure(s)")
    return 1 if FAILED else 0


if __name__ == "__main__":
    sys.exit(main())
