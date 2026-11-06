# Kivo

**Learn smarter. Remember longer.**

Kivo is a study platform for healthcare students. It keeps Anki's spaced-repetition review loop and makes it structured and easy to use, with personal-first sharing so every student owns and shapes their own collections.

## What's here

| Path | What it is |
|---|---|
| `prototype/` | Clickable, responsive prototype (HTML/CSS/JS, no build step). Desktop sidebar layout; iOS-style tab bar and bottom sheets at phone width. |
| `design-tokens/kivo.tokens.json` | Platform-neutral tokens (W3C format) for web CSS and iOS SwiftUI. |
| `docs/product-strategy.md` | Problem, positioning vs. Anki / Quizlet / AI tools, design principles, MVP scope. |
| `docs/anki-feature-map.md` | Every Anki feature and its status in Kivo: built, planned, needs accounts, or left out on purpose. |
| `docs/platform-strategy.md` | How web and iOS split responsibilities and share one design system. |
| Figma | [Kivo — Design System & Prototype](https://www.figma.com/design/EWbhUpaJ8ug7mXeGStYlli) — foundations, components, Web · Desktop and iOS screens. |

## Run the prototype

```bash
cd prototype && python3 -m http.server 4173
```

Then open http://localhost:4173. To check the phone layout, use a narrow window or your browser's device emulation.

### Try it

0. **Sign up.** Continue with Apple, Google (both simulated) or email, then six short steps: name, what you study (optometry, medicine, dentistry, pre-health, another health program, or working in healthcare), program details, courses, upcoming exams, and daily limits. The courses step suggests courses for your year and term from a catalog (`prototype/js/catalog.js`, which also reads every course in the sample students); switch year or term to browse, or type your own. The daily limits (new cards and maximum reviews per day, like Anki) apply to your whole account; any course can override them in its Review settings, and you can change them later under **Study settings** in the account menu. Nobody starts with sample cards: your courses and exam folders are ready, and a **Get started** guide on Home walks you through making a collection, adding a card, reviewing it, and the Library’s New menu. On the welcome screen, **Prototype: try it as** pre-fills the flow for one of four sample students: Alex Rivera (OD1, Pennsylvania College of Optometry), Maya Chen (MS1, Penn Perelman), Jordan Okafor (D2, Columbia Dental, Sign in with Apple) or Sam Patel (4th-year Life Sciences at the University of Toronto, pre-med, MCAT in April). Each account keeps its own library; sign out from the account menu.
1. **Home → Start [course].** Reviews are one course at a time; Kivo starts with the course whose exam is nearest, then offers the next. Press `Space` to show the answer and `1`–`4` to rate (Space again = Good). On multi-part answers, tick the key points you recalled. `E` edits the card, `F` flags, `−` buries, `@` suspends, `⌘Z` undoes.
2. **Study** shows every course, exam and collection (grouped by semester) with New / Learn / Due counts, like Anki’s deck list.
3. **My Library → New** opens one menu: Card, Lecture collection, Exam, Course, Semester, or Import. Build your own Semester → Course → Exam → Lecture collection structure. Archive a finished semester from its ⋯ menu; archiving pauses its reviews until you restore it.
4. **Add card** (sidebar, or `A`) for Basic, Basic + reversed, Cloze or Image occlusion, with a live preview. Click any card in a collection to edit it.
5. **Import** a text/CSV export, or try the sample `HN_Lec4_Final.txt`: Kivo suggests where it belongs and skips duplicates.
6. **A collection page** keeps to what you need: its exam and date, card count, retention, Add card, Study, and the card list. Share, Practice quiz, settings and delete live in the ⋯ menu. **Practice quiz** works from any collection, exam or course: multiple choice and true/false built from your own cards.
7. **Exams → Import from calendar** (Canvas or Google `.ics`), and **Insights**.
8. A course’s ⋯ menu → **Review settings**: daily limits, learning steps, desired retention, leeches.

Accounts and data are saved in your browser (one library per account). Scheduling is FSRS-5 (the algorithm modern Anki uses) with Anki-style learning steps. See `docs/anki-feature-map.md` for which Anki features are built, planned or left out.
