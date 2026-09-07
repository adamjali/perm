#!/bin/bash
# The residential runner: the fetches www.uscis.gov refuses to serve GitHub's
# datacenter runners, run from this Mac by launchd (scripts/launchd/*.plist).
#
#   bash scripts/residential_job.sh i485     # USCIS I-485 inventory (monthly)
#   bash scripts/residential_job.sh i140     # USCIS I-140 counts + trends (quarterly)
#
# Shape, each part of it a lesson:
#   * ONE run at a time per job (a lock directory holding the PID; a stale
#     lock from a dead process is removed, not obeyed).
#   * Pulls main first with --ff-only, so the laptop runs the same code the
#     runner does; a pull that cannot fast-forward is logged and the run
#     proceeds on the checkout it has.
#   * Every failure is RECORDED where the health check reads
#     (record_ingest_failure.py, bare filename key), never only in a log.
#   * Logs are one file per run under ~/Library/Logs/permtracker and pruned
#     at 60 days, so the directory cannot grow without bound.
#   * The scripts' own retries (four attempts with backoff) are the retry;
#     the calendar (five days a month) is the retry of the retry; GitHub's
#     own attempts on the same days are the fallback off this laptop.
set -uo pipefail

JOB="${1:-}"
case "$JOB" in i485|i140) ;; *) echo "usage: residential_job.sh i485|i140" >&2; exit 2;; esac

# launchd hands a job almost no PATH. Name everything, including node,
# which lives under nvm on this Mac (the newest installed version wins).
NODE_BIN="$(ls -d "$HOME/.nvm/versions/node/"*/bin 2>/dev/null | sort -V | tail -1)"
export PATH="${NODE_BIN:+$NODE_BIN:}/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin"
PY="/usr/local/Caskroom/miniconda/base/bin/python3"
REPO="$(cd "$(dirname "$0")/../.." && pwd)"
V2="$REPO/v2"
LOGS="$HOME/Library/Logs/permtracker"
mkdir -p "$LOGS"
STAMP="$(date +%Y%m%d-%H%M%S)"
LOG="$LOGS/$JOB-$STAMP.log"
exec > >(tee -a "$LOG") 2>&1

say() { printf '%s  %s\n' "$(date '+%Y-%m-%d %I:%M:%S %p %Z')" "$*"; }
say "residential job '$JOB' starting on $(hostname -s) as $(id -un); log $LOG"

# Prune logs older than 60 days: bounded by construction.
find "$LOGS" -name "*.log" -mtime +60 -delete 2>/dev/null || true

# One at a time. A lock directory is atomic on every filesystem macOS has.
LOCK="$LOGS/.$JOB.lock"
if mkdir "$LOCK" 2>/dev/null; then
  echo $$ > "$LOCK/pid"
else
  old="$(cat "$LOCK/pid" 2>/dev/null || echo 0)"
  if [ "$old" != "0" ] && kill -0 "$old" 2>/dev/null; then
    say "another '$JOB' run (pid $old) is still going; leaving"; exit 0
  fi
  say "removing a stale lock (pid $old is gone)"; rm -rf "$LOCK"; mkdir "$LOCK"; echo $$ > "$LOCK/pid"
fi
trap 'rm -rf "$LOCK"' EXIT

record_failure() {  # <script filename> <note>
  ( cd "$V2" && "$PY" scripts/record_ingest_failure.py --script "$1" \
      --note "laptop launchd ($JOB): $2; log $LOG" ) || say "could not record the failure row"
}

cd "$V2" || { say "repo not found at $V2"; exit 1; }
if [ ! -f .env.local ]; then say "no .env.local; the scripts cannot reach Turso"; exit 1; fi

# Same code as the runner, when the network allows it.
if git -c http.lowSpeedLimit=1000 -c http.lowSpeedTime=30 fetch --quiet origin main 2>&1; then
  if git merge --ff-only --quiet origin/main 2>&1; then say "on main $(git rev-parse --short HEAD)"; else say "cannot fast-forward (local changes?); running $(git rev-parse --short HEAD) as is"; fi
else
  say "fetch failed; running $(git rev-parse --short HEAD) as is"
fi

rc=0
case "$JOB" in
  i485)
    say "ingest_i485_inventory.py"
    if ! "$PY" scripts/ingest_i485_inventory.py; then
      rc=1; record_failure "ingest_i485_inventory.py" "ingest exited non-zero"
    fi
    ;;
  i140)
    TMP="$(mktemp -d)"; trap 'rm -rf "$LOCK" "$TMP"' EXIT
    say "ingest_uscis_i140.py"
    if "$PY" scripts/ingest_uscis_i140.py --out "$TMP/uscis-payload.json" && [ -s "$TMP/uscis-payload.json" ]; then
      # The same store step the quarterly workflow runs. The two tool pages
      # read api.uscisI140.getLatest, so a fetch without this store changes
      # nothing a visitor sees. Uses the Convex CLI's own login on this Mac.
      say "uscisI140:storeStats --prod"
      if ! npx --yes convex run uscisI140:storeStats "$(cat "$TMP/uscis-payload.json")" --prod; then
        rc=1; record_failure "ingest_uscis_i140.py" "payload fetched but convex storeStats failed"
      fi
    else
      rc=1; record_failure "ingest_uscis_i140.py" "fetch or reduce failed"
    fi
    say "ingest_i140_trends.py"
    if ! "$PY" scripts/ingest_i140_trends.py; then
      rc=1; record_failure "ingest_i140_trends.py" "ingest exited non-zero"
    fi
    ;;
esac

say "residential job '$JOB' finished with rc=$rc"
exit $rc
