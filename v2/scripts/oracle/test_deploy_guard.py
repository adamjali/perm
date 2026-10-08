#!/usr/bin/env python3
"""The deploy never replaces a release a slot runs from.

Oct 8 2026, 2:19 PM EDT: a second run on the same commit arrived under the
live release's name, and the deploy's `rm -rf` deleted most of the folder the
live site was serving from. Runs the real bin/permtracker-deploy under bash in
a scratch copy of /srv/permtracker/app: a release a slot (first or second
copy) runs from is refused with exit 5 and left whole; any other name gets
past the guard.

Linux only (GNU readlink -f and bash 4); CI and the server run it.

Run: python3 scripts/oracle/test_deploy_guard.py
"""
from __future__ import annotations

import os
import pathlib
import platform
import subprocess
import sys
import tempfile

HERE = pathlib.Path(__file__).resolve().parent
SCRIPT = HERE / "bin" / "permtracker-deploy"
failures: list[str] = []


def check(ok: bool, msg: str) -> None:
    print(("  ok   " if ok else "  FAIL ") + msg)
    if not ok:
        failures.append(msg)


def run(app: pathlib.Path, bindir: pathlib.Path, rel: str) -> subprocess.CompletedProcess:
    text = SCRIPT.read_text().replace("A=/srv/permtracker/app", f"A={app}", 1)
    script = app.parent / "permtracker-deploy"
    script.write_text(text)
    env = {**os.environ, "PATH": f"{bindir}:{os.environ['PATH']}"}
    return subprocess.run(["bash", str(script), f"deploy {rel}"], input=b"", capture_output=True, env=env, timeout=60)


def main() -> int:
    if platform.system() != "Linux":
        print("skipped: Linux only (CI and the server run it)")
        return 0
    with tempfile.TemporaryDirectory() as tmp:
        root = pathlib.Path(tmp)
        app, bindir = root / "app", root / "bin"
        for d in ("releases", "slots", "incoming", "env", "shared/_next/static"):
            (app / d).mkdir(parents=True)
        bindir.mkdir()
        (bindir / "logger").write_text("#!/bin/sh\nexit 0\n")
        (bindir / "logger").chmod(0o755)
        live = "14bbcd8ef65b-1"
        for name in (live, f"{live}.w2", "0ebdf27d43aa-1"):
            (app / "releases" / name).mkdir()
            (app / "releases" / name / "server.js").write_text("// the live build\n")
        os.symlink(app / "releases" / live, app / "slots" / "green")
        os.symlink(app / "releases" / f"{live}.w2", app / "slots" / "green2")
        os.symlink(app / "releases" / "0ebdf27d43aa-1", app / "slots" / "blue")
        (app / "active").write_text("green\n")

        r = run(app, bindir, live)
        check(r.returncode == 5, f"the live release's name is refused with exit 5 (got {r.returncode})")
        check((app / "releases" / live / "server.js").exists(), "the live release is left whole")
        check(b"refusing to replace it" in r.stdout, "the refusal says why")

        r = run(app, bindir, "0ebdf27d43aa-1")
        check(r.returncode == 5, "the rollback copy's release (blue) is refused too")
        check((app / "releases" / "0ebdf27d43aa-1" / "server.js").exists(), "and left whole")

        r = run(app, bindir, "aaaaaaaaaaaa-7")
        check(r.returncode not in (0, 5), "a new name gets past the guard (an empty upload then fails on its own)")
        check(b"received" in r.stdout and (app / "releases" / live / "server.js").exists(),
              "it read its upload, and the live release is still whole")
    print(f"\n{len(failures)} failure(s)")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
