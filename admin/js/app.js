/* Hiyori's Little World: Admin Dashboard (bilingual English / 中文).
   Buttons only hide things for convenience. The DATABASE enforces every permission. */
(function () {
  "use strict";
  if (window.top !== window.self) { document.documentElement.innerHTML = ""; throw new Error("framed"); }
  const $ = (s, r) => (r || document).querySelector(s), $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const b = (en, zh) => esc(en) + ' <span class="zh">' + esc(zh) + "</span>";
  const RM = (n) => "RM " + (Math.round((+n + Number.EPSILON) * 100) / 100).toFixed(2);
  const fdate = (iso) => (iso ? new Date(iso).toLocaleString("en-MY", { timeZone: "Asia/Kuala_Lumpur", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "");
  const ST = { pending_payment: ["Pending Payment", "待付款"], paid: ["Paid", "已付款"], processing: ["Processing", "处理中"], shipped: ["Shipped", "已发货"], completed: ["Completed", "已完成"], cancelled: ["Cancelled", "已取消"], refunded: ["Refunded", "已退款"] };
  const NEXT = { pending_payment: ["paid", "cancelled"], paid: ["processing", "completed", "refunded", "cancelled"], processing: ["shipped", "refunded", "cancelled"], shipped: ["completed", "refunded"], completed: ["refunded"], cancelled: [], refunded: [] };
  const badge = (s) => '<span class="badge b-' + esc(s) + '">' + b(...(ST[s] || [s, ""])) + "</span>";
  const state = { me: null, perms: new Set() };
  const can = (p) => state.perms.has(p);
  const NAV = [["overview", "Overview", "总览", () => can("dashboard.view")], ["orders", "Orders", "订单", () => can("orders.read")], ["products", "Products", "商品", () => can("products.read_all")],
    ["members", "Members", "会员", () => can("members.read")], ["settings", "Store settings", "店铺设置", () => can("settings.write") || can("content.write") || can("policies.write") || can("payment.write")],
    ["activity", "Activity log", "活动记录", () => can("audit.read")], ["admins", "Admins", "管理员", () => can("admins.manage")], ["account", "My account", "我的账号", () => true]];

  // ---------- small UI helpers
  let tt; function toast(m, bad) { const t = $("#toast"); t.innerHTML = esc(m); t.className = "toast show" + (bad ? " bad" : ""); clearTimeout(tt); tt = setTimeout(() => (t.className = "toast"), bad ? 6000 : 2800); }
  function modal(title, html) {
    const bg = document.createElement("div"); bg.className = "modal-bg";
    bg.innerHTML = '<div class="modal" role="dialog" aria-modal="true"><header><h2>' + title + '</h2><button class="btn small" data-close>Close <span class="zh">关闭</span></button></header><div class="mbody">' + html + "</div></div>";
    $("#modal-root").appendChild(bg); bg.addEventListener("click", (e) => { if (e.target.closest("[data-close]")) bg.remove(); });
    document.addEventListener("keydown", function k(e) { if (e.key === "Escape") { bg.remove(); document.removeEventListener("keydown", k); } });
    return bg;
  }
  const fld = (label, name, val, type, extra) => "<label>" + label + '<input name="' + name + '" type="' + (type || "text") + '" value="' + esc(val) + '" ' + (extra || "") + "></label>";
  const area = (label, name, val, rows) => "<label>" + label + '<textarea name="' + name + '" rows="' + (rows || 4) + '">' + esc(val) + "</textarea></label>";
  const chk = (label, name, on) => '<label class="chk"><input type="checkbox" name="' + name + '" ' + (on ? "checked" : "") + "> " + label + "</label>";
  const val = (root, n) => { const e = $('[name="' + n + '"]', root); return e ? (e.type === "checkbox" ? e.checked : e.value.trim()) : null; };
  const busy = async (btn, fn) => { btn.disabled = true; try { await fn(); } catch (e) { toast(e.message, true); } finally { btn.disabled = false; } };
  const lines = (t) => String(t || "").split("\n").map((x) => x.trim()).filter(Boolean);
  const diff = (o, n) => {
    if (!o) return "Created 新增"; if (!n) return "Deleted 删除"; const ch = [];
    Object.keys(n).forEach((k) => { if (k !== "updated_at" && JSON.stringify(o[k]) !== JSON.stringify(n[k])) { const s = (v) => { const x = typeof v === "object" ? JSON.stringify(v) : String(v); return x.length > 40 ? x.slice(0, 40) + "…" : x; }; ch.push(k + ": " + s(o[k]) + " → " + s(n[k])); } });
    return ch.join("; ") || "-";
  };

  // ---------- sign in / out
  let idle; const resetIdle = () => { clearTimeout(idle); idle = setTimeout(() => { API.logout(); location.reload(); }, 30 * 60 * 1000); };
  ["click", "keydown", "touchstart"].forEach((ev) => document.addEventListener(ev, () => state.me && resetIdle(), { passive: true }));
  function showLogin(err) { $("#shell").hidden = true; $("#login").hidden = false; $("#login-err").textContent = err || ""; }
  async function loadMe() {
    const uid = API.session.user.id;
    const rows = await API.get("admin_users", "select=*&user_id=eq." + encodeURIComponent(uid));
    if (!rows.length || !rows[0].active) { API.logout(); showLogin("This account is not an admin account / 此账号不是管理员账号"); return false; }
    state.me = rows[0];
    const p = await API.get("role_permissions", "select=permission&role=eq." + encodeURIComponent(state.me.role));
    state.perms = new Set(p.map((x) => x.permission));
    return true;
  }
  async function boot() {
    $("#login").hidden = true; $("#login-form").onsubmit = async (e) => {
      e.preventDefault(); const f = e.target; const btn = $("#login-btn"); btn.disabled = true; $("#login-err").textContent = "";
      try { await API.login(f.email.value.trim(), f.password.value); f.password.value = ""; if (await loadMe()) start(); } catch (er) { showLogin(er.message); } finally { btn.disabled = false; }
    };
    if (API.session) { try { if (await loadMe()) return start(); } catch (e) { API.logout(); } }
    showLogin();
  }
  function start() {
    $("#login").hidden = true; $("#shell").hidden = false; resetIdle();
    $("#who").innerHTML = esc((state.me.display_name || state.me.email) + " · " + state.me.role);
    $("#nav").innerHTML = NAV.filter((n) => n[3]()).map((n) => '<a href="#/' + n[0] + '" data-r="' + n[0] + '">' + b(n[1], n[2]) + "</a>").join("");
    $("#logout").onclick = () => { API.logout(); location.hash = ""; location.reload(); };
    $("#menu").onclick = () => $("#side").classList.toggle("open");
    $("#nav").addEventListener("click", () => $("#side").classList.remove("open"));
    window.addEventListener("hashchange", route); route();
  }
  async function route() {
    const parts = (location.hash.replace(/^#\/?/, "") || "").split("/"); const allowed = NAV.filter((n) => n[3]()).map((n) => n[0]);
    let r = allowed.includes(parts[0]) ? parts[0] : allowed[0]; const nav = NAV.find((n) => n[0] === r);
    $$("#nav a").forEach((a) => a.classList.toggle("on", a.dataset.r === r)); $("#title").innerHTML = b(nav[1], nav[2]);
    const el = $("#view"); el.innerHTML = '<p class="help">Loading… 加载中…</p>';
    try { await VIEWS[r](el, parts[1]); } catch (e) { el.innerHTML = '<div class="panel"><h2>Something went wrong 出错了</h2><p class="err">' + esc(e.message) + "</p></div>"; }
  }

  // ---------- OVERVIEW
  async function vOverview(el) {
    const d = await API.rpc("admin_dashboard"), alerts = await API.get("admin_alerts", "select=*&status=eq.open&order=created_at.desc&limit=10").catch(() => []);
    const s = d.status || {}, c = (k) => s[k] || 0;
    const days = []; const map = {}; (d.sales_30d || []).forEach((x) => (map[x.day] = +x.revenue));
    for (let i = 29; i >= 0; i--) { const t = new Date(Date.now() - i * 864e5).toLocaleDateString("en-CA", { timeZone: "Asia/Kuala_Lumpur" }); days.push([t, map[t] || 0]); }
    const mx = Math.max(1, ...days.map((x) => x[1]));
    el.innerHTML = '<div class="cards">' + [["Total products", "商品总数", d.products], ["Total orders", "订单总数", d.orders], ["Pending payment", "待付款", c("pending_payment")],
      ["Paid / processing / shipped", "已付款 / 处理中 / 已发货", c("paid") + c("processing") + c("shipped")], ["Completed", "已完成", c("completed")], ["Total sales", "总销售额", RM(d.sales_total)], ["Members", "会员", d.members], ["Points held by members", "会员积分合计", Number(d.points_total).toLocaleString()]]
      .map((x) => "<div class='card'><b>" + esc(x[2]) + "</b><span>" + b(x[0], x[1]) + "</span></div>").join("") + "</div>" +
      (d.pending_approvals ? '<div class="panel"><b>' + b("Points adjustments waiting for the Owner", "等待 Owner 批准的补分") + ": " + d.pending_approvals + ' <a href="#/members/approvals">' + b("Review", "查看") + "</a></b></div>" : "") +
      (alerts.length ? '<div class="panel"><h2>' + b("Alerts", "提醒") + "</h2>" + alerts.map((a) => "<p>" + esc(a.message) + ' <button class="btn small" data-ack="' + a.id + '">' + b("Done", "已处理") + "</button></p>").join("") + "</div>" : "") +
      '<div class="panel"><h2>' + b("Sales, last 30 days", "最近 30 天销售额") + '</h2><div class="bars" aria-label="Sales chart">' + days.map((x) => '<i title="' + x[0] + " " + RM(x[1]) + '" style="height:' + Math.round((x[1] / mx) * 100) + '%"></i>').join("") + "</div></div>" +
      '<div class="grid2"><div class="panel"><h2>' + b("Recent orders", "最近订单") + "</h2>" + ((d.recent_orders || []).length ? '<div class="tablewrap"><table>' + d.recent_orders.map((o) => '<tr class="click" data-order="' + esc(o.id) + '"><td>' + esc(o.id) + "</td><td>" + esc(o.customer_name) + "</td><td>" + RM(o.total) + "</td><td>" + badge(o.status) + "</td></tr>").join("") + "</table></div>" : '<p class="help">No orders yet 还没有订单</p>') + "</div>" +
      '<div class="panel"><h2>' + b("Low stock", "库存偏低") + "</h2>" + ((d.low_stock || []).length ? '<div class="tablewrap"><table>' + d.low_stock.map((p) => "<tr><td>" + esc(p.id) + "</td><td>" + esc(p.name) + '</td><td><span class="badge b-low">' + p.stock + " left</span></td></tr>").join("") + "</table></div>" : '<p class="help">All stock levels are fine 库存正常</p>') +
      '<h3 style="margin-top:1rem">' + b("Best sellers", "畅销商品") + "</h3>" + ((d.best_sellers || []).length ? '<div class="tablewrap"><table>' + d.best_sellers.map((p) => "<tr><td>" + esc(p.name) + "</td><td>" + p.units + " pcs</td><td>" + RM(p.revenue) + "</td></tr>").join("") + "</table></div>" : '<p class="help">No sales yet 暂无销售</p>') + "</div></div>";
    el.onclick = async (e) => {
      const o = e.target.closest("[data-order]"); if (o) return openOrder(o.dataset.order);
      const a = e.target.closest("[data-ack]"); if (a) busy(a, async () => { await API.patch("admin_alerts", "id=eq." + a.dataset.ack, { status: "resolved", resolved_at: new Date().toISOString() }); route(); });
    };
  }

  // ---------- ORDERS
  async function vOrders(el) {
    const q = await API.rpc("queue_stats").catch(() => null);
    el.innerHTML = (q ? '<div class="panel"><h2>' + b("Queue", "排队") + "</h2><p>" + b("Mode", "模式") + ": <b>" + (q.mode === "event" ? b("Event day", "活动日") : b("Pre-order period", "预购期")) + "</b> · " + b("Now serving", "现在叫号") + ": <b>#" + q.now_serving + "</b> · " + b("Pre-order tickets", "预购号") + ": " + q.preorder_total + " · " + b("Event tickets", "活动号") + ": " + q.event_total +
      '</p><div class="actions"><button class="btn small primary" data-q="next">' + b("Serve next", "叫下一位") + '</button><button class="btn small" data-q="preorder">' + b("Set: Pre-order period", "设为预购期") + '</button><button class="btn small" data-q="event">' + b("Set: Event day", "设为活动日") + "</button></div></div>" : "") +
      '<div class="tools"><input id="o-q" type="search" placeholder="Search order, name, email, phone 搜索订单、姓名、邮箱、电话"><select id="o-s"><option value="">All statuses 所有状态</option>' + Object.keys(ST).map((k) => '<option value="' + k + '">' + esc(ST[k][0] + " " + ST[k][1]) + "</option>").join("") + '</select></div><div id="o-list"></div>';
    let off = 0;
    async function load(more) {
      if (!more) off = 0; const s = $("#o-s").value, t = $("#o-q").value.replace(/[,()*%]/g, " ").trim();
      let qs = "select=id,created_at,customer_name,customer_phone,total,status,payment_method,queue_type,queue_seq&order=created_at.desc&limit=50&offset=" + off;
      if (s) qs += "&status=eq." + s; if (t) qs += "&or=(id.ilike.*" + encodeURIComponent(t) + "*,customer_name.ilike.*" + encodeURIComponent(t) + "*,customer_email.ilike.*" + encodeURIComponent(t) + "*,customer_phone.ilike.*" + encodeURIComponent(t) + "*)";
      const rows = await API.get("orders", qs); const html = rows.map((o) => '<tr class="click" data-order="' + esc(o.id) + '"><td>' + esc(o.id) + "</td><td>" + fdate(o.created_at) + "</td><td>" + esc(o.customer_name) + "</td><td>" + RM(o.total) + "</td><td>" + badge(o.status) + "</td><td>" + esc(o.payment_method || "") + "</td><td>" + (o.queue_type ? (o.queue_type === "preorder" ? "P" : "E") + "#" + o.queue_seq : "") + "</td></tr>").join("");
      const box = $("#o-list");
      if (!more) box.innerHTML = '<div class="tablewrap"><table><thead><tr><th>Order 订单</th><th>Date 日期</th><th>Customer 客户</th><th>Total 总额</th><th>Status 状态</th><th>Payment 付款</th><th>Queue 排队</th></tr></thead><tbody id="o-body"></tbody></table></div><p id="o-empty" class="help"></p><button class="btn small" id="o-more" hidden>Load more 加载更多</button>';
      $("#o-body").insertAdjacentHTML("beforeend", html); $("#o-empty").textContent = (!more && !rows.length) ? "No orders found 没有找到订单" : ""; $("#o-more").hidden = rows.length < 50; off += rows.length;
    }
    el.onclick = (e) => {
      const o = e.target.closest("[data-order]"); if (o) return openOrder(o.dataset.order, load);
      if (e.target.id === "o-more") return load(true);
      const qb = e.target.closest("[data-q]"); if (qb) busy(qb, async () => { if (qb.dataset.q === "next") await API.rpc("queue_serve_next"); else await API.rpc("queue_set_mode", { p_mode: qb.dataset.q }); route(); });
    };
    $("#o-s").onchange = () => load(); let dt; $("#o-q").oninput = () => { clearTimeout(dt); dt = setTimeout(() => load(), 350); };
    await load();
  }
  async function openOrder(id, after) {
    const o = (await API.get("orders", "id=eq." + encodeURIComponent(id) + "&select=*,order_items(*),order_status_history(*)"))[0];
    if (!o) return toast("Order not found 找不到订单", true);
    let mem = null; if (o.member_id) mem = (await API.get("members", "id=eq." + o.member_id + "&select=member_no,full_name"))[0];
    const a = o.shipping_address; const m = modal(b("Order", "订单") + " " + esc(o.id), "");
    const paint = (o) => {
      const items = (o.order_items || []).map((i) => "<tr><td>" + esc(i.product_name) + '<br><span class="help">' + esc(Object.values(i.options || {}).join(", ")) + "</span></td><td>" + i.qty + "</td><td>" + RM(i.unit_price) + "</td><td>" + RM(i.line_total) + "</td></tr>").join("");
      const hist = (o.order_status_history || []).sort((x, y) => (x.changed_at < y.changed_at ? 1 : -1)).map((h) => "<tr><td>" + fdate(h.changed_at) + "</td><td>" + esc((h.from_status || "-") + " → " + h.to_status) + "</td><td>" + esc(h.changed_by_label || "") + "</td><td class='wrap'>" + esc(h.note || "") + "</td></tr>").join("");
      const acts = NEXT[o.status].filter((s) => s !== "refunded" || can("orders.refund")).map((s) => '<button class="btn small ' + (s === "cancelled" || s === "refunded" ? "danger" : "primary") + '" data-set="' + s + '">' + b("Mark as " + ST[s][0], "标记为" + ST[s][1]) + "</button>").join("");
      $(".mbody", m).innerHTML = "<p>" + badge(o.status) + " · " + fdate(o.created_at) + (o.queue_type ? " · " + b("Queue", "排队") + " " + (o.queue_type === "preorder" ? "P" : "E") + "#" + o.queue_seq : "") + '</p><div class="grid2"><dl class="kv"><dt>' + b("Customer", "客户") + "</dt><dd>" + esc(o.customer_name) + "</dd><dt>Email</dt><dd>" + esc(o.customer_email) + "</dd><dt>" + b("Phone", "电话") + "</dt><dd>" + esc(o.customer_phone) + "</dd><dt>" + b("Address", "地址") + "</dt><dd>" + (a ? esc([a.address, a.city, a.postal, a.state, a.country].filter(Boolean).join(", ")) : "Digital only 仅数码商品") + "</dd><dt>" + b("Member", "会员") + "</dt><dd>" + (mem ? esc(mem.member_no + " " + mem.full_name) : "Not linked 未关联") + '</dd></dl><dl class="kv"><dt>' + b("Payment method", "付款方式") + "</dt><dd>" + esc(o.payment_method || "") + "</dd><dt>" + b("Shipping", "运送") + "</dt><dd>" + esc(o.shipping_method || "-") + " " + RM(o.shipping_fee) + "</dd><dt>" + b("Subtotal", "小计") + "</dt><dd>" + RM(o.subtotal) + "</dd><dt>" + b("Total", "总额") + "</dt><dd><b>" + RM(o.total) + "</b></dd><dt>" + b("Points earned", "获得积分") + "</dt><dd>" + o.points_earned + "</dd><dt>" + b("Tracking", "物流单号") + "</dt><dd>" + esc(o.tracking_number || "-") + "</dd></dl></div>" +
        '<div class="tablewrap"><table><thead><tr><th>Item 商品</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead><tbody>' + items + '</tbody></table></div><div class="actions">' + (acts || '<span class="help">No further status changes 没有后续状态</span>') + "</div>" +
        '<div class="grid2"><div><label>' + b("Tracking number", "物流单号") + '<input id="trk" value="' + esc(o.tracking_number || "") + '"></label><button class="btn small" data-trk>' + b("Save tracking", "保存单号") + '</button></div><div><label>' + b("Link to a member (name, phone, email or ID)", "关联会员（姓名、电话、邮箱或编号）") + '<input id="lm"></label><button class="btn small" data-lm>' + b("Search", "搜索") + '</button><div id="lm-res"></div></div></div><h3 style="margin-top:1rem">' + b("History", "记录") + '</h3><div class="tablewrap"><table><tbody>' + hist + "</tbody></table></div>";
    };
    paint(o);
    const reload = async () => { const n = (await API.get("orders", "id=eq." + encodeURIComponent(id) + "&select=*,order_items(*),order_status_history(*)"))[0]; Object.assign(o, n); paint(o); if (after) after(); };
    m.addEventListener("click", (e) => {
      const st = e.target.closest("[data-set]"), tr = e.target.closest("[data-trk]"), lm = e.target.closest("[data-lm]"), pick = e.target.closest("[data-pick]");
      if (st) busy(st, async () => { const s = st.dataset.set; if ((s === "cancelled" || s === "refunded") && !confirm("This returns stock and takes points back. Continue? 这会退回库存并扣回积分，确定吗？")) return; const note = prompt("Note (optional) 备注（可选）", ""); if (note === null) return; const r = await API.rpc("set_order_status", { p_order: id, p_status: s, p_note: note || null }); toast("Done 已完成" + (r.points_earned && s === "paid" ? " · +" + r.points_earned + " pts" : "")); await reload(); });
      if (tr) busy(tr, async () => { await API.rpc("set_tracking_number", { p_order: id, p_tracking: $("#trk", m).value }); toast("Saved 已保存"); await reload(); });
      if (lm) busy(lm, async () => { const r = await API.rpc("find_member", { q: $("#lm", m).value }); $("#lm-res", m).innerHTML = r.length ? r.map((x) => '<p><button class="btn small" data-pick="' + x.id + '">' + esc(x.member_no + " " + x.full_name + " (" + x.points_balance + " pts)") + "</button></p>").join("") : '<p class="help">No member found 找不到会员</p>'; });
      if (pick) busy(pick, async () => { if (!confirm("Link this order to this member? 把订单关联到这位会员？")) return; await API.rpc("set_order_member", { p_order: id, p_member: pick.dataset.pick }); toast("Linked 已关联"); const mm = (await API.get("members", "id=eq." + pick.dataset.pick + "&select=member_no,full_name"))[0]; mem = mm; await reload(); });
    });
  }
  const VIEWS = { overview: vOverview, orders: vOrders };
  window.__HLW = { state, VIEWS, esc, b, RM, fdate, badge, toast, modal, fld, area, chk, val, busy, lines, diff, can, route, openOrder, ST, $, $$ };
  document.addEventListener("DOMContentLoaded", () => { if (!window.HLW_NO_BOOT) boot(); });
})();
