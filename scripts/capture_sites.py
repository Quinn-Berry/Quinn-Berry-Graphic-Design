#!/usr/bin/env python3
"""
Capture a screenshot of every live site in the web-design category into
print-assets/web/, for the PDF edition (print.html). A PDF cannot embed the
live <iframe> previews the website uses, so each site needs a still.

Driven by manifest.json like everything else: add a URL there and re-run.

Chrome's plain --screenshot flag is not enough here. These sites fade their
content in on load or on scroll, so a naive headless capture catches a blank
page. This drives Chrome over the DevTools protocol instead, and neutralises
in-flight reveal animations before the shot: any element still sitting at
opacity < 1 is forced visible and un-transformed.

Usage:
    python3 scripts/capture_sites.py            # only capture missing shots
    python3 scripts/capture_sites.py --force    # re-capture everything

Requires Pillow and websocket-client:
    pip install pillow websocket-client
"""

import base64
import json
import subprocess
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

try:
    import websocket
    from PIL import Image
except ImportError:
    sys.exit("Missing deps. Run: pip install pillow websocket-client")

ROOT = Path(__file__).resolve().parent.parent
MANIFEST = ROOT / "manifest.json"
OUT = ROOT / "print-assets" / "web"

CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
PORT = 9222
WIDTH, HEIGHT = 1280, 1500
QUALITY = 86
SETTLE_SECONDS = 6          # let fonts, images and hero media finish loading
FORCE = "--force" in sys.argv

# Sites fade content in; make anything mid-animation fully visible. Only
# elements that are actually transparent are touched, so layouts that use
# transform for positioning are left alone.
SETTLE_JS = """
(() => {
  ['is-in','visible','in-view','revealed','active','loaded','show','animate']
    .forEach(c => document.querySelectorAll('[class]').forEach(el => {
      if ([...el.classList].some(x => x.includes('reveal') || x.includes('fade')))
        el.classList.add(c);
    }));
  document.querySelectorAll('*').forEach(el => {
    const cs = getComputedStyle(el);
    // Leave decorative overlays alone - grain, gradient washes and vignettes
    // are deliberately semi-transparent, and forcing them opaque covers the
    // page. They are identifiable as non-interactive and textless.
    const decorative = cs.pointerEvents === 'none' && !el.textContent.trim();
    if (!decorative && parseFloat(cs.opacity) < 1) {
      el.style.setProperty('opacity', '1', 'important');
      if (cs.transform && cs.transform !== 'none')
        el.style.setProperty('transform', 'none', 'important');
    }
    // Pause rather than remove. Removing the animation lets decorative
    // overlays (grain, gradient washes) that animate *down* from full
    // opacity snap back to opaque and cover the page.
    el.style.setProperty('animation-play-state', 'paused', 'important');
    el.style.setProperty('transition', 'none', 'important');
  });
  return document.title;
})()
"""


class Chrome:
    """Minimal Chrome DevTools Protocol client."""

    def __init__(self):
        self.proc = subprocess.Popen(
            [CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars",
             f"--remote-debugging-port={PORT}", f"--window-size={WIDTH},{HEIGHT}",
             "--remote-allow-origins=*",   # CDP rejects the websocket without this
             "--no-first-run", "--no-default-browser-check", "about:blank"],
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
        )
        self.ws = None
        self.msg_id = 0
        for _ in range(40):                      # wait for the debug port
            try:
                self._targets()
                return
            except Exception:
                time.sleep(0.25)
        raise RuntimeError("Chrome did not expose its debugging port")

    def _targets(self):
        with urllib.request.urlopen(f"http://127.0.0.1:{PORT}/json/list", timeout=2) as r:
            return json.load(r)

    def open_tab(self, url):
        req = urllib.request.Request(
            f"http://127.0.0.1:{PORT}/json/new?{urllib.parse.quote(url, safe='')}",
            method="PUT")
        with urllib.request.urlopen(req, timeout=10) as r:
            target = json.load(r)
        self.ws = websocket.create_connection(target["webSocketDebuggerUrl"], timeout=60)
        return target

    def send(self, method, **params):
        self.msg_id += 1
        self.ws.send(json.dumps({"id": self.msg_id, "method": method, "params": params}))
        while True:
            msg = json.loads(self.ws.recv())
            if msg.get("id") == self.msg_id:
                if "error" in msg:
                    raise RuntimeError(f"{method}: {msg['error']}")
                return msg.get("result", {})

    def close(self):
        if self.ws:
            self.ws.close()
        self.proc.terminate()
        try:
            self.proc.wait(timeout=10)
        except subprocess.TimeoutExpired:
            self.proc.kill()


def main() -> int:
    m = json.loads(MANIFEST.read_text())
    sites = [p for p in m["projects"] if p.get("url") and not p.get("images")]
    if not sites:
        print("No live sites in the manifest.")
        return 0

    OUT.mkdir(parents=True, exist_ok=True)
    todo = [p for p in sites if FORCE or not (OUT / f"{p['id']}.jpg").exists()]
    if not todo:
        print(f"All {len(sites)} site captures already present. Use --force to redo.")
        return 0

    chrome = Chrome()
    failures = []
    try:
        for p in todo:
            dst = OUT / f"{p['id']}.jpg"
            print(f"  capturing {p['title']} - {p['url']}")
            try:
                chrome.open_tab(p["url"])
                chrome.send("Page.enable")
                time.sleep(SETTLE_SECONDS)
                chrome.send("Runtime.evaluate", expression=SETTLE_JS,
                            returnByValue=True, awaitPromise=False)
                time.sleep(0.5)
                shot = chrome.send(
                    "Page.captureScreenshot", format="png",
                    clip={"x": 0, "y": 0, "width": WIDTH, "height": HEIGHT,
                          "scale": 1},
                    captureBeyondViewport=True)
            except Exception as exc:                     # noqa: BLE001
                print(f"    FAILED: {exc}")
                failures.append(p["title"])
                continue

            raw = OUT / f"{p['id']}.png"
            raw.write_bytes(base64.b64decode(shot["data"]))
            with Image.open(raw) as im:
                im.convert("RGB").save(dst, "JPEG", quality=QUALITY,
                                       optimize=True, progressive=True)
            raw.unlink()
            print(f"    wrote {dst.relative_to(ROOT)} "
                  f"({dst.stat().st_size / 1024:.0f} KB)")
    finally:
        chrome.close()

    if failures:
        print(f"\n{len(failures)} capture(s) failed: {', '.join(failures)}")
        print("print.html falls back to a text card for any site with no image.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
