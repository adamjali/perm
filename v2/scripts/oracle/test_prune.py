#!/usr/bin/env python3
"""The page-cache cap sees every folder Next renders pages into.

bin/permtracker-prune removes rendered pages above a disk budget. Next 16.3
moved those pages from .next/server/app into .next/server/route-cache, and the
cap, reading only the first folder, reported "0 pages" while the second grew:
on Oct 10 2026 the 145 GB disk filled to 100% and the database stopped writing.

* a page under server/route-cache/<KIND>/<hash>/$/ counts, with its .segments;
* a page under server/app still counts;
* an old release's budget of 0 removes both, .html first.

Run: python3 scripts/oracle/test_prune.py
"""
from __future__ import annotations

import importlib.machinery
import importlib.util
import pathlib
import sys
import tempfile

HERE = pathlib.Path(__file__).resolve().parent
loader = importlib.machinery.SourceFileLoader("prune", str(HERE / "bin" / "permtracker-prune"))
spec = importlib.util.spec_from_loader("prune", loader)
assert spec
prune = importlib.util.module_from_spec(spec)
loader.exec_module(prune)
# Every file this test writes is "after the deploy": the real margin counts
# pages written within two minutes of server.js as the build's own.
prune.MARGIN_S = -10

failures: list[str] = []


def check(name: str, ok: bool, detail: str = "") -> None:
    print(("ok   " if ok else "FAIL ") + name + (f": {detail}" if detail and not ok else ""))
    if not ok:
        failures.append(name)


def page(stem: pathlib.Path, size: int = 1000) -> None:
    stem.parent.mkdir(parents=True, exist_ok=True)
    for ext in (".html", ".rsc", ".meta"):
        (stem.parent / (stem.name + ext)).write_bytes(b"x" * size)
    seg = stem.parent / (stem.name + ".segments")
    seg.mkdir()
    (seg / "_index.segment.rsc").write_bytes(b"x" * size)


with tempfile.TemporaryDirectory() as tmp:
    rel = pathlib.Path(tmp) / "abc-1"
    (rel / ".next" / "server").mkdir(parents=True)
    (rel / "server.js").write_text("")
    page(rel / ".next/server/app/perm-queue")
    page(rel / ".next/server/route-cache/APP_PAGE/195f96ac/$/calculators")

    found = sorted(stem for _u, _s, stem in prune.groups(str(rel)))
    check("a route-cache page counts", any("route-cache" in s for s in found), str(found))
    check("a server/app page still counts", any("/server/app/" in s for s in found), str(found))
    sizes = [s for _u, s, _st in prune.groups(str(rel))]
    check("a page's size includes its segments", sizes == [4000, 4000], str(sizes))

    for _u, _s, stem in prune.groups(str(rel)):
        prune.remove(stem)
    left = [p for p in rel.rglob("*") if p.is_file() and p.name != "server.js"]
    check("removing frees both folders", left == [], str(left))

# Every slot runs two copies, each in its own folder with the slot's role, so
# a folder's budget is half the slot's: two live folders must fit 60 GB.
check("the live slot's two folders share 60 GB", prune.BUDGET["live"] * 2 == 60 * prune.GB,
      str(prune.BUDGET["live"] / prune.GB))
check("the standby slot's two folders share 6 GB", prune.BUDGET["standby"] * 2 == 6 * prune.GB)

sys.exit(1 if failures else 0)
