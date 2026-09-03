#!/usr/bin/env python3
"""Every internal link, and whether it goes where its own words say.

WHY. Adam clicked something labelled "processing time" on the homepage and
landed on the timeline CALCULATOR, not the processing-times data page. A 404
checker would have passed that link: it resolves, it is just not what it says.

So this checks two different things, and the second is the one that matters:

  1. RESOLVES.  Every internal href returns 200 on the live site.
  2. AGREES.    The link's own text is consistent with the destination page's
                <h1> and <title>. A link reading "Current processing times"
                that lands on a page titled "PERM Processing Times in 2026:
                What to Expect" is a blog post wearing a data page's label.

The second check is fuzzy by nature, so it reports SUSPECT rather than FAIL
and prints both sides for a human to judge. A gate that cried wolf about
wording would be ignored within a week; this one is meant to be read.

  python3 scripts/audit_internal_links.py --base https://permtracker.app
"""
import argparse
import html
import re
import sys
import urllib.request
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor

# A LABEL THAT NAMES A TOPIC IS A PROMISE ABOUT THE DESTINATION.
#
# The first version of this check compared the link's words against the target
# page's h1 and flagged anything without overlap. That produced 342 findings
# over 1,458 links and almost all were noise: a case number as link text, "full
# A-Z index" pointing at "Browse law firms A to Z", "How every figure is built"
# pointing at "How these numbers are computed". All correct links.
#
# So it checks the opposite direction instead, and only for phrases that carry a
# real topical claim. If a link says "processing times" it has to go to the
# processing-times page, not to the calculator index. Nothing else is flagged,
# which is why the output is short enough to read.
TOPICS: dict[str, set[str]] = {
    "processing time": {"/perm-processing-times"},
    "processing times": {"/perm-processing-times"},
    "visa bulletin": {"/tools/priority-date-calculator", "/guides/how-the-visa-bulletin-works"},
    "prevailing wage request": {"/pwd-cases", "/tools/pwd-calculator"},
    "wage request": {"/pwd-cases", "/tools/pwd-calculator"},
    "case status": {"/perm-case-status"},
    "denial rate": {"/perm-denial-risk"},
    "denial rates": {"/perm-denial-risk"},
    "methodology": {"/methodology"},
    "queue": set(),          # too many honest homes; skip
}

STOP = {
    "the", "a", "an", "and", "or", "of", "to", "in", "on", "for", "is", "it",
    "this", "that", "your", "you", "our", "we", "here", "page", "see", "read",
    "more", "all", "every", "what", "how", "why", "when", "where", "own",
    "with", "from", "by", "at", "as", "its", "their", "one", "can", "does",
    "view", "open", "check", "find", "go", "back", "next", "learn", "about",
}


def words(s: str) -> set[str]:
    """Substantive words only, so a label's shape can be compared to a title."""
    return {w for w in re.findall(r"[a-z0-9]+", s.lower()) if w not in STOP and len(w) > 2}


def fetch(url: str, timeout: int = 45) -> str | None:
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "permtracker-link-audit"})
        return urllib.request.urlopen(req, timeout=timeout).read().decode("utf8", "ignore")
    except Exception:
        return None


def strip_noise(h: str) -> str:
    return re.sub(r"(?is)<(script|style|noscript|template|svg)[^>]*>.*?</\1>", " ", h)


def page_identity(h: str) -> tuple[str, str]:
    """The page's own claim about what it is: its h1 and its <title>."""
    body = strip_noise(h)
    h1 = re.search(r"(?is)<h1[^>]*>(.*?)</h1>", body)
    ti = re.search(r"(?is)<title[^>]*>(.*?)</title>", h)
    clean = lambda s: re.sub(r"\s+", " ", html.unescape(re.sub(r"(?s)<[^>]+>", " ", s))).strip()
    return (clean(h1.group(1)) if h1 else "", clean(ti.group(1)) if ti else "")


LINK_RE = re.compile(
    r'<a\s[^>]*?href="(/[^"#?]*)[^"]*"[^>]*>([\s\S]{0,300}?)</a>', re.I
)


def links_on(h: str) -> list[tuple[str, str]]:
    out = []
    for m in LINK_RE.finditer(strip_noise(h)):
        text = re.sub(r"\s+", " ", html.unescape(re.sub(r"(?s)<[^>]+>", " ", m.group(2)))).strip()
        if text:
            out.append((m.group(1).rstrip("/") or "/", text))
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="https://permtracker.app")
    ap.add_argument("--pages", type=int, default=40, help="how many source pages to crawl")
    args = ap.parse_args()
    base = args.base.rstrip("/")

    sm = fetch(f"{base}/sitemaps/pages.xml")
    if not sm:
        print("FAIL: could not read the sitemap; nothing to crawl", file=sys.stderr)
        return 2
    urls = [u for u in re.findall(r"<loc>([^<]+)</loc>", sm)]
    # One per route shape, so a 33-article set does not crowd out the data pages.
    seen_shape: set[str] = set()
    sources: list[str] = []
    for u in urls:
        shape = re.sub(r"/[^/]+$", "/:slug", u) if u.count("/") > 3 else u
        if shape in seen_shape:
            continue
        seen_shape.add(shape)
        sources.append(u)
    sources = sources[: args.pages]

    print(f"base    : {base}")
    print(f"crawling: {len(sources)} source pages, one per route shape\n")

    pages = {}
    with ThreadPoolExecutor(8) as ex:
        for u, h in zip(sources, ex.map(fetch, sources)):
            if h:
                pages[u] = h

    # Every distinct internal target, with the labels used to reach it.
    labels: dict[str, set[str]] = defaultdict(set)
    where: dict[str, set[str]] = defaultdict(set)
    for src, h in pages.items():
        for href, text in links_on(h):
            labels[href].add(text)
            where[href].add(src.replace(base, "") or "/")

    targets = sorted(labels)
    with ThreadPoolExecutor(8) as ex:
        fetched = dict(zip(targets, ex.map(lambda t: fetch(base + t), targets)))

    dead, suspect = [], []
    for t in targets:
        if fetched.get(t) is None:
            dead.append((t, sorted(labels[t])[:2], sorted(where[t])[:2]))
            continue
        for label in labels[t]:
            low = label.lower()
            # NAVIGATIONAL LINKS ONLY: a destination with a slug segment is an
            # entity or an article, and its own name legitimately contains the
            # topic ("Alonge Law Firm", "PERM Processing Times in 2026"). The
            # promise this check is about is the one a NAV or a hub link makes.
            if t.count("/") > 1 and not t.startswith("/tools/"):
                continue
            for phrase, allowed in TOPICS.items():
                if not allowed or phrase not in low:
                    continue
                # A longer topic phrase wins: "prevailing wage request" should
                # not also be judged as the shorter "wage request".
                if any(p != phrase and phrase in p and p in low for p in TOPICS):
                    continue
                if t in allowed:
                    break
                h1, _ = page_identity(fetched[t])
                # A LINK WHOSE TEXT IS THE PAGE'S OWN TITLE IS ALWAYS CORRECT.
                # "Alonge Law Firm, Inc." contains the phrase "law firm" and
                # points at exactly that firm; an article's title contains the
                # topic it is about. Both are the link working, not failing.
                # This one rule removed every entity and article false positive.
                # ...and it holds in BOTH directions. "No number? Processing
                # time calculator" pointing at the page titled "PERM
                # processing time calculator" is a correct link with a lead-in
                # clause, not a mismatch; the title is a subset of the label
                # rather than the other way round. Checking only one direction
                # flagged it. The looser rule still fires on the real defect
                # (label "Processing times" -> a page titled "PERM
                # calculators" shares no words at all), which is the probe.
                lw, hw = words(label), words(h1)
                if lw and hw:
                    small, big = (lw, hw) if len(lw) <= len(hw) else (hw, lw)
                    if len(small & big) >= max(1, len(small) - 1):
                        break
                suspect.append((t, label, h1[:60], sorted(where[t])[:1], phrase))
                break

    print(f"internal targets : {len(targets)}")
    print(f"unreachable      : {len(dead)}")
    print(f"topic mismatches : {len(suspect)}\n")

    for t, ls, w in dead:
        print(f"  DEAD  {t}\n        labelled {ls}\n        linked from {w}")
    for t, label, h1, w, phrase in suspect:
        print(f'  MISMATCH  link text says "{phrase}" but goes to {t}')
        print(f'            full label : "{label}"')
        print(f'            that page  : "{h1}"')
        print(f"            linked from: {w[0] if w else '?'}")

    # A sweep that fetched nothing must not read as a pass.
    if len(targets) < 20:
        print(f"\nFAIL: only {len(targets)} internal targets found; the crawl is broken")
        return 2
    print(f"\ncontrol: crawled {len(pages)} pages and found {len(targets)} targets")
    return 1 if (dead or suspect) else 0


if __name__ == "__main__":
    sys.exit(main())
