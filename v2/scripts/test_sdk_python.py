#!/usr/bin/env python3
"""Gates for the Python package (v2/sdk-python): the client and the CLI, against
a fake transport. No network."""
from __future__ import annotations
import json, pathlib, sys
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent / "sdk-python"))
from permtracker import PermTracker, PermTrackerError, usage_from  # noqa: E402
from permtracker.cli import config_path, render  # noqa: E402

fails: list[str] = []
def check(cond, msg):
    print(("  ok   " if cond else "  FAIL ") + msg)
    if not cond: fails.append(msg)

KEY = "pt_live_" + "A" * 32 + "BBBBBB"
calls = []

def transport(status, body, headers=None):
    def t(url, hdrs, timeout):
        calls.append((url, hdrs))
        return status, headers or {}, json.dumps(body).encode()
    return t

pt = PermTracker(api_key=KEY, transport=transport(200, {"data": {"status": "ANALYST REVIEW"}, "meta": {"asOf": "2026-10-08"}},
                                                   {"RateLimit-Limit": "10", "X-Calls-Today": "4/300"}))
a = pt.case(" g-100-26045-123456 ")
url, hdrs = calls[-1]
check(url == "https://permtracker.app/v1/cases/G-100-26045-123456", "the case number is normalised into the path")
check("pt_live_" not in url and hdrs["Authorization"] == f"Bearer {KEY}", "the key goes in the header, never the address")
check(a.data["status"] == "ANALYST REVIEW" and a.usage.per_minute == 10 and a.usage.today == 4 and a.usage.per_day == 300,
      "the answer and the usage headers")
n = len(calls)
try:
    pt.case("123"); check(False, "a bad case number raises")
except PermTrackerError as e:
    check(e.code == "bad_case_number" and len(calls) == n, "a bad case number is refused without a call")
nokey = PermTracker(api_key="", transport=transport(200, {"data": {"match": "exact"}, "meta": {}}))
try:
    nokey.queue(); check(False, "no key raises")
except PermTrackerError as e:
    check(e.code == "missing_key" and e.status == 401, "a keyed call without a key says so")
check(nokey.lookup_employer("Acme").data == {"match": "exact"} and "Authorization" not in calls[-1][1], "the lookup needs no key")
limited = PermTracker(api_key=KEY, transport=transport(429, {"error": {"code": "rate_limited", "message": "Ten a minute.", "retryAfter": 42}}))
try:
    limited.queue(); check(False, "a refusal raises")
except PermTrackerError as e:
    check((e.status, e.code, e.retry_after, e.message) == (429, "rate_limited", 42, "Ten a minute."), "a refusal keeps the API's code, wait and words")
q = PermTracker(api_key=KEY, base_url="http://localhost:3000/v1/", transport=transport(200, {"data": [], "meta": {}}))
q.employers("acme corp", 5); q.visa_bulletin()
check(calls[-2][0] == "http://localhost:3000/v1/employers?q=acme+corp&limit=5" and calls[-1][0] == "http://localhost:3000/v1/visa-bulletin",
      "query parameters, the empty ones left out")
check(usage_from({}).today is None, "a missing header is unknown, not zero")
check(render({"status": "CERTIFIED", "decision": {"date": "2026-10-01"}, "notes": []}) == "status: CERTIFIED\ndecision:\n  date: 2026-10-01\nnotes: none",
      "the plain listing matches the Node CLI's")
check(str(config_path({"XDG_CONFIG_HOME": "/tmp/x"})) == "/tmp/x/permtracker/config.json", "the saved key's file")

print(f"\n{len(fails)} failure(s)")
sys.exit(1 if fails else 0)
