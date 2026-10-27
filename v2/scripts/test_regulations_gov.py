#!/usr/bin/env python3
"""The regulations.gov comment-count reader and the api.data.gov client, on real SQLite.

    python3 scripts/test_regulations_gov.py

The fixtures (fixtures/data_gov/) are regulations.gov's and the Federal
Register's own answers on Oct 27 2026. No request leaves the machine: every
answer comes from a stand-in transport.
"""
from __future__ import annotations

import io
import json
import os
import sys
import urllib.error

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
os.environ.pop("REVALIDATE_SECRET", None)  # no call to the site from a test
os.environ.pop("DATA_GOV_API_KEY", None)
import ingest_regulations_gov as rg  # noqa: E402
import lib_data_gov as dg  # noqa: E402
import lib_policy_feed as pf  # noqa: E402
from lib_db import query_dicts  # noqa: E402
from lib_sqlite_shim import SqliteTurso  # noqa: E402

FIX = os.path.join(HERE, "fixtures", "data_gov")
FAILS: list[str] = []
TODAY = "2026-10-27"


def check(name: str, cond: bool, detail: str = "") -> None:
    print(("PASS " if cond else "FAIL ") + name + (f"  ({detail})" if detail and not cond else ""))
    if not cond:
        FAILS.append(name)


def fixture(name: str) -> dict:
    return json.load(open(os.path.join(FIX, name)))


DOCS = fixture("regs_documents_frdocnum.json")      # 2026-18631 -> USCIS-2026-0364-0001
COMMENTS = fixture("regs_comments_commenton.json")  # 26,697 posted
FR = fixture("fr_regs_info.json")                   # 26,704 / 337 / 3,848


def docs_for(num: str) -> dict:
    """regulations.gov's answer for a number: the real one for 2026-18631, the
    same shape with this number's ids for the others, nothing for 2099-*."""
    if num.startswith("2099-"):
        return {"data": [], "meta": {"totalElements": 0}}
    d = json.loads(json.dumps(DOCS))
    a = d["data"][0]["attributes"]
    if num == "2026-55555":  # a neighbour, not this number
        a.update(frDocNum="2026-55556", objectId="objNear")
        return d
    if num == "2026-66666":  # withdrawn
        a.update(frDocNum=num, objectId="objGone", withdrawn=True)
        return d
    if num == "2026-77777":  # the proposal and a supporting document under one number
        other = json.loads(json.dumps(d["data"][0]))
        other["id"], other["attributes"]["documentType"] = "Z-0002", "Supporting & Related Material"
        other["attributes"].update(frDocNum=num, objectId="objZ2")
        d["data"][0]["id"] = "Z-0003"
        a.update(frDocNum=num, objectId="objZ3", docketId="Z")
        d["data"] = [other, d["data"][0]]
        return d
    if num != "2026-18631":
        a = d["data"][0]["attributes"]
        d["data"][0]["id"] = f"TEST-{num}-0001"
        a.update(frDocNum=num, objectId=f"obj{num}", docketId=f"TEST-{num}")
    return d


class Net:
    """A stand-in transport: records every address and header, answers from
    the fixtures, and can be told to fail."""

    def __init__(self, counts: dict | None = None, fail: dict | None = None, remaining: int | None = 9):
        self.calls: list[tuple[str, dict]] = []
        self.counts = counts or {}
        self.fail = fail or {}
        self.remaining = remaining

    def __call__(self, url: str, headers: dict):
        self.calls.append((url, headers))
        for part, exc in self.fail.items():
            if part in url:
                raise exc() if callable(exc) else exc
        hdrs = {} if self.remaining is None else {"x-ratelimit-remaining": str(self.remaining)}
        if "/documents" in url:
            num = url.split("filter[frDocNum]=")[1].split("&")[0]
            return 200, hdrs, json.dumps(docs_for(num)).encode()
        if "/comments" in url:
            obj = url.split("filter[commentOnId]=")[1].split("&")[0]
            d = json.loads(json.dumps(COMMENTS))
            d["meta"]["totalElements"] = self.counts.get(obj, 26697 if obj == "09000064b951de81" else 12)
            return 200, hdrs, json.dumps(d).encode()
        raise AssertionError(f"unexpected address {url}")


def http_error(code: int, body: bytes = b"") -> urllib.error.HTTPError:
    return urllib.error.HTTPError("https://api.regulations.gov/v4/x", code, "x", {}, io.BytesIO(body))


def open_rule(db, num: str, closes: str, *, type_: str = "Proposed Rule", status: str = "published") -> None:
    pf.write_notices(db, [{"document_number": num, "publication_date": "2026-09-11", "type": type_,
                           "title": f"Rule {num}", "html_url": f"https://www.federalregister.gov/d/{num}",
                           "agencies": ["U.S. Citizenship and Immigration Services"], "topics": [],
                           "comments_close_on": closes, "status": status}], source="federal-register")


def rows(db) -> dict[str, dict]:
    return {r["document_number"]: r for r in query_dicts(db, "SELECT * FROM policy_comment_counts", typed=True)}


def run(db, net, *, budget=None, key=None, fr=None, **kw) -> int:
    client = dg.Client(key=key, budget=budget, opener=net, log=lambda m: None)
    return rg.run(db, client=client, fr_fetch=fr or (lambda url: FR), today=TODAY, **kw)


def freshness(db, dataset: str = "policy-comments") -> list[dict]:
    try:
        return query_dicts(db, "SELECT as_of, max_age_days FROM data_freshness WHERE dataset = ?", [dataset], typed=True)
    except Exception:  # noqa: BLE001 - no table is no row
        return []


def runs(db) -> list[dict]:
    return query_dicts(db, "SELECT status, rows_written, note FROM ingest_runs ORDER BY id", typed=True)


def main() -> int:
    # --- pure parts ---------------------------------------------------------------
    check("regulations.gov's end of day is the Eastern day before", rg.eastern_day_of("2026-11-11T04:59:59Z") == "2026-11-10",
          str(rg.eastern_day_of("2026-11-11T04:59:59Z")))
    url, form = rg.docket_urls("USCIS-2026-0364", "USCIS-2026-0364-0001")
    check("the docket's comments page", url == "https://www.regulations.gov/docket/USCIS-2026-0364/comments", str(url))
    check("the comment form", form == "https://www.regulations.gov/commenton/USCIS-2026-0364-0001", str(form))

    # --- which rules ----------------------------------------------------------------
    db = SqliteTurso()
    open_rule(db, "2026-18631", "2026-11-10")
    open_rule(db, "2026-20941", "2026-11-13")
    open_rule(db, "2026-10000", "2026-10-26")                      # closed yesterday
    open_rule(db, "2026-10001", "2026-12-01", type_="Notice")      # not a proposal
    open_rule(db, "2026-10002", "2026-12-01", status="public-inspection")  # not published yet
    db.execute("CREATE TABLE rule_pipeline (rin TEXT PRIMARY KEY, title TEXT, proposed_document TEXT, comments_close TEXT)")
    db.execute("INSERT INTO rule_pipeline VALUES ('1205-AC29', 'PERM rule', '2026-30000', '2026-12-20')")
    db.execute("INSERT INTO rule_pipeline VALUES ('1615-AD22', 'Grace period', '2026-18631', '2026-11-10')")
    db.execute("INSERT INTO rule_pipeline VALUES ('1615-ZZ00', 'Closed', '2026-10003', '2026-10-01')")
    t = [x["document_number"] for x in rg.targets(db, TODAY)]
    check("open proposals only, the rule watch's too, once each, soonest-closing first",
          t == ["2026-18631", "2026-20941", "2026-30000"], str(t))
    check("no tables is no rules, not a crash", rg.targets(SqliteTurso(), TODAY) == [])
    dbt = SqliteTurso()
    open_rule(dbt, "2026-10027", "2026-10-27")
    check("a rule whose comments close today is still open", [x["document_number"] for x in rg.targets(dbt, TODAY)]
          == ["2026-10027"])

    # --- which regulations.gov document ---------------------------------------------
    dbd = SqliteTurso()
    for num in ("2026-55555", "2026-66666", "2026-77777"):
        open_rule(dbd, num, "2026-11-30")
    run(dbd, Net(), key="k")
    got = rows(dbd)
    check("a neighbouring number isn't this rule", "2026-55555" not in got, str(got.get("2026-55555")))
    check("a withdrawn document isn't counted", "2026-66666" not in got, str(got.get("2026-66666")))
    check("the proposed rule wins over a supporting document under its number",
          got.get("2026-77777", {}).get("regs_document_id") == "Z-0003", str(got.get("2026-77777")))

    # --- a first run, then an unchanged one, then a moved count --------------------------
    net = Net()
    code = run(db, net, key="test-key-not-real")
    got = rows(db)
    check("a first run exits 0", code == 0, str(code))
    check("a first run asks a lookup and a count for each open rule", len(net.calls) == 6, str(len(net.calls)))
    check("it counts what regulations.gov says is posted", got.get("2026-18631", {}).get("comments") == 26697, str(got.get("2026-18631")))
    check("it keeps the docket and the document", got["2026-18631"]["docket_id"] == "USCIS-2026-0364"
          and got["2026-18631"]["regs_document_id"] == "USCIS-2026-0364-0001")
    check("it links the docket's comments", got["2026-18631"]["url"] == "https://www.regulations.gov/docket/USCIS-2026-0364/comments")
    check("it names who counted", got["2026-18631"]["counted_by"] == "regulations.gov")
    check("the end date is the Eastern day", got["2026-18631"]["comment_end"] == "2026-11-10", str(got["2026-18631"]["comment_end"]))
    check("the key goes in the header, never the address",
          all("test-key-not-real" not in u and h.get("X-Api-Key") == "test-key-not-real" for u, h in net.calls))
    fresh = freshness(db)
    check("its freshness row is stamped today", fresh and fresh[0]["as_of"] == TODAY, str(fresh))

    first = {n: r["counted_at"] for n, r in rows(db).items()}
    net2 = Net()
    run(db, net2, key="test-key-not-real", now_ms=2_000_000_000_000)
    check("a second run asks only the counts (the ids are kept)", len(net2.calls) == 3, str(len(net2.calls)))
    check("an unchanged second run writes nothing", {n: r["counted_at"] for n, r in rows(db).items()} == first,
          str(rows(db)))
    net3 = Net(counts={"09000064b951de81": 26750})
    run(db, net3, key="test-key-not-real", now_ms=2_000_000_000_000)
    after = rows(db)
    check("a moved count is written, and only that row",
          after["2026-18631"]["comments"] == 26750 and after["2026-18631"]["counted_at"] == 2_000_000_000_000
          and after["2026-20941"]["counted_at"] == first["2026-20941"], str(after["2026-18631"]))

    # --- not on regulations.gov ------------------------------------------------------------
    db2 = SqliteTurso()
    open_rule(db2, "2099-00001", "2026-11-30")
    open_rule(db2, "2026-18631", "2026-11-10")
    code = run(db2, Net(), key="k")
    check("a rule regulations.gov doesn't hold is skipped, the rest counted",
          code == 0 and set(rows(db2)) == {"2026-18631"}, str(rows(db2)))

    # --- DEMO_KEY: the budget, and the Register's copy for what it didn't reach ------------
    db3 = SqliteTurso()
    for num, closes in (("2026-18631", "2026-11-10"), ("2026-20941", "2026-11-13"),
                        ("2026-20660", "2026-11-09"), ("2026-40000", "2026-11-20")):
        open_rule(db3, num, closes)
    warned: list[str] = []
    client = dg.Client(key="", opener=Net(), log=warned.append)
    check("with no key the client runs on DEMO_KEY", client.demo and client.budget == dg.DEMO_RUN_BUDGET)
    check("and says so in a warning", any("DEMO_KEY" in w for w in warned), str(warned))
    net4 = Net()
    fr_asked: list[str] = []
    every = json.loads(json.dumps(FR))
    every["results"].append({"document_number": "2026-40000", "regulations_dot_gov_info": {
        "docket_id": "TEST-2026-40000", "document_id": "TEST-2026-40000-0001", "comments_count": 55,
        "checked_regulationsdotgov_at": "2026-10-27T13:55:04Z"}})
    code = run(db3, net4, key="", fr=lambda url: fr_asked.append(url) or every)
    got = rows(db3)
    check("a DEMO_KEY run stops at its budget", len(net4.calls) == dg.DEMO_RUN_BUDGET, str(len(net4.calls)))
    check("a stopped run exits 0", code == 0, str(code))
    check("the budget's rules are counted by regulations.gov",
          sorted(n for n, r in got.items() if r["counted_by"] == "regulations.gov") == ["2026-18631", "2026-20660", "2026-20941"],
          str({n: r["counted_by"] for n, r in got.items()}))
    check("what it didn't reach takes the Register's copy, said so",
          got.get("2026-40000", {}).get("comments") == 55 and got["2026-40000"]["counted_by"] == "federalregister.gov",
          str(got.get("2026-40000")))
    check("the Register is asked only for what regulations.gov didn't count",
          len(fr_asked) == 1 and "/2026-40000.json" in fr_asked[0], str(fr_asked))
    check("the run is recorded ok, with the stop in its note",
          runs(db3)[-1]["status"] == "ok" and "stopped" in (runs(db3)[-1]["note"] or ""), str(runs(db3)[-1]))

    # The Register's copy fills only a rule regulations.gov never counted, and loses to it.
    db4 = SqliteTurso()
    open_rule(db4, "2026-18631", "2026-11-10")
    open_rule(db4, "2026-20941", "2026-11-13")
    run(db4, Net(fail={"/documents": lambda: http_error(429)}), key="k")
    got = rows(db4)
    check("a 429 on the first request still fills both from the Register's copy, and nothing else",
          got.get("2026-18631", {}).get("comments") == 26704 and got["2026-18631"]["counted_by"] == "federalregister.gov"
          and set(got) == {"2026-18631", "2026-20941"}, str(got))
    check("the copy says when the Register checked", got["2026-18631"]["source_checked_at"] == "2026-10-27T13:55:04Z",
          str(got["2026-18631"].get("source_checked_at")))
    run(db4, Net(), key="k")
    got = rows(db4)
    check("regulations.gov's own count replaces the copy the first time it answers",
          got["2026-18631"]["comments"] == 26697 and got["2026-18631"]["counted_by"] == "regulations.gov", str(got["2026-18631"]))
    run(db4, Net(fail={"/comments": lambda: http_error(503)}), key="k")
    got = rows(db4)
    check("and is never moved back to the Register's copy",
          got["2026-18631"]["comments"] == 26697 and got["2026-18631"]["counted_by"] == "regulations.gov", str(got["2026-18631"]))
    check("a 503 is recorded ok with the reason", runs(db4)[-1]["status"] == "ok" and "503" in (runs(db4)[-1]["note"] or ""),
          str(runs(db4)[-1]))

    # The gateway's own window: stop before it's spent.
    db5 = SqliteTurso()
    open_rule(db5, "2026-18631", "2026-11-10")
    open_rule(db5, "2026-20941", "2026-11-13")
    net5 = Net(remaining=dg.RESERVE)
    run(db5, net5, key="k")
    check("it stops once the gateway says only the reserve is left", len(net5.calls) == 1, str(len(net5.calls)))

    # --- broken, and defects ----------------------------------------------------------------
    db6 = SqliteTurso()
    open_rule(db6, "2026-18631", "2026-11-10")
    code = run(db6, Net(fail={"/documents": lambda: http_error(403, b'{"error":{"code":"API_KEY_INVALID"}}')}), key="bad")
    check("a refused key exits 1", code == 1, str(code))
    check("and records a failed run, writing nothing", runs(db6)[-1]["status"] == "failed" and not rows(db6), str(runs(db6)))
    db7 = SqliteTurso()
    open_rule(db7, "2026-18631", "2026-11-10")

    class Shapeless(Net):
        def __call__(self, url, headers):
            if "/comments" in url:
                return 200, {}, b'{"data": []}'
            return super().__call__(url, headers)
    code = run(db7, Shapeless(), key="k")
    check("an answer that lost its shape exits 1 and writes nothing", code == 1 and not rows(db7), str(code))
    db8 = SqliteTurso()
    open_rule(db8, "2026-18631", "2026-11-10")
    try:
        run(db8, Net(fail={"/documents": KeyError("bug")}), key="k")
        check("a code error crashes", False)
    except KeyError:
        check("a code error crashes", True)

    # --- nothing open ---------------------------------------------------------------------
    db9 = SqliteTurso()
    net9 = Net()
    code = run(db9, net9, key="k")
    fresh = freshness(db9)
    check("no open rule is a quiet ok run that asks nothing", code == 0 and not net9.calls, str(net9.calls))
    check("and still stamps its freshness", fresh and fresh[0]["as_of"] == TODAY, str(fresh))

    print(f"\n{len(FAILS)} failed" if FAILS else "\nall passed")
    return 1 if FAILS else 0


if __name__ == "__main__":
    sys.exit(main())
