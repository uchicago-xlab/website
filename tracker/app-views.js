/* Tracker pages: sidebar, home, inbox, dashboard, task views (list/board/timeline), people, docs, settings. */
(function (App) {
  'use strict';
  var C = App.C, esc = App.esc, icon = App.icon;
  var V = App.views = {};

  function st() { return App.S.state; }
  function me() { return App.me(); }
  function liveTeams() { return st().teams.filter(function (t) { return !t.deleted; }); }
  function liveProjects(teamId) {
    return st().projects.filter(function (p) { return !p.deleted && !p.archived && (!teamId || p.team === teamId); });
  }
  V.liveTeams = liveTeams;
  V.liveProjects = liveProjects;

  /* ======================= sidebar ======================= */
  V.sidebar = function () {
    var r = App.S.route, m = me();
    var inboxCount = V.inboxItems().filter(function (i) { return i.unread; }).length;
    var myOverdue = C.activeTasks(st()).filter(function (t) { return C.involves(t, m.id) && C.isOverdue(t); }).length;
    function item(path, ico, label, extra, active) {
      return '<a class="nav-item' + (active ? ' active' : '') + '" href="#/' + path + '">' + icon(ico, 18) + '<span>' + label + '</span>' + (extra || '') + '</a>';
    }
    var html = '<div class="brand"><div class="brand-mark">AIS</div><div><div class="brand-name">AI Safety @ UChicago</div><div class="brand-sub">Team tracker</div></div></div>';
    html += item('home', 'home', 'My work', myOverdue ? '<span class="count" title="Overdue">' + myOverdue + '</span>' : '', r.path === 'home');
    html += item('inbox', 'inbox', 'Inbox', inboxCount ? '<span class="count">' + inboxCount + '</span>' : '', r.path === 'inbox');
    html += item('dashboard', 'chart', 'Dashboard', '', r.path === 'dashboard');
    html += item('all', 'list', 'All tasks', '', r.path === 'all');
    html += item('docs', 'docs', 'Docs & checklists', '', r.path === 'docs');
    html += item('people', 'people', 'People', '', r.path === 'people' || r.path === 'person');
    html += '<div class="nav-section"><span>Teams</span></div>';
    liveTeams().forEach(function (t) {
      var d = C.teamDigest(st(), t.id);
      var badge = d.overdue.length ? '<span class="count" title="Overdue tasks">' + d.overdue.length + '</span>' : '<span class="count dim">' + d.open.length + '</span>';
      var mine = C.has(m.teams, t.id);
      html += '<a class="nav-item' + (r.path === 'team' && r.id === t.id ? ' active' : '') + '" href="#/team/' + esc(t.id) + '"' + (mine ? ' title="Your team"' : '') + '><span class="team-dot" style="background:' + esc(t.color) + '"></span><span' + (mine ? ' style="font-weight:700;color:#fff"' : '') + '>' + esc(t.name) + '</span>' + badge + '</a>';
      if (r.path === 'team' && r.id === t.id || (r.path === 'project' && (C.byId(st().projects, r.id) || {}).team === t.id)) {
        liveProjects(t.id).forEach(function (p) {
          html += '<a class="nav-item' + (r.path === 'project' && r.id === p.id ? ' active' : '') + '" style="padding-left:30px;font-size:13px" href="#/project/' + esc(p.id) + '">' + icon('target', 14) + '<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(p.name) + '</span></a>';
        });
      }
    });
    html += '<div class="sidebar-foot">';
    html += item('settings', 'settings', 'Settings', '', r.path === 'settings');
    html += '<button type="button" class="me-card" data-act="meMenu">' + App.avatar(m.id) + '<div style="min-width:0"><div class="me-name">' + esc(m.name) + '</div><div class="me-role">' + esc(m.title || App.roleLabel(m.role)) + (App.S.mode === 'demo' ? ' · switch user ▾' : '') + '</div></div></button>';
    if (App.S.mode === 'demo') {
      html += '<div class="mode-pill"><b>Demo mode.</b> Data lives only in this browser. Click your name to view as someone else. <a href="#/settings" style="color:#ffe3a3;text-decoration:underline">Connect Google &amp; Slack</a></div>';
    } else {
      html += '<div class="mode-pill live"><span class="sync-dot ' + (App.S.sync === 'busy' ? 'busy' : App.S.sync === 'err' ? 'err' : '') + '"></span> ' + (App.S.sync === 'err' ? 'Sync problem: retrying' : App.S.sync === 'busy' ? 'Saving…' : 'Synced with Google Sheets') + '</div>';
    }
    html += '</div>';
    return html;
  };

  /* ======================= shared task rendering ======================= */
  function flags(t, opts) {
    var out = [];
    if (C.isDone(t)) return '';
    if (t.status === 'blocked') out.push('<span class="flag blocked">' + icon('flag', 10) + 'Blocked</span>');
    var help = C.openHelp(t);
    if (help.length) out.push('<span class="flag help" title="' + esc(help.map(function (h) { return App.pname(h.from) + ' → ' + App.pname(h.to); }).join(', ')) + '">' + icon('hand', 10) + 'Help: ' + esc(help.map(function (h) { return App.firstName(h.to); }).join(', ')) + '</span>');
    if (C.isStale(t)) out.push('<span class="flag stale" title="No check-in for ' + C.staleDays(t) + ' days">' + icon('clock', 10) + 'No update ' + C.staleDays(t) + 'd</span>');
    if (!t.owner) out.push('<span class="flag unowned">No owner</span>');
    if (t.health === 'off' || t.health === 'risk') { var h = App.healthOf(t.health); out.push('<span class="flag" style="background:' + h.color + '1a;color:' + h.color + '">' + h.label + '</span>'); }
    return out.join('');
  }
  V.flags = flags;
  function miniProgress(t) {
    var p = C.stepProgress(t);
    if (!p.total) return '';
    return '<span class="mini-progress" title="' + p.done + ' of ' + p.total + ' steps done"><span class="progress"><span style="width:' + p.pct + '%"></span></span>' + p.done + '/' + p.total + '</span>';
  }
  V.miniProgress = miniProgress;
  function taskRow(t, opts) {
    opts = opts || {};
    var sel = App.S.route.query.task === t.id;
    return '<div class="task-row' + (C.isDone(t) ? ' is-done' : '') + (sel ? ' selected' : '') + '" data-act="openTask" data-id="' + esc(t.id) + '" role="button" tabindex="0">' +
      '<button type="button" class="check' + (C.isDone(t) ? ' on' : '') + '" data-act="toggleDone" data-id="' + esc(t.id) + '" aria-label="' + (C.isDone(t) ? 'Mark incomplete' : 'Mark complete') + '" title="' + (C.isDone(t) ? 'Mark incomplete' : 'Mark complete') + '">' + icon('check', 12) + '</button>' +
      '<div style="min-width:0"><div class="title">' + esc(t.title) + '</div>' +
      '<div class="sub">' + (opts.showTeam !== false ? App.teamChip(t.team) : '') + (opts.showProject !== false ? App.projectChip(t.project) : '') + flags(t) + miniProgress(t) + '</div></div>' +
      '<div class="meta"><span class="hide-sm">' + App.statusPill(t.status) + '</span>' + App.dueHtml(t) + App.avatar(t.owner) + '</div></div>';
  }
  V.taskRow = taskRow;

  function groupTasks(tasks, by) {
    var groups = [];
    function add(key, label, color, list) { if (list.length || key === '_always') groups.push({ key: key, label: label, color: color, tasks: list }); }
    if (by === 'status') {
      C.STATUSES.forEach(function (s) { add(s.id, s.label, s.color, tasks.filter(function (t) { return t.status === s.id; })); });
    } else if (by === 'due') {
      [['overdue', 'Overdue', '#dc2626'], ['today', 'Due today', '#d97706'], ['week', 'Next 7 days', '#2563eb'], ['later', 'Later', '#64748b'], ['nodate', 'No due date', '#94a3b8'], ['done', 'Completed', '#16a34a']].forEach(function (g) {
        add(g[0], g[1], g[2], tasks.filter(function (t) { return C.dueBucket(t) === g[0]; }));
      });
    } else if (by === 'owner') {
      var ids = [];
      tasks.forEach(function (t) { if (ids.indexOf(t.owner || '') === -1) ids.push(t.owner || ''); });
      ids.sort(function (a, b) { return a ? (b ? App.pname(a).localeCompare(App.pname(b)) : -1) : 1; });
      ids.forEach(function (id) { add('o' + id, id ? App.pname(id) : 'Unassigned', id ? App.avColor(id) : '#94a3b8', tasks.filter(function (t) { return (t.owner || '') === id; })); });
    } else if (by === 'project') {
      st().projects.filter(function (p) { return !p.deleted; }).forEach(function (p) { add(p.id, p.name, p.color || '#64748b', tasks.filter(function (t) { return t.project === p.id; })); });
      add('none', 'No project', '#94a3b8', tasks.filter(function (t) { return !t.project || !C.byId(st().projects, t.project) || C.byId(st().projects, t.project).deleted; }));
    } else if (by === 'team') {
      liveTeams().forEach(function (tm) { add(tm.id, tm.name, tm.color, tasks.filter(function (t) { return t.team === tm.id; })); });
    } else {
      add('all', 'Tasks', '#64748b', tasks);
    }
    groups.forEach(function (g) { g.tasks.sort(C.compareTasks); });
    return groups;
  }
  V.groupTasks = groupTasks;

  function quickAdd(scopeKey, defaults, placeholder) {
    return '<div class="quick-add"><span class="plus">' + icon('plus', 16) + '</span><input data-fk="qa-' + esc(scopeKey) + '" data-enter="quickAdd" data-input="qaPreview" data-defaults="' + esc(JSON.stringify(defaults)) + '" placeholder="' + esc(placeholder || 'Add a task… try “Book room @' + App.firstName(App.S.meId).toLowerCase() + ' due fri !high”') + '" aria-label="Add a task"><span class="qa-preview"></span></div>';
  }
  V.quickAdd = quickAdd;

  function groupedList(tasks, by, scopeKey, defaults, opts) {
    opts = opts || {};
    var groups = groupTasks(tasks, by);
    var collapsed = App.S.ui.collapsed;
    var html = '';
    if (opts.quickAdd !== false) html += '<div class="task-list" style="margin-bottom:16px">' + quickAdd(scopeKey, defaults) + '</div>';
    if (!tasks.length) {
      return html + '<div class="card empty"><div class="big">🌱</div><b>' + (opts.emptyTitle || 'No tasks here yet.') + '</b><div style="margin-top:4px">' + (opts.emptyText || 'Add one above, or press <kbd>N</kbd> for the full form.') + '</div></div>';
    }
    groups.forEach(function (g) {
      var ck = scopeKey + ':' + by + ':' + g.key;
      var isCol = collapsed[ck] !== undefined ? collapsed[ck] : (g.key === 'done' && by !== 'status');
      html += '<div class="list-group"><button type="button" class="group-head' + (isCol ? ' collapsed' : '') + '" data-act="toggleGroup" data-key="' + esc(ck) + '">' + icon('chevron', 14, 'caret') + '<span class="team-dot" style="background:' + esc(g.color) + '"></span>' + esc(g.label) + ' <span class="count">' + g.tasks.length + '</span></button>';
      if (!isCol) html += '<div class="task-list">' + g.tasks.map(function (t) { return taskRow(t, opts); }).join('') + '</div>';
      html += '</div>';
    });
    return html;
  }
  V.groupedList = groupedList;

  /* ======================= Home / My work ======================= */
  V.home = function () {
    var m = me(), today = C.todayKey();
    var dg = C.personDigest(st(), m.id);
    var mine = C.activeTasks(st()).filter(function (t) { return C.involves(t, m.id) || (C.isDone(t) && t.owner === m.id); });
    var open = mine.filter(function (t) { return !C.isDone(t); });
    var dueWeek = open.filter(function (t) { return t.dueDate && t.dueDate >= today && C.daysBetween(today, t.dueDate) <= 7; });
    var hour = new Date().getHours();
    var greet = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
    var subParts = [];
    if (dg.overdue.length) subParts.push('<b style="color:var(--bad)">' + App.plural(dg.overdue.length, 'overdue task') + '</b>');
    if (dg.helpForMe.length) subParts.push('<b style="color:var(--warn)">' + App.plural(dg.helpForMe.length, 'person', 'people') + ' waiting on your help</b>');
    if (dueWeek.length) subParts.push(App.plural(dueWeek.length, 'task') + ' due this week');
    var sub = subParts.length ? 'You have ' + subParts.join(', ') + '.' : (open.length ? 'Nothing urgent. Nice work.' : 'You have no open tasks. Grab one from your team or add your own.');
    var html = '<div class="wrap"><h2 class="greeting">' + greet + ', ' + esc(m.name.split(' ')[0]) + '</h2><p class="greeting-sub">' + esc(App.DOW[new Date().getDay()]) + ', ' + esc(App.fmtDate(today, { absolute: true })) + ' · ' + sub + '</p>';
    html += '<div class="stat-row">' +
      stat(dg.overdue.length, 'Overdue', dg.overdue.length ? 'bad' : 'ok', 'filterHome', 'overdue') +
      stat(dueWeek.length, 'Due in the next 7 days', dueWeek.length ? 'warn' : '', 'filterHome', 'week') +
      stat(dg.helpForMe.length, 'Waiting on your help', dg.helpForMe.length ? 'warn' : '', 'scrollTo', 'attention') +
      stat(dg.stale.length, 'Need a check-in from you', dg.stale.length ? 'bad' : 'ok', 'scrollTo', 'attention') + '</div>';
    html += '<div class="home-grid"><div>';
    html += '<div class="section-title">My tasks <span class="muted">· tasks you own, collaborate on, or have steps in</span></div>';
    var defaults = { owner: m.id, team: App.myTeam() };
    html += groupedList(mine, 'due', 'home', defaults, { emptyTitle: 'No tasks assigned to you.', emptyText: 'Add your own above, or browse your team’s tasks in the sidebar and take one that has no owner.' });
    html += '</div><div class="stack">';
    html += attentionCard();
    if (m.role !== 'member') html += leaderCard();
    html += '<div class="tip"><b>How we use this:</b><br>① Every task has <b>one owner</b> and a due date.<br>② Post a <b>check-in</b> on your tasks every week (on track / at risk / off track).<br>③ Stuck? Hit <b>Ask for help</b> in the task. It pings that person on Slack, so nobody has to chase.<br>④ Put docs, links and notes <b>in the task</b>, not in DMs.</div>';
    html += '</div></div></div>';
    return { title: 'My work', content: html };
  };
  function stat(n, label, cls, act, arg) {
    return '<button type="button" class="stat ' + (cls || '') + '" data-act="' + act + '" data-arg="' + esc(arg) + '"><div class="num">' + n + '</div><div class="lbl">' + esc(label) + '</div></button>';
  }
  function attentionCard() {
    var m = me(), items = [];
    C.activeTasks(st()).forEach(function (t) {
      C.openHelp(t).forEach(function (h) {
        if (h.to === m.id) items.push({ rank: 0, html: '<div class="attention-item" data-act="openTask" data-id="' + esc(t.id) + '">' + App.avatar(h.from, 'sm') + '<div style="flex:1;min-width:0"><div class="ai-title">' + esc(App.firstName(h.from)) + ' needs your help</div><div class="ai-sub"><b>' + esc(t.title) + '</b>' + (h.message ? '<br>“' + esc(h.message) + '”' : '') + '</div><div class="ai-sub muted">' + App.relTime(h.at) + '</div></div><button type="button" class="btn sm" data-act="resolveHelp" data-id="' + esc(t.id) + '" data-help="' + esc(h.id) + '">Done</button></div>' });
        if (h.from === m.id) items.push({ rank: 3, html: '<div class="attention-item" data-act="openTask" data-id="' + esc(t.id) + '">' + App.avatar(h.to, 'sm') + '<div style="flex:1;min-width:0"><div class="ai-title">Waiting on ' + esc(App.firstName(h.to)) + '</div><div class="ai-sub">' + esc(t.title) + ' · asked ' + App.relTime(h.at) + '</div></div></div>' });
      });
      if (C.isDone(t)) return;
      (t.steps || []).forEach(function (s) {
        if (s.assignee === m.id && !s.done && t.owner !== m.id) {
          var late = s.due && s.due < C.todayKey();
          items.push({ rank: late ? 1 : 2, html: '<div class="attention-item" data-act="openTask" data-id="' + esc(t.id) + '"><button type="button" class="check sq" data-act="toggleStep" data-id="' + esc(t.id) + '" data-step="' + esc(s.id) + '" aria-label="Complete step">' + icon('check', 11) + '</button><div style="flex:1;min-width:0"><div class="ai-title">' + esc(s.text) + '</div><div class="ai-sub">Step in <b>' + esc(t.title) + '</b> (owner: ' + esc(App.firstName(t.owner)) + ')' + (s.due ? ' · <span class="due' + (late ? ' overdue' : '') + '">due ' + App.fmtDate(s.due) + '</span>' : '') + '</div></div></div>' });
        }
      });
      if (t.owner === m.id && C.isStale(t)) {
        items.push({ rank: 1, html: '<div class="attention-item" data-act="openTask" data-id="' + esc(t.id) + '" data-focus="checkin"><span class="avatar sm" style="background:var(--bad)">!</span><div style="flex:1;min-width:0"><div class="ai-title">Post a check-in</div><div class="ai-sub">' + esc(t.title) + ' · no update in ' + C.staleDays(t) + ' days</div></div><button type="button" class="btn sm" data-act="openTask" data-id="' + esc(t.id) + '" data-focus="checkin">Check in</button></div>' });
      }
    });
    items.sort(function (a, b) { return a.rank - b.rank; });
    return '<div class="card card-pad" id="attention"><h3>' + icon('bell', 15) + 'Needs your attention</h3>' + (items.length ? items.slice(0, 12).map(function (i) { return i.html; }).join('') : '<div class="muted" style="font-size:13px">All clear: nobody is waiting on you. 🎉</div>') + '</div>';
  }
  function leaderCard() {
    var m = me();
    var teams = C.isExec(m) ? liveTeams() : liveTeams().filter(function (t) { return C.has(m.teams, t.id); });
    var rows = teams.map(function (t) {
      var d = C.teamDigest(st(), t.id);
      var bits = [];
      if (d.overdue.length) bits.push('<span style="color:var(--bad);font-weight:700">' + d.overdue.length + ' overdue</span>');
      if (d.blocked.length) bits.push('<span style="color:var(--bad)">' + d.blocked.length + ' blocked</span>');
      if (d.stale.length) bits.push('<span style="color:var(--warn)">' + d.stale.length + ' need update</span>');
      if (d.unowned.length) bits.push('<span style="color:#4338ca">' + d.unowned.length + ' no owner</span>');
      return '<a class="attention-item" href="#/team/' + esc(t.id) + '" style="color:inherit;text-decoration:none"><span class="team-dot" style="background:' + esc(t.color) + ';margin-top:4px"></span><div style="flex:1"><div class="ai-title">' + esc(t.name) + ' <span class="muted" style="font-weight:400">· ' + d.open.length + ' open</span></div><div class="ai-sub">' + (bits.join(' · ') || '<span style="color:var(--ok)">All on track</span>') + '</div></div></a>';
    }).join('');
    return '<div class="card card-pad"><h3>' + icon('chart', 15) + (C.isExec(m) ? 'Across all teams' : 'Your team') + '<span style="flex:1"></span><a href="#/dashboard" style="font-size:12px;font-weight:600">Dashboard →</a></h3>' + rows + '</div>';
  }

  /* ======================= Inbox ======================= */
  V.inboxItems = function () {
    var m = me();
    if (!m) return [];
    var seen = App.prefs.get('inboxSeen:' + m.id, '');
    var items = [];
    C.activeTasks(st()).forEach(function (t) {
      (t.feed || []).forEach(function (e) {
        if (e.by === m.id || !C.has(e.notify, m.id)) return;
        items.push({ task: t, entry: e, at: e.at, unread: !seen || e.at > seen });
      });
    });
    items.sort(function (a, b) { return a.at < b.at ? 1 : -1; });
    return items.slice(0, 200);
  };
  function inboxText(e) {
    var who = '<b>' + esc(App.pname(e.by)) + '</b>';
    switch (e.kind === 'activity' ? e.action : e.kind) {
      case 'comment': return who + ' mentioned you';
      case 'checkin': return who + ' posted a check-in: ' + App.healthPill(e.health);
      case 'created': return who + ' assigned you a new task';
      case 'owner': return who + ' made you the owner';
      case 'status': return who + ' moved this to ' + App.statusPill(e.value);
      case 'collaborators': return who + ' added you as a collaborator';
      case 'help': return who + ' asked you for help';
      case 'helpResolved': return who + ' marked your help request as resolved';
      case 'nudge': return who + ' nudged you for an update';
      default: return who + ' updated this task';
    }
  }
  V.inbox = function () {
    var items = V.inboxItems();
    var html = '<div class="wrap" style="max-width:860px">';
    html += '<p class="muted" style="margin:0 0 14px">Assignments, @mentions, help requests and nudges that involve you. With Slack connected, these also arrive as DMs.</p>';
    if (!items.length) {
      html += '<div class="card empty"><div class="big">📭</div><b>Inbox zero.</b><div>When someone assigns you, mentions you or asks you for help, it shows up here.</div></div>';
    } else {
      html += '<div class="card" style="overflow:hidden">' + items.map(function (i) {
        var e = i.entry;
        var body = e.text ? '<div class="ii-body">' + App.inline(e.text) + '</div>' : '';
        return '<div class="inbox-item' + (i.unread ? ' unread' : '') + '" data-act="openTask" data-id="' + esc(i.task.id) + '">' + App.avatar(e.by) + '<div style="min-width:0"><div class="ii-title">' + inboxText(e) + '</div><div class="ii-task">' + esc(i.task.title) + ' · ' + App.teamChip(i.task.team) + '</div>' + body + '</div><div class="ii-when">' + App.relTime(e.at) + '</div></div>';
      }).join('') + '</div>';
    }
    html += '</div>';
    var unread = items.filter(function (i) { return i.unread; }).length;
    return {
      title: 'Inbox', sub: unread ? unread + ' unread' : '',
      actions: unread ? '<button type="button" class="btn" data-act="markInboxRead">' + icon('check', 14) + 'Mark all read</button>' : '',
      content: html
    };
  };

  /* ======================= Dashboard ======================= */
  V.dashboard = function () {
    var all = C.activeTasks(st());
    var open = all.filter(function (t) { return !C.isDone(t); });
    var weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
    var overdue = open.filter(function (t) { return C.isOverdue(t); });
    var blocked = open.filter(function (t) { return t.status === 'blocked'; });
    var stale = open.filter(C.isStale);
    var help = open.filter(function (t) { return C.openHelp(t).length; });
    var doneWeek = all.filter(function (t) { return C.isDone(t) && t.completedAt >= weekAgo; });
    var html = '<div class="wrap">';
    html += '<div class="stat-row" style="grid-template-columns:repeat(5,1fr)">' +
      '<div class="stat"><div class="num">' + open.length + '</div><div class="lbl">Open tasks</div></div>' +
      '<div class="stat ' + (overdue.length ? 'bad' : 'ok') + '"><div class="num">' + overdue.length + '</div><div class="lbl">Overdue</div></div>' +
      '<div class="stat ' + (blocked.length ? 'bad' : 'ok') + '"><div class="num">' + blocked.length + '</div><div class="lbl">Blocked</div></div>' +
      '<div class="stat ' + (stale.length ? 'warn' : 'ok') + '"><div class="num">' + stale.length + '</div><div class="lbl">No check-in in ' + C.STALE_DAYS + '+ days</div></div>' +
      '<div class="stat ok"><div class="num">' + doneWeek.length + '</div><div class="lbl">Completed this week</div></div></div>';
    html += '<div class="section-title">Teams</div><div class="grid-cards" style="margin-bottom:22px">';
    liveTeams().forEach(function (t) {
      var d = C.teamDigest(st(), t.id);
      var health = d.overdue.length >= 2 || d.blocked.length && d.overdue.length || d.atRisk.some(function (x) { return x.health === 'off'; }) ? 'off' : (d.overdue.length || d.stale.length || d.atRisk.length || d.blocked.length ? 'risk' : 'on');
      var h = App.healthOf(health);
      var leads = C.teamLeads(st(), t.id);
      var pct = d.total ? Math.round(100 * (d.total - d.open.length) / d.total) : 0;
      html += '<a class="card team-card" href="#/team/' + esc(t.id) + '" style="color:inherit;text-decoration:none">' +
        '<div class="tc-head"><span class="team-dot" style="background:' + esc(t.color) + ';width:14px;height:14px"></span><span class="tc-name">' + esc(t.name) + '</span><span style="flex:1"></span>' + App.healthPill(health) + '</div>' +
        '<div class="row" style="gap:8px">' + App.avatars(leads.map(function (p) { return p.id; }), 'sm') + '<span class="muted" style="font-size:12px">' + esc(leads.map(function (p) { return p.name.split(' ')[0]; }).join(', ') || 'No lead set') + '</span></div>' +
        '<div class="tc-stats">' +
        '<div class="tc-stat"><div class="n">' + d.open.length + '</div><div class="l">Open</div></div>' +
        '<div class="tc-stat ' + (d.overdue.length ? 'bad' : '') + '"><div class="n">' + d.overdue.length + '</div><div class="l">Overdue</div></div>' +
        '<div class="tc-stat ' + (d.blocked.length ? 'bad' : '') + '"><div class="n">' + d.blocked.length + '</div><div class="l">Blocked</div></div>' +
        '<div class="tc-stat ' + (d.stale.length ? 'warn' : '') + '"><div class="n">' + d.stale.length + '</div><div class="l">Need update</div></div></div>' +
        '<div><div class="row" style="justify-content:space-between;font-size:12px;color:var(--ink-3);margin-bottom:4px"><span>' + d.doneThisWeek.length + ' done this week</span><span>' + pct + '% of all tasks complete</span></div><div class="progress"><span style="width:' + pct + '%;background:' + h.color + '"></span></div></div>' +
        '</a>';
    });
    html += '</div>';

    // Needs attention table
    var attention = open.filter(function (t) { return C.isOverdue(t) || t.status === 'blocked' || C.isStale(t) || !t.owner || t.health === 'off' || C.openHelp(t).length; });
    attention.sort(function (a, b) {
      function score(t) { return (C.isOverdue(t) ? 4 : 0) + (t.status === 'blocked' ? 3 : 0) + (t.health === 'off' ? 2 : 0) + (C.isStale(t) ? 1 : 0); }
      return score(b) - score(a) || C.compareTasks(a, b);
    });
    html += '<div class="section-title">Needs attention <span class="muted">· overdue, blocked, off track, waiting on help, missing an owner, or no recent check-in</span></div>';
    if (!attention.length) {
      html += '<div class="card empty" style="margin-bottom:22px"><div class="big">✅</div><b>Everything is on track.</b></div>';
    } else {
      html += '<div class="card" style="overflow-x:auto;margin-bottom:22px"><table class="table"><thead><tr><th>Task</th><th>Team</th><th>Owner</th><th>Due</th><th>Last check-in</th><th></th></tr></thead><tbody>' +
        attention.map(function (t) {
          return '<tr class="click" data-act="openTask" data-id="' + esc(t.id) + '"><td><div style="font-weight:600">' + esc(t.title) + '</div><div class="row wrap-row" style="gap:4px;margin-top:3px">' + flags(t) + '</div></td><td>' + App.teamChip(t.team) + '</td><td><div class="row" style="gap:6px">' + App.avatar(t.owner, 'sm') + '<span style="font-size:13px">' + esc(t.owner ? App.pname(t.owner) : 'Unassigned') + '</span></div></td><td>' + (App.dueHtml(t) || '<span class="muted">-</span>') + '</td><td style="font-size:12px" class="muted">' + (t.lastCheckinAt ? App.relTime(t.lastCheckinAt) : 'never') + '</td><td style="text-align:right">' + (t.owner && t.owner !== App.S.meId ? '<button type="button" class="btn sm" data-act="nudge" data-id="' + esc(t.id) + '" title="Send ' + esc(App.firstName(t.owner)) + ' a friendly reminder">' + icon('bell', 12) + 'Nudge</button>' : (!t.owner ? '<button type="button" class="btn sm" data-act="takeTask" data-id="' + esc(t.id) + '">Take it</button>' : '')) + '</td></tr>';
        }).join('') + '</tbody></table></div>';
    }

    // help requests
    var helpRows = [];
    open.forEach(function (t) { C.openHelp(t).forEach(function (h) { helpRows.push({ t: t, h: h }); }); });
    if (helpRows.length) {
      helpRows.sort(function (a, b) { return a.h.at < b.h.at ? -1 : 1; });
      html += '<div class="section-title">Open help requests <span class="muted">· oldest first</span></div><div class="card" style="overflow-x:auto;margin-bottom:22px"><table class="table"><thead><tr><th>Who</th><th>Task</th><th>Request</th><th>Waiting</th></tr></thead><tbody>' +
        helpRows.map(function (r) {
          return '<tr class="click" data-act="openTask" data-id="' + esc(r.t.id) + '"><td style="white-space:nowrap">' + App.avatar(r.h.from, 'sm') + ' → ' + App.avatar(r.h.to, 'sm') + ' <span style="font-size:13px">' + esc(App.firstName(r.h.from)) + ' → ' + esc(App.firstName(r.h.to)) + '</span></td><td style="font-weight:600;font-size:13px">' + esc(r.t.title) + '</td><td style="font-size:13px;color:var(--ink-2)">' + esc(r.h.message || '') + '</td><td class="muted" style="font-size:12px;white-space:nowrap">' + App.relTime(r.h.at) + '</td></tr>';
        }).join('') + '</tbody></table></div>';
    }

    // workload
    html += '<div class="section-title">Workload <span class="muted">· open tasks each person owns</span></div>';
    html += '<div class="card" style="overflow-x:auto"><table class="table"><thead><tr><th>Person</th><th>Team</th><th>Open</th><th>Overdue</th><th>Due ≤7d</th><th>Open steps</th><th>Last check-in</th><th style="min-width:140px">Load</th></tr></thead><tbody>';
    var people = C.activePeople(st()).slice().sort(function (a, b) { return (a.teams[0] || '').localeCompare(b.teams[0] || '') || a.name.localeCompare(b.name); });
    var maxOpen = 1;
    var rows = people.map(function (p) {
      var owned = open.filter(function (t) { return t.owner === p.id; });
      var od = owned.filter(function (t) { return C.isOverdue(t); }).length;
      var wk = owned.filter(function (t) { return t.dueDate && !C.isOverdue(t) && C.daysBetween(C.todayKey(), t.dueDate) <= 7; }).length;
      var steps = 0;
      open.forEach(function (t) { (t.steps || []).forEach(function (s) { if (s.assignee === p.id && !s.done) steps++; }); });
      var last = null;
      all.forEach(function (t) { (t.feed || []).forEach(function (e) { if (e.kind === 'checkin' && e.by === p.id && (!last || e.at > last)) last = e.at; }); });
      maxOpen = Math.max(maxOpen, owned.length);
      return { p: p, owned: owned.length, od: od, wk: wk, steps: steps, last: last };
    });
    rows.forEach(function (r) {
      var w = function (n) { return (100 * n / maxOpen) + '%'; };
      html += '<tr class="click" data-act="go" data-href="#/person/' + esc(r.p.id) + '"><td><div class="row" style="gap:8px">' + App.avatar(r.p.id, 'sm') + '<span style="font-weight:600;font-size:13px">' + esc(r.p.name) + '</span></div></td><td>' + r.p.teams.map(App.teamChip).join(' ') + '</td><td>' + r.owned + '</td><td style="' + (r.od ? 'color:var(--bad);font-weight:700' : '') + '">' + r.od + '</td><td>' + r.wk + '</td><td>' + r.steps + '</td><td class="muted" style="font-size:12px">' + (r.last ? App.relTime(r.last) : '-') + '</td><td><div class="load-bar"><span style="width:' + w(r.od) + ';background:var(--bad)"></span><span style="width:' + w(r.wk) + ';background:var(--warn)"></span><span style="width:' + w(r.owned - r.od - r.wk) + ';background:#94a3b8"></span></div></td></tr>';
    });
    html += '</tbody></table></div></div>';
    return { title: 'Dashboard', sub: 'Accountability across every team', content: html };
  };

  /* ======================= task pages (team / project / all / person) ======================= */
  function scopeInfo(r) {
    var m = me();
    if (r.path === 'team') {
      var t = C.team(st(), r.id);
      if (!t) return null;
      return { key: 'team:' + t.id, title: '<span class="team-dot" style="background:' + esc(t.color) + ';width:14px;height:14px"></span>' + esc(t.name), sub: t.description, filter: function (x) { return x.team === t.id; }, defaults: { team: t.id, owner: C.has(m.teams, t.id) ? m.id : null }, defaultGroup: 'status', team: t, tabs: ['overview', 'list', 'board', 'timeline'], defaultView: 'list' };
    }
    if (r.path === 'project') {
      var p = C.byId(st().projects, r.id);
      if (!p || p.deleted) return null;
      var tm = C.team(st(), p.team);
      return { key: 'project:' + p.id, title: icon('target', 18) + esc(p.name), sub: (tm ? tm.name + ' project' : 'Project') + (p.dueDate ? ' · due ' + App.fmtDate(p.dueDate, { absolute: true }) : '') + (p.description ? ' · ' + p.description : ''), filter: function (x) { return x.project === p.id; }, defaults: { team: p.team, project: p.id, owner: C.has(m.teams, p.team) ? m.id : null }, defaultGroup: 'status', project: p, tabs: ['list', 'board', 'timeline'], defaultView: 'list' };
    }
    if (r.path === 'all') {
      return { key: 'all', title: 'All tasks', sub: 'Every team, every task', filter: function () { return true; }, defaults: { team: App.myTeam(), owner: m.id }, defaultGroup: 'team', tabs: ['list', 'board', 'timeline'], defaultView: 'list' };
    }
    if (r.path === 'person') {
      var pp = C.person(st(), r.id);
      if (!pp) return null;
      return { key: 'person:' + pp.id, person: pp, title: App.avatar(pp.id) + esc(pp.name), sub: [pp.title, App.roleLabel(pp.role)].filter(Boolean).join(' · '), filter: function (x) { return C.involves(x, pp.id) || (C.isDone(x) && x.owner === pp.id); }, defaults: { owner: pp.id, team: pp.teams[0] || App.myTeam() }, defaultGroup: 'due', tabs: ['list', 'board', 'timeline'], defaultView: 'list' };
    }
    return null;
  }

  function getFilters(key, defGroup) {
    var f = App.S.ui.filters[key];
    if (!f) f = App.S.ui.filters[key] = { owner: null, status: 'open', attention: false, group: App.prefs.get('group:' + key, defGroup), q: '' };
    return f;
  }
  function applyFilters(tasks, f) {
    var q = (f.q || '').toLowerCase();
    return tasks.filter(function (t) {
      if (f.status === 'open' && C.isDone(t)) return false;
      if (f.status === 'done' && !C.isDone(t)) return false;
      if (f.owner === 'me' && !C.involves(t, App.S.meId) && t.owner !== App.S.meId) return false;
      if (f.owner === 'none' && t.owner) return false;
      if (f.attention && !(C.isOverdue(t) || t.status === 'blocked' || C.isStale(t) || !t.owner || C.openHelp(t).length)) return false;
      if (q && (t.title + ' ' + (t.description || '')).toLowerCase().indexOf(q) === -1) return false;
      return true;
    });
  }

  V.taskPage = function () {
    var r = App.S.route;
    var sc = scopeInfo(r);
    if (!sc) return { title: 'Not found', content: '<div class="card empty"><b>That page doesn’t exist anymore.</b><div><a href="#/home">Go to My work</a></div></div>' };
    var view = App.prefs.get('view:' + sc.key, sc.defaultView);
    if (sc.tabs.indexOf(view) === -1) view = sc.defaultView;
    var f = getFilters(sc.key, sc.defaultGroup);
    var all = C.activeTasks(st()).filter(sc.filter);
    var tasks = applyFilters(all, view === 'board' ? Object.assign({}, f, { status: f.status === 'open' ? 'all' : f.status }) : f);
    var labels = { overview: ['Overview', 'home'], list: ['List', 'list'], board: ['Board', 'board'], timeline: ['Timeline', 'timeline'] };
    var tabs = sc.tabs.map(function (v) {
      return '<button type="button" class="tab' + (v === view ? ' active' : '') + '" data-act="setView" data-key="' + esc(sc.key) + '" data-view="' + v + '">' + icon(labels[v][1], 14) + labels[v][0] + '</button>';
    }).join('');
    var actions = '';
    if (sc.project && C.canEditProject(st(), App.S.meId, sc.project)) actions += '<button type="button" class="btn ghost" data-act="editProject" data-id="' + esc(sc.project.id) + '">' + icon('edit', 14) + 'Edit project</button>';
    var res = { title: sc.title, sub: sc.sub, tabs: tabs, actions: actions };
    if (view === 'overview') { res.content = teamOverview(sc.team); return res; }
    var filterBar = '<div class="filters">' +
      '<input class="input" style="max-width:220px;padding:5px 10px;font-size:13px" placeholder="Filter tasks…" data-fk="filter-' + esc(sc.key) + '" data-input="filterQ" data-key="' + esc(sc.key) + '" value="' + esc(f.q) + '">' +
      (sc.person ? '' : fbtn('owner', 'me', 'Mine', f.owner === 'me', sc.key) + fbtn('owner', 'none', 'No owner', f.owner === 'none', sc.key)) +
      fbtn('attention', 'on', '⚑ Needs attention', f.attention, sc.key) +
      (view !== 'board' ? '<span class="seg">' + ['open', 'done', 'all'].map(function (s) { return '<button type="button" class="' + (f.status === s ? 'on' : '') + '" data-act="setFilter" data-key="' + esc(sc.key) + '" data-f="status" data-v="' + s + '">' + { open: 'Open', done: 'Done', all: 'All' }[s] + '</button>'; }).join('') + '</span>' : '') +
      (view === 'list' ? '<span style="flex:1"></span><label class="muted" style="font-size:12px">Group by <select class="select" style="width:auto;padding:4px 8px;font-size:12px;display:inline-block" data-change="setGroup" data-key="' + esc(sc.key) + '">' + ['status', 'due', 'owner', 'project', 'team', 'none'].map(function (g) { return '<option value="' + g + '"' + (f.group === g ? ' selected' : '') + '>' + { status: 'Status', due: 'Due date', owner: 'Owner', project: 'Project', team: 'Team', none: 'Nothing' }[g] + '</option>'; }).join('') + '</select></label>' : '') +
      '</div>';
    if (view === 'list') {
      res.content = '<div class="wrap">' + filterBar + groupedList(tasks, f.group, sc.key, sc.defaults, { showTeam: !sc.team && !sc.project, showProject: !sc.project }) + '</div>';
    } else if (view === 'board') {
      res.flush = true;
      res.content = '<div style="padding:16px 24px 0">' + filterBar + '</div>' + V.board(tasks, sc);
    } else {
      res.flush = true;
      res.content = V.timeline(tasks, sc);
    }
    return res;
  };
  function fbtn(f, v, label, on, key) {
    return '<button type="button" class="filter-btn' + (on ? ' on' : '') + '" data-act="setFilter" data-key="' + esc(key) + '" data-f="' + f + '" data-v="' + v + '">' + label + '</button>';
  }

  /* ---------- board ---------- */
  V.board = function (tasks, sc) {
    var html = '<div class="board" data-scroll-key="board">';
    C.STATUSES.forEach(function (s) {
      var list = tasks.filter(function (t) { return t.status === s.id; }).sort(C.compareTasks);
      if (s.id === 'done') list = list.slice().sort(function (a, b) { return (b.completedAt || '') < (a.completedAt || '') ? -1 : 1; });
      html += '<div class="col" data-drop-status="' + s.id + '"><div class="col-head"><span class="dot" style="width:9px;height:9px;border-radius:50%;background:' + s.color + '"></span>' + s.label + ' <span class="count">' + list.length + '</span></div>';
      list.slice(0, s.id === 'done' ? 30 : 200).forEach(function (t) {
        var fl = V.flags(t);
        html += '<div class="bcard" draggable="true" data-drag-task="' + esc(t.id) + '" data-act="openTask" data-id="' + esc(t.id) + '">' +
          (fl ? '<div class="flags">' + fl + '</div>' : '') +
          '<div class="title">' + esc(t.title) + '</div>' +
          '<div class="foot">' + (!sc.team && !sc.project ? App.teamChip(t.team) : App.projectChip(t.project)) + App.dueHtml(t) + V.miniProgress(t) + App.avatar(t.owner, 'sm') + '</div></div>';
      });
      html += '<button type="button" class="col-add" data-act="newTask" data-status="' + s.id + '" data-defaults="' + esc(JSON.stringify(sc.defaults)) + '">' + icon('plus', 13) + ' Add task</button></div>';
    });
    return html + '</div>';
  };

  /* ---------- timeline ---------- */
  V.timeline = function (tasks, sc) {
    var zoom = App.prefs.get('tlZoom', 'week');
    var dw = { day: 38, week: 18, month: 6 }[zoom] || 18;
    var today = C.todayKey();
    var start = C.addDays(today, -14), end = C.addDays(today, 56);
    tasks.forEach(function (t) {
      var s = t.startDate || t.dueDate, e = t.dueDate || t.startDate;
      if (s && s < start) start = s;
      if (e && e > end) end = e;
    });
    if (C.daysBetween(start, today) > 120) start = C.addDays(today, -120);
    if (C.daysBetween(today, end) > 365) end = C.addDays(today, 365);
    start = C.addDays(start, -3); end = C.addDays(end, 7);
    // start on a Monday
    var sd = C.parseDateKey(start); start = C.addDays(start, -((sd.getDay() + 6) % 7));
    var nDays = C.daysBetween(start, end) + 1;
    var width = nDays * dw;
    App.S.tl = { start: start, dw: dw };

    var groupBy = sc.project ? 'none' : (sc.team ? 'project' : (sc.person ? 'team' : 'team'));
    var groups = groupTasks(tasks, groupBy);
    var scheduled = [], unscheduled = [];
    var html = '<div style="display:flex;flex-direction:column;height:100%">';
    html += '<div class="tl-toolbar"><span class="seg">' + ['day', 'week', 'month'].map(function (z) { return '<button type="button" class="' + (zoom === z ? 'on' : '') + '" data-act="tlZoom" data-v="' + z + '">' + { day: 'Days', week: 'Weeks', month: 'Months' }[z] + '</button>'; }).join('') + '</span>' +
      '<button type="button" class="btn sm" data-act="tlToday">Today</button><span class="hint">Drag a bar to move it, drag its right edge to change the due date. Diamonds are tasks with only a due date.</span></div>';
    html += '<div class="timeline" data-scroll-key="timeline" id="timeline-scroll"><div class="tl-grid" style="width:' + (width + 260) + 'px">';
    // header
    var months = '', daysHtml = '';
    for (var i = 0; i < nDays; i++) {
      var k = C.addDays(start, i), d = C.parseDateKey(k);
      if (d.getDate() === 1 || i === 0) {
        var daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate() - d.getDate() + 1;
        months += '<div class="tl-month" style="position:absolute;left:' + (i * dw) + 'px;width:' + (Math.min(daysInMonth, nDays - i) * dw) + 'px;border-left:1px solid var(--line)">' + App.MON[d.getMonth()] + ' ' + d.getFullYear() + '</div>';
      }
      var lbl = zoom === 'day' ? (App.DOW[d.getDay()].charAt(0) + ' ' + d.getDate()) : zoom === 'week' ? (d.getDay() === 1 ? d.getDate() : '') : '';
      daysHtml += '<div class="tl-day' + ((d.getDay() === 0 || d.getDay() === 6) && zoom !== 'month' ? ' weekend' : '') + (k === today ? ' today' : '') + '" style="width:' + dw + 'px' + (zoom === 'month' ? ';border-left:' + (d.getDay() === 1 ? '1px solid var(--line-2)' : '0') : '') + '">' + lbl + '</div>';
    }
    html += '<div class="tl-head"><div class="tl-label-col" style="display:flex;align-items:flex-end;padding:6px 12px;font-size:12px;font-weight:700;color:var(--ink-3)">Task</div><div><div style="position:relative;height:22px;width:' + width + 'px">' + months + '</div><div class="tl-days">' + daysHtml + '</div></div></div>';
    // background weekends + today line
    var todayLeft = C.daysBetween(start, today) * dw + 260 + dw / 2;
    html += '<div class="tl-today" style="left:' + todayLeft + 'px"></div>';
    groups.forEach(function (g) {
      var rows = '';
      g.tasks.forEach(function (t) {
        if (!t.dueDate && !t.startDate) { unscheduled.push(t); return; }
        scheduled.push(t);
        rows += tlRow(t, start, dw, width);
      });
      if (rows) {
        if (groupBy !== 'none') html += '<div class="tl-row tl-group"><div class="tl-label-col"><span class="team-dot" style="background:' + esc(g.color) + '"></span>' + esc(g.label) + '</div><div class="tl-track" style="width:' + width + 'px"></div></div>';
        html += rows;
      }
    });
    if (unscheduled.length) {
      html += '<div class="tl-row tl-group"><div class="tl-label-col">No dates yet (' + unscheduled.length + ')</div><div class="tl-track" style="width:' + width + 'px;font-size:12px;color:var(--ink-3);padding:10px">Open a task and give it a due date to place it on the timeline.</div></div>';
      unscheduled.sort(C.compareTasks).forEach(function (t) {
        html += '<div class="tl-row"><div class="tl-label-col" data-act="openTask" data-id="' + esc(t.id) + '">' + App.avatar(t.owner, 'sm') + '<span class="t">' + esc(t.title) + '</span></div><div class="tl-track" style="width:' + width + 'px"></div></div>';
      });
    }
    if (!scheduled.length && !unscheduled.length) {
      html += '<div class="empty" style="position:sticky;left:0;width:min(100vw,700px)"><div class="big">🗓️</div><b>No tasks to show.</b></div>';
    }
    html += '</div></div></div>';
    return html;
  };
  function tlRow(t, start, dw, width) {
    var due = t.dueDate || t.startDate;
    var s = t.startDate && t.startDate <= due ? t.startDate : null;
    var color = App.statusOf(t.status).color;
    var bar;
    if (s) {
      var left = C.daysBetween(start, s) * dw;
      var w = Math.max(dw, (C.daysBetween(s, due) + 1) * dw);
      bar = '<div class="tl-bar' + (C.isDone(t) ? ' done' : '') + (C.isOverdue(t) ? ' overdue' : '') + '" data-tl-task="' + esc(t.id) + '" style="left:' + left + 'px;width:' + w + 'px;background:' + color + '" title="' + esc(t.title + ' · ' + App.fmtDate(s, { absolute: true }) + ' → ' + App.fmtDate(due, { absolute: true })) + '"><span class="handle l" data-tl-handle="l"></span>' + (w > 60 ? esc(t.title) : '') + '<span class="handle" data-tl-handle="r"></span></div>';
    } else {
      var l2 = C.daysBetween(start, due) * dw + dw / 2 - 7;
      bar = '<div class="tl-milestone" data-tl-task="' + esc(t.id) + '" data-tl-mile="1" style="left:' + l2 + 'px;background:' + color + (C.isOverdue(t) ? ';box-shadow:0 0 0 2px var(--bad)' : '') + '" title="' + esc(t.title + ' · due ' + App.fmtDate(due, { absolute: true })) + '"></div>' +
        '<div style="position:absolute;left:' + (l2 + 20) + 'px;top:11px;font-size:11.5px;color:var(--ink-2);white-space:nowrap;pointer-events:none">' + esc(t.title) + '</div>';
    }
    return '<div class="tl-row"><div class="tl-label-col" data-act="openTask" data-id="' + esc(t.id) + '">' + App.avatar(t.owner, 'sm') + '<span class="t">' + esc(t.title) + '</span></div><div class="tl-track" style="width:' + width + 'px">' + bar + '</div></div>';
  }

  /* ---------- team overview ---------- */
  function teamOverview(t) {
    var d = C.teamDigest(st(), t.id);
    var members = C.teamMembers(st(), t.id).sort(function (a, b) { return (a.role === 'lead' ? -1 : 0) - (b.role === 'lead' ? -1 : 0) || a.name.localeCompare(b.name); });
    var html = '<div class="wrap"><div class="home-grid"><div class="stack">';
    html += '<div class="card card-pad"><h3>About</h3><div class="md" style="color:var(--ink-2);line-height:1.55">' + App.md(t.description || 'No description yet.') + '</div>' +
      '<div class="row wrap-row" style="margin-top:12px;gap:8px">' +
      (t.slackChannel ? '<span class="chip">' + icon('zap', 11) + 'Slack: ' + esc(t.slackChannel) + '</span>' : '') +
      (t.driveFolderUrl ? '<a class="btn sm" href="' + esc(App.safeUrl(t.driveFolderUrl)) + '" target="_blank" rel="noopener">' + icon('folder', 13) + 'Team Drive folder</a>' : '') +
      (C.isExec(me()) ? '<button type="button" class="btn sm ghost" data-act="editTeam" data-id="' + esc(t.id) + '">' + icon('edit', 13) + 'Edit team</button>' : '') + '</div></div>';
    html += '<div class="stat-row">' +
      '<div class="stat"><div class="num">' + d.open.length + '</div><div class="lbl">Open</div></div>' +
      '<div class="stat ' + (d.overdue.length ? 'bad' : 'ok') + '"><div class="num">' + d.overdue.length + '</div><div class="lbl">Overdue</div></div>' +
      '<div class="stat ' + (d.blocked.length ? 'bad' : 'ok') + '"><div class="num">' + d.blocked.length + '</div><div class="lbl">Blocked</div></div>' +
      '<div class="stat ok"><div class="num">' + d.doneThisWeek.length + '</div><div class="lbl">Done this week</div></div></div>';
    // projects
    var projects = liveProjects(t.id);
    var canProj = C.isExec(me()) || C.has(me().teams, t.id);
    html += '<div class="card card-pad"><h3>' + icon('target', 15) + 'Projects<span style="flex:1"></span>' + (canProj ? '<button type="button" class="btn sm" data-act="editProject" data-team="' + esc(t.id) + '">' + icon('plus', 12) + 'New project</button>' : '') + '</h3>';
    if (!projects.length) html += '<div class="muted" style="font-size:13px">Projects group related tasks (e.g. “Winter Speaker Series”). None yet.</div>';
    projects.forEach(function (p) {
      var pt = C.activeTasks(st()).filter(function (x) { return x.project === p.id; });
      var done = pt.filter(C.isDone).length;
      var pct = pt.length ? Math.round(100 * done / pt.length) : 0;
      var od = pt.filter(function (x) { return C.isOverdue(x); }).length;
      html += '<a href="#/project/' + esc(p.id) + '" class="attention-item" style="color:inherit;text-decoration:none"><span class="team-dot" style="background:' + esc(p.color || t.color) + ';margin-top:4px"></span><div style="flex:1;min-width:0"><div class="ai-title">' + esc(p.name) + '</div><div class="ai-sub">' + done + '/' + pt.length + ' done' + (od ? ' · <span style="color:var(--bad)">' + od + ' overdue</span>' : '') + (p.dueDate ? ' · due ' + App.fmtDate(p.dueDate, { absolute: true }) : '') + '</div><div class="progress" style="margin-top:6px"><span style="width:' + pct + '%"></span></div></div></a>';
    });
    html += '</div>';
    // needs attention list
    var att = d.open.filter(function (x) { return C.isOverdue(x) || x.status === 'blocked' || C.isStale(x) || !x.owner || C.openHelp(x).length; }).sort(C.compareTasks);
    html += '<div><div class="section-title">Needs attention</div>' + (att.length ? '<div class="task-list">' + att.map(function (x) { return taskRow(x, { showTeam: false }); }).join('') + '</div>' : '<div class="card empty" style="padding:20px"><b>Nothing overdue, blocked or stale.</b></div>') + '</div>';
    html += '</div><div class="stack">';
    html += '<div class="card card-pad"><h3>' + icon('people', 15) + 'People</h3>' + (members.length ? members.map(function (p) {
      var owned = d.open.filter(function (x) { return x.owner === p.id; });
      var od = owned.filter(function (x) { return C.isOverdue(x); }).length;
      return '<a href="#/person/' + esc(p.id) + '" class="attention-item" style="color:inherit;text-decoration:none;align-items:center">' + App.avatar(p.id) + '<div style="flex:1;min-width:0"><div class="ai-title">' + esc(p.name) + (p.role === 'lead' ? ' <span class="chip" style="font-size:10.5px">Lead</span>' : '') + '</div><div class="ai-sub muted">' + esc(p.title || App.roleLabel(p.role)) + '</div></div><span style="font-size:12px" class="muted">' + owned.length + ' open' + (od ? ' · <b style="color:var(--bad)">' + od + ' late</b>' : '') + '</span></a>';
    }).join('') : '<div class="muted" style="font-size:13px">Nobody on this team yet. Add people in Settings.</div>') + '</div>';
    var docs = st().resources.filter(function (r) { return !r.deleted && r.team === t.id; });
    html += '<div class="card card-pad"><h3>' + icon('docs', 15) + 'Team docs<span style="flex:1"></span><button type="button" class="btn sm" data-act="editResource" data-team="' + esc(t.id) + '">' + icon('plus', 12) + 'Add</button></h3>' + (docs.length ? docs.map(resourceRow).join('') : '<div class="muted" style="font-size:13px">Pin handbooks, budgets and recurring docs here so nobody has to ask “where’s the link?”</div>') + '</div>';
    var tpls = st().templates.filter(function (x) { return !x.deleted && (x.team === t.id || !x.team); });
    html += '<div class="card card-pad"><h3>' + icon('checklist', 15) + 'Checklists</h3>' + (tpls.length ? tpls.map(function (x) { return '<div class="attention-item" data-act="useTemplate" data-id="' + esc(x.id) + '"><span style="color:var(--ink-3)">' + icon('checklist', 15) + '</span><div style="flex:1"><div class="ai-title">' + esc(x.name) + '</div><div class="ai-sub muted">' + (x.steps || []).length + ' steps · click to start a task from it</div></div></div>'; }).join('') : '<div class="muted" style="font-size:13px">No checklists yet.</div>') + '</div>';
    html += '</div></div></div>';
    return html;
  }

  function resourceRow(r) {
    var canEdit = C.canEditShared(st(), App.S.meId, r);
    return '<div class="link-row" style="margin-bottom:6px">' + App.kindIcon(r.kind) + '<div class="lk"><a href="' + esc(App.safeUrl(r.url)) + '" target="_blank" rel="noopener">' + (r.pinned ? '📌 ' : '') + esc(r.title) + '</a><div class="u">' + esc(r.note || r.url) + '</div></div>' + (canEdit ? '<button type="button" class="icon-btn" data-act="editResource" data-id="' + esc(r.id) + '" aria-label="Edit">' + icon('edit', 14) + '</button>' : '') + '</div>';
  }

  /* ======================= People ======================= */
  V.people = function () {
    var html = '<div class="wrap">';
    var canAdd = C.canManagePeople(st(), App.S.meId);
    var shown = {};
    liveTeams().forEach(function (t) {
      var members = C.teamMembers(st(), t.id).sort(function (a, b) { var r = { exec: 0, lead: 1, member: 2 }; return r[a.role] - r[b.role] || a.name.localeCompare(b.name); });
      html += '<div class="section-title" style="margin-top:8px"><span class="team-dot" style="background:' + esc(t.color) + '"></span>' + esc(t.name) + ' <span class="muted">· ' + members.length + '</span></div><div class="grid-cards" style="margin-bottom:18px">';
      members.forEach(function (p) { shown[p.id] = 1; html += personCard(p); });
      if (!members.length) html += '<div class="muted" style="font-size:13px">Nobody yet.</div>';
      html += '</div>';
    });
    var noTeam = C.activePeople(st()).filter(function (p) { return !shown[p.id]; });
    if (noTeam.length) html += '<div class="section-title">No team</div><div class="grid-cards">' + noTeam.map(personCard).join('') + '</div>';
    html += '</div>';
    return { title: 'People', sub: C.activePeople(st()).length + ' on the roster', actions: canAdd ? '<button type="button" class="btn" data-act="importRoster">' + icon('upload', 14) + 'Import roster</button><button type="button" class="btn primary" data-act="editPerson">' + icon('plus', 14) + 'Add person</button>' : '', content: html };
  };
  function personCard(p) {
    var open = C.activeTasks(st()).filter(function (t) { return !C.isDone(t) && t.owner === p.id; });
    var od = open.filter(function (t) { return C.isOverdue(t); }).length;
    return '<a class="card person-card" href="#/person/' + esc(p.id) + '" style="color:inherit;text-decoration:none">' + App.avatar(p.id, 'lg') + '<div style="min-width:0;flex:1"><div class="pn">' + esc(p.name) + (p.sample ? ' <span class="chip" style="font-size:10px">sample</span>' : '') + '</div><div class="pt">' + esc(p.title || '') + (p.title ? ' · ' : '') + esc(App.roleLabel(p.role)) + '</div><div class="pt" style="margin-top:4px">' + open.length + ' open' + (od ? ' · <b style="color:var(--bad)">' + od + ' overdue</b>' : '') + '</div></div></a>';
  }
  V.personHeaderActions = function (p) {
    var out = '';
    if (C.canEditPerson(st(), App.S.meId, p, {})) out += '<button type="button" class="btn ghost" data-act="editPerson" data-id="' + esc(p.id) + '">' + icon('edit', 14) + 'Edit</button>';
    return out;
  };

  /* ======================= Docs & checklists ======================= */
  V.docs = function () {
    var tab = App.prefs.get('docsTab', 'shared');
    var teamF = App.S.ui.docsTeam || '';
    var q = (App.S.ui.docsQ || '').toLowerCase();
    var tabs = [['shared', 'Shared docs', 'pin'], ['files', 'Files in tasks', 'link'], ['checklists', 'Checklists', 'checklist']].map(function (x) {
      return '<button type="button" class="tab' + (tab === x[0] ? ' active' : '') + '" data-act="docsTab" data-v="' + x[0] + '">' + icon(x[2], 14) + x[1] + '</button>';
    }).join('');
    var bar = '<div class="filters"><input class="input" style="max-width:240px;padding:5px 10px;font-size:13px" placeholder="Search…" data-fk="docs-q" data-input="docsQ" value="' + esc(App.S.ui.docsQ || '') + '">' +
      '<button type="button" class="filter-btn' + (!teamF ? ' on' : '') + '" data-act="docsTeam" data-v="">All teams</button>' +
      liveTeams().map(function (t) { return '<button type="button" class="filter-btn' + (teamF === t.id ? ' on' : '') + '" data-act="docsTeam" data-v="' + esc(t.id) + '"><span class="team-dot" style="background:' + esc(t.color) + '"></span>' + esc(t.name) + '</button>'; }).join('') + '</div>';
    var html = '<div class="wrap">' + bar;
    var actions = '';
    if (tab === 'shared') {
      actions = '<button type="button" class="btn" data-act="editResource">' + icon('plus', 14) + 'Add doc or link</button>';
      var res = st().resources.filter(function (r) { return !r.deleted && (!teamF || r.team === teamF || !r.team) && (!q || (r.title + ' ' + (r.note || '') + ' ' + (r.category || '')).toLowerCase().indexOf(q) !== -1); });
      res.sort(function (a, b) { return (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || a.title.localeCompare(b.title); });
      var cats = {};
      res.forEach(function (r) { var c = r.category || 'General'; (cats[c] = cats[c] || []).push(r); });
      html += '<p class="muted" style="margin:0 0 14px;font-size:13px">One place for the links everyone keeps asking for: handbooks, budgets, brand kits, curricula, room-booking how-tos. ' + (App.S.integrations.driveRootUrl ? '<a href="' + esc(App.safeUrl(App.S.integrations.driveRootUrl)) + '" target="_blank" rel="noopener">Open the shared tracker Drive folder →</a>' : '') + '</p>';
      var teamFolders = liveTeams().filter(function (t) { return t.driveFolderUrl && (!teamF || teamF === t.id); });
      if (teamFolders.length) html += '<div class="section-title">Team Drive folders</div><div class="grid-cards" style="margin-bottom:18px">' + teamFolders.map(function (t) { return '<a class="card doc-card" href="' + esc(App.safeUrl(t.driveFolderUrl)) + '" target="_blank" rel="noopener" style="text-decoration:none">' + App.kindIcon('folder') + '<div><div class="dt">' + esc(t.name) + ' folder</div><div class="dn">Google Drive</div></div></a>'; }).join('') + '</div>';
      if (!res.length) html += '<div class="card empty"><div class="big">📎</div><b>No shared docs yet.</b><div>Add the links your team uses every week.</div></div>';
      Object.keys(cats).sort().forEach(function (c) {
        html += '<div class="section-title">' + esc(c) + '</div><div class="grid-cards" style="margin-bottom:18px">' + cats[c].map(function (r) {
          var canEdit = C.canEditShared(st(), App.S.meId, r);
          return '<div class="card doc-card">' + App.kindIcon(r.kind) + '<div style="flex:1;min-width:0"><a class="dt" href="' + esc(App.safeUrl(r.url)) + '" target="_blank" rel="noopener">' + (r.pinned ? '📌 ' : '') + esc(r.title) + '</a><div class="dn">' + esc(r.note || '') + '</div><div class="row" style="gap:6px;margin-top:6px">' + (r.team ? App.teamChip(r.team) : '<span class="chip">Everyone</span>') + '</div></div>' + (canEdit ? '<button type="button" class="icon-btn" data-act="editResource" data-id="' + esc(r.id) + '" aria-label="Edit">' + icon('edit', 14) + '</button>' : '') + '</div>';
        }).join('') + '</div>';
      });
    } else if (tab === 'files') {
      var rows = [];
      C.activeTasks(st()).forEach(function (t) {
        if (teamF && t.team !== teamF) return;
        (t.links || []).forEach(function (l) {
          if (q && (l.title + ' ' + t.title + ' ' + l.url).toLowerCase().indexOf(q) === -1) return;
          rows.push({ t: t, l: l });
        });
      });
      rows.sort(function (a, b) { return (b.l.at || '') < (a.l.at || '') ? -1 : 1; });
      html += '<p class="muted" style="margin:0 0 14px;font-size:13px">Every doc, sheet, folder and link attached to any task, newest first.</p>';
      if (!rows.length) html += '<div class="card empty"><div class="big">🔗</div><b>No files attached to tasks yet.</b></div>';
      else html += '<div class="card" style="overflow-x:auto"><table class="table"><thead><tr><th>File</th><th>Task</th><th>Team</th><th>Added</th></tr></thead><tbody>' + rows.map(function (r) {
        return '<tr><td><div class="row" style="gap:10px">' + App.kindIcon(r.l.kind) + '<a href="' + esc(App.safeUrl(r.l.url)) + '" target="_blank" rel="noopener" style="font-weight:600">' + esc(r.l.title) + '</a></div></td><td><a href="#" data-act="openTask" data-id="' + esc(r.t.id) + '" style="color:var(--ink-2)">' + esc(r.t.title) + '</a></td><td>' + App.teamChip(r.t.team) + '</td><td class="muted" style="font-size:12px;white-space:nowrap">' + esc(App.firstName(r.l.addedBy)) + ' · ' + App.relTime(r.l.at) + '</td></tr>';
      }).join('') + '</tbody></table></div>';
    } else {
      actions = '<button type="button" class="btn" data-act="editTemplate">' + icon('plus', 14) + 'New checklist</button>';
      var tpls = st().templates.filter(function (x) { return !x.deleted && (!teamF || x.team === teamF || !x.team) && (!q || (x.name + ' ' + (x.description || '')).toLowerCase().indexOf(q) !== -1); });
      html += '<p class="muted" style="margin:0 0 14px;font-size:13px">Reusable checklists for things we do again and again. Start a task from one, or add one to an existing task with <b>Add checklist</b>. Step due dates are counted from the task’s due date.</p>';
      if (!tpls.length) html += '<div class="card empty"><div class="big">📋</div><b>No checklists yet.</b></div>';
      html += '<div class="grid-cards">' + tpls.map(function (x) {
        var steps = x.steps || [];
        var canEdit = C.canEditShared(st(), App.S.meId, x);
        return '<div class="card tpl-card"><div class="row" style="gap:8px"><b style="font-size:15px">' + esc(x.name) + '</b><span style="flex:1"></span>' + (x.team ? App.teamChip(x.team) : '<span class="chip">All teams</span>') + '</div>' + (x.description ? '<div class="muted" style="font-size:13px">' + esc(x.description) + '</div>' : '') +
          '<ol>' + steps.slice(0, 6).map(function (s) { return '<li>' + esc(s.text) + (typeof s.offsetDays === 'number' ? ' <span class="muted" style="font-size:11px">(' + (s.offsetDays === 0 ? 'on due date' : (s.offsetDays < 0 ? -s.offsetDays + 'd before' : s.offsetDays + 'd after')) + ')</span>' : '') + '</li>'; }).join('') + '</ol>' + (steps.length > 6 ? '<div class="muted" style="font-size:12px;padding-left:20px">+ ' + (steps.length - 6) + ' more</div>' : '') +
          '<div class="row" style="margin-top:auto;padding-top:6px"><button type="button" class="btn sm primary" data-act="useTemplate" data-id="' + esc(x.id) + '">Start a task from this</button>' + (canEdit ? '<button type="button" class="btn sm ghost" data-act="editTemplate" data-id="' + esc(x.id) + '">' + icon('edit', 12) + 'Edit</button>' : '') + '</div></div>';
      }).join('') + '</div>';
    }
    html += '</div>';
    return { title: 'Docs & checklists', tabs: tabs, actions: actions, content: html };
  };

  /* ======================= Settings ======================= */
  V.settings = function () {
    var m = me(), isExec = C.isExec(m), canPeople = C.canManagePeople(st(), m.id);
    var I = App.S.integrations;
    var html = '<div class="wrap" style="max-width:980px"><div class="stack">';
    // profile
    html += '<div class="card card-pad"><h3>' + icon('user', 15) + 'Your profile</h3><div class="row" style="gap:14px;align-items:flex-start">' + App.avatar(m.id, 'xl') + '<div style="flex:1"><div style="font-weight:700;font-size:16px">' + esc(m.name) + '</div><div class="muted" style="font-size:13px">' + esc([m.title, App.roleLabel(m.role), m.email].filter(Boolean).join(' · ')) + '</div><div class="row wrap-row" style="margin-top:6px;gap:6px">' + m.teams.map(App.teamChip).join('') + '</div><div class="hint" style="margin-top:8px">' + (m.slackId ? 'Slack member ID: ' + esc(m.slackId) : 'Slack finds you by your email. If DMs don’t arrive, add your Slack member ID (Slack → your profile → ⋯ → Copy member ID).') + '</div></div><button type="button" class="btn" data-act="editPerson" data-id="' + esc(m.id) + '">' + icon('edit', 14) + 'Edit profile</button></div></div>';

    html += App.feedbackSettingsHtml();

    // integrations
    html += '<div class="section-title" style="margin-top:22px">Integrations</div><div class="grid-2">';
    html += '<div class="card int-card"><div class="int-head"><div class="int-logo" style="background:#4a154b">#</div><div style="flex:1"><b>Slack</b><div class="hint">Notifications, nudges and daily digests</div></div>' + (I.slack ? '<span class="status-tag on">Connected (' + (I.slack === 'bot' ? 'bot: DMs + channels' : 'webhook: one channel') + ')</span>' : '<span class="status-tag off">Not connected</span>') + '</div>' +
      '<ul class="hint" style="padding-left:18px;margin:6px 0 10px"><li>DMs someone when they’re assigned a task or a step, @mentioned, nudged, or asked for help</li><li>Posts to the team channel when a task is blocked, finished, or posted as off track</li><li>8am daily DM: your overdue and due-soon tasks; daily team digest of overdue, blocked and stale tasks</li><li>Monday summary for exec</li></ul>' +
      (App.S.mode === 'live' ? (I.slack ? '<button type="button" class="btn sm" data-act="slackTest">' + icon('send', 12) + 'Send a test message</button>' : '<div class="hint">An exec member needs to add a Slack token in Apps Script (see <b>tracker/README.md</b> → “Connect Slack”).</div>') : '<div class="hint">In demo mode, notifications appear as purple 💬 toasts showing what Slack would send. Deploy with Google Apps Script to turn them on (see <b>tracker/README.md</b>).</div>') + '</div>';
    html += '<div class="card int-card"><div class="int-head"><div class="int-logo" style="background:#1a73e8">G</div><div style="flex:1"><b>Google Drive &amp; Sheets</b><div class="hint">Data storage, sign-in and shared docs</div></div>' + (App.S.mode === 'live' ? '<span class="status-tag on">Connected</span>' : '<span class="status-tag off">Demo</span>') + '</div>' +
      '<ul class="hint" style="padding-left:18px;margin:6px 0 10px"><li>Everyone signs in with their UChicago Google account, so every change is tied to a real person</li><li>Tasks are stored in a Google Sheet you own: easy to export, audit, or back up</li><li>One click creates a Doc / Sheet / Slides / folder inside the task’s shared Drive folder and attaches it</li><li>Paste any Drive link and the tracker picks up its real file name</li></ul>' +
      (App.S.mode === 'live' ? '<div class="row wrap-row">' + (I.driveRootUrl ? '<a class="btn sm" target="_blank" rel="noopener" href="' + esc(App.safeUrl(I.driveRootUrl)) + '">' + icon('folder', 12) + 'Tracker Drive folder</a>' : '') + (I.sheetUrl && isExec ? '<a class="btn sm" target="_blank" rel="noopener" href="' + esc(App.safeUrl(I.sheetUrl)) + '">' + icon('external', 12) + 'Data spreadsheet</a>' : '') + '</div>' : '<div class="hint">Setup takes about 15 minutes and needs no server: see <b>tracker/README.md</b>.</div>') + '</div>';
    html += '</div>';

    // teams
    html += '<div class="section-title" style="margin-top:22px">Teams' + (isExec ? '<span style="flex:1"></span><button type="button" class="btn sm" data-act="editTeam">' + icon('plus', 12) + 'Add team</button>' : '') + '</div>';
    html += '<div class="card" style="overflow-x:auto"><table class="table"><thead><tr><th>Team</th><th>Leads</th><th>People</th><th>Slack channel</th><th>Drive folder</th><th></th></tr></thead><tbody>' + liveTeams().map(function (t) {
      var leads = C.teamLeads(st(), t.id);
      return '<tr><td><div class="row" style="gap:8px"><span class="team-dot" style="background:' + esc(t.color) + '"></span><b>' + esc(t.name) + '</b></div></td><td>' + esc(leads.map(function (p) { return p.name; }).join(', ') || '-') + '</td><td>' + C.teamMembers(st(), t.id).length + '</td><td style="font-size:13px">' + (esc(t.slackChannel) || '<span class="muted">not set</span>') + '</td><td style="font-size:13px">' + (t.driveFolderUrl ? '<a href="' + esc(App.safeUrl(t.driveFolderUrl)) + '" target="_blank" rel="noopener">Open</a>' : '<span class="muted">not set</span>') + '</td><td style="text-align:right">' + (isExec ? '<button type="button" class="btn sm ghost" data-act="editTeam" data-id="' + esc(t.id) + '">Edit</button>' : '') + '</td></tr>';
    }).join('') + '</tbody></table></div>';

    // people
    var samples = C.activePeople(st()).filter(function (p) { return p.sample; });
    html += '<div class="section-title" style="margin-top:22px">People &amp; roles' + (canPeople ? '<span style="flex:1"></span><button type="button" class="btn sm" data-act="importRoster">' + icon('upload', 12) + 'Import roster</button><button type="button" class="btn sm primary" data-act="editPerson">' + icon('plus', 12) + 'Add person</button>' : '') + '</div>';
    if (samples.length && isExec) html += '<div class="banner warn">' + icon('flag', 15) + '<span>The roster still has <b>' + samples.length + ' sample people</b>. Import your real leadership list (from uchicagoaisafety.com/leadership) and remove the samples.</span><span class="spacer"></span><button type="button" class="btn sm" data-act="removeSamples">Remove samples</button></div>';
    html += '<div class="hint" style="margin:-4px 0 8px"><b>Exec</b> can edit everything. <b>Team leads</b> manage their team’s tasks, projects and members. <b>Members</b> edit their own team’s tasks. Everyone can see everything, comment and ask for help.</div>';
    html += '<div class="card" style="overflow-x:auto"><table class="table"><thead><tr><th>Name</th><th>Role</th><th>Teams</th><th>Email</th><th>Slack ID</th><th></th></tr></thead><tbody>' + C.activePeople(st()).slice().sort(function (a, b) { var r = { exec: 0, lead: 1, member: 2 }; return r[a.role] - r[b.role] || a.name.localeCompare(b.name); }).map(function (p) {
      var can = C.canEditPerson(st(), m.id, p, {});
      return '<tr><td><div class="row" style="gap:8px">' + App.avatar(p.id, 'sm') + '<span style="font-weight:600">' + esc(p.name) + '</span>' + (p.sample ? '<span class="chip" style="font-size:10px">sample</span>' : '') + '</div></td><td>' + esc(App.roleLabel(p.role)) + '</td><td>' + p.teams.map(App.teamChip).join(' ') + '</td><td style="font-size:13px">' + (esc(p.email) || '<span class="muted">-</span>') + '</td><td style="font-size:12px" class="muted">' + esc(p.slackId || '') + '</td><td style="text-align:right;white-space:nowrap">' + (can ? '<button type="button" class="btn sm ghost" data-act="editPerson" data-id="' + esc(p.id) + '">Edit</button>' : '') + '</td></tr>';
    }).join('') + '</tbody></table></div>';

    // data
    html += '<div class="section-title" style="margin-top:22px">Data</div><div class="card card-pad"><div class="row wrap-row">' +
      '<button type="button" class="btn" data-act="exportData">' + icon('download', 14) + 'Export everything (JSON)</button>' +
      (App.S.mode === 'demo' ? '<button type="button" class="btn" data-act="importData">' + icon('upload', 14) + 'Import JSON</button><button type="button" class="btn danger" data-act="resetDemo">' + icon('refresh', 14) + 'Reset demo data</button><button type="button" class="btn" data-act="blankStart">Start empty (keep teams &amp; checklists)</button>' : '') +
      '<button type="button" class="btn ghost" data-act="showWelcome">Show the welcome guide</button><button type="button" class="btn ghost" data-act="shortcuts">Keyboard shortcuts</button></div>' +
      (App.S.mode === 'demo' ? '<div class="hint" style="margin-top:10px">Demo data is stored in this browser’s local storage. Nobody else can see it. Use the export to move it into the real deployment.</div>' : '') + '</div>';
    html += '</div></div>';
    return { title: 'Settings', content: html };
  };
})(App);
