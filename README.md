# Kivo

**Learn smarter. Remember longer.**

Kivo is a study platform for healthcare students. It keeps Anki's spaced-repetition review loop and makes it structured and easy to use, with personal-first sharing so every student owns and shapes their own collections.

## What's here

| Path | What it is |
|---|---|
| `prototype/` | Clickable, responsive prototype (HTML/CSS/JS, no build step). Desktop sidebar layout; iOS-style tab bar and bottom sheets at phone width. |
| `design-tokens/kivo.tokens.json` | Platform-neutral tokens (W3C format) for web CSS and iOS SwiftUI. |
| `docs/product-strategy.md` | Problem, positioning vs. Anki / Quizlet / AI tools, design principles, MVP scope. |
| `docs/platform-strategy.md` | How web and iOS split responsibilities and share one design system. |
| Figma | [Kivo — Design System & Prototype](https://www.figma.com/design/EWbhUpaJ8ug7mXeGStYlli) — foundations, components, Web · Desktop and iOS screens. |

## Run the prototype

```bash
cd prototype && python3 -m http.server 4173
```

Then open http://localhost:4173. To check the phone layout, use a narrow window or your browser's device emulation.

### Try the main journey

1. **Home**: 30 cards due → **Start Reviewing**.
2. **Session**: press `Space` to reveal. On multi-part answers, tick the key points you recalled; Kivo suggests a rating. Rate with `1`–`4` (`F` flags a card, `P` pauses, `Esc` exits).
3. Finish to see **what needs more practice**, then return Home ("All caught up").
4. **My Library → Head & Neck Anatomy → Import shared collection**: the name suggestion (`HN_Lec4_Final` → *Head & Neck Anatomy / Lecture 04 / Cranial Nerves*) and the duplicate warning.
5. **Cranial Nerves → Edit**: the template builder (Basic, Cloze, Image occlusion, Multiple choice, Clinical vignette) with live preview.
6. **Share**: recipients always get their own copy. **Review suggestions** shows source updates you accept or skip card by card.
7. **Explore** and **Insights**.

All data is local sample content. Scheduling uses a simplified prototype model, not a production algorithm.
