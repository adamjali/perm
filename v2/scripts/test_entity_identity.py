#!/usr/bin/env python3
"""The Python half of the identity contract.

`src/lib/__tests__/entitySlug.test.ts` runs the SAME fixture file against the
TypeScript implementation. The two exist separately because the writer is
Python and the reader is TypeScript, and this pair of tests is the only thing
that keeps them from drifting into a detail page that 404s from its own index.

    python3 scripts/test_entity_identity.py

Wired into `pnpm test:identity`, and into `pnpm typecheck` is NOT enough:
a typechecker cannot see a Python file.
"""
from __future__ import annotations

import json
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from entity_identity import entity_key, typo_aliases  # noqa: E402
from store_entities import slugify  # noqa: E402

FIXTURES = pathlib.Path(__file__).resolve().parents[1] / "src/lib/__fixtures__/entityIdentity.json"


def main() -> int:
    fx = json.loads(FIXTURES.read_text())
    fails: list[str] = []

    for raw, want in fx["keys"]:
        got = entity_key(raw)
        if got != want:
            fails.append(f"entity_key({raw!r}) -> {got!r}, want {want!r}")

    for raw, want in fx["slugs"]:
        got = slugify(raw)
        if got != want:
            fails.append(f"slugify({raw!r}) -> {got!r}, want {want!r}")

    # Every pair here is two different parties. Both halves of the guard are
    # asserted: the keys must differ, AND the typo pass must refuse to link
    # them even inside the one population where that pass is enabled.
    for a, b in fx["must_not_merge"]:
        ka, kb = entity_key(a), entity_key(b)
        if ka == kb:
            fails.append(f"MERGED but must not: {a!r} and {b!r} both -> {ka!r}")
            continue
        got = typo_aliases({ka: 1000, kb: 3}, "attorney")
        if got:
            fails.append(f"typo_aliases linked {a!r} and {b!r}: {got}")

    # And the ones it must catch. The first name is the busier spelling and
    # has to survive as the root.
    for big, small in fx["typo_merges"]:
        kb, ks = entity_key(big), entity_key(small)
        if kb == ks:
            continue  # already one entity by Rule A; nothing for Rule B to do
        got = typo_aliases({kb: 1000, ks: 3}, "attorney")
        if got.get(ks) != kb:
            fails.append(f"typo_aliases missed {small!r} -> {big!r} (got {got})")

    # The employer exclusion is a rule, not an accident, so it is asserted.
    fragomen = entity_key("FRAGOMEN, DEL REY, BERNSEN & LOEWY, LLP")
    bersen = entity_key("Fragomen, Del Rey, Bersen Loewy, LLP")
    for kind in ("employer", "occupation"):
        if typo_aliases({fragomen: 1000, bersen: 3}, kind):
            fails.append(f"typo_aliases must be a no-op for {kind}")

    # Control. The re-glue has to keep a word that is NOT a legal suffix, or
    # it would quietly merge two different firms; if this ever passes by
    # collapsing, every other assertion above is passing for the wrong reason.
    if entity_key("Ernst & Young U.S. LLP") == entity_key("Ernst & Young LLP"):
        fails.append("control: 'U.S.' must survive the re-glue as a real word")

    print(f"entity_key   {len(fx['keys'])} fixtures")
    print(f"slugify      {len(fx['slugs'])} fixtures")
    print(f"must_not_merge {len(fx['must_not_merge'])} pairs")
    print(f"typo_merges  {len(fx['typo_merges'])} pairs")
    if fails:
        print(f"\nFAIL ({len(fails)}):")
        for f in fails:
            print("  " + f)
        return 1
    print("\nall identity fixtures agree")
    return 0


if __name__ == "__main__":
    sys.exit(main())
