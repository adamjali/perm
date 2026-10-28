"""The em-dash rule reads our prose, never a quotation (audit_all_pages.prose_em_dashes).

House style bans the em dash in our own writing, and never touches quoted material: /compare quotes
rivals' pages word for word, dashes included, and the morning page check flagged six of those on
Oct 28 2026. A quote is marked up as one (<q>, <blockquote>), and a hover tip carries its text in an
attribute; neither is our prose.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from audit_all_pages import prose_em_dashes  # noqa: E402

failures = 0


def check(name: str, ok: bool, detail: str = "") -> None:
    global failures
    print(("ok   " if ok else "FAIL ") + name + ("" if ok else f"  ({detail})"))
    if not ok:
        failures += 1


ours = "<p>An account is optional — every tool works without one.</p>"
check("our own prose with an em dash is flagged", len(prose_em_dashes(ours)) == 1, str(prose_em_dashes(ours)))

linked = '<p>Read the <a href="/x">guide</a> — then file.</p>'
check("prose spanning a link is still flagged", len(prose_em_dashes(linked)) == 1, str(prose_em_dashes(linked)))

cell = "<table><tr><td>—</td></tr></table>"
check("a lone dash in a table cell is a no-value marker", prose_em_dashes(cell) == [], str(prose_em_dashes(cell)))

quoted = '<p class="x"><q>An account is optional — every tool on the site works without one.</q> <a href="u">u</a></p>'
check("a dash inside <q> is a quotation, not our prose", prose_em_dashes(quoted) == [], str(prose_em_dashes(quoted)))

block = "<blockquote><p>Free beta — payments aren't live yet.</p></blockquote>"
check("a dash inside <blockquote> is a quotation", prose_em_dashes(block) == [], str(prose_em_dashes(block)))

tip = '<rect data-tip="ImmiLane: Visa bulletin Yes The November 2026 bulletin — matching"></rect><p>x</p>'
check("a dash inside an attribute is not visible prose", prose_em_dashes(tip) == [], str(prose_em_dashes(tip)))

after = "<p><q>Quoted — fine.</q></p><p>But ours — not fine.</p>"
check("prose after a closed quote is flagged again", len(prose_em_dashes(after)) == 1, str(prose_em_dashes(after)))

sys.exit(1 if failures else 0)
