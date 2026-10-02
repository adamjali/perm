"""The key this site's own audit scripts send to skip the per-address limits.

The server's front door (scripts/oracle/nginx/permtracker.conf) exempts a
request whose `x-permtracker-audit` header matches the audit key from the
per-address rate limits, so an audit that walks hundreds of pages isn't
answered 429. The key lives in `.env.local` (mode 600) or the environment,
never in this public repo; a header that merely existed would be a bypass
for anyone. Without it the scripts still run, at the rate any client gets.
"""
from __future__ import annotations

import os
import pathlib

HEADER = "x-permtracker-audit"
_ENV_FILE = pathlib.Path(__file__).resolve().parent.parent / ".env.local"


def audit_key() -> str | None:
    value = os.environ.get("PERMTRACKER_AUDIT_KEY", "").strip()
    if value:
        return value
    try:
        for line in _ENV_FILE.read_text().splitlines():
            if line.startswith("PERMTRACKER_AUDIT_KEY="):
                return line.split("=", 1)[1].strip().strip('"') or None
    except OSError:
        return None
    return None


def audit_headers() -> dict[str, str]:
    """The header to add to a request, or nothing when no key is configured."""
    key = audit_key()
    return {HEADER: key} if key else {}
