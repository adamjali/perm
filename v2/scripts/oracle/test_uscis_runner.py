#!/usr/bin/env python3
"""The server's job runner fails a unit only for what the alarm should email.

Runs the real bin/permtracker-uscis under bash against stand-ins for git,
python3, timeout, nice and curl, in a scratch copy of /srv/permtracker. On Oct
30 and 31 2026 one source of the policy watch (reginfo.gov answering 502, then
a cut-off robots.txt) failed the whole unit on every 30-minute run, and the
alarm emailed for each. These hold:

* one policy source failing records that source's failure row and leaves the
  unit's exit 0, with a warning naming the source;
* every source failing in one run fails the unit (the server, not a source,
  is broken then);
* the FLAG notice's limit is longer than its own two tries can take.

Run: python3 scripts/oracle/test_uscis_runner.py
"""
from __future__ import annotations

import os
import pathlib
import re
import shutil
import subprocess
import sys
import tempfile

HERE = pathlib.Path(__file__).resolve().parent
SCRIPT = HERE / "bin" / "permtracker-uscis"
NOTICE = HERE.parent / "ingest_flag_notice.py"
failures: list[str] = []

# A python3 that "runs" a script: it fails the scripts named in FAIL_SCRIPTS
# (or all of them when FAIL_SCRIPTS is "*"), and logs every failure row it is
# asked to record.
FAKE_PYTHON = r"""#!/bin/bash
for a in "$@"; do
  case "$a" in
    scripts/record_ingest_failure.py) echo "$*" >> "$RUN_ROOT/failures"; exit 0 ;;
    scripts/*.py)
      name="${a#scripts/}"
      echo "$name" >> "$RUN_ROOT/ran"
      if [ "${FAIL_SCRIPTS:-}" = "*" ]; then exit 1; fi
      case " ${FAIL_SCRIPTS:-} " in *" $name "*) exit 1 ;; esac
      exit 0 ;;
  esac
done
exit 0
"""
FAKE_TIMEOUT = '#!/bin/bash\nshift\nexec "$@"\n'
FAKE_NICE = '#!/bin/bash\n[ "$1" = -n ] && shift 2\nexec "$@"\n'
FAKE_OK = "#!/bin/bash\nexit 0\n"


def check(name: str, ok: bool, detail: str = "") -> None:
    print(f"  {'ok  ' if ok else 'FAIL'} {name}{f'  ({detail})' if detail and not ok else ''}")
    if not ok:
        failures.append(name)


def run(root: pathlib.Path, job: str, fail: str) -> tuple[int, str, list[str], list[str]]:
    for f in ("ran", "failures"):
        (root / f).unlink(missing_ok=True)
    env = {**os.environ, "PATH": f"{root / 'bin'}:/usr/bin:/bin", "RUN_ROOT": str(root), "FAIL_SCRIPTS": fail}
    r = subprocess.run(["bash", str(root / "permtracker-uscis"), job], capture_output=True, text=True, env=env, timeout=60)
    read = lambda f: (root / f).read_text().splitlines() if (root / f).exists() else []  # noqa: E731
    return r.returncode, r.stdout + r.stderr, read("ran"), read("failures")


def setup(root: pathlib.Path) -> None:
    srv = root / "srv" / "permtracker"
    (srv / "repo" / "v2" / "scripts").mkdir(parents=True)
    (srv / "app" / "env").mkdir(parents=True)
    (srv / "app" / "env" / "uscis.env").write_text("DATA_GOV_API_KEY=test\n")
    (srv / "app" / "env" / "production.env").write_text("REVALIDATE_SECRET=test\n")
    bin_dir = root / "bin"
    bin_dir.mkdir()
    for name, body in (("python3", FAKE_PYTHON), ("timeout", FAKE_TIMEOUT), ("nice", FAKE_NICE),
                       ("git", FAKE_OK), ("curl", FAKE_OK)):
        (bin_dir / name).write_text(body)
        (bin_dir / name).chmod(0o755)
    text = SCRIPT.read_text().replace("/srv/permtracker", str(srv))
    (root / "permtracker-uscis").write_text(text)


def main() -> int:
    root = pathlib.Path(tempfile.mkdtemp(prefix="pt-uscis-"))
    try:
        setup(root)
        print("policy-watch")
        rc, out, ran, recorded = run(root, "policy-watch", "")
        check("every source runs", "ingest_rule_pipeline.py" in ran and "ingest_court_opinions.py" in ran
              and len(ran) >= 8, str(ran))
        check("...and a clean run exits 0", rc == 0, out[-300:])
        rc, out, ran, recorded = run(root, "policy-watch", "ingest_rule_pipeline.py")
        check("one source failing leaves the unit's exit 0", rc == 0, out[-300:])
        check("...records that source's failure row", any("ingest_rule_pipeline.py" in r for r in recorded), str(recorded))
        check("...warns naming it", "::warning::ingest_rule_pipeline.py failed" in out, out[-300:])
        check("...and still runs every later source", "ingest_court_opinions.py" in ran, str(ran))
        rc, out, ran, recorded = run(root, "policy-watch", "*")
        check("every source failing fails the unit", rc == 1, out[-300:])
        check("...with a failure row for each", len(recorded) == len(ran), f"{len(recorded)} rows, {len(ran)} sources")

        print("flag-notice")
        rc, out, _, _ = run(root, "flag-notice", "")
        check("a clean read exits 0", rc == 0, out[-300:])
        rc, out, _, recorded = run(root, "flag-notice", "ingest_flag_notice.py")
        check("a non-zero exit fails the unit and records why", rc == 1 and len(recorded) == 1, out[-300:])
        limit = re.search(r"flag-notice\) timeout (\d+)m", SCRIPT.read_text())
        notice = NOTICE.read_text()
        attempts = int(re.search(r"^ATTEMPTS = (\d+)", notice, re.M).group(1))
        per_try = int(re.search(r"^TIMEOUT_S = (\d+)", notice, re.M).group(1))
        # robots.txt (30 s), each try, and the 20-second waits between them.
        worst = 30 + attempts * per_try + 20 * sum(3 ** i for i in range(attempts - 1))
        check("the FLAG notice's two tries fit inside its limit",
              limit is not None and worst < int(limit.group(1)) * 60, f"worst {worst}s, limit {limit and limit.group(1)}m")
    finally:
        shutil.rmtree(root, ignore_errors=True)
    if failures:
        print(f"\n{len(failures)} FAILED")
        return 1
    print("\nall passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
