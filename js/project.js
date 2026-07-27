/* Project detail page: renders the project named by ?id= from manifest.json. */

(async function () {
  const head = document.getElementById('project-head');
  const gallery = document.getElementById('gallery');
  const nav = document.getElementById('project-nav');

  const id = new URLSearchParams(location.search).get('id');
  let manifest;
  try {
    manifest = await loadManifest();
  } catch (err) {
    head.innerHTML = '<p role="alert">Could not load the portfolio manifest.</p>';
    return;
  }

  const all = orderedProjects(manifest);
  const project = all.find((p) => p.id === id);

  if (!project) {
    document.title = 'Not found — Quinn Berry';
    head.innerHTML =
      '<a class="back-link" href="./">← All work</a>' +
      '<h1>Project not found</h1>' +
      '<p class="tile__blurb">No project called “' + (id || '') +
      '” exists. Head back to the full portfolio.</p>';
    return;
  }

  const cat = categoryById(manifest, project.category);
  document.title = project.title + ' — Quinn Berry';

  head.innerHTML =
    '<a class="back-link" href="./#work">← All work</a>' +
    '<p class="eyebrow">' + cat.title + '</p>' +
    '<h1>' + project.title + '</h1>' +
    (project.blurb ? '<p class="tile__blurb">' + project.blurb + '</p>' : '') +
    (project.url
      ? '<a class="visit-link" href="' + project.url + '" target="_blank" rel="noopener">Visit live site ↗</a>'
      : '');

  if (project.url && project.images.length === 0) {
    /* live site — interactive, scrollable embed */
    const holder = document.createElement('div');
    holder.className = 'reveal';
    holder.appendChild(buildSiteFrame(manifest, project, 'live'));
    gallery.appendChild(holder);
  } else {
    project.images.forEach((fn, i) => {
      const item = document.createElement('figure');
      const dark = isDarkBacked(project, fn);
      item.className = 'gallery__item reveal' +
        (dark ? ' gallery__item--dark gallery__item--pad' : '');
      item.style.margin = 0;

      const img = document.createElement('img');
      img.src = imagePath(manifest, project, fn);
      img.alt = altText(project, i, project.images.length);
      img.loading = i === 0 ? 'eager' : 'lazy';
      /* full-page captures are extremely tall — let them scroll in place */
      img.addEventListener('load', () => {
        if (img.naturalHeight > img.naturalWidth * 1.8) {
          item.classList.add('gallery__item--tall');
        }
      });
      item.appendChild(img);
      gallery.appendChild(item);
    });
  }

  /* prev / next within the whole portfolio */
  const idx = all.indexOf(project);
  const prev = all[(idx - 1 + all.length) % all.length];
  const next = all[(idx + 1) % all.length];
  nav.innerHTML =
    '<a href="project.html?id=' + encodeURIComponent(prev.id) + '">' +
    '<span class="dir">← Previous</span>' + prev.title + '</a>' +
    '<a class="next" href="project.html?id=' + encodeURIComponent(next.id) + '">' +
    '<span class="dir">Next →</span>' + next.title + '</a>';

  observeReveals(document);
})();
