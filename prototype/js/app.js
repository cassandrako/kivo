/* ==========================================================================
   Kivo — interactive prototype
   Vanilla JS, hash-routed, local data only. Responsive: desktop sidebar on
   wide screens, iOS-style tab bar at phone widths.
   ========================================================================== */
(() => {
  "use strict";

  const D = window.KIVO_DATA;
  const I = window.KIVO_ICONS;

  /* ---------- utilities ------------------------------------------------- */
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const icon = (name, size = 18, extra = "") =>
    `<svg class="icon ${extra}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${I[name] || ""}</svg>`;
  const pct = (n) => `${Math.round(n * 100)}%`;
  const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;

  const store = {
    get(k, d) { try { const v = localStorage.getItem("kivo:" + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem("kivo:" + k, JSON.stringify(v)); } catch { /* storage unavailable */ } },
  };

  const courseById = (id) => D.courses.find((c) => c.id === id);
  const collectionById = (id) => D.collections.find((c) => c.id === id);

  /* ---------- app state -------------------------------------------------- */
  const state = {
    libraryView: store.get("libraryView", "grid"),
    libraryQuery: "",
    libraryFilter: "all",
    librarySort: "recent",
    courseView: store.get("courseView", "list"),
    exploreQuery: "",
    exploreFilters: { program: "", course: "", topic: "", institution: "" },
    collectionSection: "All",
    dueToday: 30,
    reviewedToday: 0,
    lastSession: null,
    builder: null,
    session: null,
    imported: false,
    flagged: new Set(),
    cardMeta: {}, // id -> { interval (days), ease }
  };

  /* ---------- prototype scheduler ---------------------------------------
     A simplified, SM-2-inspired interval model used only to make the
     prototype feel real. It is NOT Kivo's production algorithm.          */
  const Scheduler = {
    meta(card) {
      if (!state.cardMeta[card.id]) {
        const base = card.state === "new" ? 0 : card.state === "learning" ? 0.007 : 3;
        state.cardMeta[card.id] = { interval: base, ease: 2.5 };
      }
      return state.cardMeta[card.id];
    },
    preview(card) {
      const m = this.meta(card);
      if (m.interval < 1) {
        return { again: 1 / 1440, hard: 6 / 1440, good: card.state === "new" ? 10 / 1440 : 1, easy: 4 };
      }
      return {
        again: 10 / 1440,
        hard: Math.max(1, m.interval * 1.2),
        good: m.interval * m.ease,
        easy: m.interval * m.ease * 1.3,
      };
    },
    apply(card, rating) {
      const m = this.meta(card);
      const next = this.preview(card)[rating];
      if (rating === "again") m.ease = Math.max(1.3, m.ease - 0.2);
      if (rating === "hard") m.ease = Math.max(1.3, m.ease - 0.15);
      if (rating === "easy") m.ease += 0.15;
      m.interval = next;
      return next;
    },
    label(days) {
      if (days < 1 / 24) return `${Math.max(1, Math.round(days * 1440))}m`;
      if (days < 1) return `${Math.round(days * 24)}h`;
      if (days < 30) return `${Math.round(days)}d`;
      return `${(days / 30).toFixed(1)}mo`;
    },
  };

  /* ---------- shared UI fragments -------------------------------------- */
  const NAV = [
    { id: "home", label: "Home", icon: "home" },
    { id: "library", label: "My Library", short: "Library", icon: "library" },
    { id: "study", label: "Study", icon: "study" },
    { id: "explore", label: "Explore", icon: "explore" },
    { id: "insights", label: "Insights", icon: "insights" },
  ];

  const avatar = (initials, size = "md", tone = "") =>
    `<span class="avatar avatar--${size} ${tone}" aria-hidden="true">${esc(initials)}</span>`;

  const sourceBadge = (source) => {
    const map = {
      original: ["Created by you", "badge--neutral", "check"],
      shared: ["Your copy", "badge--sage", "fork"],
      "personal-copy": ["Your copy · edited", "badge--accent", "fork"],
      modified: ["Your copy · edited", "badge--peach", "edit"],
    };
    const [label, cls, ic] = map[source] || map.original;
    return `<span class="badge ${cls}">${icon(ic, 12)}${label}</span>`;
  };

  const statusBadge = (due) => due > 0
    ? `<span class="badge badge--warning">${icon("clock", 12)}${due} due</span>`
    : `<span class="badge badge--success">${icon("check", 12)}Up to date</span>`;

  const progressBar = (value, label, tone = "") =>
    `<div class="progress ${tone}" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(value * 100)}" aria-label="${esc(label)}"><span style="width:${(value * 100).toFixed(1)}%"></span></div>`;

  const breadcrumb = (items) =>
    `<nav class="breadcrumb" aria-label="Breadcrumb"><ol>${items.map((it, i) =>
      `<li>${it.href && i < items.length - 1 ? `<a href="${it.href}">${esc(it.label)}</a>` : `<span aria-current="page">${esc(it.label)}</span>`}</li>`
    ).join(`<li aria-hidden="true" class="breadcrumb__sep">${icon("chevronRight", 14)}</li>`)}</ol></nav>`;

  const emptyState = (title, body, action = "") =>
    `<div class="empty"><div class="empty__icon">${icon("search", 22)}</div><h3>${esc(title)}</h3><p>${esc(body)}</p>${action}</div>`;

  const prototypeNote = (text) =>
    `<p class="proto-note">${icon("info", 14)}<span>${text}</span></p>`;

  /* ---------- toast ----------------------------------------------------- */
  function toast(message, { action, onAction, tone = "default" } = {}) {
    const root = $("#toast-root");
    const el = document.createElement("div");
    el.className = `toast toast--${tone}`;
    el.setAttribute("role", "status");
    el.innerHTML = `${icon(tone === "success" ? "check" : "info", 16)}<span>${esc(message)}</span>${action ? `<button class="btn btn--ghost btn--sm toast__action">${esc(action)}</button>` : ""}<button class="icon-btn icon-btn--sm toast__close" aria-label="Dismiss">${icon("x", 14)}</button>`;
    root.appendChild(el);
    const remove = () => { el.classList.add("is-leaving"); setTimeout(() => el.remove(), 200); };
    el.querySelector(".toast__close").addEventListener("click", remove);
    if (action) el.querySelector(".toast__action").addEventListener("click", () => { onAction?.(); remove(); });
    setTimeout(remove, 5200);
  }

  /* ---------- modal ----------------------------------------------------- */
  let lastFocus = null;
  function openModal(html, { label = "Dialog", size = "md", onMount } = {}) {
    closeModal(true);
    lastFocus = document.activeElement;
    const root = $("#modal-root");
    root.innerHTML = `<div class="modal-backdrop" data-action="close-modal"></div>
      <div class="modal modal--${size}" role="dialog" aria-modal="true" aria-label="${esc(label)}">${html}</div>`;
    root.hidden = false;
    document.body.classList.add("has-modal");
    const modal = $(".modal", root);
    const focusable = $$("button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])", modal);
    (focusable.find((el) => el.matches("[autofocus]")) || focusable[0] || modal).focus();
    onMount?.(modal);
  }
  function closeModal(silent) {
    const root = $("#modal-root");
    if (root.hidden) return;
    root.hidden = true;
    root.innerHTML = "";
    document.body.classList.remove("has-modal");
    if (!silent && lastFocus) lastFocus.focus();
  }
  function trapFocus(e) {
    const modal = $("#modal-root .modal");
    if (!modal || e.key !== "Tab") return;
    const f = $$("button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex='-1'])", modal).filter((el) => el.offsetParent !== null);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  /* ======================================================================
     VIEWS
     ====================================================================== */

  /* ---------- Home ------------------------------------------------------ */
  function viewHome() {
    const hour = new Date().getHours();
    const greet = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
    const done = state.dueToday === 0;
    const sources = [
      { course: "Head & Neck Anatomy", n: 18, id: "hna-cn" },
      { course: "Ocular Anatomy", n: 7, id: "oa-eom" },
      { course: "Biochemistry", n: 3, id: "bio-gly" },
      { course: "Geometric Optics", n: 2, id: "go-verg" },
    ];
    const exams = [
      { name: "Quiz 4", course: "Geometric Optics", date: "Tue, Nov 10", days: 5, seen: 0.58, cards: 187 },
      { name: "Exam 2", course: "Head & Neck Anatomy", date: "Fri, Nov 13", days: 8, seen: 0.62, cards: 214 },
      { name: "Practical", course: "Ocular Anatomy", date: "Fri, Nov 20", days: 15, seen: 0.71, cards: 298 },
    ];
    const recent = ["hna-cn", "oa-eom", "go-verg"].map(collectionById);
    const minutes = Math.max(1, Math.round(state.dueToday * 0.6));

    return `
      <header class="page-header page-header--home">
        <div>
          <p class="overline">Thursday, November 5</p>
          <h1 class="display">${greet}, ${esc(D.user.name)}</h1>
          <p class="lede">Exam 2 for Head &amp; Neck Anatomy is in 8 days. A short session today keeps you on track.</p>
        </div>
      </header>

      <div class="home-grid">
        <section class="card hero ${done ? "hero--done" : ""}" aria-labelledby="today-title">
          <div class="hero__main">
            <p class="overline">Today’s review</p>
            ${done ? `
              <h2 id="today-title" class="hero__count">All caught up</h2>
              <p class="hero__meta">You reviewed ${plural(state.reviewedToday, "card")} today. Next reviews unlock tomorrow morning.</p>
              <div class="hero__actions">
                <a class="btn btn--secondary btn--lg" href="#/insights">${icon("insights")}See what to practice</a>
                <a class="btn btn--ghost btn--lg" href="#/library">Browse library</a>
              </div>` : `
              <h2 id="today-title" class="hero__count"><span class="num">${state.dueToday}</span> cards due</h2>
              <p class="hero__meta">${icon("clock", 14)} About ${minutes} minutes · ${state.reviewedToday ? `${state.reviewedToday} done so far` : "Mixed from 4 courses"}</p>
              <div class="hero__actions">
                <a class="btn btn--primary btn--lg" href="#/study/today" data-shortcut="S">${icon("play", 16)}Start Reviewing</a>
                <a class="btn btn--ghost btn--lg" href="#/study">Choose a collection</a>
              </div>`}
          </div>
          ${done ? "" : `
          <ul class="hero__sources" aria-label="Where today’s cards come from">
            ${sources.map((s) => `
              <li><a href="#/collection/${s.id}"><span class="dot dot--${courseById(collectionById(s.id).courseId).hue}"></span><span class="hero__source-name">${esc(s.course)}</span><span class="hero__source-n">${s.n}</span></a></li>`).join("")}
          </ul>`}
        </section>

        <section class="card exams" aria-labelledby="exams-title">
          <div class="card__head"><h2 id="exams-title" class="heading">Upcoming exams</h2><a class="link" href="#/insights">Plan</a></div>
          <ul class="exam-list">
            ${exams.map((e) => `
              <li class="exam">
                <div class="exam__date"><span>${e.days}</span><small>days</small></div>
                <div class="exam__body">
                  <p class="exam__title">${esc(e.name)} · ${esc(e.course)}</p>
                  <p class="caption">${esc(e.date)} · ${pct(e.seen)} of exam cards reviewed at least once</p>
                  ${progressBar(e.seen, `${e.name} coverage`)}
                </div>
              </li>`).join("")}
          </ul>
        </section>

        <section class="home-recent" aria-labelledby="recent-title">
          <div class="section-head"><h2 id="recent-title" class="heading">Jump back in</h2><a class="link" href="#/library">View library ${icon("arrowRight", 14)}</a></div>
          <div class="collection-grid">
            ${recent.map(collectionCard).join("")}
          </div>
        </section>

        <section class="card suggestions" aria-labelledby="next-title">
          <div class="card__head"><h2 id="next-title" class="heading">Suggested next</h2></div>
          <ul class="suggestion-list">
            <li><a href="#/collection/bio-gly">${icon("target", 18)}<span><strong>Practice glycolysis regulation</strong><small>Missed 9 times this week · Biochemistry</small></span>${icon("chevronRight", 16)}</a></li>
            <li><a href="#/collection/hna-cn">${icon("layers", 18)}<span><strong>Learn 8 new Cranial Nerve cards</strong><small>Trigeminal section · before Exam 2</small></span>${icon("chevronRight", 16)}</a></li>
            <li><a href="#/collection/hna-pter">${icon("refresh", 18)}<span><strong>3 suggested updates for Pterygopalatine Fossa</strong><small>From Jordan Lee’s source · you choose what to accept</small></span>${icon("chevronRight", 16)}</a></li>
          </ul>
        </section>
      </div>`;
  }

  /* ---------- Library --------------------------------------------------- */
  function collectionCard(col) {
    const course = courseById(col.courseId);
    return `
      <article class="card collection-card">
        <a class="collection-card__link" href="#/collection/${col.id}" aria-label="${esc(col.title)}, ${esc(course.name)}"></a>
        <div class="collection-card__top">
          <span class="chip chip--${course.hue}">${esc(course.name)}</span>
          ${statusBadge(col.due)}
        </div>
        <h3 class="subhead">${esc(col.title)}</h3>
        <p class="caption">${esc(col.lecture)} · ${esc(col.unit)}</p>
        <div class="collection-card__foot">
          <span class="caption">${col.cards} cards</span>
          <span class="caption">Updated ${esc(col.updated.replace(", 2026", ""))}</span>
        </div>
      </article>`;
  }

  function viewLibrary() {
    return `
      <header class="page-header">
        <div>
          <h1 class="title">My Library</h1>
          <p class="lede">${D.courses.length} courses · ${D.courses.reduce((a, c) => a + c.cards, 0).toLocaleString()} cards · OD1 Fall 2026</p>
        </div>
        <div class="page-header__actions">
          <button class="btn btn--secondary" data-action="open-import">${icon("upload", 16)}Import</button>
          <button class="btn btn--primary" data-action="open-create">${icon("plus", 16)}Create collection</button>
        </div>
      </header>

      <div class="toolbar" role="search">
        <label class="search">
          ${icon("search", 16)}
          <span class="sr-only">Search your library</span>
          <input type="search" placeholder="Search courses, collections, tags…" value="${esc(state.libraryQuery)}" data-input="library-query" autocomplete="off">
          <kbd>/</kbd>
        </label>
        <div class="toolbar__group">
          <label class="select">
            <span class="sr-only">Filter</span>
            ${icon("filter", 14)}
            <select data-change="library-filter">
              ${[["all", "All courses"], ["due", "Has reviews due"], ["new", "Has new cards"], ["shared", "Copied from classmates"]].map(([v, l]) => `<option value="${v}" ${state.libraryFilter === v ? "selected" : ""}>${l}</option>`).join("")}
            </select>
          </label>
          <label class="select">
            <span class="sr-only">Sort</span>
            ${icon("sort", 14)}
            <select data-change="library-sort">
              ${[["recent", "Recently studied"], ["name", "Name A–Z"], ["due", "Most due"], ["cards", "Most cards"]].map(([v, l]) => `<option value="${v}" ${state.librarySort === v ? "selected" : ""}>${l}</option>`).join("")}
            </select>
          </label>
          <div class="segmented" role="group" aria-label="Layout">
            <button class="segmented__btn ${state.libraryView === "grid" ? "is-active" : ""}" aria-pressed="${state.libraryView === "grid"}" data-action="library-view" data-value="grid">${icon("grid", 16)}<span class="sr-only">Grid view</span></button>
            <button class="segmented__btn ${state.libraryView === "list" ? "is-active" : ""}" aria-pressed="${state.libraryView === "list"}" data-action="library-view" data-value="list">${icon("list", 16)}<span class="sr-only">List view</span></button>
          </div>
        </div>
      </div>

      <div id="library-results" aria-live="polite">${libraryResults()}</div>`;
  }

  function libraryResults() {
    const q = state.libraryQuery.trim().toLowerCase();
    const recentRank = { "Today": 0, "Yesterday": 1, "2 days ago": 2, "3 days ago": 3, "Last week": 4 };
    let courses = D.courses.filter((c) => {
      if (state.libraryFilter === "due" && c.due === 0) return false;
      if (state.libraryFilter === "new" && c.newCards === 0) return false;
      if (state.libraryFilter === "shared" && !D.collections.some((col) => col.courseId === c.id && col.source === "shared")) return false;
      return !q || c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q);
    });
    const sorters = {
      recent: (a, b) => recentRank[a.lastActivity] - recentRank[b.lastActivity],
      name: (a, b) => a.name.localeCompare(b.name),
      due: (a, b) => b.due - a.due,
      cards: (a, b) => b.cards - a.cards,
    };
    courses.sort(sorters[state.librarySort]);

    const cols = q ? D.collections.filter((c) =>
      [c.title, c.topic, c.lecture, c.unit, ...(c.tags || [])].join(" ").toLowerCase().includes(q)) : [];

    if (!courses.length && !cols.length) {
      return emptyState("No matches", `Nothing in your library matches “${state.libraryQuery}”. Try a course code, lecture number, or tag.`,
        `<button class="btn btn--secondary" data-action="clear-library">Clear search</button>`);
    }

    const courseHtml = state.libraryView === "grid" ? `
      <div class="course-grid">
        ${courses.map((c) => `
          <article class="card course-card">
            <a class="course-card__link" href="#/course/${c.id}" aria-label="Open ${esc(c.name)}"></a>
            <div class="course-card__band course-card__band--${c.hue}"><span class="course-card__code">${esc(c.code)}</span></div>
            <div class="course-card__body">
              <h3 class="subhead">${esc(c.name)}</h3>
              <p class="caption">${plural(c.collections, "collection")} · ${c.cards} cards</p>
              <div class="course-card__status">
                ${statusBadge(c.due)}
                ${c.newCards ? `<span class="badge badge--neutral">${c.newCards} new</span>` : ""}
              </div>
              <div class="course-card__foot">
                <span class="caption">${icon("calendar", 12)} ${esc(c.exam)}</span>
                <span class="caption">Studied ${esc(c.lastActivity.toLowerCase())}</span>
              </div>
            </div>
          </article>`).join("")}
      </div>` : `
      <div class="table-wrap card">
        <table class="table">
          <thead><tr><th scope="col">Course</th><th scope="col">Collections</th><th scope="col">Cards</th><th scope="col">Status</th><th scope="col">Next exam</th><th scope="col">Last studied</th></tr></thead>
          <tbody>
            ${courses.map((c) => `
              <tr data-href="#/course/${c.id}" tabindex="0">
                <th scope="row"><span class="dot dot--${c.hue}"></span><a href="#/course/${c.id}">${esc(c.name)}</a><small>${esc(c.code)}</small></th>
                <td>${c.collections}</td><td>${c.cards}</td><td>${statusBadge(c.due)}</td>
                <td>${esc(c.exam)}</td><td>${esc(c.lastActivity)}</td>
              </tr>`).join("")}
          </tbody>
        </table>
      </div>`;

    return `
      ${courses.length ? `<h2 class="overline section-label">Courses</h2>${courseHtml}` : ""}
      ${cols.length ? `<h2 class="overline section-label">Collections matching “${esc(state.libraryQuery)}”</h2><div class="collection-grid">${cols.map(collectionCard).join("")}</div>` : ""}`;
  }

  /* ---------- Course ---------------------------------------------------- */
  function viewCourse(id) {
    const c = courseById(id);
    if (!c) return viewNotFound();
    const cols = D.collections.filter((x) => x.courseId === id);
    const units = [...new Set(cols.map((x) => x.unit))];
    return `
      ${breadcrumb([{ label: "My Library", href: "#/library" }, { label: c.name }])}
      <header class="page-header">
        <div>
          <p class="overline">${esc(c.code)} · ${esc(c.term)}</p>
          <h1 class="title">${esc(c.name)}</h1>
          <p class="lede">${plural(c.collections, "collection")} · ${c.cards} cards · ${c.due} due today · Next: ${esc(c.exam)}</p>
        </div>
        <div class="page-header__actions">
          <button class="btn btn--secondary" data-action="open-import" data-course="${c.id}">${icon("upload", 16)}Import shared collection</button>
          <a class="btn btn--primary" href="#/study/${cols[0]?.id || "today"}">${icon("play", 16)}Study course</a>
        </div>
      </header>
      <div class="toolbar toolbar--tight">
        <p class="caption">Organized as Course → Unit → Collection</p>
        <div class="segmented" role="group" aria-label="Layout">
          <button class="segmented__btn ${state.courseView === "grid" ? "is-active" : ""}" aria-pressed="${state.courseView === "grid"}" data-action="course-view" data-value="grid">${icon("grid", 16)}<span class="sr-only">Grid view</span></button>
          <button class="segmented__btn ${state.courseView === "list" ? "is-active" : ""}" aria-pressed="${state.courseView === "list"}" data-action="course-view" data-value="list">${icon("list", 16)}<span class="sr-only">List view</span></button>
        </div>
      </div>
      ${units.map((u) => `
        <section class="unit">
          <h2 class="overline section-label">${esc(u)}</h2>
          ${state.courseView === "grid"
            ? `<div class="collection-grid">${cols.filter((x) => x.unit === u).map(collectionCard).join("")}</div>`
            : `<ul class="row-list card">${cols.filter((x) => x.unit === u).map((x) => `
              <li><a class="row" href="#/collection/${x.id}">
                <span class="row__icon">${icon("layers", 18)}</span>
                <span class="row__main"><strong>${esc(x.title)}</strong><small>${esc(x.lecture)} · ${x.cards} cards · by ${esc(x.creator.name)}</small></span>
                <span class="row__meta">${sourceBadge(x.source)}${statusBadge(x.due)}</span>
                ${icon("chevronRight", 16, "row__chev")}
              </a></li>`).join("")}</ul>`}
        </section>`).join("")}`;
  }

  /* ---------- Collection detail ----------------------------------------- */
  function viewCollection(id) {
    const col = collectionById(id);
    if (!col) return viewNotFound();
    const course = courseById(col.courseId);
    const rich = !!col.cardList;
    const cards = rich ? col.cardList : [];
    const section = state.collectionSection;
    const shown = section === "All" ? cards : cards.filter((c) => c.section === section);
    const typeLabel = { basic: "Basic", cloze: "Cloze", occlusion: "Image occlusion", mcq: "Multiple choice", vignette: "Clinical vignette" };

    return `
      ${breadcrumb([{ label: "My Library", href: "#/library" }, { label: course.name, href: `#/course/${course.id}` }, { label: col.title }])}
      <header class="page-header page-header--collection">
        <div>
          <div class="meta-row">${sourceBadge(col.source)}${col.sourceOf ? `<span class="caption">copied from ${esc(col.sourceOf)}</span>` : ""}</div>
          <h1 class="title">${esc(course.name)} — ${esc(col.title)}</h1>
          ${col.description ? `<p class="lede lede--wide">${esc(col.description)}</p>` : ""}
        </div>
        <div class="page-header__actions">
          <button class="btn btn--ghost" data-action="open-share" data-id="${col.id}">${icon("share", 16)}Share</button>
          <a class="btn btn--secondary" href="#/builder/${col.id}">${icon("edit", 16)}Edit</a>
          <a class="btn btn--primary" href="#/study/${col.id}">${icon("play", 16)}Study${col.due ? ` ${col.due} due` : ""}</a>
        </div>
      </header>

      <div class="collection-layout">
        <div class="collection-main">
          <section class="card modes" aria-labelledby="modes-title">
            <h2 id="modes-title" class="overline">Study this collection</h2>
            <div class="mode-grid">
              <a class="mode mode--primary" href="#/study/${col.id}">${icon("refresh", 20)}<strong>Spaced review</strong><small>${col.due} due · scheduled</small></a>
              <a class="mode" href="#/study/${col.id}?mode=flashcards">${icon("study", 20)}<strong>Flashcards</strong><small>Browse all ${col.cards}, no scheduling</small></a>
              <a class="mode" href="#/study/${col.id}?mode=quiz">${icon("target", 20)}<strong>Practice quiz</strong><small>Multiple choice from cards</small></a>
              <a class="mode" href="#/study/${col.id}?mode=cases">${icon("book", 20)}<strong>Clinical cases</strong><small>Vignettes only</small></a>
            </div>
            <p class="caption">All modes use the same cards — nothing to recreate. Quiz results don’t change your review schedule.</p>
          </section>

          <section class="card" aria-labelledby="cards-title">
            <div class="card__head">
              <h2 id="cards-title" class="heading">Cards <span class="count">${col.cards}</span></h2>
              <a class="btn btn--secondary btn--sm" href="#/builder/${col.id}">${icon("plus", 14)}Add card</a>
            </div>
            ${rich ? `
              <div class="section-tabs" role="tablist" aria-label="Sections">
                ${["All", ...col.sections.map((s) => s.name)].map((s) => `
                  <button role="tab" aria-selected="${s === section}" class="tab ${s === section ? "is-active" : ""}" data-action="collection-section" data-value="${esc(s)}">${esc(s)}${s !== "All" ? ` <span>${col.sections.find((x) => x.name === s).count}</span>` : ""}</button>`).join("")}
              </div>
              <ul class="card-list">
                ${shown.length ? shown.map((c) => `
                  <li class="card-row">
                    <span class="card-row__type">${esc(typeLabel[c.type])}</span>
                    <div class="card-row__body">
                      <p class="card-row__front">${renderClozeText(c.front, "preview")}</p>
                      <p class="card-row__back">${esc(c.back)}</p>
                    </div>
                    <div class="card-row__tags">${c.tags.slice(0, 2).map((t) => `<span class="tag">#${esc(t)}</span>`).join("")}</div>
                  </li>`).join("") : `<li class="card-list__empty caption">Showing a preview of the first cards. ${esc(section)} has ${col.sections.find((x) => x.name === section)?.count || 0} cards in the full collection.</li>`}
              </ul>` : `<p class="caption">Card preview is available for the Cranial Nerves sample collection in this prototype.</p>`}
          </section>
        </div>

        <aside class="collection-aside">
          <section class="card details" aria-labelledby="details-title">
            <h2 id="details-title" class="overline">Details</h2>
            <dl class="dl">
              <div><dt>Course</dt><dd>${esc(course.name)}</dd></div>
              <div><dt>Unit</dt><dd>${esc(col.unit)}</dd></div>
              <div><dt>Lecture</dt><dd>${esc(col.lecture)}</dd></div>
              <div><dt>Topic</dt><dd>${esc(col.topic)}</dd></div>
              <div><dt>Assessment</dt><dd>${esc(col.exam)}</dd></div>
              <div><dt>Cards</dt><dd>${col.cards} · ${col.due} due · ${col.newCards} new</dd></div>
              <div><dt>Last modified</dt><dd>${esc(col.updated)}</dd></div>
            </dl>
            <div class="creator">
              ${avatar(col.creator.initials)}
              <div><p class="body-strong">${esc(col.creator.name)}</p><p class="caption">${esc(col.creator.role || "Creator")}</p></div>
            </div>
            <div class="tag-row">${(col.tags || []).map((t) => `<span class="tag">#${esc(t)}</span>`).join("")}</div>
          </section>

          ${col.copies ? `
          <section class="card" aria-labelledby="sharing-title">
            <div class="card__head"><h2 id="sharing-title" class="overline">Sharing</h2><button class="link" data-action="open-share" data-id="${col.id}">Share</button></div>
            <p class="caption personal-note">${icon("lock", 14)}<span>This collection is yours. Only you can edit it, and your schedule and progress are private.</span></p>
            <p class="caption"><strong>People with their own copy</strong></p>
            <ul class="people">
              ${col.copies.map((p) => `<li>${avatar(p.initials, "sm", p.group ? "avatar--group" : "")}<span>${esc(p.name)}<small>${esc(p.status)}</small></span></li>`).join("")}
            </ul>
            <div class="lineage">
              <p class="caption"><strong>Where this came from</strong></p>
              <ol class="lineage__list">
                <li><span class="lineage__dot"></span>Priya Shah’s source · v3.2</li>
                <li class="is-current"><span class="lineage__dot"></span>Your copy · ${col.edits.cards} cards reworded, ${col.edits.added} added</li>
              </ol>
              <p class="caption">Priya published 2 changes yesterday. <button class="link" data-action="review-update">Review suggestions</button></p>
            </div>
          </section>` : ""}
        </aside>
      </div>`;
  }

  /* ---------- Card builder ---------------------------------------------- */
  const BUILDER_DEFAULTS = {
    basic: { front: "What does the optic nerve (CN II) pass through to enter the cranial cavity?", back: "The optic canal, with the ophthalmic artery.", extra: "The optic canal is in the lesser wing of the sphenoid." },
    cloze: { text: "The {{superior oblique}} is innervated by the {{trochlear nerve (CN IV)}}.", extra: "SO4 — superior oblique, CN IV." },
    occlusion: { prompt: "Identify the masked foramen.", masked: ["Foramen rotundum", "Foramen ovale", "Superior orbital fissure"] },
    mcq: { stem: "Which muscle is the primary depressor of the eye in adduction?", options: ["Inferior rectus", "Superior oblique", "Inferior oblique", "Lateral rectus"], correct: 1, explanation: "In adduction the superior oblique’s line of pull aligns with the visual axis, making it the main depressor." },
    vignette: { case: "A 34-year-old woman reports a painful, red right eye with photophobia for 2 days. VA is 20/30 OD. There is ciliary flush and 2+ anterior chamber cells. IOP is 12 mmHg.", question: "What is the most likely diagnosis?", answer: "Acute anterior uveitis (iritis).", explanation: "Ciliary flush, photophobia and AC cells point to anterior uveitis. Ask about HLA-B27–associated conditions if recurrent." },
  };

  function newBuilder(collectionId) {
    return {
      collectionId,
      template: "basic",
      fields: JSON.parse(JSON.stringify(BUILDER_DEFAULTS)),
      side: "front",
      advancedOpen: false,
      advanced: { section: "Olfactory & Optic (CN I–II)", tags: "CN II, foramina", reverse: false, hint: "", limit: "Default (20/day)" },
      added: 0,
    };
  }

  function viewBuilder(collectionId) {
    const col = collectionById(collectionId) || collectionById("hna-cn");
    if (!state.builder || state.builder.collectionId !== col.id) state.builder = newBuilder(col.id);
    const b = state.builder;
    const course = courseById(col.courseId);

    return `
      ${breadcrumb([{ label: "My Library", href: "#/library" }, { label: course.name, href: `#/course/${course.id}` }, { label: col.title, href: `#/collection/${col.id}` }, { label: "New card" }])}
      <header class="page-header">
        <div>
          <h1 class="title">New card</h1>
          <p class="lede">Adding to <strong>${esc(col.title)}</strong>${b.added ? ` · ${plural(b.added, "card")} added this session` : ""}</p>
        </div>
        <div class="page-header__actions">
          <a class="btn btn--ghost" href="#/collection/${col.id}">Done</a>
          <button class="btn btn--primary" data-action="builder-save">${icon("check", 16)}Save &amp; add another <kbd class="kbd-inline">⌘↵</kbd></button>
        </div>
      </header>

      <section aria-labelledby="tpl-title">
        <h2 id="tpl-title" class="overline section-label">Choose a template</h2>
        <div class="template-grid" role="radiogroup" aria-label="Card template">
          ${D.templates.map((t) => `
            <button class="template ${b.template === t.id ? "is-selected" : ""}" role="radio" aria-checked="${b.template === t.id}" data-action="builder-template" data-value="${t.id}">
              <span class="template__art">${templateArt(t.id)}</span>
              <span class="template__name">${esc(t.name)}</span>
              <span class="template__desc">${esc(t.desc)}</span>
              <span class="template__best">Best for ${esc(t.best.toLowerCase())}</span>
            </button>`).join("")}
        </div>
      </section>

      <div class="builder">
        <section class="card builder__form" aria-labelledby="fields-title">
          <h2 id="fields-title" class="heading">Content</h2>
          <div id="builder-fields">${builderFields()}</div>

          <div class="disclosure ${b.advancedOpen ? "is-open" : ""}">
            <button class="disclosure__btn" aria-expanded="${b.advancedOpen}" aria-controls="adv-panel" data-action="builder-advanced">
              ${icon("settings", 16)}<span>Advanced settings</span><small>Optional</small>${icon("chevronDown", 16, "disclosure__chev")}
            </button>
            <div id="adv-panel" class="disclosure__panel" ${b.advancedOpen ? "" : "hidden"}>
              <div class="field-row">
                <label class="field"><span class="field__label">Section</span>
                  <select data-input="adv" data-key="section">${col.sections ? col.sections.map((s) => `<option ${s.name === b.advanced.section ? "selected" : ""}>${esc(s.name)}</option>`).join("") : "<option>General</option>"}</select></label>
                <label class="field"><span class="field__label">Tags</span>
                  <input data-input="adv" data-key="tags" value="${esc(b.advanced.tags)}"><span class="field__hint">Separate with commas</span></label>
              </div>
              <label class="field"><span class="field__label">Hint (shown on request)</span>
                <input data-input="adv" data-key="hint" value="${esc(b.advanced.hint)}" placeholder="e.g. Think about the sphenoid bone"></label>
              <label class="switch"><input type="checkbox" data-input="adv" data-key="reverse" ${b.advanced.reverse ? "checked" : ""}><span class="switch__track"></span><span>Also create a reversed card (answer → question)</span></label>
              <label class="field"><span class="field__label">New cards per day for this collection</span>
                <select data-input="adv" data-key="limit">${["Default (20/day)", "10/day", "30/day", "No limit"].map((o) => `<option ${o === b.advanced.limit ? "selected" : ""}>${o}</option>`).join("")}</select></label>
              <p class="caption">Need full control? Custom fields and styling live in Settings → Card types. You never need HTML or CSS to make a card.</p>
            </div>
          </div>
        </section>

        <section class="builder__preview" aria-labelledby="preview-title">
          <div class="builder__preview-head">
            <h2 id="preview-title" class="overline">Live preview</h2>
            <div class="segmented segmented--text" role="group" aria-label="Preview side">
              <button class="segmented__btn ${b.side === "front" ? "is-active" : ""}" aria-pressed="${b.side === "front"}" data-action="builder-side" data-value="front">Front</button>
              <button class="segmented__btn ${b.side === "back" ? "is-active" : ""}" aria-pressed="${b.side === "back"}" data-action="builder-side" data-value="back">Back</button>
            </div>
          </div>
          <div id="builder-preview" aria-live="polite">${builderPreview()}</div>
        </section>
      </div>`;
  }

  function templateArt(id) {
    const arts = {
      basic: `<span class="ta ta-basic"><i></i><i></i></span>`,
      cloze: `<span class="ta ta-cloze"><i></i><b></b><i></i></span>`,
      occlusion: `<span class="ta ta-occ"><i></i><b></b><b></b></span>`,
      mcq: `<span class="ta ta-mcq"><i></i><i class="on"></i><i></i></span>`,
      vignette: `<span class="ta ta-vig"><i></i><i></i><i></i><b></b></span>`,
    };
    return arts[id];
  }

  function builderFields() {
    const b = state.builder, f = b.fields[b.template];
    const field = (key, label, { area = false, rows = 3, hint = "", placeholder = "" } = {}) => `
      <label class="field"><span class="field__label">${label}</span>
        ${area ? `<textarea rows="${rows}" data-input="builder" data-key="${key}" placeholder="${esc(placeholder)}">${esc(f[key])}</textarea>`
               : `<input data-input="builder" data-key="${key}" value="${esc(f[key])}" placeholder="${esc(placeholder)}">`}
        ${hint ? `<span class="field__hint">${hint}</span>` : ""}
      </label>`;

    switch (b.template) {
      case "basic":
        return field("front", "Front · question", { area: true }) + field("back", "Back · answer", { area: true, rows: 2 }) +
          field("extra", "Extra context <small>optional</small>", { area: true, rows: 2, hint: "Shown after the answer — mnemonics, clinical pearls, sources." });
      case "cloze":
        return `
          <label class="field"><span class="field__label">Sentence</span>
            <textarea rows="4" id="cloze-text" data-input="builder" data-key="text">${esc(f.text)}</textarea>
            <span class="field__hint">Select words and press <button class="btn btn--secondary btn--xs" data-action="cloze-wrap">Hide selection</button> — each hidden phrase becomes its own card.</span>
          </label>` + field("extra", "Extra context <small>optional</small>", { area: true, rows: 2 });
      case "occlusion":
        return field("prompt", "Prompt") + `
          <div class="field"><span class="field__label">Diagram</span>
            <div class="occ-editor">
              ${occlusionSvg({ masked: f.masked, interactive: true })}
            </div>
            <span class="field__hint">${icon("image", 12)} Skull base — internal view (schematic). Click a label to hide or show it. ${plural(f.masked.length, "hidden label")} → ${plural(f.masked.length, "card")}.</span>
          </div>`;
      case "mcq":
        return field("stem", "Question", { area: true }) + `
          <fieldset class="field"><legend class="field__label">Options <small>select the correct answer</small></legend>
            ${f.options.map((o, i) => `
              <div class="option-input ${f.correct === i ? "is-correct" : ""}">
                <input type="radio" name="mcq-correct" id="mcq-${i}" ${f.correct === i ? "checked" : ""} data-input="mcq-correct" data-index="${i}" aria-label="Mark option ${String.fromCharCode(65 + i)} correct">
                <span class="option-input__letter">${String.fromCharCode(65 + i)}</span>
                <input class="option-input__text" value="${esc(o)}" data-input="mcq-option" data-index="${i}" aria-label="Option ${String.fromCharCode(65 + i)}">
              </div>`).join("")}
          </fieldset>` + field("explanation", "Explanation", { area: true, rows: 2 });
      case "vignette":
        return field("case", "Case presentation", { area: true, rows: 4 }) + field("question", "Question") +
          field("answer", "Answer") + field("explanation", "Teaching point", { area: true, rows: 2 });
    }
    return "";
  }

  function builderPreview() {
    const b = state.builder, f = b.fields[b.template], back = b.side === "back";
    let body = "";
    switch (b.template) {
      case "basic":
        body = `<p class="fc__prompt">${esc(f.front) || "<span class='muted'>Your question appears here</span>"}</p>
          ${back ? `<hr class="fc__rule"><p class="fc__answer">${esc(f.back)}</p>${f.extra ? `<p class="fc__extra">${esc(f.extra)}</p>` : ""}` : ""}`;
        break;
      case "cloze":
        body = `<p class="fc__prompt">${renderClozeText(f.text, back ? "back" : "front")}</p>${back && f.extra ? `<p class="fc__extra">${esc(f.extra)}</p>` : ""}`;
        break;
      case "occlusion":
        body = `<p class="fc__prompt fc__prompt--sm">${esc(f.prompt)}</p>${occlusionSvg({ masked: f.masked, target: f.masked[0], reveal: back })}
          ${back ? `<p class="fc__answer">${esc(f.masked[0] || "")}</p>` : ""}`;
        break;
      case "mcq":
        body = `<p class="fc__prompt">${esc(f.stem)}</p>
          <ol class="mcq">${f.options.map((o, i) => `<li class="mcq__opt ${back && i === f.correct ? "is-correct" : ""}"><span>${String.fromCharCode(65 + i)}</span>${esc(o)}${back && i === f.correct ? `<em>${icon("check", 14)}Correct</em>` : ""}</li>`).join("")}</ol>
          ${back ? `<p class="fc__extra">${esc(f.explanation)}</p>` : ""}`;
        break;
      case "vignette":
        body = `<p class="fc__case">${esc(f.case)}</p><p class="fc__prompt">${esc(f.question)}</p>
          ${back ? `<hr class="fc__rule"><p class="fc__answer">${esc(f.answer)}</p><p class="fc__extra"><strong>Teaching point.</strong> ${esc(f.explanation)}</p>` : ""}`;
        break;
    }
    const tpl = D.templates.find((t) => t.id === b.template);
    const count = b.template === "cloze" ? Math.max(1, (f.text.match(/\{\{.+?\}\}/g) || []).length)
      : b.template === "occlusion" ? Math.max(1, f.masked.length) : 1;
    return `
      <div class="flashcard flashcard--preview">
        <div class="flashcard__meta"><span class="chip chip--lavender">${esc(tpl.name)}</span><span class="caption">${back ? "Back" : "Front"}</span></div>
        <div class="flashcard__body">${body}</div>
      </div>
      <p class="caption builder__count">${icon("layers", 14)} Creates ${plural(count + (b.advanced.reverse && b.template === "basic" ? 1 : 0), "card")} · ${esc(b.advanced.section)}</p>`;
  }

  function renderClozeText(text, mode) {
    // mode: front (mask first cloze, show others), back (reveal first), preview (underline all)
    let i = 0;
    return esc(text).replace(/\{\{(.+?)\}\}/g, (_, inner) => {
      const first = i++ === 0;
      if (mode === "preview") return `<mark class="cloze cloze--soft">${inner}</mark>`;
      if (mode === "front") return first ? `<span class="cloze cloze--blank" aria-label="blank">[ … ]</span>` : inner;
      return first ? `<mark class="cloze cloze--revealed">${inner}</mark>` : inner;
    });
  }

  /* Skull base schematic used for image-occlusion cards --------------------- */
  const FORAMINA = [
    { name: "Optic canal", hx: 190, hy: 74, ly: 40 },
    { name: "Superior orbital fissure", hx: 214, hy: 92, ly: 72 },
    { name: "Foramen rotundum", hx: 222, hy: 114, ly: 104 },
    { name: "Foramen ovale", hx: 230, hy: 136, ly: 136 },
    { name: "Foramen spinosum", hx: 242, hy: 150, ly: 168 },
    { name: "Jugular foramen", hx: 238, hy: 196, ly: 200 },
    { name: "Hypoglossal canal", hx: 206, hy: 214, ly: 232 },
    { name: "Foramen magnum", hx: 190, hy: 236, ly: 264 },
  ];
  function occlusionSvg({ masked = [], target = null, reveal = false, interactive = false } = {}) {
    const holes = FORAMINA.map((f) => {
      const mx = 340 - f.hx;
      const r = f.name === "Foramen magnum" ? 0 : 5;
      return r ? `<ellipse cx="${f.hx}" cy="${f.hy}" rx="${r + 2}" ry="${r}" class="occ__hole"/><ellipse cx="${mx}" cy="${f.hy}" rx="${r + 2}" ry="${r}" class="occ__hole"/>` : "";
    }).join("");
    const labels = FORAMINA.map((f) => {
      const isMasked = masked.includes(f.name);
      const isTarget = target === f.name;
      const hidden = interactive ? isMasked : (isTarget && !reveal);
      const cls = ["occ__label", hidden ? "is-masked" : "", isTarget && reveal ? "is-revealed" : "", interactive && isMasked ? "is-selected" : ""].join(" ");
      const tag = interactive ? `role="button" tabindex="0" aria-pressed="${isMasked}" aria-label="${esc(f.name)} — ${isMasked ? "hidden" : "visible"}" data-action="occ-toggle" data-value="${esc(f.name)}"` : "";
      return `<g class="${cls}" ${tag}>
        <line x1="${f.hx + 6}" y1="${f.hy}" x2="342" y2="${f.ly}" class="occ__leader"/>
        <rect x="344" y="${f.ly - 11}" width="132" height="22" rx="5" class="occ__box"/>
        <text x="352" y="${f.ly + 4}" class="occ__text">${hidden ? (isTarget || interactive ? "?" : "") : esc(f.name)}</text>
      </g>`;
    }).join("");
    return `<svg class="occ" viewBox="0 0 480 290" role="img" aria-label="Schematic of the internal skull base showing foramina${target && !reveal ? ", one label hidden" : ""}">
      <ellipse cx="170" cy="150" rx="150" ry="132" class="occ__skull"/>
      <path d="M60 110 Q170 60 280 110" class="occ__ridge"/><path d="M70 175 Q170 140 270 175" class="occ__ridge"/>
      <ellipse cx="170" cy="236" rx="24" ry="20" class="occ__hole occ__hole--lg"/>
      <rect x="160" y="96" width="20" height="26" rx="6" class="occ__sella"/>
      ${holes}${labels}
    </svg>`;
  }

  /* ---------- Study picker ---------------------------------------------- */
  function viewStudyHub() {
    const due = D.collections.filter((c) => c.due > 0);
    return `
      <header class="page-header">
        <div><h1 class="title">Study</h1><p class="lede">Pick up today’s reviews or focus on one collection.</p></div>
      </header>
      <section class="card hero hero--compact">
        <div class="hero__main">
          <p class="overline">Today</p>
          <h2 class="hero__count"><span class="num">${state.dueToday}</span> cards due across your courses</h2>
          <div class="hero__actions">${state.dueToday ? `<a class="btn btn--primary btn--lg" href="#/study/today">${icon("play", 16)}Start Reviewing</a>` : `<span class="badge badge--success">${icon("check", 12)}All caught up</span>`}</div>
        </div>
      </section>
      <h2 class="overline section-label">Collections with reviews due</h2>
      <ul class="row-list card">${due.map((x) => `
        <li><a class="row" href="#/study/${x.id}">
          <span class="row__icon">${icon("layers", 18)}</span>
          <span class="row__main"><strong>${esc(x.title)}</strong><small>${esc(courseById(x.courseId).name)} · ${x.cards} cards</small></span>
          <span class="row__meta">${statusBadge(x.due)}</span>${icon("chevronRight", 16, "row__chev")}
        </a></li>`).join("")}</ul>
      <h2 class="overline section-label">Study modes</h2>
      <div class="mode-grid mode-grid--wide">
        <div class="mode mode--static">${icon("refresh", 20)}<strong>Spaced review</strong><small>Cards return right before you’re likely to forget them.</small></div>
        <div class="mode mode--static">${icon("study", 20)}<strong>Flashcards</strong><small>Flip through freely. Doesn’t affect scheduling.</small></div>
        <div class="mode mode--static">${icon("target", 20)}<strong>Practice quiz</strong><small>Recognition practice. Tracked separately from recall.</small></div>
        <div class="mode mode--static">${icon("book", 20)}<strong>Clinical cases</strong><small>Apply knowledge to vignettes.</small></div>
      </div>`;
  }

  /* ---------- Study session --------------------------------------------- */
  function startSession(id) {
    const col = collectionById(id);
    const queue = id === "today" ? D.reviewQueue.slice(0, 12) : (col?.cardList || D.reviewQueue).slice(0, 9);
    state.session = {
      id, title: id === "today" ? "Today’s review" : `${col.title}`,
      queue, index: 0, revealed: false, paused: false, picked: null,
      ratings: [], startedAt: Date.now(), showKeys: store.get("showKeys", true), finished: false,
    };
  }

  function viewSession(id) {
    if (!state.session || state.session.id !== id || state.session.finished && !state.session.keepSummary) startSession(id);
    const s = state.session;
    if (s.finished) return viewSummary();
    const card = s.queue[s.index];
    const total = s.queue.length;
    const prev = Scheduler.preview(card);
    const col = card.collection || (collectionById(id)?.title ?? "Cranial Nerves");

    return `
      <div class="session ${s.paused ? "is-paused" : ""}">
        <header class="session__bar">
          <button class="icon-btn" data-action="session-exit" aria-label="Exit session">${icon("x", 18)}</button>
          <div class="session__progress">
            <div class="session__title"><span>${esc(s.title)}</span><span class="caption">${s.index + 1} of ${total}</span></div>
            ${progressBar(s.index / total, "Session progress", "progress--thin")}
          </div>
          <button class="icon-btn" data-action="session-pause" aria-label="${s.paused ? "Resume" : "Pause"} session">${icon(s.paused ? "play" : "pause", 18)}</button>
        </header>

        <main class="session__stage">
          <article class="flashcard flashcard--study ${s.revealed ? "is-revealed" : ""}" aria-live="polite">
            <div class="flashcard__meta">
              <span class="caption">${esc(col)} · ${esc(card.section)}</span>
              <button class="icon-btn icon-btn--sm ${state.flagged.has(card.id) ? "is-on" : ""}" data-action="session-flag" aria-pressed="${state.flagged.has(card.id)}" aria-label="Flag card for later">${icon("flag", 16)}</button>
            </div>
            <div class="flashcard__body">${sessionCardBody(card, s)}</div>
          </article>
        </main>

        <footer class="session__controls">
          ${s.revealed ? `
            <div class="ratings" role="group" aria-label="How well did you recall it?">
              ${[["again", "Again", "Didn’t recall", 1], ["hard", "Hard", "Recalled with effort", 2], ["good", "Good", "Recalled", 3], ["easy", "Easy", "Instant recall", 4]].map(([k, l, d, n]) => `
                <button class="rating rating--${k}" data-action="rate" data-value="${k}">
                  <span class="rating__label">${l}</span>
                  <span class="rating__desc">${d}</span>
                  <span class="rating__next">${Scheduler.label(prev[k])}</span>
                  ${s.showKeys ? `<kbd>${n}</kbd>` : ""}
                </button>`).join("")}
            </div>
            <p class="caption session__explain"><button class="link" data-action="explain-scheduling">${icon("info", 12)} How scheduling works</button><span class="session__explain-extra"> · times show when you’ll see this card next</span></p>` : `
            <button class="btn btn--primary btn--xl" data-action="reveal" ${card.type === "mcq" && s.picked == null ? "" : ""}>Reveal answer ${s.showKeys ? "<kbd>Space</kbd>" : ""}</button>
            <p class="caption">Try to recall the answer before revealing.</p>`}
          <div class="session__keys">
            <button class="link link--muted" data-action="toggle-keys" aria-pressed="${s.showKeys}">${icon("keyboard", 14)} ${s.showKeys ? "Hide" : "Show"} shortcuts</button>
            ${s.showKeys ? `<span class="caption">Space reveal · 1–4 rate · F flag · P pause · Esc exit</span>` : ""}
          </div>
        </footer>

        ${s.paused ? `
          <div class="session__pause" role="dialog" aria-modal="true" aria-label="Session paused">
            <div class="card pause-card">
              <h2 class="heading">Paused</h2>
              <p class="caption">${s.index} of ${total} reviewed. Your progress is saved.</p>
              <div class="stack-h">
                <button class="btn btn--primary" data-action="session-pause" autofocus>${icon("play", 16)}Resume</button>
                <button class="btn btn--ghost" data-action="session-end">End session</button>
              </div>
            </div>
          </div>` : ""}
      </div>`;
  }

  function sessionCardBody(card, s) {
    const back = s.revealed;
    switch (card.type) {
      case "cloze":
        return `<p class="fc__prompt">${renderClozeText(card.front, back ? "back" : "front")}</p>${back && card.extra ? `<p class="fc__extra">${esc(card.extra)}</p>` : ""}`;
      case "occlusion":
        return `<p class="fc__prompt fc__prompt--sm">${esc(card.front)}</p>${occlusionSvg({ target: "Foramen rotundum", reveal: back })}
          ${back ? `<p class="fc__answer">${esc(card.back)}</p><p class="fc__extra">${esc(card.extra)}</p>` : ""}`;
      case "mcq":
        return `<p class="fc__prompt">${esc(card.front)}</p>
          <ol class="mcq mcq--interactive">${card.options.map((o, i) => {
            const cls = back ? (i === card.answer ? "is-correct" : i === s.picked ? "is-wrong" : "") : (i === s.picked ? "is-picked" : "");
            return `<li><button class="mcq__opt ${cls}" data-action="mcq-pick" data-index="${i}" ${back ? "disabled" : ""} aria-pressed="${i === s.picked}"><span>${String.fromCharCode(65 + i)}</span>${esc(o)}
              ${back && i === card.answer ? `<em>${icon("check", 14)}Correct</em>` : ""}${back && i === s.picked && i !== card.answer ? `<em>${icon("x", 14)}Your answer</em>` : ""}</button></li>`;
          }).join("")}</ol>
          ${back ? `<p class="fc__extra">${esc(card.extra)}</p>` : ""}`;
      case "vignette":
        return `<span class="chip chip--sage">Clinical vignette</span><p class="fc__case">${esc(card.front)}</p>
          ${back ? `<hr class="fc__rule"><p class="fc__answer">${esc(card.back)}</p><p class="fc__extra"><strong>Teaching point.</strong> ${esc(card.extra)}</p>` : ""}`;
      default:
        return `<p class="fc__prompt">${esc(card.front)}</p>
          ${back ? `<hr class="fc__rule"><p class="fc__answer">${esc(card.back)}</p>${card.extra ? `<p class="fc__extra">${esc(card.extra)}</p>` : ""}` : ""}`;
    }
  }

  function rate(value) {
    const s = state.session;
    if (!s || !s.revealed || s.paused) return;
    const card = s.queue[s.index];
    const next = Scheduler.apply(card, value);
    s.ratings.push({ card, value, next });
    if (value === "again") s.queue.push(card); // relearn later in this session
    s.index++;
    s.revealed = false;
    s.picked = null;
    if (s.index >= s.queue.length || s.ratings.filter((r) => r.value !== "again").length >= new Set(s.queue.map((c) => c.id)).size) {
      finishSession();
    }
    render();
  }

  function finishSession() {
    const s = state.session;
    s.finished = true;
    s.keepSummary = true;
    const unique = new Set(s.ratings.map((r) => r.card.id)).size;
    if (s.id === "today") state.dueToday = Math.max(0, state.dueToday - 30);
    else state.dueToday = Math.max(0, state.dueToday - unique);
    state.reviewedToday += unique;
    const col = collectionById(s.id);
    if (col) col.due = Math.max(0, col.due - unique);
    state.lastSession = s;
  }

  function viewSummary() {
    const s = state.session;
    const counts = { again: 0, hard: 0, good: 0, easy: 0 };
    s.ratings.forEach((r) => counts[r.value]++);
    const total = s.ratings.length || 1;
    const unique = new Set(s.ratings.map((r) => r.card.id)).size;
    const minutes = Math.max(1, Math.round((Date.now() - s.startedAt) / 60000));
    const weak = {};
    s.ratings.filter((r) => r.value === "again" || r.value === "hard").forEach((r) => {
      weak[r.card.section] = (weak[r.card.section] || 0) + 1;
    });
    const weakList = Object.entries(weak).sort((a, b) => b[1] - a[1]);
    const lastRating = {};
    s.ratings.forEach((r) => { lastRating[r.card.id] = r; });
    const upcoming = Object.values(lastRating).sort((a, b) => a.next - b.next);

    return `
      <div class="summary">
        <div class="summary__inner">
          <div class="summary__icon">${icon("check", 28)}</div>
          <h1 class="title">Session complete</h1>
          <p class="lede">You reviewed ${plural(unique, "card")} in about ${plural(minutes, "minute")}. Each card has been rescheduled based on your ratings.</p>

          <section class="card summary__stats" aria-label="Ratings breakdown">
            <div class="stacked-bar" role="img" aria-label="Again ${counts.again}, Hard ${counts.hard}, Good ${counts.good}, Easy ${counts.easy}">
              ${["again", "hard", "good", "easy"].map((k) => counts[k] ? `<span class="stacked-bar__seg rating-bg--${k}" style="flex:${counts[k] / total}"></span>` : "").join("")}
            </div>
            <ul class="legend">
              ${["again", "hard", "good", "easy"].map((k) => `<li><span class="legend__swatch rating-bg--${k}"></span>${k[0].toUpperCase() + k.slice(1)} <strong>${counts[k]}</strong></li>`).join("")}
            </ul>
          </section>

          <div class="summary__grid">
            <section class="card">
              <h2 class="heading">Needs more practice</h2>
              ${weakList.length ? `<ul class="weak-list">${weakList.map(([sec, n]) => `<li><span>${esc(sec)}</span><span class="badge badge--warning">${n} missed or hard</span></li>`).join("")}</ul>
                <p class="caption">These cards will come back sooner. You can also drill them now.</p>
                <button class="btn btn--secondary btn--sm" data-action="drill-weak">${icon("target", 14)}Drill these now</button>`
                : `<p class="caption">Nothing flagged as weak this session. Nice work.</p>`}
            </section>
            <section class="card">
              <h2 class="heading">Next time you’ll see</h2>
              <ul class="next-list">${upcoming.slice(0, 5).map((r) => `<li><span class="next-list__q">${esc(r.card.front.replace(/\{\{|\}\}/g, "").slice(0, 60))}…</span><span class="caption">in ${Scheduler.label(r.next)}</span></li>`).join("")}</ul>
            </section>
          </div>
          ${prototypeNote("Intervals here come from a simplified prototype scheduler, not Kivo’s production algorithm.")}
          <div class="stack-h stack-h--center">
            <a class="btn btn--primary btn--lg" href="#/home" data-action="session-done">Back to Home</a>
            ${collectionById(s.id)?.copies || s.id === "today" ? `<button class="btn btn--secondary btn--lg" data-action="open-share" data-id="hna-cn">${icon("share", 16)}Share with study group</button>` : ""}
          </div>
        </div>
      </div>`;
  }

  /* ---------- Explore --------------------------------------------------- */
  function viewExplore() {
    const opts = (k) => [...new Set(D.explore.map((e) => e[k]))].sort();
    const sel = (k, label) => `
      <label class="select select--filter ${state.exploreFilters[k] ? "is-set" : ""}">
        <span class="sr-only">${label}</span>
        <select data-change="explore-filter" data-key="${k}">
          <option value="">${label}: Any</option>
          ${opts(k).map((o) => `<option value="${esc(o)}" ${state.exploreFilters[k] === o ? "selected" : ""}>${esc(o)}</option>`).join("")}
        </select>
      </label>`;
    return `
      <header class="page-header">
        <div><h1 class="title">Explore</h1><p class="lede">Collections shared by students in your programs. Add any of them as your own copy, then make it yours.</p></div>
      </header>
      <div class="toolbar toolbar--stack" role="search">
        <label class="search search--lg">${icon("search", 18)}<span class="sr-only">Search shared collections</span>
          <input type="search" placeholder="Search by topic, course or creator — try “cranial” or “pharmacology”" value="${esc(state.exploreQuery)}" data-input="explore-query" autocomplete="off"></label>
        <div class="filter-row">
          ${sel("program", "Program")}${sel("course", "Course")}${sel("topic", "Topic")}${sel("institution", "Institution")}
          ${Object.values(state.exploreFilters).some(Boolean) ? `<button class="link" data-action="clear-explore">Clear filters</button>` : ""}
        </div>
      </div>
      <div id="explore-results" aria-live="polite">${exploreResults()}</div>`;
  }

  function exploreResults() {
    const q = state.exploreQuery.trim().toLowerCase();
    const f = state.exploreFilters;
    const items = D.explore.filter((e) =>
      (!f.program || e.program === f.program) && (!f.course || e.course === f.course) &&
      (!f.topic || e.topic === f.topic) && (!f.institution || e.institution === f.institution) &&
      (!q || [e.title, e.course, e.topic, e.creator, e.program].join(" ").toLowerCase().includes(q)));
    if (!items.length) return emptyState("No shared collections found", "Try a broader topic or remove a filter.", `<button class="btn btn--secondary" data-action="clear-explore">Clear filters</button>`);
    return `<p class="caption result-count">${plural(items.length, "collection")}</p>
      <div class="explore-grid">${items.map((e) => `
        <article class="card explore-card">
          <div class="explore-card__head">
            <span class="chip chip--neutral">${esc(e.program)}</span>
            ${e.verified ? `<span class="badge badge--accent">${icon("verified", 12)}TA reviewed</span>` : ""}
          </div>
          <h3 class="subhead">${esc(e.title)}</h3>
          <p class="caption">${esc(e.course)} · ${e.cards} cards · ${esc(e.version)}</p>
          <ul class="explore-card__preview" aria-label="Sample cards">${e.preview.map((p) => `<li>${esc(p)}</li>`).join("")}</ul>
          <div class="explore-card__creator">${avatar(e.initials, "sm")}<span><strong>${esc(e.creator)}</strong> · ${esc(e.role)}<br><small>${esc(e.institution)}</small></span></div>
          <div class="explore-card__foot">
            <span class="caption">Updated ${esc(e.updated)} · ${e.saves.toLocaleString()} saves</span>
            <div class="stack-h">
              <button class="btn btn--ghost btn--sm" data-action="explore-preview" data-id="${e.id}">Preview</button>
              <button class="btn btn--secondary btn--sm" data-action="explore-save" data-id="${e.id}">${icon("fork", 14)}Add copy</button>
            </div>
          </div>
        </article>`).join("")}</div>`;
  }

  /* ---------- Insights -------------------------------------------------- */
  function viewInsights() {
    const ins = D.insights;
    const max = Math.max(...ins.activity);
    const days = ins.activity.length;
    const studied = ins.activity.filter(Boolean).length;
    const total = ins.activity.reduce((a, b) => a + b, 0);
    const upMax = Math.max(...ins.upcoming.map((u) => u.n));
    const W = 560, H = 140, bw = W / days;

    return `
      <header class="page-header">
        <div><h1 class="title">Insights</h1><p class="lede">What to study next, based on your last 4 weeks.</p></div>
      </header>

      <section class="card recommend" aria-labelledby="rec-title">
        <div class="recommend__icon">${icon("target", 20)}</div>
        <div class="recommend__body">
          <p class="overline">Recommended next</p>
          <h2 id="rec-title" class="heading">Spend 15 minutes on Biochemistry</h2>
          <p class="caption">Its estimated retention is your lowest (68%) and the midterm is in 4 weeks. Start with glycolysis regulation, which you’ve missed 9 times this week.</p>
        </div>
        <a class="btn btn--primary" href="#/study/bio-gly">${icon("play", 16)}Practice now</a>
      </section>

      <div class="stat-row">
        <div class="stat card"><p class="caption">Study days</p><p class="stat__value">${studied}<small>/${days}</small></p><p class="caption">Last 4 weeks</p></div>
        <div class="stat card"><p class="caption">Reviews</p><p class="stat__value">${total.toLocaleString()}</p><p class="caption">≈ ${Math.round(total / studied)} per study day</p></div>
        <div class="stat card"><p class="caption">Estimated retention</p><p class="stat__value">82%</p><p class="caption">Across mature cards</p></div>
        <div class="stat card"><p class="caption">Current streak</p><p class="stat__value">${D.user.streakDays}<small> days</small></p><p class="caption">Rest days don’t reset it</p></div>
      </div>

      <div class="insights-grid">
        <section class="card" aria-labelledby="act-title">
          <div class="card__head"><h2 id="act-title" class="heading">Review activity</h2><span class="caption">Last 28 days</span></div>
          <svg class="chart" viewBox="0 0 ${W} ${H + 24}" role="img" aria-label="Bar chart of daily reviews over the last 28 days. ${studied} study days, ${total} reviews in total, peak ${max} in a day.">
            ${[0.5, 1].map((t) => `<line x1="0" x2="${W}" y1="${H - H * t}" y2="${H - H * t}" class="chart__grid"/><text x="${W}" y="${H - H * t - 4}" class="chart__axis" text-anchor="end">${Math.round(max * t)}</text>`).join("")}
            <line x1="0" x2="${W}" y1="${H}" y2="${H}" class="chart__base"/>
            ${ins.activity.map((v, i) => `<rect x="${i * bw + 2}" y="${H - (v / max) * H}" width="${bw - 4}" height="${Math.max(v ? 2 : 0, (v / max) * H)}" rx="2" class="chart__bar ${i === days - 1 ? "is-today" : ""}"><title>${v} reviews</title></rect>`).join("")}
            <text x="0" y="${H + 18}" class="chart__axis">Oct 9</text><text x="${W}" y="${H + 18}" class="chart__axis" text-anchor="end">Today</text>
          </svg>
        </section>

        <section class="card" aria-labelledby="load-title">
          <div class="card__head"><h2 id="load-title" class="heading">Upcoming review load</h2><span class="caption">Next 7 days</span></div>
          <ul class="load-list">
            ${ins.upcoming.map((u) => `<li><span class="load-list__day">${u.day}</span><span class="load-list__bar"><span style="width:${(u.n / upMax) * 100}%"></span></span><span class="load-list__n">${u.n}</span></li>`).join("")}
          </ul>
          <p class="caption">Monday is heavy. Doing ~10 extra reviews over the weekend evens it out.</p>
        </section>

        <section class="card" aria-labelledby="subj-title">
          <div class="card__head"><h2 id="subj-title" class="heading">Estimated retention by course</h2></div>
          <ul class="subject-list">
            ${ins.subjects.map((s) => {
              const tone = s.retention >= 0.85 ? ["success", "Strong"] : s.retention >= 0.75 ? ["neutral", "Steady"] : ["warning", "Needs work"];
              return `<li>
                <div class="subject-list__top"><span class="body-strong">${esc(s.course)}</span><span class="subject-list__val">${pct(s.retention)} <small class="${s.trend >= 0 ? "up" : "down"}">${s.trend >= 0 ? "▲" : "▼"} ${Math.abs(s.trend)}</small></span></div>
                ${progressBar(s.retention, `${s.course} estimated retention`, `progress--${tone[0]}`)}
                <div class="subject-list__foot"><span class="badge badge--${tone[0]}">${tone[1]}</span><span class="caption">${s.reviewed} reviews</span></div>
              </li>`;
            }).join("")}
          </ul>
          ${prototypeNote("Estimated retention is the share of mature cards you’d likely recall today, based on past answers. It measures recall of your cards, not exam readiness.")}
        </section>

        <section class="card" aria-labelledby="weak-title">
          <div class="card__head"><h2 id="weak-title" class="heading">Topics to revisit</h2></div>
          <ul class="row-list row-list--plain">
            ${ins.weakTopics.map((w) => `<li><a class="row" href="#/study/${w.collection}">
              <span class="row__icon row__icon--warning">${icon("alert", 16)}</span>
              <span class="row__main"><strong>${esc(w.topic)}</strong><small>${esc(w.course)} · missed ${w.lapses}× in 7 days</small></span>
              <span class="btn btn--secondary btn--sm">Practice</span></a></li>`).join("")}
          </ul>
        </section>
      </div>`;
  }

  function viewNotFound() {
    return emptyState("Page not found", "That page doesn’t exist in this prototype.", `<a class="btn btn--primary" href="#/home">Go home</a>`);
  }

  /* ======================================================================
     MODALS
     ====================================================================== */

  function openShare(id) {
    const col = collectionById(id) || collectionById("hna-cn");
    const copies = col.copies || [];
    openModal(`
      <header class="modal__head">
        <div><h2 class="heading">Share “${esc(col.title)}”</h2><p class="caption">${sourceBadge(col.source)} ${col.cards} cards</p></div>
        <button class="icon-btn" data-action="close-modal" aria-label="Close">${icon("x", 18)}</button>
      </header>
      <div class="modal__body">
        <div class="principle">
          ${icon("fork", 18)}
          <div><p class="body-strong">Everyone gets their own copy</p>
          <p class="caption">People you share with add an independent copy to their library. They can reword, reorganize and study it their way, and nothing they change affects your version. Their schedule and progress stay private.</p></div>
        </div>

        ${col.edits ? `
        <fieldset class="share-what">
          <legend class="field__label">What should they start from?</legend>
          <label class="radio-card"><input type="radio" name="share-what" checked>
            <span><strong>Your version</strong><small>Includes your ${col.edits.cards} reworded cards and ${col.edits.added} additions.</small></span></label>
          <label class="radio-card"><input type="radio" name="share-what">
            <span><strong>Priya’s source</strong><small>They start from the original. Your changes stay private to you.</small></span></label>
        </fieldset>` : ""}

        <div class="field">
          <label class="field__label" for="invite">Send to</label>
          <div class="invite">
            <input id="invite" placeholder="Classmate, email or study group" autofocus>
            <button class="btn btn--primary" data-action="share-invite">Send copy</button>
          </div>
        </div>

        <div>
          <p class="field__label">Already have a copy</p>
          <ul class="people people--modal" id="share-people">
            ${copies.map((p) => `<li>${avatar(p.initials, "sm", p.group ? "avatar--group" : "")}<span><strong>${esc(p.name)}</strong><small>${esc(p.status)}</small></span></li>`).join("") || `<li class="caption">Nobody yet.</li>`}
          </ul>
        </div>

        <label class="switch switch--block"><input type="checkbox" checked><span class="switch__track"></span>
          <span><strong>Offer my future changes as suggestions</strong><small>People who follow can accept or skip each change. Their own edits are never overwritten.</small></span></label>

        <div class="link-row">
          <span class="link-row__icon">${icon("link", 16)}</span>
          <div class="link-row__body">
            <label for="link-access" class="body-strong">Who can get a copy from the link</label>
            <select id="link-access"><option>Only people I send it to</option><option selected>Anyone at Pacific College of Optometry</option><option>Anyone with the link</option></select>
          </div>
        </div>
      </div>
      <footer class="modal__foot">
        <button class="btn btn--ghost" data-action="copy-link">${icon("copy", 16)}Copy link</button>
        <button class="btn btn--primary" data-action="close-modal">Done</button>
      </footer>`, { label: `Share ${col.title}` });
  }

  function openSuggestions() {
    openModal(`
      <header class="modal__head"><div><h2 class="heading">Suggested updates</h2><p class="caption">From Priya Shah’s source · v3.3</p></div><button class="icon-btn" data-action="close-modal" aria-label="Close">${icon("x", 18)}</button></header>
      <div class="modal__body">
        <p class="caption">Your copy is yours: nothing changes unless you accept it. Cards you’ve reworded are never overwritten.</p>
        <ul class="suggest-list">
          <li class="suggest-item">
            <span class="badge badge--accent">Corrected answer</span>
            <p class="body-strong">CN VII · Which ganglion relays parasympathetics to the submandibular gland?</p>
            <p class="diff"><del>Pterygopalatine ganglion</del> <ins>Submandibular ganglion</ins></p>
            <div class="suggest-item__actions"><button class="btn btn--ghost btn--sm" data-action="suggestion-skip">Skip</button><button class="btn btn--secondary btn--sm" data-action="suggestion-accept">Accept</button></div>
          </li>
          <li class="suggest-item">
            <span class="badge badge--sage">New card</span>
            <p class="body-strong">CN VI · Which muscle does the abducens nerve innervate?</p>
            <p class="caption">Lateral rectus — “LR6”.</p>
            <div class="suggest-item__actions"><button class="btn btn--ghost btn--sm" data-action="suggestion-skip">Skip</button><button class="btn btn--secondary btn--sm" data-action="suggestion-accept">Accept</button></div>
          </li>
          <li class="suggest-item is-protected">
            <span class="badge badge--neutral">${icon("lock", 12)}You reworded this card</span>
            <p class="body-strong">CN III · Pupil-sparing palsy vignette</p>
            <p class="caption">Priya edited the explanation. Your version is kept — compare if you like.</p>
            <div class="suggest-item__actions"><button class="btn btn--ghost btn--sm" data-action="suggestion-skip">Keep mine</button><button class="btn btn--ghost btn--sm" data-action="suggestion-accept">Use theirs</button></div>
          </li>
        </ul>
      </div>
      <footer class="modal__foot"><button class="btn btn--primary" data-action="close-modal">Done</button></footer>`, { label: "Suggested updates" });
  }

  function openImport(courseId = "hna") {
    const step = (n, html) => `<ol class="steps" aria-label="Import steps">${["Source", "Organize", "Review"].map((s, i) => `<li class="${i + 1 === n ? "is-current" : i + 1 < n ? "is-done" : ""}">${i + 1 < n ? icon("check", 12) : i + 1}<span>${s}</span></li>`).join("")}</ol>${html}`;
    const render1 = () => openModal(`
      <header class="modal__head"><h2 class="heading">Import a collection</h2><button class="icon-btn" data-action="close-modal" aria-label="Close">${icon("x", 18)}</button></header>
      <div class="modal__body">
        ${step(1, `
        <label class="field"><span class="field__label">Paste a Kivo share link</span>
          <input id="import-link" value="kivo.app/s/jlee/HN_Lec4_Final" autofocus></label>
        <div class="divider"><span>or</span></div>
        <button class="dropzone" data-action="import-next">${icon("upload", 22)}<strong>Upload a deck file</strong><small>.apkg (Anki), .csv, or Quizlet export</small></button>
        <div class="import-found">
          ${avatar("JL", "sm")}<div><p class="body-strong">HN_Lec4_Final</p><p class="caption">Shared by Jordan Lee · 71 cards · updated 2 days ago</p></div>
        </div>`)}
      </div>
      <footer class="modal__foot"><button class="btn btn--ghost" data-action="close-modal">Cancel</button><button class="btn btn--primary" data-action="import-next">Continue</button></footer>`, { label: "Import a collection" });

    const render2 = () => openModal(`
      <header class="modal__head"><h2 class="heading">Organize this collection</h2><button class="icon-btn" data-action="close-modal" aria-label="Close">${icon("x", 18)}</button></header>
      <div class="modal__body">
        ${step(2, `
        <div class="suggestion">
          <div class="suggestion__head">${icon("sparkle", 16)}<span class="body-strong">Suggested name</span><span class="badge badge--neutral">Prototype</span></div>
          <p class="suggestion__from"><span class="caption">Imported as</span> <code>HN_Lec4_Final</code></p>
          <p class="suggestion__to">Head &amp; Neck Anatomy <span>/</span> Lecture 04 <span>/</span> Cranial Nerves</p>
          <p class="caption">Based on the file name, card content and your course list. You can keep the original name — it’s saved as an alias either way.</p>
        </div>
        <div class="field-row field-row--3">
          <label class="field"><span class="field__label">Course</span><select><option selected>Head &amp; Neck Anatomy</option>${D.courses.slice(1).map((c) => `<option>${esc(c.name)}</option>`).join("")}</select></label>
          <label class="field"><span class="field__label">Lecture / unit</span><input value="Lecture 04"></label>
          <label class="field"><span class="field__label">Topic</span><input value="Cranial Nerves"></label>
        </div>
        <div class="field-row">
          <label class="field"><span class="field__label">Assessment</span><select><option>Exam 2 · Nov 13</option><option>Exam 1</option><option>Final</option></select></label>
          <label class="field"><span class="field__label">Tags</span><input value="neuro, exam-2"></label>
        </div>
        <div class="warning-box" role="note">
          ${icon("alert", 16)}
          <div><p class="body-strong">Possible duplicate</p>
          <p class="caption">38 of 71 cards closely match your “Cranial Nerves” collection.</p>
          <div class="choice-row" role="radiogroup" aria-label="How to handle duplicates">
            <label class="chip-radio"><input type="radio" name="dup" checked><span>Merge new cards only (33)</span></label>
            <label class="chip-radio"><input type="radio" name="dup"><span>Keep as separate collection</span></label>
          </div></div>
        </div>`)}
      </div>
      <footer class="modal__foot"><button class="btn btn--ghost" data-action="import-keep">Keep original name</button><button class="btn btn--primary" data-action="import-accept">${icon("check", 16)}Accept &amp; import</button></footer>`, { label: "Organize imported collection" });

    state._importRender = { render1, render2, courseId };
    render1();
  }

  function openCreate() {
    openModal(`
      <header class="modal__head"><h2 class="heading">Create collection</h2><button class="icon-btn" data-action="close-modal" aria-label="Close">${icon("x", 18)}</button></header>
      <div class="modal__body">
        <label class="field"><span class="field__label">Course</span><select id="new-course">${D.courses.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join("")}</select></label>
        <div class="field-row"><label class="field"><span class="field__label">Lecture / unit</span><input id="new-lecture" placeholder="Lecture 09" autofocus></label>
          <label class="field"><span class="field__label">Topic</span><input id="new-topic" placeholder="Cavernous sinus"></label></div>
        <p class="caption">Name preview: <strong id="new-name">Head &amp; Neck Anatomy / Lecture 09 / Cavernous sinus</strong></p>
        <fieldset class="field"><legend class="field__label">Start with</legend>
          <div class="choice-row"><label class="chip-radio"><input type="radio" name="start" checked><span>Empty collection</span></label>
          <label class="chip-radio"><input type="radio" name="start"><span>Import cards</span></label></div></fieldset>
      </div>
      <footer class="modal__foot"><button class="btn btn--ghost" data-action="close-modal">Cancel</button><button class="btn btn--primary" data-action="create-confirm">Create</button></footer>`,
      { label: "Create collection", onMount: (m) => {
        const upd = () => {
          const c = courseById($("#new-course", m).value);
          $("#new-name", m).textContent = `${c.name} / ${$("#new-lecture", m).value || "Lecture 09"} / ${$("#new-topic", m).value || "Cavernous sinus"}`;
        };
        $$("input, select", m).forEach((el) => el.addEventListener("input", upd));
      } });
  }

  function openExplorePreview(id) {
    const e = D.explore.find((x) => x.id === id);
    openModal(`
      <header class="modal__head"><div><h2 class="heading">${esc(e.title)}</h2><p class="caption">${esc(e.course)} · ${e.cards} cards · ${esc(e.version)}</p></div><button class="icon-btn" data-action="close-modal" aria-label="Close">${icon("x", 18)}</button></header>
      <div class="modal__body">
        <div class="creator">${avatar(e.initials)}<div><p class="body-strong">${esc(e.creator)} · ${esc(e.role)}</p><p class="caption">${esc(e.institution)} · updated ${esc(e.updated)}</p></div></div>
        <ul class="preview-cards">${e.preview.map((p, i) => `<li class="flashcard flashcard--mini"><span class="caption">Card ${i + 1}</span><p>${esc(p)}</p></li>`).join("")}</ul>
        <div class="info-box">${icon("fork", 16)}<p><strong>This becomes your own collection.</strong> Edit, reorder and study it however works for you. If ${esc(e.creator.split(" ")[0])} improves the source later, you’ll get suggestions you can accept or skip, card by card.</p></div>
      </div>
      <footer class="modal__foot"><button class="btn btn--ghost" data-action="close-modal">Close</button><button class="btn btn--primary" data-action="explore-save" data-id="${e.id}">${icon("fork", 16)}Add my own copy</button></footer>`,
      { label: e.title, size: "md" });
  }

  function openSchedulingExplainer() {
    openModal(`
      <header class="modal__head"><h2 class="heading">How review scheduling works</h2><button class="icon-btn" data-action="close-modal" aria-label="Close">${icon("x", 18)}</button></header>
      <div class="modal__body prose">
        <p>Kivo uses <strong>spaced repetition</strong>: each card comes back right around when you’re likely to forget it. Remembering at that moment strengthens the memory most.</p>
        <ul class="rating-explain">
          <li><span class="rating-pill rating-bg--again">Again</span> You didn’t recall it. You’ll see it again in a few minutes.</li>
          <li><span class="rating-pill rating-bg--hard">Hard</span> You got it, with real effort. The gap grows a little.</li>
          <li><span class="rating-pill rating-bg--good">Good</span> You recalled it. The gap grows normally.</li>
          <li><span class="rating-pill rating-bg--easy">Easy</span> Instant recall. The gap grows a lot.</li>
        </ul>
        <p>Be honest rather than generous. Ratings only shape your schedule — they aren’t a grade.</p>
        <p class="caption">Advanced users can adjust desired retention, learning steps and daily limits in Settings → Scheduling.</p>
        ${prototypeNote("This prototype uses a simplified interval model for demonstration.")}
      </div>
      <footer class="modal__foot"><button class="btn btn--primary" data-action="close-modal">Got it</button></footer>`, { label: "How review scheduling works" });
  }

  /* ======================================================================
     ROUTER + RENDER
     ====================================================================== */
  function parseRoute() {
    const raw = location.hash.replace(/^#\/?/, "") || "home";
    const [path, query = ""] = raw.split("?");
    const [name, id] = path.split("/");
    return { name, id, query: new URLSearchParams(query) };
  }

  function shell() {
    return `
      <a class="skip-link" href="#view">Skip to content</a>
      <aside class="sidebar" aria-label="Primary">
        <div class="brand"><span class="brand__mark" aria-hidden="true">${brandMark()}</span><span class="brand__name">Kivo</span></div>
        <button class="sidebar__search" data-action="focus-search">${icon("search", 16)}<span>Search</span><kbd>/</kbd></button>
        <nav><ul class="nav">
          ${NAV.map((n) => `<li><a class="nav__item" href="#/${n.id}" data-nav="${n.id}">${icon(n.icon, 18)}<span>${n.label}</span>${n.id === "study" ? `<span class="nav__count" id="nav-due">${state.dueToday || ""}</span>` : ""}</a></li>`).join("")}
        </ul></nav>
        <div class="sidebar__section">
          <p class="overline">Courses</p>
          <ul class="nav nav--courses">${D.courses.map((c) => `<li><a class="nav__item nav__item--sub" href="#/course/${c.id}" data-nav-course="${c.id}"><span class="dot dot--${c.hue}"></span><span>${esc(c.name)}</span></a></li>`).join("")}</ul>
        </div>
        <div class="sidebar__foot">
          <button class="icon-btn" data-action="toggle-theme" aria-label="Toggle dark mode">${icon("moon", 18)}</button>
          <div class="sidebar__user">${avatar(D.user.initials, "sm")}<span><strong>${esc(D.user.fullName)}</strong><small>${esc(D.user.year)} · Optometry</small></span></div>
        </div>
      </aside>
      <div class="main">
        <header class="appbar">
          <span class="brand brand--sm"><span class="brand__mark" aria-hidden="true">${brandMark()}</span><span class="brand__name">Kivo</span></span>
          <div class="appbar__actions">
            <button class="icon-btn" data-action="toggle-theme" aria-label="Toggle dark mode">${icon("moon", 18)}</button>
            ${avatar(D.user.initials, "sm")}
          </div>
        </header>
        <main id="view" tabindex="-1"></main>
      </div>
      <nav class="tabbar" aria-label="Primary">
        ${NAV.map((n) => `<a class="tabbar__item" href="#/${n.id}" data-nav="${n.id}">${icon(n.icon, 22)}<span>${n.short || n.label}</span>${n.id === "study" && state.dueToday ? `<span class="tabbar__badge">${state.dueToday}</span>` : ""}</a>`).join("")}
      </nav>
      <div id="modal-root" hidden></div>
      <div id="toast-root" class="toast-root" aria-live="polite"></div>`;
  }

  function brandMark() {
    return `<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><rect x="3" y="5" width="13" height="16" rx="3" fill="currentColor" opacity=".35"/><rect x="8" y="3" width="13" height="16" rx="3" fill="currentColor"/><path d="m12 11 2 2 3.5-4" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  }

  const TITLES = { home: "Home", library: "My Library", course: "Course", collection: "Collection", builder: "New card", study: "Study", explore: "Explore", insights: "Insights" };

  function render() {
    const r = parseRoute();
    const view = $("#view");
    const inSession = r.name === "study" && r.id;
    document.body.classList.toggle("is-focus-mode", !!inSession);

    let html;
    switch (r.name) {
      case "home": html = viewHome(); break;
      case "library": html = viewLibrary(); break;
      case "course": html = viewCourse(r.id); break;
      case "collection": html = viewCollection(r.id); break;
      case "builder": html = viewBuilder(r.id); break;
      case "study": html = r.id ? viewSession(r.id) : viewStudyHub(); break;
      case "explore": html = viewExplore(); break;
      case "insights": html = viewInsights(); break;
      default: html = viewNotFound();
    }
    view.innerHTML = `<div class="page ${inSession ? "page--session" : ""}">${html}</div>`;

    const active = r.name === "course" || r.name === "collection" || r.name === "builder" ? "library" : r.name;
    $$("[data-nav]").forEach((a) => {
      const on = a.dataset.nav === active;
      a.classList.toggle("is-active", on);
      on ? a.setAttribute("aria-current", "page") : a.removeAttribute("aria-current");
    });
    const courseId = r.name === "course" ? r.id : r.name === "collection" || r.name === "builder" ? collectionById(r.id)?.courseId : null;
    $$("[data-nav-course]").forEach((a) => a.classList.toggle("is-active", a.dataset.navCourse === courseId));
    const due = $("#nav-due"); if (due) due.textContent = state.dueToday || "";
    $$(".tabbar__badge").forEach((b) => { b.textContent = state.dueToday; b.hidden = !state.dueToday; });
    document.title = `${TITLES[r.name] || "Kivo"} · Kivo`;
  }

  function navigate(hash) {
    if (location.hash === hash) render(); else location.hash = hash;
  }

  /* ---------- events ---------------------------------------------------- */
  const actions = {
    "close-modal": () => closeModal(),
    "toggle-theme": () => {
      const root = document.documentElement;
      const next = root.dataset.theme === "dark" ? "light" : "dark";
      root.dataset.theme = next;
      store.set("theme", next);
    },
    "focus-search": () => { navigate("#/library"); setTimeout(() => $("[data-input='library-query']")?.focus(), 30); },
    "library-view": (el) => { state.libraryView = el.dataset.value; store.set("libraryView", state.libraryView); render(); },
    "course-view": (el) => { state.courseView = el.dataset.value; store.set("courseView", state.courseView); render(); },
    "clear-library": () => { state.libraryQuery = ""; state.libraryFilter = "all"; render(); },
    "collection-section": (el) => { state.collectionSection = el.dataset.value; render(); $(`.tab[data-value="${CSS.escape(el.dataset.value)}"]`)?.focus(); },
    "open-share": (el) => openShare(el.dataset.id),
    "share-invite": () => {
      const input = $("#invite"); const v = input.value.trim();
      if (!v) { input.focus(); input.setAttribute("aria-invalid", "true"); return; }
      const li = document.createElement("li");
      li.innerHTML = `${avatar(v.slice(0, 2).toUpperCase(), "sm")}<span><strong>${esc(v)}</strong><small>Copy sent · waiting for them to add it</small></span>`;
      $("#share-people").appendChild(li); input.value = ""; input.removeAttribute("aria-invalid");
      toast(`Sent ${v} their own copy`, { tone: "success" });
    },
    "copy-link": () => { try { navigator.clipboard?.writeText("https://kivo.app/s/arivera/cranial-nerves"); } catch { /* ignore */ } toast("Link copied", { tone: "success" }); },
    "review-update": () => openSuggestions(),
    "open-import": (el) => openImport(el.dataset.course),
    "import-next": () => state._importRender?.render2(),
    "import-accept": () => {
      closeModal(); state.imported = true;
      const col = collectionById("hna-cn"); col.cards += 33; col.newCards += 33;
      navigate("#/collection/hna-cn");
      toast("Imported 33 new cards into Head & Neck Anatomy / Lecture 04 / Cranial Nerves", { tone: "success", action: "Undo", onAction: () => { col.cards -= 33; col.newCards -= 33; render(); toast("Import undone"); } });
    },
    "import-keep": () => { closeModal(); navigate("#/course/hna"); toast("Imported as “HN_Lec4_Final”. You can rename it anytime.", { tone: "success" }); },
    "open-create": () => openCreate(),
    "create-confirm": () => { closeModal(); toast("Collection created", { tone: "success", action: "Add cards", onAction: () => navigate("#/builder/hna-cn") }); },
    "builder-template": (el) => { state.builder.template = el.dataset.value; state.builder.side = "front"; render(); $(`.template[data-value="${el.dataset.value}"]`)?.focus(); },
    "builder-side": (el) => { state.builder.side = el.dataset.value; refreshBuilderPreview(); $$(".builder__preview .segmented__btn").forEach((b) => { const on = b.dataset.value === el.dataset.value; b.classList.toggle("is-active", on); b.setAttribute("aria-pressed", on); }); },
    "builder-advanced": () => { state.builder.advancedOpen = !state.builder.advancedOpen; render(); $(".disclosure__btn")?.focus(); },
    "builder-save": () => saveCard(),
    "cloze-wrap": () => {
      const ta = $("#cloze-text"); if (!ta) return;
      const { selectionStart: a, selectionEnd: b } = ta;
      if (a === b) { toast("Select a word or phrase in the sentence first"); ta.focus(); return; }
      ta.value = ta.value.slice(0, a) + "{{" + ta.value.slice(a, b) + "}}" + ta.value.slice(b);
      state.builder.fields.cloze.text = ta.value; refreshBuilderPreview(); ta.focus();
    },
    "occ-toggle": (el) => {
      const f = state.builder.fields.occlusion, name = el.dataset.value;
      f.masked = f.masked.includes(name) ? f.masked.filter((m) => m !== name) : [...f.masked, name];
      $("#builder-fields").innerHTML = builderFields(); refreshBuilderPreview();
      $(`.occ__label[data-value="${CSS.escape(name)}"]`)?.focus();
    },
    reveal: () => { const s = state.session; if (s && !s.revealed && !s.paused) { s.revealed = true; render(); $(".rating--good")?.focus(); } },
    rate: (el) => rate(el.dataset.value),
    "mcq-pick": (el) => { state.session.picked = +el.dataset.index; render(); $(`.mcq__opt[data-index="${el.dataset.index}"]`)?.focus(); },
    "session-flag": () => {
      const c = state.session.queue[state.session.index];
      state.flagged.has(c.id) ? state.flagged.delete(c.id) : state.flagged.add(c.id);
      render(); toast(state.flagged.has(c.id) ? "Flagged — find it under Flagged in this collection" : "Flag removed");
    },
    "session-pause": () => { state.session.paused = !state.session.paused; render(); },
    "session-exit": () => {
      const s = state.session;
      if (s && s.index > 0 && !s.finished) {
        openModal(`<header class="modal__head"><h2 class="heading">End this session?</h2></header>
          <div class="modal__body"><p>You’ve reviewed ${s.index} of ${s.queue.length} cards. Ratings so far are saved and remaining cards stay due.</p></div>
          <footer class="modal__foot"><button class="btn btn--ghost" data-action="close-modal" autofocus>Keep going</button><button class="btn btn--primary" data-action="session-end">End session</button></footer>`, { label: "End session", size: "sm" });
      } else { state.session = null; history.length > 1 ? history.back() : navigate("#/home"); }
    },
    "session-end": () => { closeModal(true); if (state.session?.ratings.length) { finishSession(); render(); } else { state.session = null; navigate("#/home"); } },
    "session-done": () => { state.session = null; },
    "toggle-keys": () => { state.session.showKeys = !state.session.showKeys; store.set("showKeys", state.session.showKeys); render(); },
    "explain-scheduling": () => openSchedulingExplainer(),
    "drill-weak": () => { const id = state.session.id; state.session = null; navigate(`#/study/${id}`); toast("Drilling cards you rated Again or Hard"); },
    "clear-explore": () => { state.exploreQuery = ""; state.exploreFilters = { program: "", course: "", topic: "", institution: "" }; render(); },
    "explore-preview": (el) => openExplorePreview(el.dataset.id),
    "explore-save": (el) => { closeModal(true); const e = D.explore.find((x) => x.id === el.dataset.id); toast(`Added your own copy of “${e.title}” to My Library`, { tone: "success", action: "Open", onAction: () => navigate("#/library") }); },
    "suggestion-accept": (el) => { el.closest(".suggest-item").classList.add("is-done"); el.closest(".suggest-item__actions").innerHTML = `<span class="badge badge--success">${icon("check", 12)}Added to your copy</span>`; },
    "suggestion-skip": (el) => { el.closest(".suggest-item").classList.add("is-done"); el.closest(".suggest-item__actions").innerHTML = `<span class="badge badge--neutral">Skipped</span>`; },
  };

  function refreshBuilderPreview() { const p = $("#builder-preview"); if (p) p.innerHTML = builderPreview(); }

  function saveCard() {
    const b = state.builder;
    const col = collectionById(b.collectionId);
    const f = b.fields[b.template];
    const empty = { basic: !f.front?.trim() || !f.back?.trim(), cloze: !/\{\{.+?\}\}/.test(f.text || ""), occlusion: !f.masked?.length, mcq: !f.stem?.trim(), vignette: !f.case?.trim() || !f.answer?.trim() }[b.template];
    if (empty) {
      toast(b.template === "cloze" ? "Hide at least one phrase with {{ }} to make a cloze card" : b.template === "occlusion" ? "Hide at least one label on the diagram" : "Fill in the question and answer first", { tone: "error" });
      return;
    }
    const n = b.template === "cloze" ? (f.text.match(/\{\{.+?\}\}/g) || []).length : b.template === "occlusion" ? f.masked.length : 1;
    col.cards += n; col.newCards += n; b.added += n;
    if (b.template === "basic") { f.front = ""; f.back = ""; f.extra = ""; }
    render();
    toast(`Added ${plural(n, "card")} to ${col.title}`, { tone: "success", action: "Study now", onAction: () => navigate(`#/study/${col.id}`) });
    $("#builder-fields textarea, #builder-fields input")?.focus();
  }

  function onClick(e) {
    const row = e.target.closest("tr[data-href]");
    if (row && !e.target.closest("a")) { navigate(row.dataset.href); return; }
    const el = e.target.closest("[data-action]");
    if (!el) return;
    const fn = actions[el.dataset.action];
    if (!fn) return;
    if (el.tagName === "A" && el.dataset.action !== "session-done") e.preventDefault();
    fn(el, e);
  }

  function onInput(e) {
    const el = e.target;
    const kind = el.dataset.input;
    if (!kind) return;
    if (kind === "library-query") { state.libraryQuery = el.value; $("#library-results").innerHTML = libraryResults(); }
    else if (kind === "explore-query") { state.exploreQuery = el.value; $("#explore-results").innerHTML = exploreResults(); }
    else if (kind === "builder") { state.builder.fields[state.builder.template][el.dataset.key] = el.value; refreshBuilderPreview(); }
    else if (kind === "mcq-option") { state.builder.fields.mcq.options[+el.dataset.index] = el.value; refreshBuilderPreview(); }
    else if (kind === "mcq-correct") {
      state.builder.fields.mcq.correct = +el.dataset.index;
      $$(".option-input").forEach((o, i) => o.classList.toggle("is-correct", i === +el.dataset.index));
      refreshBuilderPreview();
    }
    else if (kind === "adv") { state.builder.advanced[el.dataset.key] = el.type === "checkbox" ? el.checked : el.value; refreshBuilderPreview(); }
  }

  function onChange(e) {
    const el = e.target;
    if (el.dataset.change === "library-filter") { state.libraryFilter = el.value; $("#library-results").innerHTML = libraryResults(); }
    if (el.dataset.change === "library-sort") { state.librarySort = el.value; $("#library-results").innerHTML = libraryResults(); }
    if (el.dataset.change === "explore-filter") { state.exploreFilters[el.dataset.key] = el.value; render(); $(`[data-change="explore-filter"][data-key="${el.dataset.key}"]`)?.focus(); }
    if (el.dataset.input === "mcq-correct" || (el.dataset.input === "adv" && el.type === "checkbox")) onInput(e);
  }

  function onKey(e) {
    trapFocus(e);
    if (e.key === "Escape") {
      if (!$("#modal-root").hidden) { closeModal(); return; }
      if (state.session && document.body.classList.contains("is-focus-mode")) { actions["session-exit"](); return; }
    }
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable;
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && state.builder && parseRoute().name === "builder") { e.preventDefault(); saveCard(); return; }
    if (e.target.matches?.(".occ__label") && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); actions["occ-toggle"](e.target); return; }
    if (e.target.matches?.("tr[data-href]") && e.key === "Enter") { navigate(e.target.dataset.href); return; }
    if (typing || !$("#modal-root").hidden) return;

    if (e.key === "/" ) { e.preventDefault(); const s = $("input[type=search]"); s ? s.focus() : actions["focus-search"](); return; }
    const s = state.session;
    if (s && document.body.classList.contains("is-focus-mode") && !s.finished) {
      if (e.key === " " && !s.revealed && !e.target.closest("button")) { e.preventDefault(); actions.reveal(); }
      else if (e.key === " " && !s.revealed && e.target.closest("[data-action='reveal']")) { /* native click */ }
      else if (s.revealed && ["1", "2", "3", "4"].includes(e.key)) { rate(["again", "hard", "good", "easy"][+e.key - 1]); }
      else if (!s.revealed && s.queue[s.index].type === "mcq" && ["a", "b", "c", "d"].includes(e.key.toLowerCase())) { s.picked = "abcd".indexOf(e.key.toLowerCase()); render(); }
      else if (e.key.toLowerCase() === "f") actions["session-flag"]();
      else if (e.key.toLowerCase() === "p") actions["session-pause"]();
    }
  }

  /* ---------- boot ------------------------------------------------------ */
  function boot() {
    const theme = store.get("theme", null);
    if (theme) document.documentElement.dataset.theme = theme;
    $("#app").innerHTML = shell();
    document.addEventListener("click", onClick);
    document.addEventListener("input", onInput);
    document.addEventListener("change", onChange);
    document.addEventListener("keydown", onKey);
    window.addEventListener("hashchange", () => {
      closeModal(true);
      const r = parseRoute();
      if (r.name !== "collection") state.collectionSection = "All";
      if (!(r.name === "study" && r.id) && state.session?.finished) state.session = null;
      render();
      window.scrollTo(0, 0);
      $("#view").focus({ preventScroll: true });
    });
    render();
  }

  boot();
})();
