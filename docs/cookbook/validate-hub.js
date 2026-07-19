// Validates the hub: loads the controller, selects each meal, drives the
// freezer/fresh toggle, and asserts the mode-specific content renders.
const fs = require("fs");
const vm = require("vm");

const src = fs.readFileSync("meal-library.html", "utf8");
let fail = 0;
function assert(c, m) { if (!c) { console.error("  ✗ " + m); fail++; } }

// islands
const islands = {};
[...src.matchAll(/id="(data-[a-z]+)">([\s\S]*?)<\/script>/g)].forEach(m => { islands[m[1]] = m[2].trim(); });
assert(Object.keys(islands).length === 6, "6 theme islands embedded (got " + Object.keys(islands).length + ")");
Object.values(islands).forEach(j => JSON.parse(j)); // valid

const appScript = [...src.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).find(s => /function selectTheme\(/.test(s));
assert(!!appScript, "hub controller script found");

function makeButton(html) {
  const attrs = {}; const re = /(\w[\w-]*)="([^"]*)"/g; let m;
  while ((m = re.exec(html))) attrs[m[1]] = m[2];
  return { handlers: {}, getAttribute: k => attrs[k] != null ? attrs[k] : null, setAttribute(){},
    addEventListener(ev, fn){ this.handlers[ev] = fn; }, click(){ if (this.handlers.click) this.handlers.click(); } };
}
function buttonsFrom(htmlStr, sel) {
  const cls = sel.replace(/^\./, ""); const out = [];
  const re = new RegExp('<button[^>]*class="[^"]*\\b' + cls + '\\b[^"]*"[^>]*>', "g");
  let m; while ((m = re.exec(htmlStr))) out.push(makeButton(m[0]));
  return out;
}

const els = {}; const LAST = {};
function getEl(id) {
  if (islands[id]) return { textContent: islands[id], innerHTML: islands[id], querySelectorAll: () => [] };
  if (!els[id]) els[id] = {
    id, innerHTML: "", textContent: "", hidden: false, _attr: {},
    addEventListener(ev, fn){ (this._h = this._h || {})[ev] = fn; },
    setAttribute(k, v){ this._attr[k] = v; },
    removeAttribute(k){ delete this._attr[k]; },
    querySelectorAll(sel){ const o = buttonsFrom(this.innerHTML, sel); LAST[sel] = o; return o; }
  };
  return els[id];
}
const doc = { getElementById: getEl,
  querySelectorAll(sel){ let o = []; Object.keys(els).forEach(k => o = o.concat(buttonsFrom(els[k].innerHTML || "", sel))); LAST[sel] = o; return o; } };
// seed the static nav (lives in the file's HTML, not injected by JS) so the
// load-time querySelectorAll(".navbtn") can find + wire the buttons
getEl("__nav").innerHTML = src.match(/<nav class="hubnav"[\s\S]*?<\/nav>/)[0];

const sandbox = { document: doc, window: {}, console: { log(){}, error(){} }, JSON, Math, RegExp, Array, String, Object };
vm.createContext(sandbox);
try { vm.runInContext(appScript, sandbox, { timeout: 5000 }); } catch (e) { assert(false, "hub threw on load: " + e.message); }

// select each meal via its theme-card, drive the toggle
const cards = LAST[".theme-card"] || [];
assert(cards.length === 6, "6 theme cards rendered (got " + cards.length + ")");
const clickMode = m => { const b = (LAST[".modebtn"] || []).find(x => x.getAttribute("data-mode") === m); if (b) b.click(); return b; };
cards.forEach(card => {
  const id = card.getAttribute("data-id");
  card.click(); // selectTheme -> update() ; default mode = prep
  assert(/modebtn active/.test(els["modebar"].innerHTML), id + ": modebar active after select");
  assert(/One meal =/.test(els["modebar"].innerHTML) && els["modebar"].innerHTML.indexOf("🍲") >= 0, id + ": meal strip + reheat icon");
  const bs = els["body-buildshop"].innerHTML;
  assert(bs.indexOf("Protein puck") >= 0 && bs.indexOf("Grain puck") >= 0 && bs.indexOf("Veg &amp; beans puck") >= 0 && bs.indexOf("Seasoning") >= 0, id + ": merged Build&Shop cards");
  assert(/Buy for 4/.test(bs), id + ": buy blocks in prep");
  assert(/Cook &amp; season/.test(els["body-prep"].innerHTML) && /freeze as pucks/i.test(els["body-prep"].innerHTML), id + ": prep mode cook+freeze");
  assert(/pucktbl/.test(els["body-nutri"].innerHTML), id + ": puck table shown (prep)");
  assert(!("hidden" in (els["sec-swaps"]._attr || {})), id + ": swaps visible in prep");
  // reheat
  clickMode("reheat");
  assert(/Grab your pucks/.test(els["body-prep"].innerHTML) && !/Cook &amp; season/.test(els["body-prep"].innerHTML), id + ": reheat is assemble-only");
  assert(!/Buy for 4/.test(els["body-buildshop"].innerHTML), id + ": no buy blocks in reheat");
  assert("hidden" in (els["sec-swaps"]._attr || {}), id + ": swaps hidden in reheat");
  assert(/pucktbl/.test(els["body-nutri"].innerHTML), id + ": puck table shown (reheat)");
  // fresh
  clickMode("fresh");
  assert(/portion for the fridge/i.test(els["body-prep"].innerHTML), id + ": fresh cook+fridge");
  assert(!/pucktbl/.test(els["body-nutri"].innerHTML), id + ": no puck table in fresh");
  clickMode("prep"); // reset for next
});

// the other three hub views must still build without error
const nav = LAST[".navbtn"] || [];
["staples", "freeze", "fuel"].forEach(v => {
  const b = nav.find(x => x.getAttribute("data-view") === v);
  try { if (b) b.click(); assert(!!(els["view-" + v] && els[v + "-body"].innerHTML.length > 50), v + " view rendered"); }
  catch (e) { assert(false, v + " view threw: " + e.message); }
});
const sb = els["staples-body"].innerHTML;
assert(/Grain pucks/.test(sb) && /Protein pucks/.test(sb) && /Veg &amp; bean pucks/.test(sb), "staples: 3 puck groups");
assert(!/Beans &amp; legumes/.test(sb) && !/Roasted vegetables/.test(sb), "staples: old 4-group labels gone");
assert(/4th component: sauce/.test(sb) && /fresh toppings/i.test(sb), "staples: sauce + fresh asides present");
const fr = els["freeze-body"].innerHTML;
assert(!/2-cup/.test(fr) && /6–9 min/.test(fr), "freeze view: puck-based, 6–9 min");

console.log(fail ? ("\nHUB FAILED (" + fail + ")") : "\nHUB ALL PASS");
process.exit(fail ? 1 : 0);
