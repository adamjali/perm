#!/usr/bin/env python3
"""Audit every public URL: status, title, description, data presence, glue.

Reads the sitemap rather than a hand-kept list, because a page nobody
remembered is exactly the page that breaks. Prints its target and its counts
BEFORE any verdict, and fails loudly when it found nothing to inspect - a
checker that cannot see its subject reads exactly like a pass.

    python3 scripts/audit_all_pages.py --base https://permtracker.app
    python3 scripts/audit_all_pages.py --base http://127.0.0.1:3100 --limit 40
"""
from __future__ import annotations

import argparse
import html as html_mod
import re
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib_sitemap_sample import describe_sampling, sample_by_shape  # noqa: E402
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor

UA = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36"
}

# A description past this is truncated mid-sentence in the SERP.
DESC_MAX = 155
DESC_MIN = 70
TITLE_MAX = 62

# Pages whose whole job is live figures. If one of these renders its empty
# state, the data pipeline is broken and the page is lying by omission.
#
# Values are REGEXES for the SHAPE of the expected figure, not the figure
# itself. Pinning the literal value means the gate fails every time DOL
# publishes: adding FY2024 moved the occupation median from $139,464 to
# $139,128 and the audit called a correct page broken. A shape still catches
# the thing this is for, which is a page rendering zeros or its empty state,
# and it does not cry wolf once a quarter.
DATA_PAGES = {
    # A five- or six-figure filing count with a thousands separator.
    "/perm-by-state": r"\d{2,3},\d{3}",
    # A six-figure annual wage.
    "/perm-wages": r"\$1\d{2},\d{3}",
    "/perm-employers": r"Microsoft",
    "/perm-attorneys": r"Fragomen",
    # A denial rate printed to two decimals.
    "/perm-denial-risk": r"\d\.\d{2}%",
    "/perm-processing-times": r"DOL",
}
EMPTY_STATE = "aggregates land with the quarterly"


def get(url: str, timeout: int = 30) -> tuple[int, str]:
    try:
        req = urllib.request.Request(url, headers=UA)
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, r.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        return e.code, ""
    except Exception as e:  # noqa: BLE001
        return 0, str(e)


def text_of(html: str) -> str:
    """Visible-ish text: drop script/style, unescape the few entities we emit."""
    h = re.sub(r"<(script|style)\b[^>]*>.*?</\1>", " ", html, flags=re.S | re.I)
    h = re.sub(r"<[^>]+>", "", h)
    return re.sub(r"\s+", " ", h)



def prose_em_dashes(html: str) -> list[str]:
    """
    Em-dashes used as PROSE punctuation, which house style bans.

    A lone "—" in a table cell is the standard no-value marker and is fine;
    the rule is about the writing tell, not the character, and flagging a null
    marker just teaches people to rule-lawyer the glyph instead of fixing
    sentences. So the test is whether the dash shares a text run with words.

    Working on tag-stripped text cannot tell the two apart (a stripped row
    reads "Software Developers 57,876 — 94.6%"), and requiring no tag beside
    the dash misses prose that spans an inline link. Both were tried. This
    reads the innermost text run instead: everything between the nearest ">"
    before the dash and the nearest "<" after it.
    """
    body = re.sub(r"<(script|style)\b[^>]*>.*?</\1>", " ", html, flags=re.S | re.I)
    hits: list[str] = []
    for m in re.finditer("\u2014", body):
        left = body.rfind(">", 0, m.start()) + 1
        right = body.find("<", m.end())
        if right == -1:
            right = len(body)
        run = html_mod.unescape(body[left:right])
        # The run is the dash and nothing else: a no-value cell, not prose.
        if run.strip().strip("\u2014").strip() == "":
            continue
        hits.append(re.sub(r"\s+", " ", run).strip()[:80])
    return hits


def audit(base: str, path: str) -> list[str]:
    url = base.rstrip("/") + path
    status, html = get(url)
    out: list[str] = []
    if status != 200:
        return [f"{path}: HTTP {status}"]

    m = re.search(r"<title>(.*?)</title>", html, re.S)
    title = html_mod.unescape(m.group(1)).strip() if m else ""
    if not title:
        out.append(f"{path}: no <title>")
    elif len(title) > TITLE_MAX + 20:  # the " | PERM Tracker" suffix is free
        out.append(f"{path}: title {len(title)} chars")

    # Capture the opening quote and backreference it: a negated class that
    # excludes the apostrophe truncates our own contraction-heavy copy.
    d = re.search(r'<meta name="description" content=(["\'])(.*?)\1', html, re.S)
    if not d:
        out.append(f"{path}: no meta description")
    else:
        # Decode first: the raw attribute carries &#x27; for every apostrophe,
        # which is six characters where the reader and Google see one. An
        # earlier version measured the raw string and reported a 150-character
        # description as 160 - it made real copy look broken because our house
        # style is contraction-heavy.
        desc = html_mod.unescape(d.group(2)).strip()
        if len(desc) > DESC_MAX:
            out.append(f"{path}: description {len(desc)} chars (>{DESC_MAX})")
        elif len(desc) < DESC_MIN:
            out.append(f"{path}: description only {len(desc)} chars")

    if not re.search(r"<h1[^>]*>", html):
        out.append(f"{path}: no <h1>")
    elif len(re.findall(r"<h1[^>]*>", html)) > 1:
        out.append(f"{path}: {len(re.findall(r'<h1[^>]*>', html))} <h1> elements")

    if not re.search(r'rel="canonical"', html):
        out.append(f"{path}: no canonical")

    # House style bans the em-dash in visible copy. Checked on the RENDERED
    # page rather than in source, because source carries them in comments and
    # in generated strings, and only what a reader sees is the violation.
    # Measured on 39 live pages the day this was added: 21 across 8 pages.
    for hit in prose_em_dashes(html):
        out.append(f"{path}: em-dash in prose -> '{hit}'")

    if path in DATA_PAGES:
        if EMPTY_STATE in html:
            out.append(f"{path}: RENDERING ITS EMPTY STATE - data pipeline broken")
        # Case-insensitive: DOL prints whatever the filer typed, so the
        # display name for a merged entity is whichever spelling had the most
        # cases - often all caps. A case-sensitive check called a correct
        # page broken.
        elif not re.search(DATA_PAGES[path], html, re.I):
            out.append(
                f"{path}: no live figure matching {DATA_PAGES[path]!r}"
            )

    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="https://permtracker.app")
    ap.add_argument("--limit", type=int, default=0, help="audit only the first N URLs")
    ap.add_argument(
        "--per-shape",
        type=int,
        default=3,
        help="URLs to audit per route template (0 = every URL, slow)",
    )
    args = ap.parse_args()

    print(f"target        : {args.base}")
    status, sm = get(args.base.rstrip("/") + "/sitemap.xml")
    if status != 200:
        sys.exit(f"FATAL: sitemap.xml returned {status}; nothing to audit")

    # /sitemap.xml is a sitemap INDEX now, not a urlset. Following it matters
    # more than it looks: an index yields 7 <loc> values, all of them sitemap
    # files, and this audit would happily check those 7 and print "urls in
    # sitemap: 7" as though it had covered the site. A gate that cannot see
    # its subject reads exactly like a pass.
    if "<sitemapindex" in sm:
        children = re.findall(r"<loc>(.*?)</loc>", sm)
        print(f"sitemap index : {len(children)} child sitemaps")
        locs = []
        for child in children:
            cs, cbody = get(re.sub(r"^https?://[^/]+", "", child) or "/")
            if cs != 200:
                sys.exit(f"FATAL: child sitemap {child} returned {cs}")
            found = re.findall(r"<loc>(.*?)</loc>", cbody)
            print(f"  {child.rsplit('/', 1)[-1]:24s} {len(found):>6,} urls")
            locs.extend(found)
    else:
        locs = re.findall(r"<loc>(.*?)</loc>", sm)

    paths = []
    for loc in locs:
        p = re.sub(r"^https?://[^/]+", "", loc) or "/"
        paths.append(p)
    if not paths:
        sys.exit("FATAL: sitemap parsed to zero URLs; the audit can see nothing")
    print(f"urls in sitemap: {len(locs)}")
    # Sample by TEMPLATE, not by position. `--limit N` takes the first N, and
    # since the sitemap emits 12,240 employer URLs before anything else, a
    # positional cut audits one component 500 times and every other page zero
    # times. That reads as broad coverage and is the opposite.
    if args.per_shape > 0:
        paths, sizes = sample_by_shape(paths, args.per_shape)
        for line in describe_sampling(sizes, args.per_shape):
            print(line)
    if args.limit:
        paths = paths[: args.limit]
    print(f"urls audited   : {len(paths)}")

    findings: list[str] = []
    with ThreadPoolExecutor(max_workers=6) as pool:
        for res in pool.map(lambda p: audit(args.base, p), paths):
            findings.extend(res)

    print(f"findings       : {len(findings)}\n")
    for f in sorted(findings):
        print("  " + f)
    return 1 if findings else 0


if __name__ == "__main__":
    sys.exit(main())
