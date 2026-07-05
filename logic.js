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

  // ---- Core scoring: streak ----

  /**
   * A day "counts" toward the streak if it was logged AND at least one core
   * thing happened (morning protein OR moved).
   */
  function dayCounts(log) {
    if (!log) return false;
    return log.proteinWithin30 === 'Y' || log.morningExercise === 'Y';
  }

  /**
   * computeStreak(logs, asOfDate)
   * Consecutive counting days ending on asOfDate — or ending yesterday if
   * asOfDate isn't logged yet, so an unlogged morning doesn't zero the streak.
   * @param {Array} logs      array of DailyLog records
   * @param {string} asOfDate YYYY-MM-DD (defaults to today)
   * @returns {number} streak length in days
   */
  function computeStreak(logs, asOfDate) {
    var as = asOfDate || todayISO();
    var byDate = indexByDate(logs);

    // Anchor on today if it's logged; otherwise start counting from yesterday.
    var cursor = byDate[as] ? as : addDaysISO(as, -1);

    var streak = 0;
    while (dayCounts(byDate[cursor])) {
      streak++;
      cursor = addDaysISO(cursor, -1);
    }
    return streak;
  }

  // ---- Core scoring: consistency ----

  // The per-day core signals and the "what's dragging it down" hints.
  // Order also serves as the tie-break priority for the drag hint
  // (sleep/wake-first spirit: logging first, then the habit chain).
  var SIGNAL_HINTS = {
    logged:    "You're skipping daily logs — even a 10-second entry keeps the score alive.",
    protein:   "Morning protein is lagging — prep a shake the night before.",
    moved:     "Movement is the gap — a short walk anywhere counts.",
    hydration: "Hydration is low — fill your water bottle first thing.",
    wake:      "Wake time is drifting — anchor a steady wake-up to steady the rest."
  };

  /**
   * computeConsistency(logs, profile, asOfDate)
   * 0–100 measure of consistency of core habits over the trailing 7 days
   * (including asOfDate). A missing day scores 0 on every signal.
   * Wake-consistency is dropped from the denominator when wakeGoal is unset.
   *
   * @returns {{score:number, achieved:number, possible:number,
   *            perSignal:Object, dragSignal:(string|null), hint:(string|null)}}
   */
  function computeConsistency(logs, profile, asOfDate) {
    var as = asOfDate || todayISO();
    profile = profile || {};
    var byDate = indexByDate(logs);

    var useWake = !!profile.wakeGoal; // in the denominator only if a goal is set

    // Which signals are active this run.
    var signals = ['logged', 'protein', 'moved', 'hydration'];
    if (useWake) signals.push('wake');

    // Per-signal achieved counts across the 7-day window.
    var perSignal = {};
    signals.forEach(function (s) { perSignal[s] = 0; });

    var DAYS = 7;
    for (var i = 0; i < DAYS; i++) {
      var d = addDaysISO(as, -i);
      var log = byDate[d];
      if (!log) continue; // missing day: 0 on every signal

      perSignal.logged += 1;
      if (log.proteinWithin30 === 'Y') perSignal.protein += 1;

      var moved = log.morningExercise === 'Y' ||
        (isNum(log.steps) && isNum(profile.stepsTarget) && log.steps >= profile.stepsTarget);
      if (moved) perSignal.moved += 1;

      if (isNum(log.waterLiters) && isNum(profile.waterTarget) &&
          log.waterLiters >= profile.waterTarget) {
        perSignal.hydration += 1;
      }

      if (useWake && wakeWithin(log.wakeTime, profile.wakeGoal, 30)) {
        perSignal.wake += 1;
      }
    }

    var achieved = signals.reduce(function (sum, s) { return sum + perSignal[s]; }, 0);
    var possible = signals.length * DAYS;
    var score = possible > 0 ? Math.round((achieved / possible) * 100) : 0;

    // "What's dragging it down": the lowest-achieving signal.
    // Ties break by SIGNAL order (object insertion order of `signals`).
    var dragSignal = null;
    var lowest = Infinity;
    signals.forEach(function (s) {
      if (perSignal[s] < lowest) {
        lowest = perSignal[s];
        dragSignal = s;
      }
    });
    // If everything is perfect, there's nothing to nag about.
    if (lowest >= DAYS) dragSignal = null;

    return {
      score: score,
      achieved: achieved,
      possible: possible,
      perSignal: perSignal,
      dragSignal: dragSignal,
      hint: dragSignal ? SIGNAL_HINTS[dragSignal] : null
    };
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
    // scoring
    computeStreak: computeStreak,
    computeConsistency: computeConsistency,
    dayCounts: dayCounts,
    isLoggedToday: isLoggedToday,
    // validation & migration
    validateDailyLog: validateDailyLog,
    validateImport: validateImport,
    migrateRecord: migrateRecord,
    // exposed for hints/tests
    SIGNAL_HINTS: SIGNAL_HINTS
  };
})();
