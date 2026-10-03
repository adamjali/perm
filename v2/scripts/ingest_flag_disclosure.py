#!/usr/bin/env python3
"""Ingest DOL's quarterly PW (ETA-9141) and LCA (ETA-9035) disclosure files.

One script, two programs, selected with `--program pw|lca`. Each run discovers
the newest disclosure file for that program on DOL's performance page, streams
it, and upserts one row per case into `pwd_cases` or `lca_cases`.

    python3 scripts/ingest_flag_disclosure.py --program pw
    python3 scripts/ingest_flag_disclosure.py --program lca

    # Probe the parser against a local file, writing nothing.
    python3 scripts/ingest_flag_disclosure.py --program pw --dry-run --file x.xlsx --dump-rows 5

    # What column names does this file actually use?
    python3 scripts/ingest_flag_disclosure.py --program lca --dump-header --file x.xlsx

The rules it shares with `ingest_perm_disclosure.py`:

* **The download URL is discovered, never constructed.** DOL keeps the
  current-year file under `/media/` and the archive under
  `/sites/dolgov/files/ETA/oflc/pdfs/`, and a hardcoded path returns a styled
  404 that reads like a dead link. The LCA link's text is misspelled
  (`LCA_Dislclosure_Data_...`) while its href is right, and the href carries a
  double slash, so discovery matches the href's basename, collapses the
  slashes and never reads the link text.
* **www.dol.gov refuses a bare User-Agent** and serves the full browser header
  set in `lib_gov_data.BROWSER_HEADERS`. Sustained traffic earns a 403 anyway,
  so the download backs off.
* **XLSX omits empty cells**, so a row's cells indexed by position shift after
  the first blank one. `lib_gov_data.iter_rows` resolves each cell from its
  own `r="A1"` reference, and the test fixture has a blank mid-row cell.
* **A load is guarded before it writes** (`lib_load_guard.py`). A pre-pass
  records which columns resolved, the blank share per column and the median
  wage per unit, and compares them with the previous load of the same
  program. A lost column, a blank share up 25 points, a median wage moved by
  half, or more than 1% of rows with impossible values refuses the file with
  nothing written. `--accept-drift` overrides the drift half after a person
  has looked; the impossible-values half has no override.
* **Columns are resolved by header name, per file**, from the names on DOL's
  FY2026 Q3 record layouts. A guessed name degrades to an empty column, which
  reads exactly like DOL not publishing the field. The older-form PW files
  (FY2020 and earlier) aren't mapped: run `--dump-header` on one and add the
  verified names first.
* **No contact data, ever.** Both files carry contact emails, direct phones
  and street addresses, and none of those columns is in
  `PROGRAMS[...]["columns"]`, so nothing here can read them.

Two things this script does that the PERM ingest doesn't:

1. **It writes rows itself**, `INSERT OR REPLACE` on `case_number`, so a case
   republished in a later file (a PW redetermination decided the next
   quarter) moves to the new `source_file`.
2. **It reconciles before it reports success.** After the write,
   `COUNT(*) WHERE source_file = <this file>` must equal the unique cases read
   from that file, or the run is recorded as failed and exits 1. Freshness is
   stamped only after that passes.

A load rewrites every row and every index entry, so the file's SHA-256 is kept
in `perm_docs['flag_disclosure_<program>']` with the row count: a later run
that sees the same hash, with the table still holding that count, skips the
write, re-stamps freshness and records a zero-row run. `--force` bypasses
that. DOL republishes each quarter under a new filename, so a new quarter
loads the first month it exists.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import pathlib
import re
import sys
import tempfile
import time
import urllib.error
import urllib.request
import zipfile
from collections import Counter

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from lib_slugs import slugify  # noqa: E402
from ingest_perm_disclosure import (  # noqa: E402
    STATE_NAMES,
    US_STATES,
    file_fiscal_year,
    fiscal_year,
    to_iso,
)
from lib_load_guard import Fingerprint, drift_findings, sanity_findings  # noqa: E402
from lib_naics import normalize_naics  # noqa: E402
from lib_gov_data import (  # noqa: E402
    BROWSER_HEADERS,
    discover_links,
    fetch,
    iter_rows,
    log,
    read_shared_strings,
)
from lib_turso import (  # noqa: E402
    Turso, add_missing_columns, case_update, query_rows, read_doc, record_run, stamp_freshness,
    stmt, write_doc,
)

PERFORMANCE_PAGE = "https://www.dol.gov/agencies/eta/foreign-labor/performance"
HOST = "https://www.dol.gov"

# Column candidates are tried in order; the first header that exists wins.
# Every name is verbatim from the FY2026 Q3 record layouts (see the module
# docstring). `decision` is the primary decision date; `event_dates` are the
# other dated events the layout carries, and `decision_date` becomes the LATEST
# of all of them - which is what CASE_STATUS describes ("the last significant
# event or decision"). A PW case withdrawn before determination has a blank
# DETERMINATION_DATE and a filled WITHDRAWAL_DATE; without the fold-in it would
# have a status and no date.
PROGRAMS: dict[str, dict] = {
    "pw": {
        "label": "prevailing wage (ETA-9141)",
        "table": "pwd_cases",
        "freshness": "pw-disclosure",
        "source": "DOL quarterly PW disclosure files (www.dol.gov)",
        # `PW_Worksites_*` and the FY2018 `PWD_Disclosure_Data_*` are excluded
        # on purpose: the first is a different table, the second an older form.
        "file_pattern": r"PW_Disclosure_Data_FY\d{2,4}(_Q\d)?(_old_form|_revised_form)?\.xlsx$",
        "columns": {
            "case": ["CASE_NUMBER"],
            "status": ["CASE_STATUS"],
            "received": ["RECEIVED_DATE"],
            "decision": ["DETERMINATION_DATE"],
            "employer": ["EMPLOYER_LEGAL_BUSINESS_NAME"],
            "job_title": ["JOB_TITLE"],
            # The OFLC-ISSUED occupation, not the employer's SUGGESTED_SOC_CODE.
            "soc_code": ["PWD_SOC_CODE"],
            "soc_title": ["PWD_SOC_TITLE"],
            # The determined prevailing wage, not ALT_PWD_WAGE_RATE (the rate
            # for the employer's alternative requirements).
            "wage": ["PWD_WAGE_RATE"],
            "wage_unit": ["PWD_UNIT_OF_PAY"],
            "state": ["PRIMARY_WORKSITE_STATE"],
            "visa": ["VISA_CLASS"],
            # From PW_Record_Layout_FY2026_Q3.pdf: the employer's NAICS code
            # and the primary worksite's city.
            "city": ["PRIMARY_WORKSITE_CITY"],
            "naics": ["NAICS_CODE"],
            # The REPRESENTING firm, not the employer. Both files carry it
            # under the same name; the ETA-9035 layout calls it "Name of Law
            # Firm representing the Employer submitting the Labor Condition
            # Application", the ETA-9141 one the same for a wage request.
            "attorney": ["LAWFIRM_NAME_BUSINESS_NAME"],
        },
        "event_dates": [
            ["REDETERMINATION_DATE"],
            ["CENTER_DIRECTOR_REVIEW_DATE"],
            ["WITHDRAWAL_DATE"],
        ],
    },
    "lca": {
        "label": "LCA (ETA-9035)",
        "table": "lca_cases",
        "freshness": "lca-disclosure",
        "source": "DOL quarterly LCA disclosure files (www.dol.gov)",
        # `LCA_Appendix_A_*` and `LCA_Worksites_*` are companion tables, and
        # the FY2019-and-earlier `H-1B_Disclosure_Data_*` files use older
        # column names that are not mapped here.
        "file_pattern": r"LCA_Disclosure_Data_FY\d{2,4}(_Q\d)?\.xlsx$",
        "columns": {
            "case": ["CASE_NUMBER"],
            "status": ["CASE_STATUS"],
            "received": ["RECEIVED_DATE"],
            "decision": ["DECISION_DATE"],
            "employer": ["EMPLOYER_NAME"],
            "job_title": ["JOB_TITLE"],
            "soc_code": ["SOC_CODE"],
            "soc_title": ["SOC_TITLE"],
            # The OFFERED wage. The file also carries PREVAILING_WAGE (the
            # floor the employer attested to), which is a different number and
            # the plausible-wrong column. The test pins this choice.
            "wage": ["WAGE_RATE_OF_PAY_FROM"],
            "wage_unit": ["WAGE_UNIT_OF_PAY"],
            "state": ["WORKSITE_STATE"],
            "visa": ["VISA_CLASS"],
            # From LCA_Record_Layout_FY2026_Q3.pdf: NAICS_CODE is Form ETA-9035
            # Section C, Item 13; WORKSITE_CITY is the first worksite location
            # (the Worksites companion file lists the rest).
            "city": ["WORKSITE_CITY"],
            "naics": ["NAICS_CODE"],
            # The REPRESENTING firm, not the employer. Both files carry it
            # under the same name; the ETA-9035 layout calls it "Name of Law
            # Firm representing the Employer submitting the Labor Condition
            # Application", the ETA-9141 one the same for a wage request.
            "attorney": ["LAWFIRM_NAME_BUSINESS_NAME"],
            # From LCA_Record_Layout_FY2026_Q3.pdf. The worker counts are Form
            # ETA-9035 Section B, Items 7 and 7a-7f: how many of the positions
            # are new employment, continuing, a change of employer (a
            # transfer) and so on. PW_WAGE_LEVEL is Section F.a, Item 13a,
            # filled only when the employer determined the wage itself from
            # OES ("I" to "IV" or "N/A"). The two flags are Section H.a, Items
            # 1 and 2: the employer's own attestation. Note the hyphen: the
            # header is `H-1B_DEPENDENT`.
            "workers": ["TOTAL_WORKER_POSITIONS"],
            "new_employment": ["NEW_EMPLOYMENT"],
            "continued_employment": ["CONTINUED_EMPLOYMENT"],
            "change_previous_employment": ["CHANGE_PREVIOUS_EMPLOYMENT"],
            "new_concurrent_employment": ["NEW_CONCURRENT_EMPLOYMENT"],
            "change_employer": ["CHANGE_EMPLOYER"],
            "amended_petition": ["AMENDED_PETITION"],
            "wage_level": ["PW_WAGE_LEVEL"],
            "h1b_dependent": ["H-1B_DEPENDENT", "H_1B_DEPENDENT"],
            "willful_violator": ["WILLFUL_VIOLATOR"],
        },
        "event_dates": [],
    },
}

# The seasonal programs: H-2A (Form ETA-9142A), H-2B (ETA-9142B) and CW-1
# (ETA-9142C). Names verbatim from DOL's FY2026 Q3 record layouts
# (H-2A_Record_Layout_FY2026_Q3.pdf and its H-2B and CW-1 siblings). None of
# the three files carries a VISA_CLASS column, so `visa_default` names it. The
# work period is the REQUESTED one: every application carries it, while the
# EMPLOYMENT_* dates are blank on a denial. Point-of-contact names, emails,
# phones and FEINs are in all three files and in none of these maps.
SEASONAL_COMMON = {
    "case": ["CASE_NUMBER"],
    "status": ["CASE_STATUS"],
    "received": ["RECEIVED_DATE"],
    "decision": ["DECISION_DATE"],
    "job_title": ["JOB_TITLE"],
    "soc_code": ["SOC_CODE"],
    "soc_title": ["SOC_TITLE"],
    "wage_unit": ["PER"],
    "state": ["WORKSITE_STATE"],
    "city": ["WORKSITE_CITY"],
    "county": ["WORKSITE_COUNTY"],
    "naics": ["NAICS_CODE"],
    "attorney": ["LAWFIRM_NAME_BUSINESS_NAME"],
    "begin_date": ["REQUESTED_BEGIN_DATE"],
    "end_date": ["REQUESTED_END_DATE"],
}

PROGRAMS.update({
    "h2a": {
        "label": "H-2A (ETA-9142A)",
        "table": "h2a_cases",
        "freshness": "h2a-disclosure",
        "source": "DOL quarterly H-2A disclosure files (www.dol.gov)",
        "visa_default": "H-2A",
        # The main file only: the Addendum A and B files are companion tables.
        "file_pattern": r"(?:H-?2A_Disclosure_Data_FY\d{2,4}(?:_Q\d|_EOY|_updated)?|H-?2A_FY\d{2,4}(?:_Q\d)?)\.xlsx$",
        "columns": {
            **SEASONAL_COMMON,
            "employer": ["EMPLOYER_NAME"],
            # Section A, Item 8b: the hourly or monthly wage offered.
            "wage": ["WAGE_OFFER"],
            # Item 2b and the National Processing Center's certified count.
            "workers": ["TOTAL_WORKERS_H-2A_REQUESTED", "TOTAL_WORKERS_H_2A_REQUESTED"],
            "workers_certified": ["TOTAL_WORKERS_H-2A_CERTIFIED", "TOTAL_WORKERS_H_2A_CERTIFIED"],
        },
        "event_dates": [],
    },
    "h2b": {
        "label": "H-2B (ETA-9142B)",
        "table": "h2b_cases",
        "freshness": "h2b-disclosure",
        "source": "DOL quarterly H-2B disclosure files (www.dol.gov)",
        "visa_default": "H-2B",
        # FY2024's file drops "_Data" and FY2020's drops the hyphen.
        "file_pattern": r"(?:H-?2B_Disclosure(?:_Data)?_FY\d{2,4}(?:_Q\d|_EOY)?|H-?2B_FY\d{2,4}(?:_Q\d)?)\.xlsx$",
        "columns": {
            **SEASONAL_COMMON,
            "employer": ["EMPLOYER_NAME"],
            "wage": ["BASIC_WAGE_RATE_FROM"],
            "workers": ["TOTAL_WORKERS_REQUESTED"],
            "workers_certified": ["TOTAL_WORKERS_CERTIFIED"],
        },
        "event_dates": [],
    },
    "cw1": {
        "label": "CW-1 (ETA-9142C)",
        "table": "cw1_cases",
        "freshness": "cw1-disclosure",
        "source": "DOL quarterly CW-1 disclosure files (www.dol.gov)",
        "visa_default": "CW-1",
        # FY2025's file is named CW_ rather than CW-1_.
        "file_pattern": r"CW(?:-1)?_Disclosure_Data_FY\d{2,4}(?:_Q\d)?\.xlsx$",
        "columns": {
            **SEASONAL_COMMON,
            "employer": ["LEGAL_BUSINESS_NAME", "EMPLOYER_NAME"],
            "wage": ["BASIC_WAGE_RATE_FROM"],
            "workers": ["TOTAL_WORKERS_REQUESTED"],
            "workers_certified": ["TOTAL_WORKERS_CERTIFIED"],
        },
        "event_dates": [],
    },
})

# The LCA worker-count columns, in form order (Section B, Items 7a to 7f).
LCA_COUNT_COLUMNS = (
    "new_employment", "continued_employment", "change_previous_employment",
    "new_concurrent_employment", "change_employer", "amended_petition",
)

# A file that resolves none of these is unusable; the rest degrade to NULL
# columns and say so in the log.
REQUIRED_FIELDS = ("case", "status", "received", "decision", "employer")

# One order for the DDL, the INSERT and the row tuples, so a column can never
# be written under another column's name.
COLUMNS = (
    "case_number", "case_status", "received_date", "decision_date",
    "employer_name", "employer_slug", "job_title", "soc_code", "soc_title",
    "wage", "wage_unit", "worksite_state", "visa_class",
    "attorney_name", "attorney_slug",
    "source_file", "fiscal_year",
    "worksite_city", "naics",
    # LCA only; NULL on every wage-request row. See PROGRAMS["lca"].
    "workers", *LCA_COUNT_COLUMNS, "wage_level", "h1b_dependent", "willful_violator",
    # The seasonal programs only (H-2A, H-2B, CW-1); NULL elsewhere. `workers`
    # above holds their requested count.
    "workers_certified", "begin_date", "end_date", "worksite_county",
)
INTEGER_COLUMNS = frozenset({"fiscal_year", "workers", *LCA_COUNT_COLUMNS, "h1b_dependent",
                             "willful_violator", "workers_certified"})

ROWS_PER_STMT = 500
STMTS_PER_REQUEST = 4
# Idle between write requests. While a large load ran unpaced, an ordinary
# GROUP BY on another table went from ~0.3 s to as much as 59 s, which starves
# the live site; a load is a background chore and the site isn't. 2,000 rows a
# request at 0.35 s idle adds ~26 s per 147k rows.
WRITE_PAUSE_S = 0.35
# A history file (any file but DOL's newest) is loaded at a gentler pace. On
# Oct 3 2026 back-to-back history quarters made the database compact its log
# continuously until its writes stalled for 38 minutes and the site served its
# busy page. History is never urgent, and the live site always is.
HISTORY_PAUSE_S = 2.0
# Names and titles are truncated exactly as the PERM corpus truncates them,
# so an employer string here matches the one the entity tables were built on.
NAME_LEN = 80
SOC_LEN = 10
FRESHNESS_MAX_AGE_DAYS = 120


def table_ddl(table: str) -> list[str]:
    """The CREATE TABLE only.

    SPLIT FROM THE INDEXES ON PURPOSE. `ensure_columns` has to run between the
    two: an index naming a column the live table has not got is a hard error,
    and the first dispatch of the attorney backfill died on exactly that -
    `no such column: attorney_slug` - because the index statements ran before
    the ALTER that adds it. Table, then columns, then indexes.
    """
    return [
        f"""CREATE TABLE IF NOT EXISTS {table} (
             case_number     TEXT PRIMARY KEY,
             case_status     TEXT,
             received_date   TEXT,
             decision_date   TEXT,
             employer_name   TEXT,
             employer_slug   TEXT,
             job_title       TEXT,
             soc_code        TEXT,
             soc_title       TEXT,
             wage            REAL,
             wage_unit       TEXT,
             worksite_state  TEXT,
             visa_class      TEXT,
             attorney_name   TEXT,
             attorney_slug   TEXT,
             source_file     TEXT,
             fiscal_year     INTEGER,
             worksite_city   TEXT,
             naics           TEXT,
             workers                    INTEGER,
             new_employment             INTEGER,
             continued_employment       INTEGER,
             change_previous_employment INTEGER,
             new_concurrent_employment  INTEGER,
             change_employer            INTEGER,
             amended_petition           INTEGER,
             wage_level                 TEXT,
             h1b_dependent              INTEGER,
             willful_violator           INTEGER,
             workers_certified          INTEGER,
             begin_date                 TEXT,
             end_date                   TEXT,
             worksite_county            TEXT)""",
    ]


def index_ddl(table: str) -> list[str]:
    """Every index, applied AFTER `ensure_columns`."""
    return [
        # The employer searches are a PREFIX RANGE on employer_slug, so rows
        # come out slug-ordered and SQLite must sort them to honour
        # `ORDER BY received_date DESC`. That temp B-tree is inherent to a
        # prefix search and cannot be indexed away: adding case_number as a
        # third column was tried and measured, and the plan did not change.
        # It is bounded by one employer's filings, which is the point - the
        # read never touches rows belonging to anybody else.
        f"CREATE INDEX IF NOT EXISTS {table}_emp ON {table} (employer_slug, received_date)",
        f"CREATE INDEX IF NOT EXISTS {table}_decided ON {table} (decision_date)",
        # The unified search's law-firm lead, the same shape as perm_cases'
        # `idx_pc_att_dec` and `idx_pc_att_st_dec`.
        f"CREATE INDEX IF NOT EXISTS {table}_att_dec ON {table} (attorney_slug, decision_date)",
        f"CREATE INDEX IF NOT EXISTS {table}_att_st_dec ON {table} (attorney_slug, case_status, decision_date)",
        # The unified search's state and occupation leads. Without these a
        # rare state or occupation scans the whole table through `_decided`
        # (wage requests in Wyoming read 229,555 rows for a 100-row page; with
        # them, 305).
        #
        # Four rather than two, because a three-column index cannot supply
        # `ORDER BY decision_date DESC` unless the status is an equality, and a
        # two-column one cannot seek the status. The `_st_` pair is used only
        # when the outcome bucket is a SINGLE status; a multi-status bucket
        # rides the plain index and filters, which measured cheaper (0.57 s for
        # California's three-status withdrawn bucket on `lca_cases`).
        #
        # The SOC indexes are on an expression because the programs spell the
        # occupation differently: `pwd_cases` holds ZERO dotted codes out of
        # 634,638 while `lca_cases` holds 434,314 of them. The 6-digit group is
        # the only key the files share, and SQLite serves a filter on an
        # expression only from an index on the same expression - so this text
        # and `SOC_GROUP_EXPR` in `src/lib/turso/caseSearchReads.ts` are one
        # fact written twice.
        f"CREATE INDEX IF NOT EXISTS {table}_state_dec ON {table} (worksite_state, decision_date)",
        f"CREATE INDEX IF NOT EXISTS {table}_state_st_dec ON {table} (worksite_state, case_status, decision_date)",
        f"CREATE INDEX IF NOT EXISTS {table}_soc_dec ON {table} (substr(soc_code, 1, 7), decision_date)",
        f"CREATE INDEX IF NOT EXISTS {table}_soc_st_dec ON {table} (substr(soc_code, 1, 7), case_status, decision_date)",
    ]


# ---------------------------------------------------------------------------
# Discovery
# ---------------------------------------------------------------------------

def file_sort_key(name: str) -> tuple:
    """Newest-last: (fiscal year, quarter, form generation).

    A file with no quarter covers the whole year and sorts after that year's
    quarters. DOL published FY2021-FY2023 PW data as an `_old_form` and a
    `_revised_form` pair that tie on year and quarter; the revised form is the
    one DOL currently uses, so it sorts later and wins.
    """
    q = re.search(r"Q(\d)", name, re.I)
    quarter = int(q.group(1)) if q else 9
    generation = 1 if re.search(r"revised_form|New_Form", name, re.I) else 0
    return (file_fiscal_year(name), quarter, generation)


def names_for_year(names, fy: int) -> list[str]:
    """The disclosure files for one fiscal year, in DOL's naming. Pure."""
    return [n for n in names if file_fiscal_year(n) == fy]


def pick_latest(names) -> str:
    """The newest disclosure filename. Pure, so it is testable without DOL."""
    names = list(names)
    if not names:
        raise SystemExit("FATAL: no disclosure filenames to choose from.")
    return max(names, key=file_sort_key)


def normalise_url(url: str) -> str:
    """Collapse the `https://www.dol.gov//media/...` double slash DOL serves."""
    scheme, sep, rest = url.partition("://")
    return scheme + sep + re.sub(r"/{2,}", "/", rest)


def discover_latest(cfg: dict, fy: int | None = None) -> tuple[str, str]:
    """Return (filename, absolute_url) of the newest file for this program.

    With `fy`, the newest file OF THAT FISCAL YEAR (a completed year's Q4 file
    covers the whole year), so history can be loaded one year at a time.
    """
    log(f"Discovering {cfg['label']} disclosure files from {PERFORMANCE_PAGE}")
    html = fetch(PERFORMANCE_PAGE).decode("utf-8", "replace")
    found = discover_links(html, cfg["file_pattern"], HOST)
    if not found:
        raise SystemExit(
            f"FATAL: no {cfg['label']} disclosure links on DOL's performance "
            "page. The page layout changed or the fetch was blocked. Refusing "
            "to report success."
        )
    if fy is not None:
        wanted = names_for_year(found, fy)
        if not wanted:
            raise SystemExit(
                f"FATAL: DOL's page lists {len(found)} {cfg['label']} files and none "
                f"is FY{fy}: " + ", ".join(sorted(found)))
        found = {n: found[n] for n in wanted}
    name = pick_latest(found)
    url = normalise_url(found[name])
    log(f"  found {len(found)} files; newest is FY{file_fiscal_year(name)} {name}")
    log(f"  {url}")
    return name, url


def discover_all(cfg: dict, fy: int | None = None) -> list[tuple[str, str]]:
    """Every disclosure file DOL lists for this program, OLDEST FIRST.

    `discover_latest` answers "what is the current quarter", which is the right
    question for the monthly run and the wrong one for history. LCA files are
    per-QUARTER (measured 2026-09-13: FY2025_Q4 holds 118,580 rows covering
    2025-07-01 to 2025-09-30 alone), so `--fy` reaches exactly one quarter of
    each year and the rest are unreachable without this.

    Oldest first so a run that is cut short leaves the record contiguous from
    the back rather than full of holes, and so the next run continues rather
    than repeating.
    """
    log(f"Discovering {cfg['label']} disclosure files from {PERFORMANCE_PAGE}")
    html = fetch(PERFORMANCE_PAGE).decode("utf-8", "replace")
    found = discover_links(html, cfg["file_pattern"], HOST)
    if not found:
        raise SystemExit(
            f"FATAL: no {cfg['label']} disclosure links on DOL's performance "
            "page. The page layout changed or the fetch was blocked. Refusing "
            "to report success."
        )
    if fy is not None:
        wanted = names_for_year(found, fy)
        if not wanted:
            raise SystemExit(
                f"FATAL: DOL's page lists {len(found)} {cfg['label']} files and none "
                f"is FY{fy}: " + ", ".join(sorted(found)))
        found = {n: found[n] for n in wanted}
    names = sorted(found, key=file_sort_key)
    log(f"  found {len(names)} file(s): " + ", ".join(names))
    return [(n, normalise_url(found[n])) for n in names]


def download(url: str, dest: str, referer: str, attempts: int = 4) -> tuple[str, int]:
    """Stream `url` to `dest`, returning (sha256, bytes).

    Streamed rather than read into memory because the LCA file is several
    hundred MB. The hash is computed on the same pass so an unchanged file
    can be recognised without a second read. Backoff mirrors
    `lib_gov_data.fetch`: a bare or partial header set is refused outright,
    and sustained traffic from one address is refused even with the full set.
    A 403 that survives every attempt raises, and must: a run that could not
    read DOL is not a run that found no data.
    """
    headers = dict(BROWSER_HEADERS)
    headers["Referer"] = referer
    delay = 20
    for attempt in range(1, attempts + 1):
        try:
            req = urllib.request.Request(url, headers=headers)
            digest = hashlib.sha256()
            size = 0
            head = b""
            with urllib.request.urlopen(req, timeout=300) as resp, open(dest, "wb") as fh:
                while True:
                    chunk = resp.read(1 << 20)
                    if not chunk:
                        break
                    if not head:
                        head = chunk[:2]
                    digest.update(chunk)
                    fh.write(chunk)
                    size += len(chunk)
            if head != b"PK":
                raise SystemExit(
                    f"FATAL: {url} is not a workbook ({size:,} bytes). DOL served "
                    "an error page. Refusing to report success."
                )
            return digest.hexdigest(), size
        except urllib.error.HTTPError as exc:
            if exc.code not in (403, 429, 503) or attempt == attempts:
                raise
            log(f"  HTTP {exc.code} from DOL (attempt {attempt}/{attempts}); waiting {delay}s")
            time.sleep(delay)
            delay *= 3
    raise SystemExit("unreachable")


def sha256_of(path: str) -> str:
    digest = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


# ---------------------------------------------------------------------------
# Parsing
# ---------------------------------------------------------------------------

def first_sheet(archive: zipfile.ZipFile) -> str:
    """The workbook's first worksheet part. DOL's files carry exactly one."""
    sheets = [n for n in archive.namelist() if re.match(r"xl/worksheets/sheet\d+\.xml$", n)]
    if not sheets:
        raise SystemExit("FATAL: the workbook has no worksheet part.")
    return min(sheets, key=lambda n: int(re.search(r"(\d+)\.xml$", n).group(1)))


def clean_text(raw: str | None, limit: int) -> str | None:
    """Whitespace-collapsed, truncated, and NULL rather than an empty string."""
    text = " ".join((raw or "").split())[:limit]
    return text or None


def parse_wage(raw: str | None) -> float | None:
    """`$145,600.00` -> 145600.0; anything unreadable -> None, never 0."""
    text = (raw or "").replace("$", "").replace(",", "").strip()
    if not text:
        return None
    try:
        value = float(text)
    except ValueError:
        return None
    return value if value >= 0 else None


def parse_state(raw: str | None) -> str | None:
    """A two-letter code, a full name mapped to its code, or None. Never a prefix guess."""
    text = (raw or "").strip().upper()
    if text in US_STATES:
        return text
    return STATE_NAMES.get(text)


def parse_count(raw: str | None) -> int | None:
    """A worker count: `3` -> 3, `0` -> 0, blank or unreadable -> None.

    `3.0` (a number cell written as a float) reads as 3. A negative or
    fractional count is not a count and reads as None, never 0.
    """
    text = (raw or "").replace(",", "").strip()
    if not text:
        return None
    try:
        value = float(text)
    except ValueError:
        return None
    if value < 0 or value != int(value):
        return None
    return int(value)


WAGE_LEVELS = ("I", "II", "III", "IV")


def parse_wage_level(raw: str | None) -> str | None:
    """`I` to `IV` as DOL prints them; `N/A`, blank and anything else -> None.

    Arabic numerals are accepted as the same levels, in case a file writes
    `1` to `4`; nothing else is guessed.
    """
    text = (raw or "").strip().upper().replace("LEVEL", "").strip()
    if text in WAGE_LEVELS:
        return text
    return {"1": "I", "2": "II", "3": "III", "4": "IV"}.get(text)


def parse_flag(raw: str | None) -> int | None:
    """`Y` -> 1, `N` -> 0, anything else (blank, N/A) -> None."""
    text = (raw or "").strip().upper()
    if text in ("Y", "YES"):
        return 1
    if text in ("N", "NO"):
        return 0
    return None


def resolve_columns(header_cells: dict[int, str], cfg: dict, filename: str) -> tuple[dict[int, str], dict[int, int]]:
    """Map sheet column index -> field name, and index -> event-date slot.

    Fails on the required fields rather than degrading: a file whose case
    number or status column did not resolve is a mapping failure, and a
    mapping failure that degrades to NULLs looks exactly like a good run.
    """
    header = {v.strip().upper(): idx for idx, v in header_cells.items() if v and v.strip()}
    colmap: dict[int, str] = {}
    for field, names in cfg["columns"].items():
        for name in names:
            if name in header:
                colmap[header[name]] = field
                break
    events: dict[int, int] = {}
    for slot, names in enumerate(cfg["event_dates"]):
        for name in names:
            if name in header:
                events[header[name]] = slot
                break

    resolved = set(colmap.values())
    missing = [f for f in REQUIRED_FIELDS if f not in resolved]
    if missing:
        raise SystemExit(
            f"FATAL: {filename} header resolves none of {missing} for program "
            f"'{cfg['table']}'. Wrong --program, or DOL renamed a column. "
            f"Header was: {sorted(header)[:40]}"
        )
    absent = [f for f in cfg["columns"] if f not in resolved]
    if absent:
        log(f"    (no column for {absent}; those land as NULL)")
    return colmap, events


def normalise_row(rec: dict[str, str], events: list[str | None], source_file: str, fy: int,
                  visa_default: str | None = None) -> dict | None:
    """One DOL row -> one table row, or None when there is no case number."""
    case_no = (rec.get("case") or "").strip()
    if not case_no:
        return None
    dates = [to_iso((rec.get("decision") or "").strip())]
    dates.extend(to_iso((d or "").strip()) for d in events)
    dated = [d for d in dates if d]
    decided = max(dated) if dated else None
    employer = clean_text(rec.get("employer"), NAME_LEN)
    status = clean_text(rec.get("status"), NAME_LEN)
    unit = clean_text(rec.get("wage_unit"), 20)
    # A fiscal year the filename did not declare (a local probe file) falls
    # back to the decision date's; a row with neither carries NULL.
    year: int | None = fy or (int(fiscal_year(decided)) if decided else None)
    firm = clean_text(rec.get("attorney"), NAME_LEN)
    return {
        "case_number": case_no,
        "case_status": status.upper() if status else None,
        "received_date": to_iso((rec.get("received") or "").strip()),
        "decision_date": decided,
        "employer_name": employer,
        "employer_slug": slugify(employer) if employer else None,
        "job_title": clean_text(rec.get("job_title"), NAME_LEN),
        "soc_code": clean_text(rec.get("soc_code"), SOC_LEN),
        "soc_title": clean_text(rec.get("soc_title"), NAME_LEN),
        "wage": parse_wage(rec.get("wage")),
        "wage_unit": unit.upper() if unit else None,
        "worksite_state": parse_state(rec.get("state")),
        # The seasonal files carry no VISA_CLASS column; their program names it.
        "visa_class": clean_text(rec.get("visa"), 40) or visa_default,
        "attorney_name": firm,
        # THE SAME SLUG FUNCTION THE PERM INGEST AND THE READ LAYER USE. A firm
        # slugged differently here would be a law firm whose wage requests
        # cannot be found from its own page.
        "attorney_slug": slugify(firm) if firm else None,
        "source_file": source_file,
        "fiscal_year": year,
        "worksite_city": clean_text(rec.get("city"), 60),
        "naics": normalize_naics(rec.get("naics")),
        # LCA only (the wage-request map names none of these, so they are None).
        "workers": parse_count(rec.get("workers")),
        **{c: parse_count(rec.get(c)) for c in LCA_COUNT_COLUMNS},
        "wage_level": parse_wage_level(rec.get("wage_level")),
        "h1b_dependent": parse_flag(rec.get("h1b_dependent")),
        "willful_violator": parse_flag(rec.get("willful_violator")),
        # The seasonal programs only (the PW and LCA maps name none of these).
        "workers_certified": parse_count(rec.get("workers_certified")),
        "begin_date": to_iso((rec.get("begin_date") or "").strip()),
        "end_date": to_iso((rec.get("end_date") or "").strip()),
        "worksite_county": clean_text(rec.get("county"), 60),
    }


class ParseStats:
    """Counts kept in the same pass that yields the rows, so they cannot disagree."""

    def __init__(self) -> None:
        self.sheet_rows = 0
        self.kept = 0
        self.duplicates = 0
        self.blank_case = 0
        self.no_received = 0
        self.no_decision = 0
        self.wage_parsed = 0
        self.state_known = 0
        self.by_status: Counter = Counter()
        self.first_received = ""
        self.last_received = ""
        self.first_decided = ""
        self.last_decided = ""
        self.resolved: list[str] = []

    def see(self, row: dict) -> None:
        self.kept += 1
        self.by_status[row["case_status"] or "(none)"] += 1
        if row["wage"] is not None:
            self.wage_parsed += 1
        if row["worksite_state"]:
            self.state_known += 1
        r, d = row["received_date"], row["decision_date"]
        if r:
            self.first_received = min(self.first_received or r, r)
            self.last_received = max(self.last_received, r)
        else:
            self.no_received += 1
        if d:
            self.first_decided = min(self.first_decided or d, d)
            self.last_decided = max(self.last_decided, d)
        else:
            self.no_decision += 1

    def report(self) -> None:
        log(f"sheet rows        {self.sheet_rows:,}")
        log(f"cases parsed      {self.kept:,}")
        log(f"  duplicates      {self.duplicates:,}")
        log(f"  blank case      {self.blank_case:,}")
        log(f"  no received     {self.no_received:,}")
        log(f"  no decision     {self.no_decision:,}")
        log(f"  by status       {dict(self.by_status.most_common(8))}")
        log(f"  received        {self.first_received or '-'} .. {self.last_received or '-'}")
        log(f"  decided         {self.first_decided or '-'} .. {self.last_decided or '-'}")
        log(f"  wage parsed     {self.wage_parsed:,} of {self.kept:,}")
        log(f"  state known     {self.state_known:,} of {self.kept:,}")


def iter_cases(path: str, cfg: dict, stats: ParseStats, dump_header: bool = False):
    """Stream one workbook, yielding one normalised row per unique case.

    The first row is the header; every column is resolved from it by name.
    Within a file the first occurrence of a case number wins and later ones
    are counted as duplicates, so the reconcile count is of UNIQUE cases.
    """
    filename = os.path.basename(path)
    fy = file_fiscal_year(filename)
    archive = zipfile.ZipFile(path)
    shared = read_shared_strings(archive)
    sheet = first_sheet(archive)
    colmap: dict[int, str] = {}
    events: dict[int, int] = {}
    seen: set[str] = set()
    for cells in iter_rows(archive, sheet, shared):
        if not colmap:
            colmap, events = resolve_columns(cells, cfg, filename)
            stats.resolved = sorted(colmap.values())
            if dump_header:
                # The primary source for what a column is really called.
                log(f"    resolved: {sorted((f, i) for i, f in colmap.items())}")
                log(f"    event dates: {sorted((s, i) for i, s in events.items())}")
                header = sorted(v.strip().upper() for v in cells.values() if v and v.strip())
                log(f"    all {len(header)} header names:")
                for name in header:
                    log(f"      {name}")
                return
            continue
        stats.sheet_rows += 1
        rec = {colmap[i]: v for i, v in cells.items() if i in colmap}
        slots: list[str | None] = [None] * len(cfg["event_dates"])
        for i, slot in events.items():
            if i in cells:
                slots[slot] = cells[i]
        row = normalise_row(rec, slots, filename, fy, cfg.get("visa_default"))
        if row is None:
            stats.blank_case += 1
            continue
        if row["case_number"] in seen:
            stats.duplicates += 1
            continue
        seen.add(row["case_number"])
        stats.see(row)
        yield row


# ---------------------------------------------------------------------------
# Writing
# ---------------------------------------------------------------------------

def load_record_key(program: str, name: str | None = None) -> str:
    """One record per FILE, so a year loaded with --fy never masquerades as
    the latest quarter's load. The bare per-program key predates --fy and is
    read as a fallback so the FY2026 file is not reloaded once for nothing."""
    return f"flag_disclosure_{program}" + (f":{name}" if name else "")



def read_load_record(db: Turso, program: str, name: str) -> dict | None:
    db.execute("""CREATE TABLE IF NOT EXISTS perm_docs (
        key TEXT PRIMARY KEY, json TEXT NOT NULL, computed_at INTEGER)""")
    rec = read_doc(db, load_record_key(program, name))
    if rec:
        return rec
    legacy = read_doc(db, load_record_key(program))
    return legacy if legacy and legacy.get("file") == name else None


def write_load_record(db: Turso, program: str, record: dict, *, latest: bool) -> None:
    keys = [load_record_key(program, record["file"])]
    if latest:
        keys.append(load_record_key(program))
    for key in keys:
        write_doc(db, key, record)


def summary_key(program: str) -> str:
    return f"flag_disclosure_summary_{program}"


def write_summary_doc(db: Turso, program: str, table: str) -> dict:
    """What the web reads instead of counting the table on every render:
    rows, the span of dates, and the files behind them. Two scans, once per
    load, against a table nothing else counts."""
    rows, earliest, latest = query_rows(
        db, f"SELECT count(*), min(received_date), max(decision_date) FROM {table}")[0]
    files = {f: int(n) for f, n in query_rows(
        db, f"SELECT source_file, count(*) FROM {table} GROUP BY source_file ORDER BY source_file")}
    doc = {
        "rows": int(rows or 0),
        "earliestReceived": earliest,
        "latestDecision": latest,
        "files": files,
    }
    write_doc(db, summary_key(program), doc)
    log(f"  summary   {doc['rows']:,} rows, received from {doc['earliestReceived']}, "
        f"decided through {doc['latestDecision']}, {len(files)} file(s)")
    return doc


def ensure_columns(db: Turso, table: str) -> None:
    """Add any column in `COLUMNS` the live table is missing.

    A full reload is the other way to gain a column, and it isn't affordable:
    every row rewritten costs a write per index too. An ALTER is metadata
    only, and a backfill then writes each row once.
    """
    types = {c: "REAL" if c == "wage" else "INTEGER" if c in INTEGER_COLUMNS else "TEXT"
             for c in COLUMNS}
    for col in add_missing_columns(db, table, types):
        log(f"  added missing column {table}.{col} {types[col]}")


def count_for_file(db: Turso, table: str, source_file: str) -> int:
    return int(db.scalar(f"SELECT count(*) FROM {table} WHERE source_file = ?", [source_file]) or 0)


# Rows per backfill UPDATE: two parameters per column plus one per row, so
# the eleven LCA detail columns make 4,600 parameters.
BACKFILL_ROWS_PER_STMT = 200
BACKFILL_STMTS_PER_REQUEST = 8


# The column groups a narrow backfill can write, by the flag that asks for it.
BACKFILL_GROUPS: dict[str, tuple[str, ...]] = {
    "attorney": ("attorney_name", "attorney_slug"),
    "place": ("worksite_city", "naics"),
    # LCA only: the worker counts by kind, the wage level and the two flags.
    "lca-detail": ("workers", *LCA_COUNT_COLUMNS, "wage_level", "h1b_dependent", "willful_violator"),
}


def backfill_attorney(db: Turso, table: str, rows, pause: float = WRITE_PAUSE_S) -> int:
    """The law-firm backfill (kept by name; the workflow and its log use it)."""
    return backfill_columns(db, table, rows, BACKFILL_GROUPS["attorney"], pause)


def backfill_columns(db: Turso, table: str, rows, cols: tuple[str, ...],
                     pause: float = WRITE_PAUSE_S) -> int:
    """Write only `cols` onto rows that already exist.

    An INSERT OR REPLACE deletes and reinserts, rewriting every index for every
    row; an UPDATE rewrites the row and only the indexes holding these
    columns, which for a new column is none.

    A case in the file that isn't in the table is left alone: this fills rows
    the ordinary load already wrote, and a new case arrives through that load
    with every column on it.
    """
    pending: list[dict] = []
    batch: list[dict] = []
    seen = 0
    t0 = time.time()

    def flush_stmt() -> None:
        nonlocal batch
        if not batch:
            return
        pending.append(case_update(table, "case_number", cols,
                                   [(r["case_number"], *(r[c] for c in cols)) for r in batch]))
        batch = []

    def flush_request() -> None:
        nonlocal pending
        if not pending:
            return
        db.pipeline(pending + [{"type": "close"}])
        pending = []
        if pause > 0:
            time.sleep(pause)

    for row in rows:
        batch.append(row)
        seen += 1
        if len(batch) >= BACKFILL_ROWS_PER_STMT:
            flush_stmt()
        if len(pending) >= BACKFILL_STMTS_PER_REQUEST:
            flush_request()
            if seen % 50_000 < BACKFILL_ROWS_PER_STMT * BACKFILL_STMTS_PER_REQUEST:
                rate = seen / max(1e-9, time.time() - t0)
                log(f"  {seen:,} rows in {time.time() - t0:,.0f}s ({rate:,.0f}/s)")
    flush_stmt()
    flush_request()
    log(f"  backfilled {seen:,} rows in {time.time() - t0:,.0f}s")
    return seen


def write_cases(db: Turso, table: str, rows, pause: float = WRITE_PAUSE_S) -> int:
    """INSERT OR REPLACE, ROWS_PER_STMT rows a statement and STMTS_PER_REQUEST
    statements a request, idling `pause` seconds between requests."""
    placeholders = "(" + ",".join("?" * len(COLUMNS)) + ")"
    head = f"INSERT OR REPLACE INTO {table} ({','.join(COLUMNS)}) VALUES "
    pending: list[dict] = []
    batch: list[dict] = []
    sent = 0
    t0 = time.time()

    def flush_stmt() -> None:
        nonlocal batch
        if not batch:
            return
        pending.append(stmt(head + ",".join([placeholders] * len(batch)),
                            [row[c] for row in batch for c in COLUMNS]))
        batch = []

    def flush_request() -> None:
        nonlocal pending
        if not pending:
            return
        db.pipeline(pending + [{"type": "close"}])
        pending = []
        if pause > 0:
            time.sleep(pause)

    for row in rows:
        batch.append(row)
        sent += 1
        if len(batch) >= ROWS_PER_STMT:
            flush_stmt()
            if len(pending) >= STMTS_PER_REQUEST:
                flush_request()
                if sent % 50_000 < ROWS_PER_STMT * STMTS_PER_REQUEST:
                    rate = sent / max(time.time() - t0, 0.001)
                    log(f"    {sent:>9,} rows  ({rate:,.0f}/s)")
    flush_stmt()
    flush_request()
    log(f"  wrote {sent:,} rows in {time.time() - t0:,.0f}s")
    return sent


# ---------------------------------------------------------------------------

def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--program", required=True, choices=sorted(PROGRAMS),
                    help="Which disclosure file: pw (ETA-9141), lca (ETA-9035), h2a (ETA-9142A), "
                         "h2b (ETA-9142B) or cw1 (ETA-9142C).")
    ap.add_argument("--file", help="Parse this local workbook instead of downloading.")
    ap.add_argument("--dry-run", action="store_true",
                    help="Parse and print counts; never open Turso, never write.")
    ap.add_argument("--dump-rows", type=int, default=0, metavar="N",
                    help="With --dry-run: print the first N parsed rows as `ROW <json>` lines.")
    ap.add_argument("--dump-header", action="store_true",
                    help="Print the file's resolved and raw column names, then stop.")
    ap.add_argument("--force", action="store_true",
                    help="Write even when the file's hash matches the last load.")
    ap.add_argument("--pause", type=float, default=None, metavar="SECONDS",
                    help="Idle between write requests so a load cannot starve the live site "
                         f"(default {WRITE_PAUSE_S} for DOL's newest file, {HISTORY_PAUSE_S} for history; "
                         "0 disables).")
    ap.add_argument("--backfill-attorney", action="store_true",
                    help="Write ONLY the law-firm columns onto rows that already "
                         "exist, then create their indexes. Ten times cheaper "
                         "than a --force reload and the only affordable way to "
                         "add a column to these tables.")
    ap.add_argument("--backfill-place", action="store_true",
                    help="Write ONLY the worksite city and NAICS columns onto rows "
                         "that already exist (one write per row). Neither column is "
                         "indexed: both are narrowing filters, not search leads.")
    ap.add_argument("--backfill-lca-detail", action="store_true",
                    help="LCA only: write ONLY the worker counts (new, continuing, change "
                         "of employer and the rest), the wage level and the H-1B-dependent "
                         "and willful-violator flags onto rows that already exist. One "
                         "write per row; none of the ten columns is indexed.")
    ap.add_argument("--accept-drift", action="store_true",
                    help="Load despite the fingerprint differing from the previous load "
                         "(a lost column, a blank-share jump, a moved median). For a "
                         "human who has read the --dry-run output and agrees DOL really "
                         "changed the file. Never overrides impossible values.")
    ap.add_argument("--name", metavar="FILENAME",
                    help="Load this specific discovered file (LCA files are "
                         "per-quarter, so --fy reaches only one of each year).")
    ap.add_argument("--list", action="store_true",
                    help="List every disclosure file DOL publishes and exit.")
    ap.add_argument("--fy", type=int, metavar="YYYY",
                    help="Load that fiscal year's newest file instead of the newest overall "
                         "(history, one year per run).")
    args = ap.parse_args()
    if args.dump_rows and not args.dry_run:
        ap.error("--dump-rows only makes sense with --dry-run")

    cfg = PROGRAMS[args.program]
    table = cfg["table"]
    if args.list:
        # Discovery only: no credentials, no download, no writes. This is how
        # you find out what quarters exist before deciding to load them.
        for n, u in discover_all(PROGRAMS[args.program], args.fy):
            print(f"{n}\t{u}")
        return 0

    script = f"ingest_flag_disclosure.py --program {args.program}" + (f" --fy {args.fy}" if args.fy else "")
    started = time.time()

    with tempfile.TemporaryDirectory() as tmp:
        newest_name: str | None = None
        needs_lookup = False
        if args.file:
            path = args.file
            name = os.path.basename(path)
            sha = sha256_of(path)
            log(f"Using local file {name} ({os.path.getsize(path) / 1e6:.1f} MB)")
            # Deliberately NOT discovered here. A local file has no listing of
            # its own, so answering "is this the newest" needs a request to
            # www.dol.gov - and `--file` is also the path `--dry-run` uses,
            # where nothing is written and the question does not arise. Asking
            # eagerly made the offline parser tests spawn a real network call
            # and time out at 120 s. It is asked lazily below, once, only if a
            # write is actually about to happen.
            needs_lookup = True
        elif args.name:
            # A SPECIFIC quarter, discovered rather than constructed. LCA files
            # are per-quarter, so `--fy` reaches one of each year and every
            # earlier quarter needs naming. The URL still comes from DOL's own
            # page - building it by hand is how a hardcoded path turns a moved
            # file into a styled 404 that reads like a dead link.
            byname = dict(discover_all(cfg, args.fy))
            # A year-less listing is EVERY file DOL lists, so the newest is
            # already in hand. ONE EXTRA REQUEST TO www.dol.gov IS NOT FREE -
            # that host 403s sustained traffic and this branch is about to
            # download a file from it.
            if args.fy is None:
                newest_name = pick_latest(list(byname))
            if args.name not in byname:
                raise SystemExit(
                    f"FATAL: DOL's page does not list {args.name}. It lists: "
                    + ", ".join(sorted(byname)))
            name, url = args.name, byname[args.name]
            path = os.path.join(tmp, name)
            log(f"Downloading {name}")
            sha, size = download(url, path, referer=PERFORMANCE_PAGE)
            log(f"  {size / 1e6:.1f} MB  sha256 {sha[:16]}")
        else:
            name, url = discover_latest(cfg, args.fy)
            # With no --fy this IS DOL's newest, by definition of the call.
            if args.fy is None:
                newest_name = name
            path = os.path.join(tmp, name)
            log(f"Downloading {name}")
            sha, size = download(url, path, referer=PERFORMANCE_PAGE)
            log(f"  {size / 1e6:.1f} MB  sha256 {sha[:16]}")

        # Is this the newest file DOL publishes? Only that file may stamp
        # freshness or move the "latest quarter" pointer; anything else is
        # history, however it was chosen (`--fy` or `--name`), and stamping
        # with an old quarter's dates would report a live source as stopped.
        # An unknown newest counts as history: declining to stamp keeps the
        # last good value, while a wrong stamp destroys it.
        #
        # Resolved lazily and at most once. The `--file` branch is the only one
        # that would need a network request for the answer, and it is also the
        # dry-run path, where nothing is written and the answer is never used.
        newest_cache: list = []

        def file_is_newest() -> bool:
            if newest_cache:
                return newest_cache[0]
            found = newest_name
            if found is None and needs_lookup:
                try:
                    found, _ = discover_latest(cfg)
                except Exception as e:  # noqa: BLE001
                    log(f"  could not determine DOL's newest file ({e})")
            verdict = found is not None and name == found
            if not verdict:
                log(f"  {name} is not DOL's newest file"
                    + (f" ({found})" if found else " (newest unknown)")
                    + "; freshness stays on the newest quarter")
            newest_cache.append(verdict)
            return verdict

        def write_pause() -> float:
            """The pause given, or the default for this file: newest or history."""
            if args.pause is not None:
                return args.pause
            return WRITE_PAUSE_S if file_is_newest() else HISTORY_PAUSE_S

        stats = ParseStats()
        if args.dump_header:
            for _ in iter_cases(path, cfg, stats, dump_header=True):
                pass
            return 0

        if args.dry_run:
            shown = 0
            guard = Fingerprint()
            for row in iter_cases(path, cfg, stats):
                guard.see(row)
                if shown < args.dump_rows:
                    print("ROW " + json.dumps(row, sort_keys=True, separators=(",", ":")), flush=True)
                    shown += 1
            guard.resolved = stats.resolved
            fp = guard.to_doc()
            log("")
            log(f"file              {name}")
            log(f"fiscal year       {file_fiscal_year(name) or '(not in filename)'}")
            log(f"resolved          {stats.resolved}")
            stats.report()
            log(f"guard blank share {fp['blankShare']}")
            log(f"guard median wage {fp['wageMedian']}")
            log(f"guard impossible  {fp['badShare']:.2%} {fp['bad']}")
            for finding in sanity_findings(fp):
                log(f"guard SANITY      {finding}")
            log("DRY RUN: nothing written")
            return 0

        # Everything below touches the database: after the two probe modes,
        # so those run with no credentials.
        db = Turso()
        prior = read_load_record(db, args.program, name)
        # BEFORE THE HASH CHECK, because a backfill is not a load. The file
        # is unchanged by definition - that is the whole point, the rows are
        # already there and only two columns are missing - so leaving this
        # after the sha-match branch meant it returned "unchanged; skipping"
        # and never ran. Caught by dispatching it once rather than by reading
        # the flow.
        if args.backfill_lca_detail:
            if args.program != "lca" or args.backfill_attorney or args.backfill_place or args.force:
                raise SystemExit("FATAL: --backfill-lca-detail runs alone, on --program lca")
            log(f"Backfilling LCA worker counts, wage level and flags onto {table} from {name}")
            existing = int(db.scalar(f"SELECT count(*) FROM {table}") or 0)
            if existing == 0:
                raise SystemExit(
                    f"FATAL: {table} holds no rows, so there is nothing to "
                    "backfill onto. Run the ordinary load first.")
            ensure_columns(db, table)
            n = backfill_columns(db, table, iter_cases(path, cfg, stats),
                                 BACKFILL_GROUPS["lca-detail"], pause=write_pause())
            stats.report()
            filled = int(db.scalar(
                f"SELECT count(*) FROM {table} WHERE source_file = ? AND workers IS NOT NULL",
                [name]) or 0)
            log(f"  {table}: {filled:,} of {n:,} rows from {name} now carry worker counts")
            record_run(db, script, status="ok", rows_written=n,
                       note=f"LCA detail backfill from {name}: {filled:,}/{n:,} with counts",
                       started_at=started)
            return 0

        if args.backfill_place:
            if args.backfill_attorney or args.force:
                raise SystemExit("FATAL: --backfill-place runs alone, without --force "
                                 "or --backfill-attorney")
            log(f"Backfilling worksite city and NAICS onto {table} from {name}")
            existing = int(db.scalar(f"SELECT count(*) FROM {table}") or 0)
            if existing == 0:
                raise SystemExit(
                    f"FATAL: {table} holds no rows, so there is nothing to "
                    "backfill onto. Run the ordinary load first.")
            ensure_columns(db, table)
            n = backfill_columns(db, table, iter_cases(path, cfg, stats),
                                 BACKFILL_GROUPS["place"], pause=write_pause())
            stats.report()
            filled = int(db.scalar(
                f"SELECT count(*) FROM {table} WHERE source_file = ? AND naics IS NOT NULL",
                [name]) or 0)
            log(f"  {table}: {filled:,} of {n:,} rows from {name} now carry an industry code")
            record_run(db, script, status="ok", rows_written=n,
                       note=f"city and NAICS backfill from {name}: {filled:,}/{n:,} with NAICS",
                       started_at=started)
            return 0

        if args.backfill_attorney:
            # THE INDEXES ARE CREATED AFTER, DELIBERATELY. An UPDATE rewrites
            # the table row plus every index containing a changed column, so
            # creating `<table>_att_dec` first would put both attorney indexes
            # in the path of all 1.07M updates and undo the saving this mode
            # exists for. Building them once at the end is a single pass.
            log(f"Backfilling the law firm onto {table} from {name}")
            # A backfill only ever writes onto rows the ordinary load already
            # wrote. Against an empty or missing table every UPDATE would match
            # nothing and the run would report success having done nothing,
            # which is the failure mode this whole script is built to refuse.
            existing = int(db.scalar(f"SELECT count(*) FROM {table}") or 0)
            if existing == 0:
                raise SystemExit(
                    f"FATAL: {table} holds no rows, so there is nothing to "
                    "backfill onto. Run the ordinary load first.")
            ensure_columns(db, table)
            n = backfill_attorney(db, table, iter_cases(path, cfg, stats),
                                  pause=write_pause())
            stats.report()
            filled = int(db.scalar(
                f"SELECT count(*) FROM {table} WHERE attorney_slug IS NOT NULL") or 0)
            total = int(db.scalar(f"SELECT count(*) FROM {table}") or 0)
            pct = (100.0 * filled / total) if total else 0.0
            log(f"  {table}: {filled:,} of {total:,} rows now carry a firm ({pct:.1f}%)")
            log("  creating the firm indexes")
            db.script([
                f"CREATE INDEX IF NOT EXISTS {table}_att_dec ON {table} (attorney_slug, decision_date)",
                f"CREATE INDEX IF NOT EXISTS {table}_att_st_dec ON {table} (attorney_slug, case_status, decision_date)",
            ])
            record_run(db, script, status="ok", rows_written=n,
                       note=f"attorney backfill from {name}: {filled:,}/{total:,} filled",
                       started_at=started)
            return 0

        if prior and prior.get("sha256") == sha and not args.force:
            # Table, then columns, then indexes. An index naming a column the
            # live table has not got is a hard error.
            db.script(table_ddl(table))
            ensure_columns(db, table)
            db.script(index_ddl(table))
            have = count_for_file(db, table, name)
            if have == int(prior.get("rows") or -1):
                log(f"{name} unchanged since {prior.get('loadedAt')} (sha256 match, "
                    f"{have:,} rows still present); skipping the write")
                write_summary_doc(db, args.program, table)
                if not file_is_newest():
                    record_run(db, script, status="ok", rows_written=0,
                               note=f"{name} unchanged (sha256 match, history)",
                               started_at=started)
                    return 0
                stamp_freshness(db, cfg["freshness"], as_of=prior.get("asOf"),
                                source=cfg["source"], cadence="Quarterly",
                                note=f"{have:,} cases, {name} (unchanged)",
                                max_age_days=FRESHNESS_MAX_AGE_DAYS)
                record_run(db, script, status="ok", rows_written=0,
                           note=f"{name} unchanged (sha256 match)", started_at=started)
                return 0
            log(f"  {name} hash matches the last load but the table holds {have:,} of "
                f"{int(prior.get('rows') or 0):,} rows; reloading")

        # THE GUARD PASS, BEFORE ANY WRITE. One extra parse of the workbook
        # (about a minute for 150k rows) buys a refusal that leaves nothing
        # behind: a column DOL renamed, a blank share that jumped, a median
        # wage that moved by half, or rows whose values cannot be right. The
        # baseline is the previous load of this PROGRAM, whichever file it
        # was, because the shape of the file is what is being compared.
        guard = Fingerprint()
        pre = ParseStats()
        for row in iter_cases(path, cfg, pre):
            guard.see(row)
        guard.resolved = pre.resolved
        fingerprint = guard.to_doc()
        baseline = read_doc(db, load_record_key(args.program)) or {}
        findings = sanity_findings(fingerprint)
        drift = drift_findings(baseline.get("fingerprint"), fingerprint)
        log(f"  guard: {pre.kept:,} rows, impossible {fingerprint['badShare']:.2%}, "
            f"baseline {baseline.get('file') or 'none'}, "
            + (f"{len(drift)} drift finding(s)" if drift else "no drift"))
        for finding in drift:
            log(f"    DRIFT: {finding}")
        if drift and args.accept_drift:
            log("    --accept-drift: loading anyway on a human's say-so")
        elif drift:
            findings.extend(drift)
        if findings:
            note = "; ".join(findings)
            record_run(db, script, status="failed", rows_written=0,
                       note=f"{name}: guard refused: {note[:150]}", started_at=started)
            raise SystemExit(
                f"FATAL: {name} refused before any write: {note}. "
                "Run --dry-run to see the fingerprint; --accept-drift overrides "
                "the drift half only, never impossible values.")

        log(f"Loading {name} into {table}")
        db.script(table_ddl(table))
        ensure_columns(db, table)
        db.script(index_ddl(table))
        written = 0
        try:
            written = write_cases(db, table, iter_cases(path, cfg, stats), pause=write_pause())
            stats.report()
            have = count_for_file(db, table, name)
            log(f"  VERIFY count(*) where source_file = {name}: {have:,} (read {stats.kept:,})")
            if have != stats.kept:
                raise SystemExit(
                    f"FATAL: reconcile failed for {name}: table holds {have:,} rows "
                    f"for this file, parser read {stats.kept:,} unique cases. "
                    "Freshness NOT stamped."
                )
            if stats.kept == 0:
                raise SystemExit(f"FATAL: {name} yielded no cases. Refusing to report success.")
        except BaseException as exc:  # noqa: BLE001 - the audit row must name the failure
            record_run(db, script, status="failed", rows_written=written,
                       note=f"{name}: {str(exc)[:200]}", started_at=started)
            raise

        write_load_record(db, args.program, {
            "file": name, "sha256": sha, "rows": stats.kept,
            "asOf": stats.last_decided or None,
            "fingerprint": fingerprint,
            "loadedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        }, latest=file_is_newest())
        write_summary_doc(db, args.program, table)
        if not file_is_newest():
            # History is not "the latest data". Keyed on the FILE, not on which
            # flag selected it - see the note above `is_newest`.
            record_run(db, script, status="ok", rows_written=written,
                       note=f"{name}: {stats.kept:,} cases (history)", started_at=started)
            log(f"loaded {name}; freshness left on the newest quarter")
            return 0
        stamp_freshness(db, cfg["freshness"], as_of=stats.last_decided or None,
                        source=cfg["source"], cadence="Quarterly",
                        note=f"{stats.kept:,} cases, {name}",
                        max_age_days=FRESHNESS_MAX_AGE_DAYS)
        record_run(db, script, status="ok", rows_written=written,
                   note=f"{name}: {stats.kept:,} cases", started_at=started)
        log(f"stamped   {cfg['freshness']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
