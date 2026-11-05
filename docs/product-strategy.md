# Kivo — Product strategy

**Learn smarter. Remember longer.**

Kivo is a study platform for students in knowledge-heavy health programs (optometry, medicine, dentistry, pharmacy, nursing). It combines the retention power of spaced repetition with an interface that doesn't require students to become software power users.

## The problem: three ways students study now, three ways they fail

| Method | What it gets right | Where it breaks down |
|---|---|---|
| **Anki** | Real spaced repetition, full control | Too malleable. Creating cards feels fragmented: fields, note types and card templates. Anything advanced is HTML/CSS and template syntax, so it's a coding experiment. Students inherit decks they don't understand. |
| **Quizlet** | Approachable, fast to start | Too gamified and simplified. Review is mostly right/wrong, so students get few options for *how* to review. There's little control over long-term scheduling, and copies of sets drift apart. |
| **AI study tools** (e.g. Gemini) | Instant explanations and generated questions | Students wait for generation, and generated questions can hallucinate, which is dangerous in clinical subjects. Most importantly, the AI does the cognitive work the student needs to do. |

The last point matters most. Two of the best-supported learning effects are **retrieval practice** (pulling information from memory) and the **generation effect** (producing material yourself, such as writing cards and writing answers). Tools that generate and explain everything remove exactly that effort.

## Kivo's position

> **You write, Kivo structures.** The thinking stays with the student; the software removes friction around it.

### Principles that follow from this

1. **Authoring is learning, so make it effortless rather than automatic.** The visual card builder offers templates (Basic, Cloze, Image occlusion, Multiple choice, Clinical vignette) with a live preview. There's no HTML, CSS or template syntax. Advanced settings sit behind a disclosure.
2. **Anki's review loop, with structure.** Kivo keeps the format students already trust: see the prompt, recall, reveal, rate. For multi-part answers it adds a **recall checklist**. The answer is split into key points (CN III · CN VII · CN IX · CN X), the student ticks the ones they recalled, and Kivo suggests a rating (all → Good, some → Hard, none → Again). The student still makes the final call. This turns "was that Hard or Good?" from a gut feeling into a consistent judgment. Single-fact cards work exactly like Anki.
3. **Review is nuanced, not binary.** Four ratings (Again / Hard / Good / Easy) each have a plain-language meaning ("Recalled with effort") and show when the card will return. Multiple-choice results are tracked separately from recall and don't change the schedule, because recognizing an answer is not the same as recalling it.
4. **Everyone learns differently, so everyone owns their own collection.** See *Personal-first sharing* below.
5. **Trustworthy content.** Cards come from students, classmates and course TAs, with visible attribution and version history. AI is not a default content source. If added later, it should *assist* (for example, flag an ambiguous card or suggest a cloze split) and never silently write answers.
6. **Honest progress.** Insights show *estimated retention* and what to study next. The UI never presents them as mastery or exam readiness.

## The core loop is Anki's: spaced active recall

Everything in Kivo serves one loop: **see a prompt → retrieve from memory → reveal → rate honestly → the card returns just before you'd forget it.**

Why this loop fits healthcare students in particular:

- **Volume.** A single OD/MD year adds thousands of discrete facts: foramina, innervations, drug mechanisms, enzyme regulation. Spaced repetition keeps review time manageable by showing each card only when it's due, not every time.
- **Durability.** Board exams and clinical work need knowledge from Year 1 years later. Retrieval practice spaced over time produces much more durable memory than re-reading or cramming.
- **Retrieval mirrors the clinic.** A patient doesn't present with four answer choices. Free recall ("what is this down-and-out eye with ptosis?") is the skill students need, so recall is the primary mode and recognition is secondary.
- **Multi-part answers are the norm.** Clinical facts often come in sets (CN III, VII, IX, X; the actions of an extraocular muscle). The recall checklist makes partial recall visible and the rating consistent, instead of a guess between Hard and Good.

Other modes exist to **support** this loop, not replace it:

| Mode | Role | Effect on schedule |
|---|---|---|
| **Spaced review** (core) | Daily recall queue: Again / Hard / Good / Easy | Drives the schedule |
| Flashcards | Browse or cram a collection freely | None |
| **Practice quiz** | Quizlet-style multiple choice and true/false generated **only from the student's own cards**, for exam-format practice | None; missed questions can be sent to today's review |
| Clinical cases | Vignette cards only, for applied reasoning | Uses the normal schedule |

### Practice quiz: generated from your cards, not from an AI

This takes the best part of AI question generation (instant practice questions) without its two problems (waiting and hallucination):

- The correct answer is always the card's answer, and each question links to its source card.
- Wrong options come from other terms in the same collection (other foramina, other nerves), so they're plausible but never invented.
- Questions are built instantly on the device.
- Future option: an AI assistant could *rephrase* a card into a new question stem or vignette. It must cite the source card and the student must review it before use. It never introduces facts that aren't in the student's cards.

## Personal-first sharing

Sharing in Kivo never means co-editing one deck.

- **Sharing gives the recipient their own independent copy.** They can reword, reorganize, tag and study it however works for them. Their schedule and progress are private.
- **The source stays linked.** Each copy remembers where it came from (lineage: *Priya's source v3.2 → your copy, 5 cards reworded, 8 added*).
- **Updates are suggestions, not overwrites.** When a creator improves their source, followers see each change and accept or skip it card by card. Cards the student has reworded are protected: Kivo shows "You reworded this card" and keeps their version unless they choose otherwise.
- **The creator controls distribution, not other people's copies.** The share dialog sets who can get a copy (people you send it to, your school, or anyone with the link) and whether to offer future changes as suggestions.

This solves Anki's "disconnected .apkg copies" problem without forcing a shared deck on students.

## Smart organization

Health-program material naturally follows *Program → Course → Unit/Lecture → Topic → Assessment*. Kivo keeps that structure underneath whatever names students use:

- On import, Kivo suggests a structured name (`HN_Lec4_Final` → *Head & Neck Anatomy / Lecture 04 / Cranial Nerves*). The original name is kept as an alias.
- Kivo detects duplicates ("38 of 71 cards match your Cranial Nerves collection") and offers "merge new cards only" or "keep separate".

In the prototype, suggestions are rule-based mock data, not an AI feature.

## MVP scope

1. Dashboard and navigation
2. Library and collection organization (import, naming suggestion, duplicate warning)
3. Visual card template builder
4. Active recall + spaced repetition session (with the recall checklist), the core
5. Practice quiz generated from the student's own cards
6. Personal-first sharing (copies, lineage, update suggestions)

Future concepts, deliberately out of MVP: advanced analytics, automated metadata generation, AI assistance, and live collaboration.

## Prototype disclaimer

All data is local sample content. Scheduling intervals come from a simplified SM-2-style model so the interactions feel real; it is not Kivo's production algorithm.
