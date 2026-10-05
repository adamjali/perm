#!/usr/bin/env python3
"""Sticky entity slugs: a URL an entity holds is the URL it keeps.

    python3 scripts/test_sticky_slugs.py

Every scenario runs the planner twice with the volumes changed between
runs, because the defect this guards was a quarterly rebuild reassigning
`-2` and `-3` by volume order and swapping two firms' URLs.
"""
from __future__ import annotations

import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from lib_slugs import plan_aliases, plan_sticky_slugs, with_aliases, with_unique_slugs  # noqa: E402
from turso_migrate_public import prior_maps  # noqa: E402

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


def name_of(item: dict) -> str:
    return item["name"]


def by_volume(items: list[dict]) -> list[dict]:
    return sorted(items, key=lambda r: -r["total"])


def slugs(assigned) -> dict[str, str]:
    return {item["name"]: slug for slug, item in assigned}


def main() -> int:
    print("sticky slugs")
    q1 = [{"name": "Acme Inc", "total": 100}, {"name": "ACME, INC.", "total": 50},
          {"name": "Globex", "total": 30}]
    first, vanished = plan_sticky_slugs(by_volume(q1), name_of, prior={})
    check("first run with no prior: volume order, exactly as with_unique_slugs",
          slugs(first), {"Acme Inc": "acme-inc", "ACME, INC.": "acme-inc-2", "Globex": "globex"})
    check("control: with_unique_slugs agrees on a first run",
          {i["name"]: s for s, i in with_unique_slugs(by_volume(q1), name_of)}, slugs(first))
    check("nothing vanished on a first run", vanished, [])
    prior = slugs(first)

    # THE DEFECT: the second spelling out-files the first next quarter.
    q2 = [{"name": "Acme Inc", "total": 100}, {"name": "ACME, INC.", "total": 400},
          {"name": "Globex", "total": 30}]
    unsticky = {i["name"]: s for s, i in with_unique_slugs(by_volume(q2), name_of)}
    check("with_unique_slugs SWAPS the two URLs (the bug)",
          (unsticky["Acme Inc"], unsticky["ACME, INC."]), ("acme-inc-2", "acme-inc"))
    second, vanished = plan_sticky_slugs(by_volume(q2), name_of, prior)
    check("sticky: both keep their slugs despite the volume swap",
          (slugs(second)["Acme Inc"], slugs(second)["ACME, INC."]), ("acme-inc", "acme-inc-2"))
    check("sticky: assigned order follows the input (volume) order for ranking",
          [i["name"] for _, i in second], ["ACME, INC.", "Acme Inc", "Globex"])
    check("nothing vanished", vanished, [])

    # A newcomer whose base collides takes the next FREE suffix, and never a
    # reserved one even if its owner is gone this quarter.
    q3 = [{"name": "ACME, INC.", "total": 400}, {"name": "Acme-Inc", "total": 10},
          {"name": "Globex", "total": 30}]
    third, vanished = plan_sticky_slugs(by_volume(q3), name_of, prior)
    check("a newcomer sharing the base takes -3, not the absent owner's acme-inc",
          slugs(third)["Acme-Inc"], "acme-inc-3")
    check("the absent owner's slug is reported as vanished", vanished, ["acme-inc"])

    # A brand-new base gets the clean slug even when a prior suffix exists elsewhere.
    q4 = [{"name": "Initech", "total": 5}] + q2
    fourth, _ = plan_sticky_slugs(by_volume(q4), name_of, prior)
    check("a brand-new name gets its clean base", slugs(fourth)["Initech"], "initech")

    # Two occupations sharing a title under two SOC codes: keyed by code.
    occ = [{"title": "Managers, All Other", "code": "11-9199", "total": 500},
           {"title": "Managers, All Other", "code": "11-9198", "total": 200}]
    title = lambda r: r["title"]  # noqa: E731
    key = lambda r: f"{r['code']}|{r['title']}"  # noqa: E731
    first_occ, _ = plan_sticky_slugs(occ, title, {}, key_of=key)
    prior_occ = {key(i): s for s, i in first_occ}
    swapped = sorted(occ, key=lambda r: r["code"])          # the other code first
    again, vanished = plan_sticky_slugs(swapped, title, prior_occ, key_of=key)
    check("two codes under one title keep their slugs when their order flips",
          {i["code"]: s for s, i in again}, {"11-9199": "managers-all-other", "11-9198": "managers-all-other-2"})
    check("nothing vanished", vanished, [])
    by_title_only, _ = plan_sticky_slugs(swapped, title, {title(i): s for s, i in first_occ})
    check("control: keyed by title alone, the pair SWAPS (the occupation defect)",
          {i["code"]: s for s, i in by_title_only}, {"11-9198": "managers-all-other-2", "11-9199": "managers-all-other"})

    print("aliases for vanished slugs")
    prior_key = {"acme": "acme", "acme-2": "acme", "globex": "globex"}
    key_slug = {"acme": "acme-2", "globex": "globex"}   # busiest holder per merge key this run
    aliases, unresolved = plan_aliases(["acme"], prior_key, key_slug)
    check("a vanished spelling redirects to the busiest holder of its merge key",
          aliases, [("acme", "acme-2")])
    check("nothing unresolved", unresolved, [])
    aliases, unresolved = plan_aliases(["globex"], prior_key, {"acme": "acme-2"})
    check("an entity whose merge key is gone entirely is unresolved", (aliases, unresolved), ([], ["globex"]))
    aliases, unresolved = plan_aliases(["zzz-unknown"], prior_key, key_slug)
    check("a slug with no recorded key is unresolved, never guessed", (aliases, unresolved), ([], ["zzz-unknown"]))

    print("old pages are keyed by TODAY'S rule, so a rule change can't strand them")
    # "Amgen Incorporated" was stored under "amgen incorporated"; since Oct 5 2026
    # "incorporated" is a form word, so the rebuild files it under "amgen". Keyed by
    # the stored key, its page had nowhere to go and the whole load refused.
    rows = [("employer", "Amgen Incorporated", "amgen-incorporated", "amgen incorporated", None),
            ("employer", "AMGEN INC.", "amgen-inc", "amgen", None),
            ("occupation", "Software Developers", "software-developers", "15-1252|software developers", "15-1252")]
    p_slug, p_key = prior_maps(rows)
    check("an employer's prior key is recomputed from its name", p_key["employer"]["amgen-incorporated"], "amgen")
    check("an occupation keeps its stored key (its identity carries the SOC code)",
          p_key["occupation"]["software-developers"], "15-1252|software developers")
    check("prior slugs are found by name as before", p_slug["employer"]["AMGEN INC."], "amgen-inc")
    aliases, unresolved = plan_aliases(["amgen-incorporated"], p_key["employer"], {"amgen": "amgen-inc"})
    check("so the absorbed page redirects instead of blocking the load",
          (aliases, unresolved), ([("amgen-incorporated", "amgen-inc")], []))

    print("alias keys resolve to their canonical page")
    ks = with_aliases({"wal mart associates": "wal-mart-associates-inc"},
                      {"walmart associates": "wal mart associates", "ghost": "not here"})
    check("a variant key takes its canonical key's slug", ks.get("walmart associates"), "wal-mart-associates-inc")
    check("an alias whose canonical has no page adds nothing", "ghost" in ks, False)
    ks2 = with_aliases({"acme": "acme", "acme co": "acme-co"}, {"acme co": "acme"})
    check("a key that already has its own page keeps it", ks2["acme co"], "acme-co")
    # The merged entity takes its NAME from the busiest single spelling, whose key can be
    # the minority key of the group: "BigPanda Inc" names the page while "big panda" holds
    # more cases. Keyed only by the name's key, the old "Big Panda Inc" page (key "big
    # panda") had nowhere to go: 43 pages, and the Oct 5 2026 load refused.
    ks3 = with_aliases({"bigpanda": "bigpanda-inc"}, {"bigpanda": "big panda", "big panda inc": "big panda"})
    check("the canonical key reaches the page named by a minority spelling", ks3.get("big panda"), "bigpanda-inc")
    check("and so does every other spelling of the group", ks3.get("big panda inc"), "bigpanda-inc")

    print()
    print(f"{CHECKS} checks")
    if CHECKS < 12:
        print(f"FATAL: only {CHECKS} checks ran; the suite is truncated")
        return 1
    if FAILURES:
        print(f"{len(FAILURES)} failure(s): {', '.join(FAILURES)}")
        return 1
    print("all checks passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
