#!/usr/bin/env python3
"""The morning report: is everything healthy, and did anything cost more than it should.

Adam, 2026-09-27: a daily check of health, price, every GitHub Action, the
ingests, failures, retries, the stats and traffic, what was expected and what
was not, run in the cloud and emailed every morning.

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
    "PW and LCA disclosure ingest", "PERM history ingest (FY2008 to FY2023)",
    "USCIS I-485 inventory", "USCIS quarterly data", "Watched cases (hourly)",
    "Backup observations",
}

# Pages a visitor reads every day. Each must answer 200 to a plain request
# (firewall rule 12 lets every cheap path through).
PROBES = ["/", "/perm-queue", "/perm-processing-times", "/visa-bulletin",
          "/perm-employers", "/tools", "/sitemap.xml", "/llms.txt"]

RANK = {"fail": 4, "warn": 3, "unknown": 2, "off": 1, "ok": 0}


def worst(statuses) -> str:
    """The worst status of a set, "ok" for an empty one."""
    return max(statuses, key=lambda s: RANK[s], default="ok")


def section(key: str, title: str, status: str, summary: str, lines=None) -> dict:
    return {"key": key, "title": title, "status": status, "summary": summary,
            "lines": list(lines or [])}


def http_json(url: str, headers=None, data=None, timeout=45):
    req = urllib.request.Request(url, headers=headers or {}, data=data)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.load(r)


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
    """'2026-09-27T19:54:52+00:00' -> 'Sep 27, 3:54 PM EDT' (Adam's clock)."""
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


def summarize_runs(runs: list[dict]) -> dict:
    """Per workflow: runs, failures, cancellations, re-runs. Pure, for the test."""
    by: dict[str, dict] = {}
    for r in runs:
        # Dependabot's version-update runs ("npm_and_yarn in /v2 for x - Update
        # #123") are one-off noise, one name per update.
        if " in /" in (r.get("name") or "") and " - Update #" in (r.get("name") or ""):
            continue
        w = by.setdefault(r.get("name") or "?", {"runs": 0, "failed": 0, "cancelled": 0,
                                                 "reruns": 0, "running": 0})
        w["runs"] += 1
        c = r.get("conclusion")
        if r.get("status") != "completed":
            w["running"] += 1
        elif c in ("failure", "timed_out", "startup_failure"):
            w["failed"] += 1
        elif c == "cancelled":
            w["cancelled"] += 1
        if (r.get("run_attempt") or 1) > 1:
            w["reruns"] += 1
    return by


def github_section(since: dt.datetime) -> dict:
    token = os.environ.get("GITHUB_TOKEN")
    headers = {"Accept": "application/vnd.github+json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    runs, page = [], 1
    created = since.strftime("%Y-%m-%dT%H:%M:%SZ")
    while page <= 5:
        d = http_json(f"https://api.github.com/repos/{REPO}/actions/runs"
                      f"?created=%3E%3D{created}&per_page=100&page={page}", headers)
        runs += d.get("workflow_runs", [])
        if len(d.get("workflow_runs", [])) < 100:
            break
        page += 1
    by = summarize_runs(runs)
    lines, statuses = [], []
    for name in sorted(by):
        w = by[name]
        bits = [f"{w['runs']} run{'s' if w['runs'] != 1 else ''}"]
        if w["failed"]:
            bits.append(f"{w['failed']} failed")
            statuses.append("fail" if name in DATA_WORKFLOWS else "warn")
        if w["reruns"]:
            bits.append(f"{w['reruns']} re-run")
            statuses.append("warn")
        if w["cancelled"]:
            bits.append(f"{w['cancelled']} cancelled")
        if w["running"]:
            bits.append(f"{w['running']} still running")
        lines.append(f"{name}: {', '.join(bits)}")
    failed = sum(w["failed"] for w in by.values())
    summary = (f"{len(runs)} runs across {len(by)} workflows, "
               + (f"{failed} failed" if failed else "none failed"))
    return section("github", "GitHub Actions (24 h)", worst(statuses), summary, lines)


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


# ── Turso: retired Sep 29 2026 ──────────────────────────────────────────
# The database moved to the site's own server on Sep 28 2026 (the "server"
# section judges it, and the R2 lines its backups). Turso's bill section was
# removed with the account.


# ── Vercel ────────────────────────────────────────────────────────────────


def vercel_section() -> dict:
    tok = os.environ.get("VERCEL_TOKEN")
    if not tok:
        return section("vercel", "Vercel (hosting bill)", "off",
                       "set the VERCEL_TOKEN secret to read usage")
    p = subprocess.run(["npx", "--yes", "vercel@latest", "usage", "--breakdown", "daily", "--json",
                        "--token", tok, "--scope", os.environ.get("VERCEL_SCOPE", "adamjalis-projects")],
                       capture_output=True, text=True, timeout=240)
    d = json.loads(p.stdout)
    daily = d["breakdown"]["data"]
    # The newest bucket is today, still filling; judge the last whole day.
    full = daily[:-1] if len(daily) > 1 else daily
    last = full[-1]
    prior = [x["totals"].get("cost", 0) for x in full[-8:-1]]
    cost = last["totals"].get("cost", 0)
    credit = d.get("creditBalance") or {}
    total = d["totals"]["cost"]
    top = sorted(last["services"], key=lambda s: -s.get("cost", 0))[:3]
    parts = ", ".join("%s $%.2f" % (x["name"], x["cost"]) for x in top)
    lines = [
        f"{last['periodKey']}: ${cost:.2f} ({parts})",
        f"This cycle: ${total:.2f} against ${credit.get('allocated', 0):.0f} of credit",
    ]
    status = "warn" if total > credit.get("allocated", 20) else "ok"
    note = spike_note(cost, prior, "dollars")
    if note:
        lines.append("Unusual: " + note)
        status = "warn"
    return section("vercel", "Vercel (hosting bill)", status,
                   f"${cost:.2f} yesterday, ${total:.2f} this cycle", lines)


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
    from lib_turso import Turso  # noqa: PLC0415 - only needed here

    db = Turso(os.environ["TURSO_DATABASE_URL"], os.environ["TURSO_AUTH_TOKEN"])

    def one(sql, args=()):
        rows = db.execute(sql, list(args))["response"]["result"]["rows"]
        return [None if c["type"] == "null" else c["value"] for c in rows[0]] if rows else None

    day_ago = now_ms - 86_400_000
    moved = one("SELECT COUNT(*) FROM perm_case_events WHERE changed_at >= ?", [day_ago])
    frontier = one("SELECT json FROM perm_docs WHERE key = 'discovery_frontier'")
    score = one("SELECT json FROM perm_docs WHERE key = 'scorecard_summary'")
    lines = [f"PERM status changes recorded in 24 h: {int(moved[0]) if moved else 0:,}"]
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
    if not moved or int(moved[0]) == 0:
        status = "warn"
        lines.append("No PERM status change recorded in 24 h: the sweep may not have written")
    return section("data", "The data", status, lines[0], lines[1:])


# ── traffic ───────────────────────────────────────────────────────────────


def traffic_section() -> dict:
    key = os.environ.get("POSTHOG_PERSONAL_API_KEY")
    if not key:
        return section("traffic", "Traffic", "off", "set the POSTHOG_PERSONAL_API_KEY secret to read visits")
    # HogQL's toDate takes one argument: shift the zone first (Sep 28, a 400 on the first run).
    q = ("SELECT toDate(toTimeZone(timestamp, 'America/New_York')) AS d, count() AS views, "
         "count(DISTINCT person_id) AS visitors FROM events WHERE event = '$pageview' "
         "AND timestamp > now() - INTERVAL 9 DAY GROUP BY d ORDER BY d")
    d = http_json(f"https://us.posthog.com/api/projects/{POSTHOG_PROJECT}/query/",
                  {"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
                  json.dumps({"query": {"kind": "HogQLQuery", "query": q}}).encode())
    rows = d.get("results", [])
    yday = (dt.datetime.now(ET).date() - dt.timedelta(days=1)).isoformat()
    by = {str(r[0])[:10]: (r[1], r[2]) for r in rows}
    if yday not in by:
        return section("traffic", "Traffic", "unknown", "no pageviews recorded for yesterday")
    views, people = by[yday]
    prior = [by[k][0] for k in sorted(by) if k < yday][-7:]
    lines = [f"Yesterday: {views:,} pageviews by {people:,} visitors"]
    status = "ok"
    note = spike_note(views, prior, "pageviews", drop=True)
    if note:
        lines.append("Unusual: " + note)
        status = "warn"
    return section("traffic", "Traffic", status, f"{views:,} pageviews, {people:,} visitors yesterday", lines)


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
    if svc.get("permtracker-dbcache") != "active":
        warns.append("the database is no longer held in memory (permtracker-dbcache)")
    if doc.get("failedUnits"):
        warns.append("failed units: " + ", ".join(doc["failedUnits"][:5]))
    if doc.get("repairCount24h"):
        warns.append(f"the watchdog restarted something {doc['repairCount24h']} time(s) in 24 h")
        lines.extend("Repair: " + r for r in (doc.get("repairs24h") or [])[-3:])

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
            # R2's free tier is 10 GB-month; old copies auto-delete after 15 days.
            if gb > R2_FAIL_GB:
                fails.append(f"R2 holds {gb:.1f} GB, about to pass the free 10 GB")
            elif gb > R2_WARN_GB:
                warns.append(f"R2 holds {gb:.1f} GB of the free 10 GB")
            lines.append(f"R2 bucket: {gb:.1f} GB of 10 GB free")
    rest = b.get("restoreOk") or {}
    if not rest.get("at"):
        warns.append("the off-site backup has never been restore-tested")
    else:
        rest_d = (now_ms / 1000 - dt.datetime.fromisoformat(rest["at"].replace("Z", "+00:00")).timestamp()) / 86400
        if rest_d > RESTORE_WARN_D:
            warns.append(f"last restore test {rest_d:.0f} days ago")
        lines.append(f"Restore test: {rest.get('tables')} tables, {rest.get('rows', 0):,} rows, {et_time(rest['at'])}")

    n = doc.get("now") or {}
    # The database folder holds the data file plus the engine's own log and
    # snapshots; the engine is meant to merge those, and this is the check that
    # it does. Past 3x the data file, something is growing that should not be.
    if n.get("dbDataBytes") and (n.get("dbBytes") or 0) > DB_DIR_RATIO * n["dbDataBytes"]:
        warns.append(f"database folder is {n['dbBytes'] / n['dbDataBytes']:.1f}x its data file: "
                     "the engine's log or snapshots are not being trimmed")
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
    status = "fail" if fails else "warn" if warns else "ok"
    summary = (fails + warns)[0] if fails or warns else f"all services up, memory {n.get('memPct')}%"
    return section("server", title, status, summary, fails + warns + lines)


def server_section(now_ms: int) -> dict:
    from lib_turso import Turso  # noqa: PLC0415 - only needed here

    db = Turso(os.environ["TURSO_DATABASE_URL"], os.environ["TURSO_AUTH_TOKEN"])
    rows = db.execute("SELECT json FROM perm_docs WHERE key = 'server_health'")["response"]["result"]["rows"]
    doc = json.loads(rows[0][0]["value"]) if rows else None
    return server_verdict(doc, now_ms)


# ── assembly ──────────────────────────────────────────────────────────────


def guarded(key: str, title: str, fn, *args) -> dict:
    """Run one section. A failure costs that section, never the report."""
    try:
        return fn(*args)
    except Exception as e:  # noqa: BLE001
        return section(key, title, "unknown", f"could not be read ({type(e).__name__})")


def build(now: dt.datetime) -> dict:
    now_ms = int(now.timestamp() * 1000)
    since = now - dt.timedelta(hours=24)
    sections = [
        guarded("health", "Ingests and data freshness", health_section),
        guarded("github", "GitHub Actions (24 h)", github_section, since),
        guarded("site", "The site", site_section),
        guarded("data", "The data", data_section, now_ms),
        guarded("vercel", "Vercel (hosting bill)", vercel_section),
        guarded("traffic", "Traffic", traffic_section),
        guarded("sentry", "Errors (Sentry)", sentry_section),
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
