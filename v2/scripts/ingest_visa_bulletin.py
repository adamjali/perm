#!/usr/bin/env python3
"""Ingest the visa bulletin: employment and family charts, every month.

Three routes, ranked by SOURCE_RANK so a worse source never overwrites a
better one:

--direct      Automatic, daily. The State Department serves its bulletin
pages from adoption.state.gov to scripts (travel.state.gov
refuses every automated client). Primary source.
--from-file   The fallback: a page a person saved from a browser. Same
parser, same checks, same primary-source rank.
--out         The back series from the Internet Archive, for months no
primary route can reach. The archive stopped capturing new
bulletins in July 2026, when travel.state.gov began refusing
its crawler too, so this can only fill history.

Every route goes through one parser that refuses anything that isn't a whole
bulletin: a challenge page, missing charts, a month it can't read, a column
in the wrong place.

Usage:
python3 scripts/ingest_visa_bulletin.py --direct
python3 scripts/ingest_visa_bulletin.py --from-file ~/Downloads/vb.html
python3 scripts/ingest_visa_bulletin.py --out /tmp/vb.json --months 18
# The archive route writes the database directly too; the JSON is
# turso_migrate_public.py's input.

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
from lib_turso import Turso, add_missing_columns, query_rows, stamp_freshness  # noqa: E402

# Queried per calendar year: one wildcard over the whole bulletin path hits the
# row limit and truncates before the recent months, while reporting success.
#
# `collapse=urlkey` is deliberately absent: it keeps the OLDEST capture of each
# bulletin, which can predate the page being filled in, and the rule below
# wants the latest. `filter=statuscode:200` keeps refused captures (a
# Cloudflare block page) from parsing as a bulletin with no charts.
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
# Several alternates per code, because rows have been renamed over the years
# and a single label silently drops a whole category from the older months.
#
# EB-5 is the one that moved: the EB-5 Reform and Integrity Act (March 2022)
# replaced "5th Non-Regional Center (C5 and T5)" and "5th Regional Center (I5
# and R5)" with "5th Unreserved" plus three set-asides. The two older rows carry
# identical cutoffs, so taking the non-regional row loses nothing. Alternates
# are listed in order, so the newest name wins where both appear.
CATEGORY_ROWS = [
    ("EB1", ["1st"]),
    ("EB2", ["2nd"]),
    ("EB3", ["3rd"]),
    ("EW3", ["Other Workers"]),
    ("EB4", ["4th"]),
    # "5th Targeted Employment Areas/ Regional Centers and Pilot Programs" is the
    # single EB-5 row of bulletins before October 2015 (October 2015's
    # dates-for-filing chart still used it after its final-action chart had split).
    # Last, so a month that prints both takes the newer name. "5th Targeted" also
    # matches the unspaced "5th Targeted EmploymentAreas" some captures carry.
    ("EB5", ["5th Unreserved", "5th Non-Regional Center", "5th Regional Center", "5th Targeted"]),
    # The three set-asides. The bulletin prints the label in a different shape on
    # each chart ("5th Set Aside: Rural (20%, including NR, RR)" and "5th Set
    # Aside: (Rural: NR, RR - 20%)"); both start with the phrase and the name, and
    # some 2022 months hyphenate it. The codes match USCIS's inventory workbook
    # (EB5R, EB5HU, EB5I), which lets the I-485 tool pair a set-aside cutoff with
    # its own inventory.
    ("EB5R", ["5th Set Aside: Rural", "5th Set Aside: (Rural", "5th Set-Aside: Rural", "5th Set-Aside: (Rural"]),
    ("EB5HU", ["5th Set Aside: High Unemployment", "5th Set Aside: (High Unemployment",
               "5th Set-Aside: High Unemployment", "5th Set-Aside: (High Unemployment"]),
    ("EB5I", ["5th Set Aside: Infrastructure", "5th Set Aside: (Infrastructure",
              "5th Set-Aside: Infrastructure", "5th Set-Aside: (Infrastructure"]),
]

# How many categories a complete parse of a given month yields. Six before the
# EB-5 Reform and Integrity Act split the category (the May 2022 bulletin is
# the first with set-aside rows), nine from then on. The backfill compares a
# stored row's count with this rather than with a constant, so a parser that
# learns a new row repairs its own history without re-fetching months that
# were already complete for their era.
SET_ASIDES_FROM = "2022-05"

# The family-sponsored chart, read the same way. Same country columns; the row
# labels are the preference codes themselves. F2A and F2B are distinct rows and
# must not be prefix-matched to "F2".
FAMILY_ROWS = [
    ("F1", ["F1"]),
    ("F2A", ["F2A"]),
    ("F2B", ["F2B"]),
    ("F3", ["F3"]),
    ("F4", ["F4"]),
]


def expected_categories(month: str) -> int:
    return 9 if month >= SET_ASIDES_FROM else 6


# The Dates for Filing chart began with the October 2015 bulletin. Before it the
# bulletin printed one employment chart (final action) and one family chart, so
# a single chart is a whole bulletin for those months and a truncated capture
# for every month since.
DATES_FOR_FILING_FROM = "2015-10"

# Column order is fixed across every bulletin, but is asserted rather than
# assumed: a silently reordered column would swap India's cutoff for China's.
COUNTRY_COLUMNS = ["worldwide", "china", "india", "mexico", "philippines"]
COUNTRY_HEADINGS = ["ALL CHARGEABILITY", "CHINA", "INDIA", "MEXICO", "PHILIPPINES"]

# The run age is what catches a missed month: `as_of` is the month the bulletin
# COVERS, about a month in the future while current, so its own age can't. The
# health check budgets the run age at max(7, max_age_days * 2), and at 20 that
# is 40 days: quiet while a bulletin lands every ~30, firing on one missed
# month.
BULLETIN_MAX_AGE_DAYS = 20

# Named for what it is (a person saved the page), so a reader can tell it apart
# from the direct and archived rows beside it.
SAVED_PAGE_SOURCE = (
    "travel.state.gov (page saved from a browser; the site refuses automated clients)"
)

# The State Department serves the same bulletin pages from adoption.state.gov,
# its own host, which answers a plain request (index, month pages and PDFs)
# and has no robots.txt rule against it. Same parser, same validation and same
# primary-source rank as a page saved from a browser: it is the same document.
DIRECT_ORIGIN = "https://adoption.state.gov"
DIRECT_INDEX = f"{DIRECT_ORIGIN}/content/travel/en/legal/visa-law0/visa-bulletin.html"
DIRECT_SOURCE = (
    "adoption.state.gov (the State Department's own page, served to scripts; "
    "travel.state.gov refuses them)"
)
DIRECT_LINK = re.compile(
    r"/content/travel/en/legal/visa-law0/visa-bulletin/(\d{4})/"
    r"visa-bulletin-for-([a-z]+)-(\d{4})\.html"
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
        # Truncation is silent and drops whole months, and rows come back ordered
        # by urlkey, so it loses the alphabetically-last bulletins, not the oldest.
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


def parse_bulletin(page: str, month: str | None = None) -> dict | None:
    """Extract both employment-based charts, or None if they are not present.

    `month` is needed only for bulletins before October 2015, which printed one
    employment chart: with it, one chart parses (dates for filing stored as an
    empty chart, because none existed); without it, or for a later month, one
    chart is refused as a truncated capture.
    """
    tables = re.findall(r"<table.*?</table>", page, re.S | re.I)
    eb = []
    fb = []
    for tbl in tables:
        rows = [
            c for c in (text_cells(tr) for tr in re.findall(r"<tr.*?</tr>", tbl, re.S | re.I))
            if any(c)
        ]
        if not rows:
            continue
        head = " ".join(rows[0]).upper().replace("- ", "-").replace(" -", "-")
        # Both charts carry INDIA, so the discriminator is EMPLOYMENT in the first
        # cell specifically: matching anywhere in the header would let a family
        # chart through, whose third column is El Salvador, not India.
        first_cell = rows[0][0].upper().replace("- ", "-").replace(" ", "")
        if first_cell.startswith("EMPLOYMENT") and "INDIA" in head:
            eb.append(rows)
        elif first_cell.startswith("FAMILY") and "INDIA" in head:
            fb.append(rows)
    single_era = month is not None and month < DATES_FOR_FILING_FROM
    if len(eb) < (1 if single_era else 2):
        return None

    def chart(rows: list[list[str]], category_rows=CATEGORY_ROWS) -> dict[str, dict[str, str]]:
        """Resolve each country to its OWN column, by header name.

        Position is not stable across years: bulletins before roughly April 2023
        carry a sixth country column (EL SALVADOR / GUATEMALA / HONDURAS) between
        CHINA and INDIA. Finding each country by its own heading handles both
        layouts, ignores columns we don't track, and still fails loudly when a
        country we need is absent.
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
        for code, labels in category_rows:
            done = False
            for label in labels:          # alternates in preference order
                for r in rows[1:]:
                    # Compare on the full label, not a short prefix: a prefix short
                    # enough to be convenient ("5th Reg", "5th Res") is short enough to
                    # collide. A family code is matched whole ("F2A" must not take the
                    # "F2B" row), which `startswith` guarantees here because no family
                    # label is a prefix of another.
                    if r and r[0].strip().lower().startswith(label.lower()):
                        out[code] = {c: (r[i] if i < len(r) else "") for c, i in idx.items()}
                        done = True
                        break
                if done:
                    break
        return out

    # The bulletin always prints final action first, then dates for filing.
    # Before October 2015 there was no second chart to read.
    out = {"finalAction": chart(eb[0]), "datesForFiling": chart(eb[1]) if len(eb) >= 2 else {}}
    # The family charts precede the employment ones on the page and share
    # the country columns. Absent from a month is a real state (an old
    # capture trimmed to the employment tables), stored as null and repaired
    # by the backfill, never as an empty chart.
    if len(fb) >= 2:
        out["familyFinalAction"] = chart(fb[0], FAMILY_ROWS)
        out["familyDatesForFiling"] = chart(fb[1], FAMILY_ROWS)
    elif len(fb) == 1 and single_era:
        out["familyFinalAction"] = chart(fb[0], FAMILY_ROWS)
    return out


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


def ensure_family_columns(db: Turso) -> None:
    """Add the family-chart columns to a table that predates them."""
    add_missing_columns(db, "visa_bulletins",
                        {"family_final_action": "TEXT", "family_dates_for_filing": "TEXT"})


def family_json(parsed: dict, key: str) -> str | None:
    return json.dumps(parsed[key]) if parsed.get(key) else None


def ingest_saved_page(path: str, month: str | None) -> int:
    """Store one bulletin from a page saved out of a browser.

    The fallback when the direct route is refused: a person saves the public page
    in a browser, and everything after that (parsing, validating the column
    order, storing, stamping) is this function. It shares the direct route's
    parser, so there is one set of checks for one document.
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

    parsed = validated(page, m)   # every refusal happens before any connection
    db = Turso()
    write_month(db, m, parsed, SAVED_PAGE_SOURCE)
    stamp_bulletin_freshness(db, SAVED_PAGE_SOURCE)
    return 0


def validated(page: str, m: str) -> dict:
    """Parse one bulletin page, refusing anything that isn't a whole bulletin.

    Shared by the saved-page and direct routes: one parser, one set of checks,
    and no database connection until they have all passed.
    """
    parsed = parse_bulletin(page, m)   # raises on a reordered column
    if not parsed:
        raise SystemExit(
            "FATAL: no employment-based charts found. Save the bulletin page "
            "itself, not the index that links to it."
        )
    cats = sorted(parsed["finalAction"])
    if len(cats) < 4:
        raise SystemExit(f"FATAL: only {len(cats)} categories parsed: {cats}")
    log(f"month {m}  categories {', '.join(cats)}")
    return parsed


def write_month(db: Turso, m: str, parsed: dict, source: str) -> None:
    """Store one validated bulletin as a primary-source row."""
    ensure_family_columns(db)
    prior = db.scalar(
        "SELECT source_url FROM visa_bulletins WHERE bulletin_month = ?", [m]
    )
    db.execute(
        "INSERT OR REPLACE INTO visa_bulletins "
        "(bulletin_month, source_url, archived_at, final_action, "
        " dates_for_filing, computed_at, family_final_action, family_dates_for_filing) "
        "VALUES (?,?,?,?,?,?,?,?)",
        [m, source, datetime.datetime.now(datetime.timezone.utc).isoformat(),
         json.dumps(parsed["finalAction"]), json.dumps(parsed["datesForFiling"]),
         int(time.time() * 1000), family_json(parsed, "familyFinalAction"),
         family_json(parsed, "familyDatesForFiling")],
    )
    # Say when a mirrored row has been replaced by the real thing. Silently
    # overwriting one source with another is how provenance stops meaning
    # anything.
    if prior and prior != source:
        log(f"replaced a row previously sourced from: {prior}")
    log(f"stored {m}")


def stamp_bulletin_freshness(db: Turso, source: str) -> None:
    n = int(db.scalar("SELECT count(*) FROM visa_bulletins") or 0)
    stamp_freshness(db, "visa-bulletin",
                    as_of=str(db.scalar("SELECT max(bulletin_month) FROM visa_bulletins"))[:10],
                    source=source, cadence="Monthly", note=f"{n:,} bulletins",
                    max_age_days=BULLETIN_MAX_AGE_DAYS)
    log(f"visa_bulletins now holds {n} months")


def note_stored() -> None:
    """Tell the workflow a bulletin was written, so it expires the bulletin pages.

    The pages sit on a one-day window, and the bulletin is read at 3 AM, so the
    day a new month lands its pages would otherwise show the old month until the
    next morning, the day most people check it. The workflow's next step reads
    `bulletin_changed` and POSTs /api/revalidate-bulletin.
    """
    out = os.environ.get("GITHUB_OUTPUT")
    if out:
        with open(out, "a", encoding="utf-8") as f:
            f.write("bulletin_changed=true\n")


def direct_months(index_html: str) -> list[tuple[str, str]]:
    """[(YYYY-MM, absolute url)] for every bulletin the index links, newest first."""
    out: dict[str, str] = {}
    for m in DIRECT_LINK.finditer(index_html):
        month = MONTHS.get(m.group(2))
        if not month:
            continue
        out[f"{m.group(3)}-{month:02d}"] = DIRECT_ORIGIN + m.group(0)
    return sorted(out.items(), reverse=True)


def ingest_direct(limit: int, dry_run: bool = False) -> int:
    """Store any bulletin State's own index links that we don't already hold
    at primary-source rank. Newest first, at most `limit` months a run.

    A refusal is not a crash: it prints a warning and exits 0, because the
    `visa-bulletin` freshness budget is the alarm that matters (it goes red
    when a month is missed, whatever the reason), and a red run for a host that
    changed its mind would be a page nobody can act on at 3 AM.
    """
    try:
        index = fetch(DIRECT_INDEX)
    except Exception as exc:  # noqa: BLE001
        log(f"::warning::adoption.state.gov index unreadable ({exc}); "
            "save the page from a browser and run --from-file")
        return 0
    if "Attention Required" in index or "Just a moment" in index:
        log("::warning::adoption.state.gov answered with a challenge page; "
            "save the page from a browser and run --from-file")
        return 0
    linked = direct_months(index)
    if not linked:
        log("::warning::no bulletin links found on State's index; the page changed shape")
        return 0
    log(f"State's index links {len(linked)} bulletins; newest {linked[0][0]}")

    db = Turso()
    held = {str(m)[:7]: src or "" for m, src in query_rows(
        db, "SELECT bulletin_month, source_url FROM visa_bulletins")}
    todo = [(m, u) for m, u in linked if rank_of(held.get(m, "")) < 3][:limit]
    if not todo:
        log("nothing new: every linked month is already held from a primary source")
        return 0
    stored = 0
    for m, url in todo:
        log(f"  {m}  {url}")
        page = fetch(url)
        if month_from_page(page) not in (None, m):
            log(f"::warning::{url} reads as {month_from_page(page)}, not {m}; skipped")
            continue
        parsed = validated(page, m)
        if dry_run:
            log("    dry run: parsed, not written")
            continue
        write_month(db, m, parsed, DIRECT_SOURCE)
        stored += 1
        time.sleep(1)
    if stored:
        stamp_bulletin_freshness(db, DIRECT_SOURCE)
        note_stored()
    return 0


# Which source wins when two hold the same month; a better source is never
# overwritten by a worse one. The saved, direct and archived pages are all the
# State Department's own document; a mirror is a third party's summary with
# half the categories.
#
# Order matters: the mirror clause must come before the travel.state.gov one,
# because a mirror records itself as "<third party> (mirror; original:
# travel.state.gov)", and a plain substring test would rank it as the page.
SOURCE_RANK = [
    (lambda u: "saved from a browser" in u, 3),   # primary, a person fetched it
    (lambda u: u.startswith("adoption.state.gov"), 3),  # primary, State's own host
    (lambda u: "mirror" in u.lower(), 1),
    (lambda u: "travel.state.gov" in u, 2),       # the real page, via the archive
    (lambda u: True, 1),
]


def rank_of(source_url: str) -> int:
    for pred, rank in SOURCE_RANK:
        if pred(source_url or ""):
            return rank
    return 0


def backfill_from_archive(years: list[int], limit: int, dry_run: bool = False) -> int:
    """Re-parse every bulletin the archive can still serve, straight to the database.

    The URL folder is the FISCAL year, so the November 2025 bulletin lives under
    /2026/; this walks every folder rather than assuming two calendar years
    cover two years of bulletins.

    `dry_run` fetches and parses exactly as a real run does and writes
    NOTHING: no row, no freshness stamp, not even the family-column ALTER. It
    reads the held rows so its ADDED/RE-PARSED lines mean what a real run's
    would.
    """
    db = Turso()
    if not dry_run:
        ensure_family_columns(db)
    have = {}
    for month, src, final_action, family in query_rows(
            db, "SELECT bulletin_month, source_url, final_action, family_final_action "
                "FROM visa_bulletins"):
        try:
            cats = len(json.loads(final_action)) if final_action is not None else 0
        except Exception:  # noqa: BLE001
            cats = 0
        have[month] = (src or "", cats, family is not None)
    log(f"holding {len(have)} months before this run")

    snaps = discover_snapshots(limit, years)
    added = upgraded = skipped = failed = 0
    for month, ts, url in snaps:
        current = have.get(month)
        # Re-parse a row that is from a good source but incomplete (fewer
        # categories than its era should carry, or no family charts). This is what
        # makes a parser improvement self-healing: a rank-only skip would leave the
        # short months looking fine forever.
        if current is not None and rank_of(current[0]) >= 2 and current[1] >= expected_categories(month) and current[2]:
            skipped += 1
            continue
        try:
            parsed = parse_bulletin(fetch(f"https://web.archive.org/web/{ts}/{url}"), month)
        except Exception as exc:  # noqa: BLE001 - one bad month must not end the run
            log(f"  {month}: {exc}")
            failed += 1
            continue
        if not parsed:
            log(f"  {month}: no employment-based charts in that capture")
            failed += 1
            continue
        cats = len(parsed["finalAction"])
        if dry_run:
            fa, dff = parsed["finalAction"], parsed["datesForFiling"]
            log(f"  {month}: WOULD {'ADD' if current is None else 'RE-PARSE'} "
                f"final action {len(fa)}/{expected_categories(month)} categories, "
                f"filing {len(dff)}, family {'yes' if 'familyFinalAction' in parsed else 'no'}; "
                f"EB2 India {fa.get('EB2', {}).get('india', '-')}, "
                f"EB3 rest of world {fa.get('EB3', {}).get('worldwide', '-')}, "
                f"EB5 China {fa.get('EB5', {}).get('china', '-')}")
            added += current is None
            upgraded += current is not None
            time.sleep(1)
            continue
        db.execute(
            "INSERT OR REPLACE INTO visa_bulletins (bulletin_month, source_url, "
            "archived_at, final_action, dates_for_filing, computed_at, "
            "family_final_action, family_dates_for_filing) "
            "VALUES (?,?,?,?,?,?,?,?)",
            [month, url, ts, json.dumps(parsed["finalAction"]),
             json.dumps(parsed["datesForFiling"]), int(time.time() * 1000),
             family_json(parsed, "familyFinalAction"), family_json(parsed, "familyDatesForFiling")],
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
    if dry_run:
        log("dry run: nothing written")
        return 1 if failed else 0

    stamp_bulletin_freshness(db, "State Dept via Internet Archive; current month from a saved page")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--out", help="Payload path (required for the archive route)")
    ap.add_argument("--months", type=int, default=18)
    ap.add_argument("--years", type=int, nargs="*", help="Calendar years to search")
    ap.add_argument(
        "--from-file",
        help="A bulletin page saved from a browser. Stores that one month "
             "straight to the database as a primary-source row.",
    )
    ap.add_argument("--month", help="YYYY-MM, when the page cannot be read for it")
    ap.add_argument(
        "--direct", action="store_true",
        help="Read State's own index on adoption.state.gov and store any bulletin "
             "not yet held from a primary source (at most --months a run).",
    )
    ap.add_argument(
        "--dry-run", action="store_true",
        help="With --backfill-turso: fetch and parse, write nothing.",
    )
    ap.add_argument(
        "--backfill-turso", action="store_true",
        help="Re-parse every bulletin the archive still serves, writing "
             "straight to the database and never overwriting a better source.",
    )
    args = ap.parse_args()

    # The primary route writes to the database directly and needs no payload,
    # so it short-circuits before any archive lookup.
    if args.from_file:
        return ingest_saved_page(args.from_file, args.month)
    if args.direct:
        # Two a run is plenty for a monthly page; the backlog, if any, clears
        # over the following days rather than in one burst.
        return ingest_direct(2, args.dry_run)
    if args.backfill_turso:
        # The folder is the FISCAL year, so cover a wide span by default
        # rather than the two the archive route assumes.
        this_year = datetime.date.today().year
        return backfill_from_archive(
            args.years or list(range(this_year - 4, this_year + 1)), args.months, args.dry_run)
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
            parsed = parse_bulletin(page, month)
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

        # State the lag rather than leaving it to be noticed: the archive stopped
        # capturing new bulletins, so a lag here is the expected steady state, not
        # a failed run.
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

    # Stamp this ingest's own freshness row, so the health check judges the
    # data this run actually wrote.
    stamp_bulletin_freshness(Turso(), "State Dept via Internet Archive")

    return 0


if __name__ == "__main__":
    sys.exit(main())
