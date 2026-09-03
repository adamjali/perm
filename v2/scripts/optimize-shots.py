"""Convert captured PNGs to web-sized WebP.

A retina full-page PNG is 2-4 MB, and page weight is the bill here: a write
unit is 8 KB, and every byte ships on every render. The shots are captured at
deviceScaleFactor 2 so text is sharp, then downscaled to a sane display width
and re-encoded.

Keeps the PNGs on disk but OUT of the build: only the .webp files are
referenced by articles. Prints before/after so the saving is measured, not
assumed.
"""
import sys, pathlib
from PIL import Image

SHOTS = pathlib.Path("public/images/content/shots")
MAX_W = 1600          # 2x the 800px figure width ScreenshotFigure renders at
QUALITY = 82

def main() -> int:
    pngs = sorted(SHOTS.glob("*.png"))
    if not pngs:
        print("no PNGs to convert"); return 1
    before = after = 0
    for p in pngs:
        if p.name.startswith("_"):      # probe shots
            continue
        im = Image.open(p).convert("RGB")
        if im.width > MAX_W:
            im = im.resize((MAX_W, round(im.height * MAX_W / im.width)), Image.LANCZOS)
        out = p.with_suffix(".webp")
        im.save(out, "WEBP", quality=QUALITY, method=6)
        b, a = p.stat().st_size, out.stat().st_size
        before += b; after += a
        bpp = a / (im.width * im.height)
        print(f"  {p.stem:24s} {b/1e6:5.2f}MB -> {a/1e3:6.1f}KB  {im.width}x{im.height}  {bpp:.3f} bpp")
    print(f"\ntotal {before/1e6:.1f} MB -> {after/1e6:.2f} MB  ({after/before:.1%} of original)")
    # A tuned photographic WebP is 0.05-0.12 bpp; UI screenshots are flatter
    # and should land well under that. Anything far above means over-encoding.
    return 0

if __name__ == "__main__":
    sys.exit(main())
