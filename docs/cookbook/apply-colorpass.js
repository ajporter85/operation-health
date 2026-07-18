// Color-semantics pass for the meal cards.
// Legend: chipotle = structure/selection · green(cactus) = freezer + goal pills ·
//         amber(corn) = keep-fresh caution · neutral = plain info ·
//         macro key (labeled): carb=gold, protein=red, fat=brown, fiber=teal.
const fs = require("fs");
const file = process.argv[2];
if (!file) { console.error("usage: node apply-colorpass.js <file.html>"); process.exit(1); }
let s = fs.readFileSync(file, "utf8");
let failures = [];

function sub(label, oldStr, newStr, expect) {
  const n = s.split(oldStr).length - 1;
  if (n !== expect) { failures.push(label + ": found " + n + " expected " + expect); return; }
  s = s.split(oldStr).join(newStr);
}

// --- R1 macro key CSS vars (light appears 2x, dark 2x) ---
sub("macro-light",
  `--macro-protein: #3F6B48; --macro-carb: #C88A1E; --macro-fat: #B8431F;`,
  `--macro-carb: #C88A1E; --macro-protein: #B8431F; --macro-fat: #8C6239; --macro-fiber: #2E7D74;`, 2);
sub("macro-dark",
  `--macro-protein: #83B889; --macro-carb: #E7B34E; --macro-fat: #EC7A50;`,
  `--macro-carb: #E7B34E; --macro-protein: #EC7A50; --macro-fat: #C79A5E; --macro-fiber: #5FB3A8;`, 2);

// --- R2 tab macro render: two lines, full macro key ---
sub("tab-macro-render",
  `        '<span class="tmac">' + v.macros.kcal + " kcal · " + v.macros.protein + "g P · " + v.macros.fat + "g F · " + '<span class="tfib">' + v.macros.fiber + "g fiber</span></span>" +`,
  `        '<span class="tmac"><span class="mc carb">' + v.macros.carbs + 'g C</span> · <span class="mc prot">' + v.macros.protein + 'g P</span> · <span class="mc fat">' + v.macros.fat + 'g F</span></span>' +\n        '<span class="tmac tsub"><span class="mc fib">' + v.macros.fiber + 'g fiber</span> · ' + v.macros.kcal + ' kcal</span>' +`, 1);

// --- R3 tab macro CSS + macro utility classes ---
sub("tab-macro-css",
  `  .tab .tmac { font-family: var(--font-mono); font-size: 12.5px; line-height: 1.4; color: var(--ink-2); font-variant-numeric: tabular-nums; }\n  .tab .tfib { color: var(--cactus-deep); font-weight: 700; }`,
  `  .tab .tmac { font-family: var(--font-mono); font-size: 13.5px; line-height: 1.5; color: var(--ink-2); font-variant-numeric: tabular-nums; }\n  .tab .tmac.tsub { font-size: 12.5px; margin-top: -1px; }\n  .mc { font-weight: 700; }\n  .mc.carb { color: var(--macro-carb); } .mc.prot { color: var(--macro-protein); } .mc.fat { color: var(--macro-fat); } .mc.fib { color: var(--macro-fiber); }`, 1);

// --- R4 REMIX/PLANT badge -> neutral ---
sub("tkind-neutral",
  `  .tab .tkind { justify-self: start; font-family: var(--font-ui); font-size: 10px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; color: var(--cactus-deep); border: 1px solid var(--line-strong); border-radius: 5px; padding: 1.5px 7px; }`,
  `  .tab .tkind { justify-self: start; font-family: var(--font-ui); font-size: 10px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; color: var(--ink-3); border: 1px solid var(--line-strong); border-radius: 5px; padding: 1.5px 7px; }`, 1);

// --- R5 component number badges -> uniform (all chipotle); selection lives only on the tab ---
sub("num-g-uniform", `  .num.g { background: var(--cactus); }`, `  .num.g { background: var(--chipotle); }`, 1);
// neutralize the "picked" protein card so it no longer mimics the selected/active tab
sub("picked-neutral",
  `  .picked { background: color-mix(in srgb, var(--chipotle) 8%, var(--surface)); border-color: color-mix(in srgb, var(--chipotle) 30%, var(--line)); }`,
  `  .picked { background: var(--surface); border-color: var(--line); }`, 1);
sub("pname-neutral",
  `  .picked-protein .pname { font-family: var(--font-display); font-weight: 800; text-transform: uppercase; font-size: 19px; color: var(--chipotle-deep); line-height: 1.1; }`,
  `  .picked-protein .pname { font-family: var(--font-display); font-weight: 800; text-transform: uppercase; font-size: 19px; color: var(--ink); line-height: 1.1; }`, 1);

// --- R6 tips -> neutral aside ---
sub("tip-neutral",
  `  .step .tip { margin-top: 8px; font-family: var(--font-ui); font-size: 13.5px; color: var(--cactus-deep); line-height: 1.45; }\n  .step .tip b { text-transform: uppercase; letter-spacing: .04em; font-size: 12px; }\n  @media (prefers-color-scheme: dark){ .step .tip { color: var(--cactus); } }\n  :root[data-theme="dark"] .step .tip { color: var(--cactus); }`,
  `  .step .tip { margin-top: 8px; font-family: var(--font-ui); font-size: 13.5px; color: var(--ink-3); line-height: 1.45; }\n  .step .tip b { text-transform: uppercase; letter-spacing: .04em; font-size: 12px; color: var(--ink-2); }`, 1);

// --- R7 chips: green now = freezer only (rename .fast -> .freezes); method chips go neutral ---
sub("chip-freezes",
  `  .chip.fast { border-color: color-mix(in srgb, var(--cactus) 45%, var(--line)); color: var(--cactus-deep); }\n  .chip.warn { border-color: color-mix(in srgb, var(--corn) 55%, var(--line)); color: var(--corn); }\n  @media (prefers-color-scheme: dark){ .chip.fast { color: var(--cactus); } }\n  :root[data-theme="dark"] .chip.fast { color: var(--cactus); }`,
  `  .chip.freezes { border-color: color-mix(in srgb, var(--cactus) 45%, var(--line)); color: var(--cactus-deep); }\n  .chip.warn { border-color: color-mix(in srgb, var(--corn) 55%, var(--line)); color: var(--corn); }\n  @media (prefers-color-scheme: dark){ .chip.freezes { color: var(--cactus); } }\n  :root[data-theme="dark"] .chip.freezes { color: var(--cactus); }`, 1);

// --- R8 JS: method appliance chips neutral; freeze chip uses .freezes ---
sub("protein-chips-neutral",
  `          chips: v.protein.appliance.map(function (a) { return chip(a, /slow cooker|instant pot|air fryer/i.test(a) ? "fast" : ""); }),`,
  `          chips: v.protein.appliance.map(function (a) { return chip(a); }),`, 1);
sub("sauce-freeze-chip",
  `          chips: [chip(sauce.tool || "Blender"), sauce.freezes ? chip("Freeze in 2-Tbsp molds", "fast") : chip("Best fresh — fridge only", "warn")],`,
  `          chips: [chip(sauce.tool || "Blender"), sauce.freezes ? chip("Freeze in 2-Tbsp molds", "freezes") : chip("Best fresh — fridge only", "warn")],`, 1);
// grain-step JSON chips carry cls:"fast" for the alt method — strip so method chips render neutral
sub("grain-chips-neutral",
  `    var mkChips = function (arr) { return (arr || []).map(function (c) { return chip(c.t, c.cls || ""); }); };`,
  `    var mkChips = function (arr) { return (arr || []).map(function (c) { return chip(c.t); }); };`, 1);

// --- R9 build sauce-name heading: green -> neutral ---
sub("sauce-name-neutral",
  `color:var(--cactus-deep);margin-bottom:9px">' + esc(sauce.name)`,
  `color:var(--ink);margin-bottom:9px">' + esc(sauce.name)`, 1);

// --- R10 buildnote accent: green -> chipotle (ties "this build" to structure) ---
sub("buildnote-accent",
  `border-left: 4px solid var(--cactus); border-radius: var(--radius-sm);`,
  `border-left: 4px solid var(--chipotle); border-radius: var(--radius-sm);`, 1);

// --- R11 Fresh note: drop green tint/heading (green != "fresh") ---
sub("note-fresh-neutral",
  `  .note.fresh { background: color-mix(in srgb, var(--avocado) 10%, var(--surface)); }\n  .note.fresh h3 { color: var(--cactus-deep); }\n  @media (prefers-color-scheme: dark){ .note.fresh h3 { color: var(--cactus); } }\n  :root[data-theme="dark"] .note.fresh h3 { color: var(--cactus); }`,
  `  .note.fresh { background: var(--surface); }`, 1);

// --- R12 Batch card: green -> neutral surface + chipotle heading ---
sub("batch-neutral",
  `  .batch { margin-bottom: 14px; background: color-mix(in srgb, var(--cactus) 10%, var(--surface)); border: 1px solid color-mix(in srgb, var(--cactus) 30%, var(--line)); border-radius: var(--radius-sm); padding: 17px 19px; }\n  .batch h3 { margin: 0 0 6px; font-family: var(--font-display); font-size: 15px; text-transform: uppercase; letter-spacing: .03em; color: var(--cactus-deep); }\n  @media (prefers-color-scheme: dark){ .batch h3 { color: var(--cactus); } }\n  :root[data-theme="dark"] .batch h3 { color: var(--cactus); }`,
  `  .batch { margin-bottom: 14px; background: var(--surface-2); border: 1px solid var(--line); border-radius: var(--radius-sm); padding: 17px 19px; }\n  .batch h3 { margin: 0 0 6px; font-family: var(--font-display); font-size: 15px; text-transform: uppercase; letter-spacing: .03em; color: var(--chipotle); }`, 1);

// --- R15 Nutrition panel: bright panel-safe macro vars + per-macro stat colors ---
sub("nutri-vars",
  `  .nutri { background: #211A14; color: var(--panel-ink); border-radius: var(--radius); padding: 24px; }`,
  `  .nutri { background: #211A14; color: var(--panel-ink); border-radius: var(--radius); padding: 24px; --macro-carb: #E7B34E; --macro-protein: #EC7A50; --macro-fat: #C79A5E; --macro-fiber: #5FB3A8; }`, 1);
sub("stat-macro-colors",
  `  .stat .v { font-family: var(--font-mono); font-size: clamp(24px, 4.3vw, 33px); font-weight: 700; line-height: 1; color: var(--panel-ink); }`,
  `  .stat .v { font-family: var(--font-mono); font-size: clamp(24px, 4.3vw, 33px); font-weight: 700; line-height: 1; color: var(--panel-ink); }\n  .stat .v.carb { color: var(--macro-carb); } .stat .v.prot { color: var(--macro-protein); } .stat .v.fat { color: var(--macro-fat); } .stat .v.fib { color: var(--macro-fiber); }`, 1);
sub("stat-fn-cls",
  `    var stat = function (val, unit, label) {\n      return '<div class="stat"><span class="v">' + val + '</span><span class="u">' + unit + '</span><span class="stat-label">' + label + "</span></div>";\n    };`,
  `    var stat = function (val, unit, label, cls) {\n      return '<div class="stat"><span class="v ' + (cls || "") + '">' + val + '</span><span class="u">' + unit + '</span><span class="stat-label">' + label + "</span></div>";\n    };`, 1);
sub("stat-calls-cls",
  `          stat(m.kcal, " kcal", "Calories") + stat(m.protein, "g", "Protein") +\n          stat(m.carbs, "g", "Carbs") + stat(m.fiber, "g", "Fiber") + stat(m.fat, "g", "Fat") +`,
  `          stat(m.kcal, " kcal", "Calories") + stat(m.protein, "g", "Protein", "prot") +\n          stat(m.carbs, "g", "Carbs", "carb") + stat(m.fiber, "g", "Fiber", "fib") + stat(m.fat, "g", "Fat", "fat") +`, 1);

// --- R16 caption under the macro bar (explains it's the calorie split) ---
sub("barcap-css",
  `  .macrobar span { display: block; }`,
  `  .macrobar span { display: block; }\n  .barcap { margin-top: 9px; font-family: var(--font-ui); font-size: 12px; color: var(--panel-ink-2); letter-spacing: .01em; }`, 1);
sub("barcap-render",
  `        "</div>" +\n        '<div class="macrolegend">' +`,
  `        "</div>" +\n        '<div class="barcap">Share of calories from each macro · protein &amp; carbs 4 kcal/g, fat 9</div>' +\n        '<div class="macrolegend">' +`, 1);

if (failures.length) {
  console.error("FAILED replacements in " + file + ":");
  failures.forEach(f => console.error("  - " + f));
  process.exit(1);
}
fs.writeFileSync(file, s);
console.log("OK color pass applied to " + file);
