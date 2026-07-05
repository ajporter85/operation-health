# Operation: Health — Technical Design & Build Plan

**Version 0.1 · Living document · How we build the app**
*Requirements & goals: see **Operation Health — Product Vision & Requirements** (the source of truth).*

---

## 1. Summary

We build **Operation: Health** as a **local-first Progressive Web App (PWA)** — a browser-based app that installs to your phone's home screen, runs offline, and stores data on your device. It starts as a **single self-contained HTML file you can use this week** and grows, without a rewrite, into the full six-pillar system with libraries, a rule engine, and a dashboard.

---

## 2. Design goals & constraints (from the NFRs)

Fast one-handed logging · works offline · free · data stays yours · mobile-first · extensible · trend-oriented. Every architecture choice below is in service of these.

---

## 3. Recommended architecture: local-first PWA

**What it is.** A single-page web app. HTML/CSS/JS running in the browser; data persisted **on-device** (IndexedDB, with `localStorage` acceptable for the earliest version); installable to the home screen so it feels like a native app and launches offline.

**Why it fits us.**

| Requirement | How the PWA delivers it |
|---|---|
| Fast mobile logging | Home-screen icon, instant launch, no login, forms tuned for thumbs |
| Offline | Service worker + on-device storage; logging never needs a connection |
| Free | Static hosting has free tiers; no server or database bill to run it |
| Own your data | Everything lives on your device; one-tap JSON export/backup |
| Start small → grow | v1 is one HTML file; later phases add modules without changing platform |
| Cross-platform | Same app on Android, iPhone, laptop — no separate builds |

**Honest tradeoffs.**
- **iPhone reminders are limited.** Web push works on Android/desktop well; on iOS it requires the app be added to the home screen (iOS 16.4+) and is more constrained. If reliable phone reminders are a hard requirement on iPhone, that's a real factor (options: accept calendar-based reminders, or revisit a native wrapper later).
- **No automatic multi-device sync out of the box.** Local-first means data is per-device. We design the data layer to be sync-*ready* (clean JSON state, a data-access boundary) so a sync backend can be added in a later phase if you decide you need phone + laptop in lockstep. Until then, JSON export/import is the manual bridge.

---

## 4. Alternatives considered

| Option | Verdict |
|---|---|
| **Google Sheets / Excel** | Great for input & manual review; fights us on the decision engine, live dashboard, streaks/XP, and quick mobile entry. Good as an interim log, not the destination. |
| **No-code DB (Airtable-style)** | Nice relational modeling and decent mobile apps; free tiers exist; but walls on custom rule-engine logic and full UI control. A reasonable fallback if we want zero coding. |
| **Native mobile app** | Best reminders and polish; highest effort, app-store overhead, and platform-specific work. Overkill for v1; possible far-future step. |
| **Local-first PWA** ✅ | Best balance of fit, cost, effort, data ownership, and a genuine "usable this week → scales for years" path. |

---

## 5. Tech stack (phased, deliberately light early)

- **Phase 1 (MVP):** vanilla HTML + CSS + JavaScript in a **single file**; data in `localStorage` (simplest) or IndexedDB; **export/import JSON** for backup. No build step, no framework, no accounts.
- **Phase 2+:** introduce **IndexedDB** properly and **Chart.js** (or similar) for trends; optionally adopt a light framework (React/Svelte) *only if* complexity earns it. Move to a Git repo with a `/docs` folder holding these two documents.
- **Phase 4 (only if needed):** add a small sync backend or a hosted DB for cross-device.

Guiding rule: **don't add a tool until the pain it solves is real.**

---

## 6. Data model

Core entities (all JSON-serializable; each record carries an `id` and timestamps):

| Entity | Purpose | Key fields |
|---|---|---|
| **Profile / Settings** | targets & preferences | targets (cal, protein, fat, fiber, water), wake-time goal, roadmap phase, `schemaVersion` |
| **DailyLog** | one row per day (the hub) | date, wake/bedtime, sleep hrs & quality, morning energy, protein-by-30 (Y/N), steps, walk min, water, hunger/energy AM-PM-EVE (1–5), mood, stress, weight (opt.), notes |
| **Meal** | a logged meal | date, slot (B/L/D/snack), items[], macros (cal/P/C/F/fiber), `mealLibraryId?` |
| **MealLibrary** | reusable saved meals | name, default macros, tags |
| **Workout** | a training session | date, type, duration, entries[] (exercise + sets/reps/weight/RPE) |
| **Exercise** (Library) | reusable exercises | name, category, equipment, progression tier, cues/notes |
| **SleepEntry** | sleep detail (may fold into DailyLog early) | date, bedtime, wake, duration, quality, screen use, caffeine cutoff |
| **Measurement** | body metrics over time | date, weight, optional circumferences |
| **Habit** + **HabitLog** | tracked habits & completions | habit def; per-day done/skipped |
| **MealPrep** | weekly checklist | week, proteins/veg/carbs/shopping/freezer/prep-done flags |
| **KnowledgeItem** | personal wiki entry | title, type (research/recipe/summary), body, source/link |

**Derived (never entered by hand):** ConsistencyScore, Streaks, adherence %, roadmap-phase progress, Achievements.

**Relationships:** DailyLog is the daily hub; Meals & Workouts reference their Library entries; Measurements & Sleep are time-series keyed by date; derived values are computed from these on the fly.

**Schema versioning (QA-friendly):** every stored record includes `schemaVersion`; a small migration step upgrades old data on load so we never lose history as the model evolves.

---

## 7. Rule engine

Rules are **data, not hard-coded branches** — each is `{ condition, window, message, severity }`, evaluated against recent trends (not single days). Examples:

- Morning protein logged "N" on ≥ X of last 7 days → *"Raise breakfast protein — prep a shake the night before."*
- Bedtime variance high **and** sleep quality low → *"Stabilize bedtime before changing calories."* (sleep-first principle, enforced)
- 7-day step average trending down → *"Add a short second walk."*
- Weight flat ≥ 2–3 weeks while adherence high → plateau flag → *"Small deficit nudge or extra activity."*
- Any core habit missed → guard the **"never miss two days in a row"** rule with a next-day prompt.

Start with ~5 rules in Phase 3; the format lets us add more without touching the engine.

---

## 8. Dashboard & visualization

- **KPI cards:** today's core log status, current streak, consistency score, current roadmap phase.
- **Trends:** weight, steps, protein, sleep hours/quality over weeks/months.
- **Progress bars:** daily targets (protein, water, steps) and roadmap-phase completion.
- **Consistency score** front-and-center, since it reinforces the exact behavior we care about.
- Phase 1 ships a minimal dashboard (today + streak + score); rich charts arrive in Phase 2 once there's data worth charting.

---

## 9. Build roadmap (MVP-first; maps to your sprints)

| Phase | Maps to | Deliverable | Usable? |
|---|---|---|---|
| **0 — Design** | Sprint 0 | These two docs + data model + dashboard sketch | — |
| **1 — MVP** | Sprint 1 | Single-file PWA: core DailyLog, on-device storage, JSON export/import, minimal dashboard (today, streak, consistency). **This week.** | ✅ daily |
| **2 — Depth & trends** | Sprint 1–2 | Exercise & Meal Libraries, full pillar logging (optional fields), Chart.js trends, measurements | ✅ |
| **3 — Intelligence** | Sprint 2–4 | Rule engine + recommendations, plateau/sleep/nutrition analysis, achievements | ✅ |
| **4 — Planning & reminders** | Sprint 5 | Meal/workout planners, shopping list, reminders (platform-permitting), optional sync | ✅ |
| **5 — Polish** | Sprint 6 | Conditional formatting/theme, gamification, Knowledge Base, UX refinement | ✅ |

The point of MVP-first: **you're logging in a real app within days**, and every later phase adds to a thing you already use rather than delaying use until it's "done." A decision engine with no data can't recommend anything, so inputs come first — which is also exactly your stated "this weekend" priority.

---

## 9.1 Phase 1 MVP — build scope (the spec for Claude Code)

The exact, unambiguous scope for the first build. **If it isn't listed as *in scope* below, it's Phase 2+.**

### Platform & structure
- Runs in a **desktop browser on the user's PC**. No server, no accounts, no network calls.
- **No build step, no framework, no external/CDN dependencies** (charts arrive in Phase 2).
- Organized as a few plain files loaded directly: `index.html`, `styles.css`, `app.js` (UI/wiring), `logic.js` (pure functions). *(This refines the earlier "single file" note — a small no-build split keeps the pure logic unit-testable, a Phase-1 quality goal.)*
- Persistence: **`localStorage`** (JSON) behind a thin storage module, so IndexedDB can replace it later without touching the UI.
- Include a PWA **manifest + service worker** so it *can* be installed/offline later — but installability and reminders are the iPhone phase, **not** Phase 1. Working in the PC browser is the goal.

### In scope
1. **Settings / Profile** (one screen): `wakeGoal` (time), `bedGoal` (time, optional), `stepsTarget`, `waterTarget` (L), `proteinTarget` (g — display only for now), `roadmapPhase`. Persisted.
2. **Daily Log** (core screen): one editable record per date. Fields below. Fast entry is the priority — good defaults, big targets, minimal typing.
3. **Dashboard** (home): three cards only — **Today**, **Streak**, **Consistency Score**.
4. **Export / Import**: download all data as one JSON file; import it back with a confirm. Format below.
5. **Data safety**: every record stamped `schemaVersion`; a no-op migration hook present.

### Out of scope (Phase 2+)
Meals & Meal Library · Workouts & Exercise Library · measurements beyond weight · charts/trend graphs · rule engine / recommendations · achievements/XP · reminders/notifications · meal prep · knowledge base · multi-device sync.

### Daily Log fields (MVP)

| Field | Type | Required | Notes |
|---|---|---|---|
| `date` | date | yes | one record per date; primary key |
| `wakeTime` | time | no | compared to `wakeGoal` for the score |
| `bedTime` | time | no | previous night's bedtime |
| `sleepHours` | number | no | manual entry (avoids cross-midnight math) |
| `sleepQuality` | 1–5 | no | |
| `morningEnergy` | 1–5 | no | |
| `proteinWithin30` | Y/N | no | the "30" habit; scored |
| `moved` | Y/N | no | did today's walk/movement; scored |
| `steps` | integer | no | scored vs `stepsTarget` |
| `waterLiters` | number | no | scored vs `waterTarget` |
| `weight` | number | no | optional; for later trends |
| `notes` | text | no | |

### Consistency Score — MVP starting definition
A 0–100 measure of *consistency of core habits* over the **trailing 7 days (including today)**. Pure function: `computeConsistency(logs, profile, asOfDate)`.

Per-day core signals (each 0 or 1):
- **Logged** — a record exists for that day.
- **Morning protein** — `proteinWithin30 === 'Y'`.
- **Moved** — `moved === 'Y'` OR `steps >= profile.stepsTarget`.
- **Hydration** — `waterLiters >= profile.waterTarget`.
- **Wake consistency** — `wakeTime` within ±30 min of `profile.wakeGoal` (omitted from the denominator if `wakeGoal` is unset).

Scoring: for each of the 7 days evaluate each applicable signal; **a missing day scores 0 on every signal** (missing = not consistent). `score = achieved ÷ possible × 100`, rounded. Also surface a one-line "what's dragging it down" hint (the lowest-scoring signal) — the seed of the future decision engine, hard-coded for now.

### Streak — MVP starting definition
A day **counts** if it's logged **AND** (`proteinWithin30 === 'Y'` OR `moved === 'Y'`) — you showed up and did at least one core thing. Streak = consecutive counting days ending today (or ending yesterday if today isn't logged yet, so an unlogged morning doesn't instantly zero it). Pure function: `computeStreak(logs, asOfDate)`.

### Export / Import format
```json
{
  "app": "operation-health",
  "schemaVersion": 1,
  "exportedAt": "<ISO timestamp>",
  "profile": { "...": "..." },
  "dailyLogs": [ { "date": "YYYY-MM-DD", "...": "..." } ]
}
```
Import: validate `app` and `schemaVersion`, then **merge by `date`** (imported day replaces the same-date local day) after a confirmation dialog; also offer a "replace all" option.

### Definition of done (Phase 1)
- Set targets, log a day, and watch the dashboard (Today, Streak, Score) update — all persisting across refresh.
- Export produces a valid file; re-importing it restores the same state.
- `logic.js` functions (`computeConsistency`, `computeStreak`, validators) are pure and covered by a few plain unit tests (a simple `tests.html` or console harness — no framework needed).

---

## 9.2 Phase 2 — graded consistency model (agreed 2026-07-04)

The Phase-1 score is a proportion of **binary** per-day signals. Phase 2 keeps that
structure but replaces each binary signal with a **three-state grade**, which adds
nuance without changing the daily-logging experience. This is the agreed model; it
supersedes the §9.1 "MVP starting definition" once Phase 2 begins.

**Per-metric grade (green / yellow / red).** Every scored metric resolves to one of
three states:
- 🟢 **green** — target met or exceeded → credit **1.0**
- 🟡 **yellow** — close; meaningful progress → credit **0.75** *(configurable; default 0.75)*
- 🔴 **red** — far enough off that the habit wasn't really done → credit **0.0**

**Grades are derived from the value you already entered — never a separate tap.** Enter
steps = 8,500 against a 10,000 target and the app computes yellow. This is a hard rule:
graded scoring must not add friction (the sub-60-second logging requirement wins).
Genuinely binary habits (e.g. "protein within 30 min", "did you walk") have no middle
state and stay **green/red only** — you can't be "close" to a yes/no.

**Daily score** = weighted average of each metric's credit × 100. Weights are **equal to
start**, but each signal stores a `weight` (default 1) so weighting can be switched on
later with no migration and no UX change.

**Consistency score** = the same calculation averaged over the **trailing 7 days**
(including today). A **missing day grades red on every signal** (unchanged from Phase 1:
missing = not consistent).

**Streak (revised).** A day **continues** the streak if it is **green *or* yellow** on the
core habit(s); only **red breaks** it. This directly encodes the guiding principles
"consistency beats perfection" and "never miss two days in a row" — a close day keeps you
alive; only a real miss resets you. Keep the Phase-1 grace where an unlogged *today* falls
back to yesterday so an unlogged morning doesn't zero the streak. *(A future "streak
freeze" — one forgiven red per week — is a possible later nicety, deferred.)*

**Dashboard.** Show a **7-day dot strip** (🟢🟡🔴 per day) next to the score so consistency
is *visible*, not just a number.

**Outcomes are never scored.** Weight (and later the scale trend) are outcomes you don't
fully control — track them as **trends only, never in the score**. You are scored on what
you *did* (effort), not on what the scale did. (Phase 1 already keeps `weight` out of the
score; preserve that.)

**Long-term considerations — revisit once there's real logged data** (both need data to
show *where* consistency actually breaks down before they're worth the added complexity):
1. **Per-metric weighting** — not every habit contributes equally; turn on the stored
   weights once we know which habits matter most.
2. **Individualized yellow thresholds per goal** — some habits are harder to stay
   consistent on than others, so the green/yellow/red bands may need to be tuned
   per-metric rather than one flat rule. Use accumulated data to decide where to be
   stricter or more lenient.

## 9.3 Parked ideas (from playtesting)

Not scheduled yet — captured so they aren't lost:
- **Display-unit preferences.** Let the user choose units per metric (e.g. water in
  **ounces** rather than litres; distance/time units for the exercise modules later).
  Store canonical values; convert only for display/entry.
- **Multi-level log inspection.** Browse past logs at different time resolutions — a
  specific **day**, then a **week**, then a **month** view — to inspect history and spot
  patterns (a natural lead-in to the Phase-2 trend charts).

---

## 10. Quality & data safety (the QA lens)

- **Backup:** one-tap JSON export; import to restore. Encourage periodic exports until sync exists.
- **Schema migrations** on load (see §6) so upgrades never orphan old data.
- **Testability:** keep logic (score, rules, macros) in pure functions, separate from the UI, so they can be unit-tested.
- **Privacy:** no accounts, no third-party analytics, no data leaves the device unless *you* export it.

---

## 11. Open decisions to confirm

1. **Direction:** local-first PWA, MVP-first — agreed? Or do you need **cross-device sync from day one** (which changes the stack toward a hosted DB / web app)?
2. **Primary phone:** iPhone or Android? (Directly affects how far we can take reminders.)
3. **Build vs. use:** do you want to **build this yourself** (I scaffold + guide, great for the QA/dev side of the fun) — or have me **build the v1** and hand it to you to use?
4. **Targets:** lock the §5 nutrition numbers as-is (pending your doctor/dietitian check), and near-term goal = fat loss or maintenance-while-building-habits?
5. **Interim tracker:** keep using the v1 spreadsheet for logging until the app MVP exists, or go straight to building the app?

---

## 12. Immediate next step

On agreement of §11.1–§11.3, **Phase 1**: I build (or scaffold, if you're building) the single-file PWA — DailyLog + on-device storage + export/import + a minimal dashboard with your streak and consistency score — so you have a real, usable app in hand within days while the rest is built out in phases.
