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
  var KEY_MEASUREMENTS = 'oh.measurements'; // periodic body metrics (§6), date-keyed
  var KEY_ENTRIES = 'oh.entries'; // incremental-logging stream (LogEntry records)
  var KEY_PREFS = 'oh.prefs'; // lightweight UI prefs (not health data, not exported)

  function byDateAsc(a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; }

  // Entries sort chronologically: by date, then time (time-less first), then id.
  function byEntryOrder(a, b) {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    var ta = a.time || '', tb = b.time || '';
    if (ta !== tb) return ta < tb ? -1 : 1;
    return (a.id || '') < (b.id || '') ? -1 : (a.id || '') > (b.id || '') ? 1 : 0;
  }

  // Opaque unique id for a LogEntry (so the ledger can edit/delete a single one).
  function genId() {
    return 'e' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  // Default targets — seeded from the requirements §5 but fully editable.
  // NEVER hard-code these anywhere else; they live here and in Settings.
  var DEFAULT_PROFILE = {
    wakeGoal: '06:30',
    bedGoal: '22:30',
    stepsTarget: 8000,
    waterTarget: 3.5,   // litres (canonical; display unit is a preference)
    proteinTarget: 170, // grams (display-only in Phase 1)
    roadmapPhase: 1,
    // Display-unit preferences (§9.3 Slice 4). Canonical storage is unchanged
    // (water = L, weight = lb); these only affect display/entry. Defaulted on
    // read for older profiles, so no schema bump is needed.
    waterUnit: 'L',     // 'L' | 'oz'
    weightUnit: 'lb',   // 'lb' | 'kg' (existing weight data is canonical pounds)
    circumferenceUnit: 'in', // 'in' | 'cm' (measurements stored canonical inches)
    // Graded-consistency scoring dials (§9.2). Seeded from the canonical
    // defaults in logic.js (one source of truth); a tuning UI comes in a later
    // Phase-2 slice. NEVER hard-code these in logic/UI — they flow in from the
    // profile. Deep-cloned so edits can't mutate the shared default object.
    scoring: JSON.parse(JSON.stringify(L.DEFAULT_SCORING)),
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

  // ---- Measurements (periodic body metrics; date is the primary key) ----

  /** All measurements, migrated, sorted ascending by date. */
  function getMeasurements() {
    var m = readJSON(KEY_MEASUREMENTS, []);
    if (!Array.isArray(m)) m = [];
    return m.map(L.migrateRecord).sort(byDateAsc);
  }

  function getMeasurement(date) {
    return getMeasurements().filter(function (m) { return m.date === date; })[0] || null;
  }

  /** Insert or replace the measurement for its date. */
  function saveMeasurement(record) {
    var stamped = L.migrateRecord(Object.assign({}, record));
    var all = getMeasurements().filter(function (m) { return m.date !== stamped.date; });
    all.push(stamped);
    all.sort(byDateAsc);
    writeJSON(KEY_MEASUREMENTS, all);
    return stamped;
  }

  function deleteMeasurement(date) {
    var all = getMeasurements().filter(function (m) { return m.date !== date; });
    writeJSON(KEY_MEASUREMENTS, all);
  }

  // ---- Log entries (incremental-logging stream) ----
  // The forthcoming source of truth for daily data. Reads/writes here; the UI
  // will project these into derived DailyLogs via Logic.projectAll (wired in a
  // later sub-slice). Defined now so the UI can build on a stable, tested store.

  /** All entries, migrated, in chronological order. */
  function getEntries() {
    var e = readJSON(KEY_ENTRIES, []);
    if (!Array.isArray(e)) e = [];
    return e.map(L.migrateRecord).sort(byEntryOrder);
  }

  /** Just one day's entries (chronological). */
  function getDayEntries(date) {
    return getEntries().filter(function (e) { return e.date === date; });
  }

  /**
   * Insert or update a LogEntry.
   * - additive types (water, steps): a new entry is appended; passing an existing
   *   `id` edits that one entry in place.
   * - snapshot/binary types: one-per-day — saving replaces any existing entry of
   *   the same type that day (per site, for circumferences). New ids are minted.
   */
  function saveEntry(entry) {
    var rec = L.migrateRecord(Object.assign({}, entry));
    if (!rec.id) rec.id = genId();

    var all = readJSON(KEY_ENTRIES, []);
    if (!Array.isArray(all)) all = [];

    var t = L.ENTRY_TYPES[rec.type];
    if (t && t.semantic !== 'additive') {
      // Enforce one-per-day (per site for circumference) by dropping the prior.
      all = all.filter(function (e) {
        if (e.date !== rec.date || e.type !== rec.type) return true;
        if (t.semantic === 'circumference') return e.site !== rec.site;
        return false;
      });
    } else if (entry.id) {
      // Editing an existing additive entry: replace it rather than duplicate.
      all = all.filter(function (e) { return e.id !== entry.id; });
    }

    all.push(rec);
    all.sort(byEntryOrder);
    writeJSON(KEY_ENTRIES, all);
    return rec;
  }

  function deleteEntry(id) {
    var all = getEntries().filter(function (e) { return e.id !== id; });
    writeJSON(KEY_ENTRIES, all);
  }

  /**
   * Move any pre-v3 weight still stored on daily logs into measurements.
   * Idempotent and cheap: runs the pure Logic.splitWeightToMeasurements over the
   * raw stores and only writes back when something actually moved. Called once
   * at load (below) and again after an import of an older backup.
   */
  function migrateWeightToMeasurements() {
    try {
      var res = L.splitWeightToMeasurements(
        readJSON(KEY_LOGS, []), readJSON(KEY_MEASUREMENTS, []));
      if (res.changed) {
        writeJSON(KEY_LOGS, res.logs);
        writeJSON(KEY_MEASUREMENTS, res.measurements);
      }
    } catch (e) {
      console.error('Weight→measurement migration failed', e);
    }
  }

  // ---- Export / Import ----

  /** The full backup payload, in the §9.1 export format. */
  function exportData() {
    return {
      app: 'operation-health',
      schemaVersion: L.SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      profile: getProfile(),
      dailyLogs: getLogs(),
      measurements: getMeasurements()
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
    var incomingMeas = (data.measurements || []).map(L.migrateRecord);

    var result = { added: 0, replaced: 0, total: 0 };

    if (mode === 'replace') {
      writeJSON(KEY_LOGS, incoming);
      writeJSON(KEY_MEASUREMENTS, incomingMeas);
      result.added = incoming.length;
    } else {
      var byDate = {};
      getLogs().forEach(function (l) { byDate[l.date] = l; });
      incoming.forEach(function (l) {
        if (byDate[l.date]) result.replaced++; else result.added++;
        byDate[l.date] = l;
      });
      var merged = Object.keys(byDate).map(function (d) { return byDate[d]; });
      merged.sort(byDateAsc);
      writeJSON(KEY_LOGS, merged);

      // Measurements ride along on merge (same date-keyed upsert); the added/
      // replaced tally stays about days, so it isn't counted here.
      var mByDate = {};
      getMeasurements().forEach(function (m) { mByDate[m.date] = m; });
      incomingMeas.forEach(function (m) { mByDate[m.date] = m; });
      var mMerged = Object.keys(mByDate).map(function (d) { return mByDate[d]; });
      mMerged.sort(byDateAsc);
      writeJSON(KEY_MEASUREMENTS, mMerged);
    }

    if (data.profile && typeof data.profile === 'object') {
      saveProfile(data.profile);
    }

    // An older (pre-v3) backup carries weight on its logs — bring it across.
    migrateWeightToMeasurements();

    result.total = getLogs().length;
    return result;
  }

  // ---- UI prefs (view state like the chosen trend range) ----

  function getPrefs() {
    var p = readJSON(KEY_PREFS, {});
    return (p && typeof p === 'object') ? p : {};
  }

  function setPref(key, value) {
    var p = getPrefs();
    p[key] = value;
    writeJSON(KEY_PREFS, p);
    return p;
  }

  window.Storage = {
    DEFAULT_PROFILE: DEFAULT_PROFILE,
    getProfile: getProfile,
    saveProfile: saveProfile,
    getPrefs: getPrefs,
    setPref: setPref,
    getLogs: getLogs,
    getLog: getLog,
    saveLog: saveLog,
    deleteLog: deleteLog,
    getMeasurements: getMeasurements,
    getMeasurement: getMeasurement,
    saveMeasurement: saveMeasurement,
    deleteMeasurement: deleteMeasurement,
    getEntries: getEntries,
    getDayEntries: getDayEntries,
    saveEntry: saveEntry,
    deleteEntry: deleteEntry,
    exportData: exportData,
    importData: importData
  };

  // One-time on load: relocate any weight that predates the Measurements module
  // out of daily logs. No-op once the store is clean (idempotent).
  migrateWeightToMeasurements();
})();
