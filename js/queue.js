/* ==========================================================
   ORDER QUEUE SYSTEM (demo, stored in this browser only)

   Rules:
   1. Every order that contains a physical item gets a queue ticket.
   2. PRE-ORDER tickets are numbered P-xxxx in the order they were placed.
   3. EVENT tickets (orders made while the store is in "event mode")
      are numbered E-xxxx and always line up AFTER the last pre-order customer.
   4. Position = pre-order tickets first, then event tickets.
   A real queue needs a server so everyone sees the same line (see docs).
   ========================================================== */
(function () {
  const U = window.U, S = window.SITE.queue;
  const mode = () => U.get("hlw_qmode", S.mode);
  const served = () => U.get("hlw_qserved", 0);
  const orders = () => U.get("hlw_orders", []).filter((o) => o.queue);
  function counts() {
    const o = orders(), p = o.filter((x) => x.queue.type === "preorder").length, e = o.filter((x) => x.queue.type === "event").length;
    return { p, e, baseP: S.baselinePreorder, baseE: S.baselineEvent, preTotal: S.baselinePreorder + p, evTotal: S.baselineEvent + e, all: S.baselinePreorder + p + S.baselineEvent + e };
  }
  // Called when a new order is created: gives the next ticket for the current mode.
  function newTicket() {
    const c = counts(), type = mode() === "event" ? "event" : "preorder";
    return { type, seq: type === "preorder" ? c.p + 1 : c.e + 1, joinedAt: new Date().toISOString(), eventName: type === "event" ? S.eventName : null };
  }
  // Works out the live position of an order's ticket.
  function info(order) {
    const c = counts(), t = order.queue, sv = served();
    let overall, label;
    if (t.type === "preorder") { overall = c.baseP + t.seq; label = "P-" + U.pad(c.baseP + t.seq); }
    else { overall = c.preTotal + c.baseE + t.seq; label = "E-" + U.pad(c.baseE + t.seq); }
    const state = overall <= sv ? "done" : overall === sv + 1 ? "next" : "waiting";
    return { label, overall, ahead: Math.max(0, overall - 1 - sv), state, type: t.type };
  }
  const stateText = (i) => (i.state === "done" ? "Served, thank you!" : i.state === "next" ? "You're next!" : i.ahead + (i.ahead === 1 ? " person" : " people") + " ahead of you");
  function ticketHtml(order) {
    const i = info(order);
    return `<div class="ticket"><p class="note" style="margin:0">${i.type === "preorder" ? "Pre-order queue" : "Event queue" + (order.queue.eventName ? " (" + U.esc(order.queue.eventName) + ")" : "")}</p><div class="tnum">${i.label}</div><p class="tpos">Overall position #${i.overall}</p><p style="margin:0">${stateText(i)}</p><p class="note" style="margin:.6rem 0 0">Order ${U.esc(order.id)} (DEMO)</p></div>`;
  }
  const mask = (n) => { const s = String(n || "Guest").trim(); return s.slice(0, 2) + "***"; };

  function initQueue() {
    const root = U.$("#queue");
    function draw() {
      const c = counts(), sv = served(), m = mode(), list = orders().map((o) => ({ o, i: info(o) })).sort((a, b) => a.i.overall - b.i.overall);
      root.innerHTML = `<div class="demo-banner"><b>DEMO QUEUE.</b> This queue lives only in your own browser. A real shared queue needs a secure backend (see the Future Upgrade Guide).</div>
<div class="stat-grid"><div class="stat"><b>${c.preTotal}</b><span>in pre-order queue</span></div><div class="stat"><b>${c.evTotal}</b><span>in event queue</span></div><div class="stat"><b>${sv}</b><span>served so far</span></div><div class="stat"><b>#${sv + 1}</b><span>now serving</span></div></div>
<div class="about-grid" style="align-items:start"><div>
<div class="form-card"><h2>Find my queue number</h2><form id="qf" novalidate><div class="field"><label for="qid">Order number or email</label><input class="input" id="qid" placeholder="e.g. HLW-DEMO-20261107-AB12 or you@email.com" autocomplete="off"><div class="err" id="qerr" role="alert"></div></div><button class="btn" style="margin-top:.7rem">Check my place</button></form><div id="qres" style="margin-top:1rem" aria-live="polite"></div></div>
<div class="form-card"><h2>How the queue works</h2><ol class="steps"><li><b>Pre-order customers go first.</b> Tickets are numbered P-xxxx in the order orders are placed.</li><li><b>Event customers come next.</b> Anyone who orders during the event gets an E-xxxx ticket, lined up after the last pre-order customer.</li><li><b>Digital items skip the queue.</b> Only orders with physical items get a ticket.</li></ol></div></div>
<div><div class="form-card"><h2>Demo controls</h2><p class="note">For testing only. In the future these will be in a secure admin dashboard.</p>
<div class="field"><label for="qmode">Store mode (decides which queue new orders join)</label><select class="select" id="qmode"><option value="preorder">Pre-order period</option><option value="event">Event day</option></select></div>
<div class="btns" style="margin-top:.8rem"><button class="btn btn-sm" id="qserve">Serve next customer</button><button class="btn btn-sm btn-ghost" id="qreset">Reset all demo data</button></div></div></div></div>
<div class="sec-head" style="margin-top:1.6rem"><h2>Tickets in this browser</h2></div>
${list.length ? `<div class="table-wrap"><table><thead><tr><th>Ticket</th><th>Position</th><th>Name</th><th>Queue</th><th>Status</th></tr></thead><tbody>${list.map(({ o, i }) => `<tr><td><b>${i.label}</b></td><td>#${i.overall}</td><td>${U.esc(mask(o.customer && o.customer.name))}</td><td><span class="pill ${i.type === "preorder" ? "p" : ""}">${i.type === "preorder" ? "Pre-order" : "Event"}</span></td><td><span class="pill ${i.state}">${i.state === "done" ? "Served" : i.state === "next" ? "Next" : i.ahead + " ahead"}</span></td></tr>`).join("")}</tbody></table></div>` : '<div class="empty"><div class="big">🎟️</div><p>No demo tickets yet. Place a demo order with a physical item to get one.</p><a class="btn" href="shop.html">Start shopping</a></div>'}
<p class="note" style="margin-top:.8rem">Demo note: ${S.baselinePreorder} pre-order and ${S.baselineEvent} event customers are simulated as already in line, so tickets start after them.</p>`;
      U.$("#qmode").value = m;
      U.$("#qmode").onchange = (e) => { U.set("hlw_qmode", e.target.value); U.toast("Store mode changed (demo)"); draw(); };
      U.$("#qserve").onclick = () => { if (served() < counts().all) { U.set("hlw_qserved", served() + 1); draw(); } else U.toast("Everyone has been served."); };
      U.$("#qreset").onclick = () => { if (confirm("Delete ALL demo orders, cart, queue and stock changes in this browser?")) { ["hlw_orders", "hlw_cart", "hlw_stock", "hlw_qserved", "hlw_qmode", "hlw_lastOrder"].forEach(U.del); window.Cart && window.Cart.badge(); draw(); } };
      U.$("#qf").onsubmit = (e) => {
        e.preventDefault(); const v = U.$("#qid").value.trim().toLowerCase(), err = U.$("#qerr"), res = U.$("#qres");
        err.textContent = ""; res.innerHTML = "";
        if (!v) { err.textContent = "Please enter your order number or email."; return; }
        const hits = orders().filter((o) => o.id.toLowerCase() === v || (o.customer && o.customer.email.toLowerCase() === v));
        if (!hits.length) { err.textContent = "No ticket found in this browser. Check the spelling, or order from this same device (demo)."; return; }
        res.innerHTML = hits.map(ticketHtml).join("<br>");
      };
    }
    draw();
  }
  window.Q = { mode, served, orders, counts, newTicket, info, ticketHtml, stateText };
  window.PAGES = window.PAGES || {}; window.PAGES.queue = initQueue;
})();
