/*
 * storage.js — Operation: Health
 * The ONLY module that talks to localStorage. Everything above it (app.js)
 * goes through this boundary, so swapping in IndexedDB later means rewriting
 * this file alone — the UI never knows where the bytes live.
 *
 * Depends on: window.Logic (schema version, migration, date helpers).
 * Exposes: window.Storage
 */
(function () {
  'use strict';

  var L = window.Logic;
  var KEY_PROFILE = 'oh.profile';
  var KEY_LOGS = 'oh.dailyLogs';

  // Default targets — seeded from the requirements §5 but fully editable.
  // NEVER hard-code these anywhere else; they live here and in Settings.
  var DEFAULT_PROFILE = {
    wakeGoal: '06:30',
    bedGoal: '22:30',
    stepsTarget: 8000,
    waterTarget: 3.5,   // litres
    proteinTarget: 170, // grams (display-only in Phase 1)
    roadmapPhase: 1,
    // Graded-consistency scoring dials (§9.2). Seeded with the confirmed
    // defaults; a tuning UI comes in a later Phase-2 slice. NEVER hard-code
    // these in logic/UI — they flow in from the profile.
    scoring: {
      yellowCredit: 0.75,      // credit for a 🟡 signal (🟢 = 1.0, 🔴 = 0.0)
      numericGreenPct: 1.0,    // 🟢 at ≥100% of target (steps, water)
      numericYellowPct: 0.75,  // 🟡 at ≥75% of target
      wakeGreenMin: 30,        // 🟢 within ±30 min of wakeGoal
      wakeYellowMin: 60,       // 🟡 within ±60 min
      dayBands: { green: 80, yellow: 50 }, // whole-day grade from daily score
      weights: {               // per-signal weights (all equal to start)
        logged: 1, protein: 1, morningExercise: 1, steps: 1, water: 1, wake: 1
      }
    },
    schemaVersion: L.SCHEMA_VERSION
  };

  function readJSON(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      console.error('Storage read failed for ' + key, e);
      return fallback;
    }
  }

  function writeJSON(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  // ---- Profile ----

  function getProfile() {
    var stored = readJSON(KEY_PROFILE, null);
    if (!stored) return Object.assign({}, DEFAULT_PROFILE);
    // Fill any missing keys from defaults, then run the migration hook.
    var merged = Object.assign({}, DEFAULT_PROFILE, stored);
    return L.migrateRecord(merged);
  }

  function saveProfile(profile) {
    var toStore = L.migrateRecord(Object.assign({}, getProfile(), profile));
    writeJSON(KEY_PROFILE, toStore);
    return toStore;
  }

  // ---- Daily logs ----

  /** All logs, migrated, sorted ascending by date. */
  function getLogs() {
    var logs = readJSON(KEY_LOGS, []);
    if (!Array.isArray(logs)) logs = [];
    return logs.map(L.migrateRecord).sort(function (a, b) {
      return a.date < b.date ? -1 : a.date > b.date ? 1 : 0;
    });
  }

  function getLog(date) {
    return getLogs().filter(function (l) { return l.date === date; })[0] || null;
  }

  /** Insert or replace the record for its date (date is the primary key). */
  function saveLog(record) {
    var stamped = L.migrateRecord(Object.assign({}, record));
    var logs = getLogs().filter(function (l) { return l.date !== stamped.date; });
    logs.push(stamped);
    logs.sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    writeJSON(KEY_LOGS, logs);
    return stamped;
  }

  function deleteLog(date) {
    var logs = getLogs().filter(function (l) { return l.date !== date; });
    writeJSON(KEY_LOGS, logs);
  }

  // ---- Export / Import ----

  /** The full backup payload, in the §9.1 export format. */
  function exportData() {
    return {
      app: 'operation-health',
      schemaVersion: L.SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      profile: getProfile(),
      dailyLogs: getLogs()
    };
  }

  /**
   * importData(data, mode)
   * mode 'merge'   → imported day replaces same-date local day; others kept.
   * mode 'replace' → wipe local logs, use imported set.
   * Profile is taken from the import when present.
   * Caller must have validated with Logic.validateImport first.
   * @returns {{added:number, replaced:number, total:number}}
   */
  function importData(data, mode) {
    var incoming = (data.dailyLogs || []).map(L.migrateRecord);

    var result = { added: 0, replaced: 0, total: 0 };

    if (mode === 'replace') {
      writeJSON(KEY_LOGS, incoming);
      result.added = incoming.length;
    } else {
      var byDate = {};
      getLogs().forEach(function (l) { byDate[l.date] = l; });
      incoming.forEach(function (l) {
        if (byDate[l.date]) result.replaced++; else result.added++;
        byDate[l.date] = l;
      });
      var merged = Object.keys(byDate).map(function (d) { return byDate[d]; });
      merged.sort(function (a, b) { return a.date < b.date ? -1 : 1; });
      writeJSON(KEY_LOGS, merged);
    }

    if (data.profile && typeof data.profile === 'object') {
      saveProfile(data.profile);
    }

    result.total = getLogs().length;
    return result;
  }

  window.Storage = {
    DEFAULT_PROFILE: DEFAULT_PROFILE,
    getProfile: getProfile,
    saveProfile: saveProfile,
    getLogs: getLogs,
    getLog: getLog,
    saveLog: saveLog,
    deleteLog: deleteLog,
    exportData: exportData,
    importData: importData
  };
})();
