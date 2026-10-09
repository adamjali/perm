#!/usr/bin/env python3
"""The morning report: is everything healthy, and did anything cost more than it should.

A daily check of health, cost, every GitHub Action, the ingests, failures,
retries, the stats and traffic, and what was and wasn't expected, emailed every
morning.

This script gathers the parts that live OUTSIDE Convex and writes one JSON
report. `convex/dailyReport.ts` then adds what only Convex can see (users,
subscribers, recorded errors, the email outbox, Resend's own log), stores the
report for the admin page and emails it:

    python3 scripts/daily_monitor.py --out report.json
    npx convex run dailyReport:send "$(python3 -c 'import json;print(json.dumps({"report": json.load(open("report.json"))}))')"

A section whose credential is missing reports status "off" and says which
secret would switch it on. A section that errors reports "unknown" with the
error's class, never its text: THIS REPOSITORY IS PUBLIC AND SO ARE ITS
ACTIONS LOGS. Nothing here prints a figure; the only stdout is one status word
per section.

Section statuses, worst first: fail, warn, unknown, off, ok.
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import pathlib
import socket
import ssl
import statistics
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from zoneinfo import ZoneInfo

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

ET = ZoneInfo("America/New_York")
REPO = "adamjali/perm"
SITE = "https://permtracker.app"
POSTHOG_PROJECT = "322551"

# A day is "unusual" at this multiple of the median of the seven before it.
SPIKE = 2.0
# ...and traffic is "unusual" when it falls below this share of that median.
DROP = 0.5

# Workflows whose failure means data stopped moving. Anything else failing is
# a warning (CodeQL, Dependabot, a test run on a branch).
DATA_WORKFLOWS = {
    "Case status (direct from DOL)", "PWD case status (direct from DOL)",
    "DOL processing times", "Federal data ingest", "Ingest health",
    "FLAG disclosure ingest", "PERM history ingest (FY2008 to FY2023)",
    "Watched cases (by hand)", "Backup observations",
}

# Pages a visitor reads every day. Each must answer 200 to a plain request.
PROBES = ["/", "/perm-queue", "/perm-processing-times", "/visa-bulletin",
          "/perm-employers", "/tools", "/sitemap.xml", "/llms.txt"]

RANK = {"fail": 4, "warn": 3, "unknown": 2, "off": 1, "ok": 0}

# Convex keeps this many characters of each report line (readReport in
# convex/lib/dailyReportCompose.ts) and cuts the rest wherever it falls, so a
# longer line has to be shortened here, at a sentence. The scorecard's rival
# readings ran past it on Oct 9 2026 and the email ended them mid-word.
LINE_MAX = 400
MORE = " More on the admin page."

# Answers a second try can cure: the far end was busy or briefly down.
# PostHog's query endpoint gave one on Oct 5 and Oct 9 2026, and a section
# read "unknown" for the day. The waits are seconds before each retry.
RETRY_CODES = frozenset({429, 500, 502, 503, 504})
RETRY_WAITS = (5, 15)


def fit(line: str, limit: int = LINE_MAX) -> str:
    """A line Convex will keep whole: the sentences that fit, then a pointer
    to the admin page, or as many words as fit when no sentence does."""
    if len(line) <= limit:
        return line
    room = limit - len(MORE)
    cut = line.rfind(". ", 0, room)
    if cut >= room // 3:
        return line[: cut + 1] + MORE
    cut = line.rfind(" ", 0, limit - 3)
    return (line[:cut] if cut > 0 else line[: limit - 3]) + "..."


def worst(statuses) -> str:
    """The worst status of a set, "ok" for an empty one."""
    return max(statuses, key=lambda s: RANK[s], default="ok")


def section(key: str, title: str, status: str, summary: str, lines=None) -> dict:
    return {"key": key, "title": title, "status": status, "summary": summary,
            "lines": [fit(str(l)) for l in (lines or [])]}


def http_json(url: str, headers=None, data=None, timeout=45, waits=RETRY_WAITS):
    """Read a JSON answer, trying again after a busy or failed reply."""
    for wait in (*waits, None):
        req = urllib.request.Request(url, headers=headers or {}, data=data)
        try:
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            if wait is None or e.code not in RETRY_CODES:
                raise
            asked = str(e.headers.get("Retry-After") or "") if e.headers else ""
            time.sleep(min(int(asked), 30) if asked.isdigit() else wait)


def spike_note(today: float, prior: list[float], unit: str, *, drop: bool = False) -> str | None:
    """A sentence when `today` is far from the median of `prior`, else None.

    Needs at least three prior days, or a single odd day would be its own
    baseline. `drop` also flags a fall (traffic); cost only flags a rise.
    """
    base = [p for p in prior if p is not None]
    if len(base) < 3:
        return None
    med = statistics.median(base)
    if med <= 0:
        return None
    ratio = today / med
    if ratio >= SPIKE:
        return f"{ratio:.1f}x the usual day ({fmt(today)} {unit} against a median of {fmt(med)})"
    if drop and ratio <= DROP:
        return f"{ratio:.0%} of the usual day ({fmt(today)} {unit} against a median of {fmt(med)})"
    return None


def et_time(iso) -> str | None:
    """'2026-09-27T19:54:52+00:00' -> 'Sep 27, 3:54 PM EDT' (the owner's clock)."""
    try:
        t = dt.datetime.fromisoformat(str(iso).replace("Z", "+00:00")).astimezone(ET)
    except ValueError:
        return None
    return t.strftime("%b %-d, %-I:%M %p %Z")


def fmt(n: float) -> str:
    """1234567 -> '1.23M'. Short enough for a one-line email."""
    for div, suf in ((1e9, "B"), (1e6, "M"), (1e3, "K")):
        if abs(n) >= div:
            return f"{n / div:.2f}{suf}"
    return f"{n:.0f}"


# ── GitHub Actions ────────────────────────────────────────────────────────


def summarize_runs(runs: list[dict], names: dict[str, str] | None = None) -> dict:
    """Per workflow: runs, failures, cancellations, re-runs, and when it last
    failed and last passed (ISO times, which sort as text). Pure, for the test.

    Grouped by the workflow FILE, named by its current name (`names`: path to
    name, from GitHub's workflow list). A run's own name is its title: a
    renamed workflow, or one whose runs carry the file they load, used to split
    into one line per title, and the old title's last failure then read "still
    failing" with no newer run to clear it (Oct 4 2026: "PW and LCA disclosure
    ingest", renamed the afternoon before). Without `names`, the run's name.
    """
    names = names or {}
    by: dict[str, dict] = {}
    for r in runs:
        # Dependabot's version-update runs ("npm_and_yarn in /v2 for x - Update
        # #123") are one-off noise, one name per update.
        if " in /" in (r.get("name") or "") and " - Update #" in (r.get("name") or ""):
            continue
        w = by.setdefault(names.get(r.get("path") or "") or r.get("name") or "?", {"runs": 0, "failed": 0, "cancelled": 0,
                                                 "reruns": 0, "running": 0,
                                                 "last_fail": "", "last_ok": ""})
        w["runs"] += 1
        c = r.get("conclusion")
        at = str(r.get("updated_at") or r.get("created_at") or "")
        if r.get("status") != "completed":
            w["running"] += 1
        elif c in ("failure", "timed_out", "startup_failure"):
            w["failed"] += 1
            w["last_fail"] = max(w["last_fail"], at)
        elif c == "cancelled":
            w["cancelled"] += 1
        elif c == "success":
            w["last_ok"] = max(w["last_ok"], at)
        if (r.get("run_attempt") or 1) > 1:
            w["reruns"] += 1
    return by


def recovered(w: dict) -> bool:
    """A workflow that failed and has passed since."""
    return bool(w["failed"]) and w["last_ok"] > w["last_fail"]


def gh_headers() -> dict:
    token = os.environ.get("GITHUB_TOKEN")
    headers = {"Accept": "application/vnd.github+json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return headers


_RUNS: dict[str, list] = {}


def runs_since(since: dt.datetime) -> list[dict]:
    """Every workflow run created since `since`, read once per report."""
    created = since.strftime("%Y-%m-%dT%H:%M:%SZ")
    if created not in _RUNS:
        runs, page = [], 1
        while page <= 5:
            d = http_json(f"https://api.github.com/repos/{REPO}/actions/runs"
                          f"?created=%3E%3D{created}&per_page=100&page={page}", gh_headers())
            runs += d.get("workflow_runs", [])
            if len(d.get("workflow_runs", [])) < 100:
                break
            page += 1
        _RUNS[created] = runs
    return _RUNS[created]


def github_section(since: dt.datetime) -> dict:
    headers = gh_headers()
    runs = runs_since(since)
    try:
        listed = http_json(f"https://api.github.com/repos/{REPO}/actions/workflows?per_page=100", headers)
        names = {w["path"]: w["name"] for w in listed.get("workflows", []) if w.get("path") and w.get("name")}
    except Exception:  # noqa: BLE001 - the run titles still group, as they did before
        names = {}
    by = summarize_runs(runs, names)
    lines, statuses = [], []
    still = 0
    for name in sorted(by):
        w = by[name]
        bits = [f"{w['runs']} run{'s' if w['runs'] != 1 else ''}"]
        if w["failed"]:
            # A failure the workflow has since passed is history, not a task,
            # so only the still-failing ones rank.
            if recovered(w):
                bits.append(f"{w['failed']} failed, then passed at {et_time(w['last_ok']) or w['last_ok']}")
            else:
                still += 1
                bits.append(f"{w['failed']} failed, still failing")
                statuses.append("fail" if name in DATA_WORKFLOWS else "warn")
        if w["reruns"]:
            bits.append(f"{w['reruns']} re-run")
        if w["cancelled"]:
            bits.append(f"{w['cancelled']} cancelled")
        if w["running"]:
            bits.append(f"{w['running']} still running")
        lines.append(f"{name}: {', '.join(bits)}")
    failed = sum(w["failed"] for w in by.values())
    if not failed:
        tail = "none failed"
    elif not still:
        tail = f"{failed} failed and every one has since passed"
    else:
        tail = f"{still} workflow{'s' if still != 1 else ''} still failing"
    summary = f"{len(runs)} runs across {len(by)} workflows, {tail}"
    return section("github", "GitHub Actions (24 h)", worst(statuses), summary, lines)


# ── how long things take ──────────────────────────────────────────────────

TESTS_PATH = ".github/workflows/test.yml"
DEPLOY_PATH = ".github/workflows/oracle-deploy.yml"
# The deploy's own step names (oracle-deploy.yml), read for its parts.
DEPLOY_STEPS = (("Build", "build"),
                ("Wait for the full test suite to pass for this commit", "waiting for tests"),
                ("Deploy to the idle copy, health-check, switch", "server"))


def minutes(start, end) -> float | None:
    try:
        a = dt.datetime.fromisoformat(str(start).replace("Z", "+00:00"))
        b = dt.datetime.fromisoformat(str(end).replace("Z", "+00:00"))
    except (TypeError, ValueError):
        return None
    return max(0.0, (b - a).total_seconds() / 60)


def typical(xs: list[float]) -> str:
    return f"{statistics.median(xs):.1f}"


def speed_lines(runs: list[dict], deploy_steps: dict) -> tuple[str, list[str]]:
    """Pure: (summary, lines) for the test runs and deploys that passed in the
    window. A deploy's time is from its push to the switch (the run's own
    span); `deploy_steps` maps a run id to its steps, for the parts."""
    def done(path):
        return [r for r in runs if r.get("path") == path and r.get("status") == "completed"
                and r.get("conclusion") == "success"]
    tests = [m for r in done(TESTS_PATH) if (m := minutes(r.get("run_started_at") or r.get("created_at"), r.get("updated_at"))) is not None]
    deploys = done(DEPLOY_PATH)
    total = [m for r in deploys if (m := minutes(r.get("run_started_at") or r.get("created_at"), r.get("updated_at"))) is not None]
    lines = []
    if tests:
        lines.append(f"Tests: {len(tests)} run{'s' if len(tests) != 1 else ''}, typically {typical(tests)} min (slowest {max(tests):.1f})")
    else:
        lines.append("Tests: no passing run in the last 24 hours")
    if total:
        parts = []
        for name, label in DEPLOY_STEPS:
            xs = [m for r in deploys for st in deploy_steps.get(r.get("id"), []) if st.get("name") == name
                  if (m := minutes(st.get("started_at"), st.get("completed_at"))) is not None]
            if xs:
                parts.append(f"{label} {typical(xs)}")
        lines.append(f"Deploys: {len(total)}, push to live typically {typical(total)} min (slowest {max(total):.1f})"
                     + (f": {', '.join(parts)}" if parts else ""))
        summary = f"Push to live typically {typical(total)} min" + (f", tests {typical(tests)} min" if tests else "")
    else:
        lines.append("Deploys: none in the last 24 hours")
        summary = f"No deploys; tests typically {typical(tests)} min" if tests else "No deploys or test runs"
    return summary, lines


def speed_section(since: dt.datetime) -> dict:
    runs = runs_since(since)
    steps = {}
    for r in runs:
        if r.get("path") == DEPLOY_PATH and r.get("conclusion") == "success":
            d = http_json(f"https://api.github.com/repos/{REPO}/actions/runs/{r['id']}/jobs", gh_headers())
            steps[r["id"]] = [st for j in d.get("jobs", []) for st in j.get("steps", [])]
    summary, lines = speed_lines(runs, steps)
    return section("speed", "How long things take (24 h)", "ok", summary, lines)


# ── the ingest health check ───────────────────────────────────────────────


def health_lines(out: str) -> list[str]:
    """The lines of check_ingest_health.py's output a person needs to read."""
    keep = []
    for line in out.splitlines():
        s = line.strip()
        if s.startswith("::warning::"):
            keep.append("Watching: " + s[len("::warning::"):])
        elif s.startswith("::error::"):
            keep.append(s[len("::error::"):])
        elif s.startswith(("FAIL", "OUR INGEST HAS STOPPED", "THE SOURCE HAS BEEN SILENT",
                           "RUNS BROKEN")) or " BROKEN" in s[:40]:
            keep.append(s)
    return keep[:12]


def health_section() -> dict:
    p = subprocess.run([sys.executable, str(HERE / "check_ingest_health.py")],
                       capture_output=True, text=True, timeout=600)
    lines = health_lines(p.stdout + "\n" + p.stderr)
    if p.returncode == 0:
        watching = [l for l in lines if l.startswith("Watching:")]
        return section("health", "Ingests and data freshness", "warn" if watching else "ok",
                       "every dataset inside its budget" + (f", {len(watching)} to watch" if watching else ""),
                       lines)
    return section("health", "Ingests and data freshness", "fail",
                   "the health check failed", lines or ["(no verdict line: read the Ingest health run)"])


# ── the site itself ───────────────────────────────────────────────────────


def cert_days(host: str) -> int:
    ctx = ssl.create_default_context()
    with socket.create_connection((host, 443), timeout=15) as s:
        with ctx.wrap_socket(s, server_hostname=host) as t:
            end = dt.datetime.strptime(t.getpeercert()["notAfter"], "%b %d %H:%M:%S %Y %Z")
    return (end - dt.datetime.now(dt.timezone.utc).replace(tzinfo=None)).days


def domain_days(domain: str) -> int | None:
    d = http_json(f"https://pubapi.registry.google/rdap/domain/{domain}")
    for e in d.get("events", []):
        if e.get("eventAction") == "expiration":
            end = dt.datetime.fromisoformat(e["eventDate"].replace("Z", "+00:00"))
            return (end - dt.datetime.now(dt.timezone.utc)).days
    return None


def site_section() -> dict:
    lines, statuses, slow = [], [], []
    for path in PROBES:
        t0 = time.monotonic()
        try:
            req = urllib.request.Request(SITE + path, headers={"User-Agent": "permtracker-daily-monitor"})
            with urllib.request.urlopen(req, timeout=30) as r:
                code = r.status
                r.read(1)
        except urllib.error.HTTPError as e:
            code = e.code
        except Exception as e:  # noqa: BLE001 - a probe reports, it never raises
            code = type(e).__name__
        ms = (time.monotonic() - t0) * 1000
        if code != 200:
            lines.append(f"{path} answered {code}")
            statuses.append("fail")
        elif ms > 4000:
            slow.append(f"{path} {ms / 1000:.1f}s")
    if slow:
        lines.append("Slow: " + ", ".join(slow))
        statuses.append("warn")
    try:
        c = cert_days("permtracker.app")
        lines.append(f"HTTPS certificate: {c} days left")
        if c < 14:
            statuses.append("warn")
    except Exception as e:  # noqa: BLE001
        lines.append(f"HTTPS certificate: could not read ({type(e).__name__})")
    try:
        dd = domain_days("permtracker.app")
        if dd is not None:
            lines.append(f"Domain registration: {dd} days left")
            if dd < 30:
                statuses.append("warn")
    except Exception as e:  # noqa: BLE001
        lines.append(f"Domain registration: could not read ({type(e).__name__})")
    bad = sum(1 for s in statuses if s == "fail")
    return section("site", "The site", worst(statuses),
                   f"{len(PROBES) - bad} of {len(PROBES)} pages answered" + (", some slowly" if slow else ""),
                   lines)


# ── the data: what moved ──────────────────────────────────────────────────


def data_section(now_ms: int) -> dict:
    from lib_turso import Turso, query_rows  # noqa: PLC0415 - only needed here

    db = Turso(os.environ["TURSO_DATABASE_URL"], os.environ["TURSO_AUTH_TOKEN"])

    def one(sql, args=()):
        rows = query_rows(db, sql, list(args))
        return rows[0] if rows else None

    day_ago = now_ms - 86_400_000
    moved = one("SELECT COUNT(*) FROM perm_case_events WHERE changed_at >= ?", [day_ago])
    frontier = one("SELECT json FROM perm_docs WHERE key = 'discovery_frontier'")
    score = one("SELECT json FROM perm_docs WHERE key = 'scorecard_summary'")
    rivals = one("SELECT json FROM perm_docs WHERE key = 'scorecard_rivals'")
    lines = [f"PERM status changes recorded in 24 h: {int(moved[0]) if moved else 0:,}"]
    # The other programs on the same counter, one line: a program whose sweep
    # stopped writing shows here as a zero beside the others.
    others = []
    for label, table in (("wage requests", "pwd_case_events"), ("LCAs", "lca_case_events"),
                         ("H-2A and H-2B", "seasonal_case_events")):
        try:
            got = one(f"SELECT COUNT(*) FROM {table} WHERE changed_at >= ?", [day_ago])
            others.append(f"{label} {int(got[0]) if got else 0:,}")
        except Exception:  # noqa: BLE001 - a missing table is a line, not a crash
            others.append(f"{label} unreadable")
    lines.append("Other programs, status changes in 24 h: " + ", ".join(others))
    status = "ok"
    if frontier and frontier[0]:
        f = json.loads(frontier[0])
        moved_at = et_time(f.get("updated_at"))
        lines.append(f"Discovery frontier: {f.get('shape')}" + (f", moved {moved_at}" if moved_at else ""))
    if score and score[0]:
        ours = (json.loads(score[0]).get("perm") or {}).get("bySource", {}).get("ours", {}).get("all", {})
        rec, graded, miss = ours.get("recorded"), ours.get("graded"), ours.get("typicalMissDays")
        if rec is not None:
            lines.append(f"Estimate scorecard: {rec} predictions recorded, {graded or 0} graded"
                         + (f", typical miss {miss} days" if miss is not None else " (grading starts 30 days after the first)"))
    # The verdicts the admin page prints, written by the site with the summary
    # (src/lib/scorecard/verdict.ts), so the email and the page say the same.
    if rivals and rivals[0]:
        priv = json.loads(rivals[0])
        readings = priv.get("readings") or {}
        for r in readings.get("rivals") or []:
            points = r.get("points") or []
            lines.append(f"Scorecard, {r.get('name')}: {r.get('headline')}. " + " ".join(points))
        for line in (readings.get("ours") or [])[:2]:
            lines.append(f"Scorecard, ours: {line}")
        # Priority dates: the first tested gap that has come current, after
        # the line that says what is compared.
        for line in (readings.get("priorityDate") or [])[:2]:
            lines.append(f"Scorecard, priority dates: {line}")
        # The other estimates, one line each, from the same doc.
        for key, label in (("pwd", "wage-request months"), ("seasonal", "H-2A, H-2B and CW-1 dates"),
                           ("bulletin", "visa bulletin release days")):
            cell = ((priv.get(key) or {}).get("bySource") or {}).get("ours", {}).get("all") or {}
            if cell.get("recorded"):
                miss = cell.get("typicalMissDays")
                lines.append(f"Scorecard, {label}: {cell['recorded']} recorded, {cell.get('graded') or 0} graded"
                             + (f", typical miss {miss} days" if miss is not None and cell.get("graded") else ""))
        # The alarms the site works out with the summaries (scorecard/alarms.ts):
        # each needs a person, so each turns the section amber.
        for alarm in priv.get("alarms") or []:
            lines.append(f"Scorecard alarm: {alarm}")
            status = "warn"
    if not moved or int(moved[0]) == 0:
        status = "warn"
        lines.append("No PERM status change recorded in 24 h: the sweep may not have written")
    return section("data", "The data", status, lines[0], lines[1:])


# ── the API and the assistants ─────────────────────────────────────────────


def api_lines(rows: list, today: str) -> tuple[str, list[str]]:
    """Pure: (summary, lines) from api_usage rows of (day, account, key_id, calls).
    Keyed calls are an account's; "anonymous" is the MCP server and the keyless
    lookup, by the bucket they're counted under."""
    days = sorted({r[0] for r in rows})
    yday = max((d for d in days if d < today), default=None)
    def calls(pred):
        return sum(int(r[3]) for r in rows if pred(r))
    keyed_y = calls(lambda r: r[0] == yday and r[1] != "anonymous")
    anon_y = {k: calls(lambda r, k=k: r[0] == yday and r[1] == "anonymous" and r[2] == k)
              for k in sorted({r[2] for r in rows if r[1] == "anonymous"})}
    accounts_y = len({r[1] for r in rows if r[0] == yday and r[1] != "anonymous"})
    week = [d for d in days if d < today][-7:]
    keyed_w = calls(lambda r: r[0] in week and r[1] != "anonymous")
    accounts_w = len({r[1] for r in rows if r[0] in week and r[1] != "anonymous"})
    summary = (f"{keyed_y:,} keyed calls from {accounts_y} account{'s' if accounts_y != 1 else ''} yesterday"
               if yday else "No API calls recorded yet")
    lines = []
    if anon_y:
        lines.append("Without a key yesterday: " + ", ".join(f"{k} {v:,}" for k, v in anon_y.items()))
    if week:
        lines.append(f"Last {len(week)} days: {keyed_w:,} keyed calls from {accounts_w} account{'s' if accounts_w != 1 else ''}")
    return summary, lines


# Live DOL lookups a UTC day for every API account together; the API enforces
# it (convex/lib/apiPlans.ts API_LIVE_DAILY_CAP), and the test holds the two equal.
API_LIVE_DAILY_CAP = 20_000


def live_lookup_line(doc, ceiling: int) -> tuple[str, bool]:
    """Pure: the line for yesterday's live lookups from perm_docs['api_live_<day>']
    ({"all": n, "<account>": n, ...}), and whether it's near the ceiling (80%)."""
    if not doc or not int(doc.get("all") or 0):
        return "No live DOL lookups through the API yesterday", False
    asked = int(doc.get("all") or 0)
    accounts = sum(1 for k, v in doc.items() if k != "all" and int(v or 0) > 0)
    line = (f"Live DOL lookups yesterday: {asked:,} of the {ceiling:,} a day every account shares, "
            f"from {accounts} account{'s' if accounts != 1 else ''}")
    return line, asked >= ceiling * 0.8


def api_section() -> dict:
    from lib_turso import Turso, query_rows  # noqa: PLC0415

    db = Turso(os.environ["TURSO_DATABASE_URL"], os.environ["TURSO_AUTH_TOKEN"])
    rows = query_rows(db, "SELECT day, account, key_id, calls FROM api_usage WHERE day >= date('now', '-8 day')", [])
    today = dt.datetime.now(dt.timezone.utc).date()
    summary, lines = api_lines(rows, today.isoformat())
    status = "ok"
    live = query_rows(db, "SELECT json FROM perm_docs WHERE key = ?", [f"api_live_{(today - dt.timedelta(days=1)).isoformat()}"])
    try:
        doc = json.loads(live[0][0]) if live and live[0][0] else None
    except (ValueError, TypeError):
        doc = None
    line, near = live_lookup_line(doc, API_LIVE_DAILY_CAP)
    lines.append(line)
    if near:
        status = "warn"
    return section("api", "The API and assistants", status, summary, lines)


# ── traffic ───────────────────────────────────────────────────────────────


def traffic_section() -> dict:
    key = os.environ.get("POSTHOG_PERSONAL_API_KEY")
    if not key:
        return section("traffic", "Traffic", "off", "set the POSTHOG_PERSONAL_API_KEY secret to read visits")
    # HogQL's toDate takes one argument, so the zone is shifted first.
    # "Likely people" are visitors who were on a phone or read more than one
    # page: about half of all visitors are single-page desktop visits from
    # crawlers wearing browser user agents, so the raw count overstates the
    # audience. An estimate, and labelled as one in the report.
    q = ("SELECT d, sum(v) AS views, count() AS visitors, countIf(v > 1 OR m > 0) AS people FROM ("
         "SELECT toDate(toTimeZone(timestamp, 'America/New_York')) AS d, person_id, count() AS v, "
         "countIf(properties.$device_type = 'Mobile') AS m FROM events WHERE event = '$pageview' "
         "AND timestamp > now() - INTERVAL 9 DAY GROUP BY d, person_id) GROUP BY d ORDER BY d")
    d = http_json(f"https://us.posthog.com/api/projects/{POSTHOG_PROJECT}/query/",
                  {"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
                  json.dumps({"query": {"kind": "HogQLQuery", "query": q}}).encode())
    rows = d.get("results", [])
    yday = (dt.datetime.now(ET).date() - dt.timedelta(days=1)).isoformat()
    by = {str(r[0])[:10]: (r[1], r[2], r[3]) for r in rows}
    if yday not in by:
        return section("traffic", "Traffic", "unknown", "no pageviews recorded for yesterday")
    views, visitors, people = by[yday]
    prior = [by[k][0] for k in sorted(by) if k < yday][-7:]
    lines = [f"Yesterday: {views:,} pageviews by {visitors:,} visitors",
             f"About {people:,} of them likely people (on a phone, or read more than one page); "
             "most of the rest are single-page crawler visits"]
    status = "ok"
    note = spike_note(views, prior, "pageviews", drop=True)
    if note:
        lines.append("Unusual: " + note)
        status = "warn"
    return section("traffic", "Traffic", status,
                   f"{views:,} pageviews, about {people:,} people ({visitors:,} visitors) yesterday", lines)


# ── Sentry ────────────────────────────────────────────────────────────────


def sentry_section() -> dict:
    tok = os.environ.get("SENTRY_AUTH_TOKEN")
    if not tok:
        return section("sentry", "Errors (Sentry)", "off", "set the SENTRY_AUTH_TOKEN secret to read new issues")
    q = urllib.parse.quote("is:unresolved firstSeen:-24h")
    issues = http_json(f"https://sentry.io/api/0/organizations/perm-tracker/issues/?query={q}&statsPeriod=24h&limit=25",
                       {"Authorization": f"Bearer {tok}"})
    lines = [f"{i.get('shortId')}: {str(i.get('title'))[:90]} ({i.get('count')} events)" for i in issues[:8]]
    return section("sentry", "Errors (Sentry)", "warn" if issues else "ok",
                   f"{len(issues)} new issue{'s' if len(issues) != 1 else ''} in 24 h", lines)


# ── browser errors (PostHog) ──────────────────────────────────────────────


def browser_errors_section() -> dict:
    """Errors in visitors' browsers. They go to PostHog, not Sentry (the
    Sentry client runs only on the sign-in pages and in the app), so this is
    the only place the report sees them.

    Every kind of error in the last 24 hours is counted, none dropped: the
    lines list the ones seen in 2+ sessions and the ones never seen in the 14
    days before (NEW) first, then say how many more there were. Known noise
    from in-app browsers and extensions is dropped at the source (before_send),
    so what arrives is worth a look; a kind seen in 2+ sessions warns. If
    PostHog can't be read the section says "unknown", never "ok"."""
    key = os.environ.get("POSTHOG_PERSONAL_API_KEY")
    if not key:
        return section("browser", "Errors in visitors' browsers", "off",
                       "set the POSTHOG_PERSONAL_API_KEY secret to read browser errors")
    # Errors from before the Sep 30 2026 fix deploy (10:42 PM EDT) are fixed or
    # filtered at the source. This floor stops mattering once the 24-hour window
    # passes it, and can then be deleted with its test.
    recent = ("timestamp > now() - INTERVAL 24 HOUR "
              "AND timestamp > toDateTime('2026-10-01 02:42:00')")
    q = ("SELECT substring(toString(properties.$exception_values), 1, 140) AS msg, "
         f"countIf({recent}) AS n, uniqIf(properties.$session_id, {recent}) AS sessions, "
         "min(timestamp) > now() - INTERVAL 24 HOUR AS is_new, "
         f"anyIf(properties.$pathname, {recent}) AS path FROM events "
         "WHERE event = '$exception' AND timestamp > now() - INTERVAL 14 DAY "
         "GROUP BY msg HAVING n > 0 ORDER BY sessions DESC, n DESC LIMIT 500")
    d = http_json(f"https://us.posthog.com/api/projects/{POSTHOG_PROJECT}/query/",
                  {"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
                  json.dumps({"query": {"kind": "HogQLQuery", "query": q}}).encode())
    rows = [(str(r[0]), int(r[1]), int(r[2]), bool(r[3]), r[4]) for r in d.get("results", [])]
    total = sum(r[1] for r in rows)
    repeated = [r for r in rows if r[2] >= 2]
    new = [r for r in rows if r[3]]
    shown = [r for r in rows if r[2] >= 2 or r[3]][:12]
    lines = []
    for msg, n, sessions, is_new, path in shown:
        text = msg.strip("[]").strip('"')[:110] or "(no message)"
        lines.append(f"{'NEW ' if is_new else ''}{text}: {n} event{'s' if n != 1 else ''}, "
                     f"{sessions} session{'s' if sessions != 1 else ''}, e.g. {path}")
    rest = len(rows) - len(shown)
    if rest:
        lines.append(f"and {rest} more kind{'s' if rest != 1 else ''}, each seen in one session")
    summary = f"{total} error event{'s' if total != 1 else ''} in 24 h, {len(rows)} kind{'s' if len(rows) != 1 else ''}"
    if repeated:
        summary += f", {len(repeated)} seen in 2+ sessions"
    if new:
        summary += f", {len(new)} new"
    return section("browser", "Errors in visitors' browsers", "warn" if repeated else "ok", summary, lines)


# ── the Oracle server ─────────────────────────────────────────────────────

# Oracle reclaims an idle Always Free A1 instance: CPU (95th percentile),
# network AND memory all under 20% for 7 days. Memory is what keeps this one
# above it (the database is locked in RAM), so a low reading is the warning.
IDLE_LINE = 20.0
IDLE_MARGIN = 25.0
SERVER_STALE_MIN = 45
BACKUP_WARN_H, BACKUP_FAIL_H = 30, 54
R2_WARN_GB, R2_FAIL_GB = 8.0, 9.5
RESTORE_WARN_D = 40  # the restore test runs monthly; a missed month shows in about ten days
MUST_RUN = ["permtracker-db", "nginx", "cloudflared"]
DB_DIR_RATIO = 3.0
# The page-cache cap (permtracker-prune) runs every 30 minutes; two hours
# without a run means it stopped, and the disk fills at crawl speed without it.
PAGE_CACHE_STALE_MIN = 120
# People shown "busy for a moment" (the whole server was full). A few on a
# rare day is a crawler burst the limits absorbed; this many in one day, or
# some on three days running, means the server is too small for its traffic,
# which is the time to add CPUs (the limits protect it, they can't add room).
BUSY_PEOPLE_WARN = 10
BUSY_STREAK_DAYS, BUSY_STREAK_MIN = 3, 3
# Memory the machine can still hand out. Under 1 GB, the next big render or a
# job's burst reaches swap or the out-of-memory killer.
MEM_AVAILABLE_WARN_MB = 1024
SWAP_WARN_MB = 1024


def repo_timers() -> list[str]:
    """The timer units the repo installs on the server (scripts/oracle/systemd)."""
    d = pathlib.Path(__file__).resolve().parent / "oracle" / "systemd"
    return sorted(p.name for p in d.glob("*.timer"))


def busy_line(doc: dict, now_ms: int, warns: list, lines: list) -> None:
    """People turned away with a refusal page, counted by the server from the
    1-pixel image those pages carry (only a browser that draws the page asks
    for it). Absent from a doc written before the count existed: says nothing.
    Present but unreadable: says so, never zero."""
    if "busySeen" not in doc:
        return
    bs = doc.get("busySeen")
    if not bs:
        warns.append("the count of people shown a busy page can't be read on the server")
        return
    last = bs.get("last24h") or {}
    by_day = {d["day"]: d for d in bs.get("days") or []}
    today = dt.datetime.fromtimestamp(now_ms / 1000, dt.timezone.utc).date()
    week = [(today - dt.timedelta(days=i)).isoformat() for i in range(6, -1, -1)]
    series = [(by_day.get(d) or {}).get("busyPeople", 0) for d in week]
    busy, slow = last.get("busyPeople", 0), last.get("people", 0) - last.get("busyPeople", 0)
    lines.append(f"People shown \"busy\" (server full): {busy} in 24 h; by day, oldest first: "
                 + ", ".join(str(n) for n in series)
                 + (f". Shown \"one moment\" (their own address too fast): {slow}" if slow else ""))
    if busy >= BUSY_PEOPLE_WARN:
        warns.append(f"{busy} people were shown \"busy\" in 24 h: the server is too small for its traffic")
    elif all(n >= BUSY_STREAK_MIN for n in series[-BUSY_STREAK_DAYS:]):
        warns.append(f"people shown \"busy\" {BUSY_STREAK_DAYS} days running: the server is getting too small")


def server_verdict(doc: dict | None, now_ms: int) -> dict:
    """Judge perm_docs['server_health'], which the server writes every 10 minutes."""
    title = "The server (Oracle)"
    if not doc:
        return section("server", title, "off", "not reporting: it writes into its own database, "
                                               "which the report reads from switch day on")
    fails, warns, lines = [], [], []
    try:
        age_min = (now_ms / 1000 - dt.datetime.fromisoformat(doc["at"].replace("Z", "+00:00")).timestamp()) / 60
    except (KeyError, ValueError):
        age_min = None
    if age_min is None or age_min > SERVER_STALE_MIN:
        fails.append("the server has stopped reporting" + (f" ({age_min / 60:.1f} h ago)" if age_min else ""))

    svc = doc.get("services") or {}
    slot = (doc.get("slot") or {}).get("active")
    must = MUST_RUN + ([f"permtracker-web@{slot}"] if slot else [])
    down = [u for u in must if svc.get(u) != "active"]
    if down:
        fails.append("not running: " + ", ".join(down))
    # The live release normally runs twice, one copy per CPU. One copy still
    # serves everything, so a missing second copy warns rather than fails.
    second = f"permtracker-web@{slot}2" if slot else None
    if second and second in svc and svc.get(second) != "active":
        warns.append(f"the site is running on one copy: {second} is {svc.get(second)}")
    if svc.get("permtracker-dbcache") != "active":
        warns.append("the database is no longer held in memory (permtracker-dbcache)")
    if doc.get("failedUnits"):
        warns.append("failed units: " + ", ".join(doc["failedUnits"][:5]))
    if doc.get("repairCount24h"):
        warns.append(f"the watchdog restarted something {doc['repairCount24h']} time(s) in 24 h")
        lines.extend("Repair: " + r for r in (doc.get("repairs24h") or [])[-3:])
    if doc.get("underAttack24h"):
        warns.append(f"the automatic defense turned on Under Attack Mode {doc['underAttack24h']} time(s) in 24 h "
                     "(every visitor passes Cloudflare's check while it's on)")
    elif doc.get("defenseCount24h"):
        warns.append(f"the automatic defense acted {doc['defenseCount24h']} time(s) in 24 h")
    lines.extend("Defense: " + r for r in (doc.get("defense24h") or [])[-3:])

    idle = doc.get("idle") or {}
    cpu, mem = idle.get("cpuP95"), idle.get("memP95")
    if mem is not None and (idle.get("hours") or 0) >= 24:
        low = mem < IDLE_LINE and (cpu is None or cpu < IDLE_LINE)
        near = mem < IDLE_MARGIN and (cpu is None or cpu < IDLE_MARGIN)
        if low:
            fails.append("under Oracle's idle line: memory and CPU both under 20%, the instance can be reclaimed")
        elif near:
            warns.append("near Oracle's idle line (memory and CPU both under 25%)")

    b = doc.get("backup") or {}
    last = (b.get("lastOk") or {}).get("at")
    if not last:
        fails.append("no backup on record")
    else:
        age_h = (now_ms / 1000 - dt.datetime.fromisoformat(last.replace("Z", "+00:00")).timestamp()) / 3600
        if age_h > BACKUP_FAIL_H:
            fails.append(f"last backup {age_h:.0f} h ago")
        elif age_h > BACKUP_WARN_H:
            warns.append(f"last backup {age_h:.0f} h ago")
        lines.append(f"Backups: {b.get('count', 0)} kept, newest {et_time(last)}")

    # The off-site copy in Cloudflare R2 and the monthly restore test. A server
    # that has never uploaded one fails, so a missing key cannot read as fine.
    off = (b.get("offsiteOk") or {}).get("at")
    if not off:
        fails.append("no off-site backup on record (R2)")
    else:
        off_h = (now_ms / 1000 - dt.datetime.fromisoformat(off.replace("Z", "+00:00")).timestamp()) / 3600
        if off_h > BACKUP_FAIL_H:
            fails.append(f"off-site backup {off_h:.0f} h old")
        elif off_h > BACKUP_WARN_H:
            warns.append(f"off-site backup {off_h:.0f} h old")
        lines.append(f"Off-site copy (R2): {et_time(off)}")
        used = (b.get("offsiteOk") or {}).get("bucketBytes")
        if used is not None:
            gb = used / 1e9
            # R2's free tier is 10 GB-month. Old copies go only after a newer one
            # lands (oracle/bin/permtracker-r2-prune: newest 15 + 3 monthly).
            if gb > R2_FAIL_GB:
                fails.append(f"R2 holds {gb:.1f} GB, about to pass the free 10 GB")
            elif gb > R2_WARN_GB:
                warns.append(f"R2 holds {gb:.1f} GB of the free 10 GB")
            lines.append(f"R2 bucket: {gb:.1f} GB used of the free 10 GB")
    rest = b.get("restoreOk") or {}
    if not rest.get("at"):
        warns.append("the off-site backup has never been restore-tested")
    else:
        rest_d = (now_ms / 1000 - dt.datetime.fromisoformat(rest["at"].replace("Z", "+00:00")).timestamp()) / 86400
        if rest_d > RESTORE_WARN_D:
            warns.append(f"last restore test {rest_d:.0f} days ago")
        lines.append(f"Restore test: {rest.get('tables')} tables, {rest.get('rows', 0):,} rows, {et_time(rest['at'])}")

    # The two sealed copies: the server's secrets and config, and
    # the Convex export. Absent from a doc written before they existed means
    # "not set up", which is itself worth a warning, never a pass.
    for key, what in (("serverOk", "sealed server copy (secrets and config)"),
                      ("convexOk", "sealed Convex copy (accounts and cases)")):
        at = (b.get(key) or {}).get("at")
        if not at:
            warns.append(f"no {what} on record")
            continue
        h = (now_ms / 1000 - dt.datetime.fromisoformat(at.replace("Z", "+00:00")).timestamp()) / 3600
        if h > BACKUP_FAIL_H:
            fails.append(f"{what} {h:.0f} h old")
        elif h > BACKUP_WARN_H:
            warns.append(f"{what} {h:.0f} h old")
        lines.append(f"{what[0].upper() + what[1:]}: {et_time(at)}")

    n = doc.get("now") or {}
    # The database folder holds the data file plus the engine's own log and
    # snapshots; the engine is meant to merge those, and this is the check that
    # it does. Past 3x the data file, something is growing that should not be.
    if n.get("dbDataBytes") and (n.get("dbBytes") or 0) > DB_DIR_RATIO * n["dbDataBytes"]:
        warns.append(f"database folder is {n['dbBytes'] / n['dbDataBytes']:.1f}x its data file: "
                     "the engine's log or snapshots are not being trimmed")
    # Every timer the repo defines must be enabled on the server: the backups,
    # the page-cache cap and the cron clock are all timers, and a disabled one
    # just stops, with nothing else to say so.
    missing_timers = sorted(set(repo_timers()) - set(doc.get("timers") or repo_timers()))
    if missing_timers:
        fails.append("timers not enabled on the server: " + ", ".join(missing_timers))
    pc = doc.get("pageCache")
    if not pc:
        warns.append("the page-cache cap has no result on record (permtracker-prune)")
    else:
        try:
            pc_min = (now_ms / 1000 - dt.datetime.fromisoformat(pc["at"].replace("Z", "+00:00")).timestamp()) / 60
        except (KeyError, ValueError):
            pc_min = None
        if pc_min is None or pc_min > PAGE_CACHE_STALE_MIN:
            warns.append("the page-cache cap has not run for over 2 hours (permtracker-prune)")
        if pc.get("tight"):
            fails.append("free disk fell below 20 GB: the page-cache cap is on its tight budgets")
    avail = n.get("memAvailableMb")
    if avail is not None and avail < MEM_AVAILABLE_WARN_MB:
        warns.append(f"only {avail:,} MB of memory available")
    swap = n.get("swapUsedMb")
    if swap is not None and swap > SWAP_WARN_MB:
        warns.append(f"{swap:,} MB of swap in use")
    disk = n.get("diskPct")
    if disk is not None and disk > 90:
        fails.append(f"disk {disk:.0f}% full")
    elif disk is not None and disk > 80:
        warns.append(f"disk {disk:.0f}% full")

    def pct(x):
        return "not measured yet" if x is None else f"{x}%"

    lines.insert(0, f"Now: memory {pct(n.get('memPct'))}, CPU {pct(n.get('cpuPct'))}, disk {pct(disk)}, "
                    f"database {(n.get('dbBytes') or 0) / 1e9:.1f} GB")
    if mem is not None:
        lines.insert(1, f"Idle-rule window ({idle.get('hours')} h): CPU p95 {pct(cpu)}, memory p95 {pct(mem)}, "
                        f"memory low {pct(idle.get('memMin'))}")
    if slot:
        lines.append(f"Live copy: {slot} ({(doc.get('slot') or {}).get('release')})")
    busy_line(doc, now_ms, warns, lines)
    status = "fail" if fails else "warn" if warns else "ok"
    summary = (fails + warns)[0] if fails or warns else f"all services up, memory {n.get('memPct')}%"
    return section("server", title, status, summary, fails + warns + lines)


def server_section(now_ms: int) -> dict:
    from lib_turso import Turso, read_doc  # noqa: PLC0415 - only needed here

    db = Turso(os.environ["TURSO_DATABASE_URL"], os.environ["TURSO_AUTH_TOKEN"])
    return server_verdict(read_doc(db, "server_health"), now_ms)


# ── assembly ──────────────────────────────────────────────────────────────


def guarded(key: str, title: str, fn, *args) -> dict:
    """Run one section. A failure costs that section, never the report."""
    try:
        return fn(*args)
    except urllib.error.HTTPError as e:
        # The status code says who to look at (429 a limit, 5xx their side);
        # it goes in the report, never to stdout.
        return section(key, title, "unknown", f"could not be read (HTTP {e.code})")
    except Exception as e:  # noqa: BLE001
        return section(key, title, "unknown", f"could not be read ({type(e).__name__})")


def build(now: dt.datetime) -> dict:
    now_ms = int(now.timestamp() * 1000)
    since = now - dt.timedelta(hours=24)
    sections = [
        guarded("health", "Ingests and data freshness", health_section),
        guarded("github", "GitHub Actions (24 h)", github_section, since),
        guarded("speed", "How long things take (24 h)", speed_section, since),
        guarded("site", "The site", site_section),
        guarded("data", "The data", data_section, now_ms),
        guarded("traffic", "Traffic", traffic_section),
        guarded("api", "The API and assistants", api_section),
        guarded("sentry", "Errors (Sentry)", sentry_section),
        guarded("browser", "Errors in visitors' browsers", browser_errors_section),
        guarded("server", "The server (Oracle)", server_section, now_ms),
    ]
    return {"day": now.astimezone(ET).date().isoformat(), "generatedAt": now_ms, "sections": sections}


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--out", default="report.json")
    args = ap.parse_args()
    report = build(dt.datetime.now(dt.timezone.utc))
    pathlib.Path(args.out).write_text(json.dumps(report))
    # Status words only: the Actions log is public.
    print(" ".join(f"{s['key']}={s['status']}" for s in report["sections"]))
    return 0


if __name__ == "__main__":
    sys.exit(main())
