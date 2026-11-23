/* Tracker UI helpers: escaping, icons, formatting, markdown, popovers, modals, toasts. */
var App = window.App = window.App || {};
(function (App) {
  'use strict';
  var C = TrackerCore;
  App.C = C;
  App.actions = App.actions || {};

  /* ---------- escaping ---------- */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function safeUrl(u) { return C.isHttpUrl(u) ? String(u).trim() : '#'; }
  App.esc = esc;
  App.safeUrl = safeUrl;

  /* ---------- icons (24px stroke icons) ---------- */
  var P = {
    home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
    inbox: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
    chart: '<path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 6-6"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
    board: '<rect x="3" y="3" width="5" height="18" rx="1.5"/><rect x="10" y="3" width="5" height="12" rx="1.5"/><rect x="17" y="3" width="4" height="8" rx="1.5"/>',
    timeline: '<path d="M3 6h10M7 12h12M5 18h8"/>',
    docs: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h5"/>',
    people: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.35-4.35"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
    help: '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01"/>',
    hand: '<path d="M18 11V6a2 2 0 0 0-4 0v5M14 10V4a2 2 0 0 0-4 0v6M10 10.5V6a2 2 0 0 0-4 0v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/>',
    bell: '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0"/>',
    more: '<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>',
    calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    trash: '<path d="M3 6h18M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>',
    copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    grip: '<circle cx="9" cy="6" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="18" r="1"/>',
    flag: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22v-7"/>',
    menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
    clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    folder: '<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>',
    send: '<path d="m22 2-7 20-4-9-9-4z"/><path d="M22 2 11 13"/>',
    external: '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14 21 3"/>',
    zap: '<path d="M13 2 3 14h9l-1 8 10-12h-9z"/>',
    target: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
    edit: '<path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/>',
    checklist: '<path d="M9 6h11M9 12h11M9 18h11"/><path d="m3 6 1.5 1.5L7 5M3 12l1.5 1.5L7 11M3 18l1.5 1.5L7 17"/>',
    refresh: '<path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>',
    chevron: '<path d="m6 9 6 6 6-6"/>',
    star: '<path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z"/>',
    pin: '<path d="M12 17v5M9 10.76V6h6v4.76l2 3.24H7z"/><path d="M8 2h8"/>'
  };
  function icon(name, size, cls) {
    size = size || 16;
    return '<svg class="ico ' + (cls || '') + '" width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (P[name] || '') + '</svg>';
  }
  App.icon = icon;

  /* ---------- people & chips ---------- */
  var AV_COLORS = ['#800000', '#b45309', '#0f766e', '#1d4ed8', '#7c3aed', '#be185d', '#4d7c0f', '#0369a1', '#c2410c', '#6d28d9', '#047857', '#9f1239'];
  function hash(s) { var h = 0; s = String(s || ''); for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); }
  function initials(name) {
    var parts = String(name || '?').trim().split(/\s+/);
    return ((parts[0] || '?').charAt(0) + (parts.length > 1 ? parts[parts.length - 1].charAt(0) : '')).toUpperCase();
  }
  function avatar(pid, size) {
    var p = pid ? C.person(App.S.state, pid) : null;
    var cls = 'avatar' + (size ? ' ' + size : '');
    if (!p) return '<span class="' + cls + ' unassigned" title="Unassigned">' + icon('user', size === 'sm' ? 10 : 13) + '</span>';
    return '<span class="' + cls + '" style="background:' + AV_COLORS[hash(p.id) % AV_COLORS.length] + '" title="' + esc(p.name) + '">' + esc(initials(p.name)) + '</span>';
  }
  function avatars(ids, size, max) {
    ids = (ids || []).filter(Boolean);
    max = max || 4;
    var out = ids.slice(0, max).map(function (id) { return avatar(id, size); }).join('');
    if (ids.length > max) out += '<span class="avatar ' + (size || '') + '" style="background:#9ca3af">+' + (ids.length - max) + '</span>';
    return '<span class="avatars">' + out + '</span>';
  }
  function pname(pid, fallback) {
    var p = pid ? C.person(App.S.state, pid) : null;
    return p ? p.name : (fallback || 'Someone');
  }
  function firstName(pid) { return pname(pid).split(' ')[0]; }
  function teamChip(tid) {
    var t = C.team(App.S.state, tid);
    if (!t) return '';
    return '<span class="chip"><span class="team-dot" style="background:' + esc(t.color) + '"></span>' + esc(t.name) + '</span>';
  }
  function projectChip(prid) {
    var p = prid ? C.byId(App.S.state.projects, prid) : null;
    if (!p || p.deleted) return '';
    return '<span class="chip" title="Project">' + icon('target', 11) + esc(p.name) + '</span>';
  }
  function statusOf(id) { return C.STATUSES.filter(function (s) { return s.id === id; })[0] || C.STATUSES[0]; }
  function prioOf(id) { return C.PRIORITIES.filter(function (s) { return s.id === id; })[0] || C.PRIORITIES[1]; }
  function healthOf(id) { return C.HEALTH.filter(function (s) { return s.id === id; })[0] || null; }
  function statusPill(id) {
    var s = statusOf(id);
    return '<span class="pill status-pill" style="background:' + s.color + '1a;color:' + s.color + '"><span class="dot" style="background:' + s.color + '"></span>' + s.label + '</span>';
  }
  function prioPill(id) {
    var p = prioOf(id);
    return '<span class="pill" style="background:' + p.color + '1f;color:' + shade(p.color) + '">' + p.label + '</span>';
  }
  function healthPill(id) {
    var h = healthOf(id);
    if (!h) return '<span class="muted" style="font-size:13px">No check-in yet</span>';
    return '<span class="pill" style="background:' + h.color + '1a;color:' + shade(h.color) + '"><span class="dot" style="background:' + h.color + '"></span>' + h.label + '</span>';
  }
  function shade(hex) {
    // darker variant for text on a tinted background
    var m = /^#?([0-9a-f]{6})$/i.exec(hex); if (!m) return hex;
    var n = parseInt(m[1], 16), r = (n >> 16) * .72, g = ((n >> 8) & 255) * .72, b = (n & 255) * .72;
    return 'rgb(' + (r | 0) + ',' + (g | 0) + ',' + (b | 0) + ')';
  }
  App.avatar = avatar; App.avatars = avatars; App.pname = pname; App.firstName = firstName;
  App.teamChip = teamChip; App.projectChip = projectChip; App.statusPill = statusPill; App.prioPill = prioPill;
  App.healthPill = healthPill; App.statusOf = statusOf; App.prioOf = prioOf; App.healthOf = healthOf; App.initials = initials;
  App.avColor = function (id) { return AV_COLORS[hash(id) % AV_COLORS.length]; };

  /* ---------- dates ---------- */
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  function fmtDate(k, opts) {
    if (!k) return '';
    var d = C.parseDateKey(k), today = C.todayKey();
    var diff = C.daysBetween(today, k);
    if (!(opts && opts.absolute)) {
      if (diff === 0) return 'Today';
      if (diff === 1) return 'Tomorrow';
      if (diff === -1) return 'Yesterday';
      if (diff > 1 && diff < 7) return DOW[d.getDay()];
    }
    var s = MON[d.getMonth()] + ' ' + d.getDate();
    if (d.getFullYear() !== new Date().getFullYear()) s += ', ' + d.getFullYear();
    return s;
  }
  function dueHtml(t) {
    if (!t.dueDate) return '';
    var cls = 'due';
    if (!C.isDone(t)) {
      var diff = C.daysBetween(C.todayKey(), t.dueDate);
      if (diff < 0) cls += ' overdue';
      else if (diff === 0) cls += ' today';
      else if (diff <= 2) cls += ' soon';
    }
    var label = fmtDate(t.dueDate);
    if (cls.indexOf('overdue') !== -1) {
      var late = -C.daysBetween(C.todayKey(), t.dueDate);
      label += ' · ' + late + 'd late';
    }
    return '<span class="' + cls + '" title="Due ' + esc(fmtDate(t.dueDate, { absolute: true })) + '">' + label + '</span>';
  }
  function relTime(iso) {
    if (!iso) return '';
    var s = (Date.now() - new Date(iso).getTime()) / 1000;
    if (s < 60) return 'just now';
    if (s < 3600) return Math.floor(s / 60) + 'm ago';
    if (s < 86400) return Math.floor(s / 3600) + 'h ago';
    if (s < 86400 * 7) return Math.floor(s / 86400) + 'd ago';
    var d = new Date(iso);
    return MON[d.getMonth()] + ' ' + d.getDate() + (d.getFullYear() !== new Date().getFullYear() ? ', ' + d.getFullYear() : '');
  }
  App.fmtDate = fmtDate; App.dueHtml = dueHtml; App.relTime = relTime; App.MON = MON; App.DOW = DOW;

  /* Parses "today", "tomorrow", "fri", "next mon", "in 3 days", "12/5", "dec 5", "2026-12-05". */
  function parseDatePhrase(str) {
    var s = String(str || '').trim().toLowerCase().replace(/[.,]$/, '');
    if (!s) return null;
    var today = C.todayKey();
    var d0 = C.parseDateKey(today);
    if (s === 'today' || s === 'tod') return today;
    if (s === 'tomorrow' || s === 'tmr' || s === 'tmrw') return C.addDays(today, 1);
    if (s === 'next week') return C.addDays(today, ((8 - d0.getDay()) % 7) || 7);
    if (s === 'end of week' || s === 'eow') return C.addDays(today, (5 - d0.getDay() + 7) % 7);
    var m = /^in (\d+) (day|days|week|weeks)$/.exec(s);
    if (m) return C.addDays(today, +m[1] * (m[2].indexOf('week') === 0 ? 7 : 1));
    var days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    m = /^(next |this )?(sun|mon|tue|tues|wed|thu|thur|thurs|fri|sat)[a-z]*$/.exec(s);
    if (m) {
      var target = days.indexOf(m[2].slice(0, 3));
      var delta = (target - d0.getDay() + 7) % 7;
      if (delta === 0) delta = 7;
      if (m[1] === 'next ' && delta < 7) delta += 7 * (delta <= (6 - d0.getDay()) ? 1 : 0);
      return C.addDays(today, delta);
    }
    m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
    if (m) return C.dateKey(new Date(+m[1], +m[2] - 1, +m[3]));
    m = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/.exec(s);
    if (m) return rollYear(+m[1] - 1, +m[2], m[3]);
    m = /^([a-z]{3})[a-z]* (\d{1,2})(?:,? (\d{4}))?$/.exec(s);
    if (m) {
      var mi = MON.map(function (x) { return x.toLowerCase(); }).indexOf(m[1]);
      if (mi !== -1) return rollYear(mi, +m[2], m[3]);
    }
    return null;
    function rollYear(month, day, year) {
      var y = year ? (+year < 100 ? 2000 + +year : +year) : d0.getFullYear();
      var d = new Date(y, month, day);
      if (!year && C.dateKey(d) < C.addDays(today, -30)) d = new Date(y + 1, month, day);
      return isNaN(d) ? null : C.dateKey(d);
    }
  }
  App.parseDatePhrase = parseDatePhrase;

  /* Quick add: "Design flyer @leo #marketing !high due fri" */
  function parseQuick(text) {
    var st = App.S.state;
    var out = { title: text, owner: undefined, team: undefined, priority: undefined, dueDate: undefined };
    var s = ' ' + text + ' ';
    s = s.replace(/\s@([a-z][\w.'-]*)(?:[ _]([a-z][\w'-]*))?(?=\s)/ig, function (m, a, b) {
      var full = (a + (b ? ' ' + b : '')).toLowerCase();
      var people = C.activePeople(st);
      var hit = b && people.filter(function (p) { return p.name.toLowerCase() === full; })[0];
      if (hit) { out.owner = hit.id; return ' '; }
      var firsts = people.filter(function (p) { return p.name.toLowerCase().split(' ')[0] === a.toLowerCase(); });
      if (!firsts.length) firsts = people.filter(function (p) { return p.name.toLowerCase().indexOf(a.toLowerCase()) === 0; });
      if (firsts.length === 1) { out.owner = firsts[0].id; return ' ' + (b ? b + ' ' : ''); }
      return m;
    });
    s = s.replace(/\s#([\w-]+)(?=\s)/g, function (m, name) {
      var t = st.teams.filter(function (x) { return !x.deleted && (x.id === name.toLowerCase() || x.name.toLowerCase().indexOf(name.toLowerCase()) === 0); })[0];
      if (t) { out.team = t.id; return ' '; }
      return m;
    });
    s = s.replace(/\s!(low|med|medium|high|urgent|[0-3])(?=\s)/i, function (m, p) {
      var map = { low: 'low', med: 'med', medium: 'med', high: 'high', urgent: 'urgent', '0': 'low', '1': 'med', '2': 'high', '3': 'urgent' };
      out.priority = map[p.toLowerCase()];
      return ' ';
    });
    var dm = /\s(?:due|by|\^)\s*([^@#!]+?)\s*$/i.exec(s);
    if (dm) {
      var words = dm[1].trim().split(/\s+/);
      for (var n = Math.min(3, words.length); n >= 1; n--) {
        var k = parseDatePhrase(words.slice(0, n).join(' '));
        if (k && n === words.length) { out.dueDate = k; s = s.slice(0, dm.index) + ' '; break; }
      }
    } else {
      var tail = /\s(today|tomorrow)\s*$/i.exec(s);
      if (tail) { out.dueDate = parseDatePhrase(tail[1]); s = s.slice(0, tail.index) + ' '; }
    }
    out.title = s.replace(/\s+/g, ' ').trim();
    return out;
  }
  App.parseQuick = parseQuick;

  /* ---------- markdown-lite ---------- */
  function inline(s) {
    // s is already escaped
    s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
    s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    s = s.replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g, function (m, pre, url) {
      var clean = url.replace(/[.,;:!?]+$/, '');
      var tail = url.slice(clean.length);
      return pre + '<a href="' + clean + '" target="_blank" rel="noopener">' + shortUrl(clean) + '</a>' + tail;
    });
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/(^|[\s(])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>');
    s = s.replace(/(^|[\s(])_([^_\s][^_]*)_/g, '$1<em>$2</em>');
    s = highlightMentions(s);
    return s;
  }
  function shortUrl(u) {
    var m = /^https?:\/\/(?:www\.)?([^/]+)(\/.*)?$/.exec(u);
    if (!m) return u;
    var path = m[2] || '';
    return m[1] + (path.length > 24 ? path.slice(0, 22) + '…' : path);
  }
  function highlightMentions(s) {
    if (s.indexOf('@') === -1) return s;
    var names = [];
    C.activePeople(App.S.state).forEach(function (p) {
      var full = esc(p.name);
      names.push(full, full.split(' ')[0]);
    });
    if (!names.length) return s;
    names.sort(function (a, b) { return b.length - a.length; });
    var re = new RegExp('(^|[\\s(>])@(' + names.map(escapeRe).join('|') + ')(?![\\w])', 'gi');
    return s.replace(re, function (m, pre, name) { return pre + '<span class="mention">@' + name + '</span>'; });
  }
  function escapeRe(x) { return x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  function md(src) {
    var lines = esc(src || '').split('\n');
    var html = '', list = null, para = [];
    function flushPara() { if (para.length) { html += '<p>' + para.map(inline).join('<br>') + '</p>'; para = []; } }
    function flushList() { if (list) { html += '</' + list + '>'; list = null; } }
    lines.forEach(function (line) {
      var ul = /^\s*[-*•]\s+(.*)$/.exec(line), ol = /^\s*\d+[.)]\s+(.*)$/.exec(line), hd = /^#{1,4}\s+(.*)$/.exec(line);
      if (ul || ol) {
        flushPara();
        var type = ul ? 'ul' : 'ol';
        if (list !== type) { flushList(); html += '<' + type + '>'; list = type; }
        var body = (ul || ol)[1];
        var box = /^\[( |x)\]\s+(.*)$/i.exec(body);
        if (box) body = (box[1].toLowerCase() === 'x' ? '☑ ' : '☐ ') + box[2];
        html += '<li>' + inline(body) + '</li>';
      } else if (hd) {
        flushPara(); flushList();
        html += '<h4>' + inline(hd[1]) + '</h4>';
      } else if (!line.trim()) {
        flushPara(); flushList();
      } else {
        flushList();
        para.push(line);
      }
    });
    flushPara(); flushList();
    return html;
  }
  App.md = md;
  App.inline = function (s) { return inline(esc(s)); };

  /* ---------- link kind badge ---------- */
  var KIND = {
    doc: ['DOC', '#4285f4'], sheet: ['XLS', '#0f9d58'], slides: ['PPT', '#f4b400'], form: ['FORM', '#7248b9'],
    folder: ['DIR', '#5f6368'], drive: ['FILE', '#5f6368'], pdf: ['PDF', '#d93025'], github: ['GH', '#24292f'],
    slack: ['#', '#4a154b'], calendar: ['CAL', '#1a73e8'], notion: ['N', '#111'], design: ['ART', '#00c4cc'], link: ['URL', '#94a3b8']
  };
  App.kindIcon = function (kind) {
    var k = KIND[kind] || KIND.link;
    return '<span class="kind-ico" style="background:' + k[1] + ';font-size:' + (k[0].length > 3 ? 8.5 : 10) + 'px">' + k[0] + '</span>';
  };
  App.KIND_LABELS = { doc: 'Google Docs', sheet: 'Google Sheets', slides: 'Google Slides', form: 'Google Forms', folder: 'Drive folders', drive: 'Drive files', pdf: 'PDFs', github: 'GitHub', slack: 'Slack', calendar: 'Calendar', notion: 'Notion', design: 'Design', link: 'Other links' };

  /* ---------- toasts ---------- */
  App.toast = function (msg, opts) {
    opts = opts || {};
    var box = document.getElementById('toasts');
    if (!box) return;
    var el = document.createElement('div');
    el.className = 'toast' + (opts.type ? ' ' + opts.type : '');
    var ico = opts.type === 'err' ? '⚠️' : opts.type === 'slack' ? '💬' : opts.icon || '✓';
    el.innerHTML = '<span class="t-ico">' + ico + '</span><span>' + (opts.html ? msg : esc(msg)) + '</span>' + (opts.action ? '<button type="button">' + esc(opts.action.label) + '</button>' : '');
    if (opts.action) el.querySelector('button').onclick = function () { opts.action.fn(); el.remove(); };
    box.appendChild(el);
    while (box.children.length > 4) box.firstChild.remove();
    setTimeout(function () { el.remove(); }, opts.timeout || (opts.type === 'err' ? 7000 : 4200));
  };

  /* ---------- popovers ---------- */
  var openPop = null;
  function closePop() { if (openPop) { openPop.remove(); openPop = null; } }
  App.closePop = closePop;
  App.hasPop = function () { return !!openPop; };
  function placePop(pop, anchor) {
    var r = anchor.getBoundingClientRect();
    document.body.appendChild(pop);
    var pw = pop.offsetWidth, ph = pop.offsetHeight;
    var left = Math.min(r.left, window.innerWidth - pw - 8);
    var top = r.bottom + 4;
    if (top + ph > window.innerHeight - 8) top = Math.max(8, r.top - ph - 4);
    pop.style.left = Math.max(8, left) + 'px';
    pop.style.top = top + 'px';
  }
  /* items: [{id, label, sub, html(left decoration), group}] */
  App.pick = function (anchor, opts, onSelect) {
    closePop();
    var selected = (opts.selected || []).slice();
    var pop = document.createElement('div');
    pop.className = 'pop';
    pop.innerHTML = (opts.search === false ? '' : '<input class="pop-search" placeholder="' + esc(opts.placeholder || 'Search…') + '">') + '<div class="pop-list"></div>';
    var list = pop.querySelector('.pop-list');
    var input = pop.querySelector('input');
    var hl = 0, visible = [];
    function draw() {
      var q = input ? input.value.trim().toLowerCase() : '';
      visible = opts.items.filter(function (it) { return !q || (it.label + ' ' + (it.sub || '')).toLowerCase().indexOf(q) !== -1; });
      var html = '', lastGroup = null;
      visible.forEach(function (it, i) {
        if (it.group && it.group !== lastGroup && !q) { html += '<div class="pop-group">' + esc(it.group) + '</div>'; lastGroup = it.group; }
        var checked = selected.indexOf(it.id) !== -1;
        html += '<button type="button" class="pop-item' + (i === hl ? ' hl' : '') + (checked ? ' checked' : '') + '" data-i="' + i + '">' + (it.html || '') + '<span>' + esc(it.label) + '</span>' + (it.sub && !checked ? '<span class="sub">' + esc(it.sub) + '</span>' : '') + '</button>';
      });
      list.innerHTML = html || '<div class="pop-group">No matches</div>';
    }
    function choose(i) {
      var it = visible[i];
      if (!it) return;
      if (opts.multi) {
        var at = selected.indexOf(it.id);
        if (at === -1) selected.push(it.id); else selected.splice(at, 1);
        onSelect(selected.slice());
        draw();
      } else {
        closePop();
        onSelect(it.id);
      }
    }
    list.addEventListener('mousedown', function (e) { e.preventDefault(); });
    list.addEventListener('click', function (e) {
      var b = e.target.closest('.pop-item');
      if (b) choose(+b.dataset.i);
    });
    if (input) {
      input.addEventListener('input', function () { hl = 0; draw(); });
      input.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowDown') { hl = Math.min(visible.length - 1, hl + 1); draw(); e.preventDefault(); }
        else if (e.key === 'ArrowUp') { hl = Math.max(0, hl - 1); draw(); e.preventDefault(); }
        else if (e.key === 'Enter') { choose(hl); e.preventDefault(); }
        else if (e.key === 'Escape') { closePop(); e.stopPropagation(); }
      });
    }
    draw();
    placePop(pop, anchor);
    openPop = pop;
    if (input) setTimeout(function () { input.focus(); }, 0);
  };
  /* menu items: [{label, icon, fn, danger}] or 'sep' */
  App.menu = function (anchor, items) {
    closePop();
    var pop = document.createElement('div');
    pop.className = 'pop';
    pop.innerHTML = '<div class="pop-list">' + items.map(function (it, i) {
      if (it === 'sep') return '<div class="pop-sep"></div>';
      return '<button type="button" class="pop-item" data-i="' + i + '"' + (it.danger ? ' style="color:var(--bad)"' : '') + '>' + (it.icon ? icon(it.icon, 15) : '') + '<span>' + esc(it.label) + '</span>' + (it.sub ? '<span class="sub">' + esc(it.sub) + '</span>' : '') + '</button>';
    }).join('') + '</div>';
    pop.addEventListener('click', function (e) {
      var b = e.target.closest('.pop-item');
      if (!b) return;
      closePop();
      items[+b.dataset.i].fn();
    });
    placePop(pop, anchor);
    openPop = pop;
  };
  document.addEventListener('mousedown', function (e) {
    if (openPop && !openPop.contains(e.target)) closePop();
  }, true);

  /* people picker items, grouped by team with the given team first */
  App.peopleItems = function (firstTeam, opts) {
    var st = App.S.state;
    var items = [];
    if (opts && opts.allowNone) items.push({ id: null, label: 'Unassigned', html: avatar(null, 'sm') });
    var teams = st.teams.filter(function (t) { return !t.deleted; }).slice();
    teams.sort(function (a, b) { return (a.id === firstTeam ? -1 : 0) - (b.id === firstTeam ? -1 : 0); });
    var seen = {};
    teams.forEach(function (t) {
      C.activePeople(st).filter(function (p) { return C.has(p.teams, t.id); })
        .sort(function (a, b) { return (a.role === 'lead' ? -1 : 0) - (b.role === 'lead' ? -1 : 0) || a.name.localeCompare(b.name); })
        .forEach(function (p) {
          if (seen[p.id]) return;
          seen[p.id] = 1;
          items.push({ id: p.id, label: p.name, sub: p.title || roleLabel(p.role), html: avatar(p.id, 'sm'), group: t.name });
        });
    });
    C.activePeople(st).forEach(function (p) {
      if (!seen[p.id]) items.push({ id: p.id, label: p.name, sub: p.title || roleLabel(p.role), html: avatar(p.id, 'sm'), group: 'No team' });
    });
    return items;
  };
  function roleLabel(r) { var x = C.ROLES.filter(function (o) { return o.id === r; })[0]; return x ? x.label : ''; }
  App.roleLabel = roleLabel;

  /* ---------- modals ---------- */
  var modalStack = [];
  App.modal = function (o) {
    closePop();
    var wrap = document.createElement('div');
    wrap.className = 'modal-wrap';
    wrap.innerHTML = '<div class="modal ' + (o.cls || '') + '" role="dialog" aria-modal="true" aria-label="' + esc(o.title || 'Dialog') + '">' +
      (o.title ? '<div class="modal-head"><h2>' + esc(o.title) + '</h2><span style="flex:1"></span><button type="button" class="icon-btn" data-close aria-label="Close">' + icon('x') + '</button></div>' : '') +
      '<div class="modal-body">' + (o.body || '') + '</div>' +
      (o.foot ? '<div class="modal-foot">' + o.foot + '</div>' : '') + '</div>';
    var api = {
      el: wrap,
      close: function () {
        wrap.remove();
        modalStack = modalStack.filter(function (m) { return m !== api; });
        if (o.onClose) o.onClose();
      }
    };
    wrap.addEventListener('mousedown', function (e) { if (e.target === wrap) api.close(); });
    wrap.addEventListener('click', function (e) { if (e.target.closest('[data-close]')) api.close(); });
    document.body.appendChild(wrap);
    modalStack.push(api);
    if (o.onMount) o.onMount(wrap, api);
    var first = wrap.querySelector('[autofocus], input:not([type=hidden]), textarea, select');
    if (first) setTimeout(function () { first.focus(); }, 30);
    return api;
  };
  App.closeTopModal = function () {
    var m = modalStack[modalStack.length - 1];
    if (m) { m.close(); return true; }
    return false;
  };
  App.hasModal = function () { return modalStack.length > 0; };
  App.confirm = function (msg, opts) {
    opts = opts || {};
    return new Promise(function (resolve) {
      var done = false;
      var m = App.modal({
        title: opts.title || 'Are you sure?',
        body: '<p style="margin:0;line-height:1.5">' + esc(msg) + '</p>',
        foot: '<button type="button" class="btn" data-close>Cancel</button><button type="button" class="btn ' + (opts.danger ? 'danger' : 'primary') + '" data-ok>' + esc(opts.ok || 'OK') + '</button>',
        onMount: function (el, api) {
          el.querySelector('[data-ok]').onclick = function () { done = true; api.close(); resolve(true); };
          setTimeout(function () { el.querySelector('[data-ok]').focus(); }, 40);
        },
        onClose: function () { if (!done) resolve(false); }
      });
      return m;
    });
  };

  /* ---------- misc ---------- */
  App.copyText = function (text) {
    function fallback() {
      var ta = document.createElement('textarea');
      ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); } catch (e) { /* ignore */ }
      ta.remove();
    }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).catch(fallback);
    else fallback();
  };
  App.download = function (filename, text) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
  };
  App.plural = function (n, word, pl) { return n + ' ' + (n === 1 ? word : (pl || word + 's')); };
})(App);
