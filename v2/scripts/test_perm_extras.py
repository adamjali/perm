#!/usr/bin/env python3
"""The industry and worksite-city columns reach perm_cases without a rewrite.

`turso_migrate.py --incremental` writes only rows that changed. Two columns
added to that table (Sep 26 2026: the employer's NAICS code and the worksite
city) would make EVERY stored row look changed, and an INSERT OR REPLACE of
373,939 rows also rewrites eighteen indexes each: millions of row writes to
fill two unindexed text fields. So a row whose original fifteen columns are
unchanged gets a narrow UPDATE of the new two instead. This runs the real
loader against in-memory SQLite and asserts:

1. the columns are added to a table made before they existed;
2. a row whose core is unchanged is filled by UPDATE, never INSERT OR REPLACE;
3. a row whose core changed is replaced whole, and a new row is inserted;
4. a second identical load writes nothing at all;
5. `normalize_naics` keeps only two to six digits, and `naics_title` names the
   code the title belongs to when it falls back to a parent.

Run:  python3 scripts/test_perm_extras.py
"""
from __future__ import annotations

import gzip
import json
import pathlib
import sys
import tempfile

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import turso_migrate  # noqa: E402
from lib_naics import naics_title, normalize_naics  # noqa: E402
from lib_sqlite_shim import SqliteTurso  # noqa: E402

FAILS: list[str] = []


def check(label: str, ok: bool) -> None:
    print(("PASS " if ok else "FAIL ") + label)
    if not ok:
        FAILS.append(label)


class Recording(SqliteTurso):
    url = "sqlite://memory"

    def __init__(self) -> None:
        super().__init__()
        self.sql: list[str] = []

    def pipeline(self, reqs, **kw):
        for r in reqs:
            if r.get("type") == "execute":
                self.sql.append(r["stmt"]["sql"].split(" ", 3)[0:3][0])
        return super().pipeline(reqs, **kw)


OLD_SCHEMA = """CREATE TABLE perm_cases (
  case_number TEXT PRIMARY KEY, status TEXT NOT NULL, received_date TEXT,
  decision_date TEXT, days INTEGER, fiscal_year TEXT, employer_name TEXT,
  employer_slug TEXT, state TEXT, job_title TEXT, soc_code TEXT,
  soc_title TEXT, attorney_name TEXT, attorney_slug TEXT, wage REAL)"""


def case(n: int, **over) -> dict:
    base = {
        "caseNumber": f"G-100-24001-{n:06d}", "status": "certified",
        "receivedDate": "2024-01-02", "decisionDate": "2025-01-02", "days": 366,
        "fiscalYear": "2025", "employerName": "", "state": "WA",
        "jobTitle": "Engineer", "socCode": "15-1252.00", "socTitle": "Software Developers",
        "attorneyName": "", "wage": 150000,
        "naics": "541511", "worksiteCity": "Seattle",
    }
    base.update(over)
    return base


def old_row(c: dict) -> tuple:
    return (c["caseNumber"], c["status"], c["receivedDate"], c["decisionDate"], c["days"],
            c["fiscalYear"], None, "", c["state"], c["jobTitle"], c["socCode"],
            c["socTitle"], None, "", c["wage"])


def load(db, cases: list[dict]) -> None:
    art = pathlib.Path(tempfile.mkdtemp())
    with gzip.open(art / "perm-cases.ndjson.gz", "wt") as f:
        for c in cases:
            f.write(json.dumps(c) + "\n")
    (art / "perm-payload.json").write_text(json.dumps({"topEmployers": [], "topAttorneys": []}))
    turso_migrate.Turso = lambda: db
    argv = sys.argv
    sys.argv = ["turso_migrate.py", str(art), "--incremental"]
    try:
        rc = turso_migrate.main()
    finally:
        sys.argv = argv
    check(f"loader exit 0 (got {rc})", rc == 0)


def facets_check() -> None:
    """The builder's city and industry facets, from a cache of decided cases."""
    from build_entity_detail import build_facets
    from entity_identity import entity_key

    rows = (
        [{"employer_name": "ACME INC", "status": "certified", "state": "VA",
          "soc_code": "15-1252.00", "soc_title": "Software Developers",
          "worksite_city": "MCLEAN", "naics": "541511"}] * 3
        + [{"employer_name": "ACME INC", "status": "denied", "state": "VA",
            "soc_code": "15-1252.00", "soc_title": "Software Developers",
            "worksite_city": "McLean", "naics": "541511.0"}]
        + [{"employer_name": "ACME INC", "status": "certified", "state": "OR",
            "soc_code": "15-1252.00", "soc_title": "Software Developers",
            "worksite_city": "Portland", "naics": "541599"}]
        + [{"employer_name": "ACME INC", "status": "certified", "state": None,
            "soc_code": "15-1252.00", "soc_title": "Software Developers",
            "worksite_city": "Nowhere", "naics": "junk"}]
    )
    cache = pathlib.Path(tempfile.mkdtemp()) / "cases.ndjson"
    cache.write_text("".join(json.dumps(r) + "\n" for r in rows))
    maps = {"employer": {entity_key("ACME INC"): ("acme-inc", 6)},
            "attorney": {},
            "occupation": {"15-1252.00": ("software-developers", 6)}}
    out = build_facets(None, maps, str(cache))
    got = {(r[0], r[2], r[4]): (r[5], r[6], r[7], r[8]) for r in out}
    check("McLean spellings pool, the mixed-case one labels it",
          got.get(("employer", "city", "MCLEAN|VA")) == ("McLean, VA", 4, 3, 1))
    check("a city with no state is not a facet row",
          not any(k[2].startswith("NOWHERE") for k in got))
    check("the occupation page gets cities too",
          ("occupation", "city", "PORTLAND|OR") in got)
    check("541511 and 541511.0 are one industry",
          got.get(("employer", "industry", "541511")) == ("Custom Computer Programming Services", 4, 3, 1))
    check("a fallback title says whose it is",
          got.get(("employer", "industry", "541599"), ("",))[0].endswith("(Census group 5415)"))
    check("junk NAICS is dropped, not stored",
          not any(k[1] == "industry" and k[2] == "junk" for k in got))


def main() -> int:
    db = Recording()
    same, changed = case(1), case(2)
    db.conn.execute(OLD_SCHEMA)
    for c in (same, changed, case(3, naics=None, worksiteCity=None)):
        db.conn.execute("INSERT INTO perm_cases VALUES (" + ",".join("?" * 15) + ")", old_row(c))
    db.conn.commit()

    incoming = [same, dict(changed, status="denied"),
                case(3, naics=None, worksiteCity=None), case(4, naics="611310", worksiteCity="Ithaca")]
    load(db, incoming)

    cols = [r[1] for r in db.conn.execute("PRAGMA table_info(perm_cases)")]
    check("naics and worksite_city added to the live table",
          cols[-2:] == ["naics", "worksite_city"])
    got = {r[0]: r[1:] for r in db.conn.execute(
        "SELECT case_number, status, naics, worksite_city FROM perm_cases")}
    check("unchanged core: extras filled", got[same["caseNumber"]] == ("certified", "541511", "Seattle"))
    check("changed core: replaced whole", got[changed["caseNumber"]] == ("denied", "541511", "Seattle"))
    check("no extras in the file: row left alone", got[case(3)["caseNumber"]] == ("certified", None, None))
    check("new row inserted", got[case(4)["caseNumber"]] == ("certified", "611310", "Ithaca"))
    kinds = db.sql
    check(f"one narrow UPDATE and INSERTs for the rest (saw {kinds})",
          kinds.count("UPDATE") == 1 and kinds.count("INSERT") >= 1)
    # The UPDATE carried the unchanged row only; the changed and new rows went
    # through INSERT OR REPLACE. Proven by the row the UPDATE touched.
    db.sql = []
    load(db, incoming)
    check(f"a second identical load writes nothing (saw {db.sql})", db.sql == [])

    for raw, want in [(541511, "541511"), ("541511.0", "541511"), (" 5415 ", "5415"),
                      ("54-1511", None), ("", None), (None, None), ("0", None), ("5415119", None)]:
        check(f"normalize_naics({raw!r}) == {want!r}", normalize_naics(raw) == want)
    check("exact title", naics_title("541511") == ("541511", "Custom Computer Programming Services"))
    check("fallback names the parent code", naics_title("541599")[0] == "5415")
    check("unknown code has no title", naics_title("999999") is None)
    check("a code 2022 retired keeps its 2017 title", naics_title("511210")[1] == "Software Publishers")

    facets_check()

    print(f"\n{len(FAILS)} failed" if FAILS else "\nall passed")
    return 1 if FAILS else 0


if __name__ == "__main__":
    sys.exit(main())
