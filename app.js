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
    var streak = L.computeStreak(logs, today);
    $('#streak-value').textContent = streak;
    $('#streak-sub').textContent = streak === 1 ? 'day in a row' : 'days in a row';

    // Consistency card
    var c = L.computeConsistency(logs, profile, today);
    $('#score-value').innerHTML = c.score + '<span class="unit">/100</span>';
    $('#score-meter').style.width = c.score + '%';
    $('#score-hint').textContent =
      c.hint || (logs.length ? 'Nailing every core habit — keep it up.' :
                               'Log a few days to build your score.');
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

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // ------------------------------------------------------------------ init
  $('#f-date').value = L.todayISO();
  showView('dashboard');

  // Service worker: harmless if it fails (e.g. opened via file://).
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(function () {});
  }
})();
