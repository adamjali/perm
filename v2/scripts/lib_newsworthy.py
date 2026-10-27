"""What moved that a reporter, an attorney or the owner would want to hear about.

One pure function, `newsworthy(inputs, since_ms, now_ms)`, and the reads that
feed it. Five kinds of move, each from a record this site already keeps:

  1. A rule took a step: OIRA received or finished a review, a filing went on
     public inspection, a proposal or a final rule was published
     (`rule_pipeline_events`, written by ingest_rule_pipeline.py).
  2. DOL moved a month on its processing-times page: analyst review, audit
     review, reconsideration, or the PERM wage requests
     (`processing_time_readings`).
  3. A new visa bulletin month reached this site (`bulletin_first_seen`).
  4. DOL moved one employer's cases as a group, a big one: on or off hold, or
     a decision batch (`perm_docs['employer_stages']`), at NEWS_EMPLOYER_MIN
     cases or more.
  5. Our sweep recorded a day of PERM decisions at DECISION_DAY_MULTIPLE
     times a typical weekday or more (`daily_decisions`, sweep-observed).

Each item says what moved, when, and the source, in plain words. The morning
report lists the last 24 hours; the evening check emails the owner what moved
since the morning, and only when something did.
"""
from __future__ import annotations

import datetime as dt
import json
import re
import statistics
from dataclasses import dataclass, field
from zoneinfo import ZoneInfo

ET = ZoneInfo("America/New_York")

# An employer-wide move worth an email: at least this many cases in one day.
NEWS_EMPLOYER_MIN = 50
# A decision day worth an email: this many times the median of the weekdays before it.
DECISION_DAY_MULTIPLE = 2.0
# The weekdays the typical day is measured over, and the fewest it needs.
TYPICAL_WEEKDAYS = 20
TYPICAL_MIN = 10
# A rule step is news only when it happened recently: on the first run the
# rule watch records every step it can read, months old included.
RULE_STEP_RECENT_DAYS = 7

QUEUES = (
    ("Analyst Review", "analyst review"),
    ("Audit Review", "audit review"),
    ("Reconsideration Request to the CO", "reconsideration review"),
)
MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August",
          "September", "October", "November", "December"]
MONTHS_ABBR = [m[:3] for m in MONTHS]


@dataclass
class Inputs:
    """Everything the check reads, already out of the database."""
    rule_events: list[dict] = field(default_factory=list)  # rin, kind, on_date, detail, seen_at, title, agency, comments_close, effective_on
    readings: list[dict] = field(default_factory=list)  # fetched_at, snapshot (dict), oldest first
    bulletins: list[dict] = field(default_factory=list)  # bulletin_month, first_seen_at
    employer_stages: dict | None = None
    decision_days: list[dict] = field(default_factory=list)  # date, total; any order


def day_label(iso: str | None) -> str:
    if not iso or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", iso):
        return str(iso or "")
    y, m, d = iso.split("-")
    return f"{MONTHS_ABBR[int(m) - 1]} {int(d)}, {y}"


def month_label(ym: str | None) -> str:
    if not ym or not re.fullmatch(r"\d{4}-\d{2}", ym[:7]):
        return str(ym or "")
    return f"{MONTHS[int(ym[5:7]) - 1]} {ym[:4]}"


def clock(ms: int) -> str:
    t = dt.datetime.fromtimestamp(ms / 1000, tz=ET)
    return f"{t.strftime('%-I:%M %p')} {t.tzname()} {MONTHS_ABBR[t.month - 1]} {t.day}"


def et_day(ms: int) -> str:
    return dt.datetime.fromtimestamp(ms / 1000, tz=ET).date().isoformat()


def rule_title(title: str | None, rin: str) -> str:
    t = re.sub(r"\s*\((?:NPRM|ANPRM|SNPRM|IFR|Final Rule|Proposed Rule|Interim Final Rule)\)\s*$", "",
               title or "", flags=re.I).strip()
    return t or f"RIN {rin}"


def rule_sentence(e: dict) -> str:
    """One rule step in words, the same as convex/lib/ruleSteps.ts says it."""
    t = f'"{rule_title(e.get("title"), e["rin"])}"'
    on = day_label(e["on_date"])
    detail = e.get("detail")
    kind = e["kind"]
    if kind == "oira-received":
        return f"{e.get('agency') or 'The agency'} sent {t} to OIRA for review on {on}" + (
            f" ({detail.lower()})." if detail else ".")
    if kind == "oira-completed":
        if re.match(r"withdrawn", detail or "", re.I):
            return f"{t} was withdrawn from OIRA review on {on}."
        return f'OIRA finished its review of {t} on {on}. Its decision: "{detail or "none printed"}".'
    if kind == "public-inspection":
        return f"{t} went on public inspection on {on}, ahead of publication in the Federal Register."
    if kind == "proposed-published":
        closes = e.get("comments_close")
        return f"{t} was published as a proposed rule on {on}" + (
            f"; comments close {day_label(closes)}." if closes else ".")
    if kind == "final-published":
        eff = e.get("effective_on")
        return f"{t} was published as a final rule on {on}" + (
            f"; it takes effect {day_label(eff)}." if eff else ".")
    return f"{t}: {kind} on {on}."


def rule_source(kind: str) -> str:
    return "OIRA's review lists on reginfo.gov" if kind.startswith("oira") else "the Federal Register"


def _rule_items(inputs: Inputs, since_ms: int, now_ms: int) -> list[dict]:
    floor = (dt.datetime.fromtimestamp(now_ms / 1000, tz=ET).date()
             - dt.timedelta(days=RULE_STEP_RECENT_DAYS)).isoformat()
    out = []
    for e in inputs.rule_events:
        if int(e.get("seen_at") or 0) < since_ms or (e.get("on_date") or "") < floor:
            continue
        out.append({"kind": "rule", "when": e["on_date"], "what": rule_sentence(e),
                    "source": rule_source(e["kind"])})
    return out


def _queue_months(snap: dict) -> dict[str, str]:
    """{label: YYYY-MM} for the months the check follows in one DOL reading."""
    months: dict[str, str] = {}
    for q in snap.get("permQueues") or []:
        for name, label in QUEUES:
            if q.get("queue") == name and q.get("priorityDate"):
                months[label] = str(q["priorityDate"])[:7]
    for p in snap.get("pwdQueues") or []:
        if p.get("program") == "PERM":
            if p.get("oewsReceiptDate"):
                months["PERM wage requests (OEWS)"] = str(p["oewsReceiptDate"])[:7]
            if p.get("nonOewsReceiptDate"):
                months["PERM wage requests (non-OEWS)"] = str(p["nonOewsReceiptDate"])[:7]
    return months


def _dol_items(inputs: Inputs, since_ms: int) -> list[dict]:
    out = []
    readings = sorted(inputs.readings, key=lambda r: int(r["fetched_at"]))
    for prev, cur in zip(readings, readings[1:]):
        if int(cur["fetched_at"]) < since_ms:
            continue
        before, after = _queue_months(prev["snapshot"]), _queue_months(cur["snapshot"])
        as_of = cur["snapshot"].get("pwdAsOf") or cur["snapshot"].get("permAsOf")
        for label, month in after.items():
            old = before.get(label)
            if old and old != month:
                is_pwd = label.startswith("PERM wage")
                stamp = cur["snapshot"].get("pwdAsOf" if is_pwd else "permAsOf") or as_of
                verb = "issuing determinations on requests filed in" if is_pwd else "reviewing cases filed in"
                out.append({
                    "kind": "dol", "when": stamp,
                    "what": (f"DOL's {label} moved: DOL is {verb} {month_label(month)}, up from "
                             f"{month_label(old)} (DOL's date: {day_label(stamp)}).") if month > old else (
                        f"DOL's {label} went back: DOL now names {month_label(month)}, where it named "
                        f"{month_label(old)} (DOL's date: {day_label(stamp)})."),
                    "source": "DOL's processing-times page (flag.dol.gov)",
                })
    return out


def _bulletin_items(inputs: Inputs, since_ms: int) -> list[dict]:
    out = []
    for b in inputs.bulletins:
        seen = int(b.get("first_seen_at") or 0)
        if seen >= since_ms:
            out.append({"kind": "bulletin", "when": et_day(seen),
                        "what": (f"The {month_label(b['bulletin_month'])} visa bulletin is out; "
                                 f"this site first held it at {clock(seen)}."),
                        "source": "the State Department's visa bulletin"})
    return out


def _employer_items(inputs: Inputs, since_ms: int) -> list[dict]:
    doc = inputs.employer_stages or {}
    floor = et_day(since_ms)
    out = []
    for m in doc.get("holdMoves") or []:
        if (m.get("date") or "") >= floor and int(m.get("n") or 0) >= NEWS_EMPLOYER_MIN:
            n = int(m["n"])
            what = (f"DOL put {n:,} of {m['name']}'s PERM cases on hold on {day_label(m['date'])}."
                    if m.get("dir") == "on" else
                    f"DOL took {n:,} of {m['name']}'s PERM cases off hold on {day_label(m['date'])}, to {m.get('to') or 'another status'}.")
            out.append({"kind": "employer", "when": m["date"], "what": what,
                        "source": "DOL's case-status search, read by this site's sweep"})
    for m in doc.get("decisionMoves") or []:
        if (m.get("date") or "") >= floor and int(m.get("n") or 0) >= NEWS_EMPLOYER_MIN:
            n = int(m["n"])
            act = {"CERTIFIED": "DOL certified", "DENIED": "DOL denied",
                   "WITHDRAWN": "The employer withdrew"}.get(m.get("to") or "", f"DOL moved to {m.get('to')}")
            out.append({"kind": "employer", "when": m["date"],
                        "what": f"{act} {n:,} of {m['name']}'s PERM cases in one day, {day_label(m['date'])}.",
                        "source": "DOL's case-status search, read by this site's sweep"})
    return out


def typical_weekday(days: list[dict], before: str) -> float | None:
    """The median of the TYPICAL_WEEKDAYS weekdays before `before`, None under TYPICAL_MIN."""
    totals = [int(d["total"]) for d in sorted(days, key=lambda d: d["date"], reverse=True)
              if d["date"] < before and dt.date.fromisoformat(d["date"]).weekday() < 5][:TYPICAL_WEEKDAYS]
    return statistics.median(totals) if len(totals) >= TYPICAL_MIN else None


def _decision_items(inputs: Inputs, since_ms: int) -> list[dict]:
    floor = et_day(since_ms)
    out = []
    for d in inputs.decision_days:
        if d["date"] < floor or dt.date.fromisoformat(d["date"]).weekday() >= 5:
            continue
        usual = typical_weekday(inputs.decision_days, d["date"])
        total = int(d["total"])
        if usual and total >= DECISION_DAY_MULTIPLE * usual:
            out.append({"kind": "decisions", "when": d["date"],
                        "what": (f"Our sweep recorded {total:,} PERM decisions on {day_label(d['date'])}, "
                                 f"{total / usual:.1f} times a typical weekday ({usual:,.0f})."),
                        "source": "DOL's case-status search, read by this site's sweep"})
    return out


def newsworthy(inputs: Inputs, since_ms: int, now_ms: int) -> list[dict]:
    """Every move since `since_ms`, newest first, rules first within a day."""
    items = (_rule_items(inputs, since_ms, now_ms) + _dol_items(inputs, since_ms)
             + _bulletin_items(inputs, since_ms) + _employer_items(inputs, since_ms)
             + _decision_items(inputs, since_ms))
    order = {"rule": 0, "dol": 1, "bulletin": 2, "employer": 3, "decisions": 4}
    items.sort(key=lambda i: (i["when"] or "", -order[i["kind"]]), reverse=True)
    return items


def line(item: dict) -> str:
    """One item as the line the report and the email print."""
    return f"{item['what']} Source: {item['source']}."


# ---------------------------------------------------------------------------
# The reads
# ---------------------------------------------------------------------------

def read_inputs(db, since_ms: int) -> Inputs:
    """Out of the database, bounded by `since_ms`. A missing table reads as empty
    (the rule watch's tables before its first run); any other failure raises."""
    from lib_db import query_dicts  # noqa: PLC0415

    def safe(sql: str, args: list) -> list[dict]:
        try:
            return query_dicts(db, sql, args)
        except Exception as exc:  # noqa: BLE001
            if "no such table" in str(exc).lower():
                return []
            raise

    inputs = Inputs()
    inputs.rule_events = safe(
        "SELECT e.rin, e.kind, e.on_date, e.detail, e.seen_at, r.title, r.agency, r.comments_close, r.effective_on "
        "FROM rule_pipeline_events e JOIN rule_pipeline r ON r.rin = e.rin WHERE e.seen_at >= ? ORDER BY e.on_date",
        [since_ms])
    # The reading before the window too, so the first one in it has something to compare with.
    rows = safe("SELECT fetched_at, json FROM processing_time_readings ORDER BY fetched_at DESC LIMIT 12", [])
    inputs.readings = sorted(({"fetched_at": int(r["fetched_at"]), "snapshot": json.loads(r["json"])} for r in rows),
                             key=lambda r: r["fetched_at"])
    inputs.bulletins = [{"bulletin_month": r["bulletin_month"], "first_seen_at": int(r["first_seen_at"])}
                        for r in safe("SELECT bulletin_month, first_seen_at FROM bulletin_first_seen "
                                      "WHERE first_seen_at >= ?", [since_ms])]
    doc = safe("SELECT json FROM perm_docs WHERE key = 'employer_stages'", [])
    inputs.employer_stages = json.loads(doc[0]["json"]) if doc else None
    inputs.decision_days = [{"date": r["date"], "total": int(r["total"] or 0)} for r in safe(
        "SELECT date, total FROM daily_decisions WHERE source = 'sweep-observed' ORDER BY date DESC LIMIT 45", [])]
    return inputs
