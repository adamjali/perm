#!/usr/bin/env python3
"""ingest_census_geo.build against a tiny geography built here.

Run: python3 scripts/test_census_geo.py
"""
from __future__ import annotations

import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import ingest_census_geo as g  # noqa: E402
from lib_test_xlsx import xlsx_bytes  # noqa: E402

FAILS: list[str] = []
N = 0


def check(label, got, want):
    global N
    N += 1
    if got != want:
        FAILS.append(f"{label}: got {got!r}, want {want!r}")


PLACES = "\n".join([
    "USPS|GEOID|GEOIDFQ|ANSICODE|NAME|LSAD|FUNCSTAT|ALAND|AWATER|ALAND_SQMI|AWATER_SQMI|INTPTLAT|INTPTLONG",
    "CA|0668000|x|x|San Jose city|25|A|1|1|1|1|37.29|-121.81",
    "CA|0668001|x|x|San Jose CDP|57|S|1|1|1|1|30.0|-100.0",
    "ID|1608830|x|x|Boise City city|25|A|1|1|1|1|43.6|-116.2",
    "HI|1571550|x|x|Urban Honolulu CDP|57|S|1|1|1|1|21.3|-157.8",
    "NV|3209700|x|x|Carson City|25|A|1|1|1|1|39.1|-119.7",
    "NY|3651000|x|x|New York city|25|A|1|1|1|1|40.66|-73.94",
    "MO|2965000|x|x|St. Louis city|25|A|1|1|1|1|38.63|-90.24",
    "NM|3539380|x|x|Las Cruces city|25|A|1|1|1|1|32.3|-106.8",
    "CT|0908000|x|x|Bridgeport city|25|A|1|1|1|1|41.18|-73.19",
    "MA|2500840|x|x|Agawam Town city|25|A|1|1|1|1|42.06|-72.65",
])
COUSUBS = "\n".join([
    "USPS|GEOID|GEOIDFQ|ANSICODE|NAME|FUNCSTAT|ALAND|AWATER|ALAND_SQMI|AWATER_SQMI|INTPTLAT|INTPTLONG",
    "MA|2501700380|x|x|Acton town|A|1|1|1|1|42.48|-71.43",
    "NY|3600508510|x|x|Bronx borough|G|1|1|1|1|40.84|-73.85",
    "AL|0100190171|x|x|Autaugaville CCD|S|1|1|1|1|32.4|-86.7",
    "MI|2609917000|x|x|Clinton charter township|A|1|1|1|1|42.6|-82.9",
    "MI|2609117020|x|x|Clinton township|A|1|1|1|1|42.0|-84.0",
    "CT|0912008070|x|x|Bridgeport town|C|1|1|1|1|41.18|-73.19",
])
COUNTIES = "\n".join([
    "USPS|GEOID|GEOIDFQ|ANSICODE|NAME|ALAND|AWATER|ALAND_SQMI|AWATER_SQMI|INTPTLAT|INTPTLONG",
    "CA|06085|x|x|Santa Clara County|1|1|1|1|37.2|-121.7",
    "ID|16001|x|x|Ada County|1|1|1|1|43.4|-116.2",
    "HI|15003|x|x|Honolulu County|1|1|1|1|21.4|-157.9",
    "NV|32510|x|x|Carson City|1|1|1|1|39.15|-119.74",
    "NY|36047|x|x|Kings County|1|1|1|1|40.64|-73.94",
    "NY|36061|x|x|New York County|1|1|1|1|40.78|-73.97",
    "NY|36005|x|x|Bronx County|1|1|1|1|40.85|-73.85",
    "MO|29510|x|x|St. Louis city|1|1|1|1|38.63|-90.24",
    "NM|35013|x|x|Doña Ana County|1|1|1|1|32.35|-106.8",
    "MA|25017|x|x|Middlesex County|1|1|1|1|42.48|-71.39",
    "MA|25013|x|x|Hampden County|1|1|1|1|42.13|-72.63",
    "MI|26099|x|x|Macomb County|1|1|1|1|42.69|-82.91",
    "MI|26091|x|x|Lenawee County|1|1|1|1|41.89|-84.06",
    "CT|09120|x|x|Greater Bridgeport Planning Region|1|1|1|1|41.2|-73.2",
])
BY_COUNTY = "\n".join([
    "STATE|STATEFP|COUNTYFP|COUNTYNAME|PLACEFP|PLACENS|PLACENAME|TYPE|CLASSFP|FUNCSTAT",
    "CA|06|085|Santa Clara County|68000|x|San Jose city|INCORPORATED PLACE|C1|A",
    "ID|16|001|Ada County|08830|x|Boise City city|INCORPORATED PLACE|C1|A",
    "HI|15|003|Honolulu County|71550|x|Urban Honolulu CDP|CDP|U1|S",
    "NV|32|510|Carson City|09700|x|Carson City|INCORPORATED PLACE|C7|A",
    "NY|36|047|Kings County|51000|x|New York city|INCORPORATED PLACE|C1|A",
    "NY|36|061|New York County|51000|x|New York city|INCORPORATED PLACE|C1|A",
    "MO|29|510|St. Louis city|65000|x|St. Louis city|INCORPORATED PLACE|C7|A",
    "NM|35|013|Dona Ana County|39380|x|Las Cruces city|INCORPORATED PLACE|C1|A",
    "CT|09|001|Fairfield County|08000|x|Bridgeport city|INCORPORATED PLACE|C5|A",
    "MA|25|013|Hampden County|00840|x|Agawam Town city|INCORPORATED PLACE|C5|A",
])
DELINEATION = xlsx_bytes({"List 1": [
    ["List 1. CBSAs"], [],
    ["CBSA Code", "Metropolitan Division Code", "CSA Code", "CBSA Title", "Metropolitan/Micropolitan Statistical Area",
     "Metropolitan Division Title", "CSA Title", "County/County Equivalent", "State Name", "FIPS State Code",
     "FIPS County Code", "Central/Outlying County"],
    ["41940", "", "488", "San Jose-Sunnyvale-Santa Clara, CA", "Metropolitan Statistical Area", "",
     "San Jose-San Francisco-Oakland, CA", "Santa Clara County", "California", "06", "085", "Central"],
    ["35620", "", "", "New York-Newark-Jersey City, NY-NJ", "Metropolitan Statistical Area", "", "",
     "Kings County", "New York", "36", "047", "Central"],
    ["16180", "", "", "Carson City, NV", "Metropolitan Statistical Area", "", "", "Carson City", "Nevada", "32", "510", "Central"],
]})
WAGE = [("CA", "Santa Clara County", "41940", "San Jose-Sunnyvale-Santa Clara, CA", 2026),
        ("NM", "Dona Ana County", "29740", "Las Cruces, NM", 2026),
        ("NY", "Kings County", "35620", "New York-Newark-Jersey City, NY-NJ", 2026),
        ("CT", "Greater Bridgeport Planning Region", "14860", "Bridgeport-Stamford-Danbury, CT", 2026)]
KEYS = ["SAN JOSE|CA", "BOISE|ID", "HONOLULU|HI", "CARSON CITY|NV", "NEW YORK|NY", "ST. LOUIS|MO",
        "SAINT LOUIS|MO", "LAS CRUCES|NM", "ACTON|MA", "BRONX|NY", "CLINTON TOWNSHIP|MI",
        "BRIDGEPORT|CT", "AGAWAM|MA", "AUTAUGAVILLE|AL", "ATLANTIS|FL", "nonsense"]


def main() -> int:
    counties, cities, rep = g.build(PLACES, COUNTIES, BY_COUNTY, DELINEATION, WAGE, KEYS + KEYS[:3], COUSUBS)
    check("a city on both lists counts once", rep["cities"], len(set(KEYS)))
    by = {r[0]: r for r in cities}
    check("an incorporated place beats a CDP of the same name", by["SAN JOSE|CA"][2], "San Jose city")
    check("its one county, metro and wage area",
          (by["SAN JOSE|CA"][6], by["SAN JOSE|CA"][7], by["SAN JOSE|CA"][8], by["SAN JOSE|CA"][11]),
          ("Santa Clara County", "single", "41940", "41940"))
    check("Boise City city is DOL's BOISE", by["BOISE|ID"][2], "Boise City city")
    check("Urban Honolulu CDP is HONOLULU", by["HONOLULU|HI"][2], "Urban Honolulu CDP")
    check("Carson City keeps its whole name", by["CARSON CITY|NV"][2], "Carson City")
    check("a place in several counties takes the nearest, and says so",
          (by["NEW YORK|NY"][6], by["NEW YORK|NY"][7]), ("Kings County", "nearest"))
    check("ST. and SAINT are one name", (by["ST. LOUIS|MO"][2], by["SAINT LOUIS|MO"][2]),
          ("St. Louis city", "St. Louis city"))
    check("Doña Ana in Census is Dona Ana in DOL", by["LAS CRUCES|NM"][11], "29740")
    check("a New England town comes from the subdivisions", (by["ACTON|MA"][2], by["ACTON|MA"][6]),
          ("Acton town", "Middlesex County"))
    check("so does a New York borough", by["BRONX|NY"][6], "Bronx County")
    check("two equally good answers are no answer", "CLINTON TOWNSHIP|MI" in by, False)
    check("and are reported", rep["ambiguous"], ["CLINTON TOWNSHIP|MI"])
    check("a county code Census retired gives way to the subdivision's current one",
          (by["BRIDGEPORT|CT"][6], by["BRIDGEPORT|CT"][11]), ("Greater Bridgeport Planning Region", "14860"))
    check("a statistical CCD is not a town", "AUTAUGAVILLE|AL" in by, False)
    check("a Massachusetts town-form city", by["AGAWAM|MA"][6], "Hampden County")
    check("a city Census has no place for stays unmatched", sorted(rep["unmatched"]), ["ATLANTIS|FL", "AUTAUGAVILLE|AL"])
    check("a malformed key is skipped", "nonsense" in by, False)
    cty = {r[0]: r for r in counties}
    check("counties carry their metro", cty["06085"][5:8], ("41940", "San Jose-Sunnyvale-Santa Clara, CA", "metro"))
    check("a county outside any metro has none", cty["16001"][5], None)
    check("DOL's suffixes come off", g.dol_variants("CRANBERRY TWP", "PA"), ["CRANBERRY TWP", "CRANBERRY"])
    check("CITY OF comes off", g.dol_variants("CITY OF INDUSTRY", "CA")[-1], "INDUSTRY")

    print(f"{N} checks")
    for f in FAILS:
        print("FAIL", f)
    if FAILS:
        return 1
    print("all checks passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
