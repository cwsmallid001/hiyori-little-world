/* Tiny Supabase client for the POS. The sign-in is kept on the iPad so the app can start without internet. */
(function () {
  "use strict";
  const C = window.HLW_POS, KEY = "hlw_pos_session", API = (window.API = { session: null });
  try { API.session = JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) {}
  const save = (j) => { API.session = { access_token: j.access_token, refresh_token: j.refresh_token, expires_at: Date.now() + ((j.expires_in || 3600) * 1000) - 30000, user: j.user }; try { localStorage.setItem(KEY, JSON.stringify(API.session)); } catch (e) {} };
  const msg = (j, s) => (j && (j.message || j.error_description || j.msg || j.error)) || "Request failed (" + s + ")";
  const net = (e) => { e.network = true; return e; };
  const f = async (url, opt) => { const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 25000); try { return await fetch(url, Object.assign({}, opt, { signal: ctl.signal })); } catch (e) { throw net(new Error("No internet / 没有网络")); } finally { clearTimeout(t); } };
  API.login = async (email, password) => { const r = await f(C.url + "/auth/v1/token?grant_type=password", { method: "POST", headers: { apikey: C.key, "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) }); const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(/invalid/i.test(msg(j, r.status)) ? "Wrong email or password / 邮箱或密码不正确" : msg(j, r.status)); save(j); };
  API.refresh = async () => { if (!API.session) throw new Error("Please sign in / 请登录"); const r = await f(C.url + "/auth/v1/token?grant_type=refresh_token", { method: "POST", headers: { apikey: C.key, "Content-Type": "application/json" }, body: JSON.stringify({ refresh_token: API.session.refresh_token }) }); const j = await r.json().catch(() => ({})); if (!r.ok) { const e = new Error("Please sign in again / 请重新登录"); e.auth = true; throw e; } save(j); };
  API.logout = () => { API.session = null; try { localStorage.removeItem(KEY); } catch (e) {} };
  API.rpc = async (fn, args) => {
    if (API.session && Date.now() > API.session.expires_at) await API.refresh();
    const r = await f(C.url + "/rest/v1/rpc/" + fn, { method: "POST", headers: { apikey: C.key, "Content-Type": "application/json", Authorization: "Bearer " + (API.session ? API.session.access_token : "") }, body: JSON.stringify(args || {}) });
    const t = await r.text(); let j = null; try { j = t ? JSON.parse(t) : null; } catch (e) {}
    if (!r.ok) { const e = new Error(msg(j, r.status)); if (r.status === 401) e.auth = true; throw e; }
    return j;
  };
})();
