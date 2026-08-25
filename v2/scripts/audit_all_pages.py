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
import sys
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
DATA_PAGES = {
    "/perm-by-state": "45,727",
    "/perm-wages": "139,464",
    "/perm-employers": "Microsoft",
    "/perm-attorneys": "Fragomen",
    "/perm-denial-risk": "2.57",
    "/perm-processing-times": "DOL",
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

    if path in DATA_PAGES:
        if EMPTY_STATE in html:
            out.append(f"{path}: RENDERING ITS EMPTY STATE - data pipeline broken")
        # Case-insensitive: DOL prints whatever the filer typed, so the
        # display name for a merged entity is whichever spelling had the most
        # cases - often all caps. A case-sensitive check called a correct
        # page broken.
        elif DATA_PAGES[path].lower() not in html.lower():
            out.append(f"{path}: expected live figure {DATA_PAGES[path]!r} absent")

    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="https://permtracker.app")
    ap.add_argument("--limit", type=int, default=0, help="audit only the first N URLs")
    args = ap.parse_args()

    print(f"target        : {args.base}")
    status, sm = get(args.base.rstrip("/") + "/sitemap.xml")
    if status != 200:
        sys.exit(f"FATAL: sitemap.xml returned {status}; nothing to audit")
    locs = re.findall(r"<loc>(.*?)</loc>", sm)
    paths = []
    for loc in locs:
        p = re.sub(r"^https?://[^/]+", "", loc) or "/"
        paths.append(p)
    if not paths:
        sys.exit("FATAL: sitemap parsed to zero URLs; the audit can see nothing")
    if args.limit:
        paths = paths[: args.limit]
    print(f"urls in sitemap: {len(locs)}")
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
