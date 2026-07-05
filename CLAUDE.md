# CLAUDE.md — Operation: Health

## What this is
A personal health-tracking app, built as a **local-first PWA**. The full vision and requirements live in `docs/Operation_Health_Vision_and_Requirements.md`; the technical design and phased build plan live in `docs/Operation_Health_Technical_Design.md`. **Those two files are the source of truth** — follow them, and if anything conflicts or is unclear, ask before proceeding.

## Current focus: Phase 1 (MVP) ONLY
Build only what's in the **"9.1 Phase 1 MVP — build scope"** section of the technical design doc. Do **not** build Phase 2+ features yet (meals, workouts, libraries, charts, rule engine, reminders, sync). The app runs in a **desktop browser on the user's PC** for now — installability and iPhone reminders come in a later phase.

## Hard constraints
- **No build step, no framework, no external/CDN dependencies** in Phase 1. Vanilla HTML/CSS/JS.
- Persistence via **`localStorage`** through a thin storage module (so IndexedDB can replace it later without touching the UI).
- Organize as `index.html`, `styles.css`, `app.js` (UI/wiring), `logic.js` (pure functions). Keep score/streak/validation logic **pure and out of the UI** so it's unit-testable.
- Include a PWA manifest + service worker, but **don't over-invest** there in Phase 1.
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
