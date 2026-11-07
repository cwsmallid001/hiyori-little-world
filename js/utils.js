/* Small helper functions used everywhere. */
(function () {
  const U = (window.U = {});
  U.$ = (s, r = document) => r.querySelector(s);
  U.$$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  U.esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  U.r2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
  U.money = (n) => "RM " + U.r2(n).toFixed(2);
  // localStorage helpers (never crash if storage is blocked)
  U.get = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } };
  U.set = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } };
  U.del = (k) => { try { localStorage.removeItem(k); } catch (e) {} };
  U.param = (k) => new URLSearchParams(location.search).get(k);
  // Dates as YYYY-MM-DD in local time. date(0)=today, date(5)=in 5 days.
  U.date = (off = 0) => {
    const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + off);
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  };
  U.fmtDate = (iso) => new Date(iso + "T12:00:00").toLocaleDateString("en-MY", { day: "numeric", month: "short", year: "numeric" });
  U.fmtDateTime = (iso) => new Date(iso).toLocaleString("en-MY", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  U.pad = (n, w = 4) => String(n).padStart(w, "0");
  U.toast = (msg) => {
    let t = U.$("#toast");
    if (!t) { t = document.createElement("div"); t.id = "toast"; t.className = "toast"; t.setAttribute("role", "status"); document.body.appendChild(t); }
    t.textContent = msg; t.classList.add("show");
    clearTimeout(U._tt); U._tt = setTimeout(() => t.classList.remove("show"), 2600);
  };
  // Pastel placeholder picture (SVG). Used until real photos are added.
  const PAIRS = [["#F8C8DC", "#FFF8F0"], ["#DCCFF5", "#F8C8DC"], ["#FFF8F0", "#DCCFF5"], ["#E9AFC5", "#FFF8F0"], ["#F8C8DC", "#DCCFF5"]];
  const SIZES = { "4/5": [400, 500], "1/1": [400, 400], "3/4": [390, 520], "16/10": [480, 300], "16/11": [480, 330] };
  U.ph = (label = "", i = 0, ratio = "4/5") => {
    const [w, h] = SIZES[ratio] || SIZES["4/5"]; const [a, b] = PAIRS[Math.abs(i) % PAIRS.length];
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}' viewBox='0 0 ${w} ${h}'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='${a}'/><stop offset='1' stop-color='${b}'/></linearGradient></defs><rect width='${w}' height='${h}' fill='url(#g)'/><text x='50%' y='47%' font-size='${Math.round(w / 4.2)}' text-anchor='middle' fill='white' fill-opacity='.85' font-family='Georgia,serif'>♡</text><text x='50%' y='62%' font-size='${Math.round(w / 24)}' text-anchor='middle' fill='#51434A' fill-opacity='.7' font-family='Georgia,serif' letter-spacing='2'>${U.esc(String(label).slice(0, 28))}</text></svg>`;
    return "data:image/svg+xml;utf8," + encodeURIComponent(svg);
  };
  U.hash = (s) => String(s).split("").reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
  U.BOW = `<svg class="bow" viewBox="0 0 90 56" aria-hidden="true"><path d="M45 28C28 2 3 4 6 26c3 24 28 26 39 2Z" fill="#F8C8DC" stroke="#E9AFC5" stroke-width="2.5" stroke-linejoin="round"/><path d="M45 28c17-26 42-24 39-2-3 24-28 26-39 2Z" fill="#F8C8DC" stroke="#E9AFC5" stroke-width="2.5" stroke-linejoin="round"/><path d="M43 33 30 54M47 33l13 21" stroke="#E9AFC5" stroke-width="5" stroke-linecap="round"/><circle cx="45" cy="28" r="8" fill="#E9AFC5"/></svg>`;
})();
