/* Tiny Supabase client (no third-party scripts). Talks to the Auth, REST (database) and Storage APIs. */
(function () {
  "use strict";
  const C = window.HLW_ADMIN, KEY = "hlw_admin_session";
  const API = (window.API = { session: null });
  try { API.session = JSON.parse(sessionStorage.getItem(KEY) || "null"); } catch (e) {}
  const save = (j) => {
    API.session = { access_token: j.access_token, refresh_token: j.refresh_token, expires_at: Date.now() + ((j.expires_in || 3600) * 1000) - 30000, user: j.user };
    try { sessionStorage.setItem(KEY, JSON.stringify(API.session)); } catch (e) {}
  };
  const msg = (j, status) => (j && (j.message || j.error_description || j.msg || j.error)) || "Request failed (" + status + ")";
  API.login = async (email, password) => {
    const r = await fetch(C.url + "/auth/v1/token?grant_type=password", { method: "POST", headers: { apikey: C.key, "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(/invalid/i.test(msg(j, r.status)) ? "Wrong email or password / 邮箱或密码不正确" : msg(j, r.status));
    save(j);
  };
  API.refresh = async () => {
    if (!API.session) throw new Error("Please sign in again / 请重新登录");
    const r = await fetch(C.url + "/auth/v1/token?grant_type=refresh_token", { method: "POST", headers: { apikey: C.key, "Content-Type": "application/json" }, body: JSON.stringify({ refresh_token: API.session.refresh_token }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { API.logout(); throw new Error("Session expired, please sign in again / 登录已过期，请重新登录"); }
    save(j);
  };
  API.logout = () => { API.session = null; try { sessionStorage.removeItem(KEY); } catch (e) {} };
  const headers = (extra) => Object.assign({ apikey: C.key, "Content-Type": "application/json" }, API.session ? { Authorization: "Bearer " + API.session.access_token } : {}, extra || {});
  API.req = async (path, opt) => {
    if (API.session && Date.now() > API.session.expires_at) await API.refresh();
    opt = opt || {};
    const r = await fetch(C.url + path, Object.assign({}, opt, { headers: headers(opt.headers) }));
    const t = await r.text(); let j = null; try { j = t ? JSON.parse(t) : null; } catch (e) {}
    if (!r.ok) throw new Error(msg(j, r.status));
    return j;
  };
  API.get = (table, qs) => API.req("/rest/v1/" + table + "?" + (qs || ""));
  API.rpc = (fn, args) => API.req("/rest/v1/rpc/" + fn, { method: "POST", body: JSON.stringify(args || {}) });
  API.patch = async (table, qs, body) => {
    const rows = await API.req("/rest/v1/" + table + "?" + qs, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify(body) });
    if (!rows || !rows.length) throw new Error("Not saved: no permission or item not found / 未保存：没有权限或找不到该项目");
    return rows;
  };
  API.post = (table, body, merge) => API.req("/rest/v1/" + table, { method: "POST", headers: { Prefer: (merge ? "resolution=merge-duplicates," : "") + "return=representation" }, body: JSON.stringify(body) });
  API.del = (table, qs) => API.req("/rest/v1/" + table + "?" + qs, { method: "DELETE", headers: { Prefer: "return=representation" } });
  API.changePassword = (password) => API.req("/auth/v1/user", { method: "PUT", body: JSON.stringify({ password }) });
  API.publicUrl = (bucket, path) => C.url + "/storage/v1/object/public/" + bucket + "/" + path;
  API.upload = async (bucket, path, file) => {
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error("Only JPG, PNG or WebP images / 只能上传 JPG、PNG 或 WebP 图片");
    if (file.size > 2097152) throw new Error("Image is over 2 MB, please make it smaller / 图片超过 2 MB，请缩小");
    if (API.session && Date.now() > API.session.expires_at) await API.refresh();
    const r = await fetch(C.url + "/storage/v1/object/" + bucket + "/" + path, { method: "POST", headers: { apikey: C.key, Authorization: "Bearer " + API.session.access_token, "Content-Type": file.type, "x-upsert": "false" }, body: file });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(msg(j, r.status));
    return API.publicUrl(bucket, path);
  };
})();
