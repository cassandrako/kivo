/* ==========================================================================
   Kivo — sign up, log in and onboarding
   Accounts live in this browser (prototype). Apple and Google sign-in are
   simulated with their account pickers; the real versions plug into the
   accounts backend (step 2) without changing this flow.
   ========================================================================== */
window.KivoOnboarding = (() => {
  "use strict";
  const S = window.KivoStore, P = window.KIVO_PERSONAS, I = window.KIVO_ICONS;
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const icon = (n, z = 18) => `<svg class="icon" width="${z}" height="${z}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${I[n] || ""}</svg>`;
  const FOX = `<path d="M12 36V9.5C12 4.5 16.5 3 19.5 6.5L40 30H12z" fill="#A68DF5"/><path d="M88 36V9.5C88 4.5 83.5 3 80.5 6.5L60 30h28z" fill="#A68DF5"/><path d="M13 29h74v38c0 3-2 5-5 6.5L60 85c-3 1.8-5 3-10 3s-7-1.2-10-3L18 73.5c-3-1.5-5-3.5-5-6.5z" fill="#A68DF5"/><path d="M13 61.5c13-3.5 24 1 33 19l-2.5 2.5C36 69 26 66 13 69.5z" fill="#E4DCFB"/><path d="M87 61.5c-13-3.5-24 1-33 19l2.5 2.5C64 69 74 66 87 69.5z" fill="#E4DCFB"/><circle cx="37.5" cy="51" r="4.2" fill="#463A6E"/><circle cx="62.5" cy="51" r="4.2" fill="#463A6E"/><path d="M43.5 81.5h13c-.8 5-3.3 8.5-6.5 8.5s-5.7-3.5-6.5-8.5z" fill="#463A6E"/>`;
  const fox = (z) => `<svg width="${z}" height="${z}" viewBox="0 0 100 100" aria-hidden="true">${FOX}</svg>`;
  const APPLE = `<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M16.4 12.7c0-2.4 2-3.6 2.1-3.7-1.1-1.7-2.9-1.9-3.5-1.9-1.5-.2-2.9.9-3.7.9-.8 0-1.9-.9-3.2-.8-1.6 0-3.2 1-4 2.5-1.7 3-.4 7.4 1.2 9.8.8 1.2 1.8 2.5 3 2.4 1.2 0 1.7-.8 3.1-.8 1.5 0 1.9.8 3.2.8 1.3 0 2.1-1.2 2.9-2.4.9-1.4 1.3-2.7 1.3-2.8 0 0-2.4-1-2.4-4zM14 5.5c.7-.8 1.1-1.9 1-3-1 0-2.1.7-2.8 1.5-.6.7-1.2 1.8-1 2.9 1.1.1 2.1-.6 2.8-1.4z"/></svg>`;
  const GOOGLE = `<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M22.6 12.2c0-.8-.1-1.5-.2-2.2H12v4.2h5.9c-.3 1.4-1 2.5-2.2 3.3v2.7h3.6c2.1-1.9 3.3-4.8 3.3-8z"/><path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.7c-1 .7-2.2 1.1-3.7 1.1-2.9 0-5.3-1.9-6.2-4.5H2.1v2.8C3.9 20.6 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.8 14.2c-.2-.7-.4-1.4-.4-2.2s.1-1.5.4-2.2V7H2.1C1.4 8.5 1 10.2 1 12s.4 3.5 1.1 5l3.7-2.8z"/><path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.2-3.2C17.5 2.1 15 1 12 1 7.7 1 3.9 3.4 2.1 7l3.7 2.8C6.7 7.3 9.1 5.4 12 5.4z"/></svg>`;
  const store = {
    get(k, d) { try { const v = localStorage.getItem("kivo:" + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem("kivo:" + k, JSON.stringify(v)); } catch { /* storage unavailable */ } },
  };
  const DAY = 86400000;
  const pad2 = (n) => String(n).padStart(2, "0");
  const isoDate = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  const today = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); };

  /* ---------- program definitions ------------------------------------- */
  const ROLES = [
    { id: "optometry", label: "Optometry student", sub: "OD program", icon: "eye" },
    { id: "medicine", label: "Medical student", sub: "MD or DO program", icon: "insights" },
    { id: "dentistry", label: "Dental student", sub: "DDS or DMD program", icon: "target" },
    { id: "prehealth", label: "Pre-health student", sub: "Undergrad, post-bacc or gap year", icon: "book" },
    { id: "other", label: "Another health program", sub: "Nursing, pharmacy, PA, PT and more", icon: "layers" },
    { id: "working", label: "Working in healthcare", sub: "Resident, clinician or educator", icon: "users" },
  ];
  const SCHOOLS = {
    optometry: ["Pennsylvania College of Optometry (Salus University)", "SUNY College of Optometry", "New England College of Optometry", "UC Berkeley Herbert Wertheim School of Optometry", "University of Waterloo School of Optometry"],
    medicine: ["Perelman School of Medicine at Penn", "Columbia Vagelos College of Physicians and Surgeons", "University of Toronto Temerty Faculty of Medicine", "Philadelphia College of Osteopathic Medicine"],
    dentistry: ["Columbia College of Dental Medicine", "Penn Dental Medicine", "NYU College of Dentistry", "University of Toronto Faculty of Dentistry"],
    prehealth: ["University of Toronto", "University of Pennsylvania", "Columbia University", "McMaster University"],
  };
  const YEARS = { optometry: ["OD1", "OD2", "OD3", "OD4"], medicine: ["MS1", "MS2", "MS3", "MS4"], dentistry: ["D1", "D2", "D3", "D4"], prehealth: ["1st year", "2nd year", "3rd year", "4th year", "Post-bacc", "Gap year"] };
  const BOARDS = { optometry: ["NBEO Part I", "NBEO Part II", "NBEO Part III"], medicine: ["USMLE Step 1", "USMLE Step 2 CK", "COMLEX Level 1", "COMLEX Level 2"], dentistry: ["INBDE"] };
  const TARGETS = [["MD", "Medicine (MD/DO)", "MCAT"], ["OD", "Optometry (OD)", "OAT"], ["DDS", "Dentistry (DDS/DMD)", "DAT"], ["PA", "Physician assistant (PA)", "GRE or PA-CAT"], ["Other", "Not sure yet", ""]];
  const OTHER_COURSES = ["Anatomy & Physiology", "Pharmacology", "Pathophysiology", "Microbiology"];
  const programLabel = (a) => a.role === "optometry" ? `${a.year} · Optometry` : a.role === "medicine" ? `${a.year} · Medicine` : a.role === "dentistry" ? `${a.year} · Dentistry` : a.role === "prehealth" ? `${a.year} · Pre-${({ MD: "med", OD: "optometry", DDS: "dental", PA: "PA", Other: "health" })[a.target] || "health"}` : a.program || "Health program";
  const templateFor = (role) => P[role] || null;

  /* ---------- state ------------------------------------------------------ */
  let ob, onDone;
  const blank = () => ({ screen: "welcome", provider: null, error: "", a: { first: "", last: "", email: "", password: "", role: "", degree: "", school: "", year: "", gradYear: "", boards: "", major: "", target: "MD", examDate: "", program: "", employer: "" }, semester: "", courses: [], custom: [], exams: {}, pace: 20, sample: true, reminder: "19:00", persona: null });
  const STEPS = ["name", "role", "details", "courses", "exams", "plan"];

  function start(done) { onDone = done; ob = blank(); render(); }
  function accounts() { return store.get("accounts", {}); }
  function saveAccount(acct) { const all = accounts(); all[acct.email.toLowerCase()] = acct; store.set("accounts", all); store.set("session", acct.email.toLowerCase()); }
  function hash(s) { let h = 5381; for (const ch of s) h = ((h << 5) + h + ch.charCodeAt(0)) | 0; return String(h >>> 0); }

  /* ---------- rendering --------------------------------------------------- */
  function shell(inner) {
    const stepIdx = STEPS.indexOf(ob.screen);
    return `<div class="ob">
      <header class="ob__top">${fox(28)}<span class="ob__word">kivo.</span></header>
      <main class="ob__main" id="ob-main">
        ${stepIdx >= 0 ? `<div class="ob__progress"><button class="link link--muted" data-ob="back">${icon("chevronLeft", 16)}Back</button><span class="caption">${stepIdx + 1} of ${STEPS.length}</span></div><div class="progress progress--thin"><span style="width:${((stepIdx + 1) / STEPS.length) * 100}%"></span></div>` : ""}
        <div class="ob__panel">${inner}</div>
      </main>
    </div>`;
  }
  const err = () => ob.error ? `<p class="field__error" role="alert">${esc(ob.error)}</p>` : "";
  const field = (id, label, value, { type = "text", placeholder = "", list = null, hint = "", auto = "" } = {}) => `<label class="field"><span class="field__label">${label}</span><input id="${id}" type="${type}" value="${esc(value)}" placeholder="${esc(placeholder)}" ${list ? `list="${id}-list"` : ""} ${auto ? `autocomplete="${auto}"` : ""}>${list ? `<datalist id="${id}-list">${list.map((x) => `<option value="${esc(x)}">`).join("")}</datalist>` : ""}${hint ? `<span class="field__hint">${hint}</span>` : ""}</label>`;
  const select = (id, label, value, options) => `<label class="field"><span class="field__label">${label}</span><select id="${id}">${options.map((o) => { const [v, l] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(v)}" ${v === value ? "selected" : ""}>${esc(l)}</option>`; }).join("")}</select></label>`;
  const actions = (primary, { secondary = "" } = {}) => `<div class="ob__actions">${secondary}<button class="btn btn--primary btn--lg" data-ob="next">${primary}</button></div>`;

  function view() {
    const a = ob.a;
    switch (ob.screen) {
      case "welcome": return shell(`
        <h1 class="ob__title">Welcome to kivo.</h1>
        <p class="ob__lede">a little smarter, every day.</p>
        <div class="ob__auth">
          <button class="btn btn--apple btn--lg" data-ob="provider" data-p="apple">${APPLE}Continue with Apple</button>
          <button class="btn btn--google btn--lg" data-ob="provider" data-p="google">${GOOGLE}Continue with Google</button>
          <div class="divider"><span>or</span></div>
          <button class="btn btn--secondary btn--lg" data-ob="go" data-to="email">${icon("edit", 16)}Sign up with email</button>
        </div>
        <p class="ob__switch">Already have an account? <button class="link" data-ob="go" data-to="login">Log in</button></p>
        <section class="ob__personas" aria-labelledby="persona-title">
          <h2 id="persona-title" class="caption">Prototype: try it as</h2>
          <div class="persona-list">${Object.values(P).map((t) => `<button class="persona" data-ob="persona" data-id="${t.id}"><strong>${esc(t.user.fullName)}</strong><small>${esc(t.user.role || "")}</small></button>`).join("")}</div>
        </section>`);
      case "login": return shell(`
        <h1 class="ob__title">Log in</h1>
        <div class="ob__auth">
          <button class="btn btn--apple btn--lg" data-ob="provider" data-p="apple">${APPLE}Continue with Apple</button>
          <button class="btn btn--google btn--lg" data-ob="provider" data-p="google">${GOOGLE}Continue with Google</button>
          <div class="divider"><span>or with email</span></div>
        </div>
        <form class="ob__form" data-form="login" novalidate>${field("ob-email", "Email", a.email, { type: "email", auto: "email" })}${field("ob-pass", "Password", "", { type: "password", auto: "current-password" })}${err()}
          ${actions("Log in", { secondary: `<button type="button" class="btn btn--ghost btn--lg" data-ob="go" data-to="welcome">Back</button>` })}</form>
        <p class="ob__switch">New to Kivo? <button class="link" data-ob="go" data-to="welcome">Create an account</button></p>`);
      case "email": return shell(`
        <h1 class="ob__title">Sign up with email</h1>
        <form class="ob__form" data-form="email" novalidate>${field("ob-email", "Email", a.email, { type: "email", placeholder: "you@school.edu", auto: "email", hint: "Your school email works best for sharing with classmates later." })}${field("ob-pass", "Password", a.password, { type: "password", auto: "new-password", hint: "At least 8 characters." })}${err()}
          ${actions("Continue", { secondary: `<button type="button" class="btn btn--ghost btn--lg" data-ob="go" data-to="welcome">Back</button>` })}</form>`);
      case "provider": {
        const isApple = ob.provider === "apple";
        const known = Object.values(P).map((t) => t.profile.email);
        return shell(`<div class="sso sso--${ob.provider}">
          <div class="sso__head">${isApple ? APPLE : GOOGLE}<span>${isApple ? "Sign in with Apple" : "Sign in with Google"}</span></div>
          ${isApple ? `<p class="body-strong">Use your Apple Account with Kivo</p>
            ${field("ob-email", "Apple Account", a.email, { type: "email", placeholder: "name@icloud.com" })}
            <fieldset class="field"><legend class="field__label">Email to share with Kivo</legend><div class="radio-stack">
              <label class="radio-card is-selected"><input type="radio" name="ob-hide" value="share" checked><span><strong>Share My Email</strong><small>Kivo sees your Apple Account email.</small></span></label>
              <label class="radio-card"><input type="radio" name="ob-hide" value="hide"><span><strong>Hide My Email</strong><small>Apple gives Kivo a private relay address that forwards to you.</small></span></label></div></fieldset>
            <p class="caption">${icon("lock", 12)} On iPhone this is the native Face ID sheet.</p>`
          : `<p class="body-strong">Choose an account to continue to Kivo</p>
            <ul class="sso__accounts">${known.map((e) => `<li><button class="sso__acct" data-ob="pick" data-email="${esc(e)}"><span class="avatar avatar--sm">${esc(e[0].toUpperCase())}</span><span>${esc(e)}</span></button></li>`).join("")}</ul>
            ${field("ob-email", "Or use another account", "", { type: "email", placeholder: "name@gmail.com" })}`}
          ${err()}
          <div class="ob__actions"><button class="btn btn--ghost btn--lg" data-ob="go" data-to="welcome">Cancel</button><button class="btn btn--primary btn--lg" data-ob="sso">Continue</button></div>
          <p class="proto-note">${icon("info", 14)}<span>Simulated. The real ${isApple ? "Apple" : "Google"} sign-in connects once accounts launch.</span></p></div>`);
      }
      case "name": return shell(`
        <h1 class="ob__title">What should we call you?</h1>
        <form class="ob__form" data-form="name" novalidate><div class="field-row">${field("ob-first", "First name", a.first, { auto: "given-name" })}${field("ob-last", "Last name", a.last, { auto: "family-name" })}</div>${err()}${actions("Continue")}</form>`);
      case "role": return shell(`
        <h1 class="ob__title">What are you studying, ${esc(a.first)}?</h1>
        <p class="ob__lede">Kivo sets up your semester, courses and exam folders to match your program.</p>
        <div class="role-grid" role="radiogroup" aria-label="Your program">${ROLES.map((r) => `<button class="role ${a.role === r.id ? "is-selected" : ""}" role="radio" aria-checked="${a.role === r.id}" data-ob="role" data-id="${r.id}"><strong>${r.label}</strong><small>${r.sub}</small></button>`).join("")}</div>
        ${err()}${actions("Continue")}`);
      case "details": return shell(`<h1 class="ob__title">${detailsTitle()}</h1><form class="ob__form" data-form="details" novalidate>${detailsFields()}${err()}${actions("Continue")}</form>`);
      case "courses": {
        const t = templateFor(a.role);
        const presets = coursePresets();
        return shell(`
          <h1 class="ob__title">Your courses this semester</h1>
          <p class="ob__lede">Pick what you’re taking. Each course gets its own exam folders and lecture collections.</p>
          <form class="ob__form" data-form="courses" novalidate>
            ${field("ob-sem", "Semester", ob.semester, { hint: "Your library is organized by semester. Archive it when it ends." })}
            <fieldset class="field"><legend class="field__label">Courses</legend><div class="chip-wall">${presets.map((c) => `<label class="chip-check"><input type="checkbox" name="ob-course" value="${esc(c.key)}" ${ob.courses.includes(c.key) ? "checked" : ""}><span>${icon("check", 14)}${esc(c.name)}${c.sample ? `<em>sample cards</em>` : ""}</span></label>`).join("")}</div></fieldset>
            <div class="add-course"><input id="ob-custom" placeholder="Add another course, like “Ocular Pharmacology”" aria-label="Add a course"><button type="button" class="btn btn--secondary" data-ob="add-course">${icon("plus", 16)}Add</button></div>
            ${err()}${actions("Continue")}
          </form>
          ${t ? "" : `<p class="caption">You can add more courses anytime from the Library.</p>`}`);
      }
      case "exams": {
        const list = selectedCourses();
        return shell(`
          <h1 class="ob__title">Any exams coming up?</h1>
          <p class="ob__lede">Add the next exam for each course. Kivo shows countdowns and which course to review first. You can also import your Canvas or Google calendar later from Exams.</p>
          <form class="ob__form" data-form="exams" novalidate>
            <div class="exam-rows">${list.map((c) => { const e = ob.exams[c.key] || {}; return `<div class="exam-row"><span class="exam-row__course">${esc(c.name)}</span><input data-exam-name="${esc(c.key)}" value="${esc(e.name || "")}" placeholder="Exam name" aria-label="Next exam for ${esc(c.name)}"><input type="date" data-exam-date="${esc(c.key)}" value="${esc(e.date || "")}" aria-label="Date for ${esc(c.name)} exam"></div>`; }).join("")}</div>
            ${a.role === "prehealth" && a.target !== "Other" ? field("ob-test", `${({ MD: "MCAT", OD: "OAT", DDS: "DAT", PA: "GRE or PA-CAT" })[a.target]} date <small>optional</small>`, a.examDate, { type: "date", hint: "Shows a countdown with your other exams." }) : ""}
            ${err()}${actions("Continue", { secondary: `<button type="button" class="btn btn--ghost btn--lg" data-ob="skip-exams">Skip for now</button>` })}
          </form>`);
      }
      case "plan": {
        const t = templateFor(a.role);
        return shell(`
          <h1 class="ob__title">How much do you want to study?</h1>
          <form class="ob__form" data-form="plan" novalidate>
            <fieldset class="field"><legend class="field__label">New cards per day, per course</legend><div class="pace-grid">${[[10, "Light", "About 10 min a course"], [20, "Steady", "Anki’s default"], [35, "Intense", "Before a big exam"]].map(([v, l, d]) => `<label class="radio-card ${ob.pace === v ? "is-selected" : ""}"><input type="radio" name="ob-pace" value="${v}" ${ob.pace === v ? "checked" : ""}><span><strong>${l} · ${v}</strong><small>${d}</small></span></label>`).join("")}</div><span class="field__hint">Reviews of cards you’ve already seen always come first. Change this per course anytime.</span></fieldset>
            ${select("ob-remind", "Daily reminder on your phone", ob.reminder, [["", "Off"], ["07:30", "7:30 AM"], ["12:00", "12:00 PM"], ["19:00", "7:00 PM"], ["21:00", "9:00 PM"]])}
            ${t ? `<label class="switch switch--block"><input type="checkbox" id="ob-sample" ${ob.sample ? "checked" : ""}><span class="switch__track"></span><span><strong>Start with sample cards</strong><small>Adds example lectures and cards to ${esc(t.courses.filter((c) => ob.courses.includes("t:" + c.id)).map((c) => c.name).join(", ") || "your courses")} so you can try reviewing right away. Delete them anytime.</small></span></label>` : `<p class="caption">Your courses start empty. Add your first lecture collection, or import cards from Anki or Quizlet.</p>`}
            ${err()}${actions(`${icon("check", 16)}Create my library`)}
          </form>`);
      }
      case "done": {
        const acct = ob.acct;
        return shell(`<div class="ob__done">
          <h1 class="ob__title">You’re all set, ${esc(acct.first)}.</h1>
          <ul class="done-list">
            <li><span><strong>${esc(ob.semester)}</strong> with ${ob.doneCourses} ${ob.doneCourses === 1 ? "course" : "courses"}</span></li>
            <li><span>${ob.doneExams ? `${ob.doneExams} upcoming ${ob.doneExams === 1 ? "exam" : "exams"}${ob.firstExam ? `, starting with ${esc(ob.firstExam)}` : ""}` : "No exams yet. Add them from Exams or import your calendar."}</span></li>
            <li><span>${ob.doneCards ? `${ob.doneCards} sample cards ready to review` : "Empty courses, ready for your first lecture"}</span></li>
            <li><span>${ob.pace} new cards a day per course${ob.reminder ? ` · phone reminder at ${esc(({ "07:30": "7:30 AM", "12:00": "12:00 PM", "19:00": "7:00 PM", "21:00": "9:00 PM" })[ob.reminder] || ob.reminder)}` : ""}</span></li>
          </ul>
          <div class="ob__actions"><button class="btn btn--primary btn--lg" data-ob="enter">${ob.doneCards ? "Start studying" : "Go to my library"}</button></div></div>`);
      }
    }
    return "";
  }
  function detailsTitle() { const r = ob.a.role; return r === "prehealth" ? "Tell us about your path" : r === "working" ? "Tell us about your work" : r === "other" ? "Tell us about your program" : "Tell us about your program"; }
  function detailsFields() {
    const a = ob.a, r = a.role;
    if (r === "optometry" || r === "medicine" || r === "dentistry") {
      const degrees = { optometry: [["OD", "OD (Doctor of Optometry)"]], medicine: [["MD", "MD"], ["DO", "DO"]], dentistry: [["DDS", "DDS"], ["DMD", "DMD"]] }[r];
      const boards = BOARDS[r].filter((b) => r !== "medicine" || (a.degree === "DO" ? true : !b.startsWith("COMLEX")));
      return `<div class="field-row">${select("ob-degree", "Degree", a.degree || degrees[0][0], degrees)}${select("ob-year", "Year", a.year || YEARS[r][0], YEARS[r])}</div>
        ${field("ob-school", "School", a.school, { list: SCHOOLS[r], placeholder: "Start typing your school" })}
        <div class="field-row">${field("ob-grad", "Graduation year", a.gradYear, { type: "number", placeholder: "2030" })}${select("ob-boards", "Next board exam", a.boards || boards[0], [...boards, "Not sure yet"])}</div>`;
    }
    if (r === "prehealth") return `${field("ob-school", "College or university", a.school, { list: SCHOOLS.prehealth })}
      <div class="field-row">${field("ob-major", "Major", a.major, { placeholder: "Biology" })}${select("ob-year", "Year", a.year || "3rd year", YEARS.prehealth)}</div>
      ${select("ob-target", "Applying to", a.target, TARGETS.map(([v, l]) => [v, l]))}`;
    return `${field("ob-program", r === "working" ? "Your role" : "Program", a.program, { placeholder: r === "working" ? "e.g. PGY-1 resident, optometrist, clinical instructor" : "e.g. PharmD, BSN nursing, PA, DPT" })}
      ${field("ob-school", r === "working" ? "Hospital, practice or school" : "School", a.school)}
      ${field("ob-year", r === "working" ? "Specialty or focus" : "Year", a.year, { placeholder: r === "working" ? "e.g. Internal medicine" : "e.g. Year 2" })}`;
  }
  function coursePresets() {
    const t = templateFor(ob.a.role);
    const base = t ? t.courses.filter((c) => !(t.semesters.find((s) => s.id === c.semesterId)?.archived)).map((c) => ({ key: "t:" + c.id, name: c.name, sample: t.decks.some((d) => d.courseId === c.id) })) : [];
    const extra = (t ? t.extraCourses || [] : OTHER_COURSES).map((n) => ({ key: "x:" + n, name: n }));
    return [...base, ...extra, ...ob.custom.map((n) => ({ key: "x:" + n, name: n }))];
  }
  function selectedCourses() { return coursePresets().filter((c) => ob.courses.includes(c.key)); }

  function render() {
    $("#app").innerHTML = view();
    document.body.classList.add("is-onboarding");
    const first = $("#ob-main input:not([type=hidden]):not([type=checkbox]):not([type=radio]), #ob-main .role.is-selected, #ob-main .role, #ob-main .btn--apple");
    first?.focus();
    document.title = "Welcome · Kivo";
  }

  /* ---------- defaults per program ------------------------------------- */
  function applyRoleDefaults() {
    const a = ob.a, t = templateFor(a.role);
    if (ob.persona) return;
    if (YEARS[a.role] && !YEARS[a.role].includes(a.year)) a.year = YEARS[a.role][0];
    ob.courses = t ? t.courses.filter((c) => !(t.semesters.find((s) => s.id === c.semesterId)?.archived)).map((c) => "t:" + c.id) : [];
    ob.exams = {};
    if (t) for (const u of t.units) if (ob.courses.includes("t:" + u.courseId) && u.offset >= 0) { const k = "t:" + u.courseId; if (!ob.exams[k]) ob.exams[k] = { name: u.name, date: isoDate(new Date(today() + u.offset * DAY)) }; }
  }
  function semesterName() { const m = new Date().getMonth(); const term = m >= 7 ? "Fall" : m >= 4 ? "Summer" : "Spring"; return `${term} ${new Date().getFullYear()}${ob.a.year ? " · " + ob.a.year : ""}`; }
  function usePersona(id) {
    const t = P[id];
    ob = blank(); ob.persona = id;
    Object.assign(ob.a, { degree: "", ...t.profile, password: "" });
    ob.provider = t.profile.email.endsWith("icloud.com") ? "apple" : "google";
    ob.semester = t.semesters.find((s) => !s.archived)?.name || "";
    ob.courses = t.courses.filter((c) => !(t.semesters.find((s) => s.id === c.semesterId)?.archived)).map((c) => "t:" + c.id);
    for (const u of t.units) if (u.offset >= 0 && ob.courses.includes("t:" + u.courseId) && !ob.exams["t:" + u.courseId]) ob.exams["t:" + u.courseId] = { name: u.name, date: isoDate(new Date(today() + u.offset * DAY)) };
    if (t.profile.examOffset) ob.a.examDate = isoDate(new Date(today() + t.profile.examOffset * DAY));
    ob.screen = "provider";
  }

  /* ---------- step handlers ------------------------------------------- */
  const val = (id) => ($("#" + id)?.value || "").trim();
  function next() {
    const a = ob.a; ob.error = "";
    switch (ob.screen) {
      case "email": {
        a.email = val("ob-email"); a.password = $("#ob-pass").value;
        if (!/^\S+@\S+\.\S+$/.test(a.email)) return fail("Enter a valid email address.", "ob-email");
        if (accounts()[a.email.toLowerCase()]) return fail("There’s already an account with that email. Log in instead.", "ob-email");
        if (a.password.length < 8) return fail("Use at least 8 characters for your password.", "ob-pass");
        ob.provider = "email"; ob.screen = "name"; break;
      }
      case "login": {
        const email = val("ob-email").toLowerCase(), acct = accounts()[email]; a.email = val("ob-email");
        if (!acct) return fail("No account with that email in this browser. Check the spelling or create an account.", "ob-email");
        if (acct.provider !== "email") return fail(`This account uses ${acct.provider === "apple" ? "Sign in with Apple" : "Google"}. Use that button above.`);
        if (acct.pass !== hash($("#ob-pass").value)) return fail("That password doesn’t match. Try again.", "ob-pass");
        return enter(acct);
      }
      case "name":
        a.first = val("ob-first"); a.last = val("ob-last");
        if (!a.first) return fail("Add your first name.", "ob-first");
        ob.screen = "role"; break;
      case "role":
        if (!a.role) return fail("Choose the option that fits you best.");
        ob.screen = "details"; break;
      case "details": {
        const r = a.role;
        if (YEARS[r] || r === "other" || r === "working") a.year = val("ob-year") || a.year;
        a.school = val("ob-school");
        if (["optometry", "medicine", "dentistry"].includes(r)) { a.degree = val("ob-degree"); a.gradYear = val("ob-grad"); a.boards = val("ob-boards"); if (!a.school) return fail("Add your school so classmates can find what you share.", "ob-school"); }
        if (r === "prehealth") { a.major = val("ob-major"); a.target = val("ob-target"); }
        if (r === "other" || r === "working") { a.program = val("ob-program"); if (!a.program) return fail(r === "working" ? "Add your role." : "Add your program.", "ob-program"); }
        if (!ob.persona && !ob.semester) ob.semester = semesterName();
        if (!ob.courses.length && !ob.persona) applyRoleDefaults();
        ob.screen = "courses"; break;
      }
      case "courses":
        ob.semester = val("ob-sem") || semesterName();
        ob.courses = $$("input[name='ob-course']:checked").map((i) => i.value);
        if (!ob.courses.length) return fail("Pick at least one course. You can add more later.");
        ob.screen = "exams"; break;
      case "exams":
        for (const el of $$("[data-exam-name]")) { const k = el.dataset.examName, d = $(`[data-exam-date="${CSS.escape(k)}"]`).value; ob.exams[k] = { name: el.value.trim(), date: d }; }
        if (a.role === "prehealth") a.examDate = val("ob-test");
        ob.screen = "plan"; break;
      case "plan":
        ob.pace = +($("input[name='ob-pace']:checked")?.value || 20); ob.reminder = val("ob-remind"); ob.sample = !!$("#ob-sample")?.checked;
        return finish();
    }
    render();
  }
  function fail(msg, id) { ob.error = msg; render(); if (id) { const el = $("#" + id); el?.setAttribute("aria-invalid", "true"); el?.focus(); } }
  function back() {
    ob.error = "";
    const i = STEPS.indexOf(ob.screen);
    ob.screen = i > 0 ? STEPS[i - 1] : "welcome";
    render();
  }
  function sso() {
    const a = ob.a; ob.error = "";
    let email = val("ob-email") || ob.picked || "";
    if (ob.provider === "apple" && $("input[name='ob-hide']:checked")?.value === "hide") ob.relay = true;
    if (!/^\S+@\S+\.\S+$/.test(email)) return fail("Choose an account or enter an email.", "ob-email");
    const existing = accounts()[email.toLowerCase()];
    if (existing) return enter(existing);
    a.email = email;
    if (!a.first) { const nm = email.split("@")[0].split(/[._-]/); a.first = cap(nm[0] || ""); a.last = cap(nm[1] || ""); }
    if (ob.relay) a.email = `${hash(email).slice(0, 8)}@privaterelay.appleid.com`;
    ob.screen = "name"; render();
  }
  const cap = (s) => s ? s[0].toUpperCase() + s.slice(1) : "";

  /* ---------- building the library -------------------------------------- */
  function guessKind(name) { return /\bosce\b/i.test(name) ? "OSCE" : /practical/i.test(name) ? "Practical" : /mid-?term/i.test(name) ? "Midterm" : /\bfinal/i.test(name) ? "Final" : /\bquiz/i.test(name) ? "Quiz" : /\b(mcat|oat|dat|nbeo|usmle|comlex|inbde|board)/i.test(name) ? "Board" : "Exam"; }
  function finish() {
    const a = ob.a, t = templateFor(a.role), sample = !!t && ob.sample;
    const semId = "sem-" + Date.now().toString(36);
    const offsetOf = (iso) => { if (!iso) return null; const [y, m, d] = iso.split("-").map(Number); return Math.round((new Date(y, m - 1, d).getTime() - today()) / DAY); };
    const T = { semesters: [{ id: semId, name: ob.semester, archived: false }], courses: [], units: [], decks: [], notes: [], sampleActivity: sample ? t.sampleActivity : [] };
    if (sample) for (const s of t.semesters.filter((x) => x.archived)) T.semesters.push(s);
    const hues = ["lavender", "sage", "peach"];
    const keyToCourse = {};
    for (const key of ob.courses) {
      if (key.startsWith("t:")) {
        const c = t.courses.find((x) => x.id === key.slice(2));
        T.courses.push({ ...c, semesterId: semId }); keyToCourse[key] = c.id;
      } else {
        const id = "c-" + Math.random().toString(36).slice(2, 8), name = key.slice(2);
        T.courses.push({ id, name, code: "", hue: hues[T.courses.length % 3], semesterId: semId }); keyToCourse[key] = id;
      }
    }
    if (sample) {
      for (const c of t.courses.filter((x) => t.semesters.find((s) => s.id === x.semesterId)?.archived)) T.courses.push(c);
      const ids = new Set(T.courses.map((c) => c.id));
      T.units = t.units.filter((u) => ids.has(u.courseId)).map((u) => ({ ...u }));
      T.decks = t.decks.filter((d) => ids.has(d.courseId)).map((d) => ({ creator: { name: `${a.first} ${a.last}`.trim(), initials: initials(a) }, ...d }));
      const deckIds = new Set(T.decks.map((d) => d.id));
      T.notes = t.notes.filter((n) => deckIds.has(n.deckId));
    }
    let examCount = 0, firstExam = null;
    for (const [key, e] of Object.entries(ob.exams)) {
      const courseId = keyToCourse[key]; if (!courseId || !e.name) continue;
      const off = offsetOf(e.date);
      const same = T.units.find((u) => u.courseId === courseId && u.name.toLowerCase() === e.name.toLowerCase());
      if (same) { same.offset = off; } else T.units.push({ id: "u-" + Math.random().toString(36).slice(2, 8), courseId, name: e.name, kind: guessKind(e.name), offset: off });
    }
    if (a.role === "prehealth" && a.examDate) {
      const test = ({ MD: "MCAT", OD: "OAT", DDS: "DAT", PA: "GRE" })[a.target] || "Entrance exam";
      let cid = Object.values(keyToCourse).find((id) => /mcat|prep/i.test(T.courses.find((c) => c.id === id)?.name || ""));
      if (!cid) { cid = "c-test"; T.courses.push({ id: cid, name: `${test} Prep`, code: "", hue: "lavender", semesterId: semId }); }
      const same = T.units.find((u) => u.courseId === cid && u.name === test);
      if (same) same.offset = offsetOf(a.examDate); else T.units.push({ id: "u-test", courseId: cid, name: test, kind: "Board", offset: offsetOf(a.examDate) });
    }
    for (const u of T.units) if (u.offset != null && u.offset >= 0 && T.courses.find((c) => c.id === u.courseId)?.semesterId === semId) { examCount++; if (!firstExam || u.offset < firstExam.offset) firstExam = u; }
    const acct = {
      id: "a" + hash(a.email.toLowerCase()), email: a.email, provider: ob.provider || "email", pass: ob.provider === "email" ? hash(a.password) : null,
      first: a.first, last: a.last, fullName: `${a.first} ${a.last}`.trim(), initials: initials(a),
      role: a.role, persona: t ? t.id : null, degree: a.degree, school: a.school, year: a.year, gradYear: a.gradYear, boards: a.boards, major: a.major, target: a.target, program: a.program,
      reminder: ob.reminder, created: Date.now(),
    };
    acct.programLabel = programLabel(acct);
    S.useAccount(acct);
    const options = {}; for (const c of T.courses) options[c.id] = { newPerDay: ob.pace };
    S.build(T, options);
    saveAccount(acct);
    Object.assign(ob, { acct, screen: "done", doneCourses: ob.courses.length, doneExams: examCount, firstExam: firstExam ? `${firstExam.name} · ${T.courses.find((c) => c.id === firstExam.courseId)?.name}` : null, doneCards: S.db.cards.length });
    render();
  }
  const initials = (a) => ((a.first[0] || "") + (a.last[0] || "")).toUpperCase() || "ME";
  function enter(acct) { store.set("session", acct.email.toLowerCase()); document.body.classList.remove("is-onboarding"); onDone(acct); }

  /* ---------- events ------------------------------------------------------ */
  document.addEventListener("click", (e) => {
    if (!document.body.classList.contains("is-onboarding")) return;
    const el = e.target.closest("[data-ob]"); if (!el) return;
    e.preventDefault();
    const k = el.dataset.ob;
    if (k === "next") next();
    else if (k === "back") back();
    else if (k === "go") { ob.error = ""; ob.screen = el.dataset.to; render(); }
    else if (k === "provider") { ob.error = ""; ob.provider = el.dataset.p; ob.picked = null; ob.screen = "provider"; render(); }
    else if (k === "persona") { usePersona(el.dataset.id); render(); }
    else if (k === "pick") { ob.picked = el.dataset.email; $$(".sso__acct").forEach((b) => b.classList.toggle("is-picked", b === el)); const i = $("#ob-email"); if (i) i.value = ""; sso(); }
    else if (k === "sso") sso();
    else if (k === "role") { const changed = ob.a.role !== el.dataset.id; ob.a.role = el.dataset.id; if (changed) { ob.persona = null; ob.courses = []; ob.exams = {}; ob.semester = ""; } render(); }
    else if (k === "add-course") { const v = val("ob-custom"); if (!v) return; ob.courses = $$("input[name='ob-course']:checked").map((i) => i.value); ob.semester = val("ob-sem") || ob.semester; if (!ob.custom.includes(v)) ob.custom.push(v); ob.courses.push("x:" + v); render(); $("#ob-custom")?.focus(); }
    else if (k === "skip-exams") { ob.exams = {}; ob.screen = "plan"; render(); }
    else if (k === "enter") enter(ob.acct);
  });
  document.addEventListener("submit", (e) => { if (!document.body.classList.contains("is-onboarding")) return; e.preventDefault(); next(); });
  document.addEventListener("change", (e) => {
    if (!document.body.classList.contains("is-onboarding")) return;
    if (e.target.name === "ob-pace" || e.target.name === "ob-hide") $$(`input[name='${e.target.name}']`).forEach((i) => i.closest(".radio-card")?.classList.toggle("is-selected", i.checked));
    if (e.target.id === "ob-degree" && ob.a.role === "medicine") { ob.a.degree = e.target.value; ob.a.school = val("ob-school"); ob.a.year = val("ob-year"); render(); }
  });
  document.addEventListener("keydown", (e) => { if (document.body.classList.contains("is-onboarding") && e.key === "Enter" && e.target.id === "ob-custom") { e.preventDefault(); $("[data-ob='add-course']").click(); } });

  return { start, accounts, current: () => accounts()[store.get("session", "")] || null, signOut: () => store.set("session", ""), programLabel };
})();
