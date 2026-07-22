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
  var KEY_ENTRIES = 'oh.entries'; // incremental-logging stream (LogEntry records) — source of truth
  var KEY_MEAL_LIB = 'oh.mealLibrary'; // reusable saved meals (reference data, not entries)
  var KEY_PREFS = 'oh.prefs'; // lightweight UI prefs (not health data, not exported)

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
    roadmapPhase: 1,
    // Nutrition targets (reqs §5 starting numbers) — CONFIGURABLE, never hard-coded
    // anywhere else. Pending a doctor/dietitian check. Carbs ≈ remaining calories.
    calorieTarget: 2400,
    proteinTarget: 170, // grams
    carbTarget: 260,
    fatTarget: 75,
    fiberTarget: 30,
    sodiumTarget: 2300, // mg — FDA/DGA daily limit; tracked, not scored (Meals M3)
    // Display-unit preferences (§9.3 Slice 4). Canonical storage is unchanged
    // (water = L, weight = lb); these only affect display/entry. Defaulted on
    // read for older profiles, so no schema bump is needed.
    waterUnit: 'L',     // 'L' | 'oz'
    weightUnit: 'lb',   // 'lb' | 'kg' (existing weight data is canonical pounds)
    circumferenceUnit: 'in', // 'in' | 'cm' (measurements stored canonical inches)
    timeFormat: '24',   // '24' | '12' — how times are shown (inputs stay 24h)
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

  // ---- Daily logs (DERIVED — projected from the entries stream) ----
  // Entries are the source of truth; these project them into the DailyLog shape
  // the scoring/trends/history engine consumes, so that engine is untouched.

  /** All days that have entries, projected, ascending by date. */
  function getLogs() {
    return L.projectAll(getEntries());
  }

  /** One day's projected log, or null if that day has no entries. */
  function getLog(date) {
    var es = getDayEntries(date);
    return es.length ? L.projectDay(es) : null;
  }

  // ---- Measurements (DERIVED) ----
  // Body metrics are now weight/circumference entries; these thin accessors keep
  // the Trends weight chart and History day-detail reading through one shape.

  /** Projected days that carry a weight or any circumference. */
  function getMeasurements() {
    return getLogs().filter(function (d) {
      return isNum(d.weight) || (d.circumferences && Object.keys(d.circumferences).length);
    });
  }

  /** One day's projected measurement view, or null if nothing body-related. */
  function getMeasurement(date) {
    var d = getLog(date);
    if (!d) return null;
    return (isNum(d.weight) || d.circumferences) ? d : null;
  }

  function isNum(v) { return typeof v === 'number' && isFinite(v); }

  // ---- Log entries (incremental-logging stream — the source of truth) ----

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

    // additive and meal entries accrue (many per day); snapshot/binary/circumference
    // are one-per-day (per site) and replace the prior on save.
    var t = L.ENTRY_TYPES[rec.type];
    var appendLike = t && (t.semantic === 'additive' || t.semantic === 'meal');
    if (t && !appendLike) {
      all = all.filter(function (e) {
        if (e.date !== rec.date || e.type !== rec.type) return true;
        if (t.semantic === 'circumference') return e.site !== rec.site;
        return false;
      });
    } else if (entry.id) {
      // Editing an existing append-like entry: replace it rather than duplicate.
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

  // ---- Meal Library (reusable saved meals; §7.8) ----

  /** Saved meals, migrated, sorted A→Z by name. */
  function getMealLibrary() {
    var m = readJSON(KEY_MEAL_LIB, []);
    if (!Array.isArray(m)) m = [];
    return m.map(L.migrateRecord).sort(function (a, b) {
      var an = String(a.name || '').toLowerCase(), bn = String(b.name || '').toLowerCase();
      return an < bn ? -1 : an > bn ? 1 : 0;
    });
  }

  /** Insert or update a library item (by id). */
  function saveMealItem(item) {
    var rec = L.migrateRecord(Object.assign({}, item));
    if (!rec.id) rec.id = genId();
    var all = readJSON(KEY_MEAL_LIB, []);
    if (!Array.isArray(all)) all = [];
    all = all.filter(function (x) { return x.id !== rec.id; });
    all.push(rec);
    writeJSON(KEY_MEAL_LIB, all);
    return rec;
  }

  function deleteMealItem(id) {
    var all = getMealLibrary().filter(function (x) { return x.id !== id; });
    writeJSON(KEY_MEAL_LIB, all);
  }

  /** Find a saved meal by name (case-insensitive) — used for upsert-on-save. */
  function findMealByName(name) {
    var n = String(name || '').trim().toLowerCase();
    if (!n) return null;
    return getMealLibrary().filter(function (x) {
      return String(x.name || '').trim().toLowerCase() === n;
    })[0] || null;
  }

  // ---- Export / Import ----

  /** The full backup payload — the entries stream plus profile (v4). */
  function exportData() {
    return {
      app: 'operation-health',
      schemaVersion: L.SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      profile: getProfile(),
      entries: getEntries(),
      mealLibrary: getMealLibrary()
    };
  }

  /**
   * importData(data, mode)
   * mode 'merge'   → imported entry replaces a local one with the same id;
   *                  entries with new ids are added.
   * mode 'replace' → wipe local entries, use the imported set.
   * Profile is taken from the import when present.
   * Caller must have validated with Logic.validateImport first.
   * @returns {{added:number, replaced:number, total:number}}
   */
  function importData(data, mode) {
    var incoming = (data.entries || []).map(L.migrateRecord);
    incoming.forEach(function (e) { if (!e.id) e.id = genId(); });

    var result = { added: 0, replaced: 0, total: 0 };

    if (mode === 'replace') {
      writeJSON(KEY_ENTRIES, incoming);
      result.added = incoming.length;
    } else {
      var byId = {};
      getEntries().forEach(function (e) { byId[e.id] = e; });
      incoming.forEach(function (e) {
        if (byId[e.id]) result.replaced++; else result.added++;
        byId[e.id] = e;
      });
      var merged = Object.keys(byId).map(function (id) { return byId[id]; });
      merged.sort(byEntryOrder);
      writeJSON(KEY_ENTRIES, merged);
    }

    if (data.profile && typeof data.profile === 'object') {
      saveProfile(data.profile);
    }

    // Meal library (optional): replace wholesale, or upsert by id on merge.
    if (Array.isArray(data.mealLibrary)) {
      if (mode === 'replace') {
        writeJSON(KEY_MEAL_LIB, data.mealLibrary.map(L.migrateRecord));
      } else {
        var libById = {};
        getMealLibrary().forEach(function (x) { libById[x.id] = x; });
        data.mealLibrary.map(L.migrateRecord).forEach(function (x) {
          if (x.id) libById[x.id] = x;
        });
        writeJSON(KEY_MEAL_LIB, Object.keys(libById).map(function (id) { return libById[id]; }));
      }
    }

    result.total = getEntries().length;
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
    getMeasurements: getMeasurements,
    getMeasurement: getMeasurement,
    getEntries: getEntries,
    getDayEntries: getDayEntries,
    saveEntry: saveEntry,
    deleteEntry: deleteEntry,
    getMealLibrary: getMealLibrary,
    saveMealItem: saveMealItem,
    deleteMealItem: deleteMealItem,
    findMealByName: findMealByName,
    exportData: exportData,
    importData: importData
  };
})();
