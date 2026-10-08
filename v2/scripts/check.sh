#!/bin/sh
# The quick check before a push: what CI would refuse, in a few minutes rather
# than the whole suite's twenty-odd on the old Mac.
#
#   pnpm check            # against origin/main
#   pnpm check HEAD~3     # against any other commit
#
# It runs both typecheckers, the data scripts' lint and tests, and the vitest
# tests that import something changed since the base (vitest's --changed,
# uncommitted and untracked files included). A test that reads source as a file
# rather than importing it (the gates that scan src/) is not "affected" by that
# reasoning, so this is the first look, never the last word: CI runs the whole
# suite on every push and the deploy waits for it to pass (test.yml,
# oracle-deploy.yml). `pnpm test:run` is still the full local run.
set -eu
cd "$(dirname "$0")/.."
base=${1:-origin/main}

# The Mac's /usr/bin/python3 is 3.9 and can't read these scripts' f-strings.
PY=python3
[ -x /usr/local/Caskroom/miniconda/base/bin/python3 ] && PY=/usr/local/Caskroom/miniconda/base/bin/python3

# Each step says how long it took, and the end gives the total.
t0=$(date +%s); tlast=$t0
took(){ now=$(date +%s); echo "   ($(( now - tlast ))s)"; tlast=$now; }

echo "== 1/4 typecheck (app, Convex, extension, SDK)"
pnpm -s typecheck
took

echo "== 2/4 pyflakes over the data scripts"
"$PY" -m pyflakes scripts/*.py scripts/oracle/*.py
took

echo "== 3/4 data script tests"
failed=0; n=0; log=$(mktemp)
for t in scripts/test_*.py scripts/oracle/test_*.py; do
  n=$((n + 1))
  "$PY" "$t" > "$log" 2>&1 || { failed=$((failed + 1)); echo "FAILED $t"; tail -20 "$log"; }
done
rm -f "$log"
echo "$n script tests, $failed failed"
[ "$failed" -eq 0 ]
took

echo "== 4/4 vitest: tests affected since $base"
pnpm exec vitest run --changed "$base"
took
echo "== passed in $(( $(date +%s) - t0 ))s"
