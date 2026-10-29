#!/usr/bin/env python3
"""Write the blog post for a quarter's PERM file: content/blog/dol-perm-file-fy<fy>-q<n>.mdx.

Run once a quarter, after build_quarter_report.py has written that quarter's doc.
The post types no figure: every number is a `<QuarterNow />` part reading the
quarter's own report. The skeleton's sentences say what each part shows; add the
quarter's own observations by hand (each checked against the doc) before publishing,
and give the post its header picture (scripts/article-heroes.json, a capture of the
post's own decisions chart, which never changes for its quarter).

Usage:
    python3 scripts/new_quarter_post.py --fy 2026 --q 3 [--date 2026-10-28]
"""
from __future__ import annotations

import argparse
import datetime as dt
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from build_quarter_report import quarter_span  # noqa: E402

MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October",
          "November", "December"]
ROOT = pathlib.Path(__file__).resolve().parent.parent


def months_of(fy: int, q: int) -> str:
    lo, hi = quarter_span(fy, q)
    return f"{MONTHS[int(lo[5:7]) - 1]} to {MONTHS[int(hi[5:7]) - 1]} {hi[:4]}"


def slug_of(fy: int, q: int) -> str:
    return f"dol-perm-file-fy{fy}-q{q}"


def render(fy: int, q: int, day: str) -> str:
    key = f"{fy}q{q}"
    span = months_of(fy, q)
    part = lambda p: f'<QuarterNow quarter="{key}" part="{p}" />'  # noqa: E731
    return f'''---
title: "What DOL's PERM file for {span} shows"
description: "DOL's PERM file for {span}: how many cases it decided and certified, how long they took, and the busiest employers, firms, jobs and states."
date: "{day}"
author: "PERM Tracker team"
image: "/images/content/heroes/blog/{slug_of(fy, q)}.webp"
imageAlt: "PERM decisions in {span} against the quarter before and a year before, as bars"
imageCredit: "Chart from DOL's PERM disclosure file, permtracker.app"
tags: ["data-note", "perm", "dol-data", "quarterly"]
category: "data-notes"
seoTitle: "DOL PERM Data, {span}: What It Shows"
seoDescription: "DOL's PERM file for {span}, read case by case: decisions, the certified share, the wait, and who filed the most, against the quarter before."
featured: false
published: true
---

{part("newer")}

DOL publishes its PERM disclosure file every quarter, one row per case it decided. This note reads the file for <QuarterName quarter="{key}" /> case by case and sets it beside the quarter before and the same quarter a year earlier. Every figure comes from the file itself.

{part("headline")}

## How many PERM cases did DOL decide?

The bars below count every PERM case DOL decided in each quarter, certified, denied or withdrawn.

{part("outcomes")}

## Who filed the most?

These are the employers with the most decided cases in the quarter, each beside its count the quarter before and a year before.

{part("employers")}

The law firms named on the most decided cases. Firms only: DOL's file names the firm, and this site never names an individual attorney.

{part("firms")}

## Which jobs and states?

The jobs, by the occupation DOL assigned, with the most decided cases.

{part("jobs")}

And the states the jobs are in.

{part("states")}

## Which employers were new to DOL's files?

These employers had their first decided PERM case in DOL's files, which reach back to October 2015, this quarter.

{part("new")}

## What else did DOL decide in the same months?

The same quarter's prevailing wage determinations, which come before a PERM, and the H-1B labor condition applications DOL certified.

{part("programs")}

## What this file can't tell you

The file holds decided cases only, so it says nothing about the cases still waiting. The [PERM queue](/perm-queue) counts those from DOL's live record, by the month they were filed.

It counts each case on the day DOL decided it. A busy quarter here may be DOL working through an older filing month. The wait figures say how old the decided cases were.

DOL doesn't publish why it denied a case, and a withdrawal is the employer's own choice. An employer that files under several names is counted on one page, the way its page counts it; a name DOL's file spells in a way this site can't tie to a page stays apart.

## Where the figures come from

Every figure is from DOL's quarterly PERM, prevailing wage and LCA disclosure files, counted by the day DOL decided each case. The [PERM case search](/case-search) reads the same files one case at a time, and each employer and law firm links to its full record.
'''


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n", 1)[0])
    ap.add_argument("--fy", type=int, required=True)
    ap.add_argument("--q", type=int, required=True, choices=[1, 2, 3, 4])
    ap.add_argument("--date", default=dt.date.today().isoformat())
    ap.add_argument("--force", action="store_true", help="overwrite a post that exists")
    args = ap.parse_args()
    out = ROOT / "content" / "blog" / f"{slug_of(args.fy, args.q)}.mdx"
    if out.exists() and not args.force:
        print(f"{out} exists; pass --force to overwrite it")
        return 1
    out.write_text(render(args.fy, args.q, args.date))
    print(f"wrote {out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
