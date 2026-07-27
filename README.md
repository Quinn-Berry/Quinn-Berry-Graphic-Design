# Quinn Berry — Graphic Design Portfolio

A static portfolio site built in vanilla HTML / CSS / JS. No framework, no build
step — `index.html` reads [`manifest.json`](manifest.json) at runtime and renders
everything from it.

**Live site:** https://quinn-berry.github.io/Quinn-Berry-Graphic-Design/

## How it works

- `manifest.json` — **single source of truth** for all content (categories,
  projects, images, covers, live-site URLs). The site never globs `images/`.
- `index.html` — hero, filterable work grid, about, contact.
- `project.html?id=<project-id>` — shareable detail page for one project.
- `css/style.css` — all colours / type / spacing via CSS custom properties.
- `js/shared.js`, `js/main.js`, `js/project.js` — manifest loading, grid +
  filters, detail renderer.
- `images/` — full-res PNGs · `thumbs/` — 600px WebP mirrors used in the grid.
- See [`CLAUDE.md`](CLAUDE.md) for the full content contract (naming
  convention, `darkBacked`, thumb rules).

Run locally with any static server, e.g.:

```sh
python3 -m http.server
# open http://localhost:8000
```

(Opening `index.html` straight from disk won't work — browsers block
`fetch()` of local files.)

## Adding image work

1. Drop the file(s) in `_inbox/`, then rename to the convention
   `<prefix><project-slug>-<NN>.png` and move into the right
   `images/0X-category/` folder (prefixes: `print-`, `web-`, `sports-`,
   `logo-`, `merch-`).
2. Run `python3 scripts/make_thumbs.py` to generate the WebP thumbnail.
3. Add or update the project entry in `manifest.json` (set `cover`; list every
   image in `images`; add filenames to `darkBacked` if the art is white/cream
   on transparency).
4. Run `python3 scripts/build_index.py` — it rewrites `FILE-INDEX.md` and
   fails loudly if the manifest and disk have drifted.
5. Commit and push. The site picks it up automatically.

## Adding a web design site

Add a project entry to `manifest.json` under the `web-design` category — no
images needed:

```json
{
  "id": "my-new-site",
  "category": "web-design",
  "title": "My New Site",
  "order": 5,
  "url": "https://example.com",
  "blurb": "One-line descriptor shown under the tile.",
  "images": []
}
```

The site renders it as a live, scrollable browser-framed embed with a
"Visit live site ↗" link. If a site refuses to be embedded
(`X-Frame-Options` / `frame-ancestors`), add an optional
`"fallback": "web-my-new-site-01.png"` screenshot in
`images/02-web-design/` and it will be shown instead. Re-run
`python3 scripts/build_index.py` after editing the manifest.

## Deploying

Pushing to `main` redeploys GitHub Pages — nothing else to do.
