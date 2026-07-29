// validate-ingredients.js — Build & Shop <-> Prep Workflow consistency check.
//
// Two directions, per build, per card:
//   SHOWN-NOT-PREPPED  an ingredient the Build & Shop section displays that no
//                      prep step ever mentions (e.g. Dijon on a build whose
//                      sauce doesn't use it)
//   NOT-BUYABLE        a per-meal ingredient with no line on any shopping list
//                      (e.g. yellow mustard, which burger-sauce needs and
//                      nothing sold)
//
// It replays the card's own renderBuildShop bucket logic and renderPrep step
// assembly, so it checks what actually reaches the screen, not just the JSON.
//
// Known-and-accepted wording variance lives in ingredient-baseline.json.
// Anything not in the baseline fails the run.
//
//   node validate-ingredients.js                     validate all six cards
//   node validate-ingredients.js burger-bowl.html    one card
//   node validate-ingredients.js --update-baseline   re-record current state
const fs = require("fs");

const ALL_CARDS = [
  "southwest-hybrid-bowl.html", "bbq-power-bowl.html", "loaded-potato-bowl.html",
  "burger-bowl.html", "italian-bowl.html", "chili-bowl.html",
];
const BASELINE = "ingredient-baseline.json";

const args = process.argv.slice(2);
const UPDATE = args.includes("--update-baseline");
const cards = args.filter(a => !a.startsWith("--"));
const CARDS = cards.length ? cards : ALL_CARDS;

// words carrying no ingredient identity
const STOP = new Set(["optional", "extra", "topping", "small", "large", "your", "and",
  "the", "for", "with", "sauce", "powder", "each", "cup", "cups", "can", "cans", "jar",
  "tub", "bottle", "head", "slices", "slice", "opt", "style", "water"]);

// qualifiers recipe prose routinely drops: the card says "Olive oil", the step
// says "1 Tbsp oil". Stripped for the mention check ONLY — the buyability check
// needs them, or "Yellow mustard" would match a "Dijon mustard" shopping line.
const QUALIFIER = new Set(["olive", "black", "yellow", "frozen", "fresh", "dried",
  "ground", "raw", "lean", "part", "skim", "center", "cut", "whole", "wheat", "apple",
  "extra", "firm", "crushed", "red", "green", "sweet", "white", "baby", "flat", "leaf"]);

// cooking-state adjectives: "Roasted potatoes" is bought as "Potatoes"
const COOK = /^(roast|saut|caramel|griddl|grill|sear|cook|fri|melt|shred|dice|chopp?|charr|pickl|smash|crumbl)/;

const stem = w => w.replace(/(ies)$/, "y").replace(/(ed|es|ing|s)$/, "");

function keys(s, opts) {
  opts = opts || {};
  let ws = String(s).toLowerCase()
    .replace(/\(.*?\)/g, " ").replace(/[^a-z\s-]/g, " ")
    .split(/[\s-]+/).filter(w => w.length > 2 && !STOP.has(w));
  if (opts.dropQualifiers) ws = ws.filter(w => !QUALIFIER.has(w));
  if (opts.dropCooked) ws = ws.filter(w => !COOK.test(w));
  const out = ws.map(stem).filter(Boolean);
  return out;
}

function auditCard(file) {
  const M = JSON.parse(fs.readFileSync(file, "utf8").match(/id="meal-data">([\s\S]*?)<\/script>/)[1]);
  const rows = [];
  const d = M.defaults.shopping;

  M.variations.forEach(v => {
    const sauce = M.sauces[v.sauceId || M.defaults.sauceId];
    const base = (v.overrides && v.overrides.base) ? v.overrides.base : M.defaults.base;
    const fresh = v.fresh || M.defaults.fresh;
    const shop = v.shopping || {};

    // ---- what Build & Shop puts on screen ----
    const shown = [];
    base.forEach(b => shown.push(["base", b.item]));
    sauce.items.forEach(i => shown.push(["sauce", i.item]));
    fresh.forEach(f => shown.push(["fresh", f]));
    if (shop.protein) shown.push(["buy", shop.protein.item]);
    // fresh toppings this build drops aren't shown, so they aren't its problem
    const skipFresh = (shop.skipFresh || []).map(s => s.toLowerCase());
    [].concat(d.produce, d.pantry, shop.produceAdd || [], shop.pantryAdd || [], sauce.shop || [])
      .filter(x => skipFresh.indexOf(String(x.item).toLowerCase()) < 0)
      .forEach(x => shown.push(["shop", x.item]));
    d.seasoning.forEach(s => shown.push(["staple", s]));

    // ---- what the Prep Workflow says, across both modes ----
    const prepText = M.prep.map(st => {
      const ov = (v.prepOverrides || {})[st.id] || {};
      if (st.kind === "grain") return [ov.p || st.p, st.pRice, ov.tip || st.tip].join(" ");
      if (st.kind === "protein") return [v.protein.method, v.protein.name, v.protein.serving, v.protein.tip].join(" ");
      if (st.kind === "sauce") return [sauce.recipe, sauce.name].join(" ");
      return [ov.h || st.h, ov.p || st.p, ov.tip || st.tip].join(" ");
    }).concat(fresh.filter(f => !/^optional/i.test(f))).join(" ").toLowerCase();

    const seen = new Set();
    shown.forEach(([where, item]) => {
      const k = where + "|" + item;
      if (seen.has(k)) return;
      seen.add(k);
      const ks = keys(item, { dropQualifiers: true });
      if (!ks.length) return;
      if (!ks.every(w => prepText.indexOf(w) >= 0)) {
        rows.push({ card: file, build: v.name, kind: "SHOWN-NOT-PREPPED", item });
      }
    });

    // ---- reverse: is every per-meal ingredient buyable? ----
    // matched per shopping line, not against one concatenated blob
    const buyLines = [].concat(
      shop.protein ? [shop.protein.item] : [], d.produce.map(x => x.item), d.pantry.map(x => x.item),
      (shop.produceAdd || []).map(x => x.item), (shop.pantryAdd || []).map(x => x.item),
      (sauce.shop || []).map(x => x.item), d.seasoning
    ).map(s => keys(s));
    sauce.items.concat(base).forEach(i => {
      String(i.item).split(/\s*[+,]\s*/).forEach(part => {
        const ks = keys(part, { dropCooked: true });
        if (!ks.length) return;
        const ok = buyLines.some(line => ks.every(w => line.some(b => b.indexOf(w) >= 0 || w.indexOf(b) >= 0)));
        if (!ok) rows.push({ card: file, build: v.name, kind: "NOT-BUYABLE", item: part });
      });
    });
  });
  return rows;
}

const sig = r => [r.card, r.build, r.kind, r.item].join(" :: ");

let found = [];
CARDS.forEach(f => { found = found.concat(auditCard(f)); });
// the same item can be reported from two buckets (base list + shopping line)
const uniq = new Map();
found.forEach(r => { if (!uniq.has(sig(r))) uniq.set(sig(r), r); });
found = [...uniq.values()];

const NOTE = [
  "accepted = wording variance only: the Build & Shop label and the prep prose",
  "  name the same thing differently (card says 'Caramelized onions', step says",
  "  'deeply browned'). Safe to keep.",
  "deferred = REAL content gaps, parked for a later per-card pass. These are bugs.",
  "  Burn this list down; do not let it grow. A genuine missing ingredient must",
  "  never be moved into 'accepted'.",
];

function readBaseline() {
  if (!fs.existsSync(BASELINE)) return { accepted: [], deferred: [] };
  const b = JSON.parse(fs.readFileSync(BASELINE, "utf8"));
  return { accepted: b.accepted || [], deferred: b.deferred || [] };
}

if (UPDATE) {
  const prev = readBaseline();
  const scanned = new Set(CARDS);
  const untouched = k => prev[k].filter(s => !scanned.has(s.split(" :: ")[0]));
  // keep entries for cards we didn't scan; re-record the ones we did
  const keepAcc = untouched("accepted"), keepDef = untouched("deferred");
  const known = new Set([...prev.accepted, ...prev.deferred]);
  const scannedSigs = found.map(sig);
  const acc = scannedSigs.filter(s => prev.accepted.includes(s));
  const def = scannedSigs.filter(s => !known.has(s) || prev.deferred.includes(s));
  fs.writeFileSync(BASELINE, JSON.stringify({
    note: NOTE,
    accepted: [...new Set(keepAcc.concat(acc))].sort(),
    deferred: [...new Set(keepDef.concat(def))].sort(),
  }, null, 2) + "\n");
  console.log("baseline updated — accepted: " + (keepAcc.length + acc.length) +
              ", deferred: " + (keepDef.length + def.length));
  process.exit(0);
}

const b = readBaseline();
const baseline = new Set([...b.accepted, ...b.deferred]);

const fresh = found.filter(r => !baseline.has(sig(r)));
const stale = [...baseline].filter(s => !found.some(r => sig(r) === s) &&
  CARDS.some(c => s.startsWith(c + " ::")));

if (fresh.length) {
  console.log("\nNEW ingredient gaps (not in baseline):\n");
  let card = "";
  fresh.forEach(r => {
    if (r.card !== card) { card = r.card; console.log("  " + card); }
    console.log("    [" + r.kind + "] " + r.build + " — " + r.item);
  });
}
if (stale.length) {
  console.log("\nSTALE baseline entries (fixed — rerun with --update-baseline):");
  stale.forEach(s => console.log("    " + s));
}
if (!fresh.length && !stale.length) {
  const def = b.deferred.filter(s => CARDS.some(c => s.startsWith(c + " :: "))).length;
  console.log("INGREDIENTS ALL PASS (" + found.length + " baselined" +
              (def ? ", of which " + def + " are DEFERRED REAL GAPS still to fix" : "") + ")");
}
process.exit(fresh.length ? 1 : 0);
