#!/usr/bin/env python3
"""Job titles and the SOC codes they're filed under: the job code finder (`/soc-codes`).

WHAT IT ANSWERS. Every PERM case, wage request and H-1B LCA carries a SOC code, the
government's number for a job (Software Developers are 15-1252). A reader knows the
job's title, not its code. This joins the two from two primary sources:

* **DOL's own filings**: the job title each employer typed beside the code it chose,
  counted per program (PERM cases decided from FY2024, wage requests and LCAs of the
  newest three fiscal years). "Software engineer" was filed under 15-1252 in nearly
  every case; "data scientist" is split, and the split is the answer.
* **O*NET 31.0** (CC BY 4.0, USDOL/ETA): the titles O*NET lists for each occupation
  (job_titles.csv) and the ones workers report (sample_of_reported_titles.csv).

THE TITLE KEY (`title_key`, held to src/lib/socTitleKey.ts by
scripts/fixtures/soc_title_keys.json): lower case, punctuation as spaces, seniority
words at the front dropped (senior, sr, jr, junior, lead, staff, principal) and level
marks at the end dropped (I to V, 1 to 9, "level 2"), never the last word. So
"SR. SOFTWARE ENGINEER III" and "Software Engineer" are one title.

WHAT IT WRITES.
* `soc_titles`, one row per (title_key, soc7): the display title, where it comes from
  (dol, onet, both), filings by program, and the commonest spellings seen. A DOL
  title is kept when its key has 5+ filings and the pair has 3+ and 1% of them;
  O*NET's are always kept.
* `perm_docs['soc_codes']`: every code with its title, Job Zone, filings by program,
  its occupation page's slug and how many titles point at it; the date span of each
  program's files.
* `perm_docs['soc_title_pages']`: the titles with a page of their own (50+ filings),
  busiest first, for the sitemap and the finder.

Rebuilt after each quarterly PERM, wage-request and LCA load and the monthly O*NET
load. The health check watches `soc_codes` at 125 days.

Usage:
    python3 scripts/build_soc_titles.py                 # discover O*NET, rebuild
    python3 scripts/build_soc_titles.py --local ZIP     # O*NET's zip from disk
    python3 scripts/build_soc_titles.py --dry-run       # read and report, write nothing
"""
from __future__ import annotations

import argparse
import csv
import io
import json
import pathlib
import re
import sys
import time
import unicodedata
import zipfile
from collections import Counter, defaultdict

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from lib_db import Database, record_run, rows_of, write_doc  # noqa: E402

SCRIPT = "build_soc_titles.py"
TABLE = "soc_titles"
DOC_CODES = "soc_codes"
DOC_PAGES = "soc_title_pages"
COLS = ["title_key", "soc7", "title", "source", "filings", "perm", "pwd", "lca", "spellings"]
DDL = [
    f"""CREATE TABLE IF NOT EXISTS {TABLE} (
    title_key TEXT NOT NULL,
    soc7 TEXT NOT NULL,
    title TEXT NOT NULL,
    source TEXT NOT NULL,
    filings INTEGER NOT NULL,
    perm INTEGER NOT NULL,
    pwd INTEGER NOT NULL,
    lca INTEGER NOT NULL,
    spellings TEXT,
    PRIMARY KEY (title_key, soc7))""",
    # A code page lists the titles filed under it, busiest first.
    f"CREATE INDEX IF NOT EXISTS idx_soc_titles_soc ON {TABLE} (soc7, filings DESC)",
]

# A DOL title earns a row when its key has KEY_MIN filings in all, and a code earns a
# row for it at PAIR_MIN filings and PAIR_SHARE of the key's: below that a pairing is a
# typed code that doesn't fit the job, not an answer.
KEY_MIN = 5
PAIR_MIN = 3
PAIR_SHARE = 0.01
# A title gets a page of its own at PAGE_MIN filings: enough for the split to mean something.
PAGE_MIN = 50
# Wage requests and LCAs are read for the newest YEARS fiscal years; PERM for every
# case in perm_cases (decided from FY2024 on).
YEARS = 3
SPELLINGS_KEPT = 5
SOC_RE = re.compile(r"^\d{2}-\d{4}$")

ONET_PAGE = "https://www.onetcenter.org/database.html"
ONET_HOST = "https://www.onetcenter.org"

# ── the title key (src/lib/socTitleKey.ts is the twin; the fixture holds both) ──

SENIORITY = frozenset({"senior", "sr", "jr", "junior", "lead", "staff", "principal"})
LEVELS = frozenset({"i", "ii", "iii", "iv", "v", "1", "2", "3", "4", "5", "6", "7", "8", "9"})
LEVEL_WORDS = frozenset({"level", "lvl"})


def base_words(raw: str) -> list[str]:
    """Lower case, accents off, '&' as 'and', anything else not a letter or digit a space."""
    s = unicodedata.normalize("NFKD", raw or "")
    s = "".join(ch for ch in s if not unicodedata.combining(ch)).lower().replace("&", " and ")
    return re.sub(r"[^a-z0-9]+", " ", s).split()


def title_key(raw: str) -> str:
    """The key one job title is counted under: seniority at the front and levels at the end dropped."""
    words = base_words(raw)
    while len(words) > 1 and words[0] in SENIORITY:
        words.pop(0)
    while len(words) > 1 and (words[-1] in LEVELS or words[-1] in LEVEL_WORDS):
        words.pop()
    return " ".join(words)


# ── a readable display title ──

ACRONYMS = frozenset({
    "it", "qa", "ux", "ui", "ai", "ml", "sap", "erp", "hr", "cnc", "cdl", "rn", "lpn", "lvn", "cna", "ceo",
    "cfo", "cto", "cio", "coo", "vp", "avp", "svp", "evp", "us", "usa", "bi", "etl", "aws", "gis", "cad",
    "php", "sql", "dba", "seo", "sem", "crm", "hvac", "mep", "pmo", "ehs", "hse", "cpa", "md", "do", "np",
    "pa", "pt", "ot", "slp", "bcba", "phd", "mba", "r&d", "ios", "api", "ic", "rf", "pcb", "fpga", "asic",
    "soc", "noc", "iot", "gpu", "cpu", "sre", "devops", "mlops", "plc", "scada", "cmm", "nlp", "ar", "vr",
    "esl", "k", "ii", "iii", "iv", "kyc", "aml", "fp&a", "ap", "rpa", "saas", "b2b", "gm", "ehr", "emr",
})
SMALL = frozenset({"a", "an", "and", "as", "at", "by", "for", "in", "of", "on", "or", "the", "to", "with"})


def nice_case(raw: str) -> str:
    """DOL's titles are mostly in capitals; this reads them as a job title is written."""
    s = re.sub(r"\s+", " ", (raw or "").strip())
    if not s or (s != s.upper() and s != s.lower()):
        return s  # already in mixed case: as typed

    def word(tok: str, first: bool) -> str:
        low = tok.lower()
        bare = re.sub(r"[^a-z0-9&]", "", low)
        if bare in ACRONYMS or re.search(r"\d", low) or low.startswith("."):
            return tok.upper()
        if not first and bare in SMALL:
            return low
        # Capitalise each part of a hyphen or slash compound: "Full-Stack", "Analyst/Programmer".
        return re.sub(r"(^|[-/(])([a-z])", lambda m: m.group(1) + m.group(2).upper(), low)

    return " ".join(word(t, i == 0) for i, t in enumerate(s.split(" ")))


def soc7_of(code: str | None) -> str | None:
    c = (code or "").strip()[:7]
    return c if SOC_RE.match(c) else None


# ── O*NET ──

def read_csv(archive: zipfile.ZipFile, name: str) -> list[dict[str, str]]:
    member = next((m for m in archive.namelist() if m.endswith("/" + name) or m == name), None)
    if member is None:
        raise SystemExit(f"{name} is missing from O*NET's release")
    with archive.open(member) as handle:
        return list(csv.DictReader(io.TextIOWrapper(handle, encoding="utf-8-sig")))


def onet_release(zip_bytes: bytes) -> dict:
    """O*NET's titles per SOC code, each code's own title and Job Zone."""
    archive = zipfile.ZipFile(io.BytesIO(zip_bytes))
    release = next((m.split("/")[0] for m in archive.namelist() if m.startswith("db_")), "")
    titles: dict[tuple[str, str], str] = {}  # (key, soc7) -> O*NET's spelling
    for name, col in (("job_titles.csv", "Job Title"), ("sample_of_reported_titles.csv", "Reported Job Title")):
        for r in read_csv(archive, name):
            soc = soc7_of(r.get("O*NET-SOC Code"))
            t = (r.get(col) or "").strip()
            key = title_key(t)
            if soc and key:
                titles.setdefault((key, soc), t)
    code_titles: dict[str, str] = {}
    for r in read_csv(archive, "occupation_data.csv"):
        code = (r.get("O*NET-SOC Code") or "").strip()
        soc = soc7_of(code)
        if soc and (code.endswith(".00") or soc not in code_titles):
            code_titles[soc] = (r.get("Title") or "").strip()
    zones: dict[str, int] = {}
    for r in read_csv(archive, "job_zones.csv"):
        code = (r.get("O*NET-SOC Code") or "").strip()
        soc = soc7_of(code)
        z = (r.get("Job Zone") or "").strip()
        if soc and z.isdigit() and (code.endswith(".00") or soc not in zones):
            zones[soc] = int(z)
    m = re.match(r"db_(\d+)_(\d+)", release)
    return {"titles": titles, "code_titles": code_titles, "zones": zones,
            "release": f"{m.group(1)}.{m.group(2)}" if m else release}


def discover_onet_zip() -> bytes:
    from lib_gov_data import fetch  # noqa: E402 - network only when discovering
    html = fetch(ONET_PAGE).decode("utf-8", "replace")
    found = re.findall(r"(/dl_files/database/db_(\d+)_(\d+)_csv\.zip)", html)
    if not found:
        raise SystemExit("O*NET's database page names no CSV zip")
    path = max(found, key=lambda m: (int(m[1]), int(m[2])))[0]
    return fetch(ONET_HOST + path)


# ── DOL ──

PROGRAMS = ("perm", "pwd", "lca")


def read_dol(db: Database, log=print) -> tuple[dict[str, Counter], dict[str, dict], dict[str, Counter]]:
    """Filings per raw title and code, by program; the span each program covers; DOL's own code titles."""
    counts: dict[str, Counter] = {p: Counter() for p in PROGRAMS}
    spans: dict[str, dict] = {}
    code_titles: dict[str, Counter] = defaultdict(Counter)

    def take(program: str, sql: str, args: list) -> None:
        t = time.time()
        rows = rows_of(db.execute(sql, args))
        for title, soc, n in rows:
            s = soc7_of(soc)
            if s and (title or "").strip():
                counts[program][((title or "").strip().upper(), s)] += int(n or 0)
        log(f"  {program}: {len(rows):,} title and code pairs ({time.time() - t:.1f}s)")

    take("perm", "SELECT upper(trim(job_title)), substr(soc_code, 1, 7), count(*) FROM perm_cases GROUP BY 1, 2", [])
    lo, hi = rows_of(db.execute("SELECT min(decision_date), max(decision_date) FROM perm_cases"))[0]
    spans["perm"] = {"from": lo, "to": hi}
    for program, table in (("pwd", "pwd_cases"), ("lca", "lca_cases")):
        newest = int(rows_of(db.execute(f"SELECT max(fiscal_year) FROM {table}"))[0][0] or 0)
        first = newest - YEARS + 1
        spans[program] = {"fyFrom": first, "fyTo": newest}
        # One fiscal year a request, so no read is large.
        for fy in range(first, newest + 1):
            take(program, f"SELECT upper(trim(job_title)), substr(soc_code, 1, 7), count(*) FROM {table} "
                          "WHERE fiscal_year = ? GROUP BY 1, 2", [fy])
    for soc, title, n in rows_of(db.execute(
            "SELECT substr(soc_code, 1, 7), soc_title, count(*) FROM pwd_cases WHERE fiscal_year >= ? "
            "AND soc_title IS NOT NULL GROUP BY 1, 2", [spans["pwd"]["fyFrom"]])):
        s = soc7_of(soc)
        if s and (title or "").strip():
            code_titles[s][(title or "").strip()] += int(n or 0)
    return counts, spans, code_titles


# ── joining them ──

def build(dol: dict[str, Counter], onet: dict) -> tuple[list[list], dict[str, dict]]:
    """The table's rows, and per key its total and display title."""
    pair: dict[tuple[str, str], dict] = defaultdict(lambda: {"perm": 0, "pwd": 0, "lca": 0, "spell": Counter()})
    key_total: Counter = Counter()
    key_spell: dict[str, Counter] = defaultdict(Counter)
    for program in PROGRAMS:
        for (raw, soc), n in dol[program].items():
            key = title_key(raw)
            if not key:
                continue
            p = pair[(key, soc)]
            p[program] += n
            p["spell"][raw] += n
            key_total[key] += n
            key_spell[key][raw] += n

    onet_titles: dict[tuple[str, str], str] = onet["titles"]
    onet_by_key: dict[str, str] = {}
    for (key, _soc), t in onet_titles.items():
        onet_by_key.setdefault(key, t)

    def display(key: str) -> str:
        if key in onet_by_key:
            return onet_by_key[key]
        spellings = key_spell.get(key) or Counter()
        # The commonest spelling that IS the key (no "Senior", no "III"), else the commonest.
        bare = [(n, raw) for raw, n in spellings.items() if " ".join(base_words(raw)) == key]
        pick = max(bare)[1] if bare else (spellings.most_common(1)[0][0] if spellings else key)
        return nice_case(pick)

    rows: list[list] = []
    keys: dict[str, dict] = {}
    for (key, soc), p in pair.items():
        filings = p["perm"] + p["pwd"] + p["lca"]
        total = key_total[key]
        if total < KEY_MIN or filings < PAIR_MIN or filings < PAIR_SHARE * total:
            continue
        spell = [[raw, n] for raw, n in p["spell"].most_common(SPELLINGS_KEPT)]
        source = "both" if (key, soc) in onet_titles else "dol"
        rows.append([key, soc, display(key), source, filings, p["perm"], p["pwd"], p["lca"],
                     json.dumps(spell, separators=(",", ":"))])
        keys.setdefault(key, {"total": total, "title": display(key)})
    kept = {(r[0], r[1]) for r in rows}
    for (key, soc), t in onet_titles.items():
        if (key, soc) not in kept:
            rows.append([key, soc, onet_by_key.get(key, t), "onet", 0, 0, 0, 0, None])
            keys.setdefault(key, {"total": 0, "title": onet_by_key.get(key, t)})
    rows.sort(key=lambda r: (r[0], r[1]))
    return rows, keys


def code_list(rows: list[list], onet: dict, dol_code_titles: dict[str, Counter], slugs: dict[str, str]) -> list[list]:
    """Every code a row points at: [soc, title, zone, perm, pwd, lca, slug, titles]."""
    agg: dict[str, list[int]] = defaultdict(lambda: [0, 0, 0, 0])
    for r in rows:
        a = agg[r[1]]
        a[0] += r[5]
        a[1] += r[6]
        a[2] += r[7]
        a[3] += 1
    out = []
    for soc in sorted(agg):
        perm, pwd, lca, n = agg[soc]
        title = onet["code_titles"].get(soc) or (dol_code_titles[soc].most_common(1)[0][0] if dol_code_titles.get(soc) else soc)
        out.append([soc, title, onet["zones"].get(soc), perm, pwd, lca, slugs.get(soc), n])
    return out


def title_pages(keys: dict[str, dict]) -> list[list]:
    """[slug, title, filings] for every title with a page, busiest first."""
    pages = [[k.replace(" ", "-"), v["title"], v["total"]] for k, v in keys.items() if v["total"] >= PAGE_MIN]
    pages.sort(key=lambda p: (-p[2], p[0]))
    return pages


def occupation_slugs(db: Database) -> dict[str, str]:
    out: dict[str, str] = {}
    for code, slug in rows_of(db.execute("SELECT code, slug FROM perm_entities WHERE kind = 'occupation'")):
        s = soc7_of(code)
        if s and slug and s not in out:
            out[s] = slug
    return out


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--local", help="O*NET's CSV zip from disk")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args(argv)
    started = time.time()
    db = Database()
    try:
        zip_bytes = pathlib.Path(args.local).read_bytes() if args.local else discover_onet_zip()
        onet = onet_release(zip_bytes)
        print(f"O*NET {onet['release']}: {len(onet['titles']):,} title and code pairs, {len(onet['code_titles']):,} codes")
        dol, spans, dol_code_titles = read_dol(db)
        rows, keys = build(dol, onet)
        slugs = occupation_slugs(db)
        codes = code_list(rows, onet, dol_code_titles, slugs)
        pages = title_pages(keys)
        dol_keys = sum(1 for v in keys.values() if v["total"] > 0)
        print(f"{len(rows):,} rows over {len(keys):,} titles ({dol_keys:,} from DOL's files), "
              f"{len(codes):,} codes, {len(pages):,} titles with a page")
        if len(rows) < 1000 or len(pages) < 100:
            raise SystemExit(f"refusing to write: {len(rows)} rows and {len(pages)} pages is far under a normal build")
        if args.dry_run:
            for p in pages[:10]:
                print("  ", p)
            return 0
        from lib_reference import sync_rows  # noqa: E402
        for stmt in DDL:
            db.execute(stmt)
        got = sync_rows(db, TABLE, ["title_key", "soc7"], COLS, rows, pause_s=0.2)
        built = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        write_doc(db, DOC_CODES, {
            "builtAt": built, "onetRelease": onet["release"], "spans": spans,
            "counts": {"rows": len(rows), "titles": len(keys), "dolTitles": dol_keys, "codes": len(codes),
                       "pages": len(pages)},
            "pageMin": PAGE_MIN,
            "codes": codes,
        })
        write_doc(db, DOC_PAGES, {"builtAt": built, "pageMin": PAGE_MIN, "pages": pages})
        held = int(rows_of(db.execute(f"SELECT count(*) FROM {TABLE}"))[0][0] or 0)
        ok = held == len(rows)
        note = (f"{len(rows):,} rows ({got['written']:,} written, {got['deleted']:,} removed), "
                f"{len(pages):,} title pages, {len(codes):,} codes")
        print(("ok " if ok else "MISMATCH ") + note + f"; table holds {held:,}")
        record_run(db, SCRIPT, status="ok" if ok else "mismatch", rows_written=got["written"], note=note,
                   started_at=started)
        return 0 if ok else 1
    except SystemExit as e:
        if not args.dry_run:
            record_run(db, SCRIPT, status="failed", note=str(e)[:300], started_at=started)
        raise


if __name__ == "__main__":
    sys.exit(main())
