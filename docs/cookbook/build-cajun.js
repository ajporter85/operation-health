// One-shot: builds cajun-bowl.html (Meal 07) from the chili card's engine.
// Same approach as the other theme transforms — copy the card verbatim, then
// swap only <title>, the hero block, the footer and the #meal-data island.
// The engine is left byte-identical so propagate-toggle.js keeps working.
const fs = require("fs");
const path = require("path");

const SRC = "chili-bowl.html";
const OUT = "cajun-bowl.html";
const DATA = process.argv[2] || "cajun-meal-data.json";  // committed alongside, so this is re-runnable

const data = JSON.parse(fs.readFileSync(DATA, "utf8"));
let s = fs.readFileSync(SRC, "utf8");
let n = 0;
const swap = (re, to) => {
  const before = s;
  s = s.replace(re, to);
  if (s === before) { console.error("  ✗ no match: " + re); process.exit(1); }
  n++;
};

swap(/<title>[^<]*<\/title>/,
  "<title>Cajun &amp; Creole Bowl — Operation Health Meal Library</title>");

swap(/<span class="eyebrow">Operation Health · Meal Library · Meal \d+<\/span>/,
  '<span class="eyebrow">Operation Health · Meal Library · Meal 07</span>');

swap(/<h1>[\s\S]*?<span class="lead">[\s\S]*?<\/span><\/h1>/,
  '<h1>Cajun &amp; Creole<span class="lead">Bowl</span></h1>');

swap(/<p class="tagline">[\s\S]*?<\/p>/,
  '<p class="tagline">One pot, one button, four meals. A boxed jambalaya mix and a rope of smoked sausage rebuilt from scratch — same Creole flavor, about a quarter of the sodium, three times the protein. Everything goes in the rice cooker together and you walk away. Pick a build below and the whole card follows it.</p>');

// Hero meta: 2-cup portions, and the timings for a hands-off cooker run.
swap(/<div class="meta">[\s\S]*?<\/div>/,
  '<div class="meta">\n' +
  '      <span>Makes <b>' + data.servings + '</b> meals · <b>~' + data.format.cups + '</b> cups</span>\n' +
  '      <span>Hands-on <b>' + data.prepMin + '</b> min</span>\n' +
  '      <span>Cooker <b>' + data.cookMin + '</b> min</span>\n' +
  '      <span>Freezes <b>' + data.freezeMonths + '</b> mo</span>\n' +
  '      <span>Reheat <b>' + data.reheatMin[0] + "–" + data.reheatMin[1] + '</b> min</span>\n' +
  '    </div>');

swap(/<footer>[\s\S]*?<\/footer>/,
  '<footer>\n' +
  '    <span>Operation Health Meal Library · Cajun &amp; Creole Bowl · v1</span>\n' +
  '    <span class="pills">\n' +
  '      <span class="pill">★ High protein</span>\n' +
  '      <span class="pill">★ High fiber</span>\n' +
  '      <span class="pill">★ Lower sodium</span>\n' +
  '      <span class="pill">★ One pot</span>\n' +
  '    </span>\n' +
  '  </footer>');

swap(/(<script type="application\/json" id="meal-data">)[\s\S]*?(<\/script>)/,
  (m, a, b) => a + "\n" + JSON.stringify(data, null, 2) + "\n" + b);

// sanity: engine must be untouched so propagate-toggle.js still applies cleanly
const src = fs.readFileSync(SRC, "utf8");
const blk = (t, re) => { const m = t.match(re); return m ? m[0] : null; };
const RES = [/<style>[\s\S]*?<\/style>/, /<section class="picker">[\s\S]*?<footer>/, /<script>\s*\(function \(\)[\s\S]*?\}\)\(\);\s*<\/script>/];
RES.forEach((re, i) => {
  // the middle block ends at <footer>, so it legitimately differs there only
  if (i === 1) return;
  if (blk(s, re) !== blk(src, re)) { console.error("  ✗ engine block " + i + " diverged from " + SRC); process.exit(1); }
});

fs.writeFileSync(OUT, s);
console.log("  ✓ " + OUT + " (" + s.length + " bytes, " + n + " swaps, " +
  data.variations.length + " builds, format=" + data.format.id + ")");
