/* ==========================================================
   FLOATING CART BUTTON + CART DRAWER
   Uses the same saved cart (localStorage) as the cart page.
   Hidden on cart.html and checkout.html (they already show the cart).
   ========================================================== */
(function () {
  const U = window.U;
  document.addEventListener("DOMContentLoaded", () => {
    const page = document.body.dataset.page;
    if (page === "cart" || page === "checkout") return;
    const fab = document.createElement("button");
    fab.className = "fab"; fab.id = "fab"; fab.setAttribute("aria-label", "Open shopping cart"); fab.setAttribute("aria-haspopup", "dialog");
    fab.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 8h14l-1 12H6L5 8Z"/><path d="M9 8V6.500a3 3 0 0 1 6 0V8"/></svg><span class="cart-count" data-n="0">0</span>';
    const wrap = document.createElement("div");
    wrap.className = "drawer-wrap"; wrap.hidden = true;
    wrap.innerHTML = '<div class="drawer-ov" data-close></div><aside class="drawer" role="dialog" aria-modal="true" aria-labelledby="dr-title" tabindex="-1"><div class="dr-head"><h2 id="dr-title">Your cart</h2><button class="icon-btn" data-close aria-label="Close cart">&times;</button></div><div class="dr-body" id="dr-body"></div><div class="dr-foot" id="dr-foot"></div></aside>';
    document.body.appendChild(fab); document.body.appendChild(wrap);
    const drawer = wrap.querySelector(".drawer"); let last = null;

    function draw() {
      const t = window.Cart.totals(window.Cart.shipKey()), body = U.$("#dr-body"), foot = U.$("#dr-foot");
      if (!t.items.length) {
        body.innerHTML = '<div class="empty" style="box-shadow:none;background:transparent"><div class="big">🛍️</div><h3>Your cart is empty</h3><p>Your little world is waiting. Find something you love!</p></div>';
        foot.innerHTML = '<a class="btn btn-block" href="shop.html">Start shopping</a>'; return;
      }
      body.innerHTML = t.items.map((it, idx) => `<div class="dr-item"><a href="product.html?id=${it.id}"><img src="${window.Shop.imagesOf(it.p)[0]}" alt="${U.esc(it.p.name)}"></a><div><h3>${U.esc(it.p.name)}</h3><small>${Object.values(it.opts).map(U.esc).join(", ")}</small>
<div class="dr-row"><div class="qty" role="group" aria-label="Quantity for ${U.esc(it.p.name)}"><button data-q="-1" data-idx="${idx}" aria-label="Decrease quantity">-</button><span>${it.qty}</span><button data-q="1" data-idx="${idx}" aria-label="Increase quantity">+</button></div><b>${U.money(it.line)}</b></div>
<button class="linkbtn" data-rm="${idx}">Remove</button></div></div>`).join("");
      foot.innerHTML = `<div class="sum-row"><span>Subtotal</span><span>${U.money(t.sub)}</span></div><div class="sum-row"><span>Shipping (estimate)</span><span>${t.hasPhysical ? (t.shipping ? U.money(t.shipping) : "FREE") : "None (digital)"}</span></div><div class="sum-row total"><span>Total</span><span>${U.money(t.total)}</span></div>
<a class="btn btn-block" href="checkout.html">Proceed to checkout</a><a class="btn btn-ghost btn-block" href="cart.html" style="margin-top:.5rem">View full cart</a><p class="note" style="text-align:center;margin:.6rem 0 0">Final shipping is chosen at checkout. Demo store.</p>`;
    }
    function open() { last = document.activeElement; draw(); wrap.hidden = false; document.body.style.overflow = "hidden"; drawer.focus(); }
    function close() { wrap.hidden = true; document.body.style.overflow = ""; (last || fab).focus(); }
    fab.addEventListener("click", open);
    wrap.addEventListener("click", (e) => {
      if (e.target.closest("[data-close]")) { close(); return; }
      const q = e.target.closest("[data-q]"), r = e.target.closest("[data-rm]");
      if (q) { const it = window.Cart.load()[+q.dataset.idx]; if (it) { const m = window.Cart.setQty(+q.dataset.idx, it.qty + +q.dataset.q); if (m) U.toast(m); } }
      if (r) { window.Cart.remove(+r.dataset.rm); U.toast("Item removed"); }
    });
    document.addEventListener("keydown", (e) => {
      if (wrap.hidden) return;
      if (e.key === "Escape") close();
      if (e.key === "Tab") { const f = U.$$("a[href],button:not([disabled])", drawer); if (!f.length) return; const a = f[0], z = f[f.length - 1]; if (e.shiftKey && (document.activeElement === a || document.activeElement === drawer)) { e.preventDefault(); z.focus(); } else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); } }
    });
    document.addEventListener("hlw:cart", () => { if (!wrap.hidden) draw(); fab.classList.remove("bump"); void fab.offsetWidth; fab.classList.add("bump"); });
    window.addEventListener("pageshow", () => window.Cart.badge());
  });
})();
