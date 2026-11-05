#!/usr/bin/env python3
"""The withheld-names helpers: the lists' format, numbering, what the tool gathers, the pages a
removal reaches, and a purge that names no one.

    python3 scripts/test_withhold.py

Every name here is made up. The real lists are server settings and secrets, never in this
public repository.
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
from lib_withheld import (  # noqa: E402
    Entry,
    affected_paths,
    check_fields,
    drop,
    gather,
    neutral_path,
    numbered,
    parse,
    parse_env,
    parse_numbers,
    render,
    render_kinds,
    render_numbers,
    shown_label,
    slug_taken,
    unlisted_spellings,
    upsert,
)

HERE = os.path.dirname(os.path.abspath(__file__))
FIXTURE = json.load(open(os.path.join(HERE, "fixtures", "withheld_format.json")))
FIRM_RAW = FIXTURE["settings"]["WITHHELD_FIRMS"]
EMPLOYER_RAW = FIXTURE["settings"]["WITHHELD_EMPLOYERS"]
SECRET_WORDS = ("jane", "example", "exampel", "acme", "g-100", "p-100")


def check(cond: bool, msg: str, failures: list[str]) -> None:
    print(("  ok   " if cond else "  FAIL ") + msg)
    if not cond:
        failures.append(msg)


def fake_db() -> sqlite3.Connection:
    db = sqlite3.connect(":memory:")
    db.row_factory = sqlite3.Row
    db.executescript("""
      CREATE TABLE perm_entities (kind TEXT, slug TEXT, name TEXT, rank INTEGER, code TEXT, merge_key TEXT);
      CREATE TABLE perm_entity_alias (kind TEXT, slug TEXT, target_slug TEXT);
      CREATE TABLE firm_page_map (source_slug TEXT, page_slug TEXT);
      CREATE TABLE employer_page_map (source_slug TEXT, page_slug TEXT, page_kind TEXT);
      CREATE TABLE perm_live_only_index (slug TEXT);
      CREATE TABLE employer_other_index (slug TEXT);
      CREATE TABLE firm_ranks (state TEXT, slug TEXT);
      CREATE TABLE perm_cases (case_number TEXT, employer_name TEXT, employer_slug TEXT, attorney_name TEXT,
        attorney_slug TEXT, soc_code TEXT, naics TEXT, worksite_city TEXT, state TEXT);
      CREATE TABLE pwd_cases (case_number TEXT, employer_name TEXT, employer_slug TEXT, attorney_name TEXT,
        attorney_slug TEXT, soc_code TEXT, naics TEXT, worksite_city TEXT, worksite_state TEXT);
      CREATE TABLE lca_cases (case_number TEXT, employer_name TEXT, employer_slug TEXT, attorney_name TEXT,
        attorney_slug TEXT, soc_code TEXT);
    """)
    for r in range(1, 400):
        db.execute("INSERT INTO perm_entities VALUES ('employer', ?, ?, ?, NULL, ?)", (f"e{r}", f"E{r}", r, f"e{r}"))
    db.execute("UPDATE perm_entities SET slug = 'jane-q-example', name = 'JANE Q EXAMPLE', merge_key = 'jane q example' WHERE rank = 200")
    for r in range(1, 900):
        db.execute("INSERT INTO perm_entities VALUES ('attorney', ?, ?, ?, NULL, ?)", (f"f{r}", f"F{r}", r, f"f{r}"))
    db.execute("UPDATE perm_entities SET slug = 'example-law-group-pllc', name = 'Example Law Group, PLLC', "
               "merge_key = 'example law group' WHERE kind = 'attorney' AND rank = 450")
    db.execute("UPDATE perm_entities SET slug = 'example-law-group-pllc-2', name = 'EXAMPLE LAW GROUP PLLC', "
               "merge_key = 'example law group' WHERE kind = 'attorney' AND rank = 800")
    db.execute("INSERT INTO perm_entities VALUES ('occupation', 'nannies', 'Nannies', 1, '39-9011.01', NULL)")
    db.execute("INSERT INTO perm_entities VALUES ('occupation', 'lawyers', 'Lawyers', 2, '23-1011.00', NULL)")
    db.execute("INSERT INTO perm_entities VALUES ('occupation', 'chefs', 'Chefs', 3, '35-1011.00', NULL)")
    db.execute("INSERT INTO perm_entity_alias VALUES ('attorney', 'example-law-grp', 'example-law-group-pllc')")
    db.execute("INSERT INTO firm_page_map VALUES ('exampel-law-group', 'example-law-group-pllc')")
    db.execute("INSERT INTO firm_page_map VALUES ('example-law-group-pllc', 'example-law-group-pllc')")
    db.execute("INSERT INTO firm_ranks VALUES ('TX', 'example-law-group-pllc')")
    db.execute("INSERT INTO perm_cases VALUES ('G-100-25001-000001', 'Jane Q Example', 'jane-q-example', 'Big Firm LLP', "
               "'big-firm-llp', '39-9011.01', '814110', 'Los Angeles', 'CA')")
    db.execute("INSERT INTO pwd_cases VALUES ('P-100-25001-000009', 'Jane Q Example', 'jane-q-example', 'Big Firm LLP', "
               "'big-firm-llp', '39-9011', '814110', 'Los Angeles', 'CA')")
    db.execute("INSERT INTO perm_cases VALUES ('G-100-24001-000004', 'Acme Corp', 'acme-corp', 'Exampel Law Group', "
               "'exampel-law-group', '23-1011.00', '541110', 'Austin', 'TX')")
    db.execute("INSERT INTO lca_cases VALUES ('I-200-24001-000005', 'Zed Labs', 'zed-labs', 'Example Law Group P.L.L.C.', "
               "'example-law-group-pllc', '15-1252.00')")
    return db


def query_on(db: sqlite3.Connection):
    return lambda sql, args: [dict(r) for r in db.execute(sql, args).fetchall()]


def main() -> int:
    f: list[str] = []

    # --- the format, held to the same fixture the TypeScript reader is held to
    got = parse_env(FIXTURE["settings"])
    as_dicts = [{
        "kind": e.kind, "slug": e.slug, "name": e.name, "label": e.label, "cases": list(e.cases),
        "number": e.number, "slugs": list(e.all_slugs()), "names": list(e.all_names()),
        "shown": shown_label(e), "neutralPath": neutral_path(e),
    } for e in got]
    check(as_dicts == FIXTURE["entries"], "both settings parse exactly as the fixture (and the site) read them", f)
    firm = next(e for e in got if e.kind == "firm")
    jane = next(e for e in got if e.slug == "jane-q-example")
    check(parse("only-a-slug") == [] and parse(None) == [] and parse("a||b") == [], "a malformed entry is skipped", f)
    check(parse(render([firm]), "firm") == [firm] and parse(render([jane])) == [jane], "render and parse round-trip", f)
    check(render_kinds(got)["WITHHELD_FIRMS"].count(";") == 0 and "WITHHELD_EMPLOYERS" in render_kinds(got),
          "each kind is written to its own setting", f)
    old = parse("acme-x|Acme X|Employer|G-100-25001-000077")[0]
    check(old.number is None and old.text() == "acme-x|Acme X|Employer|G-100-25001-000077|||",
          "an entry in the old four-field form still parses, and writes back in the new form", f)
    both = upsert([jane, firm], Entry("firm", "jane-q-example", "X", "Law firm"))
    check(len(both) == 3, "an employer and a firm with one slug are two entries", f)
    check(drop(both, "JANE-Q-EXAMPLE", "firm") == [jane, firm], "removing goes by page and kind", f)

    try:
        check_fields(Entry("firm", "a", "Bad; name", "Law firm"))
        check(False, "a field holding a separator is refused", f)
    except ValueError as exc:
        check("bad" not in str(exc).lower(), "a field holding a separator is refused, without echoing it", f)

    # --- numbering: per kind, site-wide, never reused, never onto a real page's address
    marks = parse_numbers("employer=4,firm=2")
    check(marks == {"employer": 4, "firm": 2} and render_numbers(marks) == "employer=4,firm=2", "the high-water marks round-trip", f)
    fresh = Entry("firm", "new-firm", "New Firm", "Law firm")
    listed, after = numbered([firm, fresh], {"firm": 5}, lambda k, s: False)
    check(listed[0].number == 3 and listed[1].number == 6 and after["firm"] == 6,
          "a new entry takes the number above every one its kind has used, and old ones keep theirs", f)
    listed, after = numbered([fresh], {"firm": 6}, lambda k, s: False)
    check(listed[0].number == 7, "a number freed by a removal is never given again", f)
    listed, after = numbered([fresh], {}, lambda k, s: s in ("law-firm-1", "law-firm-2"))
    check(listed[0].number == 3 and after["firm"] == 3, "a number whose neutral address a real page has is skipped", f)

    # --- gathering from the database
    db = fake_db()
    q = query_on(db)
    g = gather(q, "firm", "example-law-group-pllc")
    check(set(g.entry.all_slugs()) == {"example-law-group-pllc", "example-law-grp", "exampel-law-group", "example-law-group-pllc-2"},
          "a firm's alias, page-map spellings and merge-key siblings are gathered", f)
    check({"Example Law Group, PLLC", "EXAMPLE LAW GROUP PLLC", "Exampel Law Group", "Example Law Group P.L.L.C."} <= set(g.entry.all_names()),
          "and every printed spelling, the LCA table's too", f)
    check(g.entry.label == "Law firm" and g.counts["slugs"] == 4 and g.counts["rows"] == 2, "with counts and the default label", f)
    gj = gather(q, "employer", "jane-q-example", label="Private household employer")
    check(set(gj.entry.cases) == {"G-100-25001-000001", "P-100-25001-000009"} and gj.entry.label == "Private household employer",
          "an employer's few case numbers are gathered too", f)
    try:
        gather(q, "firm", "jane-q-example")
        check(False, "a slug with no page of that kind is refused", f)
    except LookupError:
        check(True, "a slug with no page of that kind is refused", f)
    check(slug_taken(q, "e5") and slug_taken(q, "exampel-law-group") and not slug_taken(q, "law-firm-3"),
          "a neutral address is taken when any real page or spelling answers to it", f)
    db.execute("INSERT INTO firm_page_map VALUES ('example-law-grp-new', 'example-law-group-pllc')")
    check(unlisted_spellings(q, g.entry) == 1, "a spelling the map added since is counted", f)

    # --- the pages a removal reaches
    numbered_firm = Entry("firm", g.entry.slug, g.entry.name, "Law firm", (), 3, g.entry.slugs, g.entry.names)
    paths = affected_paths(q, numbered_firm)
    check("/perm-attorneys/example-law-group-pllc" in paths and "/perm-attorneys/exampel-law-group" in paths
          and "/perm-attorneys/law-firm-3" in paths, "a firm's page under every slug, and its neutral page", f)
    check("/perm-attorneys/browse/e" in paths and "/sitemaps/attorney-1.xml" in paths, "its A-to-Z page and sitemap file", f)
    check("/perm-attorneys/f50" in paths and "/perm-attorneys/f850" in paths and "/perm-attorneys/f49" not in paths,
          "every firm within 400 ranks, whose peer lists showed it, and none beyond", f)
    check("/perm-employers/acme-corp" in paths and "/perm-employers/zed-labs" in paths, "every client employer's page", f)
    check("/badge/firm/example-law-group-pllc.svg" in paths and "/law-firm-rankings/texas" in paths
          and "/law-firm-rankings" in paths, "its badge and its rankings, the state page too", f)
    check("/perm-wages/lawyers" in paths and "/perm-wages/chefs" not in paths and "/perm-cities/austin-tx" in paths,
          "its occupations' and cities' pages only", f)
    numbered_jane = Entry("employer", "jane-q-example", "Jane Q Example", "Private household employer",
                          ("G-100-25001-000001", "P-100-25001-000009"), 2)
    epaths = affected_paths(q, numbered_jane)
    check("/perm-employers/jane-q-example" in epaths and "/perm-employers/private-household-employer-2" in epaths,
          "an employer's page and its neutral page", f)
    check("/perm-employers/e140" in epaths and "/perm-employers/e260" in epaths and "/perm-employers/e139" not in epaths,
          "every employer within 60 ranks, and none beyond", f)
    check("/perm-attorneys/big-firm-llp" in epaths and "/perm-industries/814110" in epaths
          and "/perm-cities/los-angeles-ca" in epaths and "/perm-wages/nannies" in epaths,
          "its law firm, industry, city and occupation pages", f)
    check("/perm-case-status?case=G-100-25001-000001" in epaths, "the lookups of its case numbers", f)

    # --- the deploy's purge: counts only in its log, every affected page asked for
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

    real_urlopen, real_db, real_sleep = w.urllib.request.urlopen, sys.modules.get("lib_db"), w.time.sleep
    env = {"WITHHELD_EMPLOYERS": numbered_jane.text(), "WITHHELD_FIRMS": numbered_firm.text(),
           "CF_PURGE_TOKEN": "t", "CF_ZONE_ID": "z"}
    os.environ.update(env)
    try:
        w.urllib.request.urlopen = fake_urlopen
        w.time.sleep = lambda s: None
        fake_lib = type(sys)("lib_db")
        fake_lib.Database = lambda *a, **k: db
        fake_lib.query_dicts = lambda conn, sql, args: query_on(conn)(sql, args)
        sys.modules["lib_db"] = fake_lib
        out = io.StringIO()
        with contextlib.redirect_stdout(out):
            w.cmd_purge()
        log = out.getvalue()
    finally:
        w.urllib.request.urlopen, w.time.sleep = real_urlopen, real_sleep
        if real_db is not None:
            sys.modules["lib_db"] = real_db
        for k in env:
            os.environ.pop(k, None)
    asked = sorted(u for batch in sent for u in batch)
    want = sorted({"https://permtracker.app" + p for p in [*epaths, *paths]})
    check(asked == want, "the purge asks for every page either entry reached", f)
    check(all(len(b) <= 30 for b in sent), "in batches of at most 30, Cloudflare's limit", f)
    check("pages purged" in log and "aren't in the lists" in log, "it reports its count and the spellings to refresh", f)
    check(not any(word in log.lower() for word in SECRET_WORDS), "its log names no one (the deploy's log is public)", f)

    # --- refresh: an entry from before numbers gets one and its spellings; a page that's gone is kept as listed
    saved: list = []
    real = {k: getattr(w, k) for k in ("server_state", "with_database", "save", "redeploy", "finish")}
    try:
        legacy = parse("jane-q-example|Jane Q Example|Private household employer|G-100-25001-000001")[0]
        gone = parse("no-such-page|Gone Name|Employer|")[0]
        w.server_state = lambda: ([legacy, gone], {"employer": 4})
        w.with_database = lambda fn: fn(query_on(db))
        w.save = lambda entries, marks: saved.append((entries, marks))
        w.redeploy = lambda wait: None
        w.finish = lambda *a, **k: None
        out = io.StringIO()
        with contextlib.redirect_stdout(out):
            w.cmd_refresh(yes=True, wait=False)
        entries, marks = saved[0]
        check([e.number for e in entries] == [5, 6] and marks["employer"] == 6,
              "refresh numbers every entry above the kind's high-water mark", f)
        check("P-100-25001-000009" in entries[0].cases and entries[1] == gone.__class__(**{**gone.__dict__, "number": 6}),
              "it gathers the entry's other cases, and keeps an entry whose page is gone as listed", f)
        check("1 whose page wasn't found" in out.getvalue() and not any(x in out.getvalue().lower() for x in SECRET_WORDS),
              "and says so in counts, naming no one", f)
    finally:
        for k, v in real.items():
            setattr(w, k, v)

    # --- status prints counts unless asked to show
    real_state = w.server_state
    try:
        w.server_state = lambda: ([numbered_jane, numbered_firm], {"employer": 2, "firm": 3})
        out = io.StringIO()
        with contextlib.redirect_stdout(out):
            w.cmd_status(False)
        check("1 employers and 1 firms" in out.getvalue() and not any(x in out.getvalue().lower() for x in SECRET_WORDS),
              "status prints counts and no name", f)
    finally:
        w.server_state = real_state

    # --no-deploy ships nothing, so it must not run the live checks against the old site
    seen: list[bool] = []
    real_refresh = w.cmd_refresh
    try:
        w.cmd_refresh = lambda yes, wait: seen.append(wait)
        w.main(["refresh", "--no-deploy", "--yes"])
        w.main(["refresh", "--yes"])
    finally:
        w.cmd_refresh = real_refresh
        w.NO_DEPLOY = False
    check(seen == [False, True], "--no-deploy skips the live checks; a plain run keeps them", f)

    wf = open(os.path.join(HERE, "..", "..", ".github", "workflows", "oracle-deploy.yml")).read()
    step = wf[wf.find("Drop Cloudflare's copies of pages a withheld name was on"):]
    step = step[:step.find("- name:")]
    check("python3 scripts/withhold.py purge" in step and "secrets.WITHHELD_EMPLOYERS" in step
          and "secrets.WITHHELD_FIRMS" in step and "DATABASE_LCA_URL" in step,
          "every deploy runs the purge with both private lists, and the LCA database", f)
    check("echo" not in step and "set -x" not in step, "and prints nothing of them", f)

    print("\nALL PASS" if not f else f"\n{len(f)} FAILURE(S)")
    return 1 if f else 0


if __name__ == "__main__":
    sys.exit(main())
