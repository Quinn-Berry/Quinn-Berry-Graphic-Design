# Portfolio Assets — Instructions for Claude Code

This folder holds every image for the graphic design portfolio site, plus the
manifest that tells you which image goes where. Read this file before touching
any asset or writing any gallery code.

---

## 1. The one rule

**`manifest.json` is the single source of truth.**

Do not glob `images/` to discover files. Do not hardcode filenames in
components. Do not infer a category from a filename. Read `manifest.json`,
iterate over `projects`, and render from that. If an image exists on disk but
is not in the manifest, it is intentionally not on the site yet.

If you need to add, remove, or reorder work on the site, edit `manifest.json`.

---

## 2. Directory layout

```
portfolio/
├── CLAUDE.md                    ← this file
├── manifest.json                ← source of truth (read this)
├── FILE-INDEX.md                ← human-readable list of every file, auto-updated
├── _inbox/                      ← unsorted drop zone. NEVER referenced by the site.
├── images/                      ← full-resolution PNGs
│   ├── 01-print-editorial/
│   ├── 02-web-design/
│   ├── 03-sports-graphics/
│   ├── 04-logo/
│   └── 05-merchandise/
├── thumbs/                      ← 600px-wide WebP copies, mirrors images/
│   ├── 01-print-editorial/
│   ├── 02-web-design/
│   ├── 03-sports-graphics/
│   ├── 04-logo/
│   └── 05-merchandise/
└── scripts/
    ├── make_thumbs.py           ← regenerates thumbs/ from images/
    └── build_index.py           ← rewrites FILE-INDEX.md, reports drift
```

`thumbs/` mirrors `images/` one-for-one: same subfolder, same filename **stem**,
but the extension is `.webp` instead of `.png`. Given any image path you can
derive its thumb by swapping the first path segment and the extension.

**Formats are deliberate and different.** Originals are PNG because the source
art is lossless and some pieces have transparency. Thumbnails are WebP because
the artwork is heavily textured, which PNG compresses badly — WebP is about 9×
smaller at grid size with no visible difference, and it preserves alpha, so
transparent logos still sit correctly on the page background. Do not "unify"
these to one format.

**The one exception: full-page web captures are JPEG.** Everything in
`images/02-web-design/` is a screenshot of a live site, not source art. It
arrives already lossy, and it has no transparency. Re-encoding it as PNG would
inflate it roughly 15× while recovering none of the detail the JPEG encoder
already discarded — the artefacts are baked in. So web captures stay `.jpg`;
every other category stays `.png`. Thumbnails are WebP regardless of source
format. Because two source extensions now exist, **derive a thumb path by
replacing the extension, never by assuming `.png`** — see §5.

---

## 3. Categories

| Order | Display title     | `id`              | Folder                | File prefix |
|-------|-------------------|-------------------|-----------------------|-------------|
| 1     | Print & Editorial | `print-editorial` | `01-print-editorial`  | `print-`    |
| 2     | Web Design        | `web-design`      | `02-web-design`       | `web-`      |
| 3     | Sports Graphics   | `sports-graphics` | `03-sports-graphics`  | `sports-`   |
| 4     | Logo              | `logo`            | `04-logo`             | `logo-`     |
| 5     | Merchandise       | `merchandise`     | `05-merchandise`      | `merch-`    |

Use `order` for nav and section sequence. Use `slug` for routes
(`/work/sports-graphics`). Never display the numbered folder name in the UI.

---

## 4. File naming convention

```
<prefix><project-slug>-<NN>.png
```

- All lowercase, hyphens only, no spaces, no underscores, no capitals.
- `<prefix>` is the category prefix from the table above.
- `<project-slug>` identifies the piece of work.
- `<NN>` is a zero-padded two-digit sequence starting at `01`.
- Extension is always `.png`.

Examples:

```
images/03-sports-graphics/sports-fall-invitational-01.png
images/03-sports-graphics/sports-fall-invitational-02.png
images/04-logo/logo-summit-coffee-01.png
images/01-print-editorial/print-quarterly-review-cover-01.png
```

Because the category prefix is in the filename, **no two files anywhere in this
project share a name.** You can safely flatten all images into a single build
output directory without collisions.

`-01` is the cover image by default, but always trust `cover` in the manifest
over this assumption.

---

## 5. Manifest schema

```jsonc
{
  "schemaVersion": 1,
  "imageRoot": "images",
  "thumbRoot": "thumbs",
  "thumbWidth": 600,
  "thumbExt": ".webp",         // thumbs use this extension, sources are .png

  "categories": [
    {
      "id": "sports-graphics",
      "order": 3,
      "title": "Sports Graphics",   // render this
      "slug": "sports-graphics",    // route segment
      "dir": "03-sports-graphics",  // filesystem only
      "filePrefix": "sports-"
    }
  ],

  "projects": [
    {
      "id": "fall-invitational",           // unique within its category
      "category": "sports-graphics",       // must match a categories[].id
      "title": "Fall Invitational",        // render this
      "order": 1,                          // position within the category
      "cover": "sports-fall-invitational-01.png",
      "images": [
        "sports-fall-invitational-01.png",
        "sports-fall-invitational-02.png"
      ],
      "darkBacked": [               // optional, see below
        "sports-fall-invitational-01.png"
      ]
    }
  ]
}
```

Notes:

- `images` is **always an array**, even for a single-image project. Some
  projects have one image, some have several (mockup + flat, multiple views).
  Write your components to handle both without branching on length.
- `cover` is always one of the strings in `images`. Use it for grid tiles.
- Filenames in `cover` and `images` are **bare filenames, not paths.**
  Build the full path yourself (see below).
- There is no `description` field yet. Blurbs will be added later — either by
  you on request, or by Quinn directly. When they arrive they will be an
  optional `blurb` string on the project. Write components that render nothing
  if `blurb` is absent, so adding it later requires no code change.
- `darkBacked` is optional and lists filenames **within that project** that
  must be rendered against a dark surface. See §6 — this one is easy to get
  wrong and the failure is silent.

### `darkBacked` — required reading

Some artwork is white or cream on a transparent background. Composited onto a
white page it does not look wrong, it **disappears** — the tile renders as an
empty box and nothing errors. Two current pieces are affected, and both are
their project's cover image, so the failure would land directly in the grid:

| File | What vanishes |
|------|---------------|
| `merch-all-fish-all-waters-01.png` | the white "ALL FISH ALL WATERS" lettering across the wing |
| `merch-okay-buddy-01.png` | the cream segments of every letterform |

For any filename listed in a project's `darkBacked` array, render it on a dark
surface — both in the grid tile and in the lightbox:

```jsx
const dark = (project.darkBacked ?? []).includes(filename);

<div className={dark ? "bg-neutral-900" : "bg-transparent"}>
  <img src={thumb} alt={project.title} />
</div>
```

Do not apply a dark surface to every image as a blanket fix. Pieces like
`merch-maine-harvest-01.png` are black line art and would disappear the other
way. The array exists because it varies per file.

### Tall images (full-page web captures)

Web Design pieces are full-page scroll captures — a single image of an entire
page, often 1440 × 8000 or taller. Two consequences:

1. **Thumbnails are top-cropped, not scaled whole.** `make_thumbs.py` crops any
   image taller than 1.6× its width down to a 1.6:1 tile before resizing.
   Scaling an 8000px page into a 600px-wide thumb produces an unreadable
   sliver; the top of the page is what a viewer actually recognises. **A thumb
   may therefore show only part of its source image** — do not assume the thumb
   and the full image have the same aspect ratio. Never compute layout
   dimensions for a tile from the full image's height.
2. **In the lightbox, let tall images scroll.** Do not force-fit them to the
   viewport — at 1:8 aspect that renders the page as an unreadable strip. Give
   the container a max height and let the image scroll inside it at full width.

### `url` (optional)

A project may carry a `url` string pointing at the live site. Render it as a
"View live site" link when present, omit the link entirely when absent. No
project uses it yet; the field is reserved so Web Design entries can adopt it
without a schema change.

### Resolving a path

Filenames in the manifest end in `.png`, or `.jpg` for web captures. Strip
whichever extension is there — do not hardcode `.png` — and never assume the
thumb shares the source's extension. Thumbs are always `thumbExt`.

```js
const cat   = manifest.categories.find(c => c.id === project.category);
const stem  = filename.replace(/\.(png|jpe?g)$/i, "");

const full  = `${manifest.imageRoot}/${cat.dir}/${filename}`;
// -> images/04-logo/logo-twigtree-01.png

const thumb = `${manifest.thumbRoot}/${cat.dir}/${stem}${manifest.thumbExt}`;
// -> thumbs/04-logo/logo-twigtree-01.webp
```

Use `thumb` in any grid, index, or list view. Use `full` only when the image is
displayed large — lightbox, detail page, hero.

---

## 6. Adding new work

1. Drop the file(s) in `_inbox/` (or hand them to Claude with a category).
2. Rename to the convention in §4 and move into the correct `images/` folder.
3. Run `python3 scripts/make_thumbs.py` to build the thumbnail.
4. Add or update the project entry in `manifest.json`.
5. Regenerate `FILE-INDEX.md`.

Steps 2–5 are the whole job. If any one is skipped the site will be wrong:
a missing thumb means a broken grid image, a missing manifest entry means the
work silently does not appear.

`_inbox/` is a staging area only. Nothing in it should ever be referenced by
site code, committed as a final asset, or deployed.

---

## 7. Build guidance

- Treat this folder as static assets. Copy or symlink it into whatever the
  framework expects (`public/`, `static/`, `assets/`) — do not restructure it.
- Import `manifest.json` directly; it is small and typed cleanly.
- Grid views: use `thumbs/`. Detail/lightbox: use `images/`. Getting this
  backwards is the most common way this site ends up slow.
- Set explicit `width`/`height` or an aspect-ratio box on tiles so the grid
  does not reflow as images load.
- `alt` text: use the project `title`. For multi-image projects append the
  index — `"Fall Invitational, image 2 of 3"`.
- Empty categories are possible during buildout. Render the section gracefully
  or skip it; never crash on a category with zero projects.

---

## 8. Do not

- Do not rename files without updating `manifest.json` in the same change.
- Do not commit anything from `_inbox/`.
- Do not add non-PNG assets to `images/`, with one exception: full-page web
  captures in `02-web-design/` are JPEG, for the reason given in §2. Every
  other category is PNG by decision.
- Do not edit files in `thumbs/` by hand — they are generated output and will
  be overwritten by `make_thumbs.py`.
- Do not assume a thumb shares its source's `.png` extension. Thumbs are
  `.webp`; read `thumbExt` from the manifest rather than hardcoding it.
- Do not put a transparent logo on a hardcoded white tile. Several pieces have
  alpha and are designed to sit on the page background — and the ones listed in
  `darkBacked` become invisible on white. Honour that array.
- Do not read category from the filename prefix at runtime. The prefix exists
  to guarantee unique filenames; the manifest defines the relationship.
