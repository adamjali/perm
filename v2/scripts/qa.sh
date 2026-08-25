#!/usr/bin/env bash
#
# One command that checks the rendered site.
#
# Both audits below read the SITEMAP and sample three URLs per route
# template, so adding 16,210 entity pages did not turn this into a 16,254
# request job. Each prints its counts and what it skipped BEFORE its verdict,
# because a run that could not see its subject reads exactly like a pass.
#
#   pnpm qa                              # against production
#   pnpm qa http://127.0.0.1:3211        # against a local server
#
# Exits non-zero if either audit finds anything.
set -uo pipefail
BASE="${1:-https://permtracker.app}"
cd "$(dirname "$0")/.."

echo "════ QA: $BASE ════"
fail=0

echo
echo "──── page audit (status, title, description, h1, canonical, em-dashes, live data)"
python3 scripts/audit_all_pages.py --base "$BASE" || fail=1

echo
echo "──── glued text (rendered, not source: the source gate is blind to maps,"
echo "     custom components, motion.* and conditionals)"
python3 scripts/audit_glued_text.py --base "$BASE" || fail=1

echo
echo "──── machine-readable surfaces"
for p in /robots.txt /llms.txt /sitemap.xml; do
  code=$(curl -s -o /tmp/qa-probe -w '%{http_code}' --max-time 45 "$BASE$p")
  size=$(wc -c < /tmp/qa-probe | tr -d ' ')
  printf "  %-14s HTTP %-4s %8s bytes\n" "$p" "$code" "$size"
  [ "$code" = "200" ] || fail=1
done
# A robots.txt that blocks an answer engine is a silent AEO outage, and the
# only evidence is a line nobody reads.
for bot in GPTBot ClaudeBot PerplexityBot Google-Extended; do
  if curl -s --max-time 30 "$BASE/robots.txt" | grep -qi "$bot"; then
    echo "  WARN: robots.txt names $bot; confirm it is not a Disallow"
  fi
done

echo
if [ "$fail" -eq 0 ]; then echo "════ QA CLEAN ════"; else echo "════ QA FOUND ISSUES ════"; fi
exit "$fail"
