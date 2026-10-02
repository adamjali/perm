#!/usr/bin/env python3
"""The automatic defense (bin/permtracker-defend): when it acts, at whom, and
when it stands down. Run: python3 scripts/oracle/test_defend.py"""
import importlib.machinery
import importlib.util
import json
import pathlib
import sys
import tempfile
from datetime import datetime, timezone

HERE = pathlib.Path(__file__).resolve().parent
loader = importlib.machinery.SourceFileLoader("pt_defend", str(HERE / "bin" / "permtracker-defend"))
spec = importlib.util.spec_from_loader("pt_defend", loader)
d = importlib.util.module_from_spec(spec)
loader.exec_module(d)

failures: list[str] = []


def check(name: str, ok: bool, detail: str = "") -> None:
    print(f"  {'ok  ' if ok else 'FAIL'} {name}" + (f"  ({detail})" if detail and not ok else ""))
    if not ok:
        failures.append(name)


NOW = datetime(2026, 10, 2, 12, 0, tzinfo=timezone.utc).timestamp()
PHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Version/18.0 Mobile/15E148 Safari/604.1"
SCRAPER = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/151.0.0.0 Safari/537.36"


def dl(t, status=200, asn=7922, bot="false", uri="/perm-employers/acme", ua=PHONE):
    return f'{t:.3f} {status} {asn} {bot} "{uri}" "{ua}"'


def bl(t, ip="203.0.113.5", k="503", ua=PHONE, status="200"):
    iso = datetime.fromtimestamp(t, timezone.utc).strftime("%Y-%m-%dT%H:%M:%S+00:00")
    return f'{iso} {status} {ip} {k} "{ua}"'


# Parsing
reqs = d.page_requests([dl(NOW - 10), dl(NOW - 10, uri="/_next/static/x.js"), dl(NOW - 900), "junk"], NOW - 300)
check("reads page requests, skips static files, old lines and junk", len(reqs) == 1 and reqs[0][2] == 7922)
check("an unknown network reads as none", d.page_requests([dl(NOW, asn="-")], 0)[0][2] is None)

# People shown the busy page
lines = [bl(NOW - 30), bl(NOW - 40), bl(NOW - 60, ip="198.51.100.9"), bl(NOW - 50, ua="python-requests/2"),
         bl(NOW - 70, k="429", ip="192.0.2.1"), bl(NOW - 2000, ip="192.0.2.2")]
check("counts each person once, browsers only, busy page only, last 10 minutes", d.people_busy(lines, NOW) == 2)

# A full app
full = [dl(NOW - 30 - i % 50, status=503 if i % 10 == 0 else 200) for i in range(600)]
check("a minute with 10% refused counts as full", d.full_minutes(d.page_requests(full, NOW - 600), NOW) >= 1)
calm = [dl(NOW - 30 - i % 50, status=503 if i == 0 else 200) for i in range(600)]
check("one refusal is not a full minute", d.full_minutes(d.page_requests(calm, NOW - 600), NOW) == 0)

# The source
mix = [dl(NOW - i % 200, asn=132203, ua=SCRAPER) for i in range(400)] + [dl(NOW - i % 200) for i in range(300)]
src = d.find_source(d.page_requests(mix, NOW - 300), NOW)
check("a hosting network sending most requests is the source", src and src["kind"] == "asn" and src["value"] == 132203, str(src))
isp = [dl(NOW - i % 200, asn=7922, ua=SCRAPER) for i in range(400)] + [dl(NOW - i % 200, asn=7018) for i in range(300)]
src = d.find_source(d.page_requests(isp, NOW - 300), NOW)
check("on a home ISP, the browser label is the source instead", src and src["kind"] == "ua" and src["value"] == SCRAPER, str(src))
bots = [dl(NOW - i % 200, asn=15169, bot="true", ua="Googlebot") for i in range(900)] + [dl(NOW - i % 200) for i in range(100)]
check("verified crawlers are never the source", d.find_source(d.page_requests(bots, NOW - 300), NOW) is None)
spread = [dl(NOW - i % 200, asn=1000 + i % 10, ua=f"UA {i % 10}") for i in range(900)]
check("no network or label at 30% means no single source", d.find_source(d.page_requests(spread, NOW - 300), NOW) is None)
check("a label is quoted safely in the rule", d.rule_expression({"kind": "ua", "value": 'a"b\\c'}) == 'http.user_agent eq "a\\"b\\\\c"')

# Decisions
S = {"kind": "asn", "value": 132203, "share": 0.6, "requests": 400}
check("trouble with a source: the rule", d.decide({"mode": "off"}, True, S, NOW) == [("rule_on", {"source": S})])
check("trouble with no source: Under Attack Mode", d.decide({"mode": "off"}, True, None, NOW)[0][0] == "attack_on")
check("trouble 5 minutes after the rule: wait", d.decide({"mode": "rule", "since": NOW - 300}, True, S, NOW) == [])
check("trouble 10 minutes after the rule: Under Attack Mode",
      d.decide({"mode": "rule", "since": NOW - 600}, True, S, NOW)[0][0] == "attack_on")
st = {"mode": "attack", "since": NOW - 4000}
check("calm starts the clock", d.decide(st, False, None, NOW) == [] and st["calmSince"] == NOW)
check("30 calm minutes: all off", d.decide({"mode": "attack", "calmSince": NOW - 1800}, False, None, NOW) == [("all_off", {})])
st = {"mode": "rule", "calmSince": NOW - 1700}
d.decide(st, True, S, NOW)
check("new trouble resets the calm clock", st["calmSince"] is None)
check("nothing to do when off and calm", d.decide({"mode": "off"}, False, None, NOW) == [])
check("an hour of Under Attack Mode steps back down",
      d.decide({"mode": "attack", "since": NOW - 3600}, True, S, NOW)[0][0] == "attack_off")
check("not back within three hours", d.decide({"mode": "rule", "since": NOW - 900, "attackCooldownUntil": NOW + 60}, True, S, NOW) == [])
check("back after the three hours", d.decide({"mode": "rule", "since": NOW - 900, "attackCooldownUntil": NOW - 1}, True, S, NOW)[0][0] == "attack_on")
check("no single source during the wait: nothing, not Under Attack Mode",
      d.decide({"mode": "off", "attackCooldownUntil": NOW + 60}, True, None, NOW) == [])

# Watching only (no token): logs what it would do, once, and changes nothing.
with tempfile.TemporaryDirectory() as tmp:
    t = pathlib.Path(tmp)
    (t / "defend.log").write_text("\n".join(mix) + "\n")
    (t / "seen.log").write_text("\n".join([bl(NOW - 30), bl(NOW - 40, ip="198.51.100.9")]) + "\n")
    d.HEALTH, d.STATE, d.OFF, d.REPAIRS = t, t / "defend.json", t / "defend.off", t / "repairs.log"
    d.DEFEND_LOG, d.BUSY_LOG, d.CONFIG = t / "defend.log", t / "seen.log", t / "none.env"
    real_time = d.time.time
    d.time.time = lambda: NOW
    try:
        d.main(); d.main()
    finally:
        d.time.time = real_time
    state = json.loads((t / "defend.json").read_text())
    log = (t / "repairs.log").read_text().splitlines()
    check("without a token it only watches", state["mode"] == "off" and state["last"]["live"] is False)
    check("and says what it would do, once", len(log) == 1 and "would rule on" in log[0] and "AS132203" in log[0], str(log))

print()
print(f"{len(failures)} failure(s)")
sys.exit(1 if failures else 0)
