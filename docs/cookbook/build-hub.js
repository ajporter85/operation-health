// Builds meal-library.html — a single self-contained hub that embeds all six
// theme datasets behind a theme switcher, reusing the exact card engine.
const fs = require("fs");

const THEMES = [
  { file: "southwest-hybrid-bowl.html", id: "southwest", emoji: "🌶️" },
  { file: "bbq-power-bowl.html",        id: "bbq",       emoji: "🍖" },
  { file: "loaded-potato-bowl.html",    id: "loaded",    emoji: "🥔" },
  { file: "burger-bowl.html",           id: "burger",    emoji: "🍔" },
  { file: "italian-bowl.html",          id: "italian",   emoji: "🍝" },
  { file: "chili-bowl.html",            id: "chili",      emoji: "🌶️🫘" },
];

// --- engine source (CSS + render functions) from chili ---
const engine = fs.readFileSync("chili-bowl.html", "utf8");
const css = engine.match(/<style>([\s\S]*?)<\/style>/)[1];

const appScript = [...engine.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).find(s => /function update\(/.test(s));
let fns = appScript
  .replace(/^\s*\(function \(\) \{/, "")
  .replace(/\}\)\(\);\s*$/, "")
  .replace(/\s*"use strict";\s*/, "\n")
  .replace(/\s*var MEAL = JSON\.parse\(document\.getElementById\("meal-data"\)\.textContent\);\s*/, "\n")
  .replace(/\n\s*var state = \{ vid:[^\n]*\};\s*/, "\n")
  .replace(/\s*renderNotes\(\);\s*update\(\);\s*$/, "\n");

// sanity: the render fns must survive extraction
["function renderTabs", "function renderNotes", "function update", "function renderShopping"].forEach(k => {
  if (fns.indexOf(k) === -1) { console.error("extraction lost " + k); process.exit(1); }
});
if (/document\.getElementById\("meal-data"\)/.test(fns)) { console.error("meal-data ref still present"); process.exit(1); }

// --- per-theme meta + data ---
const meta = [];
const islands = [];
THEMES.forEach(t => {
  const h = fs.readFileSync(t.file, "utf8");
  const jsonTxt = h.match(/id="meal-data">([\s\S]*?)<\/script>/)[1].trim();
  JSON.parse(jsonTxt); // validate
  const tagline = h.match(/<p class="tagline">([\s\S]*?)<\/p>/)[1].trim();
  const h1 = h.match(/<h1>([\s\S]*?)<span class="lead">([\s\S]*?)<\/span><\/h1>/);
  const no = h.match(/Meal Library · Meal (\d+)/)[1];
  meta.push({ id: t.id, no: no, emoji: t.emoji, title: h1[1].trim(), lead: h1[2].trim(), tagline: tagline });
  islands.push('<script type="application/json" class="theme-data" id="data-' + t.id + '">\n' + jsonTxt + '\n</script>');
});

// --- the 6 collapsible detail sections (verbatim from a theme card) ---
const detailSections = `  <details class="sec" open>
    <summary><span class="caret">›</span><h2>Build Your Bowl</h2><span class="rule"></span><span class="subnote">Assemble 1 → 4</span></summary>
    <div class="secbody"><div class="build" id="body-build"></div></div>
  </details>

  <details class="sec" open>
    <summary><span class="caret">›</span><h2>Prep Workflow</h2><span class="rule"></span><span class="subnote">For 4 portions</span></summary>
    <div class="secbody"><div class="flow" id="body-prep"></div></div>
  </details>

  <details class="sec" open>
    <summary><span class="caret">›</span><h2>Souper Cube Fill &amp; Freeze</h2><span class="rule"></span><span class="subnote">2-cup ×4</span></summary>
    <div class="secbody"><div class="band" id="body-cube"></div></div>
  </details>

  <details class="sec" open>
    <summary><span class="caret">›</span><h2>Nutrition</h2><span class="rule"></span><span class="subnote">Per 2-cup bowl · estimated</span></summary>
    <div class="secbody"><div id="body-nutri"></div></div>
  </details>

  <details class="sec" open>
    <summary><span class="caret">›</span><h2>Shopping List</h2><span class="rule"></span><span class="subnote">4 portions</span></summary>
    <div class="secbody"><div class="shop" id="body-shop"></div></div>
  </details>

  <details class="sec" open>
    <summary><span class="caret">›</span><h2>Make It Yours</h2><span class="rule"></span><span class="subnote">Batch · subs · boost · freeze</span></summary>
    <div class="secbody"><div id="body-notes"></div></div>
  </details>`;

// --- hub-specific CSS ---
const hubCss = `
  /* HUB */
  .lib-hero { display: grid; gap: 12px; padding-bottom: 22px; border-bottom: 2px solid var(--ink); margin-bottom: 22px; }
  .lib-hero h1 { margin: 0; font-size: clamp(34px, 6.5vw, 58px); line-height: .96; font-weight: 800; letter-spacing: -.02em; text-transform: uppercase; }
  .lib-hero h1 .lead { color: var(--chipotle); }
  .lib-hero .tagline { font-size: clamp(15.5px, 2.4vw, 18px); color: var(--ink-2); max-width: 62ch; line-height: 1.55; }
  .theme-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
  .theme-card { text-align: left; cursor: pointer; background: var(--surface); border: 1.5px solid var(--line); border-radius: var(--radius); padding: 18px; display: grid; gap: 7px; color: var(--ink); font-family: inherit; transition: border-color .14s ease, transform .14s ease, box-shadow .14s ease; }
  .theme-card:hover { transform: translateY(-3px); box-shadow: var(--shadow); border-color: var(--chipotle); }
  .theme-card .emoji { font-size: 30px; line-height: 1; }
  .theme-card .tno { font-family: var(--font-ui); font-size: 11px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; color: var(--ink-3); }
  .theme-card .tt { font-family: var(--font-display); font-weight: 800; text-transform: uppercase; font-size: 20px; line-height: 1.05; }
  .theme-card .tt .lead { color: var(--chipotle); display: block; font-size: 13.5px; letter-spacing: .02em; margin-top: 2px; }
  .theme-card .tstats { font-family: var(--font-mono); font-size: 12.5px; color: var(--ink-2); font-variant-numeric: tabular-nums; margin-top: 2px; }
  .theme-card .tstats .fib { color: var(--macro-fiber); font-weight: 700; }
  .theme-card .go { font-family: var(--font-ui); font-size: 12.5px; font-weight: 700; color: var(--chipotle); text-transform: uppercase; letter-spacing: .04em; margin-top: 3px; }
  .backbtn { font-family: var(--font-ui); font-weight: 700; font-size: 13px; color: var(--ink-2); background: var(--surface-2); border: 1px solid var(--line-strong); border-radius: 8px; padding: 8px 14px; cursor: pointer; margin-bottom: 10px; text-transform: uppercase; letter-spacing: .04em; }
  .backbtn:hover { border-color: var(--chipotle); color: var(--chipotle); }
  @media (max-width: 720px){ .theme-grid { grid-template-columns: repeat(2, 1fr); } }
  @media (max-width: 460px){ .theme-grid { grid-template-columns: 1fr; } }
`;

// --- body ---
const body = `<div class="wrap">
  <header class="lib-hero">
    <span class="eyebrow">Operation Health</span>
    <h1>Meal <span class="lead">Library</span></h1>
    <p class="tagline">Six freezer meals · 36 builds. Tap a meal for its full recipe card — ingredients, macros, Souper Cube fill, freeze &amp; reheat, and an exact shopping list, all driven by the build you pick.</p>
  </header>

  <div id="home">
    <div class="theme-grid" id="theme-grid"></div>
  </div>

  <div id="detail" hidden>
    <button class="backbtn" id="backbtn">← All themes</button>
    <header class="hero" id="d-hero"></header>
    <section class="picker">
      <div class="sec-head">
        <h2>Pick Your Build</h2>
        <span class="rule"></span>
        <span class="sec-note">Tap to switch — everything below updates</span>
      </div>
      <div class="tabs" id="var-tabs" role="tablist" aria-label="Meal variations"></div>
    </section>

${detailSections}
  </div>

  <footer>
    <span>Operation Health Meal Library · 6 meals · 36 builds</span>
    <span class="pills">
      <span class="pill">★ High protein</span>
      <span class="pill">★ High fiber</span>
      <span class="pill">★ Freezer-ready</span>
    </span>
  </footer>
</div>`;

// --- hub controller JS (uses the extracted render fns) ---
const hubJs = `
  var META = ${JSON.stringify(meta)};
  var THEMES = META.map(function (m) {
    return { id: m.id, no: m.no, emoji: m.emoji, title: m.title, lead: m.lead, tagline: m.tagline,
             data: JSON.parse(document.getElementById("data-" + m.id).textContent) };
  });
  function themeById(id) { return THEMES.filter(function (t) { return t.id === id; })[0]; }
  function statRange(vars, key) {
    var xs = vars.map(function (v) { return v.macros[key]; });
    var lo = Math.min.apply(null, xs), hi = Math.max.apply(null, xs);
    return lo === hi ? String(lo) : lo + "–" + hi;
  }

  function renderHome() {
    document.getElementById("theme-grid").innerHTML = THEMES.map(function (t) {
      var d = t.data, n = d.variations.length;
      return '<button class="theme-card" data-id="' + t.id + '" aria-label="Open ' + esc(t.title) + '">' +
        '<span class="emoji">' + t.emoji + '</span>' +
        '<span class="tno">Meal ' + t.no + '</span>' +
        '<span class="tt">' + esc(t.title) + '<span class="lead">' + esc(t.lead) + '</span></span>' +
        '<span class="tstats">' + n + ' builds · ' + statRange(d.variations, "protein") + 'g P · ' +
          '<span class="fib">' + statRange(d.variations, "fiber") + 'g fiber</span></span>' +
        '<span class="go">Open card →</span>' +
      '</button>';
    }).join("");
    Array.prototype.forEach.call(document.querySelectorAll(".theme-card"), function (btn) {
      btn.addEventListener("click", function () { selectTheme(btn.getAttribute("data-id")); });
    });
  }

  function renderDetailHero(t) {
    var d = t.data, r = d.reheatMin;
    document.getElementById("d-hero").innerHTML =
      '<span class="eyebrow">Operation Health · Meal Library · Meal ' + t.no + '</span>' +
      '<h1>' + esc(t.title) + '<span class="lead">' + esc(t.lead) + '</span></h1>' +
      '<p class="tagline">' + t.tagline + '</p>' +
      '<div class="meta">' +
        '<span>Makes <b>' + d.servings + '</b> portions</span>' +
        '<span>Prep <b>' + d.prepMin + '</b> min</span>' +
        '<span>Cook <b>' + d.cookMin + '</b> min</span>' +
        '<span>Freezes <b>' + d.freezeMonths + '</b> mo</span>' +
        '<span>Reheat <b>' + r[0] + '–' + r[1] + '</b> min</span>' +
      '</div>' +
      '<span class="thesis">Build it · Freeze it · Fuel your goals</span>';
  }

  function selectTheme(id) {
    var t = themeById(id); if (!t) return;
    MEAL = t.data;
    state.themeId = id;
    state.vid = (MEAL.variations.filter(function (v) { return v.featured; })[0] || MEAL.variations[0]).id;
    renderDetailHero(t);
    renderNotes();
    update();
    document.getElementById("home").hidden = true;
    document.getElementById("detail").hidden = false;
    if (window.scrollTo) window.scrollTo(0, 0);
  }
  function showHome() {
    document.getElementById("detail").hidden = true;
    document.getElementById("home").hidden = false;
    if (window.scrollTo) window.scrollTo(0, 0);
  }

  document.getElementById("backbtn").addEventListener("click", showHome);
  renderHome();
`;

const out =
`<title>Operation Health · Meal Library</title>
<style>${css}${hubCss}</style>

${body}

<!-- ============================================================= -->
<!-- Six canonical meal models — same #meal-data payloads as the    -->
<!-- standalone cards; the app's Meal Library can import these.      -->
<!-- ============================================================= -->
${islands.join("\n")}

<script>
(function () {
  "use strict";
  var MEAL = null;
  var state = { themeId: null, vid: null };
${fns}
${hubJs}
})();
</script>
`;

fs.writeFileSync("meal-library.html", out);
console.log("Wrote meal-library.html (" + out.length + " bytes) with " + meta.length + " themes");
