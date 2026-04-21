// =============================================================
// Shadow ToDo - agenda-view.js
// Modular Agenda View: bucket logic + TaskRow/TaskCard components
// Exposes window.ShadowAgenda. Decoupled via ctx injection.
// =============================================================
(function () {
  'use strict';

  // ---- BUCKETS (section metadata) -----------------------------
  var BUCKETS = [
    { key:'overdue',   label:'Overdue',    color:'var(--accent-red, #ea4335)',    emptyMsg:'No overdue tasks' },
    { key:'today',     label:'Today',      color:'var(--accent-orange, #f59f00)', emptyMsg:'No tasks for today' },
    { key:'tomorrow',  label:'Tomorrow',   color:'var(--accent-yellow, #fbbc04)', emptyMsg:'No tasks for tomorrow' },
    { key:'thisWeek',  label:'This Week',  color:'var(--column-blue, #4285f4)',   emptyMsg:'No tasks this week' },
    { key:'thisMonth', label:'This Month', color:'var(--accent-blue, #1967d2)',   emptyMsg:'No tasks this month' },
    { key:'upcoming',  label:'Upcoming',   color:'var(--accent-green, #34a853)',  emptyMsg:'No upcoming tasks' }
  ];

  // ---- DATE HELPERS -------------------------------------------
  function startOfDay(d) { var x = new Date(d); x.setHours(0,0,0,0); return x; }
  function addDays(d, n) { var x = new Date(d); x.setDate(x.getDate()+n); return x; }
  function endOfWeekSunday(d) {
    var x = startOfDay(d);
    var dow = x.getDay();
    var daysToSun = (7 - dow) % 7;
    return addDays(x, daysToSun);
  }
  function endOfMonth(d) {
    var x = startOfDay(d);
    return new Date(x.getFullYear(), x.getMonth()+1, 0);
  }

  function bucketOf(dueDate, now) {
    if (!dueDate) return null;
    var today = startOfDay(now || new Date());
    var tomorrow = addDays(today, 1);
    var weekEnd = endOfWeekSunday(today);
    var monthEnd = endOfMonth(today);
    var d = startOfDay(new Date(dueDate + 'T00:00:00'));
    if (d.getTime() < today.getTime())      return 'overdue';
    if (d.getTime() === today.getTime())    return 'today';
    if (d.getTime() === tomorrow.getTime()) return 'tomorrow';
    if (d.getTime() <= weekEnd.getTime())   return 'thisWeek';
    if (d.getTime() <= monthEnd.getTime())  return 'thisMonth';
    return 'upcoming';
  }

  // ---- BUCKET FILL --------------------------------------------
  function getBuckets(tasks, opts) {
    var now = (opts && opts.now) || new Date();
    var out = {};
    BUCKETS.forEach(function (s) { out[s.key] = []; });
    (tasks || []).forEach(function (t) {
      if (!t || !t.dueDate) return;
      var k = bucketOf(t.dueDate, now);
      if (k && out[k]) out[k].push(t);
    });
    return out;
  }

  // ---- SORT (priority then alphabetical) ----------------------
  var PRIORITY_RANK = { 'High': 0, 'Medium': 1, 'Low': 2 };
  function priorityRank(p) {
    return PRIORITY_RANK.hasOwnProperty(p) ? PRIORITY_RANK[p] : 3;
  }
  function sortBucket(tasks) {
    return (tasks || []).slice().sort(function (a, b) {
      var pa = priorityRank(a && a.priority);
      var pb = priorityRank(b && b.priority);
      if (pa !== pb) return pa - pb;
      var ta = (a && a.title) ? String(a.title) : '';
      var tb = (b && b.title) ? String(b.title) : '';
      return ta.localeCompare(tb, undefined, { sensitivity: 'base' });
    });
  }

  // ---- ESCAPE HELPER (XSS safety) -----------------------------
  function esc(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // ---- CONTEXT LOOKUPS ----------------------------------------
  function parentListName(t, ctx) {
    if (!ctx || !ctx.groups) return '';
    var gid = t.group || t.groupId;
    if (!gid) return '';
    var g = ctx.groups.find(function (x) { return x.id === gid; });
    return g ? g.name : '';
  }
  function priorityColor(p, ctx) {
    if (ctx && typeof ctx.priColor === 'function') return ctx.priColor(p);
    if (p === 'High')   return 'var(--accent-red, #ea4335)';
    if (p === 'Medium') return 'var(--accent-orange, #f59f00)';
    if (p === 'Low')    return 'var(--accent-green, #34a853)';
    return 'var(--text-muted, #9aa0a6)';
  }
  function fmtDate(ds, ctx) {
    if (ctx && typeof ctx.formatDate === 'function') return ctx.formatDate(ds);
    return ds || '';
  }
  function isOverdueFn(ds, ctx) {
    if (ctx && typeof ctx.isOverdue === 'function') return ctx.isOverdue(ds);
    if (!ds) return false;
    return new Date(ds + 'T23:59:59') < new Date();
  }
  function isDone(t) {
    var s = (t && t.status) ? String(t.status).toLowerCase() : '';
    return s === 'completed' || s === 'done' || s === 'closed' || s === 'fixed';
  }

  // ---- TASK ROW (list-view) -----------------------------------
  function TaskRow(t, ctx) {
    var done = isDone(t);
    var pri = t.priority || 'None';
    var priCol = priorityColor(pri, ctx);
    var parent = parentListName(t, ctx);
    var overdueCls = (!done && isOverdueFn(t.dueDate, ctx)) ? ' agenda-row--overdue' : '';
    var doneCls = done ? ' agenda-row--done' : '';

    return '' +
      '<div class="agenda-row' + overdueCls + doneCls + '" data-taskid="' + esc(t.id) + '" role="listitem">' +
        '<label class="agenda-row__check" title="' + (done ? 'Mark as open' : 'Mark as complete') + '">' +
          '<input type="checkbox" class="agenda-check" data-taskid="' + esc(t.id) + '"' + (done ? ' checked' : '') + '>' +
          '<span class="agenda-check__box" aria-hidden="true"></span>' +
        '</label>' +
        '<span class="agenda-row__priority" title="Priority: ' + esc(pri) + '" style="background:' + priCol + '" data-priority="' + esc(pri) + '"></span>' +
        '<div class="agenda-row__main">' +
          '<div class="agenda-row__title">' + esc(t.title || '(untitled)') + '</div>' +
          (parent ? '<span class="agenda-row__list-tag" title="List">' + esc(parent) + '</span>' : '') +
        '</div>' +
        (t.dueDate ? '<div class="agenda-row__due"><i class="fa-regular fa-calendar"></i> ' + esc(fmtDate(t.dueDate, ctx)) + '</div>' : '') +
      '</div>';
  }

  // ---- TASK CARD (board-view) ---------------------------------
  function TaskCard(t, ctx) {
    var done = isDone(t);
    var pri = t.priority || 'None';
    var priCol = priorityColor(pri, ctx);
    var parent = parentListName(t, ctx);
    var overdueCls = (!done && isOverdueFn(t.dueDate, ctx)) ? ' agenda-card--overdue' : '';
    var doneCls = done ? ' agenda-card--done' : '';

    return '' +
      '<div class="agenda-card' + overdueCls + doneCls + '" data-taskid="' + esc(t.id) + '">' +
        '<div class="agenda-card__top">' +
          '<label class="agenda-row__check" title="' + (done ? 'Mark as open' : 'Mark as complete') + '">' +
            '<input type="checkbox" class="agenda-check" data-taskid="' + esc(t.id) + '"' + (done ? ' checked' : '') + '>' +
            '<span class="agenda-check__box" aria-hidden="true"></span>' +
          '</label>' +
          '<span class="agenda-row__priority" title="Priority: ' + esc(pri) + '" style="background:' + priCol + '" data-priority="' + esc(pri) + '"></span>' +
          '<div class="agenda-card__title">' + esc(t.title || '(untitled)') + '</div>' +
        '</div>' +
        '<div class="agenda-card__meta">' +
          (parent ? '<span class="agenda-row__list-tag">' + esc(parent) + '</span>' : '') +
          (t.dueDate ? '<span class="agenda-card__due"><i class="fa-regular fa-calendar"></i> ' + esc(fmtDate(t.dueDate, ctx)) + '</span>' : '') +
        '</div>' +
      '</div>';
  }

  // ---- SECTION WRAPPERS ---------------------------------------
  function renderListSection(sec, tasks, ctx) {
    var rows = tasks.length
      ? tasks.map(function (t) { return TaskRow(t, ctx); }).join('')
      : '<div class="agenda-empty">' + esc(sec.emptyMsg) + '</div>';
    return '' +
      '<section class="agenda-section" data-section="' + sec.key + '">' +
        '<header class="agenda-section__header" style="border-left:3px solid ' + sec.color + '">' +
          '<span class="agenda-section__title">' + esc(sec.label) + '</span>' +
          '<span class="agenda-section__count">' + tasks.length + '</span>' +
        '</header>' +
        '<div class="agenda-section__body" role="list">' + rows + '</div>' +
      '</section>';
  }

  function renderBoardColumn(sec, tasks, ctx) {
    var cards = tasks.length
      ? tasks.map(function (t) { return TaskCard(t, ctx); }).join('')
      : '<div class="agenda-empty agenda-empty--col">' + esc(sec.emptyMsg) + '</div>';
    return '' +
      '<div class="agenda-col" data-section="' + sec.key + '">' +
        '<div class="agenda-col__header" style="border-top:3px solid ' + sec.color + '">' +
          '<span class="agenda-col__title">' + esc(sec.label) + '</span>' +
          '<span class="agenda-col__count">' + tasks.length + '</span>' +
        '</div>' +
        '<div class="agenda-col__body">' + cards + '</div>' +
      '</div>';
  }

  // ---- TOP-LEVEL RENDER ---------------------------------------
  function renderList(container, tasks, ctx) {
    if (!container) return;
    var buckets = getBuckets(tasks, ctx);
    var html = '' +
      '<div class="agenda-view agenda-view--list">' +
        '<h2 class="agenda-view__header">Agenda</h2>' +
        BUCKETS.map(function (sec) {
          return renderListSection(sec, sortBucket(buckets[sec.key]), ctx);
        }).join('') +
      '</div>';
    container.innerHTML = html;
    bindInteractions(container, ctx);
  }

  function renderBoard(container, tasks, ctx) {
    if (!container) return;
    var buckets = getBuckets(tasks, ctx);
    var html = '' +
      '<div class="agenda-view agenda-view--board">' +
        '<h2 class="agenda-view__header">Agenda</h2>' +
        '<div class="agenda-board">' +
          BUCKETS.map(function (sec) {
            return renderBoardColumn(sec, sortBucket(buckets[sec.key]), ctx);
          }).join('') +
        '</div>' +
      '</div>';
    container.innerHTML = html;
    bindInteractions(container, ctx);
  }

  // ---- INTERACTIONS -------------------------------------------
  function bindInteractions(root, ctx) {
    root.querySelectorAll('.agenda-check').forEach(function (cb) {
      cb.addEventListener('click', function (e) { e.stopPropagation(); });
      cb.addEventListener('change', function (e) {
        var id = this.dataset.taskid;
        if (!id) return;
        if (ctx && typeof ctx.onToggleComplete === 'function') {
          ctx.onToggleComplete(id, this.checked);
        }
      });
    });
    var openDetail = function (id) {
      if (ctx && typeof ctx.onTaskClick === 'function') ctx.onTaskClick(id);
    };
    root.querySelectorAll('.agenda-row').forEach(function (row) {
      row.addEventListener('click', function (e) {
        if (e.target.closest('.agenda-row__check')) return;
        openDetail(this.dataset.taskid);
      });
    });
    root.querySelectorAll('.agenda-card').forEach(function (card) {
      card.addEventListener('click', function (e) {
        if (e.target.closest('.agenda-row__check')) return;
        openDetail(this.dataset.taskid);
      });
    });
  }

  // ---- PUBLIC API ---------------------------------------------
  window.ShadowAgenda = {
    BUCKETS: BUCKETS,
    getBuckets: getBuckets,
    sortBucket: sortBucket,
    bucketOf: bucketOf,
    TaskRow: TaskRow,
    TaskCard: TaskCard,
    renderList: renderList,
    renderBoard: renderBoard
  };
})();
