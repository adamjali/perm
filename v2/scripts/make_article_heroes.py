#!/usr/bin/env python3
"""Make every article's picture: 1600x1200 WebP, one per article, from its source.

    python3 scripts/make_article_heroes.py --photos DIR --forms DIR --captures DIR [slug ...]

`scripts/article-heroes.json` says where each article's picture comes from:

  photo    a licensed photograph (Wikimedia Commons, the Library of Congress, an
           agency), cropped to 4:3 around `focus` ([x, y] as fractions)
  pdf      a page of an official form or bulletin, rendered at 200 dpi and cut
           to 4:3 from its top (or its foot, with "anchor": "bottom")
  tour     a picture of the signed-in app from public/images/for-attorneys
  capture  a live page, captured by scripts/capture_article_heroes.mjs

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


def fit43(im: Image.Image, pad: float = 0.06) -> Image.Image:
    ground = Image.new("RGB", (W, H), (244, 244, 241))
    box = im.copy()
    box.thumbnail((int(W * (1 - 2 * pad)), int(H * (1 - 2 * pad))), Image.LANCZOS)
    ground.paste(box, ((W - box.width) // 2, (H - box.height) // 2))
    return ground


def render_pdf(path: pathlib.Path, page: int, top: float, anchor: str) -> Image.Image:
    import fitz  # PyMuPDF

    doc = fitz.open(path)
    pix = doc[page].get_pixmap(dpi=200)
    im = Image.open(io.BytesIO(pix.tobytes("png"))).convert("RGB")
    w, h = im.size
    ch = w * 3 // 4
    y = h - ch if anchor == "bottom" else int(top * h)
    return im.crop((0, y, w, y + ch)).resize((W, H), Image.LANCZOS)


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
    return im


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--photos", type=pathlib.Path, required=True)
    ap.add_argument("--forms", type=pathlib.Path, required=True)
    ap.add_argument("--captures", type=pathlib.Path, required=True)
    ap.add_argument("only", nargs="*")
    a = ap.parse_args()
    spec = json.loads((ROOT / "scripts" / "article-heroes.json").read_text())
    bad = 0
    figures = json.loads((ROOT / "scripts" / "article-figures.json").read_text())
    for key, s in figures.items():
        if a.only and key not in a.only:
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
    for key, s in spec.items():
        if a.only and key not in a.only:
            continue
        kind, slug = key.split("/", 1)
        try:
            if "photo" in s:
                fx, fy = s["photo"].get("focus", [0.5, 0.5])
                src = Image.open(a.photos / s["photo"]["file"]).convert("RGB")
                # "contain" keeps a whole object (a card, a document) on a plain
                # ground instead of cutting its edges off to fill 4:3.
                im = fit43(src) if s["photo"].get("fit") == "contain" else crop43(src, fx, fy)
            elif "pdf" in s:
                p = s["pdf"]
                im = render_pdf(a.forms / p["file"], p["page"], p.get("top", 0.0), p.get("anchor", "top"))
            elif "tour" in s:
                fx, fy = s["tour"].get("focus", [0.5, 0.0])
                im = crop43(Image.open(ROOT / "public" / "images" / "for-attorneys" / s["tour"]["file"]).convert("RGB"), fx, fy)
            elif "capture" in s:
                src = Image.open(a.captures / f"{key}.png").convert("RGB")
                # "contain" keeps a wide chart whole on a plain ground; a 4:3
                # crop from its middle cut both ends off.
                im = fit43(src) if s["capture"].get("fit") == "contain" else crop43(src, 0.5, 0.0)
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
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
