#!/usr/bin/env python3
"""
Regenerate thumbnails for every PNG in images/ into thumbs/, mirroring the
category folder structure. Safe to re-run: skips thumbs that are already
newer than their source.

Source images are PNG. Thumbnails are WebP - roughly 9x smaller at grid size
with no visible difference, and alpha is preserved so transparent logos still
sit on the page background. Only the filename extension differs; the stem
always matches the source exactly.

Usage:
    python3 scripts/make_thumbs.py            # only build missing/stale thumbs
    python3 scripts/make_thumbs.py --force    # rebuild everything

Requires Pillow:  pip install pillow
"""

import sys
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    sys.exit("Pillow is not installed. Run: pip install pillow")

Image.MAX_IMAGE_PIXELS = None  # portfolio source art is legitimately large

ROOT = Path(__file__).resolve().parent.parent
IMAGES = ROOT / "images"
THUMBS = ROOT / "thumbs"
THUMB_WIDTH = 600
THUMB_EXT = ".webp"
THUMB_QUALITY = 82
TALL_RATIO = 1.6   # images taller than this are top-cropped for the thumb
FORCE = "--force" in sys.argv


def main() -> int:
    if not IMAGES.is_dir():
        sys.exit(f"No images directory at {IMAGES}")

    built = skipped = 0
    src_bytes = thumb_bytes = 0

    for src in sorted(IMAGES.rglob("*.png")):
        rel = src.relative_to(IMAGES)
        dst = (THUMBS / rel).with_suffix(THUMB_EXT)
        dst.parent.mkdir(parents=True, exist_ok=True)

        if not FORCE and dst.exists() and dst.stat().st_mtime >= src.stat().st_mtime:
            skipped += 1
            thumb_bytes += dst.stat().st_size
            src_bytes += src.stat().st_size
            continue

        with Image.open(src) as im:
            im = im.convert("RGBA")  # keeps alpha for transparent logos

            # Very tall images (full-page web captures) become unreadable
            # slivers if scaled whole. Crop the top instead - that's the part
            # a viewer recognises. The full image is still in images/.
            if im.height / im.width > TALL_RATIO:
                im = im.crop((0, 0, im.width, round(im.width * TALL_RATIO)))

            if im.width > THUMB_WIDTH:
                height = round(im.height * THUMB_WIDTH / im.width)
                im = im.resize((THUMB_WIDTH, height), Image.LANCZOS)
            im.save(dst, "WEBP", quality=THUMB_QUALITY, method=6)

        built += 1
        src_bytes += src.stat().st_size
        thumb_bytes += dst.stat().st_size
        print(f"  thumb  {dst.relative_to(THUMBS)}  ({dst.stat().st_size / 1024:.0f} KB)")

    # Any thumb whose source is gone is stale - report it rather than delete.
    for old in sorted(THUMBS.rglob("*")):
        if old.is_file() and old.suffix in (THUMB_EXT, ".png"):
            source = (IMAGES / old.relative_to(THUMBS)).with_suffix(".png")
            if not source.exists():
                print(f"  STALE  {old.relative_to(THUMBS)}  (no matching source image)")

    print(f"\nDone. {built} built, {skipped} up to date.")
    if thumb_bytes:
        print(f"Grid payload: {thumb_bytes / 1024:.0f} KB of thumbs "
              f"vs {src_bytes / 1024 / 1024:.1f} MB of originals.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
