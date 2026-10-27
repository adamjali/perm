#!/usr/bin/env python3
"""Make every article's picture: 1600x1200 WebP, one per article, from its source.

    python3 scripts/make_article_heroes.py --photos DIR --forms DIR --captures DIR [slug ...]

`scripts/article-heroes.json` says where each article's picture comes from:

  photo    a licensed photograph (Wikimedia Commons, the Library of Congress, an
           agency), cropped to 4:3 around `focus` ([x, y] as fractions); a
           document ("fit": "contain", or a file that is a PDF) is shown whole
  pdf      a page of an official form or bulletin, rendered at 200 dpi, whole
  tour     a picture of the signed-in app from public/images/for-attorneys, whole
  capture  a live page, captured by scripts/capture_article_heroes.mjs, whole,
           its bottom cut back to a blank band if the capture ran through a block

Everything but a photograph of a place is shown whole on a plain ground, inside
the band a 16:9 guide card shows (Oct 26 2026: 110 of 127 headers were 4:3
crops that ended mid-chart or mid-sentence). Those are listed in
src/lib/content/whole-heroes.json, which the guide cards read.

and the credit, link and alt text printed with it. The pictures land in
public/images/content/heroes/<type>/<slug>.webp, so two articles can't share
one, and article-pictures.test.ts holds the frontmatter to this file.

`scripts/article-figures.json` does the same for pictures inside an article's
text (keys `<type>/<slug>/<name>`), kept at their own shape rather than cut to
4:3, in public/images/content/figures/<type>/<slug>-<name>.webp.
"""

import argparse
import io
import json
import pathlib
import sys

from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "images" / "content" / "heroes"
W, H = 1600, 1200


def crop43(im: Image.Image, fx: float = 0.5, fy: float = 0.5) -> Image.Image:
    w, h = im.size
    if w * 3 > h * 4:  # wider than 4:3: cut the sides
        cw, ch = h * 4 // 3, h
    else:
        cw, ch = w, w * 3 // 4
    x = min(max(int(fx * w - cw / 2), 0), w - cw)
    y = min(max(int(fy * h - ch / 2), 0), h - ch)
    return im.crop((x, y, x + cw, y + ch)).resize((W, H), Image.LANCZOS)


GROUND = (244, 244, 241)
# A whole picture sits inside the middle band a 16:9 guide card shows (1600x900 of the 1200 rows),
# with room around it, so neither the article's 4:3 frame nor a card cuts anything off.
SAFE_W, SAFE_H = 1440, 790


def fit43(im: Image.Image) -> Image.Image:
    """The whole picture on a plain ground, framed by a 2px ink border (Oct 26 2026: every header
    that was a 4:3 crop of a taller page, form or app screen ended mid-chart or mid-sentence)."""
    ground = Image.new("RGB", (W, H), GROUND)
    box = im.copy()
    box.thumbnail((SAFE_W, SAFE_H), Image.LANCZOS)
    x, y = (W - box.width) // 2, (H - box.height) // 2
    ground.paste(box, (x, y))
    from PIL import ImageDraw

    ImageDraw.Draw(ground).rectangle((x - 2, y - 2, x + box.width + 1, y + box.height + 1), outline=(20, 20, 20), width=2)
    return ground


def trim_to_gap(im: Image.Image, keep_min: float = 0.55) -> Image.Image:
    """Cut a capture whose bottom edge runs through a block back to the last blank band above it,
    so the picture ends between two blocks rather than halfway through one. A capture that already
    ends on blank rows is left as it is."""
    import numpy as np

    a = np.asarray(im.convert("L"), dtype=np.int16)
    bg = int(np.median(np.concatenate([a[:, :8].ravel(), a[:, -8:].ravel()])))
    blank = (np.abs(a - bg) <= 6).mean(axis=1) > 0.995
    h = a.shape[0]
    if blank[-12:].all():
        return im
    run = 0
    for y in range(h - 1, int(h * keep_min), -1):
        run = run + 1 if blank[y] else 0
        if run >= 14:
            top = y
            while top > 0 and blank[top - 1]:
                top -= 1
            return im.crop((0, 0, im.width, min(h, top + 12)))
    return im


def drop_orphan_end(im: Image.Image) -> Image.Image:
    """Take off what a capture's bottom edge caught of the next section: its rule, its heading, or
    its heading and one-line note, sitting alone under a wide gap. At most three rounds, never more
    than 40% of the picture. Measured on the captures of Oct 26 2026: a heading block is under 60
    rows tall and sits 56 or more rows below the block above it."""
    import numpy as np

    a = np.asarray(im.convert("L"), dtype=np.int16)
    bg = int(np.median(np.concatenate([a[:, :8].ravel(), a[:, -8:].ravel()])))
    ink = np.abs(a - bg) > 6
    blank = ink.mean(axis=1) < 0.005
    h = a.shape[0]

    blocks, y = [], 0
    while y < h:
        if blank[y]:
            y += 1
            continue
        start = y
        while y < h and not blank[y]:
            y += 1
        if blocks and start - blocks[-1][1] < 14:
            blocks[-1][1] = y
        else:
            blocks.append([start, y])

    def is_rule(b: list[int]) -> bool:
        """A thin line across most of the width: a section rule, not the edge of a box."""
        return b[1] - b[0] <= 10 and ink[b[0] : b[1]].mean(axis=1).max() > 0.55

    def short(b: list[int]) -> bool:
        return b[1] - b[0] <= 60

    cut = h
    for _ in range(3):
        kept = list(blocks)
        if blocks and is_rule(blocks[-1]):
            blocks.pop()
        if len(blocks) >= 3 and short(blocks[-1]) and blocks[-1][0] - blocks[-2][1] >= 56:
            blocks.pop()
        elif (
            len(blocks) >= 4
            and short(blocks[-1])
            and short(blocks[-2])
            and blocks[-1][0] - blocks[-2][1] < 40
            and blocks[-2][0] - blocks[-3][1] >= 56
        ):
            blocks.pop()
            blocks.pop()
        if blocks and is_rule(blocks[-1]):
            blocks.pop()
        if not blocks or len(blocks) == len(kept) or blocks[-1][1] + 12 < h * 0.6:
            blocks = kept
            break
        cut = min(h, blocks[-1][1] + 12)
    return im if cut >= h else im.crop((0, 0, im.width, cut))

def page_image(path: pathlib.Path, page: int = 0) -> Image.Image:
    """One whole page of a PDF."""
    import fitz  # PyMuPDF

    pix = fitz.open(path)[page].get_pixmap(dpi=200)
    return Image.open(io.BytesIO(pix.tobytes("png"))).convert("RGB")


def figure(key: str, s: dict, a: argparse.Namespace) -> Image.Image:
    """An inline figure keeps its own shape: a whole photo, a page band, a full capture."""
    if "photo" in s:
        im = Image.open(a.photos / s["photo"]["file"]).convert("RGB")
    elif "pdf" in s:
        import fitz  # PyMuPDF

        p = s["pdf"]
        page = fitz.open(a.forms / p["file"])[p["page"]]
        pix = page.get_pixmap(dpi=200)
        im = Image.open(io.BytesIO(pix.tobytes("png"))).convert("RGB")
        # "mark": the words the article quotes, highlighted like a marker on paper: a lime tint
        # behind each line of the match (multiplied, so the print stays black) and the lime
        # ink (5.45:1 on white) under it
        for phrase in [p["mark"]] if isinstance(p.get("mark"), str) else p.get("mark", []):
            hits = page.search_for(phrase)
            if not hits:
                raise ValueError(f"{key}: mark not found on the page: {phrase!r}")
            from PIL import ImageChops, ImageDraw

            k = 200 / 72
            tint = Image.new("RGB", im.size, "white")
            ink = ImageDraw.Draw(tint)
            for r in hits:
                ink.rectangle((r.x0 * k - 4, r.y0 * k + 2, r.x1 * k + 4, r.y1 * k), fill="#A1E8A9")
            im = ImageChops.multiply(im, tint)
            line = ImageDraw.Draw(im)
            for r in hits:
                line.rectangle((r.x0 * k - 4, r.y1 * k, r.x1 * k + 4, r.y1 * k + 3), fill="#1A7A25")
        top, height = p.get("top", 0.0), p.get("height", 1.0)
        im = im.crop((0, int(top * im.height), im.width, int(min(1.0, top + height) * im.height)))
    elif "capture" in s:
        im = Image.open(a.captures / f"{key}.png").convert("RGB")
    else:
        raise ValueError("no source")
    if im.width > W:
        im = im.resize((W, round(im.height * W / im.width)), Image.LANCZOS)
    # "trim": rows taken off the finished picture where the capture's edge ran through a heading or
    # a row ({"top": n, "bottom": n}). Measured on the capture the credit dates: re-measure it, or
    # drop it, when the figure is captured again.
    t = s.get("trim")
    if t:
        im = im.crop((0, t.get("top", 0), im.width, im.height - t.get("bottom", 0)))
    return im


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--photos", type=pathlib.Path, required=True)
    ap.add_argument("--forms", type=pathlib.Path, required=True)
    ap.add_argument("--captures", type=pathlib.Path, required=True)
    ap.add_argument("--heroes-only", action="store_true", help="make the header pictures and leave the inline figures alone")
    ap.add_argument("only", nargs="*")
    a = ap.parse_args()
    spec = json.loads((ROOT / "scripts" / "article-heroes.json").read_text())
    bad = 0
    figures = json.loads((ROOT / "scripts" / "article-figures.json").read_text())
    for key, s in figures.items():
        if a.heroes_only or (a.only and key not in a.only):
            continue
        kind, rest = key.split("/", 1)
        try:
            im = figure(key, s, a)
        except Exception as e:  # noqa: BLE001
            print(f"FAIL {key}: {e}")
            bad += 1
            continue
        dest = ROOT / "public" / "images" / "content" / "figures" / kind / f"{rest.replace('/', '-')}.webp"
        dest.parent.mkdir(parents=True, exist_ok=True)
        im.save(dest, "WEBP", quality=82, method=6)
        print(f"ok {key} {dest.stat().st_size // 1024} KB")
    whole: list[str] = []
    for key, s in spec.items():
        if a.only and key not in a.only:
            continue
        kind, slug = key.split("/", 1)
        # Listed whether or not this run remakes the file, so a header whose source is missing
        # today keeps its card showing it whole.
        photo = a.photos / s["photo"]["file"] if "photo" in s else None
        if "photo" not in s or s["photo"].get("fit") == "contain" or (
            photo is not None and photo.exists() and photo.read_bytes()[:4] == b"%PDF"
        ):
            whole.append(key)
        try:
            # A photograph of a place is cut to 4:3 around its focus; everything else (a form, a
            # page of the site, an app screen, a document someone published) is shown whole.
            if "photo" in s:
                fx, fy = s["photo"].get("focus", [0.5, 0.5])
                path = a.photos / s["photo"]["file"]
                if path.read_bytes()[:4] == b"%PDF":
                    im = fit43(page_image(path))
                elif s["photo"].get("fit") == "contain":
                    im = fit43(Image.open(path).convert("RGB"))
                else:
                    im = crop43(Image.open(path).convert("RGB"), fx, fy)
            elif "pdf" in s:
                p = s["pdf"]
                im = fit43(page_image(a.forms / p["file"], p["page"]))
            elif "tour" in s:
                im = fit43(Image.open(ROOT / "public" / "images" / "for-attorneys" / s["tour"]["file"]).convert("RGB"))
            elif "capture" in s:
                im = fit43(drop_orphan_end(trim_to_gap(Image.open(a.captures / f"{key}.png").convert("RGB"))))
            else:
                raise ValueError("no source")
        except Exception as e:  # noqa: BLE001 - report and carry on to the next
            print(f"FAIL {key}: {e}")
            bad += 1
            continue
        dest = OUT / kind / f"{slug}.webp"
        dest.parent.mkdir(parents=True, exist_ok=True)
        im.save(dest, "WEBP", quality=82, method=6)
        print(f"ok {key} {dest.stat().st_size // 1024} KB")
    # Every header shown whole, for the guide cards: they show these with object-contain on the
    # same ground, where a photograph still fills its card.
    if not a.only:
        listed = sorted(f"/images/content/heroes/{k}.webp" for k in whole)
        (ROOT / "src" / "lib" / "content" / "whole-heroes.json").write_text(json.dumps(listed, indent=1) + "\n")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
