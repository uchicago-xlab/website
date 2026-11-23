/* Tracker controller: state, sync (demo vs. Google Apps Script), routing, rendering, events. */
(function (App) {
  'use strict';
  var C = App.C, esc = App.esc, icon = App.icon, A = App.actions, V = App.views;
  var LS_STATE = 'aisafety-tracker:state:v1';
  var IS_GAS = typeof google !== 'undefined' && google.script && google.script.run;

  var S = App.S = {
    state: C.emptyState(), meId: null, mode: IS_GAS ? 'live' : 'demo', email: null,
    integrations: { slack: '', drive: false, driveRootUrl: '', sheetUrl: '', feedback: {} }, appUrl: '',
    route: { path: 'home', id: null, query: {} },
    ui: { filters: {}, collapsed: {}, descEditing: null, drafts: {}, composerMode: {}, composerHealth: {}, showResolved: false, docsTeam: '', docsQ: '' },
    sync: 'ok', since: null, pointerDown: false, renderPending: false, rendering: false
  };

  /* ---------- prefs (localStorage with in-memory fallback) ---------- */
  var mem = {};
  App.prefs = {
    get: function (k, d) { try { var v = localStorage.getItem('aist:' + k); return v === null ? d : v; } catch (e) { return k in mem ? mem[k] : d; } },
    set: function (k, v) { try { localStorage.setItem('aist:' + k, v); } catch (e) { mem[k] = v; } }
  };
  try { S.ui.collapsed = JSON.parse(App.prefs.get('collapsed', '{}')) || {}; } catch (e) { S.ui.collapsed = {}; }

  App.me = function () { return C.person(S.state, S.meId); };
  App.myTeam = function () {
    var m = App.me();
    var teams = (m && m.teams || []).filter(function (id) { var t = C.team(S.state, id); return t && !t.deleted; });
    return teams[0] || (V.liveTeams()[0] || {}).id || null;
  };

  /* ---------- server calls (Apps Script) ---------- */
  App.server = function (fn) {
    var args = Array.prototype.slice.call(arguments, 1);
    return new Promise(function (resolve, reject) {
      if (!IS_GAS) { reject(new Error('Not connected to Google Apps Script.')); return; }
      var r = google.script.run.withSuccessHandler(function (res) {
        if (res && res.error) reject(new Error(res.error)); else resolve(res);
      }).withFailureHandler(function (err) { reject(err instanceof Error ? err : new Error(String(err && err.message || err))); });
      r[fn].apply(r, args);
    });
  };
  App.mergeEntities = function (entities) {
    if (!entities) return;
    Object.keys(entities).forEach(function (coll) {
      if (!S.state[coll]) return;
      (entities[coll] || []).forEach(function (item) {
        var list = S.state[coll];
        for (var i = 0; i < list.length; i++) if (list[i].id === item.id) { list[i] = item; return; }
        list.push(item);
      });
    });
  };

  /* ---------- adapters ---------- */
  var Local = {
    load: function () {
      var raw = null;
      try { raw = localStorage.getItem(LS_STATE); } catch (e) { /* private mode */ }
      var state = null;
      if (raw) { try { state = JSON.parse(raw); } catch (e) { state = null; } }
      if (!state || !state.teams) state = TrackerSeed.demo();
      C.COLLECTIONS.forEach(function (c) { state[c] = state[c] || []; });
      S.state = state;
      var me = App.prefs.get('demoMe', '');
      if (!C.person(state, me) || C.person(state, me).deleted) {
        var ex = C.activePeople(state).filter(function (p) { return p.role === 'exec'; })[0] || C.activePeople(state)[0];
        me = ex ? ex.id : null;
      }
      S.meId = me;
    },
    save: debounce(function () {
      try { localStorage.setItem(LS_STATE, JSON.stringify(S.state)); }
      catch (e) { App.toast('Couldn’t save to this browser’s storage (it may be full or in private mode).', { type: 'err' }); }
    }, 250),
    after: function (op, res) {
      Local.save();
      if (op.type === 'join') return;
      var msgs = [];
      (res.events || []).forEach(function (ev) {
        var d = C.describeEvent(S.state, ev);
        if (!d) return;
        var plain = d.text.replace(/\*/g, '');
        d.dm.forEach(function (pid) { msgs.push('<b>DM to ' + esc(App.pname(pid)) + ':</b> ' + esc(plain)); });
        if (d.channel) { var t = C.team(S.state, d.channel); msgs.push('<b>#' + esc(t ? t.name.toLowerCase() : 'team') + ':</b> ' + esc(plain)); }
      });
      if (msgs.length) App.toast('<span style="opacity:.75">Slack would send →</span><br>' + msgs.slice(0, 3).join('<br>') + (msgs.length > 3 ? '<br>+' + (msgs.length - 3) + ' more' : ''), { type: 'slack', html: true, timeout: 6500 });
    }
  };

  var queue = [], inFlight = false, retryMs = 2000, pollTimer = null;
  var Live = {
    after: function (op) { queue.push(op); setTimeout(Live.flush, 120); },
    flush: function () {
      if (inFlight || !queue.length) return;
      var batch = queue.splice(0, 25);
      inFlight = true; setSync('busy');
      App.server('applyOps', batch).then(function (res) {
        inFlight = false; retryMs = 2000;
        var failed = (res.results || []).filter(function (r) { return !r.ok; });
        App.mergeEntities(res.entities);
        (res.removed || []).forEach(function (r) {
          if (S.state[r.coll]) S.state[r.coll] = S.state[r.coll].filter(function (x) { return x.id !== r.id; });
        });
        // re-apply anything the user did while this batch was in flight
        queue.forEach(function (op) { C.applyOp(S.state, op, S.meId); });
        if (failed.length) {
          App.toast('Not saved: ' + failed[0].error, { type: 'err' });
          Live.poll(true);
        }
        setSync(queue.length ? 'busy' : 'ok');
        App.render();
        if (queue.length) Live.flush();
      }).catch(function (err) {
        inFlight = false;
        queue = batch.concat(queue);
        setSync('err');
        if (retryMs === 2000) App.toast('Having trouble reaching Google. Your changes are queued and will retry. (' + (err.message || err) + ')', { type: 'err' });
        setTimeout(Live.flush, retryMs);
        retryMs = Math.min(retryMs * 2, 60000);
      });
    },
    poll: function (force) {
      if (!force && (inFlight || queue.length || document.hidden)) return;
      App.server('getChanges', S.since).then(function (res) {
        if (!force && (inFlight || queue.length)) return;
        if (res.entities && Object.keys(res.entities).some(function (k) { return res.entities[k].length; })) {
          App.mergeEntities(res.entities);
          if (res.integrations) S.integrations = res.integrations;
          App.render();
        }
        S.since = res.serverTime || S.since;
        if (S.sync === 'err') setSync('ok');
      }).catch(function () { setSync('err'); });
    },
    startPolling: function () {
      clearInterval(pollTimer);
      pollTimer = setInterval(Live.poll, 20000);
      window.addEventListener('focus', function () { Live.poll(); });
      document.addEventListener('visibilitychange', function () { if (!document.hidden) Live.poll(); });
    }
  };
  function setSync(s) {
    if (S.sync === s) return;
    S.sync = s;
    var pill = document.querySelector('.mode-pill.live');
    if (pill) pill.innerHTML = '<span class="sync-dot ' + (s === 'busy' ? 'busy' : s === 'err' ? 'err' : '') + '"></span> ' + (s === 'err' ? 'Sync problem: retrying' : s === 'busy' ? 'Saving…' : 'Synced with Google Sheets');
  }
  window.addEventListener('beforeunload', function (e) {
    if (S.mode === 'live' && (queue.length || inFlight)) { e.preventDefault(); e.returnValue = 'Changes are still saving.'; return e.returnValue; }
  });

  /* ---------- dispatch ---------- */
  function prepareOp(op) {
    // client-side ids so follow-up ops (and the server) refer to the same things
    if (op.type === 'createTask' && op.task && !op.task.id) op.task.id = C.uid('t');
    if (op.type === 'addStep' && op.step && !op.step.id) op.step.id = C.uid('s');
    if (op.type === 'addLink' && op.link && !op.link.id) op.link.id = C.uid('l');
    if ((op.type === 'addComment' || op.type === 'checkin' || op.type === 'requestHelp') && !op.id) op.id = C.uid(op.type === 'requestHelp' ? 'h' : 'f');
    if (op.type === 'upsert' && op.item && !op.item.id) op.item.id = C.uid(op.coll.charAt(0));
    return op;
  }
  App.dispatch = function (op, opts) {
    opts = opts || {};
    prepareOp(op);
    var res = C.applyOp(S.state, op, S.meId);
    if (!res.ok) {
      if (!opts.silent) App.toast(res.error, { type: 'err' });
      return false;
    }
    (S.mode === 'live' ? Live : Local).after(op, res);
    if (opts.quiet) scheduleRender(); else App.render();
    return true;
  };
  var renderTimer = null;
  function scheduleRender() { clearTimeout(renderTimer); renderTimer = setTimeout(App.render, 30); }

  /* ---------- routing ---------- */
  function parseHash() {
    var h = (location.hash || '').replace(/^#\/?/, '');
    var qi = h.indexOf('?');
    var path = qi === -1 ? h : h.slice(0, qi), qs = qi === -1 ? '' : h.slice(qi + 1);
    var parts = path.split('/').filter(Boolean);
    var query = {};
    qs.split('&').forEach(function (kv) {
      if (!kv) return;
      var i = kv.indexOf('=');
      query[decodeURIComponent(i === -1 ? kv : kv.slice(0, i))] = decodeURIComponent(i === -1 ? '' : kv.slice(i + 1));
    });
    return { path: parts[0] || 'home', id: parts[1] ? decodeURIComponent(parts[1]) : null, query: query };
  }
  function routeHash(r) {
    var q = Object.keys(r.query).filter(function (k) { return r.query[k]; }).map(function (k) { return encodeURIComponent(k) + '=' + encodeURIComponent(r.query[k]); }).join('&');
    return '#/' + r.path + (r.id ? '/' + encodeURIComponent(r.id) : '') + (q ? '?' + q : '');
  }
  App.go = function (hash) {
    document.querySelector('.app') && document.querySelector('.app').classList.remove('nav-open');
    if (location.hash === hash) { S.route = parseHash(); App.render(); }
    else location.hash = hash;
  };
  App.openTask = function (id) {
    var r = { path: S.route.path, id: S.route.id, query: Object.assign({}, S.route.query, { task: id }) };
    App.go(routeHash(r));
  };
  App.closeTask = function () {
    var r = { path: S.route.path, id: S.route.id, query: Object.assign({}, S.route.query) };
    delete r.query.task;
    S.ui.descEditing = null;
    App.go(routeHash(r));
  };
  App.taskUrl = function (id) {
    if (S.mode === 'live' && S.appUrl) return S.appUrl + '?task=' + encodeURIComponent(id);
    return location.href.split('#')[0] + '#/home?task=' + encodeURIComponent(id);
  };
  window.addEventListener('hashchange', function () {
    var prevTask = S.route.query.task;
    S.route = parseHash();
    if (prevTask !== S.route.query.task) { S.ui.descEditing = null; S.ui.showResolved = false; }
    App.closePop();
    App.render();
    if (S.mode === 'live' && google.script.history) {
      try { google.script.history.replace(null, S.route.query.task ? { task: S.route.query.task } : {}, ''); } catch (e) { /* optional */ }
    }
  });

  /* ---------- rendering ---------- */
  var els = {};
  function shell() {
    var root = document.getElementById('app');
    root.innerHTML = '<div class="app"><nav class="sidebar" id="sidebar" aria-label="Main"></nav><div class="nav-scrim" data-act="toggleNav"></div>' +
      '<main class="main"><header class="topbar" id="topbar"></header><div class="tabs" id="tabs"></div><div class="content" id="content" data-scroll-key="content"></div></main></div>' +
      App.feedbackButton() + '<div class="scrim" id="scrim" data-act="closeTask"></div><aside class="panel" id="panel" aria-label="Task details"></aside><div class="toasts" id="toasts" aria-live="polite"></div>';
    els = { sidebar: document.getElementById('sidebar'), topbar: document.getElementById('topbar'), tabs: document.getElementById('tabs'), content: document.getElementById('content'), panel: document.getElementById('panel'), scrim: document.getElementById('scrim') };
  }
  function pageFor(r) {
    switch (r.path) {
      case 'home': return V.home();
      case 'inbox': return V.inbox();
      case 'dashboard': return V.dashboard();
      case 'team': case 'project': case 'all': case 'person': {
        var p = V.taskPage();
        if (r.path === 'person') { var pp = C.person(S.state, r.id); if (pp) p.actions = (p.actions || '') + V.personHeaderActions(pp); }
        return p;
      }
      case 'people': return V.people();
      case 'docs': return V.docs();
      case 'settings': return V.settings();
      default: S.route.path = 'home'; return V.home();
    }
  }
  function captureFocus() {
    var a = document.activeElement;
    if (!a || !a.dataset || !a.dataset.fk) return null;
    var f = { fk: a.dataset.fk, value: a.value };
    try { f.s = a.selectionStart; f.e = a.selectionEnd; } catch (e) { /* not a text field */ }
    return f;
  }
  function restoreFocus(f) {
    if (!f) return;
    var el = document.querySelector('[data-fk="' + (window.CSS && CSS.escape ? CSS.escape(f.fk) : f.fk) + '"]');
    if (!el) return;
    if (typeof f.value === 'string' && el.type !== 'date' && el.value !== f.value) el.value = f.value;
    el.focus({ preventScroll: true });
    try { if (f.s != null) el.setSelectionRange(f.s, f.e); } catch (e) { /* ignore */ }
  }
  function captureScroll() {
    var out = {};
    document.querySelectorAll('[data-scroll-key]').forEach(function (el) { out[el.dataset.scrollKey] = [el.scrollTop, el.scrollLeft]; });
    return out;
  }
  function restoreScroll(s) {
    document.querySelectorAll('[data-scroll-key]').forEach(function (el) {
      var v = s[el.dataset.scrollKey];
      if (v) { el.scrollTop = v[0]; el.scrollLeft = v[1]; }
    });
  }
  App.render = function () {
    if (!S.meId || !els.content) return;
    if (S.pointerDown) { S.renderPending = true; return; }
    S.renderPending = false;
    S.rendering = true;
    try {
      var focus = captureFocus(), scroll = captureScroll();
      var r = S.route;
      els.sidebar.innerHTML = V.sidebar();
      var page = pageFor(r);
      var n = C.activeTasks(S.state).length;
      els.topbar.innerHTML = '<button type="button" class="menu-btn" data-act="toggleNav" aria-label="Menu">' + icon('menu', 20) + '</button>' +
        '<h1>' + page.title + '</h1>' + (page.sub ? '<span class="sub" title="' + esc(page.sub) + '" style="max-width:46ch;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(page.sub) + '</span>' : '') +
        '<span class="spacer"></span>' + (page.actions || '') +
        '<button type="button" class="search-btn" data-act="openPalette" aria-label="Search">' + icon('search', 15) + '<span class="lbl">Search ' + n + ' tasks…</span><kbd>/</kbd></button>' +
        '<button type="button" class="btn primary" data-act="newTask">' + icon('plus', 15) + '<span class="new-label">New task</span></button>';
      els.tabs.style.display = page.tabs ? '' : 'none';
      els.tabs.innerHTML = page.tabs || '';
      els.content.className = 'content' + (page.flush ? ' flush' : '');
      els.content.innerHTML = page.content;
      var t = r.query.task ? C.task(S.state, r.query.task) : null;
      if (t && !t.deleted) {
        els.panel.innerHTML = App.renderPanel();
        els.panel.classList.add('show');
        els.scrim.classList.add('show');
        var title = els.panel.querySelector('.panel-title');
        if (title) { title.style.height = 'auto'; title.style.height = title.scrollHeight + 'px'; }
      } else {
        els.panel.classList.remove('show');
        els.scrim.classList.remove('show');
        if (r.query.task && !t) setTimeout(function () { App.toast('That task doesn’t exist (it may have been deleted).', { type: 'err' }); }, 0);
      }
      restoreScroll(scroll);
      restoreFocus(focus);
      var unread = V.inboxItems().filter(function (i) { return i.unread; }).length;
      document.title = (unread ? '(' + unread + ') ' : '') + (t ? t.title + ' · ' : '') + 'AI Safety Tracker';
      if (r.path === 'inbox') markInboxSoon();
    } finally {
      S.rendering = false;
    }
  };
  var inboxTimer = null;
  function markInboxSoon() {
    clearTimeout(inboxTimer);
    inboxTimer = setTimeout(function () {
      if (S.route.path !== 'inbox') return;
      var items = V.inboxItems();
      if (items.length && items.some(function (i) { return i.unread; })) {
        App.prefs.set('inboxSeen:' + S.meId, items[0].at);
        els.sidebar.innerHTML = V.sidebar();
      }
    }, 2500);
  }

  /* ---------- page actions ---------- */
  A.go = function (el) { App.go(el.dataset.href); };
  A.openTask = function (el, e) {
    if (e && e.target.closest('a[href]') && e.target.closest('a[href]') !== el) return;
    if (e) e.preventDefault();
    App.openTask(el.dataset.id);
    if (el.dataset.focus === 'checkin') setTimeout(A.focusCheckin, 260);
  };
  A.toggleNav = function () { document.querySelector('.app').classList.toggle('nav-open'); };
  A.openPalette = function () { App.openPalette(); };
  A.newTask = function (el) {
    var d = {};
    try { d = JSON.parse(el && el.dataset.defaults || '{}'); } catch (e) { d = {}; }
    if (el && el.dataset.status) d.status = el.dataset.status;
    if (!el || !el.dataset.defaults) d = Object.assign(currentDefaults(), d);
    App.openNewTask(d);
  };
  function currentDefaults() {
    var r = S.route;
    if (r.path === 'team') return { team: r.id };
    if (r.path === 'project') { var p = C.byId(S.state.projects, r.id); return p ? { team: p.team, project: p.id } : {}; }
    if (r.path === 'person') { var pp = C.person(S.state, r.id); return pp ? { owner: pp.id, team: pp.teams[0] } : {}; }
    return {};
  }
  A.toggleGroup = function (el) {
    var k = el.dataset.key;
    var cur = el.classList.contains('collapsed');
    S.ui.collapsed[k] = !cur;
    App.prefs.set('collapsed', JSON.stringify(S.ui.collapsed));
    App.render();
  };
  A.setView = function (el) { App.prefs.set('view:' + el.dataset.key, el.dataset.view); App.render(); };
  A.setFilter = function (el) {
    var f = S.ui.filters[el.dataset.key];
    var k = el.dataset.f, v = el.dataset.v;
    if (k === 'attention') f.attention = !f.attention;
    else if (k === 'owner') f.owner = f.owner === v ? null : v;
    else f[k] = v;
    App.render();
  };
  A.setGroup = function (el) {
    S.ui.filters[el.dataset.key].group = el.value;
    App.prefs.set('group:' + el.dataset.key, el.value);
    App.render();
  };
  A.filterQ = debounce(function (el) { S.ui.filters[el.dataset.key].q = el.value; App.render(); }, 150);
  A.filterHome = function (el) {
    var key = 'home:due:' + el.dataset.arg;
    if (S.ui.collapsed[key]) { S.ui.collapsed[key] = false; App.render(); }
    var g = document.querySelector('[data-key="' + key + '"]');
    if (g) g.scrollIntoView({ behavior: 'smooth', block: 'start' });
    else App.toast(el.dataset.arg === 'overdue' ? 'Nothing overdue. 🎉' : 'Nothing due in the next 7 days.');
  };
  A.scrollTo = function (el) { var t = document.getElementById(el.dataset.arg); if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
  A.markInboxRead = function () {
    var items = V.inboxItems();
    if (items.length) App.prefs.set('inboxSeen:' + S.meId, items[0].at);
    App.render();
  };
  A.meMenu = function (el) {
    if (S.mode === 'demo') {
      App.pick(el, { items: App.peopleItems(App.myTeam()), selected: [S.meId], placeholder: 'View the tracker as…' }, function (id) {
        S.meId = id;
        App.prefs.set('demoMe', id);
        App.render();
        App.toast('Now viewing as ' + App.pname(id) + ' (' + App.roleLabel(App.me().role) + ').');
      });
    } else {
      App.menu(el, [
        { label: 'Edit my profile', icon: 'user', fn: function () { App.openPersonModal(S.meId); } },
        { label: 'Settings', icon: 'settings', fn: function () { App.go('#/settings'); } },
        { label: 'Keyboard shortcuts', icon: 'zap', fn: App.openShortcuts }
      ]);
    }
  };
  A.quickAdd = function (el, e) {
    e.preventDefault();
    var text = el.value.trim();
    if (!text) return;
    var d = {};
    try { d = JSON.parse(el.dataset.defaults || '{}'); } catch (err) { d = {}; }
    var q = App.parseQuick(text);
    var f = {
      id: C.uid('t'), title: q.title || text, team: q.team || d.team || App.myTeam(), project: d.project || null,
      owner: q.owner !== undefined ? q.owner : (d.owner || null), dueDate: q.dueDate || null, priority: q.priority || 'med', status: 'todo'
    };
    if (f.project && (C.byId(S.state.projects, f.project) || {}).team !== f.team) f.project = null;
    el.value = '';
    var prev = el.parentNode.querySelector('.qa-preview'); if (prev) prev.innerHTML = '';
    if (App.dispatch({ type: 'createTask', task: f })) {
      App.toast('Added “' + f.title + '”' + (f.owner ? ' for ' + App.firstName(f.owner) : '') + (f.dueDate ? ', due ' + App.fmtDate(f.dueDate) : '') + '.', { action: { label: 'Open', fn: function () { App.openTask(f.id); } } });
    }
  };
  A.qaPreview = function (el) {
    var prev = el.parentNode.querySelector('.qa-preview');
    if (!prev) return;
    var q = App.parseQuick(el.value);
    var out = '';
    if (q.owner) out += '<span class="chip">' + App.avatar(q.owner, 'sm') + esc(App.pname(q.owner)) + '</span>';
    if (q.team) out += App.teamChip(q.team);
    if (q.priority) out += App.prioPill(q.priority);
    if (q.dueDate) out += '<span class="chip">' + icon('calendar', 11) + esc(App.fmtDate(q.dueDate)) + '</span>';
    prev.innerHTML = out;
  };
  A.tlZoom = function (el) { App.prefs.set('tlZoom', el.dataset.v); App.render(); A.tlToday(); };
  A.tlToday = function () {
    var sc = document.getElementById('timeline-scroll');
    if (sc && S.tl) sc.scrollLeft = Math.max(0, C.daysBetween(S.tl.start, C.todayKey()) * S.tl.dw - 200);
  };
  A.editTeam = function (el) { App.openTeamModal(el.dataset.id); };
  A.editProject = function (el) { App.openProjectModal(el.dataset.id || null, el.dataset.team); };
  A.editPerson = function (el) { App.openPersonModal(el.dataset.id || null); };
  A.importRoster = function () { App.openImportRoster(); };
  A.removeSamples = function () {
    App.confirm('Remove all sample people from the roster? Tasks assigned to them stay but become unassigned-looking until you reassign them.', { ok: 'Remove samples', danger: true }).then(function (y) { if (y) { App.removeSamples(); App.render(); } });
  };
  A.editResource = function (el) { App.openResourceModal(el.dataset.id || null, el.dataset.team); };
  A.editTemplate = function (el) { App.openTemplateModal(el.dataset.id || null); };
  A.useTemplate = function (el) { App.openNewTask(Object.assign(currentDefaults(), { template: el.dataset.id })); };
  A.docsTab = function (el) { App.prefs.set('docsTab', el.dataset.v); App.render(); };
  A.docsTeam = function (el) { S.ui.docsTeam = el.dataset.v; App.render(); };
  A.docsQ = debounce(function (el) { S.ui.docsQ = el.value; App.render(); }, 150);
  A.showWelcome = function () { App.openWelcome(); };
  A.shortcuts = function () { App.openShortcuts(); };
  A.slackTest = function () {
    App.server('slackTest').then(function (r) { App.toast(r && r.message || 'Test message sent.'); }).catch(function (e) { App.toast(e.message || String(e), { type: 'err' }); });
  };
  A.exportData = function () {
    App.download('ai-safety-tracker-' + C.todayKey() + '.json', JSON.stringify(S.state, null, 2));
  };
  A.importData = function () {
    var input = document.createElement('input');
    input.type = 'file'; input.accept = 'application/json,.json';
    input.onchange = function () {
      var f = input.files[0]; if (!f) return;
      var rd = new FileReader();
      rd.onload = function () {
        try {
          var data = JSON.parse(rd.result);
          if (!data.teams || !data.tasks) throw new Error('Not a tracker export.');
          C.COLLECTIONS.forEach(function (c) { data[c] = data[c] || []; });
          S.state = data; Local.save();
          if (!C.person(S.state, S.meId)) S.meId = (C.activePeople(S.state)[0] || {}).id;
          App.render(); App.toast('Imported.');
        } catch (e) { App.toast('Import failed: ' + e.message, { type: 'err' }); }
      };
      rd.readAsText(f);
    };
    input.click();
  };
  A.resetDemo = function () {
    App.confirm('Replace everything in this browser with fresh sample data?', { ok: 'Reset', danger: true }).then(function (y) {
      if (!y) return;
      S.state = TrackerSeed.demo(); Local.save();
      S.meId = (C.activePeople(S.state).filter(function (p) { return p.role === 'exec'; })[0] || {}).id;
      App.prefs.set('demoMe', S.meId);
      App.go('#/home'); App.render();
    });
  };
  A.blankStart = function () {
    App.confirm('Clear all sample tasks and projects (keeps teams, checklists, shared docs and the sample roster so you can import yours)?', { ok: 'Clear tasks', danger: true }).then(function (y) {
      if (!y) return;
      var keep = TrackerSeed.roster();
      keep.people = S.state.people; keep.teams = S.state.teams;
      S.state = keep; Local.save();
      App.go('#/home'); App.render();
    });
  };

  /* ---------- event delegation ---------- */
  function findFresh(el) {
    if (document.body.contains(el)) return el;
    var sel = '[data-act="' + el.dataset.act + '"]' + (el.dataset.id ? '[data-id="' + el.dataset.id + '"]' : '') + (el.dataset.step ? '[data-step="' + el.dataset.step + '"]' : '');
    return document.querySelector(sel) || el;
  }
  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-act]');
    // pointer is up: flush any render that was held back while the mouse was down
    S.pointerDown = false;
    if (S.renderPending) App.render();
    if (!el || el.disabled) return;
    var link = e.target.closest('a[href]');
    if (link && link !== el && el.contains(link) && !link.dataset.act) return; // plain links inside clickable rows
    var fn = A[el.dataset.act];
    if (!fn) return;
    if (el.tagName === 'A' && el.getAttribute('href') === '#') e.preventDefault();
    fn(findFresh(el), e);
  });
  document.addEventListener('input', function (e) {
    var el = e.target.closest('[data-input]');
    if (el && A[el.dataset.input]) A[el.dataset.input](el, e);
  });
  document.addEventListener('change', function (e) {
    var el = e.target.closest('[data-change]');
    if (el && A[el.dataset.change]) A[el.dataset.change](el, e);
  });
  document.addEventListener('focusout', function (e) {
    if (S.rendering) return;
    var el = e.target.closest && e.target.closest('[data-blur]');
    if (el && A[el.dataset.blur]) A[el.dataset.blur](el, e);
  });
  document.addEventListener('keydown', function (e) {
    var el = e.target;
    var typing = el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
    if (e.key === 'Enter' && typing && !e.shiftKey && !e.isComposing) {
      if ((e.metaKey || e.ctrlKey) && el.dataset.ctrlEnter && A[el.dataset.ctrlEnter]) { e.preventDefault(); A[el.dataset.ctrlEnter](el, e); return; }
      if (el.dataset.enter && A[el.dataset.enter] && !(e.metaKey || e.ctrlKey)) { A[el.dataset.enter](el, e); return; }
    }
    if ((e.key === 'Enter' || e.key === ' ') && !typing && el && el.getAttribute && el.getAttribute('role') === 'button' && el.dataset.act) {
      e.preventDefault(); el.click(); return;
    }
    if (e.key === 'Escape') {
      if (App.hasPop()) { App.closePop(); return; }
      if (App.closeTopModal()) return;
      if (typing && el.dataset.fk && el.dataset.fk.indexOf('desc-') === 0) {
        delete S.ui.drafts[el.dataset.fk]; S.ui.descEditing = null; App.render(); return;
      }
      if (typing) { el.blur(); return; }
      if (document.querySelector('.app.nav-open')) { A.toggleNav(); return; }
      if (S.route.query.task) { App.closeTask(); return; }
      return;
    }
    if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) { e.preventDefault(); if (!App.hasModal()) App.openPalette(); return; }
    if (typing || e.metaKey || e.ctrlKey || e.altKey || App.hasModal()) return;
    if (gPending) {
      gPending = false;
      var map = { h: '#/home', i: '#/inbox', d: '#/dashboard', a: '#/all', p: '#/people', s: '#/settings', c: '#/docs' };
      if (map[e.key]) { e.preventDefault(); App.go(map[e.key]); }
      return;
    }
    if (e.key === 'n' || e.key === 'N') { e.preventDefault(); A.newTask(); }
    else if (e.key === '/') { e.preventDefault(); App.openPalette(); }
    else if (e.key === '?') { e.preventDefault(); App.openShortcuts(); }
    else if (e.key === 'g') { gPending = true; setTimeout(function () { gPending = false; }, 1200); }
  });
  var gPending = false;

  /* ---------- pointer tracking (holds renders while the mouse is down so clicks land) ---------- */
  function pointerUp() {
    setTimeout(function () {
      S.pointerDown = false;
      if (S.renderPending) App.render();
    }, 0);
  }
  window.addEventListener('pointerdown', function (e) {
    if (e.target.closest && e.target.closest('.pop, .modal-wrap')) return;
    S.pointerDown = true;
    tlPointerDown(e);
  }, true);
  window.addEventListener('pointerup', function (e) { tlPointerUp(e); pointerUp(); }, true);
  window.addEventListener('pointercancel', function () { tlDrag = null; pointerUp(); }, true);
  window.addEventListener('pointermove', tlPointerMove, true);

  /* ---------- timeline drag ---------- */
  var tlDrag = null;
  function tlPointerDown(e) {
    var bar = e.target.closest && e.target.closest('[data-tl-task]');
    if (!bar || e.button !== 0) return;
    var t = C.task(S.state, bar.dataset.tlTask);
    var handle = e.target.closest('[data-tl-handle]');
    tlDrag = { id: t.id, mode: handle ? handle.dataset.tlHandle : 'move', x0: e.clientX, left0: bar.offsetLeft, width0: bar.offsetWidth, el: bar, moved: false, mile: !!bar.dataset.tlMile, can: C.canEditTask(S.state, S.meId, t) };
    try { bar.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    e.preventDefault();
  }
  function tlPointerMove(e) {
    if (!tlDrag) return;
    var dx = e.clientX - tlDrag.x0;
    if (Math.abs(dx) > 3) tlDrag.moved = true;
    if (!tlDrag.can || !tlDrag.moved) return;
    var dw = S.tl.dw;
    if (tlDrag.mode === 'move') tlDrag.el.style.left = (tlDrag.left0 + dx) + 'px';
    else if (tlDrag.mode === 'r') tlDrag.el.style.width = Math.max(dw, tlDrag.width0 + dx) + 'px';
    else { var w = Math.max(dw, tlDrag.width0 - dx); tlDrag.el.style.left = (tlDrag.left0 + tlDrag.width0 - w) + 'px'; tlDrag.el.style.width = w + 'px'; }
  }
  function tlPointerUp(e) {
    if (!tlDrag) return;
    var d = tlDrag; tlDrag = null;
    if (!d.moved) { S.pointerDown = false; App.openTask(d.id); return; }
    if (!d.can) { App.toast('Only the task’s team, owner or collaborators can reschedule it.', { type: 'err' }); S.pointerDown = false; App.render(); return; }
    var days = Math.round((e.clientX - d.x0) / S.tl.dw);
    var t = C.task(S.state, d.id);
    var patch = {};
    if (days) {
      if (d.mile) patch.dueDate = C.addDays(t.dueDate || t.startDate, days);
      else if (d.mode === 'move') { patch.startDate = C.addDays(t.startDate, days); patch.dueDate = C.addDays(t.dueDate, days); }
      else if (d.mode === 'r') { var nd = C.addDays(t.dueDate, days); patch.dueDate = nd < t.startDate ? t.startDate : nd; }
      else { var ns = C.addDays(t.startDate, days); patch.startDate = ns > t.dueDate ? t.dueDate : ns; }
    }
    S.pointerDown = false;
    if (Object.keys(patch).length) {
      App.dispatch({ type: 'updateTask', id: d.id, patch: patch });
      App.toast('Rescheduled “' + t.title + '” → due ' + App.fmtDate(t.dueDate, { absolute: true }) + '.');
    } else App.render();
  }

  /* ---------- drag and drop: board cards and steps ---------- */
  var drag = null;
  document.addEventListener('dragstart', function (e) {
    var card = e.target.closest && e.target.closest('[data-drag-task]');
    if (card) {
      drag = { kind: 'task', id: card.dataset.dragTask };
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', drag.id);
      setTimeout(function () { card.classList.add('dragging'); }, 0);
      return;
    }
    var grip = e.target.closest && e.target.closest('.grip');
    var step = grip && grip.closest('[data-step-id]');
    if (step) {
      drag = { kind: 'step', id: step.dataset.stepId, taskId: step.closest('[data-steps]').dataset.steps };
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', drag.id);
      try { e.dataTransfer.setDragImage(step, 20, 16); } catch (err) { /* ignore */ }
    }
  });
  document.addEventListener('dragover', function (e) {
    if (!drag) return;
    if (drag.kind === 'task') {
      var col = e.target.closest('[data-drop-status]');
      if (!col) return;
      e.preventDefault();
      document.querySelectorAll('.col.drag-over').forEach(function (c) { if (c !== col) c.classList.remove('drag-over'); });
      col.classList.add('drag-over');
    } else {
      var row = e.target.closest('[data-step-id]');
      if (!row) return;
      e.preventDefault();
      document.querySelectorAll('.step.drag-over').forEach(function (c) { if (c !== row) c.classList.remove('drag-over'); });
      row.classList.add('drag-over');
    }
  });
  document.addEventListener('drop', function (e) {
    if (!drag) return;
    e.preventDefault();
    var d = drag; drag = null;
    S.pointerDown = false;
    if (d.kind === 'task') {
      var col = e.target.closest('[data-drop-status]');
      var t = C.task(S.state, d.id);
      if (col && t && t.status !== col.dataset.dropStatus) {
        var status = col.dataset.dropStatus;
        App.dispatch({ type: 'updateTask', id: t.id, patch: { status: status } });
        if (status === 'blocked' && !C.openHelp(t).length) App.toast('Moved to Blocked. Who can unblock it?', { action: { label: 'Ask for help', fn: function () { App.openHelpModal(t.id); } } });
        if (status === 'done') App.toast('Completed “' + t.title + '”', { icon: '🎉' });
      } else App.render();
    } else {
      var row = e.target.closest('[data-step-id]');
      var task = C.task(S.state, d.taskId);
      if (row && task && row.dataset.stepId !== d.id) {
        var ids = (task.steps || []).map(function (s) { return s.id; }).filter(function (id) { return id !== d.id; });
        ids.splice(ids.indexOf(row.dataset.stepId), 0, d.id);
        App.dispatch({ type: 'reorderSteps', taskId: task.id, order: ids });
      } else App.render();
    }
  });
  document.addEventListener('dragend', function () {
    drag = null;
    document.querySelectorAll('.drag-over, .dragging').forEach(function (c) { c.classList.remove('drag-over', 'dragging'); });
    pointerUp();
  });

  /* ---------- boot ---------- */
  function debounce(fn, ms) {
    var timer;
    return function () { var args = arguments, self = this; clearTimeout(timer); timer = setTimeout(function () { fn.apply(self, args); }, ms); };
  }
  function start() {
    shell();
    S.route = parseHash();
    App.render();
    if (!App.prefs.get('welcomed', '')) setTimeout(App.openWelcome, 300);
    if (S.mode === 'live') Live.startPolling();
    // keep "2d ago" labels and overdue flags fresh
    setInterval(function () { if (!document.hidden && !App.hasModal()) App.render(); }, 5 * 60000);
  }
  function fatal(msg) {
    document.getElementById('app').innerHTML = '<div class="loading"><div style="max-width:520px;text-align:center;line-height:1.5"><div style="font-size:30px">⚠️</div><b>The tracker couldn’t load.</b><div class="muted" style="margin-top:6px">' + esc(msg) + '</div><button type="button" class="btn" style="margin-top:14px" onclick="location.reload()">Try again</button></div></div>';
  }
  function joinScreen(email) {
    var unclaimed = C.activePeople(S.state).filter(function (p) { return !p.email && p.role === 'member'; });
    var root = document.getElementById('app');
    root.innerHTML = '<div class="modal-wrap" style="background:var(--bg)"><div class="modal" style="width:min(620px,100%)"><div class="modal-head"><div class="brand-mark" style="color:#fff">AIS</div><h2>Join the AI Safety team tracker</h2></div><div class="modal-body">' +
      '<p style="margin:0 0 12px;line-height:1.5">You’re signed in as <b>' + esc(email) + '</b>, but you’re not on the roster yet.</p>' +
      (unclaimed.length ? '<div class="field-label">Is one of these you?</div><div class="row wrap-row" style="gap:6px;margin-bottom:16px">' + unclaimed.map(function (p) { return '<button type="button" class="filter-btn" data-claim="' + esc(p.id) + '">' + App.avatar(p.id, 'sm') + esc(p.name) + ' <span class="muted" style="font-weight:400">' + esc(p.title || App.roleLabel(p.role)) + '</span></button>'; }).join('') + '</div><div class="field-label">Not listed? Add yourself:</div>' : '') +
      '<div class="grid-2"><input class="input" id="jn-name" placeholder="Your full name"><input class="input" id="jn-title" placeholder="Title (optional)"></div>' +
      '<div class="row wrap-row" style="gap:6px;margin-top:10px">' + V.liveTeams().filter(function (t) { return t.id !== 'exec'; }).map(function (t) { return '<label class="filter-btn" style="cursor:pointer"><input type="checkbox" value="' + esc(t.id) + '" style="margin:0"> <span class="team-dot" style="background:' + esc(t.color) + '"></span>' + esc(t.name) + '</label>'; }).join('') + '</div>' +
      '<div class="hint" style="margin-top:8px">You’ll join as a member. Exec can change roles in Settings.</div></div>' +
      '<div class="modal-foot"><button type="button" class="btn primary" id="jn-go">Join</button></div></div></div><div class="toasts" id="toasts"></div>';
    function done(res) {
      S.state = res.state;
      var me = C.personByEmail(S.state, email);
      if (!me) { fatal('Joined, but your profile wasn’t found. Reload the page.'); return; }
      S.meId = me.id;
      start();
    }
    root.querySelectorAll('[data-claim]').forEach(function (b) {
      b.onclick = function () {
        b.disabled = true;
        App.server('join', { claimId: b.dataset.claim }).then(done).catch(function (e) { b.disabled = false; App.toast(e.message || String(e), { type: 'err' }); });
      };
    });
    root.querySelector('#jn-go').onclick = function () {
      var name = root.querySelector('#jn-name').value.trim();
      if (!name) { App.toast('Please enter your name.', { type: 'err' }); return; }
      var teams = Array.prototype.slice.call(root.querySelectorAll('input[type=checkbox]:checked')).map(function (c) { return c.value; });
      App.server('join', { person: { name: name, title: root.querySelector('#jn-title').value.trim(), teams: teams } }).then(done).catch(function (e) { App.toast(e.message || String(e), { type: 'err' }); });
    };
  }

  function boot() {
    if (!IS_GAS) {
      Local.load();
      if (!S.meId) { fatal('No people on the roster.'); return; }
      start();
      return;
    }
    App.server('bootstrap').then(function (b) {
      S.state = b.state;
      C.COLLECTIONS.forEach(function (c) { S.state[c] = S.state[c] || []; });
      S.integrations = b.integrations || S.integrations;
      S.appUrl = b.appUrl || '';
      S.since = b.serverTime;
      S.email = b.email;
      if (!b.email) { fatal('Google didn’t share your email with the tracker. Make sure you’re signed in with your UChicago Google account and that the web app is deployed for your domain.'); return; }
      var me = C.personByEmail(S.state, b.email);
      if (!me) { joinScreen(b.email); return; }
      S.meId = me.id;
      google.script.url.getLocation(function (loc) {
        var task = loc && loc.parameter && loc.parameter.task;
        if (task && !location.hash) location.hash = '#/home?task=' + encodeURIComponent(task);
        start();
      });
    }).catch(function (err) { fatal(err.message || String(err)); });
  }
  App.boot = boot;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})(App);
