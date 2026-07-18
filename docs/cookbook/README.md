# Operation Health — Meal Library (Cookbook)

Interactive, printable recipe cards for the freezer meal-prep system
(Base + Protein + Vegetables + Sauce + Fresh Toppings → 2-cup Souper Cube meals).

Each card is a **single self-contained HTML file** (no build step, no dependencies —
same zero-dependency stance as the app). Open it in a browser or print to PDF.

## How a card works

- **Pick Your Build** tabs at the top drive the whole card: choosing a variation
  repaints the Build grid, Prep workflow, Souper Cube fill, Nutrition, and Shopping
  list to match that build (protein, sauce, macros, and shopping all follow the
  selection — the shopping list is exact per build, no phantom ingredients).
- Sections are collapsible; everything prints expanded.

## The data model (`#meal-data`)

The entire card renders from a single embedded JSON island, `#meal-data`. That JSON
is the **canonical meal model** — components (with weights), sauces, per-variation
macros, mold plan, prep steps, and a per-build shopping list. The render engine is
generic; **a new theme is just a new JSON payload** (title/theme + `#meal-data`).

This is deliberate: the ProjectHealth app's **Meal Library** can parse the same JSON
to import each variation as a preset (macros baked in) with no re-keying — the V2 path.

Macros are **estimated** from standard per-ingredient values (~±10–15%, labeled on
the card). A food-database/API is the planned V2 accuracy upgrade.

Sauces carry a `freezes` flag: freezable sauces (tomato BBQ, cashew, mustard) get
portioned into 2-Tbsp molds; sauces that split/brown frozen (avocado crema,
mayo-based Alabama white) are flagged fridge-only and made fresh.

## Cards

- `southwest-hybrid-bowl.html` — Theme 01, Southwest / Tex-Mex (6 builds)
- `bbq-power-bowl.html` — Theme 02, BBQ Power Bowl (6 builds)
- `loaded-potato-bowl.html` — Theme 03, Loaded Potato Bowl (6 builds)
- `burger-bowl.html` — Theme 04, Burger Bowl (6 builds)
- `italian-bowl.html` — Theme 05, Italian Bowl (6 builds)

Planned: Chili.
