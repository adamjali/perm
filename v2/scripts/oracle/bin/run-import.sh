#!/bin/bash
# One-off: copy the Turso database into a local SQLite file.
set -euo pipefail
cd /srv/permtracker/db/import
log(){ echo "$(date -u +%FT%TZ) $*" >> import.log; }
set -a; eval "$(tr -d "\"" < /srv/permtracker/secrets/turso_migration.env)"; set +a
H=${TURSO_DATABASE_URL#libsql://}; H=${H#https://}
log "download start"
curl -sS --fail --retry 3 --max-time 7200 -H "Authorization: Bearer $TURSO_AUTH_TOKEN" "https://$H/dump" -o dump.sql
log "download done bytes=$(stat -c %s dump.sql) last_line=$(tail -c 200 dump.sql | tail -n1)"
tail -n1 dump.sql | grep -q "^COMMIT;" || { log "INCOMPLETE dump (no COMMIT at end)"; exit 1; }
rm -f data.db data.db-wal data.db-shm
log "load start"
{ printf "PRAGMA journal_mode=OFF;\nPRAGMA synchronous=OFF;\nPRAGMA cache_size=-2000000;\nPRAGMA temp_store=MEMORY;\n"; cat dump.sql; } | sqlite3 -bail data.db 2>> import.err
log "load done size=$(stat -c %s data.db)"
log "tables=$(sqlite3 data.db "select count(*) from sqlite_master where type=\"table\"") indexes=$(sqlite3 data.db "select count(*) from sqlite_master where type=\"index\"")"
log "quick_check=$(sqlite3 data.db "pragma quick_check" | head -1)"
log "ALL DONE"
