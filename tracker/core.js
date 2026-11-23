/* ==========================================================================
   Tracker core: data model, permissions and every state change.

   This file runs in two places:
     1. the browser (tracker/index.html), and
     2. the Google Apps Script backend (copied to Core.gs by the build script).
   Keep it free of DOM and Apps Script APIs so both can use it. All changes to
   the data go through applyOp(), so the server can re-run exactly the same
   permission checks and logic the browser ran optimistically.
   ========================================================================== */
var TrackerCore = (function () {
  'use strict';

  var STATUSES = [
    { id: 'todo', label: 'Not started', color: '#7a808a' },
    { id: 'doing', label: 'In progress', color: '#2563eb' },
    { id: 'blocked', label: 'Blocked', color: '#dc2626' },
    { id: 'review', label: 'In review', color: '#9333ea' },
    { id: 'done', label: 'Done', color: '#16a34a' }
  ];
  var PRIORITIES = [
    { id: 'low', label: 'Low', color: '#94a3b8', rank: 0 },
    { id: 'med', label: 'Medium', color: '#0ea5e9', rank: 1 },
    { id: 'high', label: 'High', color: '#f59e0b', rank: 2 },
    { id: 'urgent', label: 'Urgent', color: '#dc2626', rank: 3 }
  ];
  var HEALTH = [
    { id: 'on', label: 'On track', color: '#16a34a' },
    { id: 'risk', label: 'At risk', color: '#f59e0b' },
    { id: 'off', label: 'Off track', color: '#dc2626' }
  ];
  var ROLES = [
    { id: 'exec', label: 'Exec' },
    { id: 'lead', label: 'Team lead' },
    { id: 'member', label: 'Member' }
  ];
  var COLLECTIONS = ['teams', 'people', 'projects', 'tasks', 'templates', 'resources'];
  // A task with no check-in for this many days is flagged as needing an update.
  var STALE_DAYS = 7;
  // Owners can be nudged at most once per this many hours.
  var NUDGE_COOLDOWN_HOURS = 12;

  /* ---------- small utilities ---------- */
  function uid(prefix) {
    return (prefix || 'x') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }
  function nowIso() { return new Date().toISOString(); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function dateKey(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function todayKey() { return dateKey(new Date()); }
  function parseDateKey(k) {
    if (!k) return null;
    var p = String(k).split('-');
    return new Date(+p[0], +p[1] - 1, +p[2]);
  }
  function addDays(k, n) {
    var d = parseDateKey(k); d.setDate(d.getDate() + n); return dateKey(d);
  }
  function daysBetween(a, b) {
    // whole days from date key a to date key b
    return Math.round((parseDateKey(b) - parseDateKey(a)) / 86400000);
  }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function byId(list, id) {
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }
  function find(list, fn) {
    for (var i = 0; i < list.length; i++) if (fn(list[i])) return list[i];
    return null;
  }
  function has(arr, v) { return !!arr && arr.indexOf(v) !== -1; }
  function trimStr(s, max) { s = String(s == null ? '' : s).trim(); return max ? s.slice(0, max) : s; }
  function isHttpUrl(u) { return /^https?:\/\/[^\s]+$/i.test(String(u || '').trim()); }

  function emptyState() {
    return { teams: [], people: [], projects: [], tasks: [], templates: [], resources: [], meta: {} };
  }

  /* ---------- look-ups ---------- */
  function person(state, id) { return byId(state.people, id); }
  function team(state, id) { return byId(state.teams, id); }
  function task(state, id) { return byId(state.tasks, id); }
  function personByEmail(state, email) {
    if (!email) return null;
    email = String(email).toLowerCase();
    return find(state.people, function (p) { return !p.deleted && p.email && p.email.toLowerCase() === email; });
  }
  function activePeople(state) { return state.people.filter(function (p) { return !p.deleted; }); }
  function activeTasks(state) { return state.tasks.filter(function (t) { return !t.deleted; }); }
  function teamLeads(state, teamId) {
    // Leads of a team; exec members count as leads of any team they are listed on (e.g. the Exec team).
    return activePeople(state).filter(function (p) { return (p.role === 'lead' || p.role === 'exec') && has(p.teams, teamId); });
  }
  function teamMembers(state, teamId) {
    return activePeople(state).filter(function (p) { return has(p.teams, teamId); });
  }
  function isExec(p) { return !!p && p.role === 'exec'; }
  function isLeadOf(p, teamId) { return !!p && p.role === 'lead' && has(p.teams, teamId); }

  /* ---------- permissions ----------
     Everyone can see everything (transparency is the point). Editing is open to
     the task's team, its owner/collaborators and its creator; exec can do anything. */
  function canEditTask(state, pid, t) {
    var p = person(state, pid);
    if (!p || !t) return false;
    if (isExec(p)) return true;
    if (t.owner === pid || t.createdBy === pid || has(t.collaborators, pid)) return true;
    return has(p.teams, t.team);
  }
  function canDeleteTask(state, pid, t) {
    var p = person(state, pid);
    if (!p || !t) return false;
    return isExec(p) || isLeadOf(p, t.team) || t.createdBy === pid;
  }
  function canToggleStep(state, pid, t, step) {
    return canEditTask(state, pid, t) || (!!step && step.assignee === pid);
  }
  function canManagePeople(state, pid) {
    var p = person(state, pid);
    return !!p && (p.role === 'exec' || p.role === 'lead');
  }
  function canEditPerson(state, pid, target, patch) {
    var p = person(state, pid);
    if (!p) return false;
    if (isExec(p)) return true;
    var touchesRole = patch && ('role' in patch || 'teams' in patch || 'email' in patch);
    if (target && target.id === pid && !touchesRole) return true;
    if (p.role === 'lead') {
      // Leads manage members of their own teams, but cannot promote anyone.
      if (patch && patch.role && patch.role !== 'member') return false;
      if (target && target.role && target.role !== 'member') return false;
      var teams = (patch && patch.teams) || (target && target.teams) || [];
      return teams.length > 0 && teams.every(function (tid) { return has(p.teams, tid); });
    }
    return false;
  }
  function canEditProject(state, pid, proj) {
    var p = person(state, pid);
    return !!p && (isExec(p) || (proj && isLeadOf(p, proj.team)) || (proj && proj.createdBy === pid));
  }
  function canEditShared(state, pid, item) {
    // templates and resources: anyone can add; creator, exec and that team's lead can change
    var p = person(state, pid);
    if (!p) return false;
    if (!item || !item.createdBy) return true;
    return isExec(p) || item.createdBy === pid || (item.team && isLeadOf(p, item.team));
  }

  /* ---------- derived values ---------- */
  function isDone(t) { return t.status === 'done'; }
  function isOverdue(t, today) {
    return !isDone(t) && !!t.dueDate && t.dueDate < (today || todayKey());
  }
  function lastTouch(t) {
    return t.lastCheckinAt || t.createdAt;
  }
  function staleDays(t) {
    if (isDone(t) || t.status === 'todo') return 0;
    var last = lastTouch(t);
    if (!last) return 0;
    return Math.floor((Date.now() - new Date(last).getTime()) / 86400000);
  }
  function isStale(t) { return staleDays(t) >= STALE_DAYS; }
  function stepProgress(t) {
    var steps = t.steps || [];
    var done = steps.filter(function (s) { return s.done; }).length;
    return { done: done, total: steps.length, pct: steps.length ? Math.round(100 * done / steps.length) : (isDone(t) ? 100 : 0) };
  }
  function openHelp(t) { return (t.help || []).filter(function (h) { return h.status === 'open'; }); }
  function involves(t, pid) {
    if (t.owner === pid || has(t.collaborators, pid)) return true;
    return (t.steps || []).some(function (s) { return s.assignee === pid && !s.done; });
  }
  function dueBucket(t, today) {
    today = today || todayKey();
    if (isDone(t)) return 'done';
    if (!t.dueDate) return 'nodate';
    var d = daysBetween(today, t.dueDate);
    if (d < 0) return 'overdue';
    if (d === 0) return 'today';
    if (d <= 7) return 'week';
    return 'later';
  }
  function priorityRank(id) {
    var p = find(PRIORITIES, function (x) { return x.id === id; });
    return p ? p.rank : 1;
  }
  function compareTasks(a, b) {
    // Undated tasks last; then by due date, then priority (highest first), then title.
    if (isDone(a) !== isDone(b)) return isDone(a) ? 1 : -1;
    var ad = a.dueDate || '9999', bd = b.dueDate || '9999';
    if (ad !== bd) return ad < bd ? -1 : 1;
    var pr = priorityRank(b.priority) - priorityRank(a.priority);
    if (pr) return pr;
    return String(a.title).localeCompare(String(b.title));
  }
  function mentionsIn(state, text) {
    // @First or @First Last (matches against people's names, longest match wins)
    var ids = [];
    if (!text || text.indexOf('@') === -1) return ids;
    var lower = text.toLowerCase();
    var people = activePeople(state).slice().sort(function (a, b) { return b.name.length - a.name.length; });
    people.forEach(function (p) {
      var full = '@' + p.name.toLowerCase();
      var first = '@' + p.name.split(' ')[0].toLowerCase();
      var hit = lower.indexOf(full) !== -1;
      if (!hit) {
        var re = new RegExp(first.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![a-z])');
        hit = re.test(lower);
      }
      if (hit && ids.indexOf(p.id) === -1) ids.push(p.id);
    });
    return ids;
  }

  /* ---------- constructors ---------- */
  function newTask(fields, actorId) {
    var at = nowIso();
    var t = {
      id: uid('t'), title: '', description: '', team: null, project: null,
      status: 'todo', priority: 'med', owner: null, collaborators: [],
      startDate: null, dueDate: null, steps: [], links: [], help: [], feed: [],
      health: null, lastCheckinAt: null, lastNudgeAt: null,
      createdBy: actorId || null, createdAt: at, updatedAt: at, completedAt: null, deleted: false
    };
    for (var k in fields) if (Object.prototype.hasOwnProperty.call(fields, k)) t[k] = fields[k];
    return t;
  }
  function newStep(text, extra) {
    var s = { id: uid('s'), text: trimStr(text, 500), done: false, assignee: null, due: null, doneAt: null, doneBy: null };
    if (extra) for (var k in extra) s[k] = extra[k];
    return s;
  }
  function linkKind(url) {
    url = String(url || '');
    if (/docs\.google\.com\/document/.test(url)) return 'doc';
    if (/docs\.google\.com\/spreadsheets/.test(url)) return 'sheet';
    if (/docs\.google\.com\/presentation/.test(url)) return 'slides';
    if (/docs\.google\.com\/forms|forms\.gle/.test(url)) return 'form';
    if (/drive\.google\.com\/drive\/(u\/\d+\/)?folders/.test(url)) return 'folder';
    if (/drive\.google\.com/.test(url)) return 'drive';
    if (/slack\.com/.test(url)) return 'slack';
    if (/calendar\.google\.com|calendar\.app\.google/.test(url)) return 'calendar';
    if (/\.pdf(\?|#|$)/i.test(url)) return 'pdf';
    if (/github\.com/.test(url)) return 'github';
    if (/notion\.(so|site)/.test(url)) return 'notion';
    if (/canva\.com|figma\.com/.test(url)) return 'design';
    return 'link';
  }
  function titleFromUrl(url) {
    try {
      var m = String(url).match(/^https?:\/\/([^/]+)(\/[^?#]*)?/i);
      if (!m) return url;
      var host = m[1].replace(/^www\./, '');
      var kind = linkKind(url);
      var names = { doc: 'Google Doc', sheet: 'Google Sheet', slides: 'Google Slides', form: 'Google Form', folder: 'Drive folder', drive: 'Drive file' };
      if (names[kind]) return names[kind];
      var last = (m[2] || '').split('/').filter(Boolean).pop();
      return last ? host + ' / ' + decodeURIComponent(last).slice(0, 40) : host;
    } catch (e) { return url; }
  }

  /* ---------- applyOp ----------
     Every change is an op: { type, ... }. Returns
       { ok: true, changed: [{coll, id}], events: [...] }  or  { ok: false, error }.
     Events describe who should hear about the change; the server turns them into
     Slack messages, and the browser shows them in Inbox. */
  function fail(msg) { return { ok: false, error: msg }; }

  function applyOp(state, op, actorId) {
    try {
      return applyOpInner(state, op, actorId);
    } catch (e) {
      return fail(e && e.message ? e.message : String(e));
    }
  }

  function applyOpInner(state, op, actorId) {
    var at = nowIso();
    var changed = [];
    var events = [];
    var actor = person(state, actorId);
    if (!op || !op.type) return fail('Malformed change.');
    if (!actor && op.type !== 'join') return fail('You are not on the roster yet.');

    function touch(coll, item) {
      item.updatedAt = at;
      changed.push({ coll: coll, id: item.id });
    }
    function log(t, entry) {
      entry.id = entry.id || uid('f');
      entry.by = actorId;
      entry.at = at;
      t.feed = t.feed || [];
      t.feed.push(entry);
      // keep the sheet cell well under Google's 50k character limit
      if (t.feed.length > 300) t.feed = t.feed.slice(-300);
    }
    function emit(type, t, to, extra) {
      to = (to || []).filter(function (id) { return id && id !== actorId; });
      var ev = { type: type, taskId: t ? t.id : null, by: actorId, to: to, at: at };
      if (extra) for (var k in extra) ev[k] = extra[k];
      events.push(ev);
    }
    function getTask(id) {
      var t = task(state, id);
      if (!t || t.deleted) throw new Error('That task no longer exists.');
      return t;
    }
    function requireEdit(t) {
      if (!canEditTask(state, actorId, t)) throw new Error('Only the ' + teamName(state, t.team) + ' team, the owner or collaborators can edit this task. You can still comment or ask for help.');
    }

    switch (op.type) {
      /* ----- tasks ----- */
      case 'createTask': {
        var f = op.task || {};
        if (!trimStr(f.title)) return fail('A task needs a title.');
        if (!team(state, f.team)) return fail('Pick a team for the task.');
        var t = newTask({}, actorId);
        ['id', 'title', 'description', 'team', 'project', 'status', 'priority', 'owner', 'collaborators', 'startDate', 'dueDate', 'steps', 'links'].forEach(function (k) {
          if (f[k] !== undefined && f[k] !== null) t[k] = clone(f[k]);
        });
        if (task(state, t.id)) return fail('Duplicate task id.');
        t.title = trimStr(t.title, 300);
        state.tasks.push(t);
        log(t, { kind: 'activity', action: 'created' });
        if (t.owner && t.owner !== actorId) {
          t.feed[t.feed.length - 1].notify = [t.owner];
          emit('assigned', t, [t.owner]);
        }
        touch('tasks', t);
        break;
      }
      case 'updateTask': {
        var t = getTask(op.id);
        requireEdit(t);
        var patch = op.patch || {};
        var allowed = ['title', 'description', 'team', 'project', 'status', 'priority', 'owner', 'collaborators', 'startDate', 'dueDate'];
        Object.keys(patch).forEach(function (k) {
          if (allowed.indexOf(k) === -1) return;
          var before = t[k], after = patch[k];
          if (JSON.stringify(before) === JSON.stringify(after)) return;
          if (k === 'title') { after = trimStr(after, 300); if (!after) return; }
          if (k === 'team' && !team(state, after)) return;
          t[k] = clone(after);
          if (k === 'status') {
            log(t, { kind: 'activity', action: 'status', value: after, from: before });
            if (after === 'done') {
              t.completedAt = at;
              var watchers = [t.createdBy].concat(teamLeads(state, t.team).map(function (p) { return p.id; }));
              emit('done', t, watchers);
            } else {
              t.completedAt = null;
            }
            if (after === 'blocked') {
              var leads = teamLeads(state, t.team).map(function (p) { return p.id; });
              t.feed[t.feed.length - 1].notify = leads.filter(function (id) { return id !== actorId; });
              emit('blocked', t, leads.concat([t.owner]));
            }
            if (after === 'review') {
              var reviewers = teamLeads(state, t.team).map(function (p) { return p.id; });
              if (t.createdBy && t.createdBy !== t.owner) reviewers.push(t.createdBy);
              t.feed[t.feed.length - 1].notify = reviewers.filter(function (id) { return id !== actorId; });
              emit('review', t, reviewers);
            }
          } else if (k === 'owner') {
            log(t, { kind: 'activity', action: 'owner', value: after, notify: after && after !== actorId ? [after] : [] });
            if (after) emit('assigned', t, [after]);
          } else if (k === 'dueDate') {
            log(t, { kind: 'activity', action: 'due', value: after, from: before });
            if (t.owner && before) emit('dueChanged', t, [t.owner], { from: before, value: after });
          } else if (k === 'collaborators') {
            var added = (after || []).filter(function (id) { return !has(before, id); });
            if (added.length) {
              log(t, { kind: 'activity', action: 'collaborators', value: added, notify: added });
              emit('collaborator', t, added);
            }
          } else if (k === 'team') {
            log(t, { kind: 'activity', action: 'team', value: after, from: before });
          } else if (k === 'priority') {
            log(t, { kind: 'activity', action: 'priority', value: after });
          }
        });
        touch('tasks', t);
        break;
      }
      case 'deleteTask': {
        var t = getTask(op.id);
        if (!canDeleteTask(state, actorId, t)) return fail('Only exec, the team lead, or whoever created the task can delete it.');
        t.deleted = true;
        touch('tasks', t);
        break;
      }
      case 'restoreTask': {
        var t = task(state, op.id);
        if (!t) return fail('Task not found.');
        if (!canDeleteTask(state, actorId, t)) return fail('Not allowed.');
        t.deleted = false;
        touch('tasks', t);
        break;
      }

      /* ----- steps ----- */
      case 'addStep': {
        var t = getTask(op.taskId);
        requireEdit(t);
        var s = newStep(op.step && op.step.text, { id: (op.step && op.step.id) || uid('s'), assignee: op.step && op.step.assignee || null, due: op.step && op.step.due || null });
        if (!s.text) return fail('Step is empty.');
        t.steps = t.steps || [];
        var idx = typeof op.index === 'number' ? op.index : t.steps.length;
        t.steps.splice(idx, 0, s);
        if (s.assignee && s.assignee !== actorId) emit('stepAssigned', t, [s.assignee], { stepText: s.text });
        touch('tasks', t);
        break;
      }
      case 'updateStep': {
        var t = getTask(op.taskId);
        var s = byId(t.steps || [], op.stepId);
        if (!s) return fail('Step not found.');
        var p = op.patch || {};
        var onlyToggle = Object.keys(p).length === 1 && 'done' in p;
        if (onlyToggle ? !canToggleStep(state, actorId, t, s) : !canEditTask(state, actorId, t)) {
          return fail('You can only tick off steps assigned to you on another team\'s task.');
        }
        if ('text' in p) { var txt = trimStr(p.text, 500); if (txt) s.text = txt; }
        if ('assignee' in p && p.assignee !== s.assignee) {
          s.assignee = p.assignee || null;
          if (s.assignee) emit('stepAssigned', t, [s.assignee], { stepText: s.text });
        }
        if ('due' in p) s.due = p.due || null;
        if ('done' in p && !!p.done !== s.done) {
          s.done = !!p.done;
          s.doneAt = s.done ? at : null;
          s.doneBy = s.done ? actorId : null;
          if (s.done) log(t, { kind: 'activity', action: 'step', value: s.text });
        }
        touch('tasks', t);
        break;
      }
      case 'deleteStep': {
        var t = getTask(op.taskId);
        requireEdit(t);
        t.steps = (t.steps || []).filter(function (s) { return s.id !== op.stepId; });
        touch('tasks', t);
        break;
      }
      case 'reorderSteps': {
        var t = getTask(op.taskId);
        requireEdit(t);
        var order = op.order || [];
        var map = {};
        (t.steps || []).forEach(function (s) { map[s.id] = s; });
        var next = [];
        order.forEach(function (id) { if (map[id]) { next.push(map[id]); delete map[id]; } });
        Object.keys(map).forEach(function (id) { next.push(map[id]); });
        t.steps = next;
        touch('tasks', t);
        break;
      }
      case 'applyTemplate': {
        var t = getTask(op.taskId);
        requireEdit(t);
        var tpl = byId(state.templates, op.templateId);
        if (!tpl || tpl.deleted) return fail('Checklist not found.');
        t.steps = t.steps || [];
        (tpl.steps || []).forEach(function (st) {
          var due = null;
          if (t.dueDate && typeof st.offsetDays === 'number') due = addDays(t.dueDate, st.offsetDays);
          t.steps.push(newStep(st.text, { due: due }));
        });
        (tpl.links || []).forEach(function (l) {
          t.links = t.links || [];
          t.links.push({ id: uid('l'), title: l.title, url: l.url, kind: linkKind(l.url), addedBy: actorId, at: at });
        });
        log(t, { kind: 'activity', action: 'template', value: tpl.name });
        touch('tasks', t);
        break;
      }

      /* ----- links & docs ----- */
      case 'addLink': {
        var t = getTask(op.taskId);
        var l = op.link || {};
        if (!isHttpUrl(l.url)) return fail('That doesn\'t look like a link (it should start with https://).');
        t.links = t.links || [];
        var link = { id: l.id || uid('l'), title: trimStr(l.title, 200) || titleFromUrl(l.url), url: trimStr(l.url, 2000), kind: l.kind || linkKind(l.url), addedBy: actorId, at: at };
        t.links.push(link);
        if (l.driveFolder) t.driveFolderId = l.driveFolder;
        log(t, { kind: 'activity', action: 'link', value: link.title });
        touch('tasks', t);
        break;
      }
      case 'updateLink': {
        var t = getTask(op.taskId);
        var link = byId(t.links || [], op.linkId);
        if (!link) return fail('Link not found.');
        if (link.addedBy !== actorId) requireEdit(t);
        if (op.patch && 'title' in op.patch) link.title = trimStr(op.patch.title, 200) || link.title;
        touch('tasks', t);
        break;
      }
      case 'removeLink': {
        var t = getTask(op.taskId);
        var link = byId(t.links || [], op.linkId);
        if (!link) return fail('Link not found.');
        if (link.addedBy !== actorId) requireEdit(t);
        t.links = t.links.filter(function (x) { return x.id !== op.linkId; });
        touch('tasks', t);
        break;
      }

      /* ----- conversation ----- */
      case 'addComment': {
        var t = getTask(op.taskId);
        var text = trimStr(op.text, 5000);
        if (!text) return fail('Comment is empty.');
        var mentioned = mentionsIn(state, text);
        log(t, { kind: 'comment', text: text, notify: mentioned.filter(function (id) { return id !== actorId; }), id: op.id });
        if (mentioned.length) emit('mention', t, mentioned, { text: text });
        // the owner hears about comments on their task even without an @mention
        if (t.owner && t.owner !== actorId && !has(mentioned, t.owner)) emit('comment', t, [t.owner], { text: text });
        touch('tasks', t);
        break;
      }
      case 'deleteComment': {
        var t = getTask(op.taskId);
        var c = byId(t.feed || [], op.commentId);
        if (!c) return fail('Comment not found.');
        if (c.by !== actorId && !isExec(actor)) return fail('You can only delete your own comments.');
        t.feed = t.feed.filter(function (x) { return x.id !== op.commentId; });
        touch('tasks', t);
        break;
      }
      case 'checkin': {
        var t = getTask(op.taskId);
        requireEdit(t);
        var health = op.health;
        if (!find(HEALTH, function (h) { return h.id === health; })) return fail('Pick on track, at risk, or off track.');
        var text = trimStr(op.text, 5000);
        t.health = health;
        t.lastCheckinAt = at;
        var leads = teamLeads(state, t.team).map(function (p) { return p.id; });
        var notifyIds = health === 'on' ? [] : leads.filter(function (id) { return id !== actorId; });
        log(t, { kind: 'checkin', health: health, text: text, notify: notifyIds, id: op.id });
        if (t.status === 'todo') {
          t.status = 'doing';
          log(t, { kind: 'activity', action: 'status', value: 'doing', from: 'todo' });
        }
        emit('checkin', t, health === 'on' ? [] : leads, { health: health, text: text });
        touch('tasks', t);
        break;
      }
      case 'requestHelp': {
        var t = getTask(op.taskId);
        var to = op.to;
        if (!person(state, to)) return fail('Pick who you need help from.');
        var h = { id: op.id || uid('h'), from: actorId, to: to, message: trimStr(op.message, 2000), at: at, status: 'open', resolvedAt: null, resolvedBy: null };
        t.help = t.help || [];
        t.help.push(h);
        log(t, { kind: 'activity', action: 'help', value: to, text: h.message, notify: [to] });
        emit('help', t, [to], { message: h.message, helpId: h.id });
        touch('tasks', t);
        break;
      }
      case 'resolveHelp': {
        var t = getTask(op.taskId);
        var h = byId(t.help || [], op.helpId);
        if (!h) return fail('Help request not found.');
        if (h.from !== actorId && h.to !== actorId && !canEditTask(state, actorId, t)) return fail('Not allowed.');
        h.status = 'resolved';
        h.resolvedAt = at;
        h.resolvedBy = actorId;
        log(t, { kind: 'activity', action: 'helpResolved', value: h.to, notify: [h.from].filter(function (id) { return id !== actorId; }) });
        emit('helpResolved', t, [h.from], { helper: h.to });
        touch('tasks', t);
        break;
      }
      case 'nudge': {
        var t = getTask(op.taskId);
        if (!t.owner) return fail('Nobody owns this task yet. Assign an owner first.');
        if (t.owner === actorId) return fail('You can\'t nudge yourself.');
        if (t.lastNudgeAt && (Date.now() - new Date(t.lastNudgeAt).getTime()) < NUDGE_COOLDOWN_HOURS * 3600000) {
          return fail('Already nudged in the last ' + NUDGE_COOLDOWN_HOURS + ' hours. Give them a moment.');
        }
        t.lastNudgeAt = at;
        log(t, { kind: 'activity', action: 'nudge', value: t.owner, text: trimStr(op.message, 500), notify: [t.owner] });
        emit('nudge', t, [t.owner], { message: trimStr(op.message, 500) });
        touch('tasks', t);
        break;
      }

      /* ----- roster, teams, projects, templates, resources ----- */
      case 'join': {
        // A signed-in person who isn't on the roster yet adds themselves (as a member)
        // or claims an existing roster entry that has no email.
        var email = String(op.email || '').toLowerCase();
        if (!email) return fail('Missing email.');
        if (personByEmail(state, email)) return fail('You are already on the roster.');
        var p;
        if (op.claimId) {
          p = person(state, op.claimId);
          if (!p || p.deleted || p.email) return fail('That roster entry is already claimed.');
          if (p.role !== 'member') return fail('Exec and lead entries are linked by an exec. Ask one to add your email.');
          p.email = email;
        } else {
          var pp = op.person || {};
          if (!trimStr(pp.name)) return fail('Please enter your name.');
          p = { id: uid('p'), name: trimStr(pp.name, 80), email: email, role: 'member', teams: (pp.teams || []).filter(function (tid) { return team(state, tid); }), title: trimStr(pp.title, 80), slackId: '', createdAt: at };
          state.people.push(p);
        }
        touch('people', p);
        break;
      }
      case 'upsert': {
        var coll = op.coll;
        var item = op.item || {};
        if (['teams', 'people', 'projects', 'templates', 'resources'].indexOf(coll) === -1) return fail('Unknown collection.');
        var existing = item.id ? byId(state[coll], item.id) : null;
        if (coll === 'teams' && !isExec(actor)) return fail('Only exec can change teams.');
        if (coll === 'people') {
          if (!existing && !canManagePeople(state, actorId)) return fail('Only exec and team leads can add people.');
          if (!existing && item.role && item.role !== 'member' && !isExec(actor)) return fail('Only exec can add leads or exec members.');
          if (existing && !canEditPerson(state, actorId, existing, item)) return fail('You can\'t change that person\'s details.');
          if (!existing && actor.role === 'lead' && !(item.teams || []).every(function (tid) { return isLeadOf(actor, tid); })) return fail('Leads can only add people to their own team.');
          if (item.email) {
            var dup = personByEmail(state, item.email);
            if (dup && dup.id !== item.id) return fail(item.email + ' is already on the roster as ' + dup.name + '.');
          }
        }
        if (coll === 'projects') {
          if (!team(state, item.team || (existing && existing.team))) return fail('Projects belong to a team.');
          if (existing ? !canEditProject(state, actorId, existing) : !(isExec(actor) || isLeadOf(actor, item.team) || has(actor.teams, item.team))) return fail('Only exec and the team can create projects for this team.');
        }
        if ((coll === 'templates' || coll === 'resources') && existing && !canEditShared(state, actorId, existing)) {
          return fail('Only whoever added this, exec, or the team lead can change it.');
        }
        if (coll === 'resources' && item.url !== undefined && !isHttpUrl(item.url)) return fail('That doesn\'t look like a link (it should start with https://).');
        var target = existing;
        if (!target) {
          target = { id: item.id || uid(coll.charAt(0)), createdBy: actorId, createdAt: at };
          state[coll].push(target);
        }
        Object.keys(item).forEach(function (k) {
          if (k === 'id' || k === 'createdBy' || k === 'createdAt' || k === 'updatedAt') return;
          target[k] = clone(item[k]);
        });
        if (coll === 'resources' && target.url) target.kind = linkKind(target.url);
        if (coll === 'people' && target.email) target.email = String(target.email).toLowerCase().trim();
        touch(coll, target);
        break;
      }
      case 'remove': {
        var coll = op.coll;
        var item = byId(state[coll] || [], op.id);
        if (!item) return fail('Not found.');
        if (coll === 'teams' && !isExec(actor)) return fail('Only exec can remove teams.');
        if (coll === 'people' && !(isExec(actor) || (actor.role === 'lead' && canEditPerson(state, actorId, item, {})))) return fail('Not allowed.');
        if (coll === 'projects' && !canEditProject(state, actorId, item)) return fail('Not allowed.');
        if ((coll === 'templates' || coll === 'resources') && !canEditShared(state, actorId, item)) return fail('Not allowed.');
        item.deleted = true;
        touch(coll, item);
        break;
      }
      default:
        return fail('Unknown change: ' + op.type);
    }
    return { ok: true, changed: changed, events: events };
  }

  function teamName(state, id) {
    var t = team(state, id);
    return t ? t.name : 'owning';
  }

  /* ---------- digests (used by the daily Slack summary and the dashboard) ---------- */
  function personDigest(state, pid, today) {
    today = today || todayKey();
    var mine = activeTasks(state).filter(function (t) { return !isDone(t) && involves(t, pid); });
    return {
      overdue: mine.filter(function (t) { return isOverdue(t, today); }).sort(compareTasks),
      today: mine.filter(function (t) { return t.dueDate === today; }).sort(compareTasks),
      soon: mine.filter(function (t) { return t.dueDate && t.dueDate > today && daysBetween(today, t.dueDate) <= 3; }).sort(compareTasks),
      stale: mine.filter(function (t) { return t.owner === pid && isStale(t); }),
      helpForMe: activeTasks(state).filter(function (t) { return openHelp(t).some(function (h) { return h.to === pid; }); })
    };
  }
  function teamDigest(state, teamId, today) {
    today = today || todayKey();
    var all = activeTasks(state).filter(function (t) { return t.team === teamId; });
    var open = all.filter(function (t) { return !isDone(t); });
    var weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
    return {
      open: open,
      overdue: open.filter(function (t) { return isOverdue(t, today); }),
      blocked: open.filter(function (t) { return t.status === 'blocked'; }),
      stale: open.filter(isStale),
      unowned: open.filter(function (t) { return !t.owner; }),
      help: open.filter(function (t) { return openHelp(t).length > 0; }),
      atRisk: open.filter(function (t) { return t.health === 'risk' || t.health === 'off'; }),
      doneThisWeek: all.filter(function (t) { return isDone(t) && t.completedAt && t.completedAt >= weekAgo; }),
      total: all.length
    };
  }

  /* ---------- notification text (Slack on the server, previews in the demo) ----------
     Returns { text, dm: [personIds], channel: teamId|null } or null. Text uses Slack
     markdown (*bold*). */
  function clip(s, n) { s = String(s || '').replace(/\s+/g, ' ').trim(); n = n || 180; return s.length > n ? s.slice(0, n - 1) + '…' : s; }
  function describeEvent(state, ev) {
    var t = task(state, ev.taskId);
    var by = person(state, ev.by);
    var byName = by ? by.name : 'Someone';
    var title = t ? '*' + t.title + '*' : 'a task';
    var owner = t && t.owner ? person(state, t.owner) : null;
    var dm = (ev.to || []).slice();
    var channel = null;
    var text;
    switch (ev.type) {
      case 'assigned': text = byName + ' assigned you ' + title + (t && t.dueDate ? ' (due ' + t.dueDate + ')' : ''); break;
      case 'collaborator': text = byName + ' added you as a collaborator on ' + title; break;
      case 'stepAssigned': text = byName + ' assigned you a step on ' + title + ': ' + clip(ev.stepText); break;
      case 'help': text = '🙋 ' + byName + ' needs your help on ' + title + (ev.message ? ': “' + clip(ev.message, 400) + '”' : ''); break;
      case 'helpResolved': text = '✅ ' + byName + ' marked your help request on ' + title + ' as resolved'; break;
      case 'mention': text = byName + ' mentioned you on ' + title + ': “' + clip(ev.text) + '”'; break;
      case 'comment': text = byName + ' commented on ' + title + ': “' + clip(ev.text) + '”'; break;
      case 'nudge': text = '👋 ' + byName + ' is asking for a quick update on ' + title + (ev.message ? ': “' + clip(ev.message) + '”' : ''); break;
      case 'review': text = '👀 ' + title + ' is ready for review (moved by ' + byName + ')'; break;
      case 'dueChanged': text = byName + ' moved the due date of ' + title + ' to ' + (ev.value || 'no date'); break;
      case 'blocked':
        text = '🚧 ' + title + ' is blocked' + (owner ? ' (owner: ' + owner.name + ')' : '') + '. Can anyone help?';
        channel = t ? t.team : null;
        break;
      case 'done':
        text = '✅ ' + byName + ' completed ' + title;
        channel = t ? t.team : null;
        // DM only people outside the team (e.g. whoever requested it); the team sees the channel post
        dm = dm.filter(function (id) { var p = person(state, id); return p && t && !has(p.teams, t.team); });
        break;
      case 'checkin':
        if (ev.health === 'on') return null;
        var h = find(HEALTH, function (x) { return x.id === ev.health; });
        text = (ev.health === 'off' ? '🔴 ' : '🟠 ') + byName + ' marked ' + title + ' as ' + (h ? h.label.toLowerCase() : ev.health) + (ev.text ? ': “' + clip(ev.text, 300) + '”' : '');
        channel = t ? t.team : null;
        dm = [];
        break;
      default: return null;
    }
    return { text: text, dm: dm, channel: channel };
  }

  return {
    describeEvent: describeEvent, clip: clip,
    STATUSES: STATUSES, PRIORITIES: PRIORITIES, HEALTH: HEALTH, ROLES: ROLES, COLLECTIONS: COLLECTIONS,
    STALE_DAYS: STALE_DAYS, NUDGE_COOLDOWN_HOURS: NUDGE_COOLDOWN_HOURS,
    uid: uid, nowIso: nowIso, dateKey: dateKey, todayKey: todayKey, parseDateKey: parseDateKey,
    addDays: addDays, daysBetween: daysBetween, clone: clone, byId: byId, has: has, isHttpUrl: isHttpUrl,
    emptyState: emptyState, person: person, team: team, task: task, personByEmail: personByEmail,
    activePeople: activePeople, activeTasks: activeTasks, teamLeads: teamLeads, teamMembers: teamMembers,
    isExec: isExec, isLeadOf: isLeadOf,
    canEditTask: canEditTask, canDeleteTask: canDeleteTask, canToggleStep: canToggleStep,
    canManagePeople: canManagePeople, canEditPerson: canEditPerson, canEditProject: canEditProject, canEditShared: canEditShared,
    isDone: isDone, isOverdue: isOverdue, staleDays: staleDays, isStale: isStale, stepProgress: stepProgress,
    openHelp: openHelp, involves: involves, dueBucket: dueBucket, compareTasks: compareTasks, mentionsIn: mentionsIn,
    newTask: newTask, newStep: newStep, linkKind: linkKind, titleFromUrl: titleFromUrl,
    applyOp: applyOp, personDigest: personDigest, teamDigest: teamDigest
  };
})();
