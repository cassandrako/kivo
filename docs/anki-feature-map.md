# Anki feature map

What Anki does, and where Kivo stands on each feature. Kivo's core is Anki's: notes that generate cards, studied with spaced repetition. The goal is the same power with less setup.

**Status key:** ✅ working in the prototype · 🔜 planned next · ⏳ needs accounts or a backend · ➖ intentionally left out

## Organization

| Anki | Kivo | Status |
|---|---|---|
| Decks and subdecks (`Parent::Child`) — e.g. `Course::Exam 2::Lecture 04` | Semester → Course → Exam → Lecture collection. Each level is a "deck" you can open and study. | ✅ |
| Study a parent deck to include its subdecks | **Study course**, **Study exam** or **Study** a single lecture collection. Never across courses: there's no mixed “study everything” and no studying a whole semester. | ✅ |
| Deck list with New / Learn / Due counts | Study page tree with the same three counts at every level | ✅ |
| Create, rename, delete and move decks | Create, rename and delete semesters, courses, exams and collections. Drag a collection onto an exam folder (or onto a course in the sidebar) to move it, with undo; on phones use its ⋯ menu | ✅ |
| (no equivalent) | Archive a semester to tidy the library; archiving pauses its reviews until you restore it | ✅ |
| Tags | Tags on every note, searchable | ✅ |
| Filtered decks (custom study by search) | Study by scope works now; study-by-tag and "review ahead" sessions | 🔜 |

## Notes and cards

| Anki | Kivo | Status |
|---|---|---|
| Notes generate cards | Same model: one note → one or more cards, sharing edits | ✅ |
| Basic | Basic | ✅ |
| Basic (and reversed card) | Basic + reversed (two cards) | ✅ |
| Basic (type in the answer) | Left out: recall is judged by the student, not by typing | ➖ |
| Cloze, `{{c1::…}}`, hints `{{c1::…::hint}}`, several clozes per note | Same syntax under the hood. Select text and choose **Hide as new card** or **Hide in same card**; no typing braces. | ✅ |
| Image Occlusion | Paste (⌘V), drop or choose your own image. **Box** tool: drag over a label, or tap to drop a box. **Arrow** tool: tap a structure to point an arrow at it and type the answer (drag to place the answer tag). **Select** tool: move, resize, delete. One card per mask; “Hide all, guess one” or “Hide one, guess one”. A sample skull-base diagram is still available. | ✅ |
| (no equivalent; students white out labels in Preview or on an iPad first) | **Hide all text**: Kivo finds the printed labels on a diagram and covers each one, so the original labelled image works as is. Two-line labels become one mask; numbered lists stay one mask per item. Undo if it covers too much. | ✅ |
| Note types and card templates in HTML/CSS | Fixed, well-designed templates with a live preview. No HTML or CSS. | ➖ by design |
| Add dialog, with deck chooser | **Add card**, always one click away (sidebar, collection header, keyboard `A`). Like Anki’s deck chooser, pick the course and then the collection, or make a new collection from the picker. It opens on the course or collection you were viewing. | ✅ |
| Edit a note | Click any card in a collection, or press `E` during review | ✅ |
| Duplicate check on add | Duplicate check on import (same front text in the course) | ✅ (import) · 🔜 (while typing) |
| Media: images, audio, LaTeX/MathJax | Images on the front or back of Basic and Reversed cards, and on Cloze cards: paste, drop or choose. Stored in the browser (IndexedDB), resized to 2000 px. Audio and equations later. | ✅ images · 🔜 audio, equations |
| (no equivalent) | **Key points** on multi-part answers, ticked off during review to suggest a rating | ✅ |

## Browser

| Anki | Kivo | Status |
|---|---|---|
| Card browser with search | Per-collection card list with search across fields and tags | ✅ |
| Filter by state (new, learning, review, due, suspended, flagged) | Filter chips for each, plus **Leeches** | ✅ |
| Suspend / unsuspend | ✅ from the card menu or during review (`@`) | ✅ |
| Flags | One flag color (toggle with `F`) | ✅ · more colors 🔜 |
| Reset / forget card | **Reset to new** | ✅ |
| Delete notes (with undo) | Delete with undo | ✅ |
| Card info (reviews, lapses, stability, due) | Shown on the edit screen for each card of the note | ✅ |
| Bulk edit, change deck for many cards, find & replace | | 🔜 |
| Global browser across all decks | Library search finds cards across every course | ✅ (search) · 🔜 (bulk actions) |

## Scheduling

| Anki | Kivo | Status |
|---|---|---|
| FSRS (default in modern Anki) | FSRS-5 with its published default parameters | ✅ |
| Again / Hard / Good / Easy with next-interval preview | Same, with plain-language descriptions | ✅ |
| Learning steps and relearning steps | Default 1m 10m and 10m, editable | ✅ |
| New cards per day, maximum reviews per day | Set once for the account (asked during sign-up, editable in **Study settings**); any course can use its own instead | ✅ |
| Desired retention | Slider, 80–97%, default 90% | ✅ |
| Maximum interval | ✅ | ✅ |
| Leech threshold and action (tag or suspend) | ✅ default 8 lapses, tag | ✅ |
| Bury related cards (siblings) | ✅ on by default | ✅ |
| Bury a card manually | `−` during review | ✅ |
| Undo | `⌘Z` during review, plus undo on delete and import | ✅ |
| Optimize FSRS parameters from your own history | Needs enough review history | 🔜 |
| Option presets shared across decks | The account’s settings are the default preset; a course can switch to custom settings | ✅ |
| Day starts at 4am, load balancing, fuzz | | 🔜 |

## Studying

| Anki | Kivo | Status |
|---|---|---|
| Show answer (`Space`), rate (`1`–`4`), `Space` = Good after reveal | Same keys | ✅ |
| Edit current card (`E`), flag, bury (`−`), suspend (`@`), undo | Same | ✅ |
| Remaining counts (new · learning · review) in the session | ✅, with the current card's type underlined | ✅ |
| "Congratulations, finished for now" screen | Session summary: ratings, weak sections, what's next | ✅ |
| Custom study: extra new cards today, review forgotten cards | | 🔜 |
| (no equivalent) | **Practice quiz**: multiple choice and true/false generated from your own cards, never changes the schedule | ✅ |

## Statistics

| Anki | Kivo | Status |
|---|---|---|
| Today, reviews per day, future due forecast | Insights: activity (28 days), next 7 days' load | ✅ |
| Retention, card counts, mature cards | Estimated retention per course (FSRS), cards started, mature cards | ✅ |
| Interval, ease/difficulty, hourly and answer-button graphs | Deliberately fewer graphs; focused on "what to study next" | ➖ mostly |

## Data, sync and sharing

| Anki | Kivo | Status |
|---|---|---|
| Local collection | Saved in your browser (survives reloads) | ✅ |
| Import text/CSV | Paste or upload; tab, semicolon or comma; course and lecture suggested from the file name; duplicates skipped | ✅ |
| Import `.apkg` decks | Read Anki packages directly in the browser | 🔜 |
| Export (`.apkg`, text) | | 🔜 |
| AnkiWeb sync across devices | | ⏳ |
| Shared decks (AnkiWeb) | Personal-first sharing: everyone gets their own copy and updates arrive as suggestions | ⏳ (designed, simulated) |
| Profiles | Accounts with sign up (Apple, Google, email) and onboarding by program; each account has its own library. Sign-in is simulated in this browser until the backend lands. | ✅ (simulated) · ⏳ (real sign-in) |
| Backups, check database | | 🔜 / ⏳ |
| Add-ons | Not planned; common add-on needs (image occlusion, FSRS, heatmaps) are built in | ➖ |
| Night mode | Light and dark themes, following the system setting | ✅ |
| Keyboard shortcuts | Study, editor (`⌘↵` save), `A` add, `/` search | ✅ |

## Left out on purpose

- **Sample or pre-made cards.** Like a fresh Anki profile, every account starts with no cards. Kivo sets up courses and exam folders, and the Home guide shows how to make the first ones.

- **Sections or sub-decks inside a lecture.** One lecture is one collection; tags are there if you want finer grouping.

- **Flashcard browse mode** and **clinical cases mode.** Studying is spaced review; vignettes are just cards.
- **HTML/CSS card templates.** Templates are fixed so creating cards never becomes a coding task.
- **Type-in-the-answer cards.** Recall is the student's own judgment, supported by the key-points checklist.
