/* ==========================================================
   PRODUCTS: central data + shop page + product details page.
   All products are FICTIONAL DEMO items.
   To add a product: copy one P(...) line below and change it.
   ========================================================== */
(function () {
  const U = window.U;
  const CATS = [
    { id: "photobook", name: "Photobook", icon: "📖" }, { id: "photocard", name: "Photocard", icon: "🎴" },
    { id: "acrylic", name: "Acrylic Stand", icon: "💎" }, { id: "keychain", name: "Keychain", icon: "🔑" },
    { id: "prints", name: "Cosplay Prints", icon: "🖼️" }, { id: "signed", name: "Signed Merchandise", icon: "✍️" },
    { id: "photoset", name: "Exclusive Photo Sets", icon: "📸" }, { id: "apparel", name: "Clothing / Apparel", icon: "👕" },
    { id: "digital", name: "Digital Photo Collection", icon: "💾" }
  ];
  const o = (label, delta = 0) => ({ label, delta });
  // Variation templates per category. The FIRST option of each group must have delta 0.
  const V = {
    photobook: [{ name: "Edition", options: [o("Standard Edition"), o("Premium Edition", 30)] }],
    photocard: [{ name: "Option", options: [o("Single"), o("Full Set", 20)] }],
    acrylic: [{ name: "Size", options: [o("Regular (10 cm)"), o("Large (15 cm)", 12)] }],
    keychain: [{ name: "Style", options: [o("Standard"), o("With bell charm", 4)] }],
    prints: [{ name: "Size", options: [o("A4"), o("A5", -6)] }],
    signed: [{ name: "Edition", options: [o("Signed edition"), o("Unsigned edition", -12)] }],
    photoset: [{ name: "Format", options: [o("Standard set"), o("Deluxe set", 25)] }],
    apparel: [{ name: "Size", options: [o("S"), o("M"), o("L"), o("XL")] }, { name: "Colour", options: [o("Cream"), o("Sakura Pink"), o("Lavender")] }],
    digital: [{ name: "Format", options: [o("JPG - Standard"), o("JPG - High resolution", 8)] }]
  };
  const DESC = {
    photobook: "A softly printed cosplay photobook filled with dreamy pastel photography.",
    photocard: "Glossy collectible photocards in a cute pastel design.",
    acrylic: "A sturdy clear acrylic stand that brings your favourite character to your desk.",
    keychain: "A lightweight double-sided acrylic keychain with a pastel finish.",
    prints: "High quality cosplay photo prints on smooth premium paper.",
    signed: "A collectible item with a signature (demo placeholder, no real signing implied).",
    photoset: "A themed set of photographs, curated as a keepsake collection.",
    apparel: "Soft everyday apparel with a gentle kawaii design.",
    digital: "A digital photo collection delivered as downloadable image files. No physical shipping."
  };
  const PO = (op, cl, sh) => ({ opens: U.date(op), closes: U.date(cl), ships: U.date(sh), shipConfirmed: false });
  const LT = (total, remaining) => ({ total, remaining });
  const P = (id, name, cat, price, x = {}) => Object.assign({
    id, name, category: cat, price, type: cat === "digital" ? "digital" : "physical", status: "regular", stock: 50, images: [],
    variations: V[cat], collectionId: "col-01", featured: false, isNew: false, bestseller: false, fan: false, pop: 50, added: -30, spec: "", desc: ""
  }, x);

  // ----- PRODUCT DATA (fictional demo items) -----
  const PRODUCTS = [
    P("PB-001", "Standard Photobook", "photobook", 68, { stock: 40, isNew: true, pop: 70, added: -3, featured: true, spec: "A5 size, 48 pages, matte cover" }),
    P("PB-002", "Premium Photobook", "photobook", 98, { status: "preorder", preorder: PO(-4, 24, 75), stock: 120, pop: 85, added: -6, collectionId: "col-02", fan: true, spec: "B5 size, 80 pages, hardcover" }),
    P("PB-003", "Special Edition Photobook", "photobook", 138, { status: "limited", limited: LT(100, 37), pop: 90, added: -10, collectionId: "col-03", fan: true, spec: "B5 size, 96 pages, boxed set" }),
    P("PC-001", "Single Photocard", "photocard", 6, { stock: 300, bestseller: true, pop: 95, spec: "5.5 x 8.5 cm, glossy" }),
    P("PC-002", "Photocard Set", "photocard", 28, { stock: 150, bestseller: true, fan: true, pop: 92, collectionId: "col-02", spec: "Set of 6 cards, glossy" }),
    P("PC-003", "Random Photocard Pack", "photocard", 15, { stock: 200, isNew: true, pop: 80, added: -2, collectionId: "col-04", spec: "3 random cards per pack" }),
    P("PC-004", "Special Collection Set", "photocard", 45, { status: "limited", limited: LT(150, 62), pop: 78, added: -12, collectionId: "col-03", spec: "Set of 10 cards in a collector sleeve" }),
    P("AS-001", "Character Acrylic Stand", "acrylic", 32, { stock: 60, bestseller: true, fan: true, pop: 88, collectionId: "col-02", spec: "3 mm acrylic with base" }),
    P("AS-002", "Special Edition Acrylic Stand", "acrylic", 48, { status: "preorder", preorder: PO(-2, 30, 70), stock: 80, isNew: true, pop: 66, added: -1, collectionId: "col-04", spec: "5 mm acrylic, glitter edge" }),
    P("AS-003", "Limited Design Stand", "acrylic", 55, { status: "limited", limited: LT(80, 9), pop: 84, collectionId: "col-03", fan: true, spec: "Numbered limited design" }),
    P("KC-001", "Acrylic Keychain", "keychain", 18, { stock: 120, pop: 74, spec: "5 cm, double-sided print" }),
    P("KC-002", "Character Keychain", "keychain", 22, { stock: 90, isNew: true, pop: 68, added: -4, collectionId: "col-04", spec: "6 cm, with clasp" }),
    P("KC-003", "Special Collection Keychain", "keychain", 26, { status: "soldout", stock: 0, pop: 60, added: -40, collectionId: "col-02", spec: "6 cm, holographic" }),
    P("PR-001", "A4 Prints", "prints", 15, { stock: 100, pop: 72, spec: "Premium matte paper" }),
    P("PR-002", "A5 Prints", "prints", 9, { stock: 160, bestseller: true, pop: 90, collectionId: "col-02", spec: "Premium matte paper" }),
    P("PR-003", "Special Photo Prints", "prints", 25, { stock: 70, pop: 64, collectionId: "col-04", spec: "Pearl finish, white border" }),
    P("SG-001", "Signed Photocard", "signed", 35, { status: "limited", limited: LT(60, 21), pop: 93, collectionId: "col-03", fan: true, spec: "Demo item" }),
    P("SG-002", "Signed Photo Print", "signed", 58, { status: "limited", limited: LT(40, 14), pop: 76, collectionId: "col-04", spec: "A4 size, demo item" }),
    P("SG-003", "Signed Photobook", "signed", 168, { status: "preorder", preorder: PO(-1, 20, 80), limited: LT(30, 8), isNew: true, pop: 82, added: -1, collectionId: "col-03", spec: "B5 size, demo item" }),
    P("EX-001", "Exclusive Photo Collection", "photoset", 78, { stock: 45, isNew: true, pop: 70, added: -5, collectionId: "col-02", spec: "20 prints in a keepsake box" }),
    P("EX-002", "Special Theme Photo Set", "photoset", 62, { stock: 50, pop: 67, collectionId: "col-04", spec: "12 prints, themed sleeve" }),
    P("EX-003", "Premium Photo Bundle", "photoset", 118, { status: "limited", limited: LT(50, 20), pop: 79, collectionId: "col-01", spec: "Prints, cards and a mini book" }),
    P("AP-001", "T-shirt", "apparel", 58, { stock: 80, pop: 71, spec: "100% cotton" }),
    P("AP-002", "Hoodie", "apparel", 128, { status: "preorder", preorder: PO(-3, 28, 85), stock: 60, isNew: true, pop: 77, added: -2, collectionId: "col-02", spec: "Soft fleece, relaxed fit" }),
    P("AP-003", "Special Merchandise Apparel", "apparel", 88, { status: "limited", limited: LT(70, 33), pop: 63, collectionId: "col-04", spec: "Limited colourway" }),
    P("DG-001", "Digital Photo Set", "digital", 25, { isNew: true, pop: 81, added: -2, spec: "15 images, JPG" }),
    P("DG-002", "Digital Photography Collection", "digital", 45, { bestseller: true, fan: true, pop: 89, collectionId: "col-02", spec: "40 images, JPG" }),
    P("DG-003", "Premium Digital Bundle", "digital", 79, { isNew: true, pop: 73, added: -3, collectionId: "col-03", spec: "90 images plus wallpapers" })
  ].map((p) => { p.addedDate = U.date(p.added); return p; });

  // ----- helpers -----
  const byId = (id) => PRODUCTS.find((p) => p.id === id);
  const catName = (id) => (CATS.find((c) => c.id === id) || {}).name || id;
  const stockMap = () => U.get("hlw_stock", {});
  function stockOf(p) {
    if (p.type === "digital") return Infinity;
    const m = stockMap();
    if (m[p.id] != null) return m[p.id];
    return p.limited ? p.limited.remaining : p.stock;
  }
  function preorderState(p) {
    if (!p.preorder) return null;
    const t = U.date(0);
    if (t < p.preorder.opens) return "upcoming";
    if (t > p.preorder.closes) return "closed";
    return "open";
  }
  function availability(p) {
    const s = stockOf(p), ps = preorderState(p);
    if (s <= 0) return { key: "soldout", label: "Sold out", canBuy: false };
    if (ps === "upcoming") return { key: "upcoming", label: "Pre-order opens " + U.fmtDate(p.preorder.opens), canBuy: false };
    if (ps === "closed") return { key: "closed", label: "Pre-order closed", canBuy: false };
    if (ps === "open") return { key: "preorder", label: "Pre-order open, " + s + " available", canBuy: true };
    if (p.type === "digital") return { key: "digital", label: "Digital delivery (demo)", canBuy: true };
    if (p.limited) return { key: "limited", label: "Only " + s + " of " + p.limited.total + " left", canBuy: true };
    return { key: "instock", label: s <= 10 ? "Low stock, " + s + " left" : "In stock", canBuy: true };
  }
  function badges(p) {
    if (stockOf(p) <= 0) return [{ c: "soldout", t: "SOLD OUT" }];
    const b = [];
    if (p.preorder) b.push({ c: "preorder", t: "PRE-ORDER" });
    if (p.limited) b.push({ c: "limited", t: "LIMITED EDITION" });
    if (p.type === "digital") b.push({ c: "digital", t: "✦ DIGITAL PRODUCT" });
    if (p.isNew) b.push({ c: "new", t: "NEW ARRIVAL" });
    if (p.bestseller) b.push({ c: "best", t: "BEST SELLER" });
    return b;
  }
  const badgeHtml = (list) => (list.length ? `<div class="badges">${list.map((b) => `<span class="badge ${b.c}">${b.t}</span>`).join("")}</div>` : "");
  const imagesOf = (p) => (p.images && p.images.length ? p.images : [0, 1, 2].map((i) => U.ph(p.id, U.hash(p.id) + i, "4/5")));
  const related = (p) => {
    const same = PRODUCTS.filter((x) => x.id !== p.id && x.category === p.category);
    const col = PRODUCTS.filter((x) => x.id !== p.id && x.category !== p.category && x.collectionId === p.collectionId);
    return same.concat(col).slice(0, 4);
  };
  function card(p) {
    const a = availability(p), bl = badges(p).slice(0, 2);
    return `<article class="pcard"><a class="pcard-img" href="product.html?id=${p.id}" aria-label="${U.esc(p.name)}">${badgeHtml(bl)}<img src="${imagesOf(p)[0]}" alt="${U.esc(p.name)} (demo product image)" loading="lazy"></a>
<div class="pcard-body"><span class="pcard-cat">${U.esc(catName(p.category))}</span><h3><a href="product.html?id=${p.id}">${U.esc(p.name)}</a></h3>
<p class="price">${U.money(p.price)}</p><p class="avail ${a.key}">${U.esc(a.label)}</p>
<div class="pcard-actions"><a class="btn btn-ghost btn-sm" href="product.html?id=${p.id}">Details</a>
<button class="btn btn-sm" data-add="${p.id}" ${a.canBuy ? "" : "disabled"}>${a.canBuy ? "Add to Cart" : "Unavailable"}</button></div></div></article>`;
  }
  const cards = (list) => list.map(card).join("");

  // ----- SHOP PAGE -----
  function initShop() {
    const st = { q: U.param("q") || "", cat: U.param("cat") || "all", price: "all", sort: U.param("sort") || "popular", avail: false };
    const root = U.$("#shop");
    root.innerHTML = `<div class="chips" id="chips" role="group" aria-label="Categories"></div>
<div class="toolbar shop"><div class="field field-search"><label for="f-q">Search products</label><input class="input" id="f-q" type="search" placeholder="Search by name..." value="${U.esc(st.q)}"></div>
<div class="field"><label for="f-price">Price</label><select class="select" id="f-price"><option value="all">All prices</option><option value="0-30">Under RM 30</option><option value="30-60">RM 30 - 60</option><option value="60-100">RM 60 - 100</option><option value="100-9999">RM 100 and above</option></select></div>
<div class="field"><label for="f-sort">Sort by</label><select class="select" id="f-sort"><option value="popular">Popularity</option><option value="newest">Newest</option><option value="price-asc">Price: low to high</option><option value="price-desc">Price: high to low</option></select></div>
<div class="field"><label for="f-av">Availability</label><select class="select" id="f-av"><option value="all">Show all</option><option value="yes">Available only</option></select></div></div>
<p class="result-count" id="count" aria-live="polite"></p><div class="grid auto four" id="results"></div>`;
    U.$("#f-sort").value = st.sort;
    const chips = U.$("#chips");
    chips.innerHTML = [{ id: "all", name: "All" }].concat(CATS).map((c) => `<button class="chip" data-c="${c.id}" aria-pressed="${st.cat === c.id}">${c.name}</button>`).join("");
    function render() {
      let list = PRODUCTS.filter((p) => (st.cat === "all" || p.category === st.cat) && (!st.q || (p.name + " " + catName(p.category) + " " + p.id).toLowerCase().includes(st.q.toLowerCase())));
      if (st.price !== "all") { const [lo, hi] = st.price.split("-").map(Number); list = list.filter((p) => p.price >= lo && p.price < hi); }
      if (st.avail) list = list.filter((p) => availability(p).canBuy);
      const sorts = { popular: (a, b) => b.pop - a.pop, newest: (a, b) => (a.addedDate < b.addedDate ? 1 : -1), "price-asc": (a, b) => a.price - b.price, "price-desc": (a, b) => b.price - a.price };
      list.sort(sorts[st.sort] || sorts.popular);
      U.$("#count").textContent = list.length + (list.length === 1 ? " product found" : " products found");
      const rs = U.$("#results");
      if (list.length) { rs.className = "grid auto four"; rs.innerHTML = cards(list); }
      else { rs.className = ""; rs.innerHTML = `<div class="empty"><div class="big">🎀</div><h3>No products found</h3><p>Try a different word, or clear the filters.</p><button class="btn" id="clear">Clear filters</button></div>`; }
      chips.querySelectorAll(".chip").forEach((c) => c.setAttribute("aria-pressed", String(c.dataset.c === st.cat)));
    }
    chips.addEventListener("click", (e) => { const b = e.target.closest(".chip"); if (b) { st.cat = b.dataset.c; render(); } });
    U.$("#f-q").addEventListener("input", (e) => { st.q = e.target.value.trim(); render(); });
    U.$("#f-price").addEventListener("change", (e) => { st.price = e.target.value; render(); });
    U.$("#f-sort").addEventListener("change", (e) => { st.sort = e.target.value; render(); });
    U.$("#f-av").addEventListener("change", (e) => { st.avail = e.target.value === "yes"; render(); });
    root.addEventListener("click", (e) => { if (e.target.id === "clear") { Object.assign(st, { q: "", cat: "all", price: "all", avail: false }); U.$("#f-q").value = ""; U.$("#f-price").value = "all"; U.$("#f-av").value = "all"; render(); } });
    render();
  }

  // ----- PRODUCT DETAILS PAGE -----
  function initProduct() {
    const root = U.$("#product"), p = byId(U.param("id"));
    if (!p) { root.innerHTML = `<div class="empty"><div class="big">🎀</div><h2>Product not found</h2><p>This product may have moved.</p><a class="btn" href="shop.html">Back to shop</a></div>`; return; }
    document.title = p.name + " | " + window.SITE.brand;
    const imgs = imagesOf(p);
    const st = { opts: window.Cart.defaults(p), qty: 1, img: 0 };
    const col = window.Col && window.Col.byId(p.collectionId);
    function render() {
      const a = availability(p), s = stockOf(p), inCart = window.Cart.qtyOf(p.id);
      const maxQ = Math.max(0, Math.min(s - inCart, 20));
      if (st.qty > maxQ) st.qty = Math.max(1, maxQ);
      const price = window.Cart.unit(p, st.opts);
      let extra = "";
      if (p.preorder) {
        const ps = preorderState(p);
        extra += `<div class="box pink"><h4>Pre-order information</h4><p>Pre-order window: ${U.fmtDate(p.preorder.opens)} to ${U.fmtDate(p.preorder.closes)} (${ps === "open" ? "open now" : ps})</p>
<p>${p.preorder.shipConfirmed ? "Confirmed shipping date: <b>" + U.fmtDate(p.preorder.ships) + "</b>" : "Estimated shipping date: <b>" + U.fmtDate(p.preorder.ships) + "</b> (estimate only, not confirmed)"}</p><p>Available quantity: ${s}</p></div>`;
      }
      if (p.limited) {
        const pct = Math.max(0, Math.round((s / p.limited.total) * 100));
        extra += `<div class="box lav"><h4>Limited edition</h4><div class="meter" role="img" aria-label="${s} of ${p.limited.total} remaining"><i style="width:${pct}%"></i></div><p class="meter-txt">${s > 0 ? s + " of " + p.limited.total + " remaining" : "All " + p.limited.total + " sold"} (demo stock)</p></div>`;
      }
      if (p.type === "digital") extra += `<div class="box lav"><h4>✦ Digital product</h4><p>Format: ${U.esc(p.spec)}. No shipping fee.</p><p>Delivery is <b>simulated</b> in this demo. A live store would give you a secure, expiring download link after payment is verified.</p></div>`;
      else extra += `<div class="box"><h4>Order queue</h4><p>Every physical order gets a queue number, first come first served. <a href="queue.html">How the queue works</a></p></div>`;
      const groups = (p.variations || []).map((v) => `<div class="opt-group"><fieldset><legend>${v.name}: <span style="font-weight:500">${U.esc(st.opts[v.name])}</span></legend><div class="opt-chips">${v.options.map((op) => `<button type="button" class="opt" data-g="${U.esc(v.name)}" data-v="${U.esc(op.label)}" aria-pressed="${st.opts[v.name] === op.label}">${U.esc(op.label)}${op.delta ? " (" + (op.delta > 0 ? "+" : "-") + "RM " + Math.abs(op.delta) + ")" : ""}</button>`).join("")}</div></fieldset></div>`).join("");
      root.innerHTML = `<div class="crumbs"><a href="index.html">Home</a> / <a href="shop.html">Shop</a> / <a href="shop.html?cat=${p.category}">${catName(p.category)}</a> / ${U.esc(p.name)}</div>
<div class="pd"><div class="pd-gallery"><div class="pd-main"><img src="${imgs[st.img]}" alt="${U.esc(p.name)} photo ${st.img + 1} (demo image)"></div>
<div class="thumbs">${imgs.map((src, i) => `<button class="thumb" data-i="${i}" aria-label="Show photo ${i + 1}" aria-current="${i === st.img}"><img src="${src}" alt=""></button>`).join("")}</div></div>
<div class="pd-info">${badgeHtml(badges(p))}<h1>${U.esc(p.name)}</h1><div class="pd-id">Product ID: ${p.id} &nbsp;|&nbsp; Category: <a href="shop.html?cat=${p.category}">${catName(p.category)}</a>${col ? ' &nbsp;|&nbsp; Collection: <a href="collections.html?c=' + col.id + '">' + U.esc(col.title) + "</a>" : ""}</div>
<div class="pd-price">${U.money(price)}</div><p class="avail ${a.key}" style="font-size:.95rem">${U.esc(a.label)}</p>
<p>${U.esc(p.desc || DESC[p.category])} ${p.spec ? "<br><small>Details: " + U.esc(p.spec) + "</small>" : ""}<br><small><i>Fictional demo product, not a real Hiyori release.</i></small></p>
${groups}${extra}
<div class="buy-row"><div class="qty" role="group" aria-label="Quantity"><button type="button" id="qm" aria-label="Decrease quantity">-</button><output id="qv" aria-live="polite">${st.qty}</output><button type="button" id="qp" aria-label="Increase quantity">+</button></div>
<button class="btn" id="buy" ${a.canBuy && maxQ > 0 ? "" : "disabled"}>${a.canBuy ? (maxQ > 0 ? "Add to Cart" : "All stock in your cart") : "Unavailable"}</button></div><p class="msg" id="msg" aria-live="polite">${inCart ? inCart + " already in your cart." : ""}</p></div></div>
<section class="section" style="padding-bottom:0"><div class="sec-head"><h2>You may also like</h2></div><div class="grid auto four">${cards(related(p))}</div></section>`;
      root.querySelectorAll(".opt").forEach((b) => b.addEventListener("click", () => { st.opts[b.dataset.g] = b.dataset.v; render(); }));
      root.querySelectorAll(".thumb").forEach((b) => b.addEventListener("click", () => { st.img = +b.dataset.i; render(); }));
      U.$("#qm").onclick = () => { st.qty = Math.max(1, st.qty - 1); U.$("#qv").textContent = st.qty; };
      U.$("#qp").onclick = () => { if (st.qty < maxQ) { st.qty++; U.$("#qv").textContent = st.qty; } else { const m = U.$("#msg"); m.className = "msg err"; m.textContent = "Only " + maxQ + " available to add."; } };
      U.$("#buy").onclick = (e) => {
        const r = window.Cart.add(p.id, st.opts, st.qty), m = U.$("#msg");
        if (r.ok) { U.toast("Added to cart ♡"); const b = e.currentTarget; b.classList.add("pop"); setTimeout(() => render(), 650); }
        else { m.className = "msg err"; m.textContent = r.msg; }
      };
    }
    render();
  }

  window.Shop = { CATS, PRODUCTS, byId, catName, stockOf, preorderState, availability, badges, badgeHtml, imagesOf, card, cards, related, stockMap };
  window.PAGES = window.PAGES || {};
  window.PAGES.shop = initShop; window.PAGES.product = initProduct;
})();
