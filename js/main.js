/* Home page: category tiles + expandable in-page panel, from manifest.json.
   Clicking a category populates #category-panel below the tiles — no
   navigation; everything after it is pushed down. */

(async function () {
  const grid = document.getElementById('grid');
  const panel = document.getElementById('category-panel');

  let manifest;
  try {
    manifest = await loadManifest();
  } catch (err) {
    grid.innerHTML = '<p role="alert">Could not load the portfolio manifest. ' +
      'If you opened index.html directly from disk, serve the folder instead ' +
      '(e.g. <code>python3 -m http.server</code>).</p>';
    return;
  }

  const cats = [...manifest.categories].sort((a, b) => a.order - b.order);
  const projectsOf = (catId) =>
    orderedProjects(manifest).filter((p) => p.category === catId);

  let openCat = null;

  function catTile(cat) {
    const projects = projectsOf(cat.id);
    const isWeb = projects.length > 0 && projects.every((p) => p.url && p.images.length === 0);

    const art = document.createElement('article');
    art.className = 'cat-tile reveal';

    const btn = document.createElement('button');
    btn.className = 'cat-tile__btn';
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-controls', 'category-panel');
    btn.dataset.cat = cat.id;

    const media = document.createElement('div');
    media.className = 'tile__media cat-tile__media';
    if (isWeb) {
      media.appendChild(buildSiteFrame(manifest, projects[0], 'pan'));
      media.classList.add('cat-tile__media--web');
    } else {
      /* category cover comes from the manifest; fall back to the first
         project's cover so a category never renders an empty tile */
      const coverFile = cat.cover || (projects[0] && projects[0].cover);
      const owner = projects.find((p) => p.images.includes(coverFile)) || projects[0];
      if (owner && coverFile) {
        if (cat.coverFit === 'flush') media.classList.add('tile__media--flush');
        const img = document.createElement('img');
        img.src = thumbPath(manifest, owner, coverFile);
        img.alt = cat.title;
        img.loading = 'lazy';
        img.width = manifest.thumbWidth;
        media.appendChild(img);
      }
    }
    btn.appendChild(media);

    const meta = document.createElement('div');
    meta.className = 'cat-tile__meta';
    meta.innerHTML = '<span class="tile__title">' + cat.title + '</span>' +
      (cat.caption
        ? '<span class="tile__caption">' + cat.caption + '</span>'
        : '<span class="tile__cat">' + projects.length +
          (isWeb ? ' live site' : ' project') + (projects.length === 1 ? '' : 's') + '</span>');
    btn.appendChild(meta);

    btn.addEventListener('click', () => toggle(cat, btn));
    art.appendChild(btn);
    return art;
  }

  function closePanel() {
    openCat = null;
    panel.hidden = true;
    panel.replaceChildren();
    grid.querySelectorAll('.cat-tile__btn').forEach((b) => {
      b.setAttribute('aria-expanded', 'false');
      b.classList.remove('is-open');
    });
  }

  function toggle(cat, btn) {
    if (openCat === cat.id) { closePanel(); return; }
    closePanel();
    openCat = cat.id;
    btn.setAttribute('aria-expanded', 'true');
    btn.classList.add('is-open');

    const head = document.createElement('div');
    head.className = 'panel__head';
    head.innerHTML = '<h3>' + cat.title + '</h3>';
    const close = document.createElement('button');
    close.className = 'panel__close';
    close.setAttribute('aria-label', 'Close ' + cat.title);
    close.textContent = 'Close ×';
    close.addEventListener('click', closePanel);
    head.appendChild(close);
    panel.appendChild(head);

    projectsOf(cat.id).forEach((p) => {
      const block = document.createElement('section');
      block.className = 'panel__project';

      const isWeb = p.url && p.images.length === 0;
      block.innerHTML = '<h4>' + p.title + '</h4>' +
        (p.blurb ? '<p class="tile__blurb">' + p.blurb + '</p>' : '') +
        (p.url ? '<a class="visit-link" href="' + p.url +
          '" target="_blank" rel="noopener">Visit live site ↗</a>' : '');

      if (isWeb) {
        block.appendChild(buildSiteFrame(manifest, p, 'live'));
      } else {
        const imgs = document.createElement('div');
        imgs.className = 'panel__images' +
          (p.images.length === 1 ? ' panel__images--single' : '');
        p.images.forEach((fn, i) => {
          const fig = document.createElement('figure');
          fig.className = 'gallery__item' +
            (isDarkBacked(p, fn) ? ' gallery__item--dark gallery__item--pad' : '') +
            (p.pad ? ' gallery__item--pad' : '');
          const img = document.createElement('img');
          img.src = imagePath(manifest, p, fn);
          img.alt = altText(p, i, p.images.length);
          img.loading = 'lazy';
          /* extreme aspect ratios get special treatment: very tall pieces
             shrink, very wide lockups span the whole panel row */
          const classify = () => {
            if (img.naturalHeight > img.naturalWidth * 1.8) {
              fig.classList.add('gallery__item--tallratio');
            } else if (img.naturalWidth > img.naturalHeight * 2.2) {
              fig.classList.add('gallery__item--wide');
            }
          };
          if (img.complete && img.naturalWidth) classify();
          else img.addEventListener('load', classify);
          fig.appendChild(img);
          imgs.appendChild(fig);
        });
        block.appendChild(imgs);
      }
      panel.appendChild(block);
    });

    panel.hidden = false;
    /* land the panel just under the sticky nav */
    const y = panel.getBoundingClientRect().top + window.scrollY - 70;
    window.scrollTo({ top: y, behavior: 'smooth' });
  }

  cats.forEach((c) => grid.appendChild(catTile(c)));
  observeReveals(document);
})();
