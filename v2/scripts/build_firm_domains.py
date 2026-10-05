#!/usr/bin/env python3
"""The email DOMAINS DOL's own files tie to each law firm, for claiming a firm page.

A firm can claim its page on permtracker.app (convex/firmClaims.ts). The claim
is checked against this table: an address at a domain that DOL's disclosure
files print beside the firm's name verifies on its own; anything else goes to
manual review. The table is built here, from the newest disclosure file of
each program that names a representing firm:

| program | file | firm column | email column |
|---|---|---|---|
| PERM | PERM_Disclosure_Data_FY*.xlsx (ETA-9089) | ATTY_AG_LAW_FIRM_NAME | ATTY_AG_EMAIL |
| prevailing wage | PW_Disclosure_Data_FY*.xlsx (ETA-9141) | LAWFIRM_NAME_BUSINESS_NAME | AGENT_ATTORNEY_EMAIL_ADDRESS |
| LCA | LCA_Disclosure_Data_FY*.xlsx (ETA-9035) | LAWFIRM_NAME_BUSINESS_NAME | AGENT_ATTORNEY_EMAIL_ADDRESS |

Column names are DOL's FY2026 record layouts, read from the layout PDFs on
Oct 4 2026; older layouts' spellings are listed as alternates
(AGENT_ATTORNEY_FIRM_NAME / AGENT_ATTORNEY_EMAIL on the FY2020 PERM form).

ONLY THE DOMAIN IS KEPT. An address is read, split at its last "@", and
dropped; nothing here stores, prints or logs a whole address. Personal and
internet-provider mail (gmail.com, yahoo.com, comcast.net and so on) never
counts as a firm's domain, because anyone can hold one, and neither does a
domain DOL prints beside more than SHARED_LIMIT firms (a service many firms
use, which proves nothing about any one of them).

A firm's name maps to its page the way the map builder maps program files to
firm pages (build_employer_map.plan_firms): `program_key` equality with the
page's name or merge key, then the attorney-only typo rules. A spelling with no
page is skipped: there is nothing to claim.

Rows are kept per program, so a run that loads one program replaces that
program's rows and leaves the others; the claim check sums them. Writes are
diffs (one normaliser on both sides; libSQL returns integers as strings),
paced, and every run records itself.

www.dol.gov answers GitHub's runners and refuses this laptop and the Oracle
server, so this runs in .github/workflows/firm-domains.yml.

Usage:
    python3 scripts/build_firm_domains.py                      # every program, newest files
    python3 scripts/build_firm_domains.py --program lca        # one program
    python3 scripts/build_firm_domains.py --program pw --local PW.xlsx --dry-run
"""
from __future__ import annotations

import argparse
import os
import pathlib
import re
import sys
import tempfile
import time
import zipfile
from collections import Counter, defaultdict

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from entity_identity import program_key, typo_aliases  # noqa: E402
from lib_gov_data import iter_rows, log, read_shared_strings  # noqa: E402
from lib_turso import Turso, record_run, rows_of, stamp_freshness  # noqa: E402

SCRIPT = "build_firm_domains.py"
TABLE = "firm_email_domains"
COLS = ["page_slug", "domain", "program", "filings", "firm_filings"]
DDL = [
    f"""CREATE TABLE IF NOT EXISTS {TABLE} (
        page_slug TEXT NOT NULL,
        domain TEXT NOT NULL,
        program TEXT NOT NULL,
        filings INTEGER NOT NULL,
        firm_filings INTEGER NOT NULL,
        PRIMARY KEY (page_slug, domain, program))""",
    # The claim check asks "which firms does DOL print beside this domain".
    f"CREATE INDEX IF NOT EXISTS {TABLE}_domain ON {TABLE} (domain)",
]
PROGRAMS = ("perm", "pw", "lca")
FIRM_COLUMNS = {
    "perm": ["ATTY_AG_LAW_FIRM_NAME", "AGENT_ATTORNEY_FIRM_NAME", "LAWFIRM_NAME_BUSINESS"],
    "pw": ["LAWFIRM_NAME_BUSINESS_NAME"],
    "lca": ["LAWFIRM_NAME_BUSINESS_NAME"],
}
EMAIL_COLUMNS = {
    "perm": ["ATTY_AG_EMAIL", "AGENT_ATTORNEY_EMAIL"],
    "pw": ["AGENT_ATTORNEY_EMAIL_ADDRESS"],
    "lca": ["AGENT_ATTORNEY_EMAIL_ADDRESS"],
}
# A domain DOL prints beside more firms than this is a shared service.
SHARED_LIMIT = 3
WRITE_CHUNK = 400
WRITE_PAUSE_S = 0.3
MAX_AGE_DAYS = 100  # monthly run; a quarter's slack before the health check says so

# Mail anyone can hold. Matched on the whole domain, and on the first label for
# the providers that run a domain per country (yahoo.co.uk, hotmail.fr).
PERSONAL_DOMAINS = frozenset({
    "gmail.com", "googlemail.com", "ymail.com", "rocketmail.com", "aol.com", "aim.com",
    "icloud.com", "me.com", "mac.com", "msn.com", "proton.me", "pm.me", "protonmail.com",
    "protonmail.ch", "gmx.com", "gmx.net", "gmx.de", "mail.com", "usa.com", "lawyer.com",
    "zoho.com", "zohomail.com", "yandex.com", "yandex.ru", "qq.com", "163.com", "126.com",
    "sina.com", "rediffmail.com", "fastmail.com", "hey.com", "tutanota.com", "tuta.io",
    "comcast.net", "att.net", "sbcglobal.net", "verizon.net", "cox.net", "charter.net",
    "earthlink.net", "bellsouth.net", "optonline.net", "frontier.com", "windstream.net",
    "centurylink.net", "juno.com", "netzero.net", "roadrunner.com", "rr.com", "spectrum.net",
    "example.com", "example.org", "test.com", "none.com", "na.com",
})
PERSONAL_FIRST_LABELS = frozenset({
    "gmail", "yahoo", "hotmail", "outlook", "live", "msn", "aol", "icloud", "protonmail",
    "proton", "gmx", "yandex", "rediffmail", "zoho",
})
DOMAIN_RE = re.compile(r"^(?=.{4,253}$)[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$")


def domain_of(raw: str | None) -> str | None:
    """The domain of an address, lowercased, or None when it isn't one.

    DOL's cells carry stray spaces, angle brackets and the odd trailing dot;
    a cell with two addresses keeps the first. The local part is never kept.
    """
    if not raw:
        return None
    text = raw.strip().lower()[:320]
    text = re.split(r"[\s;,]+", text)[0].strip("<>\"'()[]")
    if text.count("@") < 1:
        return None
    domain = text.rsplit("@", 1)[1].strip(". ")
    if domain.startswith("www."):
        domain = domain[4:]
    return domain if DOMAIN_RE.match(domain) else None


def is_personal(domain: str) -> bool:
    """Mail anyone can hold, which proves nothing about a firm."""
    return domain in PERSONAL_DOMAINS or domain.split(".", 1)[0] in PERSONAL_FIRST_LABELS


def resolve(header: dict[int, str], names: list[str]) -> int | None:
    """The index of the first of `names` the header row carries, by name."""
    by_name = {(v or "").strip().upper(): i for i, v in header.items()}
    for name in names:
        if name in by_name:
            return by_name[name]
    return None


def first_sheet(archive: zipfile.ZipFile) -> str:
    sheets = [n for n in archive.namelist() if re.match(r"xl/worksheets/sheet\d+\.xml$", n)]
    if not sheets:
        raise SystemExit("FATAL: the workbook has no worksheet part.")
    return min(sheets, key=lambda n: int(re.search(r"(\d+)\.xml$", n).group(1)))


def read_pairs(path: str, program: str) -> tuple[Counter, Counter, dict]:
    """(filings per (firm key, domain), emailed filings per firm key, stats) for one workbook."""
    archive = zipfile.ZipFile(path)
    shared = read_shared_strings(archive)
    pairs: Counter = Counter()
    firms: Counter = Counter()
    stats = Counter()
    firm_i = email_i = None
    header_seen = False
    for cells in iter_rows(archive, first_sheet(archive), shared):
        if not header_seen:
            header_seen = True
            firm_i = resolve(cells, FIRM_COLUMNS[program])
            email_i = resolve(cells, EMAIL_COLUMNS[program])
            if firm_i is None or email_i is None:
                raise SystemExit(
                    f"FATAL: {os.path.basename(path)} has no "
                    f"{'firm' if firm_i is None else 'email'} column under any of "
                    f"{FIRM_COLUMNS[program] if firm_i is None else EMAIL_COLUMNS[program]}. "
                    "Read the record layout and add the new name.")
            continue
        stats["rows"] += 1
        key = program_key(cells.get(firm_i) or "")
        domain = domain_of(cells.get(email_i))
        if not key:
            stats["no_firm"] += 1
            continue
        if domain is None:
            stats["no_email"] += 1
            continue
        firms[key] += 1
        if is_personal(domain):
            stats["personal"] += 1
            continue
        pairs[(key, domain)] += 1
    stats["firm_keys"] = len(firms)
    stats["pairs"] = len(pairs)
    return pairs, firms, dict(stats)


def read_firm_pages(db) -> dict[str, tuple[str, str, int]]:
    """Every law-firm page: slug -> (name, merge key, total)."""
    return {str(s): (str(n or ""), str(k or ""), int(t or 0)) for s, n, k, t in rows_of(db.execute(
        "SELECT slug, name, merge_key, total FROM perm_entities WHERE kind = 'attorney'"))}


def page_of(keys: Counter, pages: dict[str, tuple[str, str, int]]) -> dict[str, str]:
    """firm key -> page slug, as build_employer_map.plan_firms places a spelling."""
    page_of_key: dict[str, tuple[int, str]] = {}
    totals: Counter = Counter()
    for slug, (name, merge_key, total) in pages.items():
        for key in {program_key(name), program_key(merge_key)}:
            if key and (key not in page_of_key or (total, slug) > page_of_key[key]):
                page_of_key[key] = (total, slug)
            if key:
                totals[key] += total
    for key, n in keys.items():
        totals[key] += n
    root = typo_aliases(dict(totals), "attorney")
    out: dict[str, str] = {}
    for key in keys:
        hit = page_of_key.get(key) or page_of_key.get(root.get(key, key))
        if hit:
            out[key] = hit[1]
    return out


def plan(program: str, pairs: Counter, firms: Counter, pages: dict) -> tuple[list[list], dict]:
    """Rows for one program: (page_slug, domain, program, filings, firm_filings). Pure, for the test."""
    where = page_of(firms, pages)
    by_page_domain: Counter = Counter()
    firm_filings: Counter = Counter()
    for key, n in firms.items():
        if key in where:
            firm_filings[where[key]] += n
    for (key, domain), n in pairs.items():
        page = where.get(key)
        if page:
            by_page_domain[(page, domain)] += n
    pages_per_domain: dict[str, set] = defaultdict(set)
    for page, domain in by_page_domain:
        pages_per_domain[domain].add(page)
    shared = {d for d, ps in pages_per_domain.items() if len(ps) > SHARED_LIMIT}
    rows = [[page, domain, program, n, firm_filings[page]]
            for (page, domain), n in sorted(by_page_domain.items()) if domain not in shared]
    stats = {
        "firm_keys": len(firms),
        "firms_with_page": len(where),
        "rows": len(rows),
        "shared_domains_dropped": len(shared),
    }
    return rows, stats


def norm(row) -> tuple:
    page, domain, program, filings, firm_filings = row
    return (str(page), str(domain), str(program), int(filings or 0), int(firm_filings or 0))


def write_program(db, program: str, want: list[list]) -> tuple[int, int]:
    """Replace one program's rows by diff: (written, removed)."""
    stored = {(r[0], r[1]): r for r in (norm(x) for x in rows_of(db.execute(
        f"SELECT {','.join(COLS)} FROM {TABLE} WHERE program = ?", [program])))}
    wanted = {(r[0], r[1]): norm(r) for r in want}
    changed = [list(r) for k, r in wanted.items() if stored.get(k) != r]
    gone = [k for k in stored if k not in wanted]
    for i in range(0, len(gone), 200):
        chunk = gone[i:i + 200]
        cond = " OR ".join("(page_slug = ? AND domain = ?)" for _ in chunk)
        db.execute(f"DELETE FROM {TABLE} WHERE program = ? AND ({cond})",
                   [program] + [v for k in chunk for v in k])
        time.sleep(WRITE_PAUSE_S)
    marks = "(" + ",".join("?" * len(COLS)) + ")"
    for i in range(0, len(changed), WRITE_CHUNK):
        chunk = changed[i:i + WRITE_CHUNK]
        db.execute(f"INSERT OR REPLACE INTO {TABLE} ({','.join(COLS)}) VALUES " + ",".join([marks] * len(chunk)),
                   [v for row in chunk for v in row])
        time.sleep(WRITE_PAUSE_S)
    return len(changed), len(gone)


def newest_file(program: str) -> tuple[str, str]:
    """(filename, url) of DOL's newest disclosure file for the program, discovered."""
    if program == "perm":
        from ingest_perm_disclosure import discover_files
        files = discover_files(1)
        if not files:
            raise SystemExit("FATAL: no PERM disclosure file on DOL's page.")
        return files[0]
    from ingest_flag_disclosure import PROGRAMS as FLAG
    from ingest_flag_disclosure import discover_latest
    return discover_latest(FLAG[program])


def fetch_file(url: str, dest: str) -> None:
    from ingest_flag_disclosure import PERFORMANCE_PAGE, download
    download(url, dest, referer=PERFORMANCE_PAGE)


def main() -> int:
    global WRITE_PAUSE_S
    ap = argparse.ArgumentParser(description=__doc__.split("\n", 1)[0])
    ap.add_argument("--program", choices=[*PROGRAMS, "all"], default="all")
    ap.add_argument("--local", metavar="XLSX", help="read this workbook instead of downloading (one program)")
    ap.add_argument("--dry-run", action="store_true", help="read and plan, print counts, write nothing")
    ap.add_argument("--pause", type=float, default=WRITE_PAUSE_S, metavar="SECONDS")
    args = ap.parse_args()
    WRITE_PAUSE_S = max(0.0, args.pause)
    programs = list(PROGRAMS) if args.program == "all" else [args.program]
    if args.local and len(programs) != 1:
        ap.error("--local reads one workbook: name its --program")
    started = time.time()
    db = Turso()
    pages = read_firm_pages(db)
    log(f"law-firm pages: {len(pages):,}")
    if not pages:
        raise SystemExit("FATAL: no law-firm pages to map onto (perm_entities has no attorney rows).")
    if not args.dry_run:
        for ddl in DDL:
            db.execute(ddl)
    notes: list[str] = []
    total_written = 0
    failed: list[str] = []
    for program in programs:
        try:
            with tempfile.TemporaryDirectory() as tmp:
                if args.local:
                    path, name = args.local, os.path.basename(args.local)
                else:
                    name, url = newest_file(program)
                    path = os.path.join(tmp, name)
                    log(f"{program}: downloading {name}")
                    fetch_file(url, path)
                pairs, firms, read_stats = read_pairs(path, program)
            rows, plan_stats = plan(program, pairs, firms, pages)
            log(f"{program}: {name} {read_stats}; {plan_stats}")
            if args.dry_run:
                continue
            written, removed = write_program(db, program, rows)
            total_written += written
            notes.append(f"{program} {name}: {len(rows):,} firm domains ({written:,} written, {removed:,} removed)")
        except SystemExit as exc:
            failed.append(program)
            notes.append(f"{program}: {exc}")
            log(f"{program}: FAILED {exc}")
    if args.dry_run:
        return 1 if failed else 0
    note = "; ".join(notes)
    if failed:
        record_run(db, SCRIPT, status="failed", rows_written=total_written, note=note, started_at=started)
        return 1
    got = int(rows_of(db.execute(f"SELECT count(*) FROM {TABLE}"))[0][0] or 0)
    stamp_freshness(db, "firm-email-domains", source="DOL disclosure files (PERM, PW, LCA): the firm's email domain",
                    cadence="monthly", note=f"{got:,} firm and domain pairs; {note}", max_age_days=MAX_AGE_DAYS)
    record_run(db, SCRIPT, status="ok", rows_written=total_written, note=note, started_at=started)
    log(f"done: {got:,} rows in {TABLE}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
