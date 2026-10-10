#!/usr/bin/env python3
"""The health check's count of people shown a refusal page (bin/permtracker-health,
busy_seen). Run: python3 scripts/oracle/test_health_busy.py"""
import importlib.machinery
import importlib.util
import pathlib
import sys
import tempfile
from datetime import datetime, timezone

HERE = pathlib.Path(__file__).resolve().parent
loader = importlib.machinery.SourceFileLoader("pt_health", str(HERE / "bin" / "permtracker-health"))
spec = importlib.util.spec_from_loader("pt_health", loader)
health = importlib.util.module_from_spec(spec)
loader.exec_module(health)

failures: list[str] = []


def check(name: str, ok: bool, detail: str = "") -> None:
    print(f"  {'ok  ' if ok else 'FAIL'} {name}" + (f"  ({detail})" if detail and not ok else ""))
    if not ok:
        failures.append(name)


CHROME = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1"
DESKTOP = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/141.0 Safari/537.36"
NOW = datetime(2026, 10, 2, 12, 0, tzinfo=timezone.utc).timestamp()


def line(iso: str, ip: str, kind: str = "503", ua: str = CHROME, status: str = "200") -> str:
    return f'{iso} {status} {ip} {kind} "{ua}"'


def run(lines_now: list[str], lines_old: list[str] | None = None) -> dict | None:
    with tempfile.TemporaryDirectory() as d:
        log = pathlib.Path(d) / "seen.log"
        log.write_text("\n".join(lines_now) + "\n")
        if lines_old is not None:
            (pathlib.Path(d) / "seen.log.1").write_text("\n".join(lines_old) + "\n")
        return health.busy_seen(NOW, log)


print("people shown a refusal page:")
r = run([
    line("2026-10-02T11:00:00+00:00", "1.1.1.1"),
    line("2026-10-02T11:00:15+00:00", "1.1.1.1"),            # the same person, reloaded
    line("2026-10-02T11:01:00+00:00", "1.1.1.1", ua=DESKTOP),  # another browser on that address
    line("2026-10-02T11:02:00+00:00", "2.2.2.2", "429"),
    line("2026-10-02T11:03:00+00:00", "3.3.3.3", ua="Mozilla/5.0 (compatible; Googlebot/2.1)"),
    line("2026-10-02T11:03:30+00:00", "4.4.4.4", ua="Mozilla/5.0 HeadlessChrome/141.0"),
    line("2026-10-02T11:04:00+00:00", "5.5.5.5", "500"),       # not a kind the pages send
    line("2026-10-02T11:05:00+00:00", "6.6.6.6", status="429"),  # refused by the log's own limit
    "garbage line",
], [
    line("2026-10-01T09:00:00+00:00", "7.7.7.7"),   # within 24 h? no: 27 h ago, yesterday's day only
    line("2026-09-30T20:00:00+00:00", "8.8.8.8"),
    line("2026-09-20T20:00:00+00:00", "9.9.9.9"),   # older than a week
])
check("reads the log", r is not None)
check("people are address + browser", r["last24h"]["people"] == 3, str(r["last24h"]))
check("views count every reload", r["last24h"]["views"] == 4, str(r["last24h"]))
check("busy and one-moment views apart", (r["last24h"]["busyViews"], r["last24h"]["slowDownViews"]) == (3, 1), str(r["last24h"]))
bots = run([line("2026-10-02T11:00:00+00:00", f"3.3.3.{i}", ua=ua) for i, ua in enumerate([
    "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 HeadlessChrome/141.0 Safari/537.36",
    "python-requests/2.32", "curl/8.5.0", "Mozilla/5.0 (compatible; bingbot/2.0)",
    # Meta's renderer, seen in this log on Oct 2 2026, without the URL that names it a crawler
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/145.0.0.0 Safari/537.36 (compatible; meta-externalagent/1.1)"])])
check("crawlers and headless browsers left out", bots["last24h"]["people"] == 0 and bots["days"] == [], str(bots))
check("the week, a row a day", [d["day"] for d in r["days"]] == ["2026-09-30", "2026-10-01", "2026-10-02"], str(r["days"]))
check("each day counts its own people", [d["people"] for d in r["days"]] == [1, 1, 3], str(r["days"]))
check("people shown \"busy\" (server full) apart", r["last24h"]["busyPeople"] == 2 and [d["busyPeople"] for d in r["days"]] == [1, 1, 2],
      str(r))
check("last view time", r["lastAt"] == "2026-10-02T11:02:00Z", str(r["lastAt"]))
check("no log, no answer (never zero)", health.busy_seen(NOW, pathlib.Path("/nonexistent/seen.log")) is None)
empty = run([""])
check("an empty log is zero people", empty is not None and empty["last24h"]["people"] == 0 and empty["days"] == [])

# The disk's trend (Oct 10 2026): Oct 9's 3.5 GB an hour from 82.6 GB reads
# about 23.6 hours to full; a flat disk or under two hours of readings, none.
T = 1_791_500_000
fall = [{"t": T + i * 600, "disk": round(82.6 - 3.5 * i / 6, 2)} for i in range(19)]
h = health.disk_hours_to_full(fall, T + 18 * 600)
check("Oct 9's fall reads about 21 hours to full from its last reading", h is not None and 20 < h < 22.5, str(h))
check("a flat disk has no time to full",
      health.disk_hours_to_full([{"t": T + i * 600, "disk": 90.0} for i in range(19)], T + 18 * 600) is None)
check("under two hours of readings gives none", health.disk_hours_to_full(fall[:6], T + 5 * 600) is None)
check("old samples without a disk reading are skipped",
      health.disk_hours_to_full([{"t": T, "cpu": 1}] + fall, T + 18 * 600) == h)

print(f"{len(failures)} failure(s)")
sys.exit(1 if failures else 0)
