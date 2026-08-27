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

    nav = (ROOT / "src/components/tools/DataNav.tsx").read_text()
    union = set(re.findall(r'"([\w-]+)"', re.search(r'export type DataSection =(.*?);', nav, re.S).group(1)))

    rs = routes()
    print(f"public routes found : {len(rs)}")
    print(f"sitemap statics     : {len(listed)}")
    print(f"DataNav section keys: {len(union)}")
    if not rs or not listed or not union:
        print("FAIL: a gate that cannot see its subject reads exactly like a pass")
        return 2

    findings: list[str] = []
    for route, path in rs:
        src = path.read_text()
        if route not in listed:
            findings.append(f"{route}: not in sitemap statics ({path.relative_to(ROOT)})")
        m = re.search(r'DataNav\s+active=\{?"([\w-]+)"', src)
        if m and m.group(1) not in union:
            findings.append(f"{route}: DataNav active=\"{m.group(1)}\" is not a DataSection key")
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
