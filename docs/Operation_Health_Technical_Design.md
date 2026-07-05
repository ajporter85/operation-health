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

## 9.2 Phase 2 — graded consistency model (CONFIRMED 2026-07-04)

Phase-1 scoring is a proportion of **binary** signals. Phase 2 keeps that structure but
upgrades the numeric/tolerance signals to a **three-state grade**, adding nuance without
adding taps. All decisions below were reviewed and confirmed with Andrew on 2026-07-04;
they supersede the §9.1 "MVP starting definition" once Phase 2 begins.

### Build slices (sequencing — CONFIRMED)
Phase 2 ships in small, independently-useful slices, smallest-first:
1. **Slice 1 — Graded consistency + dot strip. ✅ SHIPPED (2026-07-05).** Reused the
   existing DailyLog (no new data entities). Evolved scoring + streak; added the 7-day
   dot strip. Built in three commits: 1a rename+migration+config seed, 1b graded engine,
   1c dot strip + band coloring.
2. **Slice 2 — Trend charts. ✅ SHIPPED (2026-07-05).** Weight, steps, sleep over time as
   **hand-rolled inline SVG, zero dependencies**. Built in four commits: 2a Trends tab +
   weight chart (buildSeries / seriesStats / plotLine); 2b steps + sleep + steps target
   line; 2c timeframe dropdown (rangeToDays, persisted via a new UI-prefs store); 2d chart
   stats row (Avg / Change / On-target), sleep target from bed/wake goals, per-point hover
   tooltips, and a "Last 7 days" range. Dashed gap-bridges span un-logged days throughout.
3. **Slice 3 — Multi-level log inspection. ← next up.** Browse a day → week → month.
4. **Slice 4 — Unit/display preferences.** e.g. water in ounces (parked idea).
5. **Later — heavy modules.** Full nutrition (protein *grams*), meal/exercise libraries,
   measurements, per-habit dot strips, the scoring-dials Settings UI.

### Grade rule (three states)
Every scored metric resolves to one state:
- 🟢 **green** — target met/exceeded → credit **1.0**
- 🟡 **yellow** — close → credit **0.75** *(the yellow **credit**; configurable, default 0.75)*
- 🔴 **red** — clearly missed → credit **0.0**

Grades are **derived from the value you already entered — never a separate tap** (enter
steps 8,500 vs a 10,000 target → yellow). Genuinely binary habits have no middle state and
stay 🟢/🔴 only.

### Threshold defaults (CONFIRMED — all configurable later)
- **Numeric metrics** (steps, water): 🟢 ≥ 100% of target · 🟡 ≥ 75% of target · 🔴 < 75%.
- **Wake time**: 🟢 within ±30 min of `wakeGoal` · 🟡 within ±60 min · 🔴 beyond.
  *(If `wakeGoal` is unset, wake is omitted from the denominator, as in Phase 1.)*
- Note: this **75% "closeness" threshold** is a *different dial* from the 0.75 **yellow
  credit** above — they coincidentally share the number 75.

### Scored signals (Slice 1)
| Signal | Type | Grade rule |
|---|---|---|
| Logged | 🟢/🔴 | green if a record exists that day (missing day → red on everything) |
| Morning protein (`proteinWithin30`) | 🟢/🔴 | green if `'Y'` |
| Morning exercise (`morningExercise`) | 🟢/🔴 | green if `'Y'` — **see pivot below** |
| Steps | 🟢/🟡/🔴 | vs `stepsTarget` at 100% / 75% |
| Water | 🟢/🟡/🔴 | vs `waterTarget` at 100% / 75% |
| Wake consistency | 🟢/🟡/🔴 | vs `wakeGoal` at ±30 / ±60 min |

**Signal pivot — "moved" → "morning exercise" (CONFIRMED direction; finalize field name in
Slice 1).** In Phase 1 the binary habit was a generic "moved / walked today", with Steps
folded into it. In Phase 2 we **split Steps out as its own graded signal** (above) and
**re-point the binary habit at the morning routine**: *did you exercise in the morning?*
This aligns the two binary morning habits — **morning protein + morning exercise** — with
the **30/30/30 rule** (protein within 30 min of waking + ~30 min of morning movement), so
the score reinforces the "get up → morning protein → morning movement" cluster. Steps then
measures *general* daily activity separately.
- Implementation: rename the DailyLog field `moved` → `morningExercise`; relabel the UI
  toggle accordingly; migrate old `moved` values to `morningExercise` in the v1→v2 step.

### Daily score & consistency score
- **Daily score** = weighted average of each signal's credit × 100. **Weights equal to
  start**; each signal stores a `weight` (default 1) so weighting can switch on later with
  no migration and no UX change.
- **Consistency score** = daily score averaged over the **trailing 7 days** (incl. today).
  A **missing day grades red on every signal** (missing = not consistent).

### Streak — now keyed off the whole-day grade (CONFIRMED)
The Phase-1 streak keyed off one habit; in the graded model the "green-or-yellow keeps you
alive" leniency only bites when it's based on the **day's overall grade**:
- Grade the **day** from its daily score: 🟢 ≥ 80 · 🟡 ≥ 50 · 🔴 < 50 *(bands configurable)*.
- A **🟢 or 🟡 day continues** the streak; a **🔴 day breaks** it.
- Keep the Phase-1 grace: if **today** isn't logged yet, evaluate the streak ending
  **yesterday** so an unlogged morning doesn't zero it. (A missing day = all-red = 🔴 =
  breaks, as before.)
- *(Deferred nicety: a once-a-week "streak freeze" that forgives one 🔴.)*

### Dashboard (Slice 1)
- **Single 7-day dot strip** = each of the last 7 days' **overall** grade (🟢🟡🔴), next to
  the Consistency card. *(Per-habit strips are richer but deferred to a later slice.)*
- Color the consistency number by its band.

### Data / schema (Slice 1)
- **`schemaVersion` → 2**, with a real migration (first non-no-op use of the hook):
  - Profile: add scoring config (yellow credit, thresholds, day-grade bands, per-signal
    weights) seeded with the defaults above.
  - DailyLog: rename `moved` → `morningExercise`.
  - Old records upgrade on load; no history lost.

### Deferred within Phase 2 (CONFIRMED)
- **Scoring-dials Settings UI** (yellow credit, thresholds) — ship sensible defaults in
  Slice 1; add the tuning UI in a **follow-up slice**.
- **Outcomes never scored** — weight (and later the scale trend) stay **trend-only, never
  in the score** (Phase 1 already excludes `weight`; preserve that).

### Long-term considerations — revisit once there's real logged data
Both need data to reveal *where* consistency actually breaks down before they earn their
complexity:
1. **Per-metric weighting** — turn on the stored weights once we know which habits matter most.
2. **Individualized thresholds per goal** — some habits are harder to stay consistent on;
   the green/yellow/red bands may need per-metric tuning rather than one flat rule.

### Charting dependency (Q7 — CONFIRMED approach)
Slice 2 starts with **hand-rolled inline SVG charts (zero dependencies)** — our data is
tiny, it works offline trivially, and it keeps the no-build ethos. Andrew is **not opposed
to dependencies** but wants the **pros/cons laid out first**. So a **later dedicated pass
will evaluate adding a charting library** (e.g. Chart.js) — weighing bundle/offline/vendoring
cost vs. richer interactivity — and decide explicitly before adopting one. Do **not** quietly
add a dependency; this stays an open, deliberate decision.

## 9.3 Parked ideas (from playtesting)

Captured so they aren't lost; now mapped to the slices above where they fit:
- **Display-unit preferences** (Slice 4). Choose units per metric (water in **ounces** vs
  litres; distance/time units for exercise later). Store canonical values; convert for
  display/entry only.
- **Multi-level log inspection** (Slice 3). Browse a **day → week → month** view — a natural
  lead-in to the Slice-2 trend charts.
- **Trends polish (deferred, from Slice 2 playtesting)** — a dedicated pass, whenever the
  list feels cluttered (not tied to Slice 3):
  - **Range list consistency review.** The dropdown currently mixes *rolling* ("Last 7/30
    days, 3/6 months, 1 year") with *calendar* ("This month"). Decide on one paradigm or
    cleanly group the two; consider adding **"This week"** (calendar) to pair with "This month".
  - **Richer chart stats.** A **7-day moving-average overlay** to smooth daily noise; a
    **best/worst day** (value + date). Revisit the **"Change" metric** too — it's plain
    last−first per range now; a denoised trend measure was tried (first-vs-last-quarter
    average) but read as confusing, so it was reverted. Reconsider once there's more data.
- **In-calendar "logged day" markers** (Slice 3). The Daily Log date field uses the native
  picker, which can't be annotated; browsing logs will want a custom calendar that marks
  which days have entries.

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

---

## 13. Status & session handoff

**As of 2026-07-05 (end of day):**

- **Phase 1 MVP — shipped & working.** No-build, zero-dependency PWA: `index.html`,
  `styles.css`, `app.js` (UI wiring), `logic.js` (pure functions), `storage.js`
  (localStorage boundary), `tests.html` (pure-logic tests), plus a minimal
  `manifest.webmanifest` + `sw.js`. Dashboard (Today / Streak / Consistency), Daily Log,
  Settings, and JSON export/import (Merge / Replace-all modal) all working and persisting.
  Verified booting from `file://` and via headless render.
- **Phase 2 Slice 1 — shipped & working (2026-07-05).** Graded three-state consistency
  model per §9.2, in three commits:
  - *1a* — `schemaVersion`→2 with the first real migration (`moved`→`morningExercise`,
    idempotent); seeded `profile.scoring` dials; `validateImport` accepts & migrates v1
    backups. `DEFAULT_SCORING` in `logic.js` is the single source of truth.
  - *1b* — grading engine (`gradeBinary`/`gradeNumeric`/`gradeWake`/`creditFor`/
    `computeDailyScore`/`gradeDay`); rewrote `computeConsistency` (avg of daily scores
    over 7 days, missing = 0) and `computeStreak` (keys off the whole-day grade, 🟢/🟡
    continue, 🔴 breaks, unlogged-today grace kept). Steps/water/wake drop from the
    denominator when their target/goal is unset.
  - *1c* — dashboard 7-day dot strip (`last7Grades`): solid 🟢🟡🔴 for logged days by
    whole-day grade, hollow for un-logged days, small brand "today" dot; consistency number
    colored by its band. Verified via seeded headless render.
- **Phase 2 Slice 2 — shipped & working (2026-07-05).** Trends tab with hand-rolled inline
  SVG charts (zero deps), in four commits:
  - *2a* — Trends tab + Weight chart. Pure `buildSeries` / `seriesStats` / `plotLine`
    (auto-scaled y, line breaks across gaps).
  - *2b* — Steps + Sleep charts via the shared `chartCard`; **steps target line** (widens
    the y-range, dashed reference line).
  - *2c* — **timeframe dropdown** (Last 7/30 days, This month, 3/6 months, 1 year, All);
    pure `rangeToDays`; choice **persisted** via a new `oh.prefs` UI-prefs store
    (`getPrefs`/`setPref`) kept out of exports.
  - *2d* — stat row **Avg · Change · On target** (`countOnTarget`); **Change is plain
    last−first over the range** (a denoised quarter-average version was tried and reverted
    as confusing — see §9.3); **Sleep target** from bed/wake goals (`goalSleepHours`,
    midnight-wrap aware); **per-point hover tooltips** (native SVG `<title>`, skipped past
    60 points). Dashed **gap-bridges** span un-logged days on every chart.
- **Test fixture:** `test-data/sample-30days.json` — 27 logged days over a 30-day span (3
  gaps, 2 partial days, weight decline + jitter, green/yellow/red spreads). Import via
  Settings → Import → Replace-all to exercise the dashboard, dot strip, and charts.
- **Repo:** private GitHub repo `ajporter85/operation-health` (`origin/main`, HTTPS via
  `gh`). All work committed and pushed.
- **Dev environment on Andrew's Windows PC:** git, GitHub CLI (`gh`), Node LTS + npm, and
  VS Code extensions **Live Preview** (installed, parked/unused for now) and **Microsoft
  Edge Tools** (primary preview + inspect). Node is **dev tooling only** (enables Edge
  Tools' webhint a11y/compat/security linting); **the app itself stays zero-dependency**.
- **Working agreement:** make change → **Andrew tests locally & confirms** → *then*
  commit/push. Applies to code changes.
- **Known deferred:** the Edge Tools **`apple-touch-icon`** warning is left as-is on
  purpose — iOS home-screen icons belong to the later **installability phase**, not now.
  In-calendar "which days are logged" markers need a custom calendar → deferred to Slice 3
  (log inspection); the dashboard dot strip covers the last-7-days case for now.

**Next session resumes at: Phase 2 → Slice 3 (multi-level log inspection).** Browse a
**day → week → month** view of logged days — a natural lead-in that also wants a **custom
calendar marking which days have entries** (the native date picker can't be annotated; see
§9.3). Suggested first step: turn Slice 3 into a concrete build plan — what the day/week/
month views show, how you navigate between them, and where they live (likely a new tab or
an expansion of Trends) — share for Andrew's nod, then build smallest-first. Reuse the
`sample-30days.json` fixture for testing.

*Also queued (smaller, do whenever):* the **Trends polish** pass in §9.3 (range-list
consistency + "This week", moving-average overlay, best/worst-day, revisit "Change"). Not
blocking Slice 3.
