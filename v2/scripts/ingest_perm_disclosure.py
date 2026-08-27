#!/usr/bin/env python3
"""Ingest DOL's quarterly PERM disclosure files into derived aggregates.

Runs OUTSIDE Convex, and has to. One quarterly file is 156 MB compressed and
**1.21 GB of XML uncompressed**, which no Convex action can hold or parse
inside its limits. This streams the sheet, keeps only counts and percentiles,
and posts a few KB of aggregates to Convex.

NO CONTACT DATA, EVER. The source rows carry `ATTY_AG_EMAIL`, `EMP_POC_EMAIL`,
`DECL_PREP_EMAIL`, direct phone numbers and street addresses for roughly
112,000 real people. Not one of those columns is in COLUMN_CANDIDATES, so
nothing here can read them and nothing downstream can print them.

That boundary is about CONTACT DETAILS, not about aggregation, and the two
used to be conflated here. `--out` still emits aggregates only. `--cases-out`
additionally writes one line per decided case - case number, dates, employer,
job, wage, law firm - which is the same public record DOL publishes and the
same facts the aggregate pages already sum, just not yet summed. It exists
because the rival product ships a case-level browser off this identical file
and the only thing separating us from it was where the rows were dropped.

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

    # ...plus the case-level artifact, which store_cases.py then chunks in.
    python3 scripts/ingest_perm_disclosure.py --out /tmp/perm.json \
        --cases-out /tmp/perm-cases.ndjson.gz
    python3 scripts/store_cases.py --cases /tmp/perm-cases.ndjson.gz \
        --payload /tmp/perm.json

    # What column names does this quarter's file actually use?
    python3 scripts/ingest_perm_disclosure.py --dump-header --local a.xlsx
"""
from __future__ import annotations

import argparse
import gzip
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

# Columns are resolved BY HEADER NAME per file — indexes drift between fiscal
# years, and a silent shift would swap one state's numbers for another's.
# Candidates are tried in order. Deliberately excludes every contact field.
COLUMN_CANDIDATES: dict[str, list[str]] = {
    "case": ["CASE_NUMBER", "CASE_NO"],
    "status": ["CASE_STATUS", "STATUS"],
    "received": ["RECEIVED_DATE", "CASE_RECEIVED_DATE"],
    "decision": ["DECISION_DATE"],
    "employer": ["EMPLOYER_NAME", "EMP_BUSINESS_NAME"],
    # The new analytical dimensions. Aggregate-only in the payload.
    # Names verified against PERM_Record_Layout_FY2026_Q3.pdf (the new 9089
    # form, in effect since June 2023); legacy names kept as fallbacks.
    "state": ["PRIMARY_WORKSITE_STATE", "WORKSITE_STATE", "JOB_INFO_WORK_STATE", "EMPLOYER_STATE"],
    "soc_code": ["PWD_SOC_CODE", "PW_SOC_CODE", "SOC_CODE"],
    "soc_title": ["PWD_SOC_TITLE", "PW_SOC_TITLE", "SOC_TITLE"],
    # The employer's own wording for the role, which is what someone searches
    # for when the SOC title is too coarse to recognise.
    #
    # UNVERIFIED against the record layout: www.dol.gov was refusing this
    # address while these were written (403 from the full browser header set,
    # which is the documented address-reputation refusal, not a missing
    # header). Safe anyway, and deliberately so: `job_title` is NOT in
    # REQUIRED_FIELDS, so an unresolved name degrades to an empty column and
    # says so in the log rather than failing. And every candidate contains the
    # literal token JOB_TITLE, so a match cannot silently be some other
    # concept. Verify with the header dump in `--dump-header` before trusting
    # the column is really absent.
    "job_title": [
        "JOB_OPP_JOB_TITLE", "PWD_JOB_TITLE", "JOB_TITLE",
        "JOB_INFO_JOB_TITLE", "PW_JOB_TITLE_9089",
    ],
    "wage": [
        "JOB_OPP_WAGE_FROM",
        "WAGE_OFFER_FROM_9089", "WAGE_OFFERED_FROM_9089", "WAGE_OFFER_FROM",
        "PW_AMOUNT_9089", "PW_WAGE", "PW_AMOUNT",
    ],
    "wage_unit": [
        "JOB_OPP_WAGE_PER",
        "WAGE_OFFER_UNIT_OF_PAY_9089", "WAGE_UNIT_OF_PAY_9089",
        "WAGE_OFFER_UNIT_OF_PAY", "PW_UNIT_OF_PAY_9089", "PW_UNIT_OF_PAY",
    ],
    # The law firm on the filing. This is the column that speaks to the
    # attorney half of the audience, and no competitor surfaces it for them.
    # Names read off PERM_Record_Layout_FY2026_Q3.pdf, not guessed: every one
    # of my first guesses here was wrong, and a wrong column name degrades
    # silently to "no data" rather than erroring.
    "attorney": ["ATTY_AG_LAW_FIRM_NAME", "LAWFIRM_NAME_BUSINESS", "AGENT_ATTORNEY_FIRM_NAME"],
    "attorney_state": ["ATTY_AG_STATE", "AGENT_ATTORNEY_STATE"],
    # Risk factors DOL records on the form itself (Form 9089, Sections A & G).
    "layoff": ["OTHER_REQ_EMP_LAYOFF", "EMP_LAYOFF_IN_PAST_SIX_MONTHS"],
    "ownership": ["EMP_WORKER_INTEREST", "FW_OWNERSHIP_INTEREST"],
    "fulltime": ["OTHER_REQ_IS_FULLTIME_EMP", "JOB_OPP_FULL_TIME"],
}
# case/status/received/decision must resolve or the file is unusable; the
# analytical dimensions degrade gracefully (their aggregates just go absent).
REQUIRED_FIELDS = ("case", "status", "received", "decision")

US_STATES = {
    "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
    "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
    "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
    "VA","WA","WV","WI","WY","DC","PR","GU","VI","MP",
}

# Full names map to codes; anything else is dropped, never prefix-guessed.
STATE_NAMES = {
    "ALABAMA": "AL", "ALASKA": "AK", "ARIZONA": "AZ", "ARKANSAS": "AR",
    "CALIFORNIA": "CA", "COLORADO": "CO", "CONNECTICUT": "CT", "DELAWARE": "DE",
    "FLORIDA": "FL", "GEORGIA": "GA", "HAWAII": "HI", "IDAHO": "ID",
    "ILLINOIS": "IL", "INDIANA": "IN", "IOWA": "IA", "KANSAS": "KS",
    "KENTUCKY": "KY", "LOUISIANA": "LA", "MAINE": "ME", "MARYLAND": "MD",
    "MASSACHUSETTS": "MA", "MICHIGAN": "MI", "MINNESOTA": "MN",
    "MISSISSIPPI": "MS", "MISSOURI": "MO", "MONTANA": "MT", "NEBRASKA": "NE",
    "NEVADA": "NV", "NEW HAMPSHIRE": "NH", "NEW JERSEY": "NJ",
    "NEW MEXICO": "NM", "NEW YORK": "NY", "NORTH CAROLINA": "NC",
    "NORTH DAKOTA": "ND", "OHIO": "OH", "OKLAHOMA": "OK", "OREGON": "OR",
    "PENNSYLVANIA": "PA", "RHODE ISLAND": "RI", "SOUTH CAROLINA": "SC",
    "SOUTH DAKOTA": "SD", "TENNESSEE": "TN", "TEXAS": "TX", "UTAH": "UT",
    "VERMONT": "VT", "VIRGINIA": "VA", "WASHINGTON": "WA",
    "WEST VIRGINIA": "WV", "WISCONSIN": "WI", "WYOMING": "WY",
    "DISTRICT OF COLUMBIA": "DC", "PUERTO RICO": "PR", "GUAM": "GU",
    "VIRGIN ISLANDS": "VI", "U.S. VIRGIN ISLANDS": "VI",
    "NORTHERN MARIANA ISLANDS": "MP",
}

ANNUALIZE = {
    "YEAR": 1.0, "YR": 1.0, "ANNUAL": 1.0, "ANNUALLY": 1.0,
    "HOUR": 2080.0, "HR": 2080.0, "HOURLY": 2080.0,
    "WEEK": 52.0, "WK": 52.0, "WEEKLY": 52.0,
    "MONTH": 12.0, "MTH": 12.0, "MONTHLY": 12.0,
    "BI-WEEKLY": 26.0, "BIWEEKLY": 26.0, "BI WEEKLY": 26.0,
}


# The plausibility band. A value outside it is a typo or a unit mismatch, not a
# salary, and the policy is to EXCLUDE it rather than clamp or keep it.
#
# Excluding is the pre-existing behaviour and is left unchanged on purpose: it
# already decides every published wage figure on the site, and quietly moving
# that line would move numbers nobody asked to move. What IS new is that the
# exclusions are now COUNTED and reported, because silently dropping outliers
# and silently keeping them look identical from the outside. The competitor
# ships the other policy and prints the consequence: a P5 of $24,960 next to a
# P95 of $197,829 for one occupation, which is a $12/hr wage read as annual.
WAGE_MIN = 15_000
WAGE_MAX = 1_000_000
WAGE_POLICY = "exclude-out-of-band"


def annual_wage_detail(raw: str, unit: str) -> tuple[int | None, str]:
    """Annualized offered wage, plus why it was refused when it was.

    The reason is what makes the policy auditable. `annual_wage` keeps its
    original signature and simply drops the reason, so every existing caller
    is unaffected.
    """
    try:
        amount = float(raw.replace("$", "").replace(",", "").strip())
    except (ValueError, AttributeError):
        return None, "unparseable"
    factor = ANNUALIZE.get(unit.strip().upper())
    if factor is None:
        return None, "unknown-unit"
    annual = amount * factor
    if annual < WAGE_MIN:
        return None, "below-band"
    if annual > WAGE_MAX:
        return None, "above-band"
    return round(annual), "ok"


def annual_wage(raw: str, unit: str) -> int | None:
    """Annualized offered wage, or None when it cannot be trusted."""
    return annual_wage_detail(raw, unit)[0]


# ONE set of bin edges for every histogram this script emits, so two
# distributions can be laid over each other and a chart axis is stable across
# occupations, states and years. Each number is a bin's LOWER bound; the last
# bin is open-ended. Bin 0 starts at WAGE_MIN in practice, because anything
# under it was excluded before it got here.
WAGE_BIN_EDGES = [
    0, 40_000, 60_000, 80_000, 100_000, 120_000, 140_000,
    160_000, 180_000, 200_000, 250_000, 300_000, 400_000, 500_000,
]

# How many certified wages a cell needs before its percentiles are published.
#
# 50 puts p10 and p90 on the 5th and 45th order statistics, which is thin but
# real. Below that a "10th percentile" is one or two people's salaries wearing
# a statistic's name. Pairs get a higher floor because that is the partition
# where the cell count lives: for ANY single partition the number of cells
# clearing a floor F is at most N/F, so 100 caps occupation-by-state at
# 259,489/100 = 2,594 cells however the data is shaped.
WAGE_STAT_FLOOR = 50
WAGE_PAIR_FLOOR = 100

WAGE_BANDS = [
    (60_000, "Under $60K"),
    (80_000, "$60K-$80K"),
    (100_000, "$80K-$100K"),
    (130_000, "$100K-$130K"),
    (float("inf"), "Over $130K"),
]


def wage_band(wage: int) -> str:
    """The band an annualized wage falls in. Same cut points as the field uses."""
    for ceiling, label in WAGE_BANDS:
        if wage < ceiling:
            return label
    return WAGE_BANDS[-1][1]


def fiscal_year(iso: str) -> str:
    """Federal fiscal year of a decision date: FY starts October 1."""
    y, m = int(iso[:4]), int(iso[5:7])
    return str(y + 1 if m >= 10 else y)


def yes(raw: str | None) -> bool:
    """DOL writes Y/N (and occasionally Yes/No) for its boolean fields."""
    return (raw or "").strip().upper()[:1] == "Y"


def no(raw: str | None) -> bool:
    """Explicit N only. A BLANK is unknown, and unknown is not 'part time'."""
    return (raw or "").strip().upper()[:1] == "N"


# Legal suffixes and connectives. DOL prints whatever the filer typed, so one
# firm arrives as six spellings that differ only in punctuation, case and
# these words.
#
# THE RULES MOVED. `entity_key` used to live here with a private noise list,
# and it shredded punctuation to spaces BEFORE removing that list, so `P.C.`
# arrived as `p` + `c` and the list - which contains "pc" - never saw it.
# 604 pairs of firms were two firms with two pages and two ranks because of
# it. Identity now lives in `scripts/entity_identity.py` alongside the typo
# pass, with `src/lib/entitySlug.ts` mirroring it and one fixture file
# asserting both. Re-exported here so `store_cases.py`, which imports
# `entity_key` from this module to join a case to its entity slug, keeps
# reading exactly the key the entity table was built with.
from entity_identity import ENTITY_NOISE as _ENTITY_NOISE  # noqa: E402
from entity_identity import entity_key, typo_aliases  # noqa: E402

__all_identity__ = (entity_key, typo_aliases, _ENTITY_NOISE)


def merge_entities(bucket: dict, name_of, kind: str | None = None) -> list[dict]:
    """Pool rows that are one entity, keeping the busiest spelling's name.

    Medians are recomputed from the POOLED day and wage lists. Averaging the
    per-spelling medians would be a median of medians, which is not the
    median of the combined population and can sit outside it entirely.

    `kind` enables the second identity pass, which folds a single mistyped
    token into the spelling it was mistyped from. It is off without one, and
    `typo_aliases` itself refuses every kind but "attorney" - see
    `scripts/entity_identity.py` for the measurement behind that.
    """
    alias: dict[str, str] = {}
    if kind:
        totals: dict[str, int] = {}
        for d in bucket.values():
            k = entity_key(name_of(d))
            totals[k] = totals.get(k, 0) + d["certified"] + d["denied"] + d.get("withdrawn", 0)
        alias = typo_aliases(totals, kind)

    merged: dict[str, dict] = {}
    for d in bucket.values():
        key = entity_key(name_of(d))
        key = alias.get(key, key)
        cur = merged.get(key)
        if cur is None:
            merged[key] = {
                "certified": d["certified"],
                "denied": d["denied"],
                "withdrawn": d.get("withdrawn", 0),
                "days": list(d["days"]),
                "wages": list(d.get("wages", [])),
                "name": d.get("name", ""),
                "title": d.get("title", ""),
                "state": d.get("state", ""),
                "_top": d["certified"] + d["denied"] + d.get("withdrawn", 0),
            }
            continue
        n = d["certified"] + d["denied"] + d.get("withdrawn", 0)
        cur["certified"] += d["certified"]
        cur["denied"] += d["denied"]
        cur["withdrawn"] += d.get("withdrawn", 0)
        cur["days"].extend(d["days"])
        cur["wages"].extend(d.get("wages", []))
        # The busiest spelling is the one people recognise, so it wins the
        # display name and carries the state with it.
        if n > cur["_top"]:
            cur["_top"] = n
            cur["name"] = d.get("name", "") or cur["name"]
            cur["title"] = d.get("title", "") or cur["title"]
            cur["state"] = d.get("state", "") or cur["state"]
        elif not cur["state"]:
            cur["state"] = d.get("state", "")
    return list(merged.values())


def norm_status(raw: str) -> str | None:
    s = raw.strip().upper()
    if s.startswith("CERTIFIED"):
        return "certified"  # Certified and Certified-Expired both count
    if s.startswith("DENIED"):
        return "denied"
    if s.startswith("WITHDRAWN"):
        return "withdrawn"
    return None

class CaseWriter:
    """Streams one JSON line per decided case, and counts the facets as it goes.

    STREAMS rather than accumulates. 259,000 rows held as Python dicts is a
    quarter of a gigabyte of interpreter overhead before any of it is
    serialised, on a runner that is already holding 1.2 GB of parsed XML.
    Each row is written and forgotten.

    The facet counters are the other half of the job and the reason they live
    HERE rather than being recomputed later: the browser's "12,431 cases in
    California" has to be the count of rows the browser can actually page
    through. Counted in the same pass that writes them, the two cannot
    disagree. Counted anywhere else, they eventually do.

    Slugs are deliberately absent. An employer's slug depends on the MERGED
    entity ranking, which is not known until the whole parse is finished, so
    `store_cases.py` joins them on from the aggregate payload using the same
    `entity_key` this file already uses to merge. One place decides slugs.
    """

    def __init__(self, path: str):
        self.path = path
        self._fh = gzip.open(path, "wt", encoding="utf-8", compresslevel=6)
        self.total = 0
        self.by_status: Counter = Counter()
        # state -> Counter(status), fiscal year -> Counter(status)
        self.by_state: defaultdict[str, Counter] = defaultdict(Counter)
        self.by_fy: defaultdict[str, Counter] = defaultdict(Counter)
        self.first_decision = ""
        self.last_decision = ""
        self.first_received = ""
        self.last_received = ""

    def write(self, row: dict) -> None:
        self._fh.write(json.dumps(row, separators=(",", ":")) + "\n")
        self.total += 1
        status, decided, received = row["status"], row["decisionDate"], row["receivedDate"]
        self.by_status[status] += 1
        # A row with no resolvable state still counts nationally; it just has
        # no state facet. Bucketing it under "" instead would put it in a
        # filter nobody picked.
        if row["state"]:
            self.by_state[row["state"]][status] += 1
        self.by_fy[row["fiscalYear"]][status] += 1
        # ISO dates compare correctly as strings, which is the whole reason
        # every date in this project is one.
        if not self.first_decision or decided < self.first_decision:
            self.first_decision = decided
        if decided > self.last_decision:
            self.last_decision = decided
        if not self.first_received or received < self.first_received:
            self.first_received = received
        if received > self.last_received:
            self.last_received = received

    def close(self) -> dict:
        self._fh.close()
        def rows(bucket: dict, key: str) -> list[dict]:
            out = []
            for name in sorted(bucket):
                c = bucket[name]
                out.append(
                    {
                        key: name,
                        "total": sum(c.values()),
                        "certified": c["certified"],
                        "denied": c["denied"],
                        "withdrawn": c["withdrawn"],
                    }
                )
            return out

        meta = {
            "totalCases": self.total,
            "firstDecisionDate": self.first_decision,
            "lastDecisionDate": self.last_decision,
            "firstReceivedDate": self.first_received,
            "lastReceivedDate": self.last_received,
            "byStatus": [
                {"status": st, "count": self.by_status[st]}
                for st in ("certified", "denied", "withdrawn")
                if self.by_status[st]
            ],
            "byFiscalYear": rows(self.by_fy, "fiscalYear"),
            "byState": rows(self.by_state, "state"),
        }
        body = json.dumps(meta, sort_keys=True, separators=(",", ":"))
        meta["contentHash"] = hashlib.sha256(body.encode()).hexdigest()
        return meta


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
# EVERY entity is stored. The floor that used to live here was a STORAGE
# floor, and it hid 65,026 of 82,677 employers -- 79% of them -- so searching
# for a small sponsor returned "no match" for a company that is plainly in
# DOL's files. That is a worse failure than a thin row.
#
# The judgement the old floor encoded is still right and still applied, just
# further downstream: below three decided cases an approval rate is one or two
# coin flips and a median is a single value. So those entities are stored and
# searchable, and MIN_TOTAL_FOR_PAGE (src/lib/entityPayload.ts) decides which
# of them get a page of their own and a sitemap entry. Rates below
# MIN_DECIDED_FOR_RATE are withheld on the page regardless.
ENTITY_FLOOR = 1

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


def file_fiscal_year(name: str) -> int:
    """The fiscal year a disclosure filename declares, or 0 if it declares none."""
    m = re.search(r"FY(\d{2,4})", name, re.I)
    if not m:
        return 0
    year = int(m.group(1))
    return year + 2000 if year < 100 else year


def file_sort_key(name: str) -> tuple:
    """Newest-last ordering key: (fiscal year, quarter, form generation).

    The third element is the one that matters and is not obvious. DOL replaced
    the ETA-9089 mid-FY2024 and published BOTH
    `PERM_Disclosure_Data_FY2024_Q4.xlsx` and
    `PERM_Disclosure_Data_New_Form_FY2024_Q4.xlsx`. They tie on year and
    quarter, so without this the two sort in whatever order the page happened
    to list them, and the file that wins a de-duplicated case number would
    vary run to run. New-form sorts later, so when a case appears in both, the
    record from the form DOL currently uses is the one kept.
    """
    q = re.search(r"Q(\d)", name, re.I)
    # A file with no quarter (FY2021, FY2020) covers the whole year, so it
    # sorts after that year's quarters rather than before them.
    quarter = int(q.group(1)) if q else 9
    return (file_fiscal_year(name), quarter, 1 if re.search(r"New_Form", name, re.I) else 0)


def select_files(
    found: dict[str, str],
    limit: int | None = None,
    since_fy: int | None = None,
) -> list[tuple[str, str]]:
    """Choose which discovered files to union, newest first.

    Pure, so the selection can be tested against a real filename list without
    touching DOL.

    `since_fy` is the safe control and the one to use for multi-year work: it
    takes EVERY file for every fiscal year at or above the floor, so a year
    published as two files cannot be split. `limit` is the old newest-N knob,
    kept working, and it CAN split a year - FY2024 is two files, so
    `--files 4` takes one of them and silently undercounts FY2024 by however
    many cases the other form holds. That is a plausible-looking wrong number,
    which is the worst kind, so it warns.
    """
    ordered = sorted(found.items(), key=lambda kv: file_sort_key(kv[0]), reverse=True)

    if since_fy is not None:
        picked = [(n, u) for n, u in ordered if file_fiscal_year(n) >= since_fy]
        if not picked:
            years = sorted({file_fiscal_year(n) for n in found}, reverse=True)
            raise SystemExit(
                f"FATAL: no disclosure file at or after FY{since_fy}. "
                f"The page lists {years[:8]}."
            )
        return picked

    take = len(ordered) if limit is None else limit
    picked = ordered[:take]
    dropped = ordered[take:]
    if picked and dropped:
        edge = file_fiscal_year(picked[-1][0])
        split = [n for n, _ in dropped if file_fiscal_year(n) == edge]
        if split:
            log(
                f"  WARNING: --files {take} cuts through FY{edge}. Leaving out "
                f"{split}, so FY{edge} will be undercounted. Use --since-fy "
                f"{edge} to take the whole year, or --files {take + len(split)}."
            )
    return picked


def discover_files(limit: int | None, since_fy: int | None = None) -> list[tuple[str, str]]:
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

    picked = select_files(found, limit, since_fy)
    log(f"  found {len(found)} PERM files; taking {len(picked)}")
    for name, _ in picked:
        log(f"    FY{file_fiscal_year(name)}  {name}")
    return picked


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


def histogram(values: list[int]) -> list[int]:
    """Counts per WAGE_BIN_EDGES bin. Linear scan; the lists are short."""
    counts = [0] * len(WAGE_BIN_EDGES)
    for v in values:
        # Walk down from the top so the last edge is the open-ended bin.
        for i in range(len(WAGE_BIN_EDGES) - 1, -1, -1):
            if v >= WAGE_BIN_EDGES[i]:
                counts[i] += 1
                break
    return counts


def percentile(values: list[int], p: float) -> int | None:
    """The p-th percentile by LINEAR INTERPOLATION between closest ranks.

    Stated because "close enough" percentiles disagree at small n in ways
    nobody notices until a number looks wrong. This is numpy's default
    `linear` method, and it is what every existing figure on the site already
    uses, so wage stats and processing-time percentiles are computed the same
    way: rank `k = (n-1) * p/100`, then interpolate between `floor(k)` and
    `ceil(k)`. NOT nearest-rank, which would return an actual observed value
    and disagrees with this by up to one whole gap between neighbours.

    The result is rounded to a whole unit, which for wages is a dollar. Python
    rounds halves to even, so `percentile([1,2,3,4], 50)` is 2, not 3 - it is
    2.5 before rounding. Wage values are far apart enough that this never
    decides anything, but a test asserting a hand-computed value has to know.
    """
    if not values:
        return None
    s = sorted(values)
    k = (len(s) - 1) * p / 100
    lo = int(k)
    hi = min(lo + 1, len(s) - 1)
    return round(s[lo] + (s[hi] - s[lo]) * (k - lo))


def parse_file(
    path: str,
    seen: set[str],
    acc: dict,
    cases: "CaseWriter | None" = None,
    dump_header: bool = False,
) -> int:
    """Stream one workbook into `acc`. Returns the count of new cases.

    When `cases` is given, every row that carries a usable outcome is also
    written to it, one JSON line each. That is a superset of the work either
    way, so the case artifact costs one extra `json.dumps` per row and no
    second pass over 1.2 GB of XML.
    """
    z = zipfile.ZipFile(path)

    shared: list[str] = []
    with z.open("xl/sharedStrings.xml") as f:
        for _, el in iterparse(f, events=("end",)):
            if el.tag == NS + "si":
                shared.append("".join(t.text or "" for t in el.iter(NS + "t")))
                el.clear()

    rows = kept = 0
    colmap: dict[int, str] = {}
    with z.open("xl/worksheets/sheet1.xml") as f:
        for _, el in iterparse(f, events=("end",)):
            if el.tag != NS + "row":
                continue
            cells: dict[int, str] = {}
            for c in el.findall(NS + "c"):
                ci = col_index(c.get("r", "A1"))
                if rows > 0 and ci not in colmap:
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
                cells[ci] = val
            el.clear()

            rows += 1
            if rows == 1:
                # Resolve every field from the header names, first candidate
                # that exists wins. Indexes drift between fiscal years.
                header = {v.strip().upper(): k for k, v in cells.items() if v}
                for field, names in COLUMN_CANDIDATES.items():
                    for name in names:
                        if name in header:
                            colmap[header[name]] = field
                            break
                resolved = set(colmap.values())
                missing = [f for f in REQUIRED_FIELDS if f not in resolved]
                if missing:
                    raise SystemExit(
                        f"FATAL: {os.path.basename(path)} header resolves none of "
                        f"{missing}. Header was: {sorted(header)[:40]}"
                    )
                absent = [f for f in COLUMN_CANDIDATES if f not in resolved]
                if absent:
                    log(f"    (no column for {absent}; those aggregates degrade)")
                # The multi-year trap, guarded.
                #
                # DOL replaced the ETA-9089 mid-FY2024, so an older file uses
                # older column names. A name that does not resolve degrades to
                # an empty value rather than an error, which is the right
                # behaviour for a field DOL genuinely stopped publishing and
                # the WRONG behaviour for a mapping we simply got wrong: every
                # case in that file then lands with no state, no occupation
                # and no wage, and quietly drags every aggregate toward the
                # mean while looking like a successful run.
                #
                # No real PERM file lacks all three. Losing all three means the
                # mapping is wrong, so fail and name the file rather than
                # publish a diluted number.
                core = {"state", "soc_code", "wage"}
                if not (core & resolved):
                    raise SystemExit(
                        f"FATAL: {os.path.basename(path)} resolved NONE of "
                        f"{sorted(core)}. That is a column-mapping failure, not a "
                        "file without those fields. Run --dump-header on it and add "
                        "the real names to COLUMN_CANDIDATES before trusting this run."
                    )
                if dump_header:
                    # The primary source for what a column is really called.
                    # A guessed name degrades to an empty column, which reads
                    # exactly like DOL not publishing the field at all.
                    log(f"    resolved: {sorted((v, k) for k, v in colmap.items())}")
                    log(f"    all {len(header)} header names:")
                    for name in sorted(header):
                        log(f"      {name}")
                    return 0
                continue
            rec = {colmap[ci]: val for ci, val in cells.items()}

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

            # The analytical dimensions. Aggregate-only; no row survives.
            outcome = norm_status(rec.get("status", ""))
            raw_wage = rec.get("wage", "")
            wage, wage_reason = annual_wage_detail(raw_wage, rec.get("wage_unit", ""))
            raw_state = (rec.get("state") or "").strip().upper()
            state = raw_state if raw_state in US_STATES else STATE_NAMES.get(raw_state, "")
            if outcome and state:
                st = acc["byState"][state]
                st[outcome] += 1
                st["days"].append(days)
                if wage is not None:
                    st["wages"].append(wage)
            soc = (rec.get("soc_code") or "").strip()
            if outcome and soc:
                so = acc["bySoc"][soc[:10]]
                so[outcome] += 1
                so["days"].append(days)
                if wage is not None:
                    so["wages"].append(wage)
                title = (rec.get("soc_title") or "").strip()
                if title and not so["title"]:
                    so["title"] = title[:80]
            # Denial-risk dimensions. Only DECIDED cases carry a rate, and
            # "denied" is the numerator: withdrawals are neither approvals nor
            # denials, so they stay out of both.
            if outcome in ("certified", "denied"):
                is_denied = 1 if outcome == "denied" else 0
                if wage is not None:
                    band = wage_band(wage)
                    acc["riskWage"][band][0] += 1
                    acc["riskWage"][band][1] += is_denied
                fy = fiscal_year(decided)
                acc["riskYear"][fy][0] += 1
                acc["riskYear"][fy][1] += is_denied
                for flag, present in (
                    ("layoff", yes(rec.get("layoff"))),
                    ("ownership", yes(rec.get("ownership"))),
                    ("partTime", no(rec.get("fulltime"))),
                ):
                    if present:
                        acc["riskFlags"][flag][0] += 1
                        acc["riskFlags"][flag][1] += is_denied
                if outcome == "certified" and wage is not None:
                    acc["allWages"].append(wage)

            # The salary explorer's raw material. Certified cases only: a
            # denied case's offered wage is what an employer proposed and DOL
            # rejected, which is not what the job pays, and pooling the two
            # would answer a different question than the one the page asks.
            if outcome == "certified" and str(raw_wage).strip():
                acc["wageReasons"][wage_reason] += 1
                if wage is not None:
                    fy = fiscal_year(decided)
                    cells = acc["wageCells"]
                    code = soc[:10]
                    if code:
                        cells["occupation"][(code, fy)].append(wage)
                        title = " ".join((rec.get("soc_title") or "").split())[:80]
                        if title and code not in acc["socTitles"]:
                            acc["socTitles"][code] = title
                    if state:
                        cells["state"][(state, fy)].append(wage)
                    if code and state:
                        cells["occupationState"][(f"{code}|{state}", fy)].append(wage)

            attorney = " ".join((rec.get("attorney") or "").split())[:80]
            if outcome and attorney and attorney.lower() not in ("n/a", "na", "none"):
                at = acc["byAttorney"][attorney.upper()]
                at[outcome] += 1
                at["days"].append(days)
                if not at["name"]:
                    at["name"] = attorney
                if not at["state"]:
                    ast = (rec.get("attorney_state") or "").strip().upper()
                    at["state"] = ast if ast in US_STATES else STATE_NAMES.get(ast, "")

            employer = " ".join((rec.get("employer") or "").split())[:80]
            if outcome and employer:
                em = acc["byEmployer"][employer.upper()]
                em[outcome] += 1
                em["days"].append(days)
                if not em["name"]:
                    em["name"] = employer

            # The case-level row. Gated on `outcome` so the browser's corpus is
            # exactly the population every rate on the site is computed over: a
            # row DOL gave no readable status is in no facet and must not be in
            # the table either, or the header count and the pages disagree.
            #
            # Truncations match the aggregates field for field (80 chars for
            # names and titles, 10 for the SOC code). A socCode truncated
            # differently here would not match the occupation entity it is
            # supposed to slice by.
            if cases is not None and outcome:
                cases.write(
                    {
                        "caseNumber": case_no,
                        "status": outcome,
                        "receivedDate": received,
                        "decisionDate": decided,
                        "days": days,
                        "fiscalYear": fiscal_year(decided),
                        "employerName": employer,
                        "state": state,
                        "jobTitle": " ".join((rec.get("job_title") or "").split())[:80],
                        "socCode": soc[:10],
                        "socTitle": " ".join((rec.get("soc_title") or "").split())[:80],
                        "attorneyName": attorney,
                        "wage": wage,
                    }
                )

    log(f"  {os.path.basename(path)}: {rows - 1:,} sheet rows, {kept:,} new cases")
    return kept


def build_wage_stats(acc: dict, files: list[tuple[str, str]]) -> dict:
    """Percentile and histogram cells for the salary explorer.

    Three partitions - occupation, state, and occupation-by-state - each
    emitted PER FISCAL YEAR and once more pooled as `"all"`. Per-year matters
    once the ingest reaches back five years: pooling 2022 and 2026 salaries
    into one median reports a number that was never the market rate in any
    year of it.

    ## How many rows this can produce

    For any single partition, a cell needs F values to be published and every
    case lands in exactly one cell, so the cells clearing the floor number at
    most N/F. That is arithmetic, not an estimate. At N = 259,489:

        occupation    F=50   <= 5,189 cells   (really ~800, one per SOC)
        state         F=50   <= 5,189 cells   (really ~55)
        occ x state   F=100  <= 2,594 cells

    Per-year rows are bounded the same way in aggregate, because a case is in
    exactly one year, so the year-split rows total no more than the pooled
    ones. Worst case is therefore about 26,000 rows and realistically a
    fraction of that - fine for a table, and far past what a 1 MB Convex
    document could hold, which is why these go to `permWageStats` rather than
    onto the aggregate document.
    """
    reasons = acc["wageReasons"]
    considered = sum(reasons.values())
    kept = reasons.get("ok", 0)
    policy = {
        "rule": WAGE_POLICY,
        "min": WAGE_MIN,
        "max": WAGE_MAX,
        "considered": considered,
        "kept": kept,
        "excluded": considered - kept,
        # An ARRAY, not a map: Convex validators want a declared shape, and a
        # list of {reason, count} renders in a stable order besides.
        #
        # "ok" is deliberately NOT in here. It was, and it made the field a
        # lie: a reader who sums a list called `excludedByReason` gets
        # `considered`, not `excluded`. The kept count has its own field.
        "excludedByReason": [
            {"reason": r, "count": n}
            for r, n in sorted(reasons.items())
            if r != "ok"
        ],
        "population": "certified cases with a published wage",
        "percentileMethod": "linear-interpolation",
    }

    rows: list[dict] = []
    for kind, cells in acc["wageCells"].items():
        floor = WAGE_PAIR_FLOOR if kind == "occupationState" else WAGE_STAT_FLOOR
        pooled: dict[str, list[int]] = defaultdict(list)
        for (key, fy), values in cells.items():
            pooled[key].extend(values)
            if len(values) >= floor:
                rows.append(wage_row(kind, key, fy, values, acc))
        for key, values in pooled.items():
            if len(values) >= floor:
                rows.append(wage_row(kind, key, "all", values, acc))

    rows.sort(key=lambda r: (r["kind"], r["fiscalYear"], -r["count"]))
    payload = {
        "sourceFiles": [name for name, _ in files],
        "fiscalYears": sorted({r["fiscalYear"] for r in rows if r["fiscalYear"] != "all"}),
        "cells": len(rows),
        "binEdges": WAGE_BIN_EDGES,
        "floors": {"single": WAGE_STAT_FLOOR, "pair": WAGE_PAIR_FLOOR},
        "policy": policy,
        "rows": rows,
    }
    body = json.dumps(payload, sort_keys=True, separators=(",", ":"))
    payload["contentHash"] = hashlib.sha256(body.encode()).hexdigest()
    return payload


def wage_row(kind: str, key: str, fy: str, values: list[int], acc: dict) -> dict:
    """One published cell. Percentiles by the convention `percentile` states."""
    code, state = ("", "")
    if kind == "occupation":
        code = key
    elif kind == "state":
        state = key
    else:
        code, state = key.split("|", 1)
    ps = {p: percentile(values, p) for p in (5, 10, 25, 50, 75, 90, 95)}
    if any(v is None for v in ps.values()):
        raise SystemExit(
            f"FATAL: {kind}/{key}/{fy} has {len(values)} values but a percentile "
            "came back None. A published cell must never carry a null percentile."
        )
    return {
        "kind": kind,
        "key": key,
        "socCode": code,
        "socTitle": acc["socTitles"].get(code, ""),
        "state": state,
        "fiscalYear": fy,
        "count": len(values),
        "p5": ps[5],
        "p10": ps[10],
        "p25": ps[25],
        "p50": ps[50],
        "p75": ps[75],
        "p90": ps[90],
        "p95": ps[95],
        "mean": round(sum(values) / len(values)),
        "histogram": histogram(values),
    }


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

    def tot(d: dict) -> int:
        return d["certified"] + d["denied"] + d["withdrawn"]

    by_state = [
        {
            "state": st,
            "total": tot(d),
            "certified": d["certified"],
            "denied": d["denied"],
            "withdrawn": d["withdrawn"],
            "medianDays": percentile(d["days"], 50),
            "medianAnnualWage": percentile(d["wages"], 50),
        }
        for st, d in sorted(acc["byState"].items())
        if tot(d) >= 25  # a state with a handful of rows is noise, not a rate
    ]

    top_socs = [
        {
            "code": code,
            "title": d["title"] or code,
            "total": tot(d),
            "certified": d["certified"],
            "denied": d["denied"],
            "medianDays": percentile(d["days"], 50),
            "medianAnnualWage": percentile(d["wages"], 50),
        }
        for code, d in sorted(
            acc["bySoc"].items(), key=lambda kv: -tot(kv[1])
        )
        if tot(d) >= ENTITY_FLOOR
    ]

    # Every employer that clears the floor, not a top-N. A page for a
    # one-case filer is noise -- a 100% approval rate over a single decision
    # is not a rate -- so ENTITY_FLOOR is the smallest N where the numbers
    # mean anything, and everything below it still counts toward the
    # national totals, it just does not get its own row.
    top_employers = [
        {
            "name": d["name"],
            "total": tot(d),
            "certified": d["certified"],
            "denied": d["denied"],
            "medianDays": percentile(d["days"], 50),
        }
        for d in sorted(
            merge_entities(acc["byEmployer"], lambda x: x["name"], "employer"),
            key=lambda d: -tot(d),
        )
        if tot(d) >= ENTITY_FLOOR
    ]

    top_attorneys = [
        {
            "name": d["name"],
            "state": d["state"],
            "total": tot(d),
            "certified": d["certified"],
            "denied": d["denied"],
            "medianDays": percentile(d["days"], 50),
        }
        for d in sorted(
            merge_entities(acc["byAttorney"], lambda x: x["name"], "attorney"),
            key=lambda d: -tot(d),
        )
        if tot(d) >= ENTITY_FLOOR
    ]

    # The national wage ladder over certified cases. A lone median hides the
    # spread that makes a wage figure usable; the percentiles are the product.
    wages = acc["allWages"]
    wage_ladder = (
        {
            "count": len(wages),
            "p10": percentile(wages, 10),
            "p25": percentile(wages, 25),
            "p50": percentile(wages, 50),
            "p75": percentile(wages, 75),
            "p90": percentile(wages, 90),
        }
        if len(wages) >= 1000
        else None
    )

    def rate_rows(bucket: dict, order: list[str] | None = None) -> list[dict]:
        keys = order or sorted(bucket)
        out = []
        for k in keys:
            if k not in bucket:
                continue
            decided, denied = bucket[k]
            if decided < 100:  # too few decisions to carry a rate
                continue
            out.append(
                {
                    "bucket": k,
                    "decided": decided,
                    "denied": denied,
                    "denialRate": round(denied / decided * 100, 2),
                }
            )
        return out

    risk = {
        "byWage": rate_rows(acc["riskWage"], [label for _, label in WAGE_BANDS]),
        "byYear": rate_rows(acc["riskYear"]),
        "byFlag": rate_rows(acc["riskFlags"], ["layoff", "ownership", "partTime"]),
    }
    # The baseline every rate is read against: denials over decided cases.
    decided_total = sum(v[0] for v in acc["riskYear"].values())
    denied_total = sum(v[1] for v in acc["riskYear"].values())
    risk["baseline"] = {
        "decided": decided_total,
        "denied": denied_total,
        "denialRate": round(denied_total / decided_total * 100, 2) if decided_total else 0.0,
    }

    payload = {
        "sourceFiles": [name for name, _ in files],
        "uniqueCases": unique,
        "cohorts": cohorts,
        "clearanceByMonth": [
            {"month": m, "decisions": n} for m, n in sorted(acc["clearance"].items())
        ],
        "frontierHistory": frontier,
        "byState": by_state,
        "topAttorneys": top_attorneys,
        "wageLadder": wage_ladder,
        "risk": risk,
        "topOccupations": top_socs,
        "topEmployers": top_employers,
    }
    body = json.dumps(payload, sort_keys=True, separators=(",", ":"))
    payload["contentHash"] = hashlib.sha256(body.encode()).hexdigest()
    return payload


def self_test() -> int:
    """Assert the numeric conventions against hand-computed values.

    These exist because "close enough" percentiles disagree at small n in ways
    nobody notices until a published number looks wrong, and because there is
    no pytest in this repo to put them in. Run in CI with one line:

        python3 scripts/ingest_perm_disclosure.py --self-test
    """
    checks: list[tuple[str, object, object]] = []

    def eq(label, got, want):
        checks.append((label, got, want))

    # --- percentiles: LINEAR INTERPOLATION between closest ranks -----------
    # k = (n-1) * p/100, then interpolate between floor(k) and ceil(k).
    # Nearest-rank would return an observed value and disagrees on the first
    # two of these, which is exactly why the convention is written down.
    eq("p50 of [1,2,3,4] -> 2.5, halves round to even", percentile([1, 2, 3, 4], 50), 2)
    eq("p25 of [1,2,3,4] -> 1.75", percentile([1, 2, 3, 4], 25), 2)
    eq("p75 of [1,2,3,4] -> 3.25", percentile([1, 2, 3, 4], 75), 3)
    eq("p50 of [10..50] -> exact middle", percentile([10, 20, 30, 40, 50], 50), 30)
    eq("p10 of [10..50] -> 10 + 10*0.4", percentile([10, 20, 30, 40, 50], 10), 14)
    eq("p90 of [10..50] -> 50 - 10*0.4", percentile([10, 20, 30, 40, 50], 90), 46)
    eq("a single value is every percentile of itself", percentile([100], 90), 100)
    eq("no values -> None, never 0", percentile([], 50), None)
    eq("unsorted input is sorted first", percentile([50, 10, 30, 20, 40], 50), 30)

    # --- histogram: lower-bound edges, last bin open-ended -----------------
    probe = [0, 39_999, 40_000, 99_999, 100_000, 499_999, 500_000, 2_000_000]
    h = histogram(probe)
    eq("every value lands in exactly one bin", sum(h), len(probe))
    eq("bin count matches the declared edges", len(h), len(WAGE_BIN_EDGES))
    eq("39,999 sits below the 40k edge", h[0], 2)
    eq("40,000 sits on the 40k edge", h[1], 1)
    eq("the top bin is open-ended", h[-1], 2)
    eq("an empty series is all zeroes, not an error", sum(histogram([])), 0)

    # --- wage annualisation and the outlier policy ------------------------
    eq("hourly annualises at 2080", annual_wage_detail("50.00", "Hour")[0], 104_000)
    eq("weekly annualises at 52", annual_wage_detail("2000", "Week")[0], 104_000)
    eq("bi-weekly annualises at 26", annual_wage_detail("4000", "Bi-Weekly")[0], 104_000)
    eq("monthly annualises at 12", annual_wage_detail("8666.67", "Month")[0], 104_000)
    eq("yearly passes through", annual_wage_detail("104000", "Year")[0], 104_000)
    eq("dollar signs and commas are stripped", annual_wage_detail("$104,000.00", "Year")[0], 104_000)
    # The failure the competitor's data visibly contains: an hourly rate
    # entered with unit Year. It must be EXCLUDED and it must say why.
    eq("an hourly rate typed as annual is refused", annual_wage_detail("30.00", "Year"), (None, "below-band"))
    eq("an absurd figure is refused", annual_wage_detail("4500000", "Year"), (None, "above-band"))
    eq("an unknown unit is refused", annual_wage_detail("95000", "Fortnight"), (None, "unknown-unit"))
    eq("a non-number is refused", annual_wage_detail("n/a", "Year"), (None, "unparseable"))
    eq("the band edges are inclusive", annual_wage_detail(str(WAGE_MIN), "Year")[0], WAGE_MIN)
    eq("the upper band edge is inclusive", annual_wage_detail(str(WAGE_MAX), "Year")[0], WAGE_MAX)

    # --- fiscal years ------------------------------------------------------
    eq("October starts the next fiscal year", fiscal_year("2025-10-01"), "2026")
    eq("September ends the current one", fiscal_year("2025-09-30"), "2025")
    eq("FY parsed from a quarterly filename", file_fiscal_year("PERM_Disclosure_Data_FY2024_Q4.xlsx"), 2024)
    eq("FY parsed from the new-form filename", file_fiscal_year("PERM_Disclosure_Data_New_Form_FY2024_Q4.xlsx"), 2024)
    eq("a two-digit FY is 2000-based", file_fiscal_year("PERM_Disclosure_Data_FY17.xlsx"), 2017)
    eq("a filename with no FY is 0, not a guess", file_fiscal_year("PERM_Disclosure_Data.xlsx"), 0)

    # --- file selection: the FY2024 pair must never be split --------------
    pair = {
        "PERM_Disclosure_Data_FY2026_Q3.xlsx": "u",
        "PERM_Disclosure_Data_FY2025_Q4.xlsx": "u",
        "PERM_Disclosure_Data_New_Form_FY2024_Q4.xlsx": "u",
        "PERM_Disclosure_Data_FY2024_Q4.xlsx": "u",
        "PERM_Disclosure_Data_FY2023_Q4.xlsx": "u",
    }
    picked = [n for n, _ in select_files(pair, since_fy=2024)]
    fy24 = [n for n in picked if file_fiscal_year(n) == 2024]
    eq("--since-fy takes both FY2024 files", len(fy24), 2)
    # Within FY2024 the new form must be parsed FIRST, because de-duplication
    # is first-wins on case number and the current form is the record to keep.
    eq("the new form sorts ahead of the old one", "New_Form" in fy24[0], True)
    eq("the old form is still taken, just second", "New_Form" in fy24[1], False)
    eq("--files 2 is unchanged", len(select_files(pair, limit=2)), 2)

    failed = [(l, g, w) for l, g, w in checks if g != w]
    # Counts before the verdict: a self-test that asserted nothing must be
    # loud rather than print a clean pass.
    log(f"self-test: {len(checks)} assertions")
    if not checks:
        raise SystemExit("FATAL: the self-test asserted nothing.")
    for label, got, want in failed:
        log(f"  FAIL  {label}: got {got!r}, want {want!r}")
    if failed:
        raise SystemExit(f"FATAL: {len(failed)} of {len(checks)} assertions failed.")
    log("self-test: all passed")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument(
        "--files",
        type=int,
        default=None,
        help=(
            "Union the newest N disclosure files. Can split a fiscal year that "
            "DOL published as two files (FY2024 is two), so it warns when it "
            "does. Prefer --since-fy."
        ),
    )
    ap.add_argument(
        "--since-fy",
        type=int,
        default=None,
        help=(
            "Union every file for fiscal year N and later. The safe multi-year "
            "control: a year published as two files can never be split."
        ),
    )
    ap.add_argument("--out", help="Write the aggregate payload here")
    ap.add_argument("--local", nargs="*", help="Parse these local files instead of downloading")
    ap.add_argument(
        "--cases-out",
        help=(
            "Also write one gzipped JSON line per decided case here, plus a "
            "sibling <path>.meta.json holding the coverage statement and the "
            "exact facet counts. Kept out of --out on purpose: the aggregate "
            "payload is passed to `convex run` on a command line."
        ),
    )
    ap.add_argument(
        "--wages-out",
        help=(
            "Also write the salary-explorer percentile cells here as JSON. "
            "Kept out of --out because the cell list runs to thousands of rows "
            "and the aggregate payload is passed to `convex run` on a command "
            "line."
        ),
    )
    ap.add_argument(
        "--self-test",
        action="store_true",
        help="Assert the percentile, histogram, wage and file-selection conventions, then stop.",
    )
    ap.add_argument(
        "--dump-header",
        action="store_true",
        help="Print the first file's resolved and raw column names, then stop.",
    )
    args = ap.parse_args()
    if args.self_test:
        return self_test()
    if not args.out and not args.dump_header:
        ap.error("--out is required unless --dump-header is given")
    if args.files is not None and args.since_fy is not None:
        ap.error("--files and --since-fy pick files two different ways; give one")
    # Neither given keeps the historical behaviour, so an existing caller that
    # passes nothing gets exactly what it got before.
    if args.files is None and args.since_fy is None:
        args.files = DEFAULT_FILE_COUNT

    if args.local:
        files = [(os.path.basename(p), p) for p in args.local]
        log(f"Using {len(files)} local file(s)")
    else:
        files = discover_files(args.files, args.since_fy)

    acc = {
        "cohorts": defaultdict(list),
        "clearance": Counter(),
        "frontier": defaultdict(Counter),
        "byState": defaultdict(lambda: {"certified": 0, "denied": 0, "withdrawn": 0, "days": [], "wages": []}),
        "bySoc": defaultdict(lambda: {"certified": 0, "denied": 0, "withdrawn": 0, "days": [], "wages": [], "title": ""}),
        "byEmployer": defaultdict(lambda: {"certified": 0, "denied": 0, "withdrawn": 0, "days": [], "name": ""}),
        "byAttorney": defaultdict(lambda: {"certified": 0, "denied": 0, "withdrawn": 0, "days": [], "name": "", "state": ""}),
        # Denial-risk dimensions. Each holds [decided, denied].
        "riskWage": defaultdict(lambda: [0, 0]),
        "riskYear": defaultdict(lambda: [0, 0]),
        "riskFlags": defaultdict(lambda: [0, 0]),
        # Every certified wage, for the national percentile ladder.
        "allWages": [],
        # Certified wages per (partition key, fiscal year), for the salary
        # explorer. Keyed by year so a five-year ingest does not pool a 2022
        # salary with a 2026 one and call the result a market rate; the
        # pooled "all" row is derived from these at the end rather than
        # accumulated separately.
        "wageCells": {
            "occupation": defaultdict(list),
            "state": defaultdict(list),
            "occupationState": defaultdict(list),
        },
        "socTitles": {},
        # The audit trail for the outlier policy. Counted, never inferred.
        "wageReasons": Counter(),
    }
    seen: set[str] = set()
    cases = CaseWriter(args.cases_out) if args.cases_out else None

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
            parse_file(path, seen, acc, cases, args.dump_header)
            if args.dump_header:
                return 0

    payload = build_payload(files, acc, len(seen))

    if args.wages_out:
        wages = build_wage_stats(acc, files)
        with open(args.wages_out, "w") as fh:
            json.dump(wages, fh, separators=(",", ":"))
        pol = wages["policy"]
        by_kind = Counter(r["kind"] for r in wages["rows"])
        log("")
        log(f"wage cells        {len(wages['rows']):,}")
        for kind in ("occupation", "state", "occupationState"):
            log(f"  {kind:16s} {by_kind.get(kind, 0):,}")
        log(f"wages considered  {pol['considered']:,} (certified, with a published wage)")
        log(f"  kept            {pol['kept']:,}")
        log(f"  excluded        {pol['excluded']:,}  {pol['excludedByReason']}")
        log(f"wrote {args.wages_out} ({os.path.getsize(args.wages_out) / 1e6:.2f} MB)")
        # Same rule as everywhere else here: a run that inspected nothing must
        # be loud rather than quietly publish an empty salary explorer.
        if not wages["rows"]:
            raise SystemExit(
                "FATAL: --wages-out produced no cells. Either no wage column "
                "resolved or every value was excluded. Refusing to report success."
            )

    if cases is not None:
        meta = cases.close()
        meta["sourceFiles"] = [name for name, _ in files]
        meta_path = args.cases_out + ".meta.json"
        with open(meta_path, "w") as fh:
            json.dump(meta, fh, separators=(",", ":"))
        size = os.path.getsize(args.cases_out) / 1e6
        log("")
        log(f"case rows         {meta['totalCases']:,}")
        log(f"  by status       {meta['byStatus']}")
        log(f"  decisions from  {meta['firstDecisionDate']} to {meta['lastDecisionDate']}")
        log(f"  states          {len(meta['byState'])}")
        log(f"  fiscal years    {[r['fiscalYear'] for r in meta['byFiscalYear']]}")
        log(f"wrote {args.cases_out} ({size:.1f} MB gzipped)")
        log(f"wrote {meta_path}")
        # A run that wrote the file and no rows is a broken run, not an empty
        # quarter. It must be loud rather than a clean zero, or store_cases.py
        # cheerfully clears 259,000 good rows and replaces them with nothing.
        if meta["totalCases"] == 0:
            raise SystemExit("FATAL: --cases-out wrote no rows. Refusing to report success.")

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

    # STAMP OUR OWN FRESHNESS ROW.
    #
    # This ingest wrote data and never recorded that it had. The row for this
    # dataset was created once by `backfill_permtrack.py`, a one-off that is in
    # no workflow, so `as_of` stayed frozen at whatever that run left while the
    # data underneath refreshed on schedule. That makes the freshness table -
    # which `DataProvenance` renders to readers and `check_ingest_health.py`
    # alerts on - describe a moment that has nothing to do with this data.
    #
    # A monitor reading a frozen row eventually fires a FALSE alarm, which is
    # worse than no monitor: it teaches you to ignore the real one.
    db.execute("""CREATE TABLE IF NOT EXISTS data_freshness (
        dataset TEXT PRIMARY KEY, as_of TEXT, fetched_at INTEGER,
        source TEXT, cadence TEXT, note TEXT, max_age_days INTEGER)""")
    db.execute("INSERT OR REPLACE INTO data_freshness VALUES (?,?,?,?,?,?,?)",
               ["perm-cases", str(db.scalar("SELECT max(decision_date) FROM perm_cases"))[:10], int(time.time() * 1000),
                "DOL quarterly disclosure files (flag.dol.gov)", "Quarterly",
                f"{held:,} decided cases", 135])

    return 0


if __name__ == "__main__":
    sys.exit(main())
