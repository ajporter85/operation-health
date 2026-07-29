// Burger Bowl: use the new per-variation renderer hooks (fresh / prepOverrides /
// protein.tip) to fix the builds that don't follow the shared prep steps.
//
//  - Big Mac and Western BBQ are both mushroom-free, yet the shared veg step
//    says "Sauté sliced mushrooms and onions" on every build.
//  - Western BBQ buys bell peppers and puts "Roasted peppers" in the bowl, but
//    no step ever roasts them.
//  - Big Mac's onions are griddled sharp, not caramelized low & slow.
//  - Big Mac inherits "Diced tomato" and unqualified "Pickles" as fresh
//    toppings; a Big Mac has no tomato and its sauce already carries the tang.
//  - The name-regex tip tells you to rest & slice a smashed patty.
// Run: node fix-burger-overrides.js && node build-hub.js
const fs = require("fs");

const FILE = "burger-bowl.html";
const html = fs.readFileSync(FILE, "utf8");
const m = html.match(/(<script type="application\/json" id="meal-data">)([\s\S]*?)(<\/script>)/);
const d = JSON.parse(m[2]);
const log = [];

// the shared veg step needs a stable id for prepOverrides to key off
const veg = d.prep.find(s => /mushrooms & onions/i.test(s.h || ""));
if (!veg) { console.error("veg step not found — aborting"); process.exit(1); }
if (!veg.id) { veg.id = "veg"; log.push('prep: veg step given id "veg" (override key)'); }

const V = id => d.variations.find(x => x.id === id);

// ---------------- Big Mac Bowl ----------------
const bm = V("big-mac-bowl");
if (bm && !bm.prepOverrides) {
  bm.prepOverrides = {
    veg: {
      h: "Griddle the onions",
      p: "Skip the mushrooms on this build. Griddle finely diced onions in 1 tsp oil over " +
         "medium-high just until softened and lightly browned at the edges — you want them " +
         "sharp and oniony, not sweet and jammy, which is what makes a Big Mac taste like " +
         "one. Drain & rinse the white beans (this build uses a full 2/3 cup per meal) and " +
         "fold them in off the heat.",
      chips: [{ t: "Stovetop · 5–6 min" }, { t: "Keep them sharp, not caramelized" }],
      tip: "<b>Cut them small:</b> a fine dice scattered through the bowl reads far more " +
           "Big Mac than big rings do. No Worcestershire here — it pulls the flavour savoury."
    }
  };
  log.push("big-mac: veg step rewritten (no mushrooms, griddled not caramelized, 2/3 cup beans)");
}
if (bm && !bm.fresh) {
  bm.fresh = [
    "Shredded lettuce (pile it on — the crunch is half the Big Mac)",
    "Optional: pickles (the sweet relish in the sauce already carries the tang)",
    "Optional: toasted sesame-bun croutons (~60 kcal)",
    "Optional: extra special sauce"
  ];
  log.push("big-mac: own fresh list (no tomato; croutons + optional pickles surfaced)");
}
if (bm && !bm.protein.tip) {
  bm.protein.tip = "<b>Don't rest these:</b> smashed patties are thin — get the cheese on " +
                   "in the last 30 seconds and chop them straight into the bowl while hot.";
  log.push("big-mac: protein tip (was inheriting \"Rest it: 5 min before slicing\")");
}

// ---------------- Western BBQ ----------------
const wb = V("western-bbq");
if (wb && !wb.prepOverrides) {
  wb.prepOverrides = {
    veg: {
      h: "Roast the peppers & caramelize the onions",
      p: "No mushrooms on this build. Cut 2 bell peppers into strips, toss with 1 tsp oil " +
         "and a pinch of salt, and roast until blistered and sweet. Meanwhile sauté sliced " +
         "onions low & slow until deeply browned and jammy. Drain & rinse the white beans " +
         "and fold everything together.",
      chips: [{ t: "Oven · 425°F · 20–25 min" }, { t: "Air fryer · 400°F · 12–15 min", cls: "fast" },
              { t: "Onions · stovetop · 10–12 min" }],
      tip: "<b>Roast them hard:</b> blistered edges are where the sweetness comes from — " +
           "they stand in for the mushrooms this build drops."
    }
  };
  log.push("western-bbq: veg step rewritten (roasts the peppers it buys; no mushrooms)");
}

if (!log.length) { console.log("nothing to do — already applied"); process.exit(0); }
fs.writeFileSync(FILE, html.replace(m[0], m[1] + "\n" + JSON.stringify(d, null, 2) + "\n" + m[3]));
log.forEach(l => console.log("  " + l));
console.log("\nwrote " + FILE + " — now run: node build-hub.js");
