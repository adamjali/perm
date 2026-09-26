"""The value this site's own scripts send to get past its firewall.

Vercel Firewall rule 5 bypasses Bot Protection and the per-IP page limit for
requests carrying `x-permtracker-audit`. Until Sep 25 2026 the rule matched on
the header merely EXISTING, and this public repository printed the header's
name in a dozen places, so anyone could send `x-permtracker-audit: 1` and walk
past the challenge (measured: 429 without it, 200 with any value). The rule now
matches the header's VALUE, which lives in `.env.local` (mode 600) or the
environment and never in the repo. Without it the scripts still run, at the
rate the firewall allows any client.
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
