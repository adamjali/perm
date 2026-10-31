#!/usr/bin/env python3
"""Who made each page, when it changed, where its figures come from, and how to
report a mistake: checked on every public page, read from the SITEMAP.

Google's quality raters ask of every page who made it, why to trust it, and
whether the maker knows the subject first-hand (E-E-A-T). This site answers on
the page itself, and this audit holds every page to it, by kind:

  every page    the footer's trust links: About, the methodology, the editorial
                standards, the corrections log, contact, privacy; and the legal
                name of the company that runs the site
  every page    the day it last changed, as a WebPage `dateModified` (the
    but home    breadcrumb line prints the same day)
  articles      the byline linking the editorial standards, a way to report an
                error, the corrections log, and an author in the Article markup
  data pages    a source line (`data-provenance`) with the methodology linked
                and a way to report an error

A page that answers in another way is listed in EXEMPT with its reason.
Templated families are sampled, as the headings audit samples them.

    python3 scripts/audit_trust.py
    python3 scripts/audit_trust.py --base http://localhost:3000
"""
from __future__ import annotations

import argparse
import re
import sys

from audit_headings import fetch, page_paths

FOOTER_LINKS = ("/about", "/methodology", "/editorial-standards", "/changelog/corrections", "/contact", "/privacy")
# The company behind the brand, as `LEGAL_NAME` in src/lib/constants/about.ts says it.
# Python can't read that file, so it is typed here and legal-name.test.ts holds the two equal:
# the old "PERM Tracker LLC" failed every page from the Oct 30 2026 rename until Oct 31.
LEGAL_NAME = "Asolys LLC"
ARTICLE = re.compile(r"^/(guides|blog|changelog)/[^/]+$")
# Pages that legitimately lack one of the signals, with the reason.
EXEMPT: dict[str, set[str]] = {
    # The homepage's date is the sweep's, printed in its own band; it carries no breadcrumb line.
    "/": {"date"},
    # Embeds sit inside other sites' pages: they carry no site footer, by design.
    "/embed/": {"footer", "date"},
}


def exempt(path: str, signal: str) -> bool:
    return any(signal in sigs and (path == p or (p.endswith("/") and path.startswith(p))) for p, sigs in EXEMPT.items())


def links(html: str) -> set[str]:
    return {re.sub(r"[?#].*$", "", h) for h in re.findall(r'href="(/[^"]*)"', html)}


def element_at(html: str, start: int) -> str:
    """The whole <div> that opens at `start`, its nested divs included: a fixed
    window past the marker can reach the footer, whose links would hide a source
    line without its own."""
    depth = 0
    for m in re.finditer(r"<(/?)div\b", html[start:]):
        depth += -1 if m.group(1) else 1
        if depth == 0:
            return html[start: start + m.end()]
    return html[start:]


def findings_for(path: str, html: str) -> list[str]:
    out: list[str] = []
    found = links(html)
    if not exempt(path, "footer"):
        missing = [h for h in FOOTER_LINKS if h not in found]
        if missing:
            out.append(f"no link to {', '.join(missing)}")
        if LEGAL_NAME not in html:
            out.append(f"the legal name ({LEGAL_NAME}) isn't on the page")
    if not exempt(path, "date") and not re.search(r'"dateModified":"\d{4}-\d{2}-\d{2}', html):
        out.append("no dateModified: the page doesn't say when it last changed")
    if ARTICLE.match(path):
        if '"author"' not in html:
            out.append("the Article markup names no author")
        # The byline and the closing line both point at the standards; the closing
        # line carries the contact link and the corrections log.
        if html.count('href="/editorial-standards"') < 2:
            out.append("the byline or the closing line doesn't link the editorial standards")
    marker = re.search(r"<div[^>]*\bdata-provenance\b", html)
    if marker:
        block = element_at(html, marker.start())
        for h, what in (("/methodology", "the methodology"), ("/contact", "a way to report an error"),
                        ("/changelog/corrections", "the corrections log")):
            if f'href="{h}"' not in block:
                out.append(f"its source line doesn't link {what}")
    return out


def control() -> None:
    """A planted page missing everything must trip every check, or the audit is blind."""
    bad = findings_for("/guides/x", "<html><body><p>nothing here</p></body></html>")
    assert len(bad) >= 4, f"the audit stopped seeing missing signals: {bad}"
    good_footer = "".join(f'<a href="{h}">x</a>' for h in FOOTER_LINKS) + LEGAL_NAME
    data = f'<div data-provenance><a href="/methodology">m</a></div>{good_footer}"dateModified":"2026-10-28"'
    got = findings_for("/perm-queue", data)
    assert any("report an error" in g for g in got) and len(got) == 2, f"the source-line check is blind: {got}"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="https://permtracker.app")
    ap.add_argument("--pages", nargs="*", default=None)
    args = ap.parse_args()
    base = args.base.rstrip("/")
    control()

    paths = args.pages or page_paths(base)
    if args.pages is None and len(paths) < 20:
        print(f"FAIL: the sitemap walk found only {len(paths)} pages. That is "
              "a defect in this script or in the sitemap, not a clean site.")
        return 2

    print(f"scanning {len(paths)} pages\n")
    findings = scanned = data_pages = articles = 0
    for p in paths:
        html = fetch(base + p)
        if html is None:
            findings += 1
            print(f"{p}\n    - UNREACHABLE")
            continue
        scanned += 1
        data_pages += bool(re.search(r"\bdata-provenance\b", html))
        articles += bool(ARTICLE.match(p))
        msgs = findings_for(p, html)
        if msgs:
            findings += 1
            print(p)
            for m in msgs:
                print(f"    - {m}")

    print(f"\n{scanned} pages scanned ({articles} articles, {data_pages} with a source line), {findings} with a finding")
    # On a sitemap walk some page must carry a source line; a list given by hand may hold none.
    if args.pages is None and scanned and data_pages == 0:
        print("FAIL: no page carried a source line. The marker changed or this audit is blind.")
        return 2
    return 1 if findings else 0


if __name__ == "__main__":
    sys.exit(main())
