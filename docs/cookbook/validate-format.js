// Validates the assembly-format layer (FORMATS / MEAL.format).
//
// Two jobs:
//   1. DEFAULT — a card with no `format` still speaks the puck vocabulary.
//      (Guards against anyone flipping the fallback and silently rewording
//      all six original cards.)
//   2. ONEPOT — synthesizes a one-vessel card from an existing one by
//      injecting a `format` block into its #meal-data island, renders every
//      mode, and asserts the puck vocabulary is fully gone and every
//      {vessel}/{cups}/{mold}/{count} token got substituted.
//
// Synthesizing means this runs before any real one-pot card exists, so the
// engine change is provable on its own.
//
//   node validate-format.js [card.html]     (default: chili-bowl.html)
const fs = require("fs");
const vm = require("vm");
const path = require("path");

const CARD = process.argv[2] || "chili-bowl.html";
let fail = 0;
function assert(cond, msg) { if (!cond) { console.error("  ✗ " + msg); fail++; } }

function makeButton(html) {
  const attrs = {}; const re = /(\w[\w-]*)="([^"]*)"/g; let m;
  while ((m = re.exec(html))) attrs[m[1]] = m[2];
  return {
    handlers: {},
    getAttribute: k => (attrs[k] != null ? attrs[k] : null),
    setAttribute() {},
    addEventListener(ev, fn) { this.handlers[ev] = fn; },
    click() { if (this.handlers.click) this.handlers.click(); }
  };
}
function buttonsFrom(htmlStr, sel) {
  const cls = sel.replace(/^\./, ""); const out = [];
  const re = new RegExp('<button[^>]*class="[^"]*\\b' + cls + '\\b[^"]*"[^>]*>', "g");
  let m; while ((m = re.exec(htmlStr))) out.push(makeButton(m[0]));
  return out;
}
// Copy is what's between the tags — class names like ms-puck / pucktbl are
// markup and must not count as puck *vocabulary*.
const copy = html => String(html).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");

function render(src) {
  const island = src.match(/id="meal-data">([\s\S]*?)<\/script>/)[1].trim();
  const appScript = [...src.matchAll(/<script>([\s\S]*?)<\/script>/g)]
    .map(m => m[1]).find(s => /function update\(/.test(s));
  const els = {}, LAST = {};
  function getEl(id) {
    if (!els[id]) els[id] = {
      id, innerHTML: "", textContent: "", _attr: {},
      setAttribute(k, v) { this._attr[k] = v; },
      removeAttribute(k) { delete this._attr[k]; },
      querySelectorAll(sel) { const o = buttonsFrom(this.innerHTML, sel); LAST[sel] = o; return o; }
    };
    return els[id];
  }
  els["meal-data"] = { textContent: island, innerHTML: island, querySelectorAll: () => [] };
  const doc = {
    getElementById: getEl,
    querySelectorAll(sel) {
      let out = []; Object.keys(els).forEach(k => { out = out.concat(buttonsFrom(els[k].innerHTML || "", sel)); });
      LAST[sel] = out; return out;
    }
  };
  const sandbox = { document: doc, window: {}, console: { log() {}, error() {} }, JSON, Math, RegExp, Array, String, Object };
  vm.createContext(sandbox);
  vm.runInContext(appScript, sandbox, { filename: "card", timeout: 5000 });
  return {
    els, LAST, MEAL: JSON.parse(island),
    mode(m) { const b = (LAST[".modebtn"] || []).find(x => x.getAttribute("data-mode") === m); if (b) b.click(); return !!b; },
    html(id) { return (els[id] || {}).innerHTML || ""; },
    txt(id) { return (els[id] || {}).textContent || ""; }
  };
}

const src = fs.readFileSync(CARD, "utf8");

const cardData = JSON.parse(src.match(/id="meal-data">([\s\S]*?)<\/script>/)[1].trim());
const cardFmt = cardData.format;
const cardIsOnepot = cardFmt && (typeof cardFmt === "object" ? cardFmt.id : cardFmt) === "onepot";

// ---- 1. DEFAULT (no format) still means pucks -------------------------
// Only meaningful on a card that declares no format; a real one-pot card
// skips straight to section 2 and gets checked for real instead.
if (!cardFmt) {
  console.log("• default format (" + path.basename(CARD) + ")");
  const r = render(src);
  assert(/puck/i.test(copy(r.html("modebar"))), "default: mode copy still says 'puck'");
  assert(/One meal =/.test(r.html("modebar")), "default: strip lead unchanged");
  r.mode("reheat");
  assert(/Grab your pucks/.test(r.html("body-prep")), "default: reheat still 'Grab your pucks'");
} else {
  console.log("• " + path.basename(CARD) + " declares a format — skipping the default check");
}

// ---- 2. ONEPOT --------------------------------------------------------
// Against a real one-pot card when we have one; otherwise synthesize, so the
// engine is provable before any such card exists.
const OPT = cardIsOnepot
  ? { id: "onepot", vessel: cardFmt.vessel, cups: cardFmt.cups, mold: cardFmt.mold, count: cardFmt.count }
  : { id: "onepot", vessel: "rice cooker", cups: 2, mold: "2-cup", count: 4 };
console.log("• onepot format (" + (cardIsOnepot ? "real card" : "synthesized") + ": " + JSON.stringify(OPT) + ")");
{
  const onepotSrc = cardIsOnepot ? src : src.replace(/(id="meal-data">)([\s\S]*?)(<\/script>)/,
    (m, a, _b, c) => { const d = JSON.parse(_b.trim()); d.format = OPT; return a + "\n" + JSON.stringify(d, null, 2) + "\n" + c; });
  const r = render(onepotSrc);

  const SECTIONS = ["modebar", "body-bowl", "body-shop", "body-prep", "body-nutri"];
  const SUBS = ["sub-bowl", "sub-shop", "sub-prep", "sub-nutri"];
  const MODES = ["prep", "reheat", "fresh"];

  // every mode still offered — a format must not drop modes over texture
  MODES.forEach(m => assert(r.mode(m), "onepot: mode button present → " + m));

  r.mode("prep");
  assert(/rice cooker/.test(r.html("modebar")), "onepot: {vessel} substituted in mode copy");
  assert(/Each 2-cup portion =/.test(r.html("modebar")), "onepot: strip lead uses {cups}");
  assert(/2-cup molds/.test(r.html("body-prep")), "onepot: {mold} substituted in freeze step");
  assert(/Portion &amp; freeze/.test(r.html("body-prep")), "onepot: one-pot freeze step");
  assert(!/freeze as pucks/.test(r.html("body-prep")), "onepot: puck freeze step gone");

  r.mode("reheat");
  assert(/Grab a portion/.test(r.html("body-prep")), "onepot: reheat grabs one portion");
  assert(!/Grab your pucks/.test(r.html("body-prep")), "onepot: puck reheat step gone");
  assert(/already in the freezer/.test(r.html("body-shop")), "onepot: shop reheat note");

  r.mode("fresh");
  assert(/Portion for the fridge/.test(r.html("body-prep")), "onepot: fridge step");
  assert(/4 containers/.test(r.html("body-prep")), "onepot: {count} substituted");

  r.mode("prep");
  const nutri = r.html("body-nutri");
  assert(/By component/.test(nutri), "onepot: nutrition caption");
  assert(/Total · ~2-cup portion/.test(nutri), "onepot: nutrition total label");
  assert(/rice cooker/.test(nutri), "onepot: disclaimer names the vessel");

  // Across EVERY mode × EVERY build: no puck vocabulary, no stray tokens.
  MODES.forEach(m => {
    r.mode(m);
    r.MEAL.variations.forEach(v => {
      const t = (r.LAST[".tab"] || []).find(x => x.getAttribute("data-id") === v.id);
      if (t) t.click();
      const where = m + "/" + v.id;
      SECTIONS.forEach(id => {
        assert(!/puck/i.test(copy(r.html(id))), where + " " + id + ": puck vocabulary leaked into copy");
        const tok = copy(r.html(id)).match(/\{(vessel|cups|mold|count)\}/);
        assert(!tok, where + " " + id + ": unsubstituted token " + (tok && tok[0]));
      });
      SUBS.forEach(id => {
        assert(!/puck/i.test(r.txt(id)), where + " " + id + ": puck vocabulary in subtitle → " + r.txt(id));
        assert(!/\{\w+\}/.test(r.txt(id)), where + " " + id + ": unsubstituted token → " + r.txt(id));
      });
    });
  });
}

// ---- 3. HUB PATH: format must follow MEAL when it's swapped -----------
// The hub reuses this engine and reassigns MEAL to switch meals, so
// curFormat()'s cache has to invalidate on that. With every real meal on
// "pucks" today the bug would be invisible, so drive it directly: replicate
// build-hub.js's extraction, then flip MEAL between a pucks meal and a
// onepot meal and back.
console.log("• hub path (MEAL reassigned between meals)");
{
  const appScript = [...src.matchAll(/<script>([\s\S]*?)<\/script>/g)]
    .map(m => m[1]).find(s => /function update\(/.test(s));
  const fns = appScript                                   // same steps as build-hub.js
    .replace(/^\s*\(function \(\) \{/, "")
    .replace(/\}\)\(\);\s*$/, "")
    .replace(/\s*"use strict";\s*/, "\n")
    .replace(/\s*var MEAL = JSON\.parse\(document\.getElementById\("meal-data"\)\.textContent\);\s*/, "\n")
    .replace(/\n\s*var state = \{ vid:[^\n]*\};\s*/, "\n")
    .replace(/\s*renderNotes\(\);\s*update\(\);\s*$/, "\n");
  assert(!/var MEAL =/.test(fns) && !/var state = \{ vid:/.test(fns),
    "hub: extraction stripped MEAL + state (matches build-hub.js)");
  assert(!/^\s*if \(modeIds\(\)/m.test(fns.split("function update(")[0]),
    "hub: no top-level statement left outside a function after extraction");

  // Derive both variants from whatever card we were given, so this works
  // whether CARD is a puck card or a real one-pot card.
  const pucksData = JSON.parse(JSON.stringify(cardData));
  delete pucksData.format;
  const onepotData = JSON.parse(JSON.stringify(cardData));
  onepotData.format = OPT;

  const els = {}, LAST = {};
  function getEl(id) {
    if (!els[id]) els[id] = {
      id, innerHTML: "", textContent: "", _attr: {},
      setAttribute(k, v) { this._attr[k] = v; }, removeAttribute(k) { delete this._attr[k]; },
      querySelectorAll(sel) { const o = buttonsFrom(this.innerHTML, sel); LAST[sel] = o; return o; }
    };
    return els[id];
  }
  const sandbox = {
    document: {
      getElementById: getEl,
      querySelectorAll(sel) {
        let out = []; Object.keys(els).forEach(k => { out = out.concat(buttonsFrom(els[k].innerHTML || "", sel)); });
        LAST[sel] = out; return out;
      }
    },
    window: {}, console: { log() {}, error() {} }, JSON, Math, RegExp, Array, String, Object
  };
  vm.createContext(sandbox);
  vm.runInContext(
    "var MEAL = null; var state = { vid: null, mode: 'prep' };\n" + fns +
    "\nfunction __select(d) { MEAL = d; state.vid = (d.variations.find(function(v){return v.featured;}) || d.variations[0]).id; update(); }",
    sandbox, { filename: "hub-engine", timeout: 5000 });

  const bar = () => els["modebar"].innerHTML;
  sandbox.__select(pucksData);
  assert(/puck/i.test(copy(bar())), "hub: first meal (pucks) renders puck copy");
  sandbox.__select(onepotData);
  assert(/rice cooker/.test(bar()) && !/puck/i.test(copy(bar())),
    "hub: switching to a onepot meal switches the format (cache invalidated)");
  sandbox.__select(pucksData);
  assert(/puck/i.test(copy(bar())) && !/rice cooker/.test(bar()),
    "hub: switching back restores the puck format");
}

console.log(fail ? "\nFAILED (" + fail + ")" : "\nALL PASS");
process.exit(fail ? 1 : 0);
