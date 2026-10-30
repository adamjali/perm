#!/usr/bin/env python3
"""The rule watch: which rules it follows, what it reads, and when it writes.

    python3 scripts/test_rule_pipeline.py

Fixtures in scripts/fixtures/rule_pipeline/ are OIRA's two lists as published
on Oct 27 2026 (cut to a few rules each), the Federal Register's answers for
two RINs as it gave them that day, and the public inspection list of Oct 26
with one filing added in the API's own shape (a proposal under 1205-AC29;
nothing under that RIN was on public inspection that day).

The Unified Agenda's fixtures are reginfo's XML reports page and the 2026
edition's file (REGINFO_RIN_DATA_202510.xml, run Jul 3 2026), both read Oct 27
2026 and cut byte for byte to 14 entries (CDATA kept, contact names dropped).
"""
from __future__ import annotations

import json
import re
import pathlib
import sqlite3
import sys

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import ingest_rule_pipeline as rp  # noqa: E402

FIX = HERE / "fixtures" / "rule_pipeline"
AGENDA_XML = (FIX / "REGINFO_RIN_DATA_202510.xml").read_bytes()
FAILS: list[str] = []


def check(name: str, cond: bool, detail: str = "") -> None:
    print(("PASS " if cond else "FAIL ") + name + (f"  ({detail})" if detail and not cond else ""))
    if not cond:
        FAILS.append(name)


class FakeDb:
    """sqlite3 behind the libSQL client's shape: every value comes back as text."""

    def __init__(self) -> None:
        self.conn = sqlite3.connect(":memory:")
        self.writes = 0

    def execute(self, sql: str, args: list | None = None, **_kw) -> dict:
        cur = self.conn.execute(sql, args or [])
        if sql.lstrip().upper().startswith(("INSERT", "UPDATE")):
            self.writes += max(cur.rowcount, 0)
        cols = [d[0] for d in cur.description] if cur.description else []
        rows = [[{"type": "text" if v is not None else "null", "value": None if v is None else str(v)} for v in r]
                for r in cur.fetchall()]
        return {"response": {"result": {"cols": [{"name": c} for c in cols], "rows": rows}}}


def fixture_get(overrides: dict | None = None):
    """A `get` that serves the fixtures, and counts what was asked."""
    asked: list[str] = []
    overrides = overrides or {}

    def get(url: str, accept: str = "*/*") -> bytes:
        asked.append(url)
        for key, blob in overrides.items():
            if key in url:
                if isinstance(blob, Exception):
                    raise blob
                return blob
        if url == rp.OIRA_UNDER_REVIEW:
            return (FIX / "EO_RULES_UNDER_REVIEW.xml").read_bytes()
        if url == rp.OIRA_COMPLETED:
            return (FIX / "EO_RULE_COMPLETED_30_DAYS.xml").read_bytes()
        if url == rp.PUBLIC_INSPECTION:
            return (FIX / "public_inspection.json").read_bytes()
        if url == rp.AGENDA_REPORTS:
            return (FIX / "agenda_reports.html").read_bytes()
        if url == rp.AGENDA_FILE.format(pub="202510"):
            return AGENDA_XML
        if url.endswith("/202/699/901.txt"):
            return (FIX / "pi_2026-99901.txt").read_bytes()
        if "raw_text" in url:
            return b"DEPARTMENT OF HOMELAND SECURITY\nNo RIN line in this one.\n"
        for rin in ("1205-AC30", "1615-AC70"):
            if f"%22{rin}%22" in url:
                return (FIX / f"fr_{rin}.json").read_bytes()
        if "documents.json" in url:
            return b'{"description":"none","count":0}'
        raise AssertionError(f"unexpected request {url}")

    get.asked = asked  # type: ignore[attr-defined]
    return get


def raises(fn, kind) -> str | None:
    """The message `fn()` raised as `kind`, or None when it didn't."""
    try:
        fn()
    except kind as exc:
        return str(exc)
    return None


def edition_xml(pub: str, run_date: str, edits: dict[str, tuple[str, str]] | None = None,
                drop: tuple[str, ...] = ()) -> bytes:
    """The fixture as another edition: its own RUN_DATE, entries dropped, and
    `edits` replacing one entry's text (RIN -> (old, new))."""
    blob = AGENDA_XML.replace(b'RUN_DATE="2026-07-03-04:00"', f'RUN_DATE="{run_date}-04:00"'.encode())
    blob = blob.replace(b"<PUBLICATION_ID>202510<", f"<PUBLICATION_ID>{pub}<".encode())
    for rin in drop:
        blob = re.sub(rb"[ \t]*<RIN_INFO>\s*<RIN>" + rin.encode() + rb"</RIN>.*?</RIN_INFO>\s*", b"", blob, flags=re.S)
    for rin, (old, new) in (edits or {}).items():
        m = re.search(rb"<RIN_INFO>\s*<RIN>" + rin.encode() + rb"</RIN>.*?</RIN_INFO>", blob, re.S)
        assert m and old.encode() in m.group(0), (rin, old)
        blob = blob[:m.start()] + m.group(0).replace(old.encode(), new.encode()) + blob[m.end():]
    return blob


def agenda_checks() -> None:
    rp.AGENDA_MIN_ENTRIES = 5  # the fixture is cut to 14 entries; the real floor is checked below
    page = (FIX / "agenda_reports.html").read_bytes()
    eds = rp.parse_reports(page)
    check("the newest edition is the 2026 one, named as reginfo names it",
          (eds[0].pub_id, eds[0].label) == ("202510", "2026") and eds[1].label == "Spring 2025",
          str([(e.pub_id, e.label) for e in eds]))
    check("a page that isn't the reports list is reginfo not answering",
          raises(lambda: rp.parse_reports(b"<html><body>Down for maintenance</body></html>"),
                 rp.AgendaUnreachable) is not None)
    check("the reports list with no agenda link fails",
          raises(lambda: rp.parse_reports(re.sub(rb"REGINFO_RIN_DATA_\d+", b"OTHER", page)),
                 rp.AgendaFormatError) is not None)
    check("the single 2012 edition sorts before 2013's", rp.pub_key("2012") < rp.pub_key("201304") < rp.pub_key("202510"))

    ed = eds[0]
    a = rp.parse_agenda(AGENDA_XML, ed)
    check("the edition's date is its RUN_DATE", a.run_date == "2026-07-03" and a.entries == 14, f"{a.run_date} {a.entries}")
    ac29 = a.listings["1205-AC29"]
    check("1205-AC29 reads as the agenda printed it", {k: v for k, v in ac29.items() if k != "a_abstract"} == {
        "title": "Modernizing the Labor Market Test and Improving Protections for U.S. Workers in the PERM Immigrant Visa Program (NPRM)",
        "agency": "DOL's Employment and Training Administration",
        "a_pub_id": "202510", "a_edition": "2026", "a_published": "2026-07-03", "a_agency": "DOL/ETA",
        "a_stage": "Proposed Rule Stage", "a_priority": "Other Significant",
        "a_next_action": "NPRM", "a_next_date": "07/00/2026",
        "a_url": "https://www.reginfo.gov/public/do/eAgendaViewRule?pubId=202510&RIN=1205-AC29",
    }, json.dumps(ac29)[:400])
    abstract = ac29["a_abstract"] or ""
    check("its abstract is words, the HTML and entities gone",
          abstract.startswith("The Immigration and Nationality Act (8 USC 1101, et seq") and "<" not in abstract
          and "&" not in abstract and "Department of Labor’s" in abstract, abstract[:120])
    cdata = a.listings["1615-AD00"]["a_abstract"] or ""
    check("an abstract inside CDATA with its own DOCTYPE reads as words", bool(cdata) and "DOCTYPE" not in cdata
          and "<" not in cdata, cdata[:120])
    check("an ETA rule the agenda misspells is still followed by its abstract (1205-AC30)",
          "1205-AC30" in a.followed and "Foreign Nations" in a.listings["1205-AC30"]["title"])
    check("ETA's apprenticeship rule and a passport rule are not followed",
          "1205-AC21" not in a.followed and "1400-AF97" not in a.followed)
    check("another agency's abstract doesn't widen it (CBP's ESTA rule names aliens)", "1651-AB14" not in a.followed)
    check("another department's rules are never read", "0503-AA90" not in a.listings)
    check("active and long-term rules with a next action become rules; undetermined and completed don't",
          {"1205-AC29", "1205-AC30", "1615-AD00", "1615-AC97", "1615-AC98", "1615-AC67", "1615-AD14", "1400-AG33"} <= a.creates
          and "1615-AC49" not in a.creates and "1615-AC85" not in a.creates
          and {"1615-AC49", "1615-AC85"} <= a.followed, str(sorted(a.creates)))
    nxt = {r: (a.listings[r]["a_next_action"], a.listings[r]["a_next_date"]) for r in a.followed}
    check("the next step is the first undone document on the timetable", nxt["1615-AC67"] == ("Interim Final Rule", "09/00/2026")
          and nxt["1615-AD14"] == ("NPRM", "To Be Determined") and nxt["1400-AG33"] == ("Final Action", "08/00/2026")
          and nxt["1615-AC49"] == ("Next Action Undetermined", "To Be Determined"), json.dumps(nxt))
    check("a comment period closing, a withdrawal and a passed deadline are never the next step",
          nxt["1615-AC98"] == (None, None) and nxt["1615-AC97"] == (None, None) and nxt["1615-AC85"] == (None, None))
    tt = [("NPRM", "01/05/2026", "91 FR 1"), ("Interim Final Rule; Delay of Effective Date", "08/15/2026", "")]
    check("a delay of an effective date is a document, so it can be next",
          rp.next_action(tt, "2026-07-03") == ("Interim Final Rule; Delay of Effective Date", "08/15/2026"))
    check("a full date before the edition with no citation is not next",
          rp.next_action([("Final Rule", "06/15/2026", "")], "2026-07-03") == (None, None)
          and rp.next_action([("Final Rule", "07/03/2026", "")], "2026-07-03") == ("Final Rule", "07/03/2026"))
    check("the counts are by agency code", a.counts == {"1205": 2, "1615": 7, "1400": 1}, str(a.counts))

    shared = json.loads((FIX / "agenda_sentences.json").read_text())["cases"][0]
    check("the step's detail is the one the shared wording reads",
          rp.agenda_detail(ac29) == shared["event"]["detail"], rp.agenda_detail(ac29))

    # --- what the agenda refuses ---
    doctype = AGENDA_XML.replace(b"<REGINFO_RIN_DATA", b'<!DOCTYPE x [<!ENTITY a "aa">]>\n<REGINFO_RIN_DATA', 1)
    check("a DOCTYPE before the root fails", raises(lambda: rp.parse_agenda(doctype, ed), rp.AgendaFormatError) is not None)
    check("a web page in place of the file is reginfo not answering",
          raises(lambda: rp.parse_agenda(b"<!DOCTYPE html><html><body>Error</body></html>", ed), rp.AgendaUnreachable) is not None)
    check("XML that isn't the agenda fails", raises(lambda: rp.parse_agenda(b"<?xml version='1.0'?><OIRA_DATA/>", ed),
                                                   rp.AgendaFormatError) is not None)
    no_dol = edition_xml("202510", "2026-07-03", drop=("1205-AC29", "1205-AC30", "1205-AC21"))
    msg = raises(lambda: rp.parse_agenda(no_dol, ed), rp.AgendaFormatError) or ""
    check("a file with no ETA rules fails and names the agency", "Employment and Training Administration" in msg, msg)
    untitled = re.sub(rb"<RULE_TITLE>[^<]*</RULE_TITLE>", b"<RULE_TITLE></RULE_TITLE>", AGENDA_XML)
    msg = raises(lambda: rp.parse_agenda(untitled, ed), rp.AgendaFormatError) or ""
    check("entries with no title fail the file", "no RIN, title or stage" in msg, msg)
    no_uscis = edition_xml("202510", "2026-07-03", drop=("1615-AD00", "1615-AC97", "1615-AC98", "1615-AC67", "1615-AD14",
                                                        "1615-AC49", "1615-AC85"))
    msg = raises(lambda: rp.parse_agenda(no_uscis, ed), rp.AgendaFormatError) or ""
    check("a file with no USCIS rules fails and names USCIS", "USCIS" in msg, msg)
    blank = re.sub(rb"<RULE_STAGE>[^<]*</RULE_STAGE>", b"<RULE_STAGE></RULE_STAGE>", AGENDA_XML)
    msg = raises(lambda: rp.parse_agenda(blank, ed), rp.AgendaFormatError) or ""
    check("entries with no stage fail the file", "no RIN, title or stage" in msg, msg)
    rp.AGENDA_MIN_ENTRIES = 1000
    msg = raises(lambda: rp.parse_agenda(AGENDA_XML, ed), rp.AgendaFormatError) or ""
    check("a file of 14 entries is cut short at the real floor", "too few" in msg, msg)
    rp.AGENDA_MIN_ENTRIES = 5
    no_state = edition_xml("202510", "2026-07-03", edits={"1400-AG33": ("Visas: Visa Bond Program", "Bond Program")})
    again = rp.parse_agenda(no_state, ed)
    msg = raises(lambda: rp.check_agenda(again, {"pub_id": "202510", "counts": {"1400": 1, "1615": 7}}), rp.AgendaFormatError) or ""
    check("a second read of an edition that lost an agency's rules fails and names it", "State Department" in msg, msg)
    check("a new edition may list none of an agency's rules", rp.check_agenda(again, {"pub_id": "202504", "counts": {"1400": 9}}) is None)

    # --- when the file is read ---
    now = 1_793_100_000_000
    day = 86_400_000
    def reads(doc, force=False, overrides=None):
        g = fixture_get(overrides)
        got = rp.read_agenda(g, doc, now, force=force, sleep=lambda _s: None)
        return got, sum("REGINFO_RIN_DATA_" in u for u in g.asked)
    got, n = reads(None)
    check("with nothing read before, the newest edition is read", got is not None and n == 1)
    got, n = reads({"pub_id": "202510", "read_at": now - day})
    check("an edition read yesterday is not read again", got is None and n == 0)
    got, n = reads({"pub_id": "202510", "read_at": now - 8 * day})
    check("an edition read 8 days ago is read again", got is not None and n == 1)
    got, n = reads({"pub_id": "202504", "read_at": now - day})
    check("a new edition is read the day it's linked", got is not None and n == 1)
    got, n = reads({"pub_id": "202510", "read_at": now - day}, force=True)
    check("--agenda reads it anyway", got is not None and n == 1)
    check("the reports page down is reginfo not answering",
          raises(lambda: reads(None, overrides={rp.AGENDA_REPORTS: RuntimeError("503")}), rp.AgendaUnreachable) is not None)
    check("the file refused is reginfo not answering",
          raises(lambda: reads(None, overrides={"REGINFO_RIN_DATA_202510": RuntimeError("403")}), rp.AgendaUnreachable) is not None)
    check("a file past the size cap fails",
          raises(lambda: reads(None, overrides={"REGINFO_RIN_DATA_202510": rp.TooLarge("big")}), rp.AgendaFormatError) is not None)
    check("a defect in the reader is never taken for an outage",
          raises(lambda: reads(None, overrides={rp.AGENDA_REPORTS: KeyError("bug")}), KeyError) is not None)

    paused: list[float] = []
    rp.read_agenda(fixture_get(), None, now, sleep=paused.append)
    check("the agenda's file waits a pause after the reports page", paused == [rp.AGENDA_PAUSE_S], str(paused))
    paused.clear()
    g = fixture_get()
    rp.collect(g, {}, "2026-10-27", agenda=a, sleep=paused.append)
    asked = sum("documents.json" in u for u in g.asked)
    check("every Register request after the first waits a pause", asked > 5 and len(paused) == asked - 1,
          f"{asked} asked, {len(paused)} pauses")

    # --- the size cap ---
    class Answer:
        def __init__(self, n):
            self.n = n
        def __enter__(self):
            return self
        def __exit__(self, *a):
            return False
        def read(self, k=-1):
            return b"x" * (self.n if k < 0 else min(k, self.n))
    real_open, real_robots = rp.urllib.request.urlopen, rp.robots_allowed
    try:
        rp.robots_allowed = lambda _u: True
        opened: list[int] = []
        rp.urllib.request.urlopen = lambda _req, timeout=0: (opened.append(1), Answer(50))[1]
        check("an answer under the cap is read whole", rp.http_get("https://example.gov/f", limit=100) == b"x" * 50)
        opened.clear()
        check("an answer past the cap is refused, never retried",
              raises(lambda: rp.http_get("https://example.gov/f", limit=10), rp.TooLarge) is not None
              and len(opened) == 1, str(opened))
    finally:
        rp.urllib.request.urlopen, rp.robots_allowed = real_open, real_robots

    # --- the rows and steps ---
    db = FakeDb()
    old_ddl = "CREATE TABLE rule_pipeline (" + ", ".join(
        f"{k} {v}" for k, v in rp.COLUMNS.items() if k not in rp.AGENDA_COLUMNS) + ")"
    db.execute(old_ddl)
    db.execute("INSERT INTO rule_pipeline (rin, agency, title, first_seen, updated_at) VALUES "
               "('1615-AC85', 'USCIS', 'Petition for Immigrant Worker Reforms', 1, 1)")
    for sql in rp.DDL:
        db.execute(sql)
    added = rp.add_missing_columns(db, "rule_pipeline", rp.COLUMNS)
    check("a table from before the agenda gains its columns", sorted(added) == sorted(rp.AGENDA_COLUMNS), str(added))
    g = fixture_get()
    read = rp.collect(g, rp.stored_rows(db), "2026-10-27", agenda=a, sleep=lambda _s: None)
    p = rp.plan(rp.stored_rows(db), read.facts, now)
    rp.write(db, p, now)
    rows = rp.stored_rows(db)
    check("the agenda's active rules become rules; long-term undetermined and completed ones don't",
          {"1615-AD14", "1400-AG33", "1205-AC30", "1615-AC97"} <= set(rows) and "1615-AC49" not in rows, str(sorted(rows)))
    check("a rule followed already takes its listing whatever the stage",
          rows["1615-AC85"]["a_stage"] == "Completed Actions" and rows["1615-AC85"]["a_next_action"] is None)
    check("the Register is asked about the rules the agenda adds",
          any("%221615-AD14%22" in u for u in g.asked) and any("%221400-AG33%22" in u for u in g.asked))
    r29 = rows["1205-AC29"]
    check("1205-AC29 keeps OIRA's review and gains its listing",
          r29["p_completed"] == "2026-10-23" and r29["a_edition"] == "2026" and r29["a_next_date"] == "07/00/2026"
          and r29["a_listed"] == "2026-07-03" and r29["title"].endswith("(NPRM)"), json.dumps(r29)[:300])
    ag = {e["rin"]: e for e in p.events if e["kind"] == "agenda"}
    check("each rule's first listing is one agenda step, dated by the edition",
          len(ag) == len(set(read.facts) & set(a.listings)) and ag["1205-AC29"]["on_date"] == "2026-07-03"
          and json.loads(ag["1205-AC29"]["detail"]) == {"action": "NPRM", "date": "07/00/2026", "edition": "2026",
                                                         "stage": "Proposed Rule Stage"}, str(sorted(ag)))
    db.writes = 0
    p2 = rp.plan(rp.stored_rows(db), rp.collect(fixture_get(), rp.stored_rows(db), "2026-10-27", agenda=a,
                                                sleep=lambda _s: None).facts, now + 1000)
    check("a second read of the same edition writes nothing", rp.write(db, p2, now + 1000) == 0 and db.writes == 0)

    # The next edition moves one rule's timetable, keeps another's, and lists
    # a third with no next action at all.
    nxt_xml = edition_xml("202604", "2026-12-10", edits={
        "1205-AC29": ("<TTBL_DATE>07/00/2026</TTBL_DATE>", "<TTBL_DATE>01/00/2027</TTBL_DATE>"),
        "1615-AC67": ("<TTBL_ACTION>Interim Final Rule</TTBL_ACTION>\n                <TTBL_DATE>09/00/2026</TTBL_DATE>",
                      "<TTBL_ACTION>Interim Final Rule</TTBL_ACTION>\n                <TTBL_DATE>09/01/2026</TTBL_DATE>"),
    })
    spring = rp.parse_agenda(nxt_xml, rp.Edition("202604", "Spring 2026"))
    p3 = rp.plan(rp.stored_rows(db), rp.collect(fixture_get(), rp.stored_rows(db), "2026-12-11", agenda=spring,
                                                sleep=lambda _s: None).facts, now + 2000)
    rp.write(db, p3, now + 2000)
    rows = rp.stored_rows(db)
    steps3 = sorted((e["rin"], e["on_date"]) for e in p3.events if e["kind"] == "agenda")
    check("a new edition is a step only where the printed next step changed",
          steps3 == [("1205-AC29", "2026-12-10"), ("1615-AC67", "2026-12-10")], str(steps3))
    check("its listing replaces the last, a next action it no longer names included",
          rows["1205-AC29"]["a_next_date"] == "01/00/2027" and rows["1205-AC29"]["a_edition"] == "Spring 2026"
          and rows["1615-AC67"]["a_next_action"] is None and rows["1615-AC67"]["a_listed"] == "2026-12-10")
    check("a rule listed the same keeps the edition it was last listed differently in",
          rows["1615-AD14"]["a_edition"] == "Spring 2026" and rows["1615-AD14"]["a_listed"] == "2026-07-03")
    p4 = rp.plan(rp.stored_rows(db), {"1205-AC29": [a.listings["1205-AC29"]]}, now + 3000)
    check("an older edition never replaces a newer one", not p4.writes and not p4.events)

    # The same edition reissued under the same date with a new date for one rule.
    reissued = rp.parse_agenda(edition_xml("202604", "2026-12-10", edits={
        "1205-AC29": ("<TTBL_DATE>07/00/2026</TTBL_DATE>", "<TTBL_DATE>02/00/2027</TTBL_DATE>")}),
        rp.Edition("202604", "Spring 2026"))
    p5 = rp.plan(rp.stored_rows(db), {"1205-AC29": [reissued.listings["1205-AC29"]]}, now + 4000)
    rp.write(db, p5, now + 4000)
    ev = rp.query_dicts(db, "SELECT detail FROM rule_pipeline_events WHERE rin = '1205-AC29' AND kind = 'agenda' "
                            "AND on_date = '2026-12-10'")
    check("a reissued edition rewrites its own step rather than adding one",
          len(ev) == 1 and json.loads(ev[0]["detail"])["date"] == "02/00/2027", str(ev))

    # A rule whose interim final rule came out years ago is asked about again
    # while an agenda dated after it still lists the final rule.
    old_ifr = {"rin": "1615-AC67", "final_published": "2022-03-29"}
    g = fixture_get()
    rp.collect(g, {"1615-AC67": old_ifr}, "2026-10-27", sleep=lambda _s: None)
    check("a rule finished long ago isn't asked about", not any("%221615-AC67%22" in u for u in g.asked))
    g = fixture_get()
    rp.collect(g, {"1615-AC67": old_ifr}, "2026-10-27", agenda=a, sleep=lambda _s: None)
    check("unless the agenda after it still lists its final step", any("%221615-AC67%22" in u for u in g.asked))
    check("an agenda listing a long-term rule with no next step isn't still on its way",
          not rp.agenda_active(a.listings["1615-AC49"]) and rp.agenda_active(a.listings["1615-AD14"])
          and not rp.agenda_active(a.listings["1615-AC85"]))

    # A rule only the agenda names is asked of the Register once a day.
    quiet_rows = rp.stored_rows(db)
    g = fixture_get()
    rp.collect(g, quiet_rows, "2026-12-11", sleep=lambda _s: None, ask_quiet=False)
    check("a rule only the agenda names isn't asked about on every run",
          not any("%221615-AD14%22" in u for u in g.asked) and any("%221205-AC29%22" in u for u in g.asked)
          and sum("documents.json" in u for u in g.asked) == 4,  # 1205-AC29, 1205-AC30, 1615-AD00, 1615-AD25
          str([u.split("%22")[1] for u in g.asked if "documents.json" in u]))
    g = fixture_get()
    rp.collect(g, quiet_rows, "2026-12-11", sleep=lambda _s: None, follow=("1615-AD14",), ask_quiet=False)
    check("unless it's followed by hand", any("%221615-AD14%22" in u for u in g.asked))

    # --- a whole run, and its trouble ---
    import contextlib
    import io as _io

    def whole_run(db, overrides=None, force=False):
        out = _io.StringIO()
        with contextlib.redirect_stdout(out):
            code = rp.run(db, fixture_get(overrides), "2026-10-27", force_agenda=force, sleep=lambda _s: None)
        last = rp.query_dicts(db, "SELECT status, note FROM ingest_runs ORDER BY id DESC LIMIT 1")[0]
        try:
            fresh = {r["dataset"]: r for r in rp.query_dicts(db, "SELECT dataset, as_of, max_age_days FROM data_freshness")}
        except Exception as exc:  # a run that stamped nothing never made the table
            if "no such table" not in str(exc):
                raise
            fresh = {}
        return code, last, fresh, out.getvalue()

    run_db = FakeDb()
    run_db.execute(old_ddl)  # the live table as it was before the agenda
    code, last, fresh, out = whole_run(run_db)
    check("a run adds the agenda's columns to the live table before writing",
          "a_next_date" in rp.stored_rows(run_db).get("1205-AC29", {}))
    check("a run reads the agenda, stamps it with the edition's date, and records it",
          code == 0 and last["status"] == "ok" and fresh.get("rule-pipeline-agenda", {}).get("as_of") == "2026-07-03"
          and str(fresh["rule-pipeline-agenda"]["max_age_days"]) == "310" and "2026 agenda read" in last["note"],
          f"{code} {last} {fresh}")
    def quiet_asked(db):
        g = fixture_get()
        with contextlib.redirect_stdout(_io.StringIO()):
            rp.run(db, g, "2026-10-27", sleep=lambda _s: None)
        return any("%221615-AD14%22" in u for u in g.asked)
    check("a second run the same day leaves the agenda's quiet rules alone", not quiet_asked(run_db))
    check("the next day asks about them again",
          (run_db.execute("UPDATE perm_docs SET json = '{\"day\":\"2026-10-26\"}' WHERE key = ?", [rp.QUIET_DOC]) or True)
          and quiet_asked(run_db))
    doc = rp.read_doc(run_db, rp.AGENDA_DOC) or {}
    check("the run keeps which edition it read", doc.get("pub_id") == "202510" and doc.get("counts", {}).get("1615") == 7,
          json.dumps(doc))
    code, last, fresh, out = whole_run(run_db, overrides={rp.AGENDA_REPORTS: RuntimeError("reginfo.gov did not answer")})
    check("reginfo down is a warning: the run stays ok and says why",
          code == 0 and last["status"] == "ok" and "::warning::Unified Agenda unread" in out
          and "Unified Agenda unread" in last["note"], f"{code} {last} {out[-300:]}")
    check("and nothing about the agenda is written", (rp.read_doc(run_db, rp.AGENDA_DOC) or {}).get("checked_at") == doc.get("checked_at"))
    fresh_db = FakeDb()
    code, last, fresh, out = whole_run(fresh_db, overrides={"REGINFO_RIN_DATA_202510": no_dol})
    check("a file with an agency's rules missing exits 1, names it, and still writes OIRA's facts",
          code == 1 and last["status"] == "partial" and "Employment and Training Administration" in last["note"]
          and "::error::" in out and "1205-AC29" in rp.stored_rows(fresh_db) and "rule-pipeline-agenda" not in fresh,
          f"{code} {last} {sorted(fresh)}")
    # OIRA down (Oct 30 2026): a warning, never a red run, and nothing written.
    down_db = FakeDb()
    code, last, fresh, out = whole_run(down_db, overrides={rp.OIRA_UNDER_REVIEW: RuntimeError("www.reginfo.gov did not answer: HTTP Error 502")})
    check("OIRA down is a warning: the run stays ok, says why, and writes nothing",
          code == 0 and last["status"] == "ok" and "::warning::OIRA unread" in out and "502" in last["note"]
          and not rp.stored_rows(down_db) and "rule-pipeline" not in fresh, f"{code} {last} {sorted(fresh)}")
    code, last, fresh, out = whole_run(FakeDb(), overrides={rp.OIRA_COMPLETED: b"<!DOCTYPE html><html><body>Site maintenance</body></html>"})
    check("so is a maintenance page in place of OIRA's list", code == 0 and last["status"] == "ok" and "web page" in last["note"],
          f"{code} {last}")
    check("but a file that answers and isn't OIRA's list still fails the run",
          raises(lambda: whole_run(FakeDb(), overrides={rp.OIRA_UNDER_REVIEW: b"<?xml version='1.0'?><OTHER/>"}), ValueError) is not None)
    check("a defect while reading the agenda crashes the run",
          raises(lambda: whole_run(FakeDb(), overrides={rp.AGENDA_REPORTS: TypeError("bug")}), TypeError) is not None)


def main() -> int:
    rp.REGISTER_PAUSE_S = 0
    rp.AGENDA_PAUSE_S = 0
    # --- which rules ---------------------------------------------------------
    check("every USCIS rule is followed", rp.relevant("1615-AD25", "Amending the Premium Processing Timeframe"))
    check("a PERM rule from ETA is followed", rp.relevant(
        "1205-AC29", "Modernizing the Labor Market Test and Improving Protections for U.S. Workers in the PERM Immigrant Visa Program"))
    check("ETA's apprenticeship rule is not", not rp.relevant(
        "1205-AC21", "Prohibiting Illegal Discrimination in Registered Apprenticeship Programs"))
    check("WHD's contractor rule is not", not rp.relevant(
        "1235-AA46", "Employee or Independent Contractor Status Under the Fair Labor Standards Act"))
    check("WHD's H-2A enforcement would be", rp.relevant("1235-AA99", "Enforcement of H-2A Worker Protections"))
    check("State's arms rule is not", not rp.relevant("1400-AE73", "International Traffic in Arms Regulations: USML Categories IV and XV"))
    check("State's visa rule is", rp.relevant("1400-AF99", "Visas: Documentation of Immigrants"))
    check("a CBP customs rule is not", not rp.relevant("1685-AA38", "Low-Value Shipments"))
    check("a DHS rule on parole is", rp.relevant("1601-AB99", "Parole in Place for Certain Noncitizens"))
    check("ERISA rules are not", not rp.relevant("1210-AC21", "Exemption for Certain Automatic Portability Transactions"))
    check("another department is not", not rp.relevant("0570-AB13", "Visa rule in the wrong department"))

    # --- OIRA ----------------------------------------------------------------
    done = rp.parse_oira((FIX / "EO_RULE_COMPLETED_30_DAYS.xml").read_bytes())
    under = rp.parse_oira((FIX / "EO_RULES_UNDER_REVIEW.xml").read_bytes())
    check("OIRA's run date is read", done.rundate == "2026-10-27" and under.rundate == "2026-10-27", str(done.rundate))
    ac29 = next(r for r in done.reviews if r["rin"] == "1205-AC29")
    check("1205-AC29 reads as OIRA printed it", ac29 == {
        "rin": "1205-AC29",
        "title": "Modernizing the Labor Market Test and Improving Protections for U.S. Workers in the PERM Immigrant Visa Program (NPRM)",
        "stage": "Proposed Rule", "received": "2026-09-14", "completed": "2026-10-23",
        "decision": "Consistent with Change", "published": None, "major": "Yes", "significant": "No",
    }, json.dumps(ac29))
    pending = next(r for r in under.reviews if r["rin"] == "1615-AD00")
    check("a rule under review has no completion", pending["completed"] is None and pending["decision"] is None
          and pending["received"] == "2026-08-24" and pending["major"] is None)
    for bad, why in ((b"<html><body>Service unavailable</body></html>", "an error page"),
                     (b'<?xml version="1.0"?><!DOCTYPE x [<!ENTITY a "aa">]><OIRA_DATA RUNDATE="2026-10-27"></OIRA_DATA>',
                      "an entity declaration")):
        try:
            rp.parse_oira(bad)
            check(f"refuses {why}", False)
        except Exception:  # noqa: BLE001
            check(f"refuses {why}", True)

    # --- public inspection ---------------------------------------------------
    listing = json.loads((FIX / "public_inspection.json").read_bytes())
    cands = rp.inspection_candidates(listing)
    check("only kept rules and proposed rules with a filing time are inspection candidates",
          [c["document_number"] for c in cands] == ["2026-99901"], str([c["document_number"] for c in cands]))
    check("a RIN line is read", rp.rins_in((FIX / "pi_2026-99901.txt").read_text()) == ["1205-AC29"])
    check("two RINs on one line are both read", rp.rins_in("RINs 1615-AC70 and 1615-AC71\n") == ["1615-AC70", "1615-AC71"])
    check("a RIN-shaped number in the body is not", rp.rins_in("RIN: none\n" + "x" * 100 + " 1615-AC70") == [])
    pf = rp.inspection_facts(cands[0])
    check("the filing day is Eastern", pf["pi_filed"] == "2026-10-28" and pf["pi_scheduled"] == "2026-10-29", json.dumps(pf))
    check("a late-evening filing is still that Eastern day", rp.eastern_day("2026-10-29T03:30:00.000Z") == "2026-10-28")

    # --- the Register --------------------------------------------------------
    ac30 = rp.register_facts("1205-AC30", json.loads((FIX / "fr_1205-AC30.json").read_bytes()))
    check("a published proposal and its comment deadline are read, the Agenda notices are not", ac30 == {
        "proposed_document": "2026-06017", "proposed_published": "2026-03-27",
        "proposed_url": ac30.get("proposed_url"), "proposed_citation": "91 FR 15454",
        "comments_close": "2026-05-26",
        "title": "Improving Wage Protections for the Temporary and Permanent Employment of Certain Foreign Nationals in the United States",
    } and "2026-06017" in (ac30.get("proposed_url") or ""), json.dumps(ac30))
    ac70 = rp.register_facts("1615-AC70", json.loads((FIX / "fr_1615-AC70.json").read_bytes()))
    check("the newest final rule under a RIN is the final rule", ac70.get("final_document") == "2024-29354"
          and ac70.get("final_published") == "2024-12-18" and ac70.get("effective_on") == "2025-01-17", json.dumps(ac70))
    check("its proposal is the first proposed rule", ac70.get("proposed_published") == "2023-10-23"
          and ac70.get("comments_close") == "2023-12-22")
    corrected = {"results": [
        {"document_number": "A", "regulation_id_numbers": ["1615-AD25"], "type": "Proposed Rule",
         "publication_date": "2026-11-02", "comments_close_on": "2027-01-02", "correction_of": None},
        {"document_number": "B", "regulation_id_numbers": ["1615-AD25"], "type": "Proposed Rule",
         "publication_date": "2026-11-20", "comments_close_on": "2027-02-01", "correction_of": None},
        {"document_number": "C", "regulation_id_numbers": ["1615-AD25"], "type": "Proposed Rule",
         "publication_date": "2026-11-05", "comments_close_on": "2027-03-01",
         "correction_of": "https://www.federalregister.gov/api/v1/documents/A"},
    ]}
    # The Unified Agenda is filed as a proposed rule and names every RIN in its
    # text, but its own RIN list is empty (2024-00454 in the 1615-AC70 answer).
    corrected["results"].insert(0, {"document_number": "AGENDA", "regulation_id_numbers": [], "type": "Proposed Rule",
                                    "publication_date": "2026-08-14", "comments_close_on": "2027-06-01",
                                    "correction_of": None})
    cf = rp.register_facts("1615-AD25", corrected)
    check("an extension moves the deadline and a correction moves nothing", cf.get("proposed_document") == "A"
          and cf.get("comments_close") == "2027-02-01", json.dumps(cf))
    check("nothing published reads as no facts", rp.register_facts("1205-AC29", {"count": 0}) == {})

    # --- one run, then a second ----------------------------------------------
    db = FakeDb()
    for sql in rp.DDL:
        db.execute(sql)
    get = fixture_get()
    read = rp.collect(get, rp.stored_rows(db), "2026-10-27")
    check("the rules followed are the relevant ones", sorted(read.facts) == ["1205-AC29", "1615-AD00", "1615-AD25"],
          str(sorted(read.facts)))
    check("OIRA, inspection and every followed RIN were asked, nothing else",
          sum("documents.json" in u for u in get.asked) == 3 and rp.PUBLIC_INSPECTION in get.asked, str(get.asked))
    p = rp.plan(rp.stored_rows(db), read.facts, 1_793_100_000_000)
    rp.write(db, p, 1_793_100_000_000)
    rows = rp.stored_rows(db)
    r = rows["1205-AC29"]
    check("1205-AC29 is stored as received Sep 14, cleared Oct 23 with change, major, not published",
          r["p_received"] == "2026-09-14" and r["p_completed"] == "2026-10-23"
          and r["p_decision"] == "Consistent with Change" and r["major"] == "Yes"
          and r["proposed_published"] is None and r["final_published"] is None
          and r["agency"] == "DOL's Employment and Training Administration", json.dumps(r))
    check("its public inspection filing is stored against it", r["pi_document"] == "2026-99901"
          and r["pi_filed"] == "2026-10-28" and r["pi_type"] == "Proposed Rule")
    kinds = sorted((e["rin"], e["kind"], e["on_date"]) for e in p.events)
    check("each dated fact is one step", kinds == [
        ("1205-AC29", "oira-completed", "2026-10-23"), ("1205-AC29", "oira-received", "2026-09-14"),
        ("1205-AC29", "public-inspection", "2026-10-28"),
        ("1615-AD00", "oira-received", "2026-08-24"), ("1615-AD25", "oira-received", "2026-10-13"),
    ], str(kinds))

    db.writes = 0
    again = rp.collect(fixture_get(), rp.stored_rows(db), "2026-10-27")
    p2 = rp.plan(rp.stored_rows(db), again.facts, 1_793_100_600_000)
    n2 = rp.write(db, p2, 1_793_100_600_000)
    check("a second run writes nothing", n2 == 0 and db.writes == 0 and not p2.writes and not p2.events,
          f"{n2} {db.writes}")

    # A day later the completed list has forgotten nothing yet, but the public
    # inspection filing is gone and the proposal is in the Register.
    published = {"results": [{"document_number": "2026-99901", "regulation_id_numbers": ["1205-AC29"],
                              "type": "Proposed Rule", "publication_date": "2026-10-29",
                              "comments_close_on": "2026-12-28", "html_url": "https://www.federalregister.gov/d/2026-99901",
                              "citation": "91 FR 60001", "correction_of": None}]}
    later = rp.collect(fixture_get({
        rp.PUBLIC_INSPECTION: json.dumps({"count": 0, "results": []}).encode(),
        "%221205-AC29%22": json.dumps(published).encode(),
    }), rp.stored_rows(db), "2026-10-29")
    p3 = rp.plan(rp.stored_rows(db), later.facts, 1_793_200_000_000)
    rp.write(db, p3, 1_793_200_000_000)
    r3 = rp.stored_rows(db)["1205-AC29"]
    check("a fact a feed has forgotten is kept", r3["pi_filed"] == "2026-10-28" and r3["p_completed"] == "2026-10-23")
    check("publication is a step with its comment deadline stored", r3["proposed_published"] == "2026-10-29"
          and r3["comments_close"] == "2026-12-28"
          and [(e["kind"], e["on_date"]) for e in p3.events] == [("proposed-published", "2026-10-29")], str(p3.events))

    # Months on, the final rule goes to OIRA: the proposal's review stays.
    final_review = {"rin": "1205-AC29", "title": "Modernizing the Labor Market Test", "stage": "Final Rule",
                    "received": "2027-05-03", "completed": None, "decision": None, "published": None,
                    "major": None, "significant": "No"}
    p4 = rp.plan(rp.stored_rows(db), {"1205-AC29": [rp.review_facts(final_review)]}, 1_800_000_000_000)
    rp.write(db, p4, 1_800_000_000_000)
    r4 = rp.stored_rows(db)["1205-AC29"]
    check("the final rule's review doesn't erase the proposal's", r4["p_received"] == "2026-09-14"
          and r4["f_received"] == "2027-05-03" and r4["f_stage"] == "Final Rule" and r4["major"] == "Yes"
          and r4["title"].startswith("Modernizing the Labor Market Test and"), json.dumps(r4))

    # A source after OIRA failing costs its facts, never the run.
    broken = rp.collect(fixture_get({rp.PUBLIC_INSPECTION: RuntimeError("down")}), {}, "2026-10-27")
    check("public inspection down is a note, and OIRA's facts still stand",
          "1205-AC29" in broken.facts and any("public inspection" in n for n in broken.notes), str(broken.notes))
    try:
        rp.collect(fixture_get({rp.OIRA_UNDER_REVIEW: b"<OIRA_DATA RUNDATE='2026-10-27'></OIRA_DATA>"}), {}, "2026-10-27")
        check("an empty under-review list fails the run", False)
    except ValueError:
        check("an empty under-review list fails the run", True)

    agenda_checks()

    print(f"\n{len(FAILS)} failed" if FAILS else "\nall passed")
    return 1 if FAILS else 0


if __name__ == "__main__":
    sys.exit(main())
