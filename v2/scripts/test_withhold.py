#!/usr/bin/env python3
"""The withheld-names helpers: the list's format, the pages it reaches, and a purge that names no one.

    python3 scripts/test_withhold.py

Every name here is made up. The real list is a server setting and a GitHub secret, never
in this public repository.
"""
from __future__ import annotations

import contextlib
import io
import json
import os
import sqlite3
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import withhold as w  # noqa: E402
from lib_withheld import affected_paths, drop, parse, render, upsert  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = "jane-q-example|Jane  Q Example|Private household employer|g-100-25001-000001, P-100-25001-000009"


def check(cond: bool, msg: str, failures: list[str]) -> None:
    print(("  ok   " if cond else "  FAIL ") + msg)
    if not cond:
        failures.append(msg)


def fake_db() -> sqlite3.Connection:
    db = sqlite3.connect(":memory:")
    db.row_factory = sqlite3.Row
    db.executescript("""
      CREATE TABLE perm_entities (kind TEXT, slug TEXT, name TEXT, rank INTEGER, code TEXT);
      CREATE TABLE perm_cases (case_number TEXT, employer_slug TEXT, attorney_slug TEXT, soc_code TEXT,
        naics TEXT, worksite_city TEXT, state TEXT);
      CREATE TABLE pwd_cases (case_number TEXT, employer_slug TEXT, attorney_slug TEXT, soc_code TEXT,
        naics TEXT, worksite_city TEXT, worksite_state TEXT);
    """)
    for r in range(1, 400):
        db.execute("INSERT INTO perm_entities VALUES ('employer', ?, ?, ?, NULL)", (f"e{r}", f"E{r}", r))
    db.execute("UPDATE perm_entities SET slug = 'jane-q-example' WHERE rank = 200")
    db.execute("INSERT INTO perm_entities VALUES ('occupation', 'nannies', 'Nannies', 1, '39-9011.01')")
    db.execute("INSERT INTO perm_entities VALUES ('occupation', 'chefs', 'Chefs', 2, '35-1011.00')")
    db.execute("INSERT INTO perm_cases VALUES ('G-100-25001-000001', 'jane-q-example', 'some-firm', "
               "'39-9011.01', '814110', 'Los Angeles', 'CA')")
    db.execute("INSERT INTO pwd_cases VALUES ('P-100-25001-000009', 'jane-q-example', 'some-firm', "
               "'39-9011', '814110', 'Los Angeles', 'CA')")
    return db


def query_on(db: sqlite3.Connection):
    return lambda sql, args: [dict(r) for r in db.execute(sql, args).fetchall()]


def main() -> int:
    f: list[str] = []

    entries = parse(RAW)
    e = entries[0]
    check(len(entries) == 1 and e.slug == "jane-q-example" and e.name == "Jane Q Example",
          "an entry parses, its spacing evened out", f)
    check(e.cases == ("G-100-25001-000001", "P-100-25001-000009"), "case numbers are trimmed and upper-cased", f)
    check(parse("only-a-slug") == [] and parse(None) == [] and parse("a||b") == [], "a malformed entry is skipped", f)
    check(parse(render(entries)) == entries, "render and parse round-trip", f)
    other = parse("acme-x|Acme X|Employer|")[0]
    both = upsert(entries, other)
    check(len(both) == 2 and len(upsert(both, e)) == 2, "adding an entry for the same page replaces it", f)
    check(drop(both, "JANE-Q-EXAMPLE") == [other], "removing goes by page, whatever its case", f)

    # The format is the one the site parses: the TypeScript test uses the same shape.
    ts = open(os.path.join(HERE, "..", "src", "lib", "privacy", "withheld.ts")).read()
    check('"slug|name|label|case numbers"' in ts, "the site documents the same four-field format", f)

    db = fake_db()
    paths = affected_paths(query_on(db), e)
    check("/perm-employers/jane-q-example" in paths, "the employer's own page", f)
    check("/perm-employers/e140" in paths and "/perm-employers/e260" in paths and "/perm-employers/e139" not in paths,
          "every employer within 60 ranks, whose neighbour lists showed it, and none beyond", f)
    check("/perm-employers/browse/j" in paths and "/sitemaps/employer-1.xml" in paths, "its A-to-Z page and sitemap file", f)
    check("/perm-attorneys/some-firm" in paths and "/perm-industries/814110" in paths
          and "/perm-cities/los-angeles-ca" in paths, "its law firm, industry and city pages", f)
    check("/perm-wages/nannies" in paths and "/perm-wages/chefs" not in paths, "its occupation's pages only", f)
    check("/perm-case-status?case=G-100-25001-000001" in paths and "/perm-case-status?case=P-100-25001-000009" in paths,
          "the lookups of its case numbers", f)

    # The deploy's purge: counts only in its log, every affected page asked for.
    sent: list[list[str]] = []

    class Resp(io.BytesIO):
        status = 200

        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

    def fake_urlopen(req, timeout=0):
        sent.append(json.loads(req.data)["files"])
        return Resp(json.dumps({"success": True}).encode())

    real_urlopen, real_db = w.urllib.request.urlopen, sys.modules.get("lib_db")
    os.environ.update({"WITHHELD_EMPLOYERS": RAW, "CF_PURGE_TOKEN": "t", "CF_ZONE_ID": "z"})
    try:
        w.urllib.request.urlopen = fake_urlopen
        fake_lib = type(sys)("lib_db")
        fake_lib.Database = lambda *a, **k: db
        fake_lib.query_dicts = lambda conn, sql, args: query_on(conn)(sql, args)
        sys.modules["lib_db"] = fake_lib
        out = io.StringIO()
        with contextlib.redirect_stdout(out):
            w.cmd_purge()
        log = out.getvalue()
    finally:
        w.urllib.request.urlopen = real_urlopen
        if real_db is not None:
            sys.modules["lib_db"] = real_db
        for k in ("WITHHELD_EMPLOYERS", "CF_PURGE_TOKEN", "CF_ZONE_ID"):
            os.environ.pop(k, None)
    asked = [u for batch in sent for u in batch]
    check(sorted(asked) == sorted("https://permtracker.app" + p for p in paths), "the purge asks for every affected page", f)
    check(all(len(b) <= 30 for b in sent), "in batches of at most 30, Cloudflare's limit", f)
    check("jane" not in log.lower() and "example" not in log.lower() and "g-100" not in log.lower() and "pages purged" in log,
          "its log names no one (the deploy's log is public)", f)

    wf = open(os.path.join(HERE, "..", "..", ".github", "workflows", "oracle-deploy.yml")).read()
    step = wf[wf.find("Drop Cloudflare's copies of pages a withheld name was on"):]
    step = step[:step.find("- name:")]
    check("python3 scripts/withhold.py purge" in step and "secrets.WITHHELD_EMPLOYERS" in step,
          "every deploy runs the purge with the private list", f)
    check("echo" not in step and "set -x" not in step, "and prints nothing of it", f)

    print("\nALL PASS" if not f else f"\n{len(f)} FAILURE(S)")
    return 1 if f else 0


if __name__ == "__main__":
    sys.exit(main())
