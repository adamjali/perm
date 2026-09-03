#!/usr/bin/env python3
"""
Placeholder width gate: a placeholder wider than its field is a functional
defect, because the field stops saying what it accepts.

WHY MEASURE RATHER THAN COUNT CHARACTERS. "Case number, employer or job title"
is 34 characters and 264px; "Start of the employer's name" is 28 characters
and 222px. A character budget calls the second one safer by six characters
when it is 42px narrower, and neither number tells you whether it fits. So
this reads the real Inter file the site ships and sums real advance widths.

THE FONT IS THE ONE THE BROWSER GETS, not a lookalike. `next/font/google`
downloads Inter at build time into `.next/static/media/*.woff2`; the latin
subset that carries the full ASCII set is found by inspecting every file
rather than by hardcoding a hash, because the hash changes on every font
update. Inter is variable (`wght` 100-900), so it is instantiated at the
weight the control actually renders at before any advance is read.

THE BUDGET, and the arithmetic behind it (all `box-sizing: border-box`,
which Tailwind Preflight sets, so borders and padding come out of the width):

  A full-width control in the site's standard form card, 320px viewport
  (the narrowest phone still in real use):
      320  viewport
      -32  page gutter        px-4
      -40  card padding       p-5
       -4  control border     border-2
      -24  control padding    px-3
    = 220px of text box.

  The same control at 360px (the common Android floor) has 260px, and at
  390px (iPhone 12-16) has 290px. 220 is the floor, so 220 is the budget.

  Multi-column form grids are NARROWER THAN A PHONE at their own breakpoint,
  which is the trap this gate exists to catch a second time: a `sm:grid-cols-3`
  inside `sm:p-6` at exactly 640px gives each column
      640 - 48 (sm:px-6) - 48 (sm:p-6) - 24 (two gap-3) = 520 / 3 = 173
      -4 border -24 padding = 145px.
  Files can declare that tighter budget per placeholder in NARROW below.

Run:  python3 scripts/audit_placeholders.py            (public surface, gate)
      python3 scripts/audit_placeholders.py --all      (every file, advisory)
      python3 scripts/audit_placeholders.py --probe    (self-test the metrics)
"""

from __future__ import annotations

import argparse
import glob
import os
import re
import sys

from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# The floor derived above. A placeholder at or under this fits every phone.
BUDGET_PX = 220.0

# Placeholders that sit in a multi-column form grid, where the column at the
# grid's own breakpoint is narrower than a phone. Keyed "file:line-ish" by the
# placeholder text itself, because line numbers move and the string does not.
NARROW: dict[str, float] = {
    # /case-search's lead row and "Narrow it" row: sm:grid-cols-3 and
    # lg:grid-cols-4 inside sm:p-6. 145px per column at exactly 640px, and the
    # 4-column row is wider than that only above lg.
    "e.g. Fragomen": 145.0,
    "e.g. software developers": 145.0,
    "e.g. software": 145.0,
    "e.g. engineer": 145.0,
    "e.g. 120000": 145.0,
    "e.g. 300000": 145.0,
}

# Tailwind's type scale, in px. Only the sizes that appear on a control here.
TEXT_PX = {
    "text-xs": 12.0,
    "text-sm": 14.0,
    "text-base": 16.0,
    "text-lg": 18.0,
    "text-xl": 20.0,
}
# The site's shared CONTROL constants are text-base font-medium, so that is
# the default when an element names neither. It is also the widest realistic
# combination, which is the right way for a default to be wrong.
DEFAULT_PX = 16.0
DEFAULT_WGHT = 500

WEIGHT = {
    "font-normal": 400,
    "font-medium": 500,
    "font-semibold": 600,
    "font-bold": 700,
    "font-black": 900,
}

# Scope. The authenticated app is behind a login: it still deserves a readable
# field, but it is not what a stranger meets, so it is advisory (--all).
PUBLIC_GLOBS = [
    "src/components/**/*.tsx",
    "src/app/(site)/**/*.tsx",
]
SKIP_RE = re.compile(r"\.(stories|test)\.tsx$|/__tests__/|/(admin|settings|forms|cases|chat|job-description|onboarding|timeline)/")

# `type="date"`, `type="time"`, `type="color"` and `type="range"` paint their
# own edit fields everywhere they are supported, so a placeholder on one is
# inert. NOTE WHAT IS NOT ON THIS LIST.
INERT_TYPES = ("date", "datetime-local", "time", "color", "range")

# `month` AND `week` ARE THE OPPOSITE CASE, AND THIS GATE HAD THEM BACKWARDS
# ON ITS FIRST RUN. Firefox has never implemented either: `caniuse-lite` in
# this repo marks `input-datetime` PARTIAL for Firefox all the way through 157
# (read with `node -e` against `caniuse-lite/data/features/input-datetime.js`,
# not from memory), and an unsupported `type` falls back to the Text state per
# the HTML spec. So on Firefox these are plain text boxes: no picker, no format
# hint, nothing. The placeholder is the ONLY thing telling that reader what
# shape to type, and every caller here then matches the value against a
# YYYY-MM regex and silently drops anything else. Missing is the defect here,
# not present.
NEEDS_FALLBACK_TYPES = ("month", "week")
FALLBACK_INPUT_RE = re.compile(
    r'<input\b(?:[^<>{}]|\{[^{}]*\})*?type="(month|week)"(?:[^<>{}]|\{[^{}]*\})*?/?>',
    re.S,
)

# A TEXTAREA'S PLACEHOLDER WRAPS. Every engine lays it out across the box's
# lines, so length is a style question there and not a truncation defect. It is
# reported, never failed - the first version of this gate flagged the contact
# form's 92-character prompt, which renders in full on a phone across 4 lines.
TEXTAREA_RE = re.compile(r"<textarea", re.I)


def find_inter() -> str:
    """The latin Inter subset the build actually ships."""
    best: tuple[int, str] | None = None
    for p in glob.glob(os.path.join(ROOT, ".next/static/media/*.woff2")):
        try:
            f = TTFont(p, lazy=True)
            if (f["name"].getDebugName(1) or "") != "Inter":
                continue
            cmap = f.getBestCmap()
            need = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 ,.'-/()"
            if not all(ord(c) in cmap for c in need):
                continue
            n = len(cmap)
            if best is None or n < best[0]:
                best = (n, p)
        except Exception:
            continue
    if best is None:
        sys.exit(
            "No Inter latin subset under .next/static/media. Run a build (or "
            "`pnpm dev` once) so next/font materialises the file, then re-run."
        )
    return best[1]


class Metrics:
    def __init__(self, path: str) -> None:
        self._path = path
        self._cache: dict[int, tuple[dict, object, int]] = {}

    def _at(self, wght: int):
        if wght not in self._cache:
            f = TTFont(self._path)
            inst = instancer.instantiateVariableFont(f, {"wght": float(wght)}, inplace=False)
            self._cache[wght] = (inst.getBestCmap(), inst["hmtx"], inst["head"].unitsPerEm)
        return self._cache[wght]

    def width(self, s: str, px: float, wght: int) -> float:
        cmap, hmtx, upm = self._at(wght)
        total = 0
        for ch in s:
            g = cmap.get(ord(ch)) or cmap.get(ord("n"))
            total += hmtx[g][0]
        return total / upm * px


PLACEHOLDER_RE = re.compile(r'placeholder=(?:"([^"]*)"|\{`([^`{}]*)`\})')


def element_classes(text: str, at: int) -> str:
    """The className of the element the placeholder sits on.

    Scans BACK to the opening `<` of this tag and FORWARD to its `>`, so a
    `className` written after the placeholder counts too. Falls back to the
    surrounding 400 characters when the tag cannot be bounded (a spread prop,
    a multi-line template), which over-reports context rather than under.
    """
    start = text.rfind("<", max(0, at - 1200), at)
    end = text.find(">", at)
    if start == -1 or end == -1:
        return text[max(0, at - 200): at + 200]
    return text[start:end]


def scan(paths: list[str], metrics: Metrics) -> list[dict]:
    out: list[dict] = []
    for path in paths:
        with open(path, encoding="utf-8") as fh:
            text = fh.read()
        for m in PLACEHOLDER_RE.finditer(text):
            value = m.group(1) if m.group(1) is not None else m.group(2)
            if value is None or "${" in value:
                continue  # interpolated: its width is not knowable from source
            ctx = element_classes(text, m.start())
            px = DEFAULT_PX
            for k, v in TEXT_PX.items():
                if re.search(rf"\b{k}\b", ctx):
                    px = v
                    break
            wght = DEFAULT_WGHT
            for k, v in WEIGHT.items():
                if re.search(rf"\b{k}\b", ctx):
                    wght = v
                    break
            tm = re.search(r'type="([a-z-]+)"', ctx)
            itype = tm.group(1) if tm else ""
            wraps = bool(TEXTAREA_RE.search(ctx))
            out.append({
                "file": os.path.relpath(path, ROOT),
                "line": text.count("\n", 0, m.start()) + 1,
                "text": value,
                "px": metrics.width(value, px, wght),
                "size": px,
                "wght": wght,
                "budget": NARROW.get(value, BUDGET_PX),
                "inert": itype in INERT_TYPES,
                "wraps": wraps,
            })
    return out


def scan_fallbacks(paths: list[str]) -> list[dict]:
    """`month` / `week` inputs with no placeholder for the Firefox fallback."""
    out: list[dict] = []
    for path in paths:
        with open(path, encoding="utf-8") as fh:
            text = fh.read()
        for m in FALLBACK_INPUT_RE.finditer(text):
            if "placeholder=" in m.group(0):
                continue
            out.append({
                "file": os.path.relpath(path, ROOT),
                "line": text.count("\n", 0, m.start()) + 1,
                "type": m.group(1),
            })
    return out


def collect(all_files: bool) -> list[str]:
    seen: set[str] = set()
    for g in PUBLIC_GLOBS:
        for p in glob.glob(os.path.join(ROOT, g), recursive=True):
            rel = os.path.relpath(p, ROOT)
            if re.search(r"\.(stories|test)\.tsx$|/__tests__/", rel):
                continue
            if not all_files and SKIP_RE.search("/" + rel):
                continue
            seen.add(p)
    return sorted(seen)


def probe(metrics: Metrics) -> int:
    """A gate's first run is mostly the gate. Six fixtures, three of each."""
    cases = [
        # (string, size, weight, must_exceed_budget)
        ("Search employers, firms, pages, or paste any DOL case number", 16, 400, True),
        ("Case number, employer or job title", 16, 500, True),
        ("Start of the employer's name", 16, 500, True),
        ("e.g. Fragomen", 16, 500, False),
        ("G-100-24339-516453", 16, 500, False),
        ("you@example.com", 16, 500, False),
    ]
    bad = 0
    for s, px, w, should_fail in cases:
        got = metrics.width(s, px, w)
        failed = got > BUDGET_PX
        ok = failed == should_fail
        bad += 0 if ok else 1
        print(f"  {'ok  ' if ok else 'BAD '} {got:6.1f}px  expect {'over' if should_fail else 'under'} {BUDGET_PX:.0f}  {s!r}")
    # The metrics themselves: a fixed reference so a font swap is visible.
    ref = metrics.width("abcdefghijklmnopqrstuvwxyz", 16, 400)
    print(f"  reference: 'a-z' at 16px/400 = {ref:.1f}px (Inter latin: 223.1px)")
    if abs(ref - 223.1) > 1.0:
        print("  BAD  reference width drifted: the font file changed")
        bad += 1
    return bad


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--all", action="store_true", help="include the authenticated app")
    ap.add_argument("--probe", action="store_true", help="self-test and exit")
    args = ap.parse_args()

    font = find_inter()
    metrics = Metrics(font)
    print(f"font: {os.path.relpath(font, ROOT)}")

    if args.probe:
        print("probe:")
        bad = probe(metrics)
        print(f"probe: {bad} unexpected")
        return 1 if bad else 0

    files = collect(args.all)
    rows = scan(files, metrics)
    print(f"scanned {len(files)} files, {len(rows)} literal placeholders")
    if len(rows) < 10:
        print("FAIL: too few placeholders found; the scan is broken, not the code")
        return 1

    over = [r for r in rows if r["px"] > r["budget"] and not r["wraps"]]
    wrapped = [r for r in rows if r["px"] > r["budget"] and r["wraps"]]
    inert = [r for r in rows if r["inert"]]
    missing = scan_fallbacks(files)

    for r in sorted(over, key=lambda r: -r["px"]):
        print(f"  OVER  {r['px']:6.1f}px / {r['budget']:.0f}  {r['file']}:{r['line']}  {r['text']!r}")
    for r in inert:
        print(f"  INERT type on a control that never paints a placeholder: {r['file']}:{r['line']}  {r['text']!r}")
    for r in missing:
        print(f"  NO FALLBACK HINT  type=\"{r['type']}\" with no placeholder (Firefox shows a bare text box): {r['file']}:{r['line']}")
    for r in wrapped:
        print(f"  note  {r['px']:6.1f}px  textarea, wraps rather than clips: {r['file']}:{r['line']}")

    print(
        f"{len(over)} over budget, {len(inert)} inert, "
        f"{len(missing)} missing a fallback hint, {len(wrapped)} long-but-wrapping"
    )
    return 1 if (over or inert or missing) else 0


if __name__ == "__main__":
    raise SystemExit(main())
