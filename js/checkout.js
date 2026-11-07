/* ==========================================================
   DEMO CHECKOUT + ORDER SUCCESS PAGE
   No real payment is taken. No card details are collected.
   To go live later, replace placeOrder() with a call to your
   secure server, which talks to the payment provider.
   ========================================================== */
(function () {
  const U = window.U, SH = window.SITE.shipping;
  const COUNTRIES = ["Malaysia", "Singapore", "Brunei", "Indonesia", "Thailand", "Philippines", "Japan", "Hong Kong", "Taiwan", "Australia", "United States", "United Kingdom", "Other"];
  const STATES = ["Johor", "Kedah", "Kelantan", "Melaka", "Negeri Sembilan", "Pahang", "Penang", "Perak", "Perlis", "Sabah", "Sarawak", "Selangor", "Terengganu", "Kuala Lumpur", "Labuan", "Putrajaya"];
  const PAY = [
    { id: "bank", label: "Bank Transfer (Demo)", on: true, note: "Demo only. No real transfer is needed." },
    { id: "online", label: "Online Banking", on: false, note: "Future integration" },
    { id: "card", label: "Credit / Debit Card", on: false, note: "Future integration. Card details are never collected here." },
    { id: "ewallet", label: "E-wallet", on: false, note: "Future integration" }
  ];
  const payLabel = (id) => (PAY.find((p) => p.id === id) || PAY[0]).label;

  function orderId() {
    const used = U.get("hlw_orders", []).map((o) => o.id), d = U.date(0).replace(/-/g, "");
    let id; do { id = "HLW-DEMO-" + d + "-" + Math.random().toString(36).slice(2, 6).toUpperCase(); } while (used.includes(id));
    return id;
  }

  function initCheckout() {
    const root = U.$("#checkout");
    if (!window.Cart.load().length) { root.innerHTML = `<div class="empty"><div class="big">🛍️</div><h2>Your cart is empty</h2><p>Add something first, then come back to check out.</p><a class="btn" href="shop.html">Start shopping</a></div>`; return; }
    const st = { country: "Malaysia", ship: window.Cart.shipKey(), code: "", pay: "bank" };
    const digitalOnly = !window.Cart.totals(st.ship).hasPhysical;
    const f = (id, label, type = "text", extra = "") => `<div class="field" id="fd-${id}"><label for="${id}">${label}</label><input class="input" id="${id}" name="${id}" type="${type}" ${extra}><div class="err" id="er-${id}" role="alert"></div></div>`;
    root.innerHTML = `<div class="demo-banner"><b>DEMO CHECKOUT.</b> No payment is processed and no real order is placed. Please do not enter card numbers or passwords.</div>
<form id="cof" novalidate><div class="co-layout"><div>
<div class="form-card"><h2>Your details</h2><div class="fgrid two">${f("name", "Full name", "text", 'autocomplete="name"')}${f("email", "Email address", "email", 'autocomplete="email"')}${f("phone", "Phone number", "tel", 'autocomplete="tel" placeholder="+60 12-345 6789"')}</div></div>
<div class="form-card" id="addr" ${digitalOnly ? "hidden" : ""}><h2>Shipping address</h2><div class="fgrid two">
<div class="field" id="fd-country"><label for="country">Country</label><select class="select" id="country">${COUNTRIES.map((c) => `<option>${c}</option>`).join("")}</select></div>
<div class="field" id="fd-state"><label for="state">State</label><input class="input" id="state" list="states" autocomplete="address-level1"><datalist id="states">${STATES.map((s) => `<option value="${s}">`).join("")}</datalist><div class="err" id="er-state" role="alert"></div></div>
${f("city", "City", "text", 'autocomplete="address-level2"')}${f("postal", "Postal code", "text", 'autocomplete="postal-code" inputmode="numeric"')}</div>
<div class="field" id="fd-address" style="margin-top:.8rem"><label for="address">Full shipping address</label><textarea class="input" id="address" rows="3" autocomplete="street-address"></textarea><div class="err" id="er-address" role="alert"></div></div></div>
<div class="form-card" id="shipbox" ${digitalOnly ? "hidden" : ""}><h2>Shipping method</h2><div id="shiplist"></div></div>
${digitalOnly ? `<div class="box lav"><h4>✦ Digital order</h4><p>No shipping needed. Delivery is simulated in this demo.</p></div>` : ""}
<div class="form-card"><h2>Payment method</h2>${PAY.map((p) => `<label class="radio ${p.on ? "" : "off"} ${p.id === st.pay ? "sel" : ""}"><input type="radio" name="pay" value="${p.id}" ${p.on ? "" : "disabled"} ${p.id === st.pay ? "checked" : ""}><span><b>${p.label}</b><small>${p.note}</small></span></label>`).join("")}</div></div>
<aside class="summary" id="sum" aria-label="Order summary"></aside></div></form>`;

    const val = (id) => (U.$("#" + id) ? U.$("#" + id).value.trim() : "");
    function shipOptions() {
      const my = st.country === "Malaysia", keys = my ? ["my_standard", "my_express"] : ["intl"];
      if (!keys.includes(st.ship)) st.ship = keys[0];
      U.$("#shiplist").innerHTML = keys.map((k) => `<label class="radio ${k === st.ship ? "sel" : ""}"><input type="radio" name="ship" value="${k}" ${k === st.ship ? "checked" : ""}><span><b>${SH[k].label}</b><small>${U.money(SH[k].fee)}${SH[k].freeOver ? " (free over " + U.money(SH[k].freeOver) + ")" : ""}, about ${SH[k].days}</small></span></label>`).join("");
    }
    function summary() {
      const t = window.Cart.totals(st.ship, st.code);
      U.$("#sum").innerHTML = `<h2>Order summary</h2>${t.items.map((i) => `<div class="mini"><img src="${window.Shop.imagesOf(i.p)[0]}" alt=""><div>${U.esc(i.p.name)}<small>${Object.values(i.opts).map(U.esc).join(", ")}${i.p.type === "digital" ? " (digital)" : ""}<br>Qty ${i.qty} x ${U.money(i.unit)}</small></div><b>${U.money(i.line)}</b></div>`).join("")}
<div class="field" style="margin:.8rem 0 .3rem"><label for="code">Discount code</label><div style="display:flex;gap:.4rem"><input class="input" id="code" value="${U.esc(st.code)}" placeholder="Try DEMO10" autocomplete="off"><button type="button" class="btn btn-sm" id="applycode">Apply</button></div><div class="err" id="er-code" role="status"></div></div>
<div class="sum-row"><span>Subtotal</span><span>${U.money(t.sub)}</span></div>${t.discount ? `<div class="sum-row disc"><span>Discount (${t.pct}%)</span><span>-${U.money(t.discount)}</span></div>` : ""}
<div class="sum-row"><span>Shipping</span><span>${t.hasPhysical ? (t.shipping ? U.money(t.shipping) : "FREE") : "None (digital)"}</span></div>
<div class="sum-row total"><span>Grand total</span><span>${U.money(t.total)}</span></div>
<button class="btn btn-block" type="submit" id="place">Place demo order</button><p class="note" style="text-align:center;margin-top:.6rem">This creates a DEMO order only.</p>`;
      U.$("#applycode").onclick = () => {
        const c = val("code").toUpperCase(), er = U.$("#er-code");
        if (!c) { st.code = ""; summary(); return; }
        if (window.SITE.discountCodes[c]) { st.code = c; summary(); U.$("#er-code").style.color = "var(--ok)"; U.$("#er-code").textContent = "Code applied!"; }
        else { er.style.color = ""; er.textContent = "That code is not valid."; }
      };
    }
    function fail(id, msg) { const fd = U.$("#fd-" + id), er = U.$("#er-" + id); if (fd) fd.classList.add("bad"); if (er) er.textContent = msg; return id; }
    function validate() {
      U.$$(".field.bad").forEach((e) => e.classList.remove("bad")); U.$$(".err").forEach((e) => { if (e.id !== "er-code") e.textContent = ""; });
      const bad = [];
      if (val("name").length < 2) bad.push(fail("name", "Please enter your full name."));
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(val("email"))) bad.push(fail("email", "Please enter a valid email, like name@example.com."));
      if (!/^\+?[\d\s-]{8,16}$/.test(val("phone"))) bad.push(fail("phone", "Please enter a valid phone number (8 to 15 digits)."));
      if (!digitalOnly) {
        if (!val("state")) bad.push(fail("state", "Please enter your state."));
        if (!val("city")) bad.push(fail("city", "Please enter your city."));
        const pc = val("postal");
        if (st.country === "Malaysia" ? !/^\d{5}$/.test(pc) : pc.length < 3) bad.push(fail("postal", st.country === "Malaysia" ? "Malaysian postal codes have 5 digits." : "Please enter your postal code."));
        if (val("address").length < 8) bad.push(fail("address", "Please enter your full shipping address."));
      }
      return bad;
    }
    function placeOrder() {
      const probs = window.Cart.validate();
      if (probs.length) { U.toast(probs[0]); setTimeout(() => (location.href = "cart.html"), 1200); return; }
      const t = window.Cart.totals(st.ship, st.code), ticket = t.hasPhysical ? window.Q.newTicket() : null;
      const order = {
        id: orderId(), date: new Date().toISOString(), demo: true, status: "DEMO ORDER - payment not processed",
        customer: { name: val("name"), email: val("email"), phone: val("phone"), country: digitalOnly ? "" : st.country, state: val("state"), city: val("city"), postal: val("postal"), address: val("address") },
        items: t.items.map((i) => ({ id: i.id, name: i.p.name, category: i.p.category, type: i.p.type, opts: i.opts, qty: i.qty, unit: i.unit, line: i.line, preorder: i.p.preorder || null })),
        shipping: t.hasPhysical ? { key: st.ship, label: t.rate.label, fee: t.shipping, days: t.rate.days } : null,
        payment: { method: st.pay, label: payLabel(st.pay), status: "Demo: not paid, not processed" },
        subtotal: t.sub, discount: t.discount, discountCode: t.pct ? st.code : "", total: t.total, hasPhysical: t.hasPhysical, hasDigital: t.hasDigital, queue: ticket
      };
      // demo stock deduction (a real store does this on the server)
      const m = window.Shop.stockMap();
      t.items.forEach((i) => { if (i.p.type === "physical") { const cur = m[i.id] != null ? m[i.id] : window.Shop.stockOf(i.p); m[i.id] = Math.max(0, cur - i.qty); } });
      U.set("hlw_stock", m);
      const all = U.get("hlw_orders", []); all.push(order); U.set("hlw_orders", all); U.set("hlw_lastOrder", order.id);
      window.Cart.clear(); location.href = "order-success.html?o=" + encodeURIComponent(order.id);
    }
    shipOptions(); summary();
    root.addEventListener("change", (e) => {
      if (e.target.id === "country") { st.country = e.target.value; shipOptions(); summary(); }
      if (e.target.name === "ship") { st.ship = e.target.value; U.set("hlw_ship", st.ship); shipOptions(); summary(); }
    });
    U.$("#cof").addEventListener("submit", (e) => {
      e.preventDefault(); const bad = validate();
      if (bad.length) { U.toast("Please fix the highlighted fields."); const el = U.$("#" + bad[0]); if (el) el.focus(); return; }
      placeOrder();
    });
  }

  function initSuccess() {
    const root = U.$("#success"), id = U.param("o") || U.get("hlw_lastOrder", ""), o = U.get("hlw_orders", []).find((x) => x.id === id);
    if (!o) { root.innerHTML = `<div class="empty"><div class="big">🎀</div><h2>Order not found</h2><p>We couldn't find that demo order in this browser.</p><a class="btn" href="shop.html">Continue shopping</a></div>`; return; }
    const c = o.customer, ship = o.shipping;
    const po = o.items.filter((i) => i.preorder);
    root.innerHTML = `<div style="text-align:center;margin-bottom:1.6rem"><span class="badge demo">DEMO ORDER</span><h1 style="margin-top:.7rem;font-size:clamp(2rem,6vw,3.2rem)">Thank You for Your Order!</h1><p class="note">This is a demo order. No payment was taken and nothing will be shipped.</p></div>
<div class="co-layout"><div>
${o.queue ? `<div class="form-card"><h2>Your queue ticket</h2>${window.Q.ticketHtml(o)}<p class="note" style="margin-top:.7rem">Keep your order number. <a href="queue.html">Check your place in the queue</a> any time.</p></div>` : ""}
<div class="form-card"><h2>Order details</h2><p><b>Order number:</b> ${U.esc(o.id)}<br><b>Date:</b> ${U.fmtDateTime(o.date)}<br><b>Status:</b> ${U.esc(o.status)}<br><b>Payment method:</b> ${U.esc(o.payment.label)} <span class="badge preorder">DEMO, NOT PAID</span></p>
<p><b>Customer:</b> ${U.esc(c.name)}<br>${U.esc(c.email)} | ${U.esc(c.phone)}</p>
${ship ? `<p><b>Shipping to:</b><br>${U.esc(c.address)}, ${U.esc(c.city)} ${U.esc(c.postal)}, ${U.esc(c.state)}, ${U.esc(c.country)}<br><b>Method:</b> ${U.esc(ship.label)} (about ${ship.days}, estimate)</p>` : "<p><b>Delivery:</b> Digital only, no shipping.</p>"}
${po.length ? `<div class="box pink"><h4>Pre-order shipping</h4>${po.map((i) => `<p>${U.esc(i.name)}: estimated ship date ${U.fmtDate(i.preorder.ships)} (${i.preorder.shipConfirmed ? "confirmed" : "estimate, not confirmed"})</p>`).join("")}</div>` : ""}
${o.hasDigital ? `<div class="box lav"><h4>✦ Digital delivery (simulated)</h4><p>In a live store you would receive a secure download link that expires, after payment is verified. No real files are included in this demo.</p>${o.items.filter((i) => i.type === "digital").map((i) => `<p>${U.esc(i.name)}: <button class="btn btn-sm btn-ghost" data-demo-dl>Demo download</button></p>`).join("")}</div>` : ""}</div>
<div class="btns"><a class="btn" href="shop.html">Continue Shopping</a><a class="btn btn-ghost" href="index.html">Back to Home</a></div></div>
<aside class="summary"><h2>Order summary</h2>${o.items.map((i) => `<div class="mini"><img src="${window.Shop.imagesOf(window.Shop.byId(i.id))[0]}" alt=""><div>${U.esc(i.name)}<small>${Object.values(i.opts).map(U.esc).join(", ")}<br>Qty ${i.qty} x ${U.money(i.unit)}</small></div><b>${U.money(i.line)}</b></div>`).join("")}
<div class="sum-row" style="margin-top:.6rem"><span>Subtotal</span><span>${U.money(o.subtotal)}</span></div>${o.discount ? `<div class="sum-row disc"><span>Discount${o.discountCode ? " (" + U.esc(o.discountCode) + ")" : ""}</span><span>-${U.money(o.discount)}</span></div>` : ""}
<div class="sum-row"><span>Shipping</span><span>${ship ? (ship.fee ? U.money(ship.fee) : "FREE") : "None"}</span></div><div class="sum-row total"><span>Total</span><span>${U.money(o.total)}</span></div></aside></div>`;
    root.addEventListener("click", (e) => { if (e.target.closest("[data-demo-dl]")) U.toast("Demo only: no file to download."); });
  }
  window.PAGES = window.PAGES || {}; window.PAGES.checkout = initCheckout; window.PAGES.success = initSuccess;
})();
