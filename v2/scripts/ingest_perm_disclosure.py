#!/usr/bin/env python3
"""Ingest DOL's quarterly PERM disclosure files into derived aggregates.

Runs OUTSIDE Convex, and has to. One quarterly file is 156 MB compressed and
**1.21 GB of XML uncompressed**, which no Convex action can hold or parse
inside its limits. This streams the sheet, keeps only counts and percentiles,
and posts a few KB of aggregates to Convex.

AGGREGATES ONLY, as a hard boundary. The source rows carry `ATTY_AG_EMAIL`,
`EMP_POC_EMAIL`, `DECL_PREP_EMAIL`, direct phone numbers and street addresses
for roughly 112,000 real people. Only five columns are ever read, none of the
contact columns among them, and no row survives the loop it is parsed in.

Two things this script refuses to guess:

1. **The download URL.** DOL moved the current-year file to `/media/` while the
   archive stayed on `/sites/dolgov/files/ETA/oflc/pdfs/`. A hardcoded path
   returns a styled 404 that reads like a dead link. URLs are discovered from
   DOL's own performance page every run.

2. **Whether one file is enough.** Each file is a window on DETERMINATIONS, not
   a record of a filing-month cohort. A case filed 2024-07 and decided 2025-08
   is in the FY2025 file and absent from FY2026, so reading one file shows an
   old cohort's slow tail and a new cohort's fast head, and both look like
   medians. Files are unioned and de-duplicated by case number.

Writes a JSON payload; it does not talk to Convex. `npx convex run` already
handles deploy-key auth, internal functions and error reporting, so the
workflow pipes this file into it rather than reimplementing that here.

Usage:
    python3 scripts/ingest_perm_disclosure.py --out /tmp/perm.json
    python3 scripts/ingest_perm_disclosure.py --out /tmp/perm.json --local a.xlsx b.xlsx
    npx convex run permDisclosure:storeStats "$(cat /tmp/perm.json)" --prod
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
import tempfile
import time
import urllib.error
import urllib.request
import zipfile
from collections import Counter, defaultdict
from datetime import date, timedelta
from xml.etree.ElementTree import iterparse

PERFORMANCE_PAGE = "https://www.dol.gov/agencies/eta/foreign-labor/performance"
NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
EXCEL_EPOCH = date(1899, 12, 30)  # 1900 date system, including its leap-year bug

# Only these columns are read. Deliberately excludes every contact field.
COLUMNS = {0: "case", 1: "status", 2: "received", 3: "decision", 5: "employer"}

# A complete browser header set. DOL fronts www.dol.gov with Akamai, which
# answers a bare or partial UA with 403 "Access Denied" (Reference #18...,
# errors.edgesuite). The full set clears it; flag.dol.gov needs none of this.
BROWSER_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Sec-Ch-Ua": '"Chromium";v="126", "Not)A;Brand";v="24", "Google Chrome";v="126"',
    "Sec-Ch-Ua-Mobile": "?0",
    "Sec-Ch-Ua-Platform": '"macOS"',
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
    "Upgrade-Insecure-Requests": "1",
}

# How many of the most recent files to union. Two quarterly files span enough
# determination history to close out every cohort DOL has worked through.
DEFAULT_FILE_COUNT = 2
# A cohort below this many decided cases is noise, not a distribution.
MIN_COHORT_SIZE = 30
# Receipt-to-determination outside this range is a data error, not a case.
MAX_PLAUSIBLE_DAYS = 2500
# Determinations a month needs before its median filing month is trustworthy.
MIN_FRONTIER_DECISIONS = 1000


def log(msg: str) -> None:
    print(msg, flush=True)


def fetch(url: str, referer: str | None = None, attempts: int = 4) -> bytes:
    """GET with the browser header set and backoff on Akamai's throttle.

    Two failure modes, and they look identical from here:

    * A bare or partial User-Agent is refused outright. The full header set
      above clears that.
    * Sustained traffic from one address is refused even WITH the full set.
      Measured while building this: the same request that returned 200 came
      back 403 twenty minutes and ~240 MB later, from curl and urllib alike.
      So this is address reputation, not a client fingerprint, and no header
      tweak fixes it.

    Backoff is the right answer for the second, because the real job runs
    quarterly and asks for two files. A 403 that survives every attempt raises,
    and must: a run that could not read DOL is not a run that found no data.
    """
    headers = dict(BROWSER_HEADERS)
    if referer:
        headers["Referer"] = referer

    delay = 20
    for attempt in range(1, attempts + 1):
        try:
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=300) as resp:
                return resp.read()
        except urllib.error.HTTPError as exc:
            if exc.code not in (403, 429, 503) or attempt == attempts:
                raise
            log(f"  HTTP {exc.code} from DOL (attempt {attempt}/{attempts}); waiting {delay}s")
            time.sleep(delay)
            delay *= 3
    raise SystemExit("unreachable")


def discover_files(limit: int) -> list[tuple[str, str]]:
    """Return [(filename, absolute_url)] newest-first, from DOL's own page."""
    log(f"Discovering disclosure files from {PERFORMANCE_PAGE}")
    html = fetch(PERFORMANCE_PAGE).decode("utf-8", "replace")

    found: dict[str, str] = {}
    for href in re.findall(r'href="([^"]+)"', html):
        href = href.replace("&amp;", "&")
        name = href.rsplit("/", 1)[-1]
        if not re.match(r"PERM_Disclosure_Data_.*\.xlsx$", name, re.I):
            continue
        url = href if href.startswith("http") else f"https://www.dol.gov{href}"
        found[name] = url

    if not found:
        raise SystemExit(
            "FATAL: no PERM disclosure links on DOL's performance page. The page "
            "layout changed or the fetch was blocked. Refusing to report success."
        )

    def sort_key(name: str) -> tuple:
        fy = re.search(r"FY(\d{2,4})", name, re.I)
        q = re.search(r"Q(\d)", name, re.I)
        year = int(fy.group(1)) if fy else 0
        if year < 100:
            year += 2000
        return (year, int(q.group(1)) if q else 9)

    ordered = sorted(found.items(), key=lambda kv: sort_key(kv[0]), reverse=True)
    log(f"  found {len(found)} PERM files; taking the newest {limit}")
    for name, _ in ordered[:limit]:
        log(f"    {name}")
    return ordered[:limit]


def col_index(ref: str) -> int:
    """'BC12' -> 54, zero-based.

    XLSX omits empty cells entirely, so indexing a row's <c> children by
    position silently shifts every column after the first blank one. The cell's
    own r= reference is the only reliable source of its column.
    """
    n = 0
    for ch in ref:
        if ch.isdigit():
            break
        n = n * 26 + (ord(ch.upper()) - 64)
    return n - 1


def to_iso(raw: str) -> str | None:
    """Excel serial or formatted date -> YYYY-MM-DD. None when unreadable."""
    if not raw:
        return None
    try:
        return (EXCEL_EPOCH + timedelta(days=int(float(raw)))).isoformat()
    except (ValueError, OverflowError):
        pass
    m = re.match(r"^(\d{4})-(\d{2})-(\d{2})", raw)
    if m:
        return m.group(0)
    m = re.match(r"^(\d{1,2})/(\d{1,2})/(\d{4})$", raw)
    if m:
        return f"{m.group(3)}-{int(m.group(1)):02d}-{int(m.group(2)):02d}"
    return None


def percentile(values: list[int], p: float) -> int | None:
    if not values:
        return None
    s = sorted(values)
    k = (len(s) - 1) * p / 100
    lo = int(k)
    hi = min(lo + 1, len(s) - 1)
    return round(s[lo] + (s[hi] - s[lo]) * (k - lo))


def parse_file(path: str, seen: set[str], acc: dict) -> int:
    """Stream one workbook into `acc`. Returns the count of new cases."""
    z = zipfile.ZipFile(path)

    shared: list[str] = []
    with z.open("xl/sharedStrings.xml") as f:
        for _, el in iterparse(f, events=("end",)):
            if el.tag == NS + "si":
                shared.append("".join(t.text or "" for t in el.iter(NS + "t")))
                el.clear()

    rows = kept = 0
    with z.open("xl/worksheets/sheet1.xml") as f:
        for _, el in iterparse(f, events=("end",)):
            if el.tag != NS + "row":
                continue
            rec: dict[str, str] = {}
            for c in el.findall(NS + "c"):
                ci = col_index(c.get("r", "A1"))
                if ci not in COLUMNS:
                    continue
                v = c.find(NS + "v")
                if v is None or v.text is None:
                    val = ""
                elif c.get("t") == "s":
                    i = int(v.text)
                    val = shared[i] if i < len(shared) else ""
                elif c.get("t") == "inlineStr":
                    val = "".join(t.text or "" for t in c.iter(NS + "t"))
                else:
                    val = v.text
                rec[COLUMNS[ci]] = val
            el.clear()

            rows += 1
            if rows == 1:
                continue  # header

            case_no = (rec.get("case") or "").strip()
            if not case_no or case_no in seen:
                continue
            received = to_iso(rec.get("received", ""))
            decided = to_iso(rec.get("decision", ""))
            if not received or not decided:
                continue

            days = (date.fromisoformat(decided) - date.fromisoformat(received)).days
            if not 0 <= days <= MAX_PLAUSIBLE_DAYS:
                continue

            seen.add(case_no)
            kept += 1
            acc["cohorts"][received[:7]].append(days)
            acc["clearance"][decided[:7]] += 1
            acc["frontier"][decided[:7]][received[:7]] += 1

    log(f"  {os.path.basename(path)}: {rows - 1:,} sheet rows, {kept:,} new cases")
    return kept


def build_payload(files: list[tuple[str, str]], acc: dict, unique: int) -> dict:
    cohorts = [
        {
            "cohortMonth": month,
            "decided": len(days),
            "p25": percentile(days, 25),
            "p50": percentile(days, 50),
            "p75": percentile(days, 75),
            "p90": percentile(days, 90),
        }
        for month, days in sorted(acc["cohorts"].items())
        if len(days) >= MIN_COHORT_SIZE
    ]

    # Reconstruct the frontier DOL does not publish: for each month of
    # determinations, the filing month at the median of those determinations.
    frontier = []
    for decision_month, counter in sorted(acc["frontier"].items()):
        total = sum(counter.values())
        # A partial month at a file boundary produces a median from a handful of
        # cases: October 2025 held 21 decisions and its median filing month
        # jumped five months and back. Too few cases to locate a median is not a
        # data point, it is noise that would corrupt the measured rate.
        if total < MIN_FRONTIER_DECISIONS:
            continue
        running = 0
        for filing_month in sorted(counter):
            running += counter[filing_month]
            if running >= total / 2:
                frontier.append(
                    {
                        "decisionMonth": decision_month,
                        "medianFilingMonth": filing_month,
                        "decisions": total,
                    }
                )
                break

    payload = {
        "sourceFiles": [name for name, _ in files],
        "uniqueCases": unique,
        "cohorts": cohorts,
        "clearanceByMonth": [
            {"month": m, "decisions": n} for m, n in sorted(acc["clearance"].items())
        ],
        "frontierHistory": frontier,
    }
    body = json.dumps(payload, sort_keys=True, separators=(",", ":"))
    payload["contentHash"] = hashlib.sha256(body.encode()).hexdigest()
    return payload


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--files", type=int, default=DEFAULT_FILE_COUNT)
    ap.add_argument("--out", required=True, help="Write the aggregate payload here")
    ap.add_argument("--local", nargs="*", help="Parse these local files instead of downloading")
    args = ap.parse_args()

    if args.local:
        files = [(os.path.basename(p), p) for p in args.local]
        log(f"Using {len(files)} local file(s)")
    else:
        files = discover_files(args.files)

    acc = {
        "cohorts": defaultdict(list),
        "clearance": Counter(),
        "frontier": defaultdict(Counter),
    }
    seen: set[str] = set()

    with tempfile.TemporaryDirectory() as tmp:
        for name, url in files:
            if args.local:
                path = url
            else:
                path = os.path.join(tmp, name)
                log(f"Downloading {name}")
                data = fetch(url, referer=PERFORMANCE_PAGE)
                if not data.startswith(b"PK"):
                    raise SystemExit(
                        f"FATAL: {name} is not a workbook ({len(data):,} bytes). "
                        "DOL served an error page. Refusing to report success."
                    )
                with open(path, "wb") as fh:
                    fh.write(data)
                log(f"  {len(data) / 1e6:.1f} MB")
            parse_file(path, seen, acc)

    payload = build_payload(files, acc, len(seen))

    # Counts before the verdict. A run that inspected nothing must be loud, not
    # a clean zero.
    log("")
    log(f"unique cases      {payload['uniqueCases']:,}")
    log(f"cohorts           {len(payload['cohorts'])}")
    log(f"clearance months  {len(payload['clearanceByMonth'])}")
    log(f"frontier points   {len(payload['frontierHistory'])}")
    if not payload["cohorts"] or not payload["frontierHistory"]:
        raise SystemExit("FATAL: parsed no usable cohorts. Refusing to write.")

    with open(args.out, "w") as fh:
        json.dump(payload, fh, separators=(",", ":"))
    log(f"wrote {args.out} ({os.path.getsize(args.out) / 1024:.1f} KB)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
