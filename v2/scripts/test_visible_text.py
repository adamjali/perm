#!/usr/bin/env python3
"""audit_visible_text.py counts only what a reader can see, and
audit_headings.py reads only the outline a reader gets.

    python3 scripts/test_visible_text.py
"""
from __future__ import annotations

import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import audit_headings as ah  # noqa: E402
import audit_visible_text as av  # noqa: E402

FAILS: list[str] = []


def check(ok: bool, msg: str) -> None:
    print(("PASS " if ok else "FAIL ") + msg)
    if not ok:
        FAILS.append(msg)


def seen(html: str) -> list[str]:
    return av.words(av.detext(av.drop_closed_details(av.drop_hidden(html))))


# The header's closed Data menu: in the HTML for search engines, inert until it opens.
MENU = ('<p>keep</p><div id="data-menu" inert aria-hidden="true"><ul><li><a>PERM cases</a></li></ul>'
        '<div>All data</div></div><p>after</p>')


def main() -> int:
    check(seen(MENU) == ["keep", "after"], "a closed, inert menu panel isn't counted, nested divs and all")
    check(seen('<div hidden><div><p>x</p></div></div><p>y</p>') == ["y"], "the hidden attribute hides")
    check(seen('<div inert=""><p>a</p></div><p>b</p>') == ["b"], "inert with an empty value hides")
    check(seen('<p aria-hidden="false">shown</p>') == ["shown"], 'aria-hidden="false" is visible')
    check(seen('<span data-hidden="1">shown</span>') == ["shown"], "an attribute that only contains the word is visible")
    check(seen('<div class="hidden lg:block">shown</div>') == ["shown"], "a class named hidden is CSS's call, not ours")
    check(seen('<p>d <img alt="x" hidden> e</p>') == ["d", "e"], "a hidden void element hides only itself")
    check(seen('<details><summary>Fold</summary><p>body</p></details>') == ["Fold"], "a closed fold keeps its summary only")
    streamed = '<body><h1>T</h1><h2>A</h2><div hidden id="S:0"><h1>T</h1><h2>A</h2></div></body>'
    check(ah.headings(streamed) == [(1, "T"), (2, "A")], "a dev server's hidden streamed copy adds no headings")
    print(f"\n{len(FAILS)} failure(s)")
    return 1 if FAILS else 0


if __name__ == "__main__":
    sys.exit(main())
