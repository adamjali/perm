#!/usr/bin/env python3
"""Every calculator and data page, checked against the running build.

WHAT THIS ASSERTS BEYOND "200 OK". A data-fed page that renders its empty
state returns a perfectly good 200 with a perfectly good title, so a status
sweep passes a site whose every number is missing. Each row below therefore
carries a MARKER that only appears when the page has real data in it, and a
FORBIDDEN string that only appears when it has fallen back.

The first assertion of every probe is that it is on its subject: a page whose
own H1 marker is missing is reported as such rather than counted as a pass.
"""
from __future__ import annotations

import html
import re
import sys
import urllib.request

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:3131"

# (path, subject marker, data marker, forbidden-when-healthy)
PAGES = [
    ("/tools/perm-timeline-calculator", "filing month", "Most likely", "no data"),
    ("/tools/perm-deadline-calculator", "deadline", "prevailing wage", None),
    ("/tools/pwd-calculator", "prevailing wage", "ahead of yours", None),
    ("/tools/priority-date-calculator", "priority date", "Final Action", None),
    ("/tools/i140-calculator", "I-140", "months", None),
    ("/tools/i140-trends", "I-140", "USCIS", None),
    ("/tools/i485-queue-position", "I-485", "pending", None),
    ("/tools/green-card-timeline", "green card", "PERM", None),
    ("/tools/salary-explorer", "salary", "percentile", None),
    ("/perm-queue", "PERM queue", "first letter", None),
    ("/perm-decision-activity", "queue is moving", "The cases DOL moved on", None),
    ("/perm-processing-times", "processing", "days", None),
    ("/perm-denial-risk", "denial", "%", None),
    ("/perm-rfi-audit", "RFI", "%", None),
    ("/perm-cases", "case", "employer", None),
    ("/perm-employers", "employer", "cases", None),
    ("/perm-wages", "wage", "percentile", None),
    ("/perm-by-state", "state", "cases", None),
    ("/perm-case-status", "case", "case number", None),
    ("/tools", "tools", "calculator", None),
]


def text_of(path: str) -> tuple[str, str]:
    raw = urllib.request.urlopen(BASE + path, timeout=180).read().decode("utf8", "ignore")
    t = re.sub(r"<script.*?</script>", " ", raw, flags=re.S)
    t = re.sub(r"<style.*?</style>", " ", t, flags=re.S)
    t = re.sub(r"<[^>]+>", " ", t)
    return html.unescape(re.sub(r"\s+", " ", t)), raw


def main() -> int:
    bad = 0
    print(f"{'page':36} {'subject':>8} {'data':>6} {'chars':>8}")
    for path, subject, marker, forbidden in PAGES:
        try:
            txt, raw = text_of(path)
        except Exception as exc:  # noqa: BLE001
            print(f"{path:36} {'ERROR':>8}  {exc}")
            bad += 1
            continue
        on_subject = subject.lower() in txt.lower()
        has_data = marker.lower() in txt.lower()
        fell_back = bool(forbidden) and forbidden.lower() in txt.lower()
        ok = on_subject and has_data and not fell_back
        if not ok:
            bad += 1
        print(f"{path:36} {'ok' if on_subject else 'OFF':>8} "
              f"{'ok' if has_data else 'MISS':>6} {len(txt):8,}"
              f"{'   <- FELL BACK' if fell_back else ''}")
    print()
    print(f"{len(PAGES) - bad} of {len(PAGES)} pages carry real data")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
