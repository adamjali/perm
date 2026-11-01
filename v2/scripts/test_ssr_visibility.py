#!/usr/bin/env python3
"""audit_ssr_visibility.py judges inline styles, never stylesheet text.

    python3 scripts/test_ssr_visibility.py
"""
from __future__ import annotations

import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import audit_ssr_visibility as av  # noqa: E402

FAILS: list[str] = []


def check(ok: bool, msg: str) -> None:
    print(("PASS " if ok else "FAIL ") + msg)
    if not ok:
        FAILS.append(msg)


# A wrapper serialized hidden around the whole page.
PAGE_TRANSITION = '<main id="main-content"><div style="opacity:0;transform:translateY(8px)"><h1>X</h1></div></main>'
# The home curtain's stylesheet in <head>: text, not an element's style.
CURTAIN_CSS = ('<style>@media (prefers-reduced-motion:reduce){html[data-pre="leaving"] .pre'
               '{transform:none;opacity:0}}</style><main id="main-content"><h1>X</h1></main>')
# A reveal below the fold is intended and must not count before the h1.
BELOW_FOLD = '<main id="main-content"><h1>X</h1><div style="opacity:0">later</div></main>'
HALF = '<main id="main-content"><div style="opacity:0.5"><h1>X</h1></div></main>'


def before_h1(body: str) -> int:
    h1 = body.find("<h1")
    return len([p for p in av.hidden_styles(body) if p < h1])


def main() -> int:
    check(before_h1(PAGE_TRANSITION) == 1, "a hidden inline wrapper above the h1 is caught")
    check(len(av.hidden_styles(PAGE_TRANSITION, av.TRANSFORM_RE)) == 1, "the translateY(8px) shape is named")
    check(before_h1(CURTAIN_CSS) == 0, "stylesheet text in <head> is not a hidden element")
    check(before_h1(BELOW_FOLD) == 0 and len(av.hidden_styles(BELOW_FOLD)) == 1,
          "a below-the-fold reveal is counted, but not before the h1")
    check(before_h1(HALF) == 0, "opacity:0.5 is not hidden")
    switch = ('<body><div id="main-content"></div><input type="checkbox" aria-hidden="true" tabindex="-1" '
              'style="position:absolute;pointer-events:none;opacity:0" checked=""/><h1>Case</h1></body>')
    check(before_h1(switch) == 0, "a switch's hidden native input is not hidden content")
    visible_input = '<body><input type="text" style="opacity:0"/><h1>Case</h1></body>'
    check(before_h1(visible_input) == 1, "an input hidden without aria-hidden still counts")
    # A build checked before it ships lists the live site in its sitemap: every page is read from --base.
    check(av.on_base("https://permtracker.app/perm-queue/2026-01", "http://127.0.0.1:3000")
          == "http://127.0.0.1:3000/perm-queue/2026-01", "a sitemap page is read from the base")
    check(av.on_base("https://permtracker.app", "http://127.0.0.1:3000/") == "http://127.0.0.1:3000/",
          "the homepage is read from the base")
    print(f"\n{len(FAILS)} failure(s)")
    return 1 if FAILS else 0


if __name__ == "__main__":
    sys.exit(main())
