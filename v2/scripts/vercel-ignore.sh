#!/bin/sh
# Vercel "Ignored Build Step". Exit 1 = build, exit 0 = skip the build.
#
# Two rules, each learned from a real skipped or wasted build:
#
# 1. Diff against the commit Vercel last DEPLOYED, not HEAD^. A push of five
#    commits whose last one touched only vitest.config.ts diffed as
#    "config-only" and the whole push, new pages included, never built.
#    VERCEL_GIT_PREVIOUS_SHA is that deployed commit. If it is set but not in
#    the clone (shallow history), BUILD: an unknown diff must never skip.
# 2. Keep this logic in a file. vercel.json caps ignoreCommand at 256
#    characters and rejects the whole deployment above it, with no build log.
#
# Paths from `git diff --name-only` are repo-root relative regardless of cwd.
BASE="${VERCEL_GIT_PREVIOUS_SHA:-}"
if [ -z "$BASE" ]; then
  BASE=HEAD^
elif ! git cat-file -e "$BASE" 2>/dev/null; then
  exit 1
fi
git rev-parse "$BASE" >/dev/null 2>&1 || exit 1

if git diff --name-only "$BASE" HEAD \
  | grep -qvE '^(v2/scripts/|\.github/|\.planning/|v2/docs/)|\.md$|/__tests__/|\.test\.tsx?$|^v2/vitest\.'; then
  exit 1
fi
exit 0
