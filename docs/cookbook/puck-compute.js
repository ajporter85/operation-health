// Recompute every build's 3-cup macros from 1-cup component pucks.
// meal = protein puck (1 cup) + grain puck (1 cup) + veg/bean puck (1 cup) + sauce (2 Tbsp) [+ extras]
// All per-1-cup-cooked estimates from standard values (±10-15%, as the cards note).

const M = (kcal, protein, carbs, fiber, fat) => ({ kcal, protein, carbs, fiber, fat });
const add = (...xs) => xs.reduce((a, b) => M(a.kcal + b.kcal, a.protein + b.protein, a.carbs + b.carbs, a.fiber + b.fiber, a.fat + b.fat), M(0,0,0,0,0));
const round = m => M(Math.round(m.kcal/5)*5, Math.round(m.protein), Math.round(m.carbs), Math.round(m.fiber), Math.round(m.fat));

// --- PROTEIN pucks (1 cup cooked) ---
const P = {
  chicken:    M(230, 43, 0, 0, 5),   // breast: grilled/roasted/shredded/pulled/BBQ/ranch
  beef:       M(250, 37, 0, 0, 11),  // 93/7 ground or patty
  turkey:     M(220, 40, 0, 0, 9),   // 93/7 ground
  turkeyBrst: M(190, 40, 0, 0, 3),   // smoked breast
  steak:      M(240, 39, 0, 0, 9),   // sirloin/flank, lean
  brisket:    M(300, 34, 0, 0, 18),  // lean brisket
  pork:       M(280, 34, 2, 0, 15),  // lean pulled pork
  chorizo:    M(300, 28, 2, 0, 20),  // chicken chorizo
  sausage:    M(250, 28, 4, 0, 15),  // italian chicken sausage
  meatballs:  M(250, 33, 8, 1, 11),  // turkey meatballs (breadcrumb)
  parmChx:    M(300, 44, 11, 1, 10), // breaded baked parm chicken
  tofu:       M(200, 20, 5, 1, 12),  // firm tofu, roasted/buffalo
  tempeh:     M(320, 31, 16, 7, 18),
  lentilBolo: M(230, 18, 36, 15, 3), // lentil + mushroom bolognese
  threeBean:  M(220, 15, 40, 15, 1), // mixed beans as the protein
  bbBurger:   M(230, 15, 32, 10, 7), // black bean burger patty
};

// --- GRAIN pucks (1 cup cooked) ---
const G = {
  quinoa:   M(222, 8, 39, 5, 4),
  brownrice:M(218, 5, 46, 4, 2),
  potato:   M(180, 4, 33, 4, 4),   // roasted, some oil
  pasta:    M(180, 7, 37, 5, 1),   // whole-wheat
};

// --- VEG/BEAN pucks (1 cup of that meal's roasted veg + beans) ---
const V = {
  sw:      M(180, 9, 31, 9, 4),   // black beans + chickpeas + sweet potato + peppers + corn
  bbq:     M(110, 4, 23, 6, 3),   // sweet potato + broccoli + carrots + corn (no beans)
  bbqBean: M(150, 8, 26, 8, 3),   // + white beans (tempeh build)
  loaded:  M(70, 4, 12, 5, 3),    // broccoli + peppers + cauliflower (no beans)
  loadBean:M(150, 9, 23, 9, 3),   // + white beans (buffalo tofu)
  loadChili:M(150, 9, 24, 9, 2),  // chili beans (chili-cheese)
  burger:  M(130, 8, 22, 8, 2),   // mushrooms + onions + white beans
  burgEdam:M(170, 11, 15, 7, 7),  // + edamame instead of white beans
  ital:    M(140, 8, 24, 8, 2),   // zucchini + peppers + white beans
  italAlf: M(150, 9, 22, 8, 2),   // broccoli + peas + white beans
  chili:   M(150, 8, 27, 9, 2),   // black beans + corn + peppers
  chiliDbl:M(185, 11, 33, 12, 2), // black + pinto (smoky chipotle)
  chiliWht:M(140, 8, 24, 8, 2),   // white beans + corn + peppers
  chili3:  M(220, 15, 40, 15, 1), // extra beans (three-bean second cup)
  chiliPin:M(150, 8, 27, 9, 2),   // pinto + corn + peppers
};

// --- SAUCE (2 Tbsp) archetypes ---
const S = {
  crema:   M(60, 2, 3, 1, 5),
  bbq:     M(50, 0, 12, 0, 0),
  ranch:   M(50, 2, 3, 0, 3),
  special: M(70, 3, 4, 1, 5),   // burger special / cheese sauce
  marinara:M(40, 1, 6, 1, 1),
  pesto:   M(120, 2, 2, 1, 12),
  alfredo: M(60, 5, 3, 0, 3),
  redchili:M(40, 1, 7, 1, 1),
};

// extras
const X = {
  cheeseBacon: M(190, 14, 2, 0, 13),
  cheddar:     M(110, 7, 1, 0, 9),
  bacon:        M(80, 6, 0, 0, 6),
  mozz:         M(70, 6, 1, 0, 5),
  pepitas:      M(50, 2, 3, 2, 4),
};

// --- BUILDS: [meal, name, proteinPuck, grainPuck, vegPuck, sauce, ...extras] ---
const B = [
  ["SW","Fajita Chicken", P.chicken, G.quinoa, V.sw, S.crema],
  ["SW","Steak Fajita", P.steak, G.quinoa, V.sw, S.crema],
  ["SW","Taco Turkey", P.turkey, G.quinoa, V.sw, S.crema],
  ["SW","Smoky Pulled Chicken", P.chicken, G.quinoa, V.sw, S.crema],
  ["SW","Plant-Powered", P.tofu, G.quinoa, add(V.sw, X.pepitas), S.crema],
  ["SW","Cilantro-Lime Rice", P.chicken, G.brownrice, V.sw, S.crema],

  ["BBQ","BBQ Chicken", P.chicken, G.brownrice, V.bbq, S.bbq],
  ["BBQ","Smoked Turkey", P.turkeyBrst, G.brownrice, V.bbq, S.bbq],
  ["BBQ","Pulled Pork", P.pork, G.brownrice, V.bbq, S.bbq],
  ["BBQ","Brisket", P.brisket, G.brownrice, V.bbq, S.bbq],
  ["BBQ","BBQ Tempeh", P.tempeh, G.brownrice, V.bbqBean, S.bbq],
  ["BBQ","Alabama White", P.chicken, G.brownrice, V.bbq, S.ranch],

  ["LOAD","Ranch Chicken", P.chicken, G.potato, V.loaded, S.ranch],
  ["LOAD","Turkey Ranch", P.turkey, G.potato, V.loaded, S.ranch],
  ["LOAD","Cheese & Bacon", P.chicken, G.potato, V.loaded, S.ranch, X.cheeseBacon],
  ["LOAD","Chili Cheese", P.turkey, G.potato, V.loadChili, S.ranch, X.cheddar],
  ["LOAD","Buffalo Tofu", P.tofu, G.potato, V.loadBean, S.ranch],
  ["LOAD","Broccoli-Cheddar", P.chicken, G.potato, V.loaded, S.ranch, X.cheddar],

  ["BURG","Cheeseburger", P.beef, G.potato, V.burger, S.special],
  ["BURG","Turkey Burger", P.turkey, G.potato, V.burger, S.special],
  ["BURG","Western BBQ", P.beef, G.potato, V.burger, S.bbq],
  ["BURG","Bacon Cheeseburger", P.beef, G.potato, V.burger, S.special, X.bacon],
  ["BURG","Black Bean Burger", P.bbBurger, G.potato, V.burgEdam, S.special],
  ["BURG","Patty Melt", P.beef, G.potato, V.burger, S.special],

  ["ITAL","Chicken Parm", P.parmChx, G.pasta, V.ital, S.marinara, X.mozz],
  ["ITAL","Turkey Meatball", P.meatballs, G.pasta, V.ital, S.marinara],
  ["ITAL","Sausage & Peppers", P.sausage, G.pasta, V.ital, S.marinara],
  ["ITAL","Pesto Chicken", P.chicken, G.pasta, V.ital, S.pesto],
  ["ITAL","Lentil Bolognese", P.lentilBolo, G.pasta, V.ital, S.marinara],
  ["ITAL","Chicken Alfredo Primavera", P.chicken, G.pasta, V.italAlf, S.alfredo],

  ["CHILI","Classic Beef Chili", P.beef, G.brownrice, V.chili, S.redchili],
  ["CHILI","Turkey Chili", P.turkey, G.brownrice, V.chili, S.redchili],
  ["CHILI","Smoky Chipotle Beef", P.beef, G.brownrice, V.chiliDbl, S.redchili],
  ["CHILI","White Chicken Chili", P.chicken, G.brownrice, V.chiliWht, S.redchili],
  ["CHILI","Three-Bean Vegetarian", P.threeBean, G.brownrice, V.chili3, S.redchili],
  ["CHILI","Chorizo & Pinto", P.chorizo, G.brownrice, V.chiliPin, S.redchili],
];

// build RESULT keyed by build name -> { macros total, pucks: {protein,grain,veg,sauce} }
const RESULT = {};
B.forEach(row => {
  const [mn, name, ...parts] = row;
  const extras = parts.slice(4);
  RESULT[name] = {
    macros: round(add(...parts)),
    pucks: {
      protein: round(add(parts[0], ...extras)),
      grain: round(parts[1]),
      veg: round(parts[2]),
      sauce: round(parts[3]),
    }
  };
});

const fs = require("fs");
const WRITE = process.argv.includes("--write");

const MEALS = {
  "southwest-hybrid-bowl.html": { grainRe: /quinoa/i, bc: "~17 g protein & ~14 g fiber before you add your protein" },
  "bbq-power-bowl.html":        { grainRe: /brown rice/i, bc: "~9 g protein & ~10 g fiber before you add your protein" },
  "loaded-potato-bowl.html":    { grainRe: /roasted potato/i, bc: "~8 g protein & ~9 g fiber before you add your protein" },
  "burger-bowl.html":           { grainRe: /roasted potato/i, bc: "~12 g protein & ~12 g fiber before you add your protein" },
  "italian-bowl.html":          { grainRe: /penne|whole-wheat pasta/i, bc: "~15 g protein & ~13 g fiber before you add your protein" },
  "chili-bowl.html":            { grainRe: /brown rice/i, bc: "~13 g protein & ~13 g fiber before you add your protein" },
};

Object.keys(MEALS).forEach(f => {
  const cfg = MEALS[f];
  const html = fs.readFileSync(f, "utf8");
  const m = html.match(/(<script type="application\/json" id="meal-data">)([\s\S]*?)(<\/script>)/);
  const d = JSON.parse(m[2]);
  console.log("\n=== " + f + " ===");
  d.reheatMin = [6, 9];
  d.baseContribution = cfg.bc;

  function bumpGrain(baseArr) {
    (baseArr || []).forEach(b => { if (cfg.grainRe.test(b.item) && !/sweet/i.test(b.item)) b.amt = "1 cup"; });
  }
  bumpGrain(d.defaults.base);

  d.variations.forEach(v => {
    const r = RESULT[v.name];
    if (!r) { console.log("  !! NO RESULT for " + v.name); return; }
    const grainItem = (v.overrides && v.overrides.base || d.defaults.base).find(b => cfg.grainRe.test(b.item) && !/sweet/i.test(b.item));
    const sauce = d.sauces[v.sauceId || d.defaults.sauceId];
    v.macros = r.macros;
    v.pucks = {
      protein: { label: v.protein.name, macros: r.pucks.protein },
      grain: { label: grainItem ? grainItem.item : d.grain, macros: r.pucks.grain },
      veg: { label: "Roasted veg & beans", macros: r.pucks.veg },
      sauce: { label: sauce.name, macros: r.pucks.sauce },
    };
    if (v.overrides && v.overrides.base) bumpGrain(v.overrides.base);
    console.log("  " + v.name.padEnd(26) + JSON.stringify(v.macros));
  });

  if (WRITE) {
    fs.writeFileSync(f, html.replace(m[0], m[1] + "\n" + JSON.stringify(d, null, 2) + "\n" + m[3]));
    console.log("  WRITTEN");
  }
});
console.log(WRITE ? "\n(written)" : "\n(dry run — pass --write to apply)");
