#!/usr/bin/env python3
"""The database copy that leaves the server is sealed (since Nov 4 2026, owner's yes).

bin/permtracker-backup seals the nightly dump with the backup key's public half before it goes to R2, uploads the
sealed file and never the plain one, keeps OFFSITE_OK at the three fields the health report reads, and records the
sealed file's checksum for the monthly restore test, which compares it with R2's copy and loads the local plain
copy of the same night. Checked on the real dump the night it shipped: sealed on the server, opened with the
owner's key on the Mac, the same 341,562,675 bytes.

Run: python3 scripts/oracle/test_backup_seal.py
"""
from __future__ import annotations

import pathlib
import re
import sys

HERE = pathlib.Path(__file__).resolve().parent
BACKUP = (HERE / "bin" / "permtracker-backup").read_text()
RESTORE = (HERE / "bin" / "permtracker-restore-test").read_text()
HEALTH = (HERE / "bin" / "permtracker-health").read_text()
failures: list[str] = []


def check(ok: bool, msg: str) -> None:
    print(("  ok   " if ok else "  FAIL ") + msg)
    if not ok:
        failures.append(msg)


offsite = BACKUP[BACKUP.index("# ---- off-site copy"):]
seal = offsite.find("openssl cms -encrypt")
upload = offsite.find('"r2:permtracker-backups/db/')
check(seal != -1 and upload != -1 and seal < upload, "the dump is sealed before its upload to R2")
check("-aes-256-gcm" in offsite[seal:upload] and "backup-recipient.pem" in offsite[:upload],
      "sealed with AES-256-GCM to the backup key's public half, as the other two copies are")
db_copy = [line for line in offsite.splitlines() if "rclone copyto" in line and "backups/db/" in line]
check(len(db_copy) == 1 and db_copy[0].split()[2] == '"$sealed"', f"the upload sends the sealed file, never the plain one ({db_copy})")
check(re.search(r"printf '%s %s %s\\n' [^\n]*> \"\$B/OFFSITE_OK\"", offsite) is not None,
      "OFFSITE_OK keeps its three fields")
check('at, size, name = (APP / "backups" / "OFFSITE_OK").read_text().split()' in HEALTH,
      "the health report still reads those three fields")
check('> "$B/OFFSITE_SHA"' in offsite, "the sealed file's checksum is recorded for the restore test")

case = RESTORE[RESTORE.index('case "$newest" in'):RESTORE.index("esac")]
check("OFFSITE_SHA" in case and "sha256sum" in case, "the restore test compares R2's sealed copy with the recorded checksum")
check('dump="$B/${newest%.cms}"' in case, "and then loads the local plain copy of the same night")
check('".sql.zst.cms"' in RESTORE, "it finds sealed copies in R2")
check('rm -f "$work/restore.db" "$work/$newest"' in RESTORE and 'rm -f "$dump"' not in RESTORE,
      "it never deletes the local copy it loaded")

print(f"\n{len(failures)} failure(s)")
sys.exit(1 if failures else 0)
