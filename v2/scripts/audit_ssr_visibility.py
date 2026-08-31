#!/usr/bin/env python3
"""Assert no page ships its content hidden behind an inline opacity.

WHY THIS EXISTS
---------------
Motion serializes a component's `initial` prop as an INLINE STYLE during
server rendering, so `<motion.div initial={{ opacity: 0 }}>{children}</...>`
puts `style="opacity:0"` into the prerendered HTML. On 2026-08-31 the shared
`PageTransition` wrapper was doing exactly that around `{children}` in the
public layout, so every one of ~298 URLs served roughly 90% of its bytes
invisible until React hydrated:

    <main id="main-content" ...>
      <div style="opacity:0;transform:translateY(8px)">   <- 266KB of 296KB

Three consequences: FCP/LCP gated on the whole JS bundle for a page whose HTML
arrived at 20ms (PageSpeed mobile read FCP 3.0s, LCP 5.8s, element render
delay 2,470ms); a permanently blank page with JS disabled or broken; and it is
invisible on desktop, which scored 96 with the defect fully present.

Source-level review does not catch this - the JSX reads as an ordinary
animation and the prop is named `initial`, which sounds client-side. The only
place it is visible is the served bytes, so that is what this checks.

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

# A string every page on this site serves. If it is absent the fetch did not
# reach a real page (a Vercel bot challenge, a 404 body, an error shell), and
# every "clean" result in that run is meaningless. A sweep with no control
# reads exactly like a pass - the failure this repo has hit more than once.
CONTROL = "main-content"


def fetch(url: str, timeout: int = 30) -> tuple[int, str]:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
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
    args = ap.parse_args()
    base = args.base.rstrip("/")

    urls = sitemap_urls(base)
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
            hid = len(HIDDEN_RE.findall(body))
            tf = len(TRANSFORM_RE.findall(body))
            if tf:
                findings.append(
                    f"  {path}\n      translateY(8px) x{tf} - the PageTransition "
                    f"wrapper is hiding SSR content again"
                )
            elif hid:
                # Not automatically a bug: a genuinely-hidden decorative element
                # can legitimately carry opacity:0. Report for a human to judge.
                findings.append(f"  {path}\n      opacity:0 x{hid} (review: is any of it content?)")
            else:
                ok += 1

    print(f"clean   : {ok}")
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
