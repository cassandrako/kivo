/* ==========================================================================
   Kivo — images on cards
   Pasted, dropped or chosen images are resized and kept in this browser's
   IndexedDB (far more room than localStorage), one set per account. Cards
   store only an image id; rendering reads a cached object URL, so drawing a
   card stays synchronous.
   ========================================================================== */
window.KivoMedia = (() => {
  "use strict";
  const MAX_SIDE = 2000;
  let dbp = null, acct = "", persistent = true;
  const urls = new Map(), dims = new Map();

  function open() {
    if (dbp) return dbp;
    dbp = new Promise((resolve, reject) => {
      try {
        const r = indexedDB.open("kivo-media", 1);
        r.onupgradeneeded = () => { const s = r.result.createObjectStore("images", { keyPath: "id" }); s.createIndex("acct", "acct"); };
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => reject(r.error);
      } catch (e) { reject(e); }
    });
    return dbp;
  }
  const req = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });

  /** Load this account's images into memory. Resolves even if storage is unavailable. */
  async function init(accountId) {
    acct = accountId || "";
    for (const u of urls.values()) URL.revokeObjectURL(u);
    urls.clear(); dims.clear();
    try {
      const db = await open();
      const all = await req(db.transaction("images").objectStore("images").index("acct").getAll(acct));
      for (const rec of all) { urls.set(rec.id, URL.createObjectURL(rec.blob)); dims.set(rec.id, { w: rec.w, h: rec.h }); }
      persistent = true;
    } catch { persistent = false; }
  }

  /** Decode, downscale and re-encode an image file or blob. */
  async function prepare(file) {
    const bmp = await (window.createImageBitmap ? createImageBitmap(file) : new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = URL.createObjectURL(file); }));
    const w0 = bmp.width, h0 = bmp.height, k = Math.min(1, MAX_SIDE / Math.max(w0, h0));
    const w = Math.round(w0 * k), h = Math.round(h0 * k);
    const cv = document.createElement("canvas"); cv.width = w; cv.height = h;
    const cx = cv.getContext("2d"); cx.fillStyle = "#fff"; cx.fillRect(0, 0, w, h); cx.drawImage(bmp, 0, 0, w, h);
    const png = /png|gif|svg/.test(file.type || "") && w * h <= 3_000_000;
    const blob = await new Promise((res) => cv.toBlob(res, png ? "image/png" : "image/jpeg", 0.9));
    return { blob, w, h };
  }

  /** Store an image; returns its id. Works in memory if the browser blocks storage. */
  async function add(file) {
    const { blob, w, h } = await prepare(file);
    const id = "img-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    urls.set(id, URL.createObjectURL(blob)); dims.set(id, { w, h });
    try { const db = await open(); await req(db.transaction("images", "readwrite").objectStore("images").put({ id, acct, blob, w, h, created: Date.now() })); }
    catch { persistent = false; }
    return id;
  }

  /** Remove images no saved card uses (drafts that were never saved). */
  async function gc(usedIds) {
    const used = new Set(usedIds);
    const stale = [...urls.keys()].filter((id) => !used.has(id));
    for (const id of stale) { URL.revokeObjectURL(urls.get(id)); urls.delete(id); dims.delete(id); }
    if (!stale.length) return;
    try { const db = await open(); const s = db.transaction("images", "readwrite").objectStore("images"); for (const id of stale) s.delete(id); } catch { /* storage unavailable */ }
  }

  /** First image in a paste or drop, if any. */
  function fromTransfer(dt) {
    if (!dt) return null;
    for (const it of dt.items || []) if (it.kind === "file" && it.type.startsWith("image/")) return it.getAsFile();
    for (const f of dt.files || []) if (f.type.startsWith("image/")) return f;
    return null;
  }

  return { init, add, gc, fromTransfer, url: (id) => urls.get(id) || "", size: (id) => dims.get(id) || null, has: (id) => urls.has(id), get persistent() { return persistent; } };
})();
