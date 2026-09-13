#!/usr/bin/env bash
# Load every LCA disclosure quarter DOL publishes, one dispatch at a time.
#
# WHY SEQUENTIAL. GitHub's concurrency group keeps at most ONE pending run, so
# dispatching several at once cancels the middle ones silently. This waits for
# each to finish before starting the next.
#
# WHY A DRIVER AT ALL. LCA files are per-quarter and DOL lists 25 of them, so
# `--fy` reaches one per fiscal year and the rest need naming. Each load is
# ~13 minutes and ~120k rows.
#
# RESUMABLE BY CONSTRUCTION: the ingest keys its load record per FILE and skips
# one whose sha it already holds, so re-running this costs a download and a
# skip for everything already done. Kill it and start it again freely.
set -uo pipefail
REPO="adamjali/perm"
WF="flag-disclosure-ingest.yml"
LOG="${1:-/tmp/lca-history.log}"

# Newest first: the recent quarters are the ones the product actually serves,
# so an interrupted run leaves the most useful half done.
FILES=$(cat <<'LIST'
LCA_Disclosure_Data_FY2025_Q3.xlsx
LCA_Disclosure_Data_FY2025_Q2.xlsx
LCA_Disclosure_Data_FY2025_Q1.xlsx
LCA_Disclosure_Data_FY2024_Q4.xlsx
LCA_Disclosure_Data_FY2024_Q3.xlsx
LCA_Disclosure_Data_FY2024_Q2.xlsx
LCA_Disclosure_Data_FY2024_Q1.xlsx
LCA_Disclosure_Data_FY2023_Q4.xlsx
LCA_Disclosure_Data_FY2023_Q3.xlsx
LCA_Disclosure_Data_FY2023_Q2.xlsx
LCA_Disclosure_Data_FY2023_Q1.xlsx
LCA_Disclosure_Data_FY2022_Q4.xlsx
LCA_Disclosure_Data_FY2022_Q3.xlsx
LCA_Disclosure_Data_FY2022_Q2.xlsx
LCA_Disclosure_Data_FY2022_Q1.xlsx
LCA_Disclosure_Data_FY2021_Q4.xlsx
LCA_Disclosure_Data_FY2021_Q3.xlsx
LCA_Disclosure_Data_FY2021_Q2.xlsx
LCA_Disclosure_Data_FY2021_Q1.xlsx
LCA_Disclosure_Data_FY2020_Q4.xlsx
LCA_Disclosure_Data_FY2020_Q3.xlsx
LCA_Disclosure_Data_FY2020_Q2.xlsx
LCA_Disclosure_Data_FY2020_Q1.xlsx
LIST
)

say() { echo "[$(TZ=America/New_York date '+%-I:%M %p')] $*" | tee -a "$LOG"; }

n=0; ok=0; bad=0
total=$(echo "$FILES" | wc -l | tr -d ' ')
say "loading $total LCA quarters, newest first"

for f in $FILES; do
  n=$((n+1))
  # The ingest skips a file whose sha it already holds, but only AFTER
  # downloading several hundred MB. Asking Turso first turns a re-run of an
  # already-loaded quarter from a 10-minute download into one query.
  if [ -n "${TURSO_DATABASE_URL:-}" ] && python3 - "$f" <<'PYEOF' 2>/dev/null
import sys, pathlib
sys.path.insert(0, str(pathlib.Path("scripts").resolve()))
from lib_turso import Turso
n = Turso().scalar("SELECT COUNT(*) FROM lca_cases WHERE source_file = ?", [sys.argv[1]])
raise SystemExit(0 if int(n or 0) > 0 else 1)
PYEOF
  then
    say "($n/$total) $f already loaded; skipping"
    ok=$((ok+1)); continue
  fi
  say "($n/$total) dispatching $f"
  if ! gh workflow run "$WF" -R "$REPO" -f program=lca -f name="$f" >>"$LOG" 2>&1; then
    say "  !! dispatch failed for $f"; bad=$((bad+1)); continue
  fi
  sleep 30
  rid=$(gh run list -R "$REPO" --workflow="$WF" --limit 1 --json databaseId -q '.[0].databaseId')
  # Bounded poll, never an unbounded `until`. 240 x 60s = FOUR HOURS, which
  # matches the job's own timeout-minutes rather than undercutting it.
  #
  # THE FIRST VERSION USED 30 MINUTES AND WAS WRONG. It was sized from the
  # ~13 minutes FY2025_Q4 took - 118,580 rows - and the very next file,
  # FY2025_Q3, holds 280,000 and ran past it. The driver then declared a
  # failure for a load that was working and dispatched the next file ON TOP
  # of it, which the concurrency group can silently cancel. A poll bound has
  # to come from the job's own limit, not from one sample.
  st=""
  for _ in $(seq 1 240); do
    sleep 30
    read -r st concl < <(gh run view "$rid" -R "$REPO" --json status,conclusion -q '.status + " " + (.conclusion // "")')
    [ "$st" = "completed" ] && break
  done
  if [ "$st" != "completed" ]; then
    # NEVER dispatch on top of a run that is still going: GitHub keeps at most
    # one pending run per concurrency group, so the next dispatch can cancel
    # something that was working. Stop and let a human look.
    say "  !! $f STILL RUNNING after 4h (run $rid). Stopping rather than "
    say "     dispatching on top of it - re-run this script to continue."
    exit 1
  fi
  if [ "$concl" = "success" ]; then
    rows=$(gh run view "$rid" -R "$REPO" --log 2>/dev/null | grep -oE "wrote [0-9,]+ rows" | tail -1)
    say "  ok  $f  ${rows:-(no row line)}  run $rid"; ok=$((ok+1))
  else
    say "  !! $f FAILED ($concl) run $rid"; bad=$((bad+1))
  fi
done
say "done: $ok loaded, $bad failed, of $total"
