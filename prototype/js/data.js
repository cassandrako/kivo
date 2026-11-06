/* ==========================================================================
   Kivo — seed data
   Loaded once into the browser's local database the first time Kivo opens.
   After that, everything (courses, units, collections, cards, review
   history, exams) is the student's own data and is edited in the app.
   "Reset sample data" in the Library restores this seed.
   ========================================================================== */

window.KIVO_SEED = (() => {
  const user = {
    name: "Alex", fullName: "Alex Rivera", initials: "AR",
    program: "Doctor of Optometry", year: "OD1", school: "Pennsylvania College of Optometry",
  };

  // Semesters are top-level folders. Archiving one folds it away in the
  // Library and pauses its reviews until it's restored.
  const semesters = [
    { id: "f26", name: "Fall 2026 · Year 1", archived: false },
    { id: "su26", name: "Summer 2026 · Bridge program", archived: true },
  ];

  const courses = [
    { id: "fnd", name: "Foundations of Optometry", code: "OPT 501", term: "Summer 2026", hue: "peach", semesterId: "su26" },
    { semesterId: "f26", id: "hna", name: "Head & Neck Anatomy", code: "ANAT 612", term: "Fall · Year 1", hue: "lavender" },
    { semesterId: "f26", id: "oa", name: "Ocular Anatomy", code: "OPT 621", term: "Fall · Year 1", hue: "sage" },
    { semesterId: "f26", id: "bio", name: "Biochemistry", code: "BIOC 605", term: "Fall · Year 1", hue: "peach" },
    { semesterId: "f26", id: "go", name: "Geometric Optics", code: "OPT 631", term: "Fall · Year 1", hue: "lavender" },
    { semesterId: "f26", id: "cs", name: "Clinical Skills", code: "CLIN 640", term: "Fall · Year 1", hue: "sage" },
  ];

  // Exams are the folders inside a course: each holds one collection per
  // lecture on that exam. The date drives countdowns and the Exams page.
  const units = [
    { id: "fnd-u1", courseId: "fnd", name: "Final", kind: "Final", offset: -70, time: "09:00" },
    { id: "hna-u1", courseId: "hna", name: "Exam 1", kind: "Exam", offset: -18, time: "13:00" },
    { id: "hna-u2", courseId: "hna", name: "Exam 2", kind: "Exam", offset: 8, time: "13:00", source: "calendar" },
    { id: "oa-u1", courseId: "oa", name: "Lab practical 1", kind: "Practical", offset: 15, time: "08:30", source: "calendar" },
    { id: "bio-u3", courseId: "bio", name: "Midterm", kind: "Midterm", offset: 27, time: "10:00" },
    { id: "go-u2", courseId: "go", name: "Quiz 4", kind: "Quiz", offset: 5, time: "09:00" },
    { id: "cs-u1", courseId: "cs", name: "Entrance testing OSCE", kind: "OSCE", offset: 34, time: "12:00" },
  ];

  // Collections are Anki's decks. source: original | shared | personal-copy | modified
  const decks = [
    { id: "fnd-vp", courseId: "fnd", unitId: "fnd-u1", title: "Visual Pathway Basics", lecture: "Lecture 03", topic: "Visual pathway", creator: { name: "Alex Rivera", initials: "AR" }, source: "original" },
    { id: "hna-cn", courseId: "hna", unitId: "hna-u2", title: "Cranial Nerves", lecture: "Lecture 04", topic: "Cranial nerves I–XII", assessment: "Exam 2",
      description: "Origins, foramina, functions and classic lesion presentations of all twelve cranial nerves, with emphasis on CN III, IV and VI for optometry.",
      creator: { name: "Priya Shah", initials: "PS", role: "OD2 · Course TA" }, source: "personal-copy", sourceOf: "Priya Shah’s source",
      tags: ["neuro", "high-yield", "exam-2"],
      copies: [
        { name: "Jordan Lee", initials: "JL", status: "Has a copy · following your updates" },
        { name: "Sam Okafor", initials: "SO", status: "Has a copy · not following" },
        { name: "OD1 Anatomy Study Group", initials: "OD", group: true, status: "14 members · 9 copies made" },
      ],
      edits: { cards: 5, added: 8 } },
    { id: "hna-orbit", courseId: "hna", unitId: "hna-u1", title: "Bony Orbit & Foramina", lecture: "Lecture 02", topic: "Orbit", assessment: "Exam 1", creator: { name: "Alex Rivera", initials: "AR" }, source: "original" },
    { id: "hna-pter", courseId: "hna", unitId: "hna-u2", title: "Pterygopalatine Fossa", lecture: "Lecture 06", topic: "PPF", assessment: "Exam 2", creator: { name: "Jordan Lee", initials: "JL", role: "OD1" }, source: "shared", sourceOf: "Jordan Lee’s source" },
    { id: "hna-auto", courseId: "hna", unitId: "hna-u2", title: "Autonomic Pathways to the Eye", lecture: "Lecture 07", topic: "Autonomics", assessment: "Exam 2", creator: { name: "Alex Rivera", initials: "AR" }, source: "original" },
    { id: "hna-vasc", courseId: "hna", unitId: "hna-u2", title: "Arterial Supply of the Head", lecture: "Lecture 08", topic: "Vasculature", assessment: "Exam 2", creator: { name: "Alex Rivera", initials: "AR" }, source: "original" },
    { id: "oa-eom", courseId: "oa", unitId: "oa-u1", title: "Extraocular Muscles", lecture: "Lecture 03", topic: "EOMs", assessment: "Practical", creator: { name: "Alex Rivera", initials: "AR" }, source: "original" },
    { id: "oa-cornea", courseId: "oa", unitId: "oa-u1", title: "Corneal Layers", lecture: "Lecture 05", topic: "Cornea", assessment: "Practical", creator: { name: "Mei Tanaka", initials: "MT", role: "OD3" }, source: "shared", sourceOf: "Mei Tanaka’s source" },
    { id: "bio-gly", courseId: "bio", unitId: "bio-u3", title: "Glycolysis & Regulation", lecture: "Lecture 11", topic: "Glycolysis", assessment: "Midterm", creator: { name: "Alex Rivera", initials: "AR" }, source: "original" },
    { id: "go-verg", courseId: "go", unitId: "go-u2", title: "Vergence & Thin Lenses", lecture: "Lecture 06", topic: "Vergence", assessment: "Quiz 4", creator: { name: "Alex Rivera", initials: "AR" }, source: "original" },
    { id: "cs-pupil", courseId: "cs", unitId: "cs-u1", title: "Pupil Testing & RAPD", lecture: "Lab 02", topic: "Pupils", assessment: "OSCE", creator: { name: "Alex Rivera", initials: "AR" }, source: "original" },
  ];

  /* Notes. One note can make several cards (Anki-style):
     basic → 1 card · reverse → 2 cards · cloze → 1 card per {{cN::…}} ·
     occlusion → 1 card per hidden label. */
  const B = (deckId, section, front, back, extra = "", more = {}) => ({ deckId, section, type: "basic", fields: { front, back, extra, points: more.points || "" }, tags: more.tags || [] });
  const C = (deckId, section, text, extra = "", tags = []) => ({ deckId, section, type: "cloze", fields: { text, extra }, tags });
  const notes = [
    // Foundations (archived semester)
    B("fnd-vp", "Pathway", "A lesion of the optic chiasm classically causes which visual field defect?", "Bitemporal hemianopia.", "Crossing nasal retinal fibers carry the temporal fields."),
    B("fnd-vp", "Pathway", "Which nucleus of the thalamus relays visual information to V1?", "The lateral geniculate nucleus (LGN)."),
    B("fnd-vp", "Pathway", "Meyer’s loop lesions (temporal lobe) produce which field defect?", "Contralateral superior quadrantanopia (“pie in the sky”)."),
    // Cranial Nerves
    B("hna-cn", "Overview", "Which cranial nerves carry parasympathetic fibers?", "CN III, VII, IX and X.", "Mnemonic: “1973” — III, VII, IX, X.", { points: "CN III, CN VII, CN IX, CN X", tags: ["parasympathetic", "high-yield"] }),
    B("hna-cn", "Overview", "Which foramen transmits CN IX, X and XI?", "Jugular foramen.", "", { tags: ["foramina"] }),
    B("hna-cn", "Olfactory & Optic (CN I–II)", "Through which structure do olfactory nerve fibers pass to reach the olfactory bulb?", "The cribriform plate of the ethmoid bone.", "Fractures here can cause anosmia and CSF rhinorrhea."),
    B("hna-cn", "Olfactory & Optic (CN I–II)", "What does the optic nerve (CN II) pass through to enter the cranial cavity, and what travels with it?", "The optic canal, with the ophthalmic artery.", "The optic canal is in the lesser wing of the sphenoid.", { points: "Optic canal, Ophthalmic artery" }),
    C("hna-cn", "Oculomotor (CN III)", "The oculomotor nerve exits the brainstem in the {{c1::interpeduncular fossa}} of the midbrain.", "It passes between the posterior cerebral and superior cerebellar arteries.", ["CN III"]),
    B("hna-cn", "Oculomotor (CN III)", "A 58-year-old with poorly controlled diabetes reports sudden diplopia. The right eye is “down and out” with ptosis, but the pupil is round and reactive. Most likely cause?", "Ischemic (microvascular) CN III palsy, pupil-sparing.", "Pupillomotor fibers run superficially and are relatively spared by ischemia but compressed early by an aneurysm (e.g. PCom). A pupil-involving CN III palsy needs urgent imaging.", { points: "CN III palsy, Ischemic / microvascular cause, Pupil-sparing", tags: ["clinical"] }),
    B("hna-cn", "Trochlear (CN IV)", "What is the only cranial nerve to exit from the dorsal brainstem?", "Trochlear nerve (CN IV).", "It decussates, so a lesion of the CN IV nucleus affects the contralateral superior oblique."),
    B("hna-cn", "Trochlear (CN IV)", "A patient tilts their head to the left to relieve vertical diplopia. Which muscle is most likely weak?", "Right superior oblique.", "Tilting away from the affected side reduces the need for intorsion from the paretic superior oblique.", { tags: ["clinical"] }),
    { deckId: "hna-cn", section: "Trigeminal (CN V)", type: "occlusion", fields: { prompt: "Identify the masked foramen.", masked: ["Foramen rotundum", "Foramen ovale", "Superior orbital fissure"], extra: "V1 → superior orbital fissure · V2 → foramen rotundum · V3 → foramen ovale." }, tags: ["foramina"] },
    B("hna-cn", "Trigeminal (CN V)", "Name the three divisions of the trigeminal nerve.", "Ophthalmic (V1), maxillary (V2) and mandibular (V3).", "Only V3 carries motor fibers (muscles of mastication).", { points: "Ophthalmic V1, Maxillary V2, Mandibular V3" }),
    B("hna-cn", "Abducens (CN VI)", "Why is the abducens nerve especially vulnerable to raised intracranial pressure?", "It has a long intracranial course and bends sharply over the petrous apex.", "CN VI palsy can be a non-localizing sign of raised ICP.", { points: "Long intracranial course, Bends over the petrous apex" }),
    C("hna-cn", "Facial (CN VII)", "The {{c1::greater petrosal}} nerve carries parasympathetic fibers to the lacrimal gland via the {{c2::pterygopalatine}} ganglion.", "Dry eye after a proximal CN VII lesion reflects loss of these fibers.", ["lacrimal"]),
    B("hna-cn", "CN VIII–XII", "A lesion of the right hypoglossal nerve causes the protruded tongue to deviate to which side?", "To the right (toward the side of the lesion).", "The intact left genioglossus pushes the tongue toward the weak side."),
    // Bony Orbit
    B("hna-orbit", "Walls", "Name the seven bones that form the orbit.", "Frontal, zygomatic, maxilla, ethmoid, lacrimal, palatine and sphenoid.", "", { points: "Frontal, Zygomatic, Maxilla, Ethmoid, Lacrimal, Palatine, Sphenoid" }),
    B("hna-orbit", "Walls", "Which orbital wall is thinnest?", "The medial wall (lamina papyracea of the ethmoid).", "Ethmoid sinusitis can spread here into the orbit (orbital cellulitis)."),
    B("hna-orbit", "Fractures", "A blowout fracture of the orbital floor most commonly entraps which muscle?", "Inferior rectus.", "Look for restricted upgaze and infraorbital numbness (V2)."),
    C("hna-orbit", "Foramina", "The superior orbital fissure transmits CN {{c1::III}}, CN {{c2::IV}}, branches of V1, CN {{c3::VI}} and the superior ophthalmic vein."),
    // PPF
    B("hna-pter", "Communications", "The pterygopalatine fossa communicates with the orbit through which opening?", "The inferior orbital fissure."),
    B("hna-pter", "Communications", "Through which foramen does the pterygopalatine fossa open into the nasal cavity?", "The sphenopalatine foramen."),
    B("hna-pter", "Ganglion", "Which nerve brings preganglionic parasympathetic fibers to the pterygopalatine ganglion?", "The nerve of the pterygoid canal (Vidian nerve), carrying the greater petrosal nerve.", "Postganglionic fibers reach the lacrimal gland via the zygomatic and lacrimal nerves."),
    // Autonomics
    B("hna-auto", "Sympathetic", "What is the classic triad of Horner syndrome?", "Ptosis, miosis and anhidrosis.", "Ptosis is mild because only Müller’s muscle is affected.", { points: "Ptosis, Miosis, Anhidrosis" }),
    B("hna-auto", "Parasympathetic", "Where do the parasympathetic fibers to the sphincter pupillae synapse?", "In the ciliary ganglion.", "Preganglionic fibers start in the Edinger–Westphal nucleus and travel with CN III."),
    B("hna-auto", "Sympathetic", "Third-order sympathetic neurons to the dilator pupillae originate in which ganglion?", "The superior cervical ganglion."),
    // Vasculature
    B("hna-vasc", "Ophthalmic", "The ophthalmic artery is the first branch of which artery?", "The internal carotid artery.", "It enters the orbit through the optic canal."),
    B("hna-vasc", "Ophthalmic", "Which artery supplies the inner retina?", "The central retinal artery, a branch of the ophthalmic artery.", "Occlusion causes sudden painless vision loss with a cherry-red spot."),
    // EOMs
    B("oa-eom", "Actions", "What are the primary, secondary and tertiary actions of the superior oblique?", "Intorsion (primary), depression (secondary), abduction (tertiary).", "“SIN” — superiors intort.", { points: "Intorsion (primary), Depression (secondary), Abduction (tertiary)" }),
    B("oa-eom", "Actions", "What are the actions of the inferior oblique?", "Extorsion (primary), elevation (secondary), abduction (tertiary).", "", { points: "Extorsion, Elevation, Abduction" }),
    B("oa-eom", "Innervation", "Which nerve innervates the lateral rectus?", "Abducens nerve (CN VI).", "LR6 SO4, all the rest 3."),
    B("oa-eom", "Origins", "Which tendinous ring do the four rectus muscles arise from?", "The annulus of Zinn (common tendinous ring)."),
    // Cornea
    B("oa-cornea", "Layers", "Which corneal layer does not regenerate after injury?", "Bowman’s layer.", "Damage heals with scar formation."),
    C("oa-cornea", "Layers", "From anterior to posterior, the corneal layers are {{c1::epithelium}}, Bowman’s layer, {{c2::stroma}}, Descemet’s membrane and {{c3::endothelium}}."),
    B("oa-cornea", "Physiology", "What keeps the corneal stroma dehydrated and transparent?", "The endothelial pump (Na⁺/K⁺-ATPase) plus the barrier function of epithelium and endothelium.", "Endothelial cells don’t divide in adults, so cell loss is permanent."),
    B("oa-cornea", "Layers", "Roughly what fraction of corneal thickness is stroma?", "About 90%."),
    // Glycolysis
    C("bio-gly", "Regulation", "The rate-limiting enzyme of glycolysis is {{c1::phosphofructokinase-1 (PFK-1)}}.", "Activated by AMP and fructose-2,6-bisphosphate; inhibited by ATP and citrate."),
    B("bio-gly", "Regulation", "Which molecule, made by PFK-2, is the most potent activator of PFK-1?", "Fructose-2,6-bisphosphate."),
    B("bio-gly", "Enzymes", "How do hexokinase and glucokinase differ in Km?", "Hexokinase has a low Km (high affinity); glucokinase has a high Km (low affinity).", "Glucokinase acts in liver and pancreatic β-cells when glucose is high.", { points: "Hexokinase low Km, Glucokinase high Km" }),
    B("bio-gly", "Yield", "What is the net ATP yield of glycolysis per glucose?", "2 ATP (plus 2 NADH)."),
    B("bio-gly", "Clinical", "Pyruvate kinase deficiency causes what kind of anemia?", "Hemolytic anemia.", "Red cells rely entirely on glycolysis for ATP."),
    // Vergence
    B("go-verg", "Prism", "Using Prentice’s rule, how much prism is induced when a patient looks 4 mm below the optical center of a −5.00 D lens?", "2Δ base-down.", "Δ = c × F = 0.4 cm × 5.00 D = 2Δ. Minus lenses are thicker at the edge, so the base points toward the edge."),
    B("go-verg", "Vergence", "What is the vergence of light from an object 25 cm in front of a lens?", "−4.00 D.", "L = n / l = 1 / −0.25 m."),
    B("go-verg", "Refraction", "Where is the far point of an uncorrected −2.00 D myope?", "50 cm in front of the eye.", "Far point = 1 / 2.00 D = 0.5 m."),
    C("go-verg", "Vergence", "The thin-lens vergence equation is {{c1::L′ = L + F}}."),
    B("go-verg", "Prism", "Looking below the optical center of a plus lens induces prism in which base direction?", "Base-up.", "Plus lenses are thickest at the center, so the base points toward the center."),
    // Pupils
    B("cs-pupil", "RAPD", "Which test detects a relative afferent pupillary defect?", "The swinging flashlight test.", "The affected pupil dilates when the light swings onto it."),
    B("cs-pupil", "Anisocoria", "Anisocoria that is greater in dim light points to a problem with which pupil?", "The smaller pupil (sympathetic defect, such as Horner syndrome)."),
    B("cs-pupil", "Anisocoria", "Anisocoria that is greater in bright light points to a problem with which pupil?", "The larger pupil (parasympathetic defect, such as CN III palsy or Adie’s pupil)."),
    B("cs-pupil", "Light–near dissociation", "Name two causes of light–near dissociation.", "Argyll Robertson pupil (neurosyphilis) and Adie’s tonic pupil.", "Also dorsal midbrain (Parinaud) syndrome.", { points: "Argyll Robertson pupil, Adie’s tonic pupil" }),
  ];

  /* A Canvas-style calendar export: course in brackets, mixed event types. */
  const sampleCalendar = [
    { offset: 2, time: "09:00", summary: "Lecture 09: Cavernous Sinus [ANAT 612: Head & Neck Anatomy]" },
    { offset: 3, time: "23:59", summary: "Problem Set 4 due [BIOC 605: Biochemistry]" },
    { offset: 5, time: "09:00", summary: "Quiz 4 [OPT 631: Geometric Optics]" },
    { offset: 6, time: "15:00", summary: "Office hours with Dr. Patel [OPT 621: Ocular Anatomy]" },
    { offset: 8, time: "13:00", summary: "Exam 2 [ANAT 612: Head & Neck Anatomy]" },
    { offset: 12, time: "09:00", summary: "Quiz 5: Prisms and Prentice's Rule [OPT 631: Geometric Optics]" },
    { offset: 19, time: "08:30", summary: "Lab Practical 2: Anterior Segment [OPT 621: Ocular Anatomy]" },
    { offset: 22, time: "10:00", summary: "Group study session (library room 3)" },
    { offset: 41, time: "13:00", summary: "Final Exam [ANAT 612: Head & Neck Anatomy]" },
    { offset: 44, time: "09:00", summary: "Final Exam [BIOC 605: Biochemistry]" },
  ];

  /* Reviews per day before today, so Insights has a history to show. */
  const sampleActivity = [42, 38, 0, 55, 61, 47, 22, 35, 58, 64, 0, 40, 52, 70, 66, 45, 30, 0, 48, 57, 62, 71, 39, 44, 68, 59, 63];

  return { user, semesters, courses, units, decks, notes, sampleCalendar, sampleActivity };
})();
