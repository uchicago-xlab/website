/* Tracker task detail panel and dialogs (new task, ask for help, nudge, people, teams, projects, checklists, docs, roster import, palette). */
(function (App) {
  'use strict';
  var C = App.C, esc = App.esc, icon = App.icon, A = App.actions;
  function st() { return App.S.state; }
  function curTask() { var id = App.S.route.query.task; var t = id ? C.task(st(), id) : null; return t && !t.deleted ? t : null; }

  /* ======================= panel ======================= */
  App.renderPanel = function () {
    var t = curTask();
    if (!t) return '';
    var meId = App.S.meId;
    var canEdit = C.canEditTask(st(), meId, t);
    var done = C.isDone(t);
    var tm = C.team(st(), t.team);
    var html = '<div class="panel-head">';
    html += '<button type="button" class="btn done-btn' + (done ? ' is-done' : '') + '" data-act="toggleDone" data-id="' + esc(t.id) + '"' + (canEdit ? '' : ' disabled title="Only the team, owner or collaborators can complete this"') + '>' + icon('check', 14) + (done ? 'Completed' : 'Mark complete') + '</button>';
    html += '<span style="flex:1"></span>';
    html += '<button type="button" class="btn sm" data-act="askHelp" data-id="' + esc(t.id) + '" title="Ask someone for help: they get a Slack DM">' + icon('hand', 13) + '<span class="hide-sm">Ask for help</span></button>';
    if (t.owner && t.owner !== meId && !done) html += '<button type="button" class="btn sm ghost" data-act="nudge" data-id="' + esc(t.id) + '" title="Send ' + esc(App.firstName(t.owner)) + ' a friendly reminder to post an update">' + icon('bell', 13) + '<span class="hide-sm">Nudge</span></button>';
    html += '<button type="button" class="icon-btn" data-act="copyLink" data-id="' + esc(t.id) + '" title="Copy link to this task" aria-label="Copy link">' + icon('link', 16) + '</button>';
    html += '<button type="button" class="icon-btn" data-act="taskMore" data-id="' + esc(t.id) + '" title="More" aria-label="More actions">' + icon('more', 16) + '</button>';
    html += '<button type="button" class="icon-btn" data-act="closeTask" title="Close (Esc)" aria-label="Close">' + icon('x', 18) + '</button>';
    html += '</div><div class="panel-body" data-scroll-key="panel-' + esc(t.id) + '">';

    // banners
    if (!canEdit) html += '<div class="banner info">' + icon('help', 15) + '<span>This is a <b>' + esc(tm ? tm.name : '') + '</b> task. You can comment, ask for help, and tick off steps assigned to you.</span></div>';
    if (!done && C.isOverdue(t)) html += '<div class="banner bad">' + icon('clock', 15) + '<span><b>' + -C.daysBetween(C.todayKey(), t.dueDate) + ' days overdue.</b> ' + (t.owner === meId ? 'Finish it, move the date, or ask for help, so the team knows where it stands.' : 'Nudge the owner or offer help.') + '</span></div>';
    else if (!done && t.status === 'blocked') html += '<div class="banner bad">' + icon('flag', 15) + '<span><b>Blocked.</b> ' + (C.openHelp(t).length ? 'Waiting on ' + esc(C.openHelp(t).map(function (h) { return App.firstName(h.to); }).join(', ')) + '.' : 'Who can unblock this? Ask them directly.') + '</span><span class="spacer"></span>' + (!C.openHelp(t).length ? '<button type="button" class="btn sm" data-act="askHelp" data-id="' + esc(t.id) + '">Ask for help</button>' : '') + '</div>';
    if (!done && t.owner === meId && C.isStale(t)) html += '<div class="banner warn">' + icon('bell', 15) + '<span>No check-in for <b>' + C.staleDays(t) + ' days</b>. A one-line update keeps everyone in the loop.</span><span class="spacer"></span><button type="button" class="btn sm" data-act="focusCheckin">Check in</button></div>';
    if (!t.owner && !done) html += '<div class="banner info">' + icon('user', 15) + '<span><b>Nobody owns this yet.</b> Every task needs exactly one owner.</span><span class="spacer"></span>' + (canEdit ? '<button type="button" class="btn sm" data-act="takeTask" data-id="' + esc(t.id) + '">I’ll take it</button>' : '') + '</div>';

    html += '<textarea class="panel-title" rows="1" data-fk="title-' + esc(t.id) + '" data-blur="saveTitle" data-enter="blurSelf" data-id="' + esc(t.id) + '"' + (canEdit ? '' : ' readonly') + ' aria-label="Task title">' + esc(t.title) + '</textarea>';

    // fields
    var dis = canEdit ? '' : ' disabled';
    html += '<div class="fields">';
    html += '<div class="k">Owner</div><div class="v"><button type="button" class="field-btn' + (t.owner ? '' : ' placeholder') + '" data-act="pickOwner" data-id="' + esc(t.id) + '"' + dis + '>' + App.avatar(t.owner, 'sm') + (t.owner ? esc(App.pname(t.owner)) : 'Assign an owner') + '</button></div>';
    html += '<div class="k">Collaborators</div><div class="v"><button type="button" class="field-btn' + ((t.collaborators || []).length ? '' : ' placeholder') + '" data-act="pickCollabs" data-id="' + esc(t.id) + '"' + dis + '>' + ((t.collaborators || []).length ? App.avatars(t.collaborators, 'sm', 6) + '<span style="font-size:12.5px">' + esc(t.collaborators.map(App.firstName).join(', ')) + '</span>' : icon('plus', 13) + 'Add people helping') + '</button></div>';
    html += '<div class="k">Status</div><div class="v"><button type="button" class="field-btn" data-act="pickStatus" data-id="' + esc(t.id) + '"' + dis + '>' + App.statusPill(t.status) + '</button></div>';
    html += '<div class="k">Due date</div><div class="v"><input type="date" class="date-input" data-change="setDate" data-field="dueDate" data-id="' + esc(t.id) + '" value="' + esc(t.dueDate || '') + '"' + dis + ' aria-label="Due date">' + (t.dueDate ? App.dueHtml(t) : '') + '</div>';
    html += '<div class="k">Start date</div><div class="v"><input type="date" class="date-input" data-change="setDate" data-field="startDate" data-id="' + esc(t.id) + '" value="' + esc(t.startDate || '') + '"' + dis + ' aria-label="Start date"><span class="hint">optional, for the timeline</span></div>';
    html += '<div class="k">Team</div><div class="v"><button type="button" class="field-btn" data-act="pickTeam" data-id="' + esc(t.id) + '"' + dis + '>' + App.teamChip(t.team) + '</button></div>';
    html += '<div class="k">Project</div><div class="v"><button type="button" class="field-btn' + (t.project ? '' : ' placeholder') + '" data-act="pickProject" data-id="' + esc(t.id) + '"' + dis + '>' + (App.projectChip(t.project) || 'None') + '</button></div>';
    html += '<div class="k">Priority</div><div class="v"><button type="button" class="field-btn" data-act="pickPriority" data-id="' + esc(t.id) + '"' + dis + '>' + App.prioPill(t.priority) + '</button></div>';
    html += '<div class="k">Health</div><div class="v">' + App.healthPill(t.health) + (t.lastCheckinAt ? '<span class="hint">last check-in ' + App.relTime(t.lastCheckinAt) + '</span>' : '') + '</div>';
    html += '</div>';

    // help requests
    var help = t.help || [];
    if (help.length) {
      var openH = help.filter(function (h) { return h.status === 'open'; });
      var resolved = help.filter(function (h) { return h.status !== 'open'; });
      html += '<div class="help-box"><div class="p-section-head" style="margin-bottom:4px">' + icon('hand', 15) + '<h4>Help requests</h4><span class="spacer"></span><button type="button" class="btn sm ghost" data-act="askHelp" data-id="' + esc(t.id) + '">' + icon('plus', 12) + 'Ask someone</button></div>';
      openH.concat(App.S.ui.showResolved ? resolved : []).forEach(function (h) {
        var canResolve = h.from === meId || h.to === meId || canEdit;
        html += '<div class="help-item' + (h.status !== 'open' ? ' resolved' : '') + '">' + App.avatar(h.from, 'sm') + '<div style="flex:1;min-width:0"><div style="font-size:13px"><b>' + esc(App.firstName(h.from)) + '</b> asked <b>' + esc(App.pname(h.to)) + '</b> · <span class="muted">' + App.relTime(h.at) + '</span>' + (h.status !== 'open' ? ' · <span style="color:var(--ok)">resolved ' + App.relTime(h.resolvedAt) + '</span>' : '') + '</div>' + (h.message ? '<div class="msg">' + App.inline(h.message) + '</div>' : '') + '</div>' + (h.status === 'open' && canResolve ? '<button type="button" class="btn sm" data-act="resolveHelp" data-id="' + esc(t.id) + '" data-help="' + esc(h.id) + '">' + icon('check', 12) + (h.to === meId ? 'Done helping' : 'Resolved') + '</button>' : '') + '</div>';
      });
      if (resolved.length) html += '<button type="button" class="btn sm ghost" data-act="toggleResolved">' + (App.S.ui.showResolved ? 'Hide' : 'Show') + ' ' + App.plural(resolved.length, 'resolved request') + '</button>';
      if (!openH.length && !App.S.ui.showResolved) html += '<div class="hint">No open requests.</div>';
      html += '</div>';
    }

    // description / notes
    var editing = App.S.ui.descEditing === t.id;
    html += '<div class="p-section"><div class="p-section-head"><h4>Notes</h4><span class="spacer"></span>' + (editing ? '<span class="hint">Markdown: **bold**, - lists, links. Saves when you click away.</span>' : '') + '</div>';
    if (editing) {
      var draft = App.S.ui.drafts['desc-' + t.id];
      html += '<textarea class="textarea" style="min-height:160px" data-fk="desc-' + esc(t.id) + '" data-blur="saveDesc" data-input="draft" data-draft="desc-' + esc(t.id) + '" data-id="' + esc(t.id) + '" placeholder="Context, decisions, links, meeting notes…">' + esc(draft !== undefined ? draft : t.description || '') + '</textarea>';
    } else if (t.description) {
      html += '<div class="desc-view md" ' + (canEdit ? 'data-act="editDesc" data-id="' + esc(t.id) + '" title="Click to edit"' : '') + '>' + App.md(t.description) + '</div>';
    } else {
      html += '<div class="desc-view placeholder" ' + (canEdit ? 'data-act="editDesc" data-id="' + esc(t.id) + '"' : '') + '>' + (canEdit ? 'Add context, goals, decisions, meeting notes…' : 'No notes.') + '</div>';
    }
    html += '</div>';

    // steps
    var prog = C.stepProgress(t);
    var steps = t.steps || [];
    html += '<div class="p-section"><div class="p-section-head"><h4>Steps</h4>' + (prog.total ? '<span class="muted" style="font-size:12.5px">' + prog.done + ' of ' + prog.total + '</span>' : '') + '<span class="spacer"></span>' + (canEdit ? '<button type="button" class="btn sm ghost" data-act="templateMenu" data-id="' + esc(t.id) + '">' + icon('checklist', 13) + 'Add checklist</button>' : '') + '</div>';
    if (prog.total) html += '<div class="progress" style="margin-bottom:8px"><span style="width:' + prog.pct + '%"></span></div>';
    html += '<div class="steps" data-steps="' + esc(t.id) + '">';
    steps.forEach(function (s) {
      var canTog = C.canToggleStep(st(), meId, t, s);
      var late = s.due && !s.done && s.due < C.todayKey();
      html += '<div class="step' + (s.done ? ' done' : '') + '" data-step-id="' + esc(s.id) + '">' +
        '<span class="grip"' + (canEdit ? ' draggable="true" title="Drag to reorder"' : '') + '>' + (canEdit ? icon('grip', 14) : '') + '</span>' +
        '<button type="button" class="check sq' + (s.done ? ' on' : '') + '" data-act="toggleStep" data-id="' + esc(t.id) + '" data-step="' + esc(s.id) + '"' + (canTog ? '' : ' disabled') + ' aria-label="Toggle step">' + icon('check', 11) + '</button>' +
        '<input class="step-text" value="' + esc(s.text) + '" data-fk="step-' + esc(s.id) + '" data-blur="saveStep" data-enter="blurSelf" data-id="' + esc(t.id) + '" data-step="' + esc(s.id) + '"' + (canEdit ? '' : ' readonly') + ' aria-label="Step">' +
        '<span class="step-meta">' +
        (s.due || canEdit ? '<span style="position:relative;display:inline-flex"><button type="button" class="step-due' + (late ? ' overdue' : '') + '" data-act="stepDue" data-id="' + esc(t.id) + '" data-step="' + esc(s.id) + '"' + (canEdit ? '' : ' disabled') + ' title="Step due date">' + (s.due ? App.fmtDate(s.due) : '<span class="icon-btn" style="width:22px;height:22px;opacity:.6">' + icon('calendar', 13) + '</span>') + '</button><input type="date" tabindex="-1" aria-hidden="true" style="position:absolute;left:0;top:0;width:1px;height:1px;opacity:0;pointer-events:none" data-change="setStepDue" data-id="' + esc(t.id) + '" data-step="' + esc(s.id) + '" value="' + esc(s.due || '') + '"></span>' : '') +
        (s.assignee ? '<button type="button" class="icon-btn set" style="width:26px;height:26px" data-act="stepAssign" data-id="' + esc(t.id) + '" data-step="' + esc(s.id) + '" title="' + esc(App.pname(s.assignee)) + '"' + (canEdit ? '' : ' disabled') + '>' + App.avatar(s.assignee, 'sm') + '</button>' : (canEdit ? '<button type="button" class="icon-btn" data-act="stepAssign" data-id="' + esc(t.id) + '" data-step="' + esc(s.id) + '" title="Assign step">' + icon('user', 14) + '</button>' : '')) +
        (canEdit ? '<button type="button" class="icon-btn" data-act="deleteStep" data-id="' + esc(t.id) + '" data-step="' + esc(s.id) + '" title="Delete step" aria-label="Delete step">' + icon('x', 13) + '</button>' : '') +
        '</span></div>';
    });
    if (canEdit) html += '<div class="step-add">' + icon('plus', 14) + '<input placeholder="' + (steps.length ? 'Add another step…' : 'Break this into steps: type one and press Enter') + '" data-fk="addstep-' + esc(t.id) + '" data-enter="addStep" data-id="' + esc(t.id) + '" aria-label="Add a step"></div>';
    else if (!steps.length) html += '<div class="step-add muted" style="font-size:13px">No steps.</div>';
    html += '</div></div>';

    // links & docs
    var links = t.links || [];
    html += '<div class="p-section"><div class="p-section-head"><h4>Docs &amp; links</h4><span class="muted" style="font-size:12.5px">' + (links.length || '') + '</span><span class="spacer"></span>' +
      '<button type="button" class="btn sm ghost" data-act="driveMenu" data-id="' + esc(t.id) + '">' + icon('plus', 13) + 'New Google file</button></div>';
    html += '<div class="links">' + links.map(function (l) {
      var canRm = l.addedBy === meId || canEdit;
      return '<div class="link-row">' + App.kindIcon(l.kind) + '<div class="lk"><a href="' + esc(App.safeUrl(l.url)) + '" target="_blank" rel="noopener">' + esc(l.title) + '</a><div class="u">' + esc(App.firstName(l.addedBy)) + ' · ' + App.relTime(l.at) + '</div></div>' + (canRm ? '<button type="button" class="icon-btn" data-act="removeLink" data-id="' + esc(t.id) + '" data-link="' + esc(l.id) + '" title="Remove" aria-label="Remove link">' + icon('x', 13) + '</button>' : '') + '</div>';
    }).join('') + '</div>';
    html += '<div class="link-add"><input class="input" placeholder="Paste a link (Google Doc, Drive folder, Canva, form…)" data-fk="linkurl-' + esc(t.id) + '" data-enter="addLink" data-id="' + esc(t.id) + '" aria-label="Link URL"><input class="input" style="max-width:180px" placeholder="Title (optional)" data-fk="linktitle-' + esc(t.id) + '" data-enter="addLink" data-id="' + esc(t.id) + '" aria-label="Link title"><button type="button" class="btn" data-act="addLink" data-id="' + esc(t.id) + '">Attach</button></div>';
    html += '</div>';

    // activity
    var feedMode = App.prefs.get('feedMode', 'all');
    var feed = (t.feed || []).filter(function (e) { return feedMode === 'all' || e.kind !== 'activity'; });
    html += '<div class="p-section"><div class="p-section-head"><h4>Updates &amp; comments</h4><span class="spacer"></span><span class="seg"><button type="button" class="' + (feedMode === 'all' ? 'on' : '') + '" data-act="feedMode" data-v="all">All activity</button><button type="button" class="' + (feedMode === 'talk' ? 'on' : '') + '" data-act="feedMode" data-v="talk">Comments &amp; check-ins</button></span></div>';
    html += '<div class="feed">' + (feed.length ? feed.slice(-80).map(function (e) { return feedItem(t, e); }).join('') : '<div class="hint">No updates yet.</div>') + '</div>';
    // composer
    var mode = App.S.ui.composerMode[t.id] || 'comment';
    if (!canEdit) mode = 'comment';
    var health = App.S.ui.composerHealth[t.id] || t.health || 'on';
    var draftC = App.S.ui.drafts['c-' + t.id] || '';
    html += '<div class="composer" style="margin-top:14px" id="composer">' +
      '<textarea data-fk="composer-' + esc(t.id) + '" data-input="composerInput" data-draft="c-' + esc(t.id) + '" data-id="' + esc(t.id) + '" data-ctrl-enter="sendComposer" placeholder="' + (mode === 'checkin' ? 'What did you get done? What’s next? Anything in your way?' : 'Comment, or @mention someone to loop them in…') + '" aria-label="' + (mode === 'checkin' ? 'Check-in' : 'Comment') + '">' + esc(draftC) + '</textarea>' +
      '<div class="composer-foot">' + (canEdit ? '<span class="seg"><button type="button" class="' + (mode === 'comment' ? 'on' : '') + '" data-act="composerMode" data-id="' + esc(t.id) + '" data-v="comment">Comment</button><button type="button" class="' + (mode === 'checkin' ? 'on' : '') + '" data-act="composerMode" data-id="' + esc(t.id) + '" data-v="checkin">Check-in</button></span>' : '') +
      (mode === 'checkin' ? '<span class="health-choice">' + C.HEALTH.map(function (h) { return '<button type="button" class="' + (health === h.id ? 'on' : '') + '" data-act="composerHealth" data-id="' + esc(t.id) + '" data-v="' + h.id + '"><span class="health-dot" style="background:' + h.color + '"></span>' + h.label + '</button>'; }).join('') + '</span>' : '') +
      '<span class="spacer"></span><span class="hint hide-sm">⌘/Ctrl + Enter</span><button type="button" class="btn primary sm" data-act="sendComposer" data-id="' + esc(t.id) + '">' + (mode === 'checkin' ? 'Post check-in' : 'Comment') + '</button></div></div>';
    html += '<div class="hint" style="margin-top:12px">Created by ' + esc(App.pname(t.createdBy)) + ' · ' + App.relTime(t.createdAt) + (t.completedAt ? ' · completed ' + App.relTime(t.completedAt) : '') + '</div>';
    html += '</div></div>';
    return html;
  };

  function activityText(e) {
    switch (e.action) {
      case 'created': return 'created this task';
      case 'status': return 'moved this to ' + App.statusPill(e.value);
      case 'owner': return e.value ? 'made <b>' + esc(App.pname(e.value)) + '</b> the owner' : 'removed the owner';
      case 'due': return e.value ? 'changed the due date to <b>' + esc(App.fmtDate(e.value, { absolute: true })) + '</b>' + (e.from ? ' (was ' + esc(App.fmtDate(e.from, { absolute: true })) + ')' : '') : 'removed the due date';
      case 'collaborators': return 'added ' + esc((e.value || []).map(App.pname).join(', ')) + ' as collaborator' + ((e.value || []).length > 1 ? 's' : '');
      case 'team': var t = C.team(st(), e.value); return 'moved this to ' + esc(t ? t.name : 'another team');
      case 'priority': return 'set priority to ' + App.prioPill(e.value);
      case 'step': return 'completed “' + esc(e.value) + '”';
      case 'template': return 'added the checklist “' + esc(e.value) + '”';
      case 'link': return 'attached “' + esc(e.value) + '”';
      case 'help': return 'asked <b>' + esc(App.pname(e.value)) + '</b> for help' + (e.text ? ': “' + esc(e.text) + '”' : '');
      case 'helpResolved': return 'resolved the help request to ' + esc(App.pname(e.value));
      case 'nudge': return 'nudged <b>' + esc(App.pname(e.value)) + '</b> for an update' + (e.text ? ': “' + esc(e.text) + '”' : '');
      default: return 'updated this task';
    }
  }
  function feedItem(t, e) {
    var canDel = (e.by === App.S.meId || C.isExec(App.me())) && e.kind !== 'activity';
    var del = canDel ? '<button type="button" class="del" data-act="deleteComment" data-id="' + esc(t.id) + '" data-c="' + esc(e.id) + '">Delete</button>' : '';
    if (e.kind === 'activity') {
      return '<div class="feed-item activity"><span class="act-dot">' + App.avatar(e.by, 'sm') + '</span><span><b style="color:var(--ink-2)">' + esc(App.firstName(e.by)) + '</b> ' + activityText(e) + ' · ' + App.relTime(e.at) + '</span></div>';
    }
    if (e.kind === 'checkin') {
      var h = App.healthOf(e.health) || C.HEALTH[0];
      return '<div class="feed-item checkin">' + App.avatar(e.by) + '<div style="min-width:0"><span class="who">' + esc(App.pname(e.by)) + '</span><span class="when">posted a check-in · ' + App.relTime(e.at) + '</span>' + del + '<div class="bubble" style="border-left-color:' + h.color + '">' + App.healthPill(e.health) + (e.text ? '<div class="body">' + App.inline(e.text) + '</div>' : '') + '</div></div></div>';
    }
    return '<div class="feed-item">' + App.avatar(e.by) + '<div style="min-width:0"><span class="who">' + esc(App.pname(e.by)) + '</span><span class="when">' + App.relTime(e.at) + '</span>' + del + '<div class="body">' + App.inline(e.text) + '</div></div></div>';
  }

  /* ---------- panel actions ---------- */
  function upd(id, patch) { return App.dispatch({ type: 'updateTask', id: id, patch: patch }); }
  A.closeTask = function () { App.closeTask(); };
  A.toggleDone = function (el) {
    var t = C.task(st(), el.dataset.id);
    if (!t) return;
    var wasDone = C.isDone(t);
    if (upd(t.id, { status: wasDone ? 'doing' : 'done' })) {
      if (!wasDone) App.toast('Completed “' + t.title + '”', { icon: '🎉', action: { label: 'Undo', fn: function () { upd(t.id, { status: 'doing' }); } } });
    }
  };
  A.takeTask = function (el) {
    var t = C.task(st(), el.dataset.id);
    if (t && upd(t.id, { owner: App.S.meId })) App.toast('You own “' + t.title + '” now.');
  };
  A.blurSelf = function (el, e) { e.preventDefault(); el.blur(); };
  A.saveTitle = function (el) {
    var t = C.task(st(), el.dataset.id);
    var v = el.value.replace(/\s+/g, ' ').trim();
    if (!t) return;
    if (!v) { el.value = t.title; return; }
    if (v !== t.title) upd(t.id, { title: v });
  };
  A.pickOwner = function (el) {
    var t = C.task(st(), el.dataset.id);
    App.pick(el, { items: App.peopleItems(t.team, { allowNone: true }), selected: [t.owner], placeholder: 'Who owns this?' }, function (id) { upd(t.id, { owner: id || null }); });
  };
  A.pickCollabs = function (el) {
    var t = C.task(st(), el.dataset.id);
    App.pick(el, { items: App.peopleItems(t.team), selected: t.collaborators || [], multi: true, placeholder: 'Add collaborators…' }, function (ids) { upd(t.id, { collaborators: ids }); });
  };
  A.pickStatus = function (el) {
    var t = C.task(st(), el.dataset.id);
    App.pick(el, { search: false, items: C.STATUSES.map(function (s) { return { id: s.id, label: s.label, html: '<span class="health-dot" style="background:' + s.color + '"></span>' }; }), selected: [t.status] }, function (id) {
      upd(t.id, { status: id });
      if (id === 'blocked' && !C.openHelp(t).length) setTimeout(function () { App.toast('Marked as blocked. Who can unblock it?', { action: { label: 'Ask for help', fn: function () { App.openHelpModal(t.id); } } }); }, 50);
    });
  };
  A.pickPriority = function (el) {
    var t = C.task(st(), el.dataset.id);
    App.pick(el, { search: false, items: C.PRIORITIES.slice().reverse().map(function (p) { return { id: p.id, label: p.label, html: '<span class="prio" style="background:' + p.color + '"></span>' }; }), selected: [t.priority] }, function (id) { upd(t.id, { priority: id }); });
  };
  A.pickTeam = function (el) {
    var t = C.task(st(), el.dataset.id);
    App.pick(el, { search: false, items: App.views.liveTeams().map(function (x) { return { id: x.id, label: x.name, html: '<span class="team-dot" style="background:' + esc(x.color) + '"></span>' }; }), selected: [t.team] }, function (id) {
      var patch = { team: id };
      var pr = t.project && C.byId(st().projects, t.project);
      if (pr && pr.team !== id) patch.project = null;
      upd(t.id, patch);
    });
  };
  A.pickProject = function (el) {
    var t = C.task(st(), el.dataset.id);
    var items = [{ id: null, label: 'No project' }].concat(App.views.liveProjects(t.team).map(function (p) { return { id: p.id, label: p.name, html: '<span class="team-dot" style="background:' + esc(p.color || '#64748b') + '"></span>' }; }));
    items.push({ id: '__new', label: '+ New project…' });
    App.pick(el, { items: items, selected: [t.project], placeholder: 'Find a project…' }, function (id) {
      if (id === '__new') { App.openProjectModal(null, t.team, function (pid) { upd(t.id, { project: pid }); }); return; }
      upd(t.id, { project: id });
    });
  };
  A.setDate = function (el) {
    var t = C.task(st(), el.dataset.id);
    var field = el.dataset.field, v = el.value || null;
    var patch = {}; patch[field] = v;
    if (field === 'startDate' && v && t.dueDate && v > t.dueDate) patch.dueDate = v;
    if (field === 'dueDate' && v && t.startDate && v < t.startDate) patch.startDate = v;
    upd(t.id, patch);
  };
  A.editDesc = function (el, e) {
    if (e && e.target.closest('a')) return; // let links in notes open
    App.S.ui.descEditing = el.dataset.id;
    App.render();
    var ta = document.querySelector('[data-fk="desc-' + el.dataset.id + '"]');
    if (ta) { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); autoGrow(ta); }
  };
  A.saveDesc = function (el) {
    var t = C.task(st(), el.dataset.id);
    App.S.ui.descEditing = null;
    delete App.S.ui.drafts['desc-' + el.dataset.id];
    if (t && el.value !== (t.description || '')) upd(t.id, { description: el.value });
    else App.render();
  };
  A.draft = function (el) { App.S.ui.drafts[el.dataset.draft] = el.value; autoGrow(el); };
  function autoGrow(el) { if (el.tagName === 'TEXTAREA' && el.classList.contains('textarea')) { el.style.height = 'auto'; el.style.height = Math.max(160, el.scrollHeight + 4) + 'px'; } }

  // steps
  A.toggleStep = function (el) {
    var t = C.task(st(), el.dataset.id);
    var s = t && C.byId(t.steps || [], el.dataset.step);
    if (!s) return;
    App.dispatch({ type: 'updateStep', taskId: t.id, stepId: s.id, patch: { done: !s.done } });
    if (!s.done) {
      var p = C.stepProgress(t);
      if (p.total && p.done === p.total && !C.isDone(t) && C.canEditTask(st(), App.S.meId, t)) {
        App.toast('All steps done! Mark the task complete?', { icon: '🎯', action: { label: 'Complete', fn: function () { upd(t.id, { status: 'done' }); } }, timeout: 8000 });
      }
    }
  };
  A.addStep = function (el, e) {
    e.preventDefault();
    var text = el.value.trim();
    if (!text) return;
    el.value = '';
    // "Book room @hannah due fri" works in steps too
    var q = App.parseQuick(text);
    App.dispatch({ type: 'addStep', taskId: el.dataset.id, step: { text: q.title || text, assignee: q.owner || null, due: q.dueDate || null } });
  };
  A.saveStep = function (el) {
    var t = C.task(st(), el.dataset.id);
    var s = t && C.byId(t.steps || [], el.dataset.step);
    if (!s) return;
    var v = el.value.trim();
    if (!v) { el.value = s.text; return; }
    if (v !== s.text) App.dispatch({ type: 'updateStep', taskId: t.id, stepId: s.id, patch: { text: v } });
  };
  A.deleteStep = function (el) { App.dispatch({ type: 'deleteStep', taskId: el.dataset.id, stepId: el.dataset.step }); };
  A.stepAssign = function (el) {
    var t = C.task(st(), el.dataset.id);
    var s = C.byId(t.steps || [], el.dataset.step);
    App.pick(el, { items: App.peopleItems(t.team, { allowNone: true }), selected: [s.assignee], placeholder: 'Assign this step…' }, function (id) {
      App.dispatch({ type: 'updateStep', taskId: t.id, stepId: s.id, patch: { assignee: id || null } });
    });
  };
  A.stepDue = function (el) {
    var input = el.parentNode.querySelector('input[type=date]');
    if (!input) return;
    try { input.showPicker(); } catch (err) {
      var v = window.prompt('Step due date (e.g. "fri", "12/5", or blank to clear):', input.value || '');
      if (v === null) return;
      var k = v.trim() ? App.parseDatePhrase(v) : null;
      if (v.trim() && !k) { App.toast('Couldn’t read that date.', { type: 'err' }); return; }
      App.dispatch({ type: 'updateStep', taskId: el.dataset.id, stepId: el.dataset.step, patch: { due: k } });
    }
  };
  A.setStepDue = function (el) { App.dispatch({ type: 'updateStep', taskId: el.dataset.id, stepId: el.dataset.step, patch: { due: el.value || null } }); };
  A.templateMenu = function (el) {
    var t = C.task(st(), el.dataset.id);
    var tpls = st().templates.filter(function (x) { return !x.deleted; });
    tpls.sort(function (a, b) { return (b.team === t.team ? 1 : 0) - (a.team === t.team ? 1 : 0) || a.name.localeCompare(b.name); });
    App.pick(el, { items: tpls.map(function (x) { return { id: x.id, label: x.name, sub: (x.steps || []).length + ' steps', group: x.team === t.team ? 'This team' : 'Other checklists' }; }), placeholder: 'Find a checklist…' }, function (id) {
      if (App.dispatch({ type: 'applyTemplate', taskId: t.id, templateId: id }) && !t.dueDate) App.toast('Added. Set a due date and future checklists will get step dates automatically.');
    });
  };

  // links & drive
  A.addLink = function (el) {
    var id = el.dataset.id;
    var u = document.querySelector('[data-fk="linkurl-' + id + '"]');
    var ti = document.querySelector('[data-fk="linktitle-' + id + '"]');
    var url = (u.value || '').trim();
    if (!url) { u.focus(); return; }
    if (!/^https?:\/\//i.test(url) && /^[\w-]+(\.[\w-]+)+/.test(url)) url = 'https://' + url;
    if (!C.isHttpUrl(url)) { App.toast('That doesn’t look like a link.', { type: 'err' }); return; }
    var title = (ti.value || '').trim();
    u.value = ''; ti.value = '';
    var linkId = C.uid('l');
    App.dispatch({ type: 'addLink', taskId: id, link: { id: linkId, url: url, title: title } });
    if (!title && App.S.mode === 'live' && /google\.com/.test(url)) {
      App.server('driveFileInfo', url).then(function (info) {
        if (info && info.name) App.dispatch({ type: 'updateLink', taskId: id, linkId: linkId, patch: { title: info.name } });
      }).catch(function () { /* keep generic title */ });
    }
  };
  A.removeLink = function (el) { App.dispatch({ type: 'removeLink', taskId: el.dataset.id, linkId: el.dataset.link }); };
  A.driveMenu = function (el) {
    var t = C.task(st(), el.dataset.id);
    function make(kind, label, newUrl) {
      return {
        label: label, icon: kind === 'folder' ? 'folder' : 'docs', fn: function () {
          if (App.S.mode === 'live' && App.S.integrations.drive) {
            App.toast('Creating ' + label.toLowerCase() + ' in Drive…', { icon: '⏳' });
            App.server('driveCreate', t.id, kind, t.title).then(function (res) {
              App.mergeEntities(res.entities);
              App.render();
              App.toast(label + ' created in the task’s Drive folder and attached.', { action: res.url ? { label: 'Open', fn: function () { window.open(res.url, '_blank', 'noopener'); } } : null });
            }).catch(function (err) { App.toast(err.message || String(err), { type: 'err' }); });
          } else if (newUrl) {
            window.open(newUrl, '_blank', 'noopener');
            App.toast('A new ' + label.replace('New ', '') + ' opened in a new tab in your own Drive. Copy its link and paste it under “Docs & links”.', { timeout: 9000 });
            setTimeout(function () { var u = document.querySelector('[data-fk="linkurl-' + t.id + '"]'); if (u) u.focus(); }, 100);
          } else {
            App.toast('Auto-created Drive folders need the Google Apps Script deployment (see tracker/README.md). For now, paste a folder link.', { timeout: 8000 });
          }
        }
      };
    }
    App.menu(el, [make('doc', 'New Google Doc', 'https://docs.new'), make('sheet', 'New Google Sheet', 'https://sheets.new'), make('slides', 'New Google Slides', 'https://slides.new'), make('form', 'New Google Form', 'https://forms.new'), 'sep', make('folder', 'Create a Drive folder for this task', null)]);
  };

  // feed & composer
  A.feedMode = function (el) { App.prefs.set('feedMode', el.dataset.v); App.render(); };
  A.composerMode = function (el) {
    App.S.ui.composerMode[el.dataset.id] = el.dataset.v; App.render();
    var ta = document.querySelector('[data-fk="composer-' + el.dataset.id + '"]'); if (ta) ta.focus();
  };
  A.composerHealth = function (el) { App.S.ui.composerHealth[el.dataset.id] = el.dataset.v; App.render(); };
  A.focusCheckin = function () {
    var t = curTask(); if (!t) return;
    App.S.ui.composerMode[t.id] = 'checkin';
    App.render();
    var ta = document.querySelector('[data-fk="composer-' + t.id + '"]');
    if (ta) { ta.scrollIntoView({ block: 'center', behavior: 'smooth' }); ta.focus(); }
  };
  A.composerInput = function (el) {
    App.S.ui.drafts[el.dataset.draft] = el.value;
    // @mention autocomplete
    var before = el.value.slice(0, el.selectionStart);
    var m = /(^|\s)@([\w'-]*)$/.exec(before);
    if (!m) { App.closePop(); return; }
    var q = m[2].toLowerCase();
    var t = C.task(st(), el.dataset.id);
    var items = App.peopleItems(t && t.team).filter(function (it) { return !q || it.label.toLowerCase().split(' ').some(function (w) { return w.indexOf(q) === 0; }); }).slice(0, 8);
    if (!items.length) { App.closePop(); return; }
    App.pick(el, { items: items, search: false }, function (pid) {
      var name = App.pname(pid);
      var start = before.length - m[2].length - 1;
      el.value = el.value.slice(0, start) + '@' + name + ' ' + el.value.slice(el.selectionStart);
      App.S.ui.drafts[el.dataset.draft] = el.value;
      el.focus();
      var pos = start + name.length + 2;
      el.setSelectionRange(pos, pos);
    });
  };
  A.sendComposer = function (el) {
    var id = el.dataset.id;
    var ta = document.querySelector('[data-fk="composer-' + id + '"]');
    var text = (ta.value || '').trim();
    var mode = App.S.ui.composerMode[id] || 'comment';
    var t = C.task(st(), id);
    if (!C.canEditTask(st(), App.S.meId, t)) mode = 'comment';
    if (mode === 'comment' && !text) { ta.focus(); return; }
    ta.value = '';
    var ok;
    if (mode === 'checkin') {
      ok = App.dispatch({ type: 'checkin', taskId: id, health: App.S.ui.composerHealth[id] || t.health || 'on', text: text });
      if (ok) { App.S.ui.composerMode[id] = 'comment'; App.toast('Check-in posted. Thanks for keeping everyone in the loop!'); }
    } else {
      ok = App.dispatch({ type: 'addComment', taskId: id, text: text });
    }
    if (ok) { delete App.S.ui.drafts['c-' + id]; App.closePop(); App.render(); }
    else ta.value = text;
  };
  A.deleteComment = function (el) {
    App.confirm('Delete this comment?', { ok: 'Delete', danger: true }).then(function (yes) {
      if (yes) App.dispatch({ type: 'deleteComment', taskId: el.dataset.id, commentId: el.dataset.c });
    });
  };
  A.resolveHelp = function (el) {
    if (App.dispatch({ type: 'resolveHelp', taskId: el.dataset.id, helpId: el.dataset.help })) App.toast('Marked resolved. They’ll get a heads-up.');
  };
  A.toggleResolved = function () { App.S.ui.showResolved = !App.S.ui.showResolved; App.render(); };
  A.copyLink = function (el) {
    App.copyText(App.taskUrl(el.dataset.id));
    App.toast('Link copied. Paste it in Slack and it opens straight to this task.');
  };
  A.taskMore = function (el) {
    var t = C.task(st(), el.dataset.id);
    var items = [
      { label: 'Duplicate task', icon: 'copy', fn: function () { duplicate(t); } },
      { label: 'Copy link', icon: 'link', fn: function () { A.copyLink(el); } }
    ];
    if (C.canDeleteTask(st(), App.S.meId, t)) {
      items.push('sep', {
        label: 'Delete task', icon: 'trash', danger: true, fn: function () {
          App.confirm('Delete “' + t.title + '”? Exec can restore it from the spreadsheet if needed.', { ok: 'Delete', danger: true }).then(function (yes) {
            if (yes && App.dispatch({ type: 'deleteTask', id: t.id })) {
              App.closeTask();
              App.toast('Task deleted.', { action: { label: 'Undo', fn: function () { App.dispatch({ type: 'restoreTask', id: t.id }); } } });
            }
          });
        }
      });
    }
    App.menu(el, items);
  };
  function duplicate(t) {
    var copy = {
      id: C.uid('t'), title: t.title + ' (copy)', description: t.description, team: t.team, project: t.project, priority: t.priority,
      owner: t.owner, collaborators: (t.collaborators || []).slice(), startDate: t.startDate, dueDate: t.dueDate,
      steps: (t.steps || []).map(function (s) { return C.newStep(s.text, { assignee: s.assignee, due: s.due }); }),
      links: (t.links || []).map(function (l) { return { id: C.uid('l'), title: l.title, url: l.url, kind: l.kind, addedBy: App.S.meId, at: C.nowIso() }; })
    };
    if (App.dispatch({ type: 'createTask', task: copy })) App.openTask(copy.id);
  }
  A.askHelp = function (el) { App.openHelpModal(el.dataset.id); };
  A.nudge = function (el) { App.openNudgeModal(el.dataset.id); };

  /* ======================= dialogs ======================= */
  function opt(v, label, sel) { return '<option value="' + esc(v) + '"' + (sel ? ' selected' : '') + '>' + esc(label) + '</option>'; }
  function teamOptions(sel, allowAll) {
    return (allowAll ? opt('', allowAll, !sel) : '') + App.views.liveTeams().map(function (t) { return opt(t.id, t.name, t.id === sel); }).join('');
  }
  function personButton(name, pid, placeholder) {
    return '<button type="button" class="btn" style="justify-content:flex-start;width:100%" data-person-field="' + name + '" data-value="' + esc(pid || '') + '">' + App.avatar(pid, 'sm') + '<span>' + esc(pid ? App.pname(pid) : placeholder) + '</span></button>';
  }
  function bindPersonButton(el, teamGetter, allowNone) {
    el.querySelectorAll('[data-person-field]').forEach(function (b) {
      b.addEventListener('click', function () {
        App.pick(b, { items: App.peopleItems(teamGetter(), { allowNone: allowNone }), selected: [b.dataset.value || null] }, function (id) {
          b.dataset.value = id || '';
          b.innerHTML = App.avatar(id, 'sm') + '<span>' + esc(id ? App.pname(id) : 'Unassigned') + '</span>';
        });
      });
    });
  }

  /* ---------- new task ---------- */
  App.openNewTask = function (defaults) {
    defaults = defaults || {};
    var tpl = defaults.template ? C.byId(st().templates, defaults.template) : null;
    var team = defaults.team || (tpl && tpl.team) || App.myTeam();
    var owner = defaults.owner !== undefined ? defaults.owner : App.S.meId;
    var body = '<div class="stack">' +
      '<div><label class="field-label" for="nt-title">Task</label><input id="nt-title" class="input" style="font-size:16px;font-weight:600" placeholder="e.g. Book Ida Noyes for the speaker event" value="' + esc(defaults.title || (tpl ? tpl.name + ': ' : '')) + '" autofocus><div class="hint" style="margin-top:4px">Start with a verb. Shortcuts work here too: <code>@name</code>, <code>#team</code>, <code>!high</code>, <code>due fri</code>.</div></div>' +
      '<div class="grid-2"><div><label class="field-label">Owner (one person)</label>' + personButton('owner', owner, 'Unassigned') + '</div>' +
      '<div><label class="field-label" for="nt-due">Due date</label><input id="nt-due" type="date" class="input" value="' + esc(defaults.dueDate || '') + '"></div></div>' +
      '<div class="grid-2"><div><label class="field-label" for="nt-team">Team</label><select id="nt-team" class="select">' + teamOptions(team) + '</select></div>' +
      '<div><label class="field-label" for="nt-project">Project</label><select id="nt-project" class="select"></select></div></div>' +
      '<div class="grid-2"><div><label class="field-label" for="nt-prio">Priority</label><select id="nt-prio" class="select">' + C.PRIORITIES.map(function (p) { return opt(p.id, p.label, p.id === (defaults.priority || 'med')); }).join('') + '</select></div>' +
      '<div><label class="field-label" for="nt-start">Start date <span class="muted">(optional)</span></label><input id="nt-start" type="date" class="input" value="' + esc(defaults.startDate || '') + '"></div></div>' +
      '<div><label class="field-label" for="nt-tpl">Start from a checklist <span class="muted">(optional)</span></label><select id="nt-tpl" class="select">' + opt('', 'None') + st().templates.filter(function (x) { return !x.deleted; }).map(function (x) { return opt(x.id, x.name + ' (' + (x.steps || []).length + ' steps)', tpl && tpl.id === x.id); }).join('') + '</select><div class="hint" id="nt-tpl-hint" style="margin-top:4px"></div></div>' +
      '<div><label class="field-label" for="nt-desc">Notes <span class="muted">(optional)</span></label><textarea id="nt-desc" class="textarea" placeholder="Context, goal, who requested it…"></textarea></div>' +
      '</div>';
    App.modal({
      title: 'New task', body: body,
      foot: '<span class="hint">Tip: press <kbd>N</kbd> anywhere to open this.</span><span class="spacer"></span><button type="button" class="btn" data-close>Cancel</button><button type="button" class="btn primary" id="nt-go">Create task</button>',
      onMount: function (el, api) {
        var teamSel = el.querySelector('#nt-team'), projSel = el.querySelector('#nt-project'), tplSel = el.querySelector('#nt-tpl');
        function fillProjects() {
          var ps = App.views.liveProjects(teamSel.value);
          projSel.innerHTML = opt('', ps.length ? 'None' : 'No projects for this team') + ps.map(function (p) { return opt(p.id, p.name, p.id === defaults.project); }).join('');
        }
        function tplHint() {
          var x = C.byId(st().templates, tplSel.value);
          el.querySelector('#nt-tpl-hint').textContent = x ? 'Adds ' + (x.steps || []).length + ' steps' + ((x.steps || []).some(function (s) { return typeof s.offsetDays === 'number'; }) ? ', with dates counted back from the due date.' : '.') : '';
        }
        fillProjects(); tplHint();
        teamSel.addEventListener('change', fillProjects);
        tplSel.addEventListener('change', function () {
          tplHint();
          var x = C.byId(st().templates, tplSel.value);
          if (x && x.team && teamSel.value !== x.team) { teamSel.value = x.team; fillProjects(); }
        });
        bindPersonButton(el, function () { return teamSel.value; }, true);
        function go() {
          var raw = el.querySelector('#nt-title').value.trim();
          if (!raw) { el.querySelector('#nt-title').focus(); return; }
          var q = App.parseQuick(raw);
          var f = {
            id: C.uid('t'), title: q.title || raw,
            team: q.team || teamSel.value, project: projSel.value || null,
            owner: q.owner || el.querySelector('[data-person-field=owner]').dataset.value || null,
            dueDate: q.dueDate || el.querySelector('#nt-due').value || null,
            startDate: el.querySelector('#nt-start').value || null,
            priority: q.priority || el.querySelector('#nt-prio').value,
            description: el.querySelector('#nt-desc').value,
            status: defaults.status || 'todo', steps: []
          };
          if (f.project && (C.byId(st().projects, f.project) || {}).team !== f.team) f.project = null;
          var x = C.byId(st().templates, tplSel.value);
          if (x) {
            f.steps = (x.steps || []).map(function (s) { return C.newStep(s.text, { due: f.dueDate && typeof s.offsetDays === 'number' ? C.addDays(f.dueDate, s.offsetDays) : null }); });
            f.links = (x.links || []).map(function (l) { return { id: C.uid('l'), title: l.title, url: l.url, kind: C.linkKind(l.url), addedBy: App.S.meId, at: C.nowIso() }; });
          }
          if (App.dispatch({ type: 'createTask', task: f })) {
            api.close();
            App.openTask(f.id);
            if (!f.owner) App.toast('Created. Remember: every task needs an owner.');
          }
        }
        el.querySelector('#nt-go').onclick = go;
        el.querySelector('#nt-title').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); go(); } });
      }
    });
  };

  /* ---------- ask for help ---------- */
  App.openHelpModal = function (taskId) {
    var t = C.task(st(), taskId);
    if (!t) return;
    var leads = C.teamLeads(st(), t.team).filter(function (p) { return p.id !== App.S.meId; });
    var execs = C.activePeople(st()).filter(function (p) { return p.role === 'exec' && p.id !== App.S.meId; });
    var sugg = leads.concat(execs.slice(0, 3)).filter(function (p, i, arr) { return arr.indexOf(p) === i; }).slice(0, 5);
    var canEdit = C.canEditTask(st(), App.S.meId, t);
    var body = '<p class="hint" style="margin:0 0 12px">On “<b>' + esc(t.title) + '</b>”. They’ll get a Slack DM with a link to this task, and it sits at the top of their <i>My work</i> page until it’s resolved.</p>' +
      '<label class="field-label">Who can help?</label><div class="row wrap-row" style="gap:6px;margin-bottom:8px">' + sugg.map(function (p) { return '<button type="button" class="filter-btn" data-sugg="' + esc(p.id) + '">' + App.avatar(p.id, 'sm') + esc(p.name) + ' <span class="muted" style="font-weight:400">' + esc(p.title || App.roleLabel(p.role)) + '</span></button>'; }).join('') + '</div>' +
      personButton('to', null, 'Choose anyone…') +
      '<label class="field-label" for="hp-msg" style="margin-top:14px">What do you need?</label><textarea id="hp-msg" class="textarea" placeholder="Be specific. e.g. “Can you review the flyer copy by Thursday?” or “Who do I talk to about room booking?”"></textarea>' +
      (canEdit && t.status !== 'blocked' && !C.isDone(t) ? '<label class="row" style="margin-top:10px;font-size:13px;gap:8px"><input type="checkbox" id="hp-block"> Also mark this task as <b>Blocked</b> until they reply</label>' : '');
    App.modal({
      title: 'Ask for help', body: body,
      foot: '<button type="button" class="btn" data-close>Cancel</button><button type="button" class="btn primary" id="hp-go">' + icon('send', 14) + 'Send request</button>',
      onMount: function (el, api) {
        bindPersonButton(el, function () { return t.team; }, false);
        var btn = el.querySelector('[data-person-field=to]');
        el.querySelectorAll('[data-sugg]').forEach(function (b) {
          b.onclick = function () {
            el.querySelectorAll('[data-sugg]').forEach(function (x) { x.classList.remove('on'); });
            b.classList.add('on');
            btn.dataset.value = b.dataset.sugg;
            btn.innerHTML = App.avatar(b.dataset.sugg, 'sm') + '<span>' + esc(App.pname(b.dataset.sugg)) + '</span>';
          };
        });
        el.querySelector('#hp-go').onclick = function () {
          var to = btn.dataset.value;
          if (!to) { App.toast('Pick who you need help from.', { type: 'err' }); return; }
          if (to === App.S.meId) { App.toast('Pick someone other than yourself.', { type: 'err' }); return; }
          var msg = el.querySelector('#hp-msg').value.trim();
          if (App.dispatch({ type: 'requestHelp', taskId: t.id, to: to, message: msg })) {
            var bl = el.querySelector('#hp-block');
            if (bl && bl.checked) upd(t.id, { status: 'blocked' });
            api.close();
            App.toast('Asked ' + App.firstName(to) + ' for help.');
          }
        };
      }
    });
  };

  /* ---------- nudge ---------- */
  App.openNudgeModal = function (taskId) {
    var t = C.task(st(), taskId);
    if (!t || !t.owner) return;
    var first = App.firstName(t.owner);
    App.modal({
      title: 'Nudge ' + first,
      body: '<p class="hint" style="margin:0 0 10px">A friendly reminder to post a check-in on “<b>' + esc(t.title) + '</b>”. ' + (C.isOverdue(t) ? 'It’s overdue. ' : '') + (t.lastCheckinAt ? 'Last check-in ' + App.relTime(t.lastCheckinAt) + '.' : 'No check-ins yet.') + ' They’ll get a Slack DM. You can nudge once every ' + C.NUDGE_COOLDOWN_HOURS + ' hours.</p><textarea id="ng-msg" class="textarea">Hey ' + esc(first) + '! Could you post a quick check-in on this? Even one line helps. Let me know if you need anything 🙂</textarea>',
      foot: '<button type="button" class="btn" data-close>Cancel</button><button type="button" class="btn primary" id="ng-go">' + icon('bell', 14) + 'Send nudge</button>',
      onMount: function (el, api) {
        el.querySelector('#ng-go').onclick = function () {
          if (App.dispatch({ type: 'nudge', taskId: t.id, message: el.querySelector('#ng-msg').value.trim() })) { api.close(); App.toast('Nudged ' + first + '.'); }
        };
      }
    });
  };

  /* ---------- person ---------- */
  App.openPersonModal = function (pid) {
    var p = pid ? C.person(st(), pid) : null;
    var me = App.me();
    var isExec = C.isExec(me);
    var self = p && p.id === me.id;
    var canRoles = isExec || (!self && me.role === 'lead');
    var lockedTeams = !isExec && me.role === 'lead' ? me.teams : null;
    var teams = App.views.liveTeams();
    var pteams = p ? p.teams : (lockedTeams ? lockedTeams.slice(0, 1) : []);
    var body = '<div class="stack"><div class="grid-2"><div><label class="field-label" for="pp-name">Name</label><input id="pp-name" class="input" value="' + esc(p ? p.name : '') + '"></div><div><label class="field-label" for="pp-title">Title</label><input id="pp-title" class="input" placeholder="e.g. Events Lead, AISF Facilitator" value="' + esc(p ? p.title || '' : '') + '"></div></div>' +
      '<div class="grid-2"><div><label class="field-label" for="pp-email">UChicago email</label><input id="pp-email" class="input" type="email" placeholder="cnetid@uchicago.edu" value="' + esc(p ? p.email || '' : '') + '"' + (self && !isExec ? ' disabled' : '') + '><div class="hint" style="margin-top:3px">Used for Google sign-in and Slack DMs.</div></div>' +
      '<div><label class="field-label" for="pp-role">Role</label><select id="pp-role" class="select"' + (canRoles ? '' : ' disabled') + '>' + C.ROLES.map(function (r) { return opt(r.id, r.label, (p ? p.role : 'member') === r.id); }).filter(function (o, i) { return isExec || C.ROLES[i].id === 'member' || (p && p.role === C.ROLES[i].id); }).join('') + '</select></div></div>' +
      '<div><label class="field-label">Teams</label><div class="row wrap-row" style="gap:6px">' + teams.map(function (t) {
        var dis = (self && !isExec) || (lockedTeams && lockedTeams.indexOf(t.id) === -1);
        return '<label class="filter-btn" style="cursor:pointer"><input type="checkbox" value="' + esc(t.id) + '"' + (C.has(pteams, t.id) ? ' checked' : '') + (dis ? ' disabled' : '') + ' style="margin:0"> <span class="team-dot" style="background:' + esc(t.color) + '"></span>' + esc(t.name) + '</label>';
      }).join('') + '</div></div>' +
      '<div><label class="field-label" for="pp-slack">Slack member ID <span class="muted">(optional)</span></label><input id="pp-slack" class="input" placeholder="U01ABCDEF" value="' + esc(p ? p.slackId || '' : '') + '"><div class="hint" style="margin-top:3px">Only needed if their Slack email differs from their UChicago email. Slack → profile → ⋯ → Copy member ID.</div></div></div>';
    var canRemove = p && !self && (isExec || (me.role === 'lead' && C.canEditPerson(st(), me.id, p, {})));
    App.modal({
      title: p ? (self ? 'Your profile' : 'Edit ' + p.name) : 'Add person', body: body,
      foot: (canRemove ? '<button type="button" class="btn danger" id="pp-del">' + icon('trash', 14) + 'Remove from roster</button>' : '') + '<span class="spacer"></span><button type="button" class="btn" data-close>Cancel</button><button type="button" class="btn primary" id="pp-go">Save</button>',
      onMount: function (el, api) {
        el.querySelector('#pp-go').onclick = function () {
          var item = { name: el.querySelector('#pp-name').value.trim(), title: el.querySelector('#pp-title').value.trim(), slackId: el.querySelector('#pp-slack').value.trim() };
          if (!item.name) { App.toast('Name is required.', { type: 'err' }); return; }
          if (p) item.id = p.id;
          if (!(self && !isExec)) {
            item.email = el.querySelector('#pp-email').value.trim().toLowerCase();
            item.teams = Array.prototype.slice.call(el.querySelectorAll('input[type=checkbox]:checked')).map(function (c) { return c.value; });
          }
          if (canRoles) item.role = el.querySelector('#pp-role').value;
          if (!p && !item.role) item.role = 'member';
          if (p && p.sample && (item.email || item.name !== p.name)) item.sample = false;
          if (App.dispatch({ type: 'upsert', coll: 'people', item: item })) { api.close(); App.toast(p ? 'Saved.' : item.name + ' added.'); }
        };
        var del = el.querySelector('#pp-del');
        if (del) del.onclick = function () {
          App.confirm('Remove ' + p.name + ' from the roster? Their tasks stay, but show as theirs until reassigned.', { ok: 'Remove', danger: true }).then(function (yes) {
            if (yes && App.dispatch({ type: 'remove', coll: 'people', id: p.id })) api.close();
          });
        };
      }
    });
  };

  /* ---------- roster import ---------- */
  App.openImportRoster = function () {
    var body = '<p class="hint" style="margin:0 0 10px">Paste one person per line: <code>Name, email, role, teams, title</code>. Role is <b>exec</b>, <b>lead</b> or <b>member</b>. Separate multiple teams with <code>;</code>. Copying straight from a spreadsheet (tab-separated) works too. People already on the roster (same email or name) get updated.</p>' +
      '<textarea id="ir-text" class="textarea" style="min-height:180px;font-family:ui-monospace,Menlo,monospace;font-size:12.5px" placeholder="Jane Doe, jdoe@uchicago.edu, exec, Exec, Co-President\nJohn Smith, jsmith@uchicago.edu, lead, Events, Events Lead\nAlex Lee, alee@uchicago.edu, member, Research; Fellowships, Facilitator"></textarea>' +
      '<div id="ir-preview" class="hint" style="margin-top:8px"></div>' +
      (C.activePeople(st()).some(function (p) { return p.sample; }) ? '<label class="row" style="margin-top:10px;font-size:13px;gap:8px"><input type="checkbox" id="ir-samples" checked> Remove the sample people after importing</label>' : '');
    App.modal({
      title: 'Import roster', cls: 'wide', body: body,
      foot: '<button type="button" class="btn" data-close>Cancel</button><button type="button" class="btn primary" id="ir-go">Import</button>',
      onMount: function (el, api) {
        var ta = el.querySelector('#ir-text');
        function parse() {
          return ta.value.split('\n').map(function (line) { return line.trim(); }).filter(Boolean).map(function (line) {
            var parts = (line.indexOf('\t') !== -1 ? line.split('\t') : line.split(',')).map(function (s) { return s.trim(); });
            var role = (parts[2] || 'member').toLowerCase();
            role = /exec|president|chair|director/.test(role) ? 'exec' : /lead/.test(role) ? 'lead' : 'member';
            var teams = (parts[3] || '').split(/[;|/]/).map(function (s) { return s.trim().toLowerCase(); }).filter(Boolean).map(function (name) {
              var t = App.views.liveTeams().filter(function (x) { return x.id === name || x.name.toLowerCase() === name || x.name.toLowerCase().indexOf(name) === 0 || name.indexOf(x.name.toLowerCase()) === 0; })[0];
              return t ? t.id : null;
            }).filter(Boolean);
            if (role === 'exec' && teams.indexOf('exec') === -1) teams.unshift('exec');
            return { name: parts[0], email: (parts[1] || '').toLowerCase(), role: role, teams: teams, title: parts[4] || '' };
          }).filter(function (r) { return r.name; });
        }
        ta.addEventListener('input', function () {
          var rows = parse();
          el.querySelector('#ir-preview').innerHTML = rows.length ? '<b>' + rows.length + ' people:</b> ' + rows.map(function (r) { return esc(r.name) + ' <span class="muted">(' + r.role + (r.teams.length ? ', ' + r.teams.join('/') : ', no team!') + ')</span>'; }).join(' · ') : '';
        });
        el.querySelector('#ir-go').onclick = function () {
          var rows = parse();
          if (!rows.length) { App.toast('Nothing to import.', { type: 'err' }); return; }
          var n = 0;
          rows.forEach(function (r) {
            var ex = (r.email && C.personByEmail(st(), r.email)) || C.activePeople(st()).filter(function (p) { return p.name.toLowerCase() === r.name.toLowerCase(); })[0];
            var item = { name: r.name, role: r.role, teams: r.teams, title: r.title, sample: false };
            if (r.email) item.email = r.email;
            if (ex) item.id = ex.id;
            if (App.dispatch({ type: 'upsert', coll: 'people', item: item }, { quiet: true })) n++;
          });
          var rm = el.querySelector('#ir-samples');
          if (rm && rm.checked) removeSamples();
          api.close();
          App.toast('Imported ' + App.plural(n, 'person', 'people') + '.');
        };
      }
    });
  };
  function removeSamples() {
    C.activePeople(st()).filter(function (p) { return p.sample; }).forEach(function (p) {
      if (p.id !== App.S.meId) App.dispatch({ type: 'remove', coll: 'people', id: p.id }, { quiet: true });
    });
  }
  App.removeSamples = removeSamples;

  /* ---------- team ---------- */
  App.openTeamModal = function (tid) {
    var t = tid ? C.team(st(), tid) : null;
    var body = '<div class="stack"><div class="grid-2"><div><label class="field-label" for="tm-name">Team name</label><input id="tm-name" class="input" value="' + esc(t ? t.name : '') + '"></div><div><label class="field-label" for="tm-color">Color</label><input id="tm-color" type="color" class="input" style="height:38px;padding:3px" value="' + esc(t ? t.color : '#64748b') + '"></div></div>' +
      '<div><label class="field-label" for="tm-desc">What this team does</label><textarea id="tm-desc" class="textarea">' + esc(t ? t.description || '' : '') + '</textarea></div>' +
      '<div class="grid-2"><div><label class="field-label" for="tm-slack">Slack channel ID</label><input id="tm-slack" class="input" placeholder="C0123ABCD" value="' + esc(t ? t.slackChannel || '' : '') + '"><div class="hint" style="margin-top:3px">In Slack: open the channel → name → bottom of the About tab. Invite the tracker bot to the channel.</div></div>' +
      '<div><label class="field-label" for="tm-drive">Team Drive folder link</label><input id="tm-drive" class="input" placeholder="https://drive.google.com/drive/folders/…" value="' + esc(t ? t.driveFolderUrl || '' : '') + '"><div class="hint" style="margin-top:3px">New task folders for this team are created inside it.</div></div></div></div>';
    App.modal({
      title: t ? 'Edit ' + t.name : 'Add team', body: body,
      foot: (t ? '<button type="button" class="btn danger" id="tm-del">' + icon('trash', 14) + 'Remove team</button>' : '') + '<span class="spacer"></span><button type="button" class="btn" data-close>Cancel</button><button type="button" class="btn primary" id="tm-go">Save</button>',
      onMount: function (el, api) {
        el.querySelector('#tm-go').onclick = function () {
          var name = el.querySelector('#tm-name').value.trim();
          if (!name) { App.toast('Name is required.', { type: 'err' }); return; }
          var drive = el.querySelector('#tm-drive').value.trim();
          if (drive && !C.isHttpUrl(drive)) { App.toast('Drive folder should be a link.', { type: 'err' }); return; }
          var item = { name: name, color: el.querySelector('#tm-color').value, description: el.querySelector('#tm-desc').value.trim(), slackChannel: el.querySelector('#tm-slack').value.trim(), driveFolderUrl: drive };
          item.id = t ? t.id : name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || C.uid('team');
          if (!t && C.team(st(), item.id)) item.id = C.uid('team');
          if (App.dispatch({ type: 'upsert', coll: 'teams', item: item })) api.close();
        };
        var del = el.querySelector('#tm-del');
        if (del) del.onclick = function () {
          App.confirm('Remove the ' + t.name + ' team? Its tasks stay but you should move them to another team first.', { ok: 'Remove', danger: true }).then(function (yes) {
            if (yes && App.dispatch({ type: 'remove', coll: 'teams', id: t.id })) { api.close(); App.go('#/settings'); }
          });
        };
      }
    });
  };

  /* ---------- project ---------- */
  App.openProjectModal = function (prid, teamId, onCreated) {
    var p = prid ? C.byId(st().projects, prid) : null;
    var team = p ? p.team : teamId || App.myTeam();
    var body = '<div class="stack"><div><label class="field-label" for="pj-name">Project name</label><input id="pj-name" class="input" placeholder="e.g. Winter Speaker Series" value="' + esc(p ? p.name : '') + '"></div>' +
      '<div class="grid-2"><div><label class="field-label" for="pj-team">Team</label><select id="pj-team" class="select">' + teamOptions(team) + '</select></div><div><label class="field-label" for="pj-color">Color</label><input id="pj-color" type="color" class="input" style="height:38px;padding:3px" value="' + esc(p ? p.color || '#64748b' : (C.team(st(), team) || {}).color || '#64748b') + '"></div></div>' +
      '<div class="grid-2"><div><label class="field-label" for="pj-start">Start</label><input id="pj-start" type="date" class="input" value="' + esc(p ? p.startDate || '' : '') + '"></div><div><label class="field-label" for="pj-due">Target date</label><input id="pj-due" type="date" class="input" value="' + esc(p ? p.dueDate || '' : '') + '"></div></div>' +
      '<div><label class="field-label" for="pj-desc">Goal / description</label><textarea id="pj-desc" class="textarea">' + esc(p ? p.description || '' : '') + '</textarea></div></div>';
    App.modal({
      title: p ? 'Edit project' : 'New project', body: body,
      foot: (p ? '<button type="button" class="btn" id="pj-arch">Archive</button>' : '') + '<span class="spacer"></span><button type="button" class="btn" data-close>Cancel</button><button type="button" class="btn primary" id="pj-go">Save</button>',
      onMount: function (el, api) {
        el.querySelector('#pj-go').onclick = function () {
          var name = el.querySelector('#pj-name').value.trim();
          if (!name) { App.toast('Name is required.', { type: 'err' }); return; }
          var item = { id: p ? p.id : C.uid('pr'), name: name, team: el.querySelector('#pj-team').value, color: el.querySelector('#pj-color').value, startDate: el.querySelector('#pj-start').value || null, dueDate: el.querySelector('#pj-due').value || null, description: el.querySelector('#pj-desc').value.trim() };
          if (App.dispatch({ type: 'upsert', coll: 'projects', item: item })) {
            api.close();
            if (onCreated) onCreated(item.id); else if (!p) App.go('#/project/' + item.id);
          }
        };
        var ar = el.querySelector('#pj-arch');
        if (ar) ar.onclick = function () {
          if (App.dispatch({ type: 'upsert', coll: 'projects', item: { id: p.id, archived: true } })) { api.close(); App.go('#/team/' + p.team); App.toast('Project archived. Its tasks are still on the team page.'); }
        };
      }
    });
  };

  /* ---------- checklist template ---------- */
  App.openTemplateModal = function (id) {
    var x = id ? C.byId(st().templates, id) : null;
    var lines = x ? (x.steps || []).map(function (s) { return s.text + (typeof s.offsetDays === 'number' ? ' (' + s.offsetDays + ')' : ''); }).join('\n') : '';
    var body = '<div class="stack"><div class="grid-2"><div><label class="field-label" for="tp-name">Checklist name</label><input id="tp-name" class="input" placeholder="e.g. Speaker event" value="' + esc(x ? x.name : '') + '"></div><div><label class="field-label" for="tp-team">Team</label><select id="tp-team" class="select">' + teamOptions(x ? x.team : App.myTeam(), 'All teams') + '</select></div></div>' +
      '<div><label class="field-label" for="tp-desc">When to use it</label><input id="tp-desc" class="input" value="' + esc(x ? x.description || '' : '') + '"></div>' +
      '<div><label class="field-label" for="tp-steps">Steps, one per line</label><textarea id="tp-steps" class="textarea" style="min-height:200px" placeholder="Book room (-21)\nSend flyer to Marketing (-14)\nEvent day (0)\nThank-you email (1)">' + esc(lines) + '</textarea><div class="hint" style="margin-top:3px">Optional: end a line with <code>(-7)</code> to set that step’s due date 7 days before the task’s due date, <code>(0)</code> for the same day, <code>(2)</code> for 2 days after.</div></div></div>';
    App.modal({
      title: x ? 'Edit checklist' : 'New checklist', cls: 'wide', body: body,
      foot: (x ? '<button type="button" class="btn danger" id="tp-del">' + icon('trash', 14) + 'Delete</button>' : '') + '<span class="spacer"></span><button type="button" class="btn" data-close>Cancel</button><button type="button" class="btn primary" id="tp-go">Save checklist</button>',
      onMount: function (el, api) {
        el.querySelector('#tp-go').onclick = function () {
          var name = el.querySelector('#tp-name').value.trim();
          if (!name) { App.toast('Name is required.', { type: 'err' }); return; }
          var steps = el.querySelector('#tp-steps').value.split('\n').map(function (l) { return l.trim().replace(/^[-*•]\s*|^\d+[.)]\s*|^\[[ x]\]\s*/i, ''); }).filter(Boolean).map(function (l) {
            var m = /\s*\(([+-]?\d+)d?\)\s*$/.exec(l);
            return m ? { text: l.slice(0, m.index).trim(), offsetDays: +m[1] } : { text: l };
          });
          if (!steps.length) { App.toast('Add at least one step.', { type: 'err' }); return; }
          var item = { id: x ? x.id : C.uid('tpl'), name: name, team: el.querySelector('#tp-team').value || null, description: el.querySelector('#tp-desc').value.trim(), steps: steps, links: x ? x.links || [] : [] };
          if (App.dispatch({ type: 'upsert', coll: 'templates', item: item })) api.close();
        };
        var del = el.querySelector('#tp-del');
        if (del) del.onclick = function () { App.confirm('Delete the “' + x.name + '” checklist? Tasks that already used it keep their steps.', { ok: 'Delete', danger: true }).then(function (y) { if (y && App.dispatch({ type: 'remove', coll: 'templates', id: x.id })) api.close(); }); };
      }
    });
  };

  /* ---------- shared doc / resource ---------- */
  App.openResourceModal = function (id, teamId) {
    var r = id ? C.byId(st().resources, id) : null;
    var cats = {};
    st().resources.forEach(function (x) { if (!x.deleted && x.category) cats[x.category] = 1; });
    ['Handbook', 'How-to', 'Budget', 'Brand', 'Curriculum', 'Reference', 'Templates'].forEach(function (c) { cats[c] = 1; });
    var body = '<div class="stack"><div><label class="field-label" for="rs-url">Link</label><input id="rs-url" class="input" placeholder="https://docs.google.com/…" value="' + esc(r ? r.url : '') + '"></div>' +
      '<div><label class="field-label" for="rs-title">Title</label><input id="rs-title" class="input" placeholder="e.g. Events handbook" value="' + esc(r ? r.title : '') + '"></div>' +
      '<div class="grid-2"><div><label class="field-label" for="rs-team">Team</label><select id="rs-team" class="select">' + teamOptions(r ? r.team : teamId || '', 'Everyone') + '</select></div><div><label class="field-label" for="rs-cat">Category</label><input id="rs-cat" class="input" list="rs-cats" value="' + esc(r ? r.category || '' : '') + '"><datalist id="rs-cats">' + Object.keys(cats).sort().map(function (c) { return '<option value="' + esc(c) + '">'; }).join('') + '</datalist></div></div>' +
      '<div><label class="field-label" for="rs-note">Short description</label><input id="rs-note" class="input" placeholder="What is it, when do you need it?" value="' + esc(r ? r.note || '' : '') + '"></div>' +
      '<label class="row" style="font-size:13px;gap:8px"><input type="checkbox" id="rs-pin"' + (r && r.pinned ? ' checked' : '') + '> 📌 Pin to the top</label></div>';
    App.modal({
      title: r ? 'Edit shared doc' : 'Add a shared doc or link', body: body,
      foot: (r ? '<button type="button" class="btn danger" id="rs-del">' + icon('trash', 14) + 'Remove</button>' : '') + '<span class="spacer"></span><button type="button" class="btn" data-close>Cancel</button><button type="button" class="btn primary" id="rs-go">Save</button>',
      onMount: function (el, api) {
        var urlIn = el.querySelector('#rs-url'), titleIn = el.querySelector('#rs-title');
        urlIn.addEventListener('blur', function () {
          var u = urlIn.value.trim();
          if (u && !titleIn.value.trim() && App.S.mode === 'live' && /google\.com/.test(u)) {
            App.server('driveFileInfo', u).then(function (info) { if (info && info.name && !titleIn.value.trim()) titleIn.value = info.name; }).catch(function () { });
          }
        });
        el.querySelector('#rs-go').onclick = function () {
          var url = urlIn.value.trim();
          if (!C.isHttpUrl(url)) { App.toast('Enter a full link starting with https://', { type: 'err' }); return; }
          var item = { id: r ? r.id : C.uid('r'), url: url, title: titleIn.value.trim() || C.titleFromUrl(url), team: el.querySelector('#rs-team').value || null, category: el.querySelector('#rs-cat').value.trim() || 'General', note: el.querySelector('#rs-note').value.trim(), pinned: el.querySelector('#rs-pin').checked };
          if (App.dispatch({ type: 'upsert', coll: 'resources', item: item })) api.close();
        };
        var del = el.querySelector('#rs-del');
        if (del) del.onclick = function () { if (App.dispatch({ type: 'remove', coll: 'resources', id: r.id })) api.close(); };
      }
    });
  };

  /* ---------- welcome ---------- */
  App.openWelcome = function () {
    var demo = App.S.mode === 'demo';
    var body = '<p style="margin:0;line-height:1.55;color:var(--ink-2)">One place for every team’s tasks, timelines, checklists, docs and notes, so nothing lives only in someone’s DMs. It only works if we all use it, so here’s the whole system:</p>' +
      '<div class="welcome-habits">' +
      '<div class="habit"><span class="hn">1</span><div><b>Every task has one owner and a due date.</b><span>Collaborators can help, but one name is accountable. Unowned tasks get flagged.</span></div></div>' +
      '<div class="habit"><span class="hn">2</span><div><b>Check in weekly.</b><span>Post a 1-line check-in (on track / at risk / off track) on each task you own. After ' + C.STALE_DAYS + ' days without one, the task is flagged for your lead.</span></div></div>' +
      '<div class="habit"><span class="hn">3</span><div><b>Stuck? Ask for help in the task.</b><span>The person gets a Slack DM and it stays on their list until resolved. No more “did you see my message?”</span></div></div>' +
      '<div class="habit"><span class="hn">4</span><div><b>Docs, links and notes go in the task.</b><span>Attach the Doc, paste the Canva link, write the decision down. Future you (and next year’s board) will thank you.</span></div></div>' +
      '</div>' +
      (demo ? '<div class="banner info" style="margin-top:14px">' + icon('help', 15) + '<span><b>This is a demo</b> with sample people and tasks, saved only in your browser. Click your name (bottom left) to see the tracker as an exec, a team lead or a member.</span></div>' : '') +
      '<div class="hint" style="margin-top:6px">Shortcuts: <kbd>N</kbd> new task · <kbd>/</kbd> or <kbd>⌘K</kbd> search · <kbd>?</kbd> all shortcuts</div>';
    App.modal({
      title: 'Welcome to the AI Safety team tracker 👋', body: body,
      foot: '<button type="button" class="btn primary" data-close>Let’s go</button>',
      onClose: function () { App.prefs.set('welcomed', '1'); }
    });
  };

  App.openShortcuts = function () {
    var rows = [['N', 'New task'], ['/ or ⌘K', 'Search tasks, people and pages'], ['G then H', 'Go to My work'], ['G then I', 'Go to Inbox'], ['G then D', 'Go to Dashboard'], ['Esc', 'Close panel or dialog'], ['⌘/Ctrl + Enter', 'Send comment or check-in'], ['?', 'This list']];
    App.modal({ title: 'Keyboard shortcuts', body: '<table class="table">' + rows.map(function (r) { return '<tr><td style="width:150px"><kbd>' + esc(r[0]) + '</kbd></td><td>' + esc(r[1]) + '</td></tr>'; }).join('') + '</table>', foot: '<button type="button" class="btn" data-close>Close</button>' });
  };

  /* ---------- command palette ---------- */
  App.openPalette = function () {
    App.modal({
      cls: 'palette', body: '<input id="pal-q" placeholder="Search tasks, people, teams, projects, or type a command…" autocomplete="off"><div class="pop-list" id="pal-list"></div>',
      onMount: function (el, api) {
        el.querySelector('.modal-body').style.padding = '0';
        var input = el.querySelector('#pal-q'), list = el.querySelector('#pal-list');
        var hl = 0, results = [];
        var pages = [['My work', '#/home', 'home'], ['Inbox', '#/inbox', 'inbox'], ['Dashboard', '#/dashboard', 'chart'], ['All tasks', '#/all', 'list'], ['Docs & checklists', '#/docs', 'docs'], ['People', '#/people', 'people'], ['Settings', '#/settings', 'settings']];
        function draw() {
          var q = input.value.trim().toLowerCase();
          results = [];
          results.push({ label: 'Create a new task' + (q ? ': “' + input.value.trim() + '”' : ''), icon: 'plus', fn: function () { App.openNewTask({ title: input.value.trim() }); } });
          pages.forEach(function (p) { if (!q || p[0].toLowerCase().indexOf(q) !== -1) results.push({ label: p[0], sub: 'Page', icon: p[2], fn: function () { App.go(p[1]); } }); });
          App.views.liveTeams().forEach(function (t) { if (!q || t.name.toLowerCase().indexOf(q) !== -1) results.push({ label: t.name, sub: 'Team', html: '<span class="team-dot" style="background:' + esc(t.color) + '"></span>', fn: function () { App.go('#/team/' + t.id); } }); });
          if (q) {
            App.views.liveProjects().forEach(function (p) { if (p.name.toLowerCase().indexOf(q) !== -1) results.push({ label: p.name, sub: 'Project', icon: 'target', fn: function () { App.go('#/project/' + p.id); } }); });
            C.activePeople(st()).forEach(function (p) { if (p.name.toLowerCase().indexOf(q) !== -1) results.push({ label: p.name, sub: p.title || 'Person', html: App.avatar(p.id, 'sm'), fn: function () { App.go('#/person/' + p.id); } }); });
            C.activeTasks(st()).filter(function (t) { return (t.title + ' ' + (t.description || '')).toLowerCase().indexOf(q) !== -1; }).sort(C.compareTasks).slice(0, 30).forEach(function (t) {
              results.push({ label: t.title, sub: (C.isDone(t) ? '✓ ' : '') + (C.team(st(), t.team) || {}).name, html: App.avatar(t.owner, 'sm'), fn: function () { App.openTask(t.id); } });
            });
          }
          hl = Math.min(hl, results.length - 1);
          list.innerHTML = results.map(function (r, i) { return '<button type="button" class="pop-item' + (i === hl ? ' hl' : '') + '" data-i="' + i + '">' + (r.html || icon(r.icon || 'search', 15)) + '<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(r.label) + '</span>' + (r.sub ? '<span class="sub">' + esc(r.sub) + '</span>' : '') + '</button>'; }).join('');
          var cur = list.querySelector('.hl'); if (cur) cur.scrollIntoView({ block: 'nearest' });
        }
        function choose(i) { var r = results[i]; if (!r) return; api.close(); r.fn(); }
        input.addEventListener('input', function () { hl = input.value.trim() ? 1 : 0; draw(); });
        input.addEventListener('keydown', function (e) {
          if (e.key === 'ArrowDown') { hl = Math.min(results.length - 1, hl + 1); draw(); e.preventDefault(); }
          else if (e.key === 'ArrowUp') { hl = Math.max(0, hl - 1); draw(); e.preventDefault(); }
          else if (e.key === 'Enter') { choose(hl); e.preventDefault(); }
        });
        list.addEventListener('click', function (e) { var b = e.target.closest('.pop-item'); if (b) choose(+b.dataset.i); });
        draw();
      }
    });
  };
})(App);
