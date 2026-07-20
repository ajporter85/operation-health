// One-shot: add the Moe's-inspired build + queso sauce to the Southwest island.
// Macros/pucks are left empty here — puck-compute.js fills them from the puck tables.
const fs = require("fs");
const FILE = "southwest-hybrid-bowl.html";

const html = fs.readFileSync(FILE, "utf8");
const m = html.match(/(<script type="application\/json" id="meal-data">)([\s\S]*?)(<\/script>)/);
const d = JSON.parse(m[2]);

if (d.sauces["moes-queso"]) { console.error("already added — aborting"); process.exit(1); }

d.sauces["moes-queso"] = {
  name: "Moe's-style queso",
  tool: "Microwave · 5 min",
  freezes: false,
  recipe: "Cube 8 oz white American cheese (deli counter) into a microwave-safe bowl with 1/3 cup milk. Microwave in 1-minute bursts, whisking after each, about 4–5 min until smooth. Stir in a 4-oz can of diced green chiles, 1–2 chopped pickled jalapeños plus 1 Tbsp of their juice, and a pinch of cumin. Thin with a splash more milk to a pourable queso.",
  items: [
    { item: "White American cheese", amt: "8 oz, cubed" },
    { item: "Milk", amt: "1/3 cup" },
    { item: "Diced green chiles", amt: "4-oz can" },
    { item: "Pickled jalapeños + juice", amt: "1–2 + 1 Tbsp" },
    { item: "Cumin", amt: "pinch" }
  ],
  shop: [
    { item: "White American cheese", amt: "8 oz · deli counter", group: "pantry" },
    { item: "Diced green chiles", amt: "4-oz can", group: "pantry" },
    { item: "Pickled jalapeños", amt: "1 small jar", group: "pantry" },
    { item: "Milk", amt: "small carton", group: "pantry" }
  ]
};

d.variations.push({
  id: "moes-adobo-chicken",
  name: "Moe's Adobo Chicken",
  kind: "remix",
  sauceId: "moes-queso",
  protein: {
    name: "Adobo chicken (white meat)",
    serving: "5 oz / ~140 g cooked",
    method: "Marinate chicken breast in soy sauce, cider vinegar, garlic, smoked paprika, cumin, chili powder, oregano and a pinch of cayenne — 1 hour, or overnight for deeper flavor. Sear hard in a hot skillet, then pour the remaining marinade in, cover, and simmer about 20 min until tender. Rest 5 min, then cube and toss in the pan juices.",
    appliance: ["Marinate 1 hr–overnight", "Skillet · sear + simmer 20 min"]
  },
  overrides: {
    base: [
      { item: "Moe's-style seasoned rice", amt: "1 cup" },
      { item: "Black beans", amt: "1/2 cup" },
      { item: "Fire-grilled peppers & onions", amt: "1/3 cup" },
      { item: "Roasted corn", amt: "1/4 cup" }
    ]
  },
  shopping: {
    protein: { item: "Chicken breast", amt: "~24 oz raw" },
    pantrySwap: { from: "Quinoa", to: { item: "White rice", amt: "1 cup dry" } },
    produceAdd: [],
    pantryAdd: [
      { item: "Soy sauce", amt: "small bottle", group: "staple" },
      { item: "Apple cider vinegar", amt: "small bottle", group: "staple" },
      { item: "Butter", amt: "2 Tbsp", group: "staple" },
      { item: "Tomato sauce", amt: "small can", group: "staple" },
      { item: "Chicken broth", amt: "2 cups", group: "staple" },
      { item: "Onion powder", amt: "", group: "staple" },
      { item: "Cayenne pepper", amt: "", group: "staple" },
      { item: "Dried thyme", amt: "", group: "staple" },
      { item: "Bay leaves", amt: "", group: "staple" }
    ]
  },
  note: "A Moe's Southwest Grill order rebuilt as a cube: adobo-marinated white-meat chicken, buttery seasoned rice, black beans and fire-grilled peppers & onions under white-cheese queso. Sweet potato & chickpeas sit this one out. Queso is the only sauce in the library that won't freeze — make it fresh and pour it on at serving. Queso math: 2 Tbsp = 85 kcal, 4 g protein, 6 g fat — every extra 2 Tbsp adds the same again (1/4 cup = 170 kcal, 1/3 cup = 225 kcal).",
  macros: { kcal: 0, protein: 0, carbs: 0, fiber: 0, fat: 0 }
});

fs.writeFileSync(FILE, html.replace(m[0], m[1] + "\n" + JSON.stringify(d, null, 2) + "\n" + m[3]));
console.log("Added moes-queso sauce + Moe's Adobo Chicken build (" + d.variations.length + " variations now)");
