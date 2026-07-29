// Burger Bowl: make every Build & Shop ingredient traceable to a prep step.
//
// The shared "Seasoning & staples" card is a theme-wide union, so each build
// shows seasonings only *other* builds' sauces use (Big Mac shows Dijon and
// apple cider vinegar; it uses neither) — while yellow mustard, which
// burger-sauce genuinely needs, was on no list at all and couldn't be bought.
//
// Fix is data-only: sauce-owned seasonings move into that sauce's own `shop`
// array, which the renderer already prints under the Sauce card. The shared
// staples list keeps only what the shared steps (potatoes / veg / protein) use.
// Run: node fix-seasoning-ownership.js && node build-hub.js
const fs = require("fs");

const FILE = "burger-bowl.html";
const html = fs.readFileSync(FILE, "utf8");
const m = html.match(/(<script type="application\/json" id="meal-data">)([\s\S]*?)(<\/script>)/);
const d = JSON.parse(m[2]);
const log = [];

// what the shared prep steps actually call for: oil + garlic powder + salt
// (potatoes), Worcestershire (veg), salt & pepper (protein methods)
const SHARED = ["Olive oil", "Garlic powder", "Worcestershire", "Salt", "Black pepper"];

// seasonings each sauce needs, read off its own recipe text
const SAUCE_SEASONING = {
  "burger-sauce":  [{ item: "Yellow mustard", amt: "small bottle" },
                    { item: "Smoked paprika", amt: "" }],
  "cheese-sauce":  [{ item: "Dijon mustard", amt: "" },
                    { item: "Smoked paprika", amt: "" },
                    { item: "Lemon", amt: "1" }],
  "western-bbq":   [{ item: "Apple cider vinegar", amt: "" },
                    { item: "Smoked paprika", amt: "" },
                    { item: "Onion powder", amt: "" }],
  "big-mac-sauce": [{ item: "Paprika", amt: "" },
                    { item: "Onion powder", amt: "" }],
};

Object.entries(SAUCE_SEASONING).forEach(([id, adds]) => {
  const s = d.sauces[id];
  if (!s) { console.error("missing sauce " + id); process.exit(1); }
  adds.forEach(a => {
    if (s.shop.some(x => x.item.toLowerCase() === a.item.toLowerCase())) return;
    s.shop.push({ item: a.item, amt: a.amt, group: "pantry" });
    log.push(id + ": + " + a.item);
  });
});

// trim the shared list down to genuinely shared staples
const dropped = d.defaults.shopping.seasoning.filter(s => SHARED.indexOf(s) < 0);
if (dropped.length) {
  d.defaults.shopping.seasoning = SHARED.slice();
  log.push("staples: - " + dropped.join(", ") + " (now owned by the sauces that use them)");
}

// "Mayonnaise" on the ingredient list vs. "mayo" in the recipe prose
const bm = d.sauces["big-mac-sauce"];
if (/2 Tbsp mayo,/.test(bm.recipe)) {
  bm.recipe = bm.recipe.replace("2 Tbsp mayo,", "2 Tbsp mayonnaise,");
  log.push("big-mac-sauce: recipe says \"mayonnaise\", matching the ingredient list");
}

if (!log.length) { console.log("nothing to do — already applied"); process.exit(0); }
fs.writeFileSync(FILE, html.replace(m[0], m[1] + "\n" + JSON.stringify(d, null, 2) + "\n" + m[3]));
log.forEach(l => console.log("  " + l));
console.log("\nwrote " + FILE + " — now run: node build-hub.js");
