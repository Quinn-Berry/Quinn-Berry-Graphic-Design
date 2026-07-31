/* Print edition renderer.
   Same manifest.json as the site, but flattened: every category and every
   project is laid out expanded, because a PDF has no click-to-open panels.

   Pagination is done here rather than left to the browser. Letting Chrome
   break the flow means every page keeps whatever slack is left once the next
   block will not fit — which is what left half-empty sheets. Instead the rows
   are measured, packed into pages that are exactly one page tall, and the
   leftover on each page is handed to the rows holding artwork, which grow to
   absorb it. */

(async function () {
  const doc = document.getElementById('doc');

  let manifest;
  try {
    manifest = await loadManifest();
  } catch (err) {
    doc.innerHTML = '<p role="alert">Could not load manifest.json. Serve the ' +
      'folder over http rather than opening the file directly.</p>';
    return;
  }

  /* Letter minus the @page margins in css/print.css, in millimetres. */
  const PAGE_H = 248;   // 251mm sheet, less a little for rounding
  const ROW_GAP = 7;
  const MM = 96 / 25.4;               // CSS px per mm

  /* The PDF runs its own section order. A category may carry printOrder to
     sequence the printed edition without touching where it sits on the site;
     without one it falls back to the site order. */
  const seq = (c) => c.printOrder ?? c.order;
  const cats = [...manifest.categories].sort((a, b) => seq(a) - seq(b));

  const projectsOf = (catId) =>
    manifest.projects
      .filter((p) => p.category === catId)
      .sort((a, b) => (a.order ?? 999) - (b.order ?? 999));

  const el = (tag, cls, html) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html !== undefined) n.innerHTML = html;
    return n;
  };

  const pad = (n) => String(n).padStart(2, '0');

  /* ---------- build the blocks ---------- */

  const projectBlock = (p, index, feature) => {
    const block = el('article', 'proj' + (feature ? ' proj--feature' : ''));
    block.appendChild(el('p', 'proj__num', pad(index + 1)));
    block.appendChild(el('h3', 'proj__title', p.title));
    if (p.blurb) block.appendChild(el('p', 'proj__blurb', p.blurb));

    /* Live sites: a PDF cannot embed the iframe preview the site uses, so
       show the captured still plus the URL in full. */
    if (p.url && !p.images.length) {
      block.appendChild(el('p', 'proj__url', p.url.replace(/^https?:\/\//, '')));
      const shot = el('figure', 'shot');
      const img = document.createElement('img');
      img.src = 'print-assets/web/' + p.id + '.jpg';
      img.alt = p.title + ' — homepage';
      img.addEventListener('error', () => {
        shot.replaceChildren(el('p', 'shot__missing',
          'Screenshot unavailable — visit ' + p.url));
      });
      shot.appendChild(img);
      block.appendChild(shot);
      return block;
    }

    const cat = categoryById(manifest, p.category);
    const gallery = el('div', 'gal gal--n' + p.images.length);
    p.images.forEach((fn, i) => {
      const fig = el('figure', 'gal__item');
      const img = document.createElement('img');
      img.src = 'print-assets/' + cat.dir + '/' + fn.replace(/\.png$/, '.jpg');
      img.alt = altText(p, i, p.images.length);
      fig.appendChild(img);
      gallery.appendChild(fig);
    });
    block.appendChild(gallery);
    return block;
  };

  /* Rows are what get packed onto pages: either one full-width block or a
     pair of half-width projects side by side. */
  const rows = [];
  const pushRow = (cls, ...blocks) => {
    const row = el('div', 'row ' + cls);
    blocks.forEach((b) => row.appendChild(b));
    rows.push(row);
    return row;
  };

  cats.forEach((cat, ci) => {
    const projects = projectsOf(cat.id);
    if (!projects.length) return;

    const open = el('header', 'cat');
    open.appendChild(el('p', 'cat__eyebrow',
      'Section ' + pad(ci + 1) + ' — ' + projects.length +
      (projects.length === 1 ? ' project' : ' projects')));
    open.appendChild(el('h2', 'cat__title', cat.title));
    if (cat.caption) open.appendChild(el('p', 'cat__caption', cat.caption));
    pushRow('row--open', open);

    /* The opening piece of a section runs full width as its feature; so does
       any project carrying several examples. The rest pair up two across. */
    let pending = null;
    projects.forEach((p, pi) => {
      const feature = pi === 0;
      const full = feature || p.images.length > 1;
      const block = projectBlock(p, pi, feature);

      if (full) {
        if (pending) { pushRow('row--pair', pending); pending = null; }
        pushRow('row--full', block);
        return;
      }
      if (pending) { pushRow('row--pair', pending, block); pending = null; }
      else pending = block;
    });
    if (pending) pushRow('row--pair', pending);
  });

  const end = el('section', 'end');
  end.innerHTML =
    '<p class="cat__eyebrow">Contact</p>' +
    '<h2 class="cat__title">Have a project in mind?</h2>' +
    '<p class="end__lede">I build brand images that people remember — the logo, ' +
    'the merch, the gameday graphic, and the website, all speaking one visual ' +
    'language.</p>' +
    '<ul class="end__list">' +
    '<li><b>Email</b> qjberry@gmail.com</li>' +
    '<li><b>GitHub</b> github.com/Quinn-Berry</li>' +
    '<li><b>LinkedIn</b> linkedin.com/in/quinn-berry</li>' +
    '<li><b>Location</b> Cambridge, MA</li>' +
    '<li><b>Portfolio</b> quinn-berry.github.io/Quinn-Berry-Graphic-Design</li>' +
    '</ul>';
  pushRow('row--end', end);

  /* ---------- measure, then pack ---------- */

  /* Measured in a container the exact width of the printed text block, so the
     heights read here are the heights Chrome will lay out. */
  const rule = el('div', 'measure');
  rows.forEach((r) => rule.appendChild(r));
  doc.appendChild(rule);

  await Promise.all([...rule.querySelectorAll('img')].map((img) =>
    img.complete ? Promise.resolve()
      : new Promise((res) => { img.addEventListener('load', res); img.addEventListener('error', res); })));
  if (document.fonts && document.fonts.ready) await document.fonts.ready;

  const heights = rows.map((r) => r.getBoundingClientRect().height / MM);
  rows.forEach((r, i) => { r.dataset.h = heights[i]; });

  const pages = [];
  let page = null;
  let used = 0;
  rows.forEach((row, i) => {
    const h = heights[i];
    const needs = (page && page.childElementCount ? ROW_GAP : 0) + h;
    /* A section opener stays with the work it introduces. */
    const opener = row.classList.contains('row--open');
    const orphan = opener && used + needs + ROW_GAP + (heights[i + 1] || 0) > PAGE_H;

    if (!page || used + needs > PAGE_H || orphan) {
      page = el('div', 'page');
      pages.push(page);
      used = 0;
    }
    used += (page.childElementCount ? ROW_GAP : 0) + h;
    page.appendChild(row);
  });

  rule.remove();
  pages.forEach((p) => doc.appendChild(p));

  /* Now grow the artwork on each page until that page is full. Packing alone
     leaves whatever did not fit the next row as white at the foot of the page;
     raising the height cap instead spends it on the work. Each image is still
     bounded by its column width, so a page whose pieces are already as wide as
     they can go simply stops growing.

     Binary search rather than arithmetic: a taller cap only helps until an
     image becomes width-bound, so the relationship between cap and page height
     is not linear. */
  const SHEET = 251;
  const contentOf = (p) => {
    const kids = [...p.children];
    return kids.reduce((s, r) => s + r.getBoundingClientRect().height / MM, 0) +
      ROW_GAP * (kids.length - 1);
  };

  const fit = (p) => {
    /* The range runs below 1 as well as above it: a wider layout may only fit
       once its artwork is scaled down, and that still fills the page better
       than a narrow layout that cannot grow into the space at all.

       The ceiling is deliberate. Past roughly 2x the cap stops binding and the
       column width does instead, and a cell sized by width rather than by this
       number lays out differently on paper than it measured on screen — which
       showed up as artwork spilling its frame and overrunning the next block. */
    let lo = 0.5, hi = 1.9;
    for (let i = 0; i < 12; i++) {
      const mid = (lo + hi) / 2;
      p.style.setProperty('--cap', mid);
      if (contentOf(p) <= SHEET) lo = mid; else hi = mid;
    }
    p.style.setProperty('--cap', lo);
    return contentOf(p);
  };

  pages.forEach((p) => {
    [...p.children].forEach((r) => { r.style.flex = '0 0 auto'; });
    let best = fit(p);

    /* A three-up gallery on a page that is still short goes to two columns:
       wider columns let its artwork grow. Reverted if it no longer fits. */
    if (best < SHEET * 0.9) {
      const relaxed = [...p.querySelectorAll('.gal--n3')];
      if (relaxed.length) {
        relaxed.forEach((g) => g.classList.add('gal--relax'));
        const after = fit(p);
        if (after > SHEET || after < best) {
          relaxed.forEach((g) => g.classList.remove('gal--relax'));
          best = fit(p);
        } else best = after;
      }
    }

    /* Re-flowing a paired row into two full-width ones would fill a short page
       further, and it measures as fitting — but it lays out differently once
       Chrome paginates for paper, where the artwork overruns the block beneath
       it. Left alone deliberately: a page that ends early beats a broken one. */
  });

  document.documentElement.dataset.packed = 'true';
  document.documentElement.dataset.ready = 'true';   // signal for the PDF step
})();
