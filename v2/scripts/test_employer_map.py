#!/usr/bin/env python3
"""employer_page_map and employer_other_index on real SQLite (lib_sqlite_shim).

The cases are the ones measured on production on Oct 4 2026: Intellectt is not
Intel, "Salesforce.com, Inc." is Salesforce, "&amp;" is "&", a published
seasonal URL survives, two spellings of one H-1B-only employer make one page,
an employer known only from USCIS's aggregates makes none, and a case in both
a live and a published table is counted once, under the program its prefix
names.
"""
from __future__ import annotations

import json
import os
import pathlib
import sys
import tempfile

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import build_employer_map as bem  # noqa: E402
from entity_identity import program_key  # noqa: E402
from lib_sqlite_shim import SqliteTurso  # noqa: E402

FAILED: list[str] = []


def check(name: str, got, want) -> None:
    ok = got == want
    print(f"{'ok  ' if ok else 'FAIL'} {name}: {got!r}" + ("" if ok else f" (want {want!r})"))
    if not ok:
        FAILED.append(name)


CASES = """(case_number TEXT PRIMARY KEY, received_date TEXT, decision_date TEXT,
            employer_name TEXT, employer_slug TEXT)"""
LIVE = """(case_number TEXT PRIMARY KEY, filing_date TEXT, employer_name TEXT,
           employer_slug TEXT, fetched_at INTEGER)"""


def seed() -> SqliteTurso:
    db = SqliteTurso()
    db.script([
        "CREATE TABLE perm_entities (kind TEXT, slug TEXT, name TEXT, merge_key TEXT, total INTEGER)",
        "CREATE TABLE perm_entity_alias (kind TEXT, slug TEXT, target_slug TEXT)",
        "CREATE TABLE perm_live_only_index (slug TEXT, name TEXT, cases INTEGER)",
        "CREATE TABLE seasonal_employer_index (slug TEXT, cases INTEGER)",
        f"CREATE TABLE perm_cases {CASES}",
        "CREATE TABLE perm_live_recent (case_number TEXT PRIMARY KEY, filing_date TEXT, "
        "employer_name TEXT, employer_slug TEXT)",
        f"CREATE TABLE pwd_cases {CASES}",
        f"CREATE TABLE lca_cases {CASES}",
        f"CREATE TABLE seasonal_cases {CASES}",
        f"CREATE TABLE pwd_case_status {LIVE}",
        f"CREATE TABLE lca_case_status {LIVE}",
        f"CREATE TABLE seasonal_case_status {LIVE}",
        "CREATE TABLE uscis_h1b_employers (employer TEXT, employer_slug TEXT)",
        "CREATE TABLE h1b_lottery_employers (employer TEXT, employer_slug TEXT)",
        "INSERT INTO perm_entities VALUES ('employer', 'intel-corporation', 'Intel Corporation', 'intel', 900)",
        "INSERT INTO perm_entities VALUES ('employer', 'salesforce-inc', 'Salesforce, Inc.', 'salesforce', 500)",
        "INSERT INTO perm_entities VALUES ('employer', 'jpmorgan-chase-co', 'JPMorgan Chase & Co.', 'jpmorgan chase', 700)",
        "INSERT INTO perm_entity_alias VALUES ('employer', 'intel-corp-old', 'intel-corporation')",
        "INSERT INTO perm_live_only_index VALUES ('new-perm-filer', 'New PERM Filer', 2)",
        "INSERT INTO seasonal_employer_index VALUES ('green-acres-farm-llc', 2)",
    ])
    lca = [
        ("I-200-25001-000001", "2024-10-01", "2024-10-08", "Intel Corporation", "intel-corporation"),
        ("I-200-25001-000002", "2024-10-01", "2024-10-08", "Intellectt Inc", "intellectt-inc"),
        ("I-200-25001-000003", "2024-10-02", "2024-10-09", "Intellectt Inc", "intellectt-inc"),
        ("I-200-25001-000004", "2024-10-03", "2024-10-10", "Salesforce.com, Inc.", "salesforce-com-inc"),
        ("I-200-25001-000005", "2024-10-04", "2024-10-11", "JPMORGAN CHASE &amp; CO.", "jpmorgan-chase-amp-co"),
        ("I-200-25001-000006", "2024-10-05", "2024-10-12", "Intel Corp", "intel-corp-old"),
        ("I-200-25001-000007", "2024-10-06", "2024-10-13", "New PERM Filer LLC", "new-perm-filer-llc"),
        # More filings under the LCA spelling than under the published seasonal slug,
        # so only the keep-the-URL rule makes the seasonal slug the page.
        ("I-200-25001-000008", "2024-10-07", "2024-10-14", "Green Acres Farm Inc", "green-acres-farm-inc"),
        ("I-200-25001-000013", "2024-10-08", "2024-10-15", "Green Acres Farm Inc", "green-acres-farm-inc"),
        ("I-200-25001-000014", "2024-10-09", "2024-10-16", "Green Acres Farm Inc", "green-acres-farm-inc"),
        ("I-200-25001-000009", "2024-09-01", "2024-09-08", "Acme Robotics LLC", "acme-robotics-llc"),
        ("I-200-25001-000010", "2024-09-02", "2024-09-09", "Acme Robotics LLC", "acme-robotics-llc"),
        ("I-200-25001-000011", "2024-09-03", "2024-09-10", "ACME ROBOTICS, L.L.C.", "acme-robotics-l-l-c"),
    ]
    for r in lca:
        db.execute("INSERT INTO lca_cases VALUES (?,?,?,?,?)", list(r))
    # A live LCA row DOL has also published: counted once.
    db.execute("INSERT INTO lca_case_status VALUES (?,?,?,?,?)",
               ["I-200-25001-000009", "2024-09-01", "Acme Robotics LLC", "acme-robotics-llc", 1790000000000])
    # Live only, not yet published: counted.
    db.execute("INSERT INTO lca_case_status VALUES (?,?,?,?,?)",
               ["I-200-26270-000012", "2026-09-27", "Acme Robotics LLC", "acme-robotics-llc", 1790000000000])
    db.execute("INSERT INTO perm_cases VALUES (?,?,?,?,?)",
               ["G-100-25001-000001", "2024-10-01", "2025-09-01", "Intel Corporation", "intel-corporation"])
    db.execute("INSERT INTO seasonal_case_status VALUES (?,?,?,?,?)",
               ["H-300-26100-000001", "2026-04-10", "Green Acres Farm LLC", "green-acres-farm-llc", 1790000000000])
    db.execute("INSERT INTO seasonal_case_status VALUES (?,?,?,?,?)",
               ["H-300-26100-000002", "2026-04-11", "Green Acres Farm LLC", "green-acres-farm-llc", 1790000000000])
    # An H-2B wage request: published in pwd_cases and live in seasonal_case_status. One H-2B filing, no PERM wage request.
    db.execute("INSERT INTO pwd_cases VALUES (?,?,?,?,?)",
               ["P-400-25100-000003", "2025-04-10", "2025-05-01", "Shore Crabs", "shore-crabs"])
    db.execute("INSERT INTO seasonal_case_status VALUES (?,?,?,?,?)",
               ["P-400-25100-000003", "2025-04-10", "Shore Crabs", "shore-crabs", 1790000000000])
    db.execute("INSERT INTO uscis_h1b_employers VALUES ('Old Sponsor Inc', 'old-sponsor-inc')")
    db.execute("INSERT INTO uscis_h1b_employers VALUES ('Intel Corporation', 'intel-corporation')")
    return db


def main() -> int:
    check("the rule: Salesforce.com is Salesforce", program_key("Salesforce.com, Inc."), program_key("Salesforce, Inc."))
    check("the rule: &amp; is &", program_key("JPMORGAN CHASE &amp; CO."), program_key("JPMorgan Chase & Co."))
    check("the rule: the legal name before d/b/a", program_key("FMR LLC d/b/a Fidelity Investments"), "fmr")
    check("the rule: Intellectt is not Intel", program_key("Intellectt Inc") == program_key("Intel Corporation"), False)

    db = seed()
    slugs = bem.read_sources(db)
    rows, index_rows, stats = bem.plan(slugs, bem.read_pages(db))
    page = {r[0]: (r[1], r[2]) for r in rows}
    check("Intel's own slug is its page", page.get("intel-corporation"), ("intel-corporation", "perm"))
    check("Intellectt has its own page, not Intel's", page.get("intellectt-inc"), ("intellectt-inc", "other"))
    check("Salesforce.com rows reach Salesforce", page.get("salesforce-com-inc"), ("salesforce-inc", "perm"))
    check("&amp; rows reach JPMorgan", page.get("jpmorgan-chase-amp-co"), ("jpmorgan-chase-co", "perm"))
    check("an alias slug reaches its target", page.get("intel-corp-old"), ("intel-corporation", "perm"))
    check("a live-only PERM employer takes its spellings", page.get("new-perm-filer-llc"), ("new-perm-filer", "live"))
    check("a published seasonal URL stays the page", page.get("green-acres-farm-inc"), ("green-acres-farm-llc", "other"))
    check("the merged spelling keeps a row, so its URL can redirect", page.get("green-acres-farm-llc"),
          ("green-acres-farm-llc", "other"))
    check("two spellings, one page", (page.get("acme-robotics-llc"), page.get("acme-robotics-l-l-c")),
          (("acme-robotics-llc", "other"), ("acme-robotics-llc", "other")))
    check("USCIS rows alone make no page", "old-sponsor-inc" in page, False)

    idx = {r[0]: r for r in index_rows}
    cols = bem.INDEX_COLS
    acme = dict(zip(cols, idx["acme-robotics-llc"]))
    check("published + live-not-published, each case once", acme["lca"], 4)
    green = dict(zip(cols, idx["green-acres-farm-llc"]))
    check("a group counts every program it files", (green["lca"], green["h2a"]), (3, 2))
    shore = dict(zip(cols, idx["shore-crabs"]))
    check("a P-400 is H-2B, not a PERM wage request, and counted once", (shore["h2b"], shore["pwd"]), (1, 0))
    check("no index row for a PERM page", "intel-corporation" in idx or "salesforce-inc" in idx, False)
    check("ranks are dense by first filing", [r[0] for r in index_rows][:2], ["acme-robotics-llc", "intellectt-inc"])

    for ddl in bem.DDL:
        db.execute(ddl)
    m1 = bem.write_diff(db, bem.MAP, bem.MAP_COLS, rows)
    i1 = bem.write_diff(db, bem.INDEX, bem.INDEX_COLS, index_rows)
    check("first write stores every row", (m1[0], i1[0]), (len(rows), len(index_rows)))
    rows2, index2, _ = bem.plan(bem.read_sources(db), bem.read_pages(db))
    m2 = bem.write_diff(db, bem.MAP, bem.MAP_COLS, rows2)
    i2 = bem.write_diff(db, bem.INDEX, bem.INDEX_COLS, index2)
    check("an unchanged rebuild writes nothing", (m2[0], m2[1], i2[0], i2[1]), (0, 0, 0, 0))

    # The URL holds when the volumes shift: three more filings under the second
    # spelling would make it the busiest, and the page still answers at the
    # slug it was published under.
    for n in (15, 16, 17):
        db.execute("INSERT INTO lca_cases VALUES (?,?,?,?,?)",
                   [f"I-200-25001-0000{n}", "2024-09-04", "2024-09-11", "ACME ROBOTICS, L.L.C.", "acme-robotics-l-l-c"])
    rows3, _, _ = bem.plan(bem.read_sources(db), bem.read_pages(db))
    page3 = {r[0]: r[1] for r in rows3}
    check("a published page keeps its URL when another spelling grows busier",
          (page3.get("acme-robotics-l-l-c"), page3.get("acme-robotics-llc")), ("acme-robotics-llc", "acme-robotics-llc"))

    # Law firms: printed-name slugs in the program files reach the firm's page.
    firm_pages = {
        "fragomen-del-rey-bernsen-loewy-llp": ("FRAGOMEN, DEL REY, BERNSEN & LOEWY, LLP", "fragomen del rey bernsen loewy", 48000),
        "fragomen-del-rey-bernsen-loewy-pllc": ("Fragomen Del Rey Bernsen Loewy PLLC", "fragomen del rey bernsen loewy pllc", 40),
        "berardi-immigration-law": ("Berardi Immigration Law", "berardi immigration law", 900),
    }
    firm_spellings = {
        "fragomen-del-rey-bernsen-loewy-llp": bem.Counter({"FRAGOMEN, DEL REY, BERNSEN & LOEWY, LLP": 500000}),
        "fragomen-del-rey-bernsen-loewyllp": bem.Counter({"Fragomen Del Rey Bernsen & LoewyLLP": 10}),
        "fragomen-del-rey-bersen-loewy-llp": bem.Counter({"Fragomen, Del Rey, Bersen Loewy, LLP": 30}),
        "berardi-immigration-law-pc": bem.Counter({"Berardi Immigration Law, P.C.": 50}),
        "smith-jones": bem.Counter({"Smith & Jones": 7}),
    }
    frows, fstats = bem.plan_firms(firm_spellings, firm_pages)
    fpage = {r[0]: r[1] for r in frows}
    check("firm: its own printed name reaches its page", fpage.get("fragomen-del-rey-bernsen-loewy-llp"),
          "fragomen-del-rey-bernsen-loewy-llp")
    check("firm: a glued legal-form word reaches the page", fpage.get("fragomen-del-rey-bernsen-loewyllp"),
          "fragomen-del-rey-bernsen-loewy-llp")
    check("firm: a one-letter typo in a surname reaches the page", fpage.get("fragomen-del-rey-bersen-loewy-llp"),
          "fragomen-del-rey-bernsen-loewy-llp")
    check("firm: punctuation in the form word doesn't matter", fpage.get("berardi-immigration-law-pc"),
          "berardi-immigration-law")
    check("firm: a firm with no PERM page maps to nothing", "smith-jones" in fpage, False)
    # The PLLC page's key is its own (pllc is a form word, so it equals Fragomen's key and the busier page wins it);
    # a key that is a page's key never moves to another page by the typo rules.
    check("firm: stats count what moved by a typo rule", (fstats.get("typo", 0) >= 2, fstats.get("no_page")), (True, 1))

    with tempfile.TemporaryDirectory() as tmp:
        path = os.path.join(tmp, "changed.json")
        pathlib.Path(path).write_text(json.dumps({"slugs": ["adobe-inc"]}))
        check("changed pages join the expiry list", bem.add_changed_slugs(["shore-crabs", "adobe-inc"], path), 1)
        check("and the list keeps what was there", json.loads(pathlib.Path(path).read_text())["slugs"],
              ["adobe-inc", "shore-crabs"])
    print(f"{len(FAILED)} failure(s); stats {stats}")
    return 1 if FAILED else 0


if __name__ == "__main__":
    sys.exit(main())
