"""Names withheld from the site at a person's request: the shared helpers.

The list itself is never in this repository (it is public). It lives in
WITHHELD_EMPLOYERS in the server's production.env, mirrored to a GitHub secret
for the build; `withhold.py` keeps the two in step. The format is the one
src/lib/privacy/withheld.ts parses: entries separated by ";", each
"slug|name|label|case numbers", the case numbers comma-separated.

Nothing here prints a slug, a name or a case number: the deploy runs these
helpers on a public repository's runner, whose logs anyone can read.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Callable, Iterable

# The neighbour lists on an employer page reach 60 ranks either side
# (src/lib/db/entities.ts), so a withheld employer can appear on any of those.
NEIGHBOUR_REACH = 60
# Rows per sitemap file (SITEMAP_CHUNK in src/lib/sitemap/build.ts).
SITEMAP_CHUNK = 5000


@dataclass(frozen=True)
class Entry:
    slug: str
    name: str
    label: str
    cases: tuple[str, ...]

    def text(self) -> str:
        return "|".join([self.slug, self.name, self.label, ",".join(self.cases)])


def _norm(s: str) -> str:
    return re.sub(r"\s+", " ", s.strip())


def parse(raw: str | None) -> list[Entry]:
    """Entries from the setting's text; a malformed entry is skipped, as the site skips it."""
    out: list[Entry] = []
    for part in (raw or "").split(";"):
        fields = [f.strip() for f in part.split("|")]
        if len(fields) < 3 or not all(fields[:3]):
            continue
        cases = tuple(c.strip().upper() for c in (fields[3] if len(fields) > 3 else "").split(",") if c.strip())
        out.append(Entry(_norm(fields[0]).lower(), _norm(fields[1]), fields[2], cases))
    return out


def render(entries: Iterable[Entry]) -> str:
    return ";".join(e.text() for e in entries)


def upsert(entries: list[Entry], new: Entry) -> list[Entry]:
    """The list with `new` added, replacing an entry for the same page."""
    return [e for e in entries if e.slug != new.slug] + [new]


def drop(entries: list[Entry], slug: str) -> list[Entry]:
    return [e for e in entries if e.slug != slug.strip().lower()]


Query = Callable[[str, list], list[dict]]


def affected_paths(q: Query, e: Entry) -> list[str]:
    """Every public path that showed the entry's name, worked out from the database.

    The employer's page and the pages ranked near it (their neighbour lists),
    the A-to-Z page and sitemap file that listed it, and for each of its cases
    the law firm, occupation, industry and city pages and the case lookups.
    """
    paths: set[str] = {f"/perm-employers/{e.slug}"}
    first = e.slug[:1]
    if first.isalpha():
        paths.add(f"/perm-employers/browse/{first}")
    ranks = q("SELECT rank FROM perm_entities WHERE kind = 'employer' AND slug = ?", [e.slug])
    if ranks and ranks[0].get("rank") is not None:
        rank = int(ranks[0]["rank"])
        paths.add(f"/sitemaps/employer-{(rank - 1) // SITEMAP_CHUNK + 1}.xml")
        for r in q(
            "SELECT slug FROM perm_entities WHERE kind = 'employer' AND rank BETWEEN ? AND ?",
            [max(1, rank - NEIGHBOUR_REACH), rank + NEIGHBOUR_REACH],
        ):
            paths.add(f"/perm-employers/{r['slug']}")
    cases = list(e.cases)
    marks = ",".join("?" * len(cases)) or "''"
    rows = q(
        f"SELECT attorney_slug, soc_code, naics, worksite_city, state AS st FROM perm_cases "
        f"WHERE employer_slug = ? OR case_number IN ({marks})",
        [e.slug, *cases],
    ) + q(
        f"SELECT attorney_slug, soc_code, naics, worksite_city, worksite_state AS st FROM pwd_cases "
        f"WHERE employer_slug = ? OR case_number IN ({marks})",
        [e.slug, *cases],
    )
    for r in rows:
        if r.get("attorney_slug"):
            paths.add(f"/perm-attorneys/{r['attorney_slug']}")
        if r.get("naics"):
            paths.add(f"/perm-industries/{str(r['naics']).strip()}")
        if r.get("worksite_city") and r.get("st"):
            city = re.sub(r"[^a-z0-9]+", "-", f"{r['worksite_city']} {r['st']}".lower()).strip("-")
            paths.add(f"/perm-cities/{city}")
        if r.get("soc_code"):
            for o in q(
                "SELECT slug FROM perm_entities WHERE kind = 'occupation' AND code LIKE ?",
                [str(r["soc_code"])[:7] + "%"],
            ):
                paths.add(f"/perm-wages/{o['slug']}")
    for cn in cases:
        paths.add(f"/perm-case-status?case={cn}")
    return sorted(paths)
