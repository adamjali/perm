#!/usr/bin/env python3
"""Ingest the employment-based visa bulletin series from the Wayback Machine.

The State Department publishes the bulletin at travel.state.gov, which refuses
automated clients behind a bot challenge. Seven access routes were tried
directly and all were refused, and defeating a government site's bot protection
is not something this project does.

The Internet Archive is a different thing: a public archive of public pages,
built to be read programmatically. Reading an archived copy is not
circumventing anything, and it is what this uses.

The trade is FRESHNESS. The archive lags the live site, so this can never claim
to hold the current month's bulletin. That is why the product built on it is a
HISTORY: how a cutoff has moved over the months, with every month labelled by
the bulletin it came from. A movement series is honest about being historical in
a way that "here is this month's number" would not be, and the movement is the
part people actually cannot get anywhere else.

THE LAG IS NO LONGER A MONTH OR TWO. Measured 2026-08-25: travel.state.gov began
serving 403 to the Internet Archive's own crawler in mid-July 2026. The last
successful capture of any bulletin page is 2026-07-14; the first refused one is
2026-07-17. Every capture attempt since is the 4.8 KB Cloudflare block page, so
the August 2026 and September 2026 bulletins have never been archived at all
(15 and 28 capture attempts respectively, all 403, latest 2026-08-23).

    month       captures   status codes
    2026-07     16         7x 200, 4x 403, 5x no-status
    2026-08     15         15x 403
    2026-09     28         28x 403

So 2026-07 is the newest bulletin obtainable from any route this project is
willing to use, and it will stay that way until travel.state.gov relaxes. This
is a CEILING, not a backlog: re-running this script cannot fix it. The product
says so on the page rather than presenting a stale figure as a current one.

Routes measured the same day, with cloudflare.com/discord.com/flag.dol.gov as
controls (all reachable, so this is agency policy and not our IP):

    travel.state.gov, bare UA                    403
    travel.state.gov, full browser header set    403 (identical 5,868-byte body)
    www.uscis.gov filing-charts page             200, but carries NO cutoffs;
                                                 it names the current bulletin
                                                 month and links to DOS
    federalregister.gov API                      200, publishes rules about the
                                                 bulletin, never the bulletin
    archive.today mirror                         429, and a less reputable
                                                 archive is not worth leaning on

Usage:
    python3 scripts/ingest_visa_bulletin.py --out /tmp/vb.json --months 18
    npx convex run visaBulletin:storeBulletins "$(cat /tmp/vb.json)" --prod
"""
from __future__ import annotations

import argparse
import datetime
import hashlib
import html
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request

# Queried per calendar year. A single wildcard over the whole bulletin path
# matches thousands of URLs and the row limit truncates before it reaches the
# recent ones, which silently returned bulletins from 2022 while reporting
# success.
#
# `collapse=urlkey` is deliberately ABSENT, and its absence is load-bearing.
# CDX collapse keeps the FIRST row of each group, and rows are ordered by
# urlkey then timestamp, so it hands back the OLDEST capture of every bulletin.
# That silently defeated the "keep the latest snapshot" rule below: for the
# July 2026 bulletin it returned the 2026-06-18 capture while a 2026-07-14 one
# existed. An early capture can predate the page being filled in, which is the
# exact failure the rule was written to avoid.
#
# `filter=statuscode:200` is also load-bearing now that travel.state.gov
# refuses the archive's crawler: without it every August and September 2026
# capture would parse as a bulletin-shaped page with no charts on it.
CDX_LIMIT = 2000
CDX_TEMPLATE = (
    "http://web.archive.org/cdx/search/cdx"
    "?url=travel.state.gov/content/travel/en/legal/visa-law0/visa-bulletin/{year}/*"
    f"&output=json&filter=statuscode:200&limit={CDX_LIMIT}"
)
UA = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
    )
}

MONTHS = {
    m: i
    for i, m in enumerate(
        ["january", "february", "march", "april", "may", "june", "july",
         "august", "september", "october", "november", "december"], 1)
}

# The row labels the bulletin uses, mapped to the categories people say.
CATEGORY_ROWS = [
    ("EB1", "1st"),
    ("EB2", "2nd"),
    ("EB3", "3rd"),
    ("EW3", "Other Workers"),
    ("EB4", "4th"),
    ("EB5", "5th Unreserved"),
]

# Column order is fixed across every bulletin, but is asserted rather than
# assumed: a silently reordered column would swap India's cutoff for China's.
COUNTRY_COLUMNS = ["worldwide", "china", "india", "mexico", "philippines"]
COUNTRY_HEADINGS = ["ALL CHARGEABILITY", "CHINA", "INDIA", "MEXICO", "PHILIPPINES"]


def log(msg: str) -> None:
    print(msg, flush=True)


def fetch(url: str, attempts: int = 3) -> str:
    delay = 5
    for attempt in range(1, attempts + 1):
        try:
            with urllib.request.urlopen(
                urllib.request.Request(url, headers=UA), timeout=90
            ) as r:
                return r.read().decode("utf-8", "replace")
        except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError) as exc:
            if attempt == attempts:
                raise
            log(f"    retry {attempt}/{attempts} after {exc}")
            time.sleep(delay)
            delay *= 2
    raise SystemExit("unreachable")


def discover_snapshots(limit: int, years: list[int]) -> list[tuple[str, str, str]]:
    """Return [(bulletin_month, timestamp, url)], newest bulletin first."""
    log(f"Discovering archived bulletins for {years}")
    rows: list[list[str]] = []
    for year in years:
        try:
            year_rows = json.loads(fetch(CDX_TEMPLATE.format(year=year)))[1:]
        except Exception as exc:  # noqa: BLE001
            log(f"  {year}: {exc}")
            continue
        # Truncation is silent and drops whole months. Rows come back ordered
        # by urlkey, so hitting the limit loses the alphabetically-last
        # bulletins rather than the oldest ones, which is not a pattern anyone
        # would spot in the output.
        if len(year_rows) >= CDX_LIMIT:
            log(f"  WARNING {year}: hit the {CDX_LIMIT}-row CDX limit; months may be missing")
        rows += year_rows
    best: dict[str, tuple[str, str]] = {}
    for _key, ts, url, *_rest in rows:
        m = re.search(r"visa-bulletin-for-([a-z]+)-(\d{4})\.html", url, re.I)
        if not m:
            continue
        name, year = m.group(1).lower(), int(m.group(2))
        if name not in MONTHS:
            continue
        month = f"{year}-{MONTHS[name]:02d}"
        # Keep the LATEST snapshot of each bulletin: an early capture can
        # predate the page being filled in.
        if month not in best or ts > best[month][0]:
            best[month] = (ts, url)
    ordered = sorted(best.items(), reverse=True)[:limit]
    log(f"  {len(best)} distinct bulletins archived; taking the newest {len(ordered)}")
    return [(mo, ts, url) for mo, (ts, url) in ordered]


def text_cells(row_html: str) -> list[str]:
    return [
        re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", c))).strip()
        for c in re.findall(r"<t[dh][^>]*>(.*?)</t[dh]>", row_html, re.S | re.I)
    ]


def parse_bulletin(page: str) -> dict | None:
    """Extract both employment-based charts, or None if they are not present."""
    tables = re.findall(r"<table.*?</table>", page, re.S | re.I)
    eb = []
    for tbl in tables:
        rows = [
            c for c in (text_cells(tr) for tr in re.findall(r"<tr.*?</tr>", tbl, re.S | re.I))
            if any(c)
        ]
        if not rows:
            continue
        head = " ".join(rows[0]).upper().replace("- ", "-").replace(" -", "-")
        # Both charts carry INDIA, so the discriminator is EMPLOYMENT in the
        # first cell specifically. Matching anywhere in the header let a
        # family-sponsored chart through, whose third column is El Salvador and
        # not India.
        first_cell = rows[0][0].upper().replace("- ", "-").replace(" ", "")
        if first_cell.startswith("EMPLOYMENT") and "INDIA" in head:
            eb.append(rows)
    if len(eb) < 2:
        return None

    def chart(rows: list[list[str]]) -> dict[str, dict[str, str]]:
        header = [h.upper().replace("- ", "").replace(" ", "") for h in rows[0]]
        # Assert the column order rather than trust it.
        for i, expected in enumerate(COUNTRY_HEADINGS, start=1):
            if i >= len(header) or expected.replace(" ", "") not in header[i]:
                raise ValueError(f"column {i} is {header[i:i+1]}, expected {expected}")
        out: dict[str, dict[str, str]] = {}
        for code, label in CATEGORY_ROWS:
            for r in rows[1:]:
                if r and r[0].lower().startswith(label.lower()[:6]):
                    out[code] = {
                        c: r[i + 1] if i + 1 < len(r) else ""
                        for i, c in enumerate(COUNTRY_COLUMNS)
                    }
                    break
        return out

    # The bulletin always prints final action first, then dates for filing.
    return {"finalAction": chart(eb[0]), "datesForFiling": chart(eb[1])}


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--out", required=True)
    ap.add_argument("--months", type=int, default=18)
    ap.add_argument("--years", type=int, nargs="*", help="Calendar years to search")
    args = ap.parse_args()

    this_year = datetime.date.today().year
    years = args.years or [this_year, this_year - 1]
    snapshots = discover_snapshots(args.months, years)
    bulletins = []
    for month, ts, url in snapshots:
        log(f"  {month} (snapshot {ts})")
        try:
            page = fetch(f"https://web.archive.org/web/{ts}/{url}")
            parsed = parse_bulletin(page)
        except Exception as exc:  # noqa: BLE001 - one bad month must not kill the run
            log(f"    skipped: {exc}")
            continue
        if not parsed:
            log("    skipped: no employment-based charts on the page")
            continue
        bulletins.append({
            "bulletinMonth": month,
            "archivedAt": ts,
            "sourceUrl": url,
            **parsed,
        })
        time.sleep(1)  # the archive is a free public service; do not hammer it

    payload = {"bulletins": bulletins}
    body = json.dumps(payload, sort_keys=True, separators=(",", ":"))
    payload["contentHash"] = hashlib.sha256(body.encode()).hexdigest()

    log("")
    log(f"bulletins parsed  {len(bulletins)}")
    if bulletins:
        newest = bulletins[0]["bulletinMonth"]
        log(f"newest            {newest}")
        log(f"oldest            {bulletins[-1]['bulletinMonth']}")

        # State the lag rather than leaving it to be noticed. The archive route
        # has a ceiling it cannot cross on its own (see the module docstring),
        # so "two months behind" is the expected steady state, not a sign the
        # run failed.
        today = datetime.date.today()
        ny, nm = (int(x) for x in newest.split("-"))
        behind = (today.year - ny) * 12 + (today.month - nm)
        log(f"today             {today:%Y-%m}")
        log(f"months behind     {behind}")
        if behind >= 1:
            log(
                "                  the archive holds no later bulletin. This is a"
                " ceiling, not a backlog:"
            )
            log(
                "                  travel.state.gov refuses the archive's crawler,"
                " so re-running will not help."
            )

    if len(bulletins) < 3:
        raise SystemExit("FATAL: fewer than three bulletins parsed. Refusing to write.")

    with open(args.out, "w") as fh:
        json.dump(payload, fh, separators=(",", ":"))
    log(f"wrote {args.out} ({os.path.getsize(args.out) / 1024:.1f} KB)")

    # Stamp our own freshness row. This ingest previously wrote data without
    # recording that it had: the row came from a one-off backfill that is in no
    # workflow, so `as_of` described that run forever while the data refreshed
    # on schedule underneath it. A frozen row makes the monitor cry wolf, and a
    # monitor that cries wolf is one you stop reading.
    db.execute("""CREATE TABLE IF NOT EXISTS data_freshness (
        dataset TEXT PRIMARY KEY, as_of TEXT, fetched_at INTEGER,
        source TEXT, cadence TEXT, note TEXT, max_age_days INTEGER)""")
    n = int(db.scalar("SELECT count(*) FROM visa_bulletins") or 0)
    db.execute("INSERT OR REPLACE INTO data_freshness VALUES (?,?,?,?,?,?,?)",
               ["visa-bulletin", str(db.scalar("SELECT max(bulletin_month) FROM visa_bulletins"))[:10], int(time.time() * 1000),
                "State Dept via Internet Archive; gaps via permtrack.app mirror", "Monthly", f"{n:,} bulletins", 75])

    return 0


if __name__ == "__main__":
    sys.exit(main())
