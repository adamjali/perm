#!/usr/bin/env bash
# Deploy the Convex functions from the commit GitHub's full suite passed, and record which one.
#
#   pnpm convex:deploy            # checks, then `npx convex deploy -y`, then records the commit
#   pnpm convex:deploy --check    # the checks alone
#
# A Convex deploy has no record of its own: nothing said which commit production ran, and
# nothing stopped a deploy from a tree with unsaved or unpushed edits (audit, Nov 4 2026). It
# refuses unless: the branch is main, nothing tracked is changed and nothing untracked sits under
# convex/, HEAD is what origin/main holds, and the Tests workflow passed for HEAD itself.
# After the deploy it sets DEPLOYED_COMMIT and DEPLOYED_AT on the production deployment
# (`npx convex env get DEPLOYED_COMMIT --prod` reads them).
#
# Rollback: Convex keeps no older version to switch back to, so deploy an older commit the same
# way, from a worktree of it (scripts/oracle/README.md, "Rolling Convex back").
set -euo pipefail
cd "$(dirname "$0")/.."

check_only=0
[ "${1:-}" = "--check" ] && check_only=1

fail() { echo "convex:deploy refused: $*" >&2; exit 1; }

branch=$(git rev-parse --abbrev-ref HEAD)
[ "$branch" = "main" ] || fail "on branch $branch, not main"
[ -z "$(git status --porcelain --untracked-files=no)" ] || fail "tracked files have changes (git status)"
[ -z "$(git status --porcelain --untracked-files=all -- convex)" ] || fail "convex/ has files git doesn't track"
git fetch -q origin main
head=$(git rev-parse HEAD)
[ "$head" = "$(git rev-parse origin/main)" ] || fail "HEAD ${head:0:8} isn't what origin/main holds (push first, or pull)"
# By headSha: `gh run list --commit` has answered nothing here (v2/CLAUDE.md, Sep 30 2026).
result=$(gh run list --workflow test.yml --branch main --limit 40 --json headSha,conclusion,status \
  --jq "[.[] | select(.headSha == \"$head\" and .status == \"completed\")] | map(.conclusion)
        | if index(\"success\") then \"success\" elif length > 0 then .[0] else \"none yet\" end" \
  2>/dev/null || echo "unreadable")
[ "$result" = "success" ] || fail "GitHub's Tests run for ${head:0:8} is $result, not success"

echo "convex:deploy: ${head:0:8} on main, clean, pushed, and its Tests passed"
[ "$check_only" = 1 ] && exit 0

npx convex deploy -y
npx convex env set DEPLOYED_COMMIT "$head" --prod >/dev/null
npx convex env set DEPLOYED_AT "$(date -u +%Y-%m-%dT%H:%M:%SZ)" --prod >/dev/null
echo "convex:deploy: production runs ${head:0:8} ($(TZ=America/New_York date '+%-I:%M %p %Z'))"
