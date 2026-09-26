#!/usr/bin/env python3
"""Load the State Department's immigrant visa waiting list at the National Visa Center.

Source: "Annual Report of Immigrant Visa Applicants in the Family-sponsored and
Employment-based preferences Registered at the National Visa Center as of
November 1, <year>", one PDF a year on travel.state.gov's Immigrant Visa
Statistics page. travel.state.gov refuses scripts, so there are two routes:

    --archive     the Internet Archive's copies, found through its index of
                  travel.state.gov/content/dam/visas/Statistics/Immigrant-Statistics/WaitingList/
                  (the file names vary: _2020_vF, 2021vF, so they are
                  discovered, never constructed). Holds the 2017 to 2023 reports.
    --from-file   a report saved from a browser, for anything newer.

What the list IS, in State's own words, and why the page says so up front:
it counts applicants with approved petitions whose visas will be processed
ABROAD, spouses and children included; it excludes everyone adjusting status
at USCIS, so for employment categories it "significantly understate[s] true
immigrant demand"; and consulates regularly cull cases unlikely to see further
action.

Each report is reconciled against ITSELF before it is kept (two totals per
column, every sub-total adding up) and, across reports, each one's prior-year
column is compared with the previous report's own figures. A report that
doesn't add up is refused; a cross-year difference is printed, because State
revises (culls) between reports and the later figure is the one it stands by.

Writes `perm_docs['nvc_waiting_list']` and a `data_freshness` row
(`nvc-waiting-list`). Tests: python3 scripts/test_nvc_waiting_list.py
"""
from __future__ import annotations

import argparse
import datetime
import json
import pathlib
import re
import sys
import time

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))

CDX = (
    "http://web.archive.org/cdx/search/cdx"
    "?url=travel.state.gov/content/dam/visas/Statistics/Immigrant-Statistics/WaitingList/*"
    "&output=json&filter=statuscode:200&limit=500"
)
MAX_AGE_DAYS = 1200
STATS_PAGE = "https://travel.state.gov/content/travel/en/legal/visa-law0/visa-statistics/immigrant-visa-statistics.html"
DOC_KEY = "nvc_waiting_list"
DATASET = "nvc-waiting-list"

MONTHS = {m: i for i, m in enumerate(
    ["january", "february", "march", "april", "may", "june", "july",
     "august", "september", "october", "november", "december"], 1)}

# Row label -> key, in the order the report prints them. Matched at the start
# of a line, so "EMPLOYMENT THIRD TOTAL" can't be taken for "EMPLOYMENT THIRD".
ROWS = [
    ("FAMILY FIRST", "F1"),
    ("FAMILY SECOND TOTAL", "F2"),
    ("2A-Spouses/Children:", "F2A"),
    ("2B-Adult Sons/Daughters:", "F2B"),
    ("FAMILY THIRD", "F3"),
    ("FAMILY FOURTH", "F4"),
    ("EMPLOYMENT FIRST", "E1"),
    ("EMPLOYMENT SECOND", "E2"),
    ("EMPLOYMENT THIRD TOTAL", "E3"),
    ("Skilled Workers:", "E3S"),
    ("Other Workers:", "EW"),
    ("EMPLOYMENT FOURTH TOTAL", "E4"),
    ("EMPLOYMENT FIFTH TOTAL", "E5"),
    ("GRAND TOTAL", "ALL"),
]
NUM = r"([\d,]+)"


class Refusal(Exception):
    pass


def as_of(text: str) -> str:
    m = re.search(r"Registered at the National Visa Center\s+as of\s+([A-Z][a-z]+)\s+(\d{1,2}),\s+(\d{4})", text)
    if not m or m.group(1).lower() not in MONTHS:
        raise Refusal("no 'as of <date>' in the report's title")
    return f"{m.group(3)}-{MONTHS[m.group(1).lower()]:02d}-{int(m.group(2)):02d}"


def label_pattern(label: str) -> str:
    """A row label that tolerates the PDF's line breaks and spacing.

    Measured on the real reports: the 2021 report breaks "EMPLOYMENT FOURTH
    TOTAL" across two lines, and the 2017 one prints "2B- Adult Sons".
    """
    return re.escape(label).replace(r"\ ", r"\s+").replace(r"\-", r"-\s*")


def _pair(text: str, label: str, start: int = 0) -> tuple[tuple[int, int], int]:
    """The two numbers (last year, this year) after a row label, and where they end."""
    m = re.compile(rf"(?m)^\s*{label_pattern(label)}\s*{NUM}\s*{NUM}").search(text, start)
    if not m:
        raise Refusal(f"row {label!r} not found")
    return (int(m.group(1).replace(",", "")), int(m.group(2).replace(",", ""))), m.end()


def parse_report(text: str) -> dict:
    """Both years of category totals from one report, reconciled against itself."""
    now: dict[str, int] = {}
    prev: dict[str, int] = {}
    pos = 0
    for label, key in ROWS:
        (p, n), pos = _pair(text, label, pos)
        prev[key], now[key] = p, n
    # The two TOTAL rows sit after the family and after the employment block.
    fam_at = text.find("FAMILY FOURTH")
    (pf, nf), _ = _pair(text, "TOTAL", fam_at)
    emp_at = text.find("EMPLOYMENT FIFTH TOTAL")
    (pe, ne), _ = _pair(text, "TOTAL", emp_at + len("EMPLOYMENT FIFTH TOTAL"))
    prev["F"], now["F"] = pf, nf
    prev["E"], now["E"] = pe, ne
    date = as_of(text)
    for which, d in (("this year", now), ("last year", prev)):
        checks = {
            "F2 = 2A + 2B": d["F2"] == d["F2A"] + d["F2B"],
            "family total": d["F"] == d["F1"] + d["F2"] + d["F3"] + d["F4"],
            "E3 = skilled + other": d["E3"] == d["E3S"] + d["EW"],
            "employment total": d["E"] == d["E1"] + d["E2"] + d["E3"] + d["E4"] + d["E5"],
            "grand total": d["ALL"] == d["F"] + d["E"],
        }
        bad = [k for k, ok in checks.items() if not ok]
        if bad:
            raise Refusal(f"{date} report, {which}: {', '.join(bad)} don't add up")
    # The country list is secondary: one that doesn't add up to the employment
    # total is dropped (and said so), never shown, and never costs the totals.
    countries = employment_by_country(text)
    if countries and sum(c["applicants"] for c in countries) != now["E"]:
        print(f"  {date}: employment countries sum to {sum(c['applicants'] for c in countries):,}, "
              f"not {now['E']:,}; country list dropped")
        countries = []
    y, m, dd = (int(x) for x in date.split("-"))
    return {"asOf": date, "prevAsOf": f"{y - 1}-{m:02d}-{dd:02d}", "now": now, "prev": prev,
            "employmentByCountry": countries}


def employment_by_country(text: str) -> list[dict]:
    """The report's list of countries with the most employment-based applicants, and the rest."""
    head = re.search(r"Employment-based\s+Immigrant\s+Waiting\s+List\s+by\s+Country", text, re.I)
    if not head:
        return []
    table = re.compile(r"Country\s+Total\s*\n").search(text, head.end())
    end = text.find("Worldwide Total", table.end()) if table else -1
    if not table or end < 0:
        return []
    block = text[table.end():end]
    out = []
    for name, n in re.findall(r"(?m)^\s*([A-Z][A-Za-z .,'-]+?)\s*\n\s*([\d,]+)\s*$", block):
        name = re.sub(r"\s*-\s*mainland born", " (mainland born)", name.strip())
        out.append({"country": name, "applicants": int(n.replace(",", ""))})
    return out


def pdf_text(data: bytes) -> str:
    import fitz  # PyMuPDF
    with fitz.open(stream=data, filetype="pdf") as d:
        return "\n".join(p.get_text() for p in d)


def build_doc(reports: list[dict], sources: dict[str, str]) -> dict:
    """One series by as-of date; a later report's restatement of a year wins, differences listed."""
    reports = sorted(reports, key=lambda r: r["asOf"])
    series: dict[str, dict[str, int]] = {}
    revisions = []
    for r in reports:
        old = series.get(r["prevAsOf"])
        if old is not None and old != r["prev"]:
            diff = {k: [old[k], r["prev"][k]] for k in r["prev"] if old.get(k) != r["prev"][k]}
            revisions.append({"asOf": r["prevAsOf"], "restatedIn": r["asOf"], "changes": diff})
        series[r["prevAsOf"]] = r["prev"]
        series[r["asOf"]] = r["now"]
    newest = reports[-1]
    return {
        "series": [{"asOf": k, **v} for k, v in sorted(series.items())],
        "revisions": revisions,
        "newest": newest["asOf"],
        "employmentByCountry": newest["employmentByCountry"],
        "sources": sources,
        "statsPage": STATS_PAGE,
    }


def archive_reports() -> tuple[list[dict], dict[str, str]]:
    import ingest_visa_bulletin as vb
    rows = json.loads(vb.fetch(CDX))[1:]
    best: dict[str, tuple[str, str]] = {}
    for _k, ts, url, *_ in rows:
        u = url.split("?")[0]
        name = u.rsplit("/", 1)[-1]
        if re.fullmatch(r"WaitingListItem_\d{4}[_A-Za-z]*\.pdf", name) and (name not in best or ts > best[name][0]):
            best[name] = (ts, u)
    reports, sources = [], {}
    for name, (ts, u) in sorted(best.items()):
        import urllib.request
        req = urllib.request.Request(f"https://web.archive.org/web/{ts}id_/{u}", headers=vb.UA)
        with urllib.request.urlopen(req, timeout=120) as r:
            data = r.read()
        if not data.startswith(b"%PDF"):
            vb.log(f"  {name}: not a PDF in that capture; skipped")
            continue
        rep = parse_report(pdf_text(data))
        reports.append(rep)
        sources[rep["asOf"]] = f"https://web.archive.org/web/{ts}/{u}"
        vb.log(f"  {name}: as of {rep['asOf']}, {rep['now']['ALL']:,} applicants, {rep['now']['E']:,} employment")
        time.sleep(3)
    return reports, sources


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--archive", action="store_true", help="Every report the Internet Archive holds")
    ap.add_argument("--from-file", nargs="*", default=[], help="Report PDFs saved from a browser")
    ap.add_argument("--dry-run", action="store_true", help="Parse and print; write nothing")
    args = ap.parse_args()
    if not args.archive and not args.from_file:
        ap.error("give --archive, --from-file, or both")

    reports, sources = archive_reports() if args.archive else ([], {})
    for path in args.from_file:
        rep = parse_report(pdf_text(pathlib.Path(path).read_bytes()))
        reports.append(rep)
        sources[rep["asOf"]] = "travel.state.gov (report saved from a browser; the site refuses scripts)"
        print(f"  {path}: as of {rep['asOf']}")
    if not reports:
        raise SystemExit("FATAL: no report parsed. Refusing to write.")
    doc = build_doc(reports, sources)
    print(f"{len(doc['series'])} dates, {doc['series'][0]['asOf']} to {doc['newest']}; "
          f"{len(doc['revisions'])} restated year(s)")
    for rv in doc["revisions"]:
        print(f"  {rv['asOf']} restated in the {rv['restatedIn']} report: {rv['changes']}")
    if args.dry_run:
        print(json.dumps(doc, indent=1)[:1500])
        return 0

    from lib_turso import Turso
    db = Turso()
    db.execute("INSERT OR REPLACE INTO perm_docs (key, json, computed_at) VALUES (?, ?, ?)",
               [DOC_KEY, json.dumps(doc), int(time.time() * 1000)])
    db.execute("""CREATE TABLE IF NOT EXISTS data_freshness (
        dataset TEXT PRIMARY KEY, as_of TEXT, fetched_at INTEGER,
        source TEXT, cadence TEXT, note TEXT, max_age_days INTEGER)""")
    # The budget is not a year. State published nothing after the November 2023
    # report: checked 2026-09-26 on its statistics page (which no longer links
    # the report at all), by the 2024 and 2025 file names (404) and by search.
    # A yearly budget would print "source hasn't republished" every day for a
    # condition nobody can act on; this one warns if a newer report lands and
    # is then not loaded for months.
    db.execute("INSERT OR REPLACE INTO data_freshness VALUES (?,?,?,?,?,?,?)",
               [DATASET, doc["newest"], int(time.time() * 1000),
                "State Dept annual NVC waiting list report, via Internet Archive or a saved page",
                "Yearly", f"{len(doc['series'])} dates, {datetime.date.today():%Y-%m-%d} load", MAX_AGE_DAYS])
    print(f"wrote perm_docs['{DOC_KEY}'] ({len(json.dumps(doc)) / 1024:.1f} KB)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
