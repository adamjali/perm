#!/bin/bash
# Install (or reinstall) the residential launchd agents on this Mac.
#
#   bash v2/scripts/launchd/install.sh          # from the repo root or v2
#
# Fills __REPO__ and __HOME__ into the plists, copies them to
# ~/Library/LaunchAgents, and (re)loads them for the logged-in user. Safe to
# re-run: it unloads any previous copy first. Prints the loaded state so a
# silent failure to load cannot read as success.
set -euo pipefail
REPO="$(git -C "$(dirname "$0")" rev-parse --show-toplevel)"
DEST="$HOME/Library/LaunchAgents"
LOGS="$HOME/Library/Logs/permtracker"
mkdir -p "$DEST" "$LOGS"
for name in app.permtracker.i485 app.permtracker.i140; do
  src="$REPO/v2/scripts/launchd/$name.plist"
  dst="$DEST/$name.plist"
  sed -e "s#__REPO__#$REPO#g" -e "s#__HOME__#$HOME#g" "$src" > "$dst"
  plutil -lint "$dst" > /dev/null
  launchctl bootout "gui/$(id -u)/$name" 2>/dev/null || true
  launchctl bootstrap "gui/$(id -u)" "$dst"
  printf '%-24s ' "$name"
  launchctl print "gui/$(id -u)/$name" | grep -E "state = |program = " | tr -s ' ' | tr '\n' ' '
  echo
done
echo "logs: $LOGS"
