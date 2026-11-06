/* ==========================================================================
   Kivo — local database + scheduler
   - Everything is stored in the browser (localStorage) under one key.
   - Notes generate cards the way Anki does (basic, reversed, cloze, image
     occlusion).
   - Scheduling uses FSRS-5 with its published default parameters, plus
     Anki-style learning/relearning steps, daily limits, burying,
     suspending, leeches and undo.
   ========================================================================== */
window.KivoStore = (() => {
  "use strict";
  const SEED = window.KIVO_SEED;
  const KEY = "kivo:db:v3";
  const MIN = 60000, HOUR = 3600000, DAY = 86400000;

  /* ---------- FSRS-5 --------------------------------------------------- */
  const W = [0.40255, 1.18385, 3.173, 15.69105, 7.1949, 0.5345, 1.4604, 0.0046, 1.54575, 0.1192,
    1.01925, 1.9395, 0.11, 0.29605, 2.2698, 0.2315, 2.9898, 0.51655, 0.6621];
  const DECAY = -0.5, FACTOR = 19 / 81;
  const clampD = (d) => Math.min(10, Math.max(1, d));
  const retrievability = (elapsedDays, s) => Math.pow(1 + FACTOR * elapsedDays / s, DECAY);
  const intervalFor = (s, r) => (s / FACTOR) * (Math.pow(r, 1 / DECAY) - 1);
  const initS = (g) => W[g - 1];
  const initD = (g) => clampD(W[4] - Math.exp(W[5] * (g - 1)) + 1);
  const nextD = (d, g) => { const dp = d - W[6] * (g - 3) * (10 - d) / 9; return clampD(W[7] * initD(4) + (1 - W[7]) * dp); };
  const recallS = (d, s, r, g) => s * (1 + Math.exp(W[8]) * (11 - d) * Math.pow(s, -W[9]) * (Math.exp(W[10] * (1 - r)) - 1) * (g === 2 ? W[15] : 1) * (g === 4 ? W[16] : 1));
  const forgetS = (d, s, r) => Math.min(s, W[11] * Math.pow(d, -W[12]) * (Math.pow(s + 1, W[13]) - 1) * Math.exp(W[14] * (1 - r)));
  const shortS = (s, g) => s * Math.exp(W[17] * (g - 3 + W[18]));

  const DEFAULT_OPTIONS = {
    newPerDay: 20, reviewsPerDay: 200,
    learnSteps: [1, 10], relearnSteps: [10], // minutes
    retention: 0.9, maxIvl: 36500, leechThreshold: 8, leechAction: "tag", // tag | suspend
    burySiblings: true,
  };

  /* ---------- time ----------------------------------------------------- */
  const startOfDay = (t = Date.now()) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
  const endOfDay = (t = Date.now()) => startOfDay(t) + DAY - 1;

  /* ---------- persistence ---------------------------------------------- */
  let db = null;
  const uid = (p) => `${p}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  function save() { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch { /* storage full or blocked */ } }
  function load() {
    try { const raw = localStorage.getItem(KEY); if (raw) { db = JSON.parse(raw); if (db && db.v === 3) return db; } } catch { /* fall through to seed */ }
    db = seed(); save(); return db;
  }

  function seed() {
    const now = Date.now(), today = startOfDay(now);
    const d = { v: 3, created: now, semesters: [], courses: [], units: [], decks: [], notes: [], cards: [], log: [], options: {}, sampleActivity: [] };
    SEED.semesters.forEach((x, i) => d.semesters.push({ ...x, order: i, created: now - 120 * DAY }));
    SEED.courses.forEach((c, i) => d.courses.push({ ...c, order: i, created: now - 60 * DAY }));
    SEED.units.forEach((u, i) => d.units.push({ ...u, order: i, created: now - 50 * DAY }));
    SEED.decks.forEach((x, i) => d.decks.push({ tags: [], description: "", ...x, order: i, created: now - 40 * DAY + i * DAY, modified: now - (i % 6) * DAY }));
    let n = 0;
    for (const raw of SEED.notes) {
      const note = { id: `n${++n}`, created: now - 30 * DAY + n * HOUR, modified: now - (n % 9) * DAY, tags: [], ...raw };
      d.notes.push(note);
      for (const ord of cardOrds(note)) {
        const card = { id: `${note.id}-${ord}`, noteId: note.id, deckId: note.deckId, ord, flag: 0, suspended: false, buriedUntil: 0, sched: newSched() };
        // Give the sample library a believable mix of new, due and future cards.
        const k = (n * 7 + ord * 3) % 10;
        if (k >= 2) {
          const s = 1.5 + ((n * 13 + ord * 5) % 30);
          const elapsed = k <= 5 ? Math.max(1, Math.round(s * (k === 5 ? 1.4 : 1.05))) : Math.max(1, Math.round(s * (0.2 + (k - 6) * 0.15)));
          const last = today - elapsed * DAY + 10 * HOUR;
          const ivl = Math.max(1, Math.round(s));
          card.sched = { state: "review", s, d: 3 + ((n * 11) % 50) / 10, step: 0, reps: 2 + (n % 6), lapses: (n % 7 === 0) ? 2 : (n % 5 === 0 ? 1 : 0), last, due: startOfDay(last) + ivl * DAY, ivl };
        }
        d.cards.push(card);
      }
    }
    d.sampleActivity = SEED.sampleActivity.map((count, i) => ({ day: today - (SEED.sampleActivity.length - i) * DAY, count }));
    return d;
  }
  function resetToSample() { db = seed(); save(); return db; }

  /* ---------- notes → cards -------------------------------------------- */
  const clozeNums = (text) => [...new Set([...String(text || "").matchAll(/\{\{c(\d+)::/g)].map((m) => +m[1]))].sort((a, b) => a - b);
  function cardOrds(note) {
    if (note.type === "reverse") return [0, 1];
    if (note.type === "cloze") { const nums = clozeNums(note.fields.text); return nums.length ? nums : [1]; }
    if (note.type === "occlusion") return (note.fields.masked || []).map((_, i) => i);
    return [0];
  }
  const newSched = () => ({ state: "new", s: 0, d: 0, step: 0, reps: 0, lapses: 0, last: 0, due: 0, ivl: 0 });

  function syncCards(note) {
    const want = new Set(cardOrds(note));
    const existing = db.cards.filter((c) => c.noteId === note.id);
    for (const c of existing) { if (!want.has(c.ord)) db.cards.splice(db.cards.indexOf(c), 1); else c.deckId = note.deckId; }
    for (const ord of want) if (!existing.some((c) => c.ord === ord)) db.cards.push({ id: `${note.id}-${ord}`, noteId: note.id, deckId: note.deckId, ord, flag: 0, suspended: false, buriedUntil: 0, sched: newSched() });
  }

  /* ---------- lookups --------------------------------------------------- */
  const semester = (id) => db.semesters.find((x) => x.id === id);
  const course = (id) => db.courses.find((c) => c.id === id);
  const paused = (courseId) => !!semester(course(courseId)?.semesterId)?.pauseReviews;
  const semesterList = () => [...db.semesters].sort((a, b) => a.order - b.order);
  const coursesIn = (semId) => db.courses.filter((c) => (c.semesterId || null) === semId).sort((a, b) => a.order - b.order);
  const unit = (id) => db.units.find((u) => u.id === id);
  const deck = (id) => db.decks.find((x) => x.id === id);
  const note = (id) => db.notes.find((x) => x.id === id);
  const card = (id) => db.cards.find((x) => x.id === id);
  const options = (courseId) => ({ ...DEFAULT_OPTIONS, ...(db.options[courseId] || {}) });
  const unitsOf = (courseId) => db.units.filter((u) => u.courseId === courseId).sort((a, b) => a.order - b.order);
  const decksOf = (courseId, unitId) => db.decks.filter((x) => x.courseId === courseId && (unitId === undefined || (x.unitId || null) === unitId)).sort((a, b) => a.order - b.order);

  /* A scope is "all", "course:<id>", "unit:<id>" or "deck:<id>". */
  function scopeDeckIds(scope) {
    if (!scope || scope === "all") return db.decks.filter((x) => !paused(x.courseId)).map((x) => x.id);
    const [kind, id] = scope.split(":");
    if (kind === "semester") return db.decks.filter((x) => course(x.courseId)?.semesterId === id).map((x) => x.id);
    if (kind === "course") return db.decks.filter((x) => x.courseId === id).map((x) => x.id);
    if (kind === "unit") return db.decks.filter((x) => x.unitId === id).map((x) => x.id);
    return db.decks.some((x) => x.id === id) ? [id] : [];
  }
  function scopeLabel(scope) {
    if (!scope || scope === "all") return "Today’s review";
    const [kind, id] = scope.split(":");
    if (kind === "semester") return semester(id)?.name || "Semester";
    if (kind === "course") return course(id)?.name || "Course";
    if (kind === "unit") return unit(id)?.name || "Unit";
    return deck(id)?.title || "Collection";
  }

  /* ---------- daily limits & queues ------------------------------------ */
  function doneToday(courseId) {
    const t0 = startOfDay();
    let newDone = 0, revDone = 0;
    for (const l of db.log) {
      if (l.ts < t0 || l.courseId !== courseId) continue;
      if (l.prevState === "new") newDone++; else if (l.prevState === "review") revDone++;
    }
    return { newDone, revDone };
  }
  const available = (c, now) => !c.suspended && !(c.buriedUntil > now);

  /* Returns the cards that are studyable now within a scope, honoring each
     course's daily limits, split the way Anki shows them. */
  function queue(scope, now = Date.now(), learnAheadMin = 20) {
    const ids = new Set(scopeDeckIds(scope));
    const eod = endOfDay(now);
    const byCourse = {};
    const learn = [], review = [], fresh = [];
    for (const c of db.cards) {
      if (!ids.has(c.deckId) || !available(c, now)) continue;
      const st = c.sched.state;
      if (st === "learning" || st === "relearning") { if (c.sched.due <= now + learnAheadMin * MIN) learn.push(c); }
      else if (st === "review") { if (c.sched.due <= eod) review.push(c); }
      else fresh.push(c);
    }
    const limit = (list, kind) => {
      const out = [];
      for (const c of list) {
        const cid = deck(c.deckId).courseId;
        if (!byCourse[cid]) { const o = options(cid), d = doneToday(cid); byCourse[cid] = { newLeft: Math.max(0, o.newPerDay - d.newDone), revLeft: Math.max(0, o.reviewsPerDay - d.revDone) }; }
        const b = byCourse[cid];
        if (kind === "new" ? b.newLeft > 0 : b.revLeft > 0) { out.push(c); kind === "new" ? b.newLeft-- : b.revLeft--; }
      }
      return out;
    };
    learn.sort((a, b) => a.sched.due - b.sched.due);
    review.sort((a, b) => a.sched.due - b.sched.due);
    const noteOrder = new Map(db.notes.map((n, i) => [n.id, i]));
    fresh.sort((a, b) => noteOrder.get(a.noteId) - noteOrder.get(b.noteId) || a.ord - b.ord);
    return { learn, review: limit(review, "review"), fresh: limit(fresh, "new") };
  }
  function counts(scope, now = Date.now()) {
    const q = queue(scope, now, 0);
    const learnLater = db.cards.filter((c) => scopeDeckIds(scope).includes(c.deckId) && available(c, now) && (c.sched.state === "learning" || c.sched.state === "relearning") && c.sched.due > now && c.sched.due <= endOfDay(now)).length;
    return { new: q.fresh.length, learn: q.learn.length, review: q.review.length, learnLater, total: q.fresh.length + q.learn.length + q.review.length };
  }

  /* Next card to show: due learning first, then reviews and new cards
     mixed (new cards spread evenly), then learning cards slightly ahead. */
  function nextCard(scope, now = Date.now(), excludeId = null) {
    const q = queue(scope, now, 0);
    const pick = (list) => list.find((c) => c.id !== excludeId) || null;
    const dueLearn = pick(q.learn); if (dueLearn) return dueLearn;
    const rev = pick(q.review), fresh = pick(q.fresh);
    if (rev && fresh) { const ratio = q.review.length / (q.fresh.length || 1); return (db.log.length % Math.max(1, Math.round(ratio) + 1) === 0) ? fresh : rev; }
    if (rev || fresh) return rev || fresh;
    const ahead = queue(scope, now, 20).learn;
    return pick(ahead) || (excludeId ? ahead.find((c) => c.id === excludeId) || null : null);
  }

  /* ---------- scheduling ----------------------------------------------- */
  function schedule(c, g, now = Date.now()) {
    const o = options(deck(c.deckId).courseId);
    const s0 = c.sched, out = { ...s0, reps: s0.reps + 1, last: now };
    const steps = s0.state === "relearning" || (s0.state === "review" && g === 1) ? o.relearnSteps : o.learnSteps;
    const graduate = (s, bonus = 0) => {
      let ivl = Math.max(1, Math.round(intervalFor(s, o.retention)) + bonus);
      ivl = Math.min(o.maxIvl, ivl);
      return { ...out, state: "review", step: 0, ivl, due: startOfDay(now) + ivl * DAY };
    };
    const inLearning = (stepIdx, state, minutes) => ({ ...out, state, step: stepIdx, ivl: 0, due: now + minutes * MIN });

    if (s0.state === "new") {
      out.s = initS(g); out.d = initD(g);
      if (g === 4 || !o.learnSteps.length) return graduate(out.s);
      if (g === 1) return inLearning(0, "learning", o.learnSteps[0]);
      if (g === 2) return inLearning(0, "learning", o.learnSteps.length > 1 ? (o.learnSteps[0] + o.learnSteps[1]) / 2 : o.learnSteps[0] * 1.5);
      if (o.learnSteps.length > 1) return inLearning(1, "learning", o.learnSteps[1]);
      return graduate(out.s);
    }
    if (s0.state === "learning" || s0.state === "relearning") {
      out.s = shortS(s0.s || initS(3), g); out.d = nextD(s0.d || initD(3), g);
      if (g === 1) return inLearning(0, s0.state, steps[0] ?? 1);
      if (g === 2) return inLearning(s0.step, s0.state, (steps[s0.step] ?? steps[0] ?? 1) * (s0.step === 0 && steps.length > 1 ? (1 + steps[1] / steps[0]) / 2 : 1.5));
      if (g === 4) return graduate(out.s, 1);
      const nextStep = s0.step + 1;
      if (nextStep < steps.length) return inLearning(nextStep, s0.state, steps[nextStep]);
      return graduate(out.s);
    }
    // review
    const elapsed = Math.max(0, (startOfDay(now) - startOfDay(s0.last)) / DAY);
    const r = retrievability(elapsed, s0.s);
    out.d = nextD(s0.d, g);
    if (g === 1) {
      out.s = forgetS(s0.d, s0.s, r); out.lapses = s0.lapses + 1;
      if (!o.relearnSteps.length) return graduate(out.s);
      return inLearning(0, "relearning", o.relearnSteps[0]);
    }
    out.s = recallS(s0.d, s0.s, r, g);
    const ivlOf = (gg) => Math.min(o.maxIvl, Math.max(1, Math.round(intervalFor(recallS(s0.d, s0.s, r, gg), o.retention))));
    const hard = ivlOf(2), good = Math.max(ivlOf(3), hard + 1), easy = Math.max(ivlOf(4), good + 1);
    const ivl = g === 2 ? hard : g === 3 ? good : easy;
    return { ...out, state: "review", step: 0, ivl, due: startOfDay(now) + ivl * DAY };
  }
  /* Delay until next review for each rating, in ms (for the button labels). */
  function preview(c, now = Date.now()) {
    const res = {};
    for (const [k, g] of [["again", 1], ["hard", 2], ["good", 3], ["easy", 4]]) {
      const s = schedule(c, g, now);
      res[k] = s.state === "review" ? Math.max(DAY, s.due - startOfDay(now)) : s.due - now;
    }
    return res;
  }
  function answer(cardId, g, ms = 0, now = Date.now()) {
    const c = card(cardId), d = deck(c.deckId), o = options(d.courseId);
    const before = { sched: { ...c.sched }, suspended: c.suspended, siblings: [], noteTags: [...(note(c.noteId).tags || [])] };
    c.sched = schedule(c, g, now);
    const entry = { id: uid("r"), cardId, deckId: c.deckId, courseId: d.courseId, ts: now, grade: g, prevState: before.sched.state, ivl: c.sched.ivl, ms };
    db.log.push(entry);
    let leech = false;
    if (g === 1 && before.sched.state === "review" && c.sched.lapses >= o.leechThreshold && c.sched.lapses % Math.max(1, Math.ceil(o.leechThreshold / 2)) === 0) {
      leech = true; const n = note(c.noteId); if (!n.tags.includes("leech")) n.tags.push("leech");
      if (o.leechAction === "suspend") c.suspended = true;
    }
    if (o.burySiblings && before.sched.state !== "learning" && before.sched.state !== "relearning") {
      for (const sib of db.cards) if (sib.noteId === c.noteId && sib.id !== c.id && (sib.sched.state === "new" || sib.sched.state === "review") && !(sib.buriedUntil > now)) {
        before.siblings.push({ id: sib.id, buriedUntil: sib.buriedUntil }); sib.buriedUntil = endOfDay(now);
      }
    }
    save();
    return { entry, before, leech };
  }
  function undo(step) {
    const c = card(step.entry.cardId); if (!c) return;
    c.sched = step.before.sched; c.suspended = step.before.suspended;
    note(c.noteId).tags = step.before.noteTags;
    for (const s of step.before.siblings) { const sc = card(s.id); if (sc) sc.buriedUntil = s.buriedUntil; }
    const i = db.log.findIndex((l) => l.id === step.entry.id); if (i >= 0) db.log.splice(i, 1);
    save();
  }
  function bury(cardId) { const c = card(cardId); c.buriedUntil = endOfDay(); save(); }
  function setSuspended(cardIds, v) { for (const id of cardIds) { const c = card(id); if (c) c.suspended = v; } save(); }
  function setFlag(cardId, f) { const c = card(cardId); c.flag = f; save(); }
  function resetCards(cardIds) { for (const id of cardIds) { const c = card(id); if (c) c.sched = newSched(); } save(); }

  /* ---------- CRUD ------------------------------------------------------ */
  function addSemester(name) { const x = { id: uid("s"), name, archived: false, pauseReviews: false, order: -Date.now(), created: Date.now() }; db.semesters.push(x); save(); return x; }
  function removeSemester(id, { deleteCourses = false } = {}) {
    for (const c of db.courses.filter((x) => x.semesterId === id)) deleteCourses ? removeCourse(c.id) : (c.semesterId = null);
    db.semesters = db.semesters.filter((x) => x.id !== id); save();
  }
  function addCourse({ name, code = "", term = "", hue = "lavender", semesterId = null }) {
    const c = { id: uid("c"), name, code, term, hue, semesterId, order: db.courses.length, created: Date.now() }; db.courses.push(c); save(); return c;
  }
  function addUnit(courseId, name) { const u = { id: uid("u"), courseId, name, order: unitsOf(courseId).length, created: Date.now() }; db.units.push(u); save(); return u; }
  function addDeck(data) {
    const x = { id: uid("d"), tags: [], description: "", lecture: "", topic: "", assessment: "", creator: { name: SEED.user.fullName, initials: SEED.user.initials }, source: "original", ...data, order: db.decks.length, created: Date.now(), modified: Date.now() };
    db.decks.push(x); save(); return x;
  }
  function update(kind, id, patch) {
    const list = { semester: db.semesters, course: db.courses, unit: db.units, deck: db.decks }[kind];
    const obj = list.find((o) => o.id === id); Object.assign(obj, patch);
    if (kind === "deck") obj.modified = Date.now();
    save(); return obj;
  }
  function removeDeck(id) {
    const noteIds = new Set(db.notes.filter((n) => n.deckId === id).map((n) => n.id));
    db.notes = db.notes.filter((n) => !noteIds.has(n.id));
    db.cards = db.cards.filter((c) => !noteIds.has(c.noteId));
    db.decks = db.decks.filter((x) => x.id !== id); save();
  }
  function removeUnit(id, { keepDecks = true } = {}) {
    for (const x of db.decks.filter((d) => d.unitId === id)) keepDecks ? (x.unitId = null) : removeDeck(x.id);
    db.units = db.units.filter((u) => u.id !== id); save();
  }
  function removeCourse(id) {
    for (const x of db.decks.filter((d) => d.courseId === id)) removeDeck(x.id);
    db.units = db.units.filter((u) => u.courseId !== id);
    db.courses = db.courses.filter((c) => c.id !== id); delete db.options[id]; save();
  }
  function saveNote(data) {
    let n = data.id ? note(data.id) : null;
    if (n) Object.assign(n, data, { modified: Date.now() });
    else { n = { tags: [], section: "", ...data, id: uid("n"), created: Date.now(), modified: Date.now() }; db.notes.push(n); }
    syncCards(n);
    const dk = deck(n.deckId); if (dk) dk.modified = Date.now();
    save(); return n;
  }
  function removeNote(id) { db.notes = db.notes.filter((n) => n.id !== id); db.cards = db.cards.filter((c) => c.noteId !== id); save(); }
  function setOptions(courseId, patch) { db.options[courseId] = { ...(db.options[courseId] || {}), ...patch }; save(); }

  /* ---------- stats ------------------------------------------------------ */
  function deckStats(deckIds, now = Date.now()) {
    const ids = new Set(deckIds);
    const st = { total: 0, new: 0, learning: 0, review: 0, suspended: 0, seen: 0, mature: 0, retention: null, lapses: 0 };
    let rSum = 0, rN = 0;
    for (const c of db.cards) {
      if (!ids.has(c.deckId)) continue;
      st.total++;
      if (c.suspended) st.suspended++;
      const s = c.sched.state;
      if (s === "new") st.new++; else { st.seen++; if (s === "review") st.review++; else st.learning++; }
      if (s === "review") { if (c.sched.ivl >= 21) st.mature++; const el = Math.max(0, (now - c.sched.last) / DAY); rSum += retrievability(el, c.sched.s); rN++; }
      st.lapses += c.sched.lapses;
    }
    st.retention = rN ? rSum / rN : null;
    return st;
  }
  function lastStudied(deckIds) {
    const ids = new Set(deckIds); let t = 0;
    for (let i = db.log.length - 1; i >= 0; i--) if (ids.has(db.log[i].deckId)) { t = db.log[i].ts; break; }
    return t;
  }
  function forecast(days = 7, now = Date.now()) {
    const t0 = startOfDay(now), out = Array.from({ length: days }, () => 0);
    for (const c of db.cards) {
      if (c.suspended || c.sched.state === "new") continue;
      const idx = Math.max(0, Math.floor((startOfDay(c.sched.due) - t0) / DAY));
      if (idx < days) out[idx]++;
    }
    return out;
  }
  function activity(days = 28, now = Date.now()) {
    const t0 = startOfDay(now), out = Array.from({ length: days }, () => 0);
    for (const a of db.sampleActivity) { const i = days - 1 - Math.round((t0 - a.day) / DAY); if (i >= 0 && i < days) out[i] += a.count; }
    for (const l of db.log) { const i = days - 1 - Math.round((t0 - startOfDay(l.ts)) / DAY); if (i >= 0 && i < days) out[i]++; }
    return out;
  }

  return {
    load, save, resetToSample, get db() { return db; }, DAY, MIN, startOfDay, endOfDay, DEFAULT_OPTIONS,
    semester, semesterList, coursesIn, paused, addSemester, removeSemester,
    course, unit, deck, note, card, options, unitsOf, decksOf, scopeDeckIds, scopeLabel,
    queue, counts, nextCard, preview, answer, undo, bury, setSuspended, setFlag, resetCards,
    addCourse, addUnit, addDeck, update, removeDeck, removeUnit, removeCourse, saveNote, removeNote, setOptions,
    cardOrds, clozeNums, deckStats, lastStudied, forecast, activity, retrievability,
  };
})();
