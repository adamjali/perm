"""Crop and encode the attorney page's product pictures, and write their manifest.

The captures come from the "Tour/" and "Home/Attorney hero timeline" stories,
taken with the clock fixed to the recording's day (2026-10-01), reduced motion,
at device scale 2: each app page at 1280 and 430 wide, in both themes; the
timeline (its story is named "hero") at 1300 and 700; the assistant panel; the
reminder email (light only). Name them <capture>-<theme>[-phone].png in one
folder, then:

    python3 scripts/tour_shots.py <captures-folder> [--only surface,surface]

`--only` rebuilds just those surfaces (and the guide crops cut from their
captures) from the folder; every other picture is left as it is and keeps its
manifest entry, read from the file on disk. Writes public/images/for-attorneys/<surface>-<theme>[-phone].webp and
src/components/marketing/tourShots.ts, which declares each file's real size.
"""

from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public/images/for-attorneys"
MANIFEST = ROOT / "src/components/marketing/tourShots.ts"

# Each picture: the capture it is cut from, then its crop in CSS pixels (the
# captures are at scale 2) for the wide and the phone capture. A crop is
# (top, bottom) or (left, top, right, bottom); None keeps the whole capture.
# The edit page's crops skip the save bar, which is pinned to the screen and so
# lands mid-form in a full-page capture.
SURFACES = {
    # The hero: the dashboard's deadline hub alone, without the page heading.
    "hub": ("dashboard", (159, 871), (242, 907)),
    "timeline": ("hero", None, None),
    "dashboard": ("dashboard", (0, 1027), (0, 987)),
    "cases": ("cases", (0, 870), (0, 1060)),
    "case-detail": ("case-detail", (0, 1120), (0, 1180)),
    "edit-case": ("edit-case", (950, 1760), (1200, 2000)),
    "calendar": ("calendar", (0, 1070), None),
    "notifications": ("notifications", None, (0, 940)),
}
# One picture per theme, no phone version. The email keeps its card and drops
# its footer; the case card is the first card on the cases page.
SINGLE = {
    "assistant": ("assistant", None),
    "email": ("email", (10, 610)),
    "case-card": ("cases", (14, 268, 432, 612)),
}
# Crops of a capture for the guides' figures, outside the attorney page's manifest:
# out name -> (capture, crop). The dashboard's case summary strip.
EXTRA = {"case-summary-light": ("dashboard-light", (879, 1299))}

WIDE_WIDTH = 1800  # twice the widest the frame is drawn
QUALITY = 85


def encode(src: Path, crop: tuple[int, ...] | None, width: int | None, out: Path) -> tuple[int, int]:
    im = Image.open(src).convert("RGB")
    if crop:
        left, top, right, bottom = crop if len(crop) == 4 else (0, crop[0], im.width // 2, crop[1])
        im = im.crop((2 * left, 2 * top, min(2 * right, im.width), min(2 * bottom, im.height)))
    if width and im.width > width:
        im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
    out.parent.mkdir(parents=True, exist_ok=True)
    im.save(out, "WEBP", quality=QUALITY, method=6)
    return im.size


def kept(surface: str, key: str, name: str, shots: dict) -> None:
    """A picture left as it is: its manifest entry, read from the file itself."""
    out = OUT / f"{name}.webp"
    if out.exists():
        with Image.open(out) as im:
            shots.setdefault(surface, {})[key] = (f"/images/for-attorneys/{name}.webp", *im.size)


def main(folder: str, only: set[str] | None = None) -> int:
    src = Path(folder)
    shots: dict[str, dict[str, tuple[str, int, int]]] = {}
    wanted = (lambda s: only is None or s in only)

    def add(surface: str, key: str, capture: str, name: str, crop, width) -> None:
        png = src / f"{capture}.png"
        if not png.exists():
            raise SystemExit(f"missing capture {png}")
        out = OUT / f"{name}.webp"
        w, h = encode(png, crop, width, out)
        shots.setdefault(surface, {})[key] = (f"/images/for-attorneys/{name}.webp", w, h)
        print(f"{out.relative_to(ROOT)}  {w}x{h}  {out.stat().st_size // 1024} KB")

    for surface, (capture, wide, narrow) in SURFACES.items():
        for theme in ("light", "dark"):
            if wanted(surface):
                add(surface, theme, f"{capture}-{theme}", f"{surface}-{theme}", wide, WIDE_WIDTH)
                add(surface, f"narrow{theme.title()}", f"{capture}-{theme}-phone", f"{surface}-{theme}-phone", narrow, None)
            else:
                kept(surface, theme, f"{surface}-{theme}", shots)
                kept(surface, f"narrow{theme.title()}", f"{surface}-{theme}-phone", shots)
    for surface, (capture, crop) in SINGLE.items():
        for theme in ("light", "dark"):
            if not wanted(surface):
                kept(surface, theme, f"{surface}-{theme}", shots)
            elif (src / f"{capture}-{theme}.png").exists():
                add(surface, theme, f"{capture}-{theme}", f"{surface}-{theme}", crop, None)
        if "dark" not in shots[surface]:
            shots[surface]["dark"] = shots[surface]["light"]

    for name, (capture, crop) in EXTRA.items():
        if only is not None and capture.rsplit("-", 1)[0] not in {SURFACES[s][0] for s in only if s in SURFACES}:
            continue
        out = OUT / f"{name}.webp"
        w, h = encode(src / f"{capture}.png", crop, WIDE_WIDTH, out)
        print(f"{out.relative_to(ROOT)}  {w}x{h}  {out.stat().st_size // 1024} KB (guides)")

    lines = [
        "// Generated by scripts/tour_shots.py from the tour captures; do not edit by hand.",
        'import type { WindowShots } from "./AppWindow";',
        "",
        "export type TourSurface =",
        *[f'  | "{s}"' for s in shots],
        ";",
        "",
        "export const TOUR_SHOTS: Record<TourSurface, WindowShots> = {",
    ]
    for surface, entries in shots.items():
        lines.append(f'  "{surface}": {{')
        for key in ("light", "dark", "narrowLight", "narrowDark"):
            if key in entries:
                path, w, h = entries[key]
                lines.append(f'    {key}: {{ src: "{path}", width: {w}, height: {h} }},')
        lines.append("  },")
    lines.append("};")
    MANIFEST.write_text("\n".join(lines) + "\n")
    print(f"wrote {MANIFEST.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    args = sys.argv[1:]
    picked: set[str] | None = None
    if "--only" in args:
        i = args.index("--only")
        picked = {x for x in args[i + 1].split(",") if x}
        unknown = picked - set(SURFACES) - set(SINGLE)
        if unknown:
            raise SystemExit(f"unknown surfaces: {', '.join(sorted(unknown))}")
        del args[i : i + 2]
    sys.exit(main(args[0], picked))
