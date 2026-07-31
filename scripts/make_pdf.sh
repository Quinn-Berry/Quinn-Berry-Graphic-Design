#!/usr/bin/env bash
# Build the PDF edition of the portfolio from print.html.
#
#   ./scripts/make_pdf.sh
#
# Steps: print-resolution images -> live-site screenshots -> serve the folder
# -> render print.html to PDF with Chrome.
#
# print.html is served over http rather than opened from disk because it
# fetches manifest.json, which browsers block on file:// URLs.
#
# Requires: Google Chrome, python3, Pillow, websocket-client.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
PORT="${PORT:-8749}"
OUT="$ROOT/Quinn-Berry-Graphic-Design-Portfolio.pdf"

cd "$ROOT"

[ -x "$CHROME" ] || { echo "Google Chrome not found at $CHROME"; exit 1; }

echo "==> print-resolution images"
python3 scripts/make_print_assets.py

echo "==> live-site screenshots"
python3 scripts/capture_sites.py

echo "==> serving on :$PORT"
python3 -m http.server "$PORT" --bind 127.0.0.1 >/dev/null 2>&1 &
SERVER=$!
trap 'kill $SERVER 2>/dev/null || true' EXIT
sleep 2

echo "==> rendering PDF"
"$CHROME" --headless=new --disable-gpu --no-pdf-header-footer \
  --virtual-time-budget=20000 \
  --print-to-pdf="$OUT" "http://127.0.0.1:$PORT/print.html" >/dev/null 2>&1

echo "==> wrote $(basename "$OUT") ($(du -h "$OUT" | cut -f1))"
