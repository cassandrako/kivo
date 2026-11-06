/* ==========================================================================
   Kivo — persona templates
   Each template describes one kind of student: their onboarding answers,
   course presets for their program and year, and a sample library (exam
   folders, lecture collections, cards) used when they choose to start with
   sample cards. The optometry template lives in data.js (KIVO_SEED).
   ========================================================================== */
(() => {
  const B = (deckId, front, back, extra = "", points = "") => ({ deckId, section: "", type: "basic", fields: { front, back, extra, points }, tags: [] });
  const C = (deckId, text, extra = "") => ({ deckId, section: "", type: "cloze", fields: { text, extra }, tags: [] });
  const me = (name, initials, role) => ({ name: name.split(" ")[0], fullName: name, initials, role });

  const medicine = {
    id: "medicine",
    user: me("Maya Chen", "MC", "MS1 · Medicine"),
    profile: { first: "Maya", last: "Chen", email: "maya.chen@gmail.com", role: "medicine", degree: "MD", school: "Perelman School of Medicine at Penn", year: "MS1", gradYear: "2030", boards: "USMLE Step 1" },
    semesters: [{ id: "m-f26", name: "Fall 2026 · MS1", archived: false }],
    courses: [
      { id: "m-anat", semesterId: "m-f26", name: "Gross Anatomy", code: "ANAT 500", hue: "lavender" },
      { id: "m-phys", semesterId: "m-f26", name: "Physiology", code: "PHYS 510", hue: "sage" },
      { id: "m-bioc", semesterId: "m-f26", name: "Biochemistry & Genetics", code: "BIOC 505", hue: "peach" },
      { id: "m-hist", semesterId: "m-f26", name: "Histology", code: "HIST 520", hue: "lavender" },
    ],
    extraCourses: ["Doctoring & Clinical Skills", "Immunology", "Neuroscience"],
    units: [
      { id: "m-anat-b1", courseId: "m-anat", name: "Block 1 · Upper limb & thorax", kind: "Exam", offset: 9, time: "08:00" },
      { id: "m-phys-r", courseId: "m-phys", name: "Renal exam", kind: "Exam", offset: 16, time: "09:00" },
      { id: "m-bioc-mid", courseId: "m-bioc", name: "Midterm", kind: "Midterm", offset: 23, time: "13:00" },
    ],
    decks: [
      { id: "m-bp", courseId: "m-anat", unitId: "m-anat-b1", title: "Brachial Plexus", lecture: "Lecture 03" },
      { id: "m-med", courseId: "m-anat", unitId: "m-anat-b1", title: "Mediastinum", lecture: "Lecture 05" },
      { id: "m-neph", courseId: "m-phys", unitId: "m-phys-r", title: "Nephron Physiology", lecture: "Lecture 08" },
      { id: "m-vit", courseId: "m-bioc", unitId: "m-bioc-mid", title: "Vitamins & Cofactors", lecture: "Lecture 06" },
    ],
    notes: [
      B("m-bp", "Which spinal roots form the brachial plexus?", "C5–T1."),
      B("m-bp", "Erb palsy results from injury to which part of the brachial plexus?", "Upper trunk (C5–C6).", "Classic “waiter’s tip” posture."),
      B("m-bp", "Klumpke palsy involves which roots?", "C8–T1 (lower trunk).", "Claw hand; may include Horner syndrome if T1 is involved."),
      B("m-bp", "Which nerve is at risk in a midshaft humerus fracture?", "Radial nerve.", "Wrist drop."),
      B("m-bp", "Winged scapula results from injury to which nerve?", "Long thoracic nerve.", "It supplies serratus anterior."),
      C("m-bp", "The {{c1::musculocutaneous}} nerve innervates the biceps brachii."),
      B("m-med", "Does the phrenic nerve pass anterior or posterior to the root of the lung?", "Anterior.", "The vagus passes posterior."),
      B("m-med", "Which nerve hooks under the aortic arch?", "The left recurrent laryngeal nerve."),
      B("m-med", "Where does the thoracic duct drain?", "Into the junction of the left subclavian and left internal jugular veins.", "", "Left subclavian vein, Left internal jugular vein"),
      B("m-neph", "Loop diuretics act on which transporter?", "NKCC2 (Na⁺-K⁺-2Cl⁻) in the thick ascending limb."),
      B("m-neph", "ADH inserts which channel into the collecting duct?", "Aquaporin-2."),
      C("m-neph", "Angiotensin II preferentially constricts the {{c1::efferent}} arteriole, which helps maintain GFR."),
      B("m-neph", "Which substance’s clearance is used to estimate GFR at the bedside?", "Creatinine.", "Inulin is the research gold standard."),
      B("m-vit", "Thiamine (B1) is a cofactor for which enzymes?", "Pyruvate dehydrogenase, α-ketoglutarate dehydrogenase, transketolase and branched-chain α-ketoacid dehydrogenase.", "", "Pyruvate dehydrogenase, α-ketoglutarate dehydrogenase, Transketolase, BCKDH"),
      B("m-vit", "What is the classic triad of Wernicke encephalopathy?", "Confusion, ophthalmoplegia and ataxia.", "", "Confusion, Ophthalmoplegia, Ataxia"),
      B("m-vit", "Deficiency of which vitamin causes scurvy?", "Vitamin C.", "Needed for collagen hydroxylation."),
    ],
    sampleCalendar: [
      { offset: 2, time: "09:00", summary: "Lecture 07: Axilla [ANAT 500: Gross Anatomy]" },
      { offset: 9, time: "08:00", summary: "Block 1 Exam [ANAT 500: Gross Anatomy]" },
      { offset: 11, time: "14:00", summary: "Small group: renal cases [PHYS 510: Physiology]" },
      { offset: 16, time: "09:00", summary: "Renal Exam [PHYS 510: Physiology]" },
      { offset: 23, time: "13:00", summary: "Midterm [BIOC 505: Biochemistry & Genetics]" },
      { offset: 30, time: "10:00", summary: "Quiz 3 [HIST 520: Histology]" },
    ],
    sampleActivity: [30, 44, 0, 52, 38, 61, 0, 47, 55, 40, 0, 63, 58, 49],
  };

  const dentistry = {
    id: "dentistry",
    user: me("Jordan Okafor", "JO", "D2 · Dentistry"),
    profile: { first: "Jordan", last: "Okafor", email: "jordan.okafor@icloud.com", role: "dentistry", degree: "DMD", school: "Columbia College of Dental Medicine", year: "D2", gradYear: "2029", boards: "INBDE" },
    semesters: [{ id: "d-f26", name: "Fall 2026 · D2", archived: false }],
    courses: [
      { id: "d-anat", semesterId: "d-f26", name: "Dental Anatomy & Occlusion", code: "DENT 210", hue: "lavender" },
      { id: "d-histo", semesterId: "d-f26", name: "Oral Histology", code: "DENT 220", hue: "sage" },
      { id: "d-pharm", semesterId: "d-f26", name: "Pharmacology", code: "DENT 230", hue: "peach" },
      { id: "d-op", semesterId: "d-f26", name: "Preclinical Operative Dentistry", code: "DENT 240", hue: "sage" },
    ],
    extraCourses: ["Periodontology", "Oral Pathology", "Dental Materials"],
    units: [
      { id: "d-anat-p", courseId: "d-anat", name: "Tooth morphology practical", kind: "Practical", offset: 6, time: "09:00" },
      { id: "d-histo-e1", courseId: "d-histo", name: "Exam 1", kind: "Exam", offset: 12, time: "10:00" },
      { id: "d-pharm-mid", courseId: "d-pharm", name: "Midterm", kind: "Midterm", offset: 18, time: "13:00" },
    ],
    decks: [
      { id: "d-numb", courseId: "d-anat", unitId: "d-anat-p", title: "Tooth Numbering", lecture: "Lecture 01" },
      { id: "d-molar", courseId: "d-anat", unitId: "d-anat-p", title: "Permanent Molars", lecture: "Lecture 05" },
      { id: "d-enamel", courseId: "d-histo", unitId: "d-histo-e1", title: "Enamel & Dentin", lecture: "Lecture 04" },
      { id: "d-la", courseId: "d-pharm", unitId: "d-pharm-mid", title: "Local Anesthetics", lecture: "Lecture 07" },
    ],
    notes: [
      B("d-numb", "Universal number of the maxillary right first molar?", "#3."),
      B("d-numb", "Universal number of the mandibular left central incisor?", "#24."),
      B("d-numb", "FDI notation for the maxillary right first molar?", "16.", "Quadrant 1, tooth 6."),
      B("d-numb", "How many teeth are in the permanent dentition?", "32."),
      B("d-molar", "Which tooth usually has a cusp of Carabelli?", "Maxillary first molar (on the mesiolingual cusp)."),
      B("d-molar", "How many cusps does the mandibular first molar have?", "Five: MB, DB, D, ML and DL.", "", "Mesiobuccal, Distobuccal, Distal, Mesiolingual, Distolingual"),
      B("d-molar", "Which molars have an oblique ridge?", "Maxillary molars (from the distobuccal to the mesiolingual cusp)."),
      B("d-molar", "Which permanent tooth usually erupts first?", "Mandibular first molar (around age 6)."),
      B("d-enamel", "Which cells form enamel?", "Ameloblasts."),
      B("d-enamel", "Which cells form dentin?", "Odontoblasts."),
      C("d-enamel", "Enamel rods are shaped by {{c1::Tomes’ processes}} of ameloblasts."),
      B("d-enamel", "Why can’t enamel regenerate after it forms?", "Mature enamel is acellular: ameloblasts are lost when the tooth erupts."),
      B("d-la", "Articaine differs from other amide local anesthetics by containing which ring?", "A thiophene ring.", "It also has an ester side chain, so it’s partly metabolized in plasma."),
      B("d-la", "Ester local anesthetics are metabolized mainly by which enzyme?", "Plasma pseudocholinesterase."),
      B("d-la", "Why is epinephrine added to local anesthetics?", "Vasoconstriction: longer duration, less bleeding and slower systemic absorption.", "", "Longer duration, Less bleeding, Slower systemic absorption"),
    ],
    sampleCalendar: [
      { offset: 3, time: "08:00", summary: "Sim lab: Class II prep [DENT 240: Preclinical Operative Dentistry]" },
      { offset: 6, time: "09:00", summary: "Tooth Morphology Practical [DENT 210: Dental Anatomy & Occlusion]" },
      { offset: 12, time: "10:00", summary: "Exam 1 [DENT 220: Oral Histology]" },
      { offset: 18, time: "13:00", summary: "Midterm [DENT 230: Pharmacology]" },
      { offset: 25, time: "09:00", summary: "Quiz 2 [DENT 240: Preclinical Operative Dentistry]" },
    ],
    sampleActivity: [22, 35, 41, 0, 28, 39, 33, 0, 45, 30, 27, 0, 38, 42],
  };

  const prehealth = {
    id: "prehealth",
    user: me("Sam Patel", "SP", "4th year · Pre-med"),
    profile: { first: "Sam", last: "Patel", email: "sam.patel@mail.utoronto.ca", role: "prehealth", school: "University of Toronto", major: "Physiology (Life Sciences)", year: "4th year", target: "MD", entranceExam: "MCAT", examOffset: 150 },
    semesters: [{ id: "p-f26", name: "Fall 2026 · 4th year", archived: false }],
    courses: [
      { id: "p-pcl", semesterId: "p-f26", name: "Pharmacodynamic Principles", code: "PCL302H1", hue: "peach" },
      { id: "p-imm", semesterId: "p-f26", name: "Fundamental Immunology", code: "IMM340H1", hue: "sage" },
      { id: "p-psl", semesterId: "p-f26", name: "Human Physiology II", code: "PSL301H1", hue: "lavender" },
      { id: "p-mcat", semesterId: "p-f26", name: "MCAT Prep", code: "", hue: "lavender" },
    ],
    extraCourses: ["Biochemistry", "Neuroscience", "Statistics"],
    units: [
      { id: "p-pcl-t2", courseId: "p-pcl", name: "Term test 2", kind: "Exam", offset: 7, time: "10:00" },
      { id: "p-imm-mid", courseId: "p-imm", name: "Midterm", kind: "Midterm", offset: 14, time: "13:00" },
      { id: "p-psl-q", courseId: "p-psl", name: "Quiz 3", kind: "Quiz", offset: 4, time: "09:00" },
      { id: "p-mcat-t", courseId: "p-mcat", name: "MCAT", kind: "Board", offset: 150, time: "08:00" },
    ],
    decks: [
      { id: "p-dr", courseId: "p-pcl", unitId: "p-pcl-t2", title: "Dose-Response & Potency", lecture: "Lecture 03" },
      { id: "p-ag", courseId: "p-pcl", unitId: "p-pcl-t2", title: "Agonists & Antagonists", lecture: "Lecture 05" },
      { id: "p-inn", courseId: "p-imm", unitId: "p-imm-mid", title: "Innate Immunity", lecture: "Lecture 02" },
      { id: "p-mhc", courseId: "p-imm", unitId: "p-imm-mid", title: "MHC & Antigen Presentation", lecture: "Lecture 05" },
      { id: "p-ren", courseId: "p-psl", unitId: "p-psl-q", title: "Renal Clearance", lecture: "Lecture 09" },
      { id: "p-psy", courseId: "p-mcat", unitId: "p-mcat-t", title: "Psych/Soc: Learning & Behavior", lecture: "" },
    ],
    notes: [
      B("p-dr", "What does a drug’s EC50 tell you?", "Its potency: the concentration that gives 50% of the maximal effect."),
      B("p-dr", "How is the therapeutic index calculated?", "TD50 ÷ ED50.", "A larger index means a wider safety margin."),
      B("p-dr", "Efficacy vs potency?", "Efficacy is the maximal effect (Emax); potency is how much drug is needed (EC50)."),
      C("p-ag", "A competitive antagonist shifts the agonist curve to the {{c1::right}} without changing {{c2::Emax}}."),
      B("p-ag", "What is a partial agonist?", "A drug that activates the receptor but can’t reach the full response, even at full occupancy."),
      B("p-ag", "What does an inverse agonist do?", "Reduces a receptor’s constitutive (baseline) activity."),
      B("p-inn", "Which Toll-like receptor recognizes LPS?", "TLR4."),
      C("p-inn", "Complement fragment C3b acts as an {{c1::opsonin}}, tagging microbes for phagocytosis."),
      B("p-mhc", "MHC class I presents antigen to which T cells?", "CD8⁺ cytotoxic T cells."),
      B("p-mhc", "Which cells present antigen on MHC class II?", "Professional APCs: dendritic cells, macrophages and B cells.", "", "Dendritic cells\nMacrophages\nB cells"),
      B("p-ren", "Which substance is the gold standard for measuring GFR?", "Inulin: freely filtered, not reabsorbed or secreted."),
      B("p-ren", "What is a normal GFR?", "About 125 mL/min (180 L/day)."),
      B("p-psy", "Who first described classical conditioning?", "Ivan Pavlov."),
      B("p-psy", "What is the fundamental attribution error?", "Overemphasizing personality and underestimating the situation when explaining other people’s behavior."),
      B("p-psy", "In operant conditioning, what is negative reinforcement?", "Removing an unpleasant stimulus to increase a behavior.", "Not the same as punishment."),
    ],
    sampleCalendar: [
      { offset: 1, time: "10:00", summary: "Lecture 6: Receptor desensitization [PCL302H1: Pharmacodynamic Principles]" },
      { offset: 4, time: "09:00", summary: "Quiz 3 [PSL301H1: Human Physiology II]" },
      { offset: 5, time: "23:59", summary: "Problem set 2 due [IMM340H1: Fundamental Immunology]" },
      { offset: 7, time: "10:00", summary: "Term test 2 [PCL302H1: Pharmacodynamic Principles]" },
      { offset: 14, time: "13:00", summary: "Midterm [IMM340H1: Fundamental Immunology]" },
    ],
    sampleActivity: [18, 25, 0, 31, 22, 0, 0, 29, 34, 27, 19, 0, 36, 30],
  };

  window.KIVO_PERSONAS = { optometry: window.KIVO_SEED, medicine, dentistry, prehealth };
})();
