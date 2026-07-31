#!/usr/bin/env python3
"""
Build print-resolution JPEGs into print-assets/ for the PDF edition of the
portfolio (print.html). Mirrors the category folder structure like thumbs/.

Why a third size: thumbs/ are 600px WebP, which prints soft, and the originals
are 90 MB, which makes an unmailable PDF. 1400px JPEG lands around 200 DPI at
the size these run on the page.

Transparency is flattened here rather than in the browser, because a PDF has no
page background to sit on: alpha would render black. Files listed in a project's
darkBacked array are composited onto the dark surface, everything else onto the
off-white page colour - the same rule the site follows. See CLAUDE.md section 6.

Usage:
    python3 scripts/make_print_assets.py            # only build missing/stale
    python3 scripts/make_print_assets.py --force    # rebuild everything

Requires Pillow:  pip install pillow
"""

import json
import sys
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    sys.exit("Pillow is not installed. Run: pip install pillow")

Image.MAX_IMAGE_PIXELS = None  # portfolio source art is legitimately large

ROOT = Path(__file__).resolve().parent.parent
MANIFEST = ROOT / "manifest.json"
IMAGES = ROOT / "images"
PRINT = ROOT / "print-assets"

PRINT_WIDTH = 1400
QUALITY = 88
PAGE_BG = (243, 240, 233)   # --bg  #F3F0E9
DARK_BG = (20, 17, 14)      # --dark-bg  #14110E
FORCE = "--force" in sys.argv


def main() -> int:
    m = json.loads(MANIFEST.read_text())
    cats = {c["id"]: c for c in m["categories"]}

    built = skipped = 0
    out_bytes = 0

    for p in m["projects"]:
        cat = cats[p["category"]]
        dark = set(p.get("darkBacked", []))

        for fn in p["images"]:
            src = IMAGES / cat["dir"] / fn
            dst = (PRINT / cat["dir"] / fn).with_suffix(".jpg")
            dst.parent.mkdir(parents=True, exist_ok=True)

            if not src.exists():
                print(f"  MISSING  {src.relative_to(ROOT)}")
                continue

            if not FORCE and dst.exists() and dst.stat().st_mtime >= src.stat().st_mtime:
                skipped += 1
                out_bytes += dst.stat().st_size
                continue

            with Image.open(src) as im:
                im = im.convert("RGBA")

                if im.width > PRINT_WIDTH:
                    height = round(im.height * PRINT_WIDTH / im.width)
                    im = im.resize((PRINT_WIDTH, height), Image.LANCZOS)

                bg = DARK_BG if fn in dark else PAGE_BG
                flat = Image.new("RGB", im.size, bg)
                flat.paste(im, mask=im.split()[3])
                flat.save(dst, "JPEG", quality=QUALITY, optimize=True,
                          progressive=True)

            built += 1
            out_bytes += dst.stat().st_size
            print(f"  print  {dst.relative_to(PRINT)}  ({dst.stat().st_size / 1024:.0f} KB)")

    print(f"\nDone. {built} built, {skipped} up to date.")
    print(f"PDF image payload: {out_bytes / 1024 / 1024:.1f} MB.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
