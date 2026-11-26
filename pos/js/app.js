/* Hiyori's Little World: iPad POS. Sales are saved on this iPad FIRST, then uploaded when there is internet.
   Nothing is ever deleted automatically. Duplicate uploads are harmless (every sale has its own unique ID). */
(function () {
  "use strict";
  const C = window.HLW_POS, API = window.API, IDB = window.IDB;
  const $ = (s, r) => (r || document).querySelector(s), $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const b = (en, zh) => esc(en) + ' <span class="zh">' + esc(zh) + "</span>";
  const PM = [["cash", "Cash", "现金"], ["duitnow", "DuitNow", "DuitNow"], ["tng", "Touch 'n Go", "Touch 'n Go"]];
  const PMN = { cash: "Cash 现金", duitnow: "DuitNow", tng: "Touch 'n Go" };
  const S = { meta: {}, products: [], members: [], sales: [], cart: [], member: null, cat: "all", q: "", sync: { st: "idle", last: null, msg: "", needLogin: false }, syncing: false, screen: "boot", imgs: {}, pin: "", pinStage: "", pinTmp: "", fails: 0, openReceipt: null, choose: null };
  const pad = (n, w) => String(n).padStart(w || 2, "0");
  const hhmm = (d) => { d = new Date(d); return pad(d.getHours()) + ":" + pad(d.getMinutes()); };
  const ymd = (d) => { d = d || new Date(); return d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()); };
  const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => { const r = (Math.random() * 16) | 0; return (c === "x" ? r : (r & 3) | 8).toString(16); }));
  const cur = () => S.meta.currency || { code: "MYR", symbol: "RM", decimals: 2, rate_per_myr: 1 };
  const r2 = (n) => { const d = cur().decimals; return Math.round((n + Number.EPSILON) * 10 ** d) / 10 ** d; };
  const money = (n) => cur().symbol + (+n).toFixed(cur().decimals);
  const meta = async (k) => { const r = await IDB.get("meta", k); return r ? r.v : undefined; };
  const setMeta = async (k, v) => { S.meta[k] = v; await IDB.put("meta", { k, v }); };
  let tt; function toast(m, bad) { const t = $("#toast"); t.textContent = m; t.className = "toast show" + (bad ? " bad" : ""); clearTimeout(tt); tt = setTimeout(() => (t.className = "toast"), bad ? 6000 : 2600); }
  function openModal(html) { $("#modal-root").innerHTML = '<div class="modal-bg"><div class="modal">' + html + "</div></div>"; }
  function closeModal() { $("#modal-root").innerHTML = ""; S.openReceipt = null; S.choose = null; }
  const hex = (buf) => Array.from(new Uint8Array(buf)).map((x) => x.toString(16).padStart(2, "0")).join("");
  const sha = async (s) => hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)));
  const unhex = (h) => new Uint8Array(h.match(/../g).map((x) => parseInt(x, 16)));
  const pbk = async (pin, salt) => { const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveBits"]); return hex(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: 150000 }, k, 256)); };
  const normPhone = (raw) => { let d = String(raw || "").replace(/\D/g, ""); if (!d) return ""; if (d.startsWith("0")) d = "60" + d.slice(1); else if (d.length === 8 && cur().code === "SGD") d = "65" + d; return d; };

  // ---------------------------------------------------------------- stock, prices, points
  const prod = (id) => S.products.find((p) => p.id === id);
  const evSales = () => S.sales.filter((s) => s.event_id === (S.meta.event || {}).id);
  const localSold = (pid) => evSales().filter((s) => s.epoch === S.meta.epoch || s.status !== "synced").reduce((n, s) => n + s.items.filter((i) => i.product_id === pid).reduce((a, i) => a + i.qty, 0), 0);
  const avail = (p) => (p.type === "digital" ? Infinity : p.allocated - p.sold - localSold(p.id));
  const inCart = (pid) => S.cart.filter((i) => i.pid === pid).reduce((a, i) => a + i.qty, 0);
  const unitOf = (p, opts) => r2(p.price + (p.variations || []).reduce((a, g) => { const o = g.options.find((x) => x.label === (opts || {})[g.name]); return a + (o ? o.delta : 0); }, 0));
  const cartTotal = () => r2(S.cart.reduce((a, i) => a + i.unit * i.qty, 0));
  function calcPts() {
    const r = S.meta.rules || {}; if (!S.member || !r.confirmed || !r.per_rm) return 0; const fx = cur().rate_per_myr || 1; let myr = 0;
    S.cart.forEach((i) => { const p = prod(i.pid); if (r.excl_digital && p && p.type === "digital") return; myr += cur().code === "MYR" ? i.unit * i.qty : (i.unit * i.qty) / fx; });
    const v = myr * r.per_rm; return r.rounding === "round" ? Math.round(v) : r.rounding === "ceil" ? Math.ceil(v) : Math.floor(v);
  }
  const unsynced = () => S.sales.filter((s) => s.status !== "synced").length + S.members.filter((m) => m.local && m.status !== "synced").length;

  // ---------------------------------------------------------------- sync
  function pillInfo() {
    const n = unsynced();
    if (S.syncing) return ["busy", "Syncing 同步中…"];
    if (S.sync.needLogin) return ["warn", "Sign in to sync 请登录以同步"];
    if (!navigator.onLine || S.sync.st === "offline") return ["warn", "Offline 离线" + (n ? " · " + n + " pending" : "")];
    const bad = S.sales.filter((s) => s.status === "failed").length;
    if (bad) return ["warn", "Needs attention 需要处理 · " + bad];
    if (S.sync.st === "failed") return ["warn", "Sync failed 同步失败 · " + n];
    if (n > 0) return ["pend", "Pending Sync " + n + " 待同步"];
    return ["ok", S.sync.last ? "Synced 已同步 " + hhmm(S.sync.last) : "Online 在线"];
  }
  async function syncNow() {
    if (S.syncing || !S.meta.deviceId) return;
    if (!navigator.onLine) { S.sync.st = "offline"; drawHeader(); return; }
    const mems = S.members.filter((m) => m.local && m.status !== "synced"), sales = S.sales.filter((s) => s.status !== "synced").sort((x, y) => x.createdLocal - y.createdLocal).slice(0, 50);
    if (!mems.length && !sales.length) { S.sync.st = "idle"; S.sync.last = S.sync.last || Date.now(); drawHeader(); return; }
    S.syncing = true; drawHeader();
    try {
      const body = { app_version: C.version, pending_after: Math.max(0, unsynced() - mems.length - sales.length),
        members: mems.map((m) => ({ temp_id: m.id, name: m.name, phone: "+" + m.phoneNorm, registered_at: new Date(m.createdLocal).toISOString(), event_id: (S.meta.event || {}).id })),
        sales: sales.map((s) => ({ id: s.id, txn_no: s.txn_no, event_id: s.event_id, member_id: s.member_id, member_temp_id: s.member_temp_id, created_at_device: s.created_at_device, fx_rate: s.fx_rate, payment_method: s.payment_method, total: s.total, points_shown: s.points_shown, items: s.items.map((i) => ({ product_id: i.product_id, qty: i.qty, unit_price: i.unit_price, options: i.options })) })) };
      const r = await API.rpc("pos_sync", { p_device: S.meta.deviceId, p_batch: body });
      for (const x of r.results || []) {
        if (x.kind === "member") { const m = S.members.find((q) => q.id === x.id); if (!m) continue; if (["created", "linked", "duplicate"].includes(x.result)) Object.assign(m, { status: "synced", serverId: x.member_id, no: x.member_no, error: null }); else Object.assign(m, { status: "failed", error: x.reason }); await IDB.put("members", m); }
        else { const s = S.sales.find((q) => q.id === x.id); if (!s) continue; if (["accepted", "flagged", "duplicate"].includes(x.result)) Object.assign(s, { status: "synced", syncedAt: Date.now(), flags: x.flags || [], error: null }); else Object.assign(s, { status: "failed", error: x.reason, attempts: (s.attempts || 0) + 1 }); await IDB.put("sales", s); }
      }
      S.sync = { st: "idle", last: Date.now(), msg: "", needLogin: false };
    } catch (e) {
      if (e.network) S.sync = { st: "offline", last: S.sync.last, msg: e.message, needLogin: false };
      else if (e.auth) S.sync = { st: "failed", last: S.sync.last, msg: e.message, needLogin: true };
      else S.sync = { st: "failed", last: S.sync.last, msg: e.message, needLogin: false };
    } finally { S.syncing = false; drawHeader(); if ($("#hist")) drawHistory(); if (S.openReceipt) drawReceiptSync(); }
    if (!S.sync.needLogin && S.sync.st === "idle" && S.sales.some((s) => s.status === "pending")) setTimeout(syncNow, 500);
  }
  const syncSoon = () => setTimeout(syncNow, 300);

  // ---------------------------------------------------------------- screens
  function show(name) { S.screen = name; closeModal(); ({ login: scrLogin, setup: scrSetup, pin: scrPin, sales: scrSales, hist: scrHist })[name](); }
  function scrLogin(err) {
    $("#app").innerHTML = '<div class="center"><form class="card" id="lf"><h1>Hiyori\'s Little World</h1><p class="help">POS 收银 · ' + b("Sign in with your owner account. Internet is needed this once.", "用 Owner 账号登录，第一次需要网络。") + '</p><label>Email<input type="email" name="email" autocomplete="username" required></label><label>Password 密码<input type="password" name="password" autocomplete="current-password" required></label><p class="err" id="lerr">' + esc(err || "") + '</p><button class="btn primary" style="width:100%">' + b("Sign in", "登录") + "</button></form></div>";
    $("#lf").onsubmit = async (e) => { e.preventDefault(); const f = e.target, bt = $("button", f); bt.disabled = true; try { await API.login(f.email.value.trim(), f.password.value); f.password.value = ""; S.sync.needLogin = false; if (S.meta.deviceId && S.meta.event) { show(S.prevScreen || "pin"); syncSoon(); } else show("setup"); } catch (er) { $("#lerr").textContent = er.message; bt.disabled = false; } };
  }
  async function scrSetup(msg) {
    const root = $("#app"), has = !!S.meta.event;
    if (!S.meta.deviceId) {
      root.innerHTML = '<div class="center"><form class="card" id="df"><h1>' + b("Register this iPad", "登记这台 iPad") + '</h1><label>' + b("Name", "名称") + '<input type="text" name="n" value="Event iPad" maxlength="40"></label><p class="err" id="derr"></p><button class="btn primary" style="width:100%">' + b("Register", "登记") + "</button></form></div>";
      $("#df").onsubmit = async (e) => { e.preventDefault(); const bt = $("button", e.target); bt.disabled = true; try { const r = await API.rpc("pos_register_device", { p_name: e.target.n.value }); await setMeta("deviceId", r.device_id); await setMeta("deviceCode", "IP" + r.device_id.replace(/-/g, "").slice(0, 4).toUpperCase()); scrSetup(); } catch (er) { $("#derr").textContent = er.message; bt.disabled = false; } };
      return;
    }
    root.innerHTML = '<div class="center"><div class="card"><h1>' + b("Choose the event", "选择活动") + '</h1><p class="help">' + b("Loading…", "加载中…") + "</p></div></div>";
    try {
      const evs = await API.rpc("pos_events");
      root.innerHTML = '<div class="center"><div class="card"><h1>' + b("Choose the event", "选择活动") + '</h1><p class="err">' + esc(msg || "") + "</p>" + (evs.length ? evs.map((e) => '<button class="btn" style="width:100%;margin:.3rem 0;text-align:left" data-ev="' + e.id + '">' + esc(e.name) + '<br><span class="help">' + esc(e.starts_on || "") + " · " + esc(e.currency) + (e.location ? " · " + esc(e.location) : "") + "</span></button>").join("") : '<p class="help">' + b("No event is Prepared or Live. Prepare one in the admin: Events.", "没有「已准备」或「进行中」的活动。请先在后台「活动」里准备一个。") + "</p>") + '<div style="display:flex;gap:.5rem;margin-top:.8rem"><button class="btn small" id="sref">' + b("Refresh", "刷新") + "</button>" + (has ? '<button class="btn small" id="sback">' + b("Back", "返回") + "</button>" : "") + "</div></div></div>";
      $("#sref").onclick = () => scrSetup(); if (has) $("#sback").onclick = () => show("sales");
      $$("[data-ev]").forEach((el) => (el.onclick = () => pickEvent(el.dataset.ev)));
    } catch (e) { root.innerHTML = '<div class="center"><div class="card"><h1>' + b("Cannot load events", "无法加载活动") + '</h1><p class="err">' + esc(e.message) + '</p><div style="display:flex;gap:.5rem"><button class="btn primary" id="sref">' + b("Try again", "重试") + "</button>" + (e.auth ? '<button class="btn" id="slog">' + b("Sign in again", "重新登录") + "</button>" : "") + (has ? '<button class="btn" id="sback">' + b("Back", "返回") + "</button>" : "") + "</div></div></div>"; $("#sref").onclick = () => scrSetup(); if (has) $("#sback").onclick = () => show("sales"); if (e.auth) { S.prevScreen = "setup"; $("#slog").onclick = () => scrLogin(); } }
  }
  async function pickEvent(id) {
    $("#app").innerHTML = '<div class="center"><div class="card"><h1>' + b("Downloading event data…", "正在下载活动资料…") + '</h1><p class="help">' + b("Please keep the internet on. This takes a few seconds.", "请保持联网，需要几秒钟。") + "</p></div></div>";
    try {
      await syncNow(); if (unsynced() > 0) throw new Error("Please sync your pending sales first / 请先同步待上传的销售");
      const r = await API.rpc("pos_bootstrap", { p_event: id });
      const epoch = (S.meta.epoch || 0) + 1, keep = S.members.filter((m) => m.local && m.status !== "synced");
      await IDB.clear("products"); await IDB.putMany("products", r.products); await IDB.clear("members");
      const ms = r.members.map((m) => ({ id: m.id, no: m.no, name: m.name, points: m.points, legacy: m.legacy, phones: m.phones })).concat(keep); await IDB.putMany("members", ms);
      S.products = r.products; S.members = ms;
      await setMeta("event", r.event); await setMeta("currency", r.currency); await setMeta("rules", r.rules); await setMeta("categories", r.categories); await setMeta("epoch", epoch); await setMeta("bootAt", Date.now());
      S.cart = []; S.member = null; S.cat = "all"; loadImages(r.products);
      const pin = await meta("pin"); S.pinStage = pin ? "" : "set1"; show(pin ? "sales" : "pin");
    } catch (e) { scrSetup(e.message); }
  }
  async function loadImages(list) {
    for (const p of list) { if (!p.image) continue; try { let rec = await IDB.get("images", p.id); if (!rec || rec.url !== p.image) { const res = await fetch(p.image); if (!res.ok) continue; rec = { id: p.id, url: p.image, blob: await res.blob() }; await IDB.put("images", rec); } S.imgs[p.id] = URL.createObjectURL(rec.blob); if (S.screen === "sales") drawProducts(); } catch (e) {} }
  }
  // ---- PIN lock
  async function scrPin() {
    const has = !!(await meta("pin")); if (!S.pinStage) S.pinStage = has ? "unlock" : "set1"; S.pin = "";
    $("#app").innerHTML = '<div class="center"><div class="card" style="text-align:center"><h1>' + (S.pinStage === "unlock" ? b("Enter PIN", "输入密码") : S.pinStage === "set1" ? b("Create a PIN (4 to 6 digits)", "设置密码（4 到 6 位）") : b("Repeat the PIN", "再输入一次")) + '</h1><div class="dots" id="dots"></div><p class="err" id="perr"></p><div class="keys">' + [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => '<button data-k="' + n + '">' + n + "</button>").join("") + '<button data-k="c">⌫</button><button data-k="0">0</button><button data-k="ok" style="background:var(--blue)">OK</button></div>' + (S.pinStage === "unlock" ? '<p class="help" style="margin-top:1rem">' + b("Forgot the PIN? Sign out (needs internet); unsent sales stay safe on this iPad.", "忘记密码？退出登录（需要网络），未上传的销售仍安全保存在这台 iPad。") + '</p><button class="btn small danger" data-k="forgot">' + b("Sign out", "退出登录") + "</button>" : "") + "</div></div>";
    drawDots();
  }
  const drawDots = () => { const d = $("#dots"); if (d) d.innerHTML = [0, 1, 2, 3, 4, 5].map((i) => "<i" + (i < S.pin.length ? ' class="on"' : "") + "></i>").join(""); };
  async function pinKey(k) {
    if (k === "forgot") { if (confirm("Sign out? Unsent sales stay on this iPad. 退出登录？未上传的销售会保留在这台 iPad。")) { API.logout(); S.pinStage = ""; show("login"); } return; }
    if (k === "c") S.pin = S.pin.slice(0, -1); else if (k !== "ok") { if (S.pin.length < 6) S.pin += k; }
    drawDots(); if (k !== "ok") return;
    if (S.pin.length < 4) { $("#perr").textContent = "At least 4 digits / 至少 4 位"; return; }
    if (S.pinStage === "set1") { S.pinTmp = S.pin; S.pinStage = "set2"; return scrPin(); }
    if (S.pinStage === "set2") { if (S.pin !== S.pinTmp) { S.pinStage = "set1"; await scrPin(); $("#perr").textContent = "The two PINs differ, try again / 两次不一致"; return; } const salt = crypto.getRandomValues(new Uint8Array(16)); await setMeta("pin", { salt: hex(salt), hash: await pbk(S.pin, salt) }); S.pinStage = ""; S.pin = ""; return show("sales"); }
    const rec = await meta("pin"); if ((await pbk(S.pin, unhex(rec.salt))) === rec.hash) { S.pinStage = ""; S.fails = 0; S.pin = ""; return show("sales"); }
    S.fails++; S.pin = ""; drawDots(); const wait = S.fails >= 5 ? Math.min(60, 5 * (S.fails - 4)) : 0; $("#perr").textContent = "Wrong PIN 密码不对" + (wait ? " · wait " + wait + "s" : "");
    if (wait) { $$(".keys button").forEach((x) => (x.disabled = true)); setTimeout(() => $$(".keys button").forEach((x) => (x.disabled = false)), wait * 1000); }
  }
  function lock() { if (S.screen === "sales" || S.screen === "hist") { S.pinStage = "unlock"; S.prevScreen = "sales"; show("pin"); } }
  let idle; const resetIdle = () => { clearTimeout(idle); idle = setTimeout(lock, 5 * 60 * 1000); };

  // ---- main sales screen
  function headerHtml(back) {
    const p = pillInfo(); return '<div class="hd" id="hd">' + (back ? '<button class="btn small" data-a="back">← ' + b("Back", "返回") + "</button>" : "") + '<div class="ev">' + esc((S.meta.event || {}).name || "") + "<small>" + esc(cur().code) + " · " + esc(S.meta.deviceCode || "") + '</small></div><span class="pill ' + p[0] + '" data-a="syncnow">' + esc(p[1]).replace(/ ([\u4e00-\u9fa5].*)$/, ' <span class="zh">$1</span>') + '</span><button class="btn small" data-a="menu">☰ ' + b("Menu", "菜单") + "</button></div>";
  }
  function drawHeader() { const h = $("#hd"); if (!h) return; const back = !!$('[data-a="back"]', h); h.outerHTML = headerHtml(back); }
  function scrSales() {
    $("#app").innerHTML = headerHtml(false) + '<div class="sales"><div class="left"><div class="tools"><input type="search" id="q" placeholder="Search products 搜索商品" value="' + esc(S.q) + '"></div><div class="chips" id="chips"></div><div class="grid" id="grid"></div></div><aside class="cart" id="cart"><h2 data-a="cartToggle" id="ch"></h2><div class="lines" id="lines"></div><div class="mem" id="mem"></div><div class="tot" id="tot"></div><div class="pays" id="pays"></div></aside></div>';
    $("#q").oninput = (e) => { S.q = e.target.value; drawProducts(); };
    drawProducts(); drawCart();
  }
  function drawProducts() {
    const cats = (S.meta.categories || []).filter((c) => S.products.some((p) => p.category === c.id)); $("#chips").innerHTML = '<button class="chip ' + (S.cat === "all" ? "on" : "") + '" data-a="cat" data-id="all">' + b("All", "全部") + "</button>" + cats.map((c) => '<button class="chip ' + (S.cat === c.id ? "on" : "") + '" data-a="cat" data-id="' + esc(c.id) + '">' + esc(c.name) + "</button>").join("");
    const q = S.q.toLowerCase(), list = S.products.filter((p) => (S.cat === "all" || p.category === S.cat) && (!q || (p.name + " " + p.id + " " + (p.sku || "")).toLowerCase().includes(q)));
    $("#grid").innerHTML = list.length ? list.map((p) => { const a = avail(p), out = a - inCart(p.id) <= 0; return '<button class="prod ' + (out ? "out" : "") + '" data-a="add" data-id="' + esc(p.id) + '"><div class="im">' + (S.imgs[p.id] ? '<img src="' + S.imgs[p.id] + '" alt="">' : esc(p.name.charAt(0))) + "</div><b>" + esc(p.name) + '</b><span class="pr">' + money(p.price) + '</span><span class="st">' + (p.type === "digital" ? "Digital 数码" : a <= 0 ? "Sold out 售罄" : a + " left 剩余") + "</span></button>"; }).join("") : '<p class="help">' + b("No products. Allocate products to this event in the admin.", "没有商品。请在后台把商品分配给这场活动。") + "</p>";
  }
  function drawCart() {
    const n = S.cart.reduce((a, i) => a + i.qty, 0); const ch = $("#ch"); if (!ch) return; ch.innerHTML = b("Cart", "购物车") + " (" + n + ") · " + money(cartTotal());
    $("#lines").innerHTML = S.cart.length ? S.cart.map((i, k) => '<div class="line"><div><b>' + esc(i.name) + "</b><br><small>" + esc(Object.values(i.opts || {}).join(", ")) + " " + money(i.unit) + '</small></div><div class="qty"><button data-a="dec" data-k="' + k + '">−</button><b>' + i.qty + '</b><button data-a="inc" data-k="' + k + '">+</button></div><small>' + b("Line total", "小计") + ": " + money(i.unit * i.qty) + '</small><button class="btn small danger" data-a="rm" data-k="' + k + '">' + b("Remove", "移除") + "</button></div>").join("") : '<p class="help" style="padding:.8rem 0">' + b("Tap a product to add it.", "点商品加入购物车。") + "</p>";
    drawMember(); const pts = calcPts();
    $("#tot").innerHTML = (S.member ? '<div class="row"><span>' + b("Points to earn", "将获得积分") + "</span><b>+" + pts + "</b></div>" : '<div class="help">' + b("Choose a member to earn points.", "选择会员才能累积积分。") + "</div>") + '<div class="row"><span>' + b("Total", "合计") + '</span><span class="big">' + money(cartTotal()) + "</span></div>";
    $("#pays").innerHTML = PM.map((p) => '<button class="pay" data-a="pay" data-m="' + p[0] + '" ' + (S.cart.length ? "" : "disabled") + ">" + esc(p[1]) + (p[2] !== p[1] ? '<br><span class="zh">' + esc(p[2]) + "</span>" : "") + "</button>").join("");
  }
  function pendingPts(m) { return S.sales.filter((s) => s.status !== "synced" && (s.member_id === m.id || s.member_temp_id === m.id || (m.serverId && s.member_id === m.serverId))).reduce((a, s) => a + (s.points_shown || 0), 0); }
  function drawMember() {
    const el = $("#mem"); if (!el) return;
    if (S.member) { const m = S.member, pp = pendingPts(m); el.innerHTML = '<div class="sel"><div><b>' + esc(m.name) + "</b> " + esc(m.no || "(new 新)") + '<br><small>' + b("Points", "积分") + ": " + (m.points || 0) + (pp ? " (+" + pp + " pending)" : "") + '</small></div><button class="btn small" data-a="memclear">' + b("Remove", "移除") + "</button></div>"; return; }
    el.innerHTML = '<input type="search" id="ms" placeholder="Member: name, phone, number 会员：姓名、电话、编号"><div class="res" id="mres"></div><button class="btn small" style="margin-top:.4rem" data-a="newmem">+ ' + b("New member", "新会员") + "</button>";
    $("#ms").oninput = async (e) => { const r = await searchMembers(e.target.value); $("#mres").innerHTML = r.map((m) => '<button data-a="selmem" data-id="' + esc(m.id) + '"><b>' + esc(m.name) + "</b> " + esc(m.no || "(new)") + " · " + (m.points || 0) + " pts</button>").join("") || (e.target.value.trim().length >= 2 ? '<p class="help">' + b("No member found", "找不到会员") + "</p>" : ""); };
  }
  async function searchMembers(q) {
    q = q.trim(); if (q.length < 2) return []; const lq = q.toLowerCase(), digits = q.replace(/\D/g, ""), h = digits.length >= 8 ? await sha(normPhone(q)) : null, out = [];
    for (const m of S.members) {
      let hit = (m.no && m.no.toLowerCase() === lq) || (m.legacy || []).includes(q) || (m.name || "").toLowerCase().includes(lq);
      if (!hit && h) hit = (m.phones || []).some((p) => p.h === h) || (m.phoneNorm && m.phoneNorm === normPhone(q));
      if (!hit && digits.length === 4 && q === digits) hit = (m.phones || []).some((p) => p.l4 === digits) || (m.phoneNorm || "").endsWith(digits);
      if (hit) out.push(m); if (out.length >= 8) break;
    } return out;
  }
  function addLine(p, opts) {
    const a = avail(p); if (p.type === "physical" && inCart(p.id) + 1 > a) return toast("Not enough stock: " + p.name + " (" + Math.max(0, a) + " left) 库存不足", true);
    const key = JSON.stringify(opts || {}), ex = S.cart.find((i) => i.pid === p.id && JSON.stringify(i.opts) === key);
    if (ex) ex.qty++; else S.cart.push({ pid: p.id, name: p.name, opts: opts || {}, unit: unitOf(p, opts), qty: 1 }); drawCart(); drawProducts();
  }
  async function completeSale(pm) {
    if (!S.cart.length) return; const total = cartTotal();
    for (const i of S.cart) { const p = prod(i.pid); if (p.type === "physical" && inCart(p.id) > avail(p)) return toast("Not enough stock: " + p.name + " 库存不足", true); }
    const seq = (S.meta.seq || 0) + 1; await setMeta("seq", seq); const m = S.member, d = new Date();
    const sale = { id: uuid(), txn_no: (S.meta.deviceCode || "IP") + "-" + ymd(d) + "-" + pad(seq, 4), event_id: S.meta.event.id, member_id: m && !m.local ? m.id : m && m.serverId ? m.serverId : null, member_temp_id: m && m.local && !m.serverId ? m.id : null, member_label: m ? m.name + (m.no ? " (" + m.no + ")" : " (new)") : null,
      created_at_device: d.toISOString(), currency: cur().code, symbol: cur().symbol, decimals: cur().decimals, fx_rate: cur().rate_per_myr, payment_method: pm, total, points_shown: calcPts(), epoch: S.meta.epoch, status: "pending", createdLocal: Date.now(), attempts: 0,
      items: S.cart.map((i) => ({ product_id: i.pid, name: i.name, qty: i.qty, unit_price: i.unit, options: i.opts })) };
    await IDB.put("sales", sale); S.sales.push(sale); S.cart = []; S.member = null; drawCart(); drawProducts(); drawHeader(); showReceipt(sale.id); syncSoon();
  }
  const fmt = (s, n) => (s.symbol || "") + (+n).toFixed(s.decimals == null ? 2 : s.decimals);
  function receiptHtml(s) {
    return '<div class="receipt"><div style="text-align:center"><b>Hiyori\'s Little World</b><br>' + esc((S.meta.event || {}).name || "") + "<br>" + new Date(s.created_at_device).toLocaleString("en-MY") + '</div><hr><div class="r"><span>' + esc(s.txn_no) + "</span><span>" + esc(PMN[s.payment_method] || s.payment_method) + "</span></div><hr>" + s.items.map((i) => '<div class="r"><span>' + i.qty + " x " + esc(i.name) + (Object.keys(i.options || {}).length ? " (" + esc(Object.values(i.options).join(", ")) + ")" : "") + "</span><span>" + fmt(s, i.unit_price * i.qty) + "</span></div>").join("") + '<hr><div class="r"><b>TOTAL 合计</b><b>' + fmt(s, s.total) + "</b></div>" + (s.member_label ? '<hr><div class="r"><span>' + esc(s.member_label) + "</span><span>+" + (s.points_shown || 0) + " pts</span></div>" : "") + '<hr><div style="text-align:center">Thank you! 谢谢惠顾 ♡</div></div>';
  }
  function showReceipt(id) { const s = S.sales.find((x) => x.id === id); S.openReceipt = id; openModal('<h2>' + b("Sale saved", "销售已保存") + '</h2><p class="help" id="rsync"></p>' + receiptHtml(s) + '<div class="acts"><button class="btn primary" data-a="closemodal" style="flex:1">' + b("New sale", "新交易") + '</button><button class="btn" data-a="print">' + b("Print", "打印") + "</button></div>"); drawReceiptSync(); }
  function drawReceiptSync() { const s = S.sales.find((x) => x.id === S.openReceipt), el = $("#rsync"); if (!s || !el) return; el.innerHTML = "✓ " + b("Saved on this iPad", "已保存在这台 iPad") + " · " + (s.status === "synced" ? "<b>" + b("Uploaded", "已上传") + "</b>" : s.status === "failed" ? '<b style="color:var(--warn)">' + b("Needs attention", "需要处理") + ": " + esc(s.error || "") + "</b>" : b("Waiting to upload", "等待上传")); }
  function scrHist() { $("#app").innerHTML = headerHtml(true) + '<div class="hist" id="hist"></div>'; drawHistory(); }
  function drawHistory() {
    const el = $("#hist"); if (!el) return; const list = evSales().sort((x, y) => y.createdLocal - x.createdLocal), by = {}; let tot = 0; list.forEach((s) => { by[s.payment_method] = (by[s.payment_method] || 0) + s.total; tot += s.total; });
    el.innerHTML = '<h2>' + b("Sales on this iPad", "这台 iPad 的销售") + '</h2><p>' + b("Sales", "笔数") + ": <b>" + list.length + "</b> · " + b("Total", "合计") + ": <b>" + money(tot) + "</b></p><p class='help'>" + PM.map((p) => esc(p[1]) + ": " + money(by[p[0]] || 0)).join(" · ") + '</p><table><thead><tr><th>' + b("Time", "时间") + "</th><th>No.</th><th>" + b("Payment", "付款") + "</th><th>" + b("Total", "金额") + "</th><th>" + b("Member", "会员") + "</th><th>" + b("Status", "状态") + "</th></tr></thead><tbody>" + list.map((s) => '<tr class="click" data-a="rc" data-id="' + s.id + '"><td>' + hhmm(s.created_at_device) + "</td><td>" + esc(s.txn_no) + "</td><td>" + esc(PMN[s.payment_method] || s.payment_method) + "</td><td>" + fmt(s, s.total) + "</td><td>" + esc(s.member_label || "") + "</td><td>" + (s.status === "synced" ? "✓ " + b("Uploaded", "已上传") + ((s.flags || []).length ? " ⚠" : "") : s.status === "failed" ? '<span style="color:var(--warn)">⚠ ' + esc(s.error || "failed") + "</span>" : "… " + b("Waiting", "等待上传")) + "</td></tr>").join("") + "</tbody></table>";
  }
  function menu() {
    const p = pillInfo(); openModal("<h2>" + b("Menu", "菜单") + '</h2><p class="help">' + esc(p[1]) + (S.sync.msg ? " · " + esc(S.sync.msg) : "") + " · v" + esc(C.version) + '</p><div class="acts" style="flex-direction:column"><button class="btn primary" data-a="syncnow2">' + b("Sync now", "立即同步") + '</button><button class="btn" data-a="hist">' + b("Sales history", "销售记录") + '</button><button class="btn" data-a="exportjson">' + b("Save a backup file", "保存备份文件") + '</button><button class="btn" data-a="exportcsv">' + b("Export sales (CSV)", "导出销售 (CSV)") + '</button><button class="btn" data-a="switch">' + b("Switch event", "切换活动") + '</button><button class="btn" data-a="lock">' + b("Lock", "锁定") + '</button><button class="btn danger" data-a="signout">' + b("Sign out", "退出登录") + '</button><button class="btn small" data-a="closemodal">' + b("Close", "关闭") + "</button></div>");
  }
  async function save(name, mime, text) {
    const file = new File([text], name, { type: mime });
    if (navigator.canShare && navigator.canShare({ files: [file] })) { try { await navigator.share({ files: [file], title: name }); return; } catch (e) { if (e.name === "AbortError") return; } }
    const a = document.createElement("a"); a.href = URL.createObjectURL(file); a.download = name; document.body.appendChild(a); a.click(); a.remove();
  }
  const stamp = () => ymd() + "-" + hhmm(Date.now()).replace(":", "");
  async function exportJson() { const data = { app: "hlw-pos", version: C.version, exportedAt: new Date().toISOString(), device: S.meta.deviceId, event: S.meta.event, sales: await IDB.all("sales"), newMembers: (await IDB.all("members")).filter((m) => m.local) }; await save("pos-backup-" + stamp() + ".json", "application/json", JSON.stringify(data, null, 1)); }
  async function exportCsv() { const rows = [["Time", "Sale no.", "Event", "Payment", "Currency", "Total", "Member", "Points", "Items", "Status"]].concat(S.sales.map((s) => [s.created_at_device, s.txn_no, (S.meta.event || {}).name, s.payment_method, s.currency, s.total, s.member_label || "", s.points_shown, s.items.map((i) => i.qty + "x " + i.name).join("; "), s.status])); await save("pos-sales-" + stamp() + ".csv", "text/csv", "\ufeff" + rows.map((r) => r.map((c) => '"' + String(c == null ? "" : c).replace(/"/g, '""') + '"').join(",")).join("\r\n")); }
  function chooser(p) {
    S.choose = { pid: p.id, opts: Object.fromEntries((p.variations || []).map((g) => [g.name, g.options[0].label])) };
    const html = () => "<h2>" + esc(p.name) + "</h2>" + p.variations.map((g) => "<label>" + esc(g.name) + '</label><div class="opt">' + g.options.map((o) => '<button data-a="opt" data-g="' + esc(g.name) + '" data-v="' + esc(o.label) + '" class="' + (S.choose.opts[g.name] === o.label ? "on" : "") + '">' + esc(o.label) + (o.delta ? " (" + (o.delta > 0 ? "+" : "") + o.delta.toFixed(cur().decimals) + ")" : "") + "</button>").join("") + "</div>").join("") + '<div class="acts"><button class="btn primary" data-a="addopt" style="flex:1">' + b("Add", "加入") + " · " + money(unitOf(p, S.choose.opts)) + '</button><button class="btn" data-a="closemodal">' + b("Cancel", "取消") + "</button></div>";
    S.choose.html = html; openModal(html());
  }
  function newMember() {
    openModal("<h2>" + b("New member", "新会员") + '</h2><form id="nm"><label>' + b("Name (optional)", "姓名（可选）") + '<input type="text" name="n" maxlength="60"></label><label>' + b("Phone number", "电话号码") + '<input type="tel" name="p" placeholder="012-3456789"></label><p class="err" id="nerr"></p><p class="help">' + b("Works without internet. The member is saved on the next upload.", "没有网络也能登记，下次上传时保存。") + '</p><div class="acts"><button class="btn primary" style="flex:1">' + b("Save member", "保存会员") + '</button><button type="button" class="btn" data-a="closemodal">' + b("Cancel", "取消") + "</button></div></form>");
    $("#nm").onsubmit = async (e) => { e.preventDefault(); const f = e.target, ph = normPhone(f.p.value); if (ph.length < 9 || ph.length > 15) return ($("#nerr").textContent = "Please enter a valid phone number / 请输入有效的电话号码");
      const h = await sha(ph), dup = S.members.find((m) => (m.phones || []).some((p) => p.h === h) || m.phoneNorm === ph); if (dup) { S.member = dup; closeModal(); drawCart(); return toast("Already a member: " + dup.name + " 已是会员"); }
      const m = { id: "LOCAL-" + uuid(), local: true, status: "pending", name: f.n.value.trim() || "Customer", phoneNorm: ph, no: null, points: 0, createdLocal: Date.now() }; await IDB.put("members", m); S.members.push(m); S.member = m; closeModal(); drawCart(); drawHeader(); syncSoon(); };
  }

  // ---------------------------------------------------------------- one click handler for everything
  document.addEventListener("click", async (e) => {
    const k = e.target.closest("[data-k]"); if (k && S.screen === "pin") return pinKey(k.dataset.k);
    const el = e.target.closest("[data-a]"); if (!el) return; const a = el.dataset.a, id = el.dataset.id; resetIdle();
    try {
      if (a === "cat") { S.cat = id; drawProducts(); }
      else if (a === "add") { const p = prod(id); if (p.variations && p.variations.length) chooser(p); else addLine(p, {}); }
      else if (a === "opt") { S.choose.opts[el.dataset.g] = el.dataset.v; $(".modal").innerHTML = S.choose.html(); }
      else if (a === "addopt") { const p = prod(S.choose.pid), o = S.choose.opts; closeModal(); addLine(p, o); }
      else if (a === "inc") { const i = S.cart[+el.dataset.k], p = prod(i.pid); if (p.type === "physical" && inCart(p.id) + 1 > avail(p)) return toast("Not enough stock 库存不足", true); i.qty++; drawCart(); drawProducts(); }
      else if (a === "dec") { const i = S.cart[+el.dataset.k]; i.qty--; if (i.qty < 1) S.cart.splice(+el.dataset.k, 1); drawCart(); drawProducts(); }
      else if (a === "rm") { S.cart.splice(+el.dataset.k, 1); drawCart(); drawProducts(); }
      else if (a === "selmem") { S.member = S.members.find((m) => m.id === id); drawCart(); }
      else if (a === "memclear") { S.member = null; drawCart(); }
      else if (a === "newmem") newMember();
      else if (a === "pay") { el.disabled = true; await completeSale(el.dataset.m); }
      else if (a === "cartToggle") $("#cart").classList.toggle("open");
      else if (a === "syncnow") { S.sync.needLogin ? (S.prevScreen = S.screen, scrLogin()) : syncNow(); }
      else if (a === "syncnow2") { closeModal(); S.sync.needLogin ? (S.prevScreen = S.screen, scrLogin()) : syncNow(); }
      else if (a === "menu") menu();
      else if (a === "closemodal") closeModal();
      else if (a === "print") window.print();
      else if (a === "hist") show("hist");
      else if (a === "back") show("sales");
      else if (a === "rc") showReceipt(id);
      else if (a === "lock") { closeModal(); lock(); }
      else if (a === "exportjson") { await exportJson(); }
      else if (a === "exportcsv") { await exportCsv(); }
      else if (a === "switch") { if (unsynced() > 0) return toast("Sync your pending sales first 请先同步待上传的销售", true); closeModal(); show("setup"); }
      else if (a === "signout") { const n = unsynced(); if (n && !confirm(n + " sale(s)/member(s) are not uploaded yet. They stay safe on this iPad. Sign out anyway? 还有 " + n + " 项未上传，会保留在 iPad 上。仍要退出？")) return; if (!confirm("Sign out? 退出登录？")) return; API.logout(); S.pinStage = ""; show("login"); }
    } catch (er) { toast(er.message, true); }
  });
  document.addEventListener("touchstart", resetIdle, { passive: true }); document.addEventListener("keydown", resetIdle);
  window.addEventListener("online", () => { S.sync.st = "idle"; drawHeader(); syncSoon(); }); window.addEventListener("offline", () => { S.sync.st = "offline"; drawHeader(); });
  document.addEventListener("visibilitychange", () => { if (!document.hidden) { drawHeader(); syncSoon(); } });
  setInterval(() => { if (S.meta.deviceId && S.screen !== "boot" && S.screen !== "login" && navigator.onLine && unsynced() > 0 && !S.syncing && !S.sync.needLogin) syncNow(); }, 20000);

  async function init() {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
    await IDB.open();
    for (const r of await IDB.all("meta")) S.meta[r.k] = r.v;
    S.sales = await IDB.all("sales"); S.members = await IDB.all("members"); S.products = await IDB.all("products"); loadImages(S.products);
    if (!API.session) return show("login");
    if (!S.meta.deviceId || !S.meta.event) return show("setup");
    S.pinStage = (await meta("pin")) ? "unlock" : "set1"; show("pin"); resetIdle(); syncSoon();
  }
  window.__POS = { S, IDB, API, show, syncNow };
  document.addEventListener("DOMContentLoaded", init);
})();
