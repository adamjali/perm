"""DOL's recruitment record for a PERM case: Form 9089 Section H.

The new form (filed from June 2023) reports where and when the employer
recruited before filing, and DOL's disclosure file prints it: the state job
order's dates, the newspaper or journal and both ad dates, the dates of each
additional step a professional job needs, and how the notice of filing went
up. Column names read off PERM_Record_Layout_FY2026_Q3.pdf. The old form named
these differently and isn't read.

`scripts/data/recruitment_steps.json` names the additional steps and the notice
methods once, with DOL's column for each and the label every page shows; the
site reads the same file (src/lib/recruitment.ts).
"""
from __future__ import annotations

import datetime as dt
import json
import pathlib
import re

_DATA = json.loads((pathlib.Path(__file__).resolve().parent / "data" / "recruitment_steps.json").read_text())
STEPS: list[dict] = _DATA["steps"]
NOTICE: list[dict] = _DATA["notice"]
# How long before filing the first step ran. 20 C.F.R. § 656.17(e)(1) puts the
# mandatory steps 30 to 180 days before filing, so the bands follow that window.
LEAD_BANDS: list[dict] = _DATA["leadBands"]
STEP_LABEL: dict[str, str] = {s["id"]: s["label"] for s in STEPS}

# The parser's field name -> DOL's header, for COLUMN_CANDIDATES.
COLUMNS: dict[str, list[str]] = {
    "recr_supervised": ["RECR_INFO_RECRUIT_SUPERVISED_REQ"],
    "job_order_start": ["RECR_INFO_JOB_START_DATE"],
    "job_order_end": ["RECR_INFO_JOB_END_DATE"],
    "sunday_edition": ["RECR_INFO_IS_NEWSPAPER_SUNDAY"],
    "ad_type": ["RECR_INFO_RECRUIT_AD_TYPE"],
    "paper1": ["RECR_INFO_NEWSPAPER_NAME"],
    "ad1": ["RECR_INFO_AD_DATE1"],
    "paper2": ["RECR_INFO_NEWSPAPER_NAME2"],
    "ad2": ["RECR_INFO_AD_DATE2"],
    **{f"step_{s['id']}_from": [f"RECR_OCC_{s['column']}_FROM"] for s in STEPS},
    **{f"step_{s['id']}_to": [f"RECR_OCC_{s['column']}_TO"] for s in STEPS},
    **{f"notice_{n['id']}": [n["column"]] for n in NOTICE},
}

# The longest newspaper name kept, past any DOL prints.
PAPER_MAX = 80
# The longest ad-type label kept ("Newspaper of General Circulation").
AD_TYPE_MAX = 40


def _text(v, n: int) -> str | None:
    s = " ".join(str(v or "").split())[:n]
    return None if s.upper() in ("", "N/A", "NA", "NONE", "NULL", "-") else s


def _flag(v) -> str | None:
    s = str(v or "").strip().upper()
    return s if s in ("Y", "N") else None


def recruitment_fields(rec: dict, to_iso) -> dict:
    """One case's recruitment record from a parsed row, ready for the case stream.

    `to_iso` is the parser's own date reader, passed in so a date reads the
    same here as everywhere else in the file. The additional steps are one JSON
    object (step id -> [from, to]) and the notice methods one comma list, so the
    table carries two columns for sixteen of DOL's.
    """
    steps = {}
    for s in STEPS:
        frm = to_iso(rec.get(f"step_{s['id']}_from") or "")
        to = to_iso(rec.get(f"step_{s['id']}_to") or "")
        if frm or to:
            steps[s["id"]] = [frm, to]
    notice = [n["id"] for n in NOTICE if _flag(rec.get(f"notice_{n['id']}")) == "Y"]
    return {
        "recrSupervised": _flag(rec.get("recr_supervised")),
        "jobOrderStart": to_iso(rec.get("job_order_start") or ""),
        "jobOrderEnd": to_iso(rec.get("job_order_end") or ""),
        "sundayEdition": _flag(rec.get("sunday_edition")),
        "adType": _text(rec.get("ad_type"), AD_TYPE_MAX),
        "paper1": _text(rec.get("paper1"), PAPER_MAX),
        "ad1": to_iso(rec.get("ad1") or ""),
        "paper2": _text(rec.get("paper2"), PAPER_MAX),
        "ad2": to_iso(rec.get("ad2") or ""),
        "recrSteps": json.dumps(steps, sort_keys=True, separators=(",", ":")) if steps else None,
        "notice": ",".join(notice) or None,
    }


def paper_key(name: str | None) -> str | None:
    """One key per newspaper, whatever DOL's filers typed: "The New York Times",
    "New York Times" and "NEW YORK TIMES" are one paper, and so are "Star-Ledger"
    and "Star Ledger". A publisher's name in brackets is dropped ("The Mercury News
    (Bay Area News Group)"). Measured Oct 18 2026 on FY2026 Q3: 3,305 spellings."""
    if not name:
        return None
    s = re.sub(r"\([^)]*\)", " ", name.lower())
    s = re.sub(r"[^a-z0-9]+", " ", s).strip()
    s = re.sub(r"^the ", "", s)
    return s or None


def steps_of(raw: str | None) -> dict[str, list]:
    """The additional steps a stored row carries (`recr_steps`), step id -> [from, to]."""
    if not raw:
        return {}
    try:
        out = json.loads(raw)
    except (TypeError, ValueError):
        return {}
    return out if isinstance(out, dict) else {}


def step_starts(row: dict) -> list[str]:
    """Every date a recruitment step began on: the job order, both ads, each additional step."""
    dates = [row.get("job_order_start"), row.get("ad1"), row.get("ad2")]
    dates += [span[0] for span in steps_of(row.get("recr_steps")).values() if span]
    return sorted(str(d)[:10] for d in dates if d)


def lead_band(received: str | None, first_step: str | None) -> str | None:
    """Which band the days from the first step to filing fall in, or None."""
    if not received or not first_step:
        return None
    days = (dt.date.fromisoformat(str(received)[:10]) - dt.date.fromisoformat(first_step)).days
    for b in LEAD_BANDS:
        if days >= b["from"] and (b["to"] is None or days <= b["to"]):
            return b["id"]
    return None


def case_papers(row: dict) -> dict[str, str]:
    """The newspapers one case advertised in, key -> the spelling its filer used:
    one entry per paper however many ways the two ad fields spell it."""
    out: dict[str, str] = {}
    for raw in (row.get("paper1"), row.get("paper2")):
        k = paper_key(raw)
        if k and k not in out:
            out[k] = raw
    return out


# ---------------------------------------------------------------------------
# The quiet period: 30 days after the last recruitment step, before the PERM may be filed
# (20 C.F.R. § 656.17(e)). Held equal to FILING_WINDOW_WAIT_DAYS in convex/lib/perm/constants.ts,
# and the rule below to getLastRecruitmentDate, by test_recruitment_dates.py and the shared
# fixture scripts/fixtures/last_recruitment.json.
# ---------------------------------------------------------------------------

QUIET_PERIOD_DAYS = 30


def _iso(v) -> str | None:
    s = str(v or "")[:10]
    try:
        dt.date.fromisoformat(s)
    except ValueError:
        return None
    return s


def _method_latest(m: dict) -> str | None:
    """A method's latest date: its end (or its start when the end won't read), sub-entries, its one date."""
    got = [_iso(m.get("endDate")) or _iso(m.get("startDate"))]
    got += [_iso(e.get("date")) for e in m.get("subEntries") or []]
    got.append(_iso(m.get("date")))
    got = [d for d in got if d]
    return max(got) if got else None


def last_recruitment_date(d: dict, professional: bool = False) -> str | None:
    """The last recruitment step before the quiet period: the latest of the second Sunday ad,
    the job order's end and the notice's end, and for a professional job the additional steps,
    the latest-dated one excepted (one may finish inside the quiet period, 656.17(e)(1)(ii))."""
    dates = [_iso(d.get(k)) for k in ("sundayAdSecondDate", "jobOrderEndDate", "noticeOfFilingEndDate")]
    if professional:
        dates.append(_iso(d.get("additionalRecruitmentEndDate")))
        methods = sorted((x for x in (_method_latest(m) for m in d.get("additionalRecruitmentMethods") or []) if x), reverse=True)
        dates += methods[1:]
    dates = [x for x in dates if x]
    return max(dates) if dates else None


def case_recruitment_dates(row: dict) -> tuple[dict, bool]:
    """A decided case's recruitment as the rule above reads it, from DOL's columns: the second
    ad (or the only one), the job order's end, and each additional step. DOL publishes no
    notice dates. A case with additional steps is a professional one."""
    steps = steps_of(row.get("recr_steps"))
    methods = [{"startDate": span[0], "endDate": span[1] if len(span) > 1 else None} for span in steps.values() if span]
    return (
        {
            "sundayAdSecondDate": row.get("ad2") or row.get("ad1"),
            "jobOrderEndDate": row.get("job_order_end"),
            "additionalRecruitmentMethods": methods,
        },
        bool(methods),
    )


def quiet_period_end(row: dict) -> str | None:
    """The first day a case could have been filed: the last recruitment step plus the quiet period."""
    last = last_recruitment_date(*case_recruitment_dates(row))
    return (dt.date.fromisoformat(last) + dt.timedelta(days=QUIET_PERIOD_DAYS)).isoformat() if last else None
