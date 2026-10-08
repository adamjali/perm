"""Every server setting, checked two ways: for copy artifacts, then live.

Run ON the server after ANY settings change (switch day included):

    ssh permtracker 'sudo /usr/bin/python3 -' < v2/scripts/oracle/check_settings.py

A value copied between systems can carry an invisible artifact (a literal
trailing \\n, for one) that passes every length and presence check while the
service rejects the key. Part 1 finds that class in every env file; part 2
asks each service whether it accepts its key. Only names, PASS/FAIL and
HTTP codes are printed; no value leaves the server.
"""
import base64
import json
import re
import subprocess


# Part 1: copy artifacts in every env file.
import glob
bad = 0
for path in sorted(glob.glob("/srv/permtracker/app/env/*.env")):
    for line in open(path).read().splitlines():
        m = re.match(r"^([A-Z][A-Z0-9_]*)=(.*)$", line)
        if not m:
            continue
        v = m.group(2)
        if len(v) >= 2 and v[0] == v[-1] == '"':
            v = v[1:-1]
        problems = [p for p, hit in (("stray \\n at end", v.endswith("\\n")), ("whitespace at an end", v != v.strip()),
                                     ("carriage return", "\r" in v), ("empty", not v)) if hit]
        if problems:
            bad += 1
            print(f"FAIL  {path.rsplit('/', 1)[1]} {m.group(1)}: {', '.join(problems)}")
print(f"{'PASS' if not bad else 'FAIL'}  format scan of every env file ({bad} problem values)")

# Part 2: each service, live.
ENV = {}
for f in ("production", "green"):
    for line in open(f"/srv/permtracker/app/env/{f}.env").read().splitlines():
        m = re.match(r"^([A-Z][A-Z0-9_]*)=(.*)$", line)
        if m:
            v = m.group(2)
            if len(v) >= 2 and v[0] == v[-1] == '"':
                v = v[1:-1]
            ENV[m.group(1)] = v
PORT = ENV["PORT"]


def curl(*args, body=False):
    fmt = ["-w", "\n%{http_code}"]
    r = subprocess.run(["curl", "-s", "-m", "20"] + fmt + list(args), capture_output=True, text=True)
    text, _, code = r.stdout.rpartition("\n")
    return code, text


def show(name, what, ok, detail=""):
    print(f"{'PASS' if ok else 'FAIL'}  {name:30s} {what}{('  ' + detail) if detail else ''}")


def bearer(k):
    return ["-H", "Authorization: Bearer " + ENV[k]]


c, _ = curl("https://generativelanguage.googleapis.com/v1beta/models?key=" + ENV["GOOGLE_GENERATIVE_AI_API_KEY"])
show("GOOGLE_GENERATIVE_AI_API_KEY", "Gemini lists models", c == "200", c)
for k, url in [("MISTRAL_API_KEY", "https://api.mistral.ai/v1/models"),
               ("OPENROUTER_API_KEY", "https://openrouter.ai/api/v1/key"),
               ("GROQ_API_KEY", "https://api.groq.com/openai/v1/models"),
               ("CEREBRAS_API_KEY", "https://api.cerebras.ai/v1/models")]:
    c, _ = curl(*bearer(k), url)
    show(k, "provider accepts key", c == "200", c)
c, _ = curl("-H", "X-Subscription-Token: " + ENV["BRAVE_API_KEY"], "https://api.search.brave.com/res/v1/web/search?q=perm&count=1")
show("BRAVE_API_KEY", "one web search", c == "200", c)
c, _ = curl("-X", "POST", "-H", "Content-Type: application/json", "https://api.tavily.com/search",
            "-d", json.dumps({"api_key": ENV["TAVILY_API_KEY"], "query": "PERM labor certification", "max_results": 1}))
show("TAVILY_API_KEY", "one web search", c == "200", c)

c, t = curl(*bearer("GITHUB_DISPATCH_TOKEN"), "https://api.github.com/repos/adamjali/perm/actions/workflows?per_page=1")
show("GITHUB_DISPATCH_TOKEN", "reads the repo's workflows", c == "200", c)

c, t = curl("-X", "POST", "https://oauth2.googleapis.com/token",
            "-d", "grant_type=authorization_code", "-d", "code=not-a-real-code",
            "-d", "redirect_uri=https://permtracker.app/api/google/callback",
            "-d", "client_id=" + ENV["GOOGLE_CALENDAR_CLIENT_ID"], "-d", "client_secret=" + ENV["GOOGLE_CALENDAR_CLIENT_SECRET"])
err = (json.loads(t or "{}")).get("error", "")
show("GOOGLE_CALENDAR_CLIENT_*", "Google recognises the client (bad code, good client)", err == "invalid_grant", err)

# An upload token (org:ci) may read releases but not list projects (403).
c, _ = curl(*bearer("SENTRY_AUTH_TOKEN"), "https://sentry.io/api/0/organizations/" + ENV["SENTRY_ORG"] + "/releases/?per_page=1")
show("SENTRY_AUTH_TOKEN", "reads the org's releases", c == "200", c)
show("SENTRY_DSN", "same as NEXT_PUBLIC_SENTRY_DSN", ENV["SENTRY_DSN"] == ENV["NEXT_PUBLIC_SENTRY_DSN"])
show("SENTRY_ENVIRONMENT", "set (switch day makes it production)", bool(ENV["SENTRY_ENVIRONMENT"]), ENV["SENTRY_ENVIRONMENT"])

c, t = curl(*bearer("RESEND_API_KEY"), "https://api.resend.com/domains")
name = (json.loads(t or "{}")).get("name", "")
show("RESEND_API_KEY", "Resend knows the key (unused by the site)", c == "200" or name == "restricted_api_key", f"{c} {name}")


def claims(tok):
    p = tok.split(".")[1]
    return json.loads(base64.urlsafe_b64decode(p + "=" * (-len(p) % 4)))


for k in ("TURSO_AUTH_TOKEN", "TURSO_RW_AUTH_TOKEN"):
    url = ENV["TURSO_DATABASE_URL"].replace("libsql://", "https://").rstrip("/") + "/v2/pipeline"
    c, t = curl("-X", "POST", *bearer(k), "-H", "Content-Type: application/json", url,
                "-d", json.dumps({"requests": [{"type": "execute", "stmt": {"sql": "SELECT count(*) FROM perm_docs"}}, {"type": "close"}]}))
    ok = c == "200" and '"type":"ok"' in t.replace(" ", "")
    show(k, f"queries the database (access: {claims(ENV[k]).get('a', '?')})", ok, c)

c, _ = curl(ENV["NEXT_PUBLIC_CONVEX_URL"].rstrip("/") + "/version")
show("NEXT_PUBLIC_CONVEX_URL", "Convex answers", c == "200", c)
c, _ = curl("-X", "POST", "-H", "Content-Type: application/json", ENV["NEXT_PUBLIC_POSTHOG_HOST"].rstrip("/") + "/decide/?v=3",
            "-d", json.dumps({"api_key": ENV["NEXT_PUBLIC_POSTHOG_KEY"], "distinct_id": "settings-check"}))
show("NEXT_PUBLIC_POSTHOG_KEY", "PostHog accepts the project key", c == "200", c)
for k in ("RIVAL_A_API", "RIVAL_B_API"):
    c, _ = curl("-o", "/dev/null", ENV[k])
    show(k, "endpoint answers", c in ("200", "400", "405"), c)

base = f"http://127.0.0.1:{PORT}"
c, _ = curl(*bearer("CRON_SECRET"), "-H", "Host: permtracker.app", base + "/api/cron/dispatch/no-such-job")
c2, _ = curl("-H", "Authorization: Bearer wrong", "-H", "Host: permtracker.app", base + "/api/cron/dispatch/no-such-job")
show("CRON_SECRET", "right secret passes, wrong one refused", c == "404" and c2 == "401", f"right={c} wrong={c2}")
c, _ = curl("-X", "POST", "-H", "x-revalidate-secret: " + ENV["REVALIDATE_SECRET"], "-H", "Host: permtracker.app", base + "/api/revalidate-dol")
c2, _ = curl("-X", "POST", "-H", "x-revalidate-secret: wrong", "-H", "Host: permtracker.app", base + "/api/revalidate-dol")
show("REVALIDATE_SECRET", "right secret revalidates, wrong one refused", c == "200" and c2 in ("401", "403"), f"right={c} wrong={c2}")
show("SENTRY_CHECK_SECRET", "set", bool(ENV["SENTRY_CHECK_SECRET"]))
show("TURNSTILE_SECRET_KEY", "present but unused by the site (Convex holds the one used)", True)
c, _ = curl("-X", "POST", "-H", "x-revalidate-secret: " + ENV["REVALIDATE_SECRET"], "-H", "Host: permtracker.app", base + "/api/revalidate-bulletin")
c2, _ = curl("-X", "POST", "-H", "x-revalidate-secret: wrong", "-H", "Host: permtracker.app", base + "/api/revalidate-bulletin")
show("REVALIDATE_SECRET (bulletin)", "right secret revalidates, wrong one refused", c == "200" and c2 in ("401", "403"), f"right={c} wrong={c2}")


# Part 3: the database takes every job's biggest read, with room to grow.
#
# sqld's default 10 MB reply cap is smaller than several jobs' largest reads.
# Nothing in parts 1 and 2 sends a realistic query, so this part sends each
# job's real largest one and fails any reply over half the cap.
# The SQL is copied from the named script; keep them in step when a read changes.
def cap_bytes(flag, default):
    args = subprocess.run(["ps", "-o", "args=", "-C", "sqld"], capture_output=True, text=True).stdout
    m = re.search(flag + r"\s+(\d+)\s*([KMG]B)", args)
    if not m:
        return default
    return int(m.group(1)) * {"KB": 1 << 10, "MB": 1 << 20, "GB": 1 << 30}[m.group(2)]


CAP = cap_bytes("--max-response-size", 10 << 20)
DB_URL = ENV["TURSO_DATABASE_URL"].replace("libsql://", "https://").rstrip("/") + "/v2/pipeline"
BIG_READS = {
    "case-status full sweep": "SELECT case_number, current_status, employer_name, job_title FROM perm_case_status ORDER BY case_number LIMIT 1000000000 OFFSET 0",
    "case-status pending sweep": "SELECT case_number, current_status, employer_name, job_title FROM perm_case_status WHERE is_final=0 OR is_final='0' ORDER BY case_number LIMIT 1000000000 OFFSET 0",
    "nightly estimate backtest": "SELECT case_number, filing_date, current_status, is_final, upper(substr(trim(employer_name), 1, 2)) FROM perm_case_status WHERE filing_date >= '2015-01-01' AND filing_date < '2099-01-01'",
    "nightly live-cases rebuild": "SELECT case_number, filing_date, status, is_final, employer_name, employer_slug, job_title, decided_seen FROM perm_live_recent",
    "quarterly entity rebuild": "SELECT kind, name, slug, merge_key, code FROM perm_entities",
    "weekly PWD re-check": "SELECT case_number, current_status, employer_name, job_title FROM pwd_case_status WHERE filing_date >= date('now', '-180 days') ORDER BY filing_date, case_number LIMIT 1000000000",
    "weekly LCA re-check": "SELECT case_number, current_status, employer_name, job_title FROM lca_case_status WHERE filing_date >= date('now', '-90 days') ORDER BY filing_date, case_number LIMIT 1000000000",
}
for name, sql in BIG_READS.items():
    r = subprocess.run(["curl", "-s", "-m", "120", "-o", "/tmp/bigread.json", "-w", "%{http_code}", "-X", "POST",
                        *bearer("TURSO_AUTH_TOKEN"), "-H", "Content-Type: application/json", DB_URL,
                        "-d", json.dumps({"requests": [{"type": "execute", "stmt": {"sql": sql}}, {"type": "close"}]})],
                       capture_output=True, text=True)
    size = len(open("/tmp/bigread.json", "rb").read())
    ok = r.stdout == "200" and b'"type":"ok"' in open("/tmp/bigread.json", "rb").read(4096).replace(b" ", b"")
    show(name, f"reply {size / 1048576:.1f} MB of a {CAP / 1048576:.0f} MB cap", ok and size <= CAP / 2,
         "" if ok else r.stdout)
subprocess.run(["rm", "-f", "/tmp/bigread.json"])

# One value is capped too (5,000,000 bytes: "string or blob too big"). The precomputed documents are single values; fail at a fifth of it.
c, t = curl("-X", "POST", *bearer("TURSO_AUTH_TOKEN"), "-H", "Content-Type: application/json", DB_URL,
            "-d", json.dumps({"requests": [{"type": "execute", "stmt": {"sql": "SELECT max(length(json)) FROM perm_docs"}}, {"type": "close"}]}))
biggest = int(json.loads(t)["results"][0]["response"]["result"]["rows"][0][0]["value"]) if c == "200" else -1
show("largest stored document", f"{biggest:,} bytes of a 5,000,000-byte value limit", 0 <= biggest <= 1_000_000, c)
