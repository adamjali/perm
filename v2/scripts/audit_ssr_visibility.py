#!/usr/bin/env python3
"""Assert no page ships its content hidden behind an inline opacity.

Motion serializes a component's `initial` prop as an inline style during
server rendering, so `<motion.div initial={{ opacity: 0 }}>{children}</...>`
puts `style="opacity:0"` into the prerendered HTML: the page arrives invisible
until React hydrates, its paint waits on the whole JS bundle, and it stays
blank with JS disabled or broken. It is invisible on a fast desktop, and the
JSX reads as an ordinary animation, so the served bytes are the only place to
check.

USAGE
    python3 scripts/audit_ssr_visibility.py                       # live site
    python3 scripts/audit_ssr_visibility.py --base http://127.0.0.1:3100
    python3 scripts/audit_ssr_visibility.py --limit 40            # sample

Exit 1 on any finding, or if the run could not see its subject.
"""

from __future__ import annotations

import argparse
import re
import sys
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from lib_audit import audit_headers  # noqa: E402

DEFAULT_BASE = "https://permtracker.app"
UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36"
)

# `opacity:0` but NOT `opacity:0.5`. Minifiers drop the space, browsers and
# React keep it, so accept either.
HIDDEN_RE = re.compile(r"opacity:\s*0(?![.\d])")
# The specific shape the PageTransition regression produced, reported separately
# because it names its own cause.
TRANSFORM_RE = re.compile(r"translateY\(8px\)")
# Only an element's own inline style can hide it at first paint, so only inline
# `style` attributes are judged: a stylesheet rule in <head> can mention
# `opacity:0` without hiding anything on the page.
STYLE_ATTR_RE = re.compile(r'\sstyle="([^"]*)"')


def hidden_styles(body: str, pattern: re.Pattern = HIDDEN_RE) -> list[int]:
    """Positions of elements whose inline style attribute matches `pattern`."""
    return [m.start() for m in STYLE_ATTR_RE.finditer(body) if pattern.search(m.group(1))]

# A string every page on this site serves. If it is absent the fetch did not
# reach a real page (a bot challenge, a 404 body, an error shell), and every
# "clean" result in that run would be meaningless.
CONTROL = "main-content"


def fetch(url: str, timeout: int = 30) -> tuple[int, str]:
    # The audit key exempts this from the per-address limits (lib_audit.py).
    req = urllib.request.Request(url, headers={"User-Agent": UA, **audit_headers()})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, r.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        return e.code, ""
    except Exception as e:  # noqa: BLE001 - reported, not raised
        return 0, f"__ERROR__ {e}"


def sitemap_urls(base: str) -> list[str]:
    status, body = fetch(f"{base}/sitemap.xml")
    if status != 200:
        print(f"FATAL: sitemap.xml returned {status}", file=sys.stderr)
        sys.exit(1)
    urls = re.findall(r"<loc>([^<]+)</loc>", body)
    # A sitemap index points at child sitemaps rather than pages.
    if urls and all(u.rstrip("/").endswith(".xml") for u in urls):
        out: list[str] = []
        for child in urls:
            _, cb = fetch(child)
            out.extend(re.findall(r"<loc>([^<]+)</loc>", cb))
        urls = out
    return sorted(set(urls))


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default=DEFAULT_BASE)
    ap.add_argument("--limit", type=int, default=0, help="check only the first N URLs")
    ap.add_argument(
        "--sitemap",
        help="Audit ONE child sitemap instead of the whole index. "
             "THE UNIT THAT MATTERS IS THE TEMPLATE, NOT THE URL: the index "
             "holds 21,110 URLs but only ~12 templates, and 16,309 of them "
             "are the employer page with different words in it. "
             "`--sitemap .../sitemaps/pages.xml` covers every distinct "
             "template's non-entity pages; sample the entity ones with "
             "--limit rather than walking all of them.",
    )
    args = ap.parse_args()
    base = args.base.rstrip("/")

    urls = (
        [u for u in re.findall(r"<loc>([^<]+)</loc>", fetch(args.sitemap)[1])]
        if args.sitemap
        else sitemap_urls(base)
    )
    if args.limit:
        urls = urls[: args.limit]
    if not urls:
        print("FATAL: sitemap listed no URLs - nothing was inspected.", file=sys.stderr)
        return 1

    # Counts BEFORE the verdict, so a run that inspected nothing cannot read
    # as a pass.
    print(f"base    : {base}")
    print(f"checking: {len(urls)} URL(s) from the sitemap\n")

    def check(u: str):
        path = "/" + u.split("/", 3)[3] if u.count("/") >= 3 else "/"
        status, body = fetch(u)
        return u, path, status, body

    findings: list[str] = []
    below_fold_total = [0]
    blind: list[str] = []
    ok = 0

    with ThreadPoolExecutor(max_workers=6) as pool:
        for u, path, status, body in pool.map(check, urls):
            if status != 200 or body.startswith("__ERROR__"):
                blind.append(f"  {status or 'ERR'}  {path}  {body[:70]}")
                continue
            if CONTROL not in body:
                blind.append(f"  200 but no control string ({CONTROL!r})  {path}")
                continue
            # The rule is positional. `whileInView` reveals further down a page are
            # supposed to start hidden, so a bare count of `opacity:0` would fail
            # every content page forever. What is never acceptable is hiding content
            # above the fold, and the <h1> is a reliable proxy for that line:
            # anything hidden before the headline gates LCP on hydration.
            h1 = body.find("<h1")
            hidden = hidden_styles(body)
            hidden_before_h1 = [p for p in hidden if h1 > -1 and p < h1]
            tf = len(hidden_styles(body, TRANSFORM_RE))
            below = len(hidden) - len(hidden_before_h1)

            if tf:
                findings.append(
                    f"  {path}\n      translateY(8px) x{tf} - the PageTransition "
                    f"wrapper is hiding SSR content again"
                )
            elif hidden_before_h1:
                findings.append(
                    f"  {path}\n      opacity:0 x{len(hidden_before_h1)} BEFORE the "
                    f"<h1> - above-the-fold content is hidden until hydration"
                )
            else:
                ok += 1
                below_fold_total[0] += below

    print(f"clean   : {ok}")
    print(f"          (they carry {below_fold_total[0]} hidden elements BELOW the h1 -\n           the whileInView reveals, which are intended)")
    print(f"findings: {len(findings)}")
    print(f"unusable: {len(blind)}\n")

    if blind:
        print("COULD NOT INSPECT (these prove nothing either way):")
        print("\n".join(blind[:20]))
        print()
    if findings:
        print("FINDINGS:")
        print("\n".join(findings[:40]))
        return 1
    if ok == 0:
        print("FATAL: zero pages were successfully inspected.", file=sys.stderr)
        return 1

    print("PASS: no page ships its content behind an inline opacity.")
    return 1 if blind else 0


if __name__ == "__main__":
    sys.exit(main())
