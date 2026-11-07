/* ==========================================================
   MAIN: shared header/footer, home page, about, contact, FAQ,
   policies. Runs on every page (loaded last).
   ========================================================== */
(function () {
  const U = window.U, S = window.SITE;
  const page = document.body.dataset.page;
  const ICON = {
    menu: '<svg viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
    search: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"/><path d="m20 20-4-4"/></svg>',
    user: '<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4.5 20c1-4 4-6 7.5-6s6.500 2 7.500 6"/></svg>',
    bag: '<svg viewBox="0 0 24 24"><path d="M5 8h14l-1 12H6L5 8Z"/><path d="M9 8V6.500a3 3 0 0 1 6 0V8"/></svg>'
  };
  const NAV = [["index.html", "HOME", "home"], ["shop.html", "SHOP", "shop"], ["collections.html", "COLLECTIONS", "collections"], ["gallery.html", "COSPLAY GALLERY", "gallery"], ["about.html", "ABOUT HIYORI", "about"], ["contact.html", "CONTACT", "contact"], ["queue.html", "QUEUE", "queue"]];
  const activeFor = { product: "shop", cart: "", checkout: "", success: "" };
  const cur = activeFor[page] !== undefined ? activeFor[page] : page;
  const searchForm = (cls) => `<form class="search ${cls}" action="shop.html" role="search"><label class="sr-only" for="sq-${cls}">Search products</label><input id="sq-${cls}" type="search" name="q" placeholder="Search products" autocomplete="off"><button aria-label="Search">${ICON.search}</button></form>`;

  function layout() {
    const h = U.$("#site-header"), f = U.$("#site-footer");
    if (h) h.innerHTML = `<div class="announce"><p id="announce" aria-live="polite">${S.announcements[0]}</p></div>
<header class="site-header"><div class="wrap hdr"><button class="icon-btn menu-btn" id="menubtn" aria-label="Open menu" aria-expanded="false" aria-controls="nav">${ICON.menu}</button>
<a class="logo" href="index.html" aria-label="${U.esc(S.brand)} home"><span class="logo-row">${U.BOW}<span class="logo-t">Hiyori's <em>Little World</em></span></span><small>${S.brandJp}</small></a>
<nav class="nav" id="nav" aria-label="Main">${NAV.map((n) => `<a href="${n[0]}" ${n[2] === cur ? 'aria-current="page"' : ""}>${n[1]}</a>`).join("")}${searchForm("search-mobile")}</nav>
<div class="hdr-tools">${searchForm("search-desktop")}<button class="icon-btn" id="acct" aria-label="Account (coming soon)">${ICON.user}</button><a class="icon-btn" href="cart.html" aria-label="Shopping cart">${ICON.bag}<span class="cart-count" data-n="0">0</span></a></div></div></header>`;
    if (f) f.innerHTML = `<footer class="site-footer"><div class="wrap"><div class="foot-grid">
<div class="foot-brand"><span class="logo-t">Hiyori's <em>Little World</em></span><p style="margin-top:.5rem;max-width:34ch">${S.tagline}</p><p class="note" style="color:#F6E9EF;opacity:.8">Official personal merchandise store (demo version)</p></div>
<div><h4>SHOP</h4><ul><li><a href="shop.html">All products</a></li><li><a href="collections.html">Collections</a></li><li><a href="gallery.html">Cosplay gallery</a></li><li><a href="queue.html">Order queue</a></li></ul></div>
<div><h4>HELP</h4><ul><li><a href="about.html">About</a></li><li><a href="contact.html">Contact</a></li><li><a href="faq.html">FAQ</a></li><li><a href="policies.html?p=shipping">Shipping Policy</a></li><li><a href="policies.html?p=returns">Return Policy</a></li><li><a href="policies.html?p=privacy">Privacy Policy</a></li><li><a href="policies.html?p=terms">Terms &amp; Conditions</a></li></ul></div>
<div><h4>FOLLOW</h4><ul>${S.socials.map((s) => `<li><a href="${s.url}" ${s.url === "#" ? 'data-placeholder-link' : 'target="_blank" rel="noopener"'}>${s.name}</a></li>`).join("")}</ul></div></div>
<div class="foot-note"><span>Demo website. Not a real store. Policies are drafts.</span><span>&copy; ${new Date().getFullYear()} ${U.esc(S.brand)} (placeholder)</span></div></div></footer>`;

    // announcement rotator
    let ai = 0; const an = U.$("#announce");
    if (an && S.announcements.length > 1) setInterval(() => { an.style.opacity = 0; setTimeout(() => { ai = (ai + 1) % S.announcements.length; an.textContent = S.announcements[ai]; an.style.opacity = 1; }, 400); }, 4500);
    // mobile menu
    const mb = U.$("#menubtn"), nav = U.$("#nav");
    mb.addEventListener("click", () => { const o = nav.classList.toggle("open"); mb.setAttribute("aria-expanded", String(o)); mb.setAttribute("aria-label", o ? "Close menu" : "Open menu"); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && nav.classList.contains("open")) { nav.classList.remove("open"); mb.setAttribute("aria-expanded", "false"); mb.focus(); } });
    U.$("#acct").addEventListener("click", () => U.toast("Customer accounts are coming in the full version."));
  }

  // quick add-to-cart buttons on product cards + placeholder links
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-add]");
    if (b) {
      const p = window.Shop.byId(b.dataset.add), r = window.Cart.add(p.id, window.Cart.defaults(p), 1);
      if (r.ok) { const d = Object.values(window.Cart.defaults(p)).join(", "); U.toast("Added " + p.name + (d ? " (" + d + ")" : "") + " ♡"); b.classList.add("pop"); setTimeout(() => b.classList.remove("pop"), 700); }
      else U.toast(r.msg);
    }
    const pl = e.target.closest("[data-placeholder-link]");
    if (pl) { e.preventDefault(); U.toast("Placeholder link. Add the approved social link in js/config.js"); }
  });

  // ---------- HOME ----------
  function initHome() {
    const Sh = window.Shop, P = Sh.PRODUCTS;
    const img = (src, label, i, ratio) => src || U.ph(label, i, ratio);
    U.$("#hero-img").src = img(S.images.hero, "Hiyori hero photo", 0, "3/4");
    U.$("#about-img").src = img(S.images.about, "Profile photo", 1, "1/1");
    U.$("#cat-strip").innerHTML = Sh.CATS.map((c) => `<a class="cat-item" href="shop.html?cat=${c.id}"><div class="cat-dot" aria-hidden="true">${c.icon}</div>${c.name}</a>`).join("");
    const newest = P.filter((p) => p.isNew).sort((a, b) => (a.addedDate < b.addedDate ? 1 : -1)).slice(0, 4);
    U.$("#new-arrivals").innerHTML = Sh.cards(newest);
    U.$("#featured-cols").innerHTML = window.Col.COLLECTIONS.slice(0, 3).map(window.Col.cardHtml).join("");
    U.$("#best").innerHTML = Sh.cards(P.filter((p) => p.bestseller).sort((a, b) => b.pop - a.pop).slice(0, 4));
    U.$("#fan").innerHTML = Sh.cards(P.filter((p) => p.fan && Sh.availability(p).canBuy).sort((a, b) => b.pop - a.pop).slice(0, 4));
    U.$("#limited").innerHTML = P.filter((p) => p.limited && Sh.stockOf(p) > 0).sort((a, b) => Sh.stockOf(a) / a.limited.total - Sh.stockOf(b) / b.limited.total).slice(0, 3).map((p) => {
      const s = Sh.stockOf(p), pct = Math.round((s / p.limited.total) * 100);
      return `<a class="ltd" href="product.html?id=${p.id}" style="text-decoration:none"><img src="${Sh.imagesOf(p)[0]}" alt="${U.esc(p.name)} (demo)"><div><h3>${U.esc(p.name)}</h3><div class="meter" role="img" aria-label="${s} of ${p.limited.total} left"><i style="width:${pct}%"></i></div><p class="meter-txt">Only ${s} left (demo stock)</p><b>${U.money(p.price)}</b></div></a>`;
    }).join("");
    window.Gal.render(U.$("#gal-prev"), window.Gal.items.slice(0, 6), "sq");
    U.$("#socials").innerHTML = S.socials.map((s) => `<a class="social" href="${s.url}" ${s.url === "#" ? "data-placeholder-link" : 'target="_blank" rel="noopener"'}>${s.name}</a>`).join("");
  }

  // ---------- ABOUT ----------
  function initAbout() {
    U.$("#about-img").src = S.images.about || U.ph("Profile photo", 1, "1/1");
    U.$("#about-socials").innerHTML = S.socials.map((s) => `<a class="social" href="${s.url}" ${s.url === "#" ? "data-placeholder-link" : 'target="_blank" rel="noopener"'}>${s.name}</a>`).join("");
    U.$("#about-projects").innerHTML = window.Col.COLLECTIONS.map((c) => `<li><a href="collections.html?c=${c.id}">${U.esc(c.title)}</a> (placeholder)</li>`).join("");
  }

  // ---------- CONTACT ----------
  function initContact() {
    const form = U.$("#contact-form"); U.$("#mail").textContent = S.contactEmail + " (placeholder)";
    form.addEventListener("submit", (e) => {
      e.preventDefault(); let ok = true;
      const chk = (id, test, msg) => { const f = U.$("#fd-" + id), er = U.$("#er-" + id), v = U.$("#" + id).value.trim(); const good = test(v); f.classList.toggle("bad", !good); er.textContent = good ? "" : msg; if (!good) ok = false; };
      chk("c-name", (v) => v.length > 1, "Please enter your name.");
      chk("c-email", (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v), "Please enter a valid email.");
      chk("c-msg", (v) => v.length > 9, "Please write at least 10 characters.");
      if (!ok) return;
      const m = U.get("hlw_messages", []); m.push({ name: U.$("#c-name").value, email: U.$("#c-email").value, subject: U.$("#c-sub").value, message: U.$("#c-msg").value, at: new Date().toISOString() }); U.set("hlw_messages", m);
      form.reset(); U.$("#c-ok").hidden = false; U.toast("Demo form saved locally. Nothing was sent.");
    });
  }

  // ---------- FAQ ----------
  const FAQ = [
    ["How do I place an order?", "Browse the shop, choose your options, and add items to your cart. Then go to checkout, fill in your details and place the order. In this demo version, orders are practice orders only."],
    ["What payment methods are supported?", "The demo offers Bank Transfer (Demo) only. Online banking, cards and e-wallets are planned for the real store. Never enter real card details in this demo."],
    ["How long does shipping take?", "Demo estimates: Malaysia Standard 3-5 working days, Express 1-2 working days, International 7-14 working days. Pre-order shipping dates are estimates until confirmed."],
    ["Can I order internationally?", "Yes. Choose your country at checkout and the International Shipping rate will apply. Final rates and any customs fees will be confirmed in the real store."],
    ["Are pre-orders refundable?", "This is a draft answer: refund rules for pre-orders will be decided by the store owner. See the draft Return Policy."],
    ["How are digital products delivered?", "In this demo, delivery is simulated. In the real store you will get a secure, expiring download link after payment is verified."],
    ["How does the order queue work?", "Orders with physical items get a queue ticket. Pre-order customers are served first in the order they ordered. Customers who order at an event join after the last pre-order customer. See the Queue page."],
    ["How can I contact the store?", "Use the Contact page. The email address shown there is a placeholder until the store owner provides the real one."]
  ];
  const POLICIES = {
    shipping: ["Shipping Policy", ["Delivery times", "Estimated delivery: Malaysia Standard 3-5 working days, Express 1-2 working days, International 7-14 working days. [Owner to confirm]"], ["Shipping fees", "Fees are shown at checkout. Free standard shipping may apply over a minimum spend. [Owner to confirm]"], ["Pre-orders", "Pre-order shipping dates are estimates until marked confirmed. [Owner to confirm]"], ["Digital products", "Digital products have no shipping. Delivery is by secure download link in the live store. [Owner to confirm]"]],
    returns: ["Return and Refund Policy", ["Returns", "[Owner to write: conditions for returning damaged or incorrect items.]"], ["Pre-orders", "[Owner to write: whether pre-orders can be cancelled or refunded, and until when.]"], ["Digital products", "[Owner to write: digital products are normally non-refundable once delivered.]"], ["Signed and limited items", "[Owner to write.]"]],
    privacy: ["Privacy Policy", ["What we collect", "In the live store: name, email, phone and shipping address, to process orders. [Owner and legal adviser to confirm]"], ["Demo version", "This demo stores information only in your own browser (localStorage). Nothing is sent to a server."], ["Your rights", "[Owner to write, following Malaysia's PDPA requirements.]"]],
    terms: ["Terms & Conditions", ["Using this site", "This is a demo website. Products and orders are not real. [Owner to replace with real terms]"], ["Orders and pricing", "[Owner to write.]"], ["Intellectual property", "All photographs and designs will belong to Hiyori or be used with permission. [Owner to confirm]"]]
  };
  function initFaq() { U.$("#faq").innerHTML = FAQ.map((q) => `<details><summary>${q[0]}</summary><p>${q[1]}</p></details>`).join(""); }
  function initPolicy() {
    const k = U.param("p"), p = POLICIES[k] || POLICIES.shipping;
    document.title = p[0] + " (Draft) | " + S.brand; U.$("#ptitle").textContent = p[0];
    U.$("#pbody").innerHTML = `<span class="draft">DRAFT. Not approved by the store owner</span><div class="prose">${p.slice(1).map((s) => `<h2>${s[0]}</h2><p>${s[1]}</p>`).join("")}</div><p class="note">Other policies: ${Object.keys(POLICIES).map((x) => `<a href="policies.html?p=${x}">${POLICIES[x][0]}</a>`).join(" | ")}</p>`;
  }

  // ---------- Newsletter (demo) ----------
  function initNews() {
    const f = U.$("#news-form"); if (!f) return;
    f.addEventListener("submit", (e) => {
      e.preventDefault(); const i = U.$("#news-email"), er = U.$("#news-err"), v = i.value.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) { er.textContent = "Please enter a valid email address."; i.focus(); return; }
      er.textContent = ""; const l = U.get("hlw_newsletter", []); if (!l.includes(v)) l.push(v); U.set("hlw_newsletter", l); i.value = ""; U.toast("Thank you! (Demo: nothing was really subscribed.)");
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    layout(); window.Cart.badge();
    const P = window.PAGES || {}, extra = { home: initHome, about: initAbout, contact: initContact, faq: initFaq, policy: initPolicy };
    const fn = P[page] || extra[page]; if (extra[page]) extra[page](); else if (fn) fn();
    initNews();
  });
})();
