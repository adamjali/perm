#!/usr/bin/env python3
"""Who is one entity, decided BEFORE anything is ranked.

DOL prints the name that went on the form, so one practice arrives under
dozens of spellings. Ranking first and disambiguating slugs afterwards - the
old `-2`, `-3` suffix - gives every spelling its own page claiming to be a
distinct firm, and every rank on every page is then wrong.

Two rules live here. They are deliberately different in kind, and the second
one is deliberately NOT applied to every population.

## Rule A - re-glue punctuation-shredded suffixes.  DETERMINISTIC.

`entity_key` shredded punctuation to spaces and only then removed the noise
words, so `P.C.` became `p` + `c` and the noise list - which contains "pc" -
never saw it. `Jackson Lewis P.C.` and `Jackson Lewis PC` were two firms with
two pages and two ranks, and so were 604 other pairs. Gluing runs of
consecutive single-letter tokens back into one token before the noise filter
fixes exactly that and touches nothing else: `l l c` -> `llc` (dropped),
`p a` -> `pa` (dropped), `u s` -> `us` (kept, because "us" is not noise
and Ernst & Young U.S. LLP is not Ernst & Young LLP).

Measured: 367 attorney rows and 239 employer rows absorbed.

## Rule B - one mistyped token.  INFERENCE, and ATTORNEYS ONLY.

`Fragomen, Del Rey, Bersen Loewy` is `Fragomen, Del Rey, Bernsen & Loewy`
with a letter missing. Aligning the two keys token by token, exactly one
token differs and the difference is a single insertion or a transposition,
while every other token matches exactly. That corroboration is the whole
argument, and it is why the rule is scoped:

  - **Same-length substitutions are refused outright.** That is where two
    real surnames live: Petersen and Peterson, Markan and Martin, Curtis and
    Currie, Shultz and Schultz all show up at distance 1 and only some of
    them are typos. Insertions, deletions and pure transpositions
    (anagrams) are keystroke errors and almost nothing else.
  - **An insertion or deletion needs a corroborating token that carries
    meaning.** `Hartzman Law Firm` and `Hartman Law Firm` agree only on
    "law" and "firm", which identifies nobody, and dropping a letter from a
    surname is also how two real surnames differ. `Saltzman Evinch` and
    `Saltman Evinch` agree on "evinch", which does identify somebody.
    A TRANSPOSITION is exempt: two adjacent keys hit out of order is a
    keystroke and essentially never another real name, which is what lets
    `Vialto Partners` absorb `Vilato Partners` on the strength of the
    transposition alone.
  - **The absorbed side must be a quarter of the anchor or smaller.** Two
    real firms with near-identical long names would both carry real volume.

  - **EMPLOYERS ARE EXCLUDED, on measurement rather than on principle.**
    Run over the 71,748 employer names, the same rule proposed NVIDIA
    Corporation absorbing Vidian, Twilio absorbing Wiliot, Seagen absorbing
    Seamgen, Centra Health absorbing Centura Health and Cloudspace absorbing
    Cloudscape. A law firm's printed name is a long descriptive phrase where
    one bad token sits among several good ones; a company's is often one
    coined word, where distance 1 routinely separates two real companies.
    The gain would have been 126 cases, 0.03% of the corpus, and it still
    misidentified a pair. Over-merging misattributes an approval rate to a
    company that never earned it, which is worse than printing two spellings.

Measured on attorneys: 185 merges over 5,864 firms, hand-checked in full.

THE SLUG RULES ARE MIRRORED IN `src/lib/entitySlug.ts`. A key computed
differently in the writer than in the reader is a detail page that 404s from
its own index, so `scripts/test_entity_identity.py` asserts both against one
fixture set.
"""
from __future__ import annotations

import re

# Words that say what kind of thing something is rather than which one.
# Stripping them is conservative: two names still only merge when every
# remaining word is identical.
ENTITY_NOISE = {
    "llp", "llc", "inc", "pc", "plc", "pllc", "lp", "ltd", "corp",
    "corporation", "co", "company", "pa", "chartered", "and", "the",
}

# Tokens that cannot corroborate a Rule B match, because half the directory
# contains them. `Hartzman Law Firm` and `Hartman Law Firm` agree on "law"
# and "firm" and are plausibly two different firms; the guard is what stops
# that one merging while `Saltzman Evinch` / `Saltman Evinch` still does.
_GENERIC = {
    "law", "laws", "office", "offices", "firm", "attorney", "attorneys",
    "associate", "associates", "group", "legal", "immigration", "partner",
    "partners", "at", "of", "practice", "consulting", "consultancy",
    "international", "global", "national", "america", "american", "us",
    "usa", "health", "healthcare", "medical", "technologies", "technology",
    "systems", "system", "services", "service", "solutions", "holdings",
    "enterprises", "enterprise", "management", "esq", "esquire", "pllc",
}


def entity_key(name: str) -> str:
    """A merge key for one real-world entity across its printed spellings.

    Rule A lives here: single-letter tokens are re-glued before the noise
    filter, because punctuation shredding is what hid `P.C.` from a list
    that has always contained "pc".
    """
    cleaned = re.sub(r"[^a-z0-9 ]+", " ", name.lower())
    raw = cleaned.split()
    glued: list[str] = []
    i = 0
    while i < len(raw):
        if len(raw[i]) == 1:
            j = i
            while j < len(raw) and len(raw[j]) == 1:
                j += 1
            glued.append("".join(raw[i:j]))
            i = j
        else:
            glued.append(raw[i])
            i += 1
    words = [w for w in glued if w not in ENTITY_NOISE]
    return " ".join(words) or cleaned.strip()


def _lev(a: str, b: str) -> int:
    """Levenshtein distance. Small inputs only - these are single tokens."""
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ca != cb)))
        prev = cur
    return prev[-1]


# Two floors, because the two edit classes carry different risk. Short
# tokens are refused at all so "lee" and "kim" do not match every other
# surname in the file - but a transposition is a much stronger signal than
# an insertion, so it earns a shorter one. Measured: dropping the
# transposition floor from 6 to 5 added exactly four merges across 5,864
# firms (Loewy/Lowey, Byron/Bryon, Solis/Soils, Tsung/Tusng) and no false
# ones, and Loewy/Lowey alone is 125 Fragomen cases.
_MIN_INDEL = 6
_MIN_TRANSPOSE = 5


def token_typo(x: str, y: str) -> str | None:
    """Is `y` `x` mistyped? Returns the edit class, or None."""
    if abs(len(x) - len(y)) > 1:
        return None
    if len(x) == len(y):
        if len(x) < _MIN_TRANSPOSE:
            return None
        # An anagram at distance 2 is one pair of keys hit out of order.
        # Anything else at the same length is a substitution, which is where
        # Peterson and Petersen live, so it is refused.
        return "transpose" if sorted(x) == sorted(y) and _lev(x, y) == 2 else None
    if len(x) < _MIN_INDEL or len(y) < _MIN_INDEL:
        return None
    return "indel" if _lev(x, y) == 1 else None


def typo_aliases(totals: dict[str, int], kind: str) -> dict[str, str]:
    """Map each merge key to the key it belongs under.

    `totals` is every key of one kind with its case count. Only keys that
    move appear in the result, so an empty dict means nothing merged.

    ATTORNEY ONLY. See the module docstring for the measurement that
    disqualified employers; returning `{}` for them is the point, not an
    oversight.
    """
    if kind != "attorney":
        return {}

    # Bucket by "every token but one", so only keys that differ in exactly
    # one position ever get compared. Without this the pass is quadratic in
    # the number of entities and takes minutes.
    buckets: dict[tuple, list[str]] = {}
    for key in totals:
        toks = key.split()
        # A one-token key has no second token to corroborate the match.
        if len(toks) < 2:
            continue
        for i in range(len(toks)):
            buckets.setdefault(
                (len(toks), i, tuple(toks[:i]), tuple(toks[i + 1:])), []
            ).append(key)

    # Union-find, so a chain of typos all lands on one root rather than on
    # each other. The root is always the busiest spelling.
    parent: dict[str, str] = {}

    def find(k: str) -> str:
        while parent.get(k, k) != k:
            parent[k] = parent.get(parent[k], parent[k])
            k = parent[k]
        return k

    for group in buckets.values():
        if len(group) < 2:
            continue
        group.sort(key=lambda k: (-totals[k], k))
        for i, big in enumerate(group):
            btoks = big.split()
            for small in group[i + 1:]:
                stoks = small.split()
                diff = [(a, b) for a, b in zip(btoks, stoks) if a != b]
                if len(diff) != 1:
                    continue
                cls = token_typo(diff[0][0], diff[0][1])
                if cls is None:
                    continue
                # An insertion or deletion inside a surname is also how two
                # real surnames differ, so it has to be corroborated by a
                # matching token that identifies somebody. A transposition
                # is a keystroke and stands on its own.
                if cls == "indel" and not any(
                    a == b and a not in _GENERIC for a, b in zip(btoks, stoks)
                ):
                    continue
                if totals[small] > 0.25 * totals[big]:
                    continue
                ra, rb = find(big), find(small)
                if ra == rb:
                    continue
                # Busier root wins, so the surviving name is the one people
                # recognise and the merge cannot depend on iteration order.
                if (totals[ra], ra) < (totals[rb], rb):
                    ra, rb = rb, ra
                parent[rb] = ra

    return {k: find(k) for k in parent if find(k) != k}
