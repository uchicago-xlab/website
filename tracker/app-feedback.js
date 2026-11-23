/* Tracker feedback: a button on every page, a dialog that attaches page context and recent
   errors, and a feedback inbox for exec in Settings. In the deployed version submissions go
   to the server (submitFeedback in Code.gs); in the demo they are kept in this browser. */
(function (App) {
  'use strict';
  var C = App.C, esc = App.esc, icon = App.icon, A = App.actions;
  var LS_FB = 'aisafety-tracker:feedback:v1';
  var APP_VERSION = '2026.11.2';
  var TYPES = [
    { id: 'bug', label: 'Something’s broken', emoji: '🐞', hint: 'What happened, and what did you expect instead? Steps to make it happen again help a lot.' },
    { id: 'idea', label: 'Idea', emoji: '💡', hint: 'What would make the tracker more useful for you or your team?' },
    { id: 'confusing', label: 'Confusing', emoji: '😕', hint: 'What was hard to find or understand?' },
    { id: 'praise', label: 'I like this', emoji: '❤️', hint: 'What’s working well? (Helps us know what not to break.)' }
  ];
  App.FEEDBACK_TYPES = TYPES;

  /* ---------- remember recent errors so bug reports carry them ---------- */
  App.errors = [];
  function remember(msg) {
    App.errors.push({ msg: String(msg).slice(0, 300), at: new Date().toISOString() });
    if (App.errors.length > 8) App.errors.shift();
  }
  window.addEventListener('error', function (e) {
    remember((e.message || 'Error') + (e.filename ? ' @ ' + String(e.filename).split('/').pop() + ':' + e.lineno : ''));
  });
  window.addEventListener('unhandledrejection', function (e) {
    remember('Unhandled: ' + (e.reason && e.reason.message || e.reason));
  });
  var baseToast = App.toast;
  App.toast = function (msg, opts) {
    if (opts && opts.type === 'err') remember('Shown to user: ' + msg);
    return baseToast(msg, opts);
  };

  function context() {
    var S = App.S, r = S.route || { query: {} };
    var t = r.query && r.query.task ? C.task(S.state, r.query.task) : null;
    var h1 = document.querySelector('.topbar h1');
    var tab = document.querySelector('.tab.active');
    return {
      page: (location.hash || '#/home').split('?')[0],
      pageName: ((h1 ? h1.textContent : '') + (tab ? ' › ' + tab.textContent : '')).trim(),
      task: t ? { id: t.id, title: t.title } : null,
      mode: S.mode,
      role: (App.me() || {}).role || null,
      browser: navigator.userAgent,
      screen: window.innerWidth + '×' + window.innerHeight,
      version: APP_VERSION,
      errors: App.errors.slice()
    };
  }

  /* ---------- the button ---------- */
  App.feedbackButton = function () {
    return '<button type="button" class="fb-fab" data-act="feedback" title="Report a bug or suggest an improvement">' + icon('help', 16) + '<span>Feedback</span></button>';
  };

  /* ---------- the dialog ---------- */
  A.feedback = function (el) { App.openFeedback(el && el.dataset.type); };
  App.openFeedback = function (preType) {
    var ctx = context();
    var type = preType || (ctx.errors.length ? 'bug' : 'idea');
    var I = App.S.integrations.feedback || {};
    var where = App.S.mode === 'live'
      ? 'Goes to the tracker maintainers' + (I.email ? ' by email' : '') + (I.slack ? ' and Slack' : '') + ', and into the feedback log exec can see in Settings.' + (I.github ? ' Bugs and ideas are also filed as a <b>public</b> GitHub issue, without your name or the task title.' : '')
      : '<b>Demo mode:</b> saved in this browser and listed under Settings → Feedback. In the deployed tracker it goes straight to the maintainers.';
    var details = ['page “' + esc(ctx.pageName || ctx.page) + '”'];
    if (ctx.task) details.push('task “' + esc(ctx.task.title) + '”');
    details.push('browser & screen size');
    if (ctx.errors.length) details.push('<b>' + App.plural(ctx.errors.length, 'recent error') + '</b>');
    var body = '<div class="stack">' +
      '<div class="fb-types">' + TYPES.map(function (t) { return '<button type="button" class="fb-type' + (t.id === type ? ' on' : '') + '" data-type="' + t.id + '"><span class="fb-emoji">' + t.emoji + '</span>' + esc(t.label) + '</button>'; }).join('') + '</div>' +
      '<div><textarea id="fb-msg" class="textarea" style="min-height:130px" placeholder="' + esc(TYPES.filter(function (t) { return t.id === type; })[0].hint) + '" autofocus></textarea></div>' +
      '<label class="row" style="gap:8px;font-size:13px;align-items:flex-start"><input type="checkbox" id="fb-ctx" checked style="margin-top:2px"><span>Include where I was and technical details: ' + details.join(', ') + '</span></label>' +
      '<div class="hint">' + where + '</div></div>';
    App.modal({
      title: 'Send feedback', body: body,
      foot: '<span class="hint">Sent as ' + esc((App.me() || {}).name || 'you') + '</span><span class="spacer"></span><button type="button" class="btn" data-close>Cancel</button><button type="button" class="btn primary" id="fb-go">' + icon('send', 14) + 'Send</button>',
      onMount: function (el, api) {
        var msg = el.querySelector('#fb-msg');
        el.querySelectorAll('.fb-type').forEach(function (b) {
          b.onclick = function () {
            type = b.dataset.type;
            el.querySelectorAll('.fb-type').forEach(function (x) { x.classList.toggle('on', x === b); });
            msg.placeholder = TYPES.filter(function (t) { return t.id === type; })[0].hint;
            msg.focus();
          };
        });
        msg.addEventListener('keydown', function (e) { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); send(); } });
        var go = el.querySelector('#fb-go');
        function send() {
          var text = msg.value.trim();
          if (text.length < 3) { App.toast('Tell us a bit more first.', { type: 'err' }); msg.focus(); return; }
          var payload = { type: type, message: text, context: el.querySelector('#fb-ctx').checked ? ctx : { page: ctx.page, version: ctx.version, mode: ctx.mode } };
          go.disabled = true;
          submit(payload).then(function (res) {
            api.close();
            App.toast(type === 'praise' ? 'Thank you! 💛' : 'Thanks! Your feedback was sent.' + (res && res.issueUrl ? ' Filed as a GitHub issue.' : ''), { timeout: 5000 });
            if (App.S.route.path === 'settings') { App.S.ui.feedbackList = null; App.render(); }
          }).catch(function (err) {
            go.disabled = false;
            App.toast('Couldn’t send feedback: ' + (err.message || err), { type: 'err' });
          });
        }
        go.onclick = send;
      }
    });
  };

  function localList() {
    try { return JSON.parse(localStorage.getItem(LS_FB) || '[]'); } catch (e) { return []; }
  }
  function saveLocal(list) { try { localStorage.setItem(LS_FB, JSON.stringify(list.slice(0, 200))); } catch (e) { /* storage full */ } }
  function submit(payload) {
    if (App.S.mode === 'live') return App.server('submitFeedback', payload);
    var me = App.me() || {};
    var list = localList();
    list.unshift({ id: C.uid('fb'), at: C.nowIso(), status: 'open', type: payload.type, from: me.name || '', page: payload.context.page, pageName: payload.context.pageName || payload.context.page, task: payload.context.task ? payload.context.task.title : '', message: payload.message, details: payload.context, issue: '' });
    saveLocal(list);
    return Promise.resolve({ ok: true });
  }

  /* ---------- feedback inbox (Settings, exec only) ---------- */
  App.feedbackSettingsHtml = function () {
    var me = App.me();
    if (!me || me.role !== 'exec') return '';
    var S = App.S;
    var list = S.mode === 'live' ? S.ui.feedbackList : localList();
    if (S.mode === 'live' && !list) {
      if (!S.ui.feedbackLoading) {
        S.ui.feedbackLoading = true;
        App.server('listFeedback').then(function (res) {
          S.ui.feedbackList = res.items || [];
          S.ui.feedbackLoading = false;
          if (S.route.path === 'settings') App.render();
        }).catch(function (err) {
          S.ui.feedbackLoading = false;
          S.ui.feedbackList = [];
          App.toast('Couldn’t load feedback: ' + (err.message || err), { type: 'err' });
        });
      }
    }
    var filter = S.ui.feedbackFilter || 'open';
    var shown = (list || []).filter(function (f) { return filter === 'all' || (f.status || 'open') === filter; });
    var open = (list || []).filter(function (f) { return (f.status || 'open') === 'open'; }).length;
    var html = '<div class="section-title" style="margin-top:22px">Feedback <span class="muted">· bugs and ideas people sent with the Feedback button</span><span style="flex:1"></span>' +
      '<span class="seg">' + ['open', 'done', 'all'].map(function (s) { return '<button type="button" class="' + (filter === s ? 'on' : '') + '" data-act="fbFilter" data-v="' + s + '">' + { open: 'Open (' + open + ')', done: 'Done', all: 'All' }[s] + '</button>'; }).join('') + '</span>' +
      (S.mode === 'live' ? '<button type="button" class="btn sm ghost" data-act="fbRefresh">' + icon('refresh', 12) + 'Refresh</button>' : '') + '</div>';
    if (!list) return html + '<div class="card card-pad muted">Loading feedback…</div>';
    if (!shown.length) return html + '<div class="card empty" style="padding:22px"><b>' + (filter === 'open' ? 'No open feedback.' : 'Nothing here.') + '</b><div>Everyone sees a <b>Feedback</b> button in the bottom-right corner of every page.</div></div>';
    html += '<div class="card" style="overflow:hidden">' + shown.map(function (f) {
      var t = TYPES.filter(function (x) { return x.id === f.type; })[0] || TYPES[1];
      var done = f.status === 'done';
      var errs = f.details && f.details.errors && f.details.errors.length ? ' · <span style="color:var(--bad)">' + App.plural(f.details.errors.length, 'error') + '</span>' : '';
      return '<div class="inbox-item" style="cursor:default' + (done ? ';opacity:.6' : '') + '"><span style="font-size:20px;line-height:1">' + t.emoji + '</span><div style="min-width:0"><div class="ii-title"><b>' + esc(f.from || 'Someone') + '</b> · ' + esc(t.label) + (f.page ? ' · <span class="muted">' + esc(f.pageName || f.page) + '</span>' : '') + errs + '</div>' +
        (f.task ? '<div class="ii-task">Task: ' + esc(f.task) + '</div>' : '') +
        '<div class="ii-body">' + esc(f.message) + '</div>' +
        (f.issue ? '<div style="margin-top:4px"><a href="' + esc(App.safeUrl(f.issue)) + '" target="_blank" rel="noopener" style="font-size:12.5px">' + icon('external', 11) + ' GitHub issue</a></div>' : '') +
        (f.details && f.details.errors && f.details.errors.length ? '<details style="margin-top:4px;font-size:12px"><summary class="muted">Technical details</summary><pre style="white-space:pre-wrap;font-size:11.5px;background:var(--bg);padding:8px;border-radius:6px;margin:4px 0 0">' + esc(JSON.stringify(f.details, null, 2)) + '</pre></details>' : '') +
        '</div><div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px"><span class="ii-when">' + App.relTime(f.at) + '</span><button type="button" class="btn sm" data-act="fbStatus" data-id="' + esc(f.id) + '" data-v="' + (done ? 'open' : 'done') + '">' + (done ? 'Reopen' : icon('check', 12) + 'Done') + '</button></div></div>';
    }).join('') + '</div>';
    return html;
  };
  A.fbFilter = function (el) { App.S.ui.feedbackFilter = el.dataset.v; App.render(); };
  A.fbRefresh = function () { App.S.ui.feedbackList = null; App.render(); };
  A.fbStatus = function (el) {
    var id = el.dataset.id, status = el.dataset.v;
    if (App.S.mode === 'live') {
      var item = (App.S.ui.feedbackList || []).filter(function (f) { return f.id === id; })[0];
      if (item) item.status = status;
      App.render();
      App.server('setFeedbackStatus', id, status).catch(function (err) { App.toast(err.message || String(err), { type: 'err' }); A.fbRefresh(); });
    } else {
      var list = localList();
      list.forEach(function (f) { if (f.id === id) f.status = status; });
      saveLocal(list);
      App.render();
    }
  };
})(App);
