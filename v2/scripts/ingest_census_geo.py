#!/usr/bin/env python3
"""Place every city the site has a page for: county, metro area, coordinates
and DOL's prevailing-wage area.

WHAT IT IS. DOL's files name a worksite by city and state, as typed ("NEW
YORK|NY", "ST. LOUIS|MO"). Census publishes where every place is: the
Gazetteer (each place's and county's internal point), the national
places-by-county code list (which counties a place lies in) and the metro
delineation (which metro area each county belongs to). DOL's own wage tables
(`oflc_wage_geography`, loaded by ingest_oflc_wages.py) say which prevailing
wage area each county is in. Joined, a city page can say what metro it's in
and show the pay and wage levels that apply there.

HOW A CITY IS MATCHED. Names are compared after Census's legal descriptions
come off ("San Jose city" is SAN JOSE, "Urban Honolulu CDP" is HONOLULU) and
after both sides spell ST, FT and MT out. An incorporated place beats a
census-designated one of the same name. A place in one county takes it; a
place in several (New York City is in five) takes the county whose internal
point is nearest the place's own, and `county_basis` says so. A city Census
has no place for is left unmatched rather than guessed.

Usage:
    python3 scripts/ingest_census_geo.py              # discover, match, write
    python3 scripts/ingest_census_geo.py --dry-run    # match and report, write nothing
"""
from __future__ import annotations

import argparse
import io
import json
import math
import os
import re
import sys
import time
import unicodedata
import zipfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib_gov_data import POLITE_PAUSE_S, discover_links, fetch, log  # noqa: E402
from lib_reference import sheet_rows, sync_rows  # noqa: E402
from lib_turso import Turso, add_missing_columns, query_rows, record_run, stamp_freshness, write_doc  # noqa: E402

SCRIPT = "ingest_census_geo.py"
# What the site prints as the source line: a readable name, never a bare URL (a URL has no
# spaces, so it can't wrap, and it pushed two pages sideways on a phone, Oct 5 2026).
SOURCE = "Census Bureau Gazetteer and metro delineation files (census.gov)"
GAZ_INDEX = "https://www2.census.gov/geo/docs/maps-data/data/gazetteer/"
CODES_INDEX = "https://www2.census.gov/geo/docs/reference/codes2020/"
DELINEATION_PAGE = "https://www.census.gov/geographies/reference-files/time-series/demo/metro-micro/delineation-files.html"
COUNTIES = "census_counties"
CITIES = "city_geo"
COUNTY_COLS = ("fips", "state_ab", "name", "lat", "lon", "cbsa", "cbsa_title", "cbsa_type", "csa_title")
CITY_COLS = ("city_key", "place_geoid", "place_name", "lat", "lon", "county_fips", "county_name",
             "county_basis", "cbsa", "cbsa_title", "cbsa_type", "wage_area", "wage_area_name", "wage_year",
             "counties", "wage_areas")
# Added after the table first shipped, so a live table gains them by ALTER.
LATE_CITY_COLS = {"counties": "TEXT", "wage_areas": "INTEGER"}

DDL = [
    f"""CREATE TABLE IF NOT EXISTS {COUNTIES} (
        fips TEXT PRIMARY KEY, state_ab TEXT NOT NULL, name TEXT NOT NULL, lat REAL, lon REAL,
        cbsa TEXT, cbsa_title TEXT, cbsa_type TEXT, csa_title TEXT)""",
    f"""CREATE TABLE IF NOT EXISTS {CITIES} (
        city_key TEXT PRIMARY KEY, place_geoid TEXT, place_name TEXT, lat REAL, lon REAL,
        county_fips TEXT, county_name TEXT, county_basis TEXT, cbsa TEXT, cbsa_title TEXT,
        cbsa_type TEXT, wage_area TEXT, wage_area_name TEXT, wage_year INTEGER,
        counties TEXT, wage_areas INTEGER)""",
    f"CREATE INDEX IF NOT EXISTS {CITIES}_cbsa ON {CITIES} (cbsa)",
]

# Census's legal descriptions, longest first so "city and borough" goes before "city".
LSAD = sorted([
    "city and borough", "consolidated government (balance)", "metropolitan government (balance)",
    "unified government (balance)", "metro government (balance)", "city (balance)", "town (balance)",
    "charter township",
    "urban county", "municipality", "borough", "village", "township", "comunidad", "zona urbana",
    "plantation", "city", "town", "cdp",
], key=len, reverse=True)
ABBREV = [(re.compile(r"\bST\b"), "SAINT"), (re.compile(r"\bSTE\b"), "SAINTE"),
          (re.compile(r"\bFT\b"), "FORT"), (re.compile(r"\bMT\b"), "MOUNT")]
COUNTY_WORDS = re.compile(r"\s+(COUNTY|PARISH|BOROUGH|CENSUS AREA|MUNICIPIO|MUNICIPALITY|CITY AND BOROUGH)$")


class Refusal(Exception):
    """A match too poor to write, with the reason."""


def norm(name: str) -> str:
    """One spelling for a place name, whoever typed it."""
    # Doña Ana County in Census's file is Dona Ana County in DOL's.
    s = "".join(ch for ch in unicodedata.normalize("NFKD", name) if not unicodedata.combining(ch))
    s = s.upper().replace(".", "").replace("'", "").replace("’", "")
    s = re.sub(r"[^A-Z0-9 /-]", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    for pat, full in ABBREV:
        s = pat.sub(full, s)
    return s


def place_keys(census_name: str) -> list[str]:
    """The names a Census place answers to, best first.

    "Nashville-Davidson metropolitan government (balance)" answers to
    NASHVILLE-DAVIDSON and to NASHVILLE; "Urban Honolulu CDP" to HONOLULU too.
    """
    base = census_name.strip()
    # Census writes its legal descriptions in lower case ("Boise City city",
    # "Acton town"); a capitalised "City" is part of the name ("Carson City"),
    # so only an exact lower-case suffix comes off. (CDP is the one in capitals.)
    for word in LSAD:
        if base.endswith(" " + word) or (word == "cdp" and base.endswith(" CDP")):
            base = base[: -len(word) - 1].strip()
            break
    keys = [norm(base)]
    for alt in re.split(r"[-/]", base):
        alt = norm(alt)
        if alt and alt not in keys:
            keys.append(alt)
    if keys[0].startswith("URBAN "):
        keys.append(keys[0][6:])
    # Massachusetts' town-form cities: "Agawam Town city" is DOL's AGAWAM.
    if keys[0].endswith(" TOWN") and len(keys[0]) > 5:
        keys.append(keys[0][:-5])
    return keys


def dol_variants(city: str, st: str) -> list[str]:
    """The ways DOL's typed city might name a Census place, best first."""
    base = norm(city)
    out = [base]
    if st == "DC" and base in ("DISTRICT OF COLUMBIA", "WASHINGTON DC"):
        out.append("WASHINGTON")
    for pat, rep in ((r"^E ", "EAST "), (r"^W ", "WEST "), (r"^N ", "NORTH "), (r"^S ", "SOUTH ")):
        if re.match(pat, base):
            out.append(re.sub(pat, rep, base))
    m = re.match(r"^CITY OF (.+)$", base)
    if m:
        out.append(m.group(1))
    m = re.match(r"^(.+?) (TOWNSHIP|TWP|TOWN|VILLAGE|BOROUGH)$", base)
    if m:
        out.append(m.group(1))
    return list(dict.fromkeys(out))


def county_key(state_ab: str, county: str) -> tuple[str, str]:
    return state_ab.upper(), COUNTY_WORDS.sub("", norm(county))


def miles(a: tuple[float, float], b: tuple[float, float]) -> float:
    lat1, lon1, lat2, lon2 = map(math.radians, (*a, *b))
    h = math.sin((lat2 - lat1) / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin((lon2 - lon1) / 2) ** 2
    return 3958.8 * 2 * math.asin(math.sqrt(h))


def read_gazetteer(text: str) -> list[dict[str, str]]:
    lines = text.splitlines()
    head = [h.strip() for h in lines[0].split("|")]
    return [dict(zip(head, (c.strip() for c in line.split("|")))) for line in lines[1:] if line.strip()]


def build(places_txt: str, counties_txt: str, by_county_txt: str, delineation: bytes,
          wage_geo: list[tuple[str, str, str, str, int]], city_keys: list[str],
          cousubs_txt: str = "") -> tuple[list[tuple], list[tuple], dict]:
    """(county rows, city rows, match report).

    Candidates rank: an incorporated place; then a county subdivision that is a
    government (New England towns, the townships of New Jersey, Pennsylvania
    and Michigan, New York's boroughs), which Census lists as subdivisions
    rather than places; then a census-designated place; then a name whose
    trailing "City" is part of Census's name only (Boise City is DOL's BOISE).
    """
    # Metro membership per county.
    rows = sheet_rows(delineation)
    header: list[str] = []
    for r in rows:
        if "CBSA Code" in r:
            header = r
            break
    ix = {h: i for i, h in enumerate(header)}
    need = ("CBSA Code", "CBSA Title", "Metropolitan/Micropolitan Statistical Area", "FIPS State Code", "FIPS County Code")
    if any(n not in ix for n in need):
        raise Refusal(f"delineation header is {header}")
    metro: dict[str, tuple[str, str, str, str]] = {}
    for r in rows:
        if len(r) <= ix["FIPS County Code"] or not r[ix["CBSA Code"]].strip().isdigit():
            continue
        fips = r[ix["FIPS State Code"]].strip().zfill(2) + r[ix["FIPS County Code"]].strip().zfill(3)
        kind = "metro" if "Metropolitan" in r[ix["Metropolitan/Micropolitan Statistical Area"]] else "micro"
        csa = r[ix["CSA Title"]].strip() if "CSA Title" in ix and ix["CSA Title"] < len(r) else ""
        metro[fips] = (r[ix["CBSA Code"]].strip(), r[ix["CBSA Title"]].strip(), kind, csa)

    wage = {county_key(st, county): (area, name, year) for st, county, area, name, year in wage_geo}

    county_rows = []
    county_pt: dict[str, tuple[float, float]] = {}
    county_name: dict[str, str] = {}
    county_state: dict[str, str] = {}
    for c in read_gazetteer(counties_txt):
        fips = c["GEOID"]
        pt = (float(c["INTPTLAT"]), float(c["INTPTLONG"]))
        county_pt[fips], county_name[fips], county_state[fips] = pt, c["NAME"], c["USPS"]
        m = metro.get(fips, (None, None, None, None))
        county_rows.append((fips, c["USPS"], c["NAME"], round(pt[0], 6), round(pt[1], 6), m[0], m[1], m[2], m[3] or None))

    in_counties: dict[str, set[str]] = {}
    for line in by_county_txt.splitlines()[1:]:
        f = line.split("|")
        if len(f) >= 5:
            in_counties.setdefault(f[1] + f[4], set()).add(f[1] + f[2])

    # (state, name) -> [(rank, record, kind)]; the lowest rank wins.
    index: dict[tuple[str, str], list[tuple[int, dict, str]]] = {}

    def add(st: str, key: str, rank: int, rec: dict, kind: str) -> None:
        index.setdefault((st, key), []).append((rank, rec, kind))

    for p in read_gazetteer(places_txt):
        keys = place_keys(p["NAME"])
        rank = 0 if p.get("FUNCSTAT") == "A" else 2
        for k in keys:
            add(p["USPS"], k, rank, p, "place")
        if keys[0].endswith(" CITY") and len(keys[0]) > 5:
            add(p["USPS"], keys[0][:-5], 3, p, "place")
    for c in read_gazetteer(cousubs_txt) if cousubs_txt else []:
        # A statistical division (FUNCSTAT S: the CCDs of states with no
        # townships) and a fictitious one (F) govern nothing and aren't towns.
        if c.get("FUNCSTAT") in ("S", "F", "N") or c["NAME"].endswith((" CCD", " UT")):
            continue
        for k in place_keys(c["NAME"]):
            add(c["USPS"], k, 1, c, "cousub")

    # A city on both the PERM and the H-1B lists is one city.
    city_keys = sorted(set(city_keys))
    city_rows, report = [], {"cities": len(city_keys), "matched": 0, "multiCounty": 0, "splitWageArea": 0, "noWageArea": 0,
                             "unmatched": [], "ambiguous": []}
    for key in sorted(set(city_keys)):
        if "|" not in key:
            continue
        city, st = key.rsplit("|", 1)
        cands = next((index[(st, v)] for v in dol_variants(city, st) if (st, v) in index), [])
        if not cands:
            report["unmatched"].append(key)
            continue
        best = min(c[0] for c in cands)
        top = [c for c in cands if c[0] == best]
        exact = [c for c in top if place_keys(c[1]["NAME"])[0] in dol_variants(city, st)]
        top = exact or top
        if len({c[1]["GEOID"] for c in top}) > 1:
            # Michigan has a Clinton charter township and a Clinton township, in
            # different counties. Two equally good answers is no answer.
            report["ambiguous"].append(key)
            continue
        _, p, kind = top[0]
        pt = (float(p["INTPTLAT"]), float(p["INTPTLONG"]))
        # A subdivision's GEOID carries its county: state, county, subdivision.
        options = [p["GEOID"][:5]] if kind == "cousub" else sorted(in_counties.get(p["GEOID"], set()))
        if not any(o in county_name for o in options):
            # The 2020 places-by-county list still names Connecticut's old
            # counties, which the 2022 planning regions replaced (DOL and the
            # current Gazetteer use the regions), and it omits a few places.
            # The same-named subdivision carries the current county.
            sub = next((c[1] for c in cands if c[2] == "cousub"), None)
            options = [sub["GEOID"][:5]] if sub else []
        if not any(o in county_name for o in options):
            # Still nothing current: the nearest county in the same state,
            # labelled as such (a few unincorporated places in Connecticut).
            same_state = [f for f, st_ab in county_state.items() if st_ab == st]
            options = [min(same_state, key=lambda f: miles(pt, county_pt[f]))] if same_state else []
            nearest_only = True
        else:
            nearest_only = False
        if nearest_only and options:
            fips, basis = options[0], "nearest-in-state"
        elif len(options) == 1:
            fips, basis = options[0], "single"
        elif options:
            fips = min((o for o in options if o in county_pt), key=lambda o: miles(pt, county_pt[o]), default=options[0])
            basis = "nearest"
            report["multiCounty"] += 1
        else:
            fips, basis = None, None
        m = metro.get(fips or "", (None, None, None, None))
        w = wage.get(county_key(st, county_name[fips])) if fips in county_name else None
        if w is None:
            report["noWageArea"] += 1
        # Every current county the place spans, and how many of DOL's wage areas
        # they fall in. One nearest county is only a center point: New York city
        # is five counties, and a reader asking which wage area a worksite is in
        # needs to know when the city itself doesn't settle it.
        spans = sorted(o for o in options if o in county_name) if basis == "nearest" else []
        names = json.dumps([county_name[o] for o in sorted(spans, key=lambda o: county_name[o])]) if spans else None
        areas = {wage[county_key(st, county_name[o])][0] for o in spans if county_key(st, county_name[o]) in wage}
        if len(areas) > 1:
            report["splitWageArea"] += 1
        city_rows.append((key, p["GEOID"], p["NAME"], round(pt[0], 6), round(pt[1], 6), fips,
                          county_name.get(fips or ""), basis, m[0], m[1], m[2],
                          w[0] if w else None, w[1] if w else None, w[2] if w else None,
                          names, len(areas) if spans else None))
        report["matched"] += 1
    return county_rows, city_rows, report


def newest(html: str, pattern: str) -> str:
    found = sorted(re.findall(pattern, html))
    if not found:
        raise Refusal(f"nothing matching {pattern!r}")
    return found[-1]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()
    started = time.time()

    gaz_year = newest(fetch(GAZ_INDEX).decode("utf-8", "replace"), r'href="(\d{4})_Gazetteer/"')
    gaz_dir = f"{GAZ_INDEX}{gaz_year}_Gazetteer/"
    listing = fetch(gaz_dir).decode("utf-8", "replace")
    files = {}
    for kind in ("place", "counties", "cousubs"):
        name = newest(listing, rf'href="({gaz_year}_Gaz_{kind}_national\.zip)"')
        z = zipfile.ZipFile(io.BytesIO(fetch(gaz_dir + name, referer=gaz_dir)))
        files[kind] = z.read(z.namelist()[0]).decode("utf-8", "replace")
        time.sleep(POLITE_PAUSE_S)
    codes = fetch(CODES_INDEX).decode("utf-8", "replace")
    by_county_name = newest(codes, r'href="(national_place_by_county20\d\d\.txt)"')
    by_county = fetch(CODES_INDEX + by_county_name, referer=CODES_INDEX).decode("utf-8", "replace")
    lists = discover_links(fetch(DELINEATION_PAGE).decode("utf-8", "replace"), r"list1_\d{4}\.xlsx$", "https://www.census.gov")
    if not lists:
        raise Refusal("no list1 delineation file linked")
    list1 = max(lists)
    url = lists[list1]
    url = "https:" + url[len("https://www.census.gov"):] if url.startswith("https://www.census.gov//") else url
    delineation = fetch(url, referer=DELINEATION_PAGE)
    log(f"gazetteer {gaz_year}, {by_county_name}, {list1}")

    db = Turso()
    keys = [r[0] for r in query_rows(db, "SELECT key FROM perm_groups WHERE kind = 'city'")]
    keys += [r[0] for r in query_rows(db, "SELECT key FROM lca_cities")]
    wage_geo = []
    years = query_rows(db, "SELECT max(wage_year) FROM oflc_wage_geography")
    if years and years[0][0]:
        newest_year = int(years[0][0])
        wage_geo = [(r[0], r[1], r[2], r[3], newest_year) for r in query_rows(
            db, "SELECT state_ab, county, area, area_name FROM oflc_wage_geography WHERE wage_year = ?", [newest_year])]
    county_rows, city_rows, report = build(files["place"], files["counties"], by_county, delineation, wage_geo, keys,
                                           files["cousubs"])
    share = report["matched"] / max(report["cities"], 1)
    log(f"  {report['matched']} of {report['cities']} cities placed ({share:.1%}); {report['multiCounty']} span "
        f"several counties, {report['splitWageArea']} of them across DOL wage areas; {report['noWageArea']} without "
        f"a wage area; e.g. unmatched {report['unmatched'][:12]}")
    if share < 0.85:
        raise Refusal(f"only {share:.1%} of cities matched a Census place")
    if args.dry_run:
        return 0
    db.script(DDL)
    for col in add_missing_columns(db, CITIES, LATE_CITY_COLS):
        log(f"  added missing column {CITIES}.{col}")
    got_c = sync_rows(db, COUNTIES, ("fips",), COUNTY_COLS, county_rows)
    got_p = sync_rows(db, CITIES, ("city_key",), CITY_COLS, city_rows)
    write_doc(db, "census_geo_meta", {"gazetteer": gaz_year, "placeByCounty": by_county_name,
                                      "delineation": list1,
                                      **{k: v for k, v in report.items() if k not in ("unmatched", "ambiguous")},
                                      "unmatched": report["unmatched"][:200], "ambiguous": report["ambiguous"]})
    stamp_freshness(db, "census-geo", as_of=f"{gaz_year}-01-01", source=SOURCE, cadence="yearly",
                    note=f"{report['matched']} cities placed, gazetteer {gaz_year}", max_age_days=800)
    record_run(db, SCRIPT, status="ok", rows_written=got_c["written"] + got_p["written"],
               note=f"counties {got_c}; cities {got_p}", started_at=started)
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Refusal as exc:
        log(f"REFUSED: {exc}")
        sys.exit(1)
