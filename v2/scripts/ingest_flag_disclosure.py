#!/usr/bin/env python3
"""Ingest DOL's quarterly PW (ETA-9141) and LCA (ETA-9035) disclosure files into Turso.

One script, two programs, selected with `--program pw|lca`. Each run discovers
the NEWEST disclosure file for that program on DOL's performance page, streams
it, and upserts one row per case into `pwd_cases` or `lca_cases`.

    python3 scripts/ingest_flag_disclosure.py --program pw
    python3 scripts/ingest_flag_disclosure.py --program lca

    # Probe the parser against a local or synthetic file, writing nothing.
    python3 scripts/ingest_flag_disclosure.py --program pw --dry-run --file x.xlsx --dump-rows 5

    # What column names does this file actually use?
    python3 scripts/ingest_flag_disclosure.py --program lca --dump-header --file x.xlsx

Everything here mirrors `ingest_perm_disclosure.py`, because every rule in
that file was a defect first:

* **The download URL is discovered, never constructed.** DOL keeps the
  current-year file under `/media/` and the archive under
  `/sites/dolgov/files/ETA/oflc/pdfs/`; a hardcoded path returns a styled 404
  that reads like a dead link. Measured 2026-09-02 on the live page: the LCA
  link TEXT is misspelled `LCA_Dislclosure_Data_FY2026_Q3.xlsx` while its href
  is spelled correctly, and that href carries a double slash
  (`https://www.dol.gov//media/...`). Discovery matches the href's basename
  and collapses the slashes; the link text is never read.
* **www.dol.gov refuses a bare User-Agent** (403 "Access Denied" from Akamai)
  and serves the full browser header set in `lib_gov_data.BROWSER_HEADERS`.
  Sustained traffic earns a 403 anyway, so the download backs off.
* **XLSX omits empty cells entirely.** A row's `<c>` children indexed by
  position shift every column after the first blank one, so a blank job title
  would put the SOC code in the job-title column and nobody would notice.
  `lib_gov_data.iter_rows` resolves each cell from its own `r="A1"` reference.
  `scripts/test_flag_disclosure.py` builds a fixture with a blank cell in the
  middle of a row and asserts the columns after it land correctly.
* **Columns are resolved by HEADER NAME, per file.** Every name below was read
  off DOL's own record layouts for FY2026 Q3 (`PW_Record_Layout_FY2026_Q3.pdf`
  and `LCA_Record_Layout_FY2026_Q3.pdf`, both under `/pdfs/FY26Q3/`), not
  guessed. A guessed name degrades to an empty column, which reads exactly
  like DOL not publishing the field. Older-form files (the `_old_form` PW
  files, FY2020 and earlier) are NOT mapped: run `--dump-header` on one and
  add the verified names before pointing this at it.
* **NO CONTACT DATA, EVER.** Both files carry `EMPLOYER_POC_EMAIL`,
  `AGENT_ATTORNEY_EMAIL_ADDRESS`, direct phones and street addresses. Not one
  of those columns is in `PROGRAMS[...]["columns"]`, so nothing here can read
  them and nothing downstream can print them.

The two things this script does that the PERM ingest does not:

1. **It writes rows to Turso itself**, chunked 500 rows per statement, four
   statements per pipeline request (the `turso_migrate.py` shape). `INSERT OR
   REPLACE` on `case_number`, so a case re-published in a later file (a PW
   redetermination decided the next quarter) moves to the new `source_file`.
2. **It reconciles before it reports success.** After the write,
   `COUNT(*) WHERE source_file = <this file>` must equal the number of unique
   cases read from that file, or the run is recorded as failed and exits 1.
   A load that wrote half a file and stamped itself fresh is the failure the
   freshness table exists to catch, so the stamp happens only after the
   reconcile passes.

**A monthly schedule on a quarterly file would rewrite every row eleven
times for nothing.** An LCA file is several hundred thousand rows, and each
row written costs one table write plus one per index - SEVEN indexes now,
after the four the unified search's state and occupation leads need, so a
437k-row LCA reload is ~3.5M writes against a 10M/month plan and the skip
below is what keeps that quarterly rather than monthly. So the file's SHA-256 is computed while it downloads and kept in
`perm_docs['flag_disclosure_<program>']` with the row count; a later run that
sees the same hash and finds the table still holding that count skips the
write, re-stamps freshness (the data has been re-verified current) and
records a zero-row run. `--force` bypasses that. DOL republishes each quarter
under a new filename, so the new quarter is loaded the first month it exists.
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
from build_entity_detail import _search_slug  # noqa: E402
from ingest_perm_disclosure import (  # noqa: E402
    STATE_NAMES,
    US_STATES,
    file_fiscal_year,
    fiscal_year,
    to_iso,
)
from lib_gov_data import (  # noqa: E402
    BROWSER_HEADERS,
    discover_links,
    fetch,
    iter_rows,
    log,
    read_shared_strings,
)
from lib_turso import Turso, lit, record_run, stamp_freshness  # noqa: E402

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
            # The REPRESENTING firm, not the employer. Both files carry it
            # under the same name; the ETA-9035 layout calls it "Name of Law
            # Firm representing the Employer submitting the Labor Condition
            # Application", the ETA-9141 one the same for a wage request.
            "attorney": ["LAWFIRM_NAME_BUSINESS_NAME"],
        },
        "event_dates": [],
    },
}

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
)

ROWS_PER_STMT = 500
STMTS_PER_REQUEST = 4
# MEASURED 2026-09-02, and the reason this exists: while a 147k-row load ran,
# an ordinary GROUP BY on another table went from ~0.3s to a WORST OF 59.2s,
# sampled every 10 seconds. That starved a production build's prerender (a 90s
# query deadline, blown twice) and would starve the live site the same way. A
# load is a background chore; the site is not. Pacing gives the primary room
# between write requests: 2,000 rows a request at 0.35s idle is ~26 seconds
# added per 147k rows, against a load that already takes minutes.
WRITE_PAUSE_S = 0.35
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
             fiscal_year     INTEGER)""",
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
        # THE FIRM LEAD, added 2026-09-03. DOL publishes the representing law
        # firm for both of these programs - `LAWFIRM_NAME_BUSINESS_NAME` is in
        # the ETA-9035 and ETA-9141 record layouts - and this ingest simply
        # never read the column, so the unified search's firm lead answered
        # from the PERM file alone and said "this firm files no wage requests"
        # by omission. Same shape as `idx_pc_att_dec` and `idx_pc_att_st_dec`.
        f"CREATE INDEX IF NOT EXISTS {table}_att_dec ON {table} (attorney_slug, decision_date)",
        f"CREATE INDEX IF NOT EXISTS {table}_att_st_dec ON {table} (attorney_slug, case_status, decision_date)",
        # THE STATE AND OCCUPATION LEADS OF THE UNIFIED CASE SEARCH. Both
        # columns were here from the first load and neither had an index, so
        # `src/lib/turso/unifiedSearch.ts` read the PERM file alone for those
        # two leads and said nothing about the other two programs. Measured
        # against production on 2026-09-03, rows READ for a hundred-row page:
        #
        #     pwd state=WY                229,555 -> 305
        #     pwd state=CA + DENIED       634,638 -> 0     (no such rows exist)
        #     lca state=WY                259,885 -> 100
        #     lca state=CA + DENIED        78,360 -> 100
        #     lca occupation 49-3051      437,496 -> 0
        #
        # Every "before" planned as `SCAN {table} USING INDEX {table}_decided`:
        # cheap when the needle is common, the whole table when it is rare.
        #
        # FOUR RATHER THAN TWO, because a three-column index cannot supply
        # `ORDER BY decision_date DESC` unless the status is an equality, and a
        # two-column one cannot seek the status. The `_st_` pair is used only
        # when the outcome bucket is a SINGLE status; a multi-status bucket
        # rides the plain index and filters, which measured cheaper (0.57 s for
        # California's three-status withdrawn bucket on `lca_cases`).
        #
        # THE SOC INDEXES ARE ON AN EXPRESSION because the programs spell the
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


def normalise_row(rec: dict[str, str], events: list[str | None], source_file: str, fy: int) -> dict | None:
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
        "employer_slug": _search_slug(employer) if employer else None,
        "job_title": clean_text(rec.get("job_title"), NAME_LEN),
        "soc_code": clean_text(rec.get("soc_code"), SOC_LEN),
        "soc_title": clean_text(rec.get("soc_title"), NAME_LEN),
        "wage": parse_wage(rec.get("wage")),
        "wage_unit": unit.upper() if unit else None,
        "worksite_state": parse_state(rec.get("state")),
        "visa_class": clean_text(rec.get("visa"), 40),
        "attorney_name": firm,
        # THE SAME SLUG FUNCTION THE PERM INGEST AND THE READ LAYER USE. A firm
        # slugged differently here would be a law firm whose wage requests
        # cannot be found from its own page.
        "attorney_slug": _search_slug(firm) if firm else None,
        "source_file": source_file,
        "fiscal_year": year,
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
        row = normalise_row(rec, slots, filename, fy)
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


def _read_doc(db: Turso, key: str) -> dict | None:
    raw = db.scalar("SELECT json FROM perm_docs WHERE key = ?", [key])
    if not raw:
        return None
    try:
        return json.loads(raw)
    except (TypeError, ValueError):
        return None


def read_load_record(db: Turso, program: str, name: str) -> dict | None:
    db.execute("""CREATE TABLE IF NOT EXISTS perm_docs (
        key TEXT PRIMARY KEY, json TEXT NOT NULL, computed_at INTEGER)""")
    rec = _read_doc(db, load_record_key(program, name))
    if rec:
        return rec
    legacy = _read_doc(db, load_record_key(program))
    return legacy if legacy and legacy.get("file") == name else None


def write_load_record(db: Turso, program: str, record: dict, *, latest: bool) -> None:
    keys = [load_record_key(program, record["file"])]
    if latest:
        keys.append(load_record_key(program))
    for key in keys:
        db.execute(
            "INSERT OR REPLACE INTO perm_docs (key, json, computed_at) VALUES (?, ?, ?)",
            [key, json.dumps(record, separators=(",", ":")), int(time.time() * 1000)],
        )


def summary_key(program: str) -> str:
    return f"flag_disclosure_summary_{program}"


def write_summary_doc(db: Turso, program: str, table: str) -> dict:
    """What the web reads instead of counting the table on every render:
    rows, the span of dates, and the files behind them. Two scans, once per
    load, against a table nothing else counts."""
    res = db.execute(
        f"SELECT count(*), min(received_date), max(decision_date) FROM {table}")
    row = res["response"]["result"]["rows"][0]
    cell = lambda c: None if c["type"] == "null" else c["value"]  # noqa: E731
    per_file = db.execute(
        f"SELECT source_file, count(*) FROM {table} GROUP BY source_file ORDER BY source_file")
    files = {r[0]["value"]: int(r[1]["value"]) for r in per_file["response"]["result"]["rows"]}
    doc = {
        "rows": int(cell(row[0]) or 0),
        "earliestReceived": cell(row[1]),
        "latestDecision": cell(row[2]),
        "files": files,
    }
    db.execute(
        "INSERT OR REPLACE INTO perm_docs (key, json, computed_at) VALUES (?, ?, ?)",
        [summary_key(program), json.dumps(doc, separators=(",", ":")), int(time.time() * 1000)],
    )
    log(f"  summary   {doc['rows']:,} rows, received from {doc['earliestReceived']}, "
        f"decided through {doc['latestDecision']}, {len(files)} file(s)")
    return doc


def ensure_columns(db: Turso, table: str) -> None:
    """Add any column in `COLUMNS` the live table is missing.

    `CREATE TABLE IF NOT EXISTS` is a no-op on a table that already exists, so
    it can create a table with new columns but never ADD one. Both of these
    tables were loaded before the law firm was read, so without this the very
    next INSERT names a column that is not there and the load dies with a
    syntax error that reads like a typo.

    THE ALTERNATIVE WAS A FULL RELOAD AND IT IS NOT AFFORDABLE. Measured:
    pwd_cases is 634,638 rows and lca_cases 437,496, and each row written costs
    one table write plus one per index - nine of them now - so reloading both
    to gain two columns is roughly 10.7M writes against a 10M/month plan. An
    ALTER is metadata only, and the backfill that follows rewrites each row
    once.

    Idempotent by inspection rather than by catching an error, so a genuine
    failure is not swallowed as "column already there".
    """
    res = db.execute(f"SELECT name FROM pragma_table_info('{table}')")
    have = {
        str(row[0]["value"])
        for row in res["response"]["result"]["rows"]
        if row and row[0].get("type") != "null"
    }
    if not have:
        return  # the table does not exist yet; the DDL above will create it
    missing = [c for c in COLUMNS if c not in have]
    for col in missing:
        kind = "REAL" if col == "wage" else "INTEGER" if col == "fiscal_year" else "TEXT"
        log(f"  adding missing column {table}.{col} {kind}")
        db.script([f"ALTER TABLE {table} ADD COLUMN {col} {kind}"])


def count_for_file(db: Turso, table: str, source_file: str) -> int:
    return int(db.scalar(f"SELECT count(*) FROM {table} WHERE source_file = ?", [source_file]) or 0)


# One UPDATE carries this many rows. 200 x 3 parameters is 600 per statement,
# comfortably inside any bind limit, and it is the batching that matters:
# 500 SEPARATE update statements in one request measured 986 rows per 20
# seconds against production, which is 3.6 hours for pwd_cases alone and over
# the workflow's own timeout. The cost was per STATEMENT, not per request.
BACKFILL_ROWS_PER_STMT = 200
BACKFILL_STMTS_PER_REQUEST = 8


def backfill_attorney(db: Turso, table: str, rows, pause: float = WRITE_PAUSE_S) -> int:
    """Write ONLY the two attorney columns onto rows that already exist.

    WHY NOT JUST RELOAD THE FILE. `INSERT OR REPLACE` deletes and reinserts, so
    every index on the table is rewritten for every row. These two tables carry
    1,072,134 rows between them and nine indexes each, which is about 10.7M
    writes against a 10M/month plan - the whole month's budget to gain two
    columns. An `UPDATE` of two columns rewrites the table row and only the
    indexes that contain them, and the two attorney indexes are created AFTER
    this runs, so the backfill costs one write per row: about 1.07M, ten times
    cheaper for the same result.

    ONE STATEMENT PER BATCH, NOT ONE PER ROW. A `CASE case_number WHEN ...`
    updates the whole batch in a single statement whose `WHERE ... IN (...)` is
    a primary-key seek per row. The first version sent 500 individual UPDATEs
    per request and managed 986 rows per 20 seconds; the work was in the
    per-statement overhead, not the network.

    A case in the file that is not in the table is simply not updated. That is
    correct rather than a gap: this is a backfill of rows the ordinary load
    already wrote, and a genuinely new case arrives through that load with its
    firm already on it.
    """
    pending: list[dict] = []
    batch: list[dict] = []
    seen = 0
    t0 = time.time()

    def flush_stmt() -> None:
        nonlocal batch
        if not batch:
            return
        whens = " ".join(["WHEN ? THEN ?"] * len(batch))
        holes = ",".join(["?"] * len(batch))
        sql = (f"UPDATE {table} SET "
               f"attorney_name = CASE case_number {whens} END, "
               f"attorney_slug = CASE case_number {whens} END "
               f"WHERE case_number IN ({holes})")
        args: list = []
        for r in batch:
            args += [lit(r["case_number"]), lit(r["attorney_name"])]
        for r in batch:
            args += [lit(r["case_number"]), lit(r["attorney_slug"])]
        args += [lit(r["case_number"]) for r in batch]
        pending.append({"type": "execute", "stmt": {"sql": sql, "args": args}})
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
    """Chunked INSERT OR REPLACE: 500 rows a statement, 4 statements a request."""
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
        sql = head + ",".join([placeholders] * len(batch))
        args = [lit(row[c]) for row in batch for c in COLUMNS]
        pending.append({"type": "execute", "stmt": {"sql": sql, "args": args}})
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
                    help="Which disclosure file: pw (ETA-9141) or lca (ETA-9035).")
    ap.add_argument("--file", help="Parse this local workbook instead of downloading.")
    ap.add_argument("--dry-run", action="store_true",
                    help="Parse and print counts; never open Turso, never write.")
    ap.add_argument("--dump-rows", type=int, default=0, metavar="N",
                    help="With --dry-run: print the first N parsed rows as `ROW <json>` lines.")
    ap.add_argument("--dump-header", action="store_true",
                    help="Print the file's resolved and raw column names, then stop.")
    ap.add_argument("--force", action="store_true",
                    help="Write even when the file's hash matches the last load.")
    ap.add_argument("--pause", type=float, default=WRITE_PAUSE_S, metavar="SECONDS",
                    help="Idle between write requests so a load cannot starve the live site "
                         f"(default {WRITE_PAUSE_S}; 0 disables).")
    ap.add_argument("--backfill-attorney", action="store_true",
                    help="Write ONLY the law-firm columns onto rows that already "
                         "exist, then create their indexes. Ten times cheaper "
                         "than a --force reload and the only affordable way to "
                         "add a column to these tables.")
    ap.add_argument("--fy", type=int, metavar="YYYY",
                    help="Load that fiscal year's newest file instead of the newest overall "
                         "(history, one year per run).")
    args = ap.parse_args()
    if args.dump_rows and not args.dry_run:
        ap.error("--dump-rows only makes sense with --dry-run")

    cfg = PROGRAMS[args.program]
    table = cfg["table"]
    script = f"ingest_flag_disclosure.py --program {args.program}" + (f" --fy {args.fy}" if args.fy else "")
    started = time.time()

    with tempfile.TemporaryDirectory() as tmp:
        if args.file:
            path = args.file
            name = os.path.basename(path)
            sha = sha256_of(path)
            log(f"Using local file {name} ({os.path.getsize(path) / 1e6:.1f} MB)")
        else:
            name, url = discover_latest(cfg, args.fy)
            path = os.path.join(tmp, name)
            log(f"Downloading {name}")
            sha, size = download(url, path, referer=PERFORMANCE_PAGE)
            log(f"  {size / 1e6:.1f} MB  sha256 {sha[:16]}")

        stats = ParseStats()
        if args.dump_header:
            for _ in iter_cases(path, cfg, stats, dump_header=True):
                pass
            return 0

        if args.dry_run:
            shown = 0
            for row in iter_cases(path, cfg, stats):
                if shown < args.dump_rows:
                    print("ROW " + json.dumps(row, sort_keys=True, separators=(",", ":")), flush=True)
                    shown += 1
            log("")
            log(f"file              {name}")
            log(f"fiscal year       {file_fiscal_year(name) or '(not in filename)'}")
            log(f"resolved          {stats.resolved}")
            stats.report()
            log("DRY RUN: nothing written")
            return 0

        # Everything below touches Turso. Deliberately after the two probe
        # modes, so they can run on a laptop with no credentials.
        db = Turso()
        prior = read_load_record(db, args.program, name)
        # BEFORE THE HASH CHECK, because a backfill is not a load. The file
        # is unchanged by definition - that is the whole point, the rows are
        # already there and only two columns are missing - so leaving this
        # after the sha-match branch meant it returned "unchanged; skipping"
        # and never ran. Caught by dispatching it once rather than by reading
        # the flow.
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
                                  pause=args.pause)
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
                if args.fy:
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

        log(f"Loading {name} into {table}")
        db.script(table_ddl(table))
        ensure_columns(db, table)
        db.script(index_ddl(table))
        written = 0
        try:
            written = write_cases(db, table, iter_cases(path, cfg, stats), pause=args.pause)
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
            "loadedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        }, latest=args.fy is None)
        write_summary_doc(db, args.program, table)
        if args.fy:
            # A history year is not "the latest data": the freshness row
            # describes the newest quarter and stays with it.
            record_run(db, script, status="ok", rows_written=written,
                       note=f"{name}: {stats.kept:,} cases (FY{args.fy})", started_at=started)
            log(f"loaded FY{args.fy}; freshness left on the newest quarter")
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
