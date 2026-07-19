// Validates the meal cards render in BOTH modes across every variation.
// Builds a minimal DOM stub, runs the app script in a vm, drives the mode
// toggle + variation tabs, and asserts the mode-specific content appears.
const fs = require("fs");
const vm = require("vm");
const path = require("path");

const files = process.argv.slice(2);
if (!files.length) { console.error("usage: node validate-toggle.js <card.html> ..."); process.exit(1); }

let fail = 0;
function assert(cond, msg) { if (!cond) { console.error("  ✗ " + msg); fail++; } }

function makeButton(html) {
  // parse data-* attrs out of a <button ...> tag
  const attrs = {};
  const re = /(\w[\w-]*)="([^"]*)"/g; let m;
  while ((m = re.exec(html))) attrs[m[1]] = m[2];
  return {
    _html: html,
    handlers: {},
    getAttribute: function (k) { return attrs[k] != null ? attrs[k] : null; },
    setAttribute: function () {},
    addEventListener: function (ev, fn) { this.handlers[ev] = fn; },
    click: function () { if (this.handlers.click) this.handlers.click(); }
  };
}

function buttonsFrom(htmlStr, sel) {
  // sel like ".modebtn", ".tab", ".navbtn", ".theme-card"
  const cls = sel.replace(/^\./, "");
  const out = [];
  const re = new RegExp('<button[^>]*class="[^"]*\\b' + cls + '\\b[^"]*"[^>]*>', "g");
  let m; while ((m = re.exec(htmlStr))) out.push(makeButton(m[0]));
  return out;
}

function runCard(file) {
  console.log("• " + path.basename(file));
  const src = fs.readFileSync(file, "utf8");
  const island = src.match(/id="meal-data">([\s\S]*?)<\/script>/)[1].trim();
  JSON.parse(island); // valid JSON
  const appScript = [...src.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).find(s => /function update\(/.test(s));

  const els = {};
  const LAST = {}; // most-recent live (handler-bearing) button set, per selector
  function getEl(id) {
    if (!els[id]) {
      els[id] = {
        id: id, innerHTML: "", textContent: "", _attr: {},
        setAttribute: function (k, v) { this._attr[k] = v; },
        removeAttribute: function (k) { delete this._attr[k]; },
        querySelectorAll: function (sel) { const out = buttonsFrom(this.innerHTML, sel); LAST[sel] = out; return out; }
      };
    }
    return els[id];
  }
  // seed the meal-data element
  els["meal-data"] = { textContent: island, innerHTML: island, querySelectorAll: () => [] };

  const doc = {
    _last: LAST,
    getElementById: getEl,
    querySelectorAll: function (sel) {
      // global query: search across all element innerHTML
      let out = [];
      Object.keys(els).forEach(k => { out = out.concat(buttonsFrom(els[k].innerHTML || "", sel)); });
      LAST[sel] = out;
      return out;
    }
  };
  const sandbox = { document: doc, window: {}, console: { log(){}, error(){} }, JSON: JSON, Math: Math, RegExp: RegExp, Array: Array, String: String, Object: Object };
  vm.createContext(sandbox);
  try {
    vm.runInContext(appScript, sandbox, { filename: path.basename(file), timeout: 5000 });
  } catch (e) {
    assert(false, "script threw on load: " + e.message);
    return;
  }

  const clickMode = m => { const b = (LAST[".modebtn"] || []).find(x => x.getAttribute("data-mode") === m); assert(!!b, "found mode button " + m); if (b) b.click(); return b; };
  const esc = s => String(s).replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
  const MEAL = JSON.parse(island);

  // after load: default mode = prep (Cook & Freeze)
  const modebar = els["modebar"];
  assert(modebar && /modebtn active/.test(modebar.innerHTML), "modebar rendered with an active button");
  ["Cook &amp; Freeze", "Reheat from Freezer", "Cook Fresh"].forEach(lbl =>
    assert(modebar.innerHTML.indexOf(lbl) >= 0, "mode button present: " + lbl));
  assert(modebar.innerHTML.indexOf("🍲") >= 0, "reheat icon 🍲 present (not ♨️)");
  assert(modebar.innerHTML.indexOf("♨️") < 0, "old ♨️ icon gone");
  assert(/One meal =/.test(modebar.innerHTML), "'one meal =' strip present");

  // BUILD & SHOP (prep mode): 6 cards (5 pucks + seasoning), buy blocks present
  const bs = els["body-buildshop"].innerHTML;
  ["Protein puck", "Grain puck", "Veg &amp; beans puck", "Sauce", "Fresh", "Seasoning"].forEach(c =>
    assert(bs.indexOf(c) >= 0, "build&shop card present: " + c));
  assert((bs.match(/comp-title/g) || []).length === 6, "build&shop has 6 cards in shop mode");
  assert(/Buy for 4/.test(bs), "build&shop: buy blocks present in shop mode");
  assert(els["h-buildshop"].textContent === "Build & Shop", "h-buildshop title (prep)");
  assert(els["sub-buildshop"].textContent === "Per meal · buy for 4", "sub-buildshop (prep)");

  // Swaps & Boosts (not hidden in prep) = subs + boost only, no batch/freeze
  assert(!els["sec-swaps"] || !("hidden" in (els["sec-swaps"]._attr||{})), "sec-swaps visible in prep");
  const notes = els["body-notes"].innerHTML;
  assert(/Substitutions/.test(notes) && /Boost protein/.test(notes), "swaps: subs + boost present");
  assert(!/Weekly batch plan/.test(notes) && !/Freezes well/.test(notes), "swaps: batch/freeze removed");

  // PREP (Cook & Freeze) + Nutrition
  assert(/Cook &amp; season/.test(els["body-prep"].innerHTML) && /freeze as pucks/i.test(els["body-prep"].innerHTML), "prep: cook + freeze");
  assert(/pucktbl/.test(els["body-nutri"].innerHTML) && /Total · ~3-cup meal/.test(els["body-nutri"].innerHTML), "prep: puck table");
  assert(!/2-cup/.test(els["body-nutri"].innerHTML), "no stale '2-cup' text");

  // puck-sum integrity
  MEAL.variations.forEach(v => {
    if (!v.pucks) { assert(false, v.id + ": missing pucks"); return; }
    ["kcal","protein","carbs","fiber","fat"].forEach(k => {
      const sum = ["protein","grain","veg","sauce"].reduce((a,pk) => a + (v.pucks[pk] ? v.pucks[pk].macros[k] : 0), 0);
      assert(sum === v.macros[k], v.id + " " + k + ": pucks sum " + sum + " != total " + v.macros[k]);
    });
  });

  // SHOPPING EXACTNESS — every buy item must still appear, per variation (prep mode)
  clickMode("prep");
  const d = MEAL.defaults.shopping;
  const tabById = id => (LAST[".tab"] || []).find(t => t.getAttribute("data-id") === id);
  MEAL.variations.forEach(v => {
    const t = tabById(v.id); if (t) t.click();
    const html = els["body-buildshop"].innerHTML;
    const sauce = MEAL.sauces[v.sauceId || MEAL.defaults.sauceId];
    const shop = v.shopping || {};
    const expect = [];
    if (shop.protein) expect.push(shop.protein.item);
    (sauce.shop || []).forEach(x => expect.push(x.item));
    d.produce.forEach(x => expect.push(x.item));
    d.pantry.forEach(p => {
      if (p.grain && shop.pantrySwap && new RegExp(shop.pantrySwap.from, "i").test(p.item)) expect.push(shop.pantrySwap.to.item);
      else expect.push(p.item);
    });
    (shop.produceAdd || []).forEach(x => expect.push(x.item));
    (shop.pantryAdd || []).forEach(x => expect.push(x.item));
    d.seasoning.forEach(s => expect.push(s));
    expect.forEach(item => assert(html.indexOf(esc(item)) >= 0, v.id + ": shopping item missing from Build&Shop → " + item));
  });

  // REHEAT — assemble-only: composition (5 cards, no buy blocks), no cooking, puck table stays, swaps hidden
  clickMode("reheat");
  const bsR = els["body-buildshop"].innerHTML;
  assert(!/Buy for 4/.test(bsR), "reheat: no buy blocks");
  assert((bsR.match(/comp-title/g) || []).length === 5, "reheat: 5 composition cards (no seasoning)");
  assert(els["h-buildshop"].textContent === "Build Your Meal", "reheat: h-buildshop title");
  assert(/Grab your pucks/.test(els["body-prep"].innerHTML) && !/Cook &amp; season/.test(els["body-prep"].innerHTML), "reheat: assemble-only prep");
  assert(/pucktbl/.test(els["body-nutri"].innerHTML), "reheat: puck table still shown");
  assert("hidden" in (els["sec-swaps"]._attr || {}), "reheat: sec-swaps hidden");

  // FRESH — cook + fridge, buy blocks return, no puck table, swaps visible
  clickMode("fresh");
  assert(/Buy for 4/.test(els["body-buildshop"].innerHTML), "fresh: buy blocks present");
  assert(/portion for the fridge/i.test(els["body-prep"].innerHTML), "fresh: fridge ending");
  assert(!/pucktbl/.test(els["body-nutri"].innerHTML), "fresh: no puck table");
  assert(!("hidden" in (els["sec-swaps"]._attr || {})), "fresh: sec-swaps visible");

  // drive every variation tab in each mode
  ["prep", "reheat", "fresh"].forEach(m => {
    clickMode(m);
    (LAST[".tab"] || []).forEach(t => { try { t.click(); } catch (e) { assert(false, m + " tab click threw: " + e.message); } });
  });
}

files.forEach(f => { try { runCard(f); } catch (e) { console.error("  ✗ FATAL " + e.message); fail++; } });
console.log(fail ? ("\nFAILED (" + fail + ")") : "\nALL PASS");
process.exit(fail ? 1 : 0);
