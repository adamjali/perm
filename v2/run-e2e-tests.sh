#!/bin/bash
# End-to-end tests of the public flows (tests/e2e/public-flows.spec.ts).
#
# Runs against a server that is ALREADY running, so it can test a production
# build (`pnpm build && PORT=3000 pnpm start`) or the live site:
#   BASE_URL=https://permtracker.app ./run-e2e-tests.sh
# The flows are read-only; nothing here submits a form that writes.
set -e
export BASE_URL="${BASE_URL:-http://localhost:3000}"
if ! curl -s -o /dev/null -m 10 "$BASE_URL"; then
  echo "Nothing is answering at $BASE_URL. Start a server first (pnpm start)." >&2
  exit 1
fi
npx playwright test tests/e2e --reporter=list
