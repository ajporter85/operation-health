// Overwrites the three identical engine blocks (style, middle body, app script)
// in the other five cards with chili's toggle-enabled versions. Hero/title/
// footer text and the #meal-data island are left untouched.
const fs = require("fs");

const SRC = "chili-bowl.html";
const TARGETS = [
  "southwest-hybrid-bowl.html", "bbq-power-bowl.html",
  "loaded-potato-bowl.html", "burger-bowl.html", "italian-bowl.html"
];

const chili = fs.readFileSync(SRC, "utf8");
const styleBlk  = chili.match(/<style>[\s\S]*?<\/style>/)[0];
const middleBlk = chili.match(/<section class="picker">[\s\S]*?<footer>/)[0];
const appBlk    = chili.match(/<script>\s*\(function \(\)[\s\S]*?\}\)\(\);\s*<\/script>/)[0];

let fail = 0;
TARGETS.forEach(f => {
  let t = fs.readFileSync(f, "utf8");
  const before = t;
  let n = 0;
  t = t.replace(/<style>[\s\S]*?<\/style>/, () => { n++; return styleBlk; });
  t = t.replace(/<section class="picker">[\s\S]*?<footer>/, () => { n++; return middleBlk; });
  t = t.replace(/<script>\s*\(function \(\)[\s\S]*?\}\)\(\);\s*<\/script>/, () => { n++; return appBlk; });
  if (n !== 3) { console.error("  ✗ " + f + ": replaced " + n + "/3 blocks"); fail++; return; }
  // sanity: island + hero survived
  if (!/id="meal-data"/.test(t) || !/class="eyebrow"/.test(t)) { console.error("  ✗ " + f + ": lost island/hero"); fail++; return; }
  fs.writeFileSync(f, t);
  console.log("  ✓ " + f + " (" + before.length + " → " + t.length + " bytes)");
});
process.exit(fail ? 1 : 0);
