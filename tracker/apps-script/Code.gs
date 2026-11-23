/* ==========================================================================
   AI Safety @ UChicago team tracker: Google Apps Script backend.

   - Serves the app (Index.html) as a web app restricted to your Google
     Workspace domain, so everyone signs in with their UChicago account.
   - Stores data in a Google Sheet (one tab per collection, one row per item).
   - Runs every change through TrackerCore.applyOp (Core.gs), the same code the
     browser runs, so permissions are enforced on the server.
   - Sends Slack notifications and creates Google Drive files and folders.

   Setup: see tracker/README.md. In short: run setup() once from the editor,
   then Deploy -> New deployment -> Web app (Execute as: Me, Access: UChicago).

   Script properties (Project Settings -> Script properties):
     SPREADSHEET_ID     created by setup()
     DRIVE_FOLDER_ID    created by setup(), or set it to a folder in a Shared Drive
     ALLOWED_DOMAIN     default "uchicago.edu"; only these emails can use the app
     JOIN_MODE          "open" (default): anyone in the domain can add themselves as a member
                        "closed": only people an exec/lead has added (by email) can get in
     SLACK_BOT_TOKEN    xoxb-... token of your Slack app (recommended: DMs + channels)
     SLACK_WEBHOOK_URL  alternative: one incoming webhook (everything goes to one channel)
     DIGEST_HOUR        hour (0-23, Chicago time) for the daily digest; default 8
     FEEDBACK_EMAIL     who gets Feedback-button submissions (comma-separated); setup()
                        sets it to the deploying account
     FEEDBACK_SLACK_CHANNEL  optional channel ID to post feedback to (bot token mode)
     GITHUB_TOKEN       optional fine-grained token with Issues: read & write on GITHUB_REPO
     GITHUB_REPO        e.g. "uchicago-xlab/website": bugs/ideas also become GitHub issues
                        labelled "tracker-feedback" (public repo = public issues; names are left out)
   ========================================================================== */

var PROPS = PropertiesService.getScriptProperties();
var COLLECTIONS = ['teams', 'people', 'projects', 'tasks', 'templates', 'resources'];
// Readable columns written next to the JSON so the sheet is useful to humans too.
var SUMMARY = {
  tasks: ['title', 'team', 'status', 'owner', 'dueDate'],
  people: ['name', 'email', 'role', 'teams'],
  teams: ['name'],
  projects: ['name', 'team', 'dueDate'],
  templates: ['name', 'team'],
  resources: ['title', 'url', 'team']
};
var MAX_CELL = 49000; // Google Sheets allows 50,000 characters per cell

/* ======================= web app ======================= */

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('AI Safety Tracker')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setFaviconUrl('https://www.google.com/s2/favicons?domain=uchicago.edu&sz=64');
}

/** First call from the browser: who is this, and everything they can see. */
function bootstrap() {
  var email = currentEmail_();
  var state = readAll_();
  var me = TrackerCore.personByEmail(state, email);
  var base = { email: email, appUrl: appUrl_(), serverTime: serverTime_(), integrations: integrations_(me) };
  if (!me) {
    // Not on the roster: show only what the join screen needs.
    base.state = TrackerCore.emptyState();
    base.state.teams = state.teams.filter(function (t) { return !t.deleted; });
    if (joinMode_() === 'open') {
      base.state.people = state.people.filter(function (p) { return !p.deleted && !p.email && p.role === 'member'; })
        .map(function (p) { return { id: p.id, name: p.name, title: p.title, role: p.role, teams: p.teams }; });
    } else {
      return { error: 'You (' + email + ') are not on the tracker roster yet. Ask an exec member or your team lead to add your email.' };
    }
    return base;
  }
  base.state = state;
  return base;
}

/** Everything changed since `since` (an ISO time from a previous serverTime). */
function getChanges(since) {
  var email = currentEmail_();
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var time = serverTime_();
    var out = {};
    COLLECTIONS.forEach(function (coll) {
      var sh = sheet_(coll);
      var n = sh.getLastRow();
      out[coll] = [];
      if (n < 2) return;
      var width = headers_(coll).length;
      var vals = sh.getRange(2, 1, n - 1, width).getValues();
      vals.forEach(function (row) {
        if (since && String(row[1]) <= since) return;
        var item = parse_(row[width - 1]);
        if (item) out[coll].push(item);
      });
    });
    var me = TrackerCore.personByEmail({ people: readCollection_('people') }, email);
    if (!me) return { error: 'You are no longer on the roster. Reload the page.' };
    return { entities: out, serverTime: time, integrations: integrations_(me) };
  } finally {
    lock.releaseLock();
  }
}

/** Applies a batch of changes from the browser. */
function applyOps(ops) {
  var email = currentEmail_();
  if (!Array.isArray(ops)) return { error: 'Bad request.' };
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  var state, results = [], events = [], entities = {}, removed = [];
  try {
    state = readAll_();
    var me = TrackerCore.personByEmail(state, email);
    if (!me) return { error: 'You are not on the roster yet. Reload the page to join.' };
    var changed = {};
    ops.slice(0, 50).forEach(function (op) {
      if (!op || op.type === 'join') { results.push({ ok: false, error: 'Not allowed.' }); return; }
      var r = TrackerCore.applyOp(state, op, me.id);
      results.push({ ok: r.ok, error: r.error || null });
      if (r.ok) {
        r.changed.forEach(function (c) { (changed[c.coll] = changed[c.coll] || {})[c.id] = true; });
        events = events.concat(r.events);
      } else {
        // send back the server's copy so the browser drops its optimistic version
        var tgt = opTarget_(op);
        if (tgt) {
          var cur = TrackerCore.byId(state[tgt.coll] || [], tgt.id);
          if (cur) (changed[tgt.coll] = changed[tgt.coll] || {})[tgt.id] = 'send';
          else removed.push(tgt);
        }
      }
    });
    Object.keys(changed).forEach(function (coll) {
      var all = Object.keys(changed[coll]).map(function (id) { return TrackerCore.byId(state[coll], id); }).filter(Boolean);
      var toWrite = all.filter(function (item) { return changed[coll][item.id] === true; });
      if (toWrite.length) writeItems_(coll, toWrite);
      entities[coll] = all;
    });
    SpreadsheetApp.flush();
  } finally {
    lock.releaseLock();
  }
  try { notify_(state, events); } catch (e) { console.error('Slack notify failed: ' + e); }
  return { results: results, entities: entities, removed: removed, serverTime: serverTime_() };
}

/** A signed-in person who isn't on the roster adds themselves (or claims a member entry). */
function join(payload) {
  var email = currentEmail_();
  if (joinMode_() !== 'open') return { error: 'Self sign-up is turned off. Ask an exec member or your team lead to add ' + email + '.' };
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var state = readAll_();
    if (!TrackerCore.personByEmail(state, email)) {
      var op = { type: 'join', email: email };
      if (payload && payload.claimId) op.claimId = String(payload.claimId);
      else op.person = { name: payload && payload.person && payload.person.name, title: payload && payload.person && payload.person.title, teams: (payload && payload.person && payload.person.teams || []).filter(function (t) { return t !== 'exec'; }) };
      var r = TrackerCore.applyOp(state, op, null);
      if (!r.ok) return { error: r.error };
      writeItems_('people', r.changed.map(function (c) { return TrackerCore.byId(state.people, c.id); }));
      SpreadsheetApp.flush();
    }
    return { state: state };
  } finally {
    lock.releaseLock();
  }
}

/* ======================= Google Drive ======================= */

/** Creates a Doc/Sheet/Slides/Form or a folder inside the task's Drive folder and attaches it. */
function driveCreate(taskId, kind, title) {
  var email = currentEmail_();
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var state = readAll_();
    var me = TrackerCore.personByEmail(state, email);
    if (!me) return { error: 'You are not on the roster.' };
    var task = TrackerCore.task(state, taskId);
    if (!task || task.deleted) return { error: 'Task not found.' };
    var hadFolder = !!task.driveFolderId;
    var folder = taskFolder_(state, task);
    var name = String(title || task.title).slice(0, 120);
    var url, linkTitle;
    if (kind === 'folder') {
      url = folder.getUrl();
      linkTitle = 'Drive folder';
    } else {
      var file;
      if (kind === 'doc') { var d = DocumentApp.create(name); url = d.getUrl(); file = DriveApp.getFileById(d.getId()); linkTitle = name; }
      else if (kind === 'sheet') { var s = SpreadsheetApp.create(name); url = s.getUrl(); file = DriveApp.getFileById(s.getId()); linkTitle = name; }
      else if (kind === 'slides') { var p = SlidesApp.create(name); url = p.getUrl(); file = DriveApp.getFileById(p.getId()); linkTitle = name; }
      else if (kind === 'form') { var f = FormApp.create(name); url = f.getEditUrl(); file = DriveApp.getFileById(f.getId()); linkTitle = name + ' (form)'; }
      else return { error: 'Unknown file type.' };
      file.moveTo(folder);
    }
    var ops = [];
    if (kind !== 'folder' && !hadFolder) ops.push({ type: 'addLink', taskId: task.id, link: { url: folder.getUrl(), title: 'Drive folder', kind: 'folder', driveFolder: folder.getId() } });
    ops.push({ type: 'addLink', taskId: task.id, link: { url: url, title: linkTitle, driveFolder: folder.getId() } });
    for (var i = 0; i < ops.length; i++) {
      var r = TrackerCore.applyOp(state, ops[i], me.id);
      if (!r.ok) return { error: r.error };
    }
    writeItems_('tasks', [task]);
    SpreadsheetApp.flush();
    return { entities: { tasks: [task] }, url: url };
  } finally {
    lock.releaseLock();
  }
}

/** Name and type of a Drive file, used to title pasted links. Returns {} if the deployer can't see it. */
function driveFileInfo(url) {
  currentEmail_();
  var m = String(url || '').match(/[-\w]{25,}/);
  if (!m) return {};
  try { var f = DriveApp.getFileById(m[0]); return { name: f.getName(), mimeType: f.getMimeType() }; } catch (e) { /* not a file or no access */ }
  try { var d = DriveApp.getFolderById(m[0]); return { name: d.getName(), mimeType: 'folder' }; } catch (e) { /* no access */ }
  return {};
}

function driveRoot_() {
  var id = PROPS.getProperty('DRIVE_FOLDER_ID');
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) { console.warn('DRIVE_FOLDER_ID not accessible, creating a new folder'); } }
  var folder = DriveApp.createFolder('AI Safety Tracker files');
  PROPS.setProperty('DRIVE_FOLDER_ID', folder.getId());
  shareWithDomain_(folder);
  return folder;
}
function teamFolder_(state, teamId) {
  var team = TrackerCore.team(state, teamId);
  if (team && team.driveFolderUrl) {
    var m = String(team.driveFolderUrl).match(/folders\/([-\w]{20,})/);
    if (m) { try { return DriveApp.getFolderById(m[1]); } catch (e) { console.warn('Team folder for ' + team.name + ' not accessible: ' + e); } }
  }
  var root = driveRoot_();
  var name = team ? team.name : 'Other';
  var it = root.getFoldersByName(name);
  return it.hasNext() ? it.next() : root.createFolder(name);
}
function taskFolder_(state, task) {
  if (task.driveFolderId) { try { return DriveApp.getFolderById(task.driveFolderId); } catch (e) { /* recreate below */ } }
  var folder = teamFolder_(state, task.team).createFolder(String(task.title).slice(0, 100));
  task.driveFolderId = folder.getId();
  return folder;
}
function shareWithDomain_(folder) {
  try { folder.setSharing(DriveApp.Access.DOMAIN_WITH_LINK, DriveApp.Permission.EDIT); }
  catch (e) { console.warn('Could not share the tracker folder with the domain (an admin policy may block it). Share it manually. ' + e); }
}

/* ======================= Slack ======================= */

function slackCfg_() {
  var token = PROPS.getProperty('SLACK_BOT_TOKEN');
  var webhook = PROPS.getProperty('SLACK_WEBHOOK_URL');
  if (token) return { token: token };
  if (webhook) return { webhook: webhook };
  return null;
}
function slackEscape_(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function taskLink_(taskId) { return appUrl_() + (taskId ? '?task=' + encodeURIComponent(taskId) : ''); }

function notify_(state, events) {
  var cfg = slackCfg_();
  if (!cfg || !events || !events.length) return;
  events.forEach(function (ev) {
    var d = TrackerCore.describeEvent(state, ev);
    if (!d) return;
    var text = slackEscape_(d.text) + '  <' + taskLink_(ev.taskId) + '|Open task →>';
    if (cfg.token) {
      d.dm.forEach(function (pid) { var p = TrackerCore.person(state, pid); if (p) slackDM_(p, text); });
      if (d.channel) {
        var team = TrackerCore.team(state, d.channel);
        if (team && team.slackChannel) slackApi_('chat.postMessage', { channel: team.slackChannel, text: text, unfurl_links: false });
      }
    } else {
      var names = d.dm.map(function (pid) { var p = TrackerCore.person(state, pid); return p ? p.name : null; }).filter(Boolean);
      if (!names.length && !d.channel) return;
      slackWebhook_((names.length ? '*For ' + slackEscape_(names.join(', ')) + ':* ' : '') + text);
    }
  });
}

function slackApi_(method, payload) {
  var token = PROPS.getProperty('SLACK_BOT_TOKEN');
  if (!token) return null;
  var res = UrlFetchApp.fetch('https://slack.com/api/' + method, {
    method: 'post', contentType: 'application/json; charset=utf-8', muteHttpExceptions: true,
    headers: { Authorization: 'Bearer ' + token }, payload: JSON.stringify(payload)
  });
  var body = {};
  try { body = JSON.parse(res.getContentText()); } catch (e) { body = { ok: false, error: 'bad response' }; }
  if (!body.ok) console.warn('Slack ' + method + ' failed: ' + body.error);
  return body;
}
function slackApiGet_(method, params) {
  var token = PROPS.getProperty('SLACK_BOT_TOKEN');
  var qs = Object.keys(params).map(function (k) { return k + '=' + encodeURIComponent(params[k]); }).join('&');
  var res = UrlFetchApp.fetch('https://slack.com/api/' + method + '?' + qs, { headers: { Authorization: 'Bearer ' + token }, muteHttpExceptions: true });
  try { return JSON.parse(res.getContentText()); } catch (e) { return { ok: false }; }
}
function slackUserId_(p) {
  if (p.slackId) return p.slackId;
  if (!p.email) return null;
  var cache = CacheService.getScriptCache();
  var key = 'slack:' + p.email;
  var hit = cache.get(key);
  if (hit) return hit === '-' ? null : hit;
  var r = slackApiGet_('users.lookupByEmail', { email: p.email });
  var id = r && r.ok && r.user ? r.user.id : null;
  cache.put(key, id || '-', id ? 21600 : 3600);
  return id;
}
function slackDM_(p, text) {
  var id = slackUserId_(p);
  if (!id) { console.warn('No Slack user found for ' + p.name + ' (' + p.email + ')'); return false; }
  var r = slackApi_('chat.postMessage', { channel: id, text: text, unfurl_links: false });
  return !!(r && r.ok);
}
function slackWebhook_(text) {
  var url = PROPS.getProperty('SLACK_WEBHOOK_URL');
  if (!url) return;
  UrlFetchApp.fetch(url, { method: 'post', contentType: 'application/json', muteHttpExceptions: true, payload: JSON.stringify({ text: text }) });
}

/** "Send a test message" button in Settings. */
function slackTest() {
  var email = currentEmail_();
  var cfg = slackCfg_();
  if (!cfg) return { error: 'Slack is not configured. Add SLACK_BOT_TOKEN (or SLACK_WEBHOOK_URL) in Script properties.' };
  var state = readAll_();
  var me = TrackerCore.personByEmail(state, email);
  var text = '👋 Test from the AI Safety tracker. Notifications are working. <' + appUrl_() + '|Open the tracker>';
  if (cfg.token) {
    if (!me) return { error: 'You are not on the roster.' };
    return slackDM_(me, text) ? { message: 'Sent you a Slack DM.' } : { error: 'Slack couldn’t find you by ' + email + '. Add your Slack member ID to your profile, and check the bot has the users:read.email and chat:write scopes.' };
  }
  slackWebhook_(text);
  return { message: 'Posted a test message to the webhook channel.' };
}

/* ======================= feedback button ======================= */

var FEEDBACK_HEADERS = ['id', 'at', 'status', 'type', 'from', 'email', 'page', 'task', 'message', 'details', 'issue'];
var FEEDBACK_TYPES = { bug: 'Bug', idea: 'Idea', confusing: 'Confusing', praise: 'Praise' };

function feedbackSheet_() {
  var ss = ss_();
  var sh = ss.getSheetByName('feedback');
  if (!sh) {
    sh = ss.insertSheet('feedback');
    sh.getRange(1, 1, 1, FEEDBACK_HEADERS.length).setValues([FEEDBACK_HEADERS]).setFontWeight('bold');
    sh.setFrozenRows(1);
    sh.getRange(1, 1, sh.getMaxRows(), FEEDBACK_HEADERS.length).setNumberFormat('@');
  }
  return sh;
}

/** Called by the Feedback button. Logs to the sheet and tells the maintainers. */
function submitFeedback(fb) {
  var email = currentEmail_();
  fb = fb || {};
  var type = FEEDBACK_TYPES[fb.type] ? fb.type : 'idea';
  var message = String(fb.message || '').trim().slice(0, 5000);
  if (message.length < 3) return { error: 'Please write a little more.' };
  // light spam guard: 10 submissions per person per hour
  var cache = CacheService.getScriptCache();
  var key = 'fb:' + email;
  var count = parseInt(cache.get(key) || '0', 10);
  if (count >= 10) return { error: 'That’s a lot of feedback in one hour! Please try again a bit later.' };
  cache.put(key, String(count + 1), 3600);

  var me = TrackerCore.personByEmail({ people: readCollection_('people') }, email);
  var name = me ? me.name : email;
  var ctx = fb.context && typeof fb.context === 'object' ? fb.context : {};
  var id = 'fb_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  var at = new Date().toISOString();
  var task = ctx.task && ctx.task.title ? String(ctx.task.title).slice(0, 200) : '';
  var details = JSON.stringify(ctx).slice(0, 8000);

  var issueUrl = '';
  if (type !== 'praise') {
    try { issueUrl = createGithubIssue_(type, message, ctx); } catch (e) { console.warn('GitHub issue failed: ' + e); }
  }
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sh = feedbackSheet_();
    var row = [id, at, 'open', type, cellText_(name), email, cellText_(ctx.pageName || ctx.page || ''), cellText_(task), (/^[=+\-@]/.test(message) ? "'" + message : message), details, issueUrl];
    sh.getRange(sh.getLastRow() + 1, 1, 1, row.length).setNumberFormat('@').setValues([row]);
  } finally {
    lock.releaseLock();
  }
  try { notifyFeedback_({ type: type, name: name, email: email, message: message, page: ctx.pageName || ctx.page || '', task: task, errors: ctx.errors || [], issueUrl: issueUrl, details: details }); }
  catch (e) { console.warn('Feedback notification failed: ' + e); }
  return { ok: true, id: id, issueUrl: issueUrl };
}

function notifyFeedback_(f) {
  var label = FEEDBACK_TYPES[f.type];
  var to = String(PROPS.getProperty('FEEDBACK_EMAIL') || '').split(',').map(function (x) { return x.trim(); }).filter(Boolean);
  var summary = label + ' from ' + f.name + (f.page ? ' on "' + f.page + '"' : '');
  if (to.length) {
    MailApp.sendEmail({
      to: to.join(','), replyTo: f.email, name: 'AI Safety Tracker',
      subject: '[Tracker feedback] ' + label + ': ' + TrackerCore.clip(f.message, 70),
      body: summary + (f.task ? '\nTask: ' + f.task : '') + '\n\n' + f.message +
        (f.errors.length ? '\n\nRecent errors:\n' + f.errors.map(function (e) { return '- ' + e.msg; }).join('\n') : '') +
        (f.issueUrl ? '\n\nGitHub issue: ' + f.issueUrl : '') +
        '\n\nReply to this email to answer ' + f.name + ' directly.\nAll feedback: Settings → Feedback in the tracker (' + appUrl_() + ')\n\nTechnical details: ' + f.details
    });
  }
  var text = (f.type === 'bug' ? '🐞' : f.type === 'praise' ? '❤️' : f.type === 'confusing' ? '😕' : '💡') + ' *Tracker feedback* · ' + slackEscape_(summary) + '\n>' + slackEscape_(TrackerCore.clip(f.message, 600)).replace(/\n/g, '\n>') +
    (f.errors.length ? '\n_' + f.errors.length + ' recent error(s) attached_' : '') + (f.issueUrl ? '\n<' + f.issueUrl + '|GitHub issue>' : '');
  var cfg = slackCfg_();
  if (!cfg) return;
  if (cfg.token) {
    var channel = PROPS.getProperty('FEEDBACK_SLACK_CHANNEL');
    if (channel) slackApi_('chat.postMessage', { channel: channel, text: text, unfurl_links: false });
    else to.forEach(function (addr) { slackDM_({ name: addr, email: addr }, text); });
  } else {
    slackWebhook_(text);
  }
}

/** Files bugs and ideas as GitHub issues when GITHUB_TOKEN and GITHUB_REPO are set. Leaves out names and task titles. */
function createGithubIssue_(type, message, ctx) {
  var token = PROPS.getProperty('GITHUB_TOKEN');
  var repo = PROPS.getProperty('GITHUB_REPO');
  if (!token || !repo) return '';
  // keep @handles and code fences in user text from pinging people or breaking the layout
  var safe = function (s) { return String(s || '').replace(/@/g, '@\u200b').replace(/~~~/g, '~ ~ ~'); };
  var title = '[Tracker ' + FEEDBACK_TYPES[type].toLowerCase() + '] ' + TrackerCore.clip(safe(message), 80);
  var tech = { page: ctx.page || '', version: ctx.version || '', mode: ctx.mode || '', role: ctx.role || '', browser: ctx.browser || '', screen: ctx.screen || '', errors: (ctx.errors || []).map(function (e) { return e.msg; }) };
  var body = '**Type:** ' + FEEDBACK_TYPES[type] + '\n**Page:** `' + safe(tech.page).replace(/`/g, '') + '`\n\n~~~text\n' + safe(message) + '\n~~~\n\n<details><summary>Technical details</summary>\n\n~~~json\n' + safe(JSON.stringify(tech, null, 2)) + '\n~~~\n</details>\n\n_Sent with the Feedback button in the team tracker (tracker/). Who sent it and which task they were on are in the tracker’s private feedback log._';
  var labels = ['tracker-feedback', type === 'bug' ? 'bug' : 'enhancement'];
  function post(withLabels) {
    var payload = { title: title, body: body };
    if (withLabels) payload.labels = labels;
    return UrlFetchApp.fetch('https://api.github.com/repos/' + repo + '/issues', {
      method: 'post', contentType: 'application/json', muteHttpExceptions: true, payload: JSON.stringify(payload),
      headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json', 'User-Agent': 'ai-safety-tracker' }
    });
  }
  var res = post(true);
  if (res.getResponseCode() === 422) res = post(false); // e.g. labels not allowed
  if (res.getResponseCode() >= 300) { console.warn('GitHub ' + res.getResponseCode() + ': ' + res.getContentText().slice(0, 300)); return ''; }
  return JSON.parse(res.getContentText()).html_url || '';
}

/** Feedback inbox for exec (Settings → Feedback). */
function listFeedback() {
  requireExec_();
  var sh = feedbackSheet_();
  var n = sh.getLastRow();
  if (n < 2) return { items: [] };
  var rows = sh.getRange(2, 1, n - 1, FEEDBACK_HEADERS.length).getValues();
  var items = rows.map(function (r) {
    var o = {};
    FEEDBACK_HEADERS.forEach(function (h, i) { o[h] = String(r[i]); });
    o.details = parse_(o.details) || {};
    o.pageName = o.page;
    return o;
  }).filter(function (o) { return o.id; });
  items.reverse();
  return { items: items.slice(0, 300) };
}
function setFeedbackStatus(id, status) {
  requireExec_();
  if (['open', 'done'].indexOf(status) === -1) return { error: 'Bad status.' };
  var sh = feedbackSheet_();
  var n = sh.getLastRow();
  if (n < 2) return { error: 'Not found.' };
  var ids = sh.getRange(2, 1, n - 1, 1).getValues().map(function (r) { return String(r[0]); });
  var idx = ids.indexOf(String(id));
  if (idx === -1) return { error: 'Not found.' };
  sh.getRange(idx + 2, 3).setValues([[status]]);
  return { ok: true };
}
function requireExec_() {
  var me = TrackerCore.personByEmail({ people: readCollection_('people') }, currentEmail_());
  if (!me || me.role !== 'exec') throw new Error('Only exec members can see the feedback log.');
  return me;
}

/* ======================= digests (time-driven triggers) ======================= */

function dailyDigest() {
  var cfg = slackCfg_();
  if (!cfg) return;
  var state = readAll_();
  var today = TrackerCore.todayKey();
  function line(t) {
    var owner = TrackerCore.person(state, t.owner);
    return '• <' + taskLink_(t.id) + '|' + slackEscape_(t.title) + '>' + (t.dueDate ? ' (due ' + t.dueDate + ')' : '') + (owner ? ' · ' + slackEscape_(owner.name) : '');
  }
  if (cfg.token) {
    TrackerCore.activePeople(state).forEach(function (p) {
      var d = TrackerCore.personDigest(state, p.id, today);
      var parts = [];
      if (d.overdue.length) parts.push('*Overdue*\n' + d.overdue.map(line).join('\n'));
      if (d.today.length) parts.push('*Due today*\n' + d.today.map(line).join('\n'));
      if (d.soon.length) parts.push('*Due in the next 3 days*\n' + d.soon.map(line).join('\n'));
      if (d.helpForMe.length) parts.push('*People waiting on your help*\n' + d.helpForMe.map(line).join('\n'));
      if (d.stale.length) parts.push('*Needs a check-in from you* (no update in ' + TrackerCore.STALE_DAYS + '+ days)\n' + d.stale.map(line).join('\n'));
      if (parts.length) slackDM_(p, '☀️ Good morning ' + slackEscape_(p.name.split(' ')[0]) + '! Here’s your tracker update.\n\n' + parts.join('\n\n') + '\n\n<' + appUrl_() + '|Open My work>');
    });
  }
  state.teams.filter(function (t) { return !t.deleted; }).forEach(function (team) {
    var d = TrackerCore.teamDigest(state, team.id, today);
    var parts = [];
    if (d.overdue.length) parts.push('*Overdue (' + d.overdue.length + ')*\n' + d.overdue.map(line).join('\n'));
    if (d.blocked.length) parts.push('*Blocked (' + d.blocked.length + ')*\n' + d.blocked.map(line).join('\n'));
    if (d.help.length) parts.push('*Waiting on help (' + d.help.length + ')*\n' + d.help.map(line).join('\n'));
    if (d.unowned.length) parts.push('*No owner yet (' + d.unowned.length + ')*\n' + d.unowned.map(line).join('\n'));
    if (d.stale.length) parts.push('*No check-in in ' + TrackerCore.STALE_DAYS + '+ days (' + d.stale.length + ')*\n' + d.stale.map(line).join('\n'));
    if (!parts.length) return;
    var text = '📋 *' + slackEscape_(team.name) + ' daily check*\n\n' + parts.join('\n\n');
    if (cfg.token && team.slackChannel) slackApi_('chat.postMessage', { channel: team.slackChannel, text: text, unfurl_links: false });
    else if (cfg.webhook) slackWebhook_(text);
  });
}

function weeklySummary() {
  var cfg = slackCfg_();
  if (!cfg) return;
  var state = readAll_();
  var rows = state.teams.filter(function (t) { return !t.deleted; }).map(function (team) {
    var d = TrackerCore.teamDigest(state, team.id);
    return '*' + slackEscape_(team.name) + '*: ' + d.doneThisWeek.length + ' done last week · ' + d.open.length + ' open · ' + d.overdue.length + ' overdue · ' + d.blocked.length + ' blocked · ' + d.stale.length + ' need a check-in';
  });
  var text = '🗓️ *Weekly tracker summary*\n' + rows.join('\n') + '\n<' + appUrl_() + '|Open the dashboard>';
  var exec = TrackerCore.team(state, 'exec');
  if (cfg.token && exec && exec.slackChannel) slackApi_('chat.postMessage', { channel: exec.slackChannel, text: text, unfurl_links: false });
  else if (cfg.webhook) slackWebhook_(text);
}

/* ======================= setup (run from the editor) ======================= */

/**
 * Run once from the Apps Script editor (select "setup" and click Run).
 * Creates the data spreadsheet and Drive folder, seeds teams, checklists and
 * shared docs, adds you as exec, and installs the daily/weekly Slack triggers.
 */
function setup() {
  setup_(false);
}
/** Same as setup(), but also loads the sample people, projects and tasks from the demo. */
function setupWithSampleData() {
  setup_(true);
}
function setup_(withSamples) {
  var id = PROPS.getProperty('SPREADSHEET_ID');
  var ss;
  if (id) ss = SpreadsheetApp.openById(id);
  else {
    ss = SpreadsheetApp.create('AI Safety Tracker data');
    PROPS.setProperty('SPREADSHEET_ID', ss.getId());
  }
  COLLECTIONS.forEach(function (c) { sheet_(c); });
  var blank = ss.getSheetByName('Sheet1');
  if (blank && ss.getSheets().length > 1) ss.deleteSheet(blank);

  var state = readAll_();
  var seed = withSamples ? TrackerSeed.demo() : TrackerSeed.roster();
  var email = Session.getEffectiveUser().getEmail().toLowerCase();
  ['teams', 'templates', 'resources'].concat(withSamples ? ['people', 'projects', 'tasks'] : []).forEach(function (coll) {
    if (state[coll].length) return; // never overwrite existing data
    writeItems_(coll, seed[coll]);
  });
  state = readAll_();
  if (!TrackerCore.personByEmail(state, email)) {
    var now = TrackerCore.nowIso();
    writeItems_('people', [{ id: TrackerCore.uid('p'), name: email.split('@')[0], email: email, role: 'exec', teams: ['exec'], title: 'Exec', slackId: '', createdAt: now, updatedAt: now }]);
  }
  var root = driveRoot_();
  if (!PROPS.getProperty('ALLOWED_DOMAIN')) PROPS.setProperty('ALLOWED_DOMAIN', email.split('@')[1] || 'uchicago.edu');
  if (!PROPS.getProperty('JOIN_MODE')) PROPS.setProperty('JOIN_MODE', 'open');
  if (!PROPS.getProperty('FEEDBACK_EMAIL')) PROPS.setProperty('FEEDBACK_EMAIL', email);
  feedbackSheet_();
  installTriggers();
  console.log('Done.\nData spreadsheet: ' + ss.getUrl() + '\nDrive folder: ' + root.getUrl() +
    '\nYou are on the roster as exec (' + email + '). Edit your name in the app (Settings -> Edit profile).' +
    '\nNext: Deploy -> New deployment -> Web app (Execute as: Me, Who has access: anyone in your domain).');
}

/** (Re)installs the daily digest and Monday summary triggers. */
function installTriggers() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (['dailyDigest', 'weeklySummary'].indexOf(t.getHandlerFunction()) !== -1) ScriptApp.deleteTrigger(t);
  });
  var hour = parseInt(PROPS.getProperty('DIGEST_HOUR') || '8', 10);
  ScriptApp.newTrigger('dailyDigest').timeBased().everyDays(1).atHour(hour).inTimezone('America/Chicago').create();
  ScriptApp.newTrigger('weeklySummary').timeBased().onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(9).inTimezone('America/Chicago').create();
}

/* ======================= storage ======================= */

function ss_() {
  var id = PROPS.getProperty('SPREADSHEET_ID');
  if (!id) throw new Error('The tracker is not set up yet. An exec member needs to run setup() in the Apps Script editor.');
  return SpreadsheetApp.openById(id);
}
function headers_(coll) { return ['id', 'updatedAt', 'deleted'].concat(SUMMARY[coll] || []).concat(['json']); }
var sheetCache_ = {};
function sheet_(coll) {
  if (sheetCache_[coll]) return sheetCache_[coll];
  var ss = ss_();
  var sh = ss.getSheetByName(coll);
  if (!sh) {
    sh = ss.insertSheet(coll);
    var h = headers_(coll);
    sh.getRange(1, 1, 1, h.length).setValues([h]).setFontWeight('bold');
    sh.setFrozenRows(1);
    // plain text everywhere so dates and ISO times are never auto-converted
    sh.getRange(1, 1, sh.getMaxRows(), h.length).setNumberFormat('@');
    sh.setColumnWidth(h.length, 400);
  }
  sheetCache_[coll] = sh;
  return sh;
}
function parse_(json) {
  if (!json) return null;
  try { return JSON.parse(json); } catch (e) { return null; }
}
function readCollection_(coll) {
  var sh = sheet_(coll);
  var n = sh.getLastRow();
  if (n < 2) return [];
  var width = headers_(coll).length;
  return sh.getRange(2, width, n - 1, 1).getValues().map(function (r) { return parse_(r[0]); }).filter(Boolean);
}
function readAll_() {
  var state = TrackerCore.emptyState();
  COLLECTIONS.forEach(function (coll) { state[coll] = readCollection_(coll); });
  return state;
}
function cellText_(v) {
  if (v === null || v === undefined) return '';
  if (Array.isArray(v)) v = v.join(', ');
  v = String(v).slice(0, 500);
  // never let user text be interpreted as a formula
  return /^[=+\-@]/.test(v) ? "'" + v : v;
}
function rowFor_(coll, item) {
  var json = JSON.stringify(item);
  if (json.length > MAX_CELL && coll === 'tasks') {
    var copy = JSON.parse(json);
    while (JSON.stringify(copy).length > MAX_CELL && copy.feed && copy.feed.length > 10) copy.feed.splice(0, Math.ceil(copy.feed.length / 5));
    json = JSON.stringify(copy);
  }
  if (json.length > MAX_CELL) throw new Error('This item is too large to save (over 50,000 characters). Move long notes into a linked Google Doc.');
  var row = [item.id, item.updatedAt || '', item.deleted ? 'TRUE' : ''];
  (SUMMARY[coll] || []).forEach(function (k) { row.push(cellText_(item[k])); });
  row.push(json);
  return row;
}
function writeItems_(coll, items) {
  if (!items || !items.length) return;
  var sh = sheet_(coll);
  var width = headers_(coll).length;
  var n = sh.getLastRow();
  var ids = n > 1 ? sh.getRange(2, 1, n - 1, 1).getValues().map(function (r) { return String(r[0]); }) : [];
  var appends = [];
  items.forEach(function (item) {
    var row = rowFor_(coll, item);
    var idx = ids.indexOf(item.id);
    if (idx === -1) { appends.push(row); ids.push(item.id); }
    else sh.getRange(idx + 2, 1, 1, width).setValues([row]);
  });
  if (appends.length) {
    var start = sh.getLastRow() + 1;
    sh.getRange(start, 1, appends.length, width).setNumberFormat('@').setValues(appends);
  }
}

/* ======================= helpers ======================= */

function currentEmail_() {
  var email = String(Session.getActiveUser().getEmail() || '').toLowerCase();
  if (!email) throw new Error('Google didn’t share your email with the tracker. Sign in with your UChicago Google account.');
  var domain = (PROPS.getProperty('ALLOWED_DOMAIN') || 'uchicago.edu').toLowerCase();
  if (email.slice(-domain.length - 1) !== '@' + domain) throw new Error('The tracker is only open to @' + domain + ' accounts. You are signed in as ' + email + '.');
  return email;
}
function joinMode_() { return (PROPS.getProperty('JOIN_MODE') || 'open').toLowerCase(); }
function appUrl_() { try { return ScriptApp.getService().getUrl() || ''; } catch (e) { return ''; } }
// a little behind real time, so a poll never skips a write that landed while it was reading
function serverTime_() { return new Date(Date.now() - 30000).toISOString(); }
function integrations_(me) {
  var cfg = slackCfg_();
  var out = { slack: cfg ? (cfg.token ? 'bot' : 'webhook') : '', drive: true, driveRootUrl: '', sheetUrl: '' };
  out.feedback = { email: !!PROPS.getProperty('FEEDBACK_EMAIL'), slack: !!cfg, github: !!(PROPS.getProperty('GITHUB_TOKEN') && PROPS.getProperty('GITHUB_REPO')) };
  var folderId = PROPS.getProperty('DRIVE_FOLDER_ID');
  if (folderId) out.driveRootUrl = 'https://drive.google.com/drive/folders/' + folderId;
  if (me && me.role === 'exec') out.sheetUrl = 'https://docs.google.com/spreadsheets/d/' + PROPS.getProperty('SPREADSHEET_ID') + '/edit';
  return out;
}
function opTarget_(op) {
  if (!op) return null;
  if (op.type === 'createTask') return op.task && op.task.id ? { coll: 'tasks', id: op.task.id } : null;
  if (op.type === 'updateTask' || op.type === 'deleteTask' || op.type === 'restoreTask') return { coll: 'tasks', id: op.id };
  if (op.taskId) return { coll: 'tasks', id: op.taskId };
  if ((op.type === 'upsert') && op.item && op.item.id) return { coll: op.coll, id: op.item.id };
  if (op.type === 'remove') return { coll: op.coll, id: op.id };
  return null;
}
