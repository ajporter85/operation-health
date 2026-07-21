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
islands["snack-data"] = src.match(/id="snack-data">([\s\S]*?)<\/script>/)[1].trim();
const SNACKJSON = JSON.parse(islands["snack-data"]);

const appScript = [...src.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).find(s => /function selectTheme\(/.test(s));
assert(!!appScript, "hub controller script found");

function makeButton(html) {
  const attrs = {}; const re = /(\w[\w-]*)="([^"]*)"/g; let m;
  while ((m = re.exec(html))) attrs[m[1]] = m[2];
  return { handlers: {}, getAttribute: k => attrs[k] != null ? attrs[k] : null, setAttribute(){},
    addEventListener(ev, fn){ this.handlers[ev] = fn; }, click(){ if (this.handlers.click) this.handlers.click(); } };
}
function buttonsFrom(htmlStr, sel) {
  const out = [];
  const attr = sel.match(/^\[([\w-]+)\]$/);
  const re = attr
    ? new RegExp('<button[^>]*\\b' + attr[1] + '="[^"]*"[^>]*>', "g")
    : new RegExp('<button[^>]*class="[^"]*\\b' + sel.replace(/^\./, "") + '\\b[^"]*"[^>]*>', "g");
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
["staples", "freeze", "fuel", "snacks"].forEach(v => {
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

// ---- snacks: every sort axis must render EVERY snack exactly once ----
const nSnacks = SNACKJSON.snacks.length;
const countRows = h => (h.match(/class="s-name"/g) || []).length;
const navSnacks = nav.find(x => x.getAttribute("data-view") === "snacks");
navSnacks.click();
// NB: read LAST — a fresh querySelectorAll returns new stubs with no handlers
const sortBtns = () => LAST[".sortbtn"] || [];
assert(sortBtns().length === 5, "snacks: 5 sort axes (got " + sortBtns().length + ")");
// the icon/sodium legend must be ABOVE the list, not stranded at the bottom
const firstView = els["snacks-body"].innerHTML;
assert(/class="slegend"/.test(firstView), "snacks: legend rendered");
assert(firstView.indexOf('class="slegend"') < firstView.indexOf('class="s-name"'), "snacks: legend sits above the first snack");
assert(!/smatrix-foot[^>]*>★/.test(firstView), "snacks: old bottom legend removed");
["tier", "where", "fat", "flavor"].forEach(axis => {
  const b = sortBtns().find(x => x.getAttribute("data-sort") === axis);
  assert(!!b, "snacks: sort button " + axis + " exists");
  try { if (b) b.click(); } catch (e) { assert(false, "snacks: sort " + axis + " threw: " + e.message); }
  const h = els["snacks-body"].innerHTML;
  const n = countRows(h);
  // "where" is multi-valued, so a snack can legitimately appear in >1 group
  if (axis === "where") {
    const expect = SNACKJSON.snacks.reduce((a, s) => a + s.where.length, 0);
    assert(n === expect, "snacks/where: " + expect + " placements rendered (got " + n + ")");
  } else {
    assert(n === nSnacks, "snacks/" + axis + ": all " + nSnacks + " rendered exactly once (got " + n + ")");
  }
  assert(new RegExp('sortbtn on" type="button" data-sort="' + axis).test(h), "snacks/" + axis + ": button marked active");
});
// the "Make your own" axis filters to the productions alone, at the top
const myoAxis = sortBtns().find(x => x.getAttribute("data-sort") === "myo");
assert(!!myoAxis, "snacks: make-your-own axis exists");
myoAxis.click();
const mv = els["snacks-body"].innerHTML;
assert(countRows(mv) === 0, "snacks/myo: snack rows filtered out (got " + countRows(mv) + ")");
assert((mv.match(/class="myo"/g) || []).length === SNACKJSON.makeYourOwn.length, "snacks/myo: all productions shown");
// nothing but the sort bar precedes the productions — no list to scroll past
assert(!/class="sgroup"/.test(mv) && !/class="slegend"/.test(mv), "snacks/myo: snack groups + legend suppressed");
assert(mv.indexOf("Worth ") < mv.indexOf('class="myo"'), "snacks/myo: header precedes the productions");
assert(mv.indexOf("Worth ") < mv.indexOf('class="sortbtn"') + 900, "snacks/myo: productions start right after the sort bar");
sortBtns().find(x => x.getAttribute("data-sort") === "tier").click(); // back to default

// every snack that names a Make Your Own target must render a working link to it
const sh = els["snacks-body"].innerHTML;
const myoBtns = LAST["[data-myo]"] || [];
assert(myoBtns.length > 0, "snacks: make-your-own links rendered (got " + myoBtns.length + ")");
myoBtns.forEach(b => {
  const id = b.getAttribute("data-myo");
  assert(sh.indexOf('id="myo-' + id + '"') >= 0, "snacks: link target myo-" + id + " exists on the page");
});
assert(SNACKJSON.makeYourOwn.every(o => sh.indexOf('id="myo-' + o.id + '"') >= 0), "snacks: all " + SNACKJSON.makeYourOwn.length + " make-your-own cards rendered");
assert(/mg Na/.test(sh) && /class="na (lo|mid|hi)"/.test(sh), "snacks: sodium shown with traffic-light band");
// the Round Out the Day picks must come from live snack data, not a stale hardcoded list
navSnacks && nav.find(x => x.getAttribute("data-view") === "fuel").click();
const fu = els["fuel-body"].innerHTML;
assert(/options with full macros on the <b>Snacks<\/b> tab/.test(fu), "fuel: points at the Snacks tab");
assert(!/Turkey stick or jerky/.test(fu), "fuel: stale hardcoded snack list gone");
const starNames = SNACKJSON.snacks.filter(s => s.star).map(s => s.name);
assert(starNames.some(n => fu.indexOf(n) >= 0), "fuel: starred picks pulled from live snack data");

console.log(fail ? ("\nHUB FAILED (" + fail + ")") : "\nHUB ALL PASS");
process.exit(fail ? 1 : 0);
