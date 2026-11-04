"""The followed-case reader (ingest_court_dockets.py): what it keeps, what it never stores, and its trouble paths."""
from __future__ import annotations

import json
import pathlib
import sys
import urllib.error

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import ingest_court_dockets as d  # noqa: E402

failures: list[str] = []


def check(name: str, ok: bool, detail: str = "") -> None:
    print(("PASS  " if ok else "FAIL  ") + name + ("" if ok else f"  {detail}"))
    if not ok:
        failures.append(name)


GOV = "Document filed by Marco Rubio, United States Department of State."
cases = [
    ("OPINION AND ORDER re: 47 MOTION for Summary Judgment. Document filed by Plaintiffs.", "opinion"),
    ("MEMORANDUM OPINION AND ORDER granting the motion.", "opinion"),
    ("CLERK'S JUDGMENT re: 83 Memorandum & Opinion.", "judgment"),
    ("NOTICE OF APPEAL from 84 Clerk's Judgment. " + GOV, "notice of appeal"),
    ("STATUS REPORT. " + GOV + " (Attachments: # 1 Affidavit)", "status report"),
    ("RESPONSE to Motion re: 85 EMERGENCY MOTION to Enforce Judgment. " + GOV + " (Attachments: # 1 Exhibit - Declaration)", "filing with a declaration"),
    ("NOTICE of Second Circuit Stay Order and Request to Defer Consideration. " + GOV, "notice of a stay"),
    ("ORDER denying 99 MOTION to Stay pending appeal.", "order"),
    ("STATUS REPORT. Document filed by Plaintiffs.", None),
    ("DECLARATION of a plaintiff in Support of Motion. Document filed by Plaintiffs.", None),
    ("ORDER granting 130 Letter Motion for Extension of Time to Amend.", None),
    ("LETTER MOTION for Leave to File reply. Document filed by Plaintiffs.", None),
    ("TRANSCRIPT of Proceedings re: CONFERENCE held on 10/14/2026.", None),
    ("ORDER re: 121 Letter,", None),
    ("", None),
]
for text, want in cases:
    check(f"{(want or 'left out'):28} {text[:60]}", d.kind_of(text) == want, repr(d.kind_of(text)))

docket = d.followed()[0]
check("the followed list starts with CLINIC v. Rubio", docket["id"] == 72218277 and docket["short"] == "CLINIC v. Rubio")
for x in d.followed():
    check(f"{x['short']} has every field", all(x.get(k) for k in ("id", "short", "number", "court", "path", "about")))

fx = json.loads((pathlib.Path(__file__).resolve().parent / "fixtures" / "courtlistener_docket_entries.json").read_text())
entries, nxt = d.parse_page(json.dumps(fx))
rows = [r for r in (d.build(e, docket) for e in entries) if r]
check("the saved page keeps its one notice of a stay, and nothing procedural", [r["title"] for r in rows] == ["CLINIC v. Rubio: notice of a stay"], str([r["title"] for r in rows]))
row = rows[0]
check("a kept row is titled from the case's own short name and the entry's kind", row["title"].startswith("CLINIC v. Rubio: "))
check("its abstract is the case's fixed description, never the entry's own words", row["abstract"] == docket["about"])
check("its link is the entry's PDF on CourtListener's storage", row["html_url"].startswith(d.STORAGE))
check("its citation names the docket and the entry", row["citation"] == "No. 1:26-cv-00858, ECF 126", row["citation"])
check("it's dated by the day the entry was filed", row["publication_date"] == "2026-10-19")
names = " ".join(json.dumps(r) for r in rows)
check("no stored row carries a filer's name", "filed by" not in names.lower() and "Rubio, United" not in names)

no_doc = dict(entries[0], description="OPINION AND ORDER re: 47.", recap_documents=[])
check("an entry with no PDF links its docket", d.build(no_doc, docket)["html_url"] == d.SITE + docket["path"])

# Trouble.
got = d.read_dockets([docket], fetch=lambda *a, **k: "{}", sleep=lambda s: None, token=None)
check("no token is a refusal (the docket endpoints answer only a client with one), not a crash", got.status == "refused" and "TOKEN" in got.note)
got = d.read_dockets([docket], fetch=lambda *a, **k: json.dumps({"results": [{"id": 1}]}), sleep=lambda s: None, token="t")
check("an answer missing what every entry has is broken", got.status == "broken")


def refuse(*a, **k):
    raise urllib.error.HTTPError("u", 503, "busy", {}, None)


got = d.read_dockets([docket], fetch=refuse, sleep=lambda s: None, token="t")
check("CourtListener down is a refusal, recorded ok and warned", got.status == "refused" and "503" in got.note)
pages = iter([json.dumps({"results": fx["results"][:2], "next": "page2"}), json.dumps({"results": fx["results"][2:4], "next": None})])
got = d.read_dockets([docket], fetch=lambda *a, **k: next(pages), sleep=lambda s: None, token="t", walk_all={docket["id"]})
check("a first read walks every page", got.requests == 2 and got.entries == 4, f"{got.requests} {got.entries}")
pages = iter([json.dumps({"results": fx["results"][:2], "next": "page2"})])
got = d.read_dockets([docket], fetch=lambda *a, **k: next(pages), sleep=lambda s: None, token="t", walk_all=set())
check("a later read asks only the newest page", got.requests == 1)

print(f"\n  {len(failures)} failure(s)")
sys.exit(1 if failures else 0)
