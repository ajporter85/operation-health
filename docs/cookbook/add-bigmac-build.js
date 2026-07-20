// One-shot: (1) add the brown-rice swap line to Southwest's Swaps & Boosts,
// (2) add the Big Mac-inspired build + special sauce to the Burger Bowl.
// Macros/pucks are filled by puck-compute.js from the puck tables.
const fs = require("fs");

function loadIsland(file) {
  const html = fs.readFileSync(file, "utf8");
  const m = html.match(/(<script type="application\/json" id="meal-data">)([\s\S]*?)(<\/script>)/);
  return { html, m, d: JSON.parse(m[2]) };
}
function saveIsland(file, o) {
  fs.writeFileSync(file, o.html.replace(o.m[0], o.m[1] + "\n" + JSON.stringify(o.d, null, 2) + "\n" + o.m[3]));
}

// ---------- 1. Southwest: brown-rice swap line ----------
const SW = loadIsland("southwest-hybrid-bowl.html");
const swapLine = "Moe's seasoned rice → the same seasoning on brown rice: +3 g fiber for +15 kcal";
if (!SW.d.notes.subs.some(s => /brown rice: \+3 g fiber/.test(s))) {
  SW.d.notes.subs.push(swapLine);
  saveIsland("southwest-hybrid-bowl.html", SW);
  console.log("SW: added brown-rice swap line");
} else console.log("SW: swap line already present");

// ---------- 2. Burger Bowl: Big Mac build ----------
const BG = loadIsland("burger-bowl.html");
if (BG.d.sauces["big-mac-sauce"]) { console.error("big-mac-sauce already present — aborting"); process.exit(1); }

BG.d.sauces["big-mac-sauce"] = {
  name: "Big Mac-style special sauce",
  tool: "Whisk · 5 min",
  freezes: false,
  recipe: "Whisk 1/4 cup Greek yogurt with 2 Tbsp mayo, 2 Tbsp sweet pickle relish, 1 Tbsp yellow mustard, 1 tsp white vinegar, and 1/2 tsp each onion powder, garlic powder and paprika. Chill 30 min so it thickens and the flavors marry. Note the two giveaways vs. a normal burger sauce: sweet relish, not dill, and no ketchup.",
  items: [
    { item: "Greek yogurt", amt: "1/4 cup" },
    { item: "Mayonnaise", amt: "2 Tbsp" },
    { item: "Sweet pickle relish", amt: "2 Tbsp" },
    { item: "Yellow mustard", amt: "1 Tbsp" },
    { item: "Onion + garlic powder, paprika", amt: "1/2 tsp each" }
  ],
  shop: [
    { item: "Sweet pickle relish", amt: "small jar", group: "pantry" },
    { item: "Mayonnaise", amt: "small jar", group: "pantry" },
    { item: "Yellow mustard", amt: "small bottle", group: "pantry" },
    { item: "Greek yogurt", amt: "small tub", group: "pantry" }
  ]
};

BG.d.variations.push({
  id: "big-mac-bowl",
  name: "Big Mac Bowl",
  kind: "remix",
  sauceId: "big-mac-sauce",
  protein: {
    name: "Smashed beef patties + American cheese",
    serving: "5 oz / ~140 g cooked",
    method: "Press 93/7 beef into thin smashed patties, season with just salt and pepper (that's all McDonald's uses), and griddle hard for a deep crust. Lay American cheese over the patties in the last 30 seconds to melt, then chop into bite-size pieces so every forkful gets crust, cheese and sauce.",
    appliance: ["Cast-iron / griddle · 6–8 min", "Air fryer · 400°F · 8 min"]
  },
  overrides: {
    base: [
      { item: "Roasted potatoes", amt: "1 cup" },
      { item: "Griddled onions", amt: "1/3 cup" },
      { item: "White beans", amt: "2/3 cup" }
    ]
  },
  shopping: {
    protein: { item: "Lean ground beef 93/7", amt: "~20 oz" },
    produceAdd: [],
    pantryAdd: [
      { item: "American cheese", amt: "4 slices", group: "protein" },
      { item: "White vinegar", amt: "small bottle", group: "staple" }
    ]
  },
  note: "A Big Mac, rebuilt as a bowl: smashed beef with melted American cheese, crispy potatoes standing in for the fries, griddled onions and white beans, under a proper special sauce. The mushrooms sit this one out. Two giveaways make the sauce taste right — sweet relish (not dill) and no ketchup — and like all mayo/yogurt sauces it won't freeze, so make it fresh. Pile shredded lettuce on at serving; that crunch is half the Big Mac. Pickles are optional: the sweet relish in the sauce already carries the tang. Optional and very on-theme: toast half a sesame bun into croutons and scatter them on at serving (~60 kcal) for the club-bun crunch."
});

saveIsland("burger-bowl.html", BG);
console.log("BURG: added big-mac-sauce + Big Mac Bowl (" + BG.d.variations.length + " variations now)");
