/* Home page: filterable work grid, rendered from manifest.json. */

(async function () {
  const grid = document.getElementById('grid');
  const filters = document.getElementById('filters');

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
  const catTitle = {};
  cats.forEach((c) => { catTitle[c.id] = c.title; });

  /* filter buttons */
  const makeBtn = (id, label) => {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.className = 'filter-btn';
    btn.textContent = label;
    btn.dataset.cat = id;
    btn.setAttribute('aria-pressed', id === 'all' ? 'true' : 'false');
    btn.addEventListener('click', () => {
      filters.querySelectorAll('.filter-btn').forEach((b) =>
        b.setAttribute('aria-pressed', b === btn ? 'true' : 'false'));
      render(id);
    });
    li.appendChild(btn);
    return li;
  };
  filters.appendChild(makeBtn('all', 'All'));
  cats.forEach((c) => filters.appendChild(makeBtn(c.id, c.title)));

  function imageTile(p) {
    const art = document.createElement('article');
    art.className = 'tile reveal';
    const dark = isDarkBacked(p, p.cover);

    const link = document.createElement('a');
    link.className = 'tile__link';
    link.href = 'project.html?id=' + encodeURIComponent(p.id);
    link.setAttribute('aria-label', p.title + ' — ' + catTitle[p.category]);

    const media = document.createElement('div');
    media.className = 'tile__media' + (dark ? ' tile__media--dark' : '');
    const img = document.createElement('img');
    img.src = thumbPath(manifest, p, p.cover);
    img.alt = p.title;
    img.loading = 'lazy';
    img.width = manifest.thumbWidth;
    media.appendChild(img);
    link.appendChild(media);
    art.appendChild(link);

    const meta = document.createElement('div');
    meta.className = 'tile__meta';
    meta.innerHTML = '<span class="tile__title">' + p.title + '</span>' +
      '<span class="tile__cat">' + catTitle[p.category] + '</span>';
    art.appendChild(meta);
    return art;
  }

  function webTile(p) {
    const art = document.createElement('article');
    art.className = 'tile tile--web reveal';

    const link = document.createElement('a');
    link.className = 'tile__link';
    link.href = 'project.html?id=' + encodeURIComponent(p.id);
    link.setAttribute('aria-label', p.title + ' — ' + catTitle[p.category]);
    link.appendChild(buildSiteFrame(manifest, p, 'pan'));
    art.appendChild(link);

    const meta = document.createElement('div');
    meta.className = 'tile__meta';
    const left = document.createElement('div');
    left.innerHTML = '<span class="tile__title">' + p.title + '</span>' +
      (p.blurb ? '<p class="tile__blurb">' + p.blurb + '</p>' : '');
    const visit = document.createElement('a');
    visit.className = 'visit-link';
    visit.href = p.url;
    visit.target = '_blank';
    visit.rel = 'noopener';
    visit.textContent = 'Visit live site ↗';
    meta.appendChild(left);
    meta.appendChild(visit);
    art.appendChild(meta);
    return art;
  }

  function render(catId) {
    const projects = orderedProjects(manifest).filter(
      (p) => catId === 'all' || p.category === catId
    );
    grid.replaceChildren();
    grid.classList.toggle('grid--web-only', catId === 'web-design');
    projects.forEach((p) => {
      grid.appendChild(p.url && p.images.length === 0 ? webTile(p) : imageTile(p));
    });
    observeReveals(grid);
  }

  render('all');
  observeReveals(document);
})();
