// One-shot: data-level corrections to the Burger Bowl's Big Mac build.
// Everything here is content in the #meal-data island — no renderer changes.
// After running: `node build-hub.js` to push the island into meal-library.html.
//
//  1. Big Mac buys no white beans at all, despite 2/3 cup per meal (~2 cans for 4).
//  2. Big Mac uses 1/3 cup onion per meal but buys no extra (cf. Patty Melt).
//  3. White vinegar is in the sauce recipe text but not its ingredient list,
//     and shops as a "staple" instead of alongside the sauce.
//  4. The shared veg step hard-codes "a can" of beans — wrong for this build.
//  5. The Big Mac method is the only beef build with no doneness temp.
//  6. The sauce's 30-min chill is invisible in the step chip.
//  7. Swaps & Boosts still names one mushroom-free build; there are two.
const fs = require("fs");

const FILE = "burger-bowl.html";
const html = fs.readFileSync(FILE, "utf8");
const m = html.match(/(<script type="application\/json" id="meal-data">)([\s\S]*?)(<\/script>)/);
const d = JSON.parse(m[2]);

const log = [];
const bigmac = d.variations.find(v => v.id === "big-mac-bowl");
const sauce = d.sauces["big-mac-sauce"];
if (!bigmac || !sauce) { console.error("big-mac build/sauce missing — aborting"); process.exit(1); }

// --- 1. white beans onto the shopping list, at the right count ----------------
// 2/3 cup x 4 meals ~= 2.7 cups drained; a 15 oz can yields ~1.7 cups.
if (!bigmac.shopping.pantryAdd.some(x => /white beans/i.test(x.item))) {
  bigmac.shopping.pantryAdd.unshift({ item: "White beans", amt: "2 cans (15 oz)" });
  log.push("shopping: + White beans, 2 cans (double the default build's 1/3 cup)");
}

// --- 2. the extra onion ------------------------------------------------------
if (!bigmac.shopping.produceAdd.some(x => /onion/i.test(x.item))) {
  bigmac.shopping.produceAdd.push({ item: "Yellow onion", amt: "1 extra" });
  log.push("shopping: + 1 extra yellow onion (1/3 cup per meal vs. the default 1/4)");
}

// --- 3. white vinegar: into the sauce's own ingredient + buy lists ------------
if (!sauce.items.some(x => /vinegar/i.test(x.item))) {
  const mustardAt = sauce.items.findIndex(x => /mustard/i.test(x.item));
  sauce.items.splice(mustardAt + 1, 0, { item: "White vinegar", amt: "1 tsp" });
  log.push("sauce: + white vinegar to the ingredient list (was recipe-text only)");
}
if (!sauce.shop.some(x => /vinegar/i.test(x.item))) {
  sauce.shop.push({ item: "White vinegar", amt: "small bottle", group: "pantry" });
  log.push("sauce: white vinegar now shops with the sauce");
}
// ...and drop the stray "staple" copy that stranded it under Seasoning & staples
const staleVinegar = bigmac.shopping.pantryAdd.findIndex(x => /white vinegar/i.test(x.item));
if (staleVinegar >= 0) {
  bigmac.shopping.pantryAdd.splice(staleVinegar, 1);
  log.push("shopping: - white vinegar from staples (moved to the sauce card)");
}

// --- 4. stop the shared veg step hard-coding the can count --------------------
const vegStep = d.prep.find(s => /mushrooms & onions/i.test(s.h || ""));
if (vegStep && /a can of white beans/i.test(vegStep.p)) {
  vegStep.p = vegStep.p.replace(/Drain & rinse a can of white beans/, "Drain & rinse the white beans");
  log.push('prep: "a can of white beans" -> "the white beans" (count lives on the shopping list)');
}

// --- 5. doneness temp, matching the other beef builds ------------------------
if (!/\d+°F/.test(bigmac.protein.method)) {
  bigmac.protein.method = bigmac.protein.method.replace(
    /griddle hard for a deep crust\./,
    "griddle hard for a deep crust — thin patties hit 160°F fast."
  );
  log.push("protein: + 160°F doneness temp (every other beef build states one)");
}

// --- 6. surface the 30-minute chill -----------------------------------------
if (sauce.tool === "Whisk · 5 min") {
  sauce.tool = "Whisk · 5 min + 30 min chill";
  log.push('sauce: tool chip now reads "+ 30 min chill" (recipe asked for it, chip hid it)');
}

// --- 7. two mushroom-free builds now ----------------------------------------
const subIdx = d.notes.subs.findIndex(s => /mushroom-free Western BBQ build/.test(s));
if (subIdx >= 0) {
  d.notes.subs[subIdx] = d.notes.subs[subIdx].replace(
    "or just pick the mushroom-free Western BBQ build",
    "or just pick a mushroom-free build: Western BBQ or Big Mac Bowl"
  );
  log.push("swaps: mushroom-free line now names both builds");
}

if (!log.length) { console.log("nothing to do — already applied"); process.exit(0); }
fs.writeFileSync(FILE, html.replace(m[0], m[1] + "\n" + JSON.stringify(d, null, 2) + "\n" + m[3]));
log.forEach(l => console.log("  " + l));
console.log("\nwrote " + FILE + " — now run: node build-hub.js");
