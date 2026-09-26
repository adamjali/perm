#!/usr/bin/env python3
"""Measure when each visa bulletin first appeared in the Internet Archive.

The State Department publishes no release date for the bulletin and keeps no
record of one. The archive's first capture of a bulletin page is the only
evidence of when it came out, and it is a FLOOR: the page existed by then, so
the bulletin was published on or before that day.

A capture only counts when its page carries the charts. The ingest's notes say
an early capture can predate the page being filled in, so each month's first
capture is fetched and read with the ingest's own parser, and the next capture
is tried when it isn't a bulletin yet (up to three).

The result is a typed table, `src/lib/bulletinCaptures.ts`, read by
`src/lib/bulletinRelease.ts`. It is a table rather than a Turso document
because it is small and cannot grow: travel.state.gov has refused the
archive's crawler since mid-July 2026, so no later bulletin has a capture.
Re-run it if that changes.

Usage:
    python3 scripts/measure_bulletin_captures.py                # every folder, writes the table
    python3 scripts/measure_bulletin_captures.py --cdx-dir DIR  # reuse saved CDX answers
    python3 scripts/measure_bulletin_captures.py --dry-run      # print, write nothing
    python3 scripts/measure_bulletin_captures.py --years 2024 --merge  # add one folder's months

Tests: python3 scripts/test_bulletin_captures.py
"""
from __future__ import annotations

import argparse
import datetime
import json
import pathlib
import re
import sys
import time
from zoneinfo import ZoneInfo

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import ingest_visa_bulletin as vb  # noqa: E402

HERE = pathlib.Path(__file__).resolve().parent
OUT = HERE.parent / "src" / "lib" / "bulletinCaptures.ts"
EASTERN = ZoneInfo("America/New_York")
MAX_TRIES = 3


def eastern_date(ts: str) -> str:
    """An archive timestamp (UTC, YYYYMMDDhhmmss) as the Eastern date it fell on."""
    utc = datetime.datetime.strptime(ts[:14], "%Y%m%d%H%M%S").replace(tzinfo=datetime.timezone.utc)
    return utc.astimezone(EASTERN).date().isoformat()


def captures_by_month(rows: list[list[str]]) -> dict[str, list[tuple[str, str]]]:
    """{bulletin month: [(timestamp, url), ...] oldest first} from CDX rows."""
    out: dict[str, list[tuple[str, str]]] = {}
    for _key, ts, url, *_rest in rows:
        m = re.search(r"visa-bulletin-for-([a-z]+)-(\d{4})\.html", url, re.I)
        if not m or m.group(1).lower() not in vb.MONTHS:
            continue
        month = f"{int(m.group(2)):04d}-{vb.MONTHS[m.group(1).lower()]:02d}"
        out.setdefault(month, []).append((ts, url))
    for caps in out.values():
        caps.sort()
    return out


def first_real_capture(month: str, caps: list[tuple[str, str]], fetch) -> tuple[str, str] | None:
    """The earliest capture whose page is this month's bulletin with its charts."""
    for ts, url in caps[:MAX_TRIES]:
        try:
            page = fetch(f"https://web.archive.org/web/{ts}/{url}")
        except Exception as exc:  # noqa: BLE001 - one capture must not end the run
            vb.log(f"  {month} {ts}: {exc}")
            continue
        if vb.month_from_page(page) == month and vb.parse_bulletin(page, month):
            return ts, url
        vb.log(f"  {month} {ts}: not a bulletin with charts yet; trying the next capture")
    return None


def read_table(path: pathlib.Path) -> list[dict]:
    """The rows an earlier run wrote, so a partial re-run can add to them."""
    if not path.exists():
        return []
    return [
        {"month": m, "captured": c}
        for m, c in re.findall(r'\{ month: "(\d{4}-\d{2})", captured: "(\d{4}-\d{2}-\d{2})" \}', path.read_text())
    ]


def merge_rows(old: list[dict], new: list[dict]) -> list[dict]:
    """Union by month; a month measured again takes the new value."""
    by = {r["month"]: r for r in old}
    by.update({r["month"]: r for r in new})
    return [by[m] for m in sorted(by)]


def render_ts(rows: list[dict], measured: str) -> str:
    lines = [
        "/**",
        " * The Internet Archive's first capture of each visa bulletin page that",
        " * carried the bulletin's charts, as an Eastern date: a floor on when the",
        " * bulletin came out. Written by `scripts/measure_bulletin_captures.py`",
        f" * on {measured} from the archive's index of",
        " * travel.state.gov/content/travel/en/legal/visa-law0/visa-bulletin/<fiscal year>/,",
        " * each capture fetched and read before it counted. Do not edit by hand.",
        " *",
        " * No bulletin after July 2026 is here: travel.state.gov has refused the",
        " * archive's crawler since mid-July 2026.",
        " */",
        "",
        'import type { FirstCapture } from "@/lib/bulletinRelease";',
        "",
        f'export const BULLETIN_CAPTURES_MEASURED = "{measured}";',
        "",
        "export const BULLETIN_FIRST_CAPTURES: readonly FirstCapture[] = [",
    ]
    for r in rows:
        lines.append(f'  {{ month: "{r["month"]}", captured: "{r["captured"]}" }},')
    lines.append("];")
    return "\n".join(lines) + "\n"


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    this_year = datetime.date.today().year
    ap.add_argument("--years", type=int, nargs="*", default=list(range(2015, this_year + 2)),
                    help="Fiscal-year folders to read")
    ap.add_argument("--cdx-dir", help="Read cdx<YEAR>.json from here instead of asking the archive")
    ap.add_argument("--out", default=str(OUT))
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--merge", action="store_true",
                    help="Keep the months already in --out and add or replace the ones measured now")
    args = ap.parse_args()

    rows: list[list[str]] = []
    for year in args.years:
        saved = pathlib.Path(args.cdx_dir) / f"cdx{year}.json" if args.cdx_dir else None
        try:
            text = saved.read_text() if saved and saved.exists() else vb.fetch(vb.CDX_TEMPLATE.format(year=year))
            got = json.loads(text)[1:] if text.strip() else []
        except Exception as exc:  # noqa: BLE001
            vb.log(f"  {year}: {exc}")
            continue
        if len(got) >= vb.CDX_LIMIT:
            vb.log(f"  WARNING {year}: hit the {vb.CDX_LIMIT}-row CDX limit; months may be missing")
        vb.log(f"  {year}: {len(got)} captures")
        rows += got
        if not saved:
            time.sleep(3)  # the archive is a free public service

    months = captures_by_month(rows)
    out: list[dict] = []
    missing: list[str] = []
    for month in sorted(months):
        hit = first_real_capture(month, months[month], vb.fetch)
        if hit is None:
            missing.append(month)
            continue
        out.append({"month": month, "captured": eastern_date(hit[0])})
        vb.log(f"  {month}: first captured {out[-1]['captured']}")
        time.sleep(1)

    vb.log(f"\n{len(out)} bulletins measured, {len(missing)} with no usable capture: {missing}")
    if args.merge:
        out = merge_rows(read_table(pathlib.Path(args.out)), out)
        vb.log(f"{len(out)} bulletins in the table after merging")
    if len(out) < 12:
        raise SystemExit("FATAL: fewer than twelve bulletins measured. Refusing to write.")
    body = render_ts(out, datetime.datetime.now(EASTERN).date().isoformat())
    if args.dry_run:
        print(body)
        return 0
    pathlib.Path(args.out).write_text(body)
    vb.log(f"wrote {args.out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
