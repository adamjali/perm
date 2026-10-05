#!/usr/bin/env python3
"""A spelling the entity build folds into another still reaches that page.

    python3 scripts/test_key_aliases.py

The build merges spellings (the law-firm typo rules, and from Oct 2026 names that
differ only by spacing), but every later step joins a printed name to a page by
that name's OWN key. Before the build published its aliases, 20 Fragomen cases
filed as "Fragomen, Del Rey, Bersen Loewy" carried no firm link at all.
"""
from __future__ import annotations

import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from entity_identity import SpacedKeyMap, entity_key  # noqa: E402
from ingest_perm_disclosure import merge_entities  # noqa: E402
from turso_migrate import slug_maps  # noqa: E402

FAILURES: list[str] = []
CHECKS = 0


def check(name: str, got, want) -> None:
    global CHECKS
    CHECKS += 1
    if got == want:
        print(f"  ok   {name}")
    else:
        FAILURES.append(name)
        print(f"  FAIL {name}\n         got  {got!r}\n         want {want!r}")


def row(name: str, n: int, state: str = "NY") -> dict:
    return {"name": name, "certified": n, "denied": 0, "withdrawn": 0,
            "days": [100] * n, "wages": [], "state": state}


def main() -> int:
    big = "Fragomen, Del Rey, Bernsen & Loewy, LLP"     # DOL's own spellings
    typo = "Fragomen, Del Rey, Bersen Loewy, LLP"

    print("the build publishes the spellings it folded")
    aliases: dict[str, str] = {}
    merged = merge_entities({big: row(big, 400), typo: row(typo, 15)},
                            lambda x: x["name"], "attorney", aliases)
    check("the two spellings are one firm", len(merged), 1)
    check("the typo's key points at the firm's key", aliases.get(entity_key(typo)), entity_key(big))
    empty: dict[str, str] = {}
    merge_entities({big: row(big, 400)}, lambda x: x["name"], "employer", empty)
    check("nothing folded, nothing published", empty, {})

    print("a case filed under the folded spelling links to the firm's page")
    payload = {"topEmployers": [], "topAttorneys": [{"name": big, "total": 415}],
               "keyAliases": {"attorney": aliases}}
    _, firms = slug_maps(payload)
    check("the firm's own spelling", firms.get(entity_key(big)), "fragomen-del-rey-bernsen-loewy-llp")
    check("the typo spelling reaches the same page", firms.get(entity_key(typo)),
          "fragomen-del-rey-bernsen-loewy-llp")
    _, bare = slug_maps({"topEmployers": [], "topAttorneys": [{"name": big, "total": 415}]})
    check("control: without the aliases the typo links nowhere", bare.get(entity_key(typo)), None)

    print("an employer spelled with the gaps elsewhere is one employer (Rule D)")
    wm, wm2 = "WAL-MART ASSOCIATES, INC.", "WALMART ASSOCIATES, INC."   # DOL's spellings
    emp_aliases: dict[str, str] = {}
    merged = merge_entities({wm: row(wm, 1595, "AR"), wm2: row(wm2, 417, "AR")},
                            lambda x: x["name"], "employer", emp_aliases)
    check("Wal-Mart and Walmart are one employer", (len(merged), merged[0]["name"]), (1, wm))
    check("its cases pool", merged[0]["certified"], 2012)
    employers, _ = slug_maps({"topEmployers": [{"name": wm, "total": 2012}], "topAttorneys": [],
                              "keyAliases": {"employer": emp_aliases}})
    check("a case filed as WALMART links to the Wal-Mart page", employers.get(entity_key(wm2)),
          "wal-mart-associates-inc")

    print("steps that join a name to today's pages match spacing variants too")
    pages = SpacedKeyMap({"wal mart associates": ("wal-mart-associates-inc", 2012),
                          "walmart": ("walmart-inc", 40), "kv": ("kv-inc", 9)},
                         weight=lambda v: v[1])
    check("an exact key", pages.get("walmart")[0], "walmart-inc")
    check("an old spelling with no gap finds the page", pages.get("walmart associates")[0],
          "wal-mart-associates-inc")
    check("keys under 4 letters stay exact", pages.get("k v"), None)
    check("a miss is still a miss", pages.get("target stores", "none"), "none")
    check("[] and in stay exact", "walmart associates" in pages, False)

    print()
    print(f"{CHECKS} checks")
    if CHECKS < 14:
        print(f"FATAL: only {CHECKS} checks ran; the suite is truncated")
        return 1
    if FAILURES:
        print(f"{len(FAILURES)} failure(s): {', '.join(FAILURES)}")
        return 1
    print("all checks passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
