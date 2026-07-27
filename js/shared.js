/* Shared manifest loading + path helpers.
   manifest.json is the single source of truth — see CLAUDE.md. */

async function loadManifest() {
  const res = await fetch('./manifest.json');
  if (!res.ok) throw new Error('Could not load manifest.json (' + res.status + ')');
  return res.json();
}

function categoryById(manifest, id) {
  return manifest.categories.find((c) => c.id === id);
}

function imagePath(manifest, project, filename) {
  const cat = categoryById(manifest, project.category);
  return manifest.imageRoot + '/' + cat.dir + '/' + filename;
}

function thumbPath(manifest, project, filename) {
  const cat = categoryById(manifest, project.category);
  const stem = filename.replace(/\.png$/, '');
  return manifest.thumbRoot + '/' + cat.dir + '/' + stem + manifest.thumbExt;
}

function isDarkBacked(project, filename) {
  return (project.darkBacked || []).includes(filename);
}

/* All projects in display order: category order, then project order. */
function orderedProjects(manifest) {
  const catOrder = {};
  manifest.categories.forEach((c) => { catOrder[c.id] = c.order; });
  return [...manifest.projects].sort(
    (a, b) => (catOrder[a.category] - catOrder[b.category]) || ((a.order ?? 999) - (b.order ?? 999))
  );
}

function altText(project, index, count) {
  return count > 1
    ? project.title + ', image ' + (index + 1) + ' of ' + count
    : project.title;
}

/* Browser-framed live-site embed.
   mode "pan"  — grid tile: non-interactive, pans down the page on hover.
   mode "live" — detail page: real iframe scrolling.
   Falls back to project.fallback screenshot (or a plain link card) if the
   site never loads — e.g. a host that refuses to be framed. */
function buildSiteFrame(manifest, project, mode) {
  const host = new URL(project.url).host;
  const frame = document.createElement('div');
  frame.className = 'site-frame' + (mode === 'live' ? ' site-frame--live' : '');
  frame.innerHTML =
    '<div class="site-frame__bar" aria-hidden="true">' +
    '<span class="site-frame__dot"></span><span class="site-frame__dot"></span><span class="site-frame__dot"></span>' +
    '<span class="site-frame__url">' + host + '</span></div>' +
    '<div class="site-frame__viewport"></div>';
  const viewport = frame.querySelector('.site-frame__viewport');

  const iframe = document.createElement('iframe');
  iframe.src = project.url;
  iframe.loading = 'lazy';
  iframe.title = 'Live preview of ' + project.title;
  if (mode !== 'live') {
    iframe.setAttribute('aria-hidden', 'true');
    iframe.tabIndex = -1;
    iframe.setAttribute('scrolling', 'no');
  }

  const DESIGN_W = 1280;
  const PAGE_H = 3200;
  const fit = () => {
    const s = viewport.clientWidth / DESIGN_W;
    viewport.style.setProperty('--s', s);
    iframe.style.height = (mode === 'live' ? viewport.clientHeight / s : PAGE_H) + 'px';
    viewport.style.setProperty('--pan', Math.max(0, PAGE_H - viewport.clientHeight / s));
  };
  new ResizeObserver(fit).observe(viewport);

  let loaded = false;
  iframe.addEventListener('load', () => { loaded = true; });
  setTimeout(() => {
    if (loaded) return;
    const fb = document.createElement('div');
    fb.className = 'site-frame__fallback';
    if (project.fallback) {
      const img = document.createElement('img');
      img.src = imagePath(manifest, project, project.fallback);
      img.alt = project.title + ' — site screenshot';
      img.loading = 'lazy';
      viewport.replaceChildren(img);
      viewport.style.height = 'auto';
      return;
    }
    fb.innerHTML =
      '<p>This site declined to be embedded.</p>' +
      '<a class="visit-link" href="' + project.url + '" target="_blank" rel="noopener">Visit live site ↗</a>';
    viewport.replaceChildren(fb);
    viewport.style.height = 'auto';
  }, 9000);

  viewport.appendChild(iframe);
  fit();
  return frame;
}

/* Fade-in on scroll, honouring prefers-reduced-motion via CSS. */
function observeReveals(root) {
  const els = (root || document).querySelectorAll('.reveal');
  const io = new IntersectionObserver(
    (entries) => entries.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
    }),
    { threshold: 0.08 }
  );
  els.forEach((el) => io.observe(el));
}
