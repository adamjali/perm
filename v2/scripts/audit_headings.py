#!/usr/bin/env python3
"""Heading structure across every public page, read from the SITEMAP.

WHY THE SITEMAP AND NOT A LIST. A hand-kept list of pages saw 21 of 298 URLs
the last time one was written here, and the first run of THIS script - against
a list I typed from memory - reported `/compare-employers` and `/i140-trends`
as 404s. Both were my guesses; the real routes are `/perm-employers/compare`
and `/tools/i140-trends`, and both answer 200. A page nobody remembered is
exactly the page that breaks.

WHAT IT CHECKS, and why each one is worth a finding:

  h1 count      Exactly one. Zero leaves an extractor guessing the subject;
                several make it pick.
  duplicates    The same heading text twice on one page. Answer engines build
                "what is this about" from the outline, and a repeated H2 reads
                to a person as a navigation bug.
  level skips   h2 straight to h4. Assistive technology presents the outline as
                a tree, and a missing level is a broken branch.

Entity pages are sampled rather than walked: 78,600 of them share three
templates, so three of each says everything and the rest is load on the site.

    python3 scripts/audit_headings.py
    python3 scripts/audit_headings.py --base http://localhost:3100
"""
from __future__ import annotations

import argparse
import collections
import re
import sys
import urllib.request

HEADERS = {
    "User-Agent": "permtracker-audit/1.0",
    # Firewall rule 5 - without it a bare script is answered 429.
    "x-permtracker-audit": "1",
}

# One page is enough to judge a template, and these are the templated families.
TEMPLATED = ("/perm-employers/", "/perm-attorneys/", "/perm-wages/",
             "/perm-queue/", "/perm-rfi-audit/", "/blog/", "/guides/",
             "/changelog/")
SAMPLE_PER_TEMPLATE = 2

# Some repetition is the CONTENT, not a defect. A policy feed legitimately
# lists the same Federal Register notice title more than once, because DOL
# published it more than once.
ALLOW_DUPLICATES = {
    # A policy feed legitimately lists the same Federal Register notice title
    # more than once, because DOL published it more than once.
    "/policy-changes",
    # A legal policy repeats "What We Collect" / "Your Controls" / "Session
    # Replay" under each numbered vendor section, and the numbered <h2> above
    # each one disambiguates it for a reader. Checked entry by entry on
    # 2026-09-13: six duplicates, six different parent sections, all correct.
    # Qualifying them ("What We Collect (PostHog)") would be noise, not a fix.
    "/privacy",
}


def fetch(url: str) -> str | None:
    try:
        req = urllib.request.Request(url, headers=HEADERS)
        return urllib.request.urlopen(req, timeout=45).read().decode("utf-8", "replace")
    except Exception as e:  # noqa: BLE001
        print(f"  !! {url}: {e}", file=sys.stderr)
        return None


def detext(html: str) -> str:
    t = re.sub(r"<[^>]+>", " ", html)
    for a, b in (("&nbsp;", " "), ("&amp;", "&"), ("&#x27;", "'"),
                 ("&quot;", '"'), ("&lt;", "<"), ("&gt;", ">"), ("&#39;", "'")):
        t = t.replace(a, b)
    return " ".join(t.split())


def page_paths(base: str) -> list[str]:
    """Every static page, plus a sample of each templated family."""
    # RE-BASE EVERY URL, INCLUDING THE CHILD SITEMAPS.
    #
    # `.env.local` sets NEXT_PUBLIC_APP_URL=http://localhost:3000, so a local
    # server emits `http://localhost:3000/...` in every <loc> whatever port it
    # is actually listening on. Fetching the children by their absolute URL
    # therefore hit a dead port and the walk returned nothing - which the
    # minimum-pages guard caught, correctly, instead of reporting a clean site.
    def rebase(u: str) -> str:
        return base + (re.sub(r"^https?://[^/]+", "", u) or "/")

    index = fetch(f"{base}/sitemap.xml") or ""
    children = [rebase(u) for u in re.findall(r"<loc>([^<]+)</loc>", index)]
    locs: list[str] = []
    for child in children:
        xml = fetch(child)
        if xml:
            locs += re.findall(r"<loc>([^<]+)</loc>", xml)
    paths = sorted({re.sub(r"^https?://[^/]+", "", u) or "/" for u in locs})

    kept, seen = [], collections.Counter()
    for p in paths:
        fam = next((t for t in TEMPLATED if p.startswith(t)), None)
        if fam is None:
            kept.append(p)
            continue
        if seen[fam] < SAMPLE_PER_TEMPLATE:
            seen[fam] += 1
            kept.append(p)
    return kept


def headings(html: str) -> list[tuple[int, str]]:
    body = html[html.index("<body"):] if "<body" in html else html
    for tag in ("script", "style", "svg", "noscript", "template"):
        body = re.sub(rf"<{tag}\b[^>]*>[\s\S]*?</{tag}>", " ", body, flags=re.I)
    out = []
    for m in re.finditer(r"<h([1-6])\b[^>]*>([\s\S]*?)</h\1>", body):
        t = detext(m.group(2))
        if t:
            out.append((int(m.group(1)), t))
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="https://permtracker.app")
    ap.add_argument("--pages", nargs="*", default=None)
    args = ap.parse_args()
    base = args.base.rstrip("/")

    paths = args.pages or page_paths(base)
    # THE FLOOR GUARDS THE SITEMAP WALK, NOT AN EXPLICIT LIST. A walk that
    # returns three pages means the walk broke, and a near-empty scan reporting
    # "0 findings" is the exact shape of a gate that has gone blind. Checking
    # one page by name on purpose is not that, and the first version refused to
    # do it.
    if args.pages is None and len(paths) < 20:
        print(f"FAIL: the sitemap walk found only {len(paths)} pages. That is "
              "a defect in this script or in the sitemap, not a clean site.")
        return 2

    print(f"scanning {len(paths)} pages\n")
    findings = 0
    scanned = 0
    for p in paths:
        html = fetch(base + p)
        if html is None:
            findings += 1
            print(f"{p}\n    - UNREACHABLE")
            continue
        scanned += 1
        hs = headings(html)
        msgs = []

        h1s = [t for lvl, t in hs if lvl == 1]
        if len(h1s) != 1:
            msgs.append(f"h1 count is {len(h1s)}: {h1s[:3]}")

        if p not in ALLOW_DUPLICATES:
            counts = collections.Counter(t.lower() for _, t in hs)
            dups = sorted(t for t, n in counts.items() if n > 1)
            if dups:
                msgs.append(f"duplicate headings: {dups[:4]}")

        prev = None
        skips = []
        for lvl, t in hs:
            if prev is not None and lvl > prev + 1:
                skips.append(f"h{prev}->h{lvl} before {t[:38]!r}")
            prev = lvl
        if skips:
            msgs.append(f"level skips: {skips[:2]}")

        if msgs:
            findings += 1
            print(p)
            for m in msgs:
                print(f"    - {m}")

    # A CONTROL, so a blind run cannot read as a clean one.
    probe = headings("<body><h1>a</h1><h2>b</h2><h2>b</h2><h4>c</h4></body>")
    assert len(probe) == 4, "the heading parser stopped seeing headings"

    print(f"\n{scanned} pages scanned, {findings} with a finding")
    return 1 if findings else 0


if __name__ == "__main__":
    raise SystemExit(main())
