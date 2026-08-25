#!/usr/bin/env python3
"""Find glued text in the RENDERED pages, which is the only place it is real.

JSX strips the whitespace between two elements written on separate lines, so
`<a>Blog</a>` and `<a>Tutorials</a>` reach the DOM with nothing between them and
every extractor that walks it reads "BlogTutorials". CSS hides this completely,
because the children are block or flex, so it looks correct in a browser and is
wrong everywhere that matters. Google has printed the glued form verbatim in a
real search listing.

WHY THIS IS NOT A SOURCE-LEVEL CHECK. `no-glued-jsx-text.test.ts` scans source
for `</tag>` then a newline then `<tag>`, and that pattern is blind to four
shapes this project actually uses:

  1. `{items.map(...)}` — the glue is between ARRAY ELEMENTS. There is no
     newline between two tags in the source at all.
  2. `<NavLink>` and other custom components, which are not in any HTML tag list.
  3. `<motion.h1>` — renders an <h1>, but the tag name is dotted and lowercase.
  4. `</p>{cond ? (...) : null}<p>` — the next token is `{`, not `<`, and the
     glue only appears in the branch where the conditional renders nothing.

Measured on this repo: the source gate reported clean while 153 real pairs were
being served, including "PrivacyTermsSecurityContact" in the auth footer and
"All2026auditbest-practices" on every content index.

Run against a production server:

    pnpm build && PORT=3100 pnpm start
    python3 scripts/audit_glued_text.py --base http://127.0.0.1:3100

Exit status is 1 when any pair is found.

LIMITATION, stated because it matters: this fetches each page in its DEFAULT
state. A conditional branch that only renders after user input is not exercised.
"""
from __future__ import annotations

import argparse
import html
import re
import sys
import urllib.request

# Tags whose text an extractor concatenates with its neighbour's.
TAGS = "h1|h2|h3|h4|h5|h6|p|span|a|li|dt|dd|strong|b|em|td|th|button|label"
# The opening tag is captured WHOLE, so reading forward starts after it. An
# earlier version captured only its first character and so read `>` or a space
# as the first character every time, and reported a clean sweep over a page with
# fourteen real pairs on it.
BOUNDARY = re.compile(rf"</(?:{TAGS})>(<(?:{TAGS})(?:\s[^>]*)?>)", re.I)
TAG = re.compile(r"<[^>]*>")
WORD = re.compile(r"[A-Za-z0-9]")

# Public pages only. The authenticated app is behind a login and is never
# crawled, so it is deliberately out of scope.
#
# THIS LIST IS A FALLBACK, NOT THE SUBJECT. It covered 21 URLs while the site
# served 298, so the sweep reported "0 glued pairs" over a site with 1,006 of
# them - a checker that cannot see its subject reads exactly like a pass. The
# sitemap is the authority now; this list is only used when the sitemap
# cannot be fetched.
FALLBACK_PAGES = [
    "/", "/tools", "/tools/perm-timeline-calculator", "/tools/pwd-calculator",
    "/tools/perm-deadline-calculator", "/tools/i140-calculator",
    "/tools/priority-date-calculator", "/tools/green-card-timeline",
    "/perm-processing-times", "/blog", "/tutorials", "/guides", "/changelog",
    "/resources", "/faq", "/login", "/signup", "/privacy", "/terms",
    "/security", "/contact",
]

# Asserted present on every page. A sweep that silently stops matching reports
# everything as fixed, so it has to prove it can still see its subject.
CONTROL = "PERM"


def sitemap_paths(base: str) -> list[str]:
    """Every URL the site publishes, which is what "every page" has to mean."""
    try:
        req = urllib.request.Request(
            base.rstrip("/") + "/sitemap.xml",
            headers={"User-Agent": "Mozilla/5.0 (permtracker glue audit)"},
        )
        with urllib.request.urlopen(req, timeout=30) as r:
            body = r.read().decode("utf-8", "replace")
    except Exception:
        return []
    locs = re.findall(r"<loc>(.*?)</loc>", body)
    return [re.sub(r"^https?://[^/]+", "", loc) or "/" for loc in locs]


def route_shape(path: str) -> str:
    """
    The TEMPLATE a URL renders, not the URL.

    `/perm-employers/microsoft-corporation` and 12,239 siblings are one React
    component. Scanning all of them costs 12,240 requests to learn what three
    would tell you, and a gate nobody can afford to run is not a gate. The
    shape is the leading segments with the final slug replaced by a marker.
    """
    parts = [seg for seg in path.strip("/").split("/") if seg]
    if not parts:
        return "/"
    if len(parts) == 1:
        return "/" + parts[0]
    return "/" + "/".join(parts[:-1]) + "/:slug"


def sample_by_shape(paths: list[str], per_shape: int) -> tuple[list[str], dict[str, int]]:
    """One page per template, plus `per_shape - 1` more, in sitemap order."""
    picked: list[str] = []
    seen: dict[str, int] = {}
    sizes: dict[str, int] = {}
    for path in paths:
        shape = route_shape(path)
        sizes[shape] = sizes.get(shape, 0) + 1
        if seen.get(shape, 0) < per_shape:
            seen[shape] = seen.get(shape, 0) + 1
            picked.append(path)
    return picked, sizes


def glued_pairs(markup: str) -> list[str]:
    """Boundaries where real text abuts real text, with context either side."""
    found = []
    for m in BOUNDARY.finditer(markup):
        before = html.unescape(TAG.sub("", markup[max(0, m.start() - 300):m.start()]))
        after = html.unescape(TAG.sub("", markup[m.end():m.end() + 300]))
        if not before or not after:
            continue
        # Two adjacent icon-only links have no text between them and are fine.
        # Only text touching text is the defect.
        if WORD.search(before[-1]) and WORD.search(after[0]):
            found.append(f"{before.strip()[-40:]}||{after.strip()[:40]}")
    return found


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--base", default="http://127.0.0.1:3100")
    ap.add_argument(
        "--per-shape",
        type=int,
        default=3,
        help="pages to scan per route template (0 = every URL, slow)",
    )
    args = ap.parse_args()

    all_pages = sitemap_paths(args.base) or FALLBACK_PAGES
    if not all_pages:
        raise SystemExit("FATAL: no URLs to scan; the audit can see nothing")
    print(f"urls from   : {'sitemap' if len(all_pages) > len(FALLBACK_PAGES) else 'fallback list'}")

    if args.per_shape > 0:
        pages, sizes = sample_by_shape(all_pages, args.per_shape)
        # Say what was SKIPPED. A sampled run that prints only its own count
        # reads as full coverage, which is the same lie as a silent truncation.
        big = {k: v for k, v in sizes.items() if v > args.per_shape}
        print(f"templates   : {len(sizes)}")
        if big:
            skipped = sum(v - args.per_shape for v in big.values())
            detail = ", ".join(f"{k} ({v:,})" for k, v in sorted(big.items(), key=lambda kv: -kv[1]))
            print(f"sampled     : {args.per_shape}/template; {skipped:,} URLs not fetched -> {detail}")
    else:
        pages, sizes = all_pages, {}
        print(f"sampled     : no; fetching all {len(all_pages):,} URLs")

    total, scanned, blind = 0, 0, []
    for path in pages:
        url = f"{args.base}{path}"
        try:
            with urllib.request.urlopen(url, timeout=30) as r:
                body = r.read().decode("utf-8", "replace")
        except Exception as exc:  # noqa: BLE001 - one bad page must not hide the rest
            print(f"  {path}: FETCH FAILED {exc}")
            continue
        scanned += 1
        if CONTROL not in body:
            blind.append(path)
        stripped = re.sub(r"<(script|style)[\s\S]*?</\1>", "", body, flags=re.I)
        hits = glued_pairs(stripped)
        if hits:
            total += len(hits)
            print(f"\n{path}: {len(hits)}")
            for h in hits[:10]:
                print(f"    {h}")

    # Counts before the verdict, so a run that saw nothing cannot read as a pass.
    print(f"\npages scanned   : {scanned}/{len(pages)}")
    # Do not claim the sweep is healthy when it fetched nothing: that line
    # printed "the sweep is not blind" over a run that scanned 0 of 21 pages.
    verdict = "n/a — nothing was scanned" if scanned == 0 else (blind or "none — the sweep is not blind")
    print(f"control missing : {verdict}")
    print(f"glued pairs     : {total}")
    if scanned == 0 or blind:
        print("FAILED: the sweep could not see its subject.")
        return 1
    return 1 if total else 0


if __name__ == "__main__":
    sys.exit(main())
