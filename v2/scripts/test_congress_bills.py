#!/usr/bin/env python3
"""The congress.gov bill reader, on real SQLite.

    python3 scripts/test_congress_bills.py

The fixtures (fixtures/data_gov/congress_bills_page*.json) are 34 of the bills
congress.gov's list answered on Oct 27 2026, regrouped into two pages. No
request leaves the machine: every answer comes from a stand-in transport.
"""
from __future__ import annotations

import io
import json
import os
import sys
import urllib.error
import urllib.parse

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
os.environ.pop("REVALIDATE_SECRET", None)  # no call to the site from a test
os.environ.pop("DATA_GOV_API_KEY", None)
import ingest_congress_bills as c  # noqa: E402
import lib_data_gov as dg  # noqa: E402
from lib_db import query_dicts, read_doc, write_doc  # noqa: E402
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


P1, P2 = fixture("congress_bills_page1.json"), fixture("congress_bills_page2.json")
ALL = P1["bills"] + P2["bills"]
KEPT = {"bill-119-hr-2315", "bill-119-s-2886", "bill-119-s-2759", "bill-119-s-1233"}


def by(t: str, n: str) -> dict:
    return next(b for b in ALL if b["type"] == t and b["number"] == n)


class Net:
    """congress.gov's list, from the fixtures: page one at offset 0, the last
    page at any other. Records every address and header; can be told to fail."""

    def __init__(self, pages=(P1, P2), fail=None):
        self.pages = [json.loads(json.dumps(p)) for p in pages]
        self.calls: list[tuple[str, dict]] = []
        self.fail = fail

    def offsets(self) -> list[int]:
        return [int(urllib.parse.parse_qs(urllib.parse.urlsplit(u).query)["offset"][0]) for u, _ in self.calls]

    def __call__(self, url: str, headers: dict):
        self.calls.append((url, headers))
        if self.fail is not None:
            raise self.fail() if callable(self.fail) else self.fail
        off = int(urllib.parse.parse_qs(urllib.parse.urlsplit(url).query)["offset"][0])
        page = self.pages[0] if off == 0 else self.pages[-1]
        return 200, {"x-ratelimit-remaining": "900"}, json.dumps(page).encode()


def http_error(code: int, body: bytes = b"") -> urllib.error.HTTPError:
    return urllib.error.HTTPError("https://api.congress.gov/v3/bill/119", code, "x", {}, io.BytesIO(body))


def run(db, net, *, key="test-key-not-real", budget=None, **kw) -> int:
    return c.run(db, client=dg.Client(key=key, budget=budget, opener=net, log=lambda m: None), today=TODAY, **kw)


def notices(db) -> dict[str, dict]:
    try:
        return {r["document_number"]: r for r in query_dicts(db, "SELECT * FROM policy_notices", typed=True)}
    except Exception:  # noqa: BLE001 - no table is no rows
        return {}


def last_run(db) -> dict:
    return query_dicts(db, "SELECT status, rows_written, note FROM ingest_runs ORDER BY id DESC LIMIT 1", typed=True)[0]


def main() -> int:
    # --- the keep rule, on real titles --------------------------------------------
    for t, n in (("HR", "2315"), ("S", "2886"), ("S", "2759"), ("S", "1233")):
        b = by(t, n)
        check(f"keeps {t} {n}: {b['title']}", c.keeps(b["title"], b["type"]))
    for t, n in (("HR", "10896"), ("HR", "218"), ("HR", "9177"), ("HR", "251"), ("S", "3702"), ("S", "3857"),
                 ("S", "1937"), ("HR", "10879"), ("HR", "6213"), ("S", "2354")):
        b = by(t, n)
        check(f"leaves out {t} {n}: {b['title'][:70]}", not c.keeps(b["title"], b["type"]))
    kept = {c.bill_row(b)["document_number"] for b in ALL if c.keeps(b["title"], b["type"])}
    check("of the 34 real bills, exactly the four on the subject", kept == KEPT, str(sorted(kept)))
    check("a resolution isn't kept, whatever its title", not c.keeps("Healthcare Workforce Resilience Act", "HRES"))
    # Short tokens, by their capitals (constructed titles).
    check("H-1B in a title", c.keeps("H-1B and L-1 Visa Reform Act", "S"))
    check("PERM in capitals", c.keeps("To reform the PERM labor certification process", "HR"))
    check("a lower-case word perm isn't PERM", not c.keeps("A bill on perm hair products", "HR"))
    check("OPT in capitals", c.keeps("To end the OPT program", "HR"))
    check("opt out isn't OPT", not c.keeps("To let States opt out of a grant", "HR"))
    check("per-country caps", c.keeps("To eliminate the per-country numerical limitation", "HR"))
    check("EB-5", c.keeps("EB-5 Reform and Integrity Act", "S"))
    check("prevailing wage only beside a visa", c.keeps("To set the prevailing wage for H-1B nonimmigrants", "HR")
          and not c.keeps("To set prevailing wages on federal construction contracts", "HR"))

    # --- small parts ------------------------------------------------------------------
    for day, want in (("2025-01-02", 118), ("2025-01-03", 119), ("2026-10-27", 119), ("2027-01-02", 119),
                      ("2027-01-03", 120), ("2028-06-01", 120), ("2029-01-03", 121)):
        check(f"the Congress on {day} is the {c.ordinal(want)}", c.current_congress(day) == want, str(c.current_congress(day)))
    check("ordinals as congress.gov spells them",
          [c.ordinal(n) for n in (119, 120, 121, 122, 123, 111, 112, 113)] ==
          ["119th", "120th", "121st", "122nd", "123rd", "111th", "112th", "113th"])
    check("a House bill's page", c.bill_url(119, "HR", "2315") == "https://www.congress.gov/bill/119th-congress/house-bill/2315")
    check("a Senate bill's page", c.bill_url(119, "s", "1233") == "https://www.congress.gov/bill/119th-congress/senate-bill/1233")
    row = c.bill_row(by("HR", "2315"))
    check("a bill's row", row["document_number"] == "bill-119-hr-2315" and row["type"] == "Bill"
          and row["publication_date"] == "2025-03-25" and row["agencies"] == ["House"]
          and row["dates"] == "2025-03-25" and row["action"] and row["title"] == "Fairness for High-Skilled Americans Act of 2025",
          str(row))
    try:
        c.parse_page({"bill": []})
        check("an answer with no bills list is a changed shape", False)
    except c.LostStructure:
        check("an answer with no bills list is a changed shape", True)

    # --- a first run, an unchanged one, and a new latest action ---------------------------
    db = SqliteTurso()
    net = Net()
    code = run(db, net)
    got = notices(db)
    check("a first run exits 0", code == 0, str(code))
    check("it reads both pages, one request each", len(net.calls) == 2 and net.offsets() == [0, 20], str(net.offsets()))
    u = urllib.parse.parse_qs(urllib.parse.urlsplit(net.calls[0][0]).query)
    check("oldest update first, from a week back, 250 a page",
          u.get("sort") == ["updateDate asc"] and u.get("fromDateTime") == ["2026-10-20T00:00:00Z"] and u.get("limit") == ["250"],
          str(u))
    check("the key goes in the header, never the address",
          all("test-key-not-real" not in a and h.get("X-Api-Key") == "test-key-not-real" for a, h in net.calls))
    check("it writes the four bills on the subject, as Bills from congress",
          set(got) == KEPT and all(r["type"] == "Bill" and r["source"] == "congress" for r in got.values()), str(sorted(got)))
    check("each with its congress.gov page and its chamber",
          got["bill-119-s-1233"]["html_url"] == "https://www.congress.gov/bill/119th-congress/senate-bill/1233"
          and json.loads(got["bill-119-s-1233"]["agencies"]) == ["Senate"])
    cur = read_doc(db, c.CURSOR_KEY)
    check("the cursor moves to the newest update day", cur == {"congress": 119, "from": "2026-10-27", "offset": 0}, str(cur))
    fresh = query_dicts(db, "SELECT as_of FROM data_freshness WHERE dataset = 'policy-notices-congress'", typed=True)
    check("its freshness row is the newest update day", fresh and fresh[0]["as_of"] == "2026-10-27", str(fresh))

    net2 = Net()
    run(db, net2)
    u = urllib.parse.parse_qs(urllib.parse.urlsplit(net2.calls[0][0]).query)
    check("the next run starts at the cursor", u.get("fromDateTime") == ["2026-10-27T00:00:00Z"], str(u))
    fetched = {n: r["fetched_at"] for n, r in notices(db).items()}
    check("an unchanged run writes nothing", fetched == {n: r["fetched_at"] for n, r in got.items()})

    moved = Net()
    b = next(x for x in moved.pages[1]["bills"] if x["number"] == "1233")
    b["latestAction"] = {"actionDate": "2026-10-27", "text": "Committee on the Judiciary. Hearings held."}
    run(db, moved)
    after = notices(db)
    check("a new latest action is written", after["bill-119-s-1233"]["action"] == "Committee on the Judiciary. Hearings held."
          and after["bill-119-s-1233"]["dates"] == "2026-10-27", str(after["bill-119-s-1233"]))
    check("and only that bill", sum(after[n]["fetched_at"] != fetched[n] for n in KEPT) == 1)
    check("the run counts it", last_run(db)["rows_written"] == 1, str(last_run(db)))

    # A kept title with no introduced date is left out with a warning, not a crash.
    db_n = SqliteTurso()
    bare = Net()
    for x in bare.pages[0]["bills"]:
        if x["number"] == "2315":
            x.pop("introducedDate")
    run(db_n, bare)
    check("a bill with no introduced date is left out", "bill-119-hr-2315" not in notices(db_n)
          and len(notices(db_n)) == 3, str(sorted(notices(db_n))))

    # --- the budget stops a run, and the next one carries on ---------------------------------
    db2 = SqliteTurso()
    net3 = Net()
    code = run(db2, net3, budget=1)
    cur = read_doc(db2, c.CURSOR_KEY)
    check("a spent budget stops the run, exit 0", code == 0 and len(net3.calls) == 1, str(len(net3.calls)))
    check("what it read is written", set(notices(db2)) == {"bill-119-hr-2315"}, str(sorted(notices(db2))))
    check("the cursor keeps its day and moves past the page read",
          cur == {"congress": 119, "from": "2026-10-20", "offset": 20}, str(cur))
    check("the run is ok, with the stop in its note", last_run(db2)["status"] == "ok"
          and "stopped" in (last_run(db2)["note"] or ""), str(last_run(db2)))
    write_doc(db2, c.CURSOR_KEY, {"congress": 119, "from": "2026-10-20", "offset": 250})
    net4 = Net()
    run(db2, net4)
    check("a resumed run steps back OVERLAP bills", net4.offsets()[0] == 250 - c.OVERLAP, str(net4.offsets()))
    write_doc(db2, c.CURSOR_KEY, {"congress": 118, "from": "2024-12-01", "offset": 500})
    net5 = Net()
    run(db2, net5)
    u = urllib.parse.parse_qs(urllib.parse.urlsplit(net5.calls[0][0]).query)
    check("a new Congress starts its own list", "/bill/119?" in net5.calls[0][0] and net5.offsets()[0] == 0
          and u.get("fromDateTime") == ["2026-10-20T00:00:00Z"], str(net5.calls[0][0]))

    # --- trouble -----------------------------------------------------------------------
    db3 = SqliteTurso()
    db3.execute(c.DOCS_DDL)
    write_doc(db3, c.CURSOR_KEY, {"congress": 119, "from": "2026-10-25", "offset": 500})
    code = run(db3, Net(fail=lambda: http_error(429)))
    check("a 429 is recorded ok, exit 0", code == 0 and last_run(db3)["status"] == "ok"
          and "429" in (last_run(db3)["note"] or ""), str(last_run(db3)))
    check("and the cursor stays exactly where it was",
          read_doc(db3, c.CURSOR_KEY) == {"congress": 119, "from": "2026-10-25", "offset": 500}, str(read_doc(db3, c.CURSOR_KEY)))
    check("nothing read stamps no freshness",
          not query_dicts(db3, "SELECT name FROM sqlite_master WHERE name = 'data_freshness'"))

    db4 = SqliteTurso()
    code = run(db4, Net(fail=lambda: http_error(403, b'{"error":{"code":"API_KEY_INVALID","message":"x"}}')))
    check("a refused key exits 1 with a failed run", code == 1 and last_run(db4)["status"] == "failed", str(code))
    check("and writes nothing", not notices(db4) and read_doc(db4, c.CURSOR_KEY) is None)

    db5 = SqliteTurso()
    code = run(db5, Net(pages=({"bill": []},)))
    check("a changed shape exits 1, writing nothing", code == 1 and not notices(db5), str(code))

    db6 = SqliteTurso()
    try:
        run(db6, Net(fail=KeyError("bug")))
        check("a code error crashes", False)
    except KeyError:
        check("a code error crashes", True)

    # --- DEMO_KEY, and a dry run ------------------------------------------------------
    db7 = SqliteTurso()
    net7 = Net()
    run(db7, net7, key="")
    check("with no key it runs on DEMO_KEY, and says so in its note",
          all(h.get("X-Api-Key") == dg.DEMO_KEY for _, h in net7.calls) and "on DEMO_KEY" in (last_run(db7)["note"] or ""),
          str(last_run(db7)))
    net8 = Net()
    code = c.run(None, client=dg.Client(key="k", opener=net8, log=lambda m: None), dry_run=True, today=TODAY)
    check("a dry run reads and needs no database", code == 0 and len(net8.calls) == 2, str(code))

    print(f"\n{len(FAILS)} failed" if FAILS else "\nall passed")
    return 1 if FAILS else 0


if __name__ == "__main__":
    sys.exit(main())
