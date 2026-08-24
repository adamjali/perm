#!/usr/bin/env python3
"""Ingest the employment-based visa bulletin series from the Wayback Machine.

The State Department publishes the bulletin at travel.state.gov, which refuses
automated clients behind a bot challenge. Seven access routes were tried
directly and all were refused, and defeating a government site's bot protection
is not something this project does.

The Internet Archive is a different thing: a public archive of public pages,
built to be read programmatically. Reading an archived copy is not
circumventing anything, and it is what this uses.

The trade is FRESHNESS. The archive lags the live site by a month or two, so
this can never claim to hold the current month's bulletin. That is why the
product built on it is a HISTORY: how a cutoff has moved over the months, with
every month labelled by the bulletin it came from. A movement series is honest
about being historical in a way that "here is this month's number" would not be,
and the movement is the part people actually cannot get anywhere else.

Usage:
    python3 scripts/ingest_visa_bulletin.py --out /tmp/vb.json --months 18
    npx convex run visaBulletin:storeBulletins "$(cat /tmp/vb.json)" --prod
"""
from __future__ import annotations

import argparse
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
CDX_TEMPLATE = (
    "http://web.archive.org/cdx/search/cdx"
    "?url=travel.state.gov/content/travel/en/legal/visa-law0/visa-bulletin/{year}/*"
    "&output=json&filter=statuscode:200&collapse=urlkey&limit=400"
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
            rows += json.loads(fetch(CDX_TEMPLATE.format(year=year)))[1:]
        except Exception as exc:  # noqa: BLE001
            log(f"  {year}: {exc}")
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

    import datetime
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
        log(f"newest            {bulletins[0]['bulletinMonth']}")
        log(f"oldest            {bulletins[-1]['bulletinMonth']}")
    if len(bulletins) < 3:
        raise SystemExit("FATAL: fewer than three bulletins parsed. Refusing to write.")

    with open(args.out, "w") as fh:
        json.dump(payload, fh, separators=(",", ":"))
    log(f"wrote {args.out} ({os.path.getsize(args.out) / 1024:.1f} KB)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
