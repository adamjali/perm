"""Entity slugs: the URL path every employer, law firm and occupation page uses.

The rules must match src/lib/entitySlug.ts exactly. A slug computed differently
here than in the app is a detail page that 404s from its own index, so the
rules are duplicated on purpose and held together by a shared test fixture
rather than imported across the language boundary.
"""
from __future__ import annotations

import re

SLUG_MAX_LEN = 60


def slugify(raw: str | None) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", (raw or "").lower())
    s = re.sub(r"-+", "-", s).strip("-")[:SLUG_MAX_LEN]
    return s.rstrip("-")


def with_unique_slugs(items: list[dict], name_of) -> list[tuple[str, dict]]:
    """Mirrors withUniqueSlugs in src/lib/entitySlug.ts, including the order."""
    seen: dict[str, int] = {}
    out = []
    for item in items:
        base = slugify(name_of(item)) or "entity"
        n = seen.get(base, 0)
        seen[base] = n + 1
        out.append((base if n == 0 else f"{base}-{n + 1}", item))
    return out


def plan_sticky_slugs(items: list, name_of, prior: dict[str, str],
                      key_of=None) -> tuple[list[tuple[str, object]], list[str]]:
    """Assign slugs so that an entity keeps the slug it already has.

    `prior` maps an entity's identity key to the slug it holds in the live
    table; `key_of` derives that key from an item and defaults to its name.
    Occupations need the SOC code in the key: dozens of titles belong to two
    codes each ("Managers, All Other"), and keying on the title alone made each
    pair swap slugs on every rebuild.

    An item whose key is in `prior` keeps that slug; a newcomer takes the first
    free candidate (`base`, `base-2`, ...) that no prior or newly assigned slug
    holds. Every prior slug stays reserved even when its owner is gone, so a
    newcomer can never inherit another entity's URL and the links Google holds.

    This exists because with_unique_slugs assigns suffixes in volume order,
    and volume order changes every quarter: `acme` and `acme-2` would swap
    owners when the second firm out-filed the first. Returns (assigned in input
    order, prior slugs nobody kept).
    """
    key_of = key_of or name_of
    reserved = set(prior.values())
    used: set[str] = set()
    counters: dict[str, int] = {}
    out: list[tuple[str, object]] = []
    for item in items:
        name = name_of(item)
        keep = prior.get(key_of(item))
        if keep and keep not in used:
            slug = keep
        else:
            base = slugify(name) or "entity"
            n = counters.get(base, 0)
            cand = base if n == 0 else f"{base}-{n + 1}"
            while cand in reserved or cand in used:
                n += 1
                cand = f"{base}-{n + 1}"
            counters[base] = n + 1
            slug = cand
        used.add(slug)
        out.append((slug, item))
    vanished = sorted(reserved - used)
    return out, vanished


def with_aliases(key_slug: dict[str, str], aliases: dict[str, str]) -> dict[str, str]:
    """`key_slug` plus every alias key, pointed at its canonical key's slug.

    `aliases` maps a spelling's key to the key it merged under (the entity build's
    typo and spacing aliases). A case row or an old page carries its OWN spelling's
    key, so without this a merged spelling matched no page: 20 Fragomen cases filed
    under "Bersen Loewy" had no firm link. A key that already holds a page keeps it.
    """
    out = dict(key_slug)
    for variant, canonical in aliases.items():
        slug = key_slug.get(canonical)
        if slug:
            out.setdefault(variant, slug)
    return out


def plan_aliases(vanished: list[str], prior_key: dict[str, str],
                 key_slug: dict[str, str]) -> tuple[list[tuple[str, str]], list[str]]:
    """Where a vanished slug should redirect: to the busiest entity that now
    holds the same merge key (the spelling was absorbed), or nowhere.

    `prior_key` maps a prior slug to its merge key; `key_slug` maps a merge
    key to the busiest slug assigned this run. Returns (alias pairs
    (old, target), slugs with no target). A slug with no target is an entity
    that disappeared from the source entirely; the writer refuses on those
    unless told the loss is understood, because a page Google holds must not
    404 silently.
    """
    aliases: list[tuple[str, str]] = []
    unresolved: list[str] = []
    for old in vanished:
        target = key_slug.get(prior_key.get(old, ""))
        if target and target != old:
            aliases.append((old, target))
        else:
            unresolved.append(old)
    return aliases, unresolved
