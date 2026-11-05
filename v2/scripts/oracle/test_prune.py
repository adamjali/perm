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
    saved = (prune.APP, prune.HEALTH, prune.BUDGET, prune.TIGHT, prune.FREE_FLOOR, prune.disk_free)
    try:
        prune.APP, prune.HEALTH = str(app), str(pathlib.Path(tmp) / "prune.json")
        prune.BUDGET = {"live": 12_000, "standby": 4_000, "old": 0}   # 3 pages, 1 page, none
        prune.FREE_FLOOR = 0
        prune.disk_free = lambda: 1000 * prune.GB     # a roomy disk, so the budgets stay as set
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
        prune.APP, prune.HEALTH, prune.BUDGET, prune.TIGHT, prune.FREE_FLOOR, prune.disk_free = saved

# The budgets fit the disk (Nov 5 2026): every cache at its budget leaves KEEP_FREE free.
G = prune.GB
b, f = prune.fit(prune.BUDGET, 100 * G, 10 * G, 2, 2)
check("with room to spare the budgets stay as set", b == prune.BUDGET and not f, str(b))
# Nov 5 2026 on the server: 63 GB free, the caches holding 27.7 GB, two live and two standby folders.
b, f = prune.fit(prune.BUDGET, 63 * G, int(27.7 * G), 2, 2)
at_cap = 63 * G + int(27.7 * G) - (b["live"] * 2 + b["standby"] * 2)
check("a disk that has grown shrinks the live budget", f and b["live"] < prune.BUDGET["live"], str(b))
check("every cache at its fitted budget leaves 30 GB free", abs(at_cap - prune.KEEP_FREE) < G, f"{at_cap / G:.1f} GB")
check("the standby keeps its budget while the live one can still shrink", b["standby"] == prune.BUDGET["standby"])
b, f = prune.fit(prune.BUDGET, 35 * G, 5 * G, 2, 2)
check("a disk with little room drops the standby first", b["standby"] == 0 and b["live"] >= prune.TIGHT["live"], str(b))
b, f = prune.fit(prune.BUDGET, 25 * G, 0, 2, 2)
check("the live budget never goes under the tight one", b["live"] == prune.TIGHT["live"], str(b))

# The whole run with a crowded disk records the fitted budget, which the alarm reads.
with tempfile.TemporaryDirectory() as tmp:
    app = pathlib.Path(tmp) / "app"
    for rel in ("a", "a.w2"):
        r = app / "releases" / rel
        (r / ".next" / "server").mkdir(parents=True)
        (r / "server.js").write_text("")
        for i in range(5):
            page(r / f".next/server/route-cache/APP_PAGE/h{i}/$/p{i}")
    (app / "slots").mkdir()
    for slot, rel in (("blue", "a"), ("blue2", "a.w2")):
        (app / "slots" / slot).symlink_to(app / "releases" / rel)
    (app / "active").write_text("blue")
    saved = (prune.APP, prune.HEALTH, prune.BUDGET, prune.TIGHT, prune.FREE_FLOOR, prune.KEEP_FREE, prune.disk_free)
    try:
        prune.APP, prune.HEALTH = str(app), str(pathlib.Path(tmp) / "prune.json")
        prune.BUDGET = {"live": 20_000, "standby": 4_000, "old": 0}
        prune.TIGHT = {"live": 4_000, "standby": 0, "old": 0}
        prune.FREE_FLOOR, prune.KEEP_FREE = 0, 30_000
        prune.disk_free = lambda: 18_000          # with 40,000 cached: room 28,000, 14,000 a folder
        prune.main()
        rep = _json.loads(pathlib.Path(prune.HEALTH).read_text())
        by = {r["release"]: r for r in rep["releases"]}
        check("the run fits the budgets and says so", rep["fitted"] is True and rep["keepFreeGB"] == 0, str(rep))
        check("each live folder keeps what the fitted budget allows (3 of 5 pages)",
              by["a"]["pages"] == 3 and by["a.w2"]["pages"] == 3, str({k: v["pages"] for k, v in by.items()}))
    finally:
        (prune.APP, prune.HEALTH, prune.BUDGET, prune.TIGHT, prune.FREE_FLOOR, prune.KEEP_FREE, prune.disk_free) = saved

# Every slot runs two copies, each in its own folder with the slot's role, so
# a folder's budget is half the slot's: two live folders must fit 60 GB.
check("the live slot's two folders share 60 GB", prune.BUDGET["live"] * 2 == 60 * prune.GB,
      str(prune.BUDGET["live"] / prune.GB))
check("the standby slot's two folders share 6 GB", prune.BUDGET["standby"] * 2 == 6 * prune.GB)

sys.exit(1 if failures else 0)
