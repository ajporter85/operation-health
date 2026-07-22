/*
 * app.js — Operation: Health
 * UI wiring only. Reads/writes go through window.Storage; all scoring goes
 * through window.Logic. No business rules or persistence live here.
 */
(function () {
  'use strict';

  var L = window.Logic;
  var S = window.Storage;
  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  // ---------------------------------------------------------------- views
  function showView(name) {
    $$('.view').forEach(function (v) { v.hidden = v.dataset.view !== name; });
    $$('.tab').forEach(function (t) {
      t.setAttribute('aria-selected', String(t.dataset.view === name));
    });
    // Leaving the Log tab closes any open sheet, so its form ids (shared with the
    // History meal editor) can't linger in the DOM and collide.
    if (name !== 'log') closeSheet();
    if (name === 'dashboard') renderDashboard();
    if (name === 'log') renderLog();
    if (name === 'history') renderHistory();
    if (name === 'trends') renderTrends();
    if (name === 'settings') loadSettingsForm();
  }

  $$('.tab').forEach(function (t) {
    t.addEventListener('click', function () { showView(t.dataset.view); });
  });

  // ------------------------------------------------------------ dashboard
  function renderDashboard() {
    var logs = S.getLogs();
    var profile = S.getProfile();
    var today = L.todayISO();

    // Today card
    var loggedToday = L.isLoggedToday(logs, today);
    var statusEl = $('#today-status');
    statusEl.textContent = loggedToday ? 'Logged ✓' : 'Not logged yet';
    statusEl.className = 'card-status ' + (loggedToday ? 'done' : 'todo');
    $('#today-date').textContent = formatLongDate(today);
    $('#today-cta').textContent = loggedToday ? 'Edit today' : 'Log today';

    // Streak card
    var streak = L.computeStreak(logs, profile, today);
    $('#streak-value').textContent = streak;
    $('#streak-sub').textContent = streak === 1 ? 'day in a row' : 'days in a row';

    // Consistency card
    var c = L.computeConsistency(logs, profile, today);
    $('#score-value').innerHTML = c.score + '<span class="unit">/100</span>';
    $('#score-meter').style.width = c.score + '%';
    $('#score-hint').textContent =
      c.hint || (logs.length ? 'Nailing every core habit — keep it up.' :
                               'Log a few days to build your score.');

    // Color the number by its whole-day band — but only once there's data to
    // grade (an empty history shouldn't glare red before you've logged a thing).
    var band = logs.length ? L.gradeDay(c.score, L.scoringConfig(profile).dayBands) : '';
    $('#score-value').className = 'card-big' + (band ? ' grade-' + band : '');

    // 7-day overall-grade dot strip.
    renderDotStrip(L.last7Grades(logs, profile, today), today);
  }

  var DOT_CLASS = { green: 'g', yellow: 'y', red: 'r' };
  function renderDotStrip(days, today) {
    $('#dot-strip').innerHTML = days.map(function (d) {
      var cls = 'dot ' + (d.logged ? DOT_CLASS[d.grade] : 'none') +
                (d.date === today ? ' today' : '');
      var label = escapeHtml(formatLongDate(d.date) + (d.logged
        ? ' — ' + d.score + '/100 (' + d.grade + ')'
        : ' — no log'));
      return '<span class="' + cls + '" title="' + label + '" aria-label="' + label + '"></span>';
    }).join('');
  }

  // -------------------------------------------------------------- trends
  var CHART_W = 600, CHART_H = 150, CHART_PADX = 10, CHART_PADY = 16;
  // Rolling windows only — one consistent paradigm (calendar "This month" was
  // dropped in the Trends-polish pass; §9.3). rangeToDays still supports other
  // keys, and a stale saved pref falls back to DEFAULT_RANGE.
  var RANGES = [
    { key: '7d',  label: 'Last 7 days' },
    { key: '30d', label: 'Last 30 days' },
    { key: '3m',  label: 'Last 3 months' },
    { key: '6m',  label: 'Last 6 months' },
    { key: '1y',  label: 'Last year' },
    { key: 'all', label: 'All time' }
  ];
  var DEFAULT_RANGE = '30d';

  // Populate the range dropdown, restore the saved choice, and persist changes.
  // Called once at startup (the elements are static).
  function setupTrends() {
    var sel = $('#trend-range');
    sel.innerHTML = RANGES.map(function (r) {
      return '<option value="' + r.key + '">' + escapeHtml(r.label) + '</option>';
    }).join('');
    var saved = S.getPrefs().trendRange;
    sel.value = RANGES.some(function (r) { return r.key === saved; }) ? saved : DEFAULT_RANGE;
    sel.addEventListener('change', function () {
      S.setPref('trendRange', sel.value);
      renderTrends();
    });
  }

  function renderTrends() {
    var logs = S.getLogs();
    // Weight lives in measurements now (§6), so its chart reads from there while
    // Steps/Sleep still read the daily logs.
    var measurements = S.getMeasurements();
    var profile = S.getProfile();
    var today = L.todayISO();
    var host = $('#trends-charts');
    var empty = $('#trends-empty');

    if (!logs.length && !measurements.length) { host.innerHTML = ''; empty.hidden = false; return; }
    empty.hidden = true;

    // The window spans whatever history exists across both stores.
    var rangeKey = $('#trend-range').value || DEFAULT_RANGE;
    var days = L.rangeToDays(rangeKey, logs.concat(measurements), today);

    var gunit = profile.weightUnit === 'kg' ? 'kg' : 'lb';
    var cards = [
      chartCard({ label: 'Weight', field: 'weight', unit: L.weightUnitLabel(gunit),
                  logs: measurements, today: today, days: days,
                  toDisplay: function (v) { return L.weightToDisplay(v, gunit); } }),
      chartCard({ label: 'Steps', field: 'steps', unit: '', logs: logs, today: today, days: days,
                  target: profile.stepsTarget }),
      chartCard({ label: 'Sleep', field: 'sleepHours', unit: 'h', logs: logs, today: today, days: days,
                  target: L.goalSleepHours(profile) })
    ];
    // Nutrition trends (Meals M3): only surface once meals have been logged, so
    // users who don't track food don't see three empty cards. The target line is
    // a single reference (for calories that's the middle of the range goal).
    var hasNutrition = logs.some(function (l) {
      return l.nutrition && L.MEAL_MACROS.some(function (mm) { return isFiniteNum(l.nutrition[mm.key]); });
    });
    if (hasNutrition) {
      cards.push(
        chartCard({ label: 'Protein', field: 'nutrition.protein', unit: 'g', logs: logs,
                    today: today, days: days, target: profile.proteinTarget }),
        chartCard({ label: 'Calories', field: 'nutrition.calories', unit: 'kcal', logs: logs,
                    today: today, days: days, target: profile.calorieTarget }),
        chartCard({ label: 'Fiber', field: 'nutrition.fiber', unit: 'g', logs: logs,
                    today: today, days: days, target: profile.fiberTarget })
      );
    }
    host.innerHTML = cards.join('');
  }

  function round1(v) { return Math.round(v * 10) / 10; }
  function round2(v) { return Math.round(v * 100) / 100; }
  function isFiniteNum(v) { return typeof v === 'number' && isFinite(v); }
  function signed(v) { return v > 0 ? '+' + v : String(v); } // -3.9 keeps its sign; 0 → "0"

  // ---- Display units (§9.3 Slice 4) — canonical stays L; convert at the UI edge
  function currentWaterUnit() { return S.getProfile().waterUnit === 'oz' ? 'oz' : 'L'; }
  function currentWeightUnit() { return S.getProfile().weightUnit === 'kg' ? 'kg' : 'lb'; }
  function currentCircUnit() { return S.getProfile().circumferenceUnit === 'cm' ? 'cm' : 'in'; }
  function currentTimeFormat() { return S.getProfile().timeFormat === '12' ? '12' : '24'; }
  // Round a canonical-inches value for display in its unit (both to 0.1).
  function fmtCirc(inches, unit) { return round1(L.inToDisplay(inches, unit)); }
  // Format a stored 24h "HH:MM" per the user's time-display preference.
  function fmtTime(hhmm) { return L.formatTime(hhmm, currentTimeFormat()); }
  // Round a canonical-litres value for display in its unit (oz whole, L to 0.1).
  function fmtWater(liters, unit) {
    var v = L.waterToDisplay(liters, unit);
    return unit === 'oz' ? Math.round(v) : round1(v);
  }
  // Round a canonical-pounds value for display in its unit (both to 0.1).
  function fmtWeight(lb, unit) { return round1(L.weightToDisplay(lb, unit)); }

  function chartCard(o) {
    var series = L.buildSeries(o.logs, o.field, o.today, o.days);
    // Convert canonical values to the display unit (e.g. weight lb→kg) before
    // scaling/stats, so the whole chart — line, MA, High/Low — reads in-unit.
    if (o.toDisplay) {
      series = series.map(function (p) {
        return { date: p.date, value: isFiniteNum(p.value) ? o.toDisplay(p.value) : p.value };
      });
    }
    var stats = L.seriesStats(series);
    var title = escapeHtml(o.label);
    var unit = o.unit ? ' ' + escapeHtml(o.unit) : '';
    var hasTarget = isFiniteNum(o.target);

    if (!stats.count) {
      return '<article class="card chart-card">' +
        '<h3>' + title + '</h3>' +
        '<p class="muted small chart-empty">No ' + title.toLowerCase() +
        ' logged in this range.</p></article>';
    }

    var iw = CHART_W - CHART_PADX * 2, ih = CHART_H - CHART_PADY * 2;
    // A target widens the y-range so the reference line is always in view.
    var plot = L.plotLine(series, iw, ih, hasTarget ? { min: o.target, max: o.target } : {});
    var last = plot.points[plot.points.length - 1];

    var targetSvg = '';
    if (hasTarget && plot.hi > plot.lo) {
      var ty = round1(ih - ((o.target - plot.lo) / (plot.hi - plot.lo)) * ih);
      targetSvg = '<line class="chart-target" x1="0" y1="' + ty + '" x2="' + iw + '" y2="' + ty +
        '" vector-effect="non-scaling-stroke"/>';
    }

    // 7-day moving average (§9.3), pinned to the raw line's y-scale so the two
    // overlay cleanly. Only worth showing once the window spans enough days —
    // a 7-day average over ≤7 days is meaningless — and only if it yields a line.
    var maSvg = '', showMA = false;
    if (o.days >= 14) {
      var maPlot = L.plotLine(L.movingAverage(series, 7), iw, ih, { lo: plot.lo, hi: plot.hi });
      if (maPlot.points.length >= 2) {
        showMA = true;
        maSvg = '<path class="chart-ma" d="' + maPlot.path + '" fill="none" ' +
          'vector-effect="non-scaling-stroke"/>';
      }
    }

    var summary = title + ' over ' + stats.count + ' logged day' +
      (stats.count === 1 ? '' : 's') + ': ' +
      round1(stats.first) + unit + ' to ' + round1(stats.last) + unit +
      ' (range ' + round1(stats.min) + '–' + round1(stats.max) + unit + ')' +
      (hasTarget ? ', target ' + round1(o.target) + unit : '') +
      (showMA ? '. 7-day average shown' : '') + '.';

    // Per-point hover dots (native SVG <title>). Skipped on dense ranges where
    // dots would overlap; the line + last marker + summary still convey it.
    var dots = '';
    if (plot.points.length <= 60) {
      dots = plot.points.map(function (p) {
        var lbl = escapeHtml(formatLongDate(p.date) + ' — ' + round1(p.value) + unit);
        return '<circle class="chart-dot" cx="' + p.x + '" cy="' + p.y + '" r="4" ' +
          'vector-effect="non-scaling-stroke"><title>' + lbl + '</title></circle>';
      }).join('');
    }

    var svg =
      '<svg class="chart" viewBox="0 0 ' + CHART_W + ' ' + CHART_H + '" ' +
        'role="img" aria-label="' + escapeHtml(summary) + '">' +
        '<g transform="translate(' + CHART_PADX + ',' + CHART_PADY + ')">' +
          targetSvg +
          maSvg +
          (plot.gapPath ? '<path class="chart-gap" d="' + plot.gapPath + '" fill="none" ' +
            'vector-effect="non-scaling-stroke"/>' : '') +
          '<path class="chart-line" d="' + plot.path + '" fill="none" ' +
            'vector-effect="non-scaling-stroke"/>' +
          dots +
          '<circle class="chart-last" cx="' + last.x + '" cy="' + last.y + '" r="4" ' +
            'vector-effect="non-scaling-stroke"/>' +
        '</g></svg>';

    // Legend only when the moving-average line is present (so it's explained).
    var legend = showMA ?
      '<div class="chart-legend">' +
        '<span><span class="swatch swatch-actual"></span>actual</span>' +
        '<span><span class="swatch swatch-ma"></span>7-day avg</span>' +
      '</div>' : '';

    // Endpoints frame the x-axis; the y-range now lives in the High/Low stats.
    var meta =
      '<div class="chart-meta">' +
        '<span>' + escapeHtml(shortDate(series[0].date)) + '</span>' +
        (hasTarget ? '<span class="muted">target ' + round1(o.target) + unit + '</span>' : '<span></span>') +
        '<span>' + escapeHtml(shortDate(series[series.length - 1].date)) + '</span>' +
      '</div>';

    var stat = function (k, v, title) {
      return '<span class="stat"' + (title ? ' title="' + escapeHtml(title) + '"' : '') +
        '><span class="stat-k">' + k + '</span> ' + v + '</span>';
    };
    var statItems = [
      stat('Avg', round1(stats.mean) + unit),
      stat('Change', signed(round1(stats.delta)) + unit,
        'Latest logged value minus the first in this range'),
      stat('High', round1(stats.max) + unit + ' · ' + escapeHtml(shortDate(stats.maxDate)),
        'Highest logged value in this range, and when'),
      stat('Low', round1(stats.min) + unit + ' · ' + escapeHtml(shortDate(stats.minDate)),
        'Lowest logged value in this range, and when')
    ];
    if (hasTarget) {
      var ot = L.countOnTarget(series, o.target);
      statItems.push(stat('On target', ot.on + '/' + ot.of + ' days'));
    }
    var statsRow = '<div class="chart-stats">' + statItems.join('') + '</div>';

    return '<article class="card chart-card">' +
      '<h3>' + title + ' <span class="chart-latest">' + round1(stats.last) + unit +
      '</span></h3>' + svg + legend + meta + statsRow + '</article>';
  }

  // -------------------------------------------------------------- history
  // One ISO anchor date drives all three zoom levels; the level decides what
  // the anchor frames (its day / its week / its month) and how ‹ › steps.
  var LEVELS = ['week', 'month'];
  var historyAnchor = null;
  var historyLevel = null;

  function renderHistory() {
    if (!historyAnchor) historyAnchor = L.todayISO();
    if (!historyLevel) {
      var saved = S.getPrefs().historyLevel;
      historyLevel = LEVELS.indexOf(saved) >= 0 ? saved : 'month';
    }
    var logs = S.getLogs();
    // Every level renders even when empty (a blank frame is still useful); the
    // hint just tells a first-time user there's nothing to click yet.
    $('#history-empty').hidden = !!logs.length;
    if (!logs.length) $('#day-detail').hidden = true;

    $$('.level-btn').forEach(function (b) {
      b.setAttribute('aria-selected', String(b.dataset.level === historyLevel));
    });
    $('#calendar').hidden = historyLevel !== 'month';
    $('#week-view').hidden = historyLevel !== 'week';

    if (historyLevel === 'month') renderMonth(logs);
    else renderWeek(logs);

    // Redraw an open day-detail so it reflects the latest entries and unit/time
    // prefs (e.g. after logging via "Add to this day", or changing Settings).
    if (detailDate && logs.length && !$('#day-detail').hidden) drawDayDetail(detailDate);
  }

  function renderMonth(logs) {
    var profile = S.getProfile();
    var today = L.todayISO();
    var p = historyAnchor.split('-').map(Number);
    var grid = L.monthGrid(p[0], p[1], logs, profile);
    $('#cal-label').textContent = monthLabel(p[0], p[1]);

    var head = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(function (d) {
      return '<span class="cal-dow" role="columnheader">' + d + '</span>';
    }).join('');
    var body = grid.weeks.map(function (week) {
      return week.map(function (c) { return calCell(c, today); }).join('');
    }).join('');
    $('#calendar').innerHTML = head + body;
  }

  function renderWeek(logs) {
    var profile = S.getProfile();
    var today = L.todayISO();
    var wk = L.weekGrid(historyAnchor, logs, profile);
    $('#cal-label').textContent = weekLabel(wk.start, wk.end);

    $('#week-view').innerHTML = wk.days.map(function (c) {
      var isToday = c.date === today;
      var cls = 'week-row' + (c.logged ? ' logged ' + GRADE_CLASS[c.grade] : ' empty') +
                (isToday ? ' today' : '');
      var dow = new Date(c.date.slice(0, 4), Number(c.date.slice(5, 7)) - 1, c.day)
        .toLocaleDateString(undefined, { weekday: 'short' });
      var right = c.logged
        ? '<span class="week-score grade-' + c.grade + '">' + c.score + '</span>'
        : '<span class="week-score muted">—</span>';
      var stats = c.logged ? weekStats(logs, c.date, profile) : 'No log';
      return '<button type="button" class="' + cls + '" data-date="' + c.date + '">' +
        '<span class="week-date"><strong>' + dow + '</strong> ' + c.day + '</span>' +
        '<span class="week-stats">' + stats + '</span>' + right + '</button>';
    }).join('');
  }

  // A couple of at-a-glance metrics for a logged day in the week list.
  function weekStats(logs, date, profile) {
    var log = S.getLog(date);
    var bits = [];
    if (isFiniteNum(log.steps)) bits.push(log.steps.toLocaleString() + ' steps');
    if (isFiniteNum(log.sleepHours)) bits.push(log.sleepHours + 'h sleep');
    return bits.length ? escapeHtml(bits.join(' · ')) : '—';
  }

  var GRADE_CLASS = { green: 'g', yellow: 'y', red: 'r' };
  function calCell(c, today) {
    if (!c) return '<span class="cal-cell cal-blank" aria-hidden="true"></span>';
    var cls = 'cal-cell' +
      (c.logged ? ' logged ' + GRADE_CLASS[c.grade] : ' empty') +
      (c.date === today ? ' today' : '');
    var label = escapeHtml(formatLongDate(c.date) +
      (c.logged ? ' — ' + c.score + '/100 (' + c.grade + ')' : ' — no log'));
    return '<button type="button" class="' + cls + '" role="gridcell" ' +
      'data-date="' + c.date + '" title="' + label + '" aria-label="' + label + '">' +
      '<span class="cal-day">' + c.day + '</span></button>';
  }

  // Detail for one day: score + projected summary + an editable per-entry ledger.
  // `detailDate` is the day on show; `editingEntryId` tracks an in-place row edit
  // across the re-renders that edit/save/cancel/delete trigger.
  var detailDate = null;
  var editingEntryId = null;

  function renderDayDetail(date) {
    editingEntryId = null; // arriving fresh — nothing mid-edit
    drawDayDetail(date);
  }

  function drawDayDetail(date) {
    detailDate = date;
    var panel = $('#day-detail');
    var log = S.getLog(date);
    var profile = S.getProfile();

    if (!log) {
      panel.innerHTML =
        '<div class="detail-head"><h3>' + escapeHtml(formatLongDate(date)) + '</h3></div>' +
        '<p class="muted">Nothing logged this day.</p>' +
        '<div class="form-actions"><button type="button" class="btn btn-primary" ' +
        'data-edit="' + date + '">Log this day</button></div>';
      panel.hidden = false;
      return;
    }

    var day = L.computeDailyScore(log, profile);
    var band = L.gradeDay(day.score, L.scoringConfig(profile).dayBands);
    var rows = signalRows(day, log, profile) + extraRows(log, profile);

    panel.innerHTML =
      '<div class="detail-head">' +
        '<h3>' + escapeHtml(formatLongDate(date)) + '</h3>' +
        '<span class="detail-score grade-' + band + '">' + day.score +
        '<span class="unit">/100</span></span>' +
      '</div>' +
      '<dl class="detail-list">' + rows + '</dl>' +
      '<h4 class="ledger-title">Entries</h4>' +
      renderLedger(date) +
      '<div class="form-actions"><button type="button" class="btn btn-primary" ' +
      'data-edit="' + date + '">Add to this day</button></div>';
    panel.hidden = false;
  }

  // After a ledger edit/delete: the day's grade (and maybe its very existence)
  // can change, so refresh the calendar + dashboard, then redraw the detail.
  function refreshAfterLedgerChange() {
    renderHistory();
    drawDayDetail(detailDate);
    renderDashboard();
  }

  // ---- the ledger: one row per raw entry, with inline edit/delete ----
  // Per-type metadata: how to label an entry, render its value, and (for editing)
  // convert between canonical storage and the display unit.
  var ENTRY_META = {
    water:        { label: '💧 Water', kind: 'num', unit: function () { return L.waterUnitLabel(currentWaterUnit()); }, toDisp: function (v) { return fmtWater(v, currentWaterUnit()); }, fromDisp: function (v) { return round2(L.waterFromDisplay(v, currentWaterUnit())); }, step: '0.1' },
    steps:        { label: '👟 Steps', kind: 'num', unit: function () { return ''; }, toDisp: function (v) { return v; }, fromDisp: function (v) { return Math.round(v); }, step: '100' },
    weight:       { label: '⚖️ Weight', kind: 'num', unit: function () { return L.weightUnitLabel(currentWeightUnit()); }, toDisp: function (v) { return fmtWeight(v, currentWeightUnit()); }, fromDisp: function (v) { return round2(L.weightFromDisplay(v, currentWeightUnit())); }, step: '0.1' },
    circumference:{ label: '📏', kind: 'num', unit: function () { return L.circumferenceUnitLabel(currentCircUnit()); }, toDisp: function (v) { return fmtCirc(v, currentCircUnit()); }, fromDisp: function (v) { return round2(L.inFromDisplay(v, currentCircUnit())); }, step: '0.1' },
    protein:      { label: 'Morning protein', kind: 'yn' },
    exercise:     { label: 'Morning exercise', kind: 'yn' },
    wake:         { label: 'Wake time', kind: 'time' },
    bed:          { label: 'Bed time', kind: 'time' },
    sleepHours:   { label: 'Sleep', kind: 'num', unit: function () { return 'h'; }, toDisp: function (v) { return v; }, fromDisp: function (v) { return Number(v); }, step: '0.25' },
    sleepQuality: { label: 'Sleep quality', kind: 'num', unit: function () { return '/5'; }, toDisp: function (v) { return v; }, fromDisp: function (v) { return Number(v); }, step: '1' },
    energy:       { label: 'Morning energy', kind: 'num', unit: function () { return '/5'; }, toDisp: function (v) { return v; }, fromDisp: function (v) { return Number(v); }, step: '1' }
  };

  function entryLabel(e) {
    if (e.type === 'meal') return '🍽️ ' + mealSlotLabel(e.slot) + (e.name ? ' — ' + e.name : '');
    var m = ENTRY_META[e.type];
    var lab = m ? m.label : e.type;
    if (e.type === 'circumference') {
      var site = L.CIRC_SITES.filter(function (s) { return s.key === e.site; })[0];
      lab += ' ' + (site ? site.label : e.site);
    }
    return lab;
  }
  function entryValueText(e) {
    if (e.type === 'meal') {
      return L.MEAL_MACROS.filter(function (mm) { return isFiniteNum(e[mm.key]); })
        .map(function (mm) { return fmtMacro(e[mm.key], mm); }).join(' · ');
    }
    var m = ENTRY_META[e.type];
    if (!m) return String(e.value);
    if (m.kind === 'yn') return e.value === 'Y' ? 'Yes' : 'No';
    if (m.kind === 'time') return fmtTime(e.value);
    if (e.type === 'steps') return Number(e.value).toLocaleString();
    var u = m.unit();
    return m.toDisp(e.value) + (u ? ' ' + u : '');
  }

  function renderLedger(date) {
    var entries = S.getDayEntries(date); // chronological
    if (!entries.length) return '<p class="muted small">No entries.</p>';
    return '<ul class="ledger">' + entries.map(function (e) {
      var time = e.time ? escapeHtml(fmtTime(e.time)) : '—';
      if (e.id === editingEntryId) {
        return '<li class="led-row editing"><span class="led-time">' + time + '</span>' +
          '<span class="led-edit">' + ledEditHtml(e) + '</span></li>';
      }
      return '<li class="led-row"><span class="led-time">' + time + '</span>' +
        '<span class="led-body"><strong>' + escapeHtml(entryLabel(e)) + '</strong> ' +
        escapeHtml(entryValueText(e)) +
        (e.note ? ' <span class="led-note">— ' + escapeHtml(e.note) + '</span>' : '') + '</span>' +
        '<span class="led-actions">' +
          '<button type="button" class="btn btn-ghost btn-sm" data-led-edit="' + e.id + '">Edit</button>' +
          '<button type="button" class="btn btn-ghost btn-sm" data-led-delete="' + e.id + '">Delete</button>' +
        '</span></li>';
    }).join('') + '</ul>';
  }

  function ledEditHtml(e) {
    if (e.type === 'meal') {
      return '<div class="led-meal-edit">' + mealFieldsHtml(e) + '</div>' +
        '<span class="led-edit-line"><label class="muted small" for="led-time">Time</label> ' +
          '<input type="time" id="led-time" value="' + (e.time || '') + '"></span>' +
        '<span class="led-edit-line"><input type="text" id="led-note" maxlength="140" placeholder="note (optional)" value="' +
          escapeHtml(e.note || '') + '"></span>' +
        '<div class="errors" id="led-err" hidden></div>' +
        '<span class="led-edit-actions">' +
          '<button type="button" class="btn btn-primary btn-sm" data-led-save="' + e.id + '">Save</button>' +
          '<button type="button" class="btn btn-ghost btn-sm" data-led-cancel="1">Cancel</button>' +
        '</span>';
    }
    var m = ENTRY_META[e.type];
    var valInput;
    if (m.kind === 'yn') {
      valInput = '<select id="led-val">' +
        '<option value="Y"' + (e.value === 'Y' ? ' selected' : '') + '>Yes</option>' +
        '<option value="N"' + (e.value === 'N' ? ' selected' : '') + '>No</option></select>';
    } else if (m.kind === 'time') {
      valInput = '<input type="time" id="led-val" value="' + (e.value || '') + '">';
    } else {
      valInput = '<input type="number" id="led-val" step="' + m.step + '" min="0" value="' +
        m.toDisp(e.value) + '">' + (m.unit() ? ' <span class="muted small">' + m.unit() + '</span>' : '');
    }
    return '<span class="led-edit-line"><strong>' + escapeHtml(entryLabel(e)) + '</strong> ' + valInput + '</span>' +
      '<span class="led-edit-line"><label class="muted small" for="led-time">Time</label> ' +
        '<input type="time" id="led-time" value="' + (e.time || '') + '"></span>' +
      '<span class="led-edit-line"><input type="text" id="led-note" maxlength="140" placeholder="note (optional)" value="' +
        escapeHtml(e.note || '') + '"></span>' +
      '<div class="errors" id="led-err" hidden></div>' +
      '<span class="led-edit-actions">' +
        '<button type="button" class="btn btn-primary btn-sm" data-led-save="' + e.id + '">Save</button>' +
        '<button type="button" class="btn btn-ghost btn-sm" data-led-cancel="1">Cancel</button>' +
      '</span>';
  }

  function collectLedEdit(e) {
    if (e.type === 'meal') {
      var meal = collectMealFields();
      meal.id = e.id; meal.date = e.date; meal.type = 'meal';
      var mt = $('#led-time').value; if (mt) meal.time = mt;
      var mn = $('#led-note').value.trim(); if (mn) meal.note = mn;
      return meal;
    }
    var m = ENTRY_META[e.type];
    var out = { id: e.id, date: e.date, type: e.type };
    if (e.site) out.site = e.site;
    var raw = $('#led-val').value;
    out.value = (m.kind === 'yn' || m.kind === 'time') ? raw : m.fromDisp(Number(raw));
    var t = $('#led-time').value; if (t) out.time = t;
    var n = $('#led-note').value.trim(); if (n) out.note = n;
    return out;
  }

  // The scored signals, each with its grade dot and the value behind the grade.
  var SIGNAL_LABEL = {
    protein: 'Morning protein', morningExercise: 'Morning exercise',
    steps: 'Steps', water: 'Water', wake: 'Wake time',
    proteinTotal: 'Daily protein', calories: 'Calories', fiber: 'Daily fiber'
  };
  // Format a nutrition total via its MEAL_MACROS spec (e.g. "165 g", "2410 kcal").
  function nutriVal(log, key) {
    var v = log.nutrition && log.nutrition[key];
    if (!isFiniteNum(v)) return '—';
    var mm = L.MEAL_MACROS.filter(function (m) { return m.key === key; })[0];
    return mm ? fmtMacro(v, mm) : String(v);
  }
  function signalValue(sig, log, profile) {
    switch (sig) {
      case 'protein': return log.proteinWithin30 === 'Y' ? 'Yes' : 'No';
      case 'morningExercise': return log.morningExercise === 'Y' ? 'Yes' : 'No';
      case 'steps': return isFiniteNum(log.steps) ? log.steps.toLocaleString() : '—';
      case 'water':
        if (!isFiniteNum(log.waterLiters)) return '—';
        var wu = profile.waterUnit === 'oz' ? 'oz' : 'L';
        return fmtWater(log.waterLiters, wu) + ' ' + L.waterUnitLabel(wu);
      case 'wake': return log.wakeTime ? fmtTime(log.wakeTime) : '—';
      case 'proteinTotal': return nutriVal(log, 'protein');
      case 'calories': return nutriVal(log, 'calories');
      case 'fiber': return nutriVal(log, 'fiber');
      default: return '';
    }
  }
  function signalRows(day, log, profile) {
    return day.signals.filter(function (s) { return s !== 'logged'; }).map(function (s) {
      var g = day.states[s];
      return '<div class="detail-row">' +
        '<dt><span class="dot ' + GRADE_CLASS[g] + '"></span>' + SIGNAL_LABEL[s] + '</dt>' +
        '<dd>' + escapeHtml(signalValue(s, log, profile)) + '</dd></div>';
    }).join('');
  }
  // Logged-but-unscored fields, shown for context (no grade dot).
  function extraRows(log, profile) {
    var gunit = profile.weightUnit === 'kg' ? 'kg' : 'lb';
    var out = [];
    function row(label, val) {
      if (val === undefined || val === null || val === '') return;
      out.push('<div class="detail-row extra"><dt>' + label + '</dt><dd>' +
        escapeHtml(String(val)) + '</dd></div>');
    }
    row('Sleep', isFiniteNum(log.sleepHours) ? log.sleepHours + ' h' : '');
    row('Sleep quality', isFiniteNum(log.sleepQuality) ? log.sleepQuality + '/5' : '');
    row('Morning energy', isFiniteNum(log.morningEnergy) ? log.morningEnergy + '/5' : '');
    row('Bed time', log.bedTime ? fmtTime(log.bedTime) : '');
    // Weight now comes from that day's measurement, not the daily log.
    var meas = S.getMeasurement(log.date);
    row('Weight', meas && isFiniteNum(meas.weight)
      ? fmtWeight(meas.weight, gunit) + ' ' + L.weightUnitLabel(gunit) : '');
    return out.join('');
  }

  function monthLabel(year, month) {
    return new Date(year, month - 1, 1)
      .toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  }
  function weekLabel(startISO, endISO) {
    var e = new Date(endISO.slice(0, 4), Number(endISO.slice(5, 7)) - 1, Number(endISO.slice(8)));
    // "Jun 29 – Jul 5" (drop the repeated month when both fall in the same one).
    var sameMonth = startISO.slice(0, 7) === endISO.slice(0, 7);
    return shortDate(startISO) + ' – ' +
      (sameMonth ? String(e.getDate()) : shortDate(endISO));
  }

  // Step the anchor by the active level's unit; month steps land on the 1st.
  function shiftNav(delta) {
    if (historyLevel === 'week') {
      historyAnchor = L.addDaysISO(historyAnchor, delta * 7);
    } else {
      var p = historyAnchor.split('-').map(Number);
      var m = p[1] + delta, y = p[0];
      if (m < 1) { m = 12; y--; } else if (m > 12) { m = 1; y++; }
      historyAnchor = y + '-' + String(m).padStart(2, '0') + '-01';
    }
    $('#day-detail').hidden = true; // the detail belongs to the period you left
    renderHistory();
  }

  function setLevel(level) {
    if (LEVELS.indexOf(level) < 0 || level === historyLevel) return;
    historyLevel = level;
    S.setPref('historyLevel', level);
    $('#day-detail').hidden = true; // start clean when changing zoom
    renderHistory();
  }

  $('#cal-prev').addEventListener('click', function () { shiftNav(-1); });
  $('#cal-next').addEventListener('click', function () { shiftNav(1); });

  $$('.level-btn').forEach(function (b) {
    b.addEventListener('click', function () { setLevel(b.dataset.level); });
  });

  // Clicking a day in month or week drills into its detail below.
  function onDayPick(e) {
    var cell = e.target.closest('[data-date]');
    if (cell) renderDayDetail(cell.dataset.date);
  }
  $('#calendar').addEventListener('click', onDayPick);
  $('#week-view').addEventListener('click', onDayPick);

  $('#day-detail').addEventListener('click', function (e) {
    if (maybeHandleSlotClick(e)) return; // meal editor slot picker

    var jump = e.target.closest('button[data-edit]');
    if (jump) { $('#f-date').value = jump.dataset.edit; showView('log'); return; }

    var ed = e.target.closest('[data-led-edit]');
    if (ed) { editingEntryId = ed.dataset.ledEdit; drawDayDetail(detailDate); return; }

    var cancel = e.target.closest('[data-led-cancel]');
    if (cancel) { editingEntryId = null; drawDayDetail(detailDate); return; }

    var del = e.target.closest('[data-led-delete]');
    if (del) {
      if (!confirm('Delete this entry? This cannot be undone.')) return;
      S.deleteEntry(del.dataset.ledDelete);
      editingEntryId = null;
      refreshAfterLedgerChange();
      return;
    }

    var save = e.target.closest('[data-led-save]');
    if (save) {
      var id = save.dataset.ledSave;
      var entry = S.getDayEntries(detailDate).filter(function (x) { return x.id === id; })[0];
      if (!entry) return;
      var edited = collectLedEdit(entry);
      var check = L.validateEntry(edited);
      if (!check.valid) {
        var box = $('#led-err');
        if (box) {
          var firstKey = Object.keys(check.errors)[0];
          box.textContent = check.errors[firstKey] || 'Please enter a valid value.';
          box.hidden = false;
        }
        return;
      }
      var saveLib = edited.type === 'meal' && wantsSaveToLibrary();
      var mealFields = saveLib ? collectMealFields() : null;
      S.saveEntry(edited);
      if (saveLib) saveMealToLibrary(mealFields);
      editingEntryId = null;
      refreshAfterLedgerChange();
    }
  });

  // ------------------------------------------------------------- log tab
  // Incremental logging: pick a metric chip → a focused sheet → save entries.
  // Everything writes to the entries store; the day summary reflects the
  // projection so running totals update as you go.

  function currentTime() {
    var d = new Date();
    return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }
  function logDate() { return $('#f-date').value || L.todayISO(); }

  function renderLog() {
    if (!$('#f-date').value) $('#f-date').value = L.todayISO();
    syncTopTime();
    closeSheet();
    renderDaySummary(logDate());
  }

  // The date + time at the top are the shared timestamp for whatever you log.
  // Default the time to now when logging for today; blank when backfilling a past
  // day (its exact time doesn't matter). Refreshed whenever you enter the tab or
  // change the date, so as-you-go logging picks up the current time.
  function syncTopTime() {
    $('#f-time').value = (logDate() === L.todayISO()) ? currentTime() : '';
  }
  function topTime() { var el = $('#f-time'); return el && el.value ? el.value : ''; }

  var openType = null;
  var ADDITIVE_STAYS_OPEN = { water: true, steps: true };

  // Shared sheet footer: an optional per-entry note (time lives up top, with date).
  function sheetFooter(opts) {
    opts = opts || {};
    return '<div class="field"><label for="sh-note">Note <span class="muted small">(optional)</span></label>' +
        '<input type="text" id="sh-note" maxlength="140" placeholder="optional"></div>' +
      '<div class="errors" id="sheet-errors" hidden></div>' +
      '<div class="form-actions">' +
        '<button type="button" class="btn btn-primary" data-act="save">' + (opts.saveLabel || 'Save') + '</button>' +
        '<button type="button" class="btn btn-ghost" data-act="cancel">Cancel</button>' +
        '<span class="save-feedback" id="sheet-saved" hidden>Added ✓</span>' +
      '</div>';
  }

  function ynRow(label, field) {
    return '<div class="toggle-row"><span class="toggle-label">' + escapeHtml(label) + '</span>' +
      '<div class="yn" data-field="' + field + '">' +
        '<button type="button" data-val="Y">Yes</button>' +
        '<button type="button" data-val="N">No</button>' +
      '</div></div>';
  }

  // ---- meal fields (shared by the Log meal sheet and the ledger meal editor) ----
  function mealFieldsHtml(m) {
    m = m || {};
    var slots = L.MEAL_SLOTS.map(function (s) {
      return '<button type="button" class="slot-btn" data-slot="' + s.key + '" aria-pressed="' +
        (m.slot === s.key ? 'true' : 'false') + '">' + s.label + '</button>';
    }).join('');
    var macros = L.MEAL_MACROS.map(function (mm) {
      var val = isFiniteNum(m[mm.key]) ? m[mm.key] : '';
      return '<div class="field"><label for="meal-' + mm.key + '">' + mm.label + ' (' + mm.unit + ')</label>' +
        '<input type="number" id="meal-' + mm.key + '" inputmode="decimal" min="0" step="' +
        (L.INT_MACROS[mm.key] ? '10' : '1') + '" value="' + val + '"></div>';
    }).join('');
    return '<div class="slot-row" id="meal-slots">' + slots + '</div>' +
      '<div class="field"><label for="meal-name">Name <span class="muted small">(optional)</span></label>' +
      '<input type="text" id="meal-name" maxlength="80" value="' + escapeHtml(m.name || '') +
      '" placeholder="e.g. Oatmeal + shake"></div>' +
      '<div class="grid-2">' + macros + '</div>' +
      '<label class="meal-savelib"><input type="checkbox" id="meal-savelib"> ★ Save to library</label>';
  }
  function prefillMealForm(m) {
    $$('#meal-slots .slot-btn').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.dataset.slot === m.slot));
    });
    $('#meal-name').value = m.name || '';
    L.MEAL_MACROS.forEach(function (mm) {
      $('#meal-' + mm.key).value = isFiniteNum(m[mm.key]) ? m[mm.key] : '';
    });
  }
  function wantsSaveToLibrary() { var cb = $('#meal-savelib'); return !!(cb && cb.checked); }
  // Upsert the current meal-form fields into the library (by name).
  function saveMealToLibrary(fields) {
    var item = Object.assign({}, fields);
    var check = L.validateMealItem(item);
    if (!check.valid) {
      alert('Couldn’t save to library: ' + check.errors[Object.keys(check.errors)[0]]);
      return;
    }
    var existing = S.findMealByName(item.name);
    if (existing) item.id = existing.id;
    S.saveMealItem(item);
  }
  function collectMealFields() {
    var out = {};
    var slot = $('#meal-slots [aria-pressed="true"]');
    if (slot) out.slot = slot.dataset.slot;
    var name = $('#meal-name').value.trim(); if (name) out.name = name;
    L.MEAL_MACROS.forEach(function (mm) {
      var raw = $('#meal-' + mm.key).value;
      if (raw === '') return;
      var n = Number(raw);
      if (isFiniteNum(n)) out[mm.key] = L.INT_MACROS[mm.key] ? Math.round(n) : round1(n);
    });
    return out;
  }
  // Single-select slot picker, shared by the sheet and the ledger editor.
  function maybeHandleSlotClick(e) {
    var slot = e.target.closest('.slot-btn');
    if (!slot) return false;
    $$('.slot-btn', slot.parentNode).forEach(function (b) { b.setAttribute('aria-pressed', 'false'); });
    slot.setAttribute('aria-pressed', 'true');
    return true;
  }
  function fmtMacro(v, mm) { return (L.INT_MACROS[mm.key] ? Math.round(v) : round1(v)) + ' ' + mm.unit; }
  function mealSlotLabel(key) {
    var s = L.MEAL_SLOTS.filter(function (x) { return x.key === key; })[0];
    return s ? s.label : 'Meal';
  }

  function sheetHtml(type) {
    switch (type) {
      case 'water': {
        var wu = currentWaterUnit();
        var presets = wu === 'oz' ? [8, 12, 16] : [0.25, 0.5, 1];
        var btns = presets.map(function (p) {
          return '<button type="button" class="preset" data-add="' + p + '">+' + p + ' ' + L.waterUnitLabel(wu) + '</button>';
        }).join('');
        return '<h3>💧 Water</h3>' +
          '<p class="muted small">Tap a preset to log instantly, or enter an amount.</p>' +
          '<div class="preset-row">' + btns + '</div>' +
          '<div class="field"><label for="sh-water">Amount (' + L.waterUnitLabel(wu) + ')</label>' +
          '<input type="number" id="sh-water" inputmode="decimal" min="0" step="0.1"></div>' +
          sheetFooter({ saveLabel: 'Add water' });
      }
      case 'meal': {
        var lib = S.getMealLibrary();
        var picker = lib.length ?
          '<div class="field"><label for="meal-pick">Log a saved meal</label>' +
          '<select id="meal-pick"><option value="">— pick from library —</option>' +
          lib.map(function (it) { return '<option value="' + it.id + '">' + escapeHtml(it.name) + '</option>'; }).join('') +
          '</select></div>' : '';
        return '<h3>🍽️ Meal</h3>' + picker + mealFieldsHtml({}) + sheetFooter({ saveLabel: 'Save meal' });
      }
      case 'steps':
        return '<h3>👟 Steps</h3>' +
          '<p class="muted small">Adds to the day — a morning and an evening walk can be logged separately.</p>' +
          '<div class="field"><label for="sh-steps">Steps</label>' +
          '<input type="number" id="sh-steps" inputmode="numeric" min="0" step="100"></div>' +
          sheetFooter({ saveLabel: 'Add steps' });
      case 'weight': {
        var gu = currentWeightUnit();
        return '<h3>⚖️ Weight</h3>' +
          '<div class="field"><label for="sh-weight">Weight (' + L.weightUnitLabel(gu) + ')</label>' +
          '<input type="number" id="sh-weight" inputmode="decimal" min="0" step="0.1"></div>' +
          sheetFooter({ saveLabel: 'Save weight' });
      }
      case 'measurement': {
        var cu = currentCircUnit();
        var fields = L.CIRC_SITES.map(function (s) {
          return '<div class="field"><label for="sh-c-' + s.key + '">' + escapeHtml(s.label) +
            ' (' + L.circumferenceUnitLabel(cu) + ')</label>' +
            '<input type="number" id="sh-c-' + s.key + '" inputmode="decimal" min="0" step="0.1"></div>';
        }).join('');
        return '<h3>📏 Body measurements</h3>' +
          '<p class="muted small">Log only what you measure.</p>' +
          '<div class="grid-2">' + fields + '</div>' +
          sheetFooter({ saveLabel: 'Save measurements' });
      }
      case 'morning':
        return '<h3>☀️ Morning</h3>' +
          ynRow('Morning protein within 30 min?', 'protein') +
          ynRow('Morning exercise?', 'exercise') +
          sheetFooter({ saveLabel: 'Save morning' });
      case 'sleep':
        return '<h3>😴 Sleep</h3>' +
          '<div class="grid-2">' +
            '<div class="field"><label for="sh-wake">Wake time</label><input type="time" id="sh-wake"></div>' +
            '<div class="field"><label for="sh-bed">Bed time</label><input type="time" id="sh-bed"></div>' +
            '<div class="field"><label for="sh-sleephours">Sleep (hrs)</label><input type="number" id="sh-sleephours" inputmode="decimal" min="0" max="24" step="0.25"></div>' +
            '<div class="field"><label for="sh-sleepquality">Sleep quality (1–5)</label><input type="number" id="sh-sleepquality" inputmode="numeric" min="1" max="5" step="1"></div>' +
            '<div class="field"><label for="sh-energy">Morning energy (1–5)</label><input type="number" id="sh-energy" inputmode="numeric" min="1" max="5" step="1"></div>' +
          '</div>' +
          sheetFooter({ saveLabel: 'Save sleep' });
      default: return '';
    }
  }

  function openSheet(type) {
    openType = type;
    var sheet = $('#log-sheet');
    sheet.innerHTML = sheetHtml(type);
    sheet.hidden = false;
    $$('.chip').forEach(function (c) { c.setAttribute('aria-pressed', String(c.dataset.chip === type)); });
    var first = sheet.querySelector('input');
    if (first) first.focus();
    sheet.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  function closeSheet() {
    openType = null;
    var sheet = $('#log-sheet');
    sheet.hidden = true;
    sheet.innerHTML = '';
    $$('.chip').forEach(function (c) { c.setAttribute('aria-pressed', 'false'); });
  }

  $('#chip-grid').addEventListener('click', function (e) {
    var chip = e.target.closest('.chip');
    if (!chip) return;
    if (openType === chip.dataset.chip) { closeSheet(); return; } // tap active chip → close
    openSheet(chip.dataset.chip);
  });

  // Delegated handling inside the active sheet: slot picker, presets, Y/N, save/cancel.
  $('#log-sheet').addEventListener('click', function (e) {
    if (maybeHandleSlotClick(e)) return;

    var preset = e.target.closest('.preset');
    if (preset) { addWaterPreset(Number(preset.dataset.add)); return; }

    var yn = e.target.closest('.yn button[data-val]');
    if (yn) {
      var group = yn.parentNode;
      var already = yn.getAttribute('aria-pressed') === 'true';
      $$('button', group).forEach(function (b) { b.setAttribute('aria-pressed', 'false'); });
      yn.setAttribute('aria-pressed', already ? 'false' : 'true'); // tap again to clear
      return;
    }

    var act = e.target.closest('[data-act]');
    if (!act) return;
    if (act.dataset.act === 'cancel') closeSheet();
    else if (act.dataset.act === 'save') saveSheet(openType);
  });

  // Picking a saved meal prefills the meal form (you can still tweak before Save).
  $('#log-sheet').addEventListener('change', function (e) {
    var pick = e.target.closest('#meal-pick');
    if (!pick || !pick.value) return;
    var it = S.getMealLibrary().filter(function (x) { return x.id === pick.value; })[0];
    if (it) prefillMealForm(it);
  });

  function sheetNote() { var el = $('#sh-note'); return el && el.value.trim() ? el.value.trim() : ''; }
  // Attach the shared top time + this sheet's note onto an entry.
  function stamp(entry) {
    var t = topTime(); if (t) entry.time = t;
    var n = sheetNote(); if (n) entry.note = n;
    return entry;
  }
  function ynVal(field) {
    var pressed = $('.yn[data-field="' + field + '"] button[aria-pressed="true"]');
    return pressed ? pressed.dataset.val : '';
  }

  // Validate everything before writing, so a batch save is all-or-nothing.
  function commitEntries(entries) {
    for (var i = 0; i < entries.length; i++) {
      var check = L.validateEntry(entries[i]);
      if (!check.valid) { showSheetErrors(check.errors); return false; }
    }
    entries.forEach(function (e) { S.saveEntry(e); });
    return true;
  }
  function afterSave(keepOpen) {
    flash($('#sheet-saved'));
    renderDaySummary(logDate());
    renderDashboard();
    if (!keepOpen) { closeSheet(); return; }
    $$('#log-sheet input[type="number"]').forEach(function (i) { i.value = ''; });
    var f = $('#log-sheet input'); if (f) f.focus();
  }

  // One-tap water preset → immediate entry; the sheet stays open for another.
  function addWaterPreset(displayAmount) {
    var liters = L.waterFromDisplay(displayAmount, currentWaterUnit());
    if (!isFiniteNum(liters)) return;
    if (commitEntries([stamp({ date: logDate(), type: 'water', value: round2(liters) })])) afterSave(true);
  }

  function saveSheet(type) {
    var date = logDate();
    var entries = [];
    switch (type) {
      case 'water': {
        var wv = $('#sh-water').value;
        if (wv === '') { showSheetErrors({ value: 'Enter an amount, or tap a preset.' }); return; }
        entries.push({ date: date, type: 'water', value: round2(L.waterFromDisplay(Number(wv), currentWaterUnit())) });
        break;
      }
      case 'steps': {
        var sv = $('#sh-steps').value;
        if (sv === '') { showSheetErrors({ value: 'Enter a step count.' }); return; }
        entries.push({ date: date, type: 'steps', value: Number(sv) });
        break;
      }
      case 'meal': {
        var meal = collectMealFields();
        meal.date = date; meal.type = 'meal';
        entries.push(meal); // validateEntry (in commitEntries) enforces slot + a macro
        break;
      }
      case 'weight': {
        var gv = $('#sh-weight').value;
        if (gv === '') { showSheetErrors({ value: 'Enter a weight.' }); return; }
        entries.push({ date: date, type: 'weight', value: round2(L.weightFromDisplay(Number(gv), currentWeightUnit())) });
        break;
      }
      case 'measurement': {
        var cu = currentCircUnit();
        L.CIRC_SITES.forEach(function (s) {
          var raw = $('#sh-c-' + s.key).value;
          if (raw === '') return;
          entries.push({ date: date, type: 'circumference', site: s.key, value: round2(L.inFromDisplay(Number(raw), cu)) });
        });
        if (!entries.length) { showSheetErrors({ value: 'Enter at least one measurement.' }); return; }
        break;
      }
      case 'morning': {
        var p = ynVal('protein'), m = ynVal('exercise');
        if (p) entries.push({ date: date, type: 'protein', value: p });
        if (m) entries.push({ date: date, type: 'exercise', value: m });
        if (!entries.length) { showSheetErrors({ value: 'Tap Yes or No for at least one.' }); return; }
        break;
      }
      case 'sleep': {
        [['sh-wake', 'wake', String], ['sh-bed', 'bed', String],
         ['sh-sleephours', 'sleepHours', Number], ['sh-sleepquality', 'sleepQuality', Number],
         ['sh-energy', 'energy', Number]].forEach(function (f) {
          var raw = $('#' + f[0]).value;
          if (raw === '') return;
          entries.push({ date: date, type: f[1], value: f[2](raw) });
        });
        if (!entries.length) { showSheetErrors({ value: 'Enter at least one sleep detail.' }); return; }
        break;
      }
    }
    entries.forEach(stamp); // shared top time + this sheet's note onto every entry
    // Grab the library intent before commit/afterSave tears the form down.
    var saveLib = type === 'meal' && wantsSaveToLibrary();
    var mealFields = saveLib ? collectMealFields() : null;
    if (commitEntries(entries)) {
      if (saveLib) saveMealToLibrary(mealFields);
      afterSave(!!ADDITIVE_STAYS_OPEN[type]);
    }
  }

  function showSheetErrors(errors) {
    var box = $('#sheet-errors');
    if (!box) return;
    box.innerHTML = '<strong>Please fix:</strong><ul>' +
      Object.keys(errors).map(function (k) { return '<li>' + escapeHtml(errors[k]) + '</li>'; }).join('') + '</ul>';
    box.hidden = false;
  }

  // ---- day summary: running totals + what's logged for the chosen date ----
  function renderDaySummary(date) {
    var entries = S.getDayEntries(date);
    var host = $('#day-summary');
    if (!entries.length) {
      host.innerHTML = '<p class="muted">Nothing logged for ' + escapeHtml(shortDate(date)) +
        ' yet. Pick something above to start.</p>';
      return;
    }
    var day = L.projectDay(entries);
    var profile = S.getProfile();
    var gu = currentWeightUnit(), wu = currentWaterUnit(), cu = currentCircUnit();
    var rows = [];
    function row(label, val) { rows.push('<div class="detail-row"><dt>' + label + '</dt><dd>' + val + '</dd></div>'); }

    if (isFiniteNum(day.waterLiters)) {
      var wtxt = fmtWater(day.waterLiters, wu) + ' ' + L.waterUnitLabel(wu);
      if (isFiniteNum(profile.waterTarget)) wtxt += ' <span class="muted">/ ' + fmtWater(profile.waterTarget, wu) + '</span>';
      row('💧 Water', wtxt);
    }
    if (isFiniteNum(day.steps)) {
      var stxt = day.steps.toLocaleString();
      if (isFiniteNum(profile.stepsTarget)) stxt += ' <span class="muted">/ ' + profile.stepsTarget.toLocaleString() + '</span>';
      row('👟 Steps', stxt);
    }
    if (isFiniteNum(day.weight)) row('⚖️ Weight', fmtWeight(day.weight, gu) + ' ' + L.weightUnitLabel(gu));
    if (day.proteinWithin30) row('Morning protein', day.proteinWithin30 === 'Y' ? 'Yes' : 'No');
    if (day.morningExercise) row('Morning exercise', day.morningExercise === 'Y' ? 'Yes' : 'No');
    if (day.wakeTime) row('Wake', escapeHtml(fmtTime(day.wakeTime)));
    if (day.bedTime) row('Bed', escapeHtml(fmtTime(day.bedTime)));
    if (isFiniteNum(day.sleepHours)) row('Sleep', day.sleepHours + ' h');
    if (isFiniteNum(day.sleepQuality)) row('Sleep quality', day.sleepQuality + '/5');
    if (isFiniteNum(day.morningEnergy)) row('Morning energy', day.morningEnergy + '/5');
    if (day.circumferences) {
      var cbits = L.CIRC_SITES.filter(function (s) { return isFiniteNum(day.circumferences[s.key]); })
        .map(function (s) { return s.label + ' ' + fmtCirc(day.circumferences[s.key], cu) + ' ' + L.circumferenceUnitLabel(cu); });
      if (cbits.length) row('📏 Measurements', escapeHtml(cbits.join(' · ')));
    }
    // Nutrition totals vs target, then each logged meal.
    if (day.nutrition) {
      L.MEAL_MACROS.forEach(function (mm) {
        var v = day.nutrition[mm.key];
        if (!isFiniteNum(v)) return;
        var target = profile[mm.target];
        var txt = fmtMacro(v, mm);
        if (isFiniteNum(target)) txt += ' <span class="muted">/ ' + fmtMacro(target, mm) + '</span>';
        row(mm.label, txt);
      });
    }
    entries.filter(function (e) { return e.type === 'meal'; }).forEach(function (e) {
      var nm = e.name || mealSlotLabel(e.slot);
      var cal = isFiniteNum(e.calories) ? ' — ' + Math.round(e.calories) + ' kcal' : '';
      row('🍽️ ' + escapeHtml(mealSlotLabel(e.slot)), escapeHtml(nm) + cal);
    });

    host.innerHTML =
      '<dl class="detail-list">' + rows.join('') + '</dl>' +
      '<div class="form-actions summary-actions">' +
        '<span class="muted small">' + entries.length + ' entr' + (entries.length === 1 ? 'y' : 'ies') +
        ' · <a href="#" data-goto-history="' + date + '">see all in History</a></span>' +
        '<button type="button" class="btn btn-ghost" id="undo-last">Undo last add</button>' +
      '</div>';
  }

  $('#day-summary').addEventListener('click', function (e) {
    var undo = e.target.closest('#undo-last');
    if (undo) {
      var entries = S.getDayEntries(logDate());
      if (!entries.length) return;
      // "last added" ≈ the largest id (genId embeds the creation timestamp).
      var last = entries.slice().sort(function (a, b) { return a.id < b.id ? -1 : 1; }).pop();
      if (last && confirm('Remove the last entry you added for this day?')) {
        S.deleteEntry(last.id);
        renderDaySummary(logDate());
        renderDashboard();
      }
      return;
    }
    var hist = e.target.closest('[data-goto-history]');
    if (hist) {
      e.preventDefault();
      historyAnchor = hist.dataset.gotoHistory;
      showView('history');
      renderDayDetail(historyAnchor);
    }
  });

  $('#f-date').addEventListener('change', renderLog);

  $('#today-cta').addEventListener('click', function () {
    $('#f-date').value = L.todayISO();
    showView('log');
  });

  // -------------------------------------------------------- settings form
  var settingsForm = $('#settings-form');

  // The unit the water-target field is currently displayed in (so a live unit
  // switch can convert the shown value via canonical litres).
  var shownWaterUnit = 'L';

  function loadSettingsForm() {
    var p = S.getProfile();
    $('#s-wake').value = p.wakeGoal || '';
    $('#s-bed').value = p.bedGoal || '';
    $('#s-steps').value = valOr(p.stepsTarget);
    shownWaterUnit = p.waterUnit === 'oz' ? 'oz' : 'L';
    $('#s-water-unit').value = shownWaterUnit;
    $('#s-water').value = isFiniteNum(p.waterTarget) ? fmtWater(p.waterTarget, shownWaterUnit) : '';
    $('#s-water').step = shownWaterUnit === 'oz' ? '1' : '0.1';
    $('#s-water-label').textContent = 'Water target (' + L.waterUnitLabel(shownWaterUnit) + ')';
    $('#s-weight-unit').value = p.weightUnit === 'kg' ? 'kg' : 'lb';
    $('#s-circ-unit').value = p.circumferenceUnit === 'cm' ? 'cm' : 'in';
    $('#s-time-format').value = p.timeFormat === '12' ? '12' : '24';
    $('#s-phase').value = String(p.roadmapPhase || 1);
    $('#s-calories').value = valOr(p.calorieTarget);
    $('#s-protein').value = valOr(p.proteinTarget);
    $('#s-carbs').value = valOr(p.carbTarget);
    $('#s-fat').value = valOr(p.fatTarget);
    $('#s-fiber').value = valOr(p.fiberTarget);
    $('#s-sodium').value = valOr(p.sodiumTarget);
    renderMealLibrary();
    $('#settings-saved').hidden = true;
  }

  // Saved-meals manager: list each item with its macros + a Delete.
  function renderMealLibrary() {
    var lib = S.getMealLibrary();
    var host = $('#meal-lib-list');
    $('#meal-lib-empty').hidden = !!lib.length;
    host.innerHTML = lib.map(function (it) {
      var macros = L.MEAL_MACROS.filter(function (mm) { return isFiniteNum(it[mm.key]); })
        .map(function (mm) { return fmtMacro(it[mm.key], mm); }).join(' · ');
      var slot = it.slot ? mealSlotLabel(it.slot) + ' · ' : '';
      return '<div class="meal-lib-row">' +
        '<span class="meal-lib-name"><strong>' + escapeHtml(it.name) + '</strong> ' +
        '<span class="muted small">' + escapeHtml(slot) + macros + '</span></span>' +
        '<button type="button" class="btn btn-ghost btn-sm" data-lib-del="' + it.id + '">Delete</button>' +
      '</div>';
    }).join('');
  }

  $('#meal-lib-list').addEventListener('click', function (e) {
    var del = e.target.closest('[data-lib-del]');
    if (!del) return;
    if (!confirm('Remove this meal from your library?')) return;
    S.deleteMealItem(del.dataset.libDel);
    renderMealLibrary();
  });

  // Flip the water unit live: reinterpret the shown target into the new unit
  // (via canonical litres) and relabel. Persists only on Save, like the rest.
  $('#s-water-unit').addEventListener('change', function () {
    var newUnit = this.value === 'oz' ? 'oz' : 'L';
    var cur = $('#s-water').value;
    if (cur !== '' && isFiniteNum(Number(cur))) {
      var liters = L.waterFromDisplay(Number(cur), shownWaterUnit);
      $('#s-water').value = fmtWater(liters, newUnit);
    }
    $('#s-water').step = newUnit === 'oz' ? '1' : '0.1';
    $('#s-water-label').textContent = 'Water target (' + L.waterUnitLabel(newUnit) + ')';
    shownWaterUnit = newUnit;
  });

  settingsForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var wunit = $('#s-water-unit').value === 'oz' ? 'oz' : 'L';
    var p = {
      wakeGoal: $('#s-wake').value || '',
      bedGoal: $('#s-bed').value || '',
      roadmapPhase: Number($('#s-phase').value),
      waterUnit: wunit,
      weightUnit: $('#s-weight-unit').value === 'kg' ? 'kg' : 'lb',
      circumferenceUnit: $('#s-circ-unit').value === 'cm' ? 'cm' : 'in',
      timeFormat: $('#s-time-format').value === '12' ? '12' : '24'
    };
    setNum(p, 'stepsTarget', $('#s-steps').value);
    // Water target is entered in the chosen unit; store canonical litres.
    var wt = $('#s-water').value;
    if (wt !== '') {
      var liters = L.waterFromDisplay(Number(wt), wunit);
      if (isFiniteNum(liters)) p.waterTarget = round2(liters);
    }
    setNum(p, 'calorieTarget', $('#s-calories').value);
    setNum(p, 'proteinTarget', $('#s-protein').value);
    setNum(p, 'carbTarget', $('#s-carbs').value);
    setNum(p, 'fatTarget', $('#s-fat').value);
    setNum(p, 'fiberTarget', $('#s-fiber').value);
    setNum(p, 'sodiumTarget', $('#s-sodium').value);
    S.saveProfile(p);
    flash($('#settings-saved'));
    renderDashboard();
  });

  // ------------------------------------------------------- export/import
  $('#export-btn').addEventListener('click', function () {
    var data = S.exportData();
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'operation-health-' + L.todayISO() + '.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });

  $('#import-btn').addEventListener('click', function () { $('#import-file').click(); });

  $('#import-file').addEventListener('change', function (e) {
    var file = e.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      var data;
      try { data = JSON.parse(reader.result); }
      catch (err) { alert('That file is not valid JSON.'); return; }

      var check = L.validateImport(data);
      if (!check.valid) { alert('Import failed:\n\n' + check.errors.join('\n')); return; }

      // Show what this file will do: how many entries are new vs. already here.
      var incoming = data.entries || [];
      var have = {};
      S.getEntries().forEach(function (en) { have[en.id] = true; });
      var days = {};
      var overlap = 0, fresh = 0;
      incoming.forEach(function (en) {
        if (en.date) days[en.date] = true;
        if (have[en.id]) overlap++; else fresh++;
      });

      var summary =
        'This backup has <strong>' + incoming.length + ' entr' + (incoming.length === 1 ? 'y' : 'ies') +
        '</strong> across <strong>' + Object.keys(days).length + ' day(s)</strong>' +
        (data.profile ? ' plus your settings' : '') + '.<br>' +
        '<strong>' + fresh + '</strong> new to this device · ' +
        '<strong>' + overlap + '</strong> already here.';

      askImportMode(summary).then(function (mode) {
        if (!mode) return; // cancelled — nothing changed
        var res = S.importData(data, mode);
        renderDashboard();
        loadSettingsForm();
        alert('Import complete (' + mode + ').\n' +
              'Added: ' + res.added +
              '  ·  Replaced: ' + res.replaced +
              '  ·  Total now: ' + res.total);
      });
    };
    reader.readAsText(file);
    e.target.value = ''; // allow re-importing the same file
  });

  /** Show the import modal; resolves to 'merge' | 'replace' | null (cancel). */
  function askImportMode(summaryHtml) {
    var dlg = $('#import-dialog');
    $('#import-summary').innerHTML = summaryHtml;
    return new Promise(function (resolve) {
      function finish(choice) {
        dlg.removeEventListener('click', onClick);
        dlg.removeEventListener('cancel', onCancel);
        if (dlg.open) dlg.close();
        resolve(choice);
      }
      function onClick(ev) {
        var b = ev.target.closest('button[data-choice]');
        if (b) finish(b.dataset.choice === 'cancel' ? null : b.dataset.choice);
      }
      function onCancel() { finish(null); } // Esc key
      dlg.addEventListener('click', onClick);
      dlg.addEventListener('cancel', onCancel);
      dlg.showModal();
    });
  }

  // ------------------------------------------------------------- helpers
  function valOr(v) { return (v === undefined || v === null) ? '' : v; }
  function setNum(obj, key, raw) {
    if (raw === '' || raw === null || raw === undefined) return;
    var n = Number(raw);
    if (isFinite(n)) obj[key] = n;
  }
  function setStr(obj, key, raw) { if (raw) obj[key] = raw; }

  function flash(el) {
    el.hidden = false;
    clearTimeout(el._t);
    el._t = setTimeout(function () { el.hidden = true; }, 1800);
  }

  function formatLongDate(iso) {
    var p = iso.split('-').map(Number);
    var d = new Date(p[0], p[1] - 1, p[2]);
    return d.toLocaleDateString(undefined, {
      weekday: 'long', month: 'short', day: 'numeric'
    });
  }

  function shortDate(iso) {
    var p = iso.split('-').map(Number);
    return new Date(p[0], p[1] - 1, p[2])
      .toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // ------------------------------------------------------------------ init
  $('#f-date').value = L.todayISO();
  setupTrends();
  showView('dashboard');

  // Service worker: harmless if it fails (e.g. opened via file://).
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(function () {});
  }
})();
