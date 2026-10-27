#!/usr/bin/env python3
"""The rule watch: which rules it follows, what it reads, and when it writes.

    python3 scripts/test_rule_pipeline.py

Fixtures in scripts/fixtures/rule_pipeline/ are OIRA's two lists as published
on Oct 27 2026 (cut to a few rules each), the Federal Register's answers for
two RINs as it gave them that day, and the public inspection list of Oct 26
with one filing added in the API's own shape (a proposal under 1205-AC29;
nothing under that RIN was on public inspection that day).
"""
from __future__ import annotations

import json
import pathlib
import sqlite3
import sys

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import ingest_rule_pipeline as rp  # noqa: E402

FIX = HERE / "fixtures" / "rule_pipeline"
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


def main() -> int:
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

    print(f"\n{len(FAILS)} failed" if FAILS else "\nall passed")
    return 1 if FAILS else 0


if __name__ == "__main__":
    sys.exit(main())
