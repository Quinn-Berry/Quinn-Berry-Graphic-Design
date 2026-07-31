/* Print edition renderer.
   Same manifest.json as the site, but flattened: every category and every
   project is laid out expanded, because a PDF has no click-to-open panels. */

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

  cats.forEach((cat, ci) => {
    const projects = projectsOf(cat.id);
    if (!projects.length) return;

    const section = el('section', 'sheet');

    /* Section opener: a banded heading rather than a fresh page, so a short
       category does not leave most of a sheet empty. */
    const open = el('header', 'cat');
    open.appendChild(el('p', 'cat__eyebrow',
      'Section ' + pad(ci + 1) + ' — ' + projects.length +
      (projects.length === 1 ? ' project' : ' projects')));
    open.appendChild(el('h2', 'cat__title', cat.title));
    if (cat.caption) open.appendChild(el('p', 'cat__caption', cat.caption));
    section.appendChild(open);

    /* Projects sit two across. The opening piece of each section runs full
       width as a feature, and so does any project carrying several examples. */
    const projs = el('div', 'projs');
    section.appendChild(projs);

    projects.forEach((p, pi) => {
      const wide = p.images.length > 1 || pi === 0;
      const block = el('article', 'proj' + (wide ? ' proj--wide' : '') +
        (pi === 0 ? ' proj--feature' : ''));
      block.appendChild(el('p', 'proj__num', pad(pi + 1)));
      block.appendChild(el('h3', 'proj__title', p.title));
      if (p.blurb) block.appendChild(el('p', 'proj__blurb', p.blurb));

      /* Live sites: a PDF cannot embed the iframe preview the site uses, so
         show the captured still plus the URL in full, spelled out to be
         readable on paper. */
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
        projs.appendChild(block);
        return;
      }

      const cat_ = categoryById(manifest, p.category);
      const gallery = el('div', 'gal' + (p.images.length > 1 ? ' gal--multi' : '') +
        ' gal--n' + p.images.length);
      p.images.forEach((fn, i) => {
        const fig = el('figure', 'gal__item');
        const img = document.createElement('img');
        img.src = 'print-assets/' + cat_.dir + '/' + fn.replace(/\.png$/, '.jpg');
        img.alt = altText(p, i, p.images.length);
        fig.appendChild(img);
        gallery.appendChild(fig);
      });
      block.appendChild(gallery);
      projs.appendChild(block);
    });

    doc.appendChild(section);
  });

  /* Closing contact sheet */
  const end = el('section', 'sheet end');
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
  doc.appendChild(end);

  document.documentElement.dataset.ready = 'true';   // signal for the PDF step
})();
