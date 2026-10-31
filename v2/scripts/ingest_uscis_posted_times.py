#!/usr/bin/env python3
"""USCIS's posted processing times, every posting since March 2022: `uscis_posted_times`.

WHAT IT IS. USCIS's processing-times page prints, per form, per subtype and per office, the time it took to
decide 80% of the cases it decided in the past six months (its own definition since at least Jan 2024; earlier
postings were a range whose lower end this keeps, see below), and the receipt date of a case that may now ask about
its own. USCIS posts new figures about once a month and keeps no history of its own.

WHERE. egov.uscis.gov answers every script from any address with a Cloudflare challenge, and this site never gets
past a challenge. An open-source project on GitHub, jzebedee/uscis, saves USCIS's page every day and publishes it
as a SQLite file (one GitHub release a day, back to March 21 2022). That project reaches the page with a curl build
that imitates Chrome and saved browser cookies; the owner chose to use its published files knowing that (Oct 31
2026), and this site does none of that itself. The figures are USCIS's, which no one can own (17 U.S.C. 105); the
project carries no licence for its code, none of which is used here. Pages that show these figures credit it.

The owner's hand reading of USCIS's page in a real browser (weekly, `.planning/uscis-times-readings.md`) is the
check: on Oct 31 2026 all eight I-140 figures matched this file exactly. The site's typed fallback figures
(`src/lib/processing-times/i140ProcessingTimes.ts`) are compared with the newest posting on every run, and a
difference is a warning naming each code.

HOW A ROW IS KEPT. One row per (form, subtype, office, USCIS's posting date), with the first and last day the
project's files carried it. A daily file that repeats a posting changes nothing but `last_seen`. A file that can't
be read (not SQLite, no table, too few rows) is recorded as unreadable and skipped; it never removes a row.

  posted        months, the figure USCIS's page prints (the project's `range_lower`; Oct 31 2026: the eight I-140
                figures the owner read on the page equal it, 8 of 8)
  posted_text   that figure as stored ("32.5 Months", "15 Days", "See notes")
  second        months, the project's `range_upper`, kept and not shown: USCIS's page prints one figure now, and
                what the second one is today isn't stated anywhere USCIS publishes
  request_date  the receipt date before which a case may ask USCIS about itself (ISO)

Usage:
    python3 scripts/ingest_uscis_posted_times.py              # newest releases not yet loaded (daily)
    python3 scripts/ingest_uscis_posted_times.py --backfill   # every release back to 2022 (once)
    python3 scripts/ingest_uscis_posted_times.py --dry-run    # read, write nothing
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import pathlib
import re
import sqlite3
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from lib_db import Database, insert_rows, query_rows, record_run, run_stmts, stamp_freshness, stmt, write_doc  # noqa: E402

SCRIPT = "ingest_uscis_posted_times.py"
DATASET = "uscis-posted-times"
SOURCE = "USCIS processing-times page, daily copies by the jzebedee/uscis project (GitHub)"
PROJECT = "https://github.com/jzebedee/uscis"
RELEASES = "https://api.github.com/repos/jzebedee/uscis/releases"
UA = "PERMTracker/1.0 (+https://permtracker.app; support@permtracker.app)"
TABLE = "uscis_posted_times"
LOADED = "uscis_posted_releases"
DOC = "uscis_posted_times"
# A day's file holds about 490 rows across 40-odd forms (Oct 31 2026); March 2022's held about 430.
MIN_ROWS = 150
PAUSE_S = 0.25
# The daily run reads the newest page of releases; a gap longer than that (100 days) needs --backfill.
DAILY_PAGES = 1
# The doc carries the history of the two forms the site draws, at national offices only (Service Center Operations,
# the service centers, the National Benefits Center and "All Field Offices"); every form and field office stays in the
# table. With every form and field office the doc was 593 KB (Oct 31 2026); with these, 150 KB. I-140 is posted
# under Service Center Operations (SCD) from Sep 5 2025 and under the Nebraska and Texas centers (NSC, SSC) before,
# so each office is its own line.
SERIES_FORMS = ("I-140", "I-485")
SERIES_OFFICES = ("SCD", "FOD", "NBC", "NSC", "SSC", "CSC", "ESC", "YSC", "VSC", "TSC", "PSC")
# The site's typed fallback figures, compared with the newest posting each run.
HAND_FILE = pathlib.Path(__file__).resolve().parent.parent / "src/lib/processing-times/i140ProcessingTimes.ts"
HAND_RE = re.compile(r'code:\s*"([A-Z0-9]+)"[^}]*?months80:\s*([\d.]+)')

COLS = ["form", "subtype", "office", "published", "posted", "posted_text", "second", "second_text",
        "request_date", "first_seen", "last_seen"]
DDL = [
    f"""CREATE TABLE IF NOT EXISTS {TABLE} (
        form TEXT NOT NULL, subtype TEXT NOT NULL, office TEXT NOT NULL, published TEXT NOT NULL,
        posted REAL, posted_text TEXT, second REAL, second_text TEXT, request_date TEXT,
        first_seen TEXT, last_seen TEXT,
        PRIMARY KEY (form, subtype, office, published))""",
    f"CREATE INDEX IF NOT EXISTS uscis_posted_times_published ON {TABLE} (published)",
    f"""CREATE TABLE IF NOT EXISTS {LOADED} (
        tag TEXT PRIMARY KEY, published TEXT, rows INTEGER, status TEXT, loaded_at INTEGER)""",
    """CREATE TABLE IF NOT EXISTS uscis_posted_labels (
        kind TEXT NOT NULL, code TEXT NOT NULL, form TEXT NOT NULL DEFAULT '', label TEXT,
        PRIMARY KEY (kind, code, form))""",
]
DAYS_PER_MONTH = 365.25 / 12
UNIT_MONTHS = {"month": 1.0, "months": 1.0, "week": 7 / DAYS_PER_MONTH, "weeks": 7 / DAYS_PER_MONTH,
               "day": 1 / DAYS_PER_MONTH, "days": 1 / DAYS_PER_MONTH}


def log(msg: str) -> None:
    print(f"[uscis-posted] {msg}", flush=True)


def iso(text: str | None) -> str | None:
    """'October 19, 2026' -> '2026-10-19'; anything else -> None, never a guess."""
    t = (text or "").strip()
    for fmt in ("%B %d, %Y", "%b %d, %Y", "%Y-%m-%d"):
        try:
            return dt.datetime.strptime(t, fmt).date().isoformat()
        except ValueError:
            pass
    return None


def months(value, unit) -> float | None:
    """A posted figure in months, or None for 'See notes', 'learn more.' or a blank."""
    if value is None or value == "":
        return None
    factor = UNIT_MONTHS.get(str(unit or "").strip().lower())
    if factor is None:
        return None
    try:
        return round(float(value) * factor, 2)
    except (TypeError, ValueError):
        return None


def text_of(value, unit) -> str | None:
    if value is None or value == "":
        return str(unit).strip() or None if unit else None
    v = float(value)
    shown = str(int(v)) if v.is_integer() else str(v)
    return f"{shown} {str(unit or '').strip()}".strip()


def get_json(url: str):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/vnd.github+json"})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                return json.loads(r.read())
        except urllib.error.HTTPError as e:
            if e.code in (403, 429, 500, 502, 503, 504) and attempt < 3:
                time.sleep(15 * (attempt + 1))
                continue
            raise
        except (urllib.error.URLError, TimeoutError):
            if attempt < 3:
                time.sleep(15 * (attempt + 1))
                continue
            raise
    raise RuntimeError("unreachable")


def releases(pages: int | None) -> list[tuple[str, str]]:
    """(tag, download URL) for each daily release, newest first.

    The daily run asks GitHub's release list (its newest 100). The full load reads git's own tag list instead:
    GitHub's release list stops at 1,000 entries (page 11 answered 422, Oct 31 2026), and the project holds 1,642.
    Every one of the first 1,000 releases carries one asset named `<tag>.db`, so a tag's file is at that name; a tag
    without one answers 404 and is recorded as missing.
    """
    if pages is None:
        out = subprocess.run(["git", "ls-remote", "--tags", PROJECT + ".git"], capture_output=True, text=True,
                             timeout=120, check=True).stdout
        tags = sorted({line.rsplit("/", 1)[-1].removesuffix("^{}") for line in out.splitlines() if "refs/tags/" in line},
                      reverse=True)
        return [(t, f"{PROJECT}/releases/download/{t}/{t}.db") for t in tags if re.fullmatch(r"\d{4}-\d{2}-\d{2}", t)]
    out_list: list[tuple[str, str]] = []
    for page in range(1, pages + 1):
        batch = get_json(f"{RELEASES}?per_page=100&page={page}")
        if not batch:
            break
        for rel in batch:
            tag = str(rel.get("tag_name") or "")
            asset = next((a for a in rel.get("assets") or [] if str(a.get("name", "")).endswith(".db")), None)
            if re.fullmatch(r"\d{4}-\d{2}-\d{2}", tag) and asset:
                out_list.append((tag, str(asset["browser_download_url"])))
        time.sleep(PAUSE_S)
    return out_list


def download(url: str, dest: pathlib.Path) -> None:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                dest.write_bytes(r.read())
            return
        except urllib.error.HTTPError as e:
            if e.code == 404:
                raise ValueError("no file for this tag (404)") from e
            if attempt == 3:
                raise
            time.sleep(10 * (attempt + 1))
        except (urllib.error.URLError, TimeoutError):
            if attempt == 3:
                raise
            time.sleep(10 * (attempt + 1))


def read_release(path: pathlib.Path, tag: str) -> tuple[list[list], dict[tuple[str, str, str], str], str | None]:
    """The file's rows in COLS order, its labels, and its posting date. Raises ValueError for an unreadable file."""
    head = path.read_bytes()[:16]
    if not head.startswith(b"SQLite format 3"):
        raise ValueError("not a SQLite file")
    con = sqlite3.connect(f"file:{path}?mode=ro", uri=True)
    try:
        tables = {r[0] for r in con.execute("SELECT name FROM sqlite_master WHERE type='table'")}
        if "processing_time" not in tables:
            raise ValueError("no processing_time table")
        rows = con.execute(
            "SELECT form_name, form_subtype, office_code, publication_date, range_lower, range_lower_unit, "
            "range_upper, range_upper_unit, service_request_date FROM processing_time").fetchall()
        labels: dict[tuple[str, str, str], str] = {}
        if "form_types" in tables:
            for form, key, desc in con.execute("SELECT form_name, form_key, description_en FROM form_types"):
                if desc:
                    labels[("subtype", str(key), str(form))] = " ".join(str(desc).split())
        if "forms" in tables:
            for name, desc in con.execute("SELECT name, description_en FROM forms"):
                if desc:
                    labels[("form", str(name), "")] = " ".join(str(desc).split())
        if "offices" in tables:
            for code, desc in con.execute("SELECT code, description FROM offices"):
                if desc:
                    labels[("office", str(code), "")] = " ".join(str(desc).split())
    finally:
        con.close()
    if len(rows) < MIN_ROWS:
        raise ValueError(f"{len(rows)} rows, under {MIN_ROWS}")
    if not any(r[0] == "I-140" for r in rows):
        raise ValueError("no I-140 rows")
    out: list[list] = []
    dates: dict[str, int] = {}
    for form, sub, office, pub, lo, lo_u, hi, hi_u, req in rows:
        published = iso(pub)
        if not (form and sub and office and published):
            continue
        dates[published] = dates.get(published, 0) + 1
        out.append([str(form), str(sub), str(office), published, months(lo, lo_u), text_of(lo, lo_u),
                    months(hi, hi_u), text_of(hi, hi_u), iso(req), tag, tag])
    if not out:
        raise ValueError("no row with a form, subtype, office and posting date")
    main = max(dates, key=lambda d: dates[d])
    return out, labels, main


def merge(into: dict[tuple, list], rows: list[list]) -> None:
    """Fold one day's rows into the run's: one row per posting, its first and last day seen, the newest copy's figures."""
    for r in rows:
        key = (r[0], r[1], r[2], r[3])
        held = into.get(key)
        if held is None:
            into[key] = list(r)
            continue
        first, last = min(held[9], r[9]), max(held[10], r[10])
        if r[10] >= held[10]:
            held[:9] = r[:9]
        held[9], held[10] = first, last


def upsert(db: Database, rows: list[list]) -> None:
    """Write the run's postings, many to a statement (the cost is per statement)."""
    mark = "(" + ",".join("?" * len(COLS)) + ")"
    tail = (" ON CONFLICT(form, subtype, office, published) DO UPDATE SET "
            "first_seen = MIN(first_seen, excluded.first_seen), last_seen = MAX(last_seen, excluded.last_seen), "
            # A posting's figures are USCIS's; a later copy of the same posting wins if USCIS corrected it that day.
            + ", ".join(f"{c} = CASE WHEN excluded.last_seen >= last_seen THEN excluded.{c} ELSE {c} END"
                        for c in ("posted", "posted_text", "second", "second_text", "request_date")))
    per = 250
    stmts = (stmt(f"INSERT INTO {TABLE} ({', '.join(COLS)}) VALUES " + ",".join([mark] * len(rows[i:i + per])) + tail,
                  [v for row in rows[i:i + per] for v in row])
             for i in range(0, len(rows), per))
    run_stmts(db, stmts, per_request=4)


def hand_figures() -> dict[str, float]:
    try:
        return {code: float(v) for code, v in HAND_RE.findall(HAND_FILE.read_text())}
    except OSError:
        return {}


def build_doc(db: Database, newest_tag: str | None) -> dict:
    """What the site reads: the newest posting of every row, and each drawn form's history."""
    rows = query_rows(db, f"SELECT {', '.join(COLS)} FROM {TABLE} ORDER BY published")
    labels = {(k, c, f): label for k, c, f, label in query_rows(db, "SELECT kind, code, form, label FROM uscis_posted_labels")}
    postings = sorted({r[3] for r in rows})
    newest_pub = postings[-1] if postings else None
    current = [r for r in rows if r[3] == newest_pub]
    newest = [{"form": r[0], "subtype": r[1], "office": r[2], "posted": r[4], "postedText": r[5],
               "requestDate": r[8], "label": labels.get(("subtype", r[1], r[0])),
               "officeLabel": labels.get(("office", r[2], ""))} for r in current]
    series: dict[str, dict] = {}
    for r in rows:
        if r[0] not in SERIES_FORMS or r[2] not in SERIES_OFFICES or r[4] is None:
            continue
        key = f"{r[0]}|{r[1]}|{r[2]}"
        s = series.setdefault(key, {"form": r[0], "subtype": r[1], "office": r[2],
                                    "label": labels.get(("subtype", r[1], r[0])),
                                    "officeLabel": labels.get(("office", r[2], "")), "points": []})
        s["points"].append([r[3], r[4]])
    gaps = [(dt.date.fromisoformat(b) - dt.date.fromisoformat(a)).days for a, b in zip(postings, postings[1:])]
    hand = hand_figures()
    i140 = {r[1].split("-")[-1]: r[4] for r in current if r[0] == "I-140"}
    differs = [f"{code} typed {v:g}, posted {i140[code]:g}" for code, v in sorted(hand.items())
               if code in i140 and i140[code] is not None and abs(i140[code] - v) > 0.01]
    missing = sorted(code for code in hand if code not in i140)
    return {
        "source": SOURCE, "project": PROJECT, "newestRelease": newest_tag, "published": newest_pub,
        "postings": postings, "longestGapDays": max(gaps) if gaps else None, "newest": newest,
        "series": list(series.values()),
        "handCheck": {"compared": len(hand), "differs": differs, "missing": missing},
    }


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--backfill", action="store_true", help="read every release back to 2022")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--limit", type=int, default=0, help="read at most this many new releases")
    args = ap.parse_args()
    started = time.time()
    db = Database()
    try:
        if not args.dry_run:
            for ddl in DDL:
                db.execute(ddl)
        try:
            # A file read, or one the project never published (404), is done. Any other unreadable file (an error
            # page served in its place, a cut download) is asked for again the next time a listing names it.
            done = {str(t) for (t,) in query_rows(
                db, f"SELECT tag FROM {LOADED} WHERE status = 'ok' OR status LIKE 'unreadable: no file%'")}
        except RuntimeError as exc:
            if "no such table" not in str(exc).lower():
                raise
            done = set()
        listed = releases(None if args.backfill else DAILY_PAGES)
        if not listed:
            raise RuntimeError("GitHub listed no releases for the project")
        newest_tag = listed[0][0]
        todo = [(t, u) for t, u in reversed(listed) if t not in done]
        if args.limit:
            todo = todo[:args.limit]
        log(f"{len(listed):,} releases listed, newest {newest_tag}; {len(todo):,} to read")
        loaded = unreadable = rows_seen = 0
        all_labels: dict[tuple[str, str, str], str] = {}
        merged: dict[tuple, list] = {}
        done_rows: list[list] = []
        with tempfile.TemporaryDirectory(prefix="uscis-posted-") as tmp:
            for tag, url in todo:
                path = pathlib.Path(tmp) / f"{tag}.db"
                try:
                    download(url, path)
                    rows, labels, pub = read_release(path, tag)
                except ValueError as exc:
                    unreadable += 1
                    print(f"::warning::{tag}: {exc}; skipped", flush=True)
                    done_rows.append([tag, None, 0, f"unreadable: {exc}"[:200], int(time.time() * 1000)])
                    continue
                finally:
                    path.unlink(missing_ok=True)
                all_labels.update(labels)
                rows_seen += len(rows)
                loaded += 1
                merge(merged, rows)
                done_rows.append([tag, pub, len(rows), "ok", int(time.time() * 1000)])
                if loaded % 50 == 0:
                    log(f"{loaded:,} read, through {tag} (posting {pub})")
                time.sleep(PAUSE_S)
        postings = sorted({k[3] for k in merged})
        log(f"{loaded:,} read, {unreadable:,} unreadable; {rows_seen:,} rows fold into {len(merged):,} "
            f"({len(postings):,} postings: {postings[0] if postings else '-'} to {postings[-1] if postings else '-'})")
        if args.dry_run:
            return 0
        if merged:
            upsert(db, list(merged.values()))
        if all_labels:
            insert_rows(db, "uscis_posted_labels", ["kind", "code", "form", "label"],
                        [[k, c, f, v] for (k, c, f), v in all_labels.items()])
        # Releases are marked read only once their rows are written, so a failed write is read again next run.
        if done_rows:
            insert_rows(db, LOADED, ["tag", "published", "rows", "status", "loaded_at"], done_rows)
        doc = build_doc(db, newest_tag)
        if not doc["published"]:
            raise RuntimeError("no posting held after the load")
        write_doc(db, DOC, doc)
        lag = (dt.date.today() - dt.date.fromisoformat(newest_tag)).days
        notes = [f"{loaded:,} releases read ({unreadable:,} unreadable); newest posting {doc['published']}, "
                 f"{len(doc['postings']):,} postings held"]
        if lag > 4:
            # The project's own run stopped: a source that has gone quiet, not our failure (the budget below alarms).
            print(f"::warning::the project's newest daily file is {newest_tag}, {lag} days old", flush=True)
            notes.append(f"the project's newest file is {lag} days old")
        if doc["handCheck"]["differs"]:
            print(f"::warning::typed I-140 figures differ from USCIS's newest posting: "
                  f"{'; '.join(doc['handCheck']['differs'])}", flush=True)
            notes.append("typed I-140 figures differ: " + "; ".join(doc["handCheck"]["differs"]))
        note = "; ".join(notes)
        # USCIS's own gaps between postings, measured (the longest since 2022), with room: past it, the page or the
        # project has stopped.
        budget = max(45, int((doc["longestGapDays"] or 30) * 1.5))
        stamp_freshness(db, DATASET, as_of=doc["published"], source=SOURCE,
                        cadence="USCIS posts about monthly; the project copies it daily; read daily",
                        note=note, max_age_days=budget)
        record_run(db, SCRIPT, status="ok", rows_written=rows_seen, note=note, started_at=started)
        log(note)
        return 0
    except Exception as exc:  # noqa: BLE001 - recorded, then raised
        if not args.dry_run:
            record_run(db, SCRIPT, status="failed", note=str(exc)[:300], started_at=started)
        raise


if __name__ == "__main__":
    sys.exit(main())
