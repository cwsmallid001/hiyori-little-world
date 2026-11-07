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
    const gal = window.Gal.items.filter((g) => g.collectionId === c.id);
    root.innerHTML = `<div class="crumbs"><a href="index.html">Home</a> / <a href="collections.html">Collections</a> / ${U.esc(c.title)}</div>
<div class="about-grid" style="margin-bottom:2rem"><img src="${cover(c, i)}" alt="${U.esc(c.title)} cover (placeholder)" style="border-radius:var(--r);box-shadow:var(--shadow-lg);width:100%"><div><h1 style="font-size:clamp(2rem,5vw,3rem)">${U.esc(c.title)}</h1><p class="note" style="font-family:var(--font-jp)">${U.esc(c.jp)}</p><p>${U.esc(c.desc)}</p><p><b>Release date:</b> ${U.fmtDate(c.release)}<br><b>Availability:</b> ${U.esc(status(c))}</p></div></div>
<div class="sec-head"><h2>Photography</h2></div><div class="gal-grid sq" id="col-gal"></div>
<div class="sec-head" style="margin-top:2.5rem"><h2>Related merchandise</h2></div><div class="grid auto four">${window.Shop.cards(prods)}</div>
<p style="margin-top:2rem"><a class="link-more" href="collections.html">Back to all collections</a></p>`;
    window.Gal.render(U.$("#col-gal"), gal, "sq");
  }
  window.Col = { COLLECTIONS, byId, productsOf, status, cover, cardHtml };
  window.PAGES = window.PAGES || {}; window.PAGES.collections = initCollections;
})();
