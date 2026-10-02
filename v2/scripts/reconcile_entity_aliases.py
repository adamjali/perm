"""Keep perm_entity_alias consistent with the live perm_entities table.

The alias table remembers slugs from earlier runs, which may have slugged an
entity differently from the loader that rebuilt perm_entities this quarter, so
an alias can end up pointing a live page at a slug that no longer exists, or
redirecting away from a page that is itself live.

THE RULE. The live table is the truth about which slug a page has today;
the alias table is the memory of slugs a page USED to have. So:

  source live, target missing  -> the row is backwards: the live slug is the
                                  page, the missing one is the old URL. Reverse
                                  it (target -> source), so the old URL still
                                  redirects and the live page is not hijacked.
  source live, target live     -> a live page must not redirect. Drop the row;
                                  both pages stay (unmerged, but honest).
  source missing, target missing -> nothing on either end. Drop it.
  source missing, target live  -> a correct alias. Keep it.

Runs after every quarterly load (perm-disclosure-ingest.yml) and is asserted
read-only by check_invariants.py, so the two tables cannot drift silently
again whichever slugifier wins a future refactor.

    python3 scripts/reconcile_entity_aliases.py --dry-run
    python3 scripts/reconcile_entity_aliases.py
"""
from __future__ import annotations

import argparse
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from lib_turso import Turso, lit, rows_of  # noqa: E402


def classify(db: Turso) -> dict[str, list[tuple[str, str, str]]]:
    """Every alias row, bucketed by which of its two ends is a live slug.
    One JOIN over the alias table (hundreds of rows) against the primary key
    of perm_entities; no scan."""
    res = db.execute(
        "SELECT a.kind, a.slug, a.target_slug, "
        "       (s.slug IS NOT NULL) AS src_live, (t.slug IS NOT NULL) AS tgt_live "
        "  FROM perm_entity_alias a "
        "  LEFT JOIN perm_entities s ON s.kind = a.kind AND s.slug = a.slug "
        "  LEFT JOIN perm_entities t ON t.kind = a.kind AND t.slug = a.target_slug")
    out: dict[str, list[tuple[str, str, str]]] = {
        "keep": [], "reverse": [], "drop_both_live": [], "drop_both_dead": []}
    for kind, slug, target, src_live, tgt_live in rows_of(res):
        src_live, tgt_live = int(src_live or 0), int(tgt_live or 0)
        if src_live and not tgt_live:
            out["reverse"].append((kind, slug, target))
        elif src_live and tgt_live:
            out["drop_both_live"].append((kind, slug, target))
        elif not src_live and not tgt_live:
            out["drop_both_dead"].append((kind, slug, target))
        else:
            out["keep"].append((kind, slug, target))
    return out


def apply(db: Turso, buckets: dict[str, list[tuple[str, str, str]]]) -> None:
    stmts = []
    for kind, slug, target in buckets["reverse"]:
        stmts.append({"type": "execute", "stmt": {
            "sql": "DELETE FROM perm_entity_alias WHERE kind = ? AND slug = ?",
            "args": [lit(kind), lit(slug)]}})
        stmts.append({"type": "execute", "stmt": {
            "sql": "INSERT OR REPLACE INTO perm_entity_alias (kind, slug, target_slug) VALUES (?, ?, ?)",
            "args": [lit(kind), lit(target), lit(slug)]}})
    for kind, slug, _ in buckets["drop_both_live"] + buckets["drop_both_dead"]:
        stmts.append({"type": "execute", "stmt": {
            "sql": "DELETE FROM perm_entity_alias WHERE kind = ? AND slug = ?",
            "args": [lit(kind), lit(slug)]}})
    for i in range(0, len(stmts), 100):
        db.pipeline(stmts[i:i + 100] + [{"type": "close"}])


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()
    db = Turso()
    b = classify(db)
    print(f"alias rows: keep {len(b['keep'])}, reverse {len(b['reverse'])}, "
          f"drop (both live) {len(b['drop_both_live'])}, drop (both dead) {len(b['drop_both_dead'])}")
    for kind, slug, target in b["reverse"][:5]:
        print(f"  reverse  {kind}: {target} -> {slug}  (was {slug} -> {target})")
    changes = len(b["reverse"]) + len(b["drop_both_live"]) + len(b["drop_both_dead"])
    if args.dry_run:
        print("dry run; nothing written")
        return 0
    if changes:
        apply(db, b)
    after = classify(db)
    left = len(after["reverse"]) + len(after["drop_both_live"]) + len(after["drop_both_dead"])
    print(f"applied {changes} change(s); inconsistent rows now: {left}")
    if left:
        print("::error::alias table still inconsistent after reconcile")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
