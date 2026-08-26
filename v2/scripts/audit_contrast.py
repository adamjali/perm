#!/usr/bin/env python3
"""Contrast audit over the design tokens, in BOTH themes.

Only SEMANTIC pairs. A first version compared every text-ish token against
every surface-ish token and reported 64 failures in light mode, nearly all of
them nonsense like `--accent-foreground` on `--card-foreground` - two text
colours that never meet. A gate whose first run is mostly its own bugs
teaches you to ignore it.
"""
import re, sys, pathlib

CSS = pathlib.Path("src/app/globals.css")

# (text token, surface token, label, is_large_text)
PAIRS = [
    ("--foreground", "--background", "body text on page", False),
    ("--foreground", "--card", "body text on a card", False),
    ("--foreground", "--popover", "body text in a popover", False),
    ("--muted-foreground", "--background", "muted text on page", False),
    ("--muted-foreground", "--card", "muted text on a card", False),
    ("--muted-foreground", "--muted", "muted text on muted", False),
    ("--card-foreground", "--card", "card text", False),
    ("--popover-foreground", "--popover", "popover text", False),
    ("--secondary-foreground", "--secondary", "secondary button label", False),
    ("--accent-foreground", "--accent", "accent surface label", False),
    ("--primary-foreground", "--primary", "primary button label", False),
    ("--destructive-foreground", "--destructive", "destructive button label", False),
    ("--primary-text", "--background", "primary as text on page", False),
    ("--primary-text", "--card", "primary as text on a card", False),
    # --muted is a real text surface (panels, chips). primary-text and
    # destructive-text both FAILED here at 4.3x while the audit stayed green,
    # because these pairs did not exist - found by the sweep agent, not by
    # this script, which is the definition of a gap.
    ("--primary-text", "--muted", "primary as text on muted", False),
    ("--destructive-text", "--muted", "error text on muted", False),
    ("--data-good-ink", "--card", "good ink on a card", False),
    ("--data-good-ink", "--muted", "good ink on muted", False),
    ("--stage-pwd-ink", "--card", "pwd stage as text", False),
    ("--stage-recruitment-ink", "--card", "recruitment stage as text", False),
    ("--stage-eta9089-ink", "--card", "eta9089 stage as text", False),
    ("--stage-i140-ink", "--card", "i140 stage as text", False),
    ("--stage-closed-ink", "--card", "closed stage as text", False),
    ("--destructive-text", "--background", "error text on page", False),
    ("--destructive-text", "--card", "error text on a card", False),
    ("--ring", "--background", "focus ring on page", True),
    ("--border", "--background", "border on page", True),
    ("--border", "--card", "border on a card", True),
]

# Manila pairs. The folder surface stays tan in BOTH themes, so its ink is
# checked as literals against both manila values. This is the class the token
# pairs above cannot see: text-muted-foreground on dark manila measured
# 1.16:1 and shipped, twice, before this section existed.
MANILA = [
    ("#000000", 1.0, "#F5E6C8", "ink on light manila", 4.5),
    ("#000000", 1.0, "#C4A97A", "ink on dark manila", 4.5),
    ("#000000", 0.7, "#F5E6C8", "soft ink (black/70) on light manila", 4.5),
    ("#000000", 0.7, "#C4A97A", "soft ink (black/70) on dark manila", 4.5),
    ("#000000", 1.0, "#E8D4A8", "ink on light manila-dark (tab bar)", 4.5),
    ("#000000", 1.0, "#A8916A", "ink on dark manila-dark (tab bar)", 4.5),
]


# Surfaces and graphics the PAIRS table cannot reach, because they are not
# tokens. `.bg-tint-primary` is `color-mix(in srgb, --primary 12%, --card)`
# and the bar fills are opacity-derived, so both are computed here from the
# real tokens per theme instead of being read as hex literals.
#
# Added after measuring a page by hand found them ungated: tint-primary is
# used on /tools, /calculators and the I-485 queue page and had never been
# checked, and a data bar at foreground/25 measured 1.82:1 against its own
# track, under the 3:1 floor for a graphical object.
#
# (text token or None for a graphic, alpha, surface expression, label, floor)
DERIVED = [
    ("--foreground", 1.0, "tint", "ink on the primary tint", 4.5),
    ("--foreground", 0.7, "tint", "body at 70% on the primary tint", 4.5),
    ("--foreground", 0.6, "tint", "label at 60% on the primary tint", 4.5),
    ("--foreground", 0.45, "muted", "data bar fill against its track", 3.0),
    ("--border", 1.0, "muted", "hatch stroke against the hatched base", 3.0),
]

# Boundaries a reader has to SEE, where more than one thing can carry them.
#
# The certainty bar's two segments meet without a gap. Comparing their fills
# alone reports FAIL at 1.96:1 in light mode and passes at 8.14:1 in dark,
# which is true and is not the question: the segments are separated by a 2px
# --border rule that measures 9.83:1 against lime, and by hatching, which is
# a texture difference no ratio describes. A boundary is perceivable if ANY
# of its carriers clears the floor, so the check takes the best one. Testing
# only the fills would have made this gate permanently red over a boundary
# that is, measurably, the most visible edge on the page.
#
# (label, floor, [(token_a, surface_a), ...] candidate carriers)
BOUNDARIES = [
    ("certainty bar: solid meets hatched", 3.0,
     [("--primary", "muted"), ("--border", "--primary")]),
]


def mix(a, b, pa):
    """color-mix(in srgb, a pa%, b)."""
    return tuple(round(x * pa + y * (1 - pa)) for x, y in zip(a, b))


def blend(fg, bg, a):
    return tuple(round(f * a + b * (1 - a)) for f, b in zip(fg, bg))


def blocks():
    s = CSS.read_text()
    def one(sel):
        m = re.search(re.escape(sel) + r"\s*\{(.*?)\n\}", s, re.S)
        return dict(re.findall(r"^\s*(--[\w-]+):\s*([^;]+);", m.group(1), re.M)) if m else {}
    light = one(":root")
    return light, {**light, **one(".dark")}

def rgb(h):
    h = h.strip().lstrip("#")
    if len(h) == 3: h = "".join(c * 2 for c in h)
    return tuple(int(h[i:i+2], 16) for i in (0, 2, 4)) if len(h) == 6 else None

def ratio(a, b):
    def lum(c):
        def f(x):
            x /= 255
            return x / 12.92 if x <= 0.03928 else ((x + 0.055) / 1.055) ** 2.4
        r, g, bl = (f(v) for v in c)
        return 0.2126 * r + 0.7152 * g + 0.0722 * bl
    la, lb = lum(a), lum(b)
    return (max(la, lb) + 0.05) / (min(la, lb) + 0.05)

def main() -> int:
    light, dark = blocks()
    print(f"  pairs checked per theme: {len(PAIRS)}")
    bad = 0
    for name, toks in (("LIGHT", light), ("DARK", dark)):
        print(f"\n  === {name} ===")
        for t, s_, label, large in PAIRS:
            a, b = rgb(toks.get(t, "")), rgb(toks.get(s_, ""))
            if not a or not b:
                print(f"    skip  {label} ({t} or {s_} is not a hex literal)")
                continue
            r = ratio(a, b)
            floor = 3.0 if large else 4.5
            ok = r >= floor
            if not ok: bad += 1
            print(f"    {'ok  ' if ok else 'FAIL'} {r:5.2f}:1 (need {floor})  {label}"
                  f"  {t}={toks[t].strip()} on {s_}={toks[s_].strip()}")
    for name, toks in (("LIGHT", light), ("DARK", dark)):
        print(f"\n  === {name}, DERIVED SURFACES ===")
        tint = mix(rgb(toks["--primary"]), rgb(toks["--card"]), 0.12)
        surfaces = {"tint": tint, "muted": rgb(toks["--muted"])}
        for tok, a, sfc_name, label, floor in DERIVED:
            sfc = surfaces[sfc_name]
            r = ratio(blend(rgb(toks[tok]), sfc, a), sfc)
            ok = r >= floor
            if not ok:
                bad += 1
            print(f"    {'ok  ' if ok else 'FAIL'} {r:5.2f}:1 (need {floor})  {label}")
        for label, floor, carriers in BOUNDARIES:
            best = max(
                ratio(surfaces.get(a) or rgb(toks[a]), surfaces.get(b) or rgb(toks[b]))
                for a, b in carriers
            )
            ok = best >= floor
            if not ok:
                bad += 1
            print(f"    {'ok  ' if ok else 'FAIL'} {best:5.2f}:1 (need {floor})  "
                  f"{label} (best carrier of {len(carriers)})")

    print("\n  === MANILA (theme-invariant surface) ===")
    for fg, a, sfc, label, floor in MANILA:
        eff = blend(rgb(fg), rgb(sfc), a)
        r = ratio(eff, rgb(sfc))
        ok = r >= floor
        if not ok:
            bad += 1
        print(f"    {'ok  ' if ok else 'FAIL'} {r:5.2f}:1 (need {floor})  {label}")

    print(f"\n  {bad} real failures")
    return 1 if bad else 0

if __name__ == "__main__":
    sys.exit(main())
