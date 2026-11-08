/* ==========================================================
   COLLECTIONS: each is one cosplay project or themed release.
   To add one: copy an entry, give it a new id (col-05...), then
   set collectionId: "col-05" on the products that belong to it.
   Names below are EDITABLE PLACEHOLDERS.
   ========================================================== */
(function () {
  const U = window.U;
  const COLLECTIONS = [
    { id: "col-01", title: "Sakura Dream", jp: "桜の夢", release: U.date(-20), cover: "", desc: "Placeholder collection. A soft spring theme with pastel pinks and falling petals. Replace this text with the real project story." },
    { id: "col-02", title: "Midnight Cafe", jp: "真夜中のカフェ", release: U.date(-8), cover: "", desc: "Placeholder collection. A cosy cafe-inspired set with warm light and lace details. Replace with real information." },
    { id: "col-03", title: "Starlit Wish", jp: "星の願い", release: U.date(-2), cover: "", desc: "Placeholder collection. A dreamy night-sky theme with sparkles and ribbons. Replace with real information." },
    { id: "col-04", title: "Summer Festival", jp: "夏祭り", release: U.date(14), cover: "", desc: "Placeholder collection. A lively festival theme, coming soon. Replace with real information." }
  ];

  // Photos shown on each collection page. To use real photos set src, e.g.
  // photos: [{ title: "Behind the scenes", src: "assets/images/collections/sakura-1.jpg" }]
  // Leave photos empty to show pastel placeholders.
  const photosOf = (c) => (c.photos && c.photos.length ? c.photos : [1, 2, 3].map((n) => ({ title: c.title + " photo " + n, src: "" })));
  const photoSrc = (p, i) => p.src || U.ph(p.title, i + 2, "1/1");
  let lb = null, plist = [], pidx = 0, lastFocus = null;
  function renderPhotos(el, items) {
    el.innerHTML = items.map((p, i) => `<button class="gal-item" data-i="${i}" aria-label="Open photo: ${U.esc(p.title)}"><img src="${photoSrc(p, i)}" alt="${U.esc(p.title)} (placeholder photo)" loading="lazy"><span class="gal-cap">${U.esc(p.title)}</span></button>`).join("");
    el.onclick = (e) => { const b = e.target.closest(".gal-item"); if (b) openPhoto(items, +b.dataset.i); };
  }
  function showPhoto() { const p = plist[pidx]; lb.querySelector("img").src = photoSrc(p, pidx); lb.querySelector("img").alt = p.title; lb.querySelector("figcaption").textContent = p.title + " (" + (pidx + 1) + "/" + plist.length + ")"; }
  const stepPhoto = (d) => { pidx = (pidx + d + plist.length) % plist.length; showPhoto(); };
  function closePhoto() { lb.remove(); document.body.style.overflow = ""; if (lastFocus) lastFocus.focus(); }
  function openPhoto(items, i) {
    plist = items; pidx = i; lastFocus = document.activeElement;
    if (!lb) {
      lb = document.createElement("div"); lb.className = "lb"; lb.setAttribute("role", "dialog"); lb.setAttribute("aria-modal", "true"); lb.setAttribute("aria-label", "Photo viewer");
      lb.innerHTML = '<button class="lb-close" aria-label="Close viewer">&times;</button><button class="lb-prev" aria-label="Previous photo">&lsaquo;</button><figure><img alt=""><figcaption></figcaption></figure><button class="lb-next" aria-label="Next photo">&rsaquo;</button>';
      lb.addEventListener("click", (e) => { if (e.target === lb || e.target.closest(".lb-close")) closePhoto(); else if (e.target.closest(".lb-prev")) stepPhoto(-1); else if (e.target.closest(".lb-next")) stepPhoto(1); });
      document.addEventListener("keydown", (e) => { if (!lb.isConnected) return; if (e.key === "Escape") closePhoto(); if (e.key === "ArrowLeft") stepPhoto(-1); if (e.key === "ArrowRight") stepPhoto(1); });
    }
    document.body.appendChild(lb); document.body.style.overflow = "hidden"; showPhoto(); lb.querySelector(".lb-close").focus();
  }
  const byId = (id) => COLLECTIONS.find((c) => c.id === id);
  const productsOf = (id) => window.Shop.PRODUCTS.filter((p) => p.collectionId === id);
  function status(c) {
    if (c.release > U.date(0)) return "Releases " + U.fmtDate(c.release);
    const l = productsOf(c.id).map((p) => window.Shop.availability(p));
    if (l.some((a) => a.key === "preorder")) return "Pre-order open";
    if (l.some((a) => a.canBuy)) return "Available now";
    return "Sold out";
  }
  const cover = (c, i) => c.cover || U.ph(c.title, i, "16/11");
  function cardHtml(c, i) {
    return `<a class="col-card" href="collections.html?c=${c.id}"><img src="${cover(c, i)}" alt="${U.esc(c.title)} cover (placeholder)" loading="lazy"><div class="col-body"><h3>${U.esc(c.title)} <small style="font-family:var(--font-jp);font-weight:400;font-size:.8rem;color:var(--cocoa-soft)">${U.esc(c.jp)}</small></h3><p class="col-meta">Release: ${U.fmtDate(c.release)} &nbsp;|&nbsp; ${productsOf(c.id).length} items</p><span class="col-status">${U.esc(status(c))}</span></div></a>`;
  }
  function initCollections() {
    const root = U.$("#collections"), c = byId(U.param("c"));
    if (!c) { root.innerHTML = `<div class="col-grid">${COLLECTIONS.map(cardHtml).join("")}</div>`; return; }
    const i = COLLECTIONS.indexOf(c), prods = productsOf(c.id);
    document.title = c.title + " | " + window.SITE.brand;
    const photos = photosOf(c);
    root.innerHTML = `<div class="crumbs"><a href="index.html">Home</a> / <a href="collections.html">Collections</a> / ${U.esc(c.title)}</div>
<div class="about-grid" style="margin-bottom:2rem"><img src="${cover(c, i)}" alt="${U.esc(c.title)} cover (placeholder)" style="border-radius:var(--r);box-shadow:var(--shadow-lg);width:100%"><div><h1 style="font-size:clamp(2rem,5vw,3rem)">${U.esc(c.title)}</h1><p class="note" style="font-family:var(--font-jp)">${U.esc(c.jp)}</p><p>${U.esc(c.desc)}</p><p><b>Release date:</b> ${U.fmtDate(c.release)}<br><b>Availability:</b> ${U.esc(status(c))}</p></div></div>
<div class="sec-head"><h2>Photography</h2></div><div class="gal-grid sq" id="col-gal"></div>
<div class="sec-head" style="margin-top:2.5rem"><h2>Related merchandise</h2></div><div class="grid auto four">${window.Shop.cards(prods)}</div>
<p style="margin-top:2rem"><a class="link-more" href="collections.html">Back to all collections</a></p>`;
    renderPhotos(U.$("#col-gal"), photos);
  }
  window.Col = { COLLECTIONS, byId, productsOf, status, cover, cardHtml };
  window.PAGES = window.PAGES || {}; window.PAGES.collections = initCollections;
})();
