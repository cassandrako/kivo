/* ==========================================================================
   Kivo — local sample data (prototype only)
   All content is static and stored in memory. Nothing here is fetched from a
   backend, and no metric below is the output of a real learning algorithm.
   ========================================================================== */

window.KIVO_DATA = (() => {
  const user = {
    name: "Alex",
    fullName: "Alex Rivera",
    initials: "AR",
    program: "Doctor of Optometry",
    year: "OD1",
    school: "Pacific College of Optometry",
    streakDays: 9,
  };

  const courses = [
    {
      id: "hna", name: "Head & Neck Anatomy", code: "ANAT 612", term: "Fall · Year 1",
      hue: "lavender", collections: 6, cards: 412, due: 18, newCards: 24,
      lastActivity: "Today", progress: 0.62, exam: "Exam 2 · Nov 13",
    },
    {
      id: "oa", name: "Ocular Anatomy", code: "OPT 621", term: "Fall · Year 1",
      hue: "sage", collections: 5, cards: 298, due: 7, newCards: 12,
      lastActivity: "Yesterday", progress: 0.71, exam: "Practical · Nov 20",
    },
    {
      id: "bio", name: "Biochemistry", code: "BIOC 605", term: "Fall · Year 1",
      hue: "peach", collections: 8, cards: 536, due: 3, newCards: 40,
      lastActivity: "3 days ago", progress: 0.44, exam: "Midterm · Dec 2",
    },
    {
      id: "go", name: "Geometric Optics", code: "OPT 631", term: "Fall · Year 1",
      hue: "lavender", collections: 4, cards: 187, due: 2, newCards: 8,
      lastActivity: "2 days ago", progress: 0.58, exam: "Quiz 4 · Nov 10",
    },
    {
      id: "cs", name: "Clinical Skills", code: "CLIN 640", term: "Fall · Year 1",
      hue: "sage", collections: 3, cards: 142, due: 0, newCards: 6,
      lastActivity: "Last week", progress: 0.80, exam: "OSCE · Dec 9",
    },
  ];

  /* Cards for the flagship collection ------------------------------------ */
  const cnCards = [
    { id: "c1", type: "basic", section: "Overview",
      front: "Which cranial nerves carry parasympathetic fibers?",
      back: "CN III, VII, IX and X.",
      extra: "Mnemonic: “1973” — III, VII, IX, X.", tags: ["parasympathetic", "high-yield"], state: "review" },
    { id: "c2", type: "cloze", section: "Oculomotor (CN III)",
      front: "The oculomotor nerve exits the brainstem in the {{interpeduncular fossa}} of the midbrain.",
      back: "interpeduncular fossa",
      extra: "It passes between the posterior cerebral and superior cerebellar arteries.", tags: ["CN III", "brainstem"], state: "review" },
    { id: "c3", type: "vignette", section: "Oculomotor (CN III)",
      front: "A 58-year-old with poorly controlled diabetes reports sudden diplopia. The right eye is “down and out” with ptosis, but the pupil is round and reactive. What is the most likely cause?",
      back: "Ischemic (microvascular) CN III palsy — pupil-sparing.",
      extra: "Pupillomotor fibers run superficially on the nerve and are relatively spared by ischemia, but compressed early by an aneurysm (e.g., PCom). A pupil-involving CN III palsy needs urgent imaging.",
      tags: ["CN III", "clinical"], state: "learning" },
    { id: "c4", type: "basic", section: "Trochlear (CN IV)",
      front: "What is the only cranial nerve to exit from the dorsal brainstem?",
      back: "Trochlear nerve (CN IV).",
      extra: "It decussates, so a lesion of the CN IV nucleus affects the contralateral superior oblique.", tags: ["CN IV"], state: "review" },
    { id: "c5", type: "mcq", section: "Trochlear (CN IV)",
      front: "A patient tilts their head to the left to relieve vertical diplopia. Which muscle is most likely weak?",
      options: ["Left superior oblique", "Right superior oblique", "Right inferior rectus", "Left inferior oblique"],
      answer: 1,
      back: "Right superior oblique.",
      extra: "Head tilt away from the side of the lesion reduces the need for intorsion from the paretic superior oblique.", tags: ["CN IV", "clinical"], state: "new" },
    { id: "c6", type: "occlusion", section: "Trigeminal (CN V)",
      front: "Identify the foramen through which V2 (maxillary) exits the skull.",
      back: "Foramen rotundum.",
      extra: "V1 — superior orbital fissure · V2 — foramen rotundum · V3 — foramen ovale.", tags: ["CN V", "foramina"], state: "learning" },
    { id: "c7", type: "basic", section: "Abducens (CN VI)",
      front: "Why is the abducens nerve especially vulnerable to raised intracranial pressure?",
      back: "It has a long intracranial course and bends sharply over the petrous apex.",
      extra: "CN VI palsy can be a non-localizing sign of raised ICP.", tags: ["CN VI", "clinical"], state: "review" },
    { id: "c8", type: "cloze", section: "Facial (CN VII)",
      front: "The {{greater petrosal}} nerve carries parasympathetic fibers to the lacrimal gland via the pterygopalatine ganglion.",
      back: "greater petrosal",
      extra: "Dry eye after a proximal CN VII lesion reflects loss of these fibers.", tags: ["CN VII", "lacrimal"], state: "review" },
    { id: "c9", type: "basic", section: "Overview",
      front: "Which foramen transmits CN IX, X and XI?",
      back: "Jugular foramen.",
      extra: "", tags: ["foramina"], state: "review" },
  ];

  const collections = [
    {
      id: "hna-cn", courseId: "hna",
      title: "Cranial Nerves", unit: "Unit 2 · Neuroanatomy", lecture: "Lecture 04",
      exam: "Exam 2", topic: "Cranial nerves I–XII",
      description: "Origins, foramina, functions and classic lesion presentations of all twelve cranial nerves, with emphasis on CN III, IV and VI for optometry.",
      creator: { name: "Priya Shah", initials: "PS", role: "OD2 · Course TA" },
      source: "personal-copy", sourceOf: "Priya Shah’s original",
      cards: 64, due: 12, newCards: 8, updated: "Nov 3, 2026", created: "Sep 18, 2026",
      tags: ["neuro", "high-yield", "exam-2"], sections: [
        { name: "Overview", count: 8 },
        { name: "Olfactory & Optic (CN I–II)", count: 6 },
        { name: "Oculomotor (CN III)", count: 11 },
        { name: "Trochlear (CN IV)", count: 6 },
        { name: "Trigeminal (CN V)", count: 10 },
        { name: "Abducens (CN VI)", count: 5 },
        { name: "Facial (CN VII)", count: 9 },
        { name: "CN VIII–XII", count: 9 },
      ],
      cardList: cnCards,
      retention: 0.86,
      collaborators: [
        { name: "Alex Rivera", initials: "AR", role: "Owner", you: true },
        { name: "Jordan Lee", initials: "JL", role: "Editor" },
        { name: "Sam Okafor", initials: "SO", role: "Viewer" },
      ],
    },
    { id: "hna-orbit", courseId: "hna", title: "Bony Orbit & Foramina", unit: "Unit 1 · Skull", lecture: "Lecture 02",
      exam: "Exam 1", topic: "Orbit", creator: { name: "Alex Rivera", initials: "AR" }, source: "original",
      cards: 48, due: 4, newCards: 0, updated: "Oct 28, 2026", tags: ["orbit"] },
    { id: "hna-pter", courseId: "hna", title: "Pterygopalatine Fossa", unit: "Unit 2 · Neuroanatomy", lecture: "Lecture 06",
      exam: "Exam 2", topic: "PPF", creator: { name: "Jordan Lee", initials: "JL" }, source: "shared",
      cards: 36, due: 2, newCards: 10, updated: "Nov 1, 2026", tags: ["autonomics"] },
    { id: "hna-vasc", courseId: "hna", title: "Arterial Supply of the Head", unit: "Unit 3 · Vasculature", lecture: "Lecture 08",
      exam: "Exam 2", topic: "Vasculature", creator: { name: "Alex Rivera", initials: "AR" }, source: "original",
      cards: 52, due: 0, newCards: 6, updated: "Oct 30, 2026", tags: ["vascular"] },
    { id: "hna-musc", courseId: "hna", title: "Muscles of Mastication", unit: "Unit 1 · Skull", lecture: "Lecture 03",
      exam: "Exam 1", topic: "Muscles", creator: { name: "Priya Shah", initials: "PS" }, source: "shared",
      cards: 30, due: 0, newCards: 0, updated: "Oct 12, 2026", tags: ["muscles"] },
    { id: "hna-auto", courseId: "hna", title: "Autonomic Pathways to the Eye", unit: "Unit 2 · Neuroanatomy", lecture: "Lecture 07",
      exam: "Exam 2", topic: "Autonomics", creator: { name: "Alex Rivera", initials: "AR" }, source: "modified",
      cards: 41, due: 0, newCards: 0, updated: "Nov 2, 2026", tags: ["pupil", "autonomics"] },

    { id: "oa-eom", courseId: "oa", title: "Extraocular Muscles", unit: "Unit 1 · Orbit", lecture: "Lecture 03",
      exam: "Practical", topic: "EOMs", creator: { name: "Alex Rivera", initials: "AR" }, source: "original",
      cards: 58, due: 5, newCards: 4, updated: "Nov 4, 2026", tags: ["eom"] },
    { id: "oa-cornea", courseId: "oa", title: "Corneal Layers", unit: "Unit 2 · Anterior Segment", lecture: "Lecture 05",
      exam: "Practical", topic: "Cornea", creator: { name: "Mei Tanaka", initials: "MT" }, source: "shared",
      cards: 34, due: 2, newCards: 0, updated: "Oct 29, 2026", tags: ["cornea"] },
    { id: "bio-gly", courseId: "bio", title: "Glycolysis & Regulation", unit: "Unit 3 · Metabolism", lecture: "Lecture 11",
      exam: "Midterm", topic: "Glycolysis", creator: { name: "Alex Rivera", initials: "AR" }, source: "original",
      cards: 72, due: 3, newCards: 12, updated: "Nov 2, 2026", tags: ["metabolism"] },
    { id: "go-verg", courseId: "go", title: "Vergence & Thin Lenses", unit: "Unit 2 · Lenses", lecture: "Lecture 06",
      exam: "Quiz 4", topic: "Vergence", creator: { name: "Alex Rivera", initials: "AR" }, source: "original",
      cards: 44, due: 2, newCards: 0, updated: "Nov 3, 2026", tags: ["optics"] },
    { id: "cs-pupil", courseId: "cs", title: "Pupil Testing & RAPD", unit: "Unit 1 · Entrance Tests", lecture: "Lab 02",
      exam: "OSCE", topic: "Pupils", creator: { name: "Alex Rivera", initials: "AR" }, source: "original",
      cards: 26, due: 0, newCards: 6, updated: "Oct 27, 2026", tags: ["clinical"] },
  ];

  /* A queue drawn from several collections for the "Today" session -------- */
  const reviewQueue = [
    ...cnCards.slice(0, 8),
    { id: "q-eom1", type: "basic", section: "Extraocular Muscles", collection: "Extraocular Muscles",
      front: "What are the primary, secondary and tertiary actions of the superior oblique?",
      back: "Primary: intorsion · Secondary: depression · Tertiary: abduction.",
      extra: "Remember “SIN” — Superiors INtort; “RAD” — Recti ADduct (except LR).", tags: ["eom"], state: "review" },
    { id: "q-opt1", type: "basic", section: "Vergence & Thin Lenses", collection: "Vergence & Thin Lenses",
      front: "Using Prentice’s rule, how much prism is induced when a patient looks 4 mm below the optical center of a −5.00 D lens?",
      back: "2 Δ base-down.",
      extra: "Δ = c × F = 0.4 cm × 5.00 D = 2 Δ. A minus lens induces prism base-toward the direction of gaze… here base-down.", tags: ["optics", "prism"], state: "learning" },
    { id: "q-bio1", type: "cloze", section: "Glycolysis & Regulation", collection: "Glycolysis & Regulation",
      front: "The rate-limiting enzyme of glycolysis is {{phosphofructokinase-1 (PFK-1)}}.",
      back: "phosphofructokinase-1 (PFK-1)",
      extra: "Activated by AMP and fructose-2,6-bisphosphate; inhibited by ATP and citrate.", tags: ["metabolism"], state: "review" },
    { id: "q-cor1", type: "basic", section: "Corneal Layers", collection: "Corneal Layers",
      front: "Which corneal layer does not regenerate after injury?",
      back: "Bowman’s layer.",
      extra: "Damage to Bowman’s layer heals with scar formation.", tags: ["cornea"], state: "review" },
  ];

  /* Explore — community collections --------------------------------------- */
  const explore = [
    { id: "ex1", title: "Cranial Nerve Lesions — Clinical Pearls", program: "Optometry", course: "Neuroanatomy",
      topic: "Cranial nerves", institution: "Pacific College of Optometry", creator: "Priya Shah", initials: "PS",
      role: "OD2", cards: 128, saves: 342, updated: "2 days ago", verified: true, version: "v3.2",
      preview: ["Pupil-involving CN III palsy → image urgently", "CN IV: head tilt away from lesion", "CN VI: non-localizing sign of ↑ICP"] },
    { id: "ex2", title: "Ocular Pharmacology: Autonomic Agents", program: "Optometry", course: "Ocular Pharmacology",
      topic: "Pharmacology", institution: "Pacific College of Optometry", creator: "Mei Tanaka", initials: "MT",
      role: "OD3", cards: 96, saves: 210, updated: "1 week ago", verified: true, version: "v2.0",
      preview: ["Tropicamide: antimuscarinic, short-acting", "Phenylephrine: α1 agonist → mydriasis", "Pilocarpine: muscarinic agonist → miosis"] },
    { id: "ex3", title: "Brachial Plexus — Image Occlusion Set", program: "Medicine", course: "Gross Anatomy",
      topic: "Upper limb", institution: "Northbridge School of Medicine", creator: "Daniel Cho", initials: "DC",
      role: "MS2", cards: 74, saves: 1180, updated: "3 weeks ago", verified: false, version: "v1.4",
      preview: ["Roots → trunks → divisions → cords → branches", "Erb palsy: C5–C6", "Klumpke palsy: C8–T1"] },
    { id: "ex4", title: "Renal Physiology Essentials", program: "Medicine", course: "Physiology",
      topic: "Renal", institution: "Northbridge School of Medicine", creator: "Aisha Bello", initials: "AB",
      role: "MS1", cards: 152, saves: 640, updated: "5 days ago", verified: false, version: "v2.1",
      preview: ["GFR ≈ creatinine clearance", "Loop diuretics act on NKCC2", "ADH inserts aquaporin-2"] },
    { id: "ex5", title: "Geometric Optics Formula Drills", program: "Optometry", course: "Geometric Optics",
      topic: "Optics", institution: "Pacific College of Optometry", creator: "Jordan Lee", initials: "JL",
      role: "OD1", cards: 60, saves: 98, updated: "Yesterday", verified: false, version: "v1.1",
      preview: ["Vergence: L′ = L + F", "Prentice’s rule: Δ = cF", "Equivalent power of thick lenses"] },
    { id: "ex6", title: "Dental Anatomy — Permanent Dentition", program: "Dentistry", course: "Dental Anatomy",
      topic: "Tooth morphology", institution: "Lakeshore School of Dentistry", creator: "Rosa Méndez", initials: "RM",
      role: "DDS2", cards: 210, saves: 455, updated: "2 weeks ago", verified: true, version: "v4.0",
      preview: ["Universal numbering 1–32", "Mandibular first molar: 5 cusps", "Cusp of Carabelli: maxillary first molar"] },
  ];

  /* Insights (illustrative values for the prototype) ---------------------- */
  const insights = {
    activity: [ // reviews per day, last 28 days
      42, 38, 0, 55, 61, 47, 22, 35, 58, 64, 0, 40, 52, 70,
      66, 45, 30, 0, 48, 57, 62, 71, 39, 44, 68, 59, 63, 54,
    ],
    upcoming: [ // due per day, next 7 days
      { day: "Today", n: 30 }, { day: "Fri", n: 42 }, { day: "Sat", n: 25 }, { day: "Sun", n: 18 },
      { day: "Mon", n: 51 }, { day: "Tue", n: 37 }, { day: "Wed", n: 29 },
    ],
    subjects: [
      { course: "Clinical Skills", retention: 0.91, reviewed: 120, trend: +2 },
      { course: "Ocular Anatomy", retention: 0.87, reviewed: 240, trend: +4 },
      { course: "Head & Neck Anatomy", retention: 0.82, reviewed: 310, trend: +1 },
      { course: "Geometric Optics", retention: 0.76, reviewed: 140, trend: -3 },
      { course: "Biochemistry", retention: 0.68, reviewed: 220, trend: -2 },
    ],
    weakTopics: [
      { topic: "Glycolysis regulation", course: "Biochemistry", lapses: 9, collection: "bio-gly" },
      { topic: "Prentice’s rule & induced prism", course: "Geometric Optics", lapses: 7, collection: "go-verg" },
      { topic: "Trigeminal divisions & foramina", course: "Head & Neck Anatomy", lapses: 5, collection: "hna-cn" },
    ],
  };

  const templates = [
    { id: "basic", name: "Basic", desc: "Question on the front, answer on the back.", best: "Definitions, facts" },
    { id: "cloze", name: "Cloze deletion", desc: "Hide key terms inside a sentence.", best: "Pathways, lists" },
    { id: "occlusion", name: "Image occlusion", desc: "Cover labels on a diagram and recall them.", best: "Anatomy, foramina" },
    { id: "mcq", name: "Multiple choice", desc: "One correct answer with plausible distractors.", best: "Exam practice" },
    { id: "vignette", name: "Clinical vignette", desc: "A short case with a focused question.", best: "Clinical reasoning" },
  ];

  return { user, courses, collections, reviewQueue, explore, insights, templates };
})();
