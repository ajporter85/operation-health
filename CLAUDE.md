# CLAUDE.md — Operation: Health

## What this is
A personal health-tracking app, built as a **local-first PWA**. The full vision and requirements live in `docs/Operation_Health_Vision_and_Requirements.md`; the technical design and phased build plan live in `docs/Operation_Health_Technical_Design.md`. **Those two files are the source of truth** — follow them, and if anything conflicts or is unclear, ask before proceeding.

## Current status (as of 2026-07-06)
**Phase 1 + all Phase 2 slices shipped, then two big pieces landed:**

- **Incremental-logging rework (`schemaVersion` 4).** The store is now a **stream of `LogEntry` records**; daily logs *and* measurements are **derived** via pure `projectDay`/`projectAll` (so the scoring/trends/history engine is untouched). Log tab = **quick-add chip grid** (Water/Meal/Steps/Weight/Measurements/Morning/Sleep) → focused sheets; shared date+time up top; "This day so far" running-totals summary with undo. History day-detail = graded summary **+ editable per-entry ledger** (inline edit/delete). Settings has water/weight/circumference **units** + **12/24h time**. The old `oh.dailyLogs`/`oh.measurements` stores were retired and the Measurements tab removed (measuring is a chip now); live data was re-entered (migration deliberately skipped). The full-day "power form" (B4) was **deliberately skipped** as redundant.
- **Meals module (M1 + M2).** A `meal` entry (slot B/L/D/S + name + 5 macros) that **accrues** into `day.nutrition`; **configurable nutrition targets** in Settings (never hard-coded); **Meal Library** — save/reuse meals via a picker + a shared "★ Save to library" toggle (in the Log sheet *and* the History ledger editor), managed in Settings. Nutrition does **not** feed the consistency score yet.

**No slice is currently queued.** Candidates: **Meals M3** (nutrition → consistency dials + nutrition trend charts), the **Workouts** heavy module, the **scoring-dials Settings UI**, or per-habit dot strips. Still **not** started: rule engine, reminders, sync, installability/iPhone home-screen. See design-doc **§13** (handoff) and **§14** (future directions + the external-dependency decision). **Confirm the next piece with the user and share a build plan before writing code.**

## Hard constraints (the default — see §14 on when to revisit)
- **No build step, no framework, no external/CDN dependencies.** Vanilla HTML/CSS/JS — held through Phase 2 + the logging rework + Meals (charts are hand-rolled inline SVG). Node is dev-tooling only; the app ships zero-dependency.
- Persistence via **`localStorage`** through a thin storage module (so IndexedDB can replace it later without touching the UI).
- Organize as `index.html`, `styles.css`, `app.js` (UI/wiring), `logic.js` (pure functions), `storage.js` (the localStorage boundary). Keep score/streak/validation/units/projection logic **pure and out of the UI** so it's unit-testable (`tests.html`).
- PWA manifest + service worker exist but stay minimal; **don't over-invest** — installability comes in a later phase.

**On local-first (important nuance):** local-first / zero-dependency was chosen as a **"start small, don't over-complicate" forcing function — not dogma.** The user is explicitly **open to relaxing it deliberately** (e.g. a food database/API to cut logging friction) once the **pros/cons of a specific dependency** are laid out. The rule that stays firm: **never add a dependency, make a network call, or change the stack quietly — propose it with tradeoffs and get an explicit decision first.** The food-data ladder and the "when to explore external deps" progression are in design-doc **§14**.

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
