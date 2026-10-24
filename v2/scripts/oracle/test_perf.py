#!/usr/bin/env python3
"""bin/permtracker-perf: the readings it takes and what it calls a regression.

Run: python3 scripts/oracle/test_perf.py   (exit 1 on any failure)
"""
from __future__ import annotations

import importlib.machinery
import importlib.util
import json
import pathlib
import sys
import tempfile

HERE = pathlib.Path(__file__).resolve().parent
loader = importlib.machinery.SourceFileLoader("perf", str(HERE / "bin" / "permtracker-perf"))
spec = importlib.util.spec_from_loader("perf", loader)
perf = importlib.util.module_from_spec(spec)
loader.exec_module(perf)

failures: list[str] = []


def check(name: str, ok: bool, detail: str = "") -> None:
    print(f"  {'ok  ' if ok else 'FAIL'} {name}" + (f"  ({detail})" if detail and not ok else ""))
    if not ok:
        failures.append(name)


T0 = perf.log_time("21/Oct/2026:13:00:00 +0000")


def line(sec: int, path: str, urt: str, nc: str, method: str = "GET", status: int = 200) -> str:
    m, s = divmod(sec, 60)
    return (f'1.2.3.4 - - [21/Oct/2026:13:{m:02d}:{s:02d} +0000] "{method} {path} HTTP/1.1" {status} 1234 '
            f'"https://permtracker.app" "Mozilla/5.0 (X11) Chrome/150" rt=0.5 urt={urt} nc={nc}')


def test_logs() -> None:
    print("the main log")
    check("nginx time read as UTC epoch", T0 == 1792587600, str(T0))
    check("a time with an offset is moved to UTC", perf.log_time("21/Oct/2026:09:00:00 -0400") == T0)
    check("an employer page is its family's detail page", perf.family("/perm-employers/adobe-inc") == "/perm-employers/*")
    check("an index page is its own", perf.family("/perm-employers?q=adobe") == "/perm-employers")
    check("the homepage", perf.family("/") == "/")
    check("two upstream tries are added", perf.upstream_seconds("0.2, 0.3") == 0.5)
    check("an answer nginx gave itself has no upstream time", perf.upstream_seconds("-") is None)
    lines = [
        line(10, "/perm-employers/a", "0.40", "MISS"),
        line(11, "/perm-employers/b", "0.60", "MISS"),
        line(12, "/perm-employers/a", "0.02", "HIT"),
        line(13, "/perm-employers/a?_rsc=x1", "0.01", "HIT"),
        line(14, "/perm-queue", "0.90", "MISS"),
        line(15, "/perm-queue", "-", ""),
        line(16, "/api/x", "0.30", "", method="POST"),
        line(0, "/perm-employers/c", "9.00", "MISS"),
    ]
    got = perf.page_costs(lines, T0 + 5)
    check("only GETs inside the window with an upstream time are counted", got["requests"] == 5, str(got["requests"]))
    check("employer page builds pooled", got["entityBuilds"]["n"] == 2, str(got["entityBuilds"]))
    check("every page build pooled", got["builds"]["n"] == 3, str(got["builds"]))
    check("navigation data is apart from pages", any(r["kind"] == "data" for r in got["byType"]))
    check("cached answers pooled", got["cached"]["n"] == 2, str(got["cached"]))
    check("the costliest type first", got["byType"][0]["family"] == "/perm-employers/*", str(got["byType"][0]))


def test_tail() -> None:
    print("reading only a log's last hour")
    with tempfile.TemporaryDirectory() as d:
        log = pathlib.Path(d) / "defend.log"
        rows = [f"{T0 + i} 200 13335 1 \"/p{i}\" \"ua\" {1 if i % 4 == 0 else ''}\n" for i in range(0, 7200, 2)]
        log.write_text("".join(rows))
        perf.TAIL_CHUNK = 2000  # small, so the read has to grow
        got, reached = perf.tail_since(log, T0 + 3600, perf.defend_log_time)
        check("exactly the window's lines", len(got) == 1800 and got[0].startswith(str(T0 + 3600)), f"{len(got)} {got[:1]}")
        check("the file's start wasn't needed", reached is False)
        got, reached = perf.tail_since(log, T0 - 10, perf.defend_log_time)
        check("a window older than the file reads it all and says so", len(got) == 3600 and reached is True)
        rotated = pathlib.Path(d) / "defend.log.1"
        rotated.write_text(f"{T0 - 30} 200 1 1 \"/old\" \"ua\" 1\n{T0 - 5} 200 1 1 \"/older\" \"ua\" \n")
        got = perf.read_window(log, T0 - 10, perf.defend_log_time)
        check("the rotated copy's tail is added when the window starts before the file",
              len(got) == 3601 and "/older" in got[0], f"{len(got)} {got[:1]}")
        share = perf.preload_share(got, T0 - 10)
        check("pre-loads are the lines ending in the flag", share["preloads"] == 1800 and share["requests"] == 3601,
              str(share))
        mixed = [f"{T0} 503 1 false \"/a\" \"ua\" -", f"{T0} 503 1 true \"/b\" \"bot\" -",
                 f"{T0} 503 1 false \"/c\" \"ua\" 1", f"{T0} 200 1 false \"/d\" \"ua\" -"]
        check("a turned-away page counts; a crawler's or a pre-load's doesn't",
              perf.preload_share(mixed, T0 - 1)["refusedPages"] == 1, str(perf.preload_share(mixed, T0 - 1)))
        perf.TAIL_CHUNK = 4 << 20


def test_db() -> None:
    print("the database's hour")
    prev = {"SELECT a": {"count": 10, "ms": 100.0, "rows": 50}, "SELECT b": {"count": 5, "ms": 50.0, "rows": 5}}
    now = {"SELECT a": {"count": 30, "ms": 2100.0, "rows": 150}, "SELECT b": {"count": 5, "ms": 50.0, "rows": 5},
           "SELECT c": {"count": 2, "ms": 10.0, "rows": 2}}
    rows, restarted = perf.db_delta(now, prev)
    by = {r["sql"]: r for r in rows}
    check("the hour's runs and time are the difference", by["SELECT a"]["runs"] == 20 and by["SELECT a"]["totalS"] == 2.0)
    check("a statement that didn't run this hour is left out", "SELECT b" not in by)
    check("a new statement counts whole", by["SELECT c"]["runs"] == 2)
    check("costliest first", rows[0]["sql"] == "SELECT a")
    check("no restart", restarted is False)
    rows, restarted = perf.db_delta({"SELECT a": {"count": 3, "ms": 9.0, "rows": 3}}, prev)
    check("a lower count means the database restarted, and the count is taken whole",
          restarted is True and rows[0]["runs"] == 3)


def test_source_maps() -> None:
    print("naming code from source maps")
    check("our file", perf.tidy_source("webpack://v2/./src/lib/content/index.ts") == "src/lib/content/index.ts")
    check("a package", perf.tidy_source(
        "webpack://v2/../node_modules/.pnpm/reading-time@1.5.0/node_modules/reading-time/lib/x.js") == "reading-time")
    check("a scoped package", perf.tidy_source("webpack://v2/./node_modules/@libsql/client/lib/a.js") == "@libsql/client")
    check("Next's own source is not ours", perf.tidy_source(
        "webpack://v2/../../../src/server/lib/patch-fetch.ts") == "next (patch-fetch.ts)")
    check("VLQ: AAAA", perf.vlq("AAAA") == [0, 0, 0, 0])
    check("VLQ: a negative and a two-digit value", perf.vlq("D") == [-1] and perf.vlq("gB") == [16])
    with tempfile.TemporaryDirectory() as d:
        chunk = pathlib.Path(d) / "1.js"
        chunk.write_text("x")
        # Line 0: columns 0 (source 0) and 10 (source 1). Line 1: column 4, still source 1:
        # a map's source index carries over from line to line.
        (pathlib.Path(d) / "1.js.map").write_text(json.dumps({
            "version": 3, "sources": ["webpack://v2/./src/a.ts", "webpack://v2/../node_modules/pkg/i.js"],
            "mappings": "AAAA,UCAA;IAAA"}))
        maps = perf.SourceMaps()
        url = "file://" + str(chunk)
        check("column before the second segment", maps.where(url, 0, 5) == "src/a.ts", str(maps.where(url, 0, 5)))
        check("column at the second segment", maps.where(url, 0, 10) == "pkg", str(maps.where(url, 0, 10)))
        check("second line", maps.where(url, 1, 9) == "pkg", str(maps.where(url, 1, 9)))
        check("a column before any segment has no name", maps.where(url, 1, 0) is None)
        check("a chunk without a map has no name", perf.SourceMaps().where("file:///nope.js", 0, 0) is None)


class FakeMaps:
    def where(self, url: str, line: int, col: int):
        return {1: "src/lib/content/index.ts", 2: "reading-time", 3: "src/app/page.tsx"}.get(col)


def test_profile() -> None:
    print("summing a profile")
    srv = "file:///srv/x/.next/server/chunks/9.js"
    profile = {
        "nodes": [
            {"id": 1, "callFrame": {"functionName": "(root)", "url": ""}, "children": [2, 5, 6]},
            {"id": 2, "callFrame": {"functionName": "render", "url": srv, "lineNumber": 0, "columnNumber": 3}, "children": [3]},
            {"id": 3, "callFrame": {"functionName": "getAllPosts", "url": srv, "lineNumber": 0, "columnNumber": 1}, "children": [4]},
            {"id": 4, "callFrame": {"functionName": "count", "url": srv, "lineNumber": 0, "columnNumber": 2}},
            {"id": 5, "callFrame": {"functionName": "(idle)", "url": ""}},
            {"id": 6, "callFrame": {"functionName": "(garbage collector)", "url": ""}},
        ],
        "samples": [4] * 60 + [3] * 10 + [5] * 100 + [6] * 30,
    }
    s = perf.summarise_profile(profile, FakeMaps())
    check("busy share leaves idle out", s["busyShare"] == 0.5, str(s["busyShare"]))
    top = s["self"][0]
    check("library code is named with the file of ours that called it",
          top["what"] == "reading-time, called from src/lib/content/index.ts" and top["share"] == 0.6, str(top))
    ours = {o["what"]: o["share"] for o in s["ours"]}
    check("our file's share counts everything under it", ours.get("src/lib/content/index.ts") == 0.7, str(ours))
    check("a caller further up counts too", ours.get("src/app/page.tsx") == 0.7, str(ours))
    check("garbage collection is named", any(x["what"] == "garbage collection" for x in s["self"]))


def test_judge() -> None:
    print("what counts as a regression")
    fine = {"entityBuilds": {"n": 200, "p50": 0.34, "p90": 0.56}, "cached": {"n": 900, "p50": 0.016, "p90": 0.05}}
    check("a healthy hour says nothing", perf.judge(fine, {"share": 0.2, "requests": 9000}, [], {"busyShare": 0.3, "ours": []}, []) == [])
    slow = {"entityBuilds": {"n": 200, "p50": 2.8, "p90": 8.0}, "cached": {"n": 900, "p50": 1.0, "p90": 2.0}}
    w = perf.judge(slow, None, None, None, [])
    check("Oct 21's morning trips the build, slow-end and cached lines", len(w) == 3, str(w))
    hot = {"busyShare": 0.9, "ours": [{"what": "src/lib/content/index.ts", "share": 0.75}]}
    w = perf.judge(None, None, None, hot, [])
    check("a hot file of ours and a busy copy are named",
          any("src/lib/content/index.ts" in x for x in w) and any("busy 90%" in x for x in w), str(w))
    check("few builds don't count", perf.judge({"entityBuilds": {"n": 3, "p50": 9.0, "p90": 9.0},
                                                "cached": {"n": 3, "p50": 9.0, "p90": 9.0}}, None, None, None, []) == [])
    history = [{"entityBuildP50": 0.3}] * 30
    mid = {"entityBuilds": {"n": 200, "p50": 0.9, "p90": 1.2}, "cached": {"n": 900, "p50": 0.02, "p90": 0.05}}
    w = perf.judge(mid, None, None, None, history)
    check("three times the week's usual is a regression under the fixed lines", len(w) == 1 and "3.0 times" in w[0], str(w))
    w = perf.judge(None, {"share": 0.5, "requests": 9000, "refusedPages": 0}, None, None, [])
    check("pre-loads over 40% alone, with nobody hurt, are not a warning", w == [], str(w))
    w = perf.judge(None, {"share": 0.5, "requests": 9000, "refusedPages": 120}, None, None, [])
    check("pre-loads over 40% in an hour people were turned away are named",
          len(w) == 1 and "120 page requests" in w[0], str(w))
    slow = {"entityBuilds": {"n": 200, "p50": 2.0, "p90": 3.0}, "cached": {"n": 900, "p50": 0.02, "p90": 0.05}}
    w = perf.judge(slow, {"share": 0.5, "requests": 9000, "refusedPages": 0}, None, None, [])
    check("pre-loads over 40% in a slow hour are named beside the slow pages",
          len(w) == 2 and "pages were slow" in w[1], str(w))
    w = perf.judge(None, {"share": 0.3, "requests": 9000, "refusedPages": 500}, None, None, [])
    check("pre-loads under 40% aren't named, whatever else happened", w == [], str(w))
    w = perf.judge(None, None, [{"runs": 6, "meanMs": 1500, "sql": "SELECT slow"}], None, [])
    check("a statement averaging over a second is named", len(w) == 1 and "SELECT slow" in w[0], str(w))
    w = perf.judge(None, None, None, {"busyShare": 0.2, "ours": [], "inspectorLeftOpen": True}, [])
    check("an inspector left open is said", len(w) == 1, str(w))


def test_rollup() -> None:
    print("the last day")
    now = 1_800_000_000
    hist = [{"t": now - 3600 * h, "entityBuildP50": 0.3 + h / 100, "busyShare": 0.2, "warnings": ["A"] if h == 2 else [],
             "errors": ["profile"] if h == 3 else []} for h in range(1, 30)]
    r = perf.day_rollup(hist, ["B"], now)
    check("only the last 24 hours, plus this run", r["runs"] == 24, str(r["runs"]))
    check("the worst hour's build time", abs(r["worstEntityBuildP50"] - 0.53) < 1e-9, str(r["worstEntityBuildP50"]))
    check("every distinct warning, this run's too", r["warnings"] == ["A", "B"], str(r["warnings"]))
    check("runs with a failed reading are counted", r["failedRuns"] == 1)


if __name__ == "__main__":
    for t in (test_logs, test_tail, test_db, test_source_maps, test_profile, test_judge, test_rollup):
        t()
    print(f"{len(failures)} failure(s)")
    sys.exit(1 if failures else 0)
