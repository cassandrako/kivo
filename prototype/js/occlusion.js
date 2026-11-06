/* ==========================================================================
   Kivo — image occlusion on your own images
   Masks are stored in image-relative units (0–1):
     box   { kind: "box",   x, y, w, h, label }        covers part of the image
     arrow { kind: "arrow", x, y, lx, ly, label }      points at (x, y); answer sits at (lx, ly)
   Each mask makes one card. Mode "all" hides every box and asks for one
   (Anki's "Hide all, guess one"); mode "one" hides only the asked box.
   "Hide all text" finds printed labels on a diagram and covers them, so a
   student never has to white them out by hand first.
   ========================================================================== */
window.KivoOcc = (() => {
  "use strict";
  const M = () => window.KivoMedia;
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const VW = 1000; // viewBox width; height follows the image's aspect ratio
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  let uidN = 0;

  const vh = (f) => { const d = M().size(f.image); return d ? Math.round((VW * d.h) / d.w) : 625; };
  const labelBox = (m, H) => {
    const fs = VW * 0.034, t = m.label || "";
    const w = Math.max(fs * 2.2, Math.min(VW * 0.5, t.length * fs * 0.56 + fs * 1.2)), h = fs * 1.6;
    let cx = m.lx * VW, cy = m.ly * H;
    cx = clamp(cx, w / 2 + 2, VW - w / 2 - 2); cy = clamp(cy, h / 2 + 2, H - h / 2 - 2);
    return { x: cx - w / 2, y: cy - h / 2, w, h, cx, cy, fs };
  };
  // where the arrow line leaves the label box, so it doesn't cross the text
  function edgePoint(lb, tx, ty) {
    const dx = tx - lb.cx, dy = ty - lb.cy; if (!dx && !dy) return { x: lb.cx, y: lb.cy };
    const k = Math.min(Math.abs((lb.w / 2) / (dx || 1e-6)), Math.abs((lb.h / 2) / (dy || 1e-6)));
    return { x: lb.cx + dx * k, y: lb.cy + dy * k };
  }
  function arrowSvg(m, H, { text, cls = "", marker }) {
    const lb = labelBox(m, H), tx = m.x * VW, ty = m.y * H, e = edgePoint(lb, tx, ty);
    return `<g class="occi__arrow ${cls}"><line x1="${e.x.toFixed(1)}" y1="${e.y.toFixed(1)}" x2="${tx.toFixed(1)}" y2="${ty.toFixed(1)}" marker-end="url(#${marker})"/>
      <circle cx="${tx.toFixed(1)}" cy="${ty.toFixed(1)}" r="${(lb.fs * 0.22).toFixed(1)}" class="occi__tip"/>
      <rect x="${lb.x.toFixed(1)}" y="${lb.y.toFixed(1)}" width="${lb.w.toFixed(1)}" height="${lb.h.toFixed(1)}" rx="${(lb.h * 0.25).toFixed(1)}" class="occi__tag"/>
      <text x="${lb.cx.toFixed(1)}" y="${(lb.cy + lb.fs * 0.35).toFixed(1)}" font-size="${lb.fs.toFixed(1)}" text-anchor="middle">${esc(text)}</text></g>`;
  }
  const defs = (id) => `<defs><marker id="${id}" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" class="occi__head"/></marker></defs>`;

  /** A card face: the image with masks for card `ord`. */
  function face(f, ord, { reveal = false } = {}) {
    if (!f.image || !M().has(f.image)) return `<div class="occi occi--missing"><p class="caption">This card’s image isn’t in this browser.</p></div>`;
    const H = vh(f), target = f.masks[ord], mk = "occ-ah-" + (++uidN);
    const parts = f.masks.map((m, i) => {
      const isT = i === ord;
      if (m.kind === "arrow") return isT ? arrowSvg(m, H, { text: reveal ? m.label || "" : "?", cls: reveal ? "is-revealed" : "is-target", marker: mk }) : "";
      const x = m.x * VW, y = m.y * H, w = m.w * VW, h = m.h * H;
      if (isT && reveal) return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" class="occi__reveal"/>`;
      if (isT) { const fs = Math.max(14, Math.min(h * 0.62, 44)); return `<g class="occi__box is-target"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4"/><text x="${x + w / 2}" y="${y + h / 2 + fs * 0.35}" font-size="${fs}" text-anchor="middle">?</text></g>`; }
      return f.mode === "all" ? `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" class="occi__cover"/>` : "";
    }).join("");
    const what = target?.kind === "arrow" ? "an arrow points to a structure" : "one label is hidden";
    return `<div class="occi" style="aspect-ratio:${VW}/${H}"><img src="${M().url(f.image)}" alt="" draggable="false"><svg viewBox="0 0 ${VW} ${H}" preserveAspectRatio="none" role="img" aria-label="Diagram, ${reveal ? "answer shown" : what}">${defs(mk)}${parts}</svg></div>`;
  }
  const maskName = (m, i) => m.label?.trim() || (m.kind === "arrow" ? `Arrow ${i + 1}` : `Box ${i + 1}`);

  /* ---------- editor ------------------------------------------------------ */
  const HINT = {
    box: "Drag across a label to hide it, or tap to drop a box. Each box makes one card.",
    arrow: "Tap the structure you want to be asked about. Drag from it to place the answer, then type the answer.",
    select: "Drag a mask to move it. Drag a corner or an arrow end to adjust. Press Delete to remove the selected one.",
  };
  function overlayInner(f, ui) {
    const H = vh(f), mk = "occ-ed-ah";
    const masks = f.masks.map((m, i) => {
      const sel = ui.sel === i ? " is-selected" : "";
      if (m.kind === "arrow") {
        const lb = labelBox(m, H), tx = m.x * VW, ty = m.y * H, e = edgePoint(lb, tx, ty);
        return `<g class="occx__m occx__m--arrow${sel}" data-i="${i}">
          <line x1="${e.x}" y1="${e.y}" x2="${tx}" y2="${ty}" marker-end="url(#${mk})" data-part="line"/>
          <rect x="${lb.x}" y="${lb.y}" width="${lb.w}" height="${lb.h}" rx="${lb.h * 0.25}" data-part="tag"/>
          <text x="${lb.cx}" y="${lb.cy + lb.fs * 0.35}" font-size="${lb.fs}" text-anchor="middle" data-part="tag">${esc(m.label || "Answer…")}</text>
          <circle cx="${tx}" cy="${ty}" r="${sel ? 11 : 7}" class="occx__h" data-part="tip"/>
          <text x="${lb.x + 6}" y="${lb.y - 8}" class="occx__n" font-size="20">${i + 1}</text></g>`;
      }
      const x = m.x * VW, y = m.y * H, w = m.w * VW, h = m.h * H;
      return `<g class="occx__m occx__m--box${sel}" data-i="${i}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" data-part="body"/>
        <text x="${x + 6}" y="${y + Math.min(26, h - 4)}" class="occx__n" font-size="${Math.max(14, Math.min(22, h * 0.7))}">${i + 1}</text>
        ${sel ? `<rect x="${x + w - 9}" y="${y + h - 9}" width="18" height="18" rx="4" class="occx__h" data-part="se"/>` : ""}</g>`;
    }).join("");
    const draft = ui.draft ? (ui.draft.kind === "box"
      ? `<rect x="${ui.draft.x * VW}" y="${ui.draft.y * H}" width="${ui.draft.w * VW}" height="${ui.draft.h * H}" rx="4" class="occx__draft"/>`
      : arrowSvg(ui.draft, H, { text: "?", cls: "occx__draft-arrow", marker: mk })) : "";
    return defs(mk) + masks + draft;
  }
  function editorHtml(f, ui) {
    const H = vh(f), s = ui.sel != null ? f.masks[ui.sel] : null;
    return `
      <div class="occx__bar" role="toolbar" aria-label="Occlusion tools">
        <div class="segmented segmented--text" role="group" aria-label="Tool">
          ${[["box", "Box"], ["arrow", "Arrow"], ["select", "Select"]].map(([k, l]) => `<button type="button" class="segmented__btn ${ui.tool === k ? "is-active" : ""}" aria-pressed="${ui.tool === k}" data-occ="tool" data-value="${k}">${l}</button>`).join("")}
        </div>
        <button type="button" class="btn btn--secondary btn--sm" data-occ="auto" ${ui.busy ? "disabled" : ""}>${ui.busy ? "Finding text…" : "Hide all text"}</button>
        <span class="occx__spacer"></span>
        ${f.masks.length ? `<button type="button" class="btn btn--ghost btn--sm" data-occ="clear">Clear masks</button>` : ""}
        <label class="btn btn--ghost btn--sm occx__replace">Replace image<input type="file" accept="image/*" data-occ="file" hidden></label>
      </div>
      <p class="field__hint occx__hint">${HINT[ui.tool]}</p>
      <div class="occx__stage tool-${ui.tool}" style="aspect-ratio:${VW}/${H}">
        <img src="${M().url(f.image)}" alt="Your diagram" draggable="false">
        <svg viewBox="0 0 ${VW} ${H}" preserveAspectRatio="none" aria-hidden="true">${overlayInner(f, ui)}</svg>
      </div>
      ${s ? `<div class="occx__sel"><label class="field"><span class="field__label">${s.kind === "arrow" ? `Answer for arrow ${ui.sel + 1}` : `Answer for box ${ui.sel + 1} <small>optional</small>`}</span>
          <input id="occ-label" value="${esc(s.label || "")}" data-input="occ-label" placeholder="${s.kind === "arrow" ? "e.g. Ciliary body" : "e.g. Optic canal (used in lists and quizzes)"}" autocomplete="off"></label>
          <button type="button" class="btn btn--ghost btn--sm btn--danger" data-occ="delete">Remove</button></div>` : ""}
      <div class="occx__foot">
        <span class="caption">${f.masks.length ? `${f.masks.length} ${f.masks.length === 1 ? "mask" : "masks"} → ${f.masks.length} ${f.masks.length === 1 ? "card" : "cards"}` : "No masks yet."}</span>
        <div class="segmented segmented--text" role="radiogroup" aria-label="How other boxes look">
          <button type="button" class="segmented__btn ${f.mode === "all" ? "is-active" : ""}" aria-pressed="${f.mode === "all"}" data-occ="mode" data-value="all" title="Every box stays covered; one is asked">Hide all, guess one</button>
          <button type="button" class="segmented__btn ${f.mode === "one" ? "is-active" : ""}" aria-pressed="${f.mode === "one"}" data-occ="mode" data-value="one" title="Only the asked box is covered">Hide one, guess one</button>
        </div>
      </div>`;
  }
  function dropzoneHtml() {
    return `<div class="occx__drop" data-occ-drop tabindex="0">
      <p class="body-strong">Paste a diagram, drop it here, or choose a file</p>
      <p class="caption">Screenshots of lecture slides work well. Kivo can white out every label for you.</p>
      <div class="stack-h stack-h--center"><label class="btn btn--primary btn--sm">Choose image<input type="file" accept="image/*" data-occ="file" hidden></label><button type="button" class="btn btn--ghost btn--sm" data-occ="sample">Use the sample skull diagram</button></div>
      <p class="caption"><kbd>⌘V</kbd> / <kbd>Ctrl V</kbd> to paste</p></div>`;
  }

  /* Pointer interaction on the stage. `ctx` = { fields, ui, redraw, changed } */
  function attach(root, ctx) {
    const stage = root.querySelector(".occx__stage"); if (!stage) return;
    const pt = (e) => { const r = stage.getBoundingClientRect(); return { x: clamp((e.clientX - r.left) / r.width), y: clamp((e.clientY - r.top) / r.height), px: r.width, py: r.height }; };
    let drag = null;
    const paint = () => { const svg = stage.querySelector("svg"); if (svg) svg.innerHTML = overlayInner(ctx.fields(), ctx.ui); };
    stage.addEventListener("pointerdown", (e) => {
      if (e.button > 0) return;
      const f = ctx.fields(), ui = ctx.ui, p = pt(e);
      const g = e.target.closest(".occx__m"), part = e.target.dataset.part;
      stage.setPointerCapture(e.pointerId); e.preventDefault();
      if (g) {
        const i = +g.dataset.i;
        ui.sel = i; drag = { mode: part === "se" ? "resize" : part === "tip" ? "tip" : part === "tag" ? "tag" : "move", i, start: p, orig: { ...f.masks[i] }, moved: false };
        paint(); return;
      }
      if (ui.tool === "select") { ui.sel = null; ctx.redraw(); return; }
      if (ui.tool === "box") { ui.draft = { kind: "box", x: p.x, y: p.y, w: 0, h: 0 }; drag = { mode: "draw-box", start: p }; }
      else { ui.draft = { kind: "arrow", x: p.x, y: p.y, ...autoLabel(p), label: "" }; drag = { mode: "draw-arrow", start: p, moved: false }; }
      paint();
    });
    stage.addEventListener("pointermove", (e) => {
      if (!drag) return;
      const f = ctx.fields(), ui = ctx.ui, p = pt(e), dx = p.x - drag.start.x, dy = p.y - drag.start.y;
      if (Math.abs(dx * p.px) + Math.abs(dy * p.py) > 6) drag.moved = true;
      if (drag.mode === "draw-box") { ui.draft = { kind: "box", x: Math.min(p.x, drag.start.x), y: Math.min(p.y, drag.start.y), w: Math.abs(dx), h: Math.abs(dy) }; }
      else if (drag.mode === "draw-arrow") { if (drag.moved) Object.assign(ui.draft, { lx: p.x, ly: p.y }); }
      else {
        const m = f.masks[drag.i], o = drag.orig;
        if (drag.mode === "move") { if (m.kind === "box") Object.assign(m, { x: clamp(o.x + dx, 0, 1 - o.w), y: clamp(o.y + dy, 0, 1 - o.h) }); else Object.assign(m, { x: clamp(o.x + dx), y: clamp(o.y + dy), lx: clamp(o.lx + dx), ly: clamp(o.ly + dy) }); }
        else if (drag.mode === "resize") Object.assign(m, { w: clamp(o.w + dx, 0.01, 1 - o.x), h: clamp(o.h + dy, 0.01, 1 - o.y) });
        else if (drag.mode === "tip") Object.assign(m, { x: p.x, y: p.y });
        else if (drag.mode === "tag") Object.assign(m, { lx: clamp(o.lx + dx), ly: clamp(o.ly + dy) });
      }
      paint();
    });
    const end = () => {
      if (!drag) return;
      const f = ctx.fields(), ui = ctx.ui, d = ui.draft;
      if (drag.mode === "draw-box") {
        const tap = !d || (d.w < 0.012 && d.h < 0.012);
        const m = tap ? { kind: "box", x: clamp(drag.start.x - 0.07, 0, 0.86), y: clamp(drag.start.y - 0.025, 0, 0.95), w: 0.14, h: 0.05, label: "" } : { kind: "box", x: d.x, y: d.y, w: Math.max(d.w, 0.01), h: Math.max(d.h, 0.01), label: "" };
        f.masks.push(m); ui.sel = f.masks.length - 1; ui.focusLabel = false;
      } else if (drag.mode === "draw-arrow") {
        f.masks.push({ ...d, label: "" }); ui.sel = f.masks.length - 1; ui.focusLabel = true;
      }
      const wasMove = !["draw-box", "draw-arrow"].includes(drag.mode);
      ui.draft = null; drag = null; ctx.redraw(); if (!wasMove || true) ctx.changed();
    };
    stage.addEventListener("pointerup", end); stage.addEventListener("pointercancel", end);
  }
  // Put the answer tag out toward the nearer side, where there is usually white space.
  function autoLabel(p) { const left = p.x < 0.5; return { lx: clamp(left ? p.x - 0.2 : p.x + 0.2, 0.08, 0.92), ly: clamp(p.y - 0.06, 0.05, 0.95) }; }

  /* ---------- find printed text on a diagram ---------------------------- */
  /**
   * Finds label-like text: small dark marks of similar height in a row,
   * sitting on light background. Returns boxes in image units (0–1).
   */
  async function detectText(imageId) {
    const url = M().url(imageId); if (!url) return [];
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const k = Math.min(1, 1400 / Math.max(img.width, img.height));
    const W = Math.max(1, Math.round(img.width * k)), H = Math.max(1, Math.round(img.height * k));
    const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
    const cx = cv.getContext("2d", { willReadFrequently: true }); cx.fillStyle = "#fff"; cx.fillRect(0, 0, W, H); cx.drawImage(img, 0, 0, W, H);
    const px = cx.getImageData(0, 0, W, H).data, N = W * H;
    const gray = new Float32Array(N);
    for (let i = 0, j = 0; i < N; i++, j += 4) gray[i] = 0.299 * px[j] + 0.587 * px[j + 1] + 0.114 * px[j + 2];
    // local mean via integral image → adaptive threshold (ink is darker than its surroundings)
    const S = new Float64Array((W + 1) * (H + 1));
    for (let y = 0; y < H; y++) { let row = 0; for (let x = 0; x < W; x++) { row += gray[y * W + x]; S[(y + 1) * (W + 1) + x + 1] = S[y * (W + 1) + x + 1] + row; } }
    const R = Math.max(8, Math.round(Math.min(W, H) / 40));
    const ink = new Uint8Array(N);
    for (let y = 0; y < H; y++) {
      const y0 = Math.max(0, y - R), y1 = Math.min(H, y + R + 1);
      for (let x = 0; x < W; x++) {
        const x0 = Math.max(0, x - R), x1 = Math.min(W, x + R + 1);
        const sum = S[y1 * (W + 1) + x1] - S[y0 * (W + 1) + x1] - S[y1 * (W + 1) + x0] + S[y0 * (W + 1) + x0];
        const mean = sum / ((x1 - x0) * (y1 - y0)), g = gray[y * W + x];
        if (g < mean - 18 && g < 175) ink[y * W + x] = 1;
      }
    }
    // connected components
    const lab = new Int32Array(N), comps = [], stack = new Int32Array(N);
    for (let s = 0; s < N; s++) {
      if (!ink[s] || lab[s]) continue;
      const id = comps.length + 1; let sp = 0, n = 0, minx = W, miny = H, maxx = 0, maxy = 0;
      stack[sp++] = s; lab[s] = id;
      while (sp) {
        const p = stack[--sp], x = p % W, y = (p - x) / W; n++;
        if (x < minx) minx = x; if (x > maxx) maxx = x; if (y < miny) miny = y; if (y > maxy) maxy = y;
        for (let dy = -1; dy <= 1; dy++) { const yy = y + dy; if (yy < 0 || yy >= H) continue; for (let dx = -1; dx <= 1; dx++) { const xx = x + dx; if (xx < 0 || xx >= W) continue; const q = yy * W + xx; if (ink[q] && !lab[q]) { lab[q] = id; stack[sp++] = q; } } }
      }
      comps.push({ x0: minx, y0: miny, x1: maxx + 1, y1: maxy + 1, n });
    }
    // character-like marks
    const hMin = Math.max(6, H * 0.009), hMax = Math.min(90, Math.max(18, H * 0.075));
    const chars = comps.filter((c) => {
      const w = c.x1 - c.x0, h = c.y1 - c.y0, dens = c.n / (w * h);
      if (h < hMin * 0.45 || h > hMax || w > W * 0.2) return false;
      if (w > h * 2.8 + 4) return false;              // long strokes (leader lines, rules)
      const thin = w <= Math.max(3, h * 0.35);          // I, l, i, 1: solid strokes are letters too
      return dens > 0.07 && (dens < 0.95 || thin) && c.n >= 6;
    });
    // group marks into words and lines
    const P = chars.map((_, i) => i), find = (i) => (P[i] === i ? i : (P[i] = find(P[i])));
    const join = (a, b) => { a = find(a); b = find(b); if (a !== b) P[b] = a; };
    const order = chars.map((c, i) => i).sort((a, b) => chars[a].x0 - chars[b].x0);
    for (let ai = 0; ai < order.length; ai++) {
      const a = chars[order[ai]], ha = a.y1 - a.y0;
      for (let bi = ai + 1; bi < order.length; bi++) {
        const b = chars[order[bi]], hb = b.y1 - b.y0, hm = Math.max(ha, hb);
        if (b.x0 - a.x1 > hm * 1.1) break;
        const ov = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
        if (ov > Math.min(ha, hb) * 0.45 && Math.max(ha, hb) / Math.max(1, Math.min(ha, hb)) < 3.2) join(order[ai], order[bi]);
      }
    }
    let groups = new Map();
    chars.forEach((c, i) => { const r = find(i), g = groups.get(r) || { x0: W, y0: H, x1: 0, y1: 0, n: 0, hs: [] }; g.x0 = Math.min(g.x0, c.x0); g.y0 = Math.min(g.y0, c.y0); g.x1 = Math.max(g.x1, c.x1); g.y1 = Math.max(g.y1, c.y1); g.n++; g.hs.push(c.y1 - c.y0); groups.set(r, g); });
    let lines = [...groups.values()].map((g) => ({ ...g, h: g.hs.sort((a, b) => a - b)[g.hs.length >> 1], hmax: g.hs[g.hs.length - 1] }))
      // a printed line is about as tall as its tallest letter; marks climbing a curve are not
      .filter((g) => (g.y1 - g.y0) <= Math.max(g.hmax * 1.35, g.h * 2.1) && g.h >= hMin * 0.8);
    // stack lines that belong to one label (two-line labels)
    lines.forEach((l) => { l.parts = [{ ...l }]; });
    let merged = true;
    while (merged) {
      merged = false;
      outer: for (let i = 0; i < lines.length; i++) for (let j = i + 1; j < lines.length; j++) {
        const a = lines[i], b = lines[j], h = Math.max(a.h, b.h);
        const vgap = Math.max(a.y0, b.y0) - Math.min(a.y1, b.y1), hov = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
        const aligned = Math.abs(a.x0 - b.x0) < h * 1.5 || Math.abs((a.x0 + a.x1) - (b.x0 + b.x1)) < h * 3 || Math.abs(a.x1 - b.x1) < h * 1.5;
        if (vgap < h * 1.15 && vgap > -h * 0.3 && hov > Math.min(a.x1 - a.x0, b.x1 - b.x0) * 0.4 && aligned && Math.abs(a.h - b.h) < h * 0.6) {
          lines[i] = { x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0), x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1), n: a.n + b.n, h: Math.round((a.h + b.h) / 2), parts: [...a.parts, ...b.parts] };
          lines.splice(j, 1); merged = true; break outer;
        }
      }
    }
    // labels wrap onto two lines at most; three or more stacked lines is a list, one mask per item
    lines = lines.flatMap((l) => (l.parts.length >= 3 ? l.parts : [l]));
    // keep text sitting on light background; drop texture inside drawings
    const ringMean = (b, pad) => {
      const x0 = Math.max(0, b.x0 - pad), y0 = Math.max(0, b.y0 - pad), x1 = Math.min(W, b.x1 + pad), y1 = Math.min(H, b.y1 + pad);
      let s = 0, s2 = 0, c = 0, dark = 0;
      const add = (x, y) => { const g = gray[y * W + x]; s += g; s2 += g * g; c++; if (g < 120) dark++; };
      for (let x = x0; x < x1; x++) { add(x, y0); add(x, y1 - 1); }
      for (let y = y0; y < y1; y++) { add(x0, y); add(x1 - 1, y); }
      const mean = s / c; return { mean, sd: Math.sqrt(Math.max(0, s2 / c - mean * mean)), dark: dark / c };
    };
    const out = [];
    for (const g of lines) {
      const w = g.x1 - g.x0, h = g.y1 - g.y0;
      if (g.n < 2 && !(g.h >= hMin * 1.2 && w < g.h * 1.4 && w > g.h * 0.35)) continue;   // single letters like "A" only, not stray strokes
      if (g.h < hMin) continue;
      if (w * h > W * H * 0.2) continue;
      const pad = Math.max(2, Math.round(g.h * 0.35)), ring = ringMean(g, pad);
      if (ring.mean < 200 || ring.sd > 40 || ring.dark > 0.12) continue;   // labels sit on clean, light background
      const p2 = Math.max(2, Math.round(g.h * 0.22));
      out.push({ x: Math.max(0, g.x0 - p2) / W, y: Math.max(0, g.y0 - p2) / H, w: Math.min(W, w + p2 * 2) / W, h: Math.min(H, h + p2 * 2) / H });
    }
    return out.sort((a, b) => a.y - b.y || a.x - b.x);
  }
  const overlap = (a, b) => { const ix = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x), iy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y); return ix > 0 && iy > 0 ? (ix * iy) / Math.min(a.w * a.h, b.w * b.h) : 0; };

  return { face, editorHtml, dropzoneHtml, attach, detectText, overlap, maskName };
})();
