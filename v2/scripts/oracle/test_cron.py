#!/usr/bin/env python3
"""A busy site is a wait for the cron dispatcher, not a failure.

Runs the real bin/permtracker-cron under bash against a stand-in curl that
answers a scripted run of status codes, with a stand-in sleep that records
each wait instead of waiting. The case it exists for, from Oct 12 2026: a
scraper filled the app at 6 AM, nginx answered the ingest-health dispatch with
its instant 503 "busy", the job failed and the alarm emailed the owner.

Run: python3 scripts/oracle/test_cron.py
"""
from __future__ import annotations

import os
import pathlib
import subprocess
import sys
import tempfile

HERE = pathlib.Path(__file__).resolve().parent
SCRIPT = HERE / "bin" / "permtracker-cron"
failures: list[str] = []

# Answers the next line of $CRON_CODES each call: "503", "503:45" (with a
# retryAfter of 45), "200", or "000" for a dropped connection.
FAKE_CURL = r"""#!/bin/bash
out=""
while [ $# -gt 0 ]; do
  case "$1" in -o) out="$2"; shift 2 ;; *) shift ;; esac
done
n=$(cat "$CRON_STATE/calls" 2>/dev/null || echo 0); n=$((n + 1)); echo "$n" > "$CRON_STATE/calls"
line=$(sed -n "${n}p" "$CRON_STATE/codes")
code="${line%%:*}"; after="${line#*:}"
[ "$after" = "$line" ] && after=15
[ "$code" = 000 ] && exit 7
if [ "$code" = 200 ]; then echo '{"dispatched":true}' > "$out"
else echo "{\"error\":\"busy\",\"retryAfter\":$after}" > "$out"; fi
printf '%s' "$code"
"""
FAKE_SLEEP = r"""#!/bin/bash
echo "$1" >> "$CRON_STATE/slept"
"""


def check(name: str, ok: bool, detail: str = "") -> None:
    print(("ok   " if ok else "FAIL ") + name + (f"  ({detail})" if detail and not ok else ""))
    if not ok:
        failures.append(name)


def run(codes: list[str]) -> tuple[int, list[str], int]:
    with tempfile.TemporaryDirectory() as tmp:
        t = pathlib.Path(tmp)
        (t / "bin").mkdir()
        (t / "root" / "secrets").mkdir(parents=True)
        (t / "root" / "secrets" / "cron_secret").write_text("test-secret\n")
        (t / "codes").write_text("\n".join(codes) + "\n")
        for name, body in (("curl", FAKE_CURL), ("fakesleep", FAKE_SLEEP)):
            p = t / "bin" / name
            p.write_text(body)
            p.chmod(0o755)
        env = {
            **os.environ,
            "PATH": f"{t / 'bin'}:{os.environ['PATH']}",
            "PT_ROOT": str(t / "root"),
            "PT_SLEEP": str(t / "bin" / "fakesleep"),
            "CRON_STATE": str(t),
        }
        r = subprocess.run(["bash", str(SCRIPT), "dispatch-ingest-health"], env=env, capture_output=True, text=True, timeout=60)
        slept = (t / "slept").read_text().split() if (t / "slept").exists() else []
        calls = int((t / "calls").read_text()) if (t / "calls").exists() else 0
        return r.returncode, slept, calls


def main() -> int:
    rc, slept, calls = run(["503", "200"])
    check("a busy reply is asked again, and the second answer counts", rc == 0 and calls == 2, f"rc={rc} calls={calls}")
    check("the first wait is 15 s", slept == ["15"], str(slept))

    rc, slept, calls = run(["404"])
    check("a refusal that waiting won't fix fails at once", rc == 1 and calls == 1 and slept == [], f"rc={rc} calls={calls} slept={slept}")

    rc, slept, calls = run(["503"] * 5)
    check("five busy replies in a row fail the job", rc == 1 and calls == 5, f"rc={rc} calls={calls}")
    check("the waits lengthen, about five minutes in all", slept == ["15", "30", "60", "120"], str(slept))

    rc, slept, calls = run(["000", "200"])
    check("a dropped connection is asked again", rc == 0 and calls == 2, f"rc={rc} calls={calls}")

    rc, slept, calls = run(["503:45", "200"])
    check("the wait the site names is honoured when longer", slept == ["45"], str(slept))

    rc, slept, calls = run(["200"])
    check("a first answer needs no wait", rc == 0 and calls == 1 and slept == [], f"rc={rc} calls={calls} slept={slept}")

    print(f"\n{len(failures)} failure(s)")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
