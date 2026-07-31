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
  { file: "cajun-bowl.html",            id: "cajun",     emoji: "⚜️" },
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
["function renderTabs", "function renderNotes", "function update", "function renderBowl", "function renderShop"].forEach(k => {
  if (fns.indexOf(k) === -1) { console.error("extraction lost " + k); process.exit(1); }
});
if (/document\.getElementById\("meal-data"\)/.test(fns)) { console.error("meal-data ref still present"); process.exit(1); }

// --- per-theme meta + data ---
const meta = [];
const islands = [];
let totalBuilds = 0;
THEMES.forEach(t => {
  const h = fs.readFileSync(t.file, "utf8");
  const jsonTxt = h.match(/id="meal-data">([\s\S]*?)<\/script>/)[1].trim();
  totalBuilds += JSON.parse(jsonTxt).variations.length; // validate + count
  const tagline = h.match(/<p class="tagline">([\s\S]*?)<\/p>/)[1].trim();
  const h1 = h.match(/<h1>([\s\S]*?)<span class="lead">([\s\S]*?)<\/span><\/h1>/);
  const no = h.match(/Meal Library · Meal (\d+)/)[1];
  meta.push({ id: t.id, no: no, emoji: t.emoji, title: h1[1].trim(), lead: h1[2].trim(), tagline: tagline });
  islands.push('<script type="application/json" class="theme-data" id="data-' + t.id + '">\n' + jsonTxt + '\n</script>');
});

// --- the 6 collapsible detail sections (verbatim from a theme card) ---
const detailSections = `  <details class="sec" open>
    <summary><span class="caret">›</span><h2 id="h-bowl">In One Bowl</h2><span class="rule"></span><span class="subnote" id="sub-bowl">~3 cups · one meal</span></summary>
    <div class="secbody"><div class="build" id="body-bowl"></div></div>
  </details>

  <details class="sec" open id="sec-shop">
    <summary><span class="caret">›</span><h2>Shopping List</h2><span class="rule"></span><span class="subnote" id="sub-shop">Buy for 4 meals</span></summary>
    <div class="secbody"><div id="body-shop"></div></div>
  </details>

  <details class="sec" open>
    <summary><span class="caret">›</span><h2>Prep Workflow</h2><span class="rule"></span><span class="subnote" id="sub-prep">For 4 meals</span></summary>
    <div class="secbody"><div class="flow" id="body-prep"></div></div>
  </details>

  <details class="sec" open>
    <summary><span class="caret">›</span><h2>Nutrition</h2><span class="rule"></span><span class="subnote" id="sub-nutri">Per 3-cup meal · estimated</span></summary>
    <div class="secbody"><div id="body-nutri"></div></div>
  </details>

  <details class="sec" open id="sec-swaps">
    <summary><span class="caret">›</span><h2>Swaps &amp; Boosts</h2><span class="rule"></span><span class="subnote">Make it yours</span></summary>
    <div class="secbody"><div id="body-notes"></div></div>
  </details>`;

// --- snacks (own data file — there's no card to extract them from) ---
const snackTxt = fs.readFileSync("snack-data.json", "utf8").trim();
const snackData = JSON.parse(snackTxt); // validate
const snackCount = snackData.snacks.length;
islands.push('<script type="application/json" id="snack-data">\n' + snackTxt + "\n</script>");

// --- hub-specific CSS ---
const hubCss = `
  /* HUB */
  .lib-hero { display: grid; gap: 12px; padding-bottom: 22px; border-bottom: 2px solid var(--ink); margin-bottom: 22px; }
  .lib-hero h1 { margin: 0; font-size: var(--t-hero); line-height: .96; font-weight: 800; letter-spacing: -.02em; text-transform: uppercase; }
  .lib-hero h1 .lead { color: var(--chipotle); }
  .lib-hero .tagline { font-size: var(--t-lead); color: var(--ink-2); max-width: 62ch; line-height: 1.55; }
  .theme-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
  .theme-card { text-align: left; cursor: pointer; background: var(--surface); border: 1.5px solid var(--line); border-radius: var(--radius); padding: 18px; display: grid; gap: 7px; color: var(--ink); font-family: inherit; transition: border-color .14s ease, transform .14s ease, box-shadow .14s ease; }
  .theme-card:hover { transform: translateY(-3px); box-shadow: var(--shadow); border-color: var(--chipotle); }
  .theme-card .emoji { font-size: 30px; line-height: 1; }
  .theme-card .tno { font-family: var(--font-ui); font-size: var(--t-micro); font-weight: 700; letter-spacing: .1em; text-transform: uppercase; color: var(--ink-3); }
  .theme-card .tt { font-family: var(--font-display); font-weight: 800; text-transform: uppercase; font-size: var(--t-h3); line-height: 1.05; }
  .theme-card .tt .lead { color: var(--chipotle); display: block; font-size: var(--t-label); letter-spacing: .02em; margin-top: 2px; }
  .theme-card .tstats { font-family: var(--font-mono); font-size: var(--t-data); color: var(--ink-2); font-variant-numeric: tabular-nums; margin-top: 2px; }
  .theme-card .tstats .fib { color: var(--macro-fiber); font-weight: 700; }
  .theme-card .go { font-family: var(--font-ui); font-size: var(--t-label); font-weight: 700; color: var(--chipotle); text-transform: uppercase; letter-spacing: .04em; margin-top: 3px; }
  .backbtn { font-family: var(--font-ui); font-weight: 700; font-size: var(--t-label); color: var(--ink-2); background: var(--surface-2); border: 1px solid var(--line-strong); border-radius: 8px; padding: 8px 14px; cursor: pointer; margin-bottom: 10px; text-transform: uppercase; letter-spacing: .04em; }
  .backbtn:hover { border-color: var(--chipotle); color: var(--chipotle); }
  @media (max-width: 720px){ .theme-grid { grid-template-columns: repeat(2, 1fr); } }
  @media (max-width: 460px){ .theme-grid { grid-template-columns: 1fr; } }

  .lib-hero.sub h1 { font-size: var(--t-hero-sub); }
  .scolp { font-family: var(--font-ui); font-size: var(--t-body); color: var(--ink-2); line-height: 1.55; margin: 0; }

  /* HUB NAV + VIEWS */
  .hubnav { display: flex; gap: 4px 20px; flex-wrap: wrap; margin-bottom: 26px; border-bottom: 2px solid var(--line-strong); }
  .navbtn { font-family: var(--font-display); font-weight: 800; text-transform: uppercase; letter-spacing: .02em; font-size: var(--t-body); color: var(--ink-3); background: none; border: 0; border-bottom: 3px solid transparent; padding: 9px 2px; margin-bottom: -2px; cursor: pointer; }
  .navbtn:hover { color: var(--ink); }
  .navbtn.active { color: var(--chipotle); border-bottom-color: var(--chipotle); }

  /* STAPLES */
  .kitbox { font-family: var(--font-ui); font-size: var(--t-body); color: var(--ink-2); background: color-mix(in srgb, var(--cactus) 10%, var(--surface)); border: 1px solid color-mix(in srgb, var(--cactus) 30%, var(--line)); border-radius: var(--radius-sm); padding: 14px 16px; line-height: 1.5; margin-bottom: 18px; }
  .kitbox b { color: var(--cactus-deep); }
  @media (prefers-color-scheme: dark){ .kitbox b { color: var(--cactus); } }
  :root[data-theme="dark"] .kitbox b { color: var(--cactus); }
  .smatrix-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }
  .smatrix { border-collapse: collapse; width: 100%; min-width: 560px; font-family: var(--font-ui); }
  .smatrix th, .smatrix td { padding: 9px 8px; text-align: center; border-bottom: 1px solid var(--line); }
  .smatrix thead th { font-size: 22px; line-height: 1; border-bottom: 2px solid var(--line-strong); }
  .smatrix thead th.item, .smatrix td.item { text-align: left; }
  .smatrix thead th.item { font-family: var(--font-display); font-size: var(--t-label); text-transform: uppercase; letter-spacing: .05em; color: var(--ink-3); }
  .smatrix thead th.cov, .smatrix td.cov { font-family: var(--font-mono); font-size: var(--t-label); color: var(--ink-3); }
  .smatrix .catrow td { background: var(--surface-2); font-family: var(--font-display); font-weight: 800; text-transform: uppercase; font-size: var(--t-label); letter-spacing: .05em; text-align: left; color: var(--chipotle); }
  .smatrix td.item b { font-weight: 700; font-size: var(--t-body); }
  .smatrix td.item .sprep { display: block; font-size: var(--t-body-sm); color: var(--ink-3); margin-top: 2px; line-height: 1.35; max-width: 40ch; }
  .smatrix .yes { color: var(--chipotle); font-weight: 800; }
  .smatrix .no { color: var(--line-strong); }
  .smatrix-foot { margin-top: 12px; font-family: var(--font-ui); font-size: var(--t-body-sm); color: var(--ink-3); line-height: 1.5; }

  /* FREEZE — sauce columns */
  .saucecols { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-top: 16px; }
  .scol { background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius-sm); padding: 16px 18px; }
  .scol h3 { margin: 0 0 10px; font-family: var(--font-display); font-size: var(--t-h3); text-transform: uppercase; letter-spacing: .03em; color: var(--chipotle); }
  .scol h3 .sub { display: block; font-family: var(--font-ui); font-size: var(--t-label); font-weight: 600; letter-spacing: .04em; color: var(--ink-3); margin-top: 2px; }
  .saucelist { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; font-size: var(--t-body); color: var(--ink-2); }
  .saucelist .mtag { font-size: var(--t-body); }
  .saucelist .opt { color: var(--ink-3); }
  @media (max-width: 600px){ .saucecols { grid-template-columns: 1fr; } }

  /* SNACKS */
  .sortbar { margin: 0 0 22px; }
  .sortlab { font-family: var(--font-display); font-size: var(--t-label); font-weight: 800; text-transform: uppercase; letter-spacing: .1em; color: var(--ink-3); display: block; margin-bottom: 7px; }
  .sortseg { display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px; }
  .sortbtn { font-family: var(--font-display); font-weight: 800; text-transform: uppercase; letter-spacing: .02em; font-size: var(--t-body-sm); color: var(--ink-2); background: var(--surface); border: 1.5px solid var(--line-strong); border-radius: var(--radius-sm); padding: 10px 6px; cursor: pointer; transition: background .14s ease, color .14s ease, border-color .14s ease; }
  .sortbtn:hover { border-color: var(--chipotle); color: var(--chipotle); }
  .sortbtn.on { background: var(--chipotle); border-color: var(--chipotle); color: #fff; }
  @media (max-width: 900px){ .sortseg { grid-template-columns: repeat(3, 1fr); } }
  @media (max-width: 620px){ .sortseg { grid-template-columns: repeat(2, 1fr); } }

  .slegend { display: flex; gap: 8px 22px; flex-wrap: wrap; font-family: var(--font-ui); font-size: var(--t-body-sm); color: var(--ink-2); background: var(--surface-2); border: 1px solid var(--line); border-radius: var(--radius-sm); padding: 12px 15px; margin: 0 0 22px; line-height: 1.5; }
  .slegend span { white-space: nowrap; }
  .slegend .lg-ico { font-size: 16px; }
  .slegend b { color: var(--ink); }

  .sgroup { margin-bottom: 26px; }
  .sgroup > .sghead { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; border-bottom: 2px solid var(--line-strong); padding-bottom: 7px; margin-bottom: 12px; }
  .sgroup > .sghead h3 { margin: 0; font-family: var(--font-display); font-weight: 800; text-transform: uppercase; font-size: var(--t-h3); letter-spacing: .01em; }
  .sgroup > .sghead .sgn { font-family: var(--font-mono); font-size: var(--t-label); color: var(--ink-3); }
  .sgroup > .sghead .sgblurb { flex: 1 1 100%; font-family: var(--font-ui); font-size: var(--t-body-sm); color: var(--ink-2); line-height: 1.5; }

  .snack { background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius-sm); margin-bottom: 8px; }
  .snack > summary { padding: 12px 14px; }
  .snack > .sbody { padding: 0 14px 14px; }
  .snack > .sbody.solo { padding: 12px 14px; }
  .snack > summary { cursor: pointer; list-style: none; }
  .snack > summary::-webkit-details-marker { display: none; }
  .snack > summary::after { content: "▸ details"; display: block; font-family: var(--font-ui); font-size: var(--t-label); font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: var(--chipotle); margin-top: 8px; }
  .snack[open] > summary::after { content: "▾ close"; }
  .snack:hover { border-color: var(--line-strong); }
  .s-top { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; }
  .s-name { font-family: var(--font-display); font-weight: 800; text-transform: uppercase; font-size: var(--t-h3); letter-spacing: .01em; }
  .s-star { color: var(--chipotle); font-size: 15px; }
  .s-where { font-size: 17px; letter-spacing: 3px; margin-left: auto; }
  .s-portion { font-family: var(--font-ui); font-size: var(--t-body-sm); color: var(--ink-3); margin-top: 3px; line-height: 1.45; }
  .s-macros { font-family: var(--font-mono); font-size: var(--t-data); margin-top: 8px; display: flex; gap: 9px; flex-wrap: wrap; align-items: baseline; font-variant-numeric: tabular-nums; }
  .s-kcal { font-weight: 800; }
  .na { font-weight: 700; }
  .na.lo { color: var(--macro-fiber); }
  .na.mid { color: var(--macro-carb); }
  .na.hi { color: var(--chipotle); }
  .s-note { font-family: var(--font-ui); font-size: var(--t-body); color: var(--ink-2); line-height: 1.55; margin: 9px 0 0; }
  .s-tip { font-family: var(--font-ui); font-size: var(--t-body); color: var(--ink-2); line-height: 1.55; background: var(--surface-2); border-left: 3px solid var(--chipotle); border-radius: 0 6px 6px 0; padding: 9px 12px; margin: 10px 0 0; }
  .s-link { display: inline-block; font-family: var(--font-ui); font-size: var(--t-label); font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: var(--chipotle); background: none; border: 0; padding: 0; margin-top: 10px; cursor: pointer; }
  .s-link:hover { text-decoration: underline; }

  /* MAKE YOUR OWN */
  .myo { background: var(--surface); border: 1.5px solid var(--line-strong); border-radius: var(--radius); margin-bottom: 12px; }
  .myo > summary { cursor: pointer; list-style: none; padding: 16px 18px; display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; }
  .myo > summary::-webkit-details-marker { display: none; }
  .myo .myo-ico { font-size: 26px; line-height: 1; }
  .myo .myo-name { font-family: var(--font-display); font-weight: 800; text-transform: uppercase; font-size: var(--t-h2); }
  .myo .myo-time { font-family: var(--font-mono); font-size: var(--t-data); color: var(--ink-3); margin-left: auto; }
  .myo .myo-body { padding: 0 18px 18px; }
  .myo .myo-why { font-family: var(--font-ui); font-size: var(--t-body); color: var(--ink-2); line-height: 1.6; margin: 0 0 12px; }
  .myo .myo-yield { font-family: var(--font-mono); font-size: var(--t-data); color: var(--ink-3); margin: 0 0 12px; }
  .myo .myo-warn { font-family: var(--font-ui); font-size: var(--t-body); line-height: 1.55; background: color-mix(in srgb, var(--chipotle) 10%, var(--surface)); border: 1px solid color-mix(in srgb, var(--chipotle) 32%, var(--line)); border-radius: var(--radius-sm); padding: 11px 13px; margin: 0 0 14px; color: var(--ink-2); }
  .myo h4 { font-family: var(--font-display); font-size: var(--t-label); text-transform: uppercase; letter-spacing: .07em; color: var(--ink-3); margin: 14px 0 7px; }
  .myo ul, .myo ol { margin: 0; padding-left: 22px; display: grid; gap: 8px; font-family: var(--font-ui); font-size: var(--t-body); color: var(--ink-2); line-height: 1.55; }

  /* BREAKFAST & SNACKS — day table */
  .daytable { width: 100%; min-width: 540px; border-collapse: collapse; font-family: var(--font-ui); margin: 2px 0 4px; }
  .daytable th, .daytable td { padding: 9px 10px; border-bottom: 1px solid var(--line); text-align: right; font-variant-numeric: tabular-nums; }
  .daytable th:first-child, .daytable td:first-child { text-align: left; }
  .daytable thead th { font-family: var(--font-display); font-size: var(--t-label); text-transform: uppercase; letter-spacing: .05em; color: var(--ink-3); }
  .daytable .tot td { font-weight: 800; border-top: 2px solid var(--line-strong); border-bottom: 0; }
  .daytable .tgt td { color: var(--ink-3); font-size: var(--t-data); }
`;

// --- body ---
const body = `<div class="wrap">
  <header class="lib-hero">
    <span class="eyebrow">Operation Health</span>
    <h1>Meal <span class="lead">Library</span></h1>
    <p class="tagline">Six freezer meals · ${totalBuilds} builds. Tap a meal for its full recipe card — ingredients, macros, Souper Cube fill, freeze &amp; reheat, and an exact shopping list, all driven by the build you pick.</p>
  </header>

  <nav class="hubnav" id="hubnav">
    <button class="navbtn active" type="button" data-view="meals">Meals</button>
    <button class="navbtn" type="button" data-view="staples">Prep-Ahead Staples</button>
    <button class="navbtn" type="button" data-view="freeze">Freeze &amp; Reheat</button>
    <button class="navbtn" type="button" data-view="fuel">Round Out the Day</button>
    <button class="navbtn" type="button" data-view="snacks">Snacks</button>
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

    <div class="modebar" id="modebar"></div>

${detailSections}
  </div>
  </div>

  <div class="view" id="view-staples" hidden><div id="staples-body"></div></div>
  <div class="view" id="view-freeze" hidden><div id="freeze-body"></div></div>
  <div class="view" id="view-fuel" hidden><div id="fuel-body"></div></div>
  <div class="view" id="view-snacks" hidden><div id="snacks-body"></div></div>

  <footer>
    <span>Operation Health Meal Library · ${meta.length} meals · ${totalBuilds} builds</span>
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
  // Grouped by the three pucks that make up every meal (+ sauce & fresh handled
  // as asides below the matrix, since those aren't batch-frozen the same way).
  var STAPLES = [
    { cat: "① Grain pucks — 1-cup molds", items: [
      { label: "Brown rice", kw: ["rice"], prep: "Cook a big pot; freezes better than white. Portion into 1-cup pucks." },
      { label: "Quinoa", kw: ["quinoa"], prep: "Batch-cook, cool, freeze in 1-cup pucks." },
      { label: "Whole-grain pasta", kw: ["pasta", "penne", "rotini"], prep: "Boil just shy of al dente; oil lightly so it doesn't clump." },
      { label: "Roast-ahead potatoes", kw: ["potato"], prep: "Cube & roast crisp (white or sweet); re-crisp in the air fryer." }
    ]},
    { cat: "② Protein pucks — 1-cup molds", items: [
      { label: "Chicken (grilled or shredded)", kw: ["chicken"], prep: "Cook a big batch, portion ~5 oz; drops into most meals." },
      { label: "Beef (ground or brisket)", kw: ["beef"], prep: "Brown seasoned crumbles or slow-cook brisket; freeze flat in portions." },
      { label: "Turkey (ground or sliced)", kw: ["turkey"], prep: "Brown ground turkey, roll meatballs, or roast/smoke a breast; freeze ~5 oz portions." },
      { label: "Plant protein (tofu / lentils / bean mix)", kw: ["black bean burger", "lentil", "tofu", "tempeh", "three-bean", "edamame"], prep: "Cook & freeze a bean or lentil mix, or crisp tofu — the protein puck for plant builds." }
    ]},
    { cat: "③ Veg & bean pucks — 1-cup molds", items: [
      { label: "White beans (cannellini)", kw: ["white bean", "cannellini"], prep: "Drain, rinse; freeze in 1/3-cup scoops for instant fiber." },
      { label: "Black beans", kw: ["black bean"], prep: "Drain, rinse, season; freeze in scoops." },
      { label: "Pinto beans", kw: ["pinto"], prep: "Great mashed for body in a chili." },
      { label: "Chickpeas", kw: ["chickpea"], prep: "Roast or keep soft; they soften a little in the freezer." },
      { label: "Edamame", kw: ["edamame"], prep: "Keep a bag frozen — no prep, high protein." },
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
      '<header class="lib-hero sub" style="margin-bottom:16px"><span class="eyebrow">Prep-Ahead Staples</span>' +
        '<h1>Cook once, <span class="lead">eat all month</span></h1>' +
        '<p class="tagline">Every meal is three 1-cup pucks + a sauce. These are the components that repeat across the six meals, grouped by those three pucks — batch-cook and freeze them and most meals become grab-and-reheat.</p></header>' +
      '<div class="kitbox"><b>Freezer starter kit</b> — the highest-leverage staples (used in 3+ meals): ' +
        (kit.length ? esc(kit.join(", ")) : "—") + '. Keep these on hand and you’ve got the backbone of every meal in the library.</div>' +
      '<div class="smatrix-wrap"><table class="smatrix"><thead><tr><th class="item">Staple</th>' + headCells + '<th class="cov">#</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
      '<p class="smatrix-foot">✓ = used in that meal (across its builds). Freeze each in a <b>1-cup mold</b>, then pop out and bag — three pucks + a sauce cube assemble into any meal without re-cooking.</p>' +
      '<div class="saucecols" style="margin-top:20px">' +
        '<div class="scol"><h3>The 4th component: sauce <span class="sub">2-Tbsp cubes, not 1-cup pucks</span></h3>' +
          '<p class="scolp">Each sauce freezes (or is made fresh) on its own and goes on at serving — it’s the flavor swap that turns the same three pucks into a different meal. Which sauces freeze vs. stay fridge-fresh is on the <b>Freeze &amp; Reheat</b> tab.</p></div>' +
        '<div class="scol"><h3>Not stocked: fresh toppings <span class="sub">never frozen</span></h3>' +
          '<p class="scolp">Avocado, cheese, herbs, citrus, pickles &amp; greens go on <b>after</b> reheating — keep them out of the freezer entirely so the meal stays bright.</p></div>' +
      '</div>';
  }

  // ---------- Freeze & Reheat ----------
  function renderFreeze() {
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
      '<header class="lib-hero sub" style="margin-bottom:16px"><span class="eyebrow">Freeze &amp; Reheat</span>' +
        '<h1>Fill · freeze · <span class="lead">reheat</span></h1>' +
        '<p class="tagline">One system for the whole library — freeze each part as a 1-cup puck, keep ~3 months, and reheat in 6–9 minutes.</p></header>' +
      '<div class="freeze-strip">' +
        '<div class="freeze-card"><h3>The mold system</h3><ul class="fill-list" style="margin-top:6px">' +
          '<li><span class="q amt">1-cup molds</span> component pucks — protein, grain &amp; veg (3 per meal)</li>' +
          '<li><span class="q amt">2-Tbsp molds</span> one sauce cube per meal</li>' +
        '</ul><p style="margin-top:8px">Freeze each component as its own 1-cup puck; three pucks + a sauce cube make one ~3-cup meal. Pop pucks out when solid and bag by type — the molds are throughput, not the storage limit. (Prefer to cook fresh? Each card has a <b>Cook Fresh</b> toggle for the fridge route.)</p></div>' +
        fcard("Freeze", 'Cool pucks completely (fridge ~1 hr) <b>before</b> the freezer so they don’t ice-crystal. Fill warm-not-hot to the line, press out air, pop out when solid, then bag and label <b>component + date</b>. Keep up to <span class="big">3 months</span>; oldest first.') +
        fcard("Reheat", 'Reheat the pucks together <span class="big">6–9 min</span> from frozen — microwave stirring halfway, or a covered pan. Then add the sauce and fresh toppings.') +
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
    // The cube-meal row is the LIVE average of every build in the library, so the
    // day plan can't drift from the actual recipes.
    var all = [];
    THEMES.forEach(function (t) { t.data.variations.forEach(function (v) { all.push(v.macros); }); });
    var K = ["kcal", "carbs", "protein", "fat", "fiber"];
    var agg = function (fn, k) { return fn(all.map(function (m) { return m[k]; })); };
    var avg = function (k) { return Math.round(agg(function (xs) { return xs.reduce(function (a, b) { return a + b; }, 0) / xs.length; }, k)); };
    var lo = function (k) { return agg(function (xs) { return Math.min.apply(null, xs); }, k); };
    var hi = function (k) { return agg(function (xs) { return Math.max.apply(null, xs); }, k); };
    var cube = {}; K.forEach(function (k) { cube[k] = avg(k); });

    var BREAKFAST = { kcal: 450, carbs: 35, protein: 48, fat: 12, fiber: 10 };
    var SNACKBLOCK = { kcal: 600, carbs: 50, protein: 30, fat: 28, fiber: 10 }; // two snacks
    var PSYLLIUM  = { kcal: 35,  carbs: 9,  protein: 0,  fat: 0,  fiber: 7 };
    var total = {}; K.forEach(function (k) { total[k] = BREAKFAST[k] + cube[k] * 2 + SNACKBLOCK[k] + PSYLLIUM[k]; });

    function row(label, m, cls) {
      return "<tr" + (cls ? ' class="' + cls + '"' : "") + "><td>" + label + "</td><td>" + m.kcal + "</td><td>" +
        mc(m.carbs, "carb") + "</td><td>" + mc(m.protein, "prot") + "</td><td>" +
        mc(m.fat, "fat") + "</td><td>" + mc(m.fiber, "fib") + "</td></tr>";
    }
    function disp(m) {
      return { kcal: "~" + m.kcal.toLocaleString(), carbs: "~" + m.carbs + " g", protein: "~" + m.protein + " g",
               fat: "~" + m.fat + " g", fiber: "~" + m.fiber + " g" };
    }
    var table = '<div class="smatrix-wrap"><table class="daytable"><thead><tr><th>Meal</th><th>kcal</th>' +
        '<th>carbs</th><th>protein</th><th>fat</th><th>fiber</th></tr></thead><tbody>' +
      row("Breakfast — light", disp(BREAKFAST)) +
      row("Lunch — cube meal", disp(cube)) +
      row("Dinner — cube meal", disp(cube)) +
      row("Snacks × 2", disp(SNACKBLOCK)) +
      row("Psyllium — 2 scoops", { kcal: "~35", carbs: "~9 g", protein: "—", fat: "—", fiber: "~7 g" }) +
      row("Day total", disp(total), "tot") +
      row("Your target", { kcal: "2,300–2,500", carbs: "~235–285 g", protein: "~170 g", fat: "~75 g", fiber: "high" }, "tgt") +
      "</tbody></table></div>" +
      '<p class="smatrix-foot">The cube-meal row is the live average of all ' + all.length + ' builds (range <b>' +
      lo("kcal") + "–" + hi("kcal") + " kcal</b>, " + lo("protein") + "–" + hi("protein") + " g protein, " +
      lo("fat") + "–" + hi("fat") + " g fat) — pick a lighter or richer build to steer the day. <b>Carbs have no fixed target:</b> they fill whatever calories protein and fat leave, which works out to ~235–285 g.</p>";
    var breakfast = '<div class="scol"><h3>Build-your-own breakfast <span class="sub">~450 kcal · ~48g protein · covers the 30–40g morning rule</span></h3><ul class="saucelist">' +
      "<li><b>Protein shake</b> — 1 scoop (24g protein, 120 kcal) with milk or water</li>" +
      "<li><b>+ Greek yogurt</b> ¾ cup (~15g P) — or cottage cheese</li>" +
      "<li><b>+ Fruit</b> — berries or half a banana</li>" +
      "<li><b>+ Chia or ground flax</b> 1 Tbsp — fiber &amp; omega-3</li>" +
      '<li class="opt">Optional: a little oats or granola for more staying power</li>' +
      "</ul></div>";
    // Pulled live from the Snacks tab so the two can't drift apart: the starred
    // picks, leanest first — those are the ones that clear the fat budget.
    var picks = SNACKS.snacks.filter(function (s) { return s.star; })
      .sort(function (a, b) { return a.macros.fat - b.macros.fat; }).slice(0, 6);
    var snacks = '<div class="scol"><h3>Snacks <span class="sub">~300 kcal each, protein-forward — the plan assumes two</span></h3><ul class="saucelist">' +
      picks.map(function (s) {
        return "<li><b>" + esc(s.name) + "</b> — " + s.macros.kcal + " kcal · " +
          s.macros.protein + "g protein · " + s.macros.fat + "g fat</li>";
      }).join("") +
      '<li class="opt">' + SNACKS.snacks.length + " options with full macros on the <b>Snacks</b> tab →</li>" +
      "</ul></div>";
    document.getElementById("fuel-body").innerHTML =
      '<header class="lib-hero sub" style="margin-bottom:16px"><span class="eyebrow">Around the meals</span>' +
        '<h1>Round out <span class="lead">the day</span></h1>' +
        '<p class="tagline">Your two cube meals cover lunch and dinner. This is everything around them — a light, protein-forward breakfast, a snack or two, and your psyllium — sized to round the day out to your protein, fiber and calorie targets, and to land 30–40g of protein within 30 minutes of waking.</p></header>' +
      '<div class="kitbox"><b>The plan:</b> two 3-cup cube meals do the heavy lifting; a light breakfast and two protein-forward snacks top you off. Because the meals average ~' + cube.kcal + ' kcal, you generally need <b>both</b> snacks to clear the 2,300 calorie floor — the snacks are load-bearing, not optional extras.</div>' +
      table +
      '<div class="saucecols" style="margin-top:18px">' + breakfast + snacks + "</div>" +
      '<div class="kitbox" style="margin-top:16px"><b>Psyllium:</b> 1 scoop in water before lunch and before dinner (2 scoops/day) — ~7g fiber for ~35 kcal, plus fullness. &nbsp;<b>Hydration:</b> aim for 3–4 L water across the day.</div>';
  }

  // ---------- Snacks ----------
  var SNACKS = JSON.parse(document.getElementById("snack-data").textContent);
  var snackSort = "tier";

  function fatBand(g) { return g <= SNACKS.fatBands.lean ? "lean" : (g <= SNACKS.fatBands.mid ? "mid" : "rich"); }
  function naBand(mg) { return mg <= SNACKS.sodiumBands.low ? "lo" : (mg <= SNACKS.sodiumBands.mod ? "mid" : "hi"); }
  function chip(v, cls) { return '<span class="mc ' + cls + '">' + v + "</span>"; }
  function byId(list, id) { return list.filter(function (x) { return x.id === id; })[0]; }

  var AXES = [
    { id: "tier",   label: "Prep tier" },
    { id: "where",  label: "Where" },
    { id: "fat",    label: "Fat cost" },
    { id: "flavor", label: "Sweet &amp; savory" },
    { id: "myo",    label: "Make your own" }
  ];
  var FATG = [
    { id: "lean", icon: "🟢", label: "Lean — 5g fat or less",
      blurb: "Fat is the macro that binds your day, so these are the ones you can reach for twice without thinking about it." },
    { id: "mid", icon: "🟡", label: "Moderate — 6 to 9g fat",
      blurb: "Fine once a day. Two of these plus a rich meal and you are at the ceiling." },
    { id: "rich", icon: "🔴", label: "Rich — 10g fat or more",
      blurb: "A seventh of your daily fat budget or worse, usually for very little protein. Portion these deliberately." }
  ];

  function groupsFor(axis) {
    function mk(o, pick) { return { icon: o.icon, label: o.label, blurb: o.blurb || "", pick: pick }; }
    if (axis === "where") {
      return SNACKS.wheres.map(function (w) {
        return mk(w, function (s) { return s.where.indexOf(w.id) >= 0; });
      });
    }
    if (axis === "fat") {
      return FATG.map(function (g) {
        return mk(g, function (s) { return fatBand(s.macros.fat) === g.id; });
      });
    }
    if (axis === "flavor") {
      return SNACKS.flavors.map(function (f) {
        return mk(f, function (s) { return s.flavor === f.id; });
      });
    }
    return SNACKS.tiers.map(function (t) {
      return mk(t, function (s) { return s.tier === t.id; });
    });
  }

  function snackHead(s) {
    var m = s.macros;
    var wIcons = s.where.map(function (w) {
      var o = byId(SNACKS.wheres, w);
      return o ? '<span title="' + esc(o.label) + '">' + o.icon + "</span>" : "";
    }).join("");
    return '<div class="s-top"><span class="s-name">' + esc(s.name) + "</span>" +
      (s.star ? '<span class="s-star" title="Standout pick">★</span>' : "") +
      '<span class="s-where">' + wIcons + "</span></div>" +
      '<div class="s-portion">' + esc(s.portion) + "</div>" +
      '<div class="s-macros"><span class="s-kcal">' + m.kcal + " kcal</span>" +
        chip(m.protein + "g P", "prot") + chip(m.carbs + "g C", "carb") +
        chip(m.fat + "g F", "fat") + chip(m.fiber + "g fib", "fib") +
        '<span class="na ' + naBand(m.sodium) + '" title="Sodium">' + m.sodium + "mg Na</span></div>" +
      (s.note ? '<p class="s-note">' + esc(s.note) + "</p>" : "");
  }

  function snackRow(s) {
    var extra = "";
    if (s.tip) extra += '<p class="s-tip">' + esc(s.tip) + "</p>";
    if (s.makeOwn) {
      var o = byId(SNACKS.makeYourOwn, s.makeOwn);
      if (o) extra += '<button class="s-link" type="button" data-myo="' + o.id + '">' + o.icon + " Make your own: " + esc(o.name) + " ↓</button>";
    }
    if (!extra) return '<div class="snack"><div class="sbody solo">' + snackHead(s) + "</div></div>";
    return '<details class="snack"><summary>' + snackHead(s) + '</summary><div class="sbody">' + extra + "</div></details>";
  }

  function myoCard(o) {
    function li(x) { return "<li>" + esc(x) + "</li>"; }
    var m = o.macros;
    return '<details class="myo" id="myo-' + o.id + '">' +
      '<summary><span class="myo-ico">' + o.icon + '</span><span class="myo-name">' + esc(o.name) + "</span>" +
        '<span class="myo-time">' + esc(o.time) + "</span></summary>" +
      '<div class="myo-body">' +
        '<p class="myo-yield">Makes: ' + esc(o["yield"]) + "</p>" +
        '<p class="myo-why">' + esc(o.why) + "</p>" +
        (o.warn ? '<p class="myo-warn"><b>Heads up —</b> ' + esc(o.warn) + "</p>" : "") +
        (m ? '<div class="s-macros" style="margin-bottom:14px"><span class="s-kcal">' + m.kcal + " kcal</span>" +
              chip(m.protein + "g P", "prot") + chip(m.carbs + "g C", "carb") + chip(m.fat + "g F", "fat") +
              chip(m.fiber + "g fib", "fib") + '<span class="na ' + naBand(m.sodium) + '">' + m.sodium + "mg Na</span></div>" : "") +
        "<h4>What you need</h4><ul>" + o.ingredients.map(li).join("") + "</ul>" +
        "<h4>Steps</h4><ol>" + o.steps.map(li).join("") + "</ol>" +
        (o.tips && o.tips.length ? "<h4>Tips</h4><ul>" + o.tips.map(li).join("") + "</ul>" : "") +
      "</div></details>";
  }

  function renderSnacks() {
    var b = SNACKS.budget;
    var bar = '<div class="sortbar"><span class="sortlab">Group by</span><div class="sortseg" id="sortseg">' +
      AXES.map(function (a) {
        return '<button class="sortbtn' + (a.id === snackSort ? " on" : "") + '" type="button" data-sort="' + a.id + '">' + a.label + "</button>";
      }).join("") + "</div></div>";

    var legend = '<div class="slegend">' +
      '<span><b class="s-star">★</b> standout pick</span>' +
      SNACKS.wheres.map(function (w) {
        return '<span><b class="lg-ico">' + w.icon + "</b> " + esc(w.label) + "</span>";
      }).join("") +
      '<span>Sodium — <b class="na lo">under ' + SNACKS.sodiumBands.low + "mg</b> · " +
        '<b class="na mid">to ' + SNACKS.sodiumBands.mod + 'mg</b> · <b class="na hi">above</b></span>' +
      "</div>";

    // "Make your own" is a filter, not a grouping — show the productions alone.
    var onlyMyo = snackSort === "myo";

    var groups = onlyMyo ? "" : groupsFor(snackSort).map(function (g) {
      var rows = SNACKS.snacks.filter(g.pick).sort(function (x, y) {
        return (x.macros.fat - y.macros.fat) || (x.macros.kcal - y.macros.kcal);
      });
      if (!rows.length) return "";
      return '<section class="sgroup"><div class="sghead"><h3>' + g.icon + " " + g.label + "</h3>" +
        '<span class="sgn">' + rows.length + " option" + (rows.length === 1 ? "" : "s") + "</span>" +
        (g.blurb ? '<span class="sgblurb">' + esc(g.blurb) + "</span>" : "") +
        "</div>" + rows.map(snackRow).join("") + "</section>";
    }).join("");

    document.getElementById("snacks-body").innerHTML =
      '<header class="lib-hero sub" style="margin-bottom:16px"><span class="eyebrow">Snacks</span>' +
        '<h1>The other <span class="lead">quarter of the day</span></h1>' +
        '<p class="tagline">Two snacks are about 600 calories — roughly a quarter of everything you eat, and the part that decides whether the day lands on target. ' + SNACKS.snacks.length + ' options, each with real macros. Regroup them however you are thinking about it.</p></header>' +
      '<div class="kitbox"><b>Two numbers to watch.</b> <b>Fat</b> is your binding macro — the meals already run 20–28g each, so a snack at 14g of fat costs more than its calories suggest. And <b>sodium</b>: the ceiling is ' +
        b.sodiumDayMg.toLocaleString() + 'mg a day, and three meals use most of it, which leaves roughly <b>' + b.sodiumSnackBudgetMg +
        'mg for the day’s snacks</b>. Shelf-stable things are salted to stay shelf-stable, so the desk-friendly picks are usually the salty ones. ' +
        'Handy: the <b>%DV</b> printed on any label is calculated against that same ' + b.sodiumDayMg.toLocaleString() + 'mg — so it is already your share of the day.</div>' +
      bar + (onlyMyo ? "" : legend) + groups +
      '<header class="lib-hero sub" style="margin:' + (onlyMyo ? "0" : "34px") + ' 0 16px"><span class="eyebrow">Make Your Own</span>' +
        '<h1>Worth <span class="lead">making yourself</span></h1>' +
        '<p class="tagline">These are productions, not snacks — the things that feed the list' +
        (onlyMyo ? " on the other tabs" : " above") +
        '. Each one is either meaningfully cheaper than buying it, or lets you fix something you cannot fix at the store.</p></header>' +
      SNACKS.makeYourOwn.map(myoCard).join("");

    Array.prototype.forEach.call(document.querySelectorAll(".sortbtn"), function (btn) {
      btn.addEventListener("click", function () { snackSort = btn.getAttribute("data-sort"); renderSnacks(); });
    });
    Array.prototype.forEach.call(document.querySelectorAll("[data-myo]"), function (btn) {
      btn.addEventListener("click", function () {
        var card = document.getElementById("myo-" + btn.getAttribute("data-myo"));
        if (!card) return;
        card.open = true;
        if (card.scrollIntoView) card.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
  }

  // ---------- view switching ----------
  function showView(v) {
    state.view = v;
    document.getElementById("view-meals").hidden = v !== "meals";
    document.getElementById("view-staples").hidden = v !== "staples";
    document.getElementById("view-freeze").hidden = v !== "freeze";
    document.getElementById("view-fuel").hidden = v !== "fuel";
    document.getElementById("view-snacks").hidden = v !== "snacks";
    Array.prototype.forEach.call(document.querySelectorAll(".navbtn"), function (b) {
      b.className = "navbtn" + (b.getAttribute("data-view") === v ? " active" : "");
    });
    if (v === "staples") renderStaples();
    else if (v === "freeze") renderFreeze();
    else if (v === "fuel") renderFuel();
    else if (v === "snacks") renderSnacks();
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
  var state = { view: "meals", themeId: null, vid: null, mode: "prep" };
${fns}
${hubJs}
})();
</script>
`;

fs.writeFileSync("meal-library.html", out);
console.log("Wrote meal-library.html (" + out.length + " bytes) with " + meta.length + " themes");
