// ============================================================================
// Shadow ToDo — "Created by Me" view module
// Exposes window.ShadowCreatedByMe with pure render helpers.
// Decoupled from app.js via ctx injection (members, currentUserId, handlers).
// ============================================================================
(function (global) {
  'use strict';

  const STATUS_BUCKETS = ['Open', 'In Progress', 'Pending Review', 'Completed'];
  const STATUS_COLORS = {
    'Open':            'var(--accent-blue, #3b82f6)',
    'In Progress':     'var(--accent-amber, #f59e0b)',
    'Pending Review':  'var(--accent-violet, #8b5cf6)',
    'Completed':       'var(--accent-green, #10b981)'
  };

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function meName(ctx) {
    const m = (ctx.members || []).find(x => x.id === ctx.currentUserId);
    return m ? m.name : '';
  }
  function initialsOf(name) {
    if (!name) return '?';
    const parts = String(name).trim().split(/\s+/).slice(0, 2);
    return parts.map(p => p.charAt(0).toUpperCase()).join('') || '?';
  }
  function avatarHTML(name) {
    const n = name || 'Unassigned';
    const hue = Math.abs([...n].reduce((a, c) => a + c.charCodeAt(0), 0)) % 360;
    return '<span class="cbm-avatar" style="background:hsl(' + hue + ',55%,55%)" title="' + esc(n) + '">' + esc(initialsOf(n)) + '</span>';
  }

  function filterCreatedByMe(tasks, ctx) {
    const uid = ctx.currentUserId;
    return (tasks || []).filter(function (t) {
      return t.createdBy === uid || !t.createdBy;
    });
  }
  function applySubFilter(tasks, ctx, sub) {
    const me = meName(ctx);
    if (sub === 'mine') {
      return tasks.filter(function (t) { return !t.assignee || t.assignee === me; });
    }
    if (sub === 'delegated') {
      return tasks.filter(function (t) { return t.assignee && t.assignee !== me; });
    }
    return tasks;
  }

  function groupByStatus(tasks) {
    const groups = {};
    STATUS_BUCKETS.forEach(function (k) { groups[k] = []; });
    tasks.forEach(function (t) {
      const s = STATUS_BUCKETS.indexOf(t.status) >= 0 ? t.status : 'Open';
      groups[s].push(t);
    });
    return groups;
  }

  function parentLabel(task, ctx) {
    if (!task.group) return 'Personal Task';
    const g = (ctx.groups || []).find(function (x) { return x.id === task.group; });
    return g ? g.name : 'Personal Task';
  }

  function TaskRow(task, ctx, props) {
    props = props || {};
    const showAssignee = props.showAssignee !== false;
    const showStatus   = props.showStatus   !== false;
    const priColor = (ctx.priColor && ctx.priColor(task.priority)) || 'var(--border,#ccc)';
    const done = task.status === 'Completed';
    const assigneeBlock = showAssignee
      ? '<span class="cbm-assignee">' + avatarHTML(task.assignee) + '<span class="cbm-assignee-name">' + esc(task.assignee || 'Unassigned') + '</span></span>'
      : '';
    const statusBlock = showStatus
      ? '<span class="cbm-status" data-status="' + esc(task.status || 'Open') + '" style="background:' + STATUS_COLORS[task.status || 'Open'] + '">' + esc(task.status || 'Open') + '</span>'
      : '';
    const dueBlock = task.dueDate
      ? '<span class="cbm-due">' + esc(task.dueDate) + '</span>'
      : '';
    const me = meName(ctx);
    const isDelegated = task.assignee && task.assignee !== me;
    // TODO(perms): if (isDelegated && !ctx.isAdmin) disable the checkbox —
    // creator should not be able to mark a delegated task complete; the
    // assignee must do that. Left as a comment per spec.
    const nudgeBtn = isDelegated
      ? '<button class="cbm-nudge" data-action="nudge" title="Nudge assignee" aria-label="Nudge">&#128276;</button>'
      : '';
    return (
      '<div class="cbm-row' + (done ? ' is-done' : '') + '" data-id="' + esc(task.id) + '">' +
        '<button class="cbm-check" data-action="toggle" aria-label="Mark complete" aria-pressed="' + (done ? 'true' : 'false') + '"></button>' +
        '<span class="cbm-pri" style="background:' + priColor + '" title="' + esc(task.priority || '') + '"></span>' +
        '<span class="cbm-title" data-action="edit" title="Click to edit">' + esc(task.title || '(untitled)') + '</span>' +
        '<span class="cbm-parent">' + esc(parentLabel(task, ctx)) + '</span>' +
        dueBlock +
        assigneeBlock +
        statusBlock +
        nudgeBtn +
      '</div>'
    );
  }

  function headerHTML(ctx, sub, counts) {
    const tab = function (key, label) {
      const active = sub === key ? ' is-active' : '';
      const c = counts[key];
      return '<button class="cbm-tab' + active + '" data-sub="' + key + '">' +
        esc(label) + ' <span class="cbm-tab-count">' + c + '</span></button>';
    };
    return (
      '<div class="cbm-header">' +
        '<div class="cbm-title-row"><h2 class="cbm-title-h">Created by me</h2>' +
          '<div class="cbm-subtitle">Tasks you originated — track delegated work</div></div>' +
        '<div class="cbm-tabs" role="tablist">' +
          tab('all', 'All') + tab('mine', 'Assigned to me') + tab('delegated', 'Delegated') +
        '</div>' +
      '</div>'
    );
  }

  function emptyStateHTML(sub) {
    const msg = sub === 'delegated'
      ? "You haven't delegated any tasks yet."
      : sub === 'mine'
        ? 'No tasks assigned to you.'
        : "You haven't created any tasks yet.";
    return '<div class="cbm-empty"><div class="cbm-empty-icon">&#128221;</div><div class="cbm-empty-text">' + esc(msg) + '</div></div>';
  }

  function sectionHTML(status, rows, collapsed) {
    if (!rows.length) return '';
    return (
      '<section class="cbm-section' + (collapsed ? ' is-collapsed' : '') + '" data-status="' + esc(status) + '">' +
        '<header class="cbm-section-head" data-action="toggle-section">' +
          '<span class="cbm-section-dot" style="background:' + STATUS_COLORS[status] + '"></span>' +
          '<span class="cbm-section-name">' + esc(status) + '</span>' +
          '<span class="cbm-section-count">' + rows.length + '</span>' +
          '<span class="cbm-section-caret">&#9662;</span>' +
        '</header>' +
        '<div class="cbm-section-body">' + rows.join('') + '</div>' +
      '</section>'
    );
  }

  function renderList(area, tasks, ctx) {
    const sub = (ctx.sub || 'all');
    const base = filterCreatedByMe(tasks, ctx);
    const counts = {
      all:       base.length,
      mine:      applySubFilter(base, ctx, 'mine').length,
      delegated: applySubFilter(base, ctx, 'delegated').length
    };
    const filtered = applySubFilter(base, ctx, sub);
    let html = headerHTML(ctx, sub, counts);
    if (!filtered.length) { html += emptyStateHTML(sub); area.innerHTML = html; wire(area, ctx); return; }
    const grouped = groupByStatus(filtered);
    html += '<div class="cbm-body">';
    STATUS_BUCKETS.forEach(function (status) {
      const rows = grouped[status].map(function (t) { return TaskRow(t, ctx, { showAssignee: true, showStatus: true }); });
      html += sectionHTML(status, rows, status === 'Completed');
    });
    html += '</div>';
    area.innerHTML = html;
    wire(area, ctx);
  }

  function renderBoard(area, tasks, ctx) {
    const sub = (ctx.sub || 'all');
    const base = filterCreatedByMe(tasks, ctx);
    const counts = {
      all:       base.length,
      mine:      applySubFilter(base, ctx, 'mine').length,
      delegated: applySubFilter(base, ctx, 'delegated').length
    };
    const filtered = applySubFilter(base, ctx, sub);
    let html = headerHTML(ctx, sub, counts);
    if (!filtered.length) { html += emptyStateHTML(sub); area.innerHTML = html; wire(area, ctx); return; }
    const grouped = groupByStatus(filtered);
    html += '<div class="cbm-board">';
    STATUS_BUCKETS.forEach(function (status) {
      const rows = grouped[status].map(function (t) { return TaskRow(t, ctx, { showAssignee: true, showStatus: false }); });
      html += (
        '<div class="cbm-col" data-status="' + esc(status) + '">' +
          '<header class="cbm-col-head">' +
            '<span class="cbm-section-dot" style="background:' + STATUS_COLORS[status] + '"></span>' +
            '<span class="cbm-col-name">' + esc(status) + '</span>' +
            '<span class="cbm-col-count">' + grouped[status].length + '</span>' +
          '</header>' +
          '<div class="cbm-col-body">' + (rows.length ? rows.join('') : '<div class="cbm-col-empty">No tasks</div>') + '</div>' +
        '</div>'
      );
    });
    html += '</div>';
    area.innerHTML = html;
    wire(area, ctx);
  }

  function toast(message) {
    let host = document.querySelector('.cbm-toast-host');
    if (!host) {
      host = document.createElement('div');
      host.className = 'cbm-toast-host';
      document.body.appendChild(host);
    }
    const t = document.createElement('div');
    t.className = 'cbm-toast';
    t.textContent = message;
    host.appendChild(t);
    setTimeout(function () { t.classList.add('is-out'); }, 1800);
    setTimeout(function () { t.remove(); }, 2400);
  }

  function wire(area, ctx) {
    area.querySelectorAll('.cbm-tab').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const key = btn.getAttribute('data-sub');
        if (ctx.onSubChange) ctx.onSubChange(key);
      });
    });
    area.querySelectorAll('[data-action="toggle-section"]').forEach(function (h) {
      h.addEventListener('click', function () {
        h.parentElement.classList.toggle('is-collapsed');
      });
    });
    area.querySelectorAll('.cbm-row').forEach(function (row) {
      const id = row.getAttribute('data-id');
      const checkBtn = row.querySelector('[data-action="toggle"]');
      if (checkBtn) checkBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        if (ctx.onToggleComplete) ctx.onToggleComplete(id);
      });
      const nudgeBtn = row.querySelector('[data-action="nudge"]');
      if (nudgeBtn) nudgeBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        if (ctx.onNudge) ctx.onNudge(id);
      });
      const titleEl = row.querySelector('[data-action="edit"]');
      if (titleEl) titleEl.addEventListener('click', function (e) {
        e.stopPropagation();
        beginInlineEdit(titleEl, id, ctx);
      });
    });
  }

  function beginInlineEdit(titleEl, id, ctx) {
    const original = titleEl.textContent;
    const input = document.createElement('input');
    input.type = 'text';
    input.value = original;
    input.className = 'cbm-title-input';
    titleEl.replaceWith(input);
    input.focus();
    input.select();
    let done = false;
    const commit = function () {
      if (done) return; done = true;
      const next = input.value.trim();
      if (next && next !== original && ctx.onRename) ctx.onRename(id, next);
      else if (ctx.onRerender) ctx.onRerender();
    };
    const cancel = function () {
      if (done) return; done = true;
      if (ctx.onRerender) ctx.onRerender();
    };
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); commit(); }
      else if (e.key === 'Escape') { e.preventDefault(); cancel(); }
    });
    input.addEventListener('blur', commit);
  }

  global.ShadowCreatedByMe = {
    STATUS_BUCKETS: STATUS_BUCKETS,
    STATUS_COLORS: STATUS_COLORS,
    filterCreatedByMe: filterCreatedByMe,
    applySubFilter: applySubFilter,
    groupByStatus: groupByStatus,
    TaskRow: TaskRow,
    renderList: renderList,
    renderBoard: renderBoard,
    toast: toast
  };
})(window);
