"""Names withheld from the site at their owner's request: the shared helpers.

The lists themselves are never in this repository (it is public). They live in
two settings, one per kind, in the server's production.env, mirrored to GitHub
secrets for the build and to Convex production; `withhold.py` keeps all three in
step. The format is the one convex/lib/withheldNames.ts parses (read that
header for what a removal does): entries separated by ";", each

    slug|name|label|cases|number|more slugs|more names

with the case numbers and the more-slugs comma-separated and the more-names
separated by "^". The first four fields alone are the format before Nov 5 2026
and still parse. `scripts/fixtures/withheld_format.json` holds the Python and the
TypeScript readers to one reading.

Nothing here prints a slug, a name or a case number: the deploy runs these
helpers on a public repository's runner, whose logs anyone can read.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field, replace
from typing import Callable, Iterable

# The setting each kind's list lives in (WITHHELD_ENV in convex/lib/withheldNames.ts).
SETTINGS = {"employer": "WITHHELD_EMPLOYERS", "firm": "WITHHELD_FIRMS"}
# The highest number each kind has ever used, so a number is never given twice
# even after the entry that held it is removed. Only this tool reads it.
NUMBERS_SETTING = "WITHHELD_NUMBERS"
# Where each kind's pages live (NEUTRAL_BASE).
BASE = {"employer": "/perm-employers", "firm": "/perm-attorneys"}
# perm_entities' kind for each.
ENTITY_KIND = {"employer": "employer", "firm": "attorney"}
DEFAULT_LABEL = {"employer": "Employer", "firm": "Law firm"}

# The neighbour lists on an entity page reach 60 ranks either side, and a
# firm's peer list 400 when it has a state (src/lib/db/entities.ts and the
# firm page), so a withheld entity can appear on any of those.
NEIGHBOUR_REACH = {"employer": 60, "firm": 400}
# Rows per sitemap file (SITEMAP_CHUNK in src/lib/sitemap/build.ts).
SITEMAP_CHUNK = 5000
# Characters a field can't hold: they're the format's own separators, or break the env file.
FORBIDDEN = re.compile(r'[;|^"\n\r]')


@dataclass(frozen=True)
class Entry:
    kind: str
    slug: str
    name: str
    label: str
    cases: tuple[str, ...] = ()
    number: int | None = None
    slugs: tuple[str, ...] = field(default=())
    names: tuple[str, ...] = field(default=())

    def all_slugs(self) -> tuple[str, ...]:
        return _unique((self.slug, *self.slugs))

    def all_names(self) -> tuple[str, ...]:
        return _unique_by((self.name, *self.names), lambda n: _squash(n).lower())

    def text(self) -> str:
        more_slugs = ",".join(s for s in self.all_slugs() if s != self.slug)
        more_names = "^".join(n for n in self.all_names() if _squash(n).lower() != _squash(self.name).lower())
        return "|".join([
            self.slug, self.name, self.label, ",".join(self.cases),
            str(self.number) if self.number else "", more_slugs, more_names,
        ])


def _squash(s: str) -> str:
    return re.sub(r"\s+", " ", s.strip())


def _unique(xs: Iterable[str]) -> tuple[str, ...]:
    out: list[str] = []
    for x in xs:
        if x and x not in out:
            out.append(x)
    return tuple(out)


def _unique_by(xs: Iterable[str], key: Callable[[str], str]) -> tuple[str, ...]:
    seen: set[str] = set()
    out: list[str] = []
    for x in xs:
        k = key(x)
        if x and k not in seen:
            seen.add(k)
            out.append(x)
    return tuple(out)


def parse(raw: str | None, kind: str = "employer") -> list[Entry]:
    """Entries from one setting's text; a malformed entry is skipped, as the site skips it."""
    out: list[Entry] = []
    for part in (raw or "").split(";"):
        f = [x.strip() for x in part.split("|")]
        f += [""] * (7 - len(f))
        slug, name, label, cases, number, more_slugs, more_names = f[:7]
        if not slug or not name or not label:
            continue
        page = _squash(slug).lower()
        out.append(Entry(
            kind=kind,
            slug=page,
            name=_squash(name),
            label=label,
            cases=_unique(c.strip().upper() for c in cases.split(",") if c.strip()),
            number=int(number) if re.fullmatch(r"\d{1,6}", number) and int(number) > 0 else None,
            slugs=_unique([page, *(_squash(s).lower() for s in more_slugs.split(",") if s.strip())]),
            names=_unique_by([_squash(name), *(_squash(n) for n in more_names.split("^") if n.strip())],
                             lambda n: n.lower()),
        ))
    return out


def parse_env(env: dict) -> list[Entry]:
    """Both kinds' entries from an environment."""
    return [*parse(env.get(SETTINGS["employer"]), "employer"), *parse(env.get(SETTINGS["firm"]), "firm")]


def render(entries: Iterable[Entry]) -> str:
    return ";".join(e.text() for e in entries)


def render_kinds(entries: Iterable[Entry]) -> dict[str, str]:
    """Each kind's setting text."""
    entries = list(entries)
    return {SETTINGS[k]: render(e for e in entries if e.kind == k) for k in SETTINGS}


def check_fields(e: Entry) -> None:
    """Refuse a field that would break the format; the message names the field, never its value."""
    for label, value in [("slug", e.slug), ("label", e.label), *(("a slug", s) for s in e.all_slugs()),
                         *(("a printed name", n) for n in e.all_names()), *(("a case number", c) for c in e.cases)]:
        if FORBIDDEN.search(value):
            raise ValueError(f"{label} holds one of ; | ^ \" or a line break, which the format can't carry")


def base_label(e: Entry) -> str:
    t = re.sub(r"^(a|an)\s+", "", e.label.strip(), flags=re.I)
    return t[:1].upper() + t[1:]


def shown_label(e: Entry) -> str:
    """'Law firm 3', or the plain label for an entry without a number."""
    return f"{base_label(e)} {e.number}" if e.number else e.label


def neutral_slug(e: Entry) -> str | None:
    if not e.number:
        return None
    return re.sub(r"^-+|-+$", "", re.sub(r"[^a-z0-9]+", "-", base_label(e).lower())) + f"-{e.number}"


def neutral_path(e: Entry) -> str | None:
    s = neutral_slug(e)
    return f"{BASE[e.kind]}/{s}" if s else None


def neutral_slug_for(kind: str, label: str, number: int) -> str:
    return neutral_slug(Entry(kind, "x", "x", label, number=number)) or ""


def upsert(entries: list[Entry], new: Entry) -> list[Entry]:
    """The list with `new` added, replacing an entry for the same page of the same kind."""
    return [e for e in entries if not (e.kind == new.kind and e.slug == new.slug)] + [new]


def drop(entries: list[Entry], slug: str, kind: str | None = None) -> list[Entry]:
    s = slug.strip().lower()
    return [e for e in entries if not (e.slug == s and (kind is None or e.kind == kind))]


def parse_numbers(raw: str | None) -> dict[str, int]:
    """'employer=4,firm=2' as {kind: highest number used}."""
    out: dict[str, int] = {}
    for part in (raw or "").split(","):
        k, _, v = part.partition("=")
        if k.strip() in SETTINGS and v.strip().isdigit():
            out[k.strip()] = int(v)
    return out


def render_numbers(numbers: dict[str, int]) -> str:
    return ",".join(f"{k}={numbers[k]}" for k in SETTINGS if numbers.get(k))


def next_number(entries: list[Entry], numbers: dict[str, int], kind: str) -> int:
    """The next number for a kind: above every number it has held, so none is reused."""
    held = [e.number for e in entries if e.kind == kind and e.number]
    return max([numbers.get(kind, 0), *held]) + 1


def numbered(entries: list[Entry], numbers: dict[str, int], taken: Callable[[str, str], bool]) -> tuple[list[Entry], dict[str, int]]:
    """Every entry without a number given the next free one, skipping any whose
    neutral slug a real page already uses (`taken(kind, slug)`); the high-water
    marks move past every number given or skipped."""
    marks = dict(numbers)
    for e in entries:
        if e.number:
            marks[e.kind] = max(marks.get(e.kind, 0), e.number)
    out: list[Entry] = []
    for e in entries:
        if e.number:
            out.append(e)
            continue
        n = marks.get(e.kind, 0) + 1
        tries = 0
        while taken(e.kind, neutral_slug_for(e.kind, e.label, n)):
            n += 1
            tries += 1
            if tries > 50:
                raise ValueError("no free neutral page address in 50 numbers; pick another label")
        marks[e.kind] = n
        out.append(replace(e, number=n))
    return out, marks


Query = Callable[[str, list], list[dict]]


def _quiet(q: Query, sql: str, args: list) -> list[dict]:
    """A read that tolerates a table or column this database doesn't hold yet."""
    try:
        return q(sql, args)
    except Exception as exc:  # noqa: BLE001 - only missing tables and columns are tolerated
        if re.search(r"no such (table|column)", str(exc), re.I):
            return []
        raise


def _marks(n: int) -> str:
    return ",".join("?" * n)


def _city_path(city: str, st: str) -> str:
    return "/perm-cities/" + re.sub(r"[^a-z0-9]+", "-", f"{city} {st}".lower()).strip("-")


def _state_slug(code: str) -> str | None:
    try:
        from ingest_perm_disclosure import STATE_NAMES  # standard library only
    except Exception:  # noqa: BLE001 - the rankings' state pages are then left to expire
        return None
    names = {v: k for k, v in STATE_NAMES.items()}
    name = names.get((code or "").upper())
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-") if name else None


def affected_paths(q: Query, e: Entry) -> list[str]:
    """Every public path that showed the entry's name, worked out from the database.

    Its own page under every slug and its neutral page, the A-to-Z page and the
    sitemap file that listed it, the pages ranked near it (their neighbour
    lists), the rankings, and the pages its cases are on: for an employer, its
    law firms', occupations', industries' and cities' pages and its case
    lookups; for a firm, every client employer's page, its occupations', its
    badge and its rankings' state pages.
    """
    kind = e.kind
    base = BASE[kind]
    slugs = list(e.all_slugs())
    paths: set[str] = {f"{base}/{s}" for s in slugs}
    np = neutral_path(e)
    if np:
        paths.add(np)
    first = e.slug[:1]
    if first.isalpha():
        paths.add(f"{base}/browse/{first}")
    ekind = ENTITY_KIND[kind]
    ranks = _quiet(q, "SELECT rank FROM perm_entities WHERE kind = ? AND slug = ?", [ekind, e.slug])
    if ranks and ranks[0].get("rank") is not None:
        rank = int(ranks[0]["rank"])
        paths.add(f"/sitemaps/{ekind}-{(rank - 1) // SITEMAP_CHUNK + 1}.xml")
        reach = NEIGHBOUR_REACH[kind]
        for r in _quiet(q, "SELECT slug FROM perm_entities WHERE kind = ? AND rank BETWEEN ? AND ?",
                        [ekind, max(1, rank - reach), rank + reach]):
            paths.add(f"{base}/{r['slug']}")
    marks = _marks(len(slugs))
    if kind == "employer":
        paths.update({"/perm-employers", "/h1b-employers", "/perm-employers/under-review"})
        cases = list(e.cases)
        cmarks = _marks(len(cases)) or "''"
        rows = _quiet(q,
            f"SELECT attorney_slug, soc_code, naics, worksite_city, state AS st FROM perm_cases "
            f"WHERE employer_slug IN ({marks}) OR case_number IN ({cmarks})", [*slugs, *cases],
        ) + _quiet(q,
            f"SELECT attorney_slug, soc_code, naics, worksite_city, worksite_state AS st FROM pwd_cases "
            f"WHERE employer_slug IN ({marks}) OR case_number IN ({cmarks})", [*slugs, *cases],
        )
        for r in rows:
            if r.get("attorney_slug"):
                paths.add(f"/perm-attorneys/{r['attorney_slug']}")
        for cn in cases:
            paths.add(f"/perm-case-status?case={cn}")
    else:
        paths.update({"/perm-attorneys", "/law-firm-rankings"})
        for s in slugs:
            paths.update({f"/badge/firm/{s}.svg", f"/badge/firm/{s}.light.svg"})
        if np:
            ns = neutral_slug(e)
            paths.update({f"/badge/firm/{ns}.svg", f"/badge/firm/{ns}.light.svg"})
        for r in _quiet(q, f"SELECT DISTINCT state FROM firm_ranks WHERE slug IN ({marks})", slugs):
            st = _state_slug(str(r.get("state") or ""))
            if st:
                paths.add(f"/law-firm-rankings/{st}")
        rows = _quiet(q,
            f"SELECT DISTINCT employer_slug, soc_code, naics, worksite_city, state AS st FROM perm_cases "
            f"WHERE attorney_slug IN ({marks})", slugs,
        )
        for table in ("pwd_cases", "lca_cases", "seasonal_cases"):
            rows += _quiet(q, f"SELECT DISTINCT employer_slug, soc_code FROM {table} WHERE attorney_slug IN ({marks})", slugs)
        for r in rows:
            if r.get("employer_slug"):
                paths.add(f"/perm-employers/{r['employer_slug']}")
    soc_groups: set[str] = set()
    for r in rows:
        if r.get("naics"):
            paths.add(f"/perm-industries/{str(r['naics']).strip()}")
        if r.get("worksite_city") and r.get("st"):
            paths.add(_city_path(str(r["worksite_city"]), str(r["st"])))
        if r.get("soc_code"):
            soc_groups.add(str(r["soc_code"])[:7])
    for g in sorted(soc_groups):
        for o in _quiet(q, "SELECT slug FROM perm_entities WHERE kind = 'occupation' AND code LIKE ?", [g + "%"]):
            paths.add(f"/perm-wages/{o['slug']}")
    return sorted(paths)


# ---------------------------------------------------------------------------
# What the database knows of one entity: its slugs and every printed spelling
# ---------------------------------------------------------------------------

# Where each kind's name is printed, and the columns that carry it.
NAME_TABLES = {
    "firm": [
        (t, "attorney_name", "attorney_slug")
        for t in ("perm_cases", "perm_cases_history", "pwd_cases", "seasonal_cases", "lca_cases", "lca_cases_history")
    ],
    "employer": [
        (t, "employer_name", "employer_slug")
        for t in ("perm_cases", "perm_cases_history", "pwd_cases", "seasonal_cases", "lca_cases", "lca_cases_history",
                  "perm_case_status", "perm_live_recent", "pwd_case_status", "lca_case_status", "seasonal_case_status")
    ],
}
PAGE_MAP = {"firm": "firm_page_map", "employer": "employer_page_map"}
# An employer's case numbers are gathered only when there are few: a company's
# thousands are caught by its names and slugs, and would swell the setting.
MAX_CASES = 200


@dataclass
class Gathered:
    entry: Entry
    counts: dict[str, int]


def page_exists(q: Query, kind: str, slug: str) -> bool:
    if _quiet(q, "SELECT slug FROM perm_entities WHERE kind = ? AND slug = ?", [ENTITY_KIND[kind], slug]):
        return True
    if kind == "employer":
        for table in ("perm_live_only_index", "employer_other_index"):
            if _quiet(q, f"SELECT slug FROM {table} WHERE slug = ?", [slug]):
                return True
    return False


def slug_taken(q: Query, slug: str) -> bool:
    """Whether any real page or spelling already answers to this slug, of either kind."""
    checks = [
        ("SELECT slug FROM perm_entities WHERE slug = ?", [slug]),
        ("SELECT slug FROM perm_entity_alias WHERE slug = ?", [slug]),
        ("SELECT slug FROM perm_live_only_index WHERE slug = ?", [slug]),
        ("SELECT slug FROM employer_other_index WHERE slug = ?", [slug]),
        ("SELECT source_slug FROM employer_page_map WHERE source_slug = ?", [slug]),
        ("SELECT source_slug FROM firm_page_map WHERE source_slug = ?", [slug]),
    ]
    return any(_quiet(q, sql, args) for sql, args in checks)


def gather(q: Query, kind: str, slug: str, *, name: str | None = None, label: str | None = None,
           cases: Iterable[str] = (), number: int | None = None) -> Gathered:
    """Every slug and printed spelling the database ties to one page, with counts.

    The page slug, its aliases, the spellings the nightly page map assigns it,
    pages sharing its merge key, and the distinct names its rows print in every
    table; for an employer with few cases, their numbers. Raises when no such
    page exists.
    """
    s = slug.strip().lower()
    ekind = ENTITY_KIND[kind]
    if not page_exists(q, kind, s):
        raise LookupError("no page of that kind has that slug")
    head = _quiet(q, "SELECT name, merge_key FROM perm_entities WHERE kind = ? AND slug = ?", [ekind, s])
    slugs: list[str] = [s]
    slugs += [str(r["slug"]) for r in _quiet(q, "SELECT slug FROM perm_entity_alias WHERE kind = ? AND target_slug = ?", [ekind, s])]
    slugs += [str(r["source_slug"]) for r in _quiet(q, f"SELECT source_slug FROM {PAGE_MAP[kind]} WHERE page_slug = ?", [s])]
    merge_key = head[0].get("merge_key") if head else None
    names: list[str] = [name] if name else []
    if head and head[0].get("name"):
        names.append(str(head[0]["name"]))
    if merge_key:
        for r in _quiet(q, "SELECT slug, name FROM perm_entities WHERE kind = ? AND merge_key = ? AND slug <> ?", [ekind, merge_key, s]):
            slugs.append(str(r["slug"]))
            names.append(str(r["name"]))
    slugs = list(_unique(x.lower() for x in slugs))
    counts = {"slugs": len(slugs)}
    marks = _marks(len(slugs))
    rows_total = 0
    for table, ncol, scol in NAME_TABLES[kind]:
        got = _quiet(q, f"SELECT {ncol} AS n, count(*) AS c FROM {table} WHERE {scol} IN ({marks}) GROUP BY {ncol}", slugs)
        names += [str(r["n"]) for r in got if r.get("n")]
        rows_total += sum(int(r.get("c") or 0) for r in got)
    counts["rows"] = rows_total
    found_cases: list[str] = [c.strip().upper() for c in cases if c.strip()]
    if kind == "employer":
        got = _quiet(q, f"SELECT case_number FROM perm_cases WHERE employer_slug IN ({marks}) "
                        f"UNION SELECT case_number FROM pwd_cases WHERE employer_slug IN ({marks}) LIMIT {MAX_CASES + 1}",
                     [*slugs, *slugs])
        if len(got) <= MAX_CASES:
            found_cases += [str(r["case_number"]).upper() for r in got if r.get("case_number")]
    names_u = _unique_by((_squash(n) for n in names if n and n.strip()), lambda n: n.lower())
    if not names_u:
        raise LookupError("the page has no printed name to withhold")
    counts["names"] = len(names_u)
    counts["cases"] = len(_unique(found_cases))
    entry = Entry(
        kind=kind,
        slug=s,
        name=names_u[0],
        label=label or DEFAULT_LABEL[kind],
        cases=_unique(found_cases),
        number=number,
        slugs=tuple(slugs),
        names=names_u,
    )
    check_fields(entry)
    return Gathered(entry, counts)


def unlisted_spellings(q: Query, e: Entry) -> int:
    """How many spellings the nightly page map now assigns the page that the entry doesn't list."""
    known = set(e.all_slugs())
    got = _quiet(q, f"SELECT source_slug FROM {PAGE_MAP[e.kind]} WHERE page_slug = ?", [e.slug])
    return sum(1 for r in got if str(r.get("source_slug") or "").lower() not in known)
