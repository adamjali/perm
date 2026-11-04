"""Every article header's two other shapes, for Google Discover and the Article's structured data.

    python3 scripts/make_hero_crops.py              # every header that lacks a copy or is newer than it
    python3 scripts/make_hero_crops.py --all        # rewrite every copy
    python3 scripts/make_hero_crops.py guides/x     # one article

Google's Discover page (read Nov 4 2026, "Last updated 2026-03-09") asks for a large image at least 1200 px
wide in og:image or the structured data, 16x9, and not a generic or text-heavy one; its Article guide asks for
16x9, 4x3 and 1x1 versions. Every header is 1600x1200 (4:3, scripts/make_article_heroes.py), so:

  <slug>-16x9.webp  1600x900: a photograph's middle band, the band the article cards already show.
  <slug>-1x1.webp   1200x1200: a photograph's middle.
  A header shown whole (a form, a page, an app screen: src/lib/content/whole-heroes.json) is never cut: both
  copies set it whole on its own plain ground, scaled to fit.

src/lib/content/heroCrops.ts names the copies, and src/app/__tests__/hero-crops.test.ts fails a header without
them at these sizes.
"""
from __future__ import annotations

import argparse
import json
import pathlib
import sys

from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parent.parent
HEROES = ROOT / "public" / "images" / "content" / "heroes"
WHOLE = ROOT / "src" / "lib" / "content" / "whole-heroes.json"
W, H = 1600, 1200
WIDE = (1600, 900)
SQUARE = (1200, 1200)
SUFFIXES = ("-16x9", "-1x1")


def whole_set() -> set[str]:
    """The headers shown whole on a plain ground, as /images/... paths."""
    try:
        return set(json.loads(WHOLE.read_text()))
    except FileNotFoundError:
        return set()


def on_ground(im: Image.Image, size: tuple[int, int]) -> Image.Image:
    """A whole header scaled to fit `size`, centred on its own plain ground, so nothing is cut."""
    ground = im.getpixel((2, 2))
    out = Image.new("RGB", size, ground[:3] if isinstance(ground, tuple) else (ground, ground, ground))
    k = min(size[0] / W, size[1] / H)
    scaled = im.resize((round(W * k), round(H * k)), Image.LANCZOS)
    out.paste(scaled, ((size[0] - scaled.width) // 2, (size[1] - scaled.height) // 2))
    return out


def wide(im: Image.Image, whole: bool) -> Image.Image:
    """1600x900: the middle band of a photograph, or a whole header set on its ground.

    A picture shown whole can run past the middle band (measured: docketwise-alternatives-for-perm's form
    lost its last rows), so it's scaled to fit rather than cut.
    """
    if whole:
        return on_ground(im, WIDE)
    top = (H - WIDE[1]) // 2
    return im.crop((0, top, W, top + WIDE[1]))


def square(im: Image.Image, whole: bool) -> Image.Image:
    """1200x1200: the middle of a photograph, or a whole header set on its ground."""
    if whole:
        return on_ground(im, SQUARE)
    left = (W - SQUARE[0]) // 2
    return im.crop((left, 0, left + SQUARE[0], H))


def crops_for(path: pathlib.Path, whole: set[str], force: bool) -> int:
    """Write one header's two copies; the number written."""
    rel = "/" + path.relative_to(ROOT / "public").as_posix()
    im = Image.open(path).convert("RGB")
    if im.size != (W, H):
        raise SystemExit(f"FATAL: {rel} is {im.size[0]}x{im.size[1]}, not {W}x{H}")
    written = 0
    for suffix, make in (("-16x9", lambda: wide(im, rel in whole)), ("-1x1", lambda: square(im, rel in whole))):
        dest = path.with_name(path.stem + suffix + ".webp")
        if not force and dest.exists() and dest.stat().st_mtime >= path.stat().st_mtime:
            continue
        make().save(dest, "WEBP", quality=82, method=6)
        written += 1
    return written


def headers(only: list[str]) -> list[pathlib.Path]:
    found = sorted(p for p in HEROES.glob("*/*.webp") if not p.stem.endswith(SUFFIXES))
    if not only:
        return found
    wanted = {o.strip("/") for o in only}
    return [p for p in found if f"{p.parent.name}/{p.stem}" in wanted]


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("only", nargs="*", help="<type>/<slug> keys; every header when none")
    ap.add_argument("--all", action="store_true", help="rewrite copies that are already newer than their header")
    a = ap.parse_args(argv)
    whole = whole_set()
    todo = headers(a.only)
    if a.only and len(todo) != len(set(a.only)):
        raise SystemExit(f"FATAL: asked for {len(set(a.only))} headers, found {len(todo)}")
    n = sum(crops_for(p, whole, a.all) for p in todo)
    print(f"{len(todo)} headers, {n} copies written")
    return 0


if __name__ == "__main__":
    sys.exit(main())
