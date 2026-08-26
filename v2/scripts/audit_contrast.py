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
