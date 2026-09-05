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
# 3. ROOT `docs/` counts as well as `v2/docs/`. The Vercel root directory is
#    `v2/`, so nothing in the repo-root `docs/` tree can reach a build - but the
#    pattern only listed `v2/docs/`, so committing a README screenshot to
#    `docs/images/` triggered a full production build on 2026-09-04. Every
#    deploy cold-starts the ISR cache, so a docs-only build is not just wasted
#    minutes, it is a full regeneration of ~21,000 entity pages.
#
# 4. Agent tooling is not runtime code. `npx convex ai-files update` rewrites
#    `.agents/`, `convex/_generated/ai/` and `skills-lock.json`; none of it ships.
#    NARROW ON PURPOSE: only the `_generated/ai/` SUBDIRECTORY is skipped, never
#    `_generated/` itself, which holds the API bindings the build compiles
#    against and must always trigger one.
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
  | grep -qvE '^(v2/scripts/|\.github/|\.planning/|v2/docs/|docs/|v2/\.agents/|v2/convex/_generated/ai/)|\.md$|/__tests__/|\.test\.tsx?$|^v2/vitest\.|^v2/skills-lock\.json$'; then
  exit 1
fi
exit 0
