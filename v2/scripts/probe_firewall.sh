#!/bin/bash
# Run after any Firewall change. Sep 7 2026 baseline (Challenge on):
#   a script, a script wearing Chrome, and a script claiming Googlebot from a
#   non-Google address all get 429 + x-vercel-mitigated: challenge; the audit
#   header, WhatsApp, iMessage (facebookexternalhit), feed.xml, llms.txt,
#   robots.txt, the sitemaps and a revalidate POST carrying its secret header
#   all pass with no mitigation. A revalidate POST WITHOUT the header is
#   challenged, which is correct: only the cron carries it.
# Sep 15 2026 baseline (INVERTED: allow all, restrict some). Rules 11 and 12
#   bypass the challenge for AI assistant agents and for every path outside
#   the restricted set, so a plain script now gets 200 on any PAGE and 429 on
#   /api, /ingest, employer compare, the consent endpoints and a case lookup
#   carrying ?case=. An AI assistant agent passes the lookup too (rule 4's
#   20/min per IP still binds). A CHECKPOINT on a page is a regression.
# Probe the live Firewall from this laptop. Each line: label, HTTP status,
# the x-vercel-mitigated header (challenge/deny/rate-limit or empty), and
# whether the body is the Security Checkpoint page.
H="https://permtracker.app"
probe() {
  local label="$1"; shift
  local out; out=$(curl -s -o /dev/stdout -D /dev/stderr --max-time 25 "$@" 2>&1 >/dev/null | tr -d '\r')
  local code; code=$(printf '%s\n' "$out" | sed -n 's/^HTTP\/[0-9.]* \([0-9]*\).*/\1/p' | tail -1)
  local mit; mit=$(printf '%s\n' "$out" | grep -i '^x-vercel-mitigated:' | tail -1 | cut -d' ' -f2-)
  local body; body=$(curl -s --max-time 25 "$@" | head -c 400 | tr '\n' ' ')
  local cp=""; case "$body" in *"Security Checkpoint"*|*"challenge"*|*"Vercel Security"*) cp="CHECKPOINT";; esac
  printf '%-34s %s  mitigated=%-12s %s\n' "$label" "${code:-?}" "${mit:-none}" "$cp"
}
probe "curl, no UA, /pwd-cases"          "$H/pwd-cases"
probe "curl as Chrome, /pwd-cases"       -A "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36" "$H/pwd-cases"
probe "curl as Googlebot (unverified IP)" -A "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)" "$H/pwd-cases"
# Rule 5 matches the header's VALUE since Sep 25 2026 (the key in .env.local).
# A guessed value must be challenged on a restricted path; the real key passes.
KEY=$(grep '^PERMTRACKER_AUDIT_KEY=' "$(dirname "$0")/../.env.local" 2>/dev/null | cut -d= -f2-)
probe "audit header, wrong value, compare" -A "Mozilla/5.0 Chrome/148.0" -H "x-permtracker-audit: 1" "$H/perm-employers/compare"
probe "audit header, real key, compare"    -A "Mozilla/5.0 Chrome/148.0" -H "x-permtracker-audit: ${KEY:-missing}" "$H/perm-employers/compare"
probe "WhatsApp UA, /perm-queue"          -A "WhatsApp/2.23.20.0 A" "$H/perm-queue"
probe "iMessage UA (facebookexternalhit)" -A "facebookexternalhit/1.1 Facebot Twitterbot/1.0" "$H/perm-queue"
probe "curl, /feed.xml"                   "$H/feed.xml"
probe "curl, /llms.txt"                   "$H/llms.txt"
probe "curl, /robots.txt"                 "$H/robots.txt"
probe "curl, /sitemap.xml"                "$H/sitemap.xml"
probe "POST revalidate, wrong secret"     -X POST -H "x-revalidate-secret: not-the-secret" "$H/api/revalidate-dol"
probe "POST revalidate, no header"        -X POST "$H/api/revalidate-dol"
probe "curl, /api/perm-cases?q=fragomen"  "$H/api/perm-cases?q=fragomen"
# --- the inverted model (Sep 15 2026): pages open, the expensive set challenged
probe "curl, /perm-queue (page: open)"    "$H/perm-queue"
probe "curl, lookup ?case= (restricted)"  "$H/perm-case-status?case=G-100-26012-553496"
probe "Claude-User UA, lookup ?case="     -A "Claude-User/1.0 (+https://support.anthropic.com/)" "$H/perm-case-status?case=G-100-26012-553496"
probe "curl, employer compare (restr.)"   "$H/perm-employers/compare?a=x&b=y"
probe "curl, /prefs (restricted)"         "$H/prefs?token=x"

probe "curl, /employer-alert (restricted)" "$H/employer-alert/confirm?token=x"
# --- rule 13 (Sep 26 2026): one-click unsubscribe POSTs reach Convex. Mail
#   providers send them from their own servers, which cannot pass a browser
#   challenge. Expect 400 "Invalid or expired" for the junk token, never 429.
#   A GET on the same paths stays challenged.
probe "one-click POST, /prefs/unsubscribe"  -X POST --data "List-Unsubscribe=One-Click" "$H/prefs/unsubscribe?token=junk&kind=case"
probe "one-click POST, /case-alert/unsub."  -X POST --data "List-Unsubscribe=One-Click" "$H/case-alert/unsubscribe?token=junk"
probe "one-click POST, /employer-alert/un." -X POST --data "List-Unsubscribe=One-Click" "$H/employer-alert/unsubscribe?token=junk"
probe "GET /prefs/unsubscribe (restricted)" "$H/prefs/unsubscribe?token=junk&kind=case"
