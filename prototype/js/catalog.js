/* ==========================================================================
   Kivo — course catalog
   Suggested courses by program, year and term. Built from a typical
   curriculum for each program plus every course in the sample student
   templates (window.KIVO_PERSONAS), so the two never drift apart.
   Suggestions only: students can always add their own courses.
   ========================================================================== */
window.KivoCatalog = (() => {
  "use strict";
  const TERMS = ["Fall", "Spring", "Summer"];

  // program → year → term → course names
  const BASE = {
    optometry: {
      OD1: {
        Summer: ["Foundations of Optometry"],
        Fall: ["Head & Neck Anatomy", "Ocular Anatomy", "Biochemistry", "Geometric Optics", "Clinical Skills", "Ocular Physiology", "Neuroanatomy", "Optometric Theory & Methods"],
        Spring: ["Ocular Physiology II", "Physical Optics", "Visual Perception & Psychophysics", "General Pathology", "Microbiology & Immunology", "Optometric Theory & Methods II"],
      },
      OD2: {
        Fall: ["Ocular Pharmacology", "Anterior Segment Disease", "Binocular Vision", "Ophthalmic Optics", "Contact Lenses I", "Clinical Methods III"],
        Spring: ["Posterior Segment Disease", "Systemic Disease", "Pediatric Optometry", "Low Vision", "Contact Lenses II", "Neuro-ophthalmic Disease"],
      },
      OD3: {
        Fall: ["Advanced Ocular Disease", "Ocular Therapeutics", "Vision Therapy", "Clinical Practicum I", "NBEO Part I Review"],
        Spring: ["Ophthalmic Procedures", "Geriatric Optometry", "Practice Management", "Public Health & Epidemiology", "Clinical Practicum II"],
      },
      OD4: {
        Fall: ["Externship Rotation", "NBEO Part II Review"],
        Spring: ["Externship Rotation", "NBEO Part III Prep"],
      },
    },
    medicine: {
      MS1: {
        Fall: ["Gross Anatomy", "Physiology", "Biochemistry & Genetics", "Histology", "Embryology", "Doctoring & Clinical Skills"],
        Spring: ["Neuroscience", "Immunology", "Microbiology", "Cardiovascular System", "Pulmonary System", "Renal System", "Epidemiology & Biostatistics"],
      },
      MS2: {
        Fall: ["Pathology", "Pharmacology", "Hematology & Oncology", "Gastrointestinal System", "Endocrine & Reproduction", "Clinical Skills II"],
        Spring: ["Musculoskeletal & Dermatology", "Psychiatry & Behavioral Science", "Medical Ethics", "USMLE Step 1 Prep"],
      },
      MS3: {
        Fall: ["Internal Medicine Clerkship", "Surgery Clerkship", "Pediatrics Clerkship", "Neurology Clerkship"],
        Spring: ["Obstetrics & Gynecology Clerkship", "Psychiatry Clerkship", "Family Medicine Clerkship", "USMLE Step 2 CK Prep"],
      },
      MS4: {
        Fall: ["Sub-internship", "Emergency Medicine", "USMLE Step 2 CK Prep"],
        Spring: ["Electives", "Transition to Residency"],
      },
    },
    dentistry: {
      D1: {
        Fall: ["Gross Anatomy", "Biochemistry", "Histology", "Dental Anatomy", "Oral Biology"],
        Spring: ["Physiology", "Microbiology & Immunology", "Neuroscience", "Dental Materials", "Preclinical Operative Dentistry I"],
      },
      D2: {
        Fall: ["Dental Anatomy & Occlusion", "Oral Histology", "Pharmacology", "Preclinical Operative Dentistry", "Periodontology", "Oral Pathology", "Dental Materials"],
        Spring: ["Endodontics", "Fixed Prosthodontics", "Removable Prosthodontics", "Oral Radiology", "Local Anesthesia"],
      },
      D3: {
        Fall: ["Clinical Operative Dentistry", "Oral Surgery", "Orthodontics", "Pediatric Dentistry"],
        Spring: ["Periodontics II", "Implant Dentistry", "Oral Medicine", "INBDE Review"],
      },
      D4: {
        Fall: ["Comprehensive Patient Care", "Community Dentistry", "INBDE Review"],
        Spring: ["Comprehensive Patient Care II", "Practice Management"],
      },
    },
    prehealth: {
      "1st year": {
        Fall: ["General Chemistry I", "Introductory Biology I", "Calculus I", "Introduction to Psychology"],
        Spring: ["General Chemistry II", "Introductory Biology II", "Statistics", "Introduction to Sociology"],
      },
      "2nd year": {
        Fall: ["Organic Chemistry I", "Physics I", "Genetics"],
        Spring: ["Organic Chemistry II", "Physics II", "Cell Biology"],
      },
      "3rd year": {
        Fall: ["Biochemistry", "Human Physiology I", "Microbiology"],
        Spring: ["Human Physiology II", "Immunology", "Molecular Biology"],
      },
      "4th year": {
        Fall: ["Pharmacodynamic Principles", "Fundamental Immunology", "Human Physiology II", "Neuroscience", "Biochemistry", "Statistics"],
        Spring: ["Pathobiology", "Endocrinology", "Bioethics", "Research Project"],
      },
      "Post-bacc": {
        Fall: ["General Chemistry I", "Organic Chemistry I", "Physics I", "Biology I"],
        Spring: ["General Chemistry II", "Organic Chemistry II", "Physics II", "Biochemistry"],
      },
      "Gap year": { Fall: ["Biochemistry Review", "Psych/Soc Review"], Spring: ["Biochemistry Review", "Psych/Soc Review"] },
    },
  };
  // Entrance exam prep, suggested in later pre-health years.
  const PREP = { MD: "MCAT Prep", OD: "OAT Prep", DDS: "DAT Prep", PA: "PA-CAT Prep" };
  const PREP_YEARS = ["3rd year", "4th year", "Post-bacc", "Gap year"];
  // Other programs are matched by a keyword in what the student typed.
  const OTHER = [
    [/nurs|bsn|rn\b|np\b/i, "Nursing", ["Health Assessment", "Pathophysiology", "Pharmacology", "Fundamentals of Nursing", "Medical-Surgical Nursing", "Maternal-Newborn Nursing", "Pediatric Nursing", "Mental Health Nursing", "NCLEX Review"]],
    [/pharm/i, "Pharmacy", ["Pharmaceutics", "Medicinal Chemistry", "Pharmacokinetics", "Pharmacology", "Pharmacotherapy", "Pharmacy Law", "NAPLEX Review"]],
    [/\bpa\b|physician assist/i, "Physician assistant", ["Clinical Medicine", "Physical Diagnosis", "Pharmacology", "Anatomy", "Behavioral Medicine", "PANCE Review"]],
    [/\bpt\b|dpt|physical ther|physio/i, "Physical therapy", ["Gross Anatomy", "Kinesiology", "Neuroscience", "Musculoskeletal PT", "Neurologic PT", "Cardiopulmonary PT", "NPTE Review"]],
    [/ot\b|occupational/i, "Occupational therapy", ["Anatomy", "Neuroscience", "Occupational Performance", "Pediatrics OT", "Adult Rehabilitation", "NBCOT Review"]],
  ];
  const GENERAL = ["Anatomy & Physiology", "Pharmacology", "Pathophysiology", "Microbiology", "Biochemistry"];
  const WORKING = ["Board Review", "Clinical Guidelines", "Pharmacology Refresher", "Procedures", "Case Review"];

  const termOf = (semesterName = "") => /spring|winter/i.test(semesterName) ? "Spring" : /summer/i.test(semesterName) ? "Summer" : /fall|autumn/i.test(semesterName) ? "Fall" : null;
  const currentTerm = (d = new Date()) => { const m = d.getMonth(); return m >= 7 ? "Fall" : m >= 4 ? "Summer" : "Spring"; };

  // program → year → term → Map(lower name → {name, code})
  const db = {};
  const add = (role, year, term, name, code = "") => {
    const t = ((db[role] ||= {})[year] ||= {})[term] ||= new Map();
    const k = name.toLowerCase();
    if (!t.has(k)) t.set(k, { name, code }); else if (code && !t.get(k).code) t.get(k).code = code;
  };
  for (const [role, years] of Object.entries(BASE)) for (const [year, terms] of Object.entries(years)) for (const [term, names] of Object.entries(terms)) names.forEach((n) => add(role, year, term, n));
  // Parse the sample student templates into the catalog.
  for (const t of Object.values(window.KIVO_PERSONAS || {})) {
    const role = t.profile?.role, year = t.profile?.year; if (!role || !year) continue;
    for (const c of t.courses || []) {
      const sem = (t.semesters || []).find((s) => s.id === c.semesterId);
      const term = termOf(sem?.name) || "Fall";
      add(role, year, term, c.name, c.code || "");
    }
    for (const n of t.extraCourses || []) add(role, year, termOf((t.semesters || []).find((s) => !s.archived)?.name) || "Fall", n);
  }
  const list = (m) => (m ? [...m.values()] : []);

  /** Years with suggestions for a program (in curriculum order). */
  function years(role) { return Object.keys(db[role] || {}); }
  /** Terms with suggestions for a program year. */
  function terms(role, year) { return TERMS.filter((t) => db[role]?.[year]?.[t]); }

  /**
   * Suggestions for one program/year/term.
   * Falls back to the nearest term so a student is never shown an empty list.
   */
  function suggest({ role, year, term, target, program } = {}) {
    if (role === "other") { const hit = OTHER.find(([re]) => re.test(program || "")); return (hit ? hit[2] : GENERAL).map((name) => ({ name, code: "" })); }
    if (role === "working") return WORKING.map((name) => ({ name, code: "" }));
    const y = db[role]?.[year]; if (!y) return [];
    const t = y[term] ? term : y.Fall ? "Fall" : Object.keys(y)[0];
    const out = list(y[t]);
    if (role === "prehealth" && PREP[target] && PREP_YEARS.includes(year) && !out.some((c) => c.name === PREP[target])) out.push({ name: PREP[target], code: "" });
    return out;
  }
  /** Every course for a program across all years: used for type-ahead. */
  function all(role) {
    const seen = new Map();
    for (const y of Object.values(db[role] || {})) for (const m of Object.values(y)) for (const c of m.values()) if (!seen.has(c.name.toLowerCase())) seen.set(c.name.toLowerCase(), c);
    if (role === "other") OTHER.forEach(([, , n]) => n.forEach((name) => seen.set(name.toLowerCase(), { name, code: "" })));
    return [...seen.values()];
  }
  const otherLabel = (program) => OTHER.find(([re]) => re.test(program || ""))?.[1] || null;
  return { suggest, all, years, terms, termOf, currentTerm, otherLabel, TERMS };
})();
