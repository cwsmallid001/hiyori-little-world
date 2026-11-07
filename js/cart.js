/* ==========================================================
   SHOPPING CART (saved in localStorage so it survives refresh)
   Cart line = { id, opts:{Size:"M",...}, qty }
   ========================================================== */
(function () {
  const U = window.U, KEY = "hlw_cart", SH = window.SITE.shipping;
  const sh = () => window.Shop;
  const load = () => U.get(KEY, []).filter((i) => i && sh().byId(i.id));
  const save = (c) => { U.set(KEY, c); badge(); };
  function badge() { const n = load().reduce((s, i) => s + i.qty, 0); U.$$(".cart-count").forEach((e) => { e.textContent = n; e.dataset.n = n; }); }
  const defaults = (p) => { const o = {}; (p.variations || []).forEach((v) => (o[v.name] = v.options[0].label)); return o; };
  const norm = (p, opts) => { const o = {}; (p.variations || []).forEach((v) => { o[v.name] = v.options.some((x) => x.label === (opts || {})[v.name]) ? opts[v.name] : v.options[0].label; }); return o; };
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  function unit(p, opts) { let pr = p.price; (p.variations || []).forEach((v) => { const op = v.options.find((x) => x.label === (opts || {})[v.name]); if (op) pr += op.delta; }); return U.r2(pr); }
  const qtyOf = (id) => load().filter((i) => i.id === id).reduce((s, i) => s + i.qty, 0);

  function add(id, opts, qty) {
    const p = sh().byId(id); if (!p) return { ok: false, msg: "Product not found." };
    const a = sh().availability(p); if (!a.canBuy) return { ok: false, msg: "Sorry, this item is not available right now." };
    qty = Math.max(1, parseInt(qty, 10) || 1);
    const stock = sh().stockOf(p), have = qtyOf(id);
    if (have + qty > stock) return { ok: false, msg: stock - have <= 0 ? "All available stock is already in your cart." : "Only " + (stock - have) + " more available." };
    const o = norm(p, opts), cart = load(), ex = cart.find((i) => i.id === id && same(i.opts, o));
    if (ex) ex.qty += qty; else cart.push({ id, opts: o, qty });
    save(cart); return { ok: true };
  }
  function setQty(idx, qty) {
    const cart = load(), it = cart[idx]; if (!it) return "";
    const p = sh().byId(it.id), max = sh().stockOf(p) - (qtyOf(it.id) - it.qty); let msg = "";
    if (qty > max) { qty = max; msg = "Only " + max + " available for this item."; }
    if (qty < 1) cart.splice(idx, 1); else it.qty = qty;
    save(cart); return msg;
  }
  const remove = (idx) => { const c = load(); c.splice(idx, 1); save(c); };
  function changeOpt(idx, name, value) {
    const cart = load(), it = cart[idx]; if (!it) return;
    it.opts[name] = value;
    const dup = cart.findIndex((x, j) => j !== idx && x.id === it.id && same(x.opts, it.opts));
    if (dup > -1) { cart[dup].qty += it.qty; cart.splice(idx, 1); }
    save(cart);
  }
  const clear = () => save([]);
  const shipKey = () => U.get("hlw_ship", "my_standard");

  // Cart maths. Returns every number the cart and checkout pages need.
  function totals(shipKeyIn, code) {
    const items = load().map((i) => { const p = sh().byId(i.id), u = unit(p, i.opts); return Object.assign({}, i, { p, unit: u, line: U.r2(u * i.qty) }); });
    const sub = U.r2(items.reduce((s, i) => s + i.line, 0));
    const phys = U.r2(items.filter((i) => i.p.type === "physical").reduce((s, i) => s + i.line, 0));
    const hasPhysical = items.some((i) => i.p.type === "physical"), hasDigital = items.some((i) => i.p.type === "digital");
    const pct = code ? window.SITE.discountCodes[String(code).toUpperCase()] || 0 : 0;
    const discount = U.r2((sub * pct) / 100);
    const rate = SH[shipKeyIn] || SH.my_standard;
    let shipping = 0;
    if (hasPhysical) shipping = rate.freeOver && phys >= rate.freeOver ? 0 : rate.fee;
    return { items, sub, phys, hasPhysical, hasDigital, pct, discount, shipping, rate, total: U.r2(sub - discount + shipping) };
  }
  // Re-checks stock/availability. Returns list of problems (and fixes quantities).
  function validate() {
    const problems = [], cart = load();
    cart.forEach((it) => {
      const p = sh().byId(it.id), a = sh().availability(p), s = sh().stockOf(p);
      if (!a.canBuy) problems.push(p.name + " is no longer available.");
      else if (qtyOf(it.id) > s) problems.push("Only " + s + " of " + p.name + " left.");
    });
    return problems;
  }

  function initCart() {
    const root = U.$("#cart");
    function draw() {
      const t = totals(shipKey()), probs = validate();
      if (!t.items.length) { root.innerHTML = `<div class="empty"><div class="big">🛍️</div><h2>Your cart is empty</h2><p>Your little world is waiting. Find something you love!</p><div class="btns" style="justify-content:center"><a class="btn" href="shop.html">Start shopping</a><a class="btn btn-ghost" href="collections.html">Browse collections</a></div></div>`; return; }
      const rows = t.items.map((it, idx) => {
        const a = sh().availability(it.p);
        const sels = (it.p.variations || []).map((v) => `<div><label for="o${idx}-${v.name}">${v.name}</label><select class="select" id="o${idx}-${v.name}" data-idx="${idx}" data-name="${U.esc(v.name)}">${v.options.map((op) => `<option ${op.label === it.opts[v.name] ? "selected" : ""} value="${U.esc(op.label)}">${U.esc(op.label)}</option>`).join("")}</select></div>`).join("");
        return `<div class="cart-item"><a href="product.html?id=${it.id}"><img src="${sh().imagesOf(it.p)[0]}" alt="${U.esc(it.p.name)}"></a><div><h3><a href="product.html?id=${it.id}" style="text-decoration:none">${U.esc(it.p.name)}</a></h3>
<div>${sh().badgeHtml(sh().badges(it.p).slice(0, 2))}</div><div class="ci-opts">${sels}</div>${a.canBuy ? "" : `<p class="msg err">${U.esc(a.label)}. Please remove this item.</p>`}
<div class="ci-row"><div class="qty" role="group" aria-label="Quantity for ${U.esc(it.p.name)}"><button data-q="-1" data-idx="${idx}" aria-label="Decrease quantity">-</button><span>${it.qty}</span><button data-q="1" data-idx="${idx}" aria-label="Increase quantity">+</button></div>
<div><small>${U.money(it.unit)} each</small><br><b>${U.money(it.line)}</b></div><button class="linkbtn" data-rm="${idx}">Remove</button></div></div></div>`;
      }).join("");
      const shipOpts = Object.keys(SH).map((k) => `<option value="${k}" ${k === shipKey() ? "selected" : ""}>${SH[k].label} (${U.money(SH[k].fee)})</option>`).join("");
      root.innerHTML = `<div class="cart-layout"><div>${probs.length ? `<div class="box pink" role="alert"><h4>Please check your cart</h4>${probs.map((x) => "<p>" + U.esc(x) + "</p>").join("")}</div>` : ""}${rows}<p><a class="link-more" href="shop.html">Continue shopping</a></p></div>
<aside class="summary" aria-label="Order summary"><h2>Order summary</h2><div class="sum-row"><span>Subtotal</span><span>${U.money(t.sub)}</span></div>
${t.hasPhysical ? `<div class="field" style="margin:.4rem 0"><label for="shipsel">Shipping (estimate)</label><select class="select" id="shipsel">${shipOpts}</select></div>` : ""}
<div class="sum-row"><span>Shipping</span><span>${t.hasPhysical ? (t.shipping ? U.money(t.shipping) : "FREE") : "None (digital only)"}</span></div>
<div class="sum-row total"><span>Total</span><span>${U.money(t.total)}</span></div>
<p class="note">${t.hasPhysical && t.rate.freeOver ? "Free standard shipping on physical items over " + U.money(t.rate.freeOver) + ". " : ""}Discount codes can be added at checkout.</p>
<a class="btn btn-block ${probs.length ? "is-off" : ""}" href="checkout.html" ${probs.length ? 'aria-disabled="true"' : ""}>Proceed to checkout</a><p class="note" style="margin-top:.7rem;text-align:center">Demo store: no real payment is taken.</p></aside></div>`;
    }
    root.addEventListener("click", (e) => {
      const q = e.target.closest("[data-q]"), r = e.target.closest("[data-rm]");
      if (q) { const it = load()[+q.dataset.idx]; const m = setQty(+q.dataset.idx, it.qty + +q.dataset.q); if (m) U.toast(m); draw(); }
      if (r) { remove(+r.dataset.rm); draw(); U.toast("Item removed"); }
    });
    root.addEventListener("change", (e) => {
      if (e.target.dataset.name) { changeOpt(+e.target.dataset.idx, e.target.dataset.name, e.target.value); draw(); }
      if (e.target.id === "shipsel") { U.set("hlw_ship", e.target.value); draw(); }
    });
    draw();
  }
  window.Cart = { load, add, setQty, remove, changeOpt, clear, totals, validate, defaults, unit, qtyOf, badge, shipKey };
  window.PAGES = window.PAGES || {}; window.PAGES.cart = initCart;
})();
