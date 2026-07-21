// Type-scale pass — collapses the organically-grown font-size soup into one
// named scale, the same way apply-colorpass.js locked the color language.
//
//   ONE size = ONE role. If you can't say what role a size means, it's drift.
//
// Idempotent: re-running is a no-op. EXHAUSTIVE: if a rule declares a
// font-size whose selector isn't classified below, the pass FAILS rather than
// silently leaving it behind — that's what stops the scale rotting again.
//
//   node apply-typepass.js chili-bowl.html [more.html ...]
const fs = require("fs");

// The scale. Values are deliberately a touch larger than what they replace —
// most prose sat at 13.5–15.5px, which reads small on a desktop monitor.
const SCALE = [
  ["--t-hero",    "clamp(36px, 7vw, 64px)",     "page title, once per view"],
  ["--t-lead",    "clamp(16.5px, 2.6vw, 19.5px)", "hero tagline"],
  ["--t-stat",    "clamp(24px, 4.3vw, 33px)",   "big data numerals"],
  ["--t-hero-sub", "clamp(28px, 5vw, 44px)",    "sub-view page title"],
  ["--t-h2",      "clamp(20px, 3vw, 26px)",     "section heading"],
  ["--t-h3",      "18px",                       "card / group title"],
  ["--t-body",    "16px",                       "prose you actually read"],
  ["--t-body-sm", "14.5px",                     "secondary prose, captions"],
  ["--t-data",    "14px",                       "mono numbers, macro chips"],
  ["--t-label",   "12.5px",                     "uppercase labels & eyebrows"],
  ["--t-micro",   "11px",                       "badges only"],
];

// selector -> token
const MAP = {
  ".hero h1": "--t-hero",
  ".hero .tagline": "--t-lead",
  ".stat .v": "--t-stat",

  ".sec-head h2": "--t-h2",
  "details.sec > summary h2": "--t-h2",

  ".step h3": "--t-h3",
  ".comp-title": "--t-h3",
  ".freeze-card h3": "--t-h3",
  ".note h3": "--t-h3",
  ".picked-protein .pname": "--t-h3",
  ".saucename": "--t-h3",

  ".ing li": "--t-body",
  ".step p": "--t-body",
  ".fill-list li": "--t-body",
  ".checks li": "--t-body",
  ".note ul": "--t-body",
  ".freeze-card p": "--t-body",
  ".buildnote": "--t-body",
  ".modedesc": "--t-body",
  ".tab .tname": "--t-body",

  ".thesis": "--t-body-sm",
  ".sec-note": "--t-body-sm",
  ".step .tip": "--t-body-sm",
  ".macrolegend": "--t-body-sm",
  ".shop-note": "--t-body-sm",
  ".mini": "--t-body-sm",
  "details.sec > summary .subnote": "--t-body-sm",
  ".disclaim": "--t-body-sm",

  ".meta span": "--t-data",
  ".meta b": "--t-data",
  ".pucktbl th, .pucktbl td": "--t-data",
  ".ing .q": "--t-data",
  ".picked-protein .pserve": "--t-data",
  ".nutri .nlabel": "--t-data",
  ".stat .u": "--t-data",
  ".tab .tmac": "--t-data",
  ".fill-list .q": "--t-data",
  ".checks .q": "--t-data",
  ".ms-plus": "--t-data",

  ".eyebrow": "--t-label",
  ".tab .tmac.tsub": "--t-label",
  ".modebtn": "--t-label",
  ".mealstrip .ms-lead": "--t-label",
  "footer": "--t-label",
  ".chip": "--t-label",
  ".barcap": "--t-label",
  ".pucktbl caption": "--t-label",
  ".buylabel": "--t-label",
  ".stat-label": "--t-label",
  ".comp-title .sub": "--t-label",
  ".step .tip b": "--t-label",
  ".ms-cap": "--t-label",
  ".ms-puck": "--t-label",

  ".pucktbl td .pk": "--t-micro",
  "footer .pill": "--t-micro",
  ".pucktbl thead th": "--t-micro",
  ".tab .tkind": "--t-micro",

  // ---- hub-only (build-hub.js hubCss) ----
  ".lib-hero h1": "--t-hero",
  ".lib-hero.sub h1": "--t-hero-sub",
  ".scolp": "--t-body",
  ".lib-hero .tagline": "--t-lead",
  ".myo .myo-name": "--t-h2",

  ".theme-card .tt": "--t-h3",
  ".scol h3": "--t-h3",
  ".sgroup > .sghead h3": "--t-h3",
  ".s-name": "--t-h3",

  ".navbtn": "--t-body",
  ".kitbox": "--t-body",
  ".smatrix td.item b": "--t-body",
  ".saucelist": "--t-body",
  ".saucelist .mtag": "--t-body",
  ".s-note": "--t-body",
  ".s-tip": "--t-body",
  ".myo .myo-why": "--t-body",
  ".myo .myo-warn": "--t-body",
  ".myo ul, .myo ol": "--t-body",

  ".smatrix td.item .sprep": "--t-body-sm",
  ".smatrix-foot": "--t-body-sm",
  ".sortbtn": "--t-body-sm",
  ".slegend": "--t-body-sm",
  ".sgroup > .sghead .sgblurb": "--t-body-sm",
  ".s-portion": "--t-body-sm",

  ".theme-card .tstats": "--t-data",
  ".s-macros": "--t-data",
  ".myo .myo-time": "--t-data",
  ".myo .myo-yield": "--t-data",
  ".daytable .tgt td": "--t-data",

  ".theme-card .tt .lead": "--t-label",
  ".theme-card .go": "--t-label",
  ".backbtn": "--t-label",
  ".smatrix thead th.item": "--t-label",
  ".smatrix thead th.cov, .smatrix td.cov": "--t-label",
  ".smatrix .catrow td": "--t-label",
  ".scol h3 .sub": "--t-label",
  ".sortlab": "--t-label",
  ".sgroup > .sghead .sgn": "--t-label",
  ".snack > summary::after": "--t-label",
  ".s-link": "--t-label",
  ".myo h4": "--t-label",
  ".daytable thead th": "--t-label",

  ".theme-card .tno": "--t-micro",
};

// Deliberately OFF the prose scale — these aren't text roles.
//   body        the document base every component overrides
//   .modebtn .mi / .caret   glyphs sized as icons, not type
//   .num / .step .idx       numerals inside fixed-size round badges
const EXEMPT = [
  "body", ".modebtn .mi", "details.sec > summary .caret", ".num", ".step .idx",
  // hub: all emoji/glyph runs, sized as icons rather than as type
  ".theme-card .emoji", ".smatrix thead th", ".slegend .lg-ico", ".s-star", ".s-where", ".myo .myo-ico",
];

function normSel(raw) {
  return raw.replace(/\/\*[\s\S]*?\*\//g, "")  // strip comments
            .replace(/^[\s\S]*\{/, "")          // strip a leading "@media (...) {"
            .replace(/\s+/g, " ").trim();
}

function pass(file) {
  const src = fs.readFileSync(file, "utf8");
  // The hub's own CSS lives in a template literal in build-hub.js; the tokens
  // themselves come from the card CSS it prepends, so don't re-declare them.
  const isJs = /\.js$/.test(file);
  const styleM = isJs ? src.match(/const hubCss = `([\s\S]*?)`;/) : src.match(/<style>([\s\S]*?)<\/style>/);
  if (!styleM) throw new Error(file + (isJs ? ": no hubCss literal" : ": no <style> block"));
  let css = styleM[1];

  // 1. declare the tokens in :root. Regenerate the whole block every run rather
  // than only stamping it once — otherwise a token added to SCALE later never
  // lands in already-processed files, and the var() references dangle.
  if (!isJs) {
    const HEAD = "  /* TYPE SCALE — one size = one role. See apply-typepass.js. */\n";
    const block = "\n" + HEAD +
      SCALE.map(([n, v, why]) => "  " + n + ": " + v + ";" + " ".repeat(Math.max(1, 30 - (n + v).length)) + "/* " + why + " */").join("\n") + "\n";
    const existing = css.indexOf(HEAD);
    if (existing >= 0) {
      // span the header plus its contiguous --t-* lines
      const end = css.indexOf("\n\n", existing);
      if (end === -1) throw new Error(file + ": malformed type-scale block");
      css = css.slice(0, existing - 1) + block.replace(/\n$/, "") + css.slice(end);
    } else {
      const open = css.indexOf("{", css.indexOf(":root"));
      if (open === -1) throw new Error(file + ": no :root to extend");
      css = css.slice(0, open + 1) + block + css.slice(open + 1);
    }
  }

  // 2. rewrite every classified font-size
  const counts = {}; const unknown = []; let changed = 0;
  const rules = [];
  const re = /([^{}]+)\{([^{}]*)\}/g; let m;
  while ((m = re.exec(css))) rules.push({ full: m[0], sel: normSel(m[1]), body: m[2] });

  rules.forEach(r => {
    const f = r.body.match(/font-size:\s*([^;]+);/);
    if (!f) return;
    const cur = f[1].trim();
    if (r.sel === ":root" || EXEMPT.indexOf(r.sel) >= 0) return;
    const tok = MAP[r.sel];
    if (!tok) { unknown.push(r.sel + "  (" + cur + ")"); return; }
    const want = "var(" + tok + ")";
    if (cur === want) { counts[tok] = (counts[tok] || 0) + 1; return; } // already done
    const nextRule = r.full.replace(/font-size:\s*[^;]+;/, "font-size: " + want + ";");
    if (css.indexOf(r.full) === -1) throw new Error(file + ": rule vanished for " + r.sel);
    css = css.replace(r.full, nextRule);
    counts[tok] = (counts[tok] || 0) + 1; changed++;
  });

  if (unknown.length) {
    console.error("\n✗ " + file + " — unclassified font-size rules:\n  " + unknown.join("\n  "));
    console.error("\n  Classify each in MAP (or EXEMPT) and re-run. The pass is exhaustive on purpose.");
    process.exit(1);
  }

  // Inline style="font-size:..." bypasses the scale entirely, so the pass would
  // silently under-report. Refuse rather than pretend the file is on-scale.
  const inline = (src.match(/style="[^"]*font-size:[^"]*"/g) || []);
  if (inline.length) {
    console.error("\n✗ " + file + " — inline font-size, invisible to the scale:\n  " + inline.join("\n  "));
    console.error("\n  Move it into a class and classify that class instead.");
    process.exit(1);
  }
  fs.writeFileSync(file, src.replace(styleM[1], css));
  const used = SCALE.map(([n]) => n).filter(n => counts[n]);
  console.log(file + ": " + changed + " rewritten, " + Object.values(counts).reduce((a, b) => a + b, 0) +
    " on-scale across " + used.length + " tokens");
  used.forEach(n => console.log("   " + n.padEnd(12) + " ×" + counts[n]));
}

const files = process.argv.slice(2);
if (!files.length) { console.error("usage: node apply-typepass.js <file.html> [...]"); process.exit(1); }
files.forEach(pass);
