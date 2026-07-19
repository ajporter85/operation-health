// Builds meal-library.html — a single self-contained hub that embeds all six
// theme datasets behind a theme switcher, reusing the exact card engine.
const fs = require("fs");

const THEMES = [
  { file: "southwest-hybrid-bowl.html", id: "southwest", emoji: "🌶️" },
  { file: "bbq-power-bowl.html",        id: "bbq",       emoji: "🍖" },
  { file: "loaded-potato-bowl.html",    id: "loaded",    emoji: "🥔" },
  { file: "burger-bowl.html",           id: "burger",    emoji: "🍔" },
  { file: "italian-bowl.html",          id: "italian",   emoji: "🍝" },
  { file: "chili-bowl.html",            id: "chili",      emoji: "🫘" },
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

  /* HUB NAV + VIEWS */
  .hubnav { display: flex; gap: 4px 20px; flex-wrap: wrap; margin-bottom: 26px; border-bottom: 2px solid var(--line-strong); }
  .navbtn { font-family: var(--font-display); font-weight: 800; text-transform: uppercase; letter-spacing: .02em; font-size: 14px; color: var(--ink-3); background: none; border: 0; border-bottom: 3px solid transparent; padding: 9px 2px; margin-bottom: -2px; cursor: pointer; }
  .navbtn:hover { color: var(--ink); }
  .navbtn.active { color: var(--chipotle); border-bottom-color: var(--chipotle); }

  /* STAPLES */
  .kitbox { font-family: var(--font-ui); font-size: 14.5px; color: var(--ink-2); background: color-mix(in srgb, var(--cactus) 10%, var(--surface)); border: 1px solid color-mix(in srgb, var(--cactus) 30%, var(--line)); border-radius: var(--radius-sm); padding: 14px 16px; line-height: 1.5; margin-bottom: 18px; }
  .kitbox b { color: var(--cactus-deep); }
  @media (prefers-color-scheme: dark){ .kitbox b { color: var(--cactus); } }
  :root[data-theme="dark"] .kitbox b { color: var(--cactus); }
  .smatrix-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }
  .smatrix { border-collapse: collapse; width: 100%; min-width: 560px; font-family: var(--font-ui); }
  .smatrix th, .smatrix td { padding: 9px 8px; text-align: center; border-bottom: 1px solid var(--line); }
  .smatrix thead th { font-size: 22px; line-height: 1; border-bottom: 2px solid var(--line-strong); }
  .smatrix thead th.item, .smatrix td.item { text-align: left; }
  .smatrix thead th.item { font-family: var(--font-display); font-size: 12.5px; text-transform: uppercase; letter-spacing: .05em; color: var(--ink-3); }
  .smatrix thead th.cov, .smatrix td.cov { font-family: var(--font-mono); font-size: 12px; color: var(--ink-3); }
  .smatrix .catrow td { background: var(--surface-2); font-family: var(--font-display); font-weight: 800; text-transform: uppercase; font-size: 12px; letter-spacing: .05em; text-align: left; color: var(--chipotle); }
  .smatrix td.item b { font-weight: 700; font-size: 14.5px; }
  .smatrix td.item .sprep { display: block; font-size: 12px; color: var(--ink-3); margin-top: 2px; line-height: 1.35; max-width: 40ch; }
  .smatrix .yes { color: var(--chipotle); font-weight: 800; }
  .smatrix .no { color: var(--line-strong); }
  .smatrix-foot { margin-top: 12px; font-family: var(--font-ui); font-size: 13px; color: var(--ink-3); line-height: 1.5; }

  /* FREEZE — sauce columns */
  .saucecols { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-top: 16px; }
  .scol { background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius-sm); padding: 16px 18px; }
  .scol h3 { margin: 0 0 10px; font-family: var(--font-display); font-size: 14px; text-transform: uppercase; letter-spacing: .03em; color: var(--chipotle); }
  .scol h3 .sub { display: block; font-family: var(--font-ui); font-size: 11.5px; font-weight: 600; letter-spacing: .04em; color: var(--ink-3); margin-top: 2px; }
  .saucelist { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; font-size: 14.5px; color: var(--ink-2); }
  .saucelist .mtag { font-size: 14px; }
  .saucelist .opt { color: var(--ink-3); }
  @media (max-width: 600px){ .saucecols { grid-template-columns: 1fr; } }

  /* BREAKFAST & SNACKS — day table */
  .daytable { width: 100%; border-collapse: collapse; font-family: var(--font-ui); margin: 2px 0 4px; }
  .daytable th, .daytable td { padding: 9px 10px; border-bottom: 1px solid var(--line); text-align: right; font-variant-numeric: tabular-nums; }
  .daytable th:first-child, .daytable td:first-child { text-align: left; }
  .daytable thead th { font-family: var(--font-display); font-size: 12px; text-transform: uppercase; letter-spacing: .05em; color: var(--ink-3); }
  .daytable .tot td { font-weight: 800; border-top: 2px solid var(--line-strong); border-bottom: 0; }
  .daytable .tgt td { color: var(--ink-3); font-size: 13px; }
`;

// --- body ---
const body = `<div class="wrap">
  <header class="lib-hero">
    <span class="eyebrow">Operation Health</span>
    <h1>Meal <span class="lead">Library</span></h1>
    <p class="tagline">Six freezer meals · 36 builds. Tap a meal for its full recipe card — ingredients, macros, Souper Cube fill, freeze &amp; reheat, and an exact shopping list, all driven by the build you pick.</p>
  </header>

  <nav class="hubnav" id="hubnav">
    <button class="navbtn active" type="button" data-view="meals">Meals</button>
    <button class="navbtn" type="button" data-view="staples">Prep-Ahead Staples</button>
    <button class="navbtn" type="button" data-view="freeze">Freeze &amp; Reheat</button>
    <button class="navbtn" type="button" data-view="fuel">Round Out the Day</button>
  </nav>

  <div class="view" id="view-meals">
  <div id="home">
    <div class="theme-grid" id="theme-grid"></div>
  </div>

  <div id="detail" hidden>
    <button class="backbtn" id="backbtn">← All meals</button>
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
  </div>

  <div class="view" id="view-staples" hidden><div id="staples-body"></div></div>
  <div class="view" id="view-freeze" hidden><div id="freeze-body"></div></div>
  <div class="view" id="view-fuel" hidden><div id="fuel-body"></div></div>

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
        '<span>Makes <b>' + d.servings + '</b> meals · <b>~3</b> cups</span>' +
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

  // ---------- Prep-Ahead Staples ----------
  function mealText(d) {
    var parts = [String(d.grain || "")];
    (d.defaults.base || []).forEach(function (b) { parts.push(b.item); });
    d.variations.forEach(function (v) {
      parts.push(v.protein.name);
      if (v.overrides && v.overrides.base) v.overrides.base.forEach(function (b) { parts.push(b.item); });
    });
    return parts.join(" | ").toLowerCase();
  }
  var STAPLES = [
    { cat: "Grains & starches", items: [
      { label: "Brown rice", kw: ["rice"], prep: "Cook a big pot; freezes better than white. Portion in 1-cup molds." },
      { label: "Quinoa", kw: ["quinoa"], prep: "Batch-cook, cool, freeze in 1-cup molds." },
      { label: "Whole-grain pasta", kw: ["pasta", "penne", "rotini"], prep: "Boil just shy of al dente; oil lightly so it doesn't clump." },
      { label: "Roast-ahead potatoes", kw: ["potato"], prep: "Cube & roast crisp (white or sweet); re-crisp in the air fryer." }
    ]},
    { cat: "Proteins — batch-cook, 1-cup molds", items: [
      { label: "Chicken (grilled or shredded)", kw: ["chicken"], prep: "Cook a big batch, portion ~5 oz; drops into most meals." },
      { label: "Beef (ground or brisket)", kw: ["beef"], prep: "Brown seasoned crumbles or slow-cook brisket; freeze flat in portions." },
      { label: "Turkey (ground or sliced)", kw: ["turkey"], prep: "Brown ground turkey, roll meatballs, or roast/smoke a breast; freeze ~5 oz portions." },
      { label: "Plant protein (beans / lentils / tofu)", kw: ["black bean burger", "lentil", "tofu", "tempeh", "three-bean", "edamame"], prep: "Cook & freeze bean or lentil mixes, or crisp tofu." }
    ]},
    { cat: "Beans & legumes — freeze great", items: [
      { label: "White beans (cannellini)", kw: ["white bean", "cannellini"], prep: "Drain, rinse; freeze in 1/3-cup scoops for instant fiber." },
      { label: "Black beans", kw: ["black bean"], prep: "Drain, rinse, season; freeze in scoops." },
      { label: "Pinto beans", kw: ["pinto"], prep: "Great mashed for body in a chili." },
      { label: "Chickpeas", kw: ["chickpea"], prep: "Roast or keep soft; they soften a little in the freezer." },
      { label: "Edamame", kw: ["edamame"], prep: "Keep a bag frozen — no prep, high protein." }
    ]},
    { cat: "Roasted vegetables", items: [
      { label: "Bell peppers", kw: ["pepper"], prep: "Roast or char in bulk; freeze in 1/2-cup portions." },
      { label: "Onions", kw: ["onion"], prep: "Caramelize a big batch; freezes beautifully." },
      { label: "Broccoli", kw: ["broccoli"], prep: "Roast firm so it reheats without going mushy." },
      { label: "Corn", kw: ["corn"], prep: "Char and freeze; adds smoky sweetness." },
      { label: "Zucchini", kw: ["zucchini"], prep: "Roast with a char (holds up better than raw)." },
      { label: "Mushrooms", kw: ["mushroom"], prep: "Sauté deeply browned before freezing." }
    ]}
  ];
  function renderStaples() {
    var texts = {};
    THEMES.forEach(function (t) { texts[t.id] = mealText(t.data); });
    function has(t, kw) { var x = texts[t.id]; return kw.some(function (k) { return x.indexOf(k) >= 0; }); }
    var headCells = THEMES.map(function (t) { return '<th title="' + esc(t.title) + '">' + t.emoji + '</th>'; }).join("");
    var rows = "", kit = [];
    STAPLES.forEach(function (cat) {
      rows += '<tr class="catrow"><td colspan="' + (THEMES.length + 2) + '">' + esc(cat.cat) + '</td></tr>';
      var items = cat.items.map(function (it) {
        return { it: it, cov: THEMES.filter(function (t) { return has(t, it.kw); }) };
      }).sort(function (a, b) { return b.cov.length - a.cov.length; });
      items.forEach(function (o) {
        if (o.cov.length >= 3) kit.push(o.it.label);
        rows += '<tr><td class="item"><b>' + esc(o.it.label) + '</b><span class="sprep">' + esc(o.it.prep) + '</span></td>' +
          THEMES.map(function (t) { return has(t, o.it.kw) ? '<td class="yes">✓</td>' : '<td class="no">·</td>'; }).join("") +
          '<td class="cov">' + o.cov.length + '</td></tr>';
      });
    });
    document.getElementById("staples-body").innerHTML =
      '<header class="lib-hero" style="margin-bottom:16px"><span class="eyebrow">Prep-Ahead Staples</span>' +
        '<h1 style="font-size:clamp(28px,5vw,44px)">Cook once, <span class="lead">eat all month</span></h1>' +
        '<p class="tagline">The components that repeat across the six meals. Batch-cook and freeze these and most bowls become assemble-only — no cooking from scratch.</p></header>' +
      '<div class="kitbox"><b>Freezer starter kit</b> — the highest-leverage staples (used in 3+ meals): ' +
        (kit.length ? esc(kit.join(", ")) : "—") + '. Keep these on hand and you’ve got the backbone of every meal in the library.</div>' +
      '<div class="smatrix-wrap"><table class="smatrix"><thead><tr><th class="item">Staple</th>' + headCells + '<th class="cov">#</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
      '<p class="smatrix-foot">✓ = used in that meal (across its builds). Freeze components in your <b>1-cup molds</b> so you can mix &amp; match into any bowl without re-cooking.</p>';
  }

  // ---------- Freeze & Reheat ----------
  function renderFreeze() {
    var m = THEMES[0].data.molds;
    var freeze = [], fresh = [];
    THEMES.forEach(function (t) {
      var s = t.data.sauces || {};
      Object.keys(s).forEach(function (k) {
        var o = s[k], row = "<li>" + esc(o.name) + ' <span class="mtag" title="' + esc(t.title) + '">' + t.emoji + "</span></li>";
        (o.freezes ? freeze : fresh).push(row);
      });
    });
    function fcard(h, p) { return '<div class="freeze-card"><h3>' + h + "</h3><p>" + p + "</p></div>"; }
    document.getElementById("freeze-body").innerHTML =
      '<header class="lib-hero" style="margin-bottom:16px"><span class="eyebrow">Freeze &amp; Reheat</span>' +
        '<h1 style="font-size:clamp(28px,5vw,44px)">Fill · freeze · <span class="lead">reheat</span></h1>' +
        '<p class="tagline">One system for the whole library — every meal freezes ~3 months and reheats in 4–6 minutes.</p></header>' +
      '<div class="freeze-strip">' +
        '<div class="freeze-card"><h3>The mold system</h3><ul class="fill-list" style="margin-top:6px">' +
          '<li><span class="q amt">' + m.assembled.count + '× 2-cup</span> ' + esc(m.assembled.use) + '</li>' +
          '<li><span class="q amt">' + m.component.count + '× 1-cup</span> ' + esc(m.component.use) + '</li>' +
          '<li><span class="q amt">' + m.sauce.count + '× 2-Tbsp</span> ' + esc(m.sauce.use) + '</li>' +
        '</ul></div>' +
        fcard("Freeze", 'Cool cubes completely (fridge ~1 hr) <b>before</b> the freezer so they don’t ice-crystal. Fill warm-not-hot to the line, press out air, pop out when solid, then bag and label <b>protein + date</b>. Keep up to <span class="big">3 months</span>; oldest first.') +
        fcard("Reheat", 'Reheat a meal cube <span class="big">4–6 min</span> from frozen — microwave stirring halfway, or a covered pan. Then add the sauce and fresh toppings.') +
        fcard("Add fresh, not frozen", 'Avocado, cheese, herbs, pickles, greens & citrus go on <b>after</b> reheating — they keep the bowl bright and stop the frozen portion going soggy.') +
      '</div>' +
      '<div class="saucecols">' +
        '<div class="scol"><h3>Sauces that freeze <span class="sub">portion in 2-Tbsp molds</span></h3><ul class="saucelist">' + (freeze.length ? freeze.join("") : "<li>—</li>") + '</ul></div>' +
        '<div class="scol"><h3>Make fresh <span class="sub">fridge ~1 week, add at serving</span></h3><ul class="saucelist">' + (fresh.length ? fresh.join("") : "<li>—</li>") + '</ul></div>' +
      '</div>';
  }

  // ---------- Breakfast & Snacks ----------
  function renderFuel() {
    function mc(v, cls) { return '<span class="mc ' + cls + '">' + v + "</span>"; }
    function row(label, kcal, p, fib, cls) {
      return "<tr" + (cls ? ' class="' + cls + '"' : "") + "><td>" + label + "</td><td>" + kcal +
        "</td><td>" + mc(p, "prot") + "</td><td>" + mc(fib, "fib") + "</td></tr>";
    }
    var table = '<table class="daytable"><thead><tr><th>Meal</th><th>kcal</th><th>protein</th><th>fiber</th></tr></thead><tbody>' +
      row("Breakfast — light", "~450", "~48 g", "~10 g") +
      row("Lunch — 3-cup cube", "~800", "~56 g", "~16 g") +
      row("Dinner — 3-cup cube", "~800", "~56 g", "~16 g") +
      row("Snack", "~300", "~15 g", "~5 g") +
      row("Psyllium — 2 scoops, pre-lunch &amp; dinner", "~35", "—", "~7 g") +
      row("<b>Day total</b>", "<b>~2,385</b>", "<b>~175 g</b>", "<b>~54 g</b>", "tot") +
      row("Your target", "~2,400", "~170 g", "high", "tgt") +
      "</tbody></table>";
    var breakfast = '<div class="scol"><h3>Build-your-own breakfast <span class="sub">~450 kcal · ~48g protein · covers the 30–40g morning rule</span></h3><ul class="saucelist">' +
      "<li><b>Protein shake</b> — 1 scoop (24g protein, 120 kcal) with milk or water</li>" +
      "<li><b>+ Greek yogurt</b> ¾ cup (~15g P) — or cottage cheese</li>" +
      "<li><b>+ Fruit</b> — berries or half a banana</li>" +
      "<li><b>+ Chia or ground flax</b> 1 Tbsp — fiber &amp; omega-3</li>" +
      '<li class="opt">Optional: a little oats or granola for more staying power</li>' +
      "</ul></div>";
    var snacks = '<div class="scol"><h3>Snacks <span class="sub">~150–300 kcal, protein-forward — pick one or two</span></h3><ul class="saucelist">' +
      "<li>Edamame, 1 cup — ~17g protein, high fiber</li>" +
      "<li>Cottage cheese + fruit</li>" +
      "<li>Turkey stick or jerky</li>" +
      "<li>Roasted chickpeas</li>" +
      "<li>A second protein shake</li>" +
      "<li>Two hard-boiled eggs</li>" +
      "<li>Apple + 1 Tbsp peanut butter</li>" +
      "<li>Small handful of almonds</li>" +
      "</ul></div>";
    document.getElementById("fuel-body").innerHTML =
      '<header class="lib-hero" style="margin-bottom:16px"><span class="eyebrow">Around the meals</span>' +
        '<h1 style="font-size:clamp(28px,5vw,44px)">Round out <span class="lead">the day</span></h1>' +
        '<p class="tagline">Your two cube meals cover lunch and dinner. This is everything around them — a light, protein-forward breakfast, a snack or two, and your psyllium — sized to round the day out to your protein, fiber and calorie targets, and to land 30–40g of protein within 30 minutes of waking.</p></header>' +
      '<div class="kitbox"><b>The plan:</b> two 3-cup cube meals do the heavy lifting; breakfast stays light and a snack or two tops you off.</div>' +
      table +
      '<div class="saucecols" style="margin-top:18px">' + breakfast + snacks + "</div>" +
      '<div class="kitbox" style="margin-top:16px"><b>Psyllium:</b> 1 scoop in water before lunch and before dinner (2 scoops/day) — ~7g fiber for ~35 kcal, plus fullness. &nbsp;<b>Hydration:</b> aim for 3–4 L water across the day.</div>';
  }

  // ---------- view switching ----------
  function showView(v) {
    state.view = v;
    document.getElementById("view-meals").hidden = v !== "meals";
    document.getElementById("view-staples").hidden = v !== "staples";
    document.getElementById("view-freeze").hidden = v !== "freeze";
    document.getElementById("view-fuel").hidden = v !== "fuel";
    Array.prototype.forEach.call(document.querySelectorAll(".navbtn"), function (b) {
      b.className = "navbtn" + (b.getAttribute("data-view") === v ? " active" : "");
    });
    if (v === "staples") renderStaples();
    else if (v === "freeze") renderFreeze();
    else if (v === "fuel") renderFuel();
    else showHome();
    if (window.scrollTo) window.scrollTo(0, 0);
  }
  Array.prototype.forEach.call(document.querySelectorAll(".navbtn"), function (b) {
    b.addEventListener("click", function () { showView(b.getAttribute("data-view")); });
  });

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
  var state = { view: "meals", themeId: null, vid: null };
${fns}
${hubJs}
})();
</script>
`;

fs.writeFileSync("meal-library.html", out);
console.log("Wrote meal-library.html (" + out.length + " bytes) with " + meta.length + " themes");
