# Operation: Health — Product Vision & Requirements

**Version 0.1 · Living document · Source of truth for *what* we're building and *why***
*Companion to: Operation Health — Technical Design & Build Plan (the "how").*

---

## 1. Mission

Build a healthier, stronger, more energetic life through **consistent habits, not perfection.** Rather than chasing a number on the scale, we build systems that naturally produce healthy outcomes and support good decisions over a **2+ year horizon**.

The product is not a tracker. It's a **Personal Health Operating System** — something that helps answer *"why am I tired?"*, *"why isn't the weight moving?"*, and *"what should I work on next?"* — not just record what happened.

---

## 2. Guiding principles

1. **Sleep is the foundation** (Pillar #1).
2. Consistency beats perfection.
3. Protein and fiber come first.
4. Move every day.
5. Strength preserves muscle while losing fat.
6. Build habits before increasing intensity.
7. Trust weekly and monthly trends, not individual days.
8. Design the environment to make healthy choices easy.
9. **Never miss two days in a row.**

---

## 3. Long-term goals

**Health:** lose body fat sustainably · improve cardiovascular health · build strength & muscle · improve mobility · improve energy · consistent sleep schedule · habits maintainable for life.

**Fitness (progression targets):** daily 30/30/30 routine → 10,000+ steps/day → comfortable Zone 2 cardio → regular rowing → full-body strength → progressive bodyweight → kettlebell training → long-term athletic lifestyle.

**Nutrition:** transition off intermittent fasting toward structured breakfast / lunch / dinner / snacks, protein-forward, fiber via psyllium before lunch & dinner, hydration throughout the day.

**Sleep:** consistent bedtime & wake time · support the 30/30/30 morning routine · reduce late-night eating · improve recovery · increase daily energy.

---

## 4. The six pillars (tracking taxonomy)

| # | Pillar | What it covers |
|---|--------|----------------|
| 1 | **Sleep** | bedtime, wake time, duration, quality, morning energy, evening screen use, caffeine cutoff |
| 2 | **Nutrition** | calories, protein, carbs, fat, fiber, water, breakfast/lunch/dinner/snacks, psyllium |
| 3 | **Movement** | walking, steps, treadmill, rowing, mobility, stretching, standing breaks |
| 4 | **Strength** | workouts, exercises, sets, reps, weights, progression, RPE |
| 5 | **Recovery** | soreness, hunger, energy, mood, stress, recovery |
| 6 | **Environment** | meal prep, groceries, healthy snacks, workout clothes ready, treadmill accessible, water bottle filled |

> **Design tension to respect:** the taxonomy is rich, but *daily entry must stay near one minute.* Depth lives in the structure and the auto-generated outputs — not in what you hand-type each morning. Most fields are optional; a small "core" set drives the streaks and score.

---

## 5. Nutrition targets (starting point)

| Target | Value |
|--------|-------|
| Calories | ~2,300–2,500 / day |
| Protein | ~170 g / day |
| Fat | ~75 g / day |
| Carbohydrates | fill remaining calories |
| Fiber | increase gradually; psyllium before lunch & dinner |
| Hydration | 3–4 L / day |
| Morning rule | 30–40 g protein within 30 min of waking (the "30" in 30/30/30) |

> These are moderate, reasonable starting numbers for your size and goals, but they'll drive the whole nutrition module — **worth a quick confirm with your doctor or a dietitian** before we treat them as fixed. Near-term intent to confirm: active fat loss vs. maintenance-while-building-habits.

---

## 6. Exercise roadmap (four phases)

- **Phase 1 — Become a walker.** 30-min daily treadmill walk; build the morning routine; improve sleep; no focus on intensity.
- **Phase 2 — Movement becomes lifestyle.** 10k steps; longer walks; mobility; introduce rowing.
- **Phase 3 — Strength becomes routine.** 2–3 full-body workouts/week, progressing:
  - Chair squats → goblet squats → split squats → lunges
  - Wall push-ups → bench push-ups → floor push-ups
  - Bodyweight → dumbbells → kettlebells
- **Phase 4 — Performance.** Better conditioning; stronger lifts; longer cardio; athletic lifestyle.

*(More detailed exercise PDFs to be folded into the Exercise Library as they arrive.)*

---

## 7. App feature requirements

The app is a mix of:

1. **Data tracking** — weight, macros, workouts, habits, sleep, measurements.
2. **Time-series trends** — progress over weeks and months (the unit of truth is the trend, not the day).
3. **Rule-based logic** — the 30g-protein-morning rule, streaks, adherence/consistency, "never miss two days in a row," plateau detection.
4. **Dashboard visualization** — charts, progress bars, roadmap-phase tracker, KPI cards.
5. **Reminders / scheduling** — *(nice-to-have; platform-dependent — see design doc).*
6. **Fast web/mobile logging** — quick entry is a top-priority requirement, not a bonus.
7. **Exercise Library / database** — reusable exercises for fast workout entry.
8. **Meal Library / database** — save favorite/regular meals for one-tap logging.

### Derived / "smart" features (from v2)
- **Consistency Score** — measures *consistency* of sleep, calories, protein, steps, water, bedtime (not just raw numbers).
- **Hunger & Energy tracking** — morning / afternoon / evening, 1–5.
- **Decision Engine** — rule-driven recommendations, e.g. *protein low → raise breakfast protein*; *sleep inconsistent → fix bedtime before touching calories*; *steps trending down → walk more*.
- **Meal Prep system** — weekly checklist (proteins, veg, carbs, shopping, freezer meals, prep done?).
- **Knowledge Base** — personal wiki for research, PDF summaries, recipes, workout/sleep/nutrition references.
- **Achievements / milestones** — light gamification to reinforce consistency.

---

## 8. Non-functional requirements

- **Low daily friction** — core log ≤ ~60 seconds; optional depth never blocks a quick entry.
- **Mobile-first** — primary use is on a phone; must work well one-handed.
- **Offline-capable** — logging can't depend on a connection.
- **Free / low-cost** — no mandatory subscriptions.
- **Data ownership & privacy** — data stays yours; easy export/backup; nothing sold or shared.
- **Trend-oriented** — the UI should nudge attention to weekly/monthly patterns over daily noise.
- **Extensible** — new pillars, rules, and libraries can be added without a rebuild.

---

## 9. What success looks like

- **Level 1 (habit):** you log most days; walking and morning-protein streaks are visible and growing.
- **Level 2 (insight):** trends and the consistency score make patterns obvious ("sleep quality tanks after late caffeine").
- **Level 3 (system):** the app recommends the *next* thing to improve and tracks roadmap-phase progress — you spend less time deciding and more time doing.

---

## 10. Explicitly out of scope (for now)

Social features, calorie photo-scanning/AI food recognition, wearable auto-sync, multi-user, and anything that adds daily friction before the core habit is established. These are revisited only after Level 1 is solid.
