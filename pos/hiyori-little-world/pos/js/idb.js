/* Local database on the iPad (IndexedDB). Sales are saved here FIRST and are never deleted automatically. */
(function () {
  "use strict";
  const req = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  const IDB = (window.IDB = { db: null });
  IDB.open = () => new Promise((res, rej) => {
    const r = indexedDB.open("hlw-pos", 1);
    r.onupgradeneeded = () => { const d = r.result; d.createObjectStore("meta", { keyPath: "k" }); d.createObjectStore("products", { keyPath: "id" }); d.createObjectStore("members", { keyPath: "id" }); d.createObjectStore("sales", { keyPath: "id" }).createIndex("status", "status"); d.createObjectStore("images", { keyPath: "id" }); };
    r.onsuccess = () => { IDB.db = r.result; res(); }; r.onerror = () => rej(r.error);
  });
  IDB.get = (s, k) => req(IDB.db.transaction(s).objectStore(s).get(k));
  IDB.put = (s, v) => req(IDB.db.transaction(s, "readwrite").objectStore(s).put(v));
  IDB.all = (s) => req(IDB.db.transaction(s).objectStore(s).getAll());
  IDB.clear = (s) => req(IDB.db.transaction(s, "readwrite").objectStore(s).clear());
  IDB.putMany = (s, arr) => new Promise((res, rej) => { const t = IDB.db.transaction(s, "readwrite"), st = t.objectStore(s); arr.forEach((v) => st.put(v)); t.oncomplete = res; t.onerror = () => rej(t.error); });
})();
