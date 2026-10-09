#!/usr/bin/env python3
"""Gates for the Python package (v2/sdk-python): the client and the CLI, against
a fake transport. No network."""
from __future__ import annotations
import json, pathlib, sys
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent / "sdk-python"))
from permtracker import PermTracker, PermTrackerError, usage_from, verify_webhook  # noqa: E402
from permtracker.cli import config_path, export_params, parser, render  # noqa: E402

fails: list[str] = []
def check(cond, msg):
    print(("  ok   " if cond else "  FAIL ") + msg)
    if not cond: fails.append(msg)

KEY = "pt_live_" + "A" * 32 + "BBBBBB"
calls = []

sent = []  # (method, body) of each call, beside calls' (url, headers)

def transport(status, body, headers=None, raw=None):
    def t(url, hdrs, timeout, method="GET", data=None):
        calls.append((url, hdrs))
        sent.append((method, data))
        return status, headers or {}, raw if raw is not None else json.dumps(body).encode()
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

# Live lookups, exports, webhooks
live = PermTracker(api_key=KEY, transport=transport(200, {"data": {"caseNumber": "x"}, "meta": {}}))
live.case("G-100-26045-123456"); live.case("G-100-26045-123456", live=True)
check(calls[-2][0].endswith("/cases/G-100-26045-123456") and calls[-1][0].endswith("/cases/G-100-26045-123456?live=1"),
      "a live lookup is asked for only when told to")
ex = PermTracker(api_key=KEY, transport=transport(200, {"data": {"kind": "cases", "rows": [{"caseNumber": "x"}], "count": 1, "cap": 1000, "truncated": False}, "meta": {}}))
page = ex.export("cases", {"q": "acme", "state": "CA"})
check(calls[-1][0] == "https://permtracker.app/v1/exports/cases?q=acme&state=CA&format=json" and page.data["count"] == 1,
      "a JSON export asks for format=json and reads its rows")
csv = PermTracker(api_key=KEY, transport=transport(200, None, {"X-Export-Rows": "1", "X-Export-Cap": "1000", "X-Export-Truncated": "true",
                                                              "X-Calls-Today": "2/3000"}, raw=b"case_number\nG-1\n"))
got = csv.export_csv("employers", {"q": "acme"})
check(got.csv == "case_number\nG-1\n" and got.rows == 1 and got.cap == 1000 and got.truncated and got.usage.today == 2
      and "format=csv" in calls[-1][0], "a CSV export comes back as text with its row count and whether it was cut")
hooks = PermTracker(api_key=KEY, transport=transport(201, {"data": {"id": "abc123def456", "secret": "whsec_x"}}))
made = hooks.create_webhook("https://h.example.com/x", ["case.status_changed"])
method, data = sent[-1]
check(made.data["secret"] == "whsec_x" and method == "POST" and calls[-1][0] == "https://permtracker.app/v1/webhooks"
      and calls[-1][1].get("Content-Type") == "application/json"
      and json.loads(data) == {"url": "https://h.example.com/x", "events": ["case.status_changed"]},
      "a new endpoint is a POST of its address and events as JSON")
hooks.watch(case_number="G-100-26045-123456")
check(json.loads(sent[-1][1]) == {"caseNumber": "G-100-26045-123456"}, "watching a case posts its number")
hooks.unwatch("google-llc", kind="employer")
check(sent[-1][0] == "DELETE" and calls[-1][0] == "https://permtracker.app/v1/watches/google-llc?kind=employer", "unwatching is a DELETE")
hooks.delete_webhook("abc123def456")
check(sent[-1][0] == "DELETE" and calls[-1][0].endswith("/webhooks/abc123def456"), "deleting an endpoint is a DELETE by id")

# A delivery signed by svix 2.5.0 (an independent Standard Webhooks library), recorded here.
# Made up for this test. Split in two so secret scanners don't read it as a
# real signing key (GitHub flagged the whole string as a Stripe secret, Oct 9 2026).
SECRET = "whsec" + "_cGVybSB0cmFja2VyIHdlYmhvb2sgdGVzdCBrZXkgMzI="
BODY = '{"type":"queue.moved","timestamp":"2026-10-09T16:00:00.000Z","data":{"to":"2026-01"}}'
HDRS = {"webhook-id": "msg_abc", "webhook-timestamp": "1791561600", "webhook-signature": "v1,Et0D3wYOCufqfGB2r4bhO+2HOwTVmtFnkDN8DIRDIG4="}
NOW = 1791561600 + 30
check(verify_webhook(SECRET, HDRS, BODY, now=NOW), "a delivery svix signed checks out")
check(verify_webhook(SECRET, {k.title(): v for k, v in HDRS.items()}, BODY.encode(), now=NOW), "header case and bytes bodies are fine")
check(not verify_webhook(SECRET, HDRS, BODY + " ", now=NOW), "a changed body fails")
check(not verify_webhook(SECRET, {**HDRS, "webhook-id": "msg_other"}, BODY, now=NOW), "a changed id fails")
check(not verify_webhook(SECRET, HDRS, BODY, now=NOW + 600), "a delivery ten minutes old fails")
check(not verify_webhook("whsec_" + "eno" * 4, HDRS, BODY, now=NOW), "another secret fails")

# The CLI's new commands
a = parser().parse_args(["case", "G-100-26045-123456", "--live"])
check(a.live and a.command == "case", "case --live")
a = parser().parse_args(["export", "cases", "q=acme", "state=CA", "--format", "json", "--out", "a.json"])
check(a.args == ["cases", "q=acme", "state=CA"] and a.format == "json" and a.out == "a.json", "export's arguments and flags")
check(export_params(["q=acme corp", "fy=2026"]) == {"q": "acme corp", "fy": "2026"}, "name=value parameters")
try:
    export_params(["acme"]); check(False, "a bare word raises")
except PermTrackerError as e:
    check("name=value" in e.message, "a parameter that isn't name=value is refused")
check(parser().parse_args(["watch", "--employer", "google-llc"]).employer == "google-llc", "watch --employer")

print(f"\n{len(fails)} failure(s)")
sys.exit(1 if fails else 0)
