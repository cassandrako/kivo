# Kivo — Web + iOS platform strategy

Students create material on a laptop and review it in short sessions on their phone between classes. Kivo targets both from one design system.

## Roles of each platform

| | Web (desktop-first, responsive) | iOS (native) |
|---|---|---|
| Primary jobs | Building cards, organizing the library, importing, sharing, insights | Daily reviews, quick card capture, notifications for due reviews |
| Navigation | Left sidebar (5 destinations + course shortcuts); collapses to icons < 980px | Bottom tab bar: Home · Library · Study · Exams · Insights |
| Study session | Keyboard-first: Space reveal, 1–4 rate, F flag, P pause | Thumb-first: ratings pinned to the bottom, 44pt targets, haptics on rate |
| Dialogs | Centered modals | Bottom sheets with a grabber |
| Typography | Inter | SF Pro via Dynamic Type (sizes mapped in tokens) |

## Shared foundation

- **Design tokens:** `design-tokens/kivo.tokens.json` (W3C Design Tokens format) is the single source of truth. It holds color primitives, semantic light/dark colors, the type scale with iOS Dynamic Type mappings, spacing, radii, elevation and the 44pt touch minimum.
  - Web: generate CSS custom properties (`prototype/css/tokens.css` mirrors this today).
  - iOS: generate an asset catalog (Any/Dark appearances) plus `Color.kivo.*`, `Font.kivo.*` and spacing constants. Figma variables carry iOS code syntax (`Color.kivo.textPrimary`).
- **Figma:** one file with shared Foundations and Components, and separate *Web · Desktop* and *iOS* pages.
- **Domain model:** Collection → Card (template type + fields) → per-student ReviewState (interval, ease, due date). Lineage on each collection (`sourceId`, `sourceVersion`, local edits) supports personal-first sharing.

## Recommended build path

1. **Now:** the responsive web prototype in `prototype/` works on phones with iOS-style patterns and can be installed to the home screen (web app manifest included). Use it for usability testing on both form factors.
2. **Production web:** React + TypeScript with tokens compiled to CSS variables.
3. **Production iOS:** SwiftUI app sharing the API and the token pipeline. Native is recommended over a cross-platform wrapper because the study session benefits from haptics, offline-first storage, widgets ("12 cards due") and notification actions.
4. **Sync:** offline-first review on device. Review logs sync and merge by timestamp; card content syncs per collection copy.
