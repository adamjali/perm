#!/usr/bin/env python3
"""How many words a reader actually FACES on each page.

WHY NOT JUST COUNT THE WORDS. Collapsing a reference section into `<details>`
removes it from the page a person sees and leaves it exactly where it was in
the DOM - which is the whole reason collapsing is safe for search. So a plain
word count of the served HTML cannot see the improvement at all, and would
report a page as unchanged after the change that fixed it.

Two numbers, and the pair is the point:

  visible  words NOT inside a closed `<details>`. This is what a reader meets,
           and it is the number the complaint was about.
  dom      every word, open or shut. This is what Google, Bing and the answer
           engines read, and it must NOT fall when a section is collapsed.

A change that cuts `visible` and holds `dom` is the one worth shipping. A
change that cuts both has deleted content, which may be right but is a
different decision and should be made deliberately.

CHROME IS SUBTRACTED SEPARATELY. Header, rail and footer are ~300 words on
every page and drown a short one: a 530-word index reads as 60% duplicated
whatever it says. The `own` column drops any 5-gram appearing on more than half
the pages scanned, which is what chrome is by definition.

    python3 scripts/audit_visible_text.py                 # the live site
    python3 scripts/audit_visible_text.py --base http://localhost:3000
"""
from __future__ import annotations

import argparse
import collections
import re
import sys
import urllib.request

HEADERS = {
    "User-Agent": "permtracker-audit/1.0",
    # Firewall rule 5: the site's own audit scripts bypass Bot Protection and
    # the per-IP page limit. Without it a bare script is answered with 429.
    "x-permtracker-audit": "1",
}

DEFAULT_PAGES = [
    "/", "/perm-rfi-audit", "/visa-bulletin", "/perm-denial-risk",
    "/perm-decision-activity", "/perm-processing-times", "/methodology",
    "/perm-queue", "/perm-case-status", "/calculators", "/case-search",
    "/for-attorneys", "/tools", "/pwd-cases", "/lca-wages", "/about",
    "/lca-cases", "/perm-case-statuses", "/perm-employers", "/perm-wages",
    "/glossary", "/layoffs", "/debarments",
]

# A control the scan must find, so a blind run cannot read as a clean one.
CONTROL = "PERM Tracker"


def fetch(url: str) -> str | None:
    try:
        req = urllib.request.Request(url, headers=HEADERS)
        return urllib.request.urlopen(req, timeout=60).read().decode("utf-8", "replace")
    except Exception as e:  # noqa: BLE001
        print(f"  !! {url}: {e}", file=sys.stderr)
        return None


def strip_noise(html: str) -> str:
    for tag in ("script", "style", "svg", "noscript", "template"):
        html = re.sub(rf"<{tag}\b[^>]*>[\s\S]*?</{tag}>", " ", html, flags=re.I)
    return re.sub(r"<!--[\s\S]*?-->", " ", html)


def detext(html: str) -> str:
    t = re.sub(r"<[^>]+>", " ", html)
    for a, b in (("&nbsp;", " "), ("&amp;", "&"), ("&#x27;", "'"),
                 ("&quot;", '"'), ("&lt;", "<"), ("&gt;", ">"), ("&#39;", "'")):
        t = t.replace(a, b)
    return t


def words(text: str) -> list[str]:
    return [w for w in text.split() if any(c.isalpha() for c in w)]


def drop_closed_details(html: str) -> str:
    """Remove the BODY of every `<details>` that has no `open` attribute.

    The `<summary>` stays - it is visible, and it is usually the whole point of
    the collapse. Nested `<details>` are handled by scanning depth rather than
    by a non-greedy match, which would stop at the first `</details>` and
    silently keep an outer section's body.
    """
    out, i = [], 0
    for m in re.finditer(r"<details\b([^>]*)>", html, flags=re.I):
        if re.search(r"\bopen\b", m.group(1), flags=re.I):
            continue                      # an open one is visible; leave it
        # Walk to this element's OWN closing tag, counting nesting.
        depth, j = 1, m.end()
        while depth and j < len(html):
            nxt = re.search(r"</?details\b[^>]*>", html[j:], flags=re.I)
            if not nxt:
                # UNCLOSED. A browser hides everything to the end of the
                # document, so the honest answer is to drop the rest rather
                # than leave it counted as visible. React never emits this;
                # the branch exists so a malformed page cannot silently
                # inflate the visible count and make a change look worse than
                # it is.
                j = len(html)
                break
            depth += -1 if nxt.group(0).startswith("</") else 1
            j += nxt.end()
        body = html[m.end():j]
        summary = re.search(r"<summary\b[^>]*>[\s\S]*?</summary>", body, flags=re.I)
        if m.start() < i:
            continue                      # already inside a dropped region
        out.append(html[i:m.end()])
        if summary:
            out.append(summary.group(0))
        i = j
    out.append(html[i:])
    return "".join(out)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="https://permtracker.app")
    ap.add_argument("--pages", nargs="*", default=None)
    args = ap.parse_args()

    pages = args.pages or DEFAULT_PAGES
    got: dict[str, tuple[list[str], list[str]]] = {}
    for p in pages:
        html = fetch(args.base.rstrip("/") + p)
        if html is None:
            continue
        clean = strip_noise(html)
        got[p] = (words(detext(clean)),
                  words(detext(drop_closed_details(clean))))

    if not got:
        print("FAIL: nothing fetched - the audit has no subject")
        return 2
    if not any(CONTROL in " ".join(dom) for dom, _ in got.values()):
        print(f"FAIL: the control string {CONTROL!r} appears on no page. "
              "A scan that cannot see known content cannot be trusted to have "
              "seen anything.")
        return 2

    grams: collections.Counter = collections.Counter()
    for _, (_, vis) in got.items():
        grams.update({" ".join(vis[i:i + 5]) for i in range(len(vis) - 4)})
    chrome = {g for g, n in grams.items() if n > len(got) / 2}

    print(f"pages scanned: {len(got)}   control found: yes\n")
    print(f"{'page':26s} {'visible':>8s} {'own':>6s} {'dom':>7s} {'collapsed':>10s}")
    rows = []
    for p, (dom, vis) in got.items():
        own = sum(1 for i in range(len(vis) - 4)
                  if " ".join(vis[i:i + 5]) not in chrome)
        rows.append((own, len(vis), len(dom), p))
    for own, vis, dom, p in sorted(rows, reverse=True):
        print(f"{p:26s} {vis:8d} {own:6d} {dom:7d} {dom - vis:10d}")
    print("\nvisible = what a reader meets · dom = what a crawler reads")
    print("collapsed = kept for search, removed from the page")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
