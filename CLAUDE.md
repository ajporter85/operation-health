# CLAUDE.md — Operation: Health

## What this is
A personal health-tracking app, built as a **local-first PWA**. The full vision and requirements live in `docs/Operation_Health_Vision_and_Requirements.md`; the technical design and phased build plan live in `docs/Operation_Health_Technical_Design.md`. **Those two files are the source of truth** — follow them, and if anything conflicts or is unclear, ask before proceeding.

## Current status (as of 2026-07-05)
**Phase 1 MVP + all Phase 2 build slices (1–4) + the Trends-polish pass are shipped and pushed.** That covers graded consistency + dot strip, trend charts (7-day moving average, High/Low), the History tab (month calendar + week view + day detail), and per-metric display units (water, weight). See §13 of the technical design doc for the full status/handoff and §9.2/§9.3 for the confirmed specs.

**No slice is currently queued** — the next direction is open (candidates: the scoring-dials Settings UI, per-habit dot strips, or the Phase 2 heavy modules — nutrition/meals/workouts/measurements). **Confirm the next piece with the user and share a build plan before writing code.** Still **not** started: rule engine, reminders, sync, and installability/iPhone home-screen (a later phase). The app runs in a **desktop browser on the user's PC** for now.

## Hard constraints
- **No build step, no framework, no external/CDN dependencies.** Vanilla HTML/CSS/JS — this has held through Phase 2 (charts are hand-rolled inline SVG). Node is dev-tooling only; the app ships zero-dependency. *(The one deliberately-open exception is a possible charting library — see §9.2 Q7; decide explicitly with the user before adopting, never quietly.)*
- Persistence via **`localStorage`** through a thin storage module (so IndexedDB can replace it later without touching the UI).
- Organize as `index.html`, `styles.css`, `app.js` (UI/wiring), `logic.js` (pure functions), `storage.js` (the localStorage boundary). Keep score/streak/validation/units logic **pure and out of the UI** so it's unit-testable (`tests.html`).
- PWA manifest + service worker exist but stay minimal; **don't over-invest** — installability comes in a later phase.
- **Ask before adding any dependency or changing the stack.**

## Quality expectations (the user is QA/systems-minded)
- Pure functions for `computeConsistency`, `computeStreak`, and validators; add a few plain unit tests (a `tests.html` or console harness — no framework needed).
- Every stored record carries `schemaVersion`; keep a migration hook for future upgrades.
- Data stays **on-device**: no network calls, no analytics. Export/import JSON is the backup path.
- Exact field list, score/streak definitions, and export format are specified in §9.1 — implement them as written.

## Working style
- Before writing code for a new piece, give a **short plan + proposed files + assumptions**, and wait for a nod.
- Prefer small, reviewable changes. Use git; commit in logical chunks.
- Keep daily-logging UX **fast and low-friction** — that's a top requirement, not a nice-to-have.

## Guardrails
- The nutrition targets in the requirements doc are the user's own starting numbers, pending a doctor/dietitian check — treat them as configurable **Settings**, never hard-coded.
