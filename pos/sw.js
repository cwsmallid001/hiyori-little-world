/* Service worker: keeps the POS app files on the iPad so it opens with NO internet.
   Change CACHE when you upload a new version so the iPad refreshes its copy. */
const CACHE = "hlw-pos-v1";
const FILES = ["./", "index.html", "pos.css", "manifest.webmanifest", "js/config.js", "js/api.js", "js/idb.js", "js/app.js", "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png"];
self.addEventListener("install", (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener("activate", (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", (e) => {
  const r = e.request; if (r.method !== "GET" || new URL(r.url).origin !== location.origin) return;
  e.respondWith(caches.match(r, { ignoreSearch: true }).then((hit) => {
    const net = fetch(r).then((res) => { if (res && res.ok) caches.open(CACHE).then((c) => c.put(r, res.clone())); return res; }).catch(() => hit || caches.match("index.html"));
    return hit || net;
  }));
});
