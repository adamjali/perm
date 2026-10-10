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

    check("the tree size counts every file under .next/server",
          prune.tree_size(str(rel / ".next" / "server")) == 8000, str(prune.tree_size(str(rel / ".next" / "server"))))
    freed = [prune.remove(stem) for _u, _s, stem in prune.groups(str(rel))]
    left = [p for p in rel.rglob("*") if p.is_file() and p.name != "server.js"]
    check("removing frees both folders", left == [], str(left))
    check("remove reports the bytes it actually freed", freed == [4000, 4000], str(freed))
    check("a page that's already gone frees nothing", prune.remove(str(rel / ".next/server/app/perm-queue")) == 0)

# The whole run: roles from the slots, least recently used out first, the
# budget per role, the report on disk.
import json as _json, os as _os, time as _time
with tempfile.TemporaryDirectory() as tmp:
    app = pathlib.Path(tmp) / "app"
    for rel in ("a", "a.w2", "b", "c"):
        r = app / "releases" / rel
        (r / ".next" / "server").mkdir(parents=True)
        (r / "server.js").write_text("")
        for i in range(5):
            stem = r / f".next/server/route-cache/APP_PAGE/h{i}/$/p{i}"
            page(stem)
            t = _time.time() - 1000 + i * 100       # p4 newest
            for ext in (".html", ".meta"):
                _os.utime(str(stem) + ext, (t, t))
    (app / "slots").mkdir()
    for slot, rel in (("blue", "a"), ("blue2", "a.w2"), ("green", "b")):
        (app / "slots" / slot).symlink_to(app / "releases" / rel)
    (app / "active").write_text("blue")
    saved = (prune.APP, prune.HEALTH, prune.BUDGET, prune.TIGHT, prune.FREE_FLOOR)
    try:
        prune.APP, prune.HEALTH = str(app), str(pathlib.Path(tmp) / "prune.json")
        prune.BUDGET = {"live": 12_000, "standby": 4_000, "old": 0}   # 3 pages, 1 page, none
        prune.FREE_FLOOR = 0
        prune.main()
        report = {r["release"]: r for r in _json.loads(pathlib.Path(prune.HEALTH).read_text())["releases"]}
        check("both live folders keep their 3 newest pages", report["a"]["pages"] == 3 and report["a.w2"]["pages"] == 3,
              str({k: v["pages"] for k, v in report.items()}))
        check("the standby slot keeps 1, an old release none", report["b"]["pages"] == 1 and report["c"]["pages"] == 0,
              str({k: v["pages"] for k, v in report.items()}))
        check("roles come from the slots", (report["a"]["role"], report["b"]["role"], report["c"]["role"]) == ("live", "standby", "old"))
        kept = sorted(pp.name for pp in (app / "releases" / "a").rglob("*.meta"))
        check("the least recently used went first", kept == ["p2.meta", "p3.meta", "p4.meta"], str(kept))
        check("the report records what Next really holds beside what was counted",
              all("serverGB" in r for r in report.values()))
    finally:
        prune.APP, prune.HEALTH, prune.BUDGET, prune.TIGHT, prune.FREE_FLOOR = saved

# Every slot runs two copies, each in its own folder with the slot's role, so
# a folder's budget is half the slot's: two live folders must fit 60 GB.
check("the live slot's two folders share 60 GB", prune.BUDGET["live"] * 2 == 60 * prune.GB,
      str(prune.BUDGET["live"] / prune.GB))
check("the standby slot's two folders share 6 GB", prune.BUDGET["standby"] * 2 == 6 * prune.GB)

sys.exit(1 if failures else 0)
