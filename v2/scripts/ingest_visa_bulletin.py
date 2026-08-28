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

THE BLOCK IS AGENCY POLICY, NOT OUR ADDRESS. Re-measured 2026-08-27 from a
GitHub Actions runner, an entirely different network, with controls in the
same run:

    travel.state.gov  bulletin index          403   5,843 b, 0 cutoffs
    travel.state.gov  September 2026 page     403   5,843 b, 0 cutoffs
    travel.state.gov  robots.txt              403   4,905 b
    cloudflare.com                            200   (control)
    flag.dol.gov                              200   (control)
    www.dol.gov  full browser header set      200   (403 from this laptop)
    www.uscis.gov                             403   (200 from this laptop)

A host that refuses robots.txt itself is not rate-limiting us. Two networks,
every path, same 403. The first run of that probe had a control that ALSO
failed, which made it worthless - a probe whose control fails is blind, and
its findings read exactly like real ones.

So there is no automated primary route, and there will not be one until the
State Department relaxes. What there IS:

    --from-file   A person opens the public page in a normal browser and
                  saves it; this parses, validates and stores it, with
                  primary-source provenance. The bulletin is ONE page
                  published ONCE a month, so the human step is 30 seconds
                  twelve times a year, and it removes the dependency on
                  anyone else's mirror entirely.

Usage:
    # Archive route: the back series, automated, structurally behind.
    python3 scripts/ingest_visa_bulletin.py --out /tmp/vb.json --months 18
    npx convex run visaBulletin:storeBulletins "$(cat /tmp/vb.json)" --prod

    # Primary route: this month, from the source, needing one human minute.
    #   1. Open the bulletin in a browser.
    #   2. Save it (Cmd+S, "Page Source" / "HTML only" is enough).
    #   3. Point this at the file. It refuses a challenge page, a page with
    #      no charts, a month it cannot read, and a month you assert that
    #      the page contradicts.
    python3 scripts/ingest_visa_bulletin.py --from-file ~/Downloads/vb.html

Tests: python3 scripts/test_visa_bulletin.py
"""
from __future__ import annotations

import argparse
import datetime
import hashlib
import html
import json
import os
import pathlib
import re
import sys
import time
import urllib.error
import urllib.request

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from lib_turso import Turso  # noqa: E402

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
# Several alternates per code, because DOL has renamed rows over the years and
# a single label silently drops a whole category from the older months.
#
# EB5 IS THE ONE THAT MOVED. The EB-5 Reform and Integrity Act (March 2022)
# replaced the old split - "5th Non-Regional Center (C5 and T5)" and "5th
# Regional Center (I5 and R5)" - with "5th Unreserved" plus three set-asides.
# Matching only "5th Unreserved" left EB5 missing from every bulletin before
# 2022-05: 18 months, silently, with nothing erroring.
#
# The two pre-RIA rows carry IDENTICAL cutoffs (checked on April 2021: both
# 15AUG15 China final-action, both 15DEC15 dates-for-filing), so taking the
# non-regional row loses nothing. It is not the same legal category as
# today's Unreserved, which is why the alternates are listed in order and the
# newest name wins where both appear.
CATEGORY_ROWS = [
    ("EB1", ["1st"]),
    ("EB2", ["2nd"]),
    ("EB3", ["3rd"]),
    ("EW3", ["Other Workers"]),
    ("EB4", ["4th"]),
    ("EB5", ["5th Unreserved", "5th Non-Regional Center", "5th Regional Center"]),
]

# Column order is fixed across every bulletin, but is asserted rather than
# assumed: a silently reordered column would swap India's cutoff for China's.
COUNTRY_COLUMNS = ["worldwide", "china", "india", "mexico", "philippines"]
COUNTRY_HEADINGS = ["ALL CHARGEABILITY", "CHINA", "INDIA", "MEXICO", "PHILIPPINES"]

# Primary source. Named as what it is - a person opened the page - so a
# reader can tell it apart from the archived and mirrored rows beside it.
SAVED_PAGE_SOURCE = (
    "travel.state.gov (page saved from a browser; the site refuses automated clients)"
)


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
        """Resolve each country to its OWN column, by header name.

        POSITION IS NOT STABLE ACROSS YEARS. Bulletins before roughly April
        2023 carry a SIXTH country column on the employment chart - EL
        SALVADOR / GUATEMALA / HONDURAS, between CHINA and INDIA - which was
        later dropped. A parser that asserted "column 3 is INDIA" therefore
        refused 18 real bulletins with
        `column 3 is ['ELSALVADORGUATEMALAHONDURAS'], expected INDIA`.

        Refusing was the right failure: reading that column as India would
        have published Central American cutoffs as Indian ones, silently, on
        a page headed "These are not estimates." But the fix is to stop
        assuming position at all. Finding each country by its own heading
        handles both layouts, ignores columns we do not track, and still
        fails loudly when a country we DO need is absent.
        """
        header = [h.upper().replace("- ", "").replace(" ", "") for h in rows[0]]
        idx: dict[str, int] = {}
        for col, heading in zip(COUNTRY_COLUMNS, COUNTRY_HEADINGS):
            want = heading.replace(" ", "")
            # Skip cell 0: it is the row-label column ("Employment- based").
            for i, h in enumerate(header[1:], start=1):
                if want in h:
                    idx[col] = i
                    break
            else:
                raise ValueError(f"no column matched {heading}; header={header}")
        out: dict[str, dict[str, str]] = {}
        for code, labels in CATEGORY_ROWS:
            done = False
            for label in labels:          # alternates in preference order
                for r in rows[1:]:
                    # Compare on the full label, not a 6-character prefix:
                    # "5th Unreserved" and "5th Non-Regional" share "5th un"?
                    # No - but "5th Reg" and "5th Res" would, and a prefix
                    # short enough to be convenient is short enough to collide.
                    if r and r[0].strip().lower().startswith(label.lower()):
                        out[code] = {c: (r[i] if i < len(r) else "") for c, i in idx.items()}
                        done = True
                        break
                if done:
                    break
        return out

    # The bulletin always prints final action first, then dates for filing.
    return {"finalAction": chart(eb[0]), "datesForFiling": chart(eb[1])}


def month_from_page(page: str) -> str | None:
    """The bulletin month, read off the page, or None if it cannot be trusted.

    An unanchored search would take the first month-shaped string anywhere in
    the document, and these pages name several: the cutoffs themselves are
    dates, and the footer links to the neighbouring months. So this matches
    only the page's own title phrase, and REFUSES when two different months
    match it. A plausible wrong month is far worse than no month - a null stops
    the run, and a wrong one silently files October's cutoffs under September.
    """
    hits = {
        f"{int(y):04d}-{MONTHS[m.lower()]:02d}"
        for m, y in re.findall(
            r"[Vv]isa\s+[Bb]ulletin\s+[Ff]or\s+([A-Za-z]+)\s+(\d{4})", page
        )
        if m.lower() in MONTHS
    }
    return hits.pop() if len(hits) == 1 else None


def ingest_saved_page(path: str, month: str | None) -> int:
    """Store one bulletin from a page saved out of a browser.

    travel.state.gov refuses every automated client, from this machine and
    from GitHub's runners alike, on every path including robots.txt (measured
    2026-08-27, with cloudflare.com and flag.dol.gov returning 200 in the same
    run as controls, so it is agency policy and not our address). Defeating
    that is not something this project does.

    A person opening a public page in their own browser is not automation, and
    the bulletin is ONE page published ONCE a month. So the human step is the
    30 seconds it takes to save the page; everything after it - parsing,
    validating the column order, storing, stamping - is this function.

    It is deliberately the SAME parser the archive route uses. A second parser
    for the same document is a second thing to get wrong, and the two would
    drift on the first bulletin that changed shape.
    """
    page = pathlib.Path(path).read_text(errors="replace")
    log(f"read {path} ({len(page) / 1024:.0f} KB)")

    if "Attention Required" in page or "Just a moment" in page:
        raise SystemExit(
            "FATAL: that file is Cloudflare's challenge page, not a bulletin. "
            "Open the URL in a normal browser tab and save from there."
        )

    m = month or month_from_page(page)
    if not m:
        raise SystemExit(
            "FATAL: could not read exactly one bulletin month from the page. "
            "Pass --month YYYY-MM explicitly."
        )
    if month and (found := month_from_page(page)) and found != month:
        raise SystemExit(f"FATAL: --month {month} but the page says {found}.")

    parsed = parse_bulletin(page)   # raises on a reordered column
    if not parsed:
        raise SystemExit(
            "FATAL: no employment-based charts found. Save the bulletin page "
            "itself, not the index that links to it."
        )
    cats = sorted(parsed["finalAction"])
    if len(cats) < 4:
        raise SystemExit(f"FATAL: only {len(cats)} categories parsed: {cats}")
    log(f"month {m}  categories {', '.join(cats)}")

    db = Turso()
    prior = db.scalar(
        "SELECT source_url FROM visa_bulletins WHERE bulletin_month = ?", [m]
    )
    db.execute(
        "INSERT OR REPLACE INTO visa_bulletins "
        "(bulletin_month, source_url, archived_at, final_action, "
        " dates_for_filing, computed_at) VALUES (?,?,?,?,?,?)",
        [m, SAVED_PAGE_SOURCE, datetime.datetime.now(datetime.timezone.utc).isoformat(),
         json.dumps(parsed["finalAction"]), json.dumps(parsed["datesForFiling"]),
         int(time.time() * 1000)],
    )
    # Say when a mirrored row has been replaced by the real thing. Silently
    # overwriting one source with another is how provenance stops meaning
    # anything.
    if prior and prior != SAVED_PAGE_SOURCE:
        log(f"replaced a row previously sourced from: {prior}")
    log(f"stored {m}")

    n = int(db.scalar("SELECT count(*) FROM visa_bulletins") or 0)
    db.execute("""CREATE TABLE IF NOT EXISTS data_freshness (
        dataset TEXT PRIMARY KEY, as_of TEXT, fetched_at INTEGER,
        source TEXT, cadence TEXT, note TEXT, max_age_days INTEGER)""")
    db.execute("INSERT OR REPLACE INTO data_freshness VALUES (?,?,?,?,?,?,?)",
               ["visa-bulletin",
                str(db.scalar("SELECT max(bulletin_month) FROM visa_bulletins"))[:10],
                int(time.time() * 1000), SAVED_PAGE_SOURCE, "Monthly",
                f"{n:,} bulletins", 75])
    log(f"visa_bulletins now holds {n} months")
    return 0


# Which source wins when two of them hold the same month. A better source
# must never be overwritten by a worse one, and "better" here is not a
# judgement call: the saved page and the archived page are both the State
# Department's own document, and the mirror is a third party's summary of it
# that carries HALF THE CATEGORIES (EB1/EB2/EB3 only, no EB4, EB5 or EW3).
# ORDER IS LOAD-BEARING, and the mirror clause MUST come before the
# travel.state.gov one. The mirror records itself as
#   "permtrack.app/api/stats/visa-bulletin (mirror; original: travel.state.gov)"
# because naming the original is good provenance - and that means a plain
# substring test for "travel.state.gov" matches the MIRROR too, ranks it as
# the real page, and makes the backfill skip every month that most needs
# upgrading while reporting success. Caught by a unit test before it ran.
SOURCE_RANK = [
    (lambda u: "saved from a browser" in u, 3),   # primary, a person fetched it
    (lambda u: "mirror" in u.lower() or "permtrack" in u.lower(), 1),
    (lambda u: "travel.state.gov" in u, 2),       # the real page, via the archive
    (lambda u: True, 1),
]


def rank_of(source_url: str) -> int:
    for pred, rank in SOURCE_RANK:
        if pred(source_url or ""):
            return rank
    return 0


def backfill_from_archive(years: list[int], limit: int) -> int:
    """Re-parse every bulletin the archive can still serve, straight to Turso.

    WHY THIS EXISTED AS A GAP. `main()` defaults to `[this_year, this_year-1]`,
    but the folder in the URL is the FISCAL year, so the November 2025 bulletin
    lives under /2026/ and the whole of calendar 2024 lives under /2024/ and
    /2025/. Two years of folders is not two years of bulletins, and the months
    that fell outside them were quietly filled from the mirror instead - at
    three categories each, for 24 months, with nothing anywhere saying so.

    Nothing was broken and nothing errored. The series just silently carried
    half the categories for two thirds of its length.
    """
    db = Turso()
    res = db.execute("SELECT bulletin_month, source_url, final_action FROM visa_bulletins")
    have = {}
    for r in res["response"]["result"]["rows"]:
        src = r[1]["value"] if r[1]["type"] != "null" else ""
        try:
            cats = len(json.loads(r[2]["value"])) if r[2]["type"] != "null" else 0
        except Exception:  # noqa: BLE001
            cats = 0
        have[r[0]["value"]] = (src, cats)
    log(f"holding {len(have)} months before this run")

    snaps = discover_snapshots(limit, years)
    added = upgraded = skipped = failed = 0
    for month, ts, url in snaps:
        current = have.get(month)
        # Re-parse a row that is already from a good source but INCOMPLETE.
        # This is what makes a parser improvement self-healing: when EB5 was
        # missing from every pre-2022-05 bulletin because DOL had renamed the
        # row, a rank-only skip meant fixing the parser fixed nothing, and the
        # 18 short months would have sat there looking fine.
        if current is not None and rank_of(current[0]) >= 2 and current[1] >= 6:
            skipped += 1
            continue
        try:
            parsed = parse_bulletin(fetch(f"https://web.archive.org/web/{ts}/{url}"))
        except Exception as exc:  # noqa: BLE001 - one bad month must not end the run
            log(f"  {month}: {exc}")
            failed += 1
            continue
        if not parsed:
            log(f"  {month}: no employment-based charts in that capture")
            failed += 1
            continue
        cats = len(parsed["finalAction"])
        db.execute(
            "INSERT OR REPLACE INTO visa_bulletins (bulletin_month, source_url, "
            "archived_at, final_action, dates_for_filing, computed_at) "
            "VALUES (?,?,?,?,?,?)",
            [month, url, ts, json.dumps(parsed["finalAction"]),
             json.dumps(parsed["datesForFiling"]), int(time.time() * 1000)],
        )
        if current is None:
            log(f"  {month}: ADDED ({cats} categories)")
            added += 1
        elif rank_of(current[0]) >= 2:
            log(f"  {month}: RE-PARSED {current[1]} -> {cats} categories")
            upgraded += 1
        else:
            log(f"  {month}: UPGRADED mirror -> State Dept ({cats} categories)")
            upgraded += 1
        time.sleep(1)  # the archive is a free public service; do not hammer it

    log("")
    log(f"added     {added}")
    log(f"upgraded  {upgraded}")
    log(f"skipped   {skipped} (already from a source at least as good)")
    log(f"failed    {failed}")

    n = int(db.scalar("SELECT count(*) FROM visa_bulletins") or 0)
    db.execute("""CREATE TABLE IF NOT EXISTS data_freshness (
        dataset TEXT PRIMARY KEY, as_of TEXT, fetched_at INTEGER,
        source TEXT, cadence TEXT, note TEXT, max_age_days INTEGER)""")
    db.execute("INSERT OR REPLACE INTO data_freshness VALUES (?,?,?,?,?,?,?)",
               ["visa-bulletin",
                str(db.scalar("SELECT max(bulletin_month) FROM visa_bulletins"))[:10],
                int(time.time() * 1000),
                "State Dept via Internet Archive; current month from a saved page",
                "Monthly", f"{n:,} bulletins", 75])
    log(f"visa_bulletins now holds {n} months")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--out", help="Payload path (required for the archive route)")
    ap.add_argument("--months", type=int, default=18)
    ap.add_argument("--years", type=int, nargs="*", help="Calendar years to search")
    ap.add_argument(
        "--from-file",
        help="A bulletin page saved from a browser. Stores that one month "
             "straight to Turso as a primary-source row.",
    )
    ap.add_argument("--month", help="YYYY-MM, when the page cannot be read for it")
    ap.add_argument(
        "--backfill-turso", action="store_true",
        help="Re-parse every bulletin the archive still serves, writing "
             "straight to Turso and never overwriting a better source.",
    )
    args = ap.parse_args()

    # The primary route writes to the database directly and needs no payload,
    # so it short-circuits before any archive lookup.
    if args.from_file:
        return ingest_saved_page(args.from_file, args.month)
    if args.backfill_turso:
        # The folder is the FISCAL year, so cover a wide span by default
        # rather than the two the archive route assumes.
        this_year = datetime.date.today().year
        return backfill_from_archive(
            args.years or list(range(this_year - 4, this_year + 1)), args.months)
    if not args.out:
        ap.error("--out is required unless --from-file or --backfill-turso is given")

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
    db = Turso()
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
