/* ==========================================================
   COSPLAY GALLERY. To use real photos: put files in
   assets/images/gallery/ and set src: "assets/images/gallery/name.jpg".
   Leave src empty to show a placeholder. No other code changes needed.
   ========================================================== */
(function () {
  const U = window.U;
  const G = (id, title, category, collectionId, ratio) => ({ id, title, category, collectionId, ratio, src: "" });
  const ITEMS = [
    G(1, "Pastel Garden Portrait", "Portraits", "col-01", "4/5"), G(2, "Moonlit Studio Set", "Studio", "col-02", "1/1"),
    G(3, "Cherry Blossom Walk", "Outdoor", "col-01", "3/4"), G(4, "Cafe Afternoon", "Studio", "col-02", "4/5"),
    G(5, "Fan Meet Moments", "Behind the Scenes", "col-04", "1/1"), G(6, "Starlight Close-up", "Portraits", "col-03", "3/4"),
    G(7, "Ribbon and Lace", "Studio", "col-03", "4/5"), G(8, "Riverside Stroll", "Outdoor", "col-04", "1/1"),
    G(9, "Backstage Smile", "Behind the Scenes", "col-03", "3/4"), G(10, "Festival Evening", "Outdoor", "col-04", "4/5"),
    G(11, "Soft Light Portrait", "Portraits", "col-02", "3/4"), G(12, "Costume Fitting", "Behind the Scenes", "col-01", "1/1")
  ];
  const colName = (id) => { const c = window.Col && window.Col.byId(id); return c ? c.title : ""; };
  const srcOf = (g) => g.src || U.ph(g.title, g.id, g.ratio);
  let list = [], idx = 0, lb = null, lastFocus = null;

  function render(el, items, mode) {
    if (!items.length) { el.innerHTML = '<p class="note">No photos here yet.</p>'; return; }
    el.innerHTML = items.map((g, i) => `<button class="gal-item" data-i="${i}" aria-label="Open photo: ${U.esc(g.title)}"><img src="${srcOf(g)}" alt="${U.esc(g.title)} (placeholder photo)" loading="lazy"><span class="gal-cap">${U.esc(g.title)}${colName(g.collectionId) ? " - " + U.esc(colName(g.collectionId)) : ""}</span></button>`).join("");
    el.onclick = (e) => { const b = e.target.closest(".gal-item"); if (b) open(items, +b.dataset.i); };
  }
  function open(items, i) {
    list = items; idx = i; lastFocus = document.activeElement;
    if (!lb) {
      lb = document.createElement("div"); lb.className = "lb"; lb.setAttribute("role", "dialog"); lb.setAttribute("aria-modal", "true"); lb.setAttribute("aria-label", "Photo viewer");
      lb.innerHTML = '<button class="lb-close" aria-label="Close viewer">&times;</button><button class="lb-prev" aria-label="Previous photo">&lsaquo;</button><figure><img alt=""><figcaption></figcaption></figure><button class="lb-next" aria-label="Next photo">&rsaquo;</button>';
      lb.addEventListener("click", (e) => { if (e.target === lb || e.target.closest(".lb-close")) close(); else if (e.target.closest(".lb-prev")) step(-1); else if (e.target.closest(".lb-next")) step(1); });
      document.addEventListener("keydown", (e) => { if (!lb.isConnected) return; if (e.key === "Escape") close(); if (e.key === "ArrowLeft") step(-1); if (e.key === "ArrowRight") step(1); });
    }
    document.body.appendChild(lb); document.body.style.overflow = "hidden"; show(); lb.querySelector(".lb-close").focus();
  }
  function show() {
    const g = list[idx];
    lb.querySelector("img").src = srcOf(g); lb.querySelector("img").alt = g.title + " (placeholder photo)";
    lb.querySelector("figcaption").textContent = g.title + (colName(g.collectionId) ? " - " + colName(g.collectionId) : "") + " (" + (idx + 1) + "/" + list.length + ")";
  }
  const step = (d) => { idx = (idx + d + list.length) % list.length; show(); };
  function close() { lb.remove(); document.body.style.overflow = ""; if (lastFocus) lastFocus.focus(); }

  function initGallery() {
    const root = U.$("#gallery"), cats = ["All"].concat([...new Set(ITEMS.map((g) => g.category))]);
    root.innerHTML = `<div class="chips" id="gchips" role="group" aria-label="Photo categories">${cats.map((c, i) => `<button class="chip" data-c="${c}" aria-pressed="${i === 0}">${c}</button>`).join("")}</div><div class="masonry" id="gwall"></div>`;
    const draw = (c) => { render(U.$("#gwall"), c === "All" ? ITEMS : ITEMS.filter((g) => g.category === c)); U.$$("#gchips .chip").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.c === c))); };
    U.$("#gchips").addEventListener("click", (e) => { const b = e.target.closest(".chip"); if (b) draw(b.dataset.c); });
    draw("All");
  }
  window.Gal = { items: ITEMS, render, open, srcOf };
  window.PAGES = window.PAGES || {}; window.PAGES.gallery = initGallery;
})();
