/*
 * logic.js — Operation: Health
 * PURE functions only. No DOM, no storage, no globals mutated.
 * Everything here is unit-testable in isolation (see tests.html).
 *
 * Loaded as a plain script (not an ES module) so it works over file://.
 * Exposes a single global: window.Logic
 */
(function () {
  'use strict';

  // Bump when the stored shape changes; every record carries this.
  var SCHEMA_VERSION = 2;

  // ---- Date helpers (timezone-safe via UTC arithmetic on YYYY-MM-DD) ----

  /** Format a JS Date as a local YYYY-MM-DD string. */
  function toISODate(date) {
    var y = date.getFullYear();
    var m = String(date.getMonth() + 1).padStart(2, '0');
    var d = String(date.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + d;
  }

  /** Today's local date as YYYY-MM-DD. */
  function todayISO() {
    return toISODate(new Date());
  }

  /** Add n days to a YYYY-MM-DD string, returning a YYYY-MM-DD string. */
  function addDaysISO(iso, n) {
    var parts = iso.split('-').map(Number);
    var dt = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
    dt.setUTCDate(dt.getUTCDate() + n);
    return dt.toISOString().slice(0, 10);
  }

  /** True if a string looks like YYYY-MM-DD and is a real calendar date. */
  function isValidISODate(iso) {
    if (typeof iso !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
    var p = iso.split('-').map(Number);
    var dt = new Date(Date.UTC(p[0], p[1] - 1, p[2]));
    return dt.getUTCFullYear() === p[0] &&
           dt.getUTCMonth() === p[1] - 1 &&
           dt.getUTCDate() === p[2];
  }

  // ---- Small utilities ----

  function isNum(v) {
    return typeof v === 'number' && isFinite(v);
  }

  /** Build a { 'YYYY-MM-DD': log } lookup from an array of logs. */
  function indexByDate(logs) {
    var map = {};
    (logs || []).forEach(function (log) {
      if (log && log.date) map[log.date] = log;
    });
    return map;
  }

  /** Parse "HH:MM" 24h time to minutes-since-midnight, or null if invalid. */
  function timeToMinutes(t) {
    if (typeof t !== 'string' || !/^\d{1,2}:\d{2}$/.test(t)) return null;
    var parts = t.split(':').map(Number);
    var h = parts[0], m = parts[1];
    if (h < 0 || h > 23 || m < 0 || m > 59) return null;
    return h * 60 + m;
  }

  /**
   * True if wakeTime is within ±tolMin of wakeGoal, accounting for the
   * midnight wrap (e.g. 23:50 vs 00:10 is 20 min apart, not 1420).
   */
  function wakeWithin(wakeTime, wakeGoal, tolMin) {
    var a = timeToMinutes(wakeTime);
    var b = timeToMinutes(wakeGoal);
    if (a === null || b === null) return false;
    var diff = Math.abs(a - b);
    diff = Math.min(diff, 1440 - diff);
    return diff <= tolMin;
  }

  // ---- Core scoring: grading (§9.2 three-state model) ----

  // Canonical scoring defaults. storage.js seeds DEFAULT_PROFILE.scoring from
  // this same object, so there is one source of truth for the dials.
  var DEFAULT_SCORING = {
    yellowCredit: 0.75,      // credit for a 🟡 signal (🟢 = 1.0, 🔴 = 0.0)
    numericGreenPct: 1.0,    // 🟢 at ≥100% of target (steps, water)
    numericYellowPct: 0.75,  // 🟡 at ≥75% of target
    wakeGreenMin: 30,        // 🟢 within ±30 min of wakeGoal
    wakeYellowMin: 60,       // 🟡 within ±60 min
    dayBands: { green: 80, yellow: 50 }, // whole-day grade from daily score
    weights: { logged: 1, protein: 1, morningExercise: 1, steps: 1, water: 1, wake: 1 }
  };

  /** Resolve a full scoring config from a profile, filling any gaps with defaults. */
  function scoringConfig(profile) {
    var s = (profile && profile.scoring) || {};
    var num = function (v, d) { return isNum(v) ? v : d; };
    return {
      yellowCredit: num(s.yellowCredit, DEFAULT_SCORING.yellowCredit),
      numericGreenPct: num(s.numericGreenPct, DEFAULT_SCORING.numericGreenPct),
      numericYellowPct: num(s.numericYellowPct, DEFAULT_SCORING.numericYellowPct),
      wakeGreenMin: num(s.wakeGreenMin, DEFAULT_SCORING.wakeGreenMin),
      wakeYellowMin: num(s.wakeYellowMin, DEFAULT_SCORING.wakeYellowMin),
      dayBands: Object.assign({}, DEFAULT_SCORING.dayBands, s.dayBands),
      weights: Object.assign({}, DEFAULT_SCORING.weights, s.weights)
    };
  }

  /** Binary habit → 🟢 only on 'Y', else 🔴 (missing/'N' both miss). */
  function gradeBinary(val) {
    return val === 'Y' ? 'green' : 'red';
  }

  /**
   * Numeric metric vs a target → 🟢/🟡/🔴 at greenPct/yellowPct of target.
   * A logged-but-blank (or invalid) value is a miss → 🔴.
   */
  function gradeNumeric(value, target, cfg) {
    cfg = cfg || DEFAULT_SCORING;
    if (!isNum(target) || target <= 0) return 'red'; // signal inactive upstream
    if (!isNum(value)) return 'red';
    var pct = value / target;
    if (pct >= cfg.numericGreenPct) return 'green';
    if (pct >= cfg.numericYellowPct) return 'yellow';
    return 'red';
  }

  /** Wake time vs goal → 🟢 within ±green, 🟡 within ±yellow, else 🔴. */
  function gradeWake(wakeTime, wakeGoal, cfg) {
    cfg = cfg || DEFAULT_SCORING;
    if (!wakeGoal) return null; // no goal → signal inactive
    if (wakeWithin(wakeTime, wakeGoal, cfg.wakeGreenMin)) return 'green';
    if (wakeWithin(wakeTime, wakeGoal, cfg.wakeYellowMin)) return 'yellow';
    return 'red';
  }

  /** Credit for a grade state: 🟢 1.0, 🟡 yellowCredit, 🔴 0.0. */
  function creditFor(state, cfg) {
    cfg = cfg || DEFAULT_SCORING;
    if (state === 'green') return 1;
    if (state === 'yellow') return cfg.yellowCredit;
    return 0;
  }

  /**
   * Which signals are scored this run. Steps/water/wake drop out of the
   * denominator when their target/goal is unset (as wake did in Phase 1),
   * so an un-configured metric never drags the score down.
   */
  function activeSignals(profile) {
    profile = profile || {};
    var sig = ['logged', 'protein', 'morningExercise'];
    if (isNum(profile.stepsTarget) && profile.stepsTarget > 0) sig.push('steps');
    if (isNum(profile.waterTarget) && profile.waterTarget > 0) sig.push('water');
    if (profile.wakeGoal) sig.push('wake');
    return sig;
  }

  /** Grade one signal for a present log. `logged` is always 🟢 (a record exists). */
  function gradeSignal(signal, log, profile, cfg) {
    switch (signal) {
      case 'logged': return 'green';
      case 'protein': return gradeBinary(log.proteinWithin30);
      case 'morningExercise': return gradeBinary(log.morningExercise);
      case 'steps': return gradeNumeric(log.steps, profile.stepsTarget, cfg);
      case 'water': return gradeNumeric(log.waterLiters, profile.waterTarget, cfg);
      case 'wake': return gradeWake(log.wakeTime, profile.wakeGoal, cfg);
      default: return 'red';
    }
  }

  /**
   * computeDailyScore(log, profile) → { score, states, signals }
   * Weighted average of each active signal's credit × 100 (0–100).
   * Only call for a present log; a missing day scores 0 by definition.
   */
  function computeDailyScore(log, profile) {
    profile = profile || {};
    var cfg = scoringConfig(profile);
    var signals = activeSignals(profile);
    var states = {};
    var wSum = 0, cSum = 0;
    signals.forEach(function (s) {
      var state = gradeSignal(s, log, profile, cfg);
      states[s] = state;
      var w = isNum(cfg.weights[s]) ? cfg.weights[s] : 1;
      wSum += w;
      cSum += w * creditFor(state, cfg);
    });
    var score = wSum > 0 ? Math.round((cSum / wSum) * 100) : 0;
    return { score: score, states: states, signals: signals };
  }

  /** Whole-day grade from a daily score: 🟢 ≥ green band, 🟡 ≥ yellow band, else 🔴. */
  function gradeDay(score, bands) {
    bands = bands || DEFAULT_SCORING.dayBands;
    if (score >= bands.green) return 'green';
    if (score >= bands.yellow) return 'yellow';
    return 'red';
  }

  /** The whole-day grade for a (possibly missing) log. Missing → 🔴. */
  function dayGrade(log, profile, cfg) {
    if (!log) return 'red';
    return gradeDay(computeDailyScore(log, profile).score, cfg.dayBands);
  }

  // ---- Core scoring: streak ----

  /**
   * computeStreak(logs, profile, asOfDate)
   * Consecutive days whose whole-day grade is 🟢 or 🟡, ending on asOfDate —
   * or ending yesterday if asOfDate isn't logged yet, so an unlogged morning
   * doesn't zero the streak. A 🔴 day (incl. a missing day) breaks it.
   * @param {Array}  logs     array of DailyLog records
   * @param {Object} profile  scoring config + targets/goals
   * @param {string} asOfDate YYYY-MM-DD (defaults to today)
   * @returns {number} streak length in days
   */
  function computeStreak(logs, profile, asOfDate) {
    var as = asOfDate || todayISO();
    profile = profile || {};
    var cfg = scoringConfig(profile);
    var byDate = indexByDate(logs);

    // Anchor on today if it's logged; otherwise start counting from yesterday.
    var cursor = byDate[as] ? as : addDaysISO(as, -1);

    var streak = 0;
    while (true) {
      var g = dayGrade(byDate[cursor], profile, cfg);
      if (g !== 'green' && g !== 'yellow') break;
      streak++;
      cursor = addDaysISO(cursor, -1);
    }
    return streak;
  }

  // ---- Core scoring: consistency ----

  // The scored signals and the "what's dragging it down" hints. Object order
  // also serves as the tie-break priority for the drag hint (logging first,
  // then the morning chain, then the graded metrics).
  var SIGNAL_HINTS = {
    logged:          "You're skipping daily logs — even a 10-second entry keeps the score alive.",
    protein:         "Morning protein is lagging — prep a shake the night before.",
    morningExercise: "Morning movement is the gap — even 10 minutes after waking counts.",
    steps:           "Your step count is short of target — a short walk anywhere adds up.",
    water:           "Hydration is low — fill your water bottle first thing.",
    wake:            "Wake time is drifting — anchor a steady wake-up to steady the rest."
  };

  /**
   * computeConsistency(logs, profile, asOfDate)
   * 0–100: the daily score (graded, weighted) averaged over the trailing 7
   * days including asOfDate. A missing day scores 0 (all-red = not consistent).
   * Steps/water/wake drop out when their target/goal is unset.
   *
   * @returns {{score:number, perSignal:Object, signals:string[],
   *            dragSignal:(string|null), hint:(string|null)}}
   */
  function computeConsistency(logs, profile, asOfDate) {
    var as = asOfDate || todayISO();
    profile = profile || {};
    var cfg = scoringConfig(profile);
    var byDate = indexByDate(logs);
    var signals = activeSignals(profile);
    var DAYS = 7;

    // Sum of each signal's credit across the window (missing day adds 0).
    var perSignal = {};
    signals.forEach(function (s) { perSignal[s] = 0; });
    var scoreSum = 0;

    for (var i = 0; i < DAYS; i++) {
      var log = byDate[addDaysISO(as, -i)];
      if (!log) continue; // missing day: 0 daily score, 0 credit everywhere
      var day = computeDailyScore(log, profile);
      scoreSum += day.score;
      signals.forEach(function (s) {
        perSignal[s] += creditFor(day.states[s], cfg);
      });
    }

    var score = Math.round(scoreSum / DAYS);

    // "What's dragging it down": the active signal with the least total credit.
    // Ties break by signal order. If a signal is maxed every day, skip it.
    var dragSignal = null;
    var lowest = Infinity;
    signals.forEach(function (s) {
      if (perSignal[s] < lowest) {
        lowest = perSignal[s];
        dragSignal = s;
      }
    });
    if (lowest >= DAYS) dragSignal = null; // everything green all week

    return {
      score: score,
      perSignal: perSignal,
      signals: signals,
      dragSignal: dragSignal,
      hint: dragSignal ? SIGNAL_HINTS[dragSignal] : null
    };
  }

  /**
   * last7Grades(logs, profile, asOfDate) → [{date, grade, score, logged}]
   * Oldest → newest, for the dashboard 7-day dot strip. A missing day is
   * grade 🔴, score 0, logged:false.
   */
  function last7Grades(logs, profile, asOfDate) {
    var as = asOfDate || todayISO();
    profile = profile || {};
    var cfg = scoringConfig(profile);
    var byDate = indexByDate(logs);
    var out = [];
    for (var i = 6; i >= 0; i--) {
      var date = addDaysISO(as, -i);
      var log = byDate[date];
      var score = log ? computeDailyScore(log, profile).score : 0;
      out.push({
        date: date,
        score: score,
        grade: log ? gradeDay(score, cfg.dayBands) : 'red',
        logged: !!log
      });
    }
    return out;
  }

  // ---- Log inspection (§9.2 Slice 3 — calendar geometry, pure) ----

  function pad2(n) { return String(n).padStart(2, '0'); }

  /**
   * One calendar cell for an ISO date: { date, day, logged, score, grade }.
   * score/grade are null for un-logged days — this is a browse view, not the
   * score, so an empty cell means "no entry", not an all-red penalty.
   */
  function dayCell(iso, byDate, profile, cfg) {
    var log = byDate[iso];
    var score = log ? computeDailyScore(log, profile).score : null;
    return {
      date: iso,
      day: Number(iso.slice(8, 10)),
      logged: !!log,
      score: score,
      grade: log ? gradeDay(score, cfg.dayBands) : null
    };
  }

  /** Monday-first start of the week containing `iso` (JS 0=Sun..6=Sat). */
  function startOfWeekISO(iso) {
    var p = iso.split('-').map(Number);
    var dow = new Date(Date.UTC(p[0], p[1] - 1, p[2])).getUTCDay();
    return addDaysISO(iso, -((dow + 6) % 7));
  }

  /**
   * monthGrid(year, month, logs, profile) → { year, month, days, weeks }
   * A Monday-first calendar for the given month (`month` is 1–12). `weeks` is
   * an array of 7-cell rows; leading/trailing padding cells are `null`.
   */
  function monthGrid(year, month, logs, profile) {
    profile = profile || {};
    var cfg = scoringConfig(profile);
    var byDate = indexByDate(logs);
    var daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    // Monday-first column of the 1st: JS 0=Sun..6=Sat → 0=Mon..6=Sun.
    var firstDow = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
    var lead = (firstDow + 6) % 7;

    var cells = [];
    var i;
    for (i = 0; i < lead; i++) cells.push(null);
    for (var d = 1; d <= daysInMonth; d++) {
      cells.push(dayCell(year + '-' + pad2(month) + '-' + pad2(d), byDate, profile, cfg));
    }
    while (cells.length % 7 !== 0) cells.push(null);

    var weeks = [];
    for (i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
    return { year: year, month: month, days: daysInMonth, weeks: weeks };
  }

  /**
   * weekGrid(anchorDate, logs, profile) → { start, end, days }
   * The Monday-first week containing `anchorDate` as 7 day cells (no padding —
   * a week is always exactly seven days).
   */
  function weekGrid(anchorDate, logs, profile) {
    profile = profile || {};
    var cfg = scoringConfig(profile);
    var byDate = indexByDate(logs);
    var start = startOfWeekISO(anchorDate);
    var days = [];
    for (var i = 0; i < 7; i++) days.push(dayCell(addDaysISO(start, i), byDate, profile, cfg));
    return { start: start, end: addDaysISO(start, 6), days: days };
  }

  // ---- Trends / charts (§9.2 Slice 2 — pure geometry, zero deps) ----

  /** Round to 1 decimal — keeps generated SVG paths compact. */
  function r1(x) { return Math.round(x * 10) / 10; }

  /**
   * buildSeries(logs, field, asOfDate, days) → [{date, value|null}]
   * One numeric point per day over the trailing `days` window (oldest→newest).
   * A missing day, or a blank/non-numeric field, yields value:null (a gap).
   */
  function buildSeries(logs, field, asOfDate, days) {
    var as = asOfDate || todayISO();
    days = isNum(days) && days > 0 ? days : 30;
    var byDate = indexByDate(logs);
    var out = [];
    for (var i = days - 1; i >= 0; i--) {
      var date = addDaysISO(as, -i);
      var log = byDate[date];
      var raw = log ? log[field] : undefined;
      var num = (raw === '' || raw == null) ? NaN : Number(raw);
      out.push({ date: date, value: isNum(num) ? num : null });
    }
    return out;
  }

  /** Summary stats over the non-null points of a series (for scaling + labels). */
  function seriesStats(series) {
    var pts = (series || []).filter(function (p) { return isNum(p.value); });
    if (!pts.length) {
      return { min: null, max: null, first: null, last: null, count: 0, mean: null, delta: null };
    }
    var nums = pts.map(function (p) { return p.value; });
    var sum = nums.reduce(function (a, b) { return a + b; }, 0);
    var first = pts[0].value, last = pts[pts.length - 1].value;
    return {
      min: Math.min.apply(null, nums),
      max: Math.max.apply(null, nums),
      first: first,
      last: last,
      count: pts.length,
      mean: sum / pts.length,   // average over logged days
      delta: last - first       // net change over the range (last logged − first)
    };
  }

  /**
   * goalSleepHours(profile) → number|null
   * The nightly sleep target implied by the bed/wake goals (e.g. 22:30 → 06:30
   * = 8h), handling the midnight wrap. null if either goal is unset — then the
   * Sleep chart simply shows no target line.
   */
  function goalSleepHours(profile) {
    profile = profile || {};
    var bed = timeToMinutes(profile.bedGoal);
    var wake = timeToMinutes(profile.wakeGoal);
    if (bed === null || wake === null) return null;
    var mins = (wake - bed + 1440) % 1440;
    return mins === 0 ? null : mins / 60;
  }

  /**
   * countOnTarget(series, target) → { on, of, pct }
   * How many logged days met/exceeded the target (e.g. steps ≥ goal).
   * `of` counts logged (non-null) days only; missing days aren't judged here.
   */
  function countOnTarget(series, target) {
    if (!isNum(target)) return { on: 0, of: 0, pct: 0 };
    var pts = (series || []).filter(function (p) { return isNum(p.value); });
    var on = pts.filter(function (p) { return p.value >= target; }).length;
    return { on: on, of: pts.length, pct: pts.length ? Math.round((on / pts.length) * 100) : 0 };
  }

  /**
   * plotLine(series, width, height, opts) → { path, gapPath, points, lo, hi }
   * Maps a series into an SVG coordinate box (0,0 top-left → width,height).
   * - y is auto-scaled to the data range (NOT zero-based — weight needs this),
   *   padded by `opts.pad` (default 0.1); `opts.min`/`opts.max` can widen it
   *   (e.g. to include a target line).
   * - `path` is the SOLID line over runs of consecutive logged days (a new
   *   "M" starts each run).
   * - `gapPath` bridges across missing days (drawn dashed/muted) so the trend
   *   stays followable while signalling "inferred, not logged."
   * - `points` are the plotted (non-null) coordinates, for dots/markers.
   */
  function plotLine(series, width, height, opts) {
    opts = opts || {};
    var n = (series || []).length;
    var stats = seriesStats(series);
    if (n === 0 || stats.count === 0) {
      return { path: '', gapPath: '', points: [], lo: null, hi: null };
    }

    var lo = isNum(opts.min) ? Math.min(opts.min, stats.min) : stats.min;
    var hi = isNum(opts.max) ? Math.max(opts.max, stats.max) : stats.max;
    if (hi === lo) { hi = lo + 1; lo = lo - 1; } // flat data → give the line room
    var padFrac = isNum(opts.pad) ? opts.pad : 0.1;
    var padV = (hi - lo) * padFrac;
    lo -= padV; hi += padV;
    var range = hi - lo;

    var xAt = function (i) { return n === 1 ? width / 2 : (i / (n - 1)) * width; };
    var yAt = function (v) { return height - ((v - lo) / range) * height; };

    var path = '';
    var gapPath = '';
    var points = [];
    var prev = null; // previous plotted point {x, y, index}
    for (var i = 0; i < n; i++) {
      var v = series[i].value;
      if (!isNum(v)) continue;
      var x = r1(xAt(i)), y = r1(yAt(v));
      if (prev === null) {
        path += 'M' + x + ',' + y;
      } else if (prev.index === i - 1) {
        path += ' L' + x + ',' + y;                 // consecutive day → solid
      } else {
        gapPath += (gapPath ? ' ' : '') +           // spanned ≥1 missing day →
          'M' + prev.x + ',' + prev.y + ' L' + x + ',' + y; // dashed bridge
        path += ' M' + x + ',' + y;                 // and start a fresh solid run
      }
      points.push({ x: x, y: y, value: v, date: series[i].date, index: i });
      prev = { x: x, y: y, index: i };
    }
    return { path: path, gapPath: gapPath, points: points, lo: lo, hi: hi };
  }

  /**
   * rangeToDays(rangeKey, logs, asOfDate) → integer day-count for a trailing
   * window ending on asOfDate. Fixed ranges are constant; 'month' is
   * month-to-date; 'all' spans from the earliest logged day (falls back to 30
   * when there are no logs). Feeds buildSeries' `days` argument.
   */
  function rangeToDays(rangeKey, logs, asOfDate) {
    var as = asOfDate || todayISO();
    switch (rangeKey) {
      case '7d': return 7;
      case '30d': return 30;
      case '3m': return 90;
      case '6m': return 180;
      case '1y': return 365;
      case 'month': return Number(as.slice(8, 10)); // day-of-month = month-to-date
      case 'all': {
        var dates = (logs || [])
          .map(function (l) { return l && l.date; })
          .filter(function (d) { return isValidISODate(d); })
          .sort();
        if (!dates.length) return 30;
        var p1 = dates[0].split('-').map(Number);
        var p2 = as.split('-').map(Number);
        var diff = Math.round(
          (Date.UTC(p2[0], p2[1] - 1, p2[2]) - Date.UTC(p1[0], p1[1] - 1, p1[2])) / 86400000
        ) + 1;
        return diff > 0 ? diff : 1;
      }
      default: return 30;
    }
  }

  // ---- Validation ----

  /** True if today is logged (used by the dashboard "Today" card). */
  function isLoggedToday(logs, asOfDate) {
    var as = asOfDate || todayISO();
    return !!indexByDate(logs)[as];
  }

  function inRange(v, lo, hi) {
    return isNum(v) && v >= lo && v <= hi;
  }

  /**
   * validateDailyLog(record) → { valid, errors:{field:message} }
   * Only `date` is required; every other field is optional but, when present,
   * must be well-formed. Keeps bad data out of storage and out of the score.
   */
  function validateDailyLog(record) {
    var errors = {};
    record = record || {};

    if (!isValidISODate(record.date)) {
      errors.date = 'A valid date (YYYY-MM-DD) is required.';
    }

    if (record.wakeTime != null && record.wakeTime !== '' &&
        timeToMinutes(record.wakeTime) === null) {
      errors.wakeTime = 'Wake time must be HH:MM (24h).';
    }
    if (record.bedTime != null && record.bedTime !== '' &&
        timeToMinutes(record.bedTime) === null) {
      errors.bedTime = 'Bed time must be HH:MM (24h).';
    }

    if (record.sleepHours != null && record.sleepHours !== '' &&
        !inRange(Number(record.sleepHours), 0, 24)) {
      errors.sleepHours = 'Sleep hours must be between 0 and 24.';
    }
    if (record.sleepQuality != null && record.sleepQuality !== '' &&
        !inRange(Number(record.sleepQuality), 1, 5)) {
      errors.sleepQuality = 'Sleep quality must be 1–5.';
    }
    if (record.morningEnergy != null && record.morningEnergy !== '' &&
        !inRange(Number(record.morningEnergy), 1, 5)) {
      errors.morningEnergy = 'Morning energy must be 1–5.';
    }

    ['proteinWithin30', 'morningExercise'].forEach(function (f) {
      if (record[f] != null && record[f] !== '' &&
          record[f] !== 'Y' && record[f] !== 'N') {
        errors[f] = "Must be 'Y' or 'N'.";
      }
    });

    if (record.steps != null && record.steps !== '') {
      var steps = Number(record.steps);
      if (!isNum(steps) || steps < 0 || Math.floor(steps) !== steps) {
        errors.steps = 'Steps must be a whole number ≥ 0.';
      }
    }
    if (record.waterLiters != null && record.waterLiters !== '' &&
        !inRange(Number(record.waterLiters), 0, 20)) {
      errors.waterLiters = 'Water must be between 0 and 20 L.';
    }
    if (record.weight != null && record.weight !== '' &&
        !inRange(Number(record.weight), 0, 1000)) {
      errors.weight = 'Weight looks out of range.';
    }

    return { valid: Object.keys(errors).length === 0, errors: errors };
  }

  /** Validate the shape of an import payload before we touch stored data. */
  function validateImport(data) {
    var errors = [];
    if (!data || typeof data !== 'object') {
      return { valid: false, errors: ['File is not valid JSON object.'] };
    }
    if (data.app !== 'operation-health') {
      errors.push('This file is not an Operation: Health export.');
    }
    // Accept any known version up to the current one; older payloads are
    // brought forward by migrateRecord on import (see storage.importData).
    var v = data.schemaVersion;
    if (!(typeof v === 'number' && v >= 1 && v <= SCHEMA_VERSION)) {
      errors.push('Unsupported schemaVersion: ' + v + '.');
    }
    if (!Array.isArray(data.dailyLogs)) {
      errors.push('Missing dailyLogs array.');
    }
    return { valid: errors.length === 0, errors: errors };
  }

  // ---- Migration hook (no-op today; the seam for future upgrades) ----

  /**
   * migrateRecord(record) — brings any stored record up to SCHEMA_VERSION.
   * Runs on every profile and daily-log read/write, so it must be idempotent
   * and safe to apply to both shapes.
   */
  function migrateRecord(record) {
    record = record || {};

    // v1 → v2: the DailyLog binary habit `moved` is re-pointed at the morning
    // routine and renamed `morningExercise` (§9.2). Profiles have no `moved`,
    // so this is a no-op for them. Idempotent: only fires while `moved` exists.
    if (record.moved !== undefined) {
      if (record.morningExercise === undefined) {
        record.morningExercise = record.moved;
      }
      delete record.moved;
    }

    record.schemaVersion = SCHEMA_VERSION;
    return record;
  }

  window.Logic = {
    SCHEMA_VERSION: SCHEMA_VERSION,
    // dates
    toISODate: toISODate,
    todayISO: todayISO,
    addDaysISO: addDaysISO,
    isValidISODate: isValidISODate,
    // time
    timeToMinutes: timeToMinutes,
    wakeWithin: wakeWithin,
    // grading (§9.2 three-state model)
    DEFAULT_SCORING: DEFAULT_SCORING,
    scoringConfig: scoringConfig,
    gradeBinary: gradeBinary,
    gradeNumeric: gradeNumeric,
    gradeWake: gradeWake,
    creditFor: creditFor,
    computeDailyScore: computeDailyScore,
    gradeDay: gradeDay,
    // scoring
    computeStreak: computeStreak,
    computeConsistency: computeConsistency,
    last7Grades: last7Grades,
    isLoggedToday: isLoggedToday,
    // log inspection (§9.2 Slice 3)
    startOfWeekISO: startOfWeekISO,
    monthGrid: monthGrid,
    weekGrid: weekGrid,
    // trends / charts
    buildSeries: buildSeries,
    seriesStats: seriesStats,
    countOnTarget: countOnTarget,
    goalSleepHours: goalSleepHours,
    plotLine: plotLine,
    rangeToDays: rangeToDays,
    // validation & migration
    validateDailyLog: validateDailyLog,
    validateImport: validateImport,
    migrateRecord: migrateRecord,
    // exposed for hints/tests
    SIGNAL_HINTS: SIGNAL_HINTS
  };
})();
