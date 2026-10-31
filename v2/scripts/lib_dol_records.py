"""What the DOL enforcement loaders share: finding a file in DOL's open data catalog, joining a record to a PERM
sponsor's page, and refreshing the pages whose records moved.

Used by ingest_whd.py (Wage and Hour cases) and ingest_osha.py (OSHA inspections). Joining a record to a page is
where a wrong answer would hurt someone, so the rule is strict and shared, one place:

* the name's key (`program_key`) must lead to a PERM sponsor (`sponsor_matcher`, the layoff notices' rule);
* a national sponsor (`NATIONAL_SPONSOR` or more PERM cases) takes a record from any state. A caller whose records
  print only an establishment's name (OSHA) asks for `national_states` too: a company with 74 cases all in
  Tennessee isn't national there, and an Ohio inspection of the same name stays off its page (a cleaning company,
  measured Oct 31 2026). WHD's records print the legal name, and the 50-case test alone was measured right there:
  requiring five PERM states would have dropped 276 cases, nearly all real (Tyson's Texas plant, Delta in
  California), because PERM jobs sit at headquarters;
* any other sponsor takes a record only under a name of two words or more, and only from a state its own PERM
  filings name as a worksite (`lenient` waives the state for a record already tied to a visa program, a WHD H-1B
  case). A small restaurant in Ohio doesn't land on a namesake that files only in Texas, and a one-word name
  ("Linde Corporation", a contractor, against Linde Inc., the gas company) joins only a national sponsor;
* with `bare_needs_national`, a bare brand (no Inc., LLC or Corp.) joins only a national sponsor too: OSHA prints
  the establishment's name, and a franchisee's store is printed under the brand ("7 ELEVEN" in Michigan against
  7-Eleven, Inc., whose PERM filings are in Ohio and Texas);
* PERM jobs sit at a company's headquarters, so a big sponsor's PERM states undercount where it works (Costco's
  111 PERM cases name 2 states, Kroger's 54 name 1). With `spread` (how many states the record's own file holds that
  exact name in), a sponsor with `NATIONAL_SPONSOR` cases takes an out-of-state record whose name carries its legal
  form ("COSTCO WHOLESALE CORPORATION") when the file holds that name in `NATIONAL_STATES` or more states.
"""
from __future__ import annotations

import json
import os
import pathlib
import re
import urllib.error
import urllib.request
from typing import Callable, Sequence

from entity_identity import program_key
from ingest_warn import FORM_WORD, sponsor_matcher
from lib_db import Database, canon_hash, query_rows
from lib_gov_data import robots_allowed

HEADERS = {"User-Agent": "PERMTracker/1.0 (+https://permtracker.app; support@permtracker.app)"}
# A sponsor this big takes a record from any state: it works in many. NATIONAL_STATES is for callers that ask for it.
NATIONAL_SPONSOR = 50
NATIONAL_STATES = 5
# The most pages one refresh call takes (MAX_PATHS in src/app/api/revalidate-live-employers/route.ts).
MAX_REFRESH = 800


def catalog_url(dataset_id: int) -> str:
    """A dataset's file, from DOL's own catalog record: data-catalog/<agency>/<api path>/<table name>.zip."""
    req = urllib.request.Request(f"https://apiprod.dol.gov/v4/datasets/{dataset_id}", headers=HEADERS)
    with urllib.request.urlopen(req, timeout=60) as res:
        meta = json.load(res)["dataset"]
    url = f"https://data.dol.gov/data-catalog/{meta['agency']['abbr']}/{meta['api_url']}/{meta['tablename']}.zip"
    if not robots_allowed(url):
        raise RuntimeError(f"robots.txt asks scripts off {url}")
    return url


def download(url: str, dest: pathlib.Path) -> None:
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=900) as res, open(dest, "wb") as out:
        while chunk := res.read(1 << 20):
            out.write(chunk)


def file_date(names: Sequence[str]) -> str | None:
    """DOL names each chunk by the day it wrote the file: "2026-10-26_chunk_1.csv"."""
    for name in names:
        m = re.match(r"(\d{4}-\d{2}-\d{2})_", pathlib.PurePath(name).name)
        if m:
            return m.group(1)
    return None


def load_sponsors(db: Database):
    """(merge_key, slug, total) busiest first, and each sponsor's PERM worksite states."""
    sponsors = query_rows(
        db, "SELECT merge_key, slug, total FROM perm_entities WHERE kind = 'employer' AND merge_key IS NOT NULL "
            "ORDER BY total DESC")
    states: dict[str, set[str]] = {}
    # One pass over the PERM file's (employer, worksite state) index.
    for slug, state in query_rows(
            db, "SELECT employer_slug, state FROM perm_cases WHERE employer_slug IS NOT NULL AND state IS NOT NULL "
                "GROUP BY employer_slug, state"):
        # A blank state isn't a state, and would count toward NATIONAL_STATES.
        if str(state).strip():
            states.setdefault(str(slug), set()).add(str(state).strip().upper())
    if not sponsors:
        raise RuntimeError("the employer table read empty; a match against nothing would unlink every record")
    return sponsors, states


def sponsor_rule(sponsors, states, *, bare_needs_national: bool = False, national_states: int = 0) -> Callable[..., str | None]:
    """name, state -> the PERM sponsor's slug under the strict rule above, or None."""
    sponsor = sponsor_matcher(sponsors)
    totals = {str(s): int(t or 0) for _, s, t in sponsors}

    def national(slug: str) -> bool:
        return totals.get(slug, 0) >= NATIONAL_SPONSOR and len(states.get(slug, ())) >= national_states

    def match(name: str, state: str, *, lenient: bool = False, spread: dict[str, int] | None = None) -> str | None:
        key = program_key(name)
        if not key:
            return None
        slug = sponsor(key)
        if not slug:
            return None
        if national(slug):
            return slug
        bare = not FORM_WORD.search(name)
        if bare_needs_national and bare:
            return None
        if (spread is not None and not bare and totals.get(slug, 0) >= NATIONAL_SPONSOR
                and spread.get(key, 0) >= NATIONAL_STATES):
            return slug
        in_state = (state or "").strip().upper() in states.get(slug, ())
        return slug if len(key.split()) > 1 and (lenient or in_state) else None

    # The sponsor a name's key leads to, before any rule: what a caller counts `spread` over.
    match.slug_of = lambda key: sponsor(key)  # type: ignore[attr-defined]
    return match


def moved_pages(db: Database, table: str, cols: Sequence[str], keep: list[list]) -> list[str]:
    """The employer pages whose records changed: a record new, changed or gone, under its old page and its new one,
    the busiest first. `cols` starts with the key and ends with `employer_slug`. Read before the write, so a removed
    record still names the page it has to leave."""
    stored: dict[str, tuple[str, str | None]] = {}
    try:
        for r in query_rows(db, f"SELECT {', '.join(cols)} FROM {table}"):
            stored[str(r[0])] = (canon_hash(r), r[-1])
    except RuntimeError as exc:
        if "no such table" not in str(exc).lower():
            raise
    counts: dict[str, int] = {}

    def bump(slug):
        if slug:
            counts[str(slug)] = counts.get(str(slug), 0) + 1

    seen = set()
    for row in keep:
        rid = str(row[0])
        seen.add(rid)
        old = stored.get(rid)
        if old is None or old[0] != canon_hash(row):
            bump(row[-1])
            bump(old[1] if old else None)
    for rid, (_, slug) in stored.items():
        if rid not in seen:
            bump(slug)
    return sorted(counts, key=lambda k: (-counts[k], k))[:MAX_REFRESH]


def refresh_pages(slugs: list[str], agent: str) -> str:
    """Ask the site to rebuild the employer pages whose records moved; their own window is 30 days."""
    secret = os.environ.get("REVALIDATE_SECRET", "").strip()
    if not slugs or not secret:
        return "no pages to refresh" if not slugs else "no REVALIDATE_SECRET, pages not refreshed"
    base = os.environ.get("REVALIDATE_BASE", "https://permtracker.app").rstrip("/")
    headers = {"x-revalidate-secret": secret, "Content-Type": "application/json", "User-Agent": f"permtracker {agent}"}
    if "127.0.0.1" in base or "localhost" in base:
        headers["Host"] = "permtracker.app"
    req = urllib.request.Request(base + "/api/revalidate-live-employers", data=json.dumps({"slugs": slugs}).encode(),
                                 method="POST", headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            return f"{len(slugs):,} pages refreshed" if r.status == 200 else f"refresh answered {r.status}"
    except urllib.error.HTTPError as e:
        print(f"::warning::the page refresh answered {e.code}", flush=True)
        return f"refresh answered {e.code}"
