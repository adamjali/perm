#!/usr/bin/env python3
"""Every public page must be reachable: sitemap entry + nav chip + canonical.

A page that renders perfectly and is listed nowhere is invisible. This repo has
shipped that defect before, and the usual cause is exactly what happened here:
a page and its registration live in different files, so adding the page is one
edit and registering it is three more that nobody makes.

Checks, per public route:
  1. it appears in `src/lib/sitemap/build.ts`'s `statics` array
  2. its `DataNav active=` prop names a key that exists in the DataSection union
  3. it declares `alternates.canonical`
  4. that canonical matches its own route

Prints its counts BEFORE its verdict, and fails loudly when it finds no pages
at all -- a gate that cannot see its subject reads exactly like a pass.
"""
from __future__ import annotations
import re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PUB = ROOT / "src/app/(site)/(public)"

# Data-reading pages that are deliberately outside the rail: the homepage, the
# marketing pages that quote a live figure, and the auth pages that do the same.
RAIL_EXEMPT = {"/", "/about", "/for-attorneys", "/signup", "/login", "/faq", "/case-search", "/perm-case-status"}

def routes() -> list[tuple[str, Path]]:
    out = []
    for p in sorted(PUB.rglob("page.tsx")):
        rel = p.parent.relative_to(PUB).as_posix()
        if rel == ".":
            out.append(("/", p)); continue
        if "[" in rel:            # dynamic segments are covered by entity sitemaps
            continue
        out.append(("/" + rel, p))
    return out

def main() -> int:
    sm = (ROOT / "src/lib/sitemap/build.ts").read_text()
    listed = set(re.findall(r'\$\{base\}(/[\w\-/]*)`', sm))
    listed.add("/")

    # The rail map replaced DataNav on 2026-08-30: pages no longer pass an
    # `active` key, sectionForPath() derives it from the pathname by longest
    # prefix. So the check is now: every page that READS DATA (imports from
    # lib/turso) is reachable from the rail, either as an entry's href or under
    # one by prefix. A data page the rail cannot reach is listed nowhere a
    # reader browses.
    sections = (ROOT / "src/components/tools/dataSections.ts").read_text()
    rail = set(re.findall(r'href:\s*"(/[\w\-/]*)"', sections))

    rs = routes()
    print(f"public routes found : {len(rs)}")
    print(f"sitemap statics     : {len(listed)}")
    print(f"rail hrefs          : {len(rail)}")
    if not rs or not listed or not rail:
        print("FAIL: a gate that cannot see its subject reads exactly like a pass")
        return 2

    findings: list[str] = []
    for route, path in rs:
        src = path.read_text()
        if route not in listed:
            findings.append(f"{route}: not in sitemap statics ({path.relative_to(ROOT)})")
        reads_data = "lib/turso" in src
        reachable = route in rail or any(route.startswith(h + "/") for h in rail)
        if reads_data and not reachable and route not in RAIL_EXEMPT:
            findings.append(f"{route}: reads data but no rail entry reaches it (dataSections.ts)")
        c = re.search(r'canonical:\s*"([^"]+)"', src)
        if not c:
            findings.append(f"{route}: no alternates.canonical")
        elif c.group(1).rstrip("/") != route.rstrip("/") and route != "/":
            findings.append(f"{route}: canonical says {c.group(1)}")

    print(f"findings            : {len(findings)}")
    for f in findings:
        print("  " + f)
    return 1 if findings else 0

if __name__ == "__main__":
    sys.exit(main())
