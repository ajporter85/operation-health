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
    if (name === 'dashboard') renderDashboard();
    if (name === 'log') loadLogForm($('#f-date').value || L.todayISO());
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
  var RANGES = [
    { key: '7d',    label: 'Last 7 days' },
    { key: '30d',   label: 'Last 30 days' },
    { key: 'month', label: 'This month' },
    { key: '3m',    label: 'Last 3 months' },
    { key: '6m',    label: 'Last 6 months' },
    { key: '1y',    label: 'Last year' },
    { key: 'all',   label: 'All time' }
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
    var profile = S.getProfile();
    var today = L.todayISO();
    var host = $('#trends-charts');
    var empty = $('#trends-empty');

    if (!logs.length) { host.innerHTML = ''; empty.hidden = false; return; }
    empty.hidden = true;

    var rangeKey = $('#trend-range').value || DEFAULT_RANGE;
    var days = L.rangeToDays(rangeKey, logs, today);

    host.innerHTML = [
      chartCard({ label: 'Weight', field: 'weight', unit: '', logs: logs, today: today, days: days }),
      chartCard({ label: 'Steps', field: 'steps', unit: '', logs: logs, today: today, days: days,
                  target: profile.stepsTarget }),
      chartCard({ label: 'Sleep', field: 'sleepHours', unit: 'h', logs: logs, today: today, days: days,
                  target: L.goalSleepHours(profile) })
    ].join('');
  }

  function round1(v) { return Math.round(v * 10) / 10; }
  function isFiniteNum(v) { return typeof v === 'number' && isFinite(v); }
  function signed(v) { return v > 0 ? '+' + v : String(v); } // -3.9 keeps its sign; 0 → "0"

  function chartCard(o) {
    var series = L.buildSeries(o.logs, o.field, o.today, o.days);
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

    var summary = title + ' over ' + stats.count + ' logged day' +
      (stats.count === 1 ? '' : 's') + ': ' +
      round1(stats.first) + unit + ' to ' + round1(stats.last) + unit +
      ' (range ' + round1(stats.min) + '–' + round1(stats.max) + unit + ')' +
      (hasTarget ? ', target ' + round1(o.target) + unit : '') + '.';

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
          (plot.gapPath ? '<path class="chart-gap" d="' + plot.gapPath + '" fill="none" ' +
            'vector-effect="non-scaling-stroke"/>' : '') +
          '<path class="chart-line" d="' + plot.path + '" fill="none" ' +
            'vector-effect="non-scaling-stroke"/>' +
          dots +
          '<circle class="chart-last" cx="' + last.x + '" cy="' + last.y + '" r="4" ' +
            'vector-effect="non-scaling-stroke"/>' +
        '</g></svg>';

    var meta =
      '<div class="chart-meta">' +
        '<span>' + escapeHtml(shortDate(series[0].date)) + '</span>' +
        '<span class="muted">min ' + round1(stats.min) + unit +
          ' · max ' + round1(stats.max) + unit +
          (hasTarget ? ' · target ' + round1(o.target) + unit : '') + '</span>' +
        '<span>' + escapeHtml(shortDate(series[series.length - 1].date)) + '</span>' +
      '</div>';

    var stat = function (k, v, title) {
      return '<span class="stat"' + (title ? ' title="' + escapeHtml(title) + '"' : '') +
        '><span class="stat-k">' + k + '</span> ' + v + '</span>';
    };
    var statItems = [
      stat('Avg', round1(stats.mean) + unit),
      stat('Change', signed(round1(stats.delta)) + unit,
        'Latest logged value minus the first in this range')
    ];
    if (hasTarget) {
      var ot = L.countOnTarget(series, o.target);
      statItems.push(stat('On target', ot.on + '/' + ot.of + ' days'));
    }
    var statsRow = '<div class="chart-stats">' + statItems.join('') + '</div>';

    return '<article class="card chart-card">' +
      '<h3>' + title + ' <span class="chart-latest">' + round1(stats.last) + unit +
      '</span></h3>' + svg + meta + statsRow + '</article>';
  }

  // ------------------------------------------------------------- log form
  var logForm = $('#log-form');

  // Y/N toggle buttons
  $$('.yn').forEach(function (group) {
    group.addEventListener('click', function (e) {
      var btn = e.target.closest('button[data-val]');
      if (!btn) return;
      var already = btn.getAttribute('aria-pressed') === 'true';
      $$('button', group).forEach(function (b) { b.setAttribute('aria-pressed', 'false'); });
      // Allow un-selecting by tapping the active one again.
      btn.setAttribute('aria-pressed', already ? 'false' : 'true');
    });
  });

  function getToggle(field) {
    var pressed = $('.yn[data-field="' + field + '"] button[aria-pressed="true"]');
    return pressed ? pressed.dataset.val : '';
  }
  function setToggle(field, val) {
    $$('.yn[data-field="' + field + '"] button').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.dataset.val === val));
    });
  }

  /** Populate the form from a stored record (or a blank day). */
  function loadLogForm(date) {
    var rec = S.getLog(date) || { date: date };
    $('#f-date').value = rec.date || date;
    $('#f-steps').value = valOr(rec.steps);
    $('#f-water').value = valOr(rec.waterLiters);
    $('#f-wake').value = rec.wakeTime || '';
    $('#f-bed').value = rec.bedTime || '';
    $('#f-sleephours').value = valOr(rec.sleepHours);
    $('#f-sleepquality').value = valOr(rec.sleepQuality);
    $('#f-energy').value = valOr(rec.morningEnergy);
    $('#f-weight').value = valOr(rec.weight);
    $('#f-notes').value = rec.notes || '';
    setToggle('proteinWithin30', rec.proteinWithin30 || '');
    setToggle('morningExercise', rec.morningExercise || '');

    $('#log-delete').hidden = !S.getLog(date);
    hideErrors();
    $('#log-saved').hidden = true;
  }

  /** Collect the form into a clean record; blanks are omitted, not stored. */
  function collectLog() {
    var rec = { date: $('#f-date').value };
    setNum(rec, 'steps', $('#f-steps').value);
    setNum(rec, 'waterLiters', $('#f-water').value);
    setNum(rec, 'sleepHours', $('#f-sleephours').value);
    setNum(rec, 'sleepQuality', $('#f-sleepquality').value);
    setNum(rec, 'morningEnergy', $('#f-energy').value);
    setNum(rec, 'weight', $('#f-weight').value);
    setStr(rec, 'wakeTime', $('#f-wake').value);
    setStr(rec, 'bedTime', $('#f-bed').value);
    setStr(rec, 'notes', $('#f-notes').value.trim());
    var p = getToggle('proteinWithin30'); if (p) rec.proteinWithin30 = p;
    var m = getToggle('morningExercise'); if (m) rec.morningExercise = m;
    return rec;
  }

  logForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var rec = collectLog();
    var check = L.validateDailyLog(rec);
    if (!check.valid) { showErrors(check.errors); return; }
    hideErrors();
    S.saveLog(rec);
    $('#log-delete').hidden = false;
    flash($('#log-saved'));
    renderDashboard();
  });

  $('#log-delete').addEventListener('click', function () {
    var date = $('#f-date').value;
    if (!confirm('Delete the log for ' + date + '? This cannot be undone.')) return;
    S.deleteLog(date);
    loadLogForm(date);
    renderDashboard();
  });

  $('#f-date').addEventListener('change', function () {
    loadLogForm($('#f-date').value);
  });

  $('#today-cta').addEventListener('click', function () {
    $('#f-date').value = L.todayISO();
    showView('log');
  });

  function showErrors(errors) {
    var box = $('#log-errors');
    var items = Object.keys(errors).map(function (k) {
      return '<li>' + escapeHtml(errors[k]) + '</li>';
    }).join('');
    box.innerHTML = '<strong>Please fix:</strong><ul>' + items + '</ul>';
    box.hidden = false;
  }
  function hideErrors() { $('#log-errors').hidden = true; }

  // -------------------------------------------------------- settings form
  var settingsForm = $('#settings-form');

  function loadSettingsForm() {
    var p = S.getProfile();
    $('#s-wake').value = p.wakeGoal || '';
    $('#s-bed').value = p.bedGoal || '';
    $('#s-steps').value = valOr(p.stepsTarget);
    $('#s-water').value = valOr(p.waterTarget);
    $('#s-protein').value = valOr(p.proteinTarget);
    $('#s-phase').value = String(p.roadmapPhase || 1);
    $('#settings-saved').hidden = true;
  }

  settingsForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var p = {
      wakeGoal: $('#s-wake').value || '',
      bedGoal: $('#s-bed').value || '',
      roadmapPhase: Number($('#s-phase').value)
    };
    setNum(p, 'stepsTarget', $('#s-steps').value);
    setNum(p, 'waterTarget', $('#s-water').value);
    setNum(p, 'proteinTarget', $('#s-protein').value);
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

      // Show what this file will actually do: how many days are new vs. overlap.
      var incoming = data.dailyLogs || [];
      var have = {};
      S.getLogs().forEach(function (l) { have[l.date] = true; });
      var overlap = 0, fresh = 0;
      incoming.forEach(function (l) { if (have[l.date]) overlap++; else fresh++; });

      var summary =
        'This backup has <strong>' + incoming.length + ' day(s)</strong>' +
        (data.profile ? ' plus your settings' : '') + '.<br>' +
        '<strong>' + fresh + '</strong> new to this device · ' +
        '<strong>' + overlap + '</strong> match a date you already have.';

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
