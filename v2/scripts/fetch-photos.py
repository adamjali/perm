"""Fetch and optimise stock photos for the article heroes.

Downloaded and self-hosted, never hot-linked: a remote image is a third party
that can change, disappear or start tracking our readers. Each is resized and
re-encoded, because a 3000px Unsplash JPEG is ~1 MB and page weight is a real
cost on this site.

Sources are Unsplash, free for commercial use with no attribution required.
The photos are DECORATIVE. Nothing here illustrates our data, and no caption
may imply otherwise.
"""
import io, json, pathlib, sys, urllib.request
from PIL import Image

OUT = pathlib.Path("public/images/content/photos")
OUT.mkdir(parents=True, exist_ok=True)
UA = {"User-Agent": "Mozilla/5.0"}
MAX_W, QUALITY = 1600, 80

def main(spec_path):
    spec = json.load(open(spec_path))
    seen_hashes = {}
    for name, url in spec.items():
        try:
            req = urllib.request.Request(url, headers=UA)
            raw = urllib.request.urlopen(req, timeout=60).read()
        except Exception as e:
            print(f"FAIL {name}: {str(e)[:70]}"); continue
        im = Image.open(io.BytesIO(raw)).convert("RGB")
        # A duplicate photo under two names is the defect we are fixing, so
        # refuse one rather than shipping it twice.
        h = hash(im.resize((16, 16)).tobytes())
        if h in seen_hashes:
            print(f"DUPLICATE {name} is the same image as {seen_hashes[h]}, skipped"); continue
        seen_hashes[h] = name
        if im.width > MAX_W:
            im = im.resize((MAX_W, round(im.height * MAX_W / im.width)), Image.LANCZOS)
        # 16:9 centre crop, so every hero card is the same shape.
        target_h = round(im.width * 9 / 16)
        if im.height > target_h:
            top = (im.height - target_h) // 2
            im = im.crop((0, top, im.width, top + target_h))
        p = OUT / f"{name}.webp"
        im.save(p, "WEBP", quality=QUALITY, method=6)
        print(f"ok   {name:26s} {im.width}x{im.height}  {p.stat().st_size/1e3:6.1f} KB")
    return 0

if __name__ == "__main__":
    sys.exit(main(sys.argv[1]))
