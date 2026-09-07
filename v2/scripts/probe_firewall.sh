#!/bin/bash
# Run after any Firewall change. Sep 7 2026 baseline (Challenge on):
#   a script, a script wearing Chrome, and a script claiming Googlebot from a
#   non-Google address all get 429 + x-vercel-mitigated: challenge; the audit
#   header, WhatsApp, iMessage (facebookexternalhit), feed.xml, llms.txt,
#   robots.txt, the sitemaps and a revalidate POST carrying its secret header
#   all pass with no mitigation. A revalidate POST WITHOUT the header is
#   challenged, which is correct: only the cron carries it.
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
probe "audit header, /pwd-cases"          -H "x-permtracker-audit: 1" "$H/pwd-cases"
probe "WhatsApp UA, /perm-queue"          -A "WhatsApp/2.23.20.0 A" "$H/perm-queue"
probe "iMessage UA (facebookexternalhit)" -A "facebookexternalhit/1.1 Facebot Twitterbot/1.0" "$H/perm-queue"
probe "curl, /feed.xml"                   "$H/feed.xml"
probe "curl, /llms.txt"                   "$H/llms.txt"
probe "curl, /robots.txt"                 "$H/robots.txt"
probe "curl, /sitemap.xml"                "$H/sitemap.xml"
probe "POST revalidate, wrong secret"     -X POST -H "x-revalidate-secret: not-the-secret" "$H/api/revalidate-dol"
probe "POST revalidate, no header"        -X POST "$H/api/revalidate-dol"
probe "curl, /api/perm-cases?q=fragomen"  "$H/api/perm-cases?q=fragomen"
