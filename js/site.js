/* ---------------------------------------------------------------------------
   Logo carousel for section 01.

   Four marks cycle on a timer. The track holds a clone of the first cell at
   the end so the wrap is a continuous slide rather than a jump back: when the
   animation lands on the clone, transition is switched off, the index resets
   to 0 (visually identical), then transition is armed again on the next frame.

   Cells are 100% of the window width, so the whole thing is responsive and
   the translate is expressed in percent, not pixels.

   Marks are declared here rather than read from manifest.json because this is
   an authored editorial sequence — the order and the sentence under each mark
   are copy, not data. The filenames still have to exist in the manifest; see
   CLAUDE.md.
--------------------------------------------------------------------------- */
(function () {
  "use strict";

  var HOLD = 3400;   // ms each mark rests
  var SLIDE = 900;   // ms of travel, must match --marks transition in site.css

  // r = intrinsic width / height, used to normalise optical size across ratios
  var MARKS = [
    {
      src: "thumbs/04-logo/logo-twigtree-01.webp",
      name: "Twigtree",
      r: 0.514,
      cap: "Meet Twigtree — a vintage clothing shop, online."
    },
    {
      src: "thumbs/04-logo/logo-woodberry-01.webp",
      name: "Woodberry",
      r: 0.962,
      cap: "Meet Woodberry — a woodworking shop specializing in high-quality furniture and home goods."
    },
    {
      src: "thumbs/04-logo/logo-run-the-race-03.webp",
      name: "Run the Race",
      r: 1.267,
      cap: "Meet Run the Race — a fast-growing podcast on fitness, faith, and discipline."
    },
    {
      src: "thumbs/04-logo/logo-max-mancuso-monogram-02.webp",
      name: "Max Mancuso",
      r: 0.666,
      cap: "Meet Max — a fitness influencer with 100k+ followers on Instagram and brand deals with Puma and MyProtein."
    }
  ];

  var track = document.getElementById("marks-track");
  var nameEl = document.getElementById("marks-name");
  var countEl = document.getElementById("marks-count");
  if (!track || !nameEl || !countEl) return;

  var K = 145;
  function cell(m, index, total, isClone) {
    var wrap = document.createElement("div");
    wrap.className = "marks__cell";
    if (isClone) wrap.setAttribute("aria-hidden", "true");

    var art = document.createElement("div");
    art.className = "marks__art";

    var img = document.createElement("img");
    img.src = m.src;
    img.alt = isClone ? "" : m.name + " logo";
    img.loading = index === 0 ? "eager" : "lazy";
    img.decoding = "async";
    img.style.height = Math.round(K / Math.pow(m.r, 0.42)) + "px";
    art.appendChild(img);

    var capBox = document.createElement("div");
    capBox.className = "marks__cap";
    var p = document.createElement("p");
    p.textContent = m.cap;
    capBox.appendChild(p);

    wrap.appendChild(art);
    wrap.appendChild(capBox);
    return wrap;
  }

  MARKS.forEach(function (m, i) { track.appendChild(cell(m, i, MARKS.length, false)); });
  track.appendChild(cell(MARKS[0], 0, MARKS.length, true));   // wrap clone

  var n = MARKS.length;
  var i = 0;
  var timer = null;

  function pad(v) { return String(v).length < 2 ? "0" + v : String(v); }

  function paint() {
    track.style.transform = "translate3d(" + (-i * 100) + "%,0,0)";
    var real = i % n;
    nameEl.textContent = MARKS[real].name;
    countEl.textContent = pad(real + 1) + " / " + pad(n);
  }

  function advance() {
    i += 1;
    paint();

    if (i === n) {
      // Landed on the clone. Cut back to the identical first cell unanimated.
      window.setTimeout(function () {
        track.classList.add("is-instant");
        i = 0;
        paint();
        // Two frames: one to apply the untransitioned position, one to re-arm.
        window.requestAnimationFrame(function () {
          window.requestAnimationFrame(function () {
            track.classList.remove("is-instant");
          });
        });
      }, SLIDE + 60);
    }
  }

  function start() {
    stop();
    timer = window.setInterval(advance, HOLD);
  }
  function stop() {
    if (timer !== null) { window.clearInterval(timer); timer = null; }
  }

  paint();

  var motionOK = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (motionOK) {
    start();
    // Don't animate offscreen or in a background tab.
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) stop(); else start();
    });
  }
})();
