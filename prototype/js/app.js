/* ==========================================================================
   Kivo — app
   Views, routing and interactions on top of KivoStore (local database +
   FSRS scheduler). Library: Semester → Course → Unit → Collection → Cards.
   Responsive: sidebar on desktop, tab bar on phones.
   ========================================================================== */
(() => {
  "use strict";

  const S = window.KivoStore;
  const SEED = window.KIVO_SEED;
  const I = window.KIVO_ICONS;

  /* ---------- utilities ------------------------------------------------- */
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const icon = (name, size = 18, extra = "") =>
    `<svg class="icon ${extra}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${I[name] || ""}</svg>`;
  const pct = (n) => `${Math.round(n * 100)}%`;
  const plural = (n, w, pl) => `${n} ${n === 1 ? w : pl || w + "s"}`;
  const strip = (t) => String(t || "").replace(/\{\{c\d+::(.+?)(::.+?)?\}\}/g, "$1").replace(/<[^>]+>/g, "");
  const prefs = {
    get(k, d) { try { const v = localStorage.getItem("kivo:" + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem("kivo:" + k, JSON.stringify(v)); } catch { /* storage unavailable */ } },
  };
  const DAY = S.DAY;
  const TODAY = S.startOfDay();
  const pad2 = (n) => String(n).padStart(2, "0");
  const isoDate = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  const parseISO = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
  const daysUntil = (iso) => Math.round((parseISO(iso) - TODAY) / DAY);
  const fmtDate = (iso, opts = { weekday: "short", month: "short", day: "numeric" }) => parseISO(iso).toLocaleDateString("en-US", opts);
  const fmtTime = (t) => { if (!t) return ""; const [h, m] = t.split(":").map(Number); return new Date(2000, 0, 1, h, m).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }); };
  const daysLabel = (n) => (n === 0 ? "today" : n === 1 ? "tomorrow" : `in ${n} days`);
  function fmtIvl(ms) {
    const m = ms / 60000;
    if (m < 60) return `${Math.max(1, Math.round(m))}m`;
    if (m < 1440) return `${Math.round(m / 60)}h`;
    const d = ms / DAY;
    if (d < 30) return `${Math.round(d)}d`;
    if (d < 365) return `${(d / 30).toFixed(1).replace(/\.0$/, "")}mo`;
    return `${(d / 365).toFixed(1).replace(/\.0$/, "")}y`;
  }
  function relTime(ts) {
    if (!ts) return "Not studied yet";
    const d = Math.round((TODAY - S.startOfDay(ts)) / DAY);
    return d <= 0 ? "Studied today" : d === 1 ? "Studied yesterday" : d < 7 ? `Studied ${d} days ago` : `Studied ${new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
  }

  /* ---------- app state -------------------------------------------------- */
  const state = {
    libraryView: prefs.get("libraryView", "grid"), libraryQuery: "", librarySort: "recent",
    browse: { q: "", filter: "all", section: "All" },
    collapsed: prefs.get("collapsed", {}),
    session: null, builder: null, quiz: null, exams: [], calImport: null, importer: null, returnTo: null,
  };

  /* ---------- scopes ----------------------------------------------------- */
  // URL param ↔ store scope: "all" · "semester-<id>" · "course-<id>" · "unit-<id>" · "<deckId>"
  const toScope = (p) => !p || p === "all" ? "all" : p.startsWith("semester-") ? "semester:" + p.slice(9) : p.startsWith("course-") ? "course:" + p.slice(7) : p.startsWith("unit-") ? "unit:" + p.slice(5) : "deck:" + p;
  const toParam = (scope) => scope === "all" ? "all" : scope.replace(/^semester:/, "semester-").replace(/^course:/, "course-").replace(/^unit:/, "unit-").replace(/^deck:/, "");
  const activeCourses = () => S.db.courses.filter((c) => !S.semester(c.semesterId)?.archived);
  const isArchived = (courseId) => !!S.semester(S.course(courseId)?.semesterId)?.archived;

  /* ---------- card rendering --------------------------------------------- */
  function clozeHtml(text, n, mode) {
    return esc(text).replace(/\{\{c(\d+)::(.+?)(?:::(.+?))?\}\}/g, (_, k, ans, hint) => {
      if (mode === "all") return `<mark class="cloze cloze--soft">${ans}</mark>`;
      if (+k !== n) return ans;
      if (mode === "front") return `<span class="cloze cloze--blank">[${hint ? hint : "…"}]</span>`;
      return `<mark class="cloze cloze--revealed">${ans}</mark>`;
    });
  }
  function normalizeCloze(text) {
    let next = Math.max(0, ...S.clozeNums(text)) + 1;
    return text.replace(/\{\{(?!c\d+::)(.+?)\}\}/g, (_, inner) => `{{c${next++}::${inner}}}`);
  }
  const TYPE_LABEL = { basic: "Basic", reverse: "Basic + reversed", cloze: "Cloze", occlusion: "Image occlusion" };
  function cardFaces(c, n = S.note(c.noteId)) {
    const f = n.fields;
    if (n.type === "cloze") return { front: `<p class="fc__prompt">${clozeHtml(f.text, c.ord, "front")}</p>`, back: `<p class="fc__prompt">${clozeHtml(f.text, c.ord, "back")}</p>${f.extra ? `<p class="fc__extra">${esc(f.extra)}</p>` : ""}`, q: strip(f.text), a: (f.text.match(new RegExp(`\\{\\{c${c.ord}::(.+?)(::|\\}\\})`)) || [])[1] || "" };
    if (n.type === "occlusion") { const target = f.masked[c.ord]; return { front: `<p class="fc__prompt fc__prompt--sm">${esc(f.prompt)}</p>${occlusionSvg({ target })}`, back: `<p class="fc__prompt fc__prompt--sm">${esc(f.prompt)}</p>${occlusionSvg({ target, reveal: true })}<p class="fc__answer">${esc(target)}</p>${f.extra ? `<p class="fc__extra">${esc(f.extra)}</p>` : ""}`, q: f.prompt, a: target }; }
    const [q, a] = n.type === "reverse" && c.ord === 1 ? [f.back, f.front] : [f.front, f.back];
    return { front: `<p class="fc__prompt">${esc(q)}</p>`, back: `<p class="fc__prompt">${esc(q)}</p><hr class="fc__rule"><p class="fc__answer">${esc(a)}</p>${f.extra ? `<p class="fc__extra">${esc(f.extra)}</p>` : ""}`, q, a };
  }
  const notePoints = (c, n = S.note(c.noteId)) => (n.type === "basic" || (n.type === "reverse" && c.ord === 0)) ? String(n.fields.points || "").split(",").map((p) => p.trim()).filter(Boolean) : [];
  function dueLabel(c) {
    if (c.suspended) return { text: "Suspended", tone: "neutral" };
    if (c.buriedUntil > Date.now()) return { text: "Buried", tone: "neutral" };
    const s = c.sched;
    if (s.state === "new") return { text: "New", tone: "accent" };
    if (s.state !== "review") return { text: "Learning", tone: "danger" };
    const d = Math.round((S.startOfDay(s.due) - TODAY) / DAY);
    return d <= 0 ? { text: "Due today", tone: "warning" } : { text: `In ${fmtIvl(d * DAY)}`, tone: "success" };
  }

  /* Skull-base schematic for image-occlusion cards ------------------------ */
  const FORAMINA = [
    { name: "Optic canal", hx: 190, hy: 74, ly: 40 }, { name: "Superior orbital fissure", hx: 214, hy: 92, ly: 72 },
    { name: "Foramen rotundum", hx: 222, hy: 114, ly: 104 }, { name: "Foramen ovale", hx: 230, hy: 136, ly: 136 },
    { name: "Foramen spinosum", hx: 242, hy: 150, ly: 168 }, { name: "Jugular foramen", hx: 238, hy: 196, ly: 200 },
    { name: "Hypoglossal canal", hx: 206, hy: 214, ly: 232 }, { name: "Foramen magnum", hx: 190, hy: 236, ly: 264 },
  ];
  function occlusionSvg({ masked = [], target = null, reveal = false, interactive = false } = {}) {
    const holes = FORAMINA.map((f) => f.name === "Foramen magnum" ? "" : `<ellipse cx="${f.hx}" cy="${f.hy}" rx="7" ry="5" class="occ__hole"/><ellipse cx="${340 - f.hx}" cy="${f.hy}" rx="7" ry="5" class="occ__hole"/>`).join("");
    const labels = FORAMINA.map((f) => {
      const isMasked = masked.includes(f.name), isTarget = target === f.name;
      const hidden = interactive ? isMasked : isTarget && !reveal;
      const cls = ["occ__label", hidden ? "is-masked" : "", isTarget && reveal ? "is-revealed" : ""].join(" ");
      const tag = interactive ? `role="button" tabindex="0" aria-pressed="${isMasked}" aria-label="${esc(f.name)}, ${isMasked ? "hidden" : "visible"}" data-action="occ-toggle" data-value="${esc(f.name)}"` : "";
      return `<g class="${cls}" ${tag}><line x1="${f.hx + 6}" y1="${f.hy}" x2="342" y2="${f.ly}" class="occ__leader"/><rect x="344" y="${f.ly - 11}" width="132" height="22" rx="5" class="occ__box"/><text x="352" y="${f.ly + 4}" class="occ__text">${hidden ? "?" : esc(f.name)}</text></g>`;
    }).join("");
    return `<svg class="occ" viewBox="0 0 480 290" role="img" aria-label="Schematic of the internal skull base showing foramina${target && !reveal ? ", one label hidden" : ""}"><ellipse cx="170" cy="150" rx="150" ry="132" class="occ__skull"/><path d="M60 110 Q170 60 280 110" class="occ__ridge"/><path d="M70 175 Q170 140 270 175" class="occ__ridge"/><ellipse cx="170" cy="236" rx="24" ry="20" class="occ__hole occ__hole--lg"/><rect x="160" y="96" width="20" height="26" rx="6" class="occ__sella"/>${holes}${labels}</svg>`;
  }

  /* ---------- shared UI -------------------------------------------------- */
  const NAV = [
    { id: "home", label: "Home", icon: "home" }, { id: "library", label: "My Library", short: "Library", icon: "library" },
    { id: "study", label: "Study", icon: "study" }, { id: "exams", label: "Exams", icon: "calendar" }, { id: "insights", label: "Insights", icon: "insights" },
  ];
  const avatar = (initials, size = "md", tone = "") => `<span class="avatar avatar--${size} ${tone}" aria-hidden="true">${esc(initials)}</span>`;
  function sourceBadge(source) {
    const map = { original: ["Created by you", "badge--neutral", "check"], shared: ["Your copy", "badge--sage", "fork"], "personal-copy": ["Your copy · edited", "badge--accent", "fork"], modified: ["Your copy · edited", "badge--peach", "edit"] };
    const [label, cls, ic] = map[source] || map.original;
    return `<span class="badge ${cls}">${icon(ic, 12)}${label}</span>`;
  }
  const countPills = (c, { compact = false } = {}) => `<span class="counts ${compact ? "counts--compact" : ""}" aria-label="${c.new} new, ${c.learn} learning, ${c.review} to review"><span class="cnt cnt--new" title="New">${c.new}</span><span class="cnt cnt--learn" title="Learning">${c.learn}</span><span class="cnt cnt--review" title="To review">${c.review}</span></span>`;
  const dueBadge = (c) => c.total ? `<span class="badge badge--warning">${icon("clock", 12)}${c.total} to study</span>` : `<span class="badge badge--success">${icon("check", 12)}Up to date</span>`;
  const progressBar = (value, label, tone = "") => `<div class="progress ${tone}" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(value * 100)}" aria-label="${esc(label)}"><span style="width:${(Math.max(0, Math.min(1, value)) * 100).toFixed(1)}%"></span></div>`;
  const breadcrumb = (items) => `<nav class="breadcrumb" aria-label="Breadcrumb"><ol>${items.map((it, i) => `<li>${it.href && i < items.length - 1 ? `<a href="${it.href}">${esc(it.label)}</a>` : `<span aria-current="page">${esc(it.label)}</span>`}</li>`).join(`<li aria-hidden="true" class="breadcrumb__sep">${icon("chevronRight", 14)}</li>`)}</ol></nav>`;
  const emptyState = (title, body, action = "", ic = "search") => `<div class="empty"><div class="empty__icon">${icon(ic, 22)}</div><h3>${esc(title)}</h3><p>${esc(body)}</p>${action}</div>`;
  const prototypeNote = (text) => `<p class="proto-note">${icon("info", 14)}<span>${text}</span></p>`;
  const menu = (id, items) => `<details class="menu" data-menu="${id}"><summary class="icon-btn" aria-label="More actions">${icon("more", 18)}</summary><div class="menu__list" role="menu">${items.filter(Boolean).map((it) => it === "-" ? `<hr>` : `<button role="menuitem" class="menu__item ${it.danger ? "is-danger" : ""}" data-action="${it.action}" ${Object.entries(it.data || {}).map(([k, v]) => `data-${k}="${esc(v)}"`).join(" ")}>${icon(it.icon, 16)}${esc(it.label)}</button>`).join("")}</div></details>`;
  const deckLabel = (d) => { const c = S.course(d.courseId), u = d.unitId ? S.unit(d.unitId) : null; return [c?.name, u?.name, d.title].filter(Boolean).join(" › "); };
  const courseCrumbs = (c) => { const sem = S.semester(c.semesterId); return [{ label: "My Library", href: "#/library" }, ...(sem ? [{ label: sem.name, href: "#/library" }] : [])]; };

  /* ---------- toast & modal ----------------------------------------------- */
  function toast(message, { action, onAction, tone = "default" } = {}) {
    const el = document.createElement("div");
    el.className = `toast toast--${tone}`; el.setAttribute("role", "status");
    el.innerHTML = `${icon(tone === "success" ? "check" : tone === "error" ? "alert" : "info", 16)}<span>${esc(message)}</span>${action ? `<button class="btn btn--ghost btn--sm toast__action">${esc(action)}</button>` : ""}<button class="icon-btn icon-btn--sm toast__close" aria-label="Dismiss">${icon("x", 14)}</button>`;
    const root = $("#toast-root");
    while (root.children.length >= 2) root.firstElementChild.remove();
    root.appendChild(el);
    const remove = () => { el.classList.add("is-leaving"); setTimeout(() => el.remove(), 200); };
    el.querySelector(".toast__close").addEventListener("click", remove);
    if (action) el.querySelector(".toast__action").addEventListener("click", () => { onAction?.(); remove(); });
    setTimeout(remove, 5600);
  }
  let lastFocus = null;
  function openModal(html, { label = "Dialog", size = "md", onMount } = {}) {
    if ($("#modal-root").hidden) lastFocus = document.activeElement;
    const root = $("#modal-root");
    root.innerHTML = `<div class="modal-backdrop" data-action="close-modal"></div><div class="modal modal--${size}" role="dialog" aria-modal="true" aria-label="${esc(label)}">${html}</div>`;
    root.hidden = false; document.body.classList.add("has-modal");
    const m = $(".modal", root);
    const f = $$("button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])", m);
    (f.find((el) => el.matches("[autofocus]")) || f[0] || m).focus();
    onMount?.(m);
  }
  function closeModal(silent) {
    const root = $("#modal-root"); if (root.hidden) return;
    root.hidden = true; root.innerHTML = ""; document.body.classList.remove("has-modal");
    if (!silent && lastFocus?.isConnected) lastFocus.focus();
  }
  function trapFocus(e) {
    const m = $("#modal-root .modal"); if (!m || e.key !== "Tab") return;
    const f = $$("button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex='-1'])", m).filter((el) => el.offsetParent !== null);
    if (!f.length) return;
    if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
    else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
  }
  const formError = (msg, field) => { const e = $("#form-error"); if (e) { e.textContent = msg; e.hidden = false; } if (field) { field.setAttribute("aria-invalid", "true"); field.focus(); } };

  /* Reviews are always one course at a time. Pick the course to start with:
     the one with the nearest exam that has cards due, otherwise the most due. */
  function courseQueue(excludeId = null) {
    const list = S.db.courses.filter((c) => !S.paused(c.id) && c.id !== excludeId).map((c) => ({ c, n: S.counts("course:" + c.id) })).filter((x) => x.n.total);
    const examDays = (cid) => { const e = upcomingExams().find((x) => x.courseId === cid); return e ? daysUntil(e.date) : Infinity; };
    return list.sort((a, b) => examDays(a.c.id) - examDays(b.c.id) || b.n.total - a.n.total).map((x) => ({ ...x, exam: upcomingExams().find((e) => e.courseId === x.c.id) }));
  }

  /* ======================================================================
     HOME
     ====================================================================== */
  function viewHome() {
    const hour = new Date().getHours();
    const greet = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
    const all = S.counts("all");
    const exams = upcomingExams().slice(0, 3), next = exams[0];
    const queue = courseQueue(), first = queue[0];
    const recent = S.db.decks.filter((d) => !isArchived(d.courseId)).sort((a, b) => (S.lastStudied([b.id]) || b.modified) - (S.lastStudied([a.id]) || a.modified)).slice(0, 4);
    const reviewedToday = S.db.log.filter((l) => l.ts >= TODAY).length;
    const tomorrow = S.forecast(2)[1];
    return `
      <header class="page-header page-header--home"><div>
        <p class="overline">${esc(new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }))}</p>
        <h1 class="display">${greet}, ${esc(SEED.user.name)}</h1>
        <p class="lede">${next ? `${esc(next.title)} for ${esc(S.course(next.courseId)?.name || "your course")} is ${daysLabel(daysUntil(next.date))}.` : "Add your exam dates and Kivo will show what to review before each one."}</p>
      </div></header>
      <div class="home-grid">
        <section class="card hero ${all.total ? "" : "hero--done"}" aria-labelledby="today-title">
          <div class="hero__main">
            <p class="overline">Today’s review</p>
            ${first ? `
              <h2 id="today-title" class="hero__count"><span class="num">${all.total}</span> ${all.total === 1 ? "card" : "cards"} across ${plural(queue.length, "course")}</h2>
              <p class="hero__meta">Review one course at a time so you stay in one subject. ${first.exam ? `Start with ${esc(first.c.name)}: ${esc(first.exam.title)} is ${daysLabel(daysUntil(first.exam.date))}.` : `Start with ${esc(first.c.name)}, which has the most due.`}</p>
              <div class="hero__actions"><a class="btn btn--primary btn--lg" href="#/study/course-${first.c.id}">${icon("play", 16)}Start ${esc(first.c.name)} · ${first.n.total}</a><a class="btn btn--ghost btn--lg" href="#/study">Pick a unit or collection</a></div>` : `
              <h2 id="today-title" class="hero__count">All caught up</h2>
              <p class="hero__meta">${reviewedToday ? `You reviewed ${plural(reviewedToday, "card")} today. ` : ""}${all.learnLater ? `${plural(all.learnLater, "learning card")} will be ready again shortly.` : `${plural(tomorrow, "card")} due tomorrow.`}</p>
              <div class="hero__actions"><a class="btn btn--secondary btn--lg" href="#/builder">${icon("plus", 16)}Add cards</a><a class="btn btn--ghost btn--lg" href="#/insights">See insights</a></div>`}
          </div>
          ${queue.length ? `<ul class="hero__sources hero__sources--courses" aria-label="Courses with cards to study">${queue.map(({ c, n, exam }) => `<li><a href="#/study/course-${c.id}"><span class="dot dot--${c.hue}"></span><span class="hero__source-name">${esc(c.name)}${exam ? `<small class="caption">${esc(exam.title)} ${daysLabel(daysUntil(exam.date))}</small>` : isArchived(c.id) ? `<small class="caption">Archived semester · keeping it fresh</small>` : ""}</span>${countPills(n, { compact: true })}<span class="hero__source-go">${icon("play", 14)}Study</span></a></li>`).join("")}</ul>` : ""}
        </section>
        <section class="card exams" aria-labelledby="exams-title">
          <div class="card__head"><h2 id="exams-title" class="heading">Upcoming exams</h2><a class="link" href="#/exams">Manage</a></div>
          ${exams.length ? `<ul class="exam-list">${exams.map((e) => { const n = daysUntil(e.date), cov = examCoverage(e), c = S.course(e.courseId);
            return `<li><a class="exam" href="#/exams"><div class="exam__date">${n === 0 ? `<span>Today</span>` : `<span>${n}</span><small>${n === 1 ? "day" : "days"}</small>`}</div>
              <div class="exam__body"><p class="exam__title">${esc(e.title)} · ${esc(c?.name || "")}</p><p class="caption">${fmtDate(e.date)}${cov ? ` · ${pct(cov.ratio)} of exam cards studied at least once` : " · no collections linked"}</p>${cov ? progressBar(cov.ratio, `${e.title} coverage`) : ""}</div></a></li>`; }).join("")}</ul>`
            : `<div class="exams-empty"><p class="caption">No exams yet. Add your exam dates, or import them from Canvas or Google Calendar.</p><div class="stack-h"><button class="btn btn--secondary btn--sm" data-action="open-exam-form">${icon("plus", 14)}Add exam</button><button class="btn btn--ghost btn--sm" data-action="open-calendar-import">${icon("upload", 14)}Import</button></div></div>`}
        </section>
        <section class="card home-recent" aria-labelledby="recent-title">
          <div class="card__head"><h2 id="recent-title" class="heading">Jump back in</h2><a class="link" href="#/library">Library</a></div>
          ${recent.length ? `<ul class="recent-list">${recent.map((d) => { const c = S.course(d.courseId), n = S.counts("deck:" + d.id); return `<li><a href="#/collection/${d.id}"><span class="dot dot--${c?.hue}"></span><span class="recent-list__main"><strong>${esc(d.title)}</strong><small>${esc(c?.name || "")} · ${esc(relTime(S.lastStudied([d.id])))}</small></span>${n.total ? `<span class="badge badge--warning">${n.total}</span>` : `<span class="badge badge--success">${icon("check", 12)}</span>`}</a></li>`; }).join("")}</ul>`
            : `<p class="caption">No collections yet. <button class="link" data-action="open-course-form">Create a course</button> to start.</p>`}
        </section>
      </div>`;
  }
  /* ======================================================================
     LIBRARY → SEMESTER → COURSE → UNIT → COLLECTION
     ====================================================================== */
  function collectionCard(d) {
    const c = S.course(d.courseId), u = d.unitId ? S.unit(d.unitId) : null, st = S.deckStats([d.id]), n = S.counts("deck:" + d.id);
    return `
      <article class="card collection-card">
        <a class="collection-card__link" href="#/collection/${d.id}" aria-label="${esc(d.title)}, ${esc(c?.name)}"></a>
        <div class="collection-card__top"><span class="chip chip--${c?.hue || "neutral"}">${esc(c?.name)}</span>${dueBadge(n)}</div>
        <h3 class="subhead">${esc(d.title)}</h3>
        <p class="caption">${esc([d.lecture, u?.name].filter(Boolean).join(" · ") || "No unit")}</p>
        <div class="collection-card__foot"><span class="caption">${plural(st.total, "card")}</span><span class="caption">${esc(relTime(S.lastStudied([d.id])))}</span></div>
      </article>`;
  }
  function viewLibrary() {
    return `
      <header class="page-header">
        <div><h1 class="title">My Library</h1><p class="lede">${plural(S.db.semesters.filter((x) => !x.archived).length, "active semester")} · ${plural(activeCourses().length, "course")} · ${S.db.cards.length.toLocaleString()} cards</p></div>
        <div class="page-header__actions">
          <button class="btn btn--ghost" data-action="open-import">${icon("upload", 16)}Import</button>
          <button class="btn btn--ghost" data-action="open-semester-form">${icon("folder", 16)}New semester</button>
          <button class="btn btn--secondary" data-action="open-deck-form">${icon("layers", 16)}New collection</button>
          <button class="btn btn--primary" data-action="open-course-form">${icon("plus", 16)}New course</button>
        </div>
      </header>
      <div class="toolbar" role="search">
        <label class="search">${icon("search", 16)}<span class="sr-only">Search your library</span>
          <input type="search" id="library-search" placeholder="Search courses, collections and cards…" value="${esc(state.libraryQuery)}" data-input="library-query" autocomplete="off"><kbd>/</kbd></label>
        <div class="toolbar__group">
          <label class="select"><span class="sr-only">Sort</span>${icon("sort", 14)}
            <select id="library-sort" data-change="library-sort">${[["recent", "Recently studied"], ["name", "Name A–Z"], ["due", "Most to study"], ["cards", "Most cards"]].map(([v, l]) => `<option value="${v}" ${state.librarySort === v ? "selected" : ""}>${l}</option>`).join("")}</select></label>
          <div class="segmented" role="group" aria-label="Layout">
            <button class="segmented__btn ${state.libraryView === "grid" ? "is-active" : ""}" aria-pressed="${state.libraryView === "grid"}" data-action="library-view" data-value="grid">${icon("grid", 16)}<span class="sr-only">Grid view</span></button>
            <button class="segmented__btn ${state.libraryView === "list" ? "is-active" : ""}" aria-pressed="${state.libraryView === "list"}" data-action="library-view" data-value="list">${icon("list", 16)}<span class="sr-only">List view</span></button>
          </div>
        </div>
      </div>
      <div id="library-results" aria-live="polite">${libraryResults()}</div>
      <p class="library-foot"><button class="link link--muted" data-action="reset-sample">${icon("refresh", 14)}Reset sample data</button></p>`;
  }
  function courseInfo(c) { const ids = S.scopeDeckIds("course:" + c.id); return { c, st: S.deckStats(ids), n: S.counts("course:" + c.id), last: S.lastStudied(ids), decks: ids.length }; }
  function coursesHtml(rows, { addTo = undefined } = {}) {
    if (state.libraryView === "list") return `
      <div class="table-wrap card"><table class="table">
        <thead><tr><th scope="col">Course</th><th scope="col">Collections</th><th scope="col">Cards</th><th scope="col">To study</th><th scope="col">Next exam</th><th scope="col">Last studied</th></tr></thead>
        <tbody>${rows.map(({ c, st, n, last, decks }) => `<tr data-href="#/course/${c.id}" tabindex="0"><th scope="row"><span class="dot dot--${c.hue}"></span><a href="#/course/${c.id}">${esc(c.name)}</a><small>${esc(c.code || "")}</small></th><td>${decks}</td><td>${st.total}</td><td>${countPills(n, { compact: true })}</td><td>${esc(nextExamLabel(c.id))}</td><td>${esc(relTime(last))}</td></tr>`).join("") || `<tr><td colspan="6" class="caption">No courses yet.</td></tr>`}</tbody>
      </table></div>`;
    return `<div class="course-grid">${rows.map(({ c, st, n, last, decks }) => `
      <article class="card course-card">
        <a class="course-card__link" href="#/course/${c.id}" aria-label="Open ${esc(c.name)}"></a>
        <div class="course-card__band course-card__band--${c.hue}"><span class="course-card__code">${esc(c.code || "")}</span></div>
        <div class="course-card__body">
          <h3 class="subhead">${esc(c.name)}</h3>
          <p class="caption">${plural(decks, "collection")} · ${plural(st.total, "card")}</p>
          <div class="course-card__status">${dueBadge(n)}${st.new ? `<span class="badge badge--neutral">${st.new} new</span>` : ""}</div>
          <div class="course-card__foot"><span class="caption">${icon("calendar", 12)} ${esc(nextExamLabel(c.id))}</span><span class="caption">${esc(relTime(last))}</span></div>
        </div>
      </article>`).join("")}
      ${addTo !== undefined ? `<button class="course-card course-card--add" data-action="open-course-form" data-semester="${addTo || ""}">${icon("plus", 22)}<span>New course</span></button>` : ""}
    </div>`;
  }
  function semesterBlock(sem) {
    const sorters = { recent: (a, b) => b.last - a.last, name: (a, b) => a.c.name.localeCompare(b.c.name), due: (a, b) => b.n.total - a.n.total, cards: (a, b) => b.st.total - a.st.total };
    const rows = S.coursesIn(sem ? sem.id : null).map(courseInfo).sort(sorters[state.librarySort]);
    if (!sem && !rows.length) return "";
    const n = sem ? S.counts("semester:" + sem.id) : null;
    const items = sem ? [
      { label: "Add course", icon: "plus", action: "open-course-form", data: { semester: sem.id } },
      { label: "Rename semester", icon: "edit", action: "open-semester-form", data: { id: sem.id } },
      sem.archived ? { label: "Move back to active", icon: "refresh", action: "semester-archive", data: { id: sem.id } } : { label: "Archive semester", icon: "folder", action: "semester-archive", data: { id: sem.id } },
      { label: sem.pauseReviews ? "Resume reviews" : "Pause reviews", icon: sem.pauseReviews ? "play" : "pause", action: "semester-pause", data: { id: sem.id } },
      "-", { label: "Delete semester", icon: "trash", action: "open-semester-form", data: { id: sem.id, del: 1 }, danger: true },
    ] : [];
    return `<section class="semester ${sem?.archived ? "is-archived" : ""}" aria-labelledby="sem-${sem?.id || "none"}">
      <header class="semester__head">
        <div class="semester__title"><span class="unit__icon">${icon("folder", 18)}</span><h2 id="sem-${sem?.id || "none"}" class="heading">${esc(sem ? sem.name : "Not in a semester")}</h2>
          <span class="caption">${plural(rows.length, "course")}</span>${sem?.pauseReviews ? `<span class="badge badge--neutral">${icon("pause", 12)}Reviews paused</span>` : ""}</div>
        ${sem ? `<div class="unit__actions">${n.total && !sem.pauseReviews ? `<span class="caption">${plural(n.total, "card")} to study</span>` : ""}${menu("sem-" + sem.id, items)}</div>` : ""}
      </header>
      ${rows.length || sem ? coursesHtml(rows, { addTo: sem && !sem.archived ? sem.id : undefined }) : ""}
    </section>`;
  }
  function libraryResults() {
    const q = state.libraryQuery.trim().toLowerCase();
    if (!S.db.courses.length && !S.db.semesters.length) return emptyState("Your library is empty", "Start with a semester, like “Fall 2026 · Year 1”, then add courses inside it.", `<div class="stack-h stack-h--center"><button class="btn btn--secondary" data-action="open-semester-form">${icon("folder", 16)}New semester</button><button class="btn btn--primary" data-action="open-course-form">${icon("plus", 16)}New course</button></div>`, "library");
    if (q) {
      const rows = S.db.courses.filter((c) => c.name.toLowerCase().includes(q) || (c.code || "").toLowerCase().includes(q)).map(courseInfo);
      const decks = S.db.decks.filter((d) => [d.title, d.topic, d.lecture, ...(d.tags || [])].join(" ").toLowerCase().includes(q));
      const notes = q.length > 2 ? S.db.notes.filter((n) => strip(Object.values(n.fields).flat().join(" ")).toLowerCase().includes(q)).slice(0, 12) : [];
      if (!rows.length && !decks.length && !notes.length) return emptyState("No matches", `Nothing in your library matches “${state.libraryQuery}”. Try a course code, lecture number or term.`, `<button class="btn btn--secondary" data-action="clear-library">Clear search</button>`);
      return `${rows.length ? `<h2 class="overline section-label">Courses</h2>${coursesHtml(rows)}` : ""}
        ${decks.length ? `<h2 class="overline section-label">Collections</h2><div class="collection-grid">${decks.map(collectionCard).join("")}</div>` : ""}
        ${notes.length ? `<h2 class="overline section-label">Cards</h2><ul class="row-list card">${notes.map((n) => { const d = S.deck(n.deckId); const c0 = S.db.cards.find((c) => c.noteId === n.id); return `<li><a class="row" href="#/builder/${n.deckId}?note=${n.id}"><span class="row__icon">${icon("study", 18)}</span><span class="row__main"><strong>${esc(c0 ? cardFaces(c0, n).q : "")}</strong><small>${esc(d ? deckLabel(d) : "")}</small></span>${icon("chevronRight", 16, "row__chev")}</a></li>`; }).join("")}</ul>` : ""}`;
    }
    const sems = S.semesterList(), active = sems.filter((x) => !x.archived), archived = sems.filter((x) => x.archived);
    return `${active.map(semesterBlock).join("")}${semesterBlock(null)}
      ${archived.length ? `<details class="archive" ${state.collapsed.__archive ? "open" : ""} data-archive>
        <summary><span class="unit__icon">${icon("folder", 18)}</span><span class="heading">Archived</span><span class="caption">${plural(archived.length, "semester")} · ${plural(archived.reduce((n, x) => n + S.coursesIn(x.id).length, 0), "course")} · their cards still come up for review unless paused</span>${icon("chevronDown", 16, "archive__chev")}</summary>
        <div class="archive__body">${archived.map(semesterBlock).join("")}</div></details>` : ""}`;
  }

  function deckRow(d) {
    const n = S.counts("deck:" + d.id), st = S.deckStats([d.id]);
    return `<li class="deck-row">
      <a class="deck-row__main" href="#/collection/${d.id}"><span class="row__icon">${icon("layers", 18)}</span>
        <span class="row__main"><strong>${esc(d.title)}</strong><small>${esc([d.lecture, plural(st.total, "card")].filter(Boolean).join(" · "))}</small></span></a>
      <span class="deck-row__meta">${d.source !== "original" ? sourceBadge(d.source) : ""}${countPills(n)}</span>
      <a class="btn btn--secondary btn--sm ${n.total ? "" : "is-quiet"}" href="#/study/${d.id}" aria-label="Study ${esc(d.title)}">${icon("play", 14)}Study</a>
    </li>`;
  }
  function viewCourse(id) {
    const c = S.course(id); if (!c) return viewNotFound();
    const units = S.unitsOf(id), loose = S.decksOf(id, null), all = S.counts("course:" + id), st = S.deckStats(S.scopeDeckIds("course:" + id));
    const unitBlock = (u) => {
      const decks = S.decksOf(id, u.id), n = S.counts("unit:" + u.id);
      return `<section class="unit card" aria-labelledby="unit-${u.id}">
        <header class="unit__head">
          <div class="unit__title"><span class="unit__icon">${icon("folder", 18)}</span><h2 id="unit-${u.id}" class="subhead">${esc(u.name)}</h2><span class="caption">${plural(decks.length, "collection")}</span></div>
          <div class="unit__actions">${countPills(n)}
            <a class="btn btn--primary btn--sm ${n.total ? "" : "is-quiet"}" href="#/study/unit-${u.id}">${icon("play", 14)}Study unit</a>
            ${menu("unit-" + u.id, [{ label: "Add collection", icon: "plus", action: "open-deck-form", data: { course: id, unit: u.id } }, { label: "Practice quiz on unit", icon: "target", action: "go", data: { href: `#/quiz/unit-${u.id}` } }, { label: "Rename unit", icon: "edit", action: "open-unit-form", data: { id: u.id } }, "-", { label: "Delete unit", icon: "trash", action: "open-unit-form", data: { id: u.id, del: 1 }, danger: true }])}
          </div>
        </header>
        ${decks.length ? `<ul class="deck-list">${decks.map(deckRow).join("")}</ul>` : `<div class="unit__empty"><p class="caption">No collections in this unit yet.</p><button class="btn btn--secondary btn--sm" data-action="open-deck-form" data-course="${id}" data-unit="${u.id}">${icon("plus", 14)}Add collection</button></div>`}
      </section>`;
    };
    return `
      ${breadcrumb([...courseCrumbs(c), { label: c.name }])}
      <header class="page-header">
        <div><p class="overline">${esc([c.code, c.term].filter(Boolean).join(" · "))}${isArchived(id) ? " · Archived" : ""}</p><h1 class="title">${esc(c.name)}</h1>
          <p class="lede">${plural(units.length, "unit")} · ${plural(S.scopeDeckIds("course:" + id).length, "collection")} · ${plural(st.total, "card")} · Next: ${esc(nextExamLabel(id))}</p></div>
        <div class="page-header__actions">
          <button class="btn btn--ghost" data-action="open-unit-form" data-course="${id}">${icon("folder", 16)}New unit</button>
          <button class="btn btn--secondary" data-action="open-deck-form" data-course="${id}">${icon("plus", 16)}New collection</button>
          <a class="btn btn--primary ${all.total ? "" : "is-quiet"}" href="#/study/course-${id}">${icon("play", 16)}Study course${all.total ? ` · ${all.total}` : ""}</a>
          ${menu("course-" + id, [{ label: "Edit course", icon: "edit", action: "open-course-form", data: { id } }, { label: "Review settings", icon: "settings", action: "open-options", data: { course: id } }, { label: "Practice quiz on course", icon: "target", action: "go", data: { href: `#/quiz/course-${id}` } }, "-", { label: "Delete course", icon: "trash", action: "open-course-form", data: { id, del: 1 }, danger: true }])}
        </div>
      </header>
      <div class="course-body">
        ${units.map(unitBlock).join("")}
        ${loose.length ? `<section class="unit card"><header class="unit__head"><div class="unit__title"><span class="unit__icon">${icon("layers", 18)}</span><h2 class="subhead">Not in a unit</h2></div></header><ul class="deck-list">${loose.map(deckRow).join("")}</ul></section>` : ""}
        ${!units.length && !loose.length ? emptyState("This course is empty", "Organize it the way your program does: add units (like “Unit 2 · Neuroanatomy”), then a collection for each lecture.", `<div class="stack-h stack-h--center"><button class="btn btn--secondary" data-action="open-unit-form" data-course="${id}">${icon("folder", 16)}New unit</button><button class="btn btn--primary" data-action="open-deck-form" data-course="${id}">${icon("plus", 16)}New collection</button></div>`, "folder") : ""}
      </div>`;
  }

  function viewCollection(id) {
    const d = S.deck(id); if (!d) return viewNotFound();
    const c = S.course(d.courseId), u = d.unitId ? S.unit(d.unitId) : null;
    const n = S.counts("deck:" + id), st = S.deckStats([id]);
    return `
      ${breadcrumb([...courseCrumbs(c), { label: c.name, href: `#/course/${c.id}` }, ...(u ? [{ label: u.name, href: `#/course/${c.id}` }] : []), { label: d.title }])}
      <header class="page-header page-header--collection">
        <div>
          <div class="meta-row">${sourceBadge(d.source)}${d.sourceOf ? `<span class="caption">copied from ${esc(d.sourceOf)}</span>` : ""}</div>
          <h1 class="title">${esc(d.title)}</h1>
          ${d.description ? `<p class="lede lede--wide">${esc(d.description)}</p>` : ""}
        </div>
        <div class="page-header__actions">
          <button class="btn btn--ghost" data-action="open-share" data-id="${id}">${icon("share", 16)}Share</button>
          <a class="btn btn--secondary" href="#/builder/${id}">${icon("plus", 16)}Add card</a>
          <a class="btn btn--primary ${n.total ? "" : "is-quiet"}" href="#/study/${id}">${icon("play", 16)}${n.total ? `Study · ${n.total}` : "Study"}</a>
          ${menu("deck-" + id, [{ label: "Edit details", icon: "edit", action: "open-deck-form", data: { id } }, { label: "Review settings", icon: "settings", action: "open-options", data: { course: d.courseId } }, { label: "Practice quiz", icon: "target", action: "go", data: { href: `#/quiz/${id}` } }, "-", { label: "Delete collection", icon: "trash", action: "open-deck-form", data: { id, del: 1 }, danger: true }])}
        </div>
      </header>
      <div class="collection-layout">
        <div class="collection-main">
          <section class="card modes" aria-label="Study this collection">
            <div class="mode-grid mode-grid--two">
              <a class="mode mode--primary" href="#/study/${id}">${icon("refresh", 20)}<strong>Spaced review</strong>
                <small>${n.total ? `${n.new} new · ${n.learn} learning · ${n.review} review` : `Nothing due. ${st.total ? "Cards come back on schedule." : "Add cards to start."}`}</small></a>
              <a class="mode" href="#/quiz/${id}">${icon("target", 20)}<strong>Practice quiz</strong><small>Multiple choice and true/false from these cards. Doesn’t change your schedule.</small></a>
            </div>
          </section>
          <section class="card" aria-labelledby="cards-title">
            <div class="card__head"><h2 id="cards-title" class="heading">Cards <span class="count">${st.total}</span></h2><a class="btn btn--secondary btn--sm" href="#/builder/${id}">${icon("plus", 14)}Add card</a></div>
            <div id="browser">${cardBrowser(id)}</div>
          </section>
        </div>
        <aside class="collection-aside">
          <section class="card details" aria-labelledby="details-title">
            <h2 id="details-title" class="overline">Details</h2>
            <dl class="dl">
              <div><dt>Course</dt><dd><a class="link" href="#/course/${c.id}">${esc(c.name)}</a></dd></div>
              <div><dt>Unit</dt><dd>${esc(u?.name || "Not in a unit")}</dd></div>
              ${d.lecture ? `<div><dt>Lecture</dt><dd>${esc(d.lecture)}</dd></div>` : ""}
              ${d.topic ? `<div><dt>Topic</dt><dd>${esc(d.topic)}</dd></div>` : ""}
              <div><dt>Cards</dt><dd>${st.total} · ${st.new} new · ${st.learning} learning · ${st.review} review${st.suspended ? ` · ${st.suspended} suspended` : ""}</dd></div>
              ${st.retention != null ? `<div><dt>Est. retention</dt><dd>${pct(st.retention)}</dd></div>` : ""}
              <div><dt>Last modified</dt><dd>${new Date(d.modified).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</dd></div>
            </dl>
            ${d.creator ? `<div class="creator">${avatar(d.creator.initials)}<div><p class="body-strong">${esc(d.creator.name)}</p><p class="caption">${esc(d.creator.role || "Creator")}</p></div></div>` : ""}
            ${d.tags?.length ? `<div class="tag-row">${d.tags.map((t) => `<span class="tag">#${esc(t)}</span>`).join("")}</div>` : ""}
          </section>
          <section class="card" aria-labelledby="sharing-title">
            <div class="card__head"><h2 id="sharing-title" class="overline">Sharing</h2><button class="link" data-action="open-share" data-id="${id}">Share</button></div>
            <p class="caption personal-note">${icon("lock", 14)}<span>This collection is yours. Only you can edit it, and your schedule and progress are private.</span></p>
            ${d.copies ? `<p class="caption"><strong>People with their own copy</strong></p><ul class="people">${d.copies.map((p) => `<li>${avatar(p.initials, "sm", p.group ? "avatar--group" : "")}<span>${esc(p.name)}<small>${esc(p.status)}</small></span></li>`).join("")}</ul>` : `<p class="caption">Not shared yet.</p>`}
            ${d.sourceOf ? `<div class="lineage"><p class="caption"><strong>Where this came from</strong></p><ol class="lineage__list"><li><span class="lineage__dot"></span>${esc(d.sourceOf)}</li><li class="is-current"><span class="lineage__dot"></span>Your copy${d.edits ? ` · ${d.edits.cards} reworded, ${d.edits.added} added` : ""}</li></ol>${d.id === "hna-cn" ? `<p class="caption">2 changes published yesterday. <button class="link" data-action="review-update">Review suggestions</button></p>` : ""}</div>` : ""}
          </section>
        </aside>
      </div>`;
  }

  /* Anki-style browser: one row per card, filter by state, search. */
  function cardBrowser(deckId) {
    const b = state.browse;
    const cards = S.db.cards.filter((c) => c.deckId === deckId);
    const notesById = new Map(S.db.notes.map((n) => [n.id, n]));
    const sections = [...new Set(cards.map((c) => notesById.get(c.noteId)?.section).filter(Boolean))];
    const filters = {
      all: () => true, due: (c) => !c.suspended && c.sched.state !== "new" && c.sched.due <= S.endOfDay(),
      new: (c) => c.sched.state === "new", learning: (c) => c.sched.state === "learning" || c.sched.state === "relearning",
      review: (c) => c.sched.state === "review", suspended: (c) => c.suspended, flagged: (c) => c.flag > 0,
      leech: (c) => notesById.get(c.noteId)?.tags.includes("leech"),
    };
    const q = b.q.trim().toLowerCase();
    const rows = cards.filter((c) => {
      const n = notesById.get(c.noteId);
      if (!filters[b.filter](c)) return false;
      if (b.section !== "All" && n.section !== b.section) return false;
      return !q || strip([...Object.values(n.fields).flat(), ...(n.tags || [])].join(" ")).toLowerCase().includes(q);
    });
    if (!cards.length) return emptyState("No cards yet", "Add your first card. Pick a template, type the question and answer, and you’re done.", `<a class="btn btn--primary" href="#/builder/${deckId}">${icon("plus", 16)}Add card</a>`, "study");
    const fc = (k) => cards.filter(filters[k]).length;
    return `
      <div class="browser__tools">
        <label class="search search--sm">${icon("search", 14)}<span class="sr-only">Search cards</span><input type="search" id="browse-search" placeholder="Search cards and tags" value="${esc(b.q)}" data-input="browse-q" autocomplete="off"></label>
        <div class="filter-chips" role="group" aria-label="Filter cards">${[["all", "All"], ["due", "Due"], ["new", "New"], ["learning", "Learning"], ["review", "Review"], ["suspended", "Suspended"], ["flagged", "Flagged"], ["leech", "Leeches"]].filter(([k]) => k === "all" || fc(k)).map(([k, l]) => `<button class="tab ${b.filter === k ? "is-active" : ""}" aria-pressed="${b.filter === k}" data-action="browse-filter" data-value="${k}">${l} <span>${fc(k)}</span></button>`).join("")}</div>
      </div>
      ${sections.length > 1 ? `<div class="section-tabs" role="group" aria-label="Sections">${["All", ...sections].map((s) => `<button class="tab tab--ghost ${b.section === s ? "is-active" : ""}" aria-pressed="${b.section === s}" data-action="browse-section" data-value="${esc(s)}">${esc(s)}</button>`).join("")}</div>` : ""}
      <ul class="card-list">${rows.length ? rows.map((c) => {
        const n = notesById.get(c.noteId), f = cardFaces(c, n), due = dueLabel(c);
        return `<li class="card-row ${c.suspended ? "is-suspended" : ""}">
          <a class="card-row__link" href="#/builder/${deckId}?note=${n.id}" aria-label="Edit card: ${esc(f.q.slice(0, 80))}"></a>
          <span class="card-row__type">${esc(TYPE_LABEL[n.type])}${S.cardOrds(n).length > 1 ? ` · ${n.type === "cloze" ? "c" + c.ord : n.type === "reverse" ? (c.ord ? "back" : "front") : "#" + (c.ord + 1)}` : ""}</span>
          <div class="card-row__body"><p class="card-row__front">${n.type === "cloze" ? clozeHtml(n.fields.text, c.ord, "front") : esc(f.q)}</p><p class="card-row__back">${esc(f.a)}</p></div>
          <div class="card-row__meta">${c.flag ? `<span class="flag" title="Flagged">${icon("flag", 14)}</span>` : ""}<span class="badge badge--${due.tone}">${esc(due.text)}</span>
            ${menu("card-" + c.id, [{ label: "Edit", icon: "edit", action: "go", data: { href: `#/builder/${deckId}?note=${n.id}` } }, { label: c.suspended ? "Unsuspend" : "Suspend", icon: "pause", action: "card-suspend", data: { id: c.id } }, { label: c.flag ? "Remove flag" : "Flag", icon: "flag", action: "card-flag", data: { id: c.id } }, { label: "Reset to new", icon: "refresh", action: "card-reset", data: { id: c.id } }, "-", { label: "Delete note", icon: "trash", action: "note-delete", data: { id: n.id }, danger: true }])}
          </div>
        </li>`; }).join("") : `<li class="card-list__empty caption">No cards match this filter.</li>`}</ul>`;
  }

  /* ======================================================================
     CARD EDITOR (add + edit)
     ====================================================================== */
  const TEMPLATES = [
    { id: "basic", name: "Basic", desc: "Question on the front, answer on the back.", best: "Facts, definitions" },
    { id: "reverse", name: "Basic + reversed", desc: "Two cards: front → back and back → front.", best: "Terms both ways" },
    { id: "cloze", name: "Cloze deletion", desc: "Hide words in a sentence. Each hidden part is its own card.", best: "Pathways, lists" },
    { id: "occlusion", name: "Image occlusion", desc: "Hide labels on a diagram and recall them.", best: "Anatomy, foramina" },
  ];
  const blankFields = () => ({ basic: { front: "", back: "", extra: "", points: "" }, reverse: { front: "", back: "", extra: "" }, cloze: { text: "", extra: "" }, occlusion: { prompt: "Identify the masked foramen.", masked: [], extra: "" } });
  function startBuilder(deckId, noteId) {
    const n = noteId ? S.note(noteId) : null;
    const fields = blankFields();
    if (n) fields[n.type] = JSON.parse(JSON.stringify(n.fields));
    const lastDeck = prefs.get("lastDeck", null);
    const fallbackDeck = deckId && S.deck(deckId) ? deckId : (lastDeck && S.deck(lastDeck) ? lastDeck : S.db.decks.find((d) => !isArchived(d.courseId))?.id || S.db.decks[0]?.id || null);
    state.builder = { key: `${deckId}|${noteId || ""}`, noteId: n?.id || null, deckId: n?.deckId || fallbackDeck, type: n?.type || prefs.get("lastType", "basic"), fields, tags: (n?.tags || []).filter((t) => t !== "leech").join(", "), section: n?.section ?? prefs.get("lastSection:" + fallbackDeck, ""), side: "front", previewOrd: null, advanced: !!n, added: 0, confirmDelete: false };
  }
  function viewBuilder(deckId, query) {
    const noteId = query.get("note");
    const key = `${deckId}|${noteId || ""}`;
    if (!state.builder || state.builder.key !== key) startBuilder(deckId, noteId);
    const b = state.builder;
    if (!S.db.decks.length || !S.deck(b.deckId)) return emptyState("Create a collection first", "Cards live in collections. Make one inside a course, then add cards to it.", `<button class="btn btn--primary" data-action="open-deck-form">${icon("plus", 16)}New collection</button>`, "layers");
    const d = S.deck(b.deckId), c = S.course(d.courseId);
    const editing = !!b.noteId, n = editing ? S.note(b.noteId) : null;
    if (editing && !n) return viewNotFound();
    const cards = editing ? S.db.cards.filter((x) => x.noteId === b.noteId) : [];
    const sections = [...new Set(S.db.notes.filter((x) => x.deckId === b.deckId).map((x) => x.section).filter(Boolean))];
    return `
      ${breadcrumb([...courseCrumbs(c), { label: c.name, href: `#/course/${c.id}` }, { label: d.title, href: `#/collection/${d.id}` }, { label: editing ? "Edit card" : "Add card" }])}
      <header class="page-header">
        <div><h1 class="title">${editing ? "Edit card" : "Add card"}</h1>
          <p class="lede">${editing ? `${esc(TYPE_LABEL[b.type])} · ${plural(cards.length, "card")} from this note` : b.added ? `${plural(b.added, "card")} added this session` : "Pick a template, fill it in, save. No formatting code needed."}</p></div>
        <div class="page-header__actions">
          <button class="btn btn--ghost" data-action="builder-done">${editing ? "Cancel" : "Done"}</button>
          <button class="btn btn--primary" data-action="builder-save">${icon("check", 16)}${editing ? "Save changes" : "Add card"} <kbd class="kbd-inline">⌘↵</kbd></button>
        </div>
      </header>
      <div class="builder-deck">
        <label class="field field--inline"><span class="field__label">Collection</span>
          <select id="builder-deck" data-change="builder-deck">${S.db.courses.map((co) => { const ds = S.db.decks.filter((x) => x.courseId === co.id); return ds.length ? `<optgroup label="${esc(co.name)}${isArchived(co.id) ? " (archived)" : ""}">${ds.map((x) => `<option value="${x.id}" ${x.id === b.deckId ? "selected" : ""}>${esc([x.unitId ? S.unit(x.unitId)?.name : "", x.title].filter(Boolean).join(" › "))}</option>`).join("")}</optgroup>` : ""; }).join("")}</select></label>
        <button class="link" data-action="open-deck-form" data-course="${d.courseId}">${icon("plus", 14)}New collection</button>
      </div>
      ${editing ? "" : `<section aria-labelledby="tpl-title"><h2 id="tpl-title" class="overline section-label">Template</h2>
        <div class="template-grid template-grid--four" role="radiogroup" aria-label="Card template">${TEMPLATES.map((t) => `
          <button class="template ${b.type === t.id ? "is-selected" : ""}" role="radio" aria-checked="${b.type === t.id}" data-action="builder-template" data-value="${t.id}">
            <span class="template__art">${templateArt(t.id)}</span><span class="template__name">${esc(t.name)}</span><span class="template__desc">${esc(t.desc)}</span><span class="template__best">Best for ${esc(t.best.toLowerCase())}</span></button>`).join("")}</div></section>`}
      <div class="builder">
        <section class="card builder__form" aria-labelledby="fields-title">
          <h2 id="fields-title" class="heading">Content</h2>
          <div id="builder-fields">${builderFields()}</div>
          <p class="field__error" id="form-error" role="alert" hidden></p>
          <div class="disclosure ${b.advanced ? "is-open" : ""}">
            <button class="disclosure__btn" aria-expanded="${b.advanced}" aria-controls="adv-panel" data-action="builder-advanced">${icon("settings", 16)}<span>Tags and section</span><small>Optional</small>${icon("chevronDown", 16, "disclosure__chev")}</button>
            <div id="adv-panel" class="disclosure__panel" ${b.advanced ? "" : "hidden"}>
              <div class="field-row">
                <label class="field"><span class="field__label">Section</span><input id="b-section" list="section-list" value="${esc(b.section)}" data-input="builder-meta" data-key="section" placeholder="e.g. Oculomotor (CN III)"><datalist id="section-list">${sections.map((s) => `<option value="${esc(s)}">`).join("")}</datalist><span class="field__hint">Groups cards inside the collection.</span></label>
                <label class="field"><span class="field__label">Tags</span><input id="b-tags" value="${esc(b.tags)}" data-input="builder-meta" data-key="tags" placeholder="high-yield, clinical"><span class="field__hint">Separate with commas.</span></label>
              </div>
            </div>
          </div>
          ${editing ? `<div class="note-info">
            <h3 class="overline">Review history</h3>
            <ul class="note-info__cards">${cards.map((x) => { const due = dueLabel(x); return `<li><span>${n.type === "cloze" ? "Card c" + x.ord : n.type === "reverse" ? (x.ord ? "Back → front" : "Front → back") : n.type === "occlusion" ? esc(n.fields.masked[x.ord] || "Card") : "Card"}</span><span class="caption">${x.sched.reps} reviews · ${x.sched.lapses} lapses${x.sched.state === "review" ? ` · stability ${x.sched.s.toFixed(1)}d` : ""}</span><span class="badge badge--${due.tone}">${esc(due.text)}</span></li>`; }).join("")}</ul>
            <div class="stack-h">${b.confirmDelete
              ? `<span class="caption">Delete this note and its ${plural(cards.length, "card")}? Their review history goes too.</span><button class="btn btn--ghost btn--sm" data-action="builder-delete-cancel">Keep</button><button class="btn btn--danger-solid btn--sm" data-action="builder-delete">Delete</button>`
              : `<button class="btn btn--ghost btn--sm btn--danger" data-action="builder-delete-ask">${icon("trash", 14)}Delete note</button><button class="btn btn--ghost btn--sm" data-action="builder-reset">${icon("refresh", 14)}Reset to new</button>`}</div>
          </div>` : ""}
        </section>
        <section class="builder__preview" aria-labelledby="preview-title">
          <div class="builder__preview-head"><h2 id="preview-title" class="overline">Live preview</h2>
            <div class="segmented segmented--text" role="group" aria-label="Preview side">
              <button class="segmented__btn ${b.side === "front" ? "is-active" : ""}" aria-pressed="${b.side === "front"}" data-action="builder-side" data-value="front">Front</button>
              <button class="segmented__btn ${b.side === "back" ? "is-active" : ""}" aria-pressed="${b.side === "back"}" data-action="builder-side" data-value="back">Back</button>
            </div></div>
          <div id="builder-preview" aria-live="polite">${builderPreview()}</div>
        </section>
      </div>`;
  }
  const templateArt = (id) => ({ basic: `<span class="ta ta-basic"><i></i><i></i></span>`, reverse: `<span class="ta ta-rev"><i></i><b></b></span>`, cloze: `<span class="ta ta-cloze"><i></i><b></b><i></i></span>`, occlusion: `<span class="ta ta-occ"><i></i><b></b><b></b></span>` }[id]);
  function builderFields() {
    const b = state.builder, f = b.fields[b.type];
    const field = (key, label, { area = false, rows = 3, hint = "", placeholder = "" } = {}) => `
      <label class="field"><span class="field__label">${label}</span>
        ${area ? `<textarea rows="${rows}" id="bf-${key}" data-input="builder" data-key="${key}" placeholder="${esc(placeholder)}">${esc(f[key])}</textarea>` : `<input id="bf-${key}" data-input="builder" data-key="${key}" value="${esc(f[key])}" placeholder="${esc(placeholder)}">`}
        ${hint ? `<span class="field__hint">${hint}</span>` : ""}</label>`;
    switch (b.type) {
      case "basic": return field("front", "Front", { area: true, placeholder: "Which nerve innervates the lateral rectus?" }) + field("back", "Back", { area: true, rows: 2, placeholder: "Abducens nerve (CN VI)" }) +
        field("points", "Key points <small>optional</small>", { hint: "For answers with several parts. Separate with commas; while reviewing you tick the ones you recalled.", placeholder: "e.g. Ptosis, Miosis, Anhidrosis" }) +
        field("extra", "Extra <small>optional</small>", { area: true, rows: 2, hint: "Shown after the answer: mnemonics, clinical pearls, sources." });
      case "reverse": return field("front", "Front", { area: true, placeholder: "Abducens nerve (CN VI)" }) + field("back", "Back", { area: true, rows: 2, placeholder: "Innervates the lateral rectus" }) + field("extra", "Extra <small>optional</small>", { area: true, rows: 2 });
      case "cloze": {
        const nums = S.clozeNums(normalizeCloze(f.text || ""));
        return `<label class="field"><span class="field__label">Text</span><textarea rows="4" id="cloze-text" data-input="builder" data-key="text" placeholder="The superior oblique is innervated by the trochlear nerve.">${esc(f.text)}</textarea>
          <span class="field__hint">Select words, then <button class="btn btn--secondary btn--xs" data-action="cloze-wrap">Hide as new card</button> or <button class="btn btn--ghost btn--xs" data-action="cloze-wrap" data-same="1">Hide in same card</button>.<span class="cloze-count"> ${nums.length ? `This makes ${plural(nums.length, "card")}.` : "Nothing hidden yet."}</span></span></label>` +
          field("extra", "Extra <small>optional</small>", { area: true, rows: 2 });
      }
      case "occlusion": return field("prompt", "Prompt") + `<div class="field"><span class="field__label">Diagram</span><div class="occ-editor">${occlusionSvg({ masked: f.masked, interactive: true })}</div>
        <span class="field__hint">${icon("image", 12)} Skull base, internal view (schematic). Select the labels to hide: ${plural(f.masked.length, "hidden label")} → ${plural(f.masked.length, "card")}. Uploading your own images is coming next.</span></div>` + field("extra", "Extra <small>optional</small>", { area: true, rows: 2 });
    }
    return "";
  }
  function builderNote() {
    const b = state.builder, f = JSON.parse(JSON.stringify(b.fields[b.type]));
    if (b.type === "cloze") f.text = normalizeCloze(f.text || "");
    return { id: b.noteId || "preview", deckId: b.deckId, type: b.type, fields: f, tags: [], section: b.section };
  }
  function builderPreview() {
    const b = state.builder, n = builderNote(), ords = S.cardOrds(n);
    if (!ords.length) return `<div class="flashcard flashcard--preview"><div class="flashcard__body"><p class="caption">${b.type === "cloze" ? "Hide at least one part of the text to make a card." : "Select at least one label to hide."}</p></div></div>`;
    const ord = ords.includes(b.previewOrd) ? b.previewOrd : ords[0];
    const faces = cardFaces({ noteId: n.id, ord }, n), pts = notePoints({ ord }, n), empty = !strip(faces.q).trim();
    return `
      ${ords.length > 1 ? `<div class="preview-ords" role="group" aria-label="Preview card">${ords.map((o, i) => `<button class="tab ${o === ord ? "is-active" : ""}" data-action="builder-ord" data-value="${o}">Card ${i + 1}</button>`).join("")}</div>` : ""}
      <div class="flashcard flashcard--preview">
        <div class="flashcard__meta"><span class="chip chip--lavender">${esc(TYPE_LABEL[b.type])}</span><span class="caption">${b.side === "back" ? "Back" : "Front"}</span></div>
        <div class="flashcard__body">${empty ? `<p class="fc__prompt muted">Your question appears here</p>` : b.side === "back" ? faces.back : faces.front}
          ${b.side === "back" && pts.length > 1 ? `<div class="checklist"><p class="checklist__title"><span class="overline">What did you recall?</span><span class="caption">0 of ${pts.length} key points</span></p><div class="checklist__points">${pts.map((p) => `<span class="point">${icon("plus", 14)}${esc(p)}</span>`).join("")}</div></div>` : ""}</div>
      </div>
      <p class="caption builder__count">${icon("layers", 14)} ${b.noteId ? "Saves" : "Adds"} ${plural(ords.length, "card")} to ${esc(S.deck(b.deckId)?.title || "")}</p>`;
  }
  function saveBuilder() {
    const b = state.builder, n = builderNote();
    const err = b.type === "cloze" ? (!S.clozeNums(n.fields.text).length && "Hide at least one word or phrase. Select it and use “Hide as new card”.")
      : b.type === "occlusion" ? (!n.fields.masked.length && "Select at least one label on the diagram to hide.")
      : (!n.fields.front.trim() ? "Add the front of the card." : !n.fields.back.trim() ? "Add the back of the card." : "");
    if (err) { formError(err, b.type === "cloze" ? $("#cloze-text") : b.type === "occlusion" ? null : (!n.fields.front.trim() ? $("#bf-front") : $("#bf-back"))); return; }
    const tags = b.tags.split(",").map((t) => t.trim()).filter(Boolean);
    if (b.noteId && S.note(b.noteId)?.tags.includes("leech")) tags.push("leech");
    const saved = S.saveNote({ ...(b.noteId ? { id: b.noteId } : {}), deckId: b.deckId, type: b.type, fields: n.fields, tags, section: b.section.trim() });
    const count = S.cardOrds(saved).length;
    prefs.set("lastType", b.type); prefs.set("lastDeck", b.deckId); prefs.set("lastSection:" + b.deckId, b.section.trim());
    if (b.noteId) {
      toast("Card saved", { tone: "success" });
      state.builder = null;
      const r = state.returnTo; state.returnTo = null;
      navigate(r || `#/collection/${saved.deckId}`);
      return;
    }
    b.added += count; b.fields[b.type] = blankFields()[b.type];
    render();
    toast(`Added ${plural(count, "card")} to ${S.deck(b.deckId).title}`, { tone: "success", action: "Undo", onAction: () => { S.removeNote(saved.id); b.added -= count; render(); toast("Removed"); } });
    $("#builder-fields textarea, #builder-fields input")?.focus();
  }

  /* ======================================================================
     STUDY (deck tree) + SESSION
     ====================================================================== */
  function viewStudyHub() {
    const all = S.counts("all");
    const row = (level, label, scope, extra = "", href = null, note = "") => {
      const n = S.counts(scope);
      return `<tr class="tree__row tree__row--${level} ${n.total ? "" : "is-done"}">
        <th scope="row">${extra}${href ? `<a href="${href}">${esc(label)}</a>` : `<span>${esc(label)}</span>`}${note}</th>
        <td class="num cnt-col cnt-col--new">${n.new}</td><td class="num cnt-col cnt-col--learn">${n.learn}</td><td class="num cnt-col cnt-col--review">${n.review}</td>
        <td class="tree__go">${level === "sem" ? "" : `<a class="btn btn--${level === "course" ? "primary" : "secondary"} btn--sm ${n.total ? "" : "is-quiet"}" href="#/study/${toParam(scope)}" aria-label="Study ${esc(label)}">${icon("play", 14)}Study</a>`}</td></tr>`;
    };
    const toggle = (key, label, open) => `<button class="tree__toggle" data-action="tree-toggle" data-id="${key}" aria-expanded="${open}" aria-label="${open ? "Collapse" : "Expand"} ${esc(label)}">${icon(open ? "chevronDown" : "chevronRight", 16)}</button>`;
    const courseRows = (c, depth) => {
      const open = !state.collapsed[c.id];
      let html = row("course", c.name, "course:" + c.id, `${"<span class='tree__indent'></span>".repeat(depth)}${toggle(c.id, c.name, open)}<span class="dot dot--${c.hue}"></span>`, `#/course/${c.id}`);
      if (!open) return html;
      for (const u of S.unitsOf(c.id)) {
        html += row("unit", u.name, "unit:" + u.id, `${"<span class='tree__indent'></span>".repeat(depth + 1)}${icon("folder", 15)}`);
        for (const d of S.decksOf(c.id, u.id)) html += row("deck", d.title, "deck:" + d.id, "<span class='tree__indent'></span>".repeat(depth + 2), `#/collection/${d.id}`);
      }
      for (const d of S.decksOf(c.id, null)) html += row("deck", d.title, "deck:" + d.id, "<span class='tree__indent'></span>".repeat(depth + 1), `#/collection/${d.id}`);
      return html;
    };
    const sems = S.semesterList().filter((x) => !x.pauseReviews);
    const semRows = (sem) => {
      const key = "sem-" + sem.id, open = state.collapsed[key] === undefined ? !sem.archived : !state.collapsed[key];
      let html = row("sem", sem.name, "semester:" + sem.id, toggle(key, sem.name, open), null, sem.archived ? ` <span class="badge badge--neutral">Archived</span>` : "");
      if (open) for (const c of S.coursesIn(sem.id)) html += courseRows(c, 1);
      return html;
    };
    const tree = sems.map(semRows).join("") + S.coursesIn(null).map((c) => courseRows(c, 0)).join("");
    const pausedN = S.semesterList().filter((x) => x.pauseReviews).length;
    return `
      <header class="page-header"><div><h1 class="title">Study</h1><p class="lede">Reviews happen one course at a time. Study a whole course, one unit, or a single collection.</p></div></header>
      <section class="card hero hero--compact"><div class="hero__main">
        <p class="overline">Due today</p>
        <h2 class="hero__count">${all.total ? `<span class="num">${all.total}</span> ${all.total === 1 ? "card" : "cards"} across ${plural(courseQueue().length, "course")}` : "All caught up"}</h2>
        ${courseQueue()[0] ? `<p class="hero__meta">${countPills(courseQueue()[0].n)}<span>${esc(courseQueue()[0].c.name)} is up next${courseQueue()[0].exam ? `, with ${esc(courseQueue()[0].exam.title)} ${daysLabel(daysUntil(courseQueue()[0].exam.date))}` : ""}.</span></p>
        <div class="hero__actions"><a class="btn btn--primary btn--lg" href="#/study/course-${courseQueue()[0].c.id}">${icon("play", 16)}Start ${esc(courseQueue()[0].c.name)}</a></div>` : ""}
      </div></section>
      ${S.db.courses.length ? `<div class="table-wrap card tree-wrap"><table class="table tree">
        <thead><tr><th scope="col">Course › Unit › Collection</th><th scope="col" class="cnt-col cnt-col--new">New</th><th scope="col" class="cnt-col cnt-col--learn">Learn</th><th scope="col" class="cnt-col cnt-col--review">Due</th><th scope="col"><span class="sr-only">Study</span></th></tr></thead>
        <tbody>${tree}</tbody></table></div>` : emptyState("Nothing to study yet", "Create a course and add cards to it first.", `<button class="btn btn--primary" data-action="open-course-form">New course</button>`, "study")}
      ${prototypeNote(`Counts follow each course’s daily limits (default 20 new and 200 reviews a day), set in a course’s Review settings.${pausedN ? ` ${plural(pausedN, "semester")} with paused reviews ${pausedN === 1 ? "is" : "are"} hidden.` : ""}`)}`;
  }

  function startSession(param) {
    const scope = toScope(param);
    state.session = { param, scope, startedAt: Date.now(), cardId: S.nextCard(scope)?.id || null, revealed: false, checked: [], shownAt: Date.now(), history: [], answered: [], paused: false, showKeys: prefs.get("showKeys", true), finished: false };
    if (!state.session.cardId) state.session.finished = true;
  }
  function viewSession(param) {
    if (!state.session || state.session.param !== param) startSession(param);
    const s = state.session;
    if (s.scope !== "all" && !S.scopeDeckIds(s.scope).length) return viewNotFound();
    if (s.finished) return viewSummary();
    const c = S.card(s.cardId);
    if (!c) { advance(); return viewSession(param); }
    const n = S.note(c.noteId), d = S.deck(c.deckId), faces = cardFaces(c, n), counts = S.counts(s.scope);
    const prev = S.preview(c), pts = notePoints(c, n);
    const kind = c.sched.state === "new" ? "new" : c.sched.state === "review" ? "review" : "learn";
    const sug = s.revealed && pts.length > 1 ? (s.checked.length === 0 ? "again" : s.checked.length < pts.length ? "hard" : "good") : null;
    return `
      <div class="session ${s.paused ? "is-paused" : ""}">
        <header class="session__bar">
          <button class="icon-btn" data-action="session-exit" aria-label="Exit session">${icon("x", 18)}</button>
          <div class="session__progress">
            <div class="session__title"><span>${esc(S.scopeLabel(s.scope))}</span>
              <span class="session__counts" aria-label="Remaining: ${counts.new} new, ${counts.learn} learning, ${counts.review} review">
                <span class="cnt cnt--new ${kind === "new" ? "is-current" : ""}">${counts.new}</span><span class="cnt cnt--learn ${kind === "learn" ? "is-current" : ""}">${counts.learn}</span><span class="cnt cnt--review ${kind === "review" ? "is-current" : ""}">${counts.review}</span></span></div>
            ${progressBar(s.answered.length / Math.max(1, s.answered.length + counts.total), "Session progress", "progress--thin")}
          </div>
          <button class="icon-btn" data-action="session-undo" aria-label="Undo last rating" ${s.history.length ? "" : "disabled"} title="Undo (⌘Z)">${icon("undo", 18)}</button>
          <button class="icon-btn" data-action="session-pause" aria-label="${s.paused ? "Resume" : "Pause"} session">${icon(s.paused ? "play" : "pause", 18)}</button>
        </header>
        <main class="session__stage">
          <article class="flashcard flashcard--study ${s.revealed ? "is-revealed" : ""}" aria-live="polite">
            <div class="flashcard__meta">
              <span class="caption">${esc(d.title)}${n.section ? ` · ${esc(n.section)}` : ""}${c.sched.state === "new" ? ` · <span class="tag tag--new">New</span>` : c.sched.state === "relearning" ? ` · <span class="tag tag--learn">Relearning</span>` : ""}</span>
              <span class="flashcard__tools">
                <button class="icon-btn icon-btn--sm" data-action="session-edit" aria-label="Edit this card" title="Edit (E)">${icon("edit", 16)}</button>
                <button class="icon-btn icon-btn--sm ${c.flag ? "is-on" : ""}" data-action="session-flag" aria-pressed="${!!c.flag}" aria-label="Flag card" title="Flag (F)">${icon("flag", 16)}</button>
                ${menu("session-card", [{ label: "Bury until tomorrow", icon: "eyeOff", action: "session-bury" }, { label: "Suspend card", icon: "pause", action: "session-suspend" }])}
              </span>
            </div>
            <div class="flashcard__body">${s.revealed ? faces.back : faces.front}
              ${s.revealed && pts.length > 1 ? `<div class="checklist" role="group" aria-labelledby="checklist-title">
                <p class="checklist__title" id="checklist-title"><span class="overline">What did you recall?</span><span class="caption">${s.checked.length} of ${pts.length} key points</span></p>
                <div class="checklist__points">${pts.map((p, i) => `<button class="point ${s.checked.includes(i) ? "is-on" : ""}" data-action="check-point" data-index="${i}" aria-pressed="${s.checked.includes(i)}">${icon(s.checked.includes(i) ? "check" : "plus", 14)}${esc(p)}</button>`).join("")}</div>
                <p class="caption">Suggested rating: <strong class="checklist__sug checklist__sug--${sug}">${sug[0].toUpperCase() + sug.slice(1)}</strong>. You make the final call.</p></div>` : ""}
            </div>
          </article>
        </main>
        <footer class="session__controls">
          ${s.revealed ? `
            <div class="ratings" role="group" aria-label="How well did you recall it?">
              ${[["again", "Again", "Didn’t recall", 1], ["hard", "Hard", "Recalled with effort", 2], ["good", "Good", "Recalled", 3], ["easy", "Easy", "Instant recall", 4]].map(([k, l, desc, num]) => `
                <button class="rating rating--${k} ${sug === k ? "is-suggested" : ""}" data-action="rate" data-value="${num}">
                  ${sug === k ? `<span class="rating__sug">Suggested</span>` : ""}
                  <span class="rating__label">${l}</span><span class="rating__desc">${desc}</span><span class="rating__next">${fmtIvl(prev[k])}</span>${s.showKeys ? `<kbd>${num}</kbd>` : ""}</button>`).join("")}
            </div>
            <p class="caption session__explain"><button class="link" data-action="explain-scheduling">${icon("info", 12)} How scheduling works</button><span class="session__explain-extra"> · times show when you’ll see this card next</span></p>`
            : `<button class="btn btn--primary btn--xl" data-action="reveal">Show answer ${s.showKeys ? "<kbd>Space</kbd>" : ""}</button><p class="caption">Recall the answer before revealing.</p>`}
          <div class="session__keys"><button class="link link--muted" data-action="toggle-keys" aria-pressed="${s.showKeys}">${icon("keyboard", 14)} ${s.showKeys ? "Hide" : "Show"} shortcuts</button>
            ${s.showKeys ? `<span class="caption">Space show/Good · 1–4 rate · E edit · F flag · − bury · @ suspend · ⌘Z undo · Esc exit</span>` : ""}</div>
        </footer>
        ${s.paused ? `<div class="session__pause" role="dialog" aria-modal="true" aria-label="Session paused"><div class="card pause-card"><h2 class="heading">Paused</h2><p class="caption">${plural(s.answered.length, "card")} reviewed. Progress is saved after every card.</p>
          <div class="stack-h"><button class="btn btn--primary" data-action="session-pause" autofocus>${icon("play", 16)}Resume</button><button class="btn btn--ghost" data-action="session-end">End session</button></div></div></div>` : ""}
      </div>`;
  }
  function advance(excludeId = null) {
    const s = state.session;
    const next = S.nextCard(s.scope, Date.now(), excludeId);
    s.cardId = next?.id || null; s.revealed = false; s.checked = []; s.shownAt = Date.now();
    if (!next) s.finished = true;
  }
  function rate(g) {
    const s = state.session; if (!s || !s.revealed || s.paused || s.finished) return;
    const res = S.answer(s.cardId, g, Date.now() - s.shownAt);
    s.history.push(res); s.answered.push({ cardId: s.cardId, grade: g });
    if (res.leech) { const lc = S.card(res.entry.cardId); toast("This card keeps slipping, so it’s tagged as a leech. Consider rewording it.", { action: "Edit", onAction: () => { state.returnTo = currentRoute; navigate(`#/builder/${lc.deckId}?note=${lc.noteId}`); } }); }
    advance(res.entry.cardId);
    render();
  }
  function undoLast() {
    const s = state.session; if (!s || !s.history.length) return;
    const step = s.history.pop(); s.answered.pop(); S.undo(step);
    Object.assign(s, { finished: false, cardId: step.entry.cardId, revealed: false, checked: [], shownAt: Date.now() });
    render(); toast("Undid last rating");
  }
  function viewSummary() {
    const s = state.session;
    const counts = { 1: 0, 2: 0, 3: 0, 4: 0 };
    s.answered.forEach((a) => counts[a.grade]++);
    const total = s.answered.length, unique = new Set(s.answered.map((a) => a.cardId)).size;
    const minutes = Math.max(1, Math.round((Date.now() - s.startedAt) / 60000));
    const weak = {};
    s.answered.filter((a) => a.grade <= 2).forEach((a) => { const c = S.card(a.cardId); if (!c) return; const k = S.note(c.noteId).section || S.deck(c.deckId).title; weak[k] = (weak[k] || 0) + 1; });
    const ids = new Set(S.scopeDeckIds(s.scope));
    const later = S.counts(s.scope).learnLater;
    const nextLearn = S.db.cards.filter((c) => ids.has(c.deckId) && (c.sched.state === "learning" || c.sched.state === "relearning") && !c.suspended).sort((a, b) => a.sched.due - b.sched.due)[0];
    const tomorrowCount = S.db.cards.filter((c) => ids.has(c.deckId) && !c.suspended && c.sched.state === "review" && S.startOfDay(c.sched.due) === TODAY + DAY).length;
    const label = { 1: "Again", 2: "Hard", 3: "Good", 4: "Easy" }, cls = { 1: "again", 2: "hard", 3: "good", 4: "easy" };
    const nextExam = upcomingExams()[0];
    const thisCourse = (() => { const [k, id] = s.scope.split(":"); return k === "course" ? id : k === "unit" ? S.unit(id)?.courseId : k === "deck" ? S.deck(id)?.courseId : null; })();
    const nextCourse = courseQueue(thisCourse)[0];
    if (!total) return `<div class="summary"><div class="summary__inner">
        <div class="summary__icon">${icon("check", 28)}</div>
        <h1 class="title">Nothing to study in ${esc(S.scopeLabel(s.scope))} right now</h1>
        <p class="lede">${later && nextLearn ? `${plural(later, "learning card")} ${later === 1 ? "comes" : "come"} back in ${fmtIvl(Math.max(60000, nextLearn.sched.due - Date.now()))}.` : tomorrowCount ? `${plural(tomorrowCount, "card")} ${tomorrowCount === 1 ? "is" : "are"} due tomorrow.` : "You’re up to date. New cards appear here as you add them."}</p>
        <div class="stack-h stack-h--center"><a class="btn btn--primary btn--lg" href="#/home" data-action="session-done">Back to Home</a><a class="btn btn--secondary btn--lg" href="#/builder${s.scope.startsWith("deck:") ? "/" + s.scope.slice(5) : ""}">${icon("plus", 16)}Add cards</a></div>
      </div></div>`;
    return `
      <div class="summary"><div class="summary__inner">
        <div class="summary__icon">${icon("check", 28)}</div>
        <h1 class="title">Session complete</h1>
        <p class="lede">You studied ${plural(unique, "card")} (${plural(total, "rating")}) in about ${plural(minutes, "minute")}. Each card has been rescheduled.</p>
        <section class="card summary__stats" aria-label="Ratings breakdown">
          <div class="stacked-bar" role="img" aria-label="Again ${counts[1]}, Hard ${counts[2]}, Good ${counts[3]}, Easy ${counts[4]}">${[1, 2, 3, 4].map((g) => counts[g] ? `<span class="stacked-bar__seg rating-bg--${cls[g]}" style="flex:${counts[g] / total}"></span>` : "").join("")}</div>
          <ul class="legend">${[1, 2, 3, 4].map((g) => `<li><span class="legend__swatch rating-bg--${cls[g]}"></span>${label[g]} <strong>${counts[g]}</strong></li>`).join("")}</ul>
        </section>
        <div class="summary__grid">
          <section class="card"><h2 class="heading">Needs more practice</h2>
            ${Object.keys(weak).length ? `<ul class="weak-list">${Object.entries(weak).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<li><span>${esc(k)}</span><span class="badge badge--warning">${v} missed or hard</span></li>`).join("")}</ul><p class="caption">These come back sooner, automatically.</p>` : `<p class="caption">Nothing rated Again or Hard this session.</p>`}</section>
          <section class="card"><h2 class="heading">What’s next</h2><ul class="next-list">
            ${later && nextLearn ? `<li><span>${plural(later, "learning card")}</span><span class="caption">in ${fmtIvl(Math.max(60000, nextLearn.sched.due - Date.now()))}</span></li>` : ""}
            <li><span>Due tomorrow</span><span class="caption">${plural(tomorrowCount, "card")}</span></li>
            ${nextExam ? `<li><span>${esc(nextExam.title)} · ${esc(S.course(nextExam.courseId)?.name || "")}</span><span class="caption">${daysLabel(daysUntil(nextExam.date))}</span></li>` : ""}
          </ul></section>
        </div>
        ${prototypeNote("Scheduling uses FSRS-5 with its default parameters and Anki-style learning steps (1m, 10m), the same model modern Anki offers.")}
        <div class="stack-h stack-h--center">${nextCourse ? `<a class="btn btn--primary btn--lg" href="#/study/course-${nextCourse.c.id}" data-action="session-done">${icon("play", 16)}Next: ${esc(nextCourse.c.name)} · ${nextCourse.n.total}</a><a class="btn btn--ghost btn--lg" href="#/home" data-action="session-done">Back to Home</a>` : `<a class="btn btn--primary btn--lg" href="#/home" data-action="session-done">Back to Home</a>`}${later ? `<button class="btn btn--secondary btn--lg" data-action="session-continue">${icon("refresh", 16)}Keep going</button>` : ""}</div>
      </div></div>`;
  }

  /* ======================================================================
     PRACTICE QUIZ — generated only from the student's own cards
     ====================================================================== */
  const norm = (t) => String(t).toLowerCase().replace(/[.\s]+$/g, "").trim();
  function shuffle(arr, seed) { const a = [...arr]; let x = seed || 1; const rnd = () => ((x = (x * 9301 + 49297) % 233280) / 233280); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  const cleanAns = (a) => String(a).replace(/\.$/, "").trim();
  function buildQuiz(scope, opts) {
    const ids = new Set(S.scopeDeckIds(scope));
    const courseIds = new Set(S.db.decks.filter((d) => ids.has(d.id)).map((d) => d.courseId));
    const inScope = S.db.notes.filter((n) => ids.has(n.deckId));
    const wide = S.db.notes.filter((n) => courseIds.has(S.deck(n.deckId)?.courseId));
    const answersOf = (list) => list.flatMap((n) => n.type === "basic" || n.type === "reverse" ? [{ a: cleanAns(n.fields.back) }] : n.type === "cloze" ? [...n.fields.text.matchAll(/\{\{c\d+::(.+?)(::|\}\})/g)].map((m) => ({ a: m[1] })) : n.type === "occlusion" ? n.fields.masked.map((a) => ({ a })) : []);
    const poolScope = answersOf(inScope), poolWide = answersOf(wide);
    const distractors = (correct, kind, seed) => {
      const close = (pool) => pool.filter((p) => norm(p.a) !== norm(correct) && p.a.length < correct.length * 2.6 + 8 && correct.length < p.a.length * 2.6 + 8);
      const occ = kind === "occlusion" ? FORAMINA.map((f) => ({ a: f.name })).filter((p) => p.a !== correct) : [];
      let pool = [...new Map([...occ, ...close(poolScope), ...close(poolWide)].map((p) => [norm(p.a), p.a])).values()];
      pool = pool.sort((a, b) => Math.abs(a.length - correct.length) - Math.abs(b.length - correct.length)).slice(0, 8);
      return shuffle(pool, seed).slice(0, 3);
    };
    const qs = [];
    inScope.forEach((n, i) => {
      const seed = (opts.seed || 7) + i * 17;
      if (!S.db.cards.some((c) => c.noteId === n.id)) return;
      if (n.type === "cloze") {
        const m = [...n.fields.text.matchAll(/\{\{c(\d+)::(.+?)(?:::.+?)?\}\}/g)][0]; if (!m) return;
        const ans = m[2], others = distractors(ans, "cloze", seed);
        if (opts.tf && (!opts.mcq || i % 2 === 1) && others.length) {
          const truthful = i % 4 !== 3, shown = truthful ? ans : others[0];
          qs.push({ kind: "tf", prompt: strip(n.fields.text.replace(m[0], shown)), options: ["True", "False"], answer: truthful ? 0 : 1, note: n, correction: truthful ? null : ans });
        } else if (opts.mcq && others.length >= 3) { const options = shuffle([ans, ...others], seed + 3); qs.push({ kind: "mcq", prompt: strip(n.fields.text.replace(m[0], "_____")), options, answer: options.indexOf(ans), note: n }); }
      } else if (n.type === "occlusion") {
        if (!opts.mcq) return;
        const ans = n.fields.masked[0], others = distractors(ans, "occlusion", seed);
        if (others.length >= 3) { const options = shuffle([ans, ...others], seed); qs.push({ kind: "mcq", prompt: n.fields.prompt, diagram: ans, options, answer: options.indexOf(ans), note: n }); }
      } else {
        const ans = cleanAns(n.fields.back), others = distractors(ans, "basic", seed);
        if (opts.mcq && others.length >= 3) { const options = shuffle([ans, ...others], seed); qs.push({ kind: "mcq", prompt: n.fields.front, options, answer: options.indexOf(ans), note: n }); }
      }
    });
    const out = shuffle(qs, opts.seed || 7);
    return opts.count === "all" ? out : out.slice(0, +opts.count);
  }
  function quizBackHref(scope) { const [k, id] = scope.split(":"); return k === "deck" ? `#/collection/${id}` : k === "course" ? `#/course/${id}` : k === "unit" ? `#/course/${S.unit(id)?.courseId}` : "#/library"; }
  function viewQuiz(param) {
    const scope = toScope(param);
    if (!S.scopeDeckIds(scope).length) return viewNotFound();
    if (!state.quiz || state.quiz.param !== param) state.quiz = { param, scope, stage: "setup", opts: { mcq: true, tf: true, count: "10", seed: 7 } };
    const q = state.quiz;
    if (q.stage === "done") return viewQuizResults(q);
    if (q.stage === "run") return viewQuizQuestion(q);
    const preview = buildQuiz(scope, q.opts), allN = buildQuiz(scope, { ...q.opts, count: "all" }).length;
    return `
      ${breadcrumb([{ label: "My Library", href: "#/library" }, { label: S.scopeLabel(scope), href: quizBackHref(scope) }, { label: "Practice quiz" }])}
      <header class="page-header"><div><h1 class="title">Practice quiz</h1><p class="lede">Built instantly from your cards in <strong>${esc(S.scopeLabel(scope))}</strong>. Every question links back to its card. Quizzes check recognition and never change your review schedule.</p></div></header>
      <div class="quiz-setup">
        <section class="card quiz-setup__form" aria-labelledby="qs-title">
          <h2 id="qs-title" class="heading">Set up your quiz</h2>
          <fieldset class="field"><legend class="field__label">Question types</legend><div class="choice-row">
            <label class="chip-check"><input type="checkbox" id="q-mcq" data-change="quiz-opt" data-key="mcq" ${q.opts.mcq ? "checked" : ""}><span>${icon("check", 14)}Multiple choice</span></label>
            <label class="chip-check"><input type="checkbox" id="q-tf" data-change="quiz-opt" data-key="tf" ${q.opts.tf ? "checked" : ""}><span>${icon("check", 14)}True / false</span></label></div></fieldset>
          <fieldset class="field"><legend class="field__label">Length</legend><div class="choice-row">${[["5", "5"], ["10", "10"], ["all", `All (${allN})`]].map(([v, l]) => `<label class="chip-radio"><input type="radio" name="qcount" id="q-count-${v}" data-change="quiz-opt" data-key="count" value="${v}" ${q.opts.count === v ? "checked" : ""}><span>${l}</span></label>`).join("")}</div></fieldset>
          <div class="stack-h"><button class="btn btn--primary btn--lg" data-action="quiz-start" ${preview.length ? "" : "disabled"}>${icon("play", 16)}Start quiz · ${plural(preview.length, "question")}</button><button class="btn btn--ghost btn--lg" data-action="quiz-shuffle">${icon("refresh", 16)}Shuffle</button></div>
          ${preview.length ? "" : `<p class="caption">Not enough cards yet. A question needs three other answers in the same course to use as wrong options.</p>`}
        </section>
        <aside class="quiz-how card"><h2 class="overline">How questions are made</h2>
          <ul class="how-list">
            <li>${icon("layers", 16)}<span><strong>From your cards only.</strong> The correct answer is your card’s answer. Nothing is invented.</span></li>
            <li>${icon("target", 16)}<span><strong>Plausible wrong options</strong> come from other answers in this course.</span></li>
            <li>${icon("clock", 16)}<span><strong>Instant.</strong> Built on your device.</span></li>
            <li>${icon("info", 16)}<span><strong>Missed questions</strong> can go straight to today’s review.</span></li>
          </ul></aside>
      </div>`;
  }
  function viewQuizQuestion(q) {
    const item = q.qs[q.i], total = q.qs.length, correct = q.checked && q.picked === item.answer;
    const c0 = S.db.cards.find((c) => c.noteId === item.note.id), faces = c0 ? cardFaces(c0, item.note) : { q: "", a: "" };
    return `
      <div class="session quiz">
        <header class="session__bar">
          <button class="icon-btn" data-action="quiz-exit" aria-label="Exit quiz">${icon("x", 18)}</button>
          <div class="session__progress"><div class="session__title"><span>Practice quiz · ${esc(S.scopeLabel(q.scope))}</span><span class="caption">Question ${q.i + 1} of ${total}</span></div>${progressBar((q.i + (q.checked ? 1 : 0)) / total, "Quiz progress", "progress--thin")}</div>
          <span class="badge badge--neutral quiz__score">${q.results.filter((r) => r.correct).length} correct</span>
        </header>
        <main class="session__stage"><article class="flashcard flashcard--study quiz-card">
          <div class="flashcard__meta"><span class="chip chip--${item.kind === "mcq" ? "lavender" : "sage"}">${item.kind === "mcq" ? "Multiple choice" : "True or false"}</span><span class="caption">${esc(S.deck(item.note.deckId)?.title || "")}</span></div>
          <div class="flashcard__body">
            <p class="fc__prompt">${esc(item.prompt)}</p>
            ${item.diagram ? occlusionSvg({ target: item.diagram, reveal: q.checked }) : ""}
            <ol class="mcq mcq--interactive ${item.kind === "tf" ? "mcq--tf" : ""}">${item.options.map((o, i) => {
              const cls = q.checked ? (i === item.answer ? "is-correct" : i === q.picked ? "is-wrong" : "") : (i === q.picked ? "is-picked" : "");
              return `<li><button class="mcq__opt ${cls}" data-action="quiz-pick" data-index="${i}" ${q.checked ? "disabled" : ""} aria-pressed="${i === q.picked}"><span>${item.kind === "tf" ? (i === 0 ? "T" : "F") : String.fromCharCode(65 + i)}</span>${esc(o)}${q.checked && i === item.answer ? `<em>${icon("check", 14)}Correct answer</em>` : ""}${q.checked && i === q.picked && i !== item.answer ? `<em>${icon("x", 14)}Your answer</em>` : ""}</button></li>`; }).join("")}</ol>
            ${q.checked ? `<div class="quiz-feedback quiz-feedback--${correct ? "ok" : "miss"}" role="status"><strong>${correct ? "Correct" : "Not quite"}</strong>${item.correction ? `<span>The statement should read “${esc(item.correction)}”.</span>` : ""}</div>
              <div class="source-card"><p class="overline">${icon("layers", 12)} From your card</p><p class="body-strong">${item.note.type === "cloze" ? clozeHtml(item.note.fields.text, 0, "all") : esc(faces.q)}</p>${item.note.type !== "cloze" ? `<p class="caption">${esc(faces.a)}</p>` : ""}${item.note.fields.extra ? `<p class="caption">${esc(item.note.fields.extra)}</p>` : ""}</div>` : ""}
          </div></article></main>
        <footer class="session__controls">${q.checked ? `<button class="btn btn--primary btn--xl" data-action="quiz-next" autofocus>${q.i + 1 < total ? "Next question" : "See results"} <kbd>↵</kbd></button>` : `<button class="btn btn--primary btn--xl" data-action="quiz-check" ${q.picked == null ? "disabled" : ""}>Check answer <kbd>↵</kbd></button><p class="caption">Press ${item.kind === "tf" ? "T or F" : "A–D or 1–4"} to choose.</p>`}</footer>
      </div>`;
  }
  function viewQuizResults(q) {
    const right = q.results.filter((r) => r.correct).length, missed = q.results.filter((r) => !r.correct);
    return `<div class="summary"><div class="summary__inner">
      <div class="summary__icon">${icon("target", 26)}</div><h1 class="title">${right} of ${q.results.length} correct</h1>
      <p class="lede">Practice quiz · ${esc(S.scopeLabel(q.scope))}. Quiz results don’t change your review schedule.</p>
      <section class="card quiz-results"><h2 class="heading">${missed.length ? "Review what you missed" : "Nothing missed"}</h2>
        ${missed.length ? `<ul class="missed-list">${missed.map((r) => `<li><span class="badge badge--danger">${icon("x", 12)}Missed</span><div><p class="body-strong">${esc(r.item.prompt)}</p><p class="caption">Answer: ${esc(r.item.options[r.item.answer])} · ${esc(S.deck(r.item.note.deckId)?.title || "")}</p></div></li>`).join("")}</ul>
          <div class="stack-h"><button class="btn btn--primary" data-action="quiz-to-review">${icon("refresh", 16)}Study ${plural(missed.length, "missed card")} now</button><button class="btn btn--secondary" data-action="quiz-retake-missed">Retake missed</button></div>` : `<p class="caption">Every answer correct.</p>`}
      </section>
      <div class="stack-h stack-h--center"><a class="btn btn--ghost btn--lg" href="${quizBackHref(q.scope)}">Back</a><button class="btn btn--secondary btn--lg" data-action="quiz-again">${icon("refresh", 16)}New quiz</button></div>
    </div></div>`;
  }
  function quizCheck() { const q = state.quiz; if (!q || q.checked || q.picked == null) return; q.checked = true; const item = q.qs[q.i]; q.results.push({ item, correct: q.picked === item.answer }); render(); $("[data-action='quiz-next']")?.focus(); }
  function quizNext() { const q = state.quiz; if (!q || !q.checked) return; if (q.i + 1 >= q.qs.length) q.stage = "done"; else { q.i++; q.picked = null; q.checked = false; } render(); }

  /* ======================================================================
     EXAMS
     ====================================================================== */
  const EXAM_KINDS = ["Exam", "Quiz", "Midterm", "Final", "Practical", "OSCE"];
  function loadExams() {
    const saved = prefs.get("exams:v3", null);
    if (Array.isArray(saved)) return saved;
    return SEED.exams.map(({ offset, ...e }) => ({ ...e, date: isoDate(new Date(TODAY + offset * DAY)) }));
  }
  const saveExams = () => prefs.set("exams:v3", state.exams);
  const byDate = (a, b) => a.date.localeCompare(b.date) || (a.time || "").localeCompare(b.time || "");
  const upcomingExams = () => state.exams.filter((e) => daysUntil(e.date) >= 0 && S.course(e.courseId)).sort(byDate);
  const pastExams = () => state.exams.filter((e) => daysUntil(e.date) < 0).sort((a, b) => byDate(b, a));
  function examCoverage(e) {
    const cols = (e.collections || []).map(S.deck).filter(Boolean);
    const st = S.deckStats(cols.map((c) => c.id));
    return st.total ? { cards: st.total, seen: st.seen, ratio: st.seen / st.total, cols } : null;
  }
  function nextExamLabel(courseId) { const e = upcomingExams().find((x) => x.courseId === courseId); return e ? `${e.title} · ${fmtDate(e.date, { month: "short", day: "numeric" })}` : "No exam scheduled"; }
  function viewExams() {
    const up = upcomingExams(), past = pastExams();
    return `
      <header class="page-header"><div><h1 class="title">Exams</h1><p class="lede">Your quizzes, exams and practicals. Link each one to the collections it covers to see how much of that material you’ve studied.</p></div>
        <div class="page-header__actions"><button class="btn btn--secondary" data-action="open-calendar-import">${icon("upload", 16)}Import from calendar</button><button class="btn btn--primary" data-action="open-exam-form">${icon("plus", 16)}Add exam</button></div></header>
      ${up.length ? `<h2 class="overline section-label">Upcoming · ${up.length}</h2><ul class="exam-cards">${up.map(examCard).join("")}</ul>`
        : `<div class="card exams-empty exams-empty--page">${icon("calendar", 22)}<h2 class="subhead">No upcoming exams</h2><p class="caption">Add an exam yourself, or import your schedule from a Canvas or Google Calendar export.</p><div class="stack-h"><button class="btn btn--primary" data-action="open-exam-form">${icon("plus", 16)}Add exam</button><button class="btn btn--secondary" data-action="open-calendar-import">${icon("upload", 16)}Import from calendar</button></div></div>`}
      ${past.length ? `<details class="past-exams"><summary class="overline">Past · ${past.length}</summary><ul class="exam-cards">${past.map(examCard).join("")}</ul></details>` : ""}
      ${prototypeNote("Calendar import reads a .ics file you export from Canvas or Google Calendar. Automatic syncing needs sign-in to those services and comes with accounts.")}`;
  }
  function examCard(e) {
    const c = S.course(e.courseId), n = daysUntil(e.date), cov = examCoverage(e);
    const when = n < 0 ? `${-n} ${-n === 1 ? "day" : "days"} ago` : n === 0 ? "Today" : n === 1 ? "Tomorrow" : `In ${n} days`;
    const studyHref = cov && cov.cols.length === 1 ? `#/study/${cov.cols[0].id}` : cov ? `#/study/course-${e.courseId}` : null;
    return `<li class="card exam-card ${n < 0 ? "is-past" : ""} ${n >= 0 && n <= 7 ? "is-soon" : ""}">
      <div class="exam-card__date" aria-hidden="true"><span class="exam-card__month">${fmtDate(e.date, { month: "short" })}</span><span class="exam-card__day">${parseISO(e.date).getDate()}</span><span class="exam-card__dow">${fmtDate(e.date, { weekday: "short" })}</span></div>
      <div class="exam-card__body">
        <div class="exam-card__top"><span class="chip chip--${c?.hue || "neutral"}">${esc(c?.name || "Course removed")}</span><span class="badge badge--neutral">${esc(e.kind)}</span>${e.source === "calendar" ? `<span class="badge badge--sage">${icon("calendar", 12)}From calendar</span>` : ""}</div>
        <h3 class="subhead">${esc(e.title)}</h3>
        <p class="caption"><strong class="exam-card__when">${when}</strong> · ${fmtDate(e.date, { weekday: "long", month: "long", day: "numeric" })}${e.time ? ` · ${fmtTime(e.time)}` : ""}</p>
        ${cov ? `<div class="exam-card__cov"><p class="caption">${pct(cov.ratio)} of ${cov.cards} cards studied at least once</p>${progressBar(cov.ratio, `${e.title} coverage`)}<div class="tag-row">${cov.cols.map((x) => `<a class="tag tag--link" href="#/collection/${x.id}">${esc(x.title)}</a>`).join("")}</div></div>`
          : `<p class="caption">No collections linked. <button class="link" data-action="open-exam-form" data-id="${e.id}">Link collections</button> to track coverage.</p>`}
      </div>
      <div class="exam-card__actions">${n >= 0 && studyHref ? `<a class="btn btn--primary btn--sm" href="${studyHref}">${icon("play", 14)}Review</a>` : ""}<button class="btn btn--ghost btn--sm" data-action="open-exam-form" data-id="${e.id}" aria-label="Edit ${esc(e.title)}">${icon("edit", 14)}Edit</button></div>
    </li>`;
  }
  function examColsHtml(courseId, selected) {
    const cols = S.db.decks.filter((c) => c.courseId === courseId);
    if (!cols.length) return `<p class="caption">This course has no collections yet.</p>`;
    return `<div class="check-list">${cols.map((c) => `<label class="check-row"><input type="checkbox" name="exam-col" value="${c.id}" ${selected.includes(c.id) ? "checked" : ""}><span><strong>${esc(c.title)}</strong><small>${esc([c.unitId ? S.unit(c.unitId)?.name : "", plural(S.deckStats([c.id]).total, "card")].filter(Boolean).join(" · "))}</small></span></label>`).join("")}</div>`;
  }
  function openExamForm(id) {
    if (!S.db.courses.length) { toast("Create a course first, then add its exams."); return; }
    const ex = id ? state.exams.find((e) => e.id === id) : null;
    const d = ex || { title: "", kind: "Exam", courseId: activeCourses()[0]?.id || S.db.courses[0].id, date: isoDate(new Date(TODAY + 7 * DAY)), time: "", collections: null };
    const selected = d.collections || S.db.decks.filter((c) => c.courseId === d.courseId).map((c) => c.id);
    openModal(`
      <header class="modal__head"><h2 class="heading">${ex ? "Edit exam" : "Add exam"}</h2><button class="icon-btn" data-action="close-modal" aria-label="Close">${icon("x", 18)}</button></header>
      <form class="modal__body" id="exam-form" novalidate>
        <label class="field"><span class="field__label">Name</span><input id="exam-title" value="${esc(d.title)}" placeholder="e.g. Exam 3, Quiz 6, Lab practical 2" autofocus autocomplete="off"></label>
        <div class="field-row"><label class="field"><span class="field__label">Course</span><select id="exam-course">${S.db.courses.map((c) => `<option value="${c.id}" ${c.id === d.courseId ? "selected" : ""}>${esc(c.name)}</option>`).join("")}</select></label>
          <label class="field"><span class="field__label">Type</span><select id="exam-kind">${EXAM_KINDS.map((k) => `<option ${k === d.kind ? "selected" : ""}>${k}</option>`).join("")}</select></label></div>
        <div class="field-row"><label class="field"><span class="field__label">Date</span><input type="date" id="exam-date" value="${esc(d.date)}"></label><label class="field"><span class="field__label">Time <small>optional</small></span><input type="time" id="exam-time" value="${esc(d.time || "")}"></label></div>
        <fieldset class="field"><legend class="field__label">Collections this exam covers</legend><div id="exam-cols">${examColsHtml(d.courseId, selected)}</div><span class="field__hint">Kivo uses these to show how much of the exam material you’ve studied.</span></fieldset>
        <p class="field__error" id="form-error" role="alert" hidden></p>
      </form>
      <footer class="modal__foot">${ex ? `<button class="btn btn--ghost btn--danger" data-action="exam-delete" data-id="${ex.id}">Delete</button>` : ""}<button class="btn btn--ghost" data-action="close-modal">Cancel</button><button class="btn btn--primary" data-action="exam-save" data-id="${ex ? ex.id : ""}">${ex ? "Save changes" : "Add exam"}</button></footer>`,
      { label: ex ? "Edit exam" : "Add exam", onMount: (m) => {
        $("#exam-course", m).addEventListener("change", (e) => { $("#exam-cols", m).innerHTML = examColsHtml(e.target.value, S.db.decks.filter((c) => c.courseId === e.target.value).map((c) => c.id)); });
        $("#exam-form", m).addEventListener("submit", (e) => { e.preventDefault(); saveExamFromForm(ex?.id || null); });
      } });
  }
  function saveExamFromForm(id) {
    const title = $("#exam-title").value.trim(), date = $("#exam-date").value;
    if (!title) return formError("Give the exam a name, like “Exam 3”.", $("#exam-title"));
    if (!date) return formError("Choose the exam date.", $("#exam-date"));
    const data = { title, date, kind: $("#exam-kind").value, courseId: $("#exam-course").value, time: $("#exam-time").value, collections: $$("input[name='exam-col']:checked").map((i) => i.value) };
    if (id) Object.assign(state.exams.find((e) => e.id === id), data); else state.exams.push({ id: "ex-" + Date.now().toString(36), source: "manual", ...data });
    saveExams(); closeModal(true); render(); toast(id ? "Exam updated" : `Added ${title} on ${fmtDate(date)}`, { tone: "success" });
  }
  const unescapeICS = (v) => v.replace(/\\n/gi, " ").replace(/\\([,;\\])/g, "$1").trim();
  function parseICS(text) {
    const lines = text.replace(/\r\n?/g, "\n").replace(/\n[ \t]/g, "").split("\n");
    const events = []; let cur = null;
    for (const line of lines) {
      if (line === "BEGIN:VEVENT") { cur = {}; continue; }
      if (line === "END:VEVENT") { if (cur && cur.summary && cur.date) events.push(cur); cur = null; continue; }
      if (!cur) continue;
      const i = line.indexOf(":"); if (i < 0) continue;
      const key = line.slice(0, i).split(";")[0].toUpperCase(), val = line.slice(i + 1);
      if (key === "SUMMARY") cur.summary = unescapeICS(val);
      else if (key === "DTSTART") {
        const m = val.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2}))?/); if (!m) continue;
        if (m[4] && /Z\s*$/.test(val)) { const dt = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5])); cur.date = isoDate(dt); cur.time = `${pad2(dt.getHours())}:${pad2(dt.getMinutes())}`; }
        else { cur.date = `${m[1]}-${m[2]}-${m[3]}`; cur.time = m[4] ? `${m[4]}:${m[5]}` : ""; }
      }
    }
    return events;
  }
  const KIND_RULES = [[/\bosce\b/i, "OSCE"], [/\bpracticals?\b/i, "Practical"], [/\bmid-?terms?\b/i, "Midterm"], [/\bfinal (exam|examination|assessment)\b|\bfinals?\b(?!.*\b(project|paper|due)\b)/i, "Final"], [/\bquiz(zes)?\b/i, "Quiz"], [/\b(exam|examination|test|assessment)s?\b/i, "Exam"]];
  const examKind = (title) => (KIND_RULES.find(([re]) => re.test(title)) || [])[1] || null;
  function matchCourse(summary) {
    const bracket = (summary.match(/\[([^\]]+)\]\s*$/) || [])[1] || "";
    const hay = (bracket || summary).toLowerCase();
    return S.db.courses.find((c) => (c.code && hay.includes(c.code.toLowerCase())) || hay.includes(c.name.toLowerCase()))?.id || "";
  }
  function analyzeCalendar(events) {
    let skipped = 0, past = 0; const found = [];
    for (const ev of events) {
      const title = ev.summary.replace(/\s*\[[^\]]+\]\s*$/, "").trim(), kind = examKind(title);
      if (!kind) { skipped++; continue; }
      if (daysUntil(ev.date) < 0) { past++; continue; }
      const courseId = matchCourse(ev.summary);
      const dup = state.exams.some((x) => x.date === ev.date && x.courseId === courseId && (x.title.toLowerCase() === title.toLowerCase() || x.kind === kind));
      found.push({ title, kind, courseId, date: ev.date, time: ev.time || "", dup, selected: !dup });
    }
    return { found: found.sort(byDate), skipped, past };
  }
  function sampleCanvasICS() {
    const stamp = (off, t) => `${isoDate(new Date(TODAY + off * DAY)).replace(/-/g, "")}T${t.replace(":", "")}00`;
    const ev = SEED.sampleCalendar.map((e, i) => ["BEGIN:VEVENT", `UID:event-${1000 + i}@canvas.example`, `DTSTART;TZID=America/New_York:${stamp(e.offset, e.time)}`, `SUMMARY:${e.summary.replace(/,/g, "\\,")}`, "END:VEVENT"].join("\r\n"));
    return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Instructure//Canvas//EN", ...ev, "END:VCALENDAR"].join("\r\n");
  }
  function openCalendarImport() {
    state.calImport = { step: 1 };
    openModal(`
      <header class="modal__head"><h2 class="heading">Import exams from your calendar</h2><button class="icon-btn" data-action="close-modal" aria-label="Close">${icon("x", 18)}</button></header>
      <div class="modal__body">
        <p class="caption">Kivo reads a calendar file and picks out quizzes, exams and practicals. Lectures, assignments and other events are skipped.</p>
        <div class="source-grid">
          <section class="source"><h3 class="body-strong">From Canvas</h3><ol class="howto"><li>Open <strong>Calendar</strong> in Canvas.</li><li>Select <strong>Calendar Feed</strong> at the bottom of the sidebar and copy the link.</li><li>Paste the link into your browser to download the <code>.ics</code> file.</li></ol></section>
          <section class="source"><h3 class="body-strong">From Google Calendar</h3><ol class="howto"><li>Open <strong>Settings</strong>, then <strong>Import &amp; export</strong>.</li><li>Select <strong>Export</strong> and unzip the download.</li><li>Pick the <code>.ics</code> file for your school calendar.</li></ol></section>
        </div>
        <label class="dropzone" for="ics-file" id="ics-drop">${icon("upload", 22)}<strong>Choose a .ics file</strong><small>or drop it here. The file is read on your device and never uploaded.</small><input type="file" id="ics-file" accept=".ics,text/calendar" class="sr-only" data-change="ics-file"></label>
        <p class="field__error" id="form-error" role="alert" hidden></p>
      </div>
      <footer class="modal__foot"><button class="btn btn--ghost" data-action="close-modal">Cancel</button><button class="btn btn--secondary" data-action="ics-sample">${icon("calendar", 16)}Try a sample Canvas calendar</button></footer>`,
      { label: "Import exams from your calendar", onMount: (m) => dropTarget($("#ics-drop", m), (f) => readFile(f, (t) => handleCalendarText(t, f.name))) });
  }
  function dropTarget(el, onFile) {
    el.addEventListener("dragover", (e) => { e.preventDefault(); el.classList.add("is-over"); });
    el.addEventListener("dragleave", () => el.classList.remove("is-over"));
    el.addEventListener("drop", (e) => { e.preventDefault(); el.classList.remove("is-over"); const f = e.dataTransfer.files[0]; if (f) onFile(f); });
  }
  function readFile(file, cb) { const r = new FileReader(); r.onload = () => cb(String(r.result)); r.onerror = () => formError("Kivo couldn’t read that file. Try downloading it again."); r.readAsText(file); }
  function handleCalendarText(text, name) {
    if (!/BEGIN:VCALENDAR/.test(text)) return formError(`“${name}” isn’t a calendar file. Look for a file ending in .ics.`);
    const events = parseICS(text), res = analyzeCalendar(events);
    if (!res.found.length) return formError(`No upcoming quizzes or exams found in “${name}” (${plural(events.length, "event")} checked).`);
    state.calImport = { step: 2, name, ...res }; renderImportReview();
  }
  const importCount = () => state.calImport.found.filter((f) => f.selected && !f.dup).length;
  function renderImportReview() {
    const ci = state.calImport;
    openModal(`
      <header class="modal__head"><div><h2 class="heading">Review exams to import</h2><p class="caption">${esc(ci.name)}</p></div><button class="icon-btn" data-action="close-modal" aria-label="Close">${icon("x", 18)}</button></header>
      <div class="modal__body">
        <p class="caption">Found ${plural(ci.found.length, "upcoming assessment")}. Skipped ${plural(ci.skipped, "other event")} like lectures, assignments and office hours${ci.past ? `, and ${ci.past} past ${ci.past === 1 ? "exam" : "exams"}` : ""}.</p>
        <ul class="import-list">${ci.found.map((f, i) => `<li class="import-row ${f.dup ? "is-dup" : ""}"><input type="checkbox" id="imp-${i}" data-change="imp-toggle" data-index="${i}" ${f.selected ? "checked" : ""} ${f.dup ? "disabled" : ""}>
          <label class="import-row__main" for="imp-${i}"><strong>${esc(f.title)}</strong><small>${fmtDate(f.date)}${f.time ? ` · ${fmtTime(f.time)}` : ""} · ${f.kind}</small></label>
          ${f.dup ? `<span class="badge badge--neutral">${icon("check", 12)}Already added</span>` : `<select class="import-row__course ${!f.courseId ? "is-missing" : ""}" aria-label="Course for ${esc(f.title)}" data-change="imp-course" data-index="${i}"><option value="">Choose course…</option>${S.db.courses.map((c) => `<option value="${c.id}" ${c.id === f.courseId ? "selected" : ""}>${esc(c.name)}</option>`).join("")}</select>`}</li>`).join("")}</ul>
        <p class="caption">Each exam is linked to every collection in its course. You can change that from the exam later.</p>
        <p class="field__error" id="form-error" role="alert" hidden></p>
      </div>
      <footer class="modal__foot"><button class="btn btn--ghost" data-action="open-calendar-import">Back</button><button class="btn btn--primary" id="ics-import-btn" data-action="ics-import" ${importCount() ? "" : "disabled"}>Add ${plural(importCount(), "exam")}</button></footer>`, { label: "Review exams to import" });
  }
  function doCalendarImport() {
    const picked = state.calImport.found.filter((f) => f.selected && !f.dup), missing = picked.filter((f) => !f.courseId);
    if (missing.length) return formError(`Choose a course for ${missing.map((m) => `“${m.title}”`).join(", ")}, or untick ${missing.length === 1 ? "it" : "them"}.`);
    picked.forEach((f, i) => state.exams.push({ id: `ex-${Date.now().toString(36)}-${i}`, title: f.title, kind: f.kind, courseId: f.courseId, date: f.date, time: f.time, collections: S.db.decks.filter((c) => c.courseId === f.courseId).map((c) => c.id), source: "calendar" }));
    saveExams(); state.calImport = null; closeModal(true); navigate("#/exams"); toast(`Added ${plural(picked.length, "exam")} from your calendar`, { tone: "success" });
  }

  /* ======================================================================
     INSIGHTS
     ====================================================================== */
  function viewInsights() {
    const act = S.activity(28), days = act.length, studied = act.filter(Boolean).length, total = act.reduce((a, b) => a + b, 0), max = Math.max(1, ...act);
    const fc = S.forecast(7), fcMax = Math.max(1, ...fc);
    const allSt = S.deckStats(S.scopeDeckIds("all"));
    const subjects = S.db.courses.filter((c) => !S.paused(c.id)).map((c) => ({ c, st: S.deckStats(S.scopeDeckIds("course:" + c.id)) })).filter((x) => x.st.retention != null).sort((a, b) => b.st.retention - a.st.retention);
    const weakest = subjects[subjects.length - 1];
    const topics = [];
    for (const d of S.db.decks.filter((x) => !S.paused(x.courseId))) {
      const bySec = {};
      for (const c of S.db.cards.filter((x) => x.deckId === d.id)) { const n = S.note(c.noteId); const k = n.section || d.title; (bySec[k] ||= { lapses: 0, low: 0 }); bySec[k].lapses += c.sched.lapses; if (c.sched.state === "review" && S.retrievability((Date.now() - c.sched.last) / DAY, c.sched.s) < 0.85) bySec[k].low++; }
      for (const [k, v] of Object.entries(bySec)) if (v.lapses || v.low) topics.push({ topic: k, deck: d, ...v });
    }
    topics.sort((a, b) => (b.lapses + b.low) - (a.lapses + a.low));
    const W = 560, H = 140, bw = W / days, start = new Date(TODAY - (days - 1) * DAY);
    const dayNames = Array.from({ length: 7 }, (_, i) => i === 0 ? "Today" : new Date(TODAY + i * DAY).toLocaleDateString("en-US", { weekday: "short" }));
    return `
      <header class="page-header"><div><h1 class="title">Insights</h1><p class="lede">What to study next, from your review history and the scheduler’s memory model.</p></div></header>
      ${weakest ? `<section class="card recommend" aria-labelledby="rec-title"><div class="recommend__icon">${icon("target", 20)}</div>
        <div class="recommend__body"><p class="overline">Recommended next</p><h2 id="rec-title" class="heading">Review ${esc(weakest.c.name)}</h2>
          <p class="caption">Its estimated retention is your lowest (${pct(weakest.st.retention)}).${topics[0] ? ` Start with ${esc(topics[0].topic)}, which has the most lapses and fading cards.` : ""}</p></div>
        <a class="btn btn--primary" href="#/study/course-${weakest.c.id}">${icon("play", 16)}Study now</a></section>` : ""}
      <div class="stat-row">
        <div class="stat card"><p class="caption">Study days</p><p class="stat__value">${studied}<small>/${days}</small></p><p class="caption">Last 4 weeks</p></div>
        <div class="stat card"><p class="caption">Reviews</p><p class="stat__value">${total.toLocaleString()}</p><p class="caption">${studied ? `≈ ${Math.round(total / studied)} per study day` : "No reviews yet"}</p></div>
        <div class="stat card"><p class="caption">Estimated retention</p><p class="stat__value">${allSt.retention != null ? pct(allSt.retention) : "—"}</p><p class="caption">Across cards in review</p></div>
        <div class="stat card"><p class="caption">Cards started</p><p class="stat__value">${allSt.seen}<small>/${allSt.total}</small></p><p class="caption">${allSt.mature} mature (21d+ interval)</p></div>
      </div>
      <div class="insights-grid">
        <section class="card" aria-labelledby="act-title"><div class="card__head"><h2 id="act-title" class="heading">Review activity</h2><span class="caption">Last 28 days</span></div>
          <svg class="chart" viewBox="0 0 ${W} ${H + 24}" role="img" aria-label="Daily reviews over the last 28 days. ${studied} study days, ${total} reviews, peak ${max} in a day.">
            ${[0.5, 1].map((t) => `<line x1="0" x2="${W}" y1="${H - H * t}" y2="${H - H * t}" class="chart__grid"/><text x="${W}" y="${H - H * t - 4}" class="chart__axis" text-anchor="end">${Math.round(max * t)}</text>`).join("")}
            <line x1="0" x2="${W}" y1="${H}" y2="${H}" class="chart__base"/>
            ${act.map((v, i) => `<rect x="${i * bw + 2}" y="${H - (v / max) * H}" width="${bw - 4}" height="${Math.max(v ? 2 : 0, (v / max) * H)}" rx="2" class="chart__bar ${i === days - 1 ? "is-today" : ""}"><title>${v} reviews</title></rect>`).join("")}
            <text x="0" y="${H + 18}" class="chart__axis">${start.toLocaleDateString("en-US", { month: "short", day: "numeric" })}</text><text x="${W}" y="${H + 18}" class="chart__axis" text-anchor="end">Today</text>
          </svg></section>
        <section class="card" aria-labelledby="load-title"><div class="card__head"><h2 id="load-title" class="heading">Upcoming review load</h2><span class="caption">Next 7 days</span></div>
          <ul class="load-list">${fc.map((n, i) => `<li><span class="load-list__day">${dayNames[i]}</span><span class="load-list__bar"><span style="width:${(n / fcMax) * 100}%"></span></span><span class="load-list__n">${n}</span></li>`).join("")}</ul>
          <p class="caption">Cards already in review, by due date. New cards aren’t counted until you study them.</p></section>
        <section class="card" aria-labelledby="subj-title"><div class="card__head"><h2 id="subj-title" class="heading">Estimated retention by course</h2></div>
          ${subjects.length ? `<ul class="subject-list">${subjects.map(({ c, st }) => { const tone = st.retention >= 0.9 ? ["success", "Strong"] : st.retention >= 0.8 ? ["neutral", "Steady"] : ["warning", "Needs work"];
            return `<li><div class="subject-list__top"><a class="body-strong" href="#/course/${c.id}">${esc(c.name)}${isArchived(c.id) ? ` <small class="muted">· archived</small>` : ""}</a><span class="subject-list__val">${pct(st.retention)}</span></div>${progressBar(st.retention, `${c.name} estimated retention`, `progress--${tone[0]}`)}<div class="subject-list__foot"><span class="badge badge--${tone[0]}">${tone[1]}</span><span class="caption">${st.review} cards in review · ${st.lapses} lapses</span></div></li>`; }).join("")}</ul>` : `<p class="caption">Study a few cards to see this.</p>`}
          ${prototypeNote("Estimated retention is the average chance you’d recall each reviewed card today, from the FSRS memory model. It measures your cards, not exam readiness.")}</section>
        <section class="card" aria-labelledby="weak-title"><div class="card__head"><h2 id="weak-title" class="heading">Topics to revisit</h2></div>
          ${topics.length ? `<ul class="row-list row-list--plain">${topics.slice(0, 5).map((w) => `<li><a class="row" href="#/study/${w.deck.id}"><span class="row__icon row__icon--warning">${icon("alert", 16)}</span><span class="row__main"><strong>${esc(w.topic)}</strong><small>${esc(w.deck.title)} · ${plural(w.lapses, "lapse")}${w.low ? ` · ${w.low} fading` : ""}</small></span><span class="btn btn--secondary btn--sm">Study</span></a></li>`).join("")}</ul>` : `<p class="caption">No weak spots yet.</p>`}</section>
      </div>`;
  }
  function viewNotFound() { return emptyState("Not found", "That page doesn’t exist, or it was deleted.", `<a class="btn btn--primary" href="#/home">Go home</a>`); }

  /* ======================================================================
     FORMS: semester, course, unit, collection, review settings, import, share
     ====================================================================== */
  const HUES = [["lavender", "Lavender"], ["sage", "Sage"], ["peach", "Peach"]];
  const confirmBlock = (text, action, data) => `<div class="danger-box" role="alert"><p>${text}</p><div class="stack-h"><button class="btn btn--ghost" data-action="close-modal">Cancel</button><button class="btn btn--danger-solid" data-action="${action}" ${Object.entries(data).map(([k, v]) => `data-${k}="${esc(v)}"`).join(" ")}>Delete</button></div></div>`;
  function openSemesterForm({ id, del } = {}) {
    const sem = id ? S.semester(id) : null;
    if (sem && del) {
      const n = S.coursesIn(id).length;
      return openModal(`<header class="modal__head"><h2 class="heading">Delete ${esc(sem.name)}?</h2></header><div class="modal__body">
        ${n ? `<fieldset class="field"><legend class="field__label">This semester has ${plural(n, "course")}. What happens to them?</legend><div class="radio-stack">
          <label class="radio-card is-selected"><input type="radio" name="sem-del" value="keep" checked><span><strong>Keep the courses</strong><small>They move to “Not in a semester”.</small></span></label>
          <label class="radio-card"><input type="radio" name="sem-del" value="all"><span><strong>Delete the courses too</strong><small>Deletes ${plural(S.deckStats(S.scopeDeckIds("semester:" + id)).total, "card")} and their review history.</small></span></label></div></fieldset>` : `<p class="caption">This semester is empty.</p>`}
        <div class="stack-h stack-h--end"><button class="btn btn--ghost" data-action="close-modal">Cancel</button><button class="btn btn--danger-solid" data-action="semester-delete" data-id="${id}">Delete semester</button></div></div>`, { label: "Delete semester", size: "sm" });
    }
    openModal(`
      <header class="modal__head"><h2 class="heading">${sem ? "Rename semester" : "New semester"}</h2><button class="icon-btn" data-action="close-modal" aria-label="Close">${icon("x", 18)}</button></header>
      <form class="modal__body" id="sem-form" novalidate>
        <label class="field"><span class="field__label">Semester name</span><input id="sem-name" value="${esc(sem?.name || "")}" placeholder="e.g. Spring 2027 · Year 1" autofocus autocomplete="off"><span class="field__hint">Semesters hold your courses. Archive one when it ends to keep the library tidy.</span></label>
        ${sem ? "" : `<fieldset class="field"><legend class="field__label">Move courses into it <small>optional</small></legend><div class="check-list">${S.db.courses.map((c) => `<label class="check-row"><input type="checkbox" name="sem-course" value="${c.id}"><span><strong>${esc(c.name)}</strong><small>${esc(S.semester(c.semesterId)?.name || "Not in a semester")}</small></span></label>`).join("") || `<p class="caption">No courses yet.</p>`}</div></fieldset>`}
        <p class="field__error" id="form-error" role="alert" hidden></p>
      </form>
      <footer class="modal__foot"><button class="btn btn--ghost" data-action="close-modal">Cancel</button><button class="btn btn--primary" data-action="semester-save" data-id="${sem?.id || ""}">${sem ? "Save" : "Create semester"}</button></footer>`,
      { label: sem ? "Rename semester" : "New semester", onMount: (m) => $("#sem-form", m).addEventListener("submit", (e) => { e.preventDefault(); actions["semester-save"]({ dataset: { id: sem?.id || "" } }); }) });
  }
  function openCourseForm(id, del, semesterId) {
    const c = id ? S.course(id) : null;
    if (c && del) {
      const st = S.deckStats(S.scopeDeckIds("course:" + id));
      return openModal(`<header class="modal__head"><h2 class="heading">Delete ${esc(c.name)}?</h2></header><div class="modal__body">${confirmBlock(`This deletes ${plural(S.unitsOf(id).length, "unit")}, ${plural(S.scopeDeckIds("course:" + id).length, "collection")} and ${plural(st.total, "card")}, including their review history. This can’t be undone.`, "course-delete", { id })}</div>`, { label: "Delete course", size: "sm" });
    }
    const defSem = c ? c.semesterId || "" : semesterId ?? (S.semesterList().find((x) => !x.archived)?.id || "");
    openModal(`
      <header class="modal__head"><h2 class="heading">${c ? "Edit course" : "New course"}</h2><button class="icon-btn" data-action="close-modal" aria-label="Close">${icon("x", 18)}</button></header>
      <form class="modal__body" id="course-form" novalidate>
        <label class="field"><span class="field__label">Course name</span><input id="course-name" value="${esc(c?.name || "")}" placeholder="e.g. Ocular Pharmacology" autofocus autocomplete="off"></label>
        <div class="field-row"><label class="field"><span class="field__label">Semester</span><select id="course-sem"><option value="">Not in a semester</option>${S.semesterList().map((x) => `<option value="${x.id}" ${x.id === defSem ? "selected" : ""}>${esc(x.name)}${x.archived ? " (archived)" : ""}</option>`).join("")}</select></label>
          <label class="field"><span class="field__label">Course code <small>optional</small></span><input id="course-code" value="${esc(c?.code || "")}" placeholder="OPT 641"><span class="field__hint">Used to match calendar imports.</span></label></div>
        <fieldset class="field"><legend class="field__label">Color</legend><div class="choice-row">${HUES.map(([v, l]) => `<label class="chip-radio"><input type="radio" name="course-hue" value="${v}" ${(c?.hue || "lavender") === v ? "checked" : ""}><span><span class="dot dot--${v}"></span>&nbsp;${l}</span></label>`).join("")}</div></fieldset>
        ${c ? "" : `<label class="field"><span class="field__label">First unit <small>optional</small></span><input id="course-unit" placeholder="Unit 1 · Introduction"><span class="field__hint">You can add more units later.</span></label>`}
        <p class="field__error" id="form-error" role="alert" hidden></p>
      </form>
      <footer class="modal__foot"><button class="btn btn--ghost" data-action="close-modal">Cancel</button><button class="btn btn--primary" data-action="course-save" data-id="${c?.id || ""}">${c ? "Save" : "Create course"}</button></footer>`,
      { label: c ? "Edit course" : "New course", onMount: (m) => $("#course-form", m).addEventListener("submit", (e) => { e.preventDefault(); actions["course-save"]({ dataset: { id: c?.id || "" } }); }) });
  }
  function openUnitForm({ id, course, del } = {}) {
    const u = id ? S.unit(id) : null;
    if (u && del) {
      const n = S.decksOf(u.courseId, u.id).length;
      return openModal(`<header class="modal__head"><h2 class="heading">Delete ${esc(u.name)}?</h2></header><div class="modal__body">
        ${n ? `<fieldset class="field"><legend class="field__label">This unit has ${plural(n, "collection")}. What happens to them?</legend><div class="radio-stack">
          <label class="radio-card is-selected"><input type="radio" name="unit-del" value="keep" checked><span><strong>Keep them</strong><small>They move to “Not in a unit” in the same course.</small></span></label>
          <label class="radio-card"><input type="radio" name="unit-del" value="all"><span><strong>Delete them too</strong><small>Deletes ${plural(S.deckStats(S.scopeDeckIds("unit:" + id)).total, "card")} and their review history.</small></span></label></div></fieldset>` : `<p class="caption">This unit is empty.</p>`}
        <div class="stack-h stack-h--end"><button class="btn btn--ghost" data-action="close-modal">Cancel</button><button class="btn btn--danger-solid" data-action="unit-delete" data-id="${id}">Delete unit</button></div></div>`, { label: "Delete unit", size: "sm" });
    }
    const courseId = u?.courseId || course || activeCourses()[0]?.id || S.db.courses[0]?.id;
    if (!courseId) { openCourseForm(); toast("Create a course first. Units live inside courses."); return; }
    openModal(`
      <header class="modal__head"><h2 class="heading">${u ? "Rename unit" : "New unit"}</h2><button class="icon-btn" data-action="close-modal" aria-label="Close">${icon("x", 18)}</button></header>
      <form class="modal__body" id="unit-form" novalidate>
        ${u ? "" : `<label class="field"><span class="field__label">Course</span><select id="unit-course">${S.db.courses.map((c) => `<option value="${c.id}" ${c.id === courseId ? "selected" : ""}>${esc(c.name)}</option>`).join("")}</select></label>`}
        <label class="field"><span class="field__label">Unit name</span><input id="unit-name" value="${esc(u?.name || "")}" placeholder="Unit ${S.unitsOf(courseId).length + 1} · Topic" autofocus autocomplete="off"><span class="field__hint">Units group collections, like an exam block. You can study a whole unit at once.</span></label>
        <p class="field__error" id="form-error" role="alert" hidden></p>
      </form>
      <footer class="modal__foot"><button class="btn btn--ghost" data-action="close-modal">Cancel</button><button class="btn btn--primary" data-action="unit-save" data-id="${u?.id || ""}">${u ? "Save" : "Create unit"}</button></footer>`,
      { label: u ? "Rename unit" : "New unit", onMount: (m) => $("#unit-form", m).addEventListener("submit", (e) => { e.preventDefault(); actions["unit-save"]({ dataset: { id: u?.id || "" } }); }) });
  }
  function openDeckForm({ id, course, unit, del } = {}) {
    const d = id ? S.deck(id) : null;
    if (d && del) return openModal(`<header class="modal__head"><h2 class="heading">Delete ${esc(d.title)}?</h2></header><div class="modal__body">${confirmBlock(`This deletes ${plural(S.deckStats([id]).total, "card")} and their review history. This can’t be undone.`, "deck-delete", { id })}</div>`, { label: "Delete collection", size: "sm" });
    if (!S.db.courses.length) { openCourseForm(); toast("Start with a course. Collections live inside courses."); return; }
    const courseId = d?.courseId || course || activeCourses()[0]?.id || S.db.courses[0].id;
    const unitId = d ? d.unitId || "" : unit ?? (S.unitsOf(courseId)[0]?.id || "");
    const unitOpts = (cid, sel) => `<option value="">Not in a unit</option>${S.unitsOf(cid).map((u) => `<option value="${u.id}" ${u.id === sel ? "selected" : ""}>${esc(u.name)}</option>`).join("")}<option value="__new">+ New unit…</option>`;
    openModal(`
      <header class="modal__head"><h2 class="heading">${d ? "Edit collection" : "New collection"}</h2><button class="icon-btn" data-action="close-modal" aria-label="Close">${icon("x", 18)}</button></header>
      <form class="modal__body" id="deck-form" novalidate>
        <div class="field-row"><label class="field"><span class="field__label">Course</span><select id="deck-course">${S.db.courses.map((c) => `<option value="${c.id}" ${c.id === courseId ? "selected" : ""}>${esc(c.name)}</option>`).join("")}</select></label>
          <label class="field"><span class="field__label">Unit</span><select id="deck-unit">${unitOpts(courseId, unitId)}</select></label></div>
        <label class="field" id="deck-newunit-wrap" hidden><span class="field__label">New unit name</span><input id="deck-newunit" placeholder="Unit 3 · Vasculature"></label>
        <label class="field"><span class="field__label">Collection name</span><input id="deck-title" value="${esc(d?.title || "")}" placeholder="e.g. Cavernous Sinus" autofocus autocomplete="off"></label>
        <div class="field-row"><label class="field"><span class="field__label">Lecture <small>optional</small></span><input id="deck-lecture" value="${esc(d?.lecture || "")}" placeholder="Lecture 09"></label>
          <label class="field"><span class="field__label">Topic <small>optional</small></span><input id="deck-topic" value="${esc(d?.topic || "")}" placeholder="Dural venous sinuses"></label></div>
        <label class="field"><span class="field__label">Description <small>optional</small></span><textarea id="deck-desc" rows="2">${esc(d?.description || "")}</textarea></label>
        <p class="caption">Shows in your library as <strong id="deck-preview"></strong></p>
        <p class="field__error" id="form-error" role="alert" hidden></p>
      </form>
      <footer class="modal__foot"><button class="btn btn--ghost" data-action="close-modal">Cancel</button><button class="btn btn--primary" data-action="deck-save" data-id="${d?.id || ""}">${d ? "Save" : "Create collection"}</button></footer>`,
      { label: d ? "Edit collection" : "New collection", onMount: (m) => {
        const upd = () => {
          const cid = $("#deck-course", m).value, uval = $("#deck-unit", m).value;
          $("#deck-newunit-wrap", m).hidden = uval !== "__new";
          const uname = uval === "__new" ? $("#deck-newunit", m).value || "New unit" : uval ? S.unit(uval)?.name : "";
          $("#deck-preview", m).textContent = [S.course(cid)?.name, uname, $("#deck-title", m).value || "Collection name"].filter(Boolean).join(" › ");
        };
        $("#deck-course", m).addEventListener("change", (e) => { $("#deck-unit", m).innerHTML = unitOpts(e.target.value, S.unitsOf(e.target.value)[0]?.id || ""); upd(); });
        $$("input, select, textarea", m).forEach((el) => el.addEventListener("input", upd)); upd();
        $("#deck-form", m).addEventListener("submit", (e) => { e.preventDefault(); actions["deck-save"]({ dataset: { id: d?.id || "" } }); });
      } });
  }
  function openOptions(courseId) {
    const c = S.course(courseId), o = S.options(courseId);
    openModal(`
      <header class="modal__head"><div><h2 class="heading">Review settings</h2><p class="caption">${esc(c.name)} · applies to every collection in this course</p></div><button class="icon-btn" data-action="close-modal" aria-label="Close">${icon("x", 18)}</button></header>
      <form class="modal__body" id="opt-form" novalidate>
        <h3 class="overline">Daily limits</h3>
        <div class="field-row"><label class="field"><span class="field__label">New cards per day</span><input type="number" min="0" max="9999" id="o-new" value="${o.newPerDay}"></label>
          <label class="field"><span class="field__label">Maximum reviews per day</span><input type="number" min="0" max="9999" id="o-rev" value="${o.reviewsPerDay}"></label></div>
        <h3 class="overline">Learning</h3>
        <div class="field-row"><label class="field"><span class="field__label">Learning steps</span><input id="o-learn" value="${o.learnSteps.map((m) => m + "m").join(" ")}"><span class="field__hint">Minutes between first views of a new card.</span></label>
          <label class="field"><span class="field__label">Relearning steps</span><input id="o-relearn" value="${o.relearnSteps.map((m) => m + "m").join(" ")}"><span class="field__hint">After you forget a review card.</span></label></div>
        <h3 class="overline">Memory</h3>
        <label class="field"><span class="field__label">Desired retention · <strong id="o-ret-v">${Math.round(o.retention * 100)}%</strong></span><input type="range" min="0.8" max="0.97" step="0.01" id="o-ret" value="${o.retention}"><span class="field__hint">Higher means more reviews but fewer forgotten cards. 90% is a good default.</span></label>
        <div class="field-row"><label class="field"><span class="field__label">Maximum interval (days)</span><input type="number" min="1" max="36500" id="o-max" value="${o.maxIvl}"></label>
          <label class="field"><span class="field__label">Leech after this many lapses</span><input type="number" min="1" max="99" id="o-leech" value="${o.leechThreshold}"></label></div>
        <label class="field"><span class="field__label">When a card becomes a leech</span><select id="o-leech-action"><option value="tag" ${o.leechAction === "tag" ? "selected" : ""}>Tag it “leech” and keep reviewing</option><option value="suspend" ${o.leechAction === "suspend" ? "selected" : ""}>Tag it and suspend it</option></select></label>
        <label class="switch switch--block"><input type="checkbox" id="o-bury" ${o.burySiblings ? "checked" : ""}><span class="switch__track"></span><span><strong>Bury related cards until tomorrow</strong><small>After you see one card from a note (like cloze c1), its other cards wait a day.</small></span></label>
        <p class="field__error" id="form-error" role="alert" hidden></p>
      </form>
      <footer class="modal__foot"><button class="btn btn--ghost" data-action="options-default" data-course="${courseId}">Restore defaults</button><button class="btn btn--ghost" data-action="close-modal">Cancel</button><button class="btn btn--primary" data-action="options-save" data-course="${courseId}">Save</button></footer>`,
      { label: "Review settings", onMount: (m) => $("#o-ret", m).addEventListener("input", (e) => { $("#o-ret-v", m).textContent = Math.round(e.target.value * 100) + "%"; }) });
  }
  const parseSteps = (s) => s.split(/[\s,]+/).filter(Boolean).map((x) => { const m = x.match(/^(\d+(?:\.\d+)?)(m|h|d)?$/i); return m ? +m[1] * ({ m: 1, h: 60, d: 1440 }[(m[2] || "m").toLowerCase()]) : NaN; });

  /* Import cards: text / CSV / TSV, naming suggestion, duplicate check */
  const SAMPLE_IMPORT = { name: "HN_Lec4_Final.txt", text: [
    "Which cranial nerves carry parasympathetic fibers?\tCN III, VII, IX and X",
    "Which foramen transmits CN IX, X and XI?\tJugular foramen",
    "What is the only cranial nerve to exit from the dorsal brainstem?\tTrochlear nerve (CN IV)",
    "Which muscle does CN XI innervate besides the trapezius?\tSternocleidomastoid",
    "Which cranial nerve carries taste from the posterior third of the tongue?\tGlossopharyngeal nerve (CN IX)",
    "Which nerve innervates the stapedius muscle?\tFacial nerve (CN VII)",
    "Which nerve innervates most intrinsic laryngeal muscles?\tRecurrent laryngeal nerve (CN X)",
    "Which foramen does V3 exit through?\tForamen ovale",
    "Loss of the corneal reflex on one side with intact facial movement suggests a lesion of which nerve?\tTrigeminal nerve (V1, afferent limb)",
    "Which cranial nerve exits through the internal acoustic meatus with CN VII?\tVestibulocochlear nerve (CN VIII)",
  ].join("\n") };
  function parseImport(text) {
    const lines = text.replace(/\r\n?/g, "\n").split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#"));
    if (!lines.length) return [];
    const sep = ["\t", ";", ","].find((s) => lines.filter((l) => l.includes(s)).length >= Math.ceil(lines.length * 0.8)) || "\t";
    const split = (l) => { if (sep !== ",") return l.split(sep); const out = []; let cur = "", q = false; for (const ch of l) { if (ch === '"') q = !q; else if (ch === "," && !q) { out.push(cur); cur = ""; } else cur += ch; } out.push(cur); return out; };
    return lines.map(split).filter((p) => p.length >= 2 && p[0].trim() && p[1].trim()).map((p) => ({ front: p[0].trim(), back: p[1].trim(), tags: (p[2] || "").split(/[\s,]+/).filter(Boolean) }));
  }
  const ABBR = { hn: "Head & Neck Anatomy", "h&n": "Head & Neck Anatomy", oa: "Ocular Anatomy", go: "Geometric Optics", bio: "Biochemistry", biochem: "Biochemistry", cs: "Clinical Skills" };
  function suggestName(fileName) {
    const parts = fileName.replace(/\.[^.]+$/, "").split(/[_\-\s.]+/).filter(Boolean);
    let courseId = "", lecture = "";
    for (const p of parts) {
      const lc = p.toLowerCase();
      const c = S.db.courses.find((x) => (x.code && x.code.replace(/\s/g, "").toLowerCase() === lc) || x.name.toLowerCase() === (ABBR[lc] || "").toLowerCase());
      if (c && !courseId) courseId = c.id;
      const m = lc.match(/^(?:lec|lecture|l)(\d{1,2})$/); if (m) lecture = `Lecture ${m[1].padStart(2, "0")}`;
    }
    const topic = parts.filter((p) => !/^(final|v\d+|updated|copy|new|deck|cards|\d+)$/i.test(p) && !/^(?:lec|lecture|l)\d+$/i.test(p) && !ABBR[p.toLowerCase()]).join(" ");
    const known = courseId && lecture ? S.db.decks.find((d) => d.courseId === courseId && d.lecture === lecture) : null;
    return { courseId, lecture, topic: topic || known?.title || "", existingDeck: known?.id || "" };
  }
  function openImport(courseId) {
    state.importer = { step: 1, courseId: courseId || activeCourses()[0]?.id || S.db.courses[0]?.id };
    openModal(`
      <header class="modal__head"><h2 class="heading">Import cards</h2><button class="icon-btn" data-action="close-modal" aria-label="Close">${icon("x", 18)}</button></header>
      <div class="modal__body">
        <p class="caption">Paste or upload a text file with one card per line: front and back separated by a tab, semicolon or comma. Anki’s “Notes in plain text” export and Quizlet’s export both use this format.</p>
        <label class="dropzone" for="imp-file" id="imp-drop">${icon("upload", 22)}<strong>Choose a .txt, .csv or .tsv file</strong><small>or drop it here. Read on your device, never uploaded.</small><input type="file" id="imp-file" accept=".txt,.csv,.tsv,text/plain,text/csv" class="sr-only" data-change="imp-file"></label>
        <div class="divider"><span>or paste</span></div>
        <label class="field"><span class="sr-only">Paste cards</span><textarea id="imp-text" rows="5" placeholder="Front&#9;Back"></textarea></label>
        <p class="field__error" id="form-error" role="alert" hidden></p>
      </div>
      <footer class="modal__foot"><button class="btn btn--ghost" data-action="imp-sample">Try a sample export</button><button class="btn btn--primary" data-action="imp-parse">Continue</button></footer>`,
      { label: "Import cards", onMount: (m) => dropTarget($("#imp-drop", m), (f) => readFile(f, (t) => importParsed(t, f.name))) });
  }
  function importParsed(text, fileName = "Pasted cards") {
    if (!S.db.courses.length) { closeModal(true); openCourseForm(); toast("Create a course to import into first."); return; }
    const rows = parseImport(text);
    if (!rows.length) return formError("Kivo couldn’t find any cards. Put the front and back on one line, separated by a tab, semicolon or comma.");
    const sug = suggestName(fileName);
    state.importer = { step: 2, rows, fileName, courseId: sug.courseId || state.importer?.courseId || S.db.courses[0].id, lecture: sug.lecture, topic: sug.topic, target: sug.existingDeck ? "existing" : "new", deckId: sug.existingDeck, skipDup: true };
    renderImportStep2();
  }
  function importDupes(courseId) {
    const existing = new Set(S.db.notes.filter((n) => S.deck(n.deckId)?.courseId === courseId).map((n) => norm(n.fields.front || strip(n.fields.text || ""))));
    return state.importer.rows.map((r) => existing.has(norm(r.front)));
  }
  function keepImportInputs() { const im = state.importer; im.lecture = $("#imp-lecture")?.value ?? im.lecture; im.topic = $("#imp-topic")?.value ?? im.topic; im.deckId = $("#imp-deck")?.value ?? im.deckId; }
  function renderImportStep2() {
    const im = state.importer;
    const dup = importDupes(im.courseId), nDup = dup.filter(Boolean).length;
    const decks = S.db.decks.filter((d) => d.courseId === im.courseId);
    const suggested = [S.course(im.courseId)?.name, im.lecture, im.topic].filter(Boolean).join(" / ");
    openModal(`
      <header class="modal__head"><div><h2 class="heading">Organize ${plural(im.rows.length, "card")}</h2><p class="caption">${esc(im.fileName)}</p></div><button class="icon-btn" data-action="close-modal" aria-label="Close">${icon("x", 18)}</button></header>
      <form class="modal__body" id="imp-form" novalidate>
        ${im.fileName !== "Pasted cards" ? `<div class="suggestion"><div class="suggestion__head">${icon("sparkle", 16)}<span class="body-strong">Suggested name</span></div>
          <p class="suggestion__from"><span class="caption">File name</span> <code>${esc(im.fileName)}</code></p><p class="suggestion__to">${esc(suggested)}</p>
          <p class="caption">From the file name and your course list${im.target === "existing" ? ", which already has a collection for this lecture" : ""}. Change anything below.</p></div>` : ""}
        <label class="field"><span class="field__label">Course</span><select id="imp-course" data-change="imp-course-sel">${S.db.courses.map((c) => `<option value="${c.id}" ${c.id === im.courseId ? "selected" : ""}>${esc(c.name)}</option>`).join("")}</select></label>
        <fieldset class="field"><legend class="field__label">Add to</legend><div class="radio-stack">
          <label class="radio-card ${im.target === "new" ? "is-selected" : ""}"><input type="radio" name="imp-target" value="new" data-change="imp-target" ${im.target === "new" ? "checked" : ""}><span><strong>A new collection</strong>
            <span class="field-row field-row--tight"><input id="imp-lecture" value="${esc(im.lecture)}" placeholder="Lecture" aria-label="Lecture"><input id="imp-topic" value="${esc(im.topic)}" placeholder="Collection name" aria-label="Collection name"></span></span></label>
          ${decks.length ? `<label class="radio-card ${im.target === "existing" ? "is-selected" : ""}"><input type="radio" name="imp-target" value="existing" data-change="imp-target" ${im.target === "existing" ? "checked" : ""}><span><strong>An existing collection</strong>
            <select id="imp-deck" aria-label="Existing collection">${decks.map((d) => `<option value="${d.id}" ${d.id === im.deckId ? "selected" : ""}>${esc(d.title)}</option>`).join("")}</select></span></label>` : ""}
        </div></fieldset>
        ${nDup ? `<div class="warning-box" role="note">${icon("alert", 16)}<div><p class="body-strong">${plural(nDup, "card")} already in ${esc(S.course(im.courseId).name)}</p><p class="caption">Same front text as cards you have.</p>
          <div class="choice-row" role="radiogroup" aria-label="Duplicates"><label class="chip-radio"><input type="radio" name="imp-dup" value="skip" data-change="imp-dup" ${im.skipDup ? "checked" : ""}><span>Skip them (import ${im.rows.length - nDup})</span></label><label class="chip-radio"><input type="radio" name="imp-dup" value="keep" data-change="imp-dup" ${im.skipDup ? "" : "checked"}><span>Import all ${im.rows.length}</span></label></div></div></div>` : ""}
        <details class="imp-preview"><summary class="caption">Preview cards</summary><ul>${im.rows.slice(0, 8).map((r, i) => `<li class="${dup[i] ? "is-dup" : ""}"><strong>${esc(r.front)}</strong><span>${esc(r.back)}</span>${dup[i] ? `<em>duplicate</em>` : ""}</li>`).join("")}${im.rows.length > 8 ? `<li class="caption">and ${im.rows.length - 8} more</li>` : ""}</ul></details>
        <p class="field__error" id="form-error" role="alert" hidden></p>
      </form>
      <footer class="modal__foot"><button class="btn btn--ghost" data-action="open-import">Back</button><button class="btn btn--primary" data-action="imp-commit">Import ${plural(im.rows.length - (im.skipDup ? nDup : 0), "card")}</button></footer>`, { label: "Organize imported cards" });
  }
  function commitImport() {
    keepImportInputs();
    const im = state.importer;
    let deckId;
    if (im.target === "existing") deckId = im.deckId || $("#imp-deck").value;
    else {
      const title = im.topic || im.lecture || im.fileName.replace(/\.[^.]+$/, "");
      if (!title) return formError("Name the new collection.", $("#imp-topic"));
      deckId = S.addDeck({ courseId: im.courseId, unitId: S.unitsOf(im.courseId)[0]?.id || null, title, lecture: im.lecture, description: `Imported from ${im.fileName}.` }).id;
    }
    const dup = importDupes(im.courseId);
    let n = 0;
    im.rows.forEach((r, i) => { if (im.skipDup && dup[i]) return; S.saveNote({ deckId, type: "basic", fields: { front: r.front, back: r.back, extra: "", points: "" }, tags: r.tags, section: "" }); n++; });
    closeModal(true); state.importer = null; navigate(`#/collection/${deckId}`);
    toast(`Imported ${plural(n, "card")} into ${S.deck(deckId).title}`, { tone: "success" });
  }

  function openShare(id) {
    const d = S.deck(id); if (!d) return;
    const copies = d.copies || [];
    openModal(`
      <header class="modal__head"><div><h2 class="heading">Share “${esc(d.title)}”</h2><p class="caption">${sourceBadge(d.source)} ${plural(S.deckStats([id]).total, "card")}</p></div><button class="icon-btn" data-action="close-modal" aria-label="Close">${icon("x", 18)}</button></header>
      <div class="modal__body">
        <div class="principle">${icon("fork", 18)}<div><p class="body-strong">Everyone gets their own copy</p><p class="caption">People you share with add an independent copy to their library. They can reword, reorganize and study it their way, and nothing they change affects your version. Their schedule and progress stay private.</p></div></div>
        <div class="field"><label class="field__label" for="invite">Send to</label><div class="invite"><input id="invite" placeholder="Classmate, email or study group" autofocus><button class="btn btn--primary" data-action="share-invite">Send copy</button></div></div>
        <div><p class="field__label">Already have a copy</p><ul class="people people--modal" id="share-people">${copies.map((p) => `<li>${avatar(p.initials, "sm", p.group ? "avatar--group" : "")}<span><strong>${esc(p.name)}</strong><small>${esc(p.status)}</small></span></li>`).join("") || `<li class="caption">Nobody yet.</li>`}</ul></div>
        <label class="switch switch--block"><input type="checkbox" checked id="share-follow"><span class="switch__track"></span><span><strong>Offer my future changes as suggestions</strong><small>People who follow can accept or skip each change. Their own edits are never overwritten.</small></span></label>
        <div class="link-row"><span class="link-row__icon">${icon("link", 16)}</span><div class="link-row__body"><label for="link-access" class="body-strong">Who can get a copy from the link</label><select id="link-access"><option>Only people I send it to</option><option selected>Anyone at Pennsylvania College of Optometry</option><option>Anyone with the link</option></select></div></div>
        ${prototypeNote("Sending copies needs accounts, which come next. This dialog shows how sharing will work.")}
      </div>
      <footer class="modal__foot"><button class="btn btn--ghost" data-action="copy-link">${icon("copy", 16)}Copy link</button><button class="btn btn--primary" data-action="close-modal">Done</button></footer>`, { label: `Share ${d.title}` });
  }
  function openSuggestions() {
    openModal(`
      <header class="modal__head"><div><h2 class="heading">Suggested updates</h2><p class="caption">From Priya Shah’s source · v3.3</p></div><button class="icon-btn" data-action="close-modal" aria-label="Close">${icon("x", 18)}</button></header>
      <div class="modal__body"><p class="caption">Your copy is yours: nothing changes unless you accept it. Cards you’ve reworded are never overwritten.</p>
        <ul class="suggest-list">
          <li class="suggest-item"><span class="badge badge--sage">New card</span><p class="body-strong">CN VI · Which muscle does the abducens nerve innervate?</p><p class="caption">Lateral rectus (“LR6”).</p><div class="suggest-item__actions"><button class="btn btn--ghost btn--sm" data-action="suggestion-skip">Skip</button><button class="btn btn--secondary btn--sm" data-action="suggestion-accept" data-add="1">Accept</button></div></li>
          <li class="suggest-item is-protected"><span class="badge badge--neutral">${icon("lock", 12)}You reworded this card</span><p class="body-strong">CN III · Pupil-sparing palsy vignette</p><p class="caption">Priya edited the explanation. Your version is kept.</p><div class="suggest-item__actions"><button class="btn btn--ghost btn--sm" data-action="suggestion-skip">Keep mine</button></div></li>
        </ul></div>
      <footer class="modal__foot"><button class="btn btn--primary" data-action="close-modal">Done</button></footer>`, { label: "Suggested updates" });
  }
  function openSchedulingExplainer() {
    openModal(`
      <header class="modal__head"><h2 class="heading">How review scheduling works</h2><button class="icon-btn" data-action="close-modal" aria-label="Close">${icon("x", 18)}</button></header>
      <div class="modal__body prose">
        <p>Kivo uses <strong>spaced repetition</strong>, the same approach as Anki. Each card comes back right around when you’re likely to forget it, which is when recalling it strengthens memory most.</p>
        <ul class="rating-explain">
          <li><span class="rating-pill rating-bg--again">Again</span> You didn’t recall it. It comes back in a minute, then in 10 minutes.</li>
          <li><span class="rating-pill rating-bg--hard">Hard</span> You got it with real effort. The gap grows a little.</li>
          <li><span class="rating-pill rating-bg--good">Good</span> You recalled it. The gap grows normally.</li>
          <li><span class="rating-pill rating-bg--easy">Easy</span> Instant recall. The gap grows a lot.</li>
        </ul>
        <p>Under the hood is <strong>FSRS</strong>, the memory model modern Anki uses. It tracks how stable each memory is and how hard each card is for you, and aims for 90% recall. Rate honestly: ratings shape your schedule, they aren’t a grade.</p>
        <p class="caption">Change daily limits, learning steps and desired retention in a course’s Review settings.</p>
      </div>
      <footer class="modal__foot"><button class="btn btn--primary" data-action="close-modal">Got it</button></footer>`, { label: "How review scheduling works" });
  }

  /* ======================================================================
     ROUTER + RENDER
     ====================================================================== */
  let currentRoute = /^#\//.test(location.hash) ? location.hash : "#/home";
  function parseRoute() {
    const raw = currentRoute.replace(/^#\/?/, "") || "home";
    const [path, query = ""] = raw.split("?");
    const [name, ...rest] = path.split("/");
    return { name, id: rest.join("/") || undefined, query: new URLSearchParams(query) };
  }
  function shell() {
    return `
      <a class="skip-link" href="#view">Skip to content</a>
      <aside class="sidebar" aria-label="Primary">
        <div class="brand"><span class="brand__mark" aria-hidden="true">${brandMark()}</span><span class="brand__name">Kivo</span></div>
        <div class="sidebar__actions"><button class="sidebar__search" data-action="focus-search">${icon("search", 16)}<span>Search</span><kbd>/</kbd></button>
          <a class="btn btn--primary sidebar__new" href="#/builder" title="Add card (A)">${icon("plus", 16)}<span>Add card</span></a></div>
        <nav><ul class="nav">${NAV.map((n) => `<li><a class="nav__item" href="#/${n.id}" data-nav="${n.id}">${icon(n.icon, 18)}<span>${n.label}</span>${n.id === "study" ? `<span class="nav__count" id="nav-due"></span>` : ""}</a></li>`).join("")}</ul></nav>
        <div class="sidebar__section"><div class="sidebar__section-head"><p class="overline" id="nav-sem-label">Courses</p><button class="icon-btn icon-btn--sm" data-action="open-course-form" aria-label="New course" title="New course">${icon("plus", 14)}</button></div><ul class="nav nav--courses" id="nav-courses"></ul></div>
        <div class="sidebar__foot"><button class="icon-btn" data-action="toggle-theme" aria-label="Toggle dark mode">${icon("moon", 18)}</button>
          <div class="sidebar__user">${avatar(SEED.user.initials, "sm")}<span><strong>${esc(SEED.user.fullName)}</strong><small>${esc(SEED.user.year)} · Optometry</small></span></div></div>
      </aside>
      <div class="main">
        <header class="appbar"><span class="brand brand--sm"><span class="brand__mark" aria-hidden="true">${brandMark()}</span><span class="brand__name">Kivo</span></span>
          <div class="appbar__actions"><a class="icon-btn" href="#/builder" aria-label="Add card">${icon("plus", 20)}</a><button class="icon-btn" data-action="toggle-theme" aria-label="Toggle dark mode">${icon("moon", 18)}</button></div></header>
        <main id="view" tabindex="-1"></main>
      </div>
      <nav class="tabbar" aria-label="Primary">${NAV.map((n) => `<a class="tabbar__item" href="#/${n.id}" data-nav="${n.id}">${icon(n.icon, 22)}<span>${n.short || n.label}</span>${n.id === "study" ? `<span class="tabbar__badge" hidden></span>` : ""}</a>`).join("")}</nav>
      <div id="modal-root" hidden></div><div id="toast-root" class="toast-root" aria-live="polite"></div>`;
  }
  const brandMark = () => `<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><rect x="3" y="5" width="13" height="16" rx="3" fill="currentColor" opacity=".35"/><rect x="8" y="3" width="13" height="16" rx="3" fill="currentColor"/><path d="m12 11 2 2 3.5-4" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  const TITLES = { home: "Home", library: "My Library", course: "Course", collection: "Collection", builder: "Card editor", study: "Study", quiz: "Practice quiz", exams: "Exams", insights: "Insights" };
  function render() {
    let r = parseRoute();
    if ((r.name === "study" || r.name === "quiz") && r.id && (r.id === "all" || r.id.startsWith("semester-"))) {
      // Reviews never mix courses: send mixed scopes to the course picker.
      currentRoute = "#/study"; try { history.replaceState(null, "", currentRoute); } catch { /* sandboxed */ } r = parseRoute();
    }
    const view = $("#view");
    const focus = (r.name === "study" && r.id) || (r.name === "quiz" && state.quiz && state.quiz.param === r.id && state.quiz.stage !== "setup");
    document.body.classList.toggle("is-focus-mode", !!focus);
    let html;
    switch (r.name) {
      case "home": html = viewHome(); break;
      case "library": html = viewLibrary(); break;
      case "course": html = viewCourse(r.id); break;
      case "collection": html = viewCollection(r.id); break;
      case "builder": html = viewBuilder(r.id, r.query); break;
      case "study": html = r.id ? viewSession(r.id) : viewStudyHub(); break;
      case "quiz": html = viewQuiz(r.id); break;
      case "exams": html = viewExams(); break;
      case "insights": html = viewInsights(); break;
      default: html = viewNotFound();
    }
    view.innerHTML = `<div class="page ${focus ? "page--session" : ""}">${html}</div>`;
    const deckCtx = r.name === "collection" ? S.deck(r.id) : r.name === "builder" ? S.deck(state.builder?.deckId) : null;
    const active = ["course", "collection", "builder"].includes(r.name) ? "library" : r.name === "quiz" ? "study" : r.name;
    $$("[data-nav]").forEach((a) => { const on = a.dataset.nav === active; a.classList.toggle("is-active", on); on ? a.setAttribute("aria-current", "page") : a.removeAttribute("aria-current"); });
    const courseId = r.name === "course" ? r.id : deckCtx?.courseId;
    const current = S.semesterList().find((x) => !x.archived);
    $("#nav-sem-label").textContent = current ? current.name : "Courses";
    $("#nav-courses").innerHTML = activeCourses().map((c) => `<li><a class="nav__item nav__item--sub ${c.id === courseId ? "is-active" : ""}" href="#/course/${c.id}"><span class="dot dot--${c.hue}"></span><span>${esc(c.name)}</span></a></li>`).join("");
    const due = S.counts("all").total;
    $("#nav-due").textContent = due || "";
    $$(".tabbar__badge").forEach((b) => { b.textContent = due; b.hidden = !due; });
    document.title = `${TITLES[r.name] || "Kivo"} · Kivo`;
  }
  function navigate(hash) {
    const changed = hash !== currentRoute; currentRoute = hash;
    try { if (location.hash !== hash) history.replaceState(null, "", hash); } catch { /* sandboxed frame */ }
    changed ? onRouteChange() : render();
  }
  function onRouteChange() {
    closeModal(true);
    const r = parseRoute();
    if (r.name !== "collection") state.browse = { q: "", filter: "all", section: "All" };
    if (!(r.name === "study" && r.id) && !(r.name === "builder" && state.returnTo)) state.session = null;
    if (r.name !== "builder") state.builder = null;
    if (r.name !== "quiz" && state.quiz?.stage === "done") state.quiz = null;
    render(); window.scrollTo(0, 0); $("#view").focus({ preventScroll: true });
  }

  /* ---------- actions ---------------------------------------------------- */
  const sessionCard = () => state.session && S.card(state.session.cardId);
  const keepValues = () => { /* nothing: modal forms read values on save */ };
  const actions = {
    "close-modal": () => closeModal(),
    go: (el) => navigate(el.dataset.href),
    "toggle-theme": () => { const root = document.documentElement; const isDark = root.dataset.theme ? root.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches; root.dataset.theme = isDark ? "light" : "dark"; prefs.set("theme", root.dataset.theme); },
    "focus-search": () => { navigate("#/library"); setTimeout(() => $("#library-search")?.focus(), 30); },
    "library-view": (el) => { state.libraryView = el.dataset.value; prefs.set("libraryView", state.libraryView); render(); },
    "clear-library": () => { state.libraryQuery = ""; render(); },
    "reset-sample": () => openModal(`<header class="modal__head"><h2 class="heading">Reset to the sample library?</h2></header><div class="modal__body"><div class="danger-box" role="alert"><p>This replaces all your semesters, courses, cards, review history and exams with Kivo’s sample data.</p><div class="stack-h"><button class="btn btn--ghost" data-action="close-modal">Cancel</button><button class="btn btn--danger-solid" data-action="reset-confirm">Reset</button></div></div></div>`, { label: "Reset sample data", size: "sm" }),
    "reset-confirm": () => { S.resetToSample(); try { localStorage.removeItem("kivo:exams:v3"); } catch { /* ignore */ } state.exams = loadExams(); closeModal(true); navigate("#/library"); toast("Sample data restored", { tone: "success" }); },
    "tree-toggle": (el) => { const k = el.dataset.id; const cur = state.collapsed[k]; const isSem = k.startsWith("sem-"); const sem = isSem ? S.semester(k.slice(4)) : null; const open = cur === undefined ? (isSem ? !sem?.archived : true) : !cur; state.collapsed[k] = open; prefs.set("collapsed", state.collapsed); render(); $(`[data-action="tree-toggle"][data-id="${k}"]`)?.focus(); },
    // semesters
    "open-semester-form": (el) => openSemesterForm({ id: el.dataset.id, del: el.dataset.del }),
    "semester-save": (el) => {
      const name = $("#sem-name").value.trim(); if (!name) return formError("Give the semester a name, like “Spring 2027 · Year 1”.", $("#sem-name"));
      if (el.dataset.id) { S.update("semester", el.dataset.id, { name }); closeModal(true); render(); toast("Semester renamed", { tone: "success" }); return; }
      const sem = S.addSemester(name);
      for (const cb of $$("input[name='sem-course']:checked")) S.update("course", cb.value, { semesterId: sem.id });
      closeModal(true); render(); toast(`Created ${name}`, { tone: "success", action: "Add course", onAction: () => openCourseForm(null, null, sem.id) });
    },
    "semester-archive": (el) => {
      const sem = S.semester(el.dataset.id), archived = !sem.archived;
      S.update("semester", sem.id, { archived });
      render();
      toast(archived ? `Archived ${sem.name}. Its cards still come up for review.` : `${sem.name} is active again`, { action: archived ? "Pause reviews" : undefined, onAction: () => { S.update("semester", sem.id, { pauseReviews: true }); render(); toast(`Reviews paused for ${sem.name}`); } });
    },
    "semester-pause": (el) => { const sem = S.semester(el.dataset.id); S.update("semester", sem.id, { pauseReviews: !sem.pauseReviews }); render(); toast(sem.pauseReviews ? `Reviews paused for ${sem.name}. Cards keep their schedule and wait.` : `Reviews resumed for ${sem.name}`); },
    "semester-delete": (el) => { const sem = S.semester(el.dataset.id); const all = $("input[name='sem-del']:checked")?.value === "all"; const gone = S.coursesIn(sem.id).map((c) => c.id); S.removeSemester(sem.id, { deleteCourses: all }); if (all) { state.exams = state.exams.filter((e) => !gone.includes(e.courseId)); saveExams(); } closeModal(true); render(); toast(`Deleted ${sem.name}`); },
    // courses / units / decks
    "open-course-form": (el) => openCourseForm(el?.dataset?.id, el?.dataset?.del, el?.dataset?.semester),
    "course-save": (el) => {
      const name = $("#course-name").value.trim(); if (!name) return formError("Give the course a name.", $("#course-name"));
      const data = { name, code: $("#course-code").value.trim(), semesterId: $("#course-sem").value || null, hue: $("input[name='course-hue']:checked").value };
      if (el.dataset.id) { S.update("course", el.dataset.id, data); closeModal(true); render(); toast("Course saved", { tone: "success" }); return; }
      const c = S.addCourse(data); const un = $("#course-unit").value.trim(); if (un) S.addUnit(c.id, un);
      closeModal(true); navigate(`#/course/${c.id}`); toast(`Created ${name}`, { tone: "success", action: "Add collection", onAction: () => openDeckForm({ course: c.id }) });
    },
    "course-delete": (el) => { const c = S.course(el.dataset.id); S.removeCourse(el.dataset.id); state.exams = state.exams.filter((e) => e.courseId !== el.dataset.id); saveExams(); closeModal(true); navigate("#/library"); toast(`Deleted ${c.name}`); },
    "open-unit-form": (el) => openUnitForm({ id: el.dataset.id, course: el.dataset.course, del: el.dataset.del }),
    "unit-save": (el) => {
      const name = $("#unit-name").value.trim(); if (!name) return formError("Give the unit a name.", $("#unit-name"));
      if (el.dataset.id) S.update("unit", el.dataset.id, { name }); else S.addUnit($("#unit-course").value, name);
      closeModal(true); render(); toast(el.dataset.id ? "Unit renamed" : `Created ${name}`, { tone: "success" });
    },
    "unit-delete": (el) => { const u = S.unit(el.dataset.id); const all = $("input[name='unit-del']:checked")?.value === "all"; S.removeUnit(el.dataset.id, { keepDecks: !all }); closeModal(true); render(); toast(`Deleted ${u.name}`); },
    "open-deck-form": (el) => openDeckForm({ id: el.dataset.id, course: el.dataset.course, unit: el.dataset.unit, del: el.dataset.del }),
    "deck-save": (el) => {
      const title = $("#deck-title").value.trim(); if (!title) return formError("Give the collection a name.", $("#deck-title"));
      const courseId = $("#deck-course").value; let unitId = $("#deck-unit").value || null;
      if (unitId === "__new") { const un = $("#deck-newunit").value.trim(); if (!un) return formError("Name the new unit.", $("#deck-newunit")); unitId = S.addUnit(courseId, un).id; }
      const data = { title, courseId, unitId, lecture: $("#deck-lecture").value.trim(), topic: $("#deck-topic").value.trim(), description: $("#deck-desc").value.trim() };
      if (el.dataset.id) { S.update("deck", el.dataset.id, data); for (const c of S.db.cards) if (c.deckId === el.dataset.id) c.deckId = el.dataset.id; S.save(); closeModal(true); render(); toast("Collection saved", { tone: "success" }); return; }
      const d = S.addDeck(data); closeModal(true);
      if (parseRoute().name === "builder" && state.builder) { state.builder.deckId = d.id; render(); toast(`Created ${title}. New cards go here.`, { tone: "success" }); return; }
      navigate(`#/collection/${d.id}`); toast(`Created ${title}`, { tone: "success", action: "Add card", onAction: () => navigate(`#/builder/${d.id}`) });
    },
    "deck-delete": (el) => { const d = S.deck(el.dataset.id); S.removeDeck(el.dataset.id); closeModal(true); navigate(`#/course/${d.courseId}`); toast(`Deleted ${d.title}`); },
    "open-options": (el) => openOptions(el.dataset.course),
    "options-save": (el) => {
      const learn = parseSteps($("#o-learn").value), relearn = parseSteps($("#o-relearn").value);
      if (learn.some(isNaN) || relearn.some(isNaN)) return formError("Write steps like “1m 10m” (m = minutes, h = hours, d = days).", learn.some(isNaN) ? $("#o-learn") : $("#o-relearn"));
      S.setOptions(el.dataset.course, { newPerDay: Math.max(0, +$("#o-new").value || 0), reviewsPerDay: Math.max(0, +$("#o-rev").value || 0), learnSteps: learn, relearnSteps: relearn, retention: +$("#o-ret").value, maxIvl: Math.max(1, +$("#o-max").value || 36500), leechThreshold: Math.max(1, +$("#o-leech").value || 8), leechAction: $("#o-leech-action").value, burySiblings: $("#o-bury").checked });
      closeModal(true); render(); toast("Review settings saved", { tone: "success" });
    },
    "options-default": (el) => { S.db.options[el.dataset.course] = {}; S.save(); closeModal(true); render(); toast("Review settings restored to defaults"); },
    // card browser
    "browse-filter": (el) => { state.browse.filter = el.dataset.value; refreshBrowser(); },
    "browse-section": (el) => { state.browse.section = el.dataset.value; refreshBrowser(); },
    "card-suspend": (el) => { const c = S.card(el.dataset.id); S.setSuspended([c.id], !c.suspended); render(); toast(c.suspended ? "Card suspended. It won’t appear in reviews." : "Card unsuspended"); },
    "card-flag": (el) => { const c = S.card(el.dataset.id); S.setFlag(c.id, c.flag ? 0 : 1); render(); },
    "card-reset": (el) => { S.resetCards([el.dataset.id]); render(); toast("Card reset to new"); },
    "note-delete": (el) => { const n = JSON.parse(JSON.stringify(S.note(el.dataset.id))); const cards = JSON.parse(JSON.stringify(S.db.cards.filter((c) => c.noteId === n.id))); S.removeNote(n.id); render(); toast("Note deleted", { action: "Undo", onAction: () => { S.db.notes.push(n); S.db.cards.push(...cards); S.save(); render(); } }); },
    // builder
    "builder-template": (el) => { state.builder.type = el.dataset.value; state.builder.side = "front"; render(); $(`.template[data-value="${el.dataset.value}"]`)?.focus(); },
    "builder-side": (el) => { state.builder.side = el.dataset.value; refreshPreview(); $$(".builder__preview .segmented__btn").forEach((b) => { const on = b.dataset.value === el.dataset.value; b.classList.toggle("is-active", on); b.setAttribute("aria-pressed", on); }); },
    "builder-ord": (el) => { state.builder.previewOrd = +el.dataset.value; refreshPreview(); },
    "builder-advanced": () => { state.builder.advanced = !state.builder.advanced; render(); $(".disclosure__btn")?.focus(); },
    "builder-save": () => saveBuilder(),
    "builder-done": () => { const b = state.builder; const r = state.returnTo; state.returnTo = null; state.builder = null; navigate(r || (b?.deckId ? `#/collection/${b.deckId}` : "#/library")); },
    "builder-delete-ask": () => { state.builder.confirmDelete = true; render(); },
    "builder-delete-cancel": () => { state.builder.confirmDelete = false; render(); },
    "builder-delete": () => { const b = state.builder; S.removeNote(b.noteId); toast("Note deleted"); state.builder = null; const r = state.returnTo; state.returnTo = null; if (r && state.session) { const s = state.session; if (!S.card(s.cardId)) advance(); } navigate(r || `#/collection/${b.deckId}`); },
    "builder-reset": () => { const b = state.builder; S.resetCards(S.db.cards.filter((c) => c.noteId === b.noteId).map((c) => c.id)); render(); toast("Cards reset to new"); },
    "cloze-wrap": (el) => {
      const ta = $("#cloze-text"); if (!ta) return;
      const { selectionStart: a, selectionEnd: z } = ta;
      if (a === z) { formError("Select a word or phrase in the text first.", ta); return; }
      const nums = S.clozeNums(normalizeCloze(ta.value)), max = nums.length ? Math.max(...nums) : 0;
      const n = el.dataset.same && max ? max : max + 1;
      ta.value = ta.value.slice(0, a) + `{{c${n}::` + ta.value.slice(a, z) + "}}" + ta.value.slice(z);
      state.builder.fields.cloze.text = ta.value; $("#builder-fields").innerHTML = builderFields(); refreshPreview(); $("#cloze-text").focus();
    },
    "occ-toggle": (el) => { const f = state.builder.fields.occlusion, name = el.dataset.value; f.masked = f.masked.includes(name) ? f.masked.filter((m) => m !== name) : [...f.masked, name]; $("#builder-fields").innerHTML = builderFields(); refreshPreview(); $(`.occ__label[data-value="${CSS.escape(name)}"]`)?.focus(); },
    // session
    reveal: () => { const s = state.session; if (s && !s.revealed && !s.paused && !s.finished) { s.revealed = true; render(); $(".rating--good")?.focus(); } },
    rate: (el) => rate(+el.dataset.value),
    "check-point": (el) => { const s = state.session, i = +el.dataset.index; s.checked = s.checked.includes(i) ? s.checked.filter((x) => x !== i) : [...s.checked, i]; render(); $(`.point[data-index="${i}"]`)?.focus(); },
    "session-undo": () => undoLast(),
    "session-flag": () => { const c = sessionCard(); if (!c) return; S.setFlag(c.id, c.flag ? 0 : 1); render(); toast(c.flag ? "Flagged. Find it with the Flagged filter in its collection." : "Flag removed"); },
    "session-bury": () => { const c = sessionCard(); if (!c) return; S.bury(c.id); advance(c.id); render(); toast("Buried until tomorrow", { action: "Undo", onAction: () => { c.buriedUntil = 0; S.save(); Object.assign(state.session, { cardId: c.id, finished: false, revealed: false }); render(); } }); },
    "session-suspend": () => { const c = sessionCard(); if (!c) return; S.setSuspended([c.id], true); advance(c.id); render(); toast("Card suspended", { action: "Undo", onAction: () => { S.setSuspended([c.id], false); Object.assign(state.session, { cardId: c.id, finished: false, revealed: false }); render(); } }); },
    "session-edit": () => { const c = sessionCard(); if (!c) return; state.returnTo = currentRoute; navigate(`#/builder/${c.deckId}?note=${c.noteId}`); },
    "session-pause": () => { state.session.paused = !state.session.paused; render(); },
    "session-exit": () => { state.session = null; navigate("#/home"); },
    "session-end": () => { Object.assign(state.session, { finished: true, paused: false }); render(); },
    "session-done": () => { state.session = null; },
    "session-continue": () => { state.session.finished = false; advance(); render(); },
    "toggle-keys": () => { state.session.showKeys = !state.session.showKeys; prefs.set("showKeys", state.session.showKeys); render(); },
    "explain-scheduling": () => openSchedulingExplainer(),
    // quiz
    "quiz-start": () => { const q = state.quiz; Object.assign(q, { stage: "run", qs: buildQuiz(q.scope, q.opts), i: 0, picked: null, checked: false, results: [] }); render(); },
    "quiz-shuffle": () => { state.quiz.opts.seed = (state.quiz.opts.seed || 7) + 13; render(); toast("Questions reshuffled"); },
    "quiz-pick": (el) => { if (state.quiz.checked) return; state.quiz.picked = +el.dataset.index; render(); $(`.mcq__opt[data-index="${el.dataset.index}"]`)?.focus(); },
    "quiz-check": () => quizCheck(), "quiz-next": () => quizNext(),
    "quiz-exit": () => { const q = state.quiz; state.quiz = null; navigate(quizBackHref(q.scope)); },
    "quiz-again": () => { const q = state.quiz; state.quiz = { param: q.param, scope: q.scope, stage: "setup", opts: { ...q.opts, seed: (q.opts.seed || 7) + 13 } }; render(); },
    "quiz-retake-missed": () => { const q = state.quiz; Object.assign(q, { stage: "run", qs: q.results.filter((r) => !r.correct).map((r) => r.item), i: 0, picked: null, checked: false, results: [] }); render(); },
    "quiz-to-review": () => {
      const q = state.quiz; const noteIds = new Set(q.results.filter((r) => !r.correct).map((r) => r.item.note.id));
      for (const c of S.db.cards) if (noteIds.has(c.noteId)) { c.buriedUntil = 0; if (c.sched.state === "review" && c.sched.due > S.endOfDay()) c.sched.due = S.startOfDay(); }
      S.save(); const p = q.param; state.quiz = null; navigate(`#/study/${p}`);
    },
    // exams
    "open-exam-form": (el) => openExamForm(el?.dataset?.id || null),
    "exam-save": (el) => saveExamFromForm(el.dataset.id || null),
    "exam-delete": (el) => {
      if (!el.dataset.armed) { el.dataset.armed = "1"; el.textContent = "Select again to delete"; return; }
      const i = state.exams.findIndex((e) => e.id === el.dataset.id); const [gone] = state.exams.splice(i, 1);
      saveExams(); closeModal(true); render(); toast(`Deleted ${gone.title}`, { action: "Undo", onAction: () => { state.exams.push(gone); saveExams(); render(); } });
    },
    "open-calendar-import": () => openCalendarImport(),
    "ics-sample": () => handleCalendarText(sampleCanvasICS(), "Alex Rivera Calendar (Canvas).ics"),
    "ics-import": () => doCalendarImport(),
    // import cards
    "open-import": (el) => openImport(el?.dataset?.course),
    "imp-sample": () => importParsed(SAMPLE_IMPORT.text, SAMPLE_IMPORT.name),
    "imp-parse": () => importParsed($("#imp-text").value),
    "imp-commit": () => commitImport(),
    // sharing
    "open-share": (el) => openShare(el.dataset.id),
    "share-invite": () => { const input = $("#invite"); const v = input.value.trim(); if (!v) { input.focus(); input.setAttribute("aria-invalid", "true"); return; } const li = document.createElement("li"); li.innerHTML = `${avatar(v.slice(0, 2).toUpperCase(), "sm")}<span><strong>${esc(v)}</strong><small>Copy will be sent when accounts launch</small></span>`; $("#share-people").appendChild(li); input.value = ""; input.removeAttribute("aria-invalid"); },
    "copy-link": () => { const t = "https://kivo.app/s/arivera/cranial-nerves"; const p = navigator.clipboard?.writeText(t); if (p) p.then(() => toast("Link copied", { tone: "success" })).catch(() => toast(t)); else toast(t); },
    "review-update": () => openSuggestions(),
    "suggestion-accept": (el) => {
      if (el.dataset.add) S.saveNote({ deckId: "hna-cn", type: "basic", section: "Abducens (CN VI)", fields: { front: "Which muscle does the abducens nerve innervate?", back: "Lateral rectus.", extra: "“LR6”", points: "" }, tags: [] });
      el.closest(".suggest-item").classList.add("is-done"); el.closest(".suggest-item__actions").innerHTML = `<span class="badge badge--success">${icon("check", 12)}Added to your copy</span>`;
    },
    "suggestion-skip": (el) => { el.closest(".suggest-item").classList.add("is-done"); el.closest(".suggest-item__actions").innerHTML = `<span class="badge badge--neutral">Skipped</span>`; },
  };
  void keepValues;
  const refreshPreview = () => { const p = $("#builder-preview"); if (p) p.innerHTML = builderPreview(); };
  function refreshBrowser() { const b = $("#browser"); if (b) b.innerHTML = cardBrowser(parseRoute().id); }

  function onClick(e) {
    const openMenu = e.target.closest("details.menu");
    $$("details.menu[open]").forEach((d) => { if (d !== openMenu) d.open = false; });
    const link = e.target.closest('a[href^="#/"]');
    if (link && !e.metaKey && !e.ctrlKey && !e.shiftKey) {
      e.preventDefault();
      if (link.dataset.action && actions[link.dataset.action]) actions[link.dataset.action](link, e);
      navigate(link.getAttribute("href")); return;
    }
    const row = e.target.closest("tr[data-href]");
    if (row && !e.target.closest("a, button")) { navigate(row.dataset.href); return; }
    const el = e.target.closest("[data-action]"); if (!el) return;
    const fn = actions[el.dataset.action]; if (!fn) return;
    if (el.closest("details.menu")) el.closest("details.menu").open = false;
    fn(el, e);
  }
  function onToggle(e) { if (e.target.matches?.("details[data-archive]")) { state.collapsed.__archive = e.target.open; prefs.set("collapsed", state.collapsed); } }
  function onInput(e) {
    const el = e.target, kind = el.dataset.input; if (!kind) return;
    if (kind === "library-query") { state.libraryQuery = el.value; $("#library-results").innerHTML = libraryResults(); }
    else if (kind === "browse-q") { state.browse.q = el.value; const pos = el.selectionStart; refreshBrowser(); const s = $("#browse-search"); s.focus(); s.setSelectionRange(pos, pos); }
    else if (kind === "builder") {
      state.builder.fields[state.builder.type][el.dataset.key] = el.value; refreshPreview();
      if (state.builder.type === "cloze") { const cnt = $(".cloze-count"); if (cnt) { const nums = S.clozeNums(normalizeCloze(el.value)); cnt.textContent = ` ${nums.length ? `This makes ${plural(nums.length, "card")}.` : "Nothing hidden yet."}`; } }
    }
    else if (kind === "builder-meta") state.builder[el.dataset.key] = el.value;
    el.removeAttribute("aria-invalid");
  }
  function onChange(e) {
    const el = e.target, ch = el.dataset.change;
    if (ch === "library-sort") { state.librarySort = el.value; $("#library-results").innerHTML = libraryResults(); }
    else if (ch === "builder-deck") { state.builder.deckId = el.value; render(); }
    else if (ch === "quiz-opt" && state.quiz) { const k = el.dataset.key; state.quiz.opts[k] = el.type === "checkbox" ? el.checked : el.value; render(); $(`#${el.id}`)?.focus(); }
    else if (ch === "ics-file" && el.files[0]) { const f = el.files[0]; readFile(f, (t) => handleCalendarText(t, f.name)); }
    else if (ch === "imp-file" && el.files[0]) { const f = el.files[0]; readFile(f, (t) => importParsed(t, f.name)); }
    else if (ch === "imp-course-sel") { keepImportInputs(); Object.assign(state.importer, { courseId: el.value, deckId: "", target: "new" }); renderImportStep2(); }
    else if (ch === "imp-target") { keepImportInputs(); state.importer.target = el.value; renderImportStep2(); }
    else if (ch === "imp-dup") { keepImportInputs(); state.importer.skipDup = el.value === "skip"; renderImportStep2(); }
    else if (ch === "imp-toggle" || ch === "imp-course") {
      const f = state.calImport.found[+el.dataset.index];
      if (ch === "imp-toggle") f.selected = el.checked; else { f.courseId = el.value; el.classList.toggle("is-missing", !el.value); }
      const b = $("#ics-import-btn"); const n = importCount(); b.textContent = `Add ${plural(n, "exam")}`; b.disabled = !n;
    }
  }
  function onKey(e) {
    trapFocus(e);
    const r = parseRoute();
    if (e.key === "Escape") {
      if ($$("details.menu[open]").length) { $$("details.menu[open]").forEach((d) => (d.open = false)); return; }
      if (!$("#modal-root").hidden) { closeModal(); return; }
      if (state.session && r.name === "study" && r.id) { actions["session-exit"](); return; }
      if (state.quiz && state.quiz.stage === "run" && r.name === "quiz") { actions["quiz-exit"](); return; }
    }
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable;
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && state.builder && r.name === "builder") { e.preventDefault(); saveBuilder(); return; }
    if (e.target.matches?.(".occ__label") && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); actions["occ-toggle"](e.target); return; }
    if (e.target.matches?.("tr[data-href]") && e.key === "Enter") { navigate(e.target.dataset.href); return; }
    if (typing || !$("#modal-root").hidden) return;
    const s = state.session;
    if (s && r.name === "study" && r.id && !s.finished) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") { e.preventDefault(); undoLast(); return; }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (s.paused) { if (e.key.toLowerCase() === "p") actions["session-pause"](); return; }
      if ((e.key === " " || e.key === "Enter") && !e.target.closest("button, a, summary")) { e.preventDefault(); s.revealed ? rate(3) : actions.reveal(); return; }
      if (s.revealed && ["1", "2", "3", "4"].includes(e.key)) { rate(+e.key); return; }
      const k = e.key.toLowerCase();
      if (k === "e") actions["session-edit"](); else if (k === "f") actions["session-flag"](); else if (k === "-") actions["session-bury"](); else if (e.key === "@") actions["session-suspend"](); else if (k === "p") actions["session-pause"]();
      return;
    }
    const q = state.quiz;
    if (q && q.stage === "run" && r.name === "quiz") {
      const item = q.qs[q.i], k = e.key.toLowerCase();
      if (e.key === "Enter") { e.preventDefault(); q.checked ? quizNext() : quizCheck(); return; }
      if (!q.checked) { const idx = item.kind === "tf" ? (k === "t" ? 0 : k === "f" ? 1 : ["1", "2"].includes(k) ? +k - 1 : -1) : "abcd".indexOf(k) >= 0 ? "abcd".indexOf(k) : ["1", "2", "3", "4"].includes(k) ? +k - 1 : -1; if (idx >= 0 && idx < item.options.length) { q.picked = idx; render(); } }
      return;
    }
    if (e.key === "/") { e.preventDefault(); const sch = $("input[type=search]"); sch ? sch.focus() : actions["focus-search"](); return; }
    if (e.key.toLowerCase() === "a" && !e.metaKey && !e.ctrlKey && !e.altKey) { navigate(`#/builder${r.name === "collection" ? "/" + r.id : ""}`); }
  }

  /* ---------- boot -------------------------------------------------------- */
  function boot() {
    const theme = prefs.get("theme", null); if (theme) document.documentElement.dataset.theme = theme;
    S.load(); state.exams = loadExams();
    $("#app").innerHTML = shell();
    document.addEventListener("click", onClick); document.addEventListener("input", onInput); document.addEventListener("change", onChange); document.addEventListener("keydown", onKey); document.addEventListener("toggle", onToggle, true);
    window.addEventListener("hashchange", () => { if (/^#\//.test(location.hash) && location.hash !== currentRoute) { currentRoute = location.hash; onRouteChange(); } });
    render();
  }
  boot();
})();
