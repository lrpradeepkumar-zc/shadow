/**
 * notification-bell.js
 * Wires the header notification bell (#notifBellBtn) with real task-lifecycle notifications.
 * Works with the existing NotificationsModule in app.js (state.notifications + notifications:updated event).
 *
 * Features:
 *  - Persists notifications to localStorage (survives page refresh)
 *  - Intercepts ShadowDB.Tasks.create  -> "Task Created" notification
 *  - Intercepts ShadowDB.Tasks.update  -> detects status/priority/dueDate/assignee changes
 *  - Hooks comment submit button       -> "Comment Added" notification
 *  - Seeds overdue / due-soon alerts from existing tasks on boot
 *  - Re-wires the bell click handler (fallback in case NotificationsModule init races)
 */
(function NotificationBell() {
  'use strict';

  var STORAGE_KEY = 'shadow_bell_notifications';
  var MAX_NOTIFS  = 80;

  function actor() {
    return (window.state && (state.currentUserName || (state.currentUser && state.currentUser.name))) || 'You';
  }

  function loadFromStorage() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) { return []; }
  }

  function saveToStorage(items) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_NOTIFS))); } catch(e) {}
  }

  /* push a notification into state + storage + fire event */
  function push(type, taskId, taskTitle, message) {
    var items = loadFromStorage();
    var entry = {
      id:      'nb_' + Date.now() + '_' + Math.random().toString(36).slice(2,6),
      type:    type,
      taskId:  taskId || '',
      actor:   actor(),
      message: message,
      time:    new Date().toISOString(),
      read:    false
    };
    items.unshift(entry);
    if (items.length > MAX_NOTIFS) items = items.slice(0, MAX_NOTIFS);
    saveToStorage(items);

    if (window.state) {
      state.notifications = state.notifications || [];
      state.notifications.unshift(entry);
      if (state.notifications.length > MAX_NOTIFS) state.notifications = state.notifications.slice(0, MAX_NOTIFS);
    }
    document.dispatchEvent(new CustomEvent('notifications:updated'));
  }

  /* restore persisted notifications into state on page load */
  function restoreFromStorage() {
    var tries = 0;
    var iv = setInterval(function() {
      if (window.state) {
        clearInterval(iv);
        var items = loadFromStorage();
        state.notifications = items;
        document.dispatchEvent(new CustomEvent('notifications:updated'));
      } else if (++tries > 50) { clearInterval(iv); }
    }, 100);
  }

  /* ── Wire the bell button click (re-wire fallback) ────────────────────── */
  function wireBellClick() {
    var tries = 0;
    var iv = setInterval(function() {
      var btn   = document.getElementById('notifBellBtn');
      var panel = document.getElementById('notifPanel');
      if (btn && panel) {
        clearInterval(iv);

        function togglePanel(force) {
          var willOpen = typeof force === 'boolean' ? force : panel.hidden;
          panel.hidden = !willOpen;
          btn.setAttribute('aria-expanded', String(willOpen));
          if (willOpen) {
            renderPanel();
            updateBadge();
          }
        }

        function updateBadge() {
          var badge = document.getElementById('notifBadge');
          if (!badge) return;
          var items = loadFromStorage();
          var unread = items.filter(function(n){ return !n.read; }).length;
          badge.textContent = unread;
          badge.hidden = unread === 0;
        }

        function timeAgo(iso) {
          var diff = Math.max(0, Date.now() - new Date(iso).getTime());
          var m = Math.floor(diff / 60000);
          if (m < 1) return 'just now';
          if (m < 60) return m + 'm ago';
          var h = Math.floor(m / 60);
          if (h < 24) return h + 'h ago';
          return Math.floor(h / 24) + 'd ago';
        }

        function iconFor(type) {
          var map = {
            'invite': 'fa-user-plus',
            'comment': 'fa-comment',
            'status': 'fa-circle-check',
            'task_created': 'fa-plus-circle',
            'priority': 'fa-flag',
            'due_date': 'fa-calendar',
            'assignee': 'fa-user',
            'overdue': 'fa-clock',
            'due_soon': 'fa-bell'
          };
          return map[type] || 'fa-bell';
        }

        function esc(s) {
          return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
        }

        function renderPanel() {
          var listEl = document.getElementById('notifList');
          var emptyEl = document.getElementById('notifEmpty');
          if (!listEl || !emptyEl) return;
          var items = loadFromStorage();
          if (!items.length) {
            listEl.innerHTML = '';
            emptyEl.style.display = 'block';
            return;
          }
          emptyEl.style.display = 'none';
          listEl.innerHTML = items.map(function(n) {
            return '<li class="notif-item ' + (n.read ? '' : 'unread') + '" ' +
                   'data-id="' + esc(n.id) + '" data-task="' + esc(n.taskId) + '" data-type="' + esc(n.type) + '" role="menuitem">' +
                   '<div class="n-icon"><i class="fa-solid ' + iconFor(n.type) + '"></i></div>' +
                   '<div><div class="n-body">' + esc(n.message) + '</div>' +
                   '<div class="n-time">' + timeAgo(n.time) + '</div></div></li>';
          }).join('');
        }

        // Attach click to bell
        btn.addEventListener('click', function(e) {
          e.stopPropagation();
          togglePanel();
        });

        // Close on outside click
        document.addEventListener('click', function(e) {
          if (!panel.hidden && !(e.target.closest && e.target.closest('.notif-wrap'))) {
            togglePanel(false);
          }
        });

        // Close on Escape
        document.addEventListener('keydown', function(e) {
          if (e.key === 'Escape') togglePanel(false);
        });

        // Mark all read
        var markAll = document.getElementById('notifMarkAllRead');
        if (markAll) markAll.addEventListener('click', function(e) {
          e.stopPropagation();
          var stored = loadFromStorage();
          stored.forEach(function(n){ n.read = true; });
          saveToStorage(stored);
          if (window.state) state.notifications = stored;
          updateBadge();
          renderPanel();
        });

        // Clear all
        var clearAll = document.getElementById('notifClearAll');
        if (clearAll) clearAll.addEventListener('click', function(e) {
          e.stopPropagation();
          saveToStorage([]);
          if (window.state) state.notifications = [];
          updateBadge();
          renderPanel();
        });

        // Item click -> open task
        var listEl2 = document.getElementById('notifList');
        if (listEl2) listEl2.addEventListener('click', function(e) {
          var li = e.target.closest && e.target.closest('.notif-item');
          if (!li) return;
          var id = li.dataset.id;
          var taskId = li.dataset.task;
          var stored = loadFromStorage();
          var item = stored.find(function(n){ return n.id === id; });
          if (item) { item.read = true; saveToStorage(stored); if (window.state) state.notifications = stored; }
          updateBadge();
          renderPanel();
          if (taskId) {
            var opener = (typeof window.openTaskDetail === 'function' && window.openTaskDetail) ||
                         (typeof window.showTaskDetail === 'function' && window.showTaskDetail);
            if (opener) { togglePanel(false); opener(taskId, 'notification'); }
          }
        });

        // React to notifications:updated
        document.addEventListener('notifications:updated', function() {
          updateBadge();
          if (!panel.hidden) renderPanel();
        });

        // Initial badge render
        updateBadge();

      } else if (++tries > 80) { clearInterval(iv); }
    }, 150);
  }

  /* patch ShadowDB.Tasks.create */
  function patchCreate() {
    var tries = 0;
    var iv = setInterval(function() {
      if (window.ShadowDB && ShadowDB.Tasks && ShadowDB.Tasks.create) {
        clearInterval(iv);
        var orig = ShadowDB.Tasks.create.bind(ShadowDB.Tasks);
        ShadowDB.Tasks.create = function(task) {
          return orig(task).then(function(created) {
            var t = created || task;
            var title = t.title || 'Untitled';
            var grp   = t.groupName || '';
            var msg   = actor() + ' created task "' + title + '"' + (grp ? ' in ' + grp : '');
            push('task_created', t.id || t._id, title, msg);
            return created;
          });
        };
      } else if (++tries > 100) { clearInterval(iv); }
    }, 150);
  }

  /* track task snapshots for diff */
  var _snap = {};
  function snapshotTask(task) {
    if (!task || !task.id) return;
    _snap[task.id] = {
      status:     task.status,
      priority:   task.priority,
      dueDate:    task.dueDate,
      assigneeId: task.assigneeId || task.assignee || ''
    };
  }

  function diffAndPush(prev, task) {
    if (!prev) return;
    var title = task.title || 'Untitled';
    var id    = task.id;
    if (prev.status !== task.status && task.status)
      push('status', id, title, actor() + ' changed "' + title + '" status to ' + task.status);
    if (prev.priority !== task.priority && task.priority)
      push('priority', id, title, actor() + ' changed "' + title + '" priority to ' + task.priority);
    if (prev.dueDate !== task.dueDate && task.dueDate)
      push('due_date', id, title, actor() + ' set due date of "' + title + '" to ' + task.dueDate);
    var newA = task.assigneeId || task.assignee || '';
    if (newA && prev.assigneeId !== newA)
      push('assignee', id, title, actor() + ' assigned "' + title + '" to ' + (task.assigneeName || newA));
  }

  /* patch ShadowDB.Tasks.update */
  function patchUpdate() {
    var tries = 0;
    var iv = setInterval(function() {
      if (window.ShadowDB && ShadowDB.Tasks && ShadowDB.Tasks.update) {
        clearInterval(iv);
        var orig = ShadowDB.Tasks.update.bind(ShadowDB.Tasks);
        ShadowDB.Tasks.update = function(task) {
          var prev = _snap[task.id];
          return orig(task).then(function(result) {
            diffAndPush(prev, task);
            snapshotTask(task);
            return result;
          });
        };
        if (window.state && state.tasks) state.tasks.forEach(snapshotTask);
        document.addEventListener('tasks:loaded', function() {
          if (state.tasks) state.tasks.forEach(snapshotTask);
        });
      } else if (++tries > 100) { clearInterval(iv); }
    }, 150);
  }

  /* hook comment submit */
  function hookCommentBtn() {
    document.addEventListener('click', function(e) {
      var btn = e.target.closest && (
        e.target.closest('#tdpCommentSend') ||
        e.target.closest('.comment-send-btn') ||
        e.target.closest('[data-action="send-comment"]')
      );
      if (!btn) return;
      var input     = document.querySelector('#tdpCommentInput, .comment-input, [data-comment-input]');
      var text      = input ? (input.value || input.textContent || '').trim() : '';
      if (!text) return;
      var taskId    = window.state && (state.selectedTaskId || state.currentTaskId);
      var task      = window.state && state.tasks && state.tasks.find(function(t){ return t.id === taskId; });
      var taskTitle = task ? (task.title || 'task') : 'task';
      var snippet   = text.length > 60 ? text.substring(0,57) + '...' : text;
      push('comment', taskId, taskTitle, actor() + ' commented on "' + taskTitle + '": ' + snippet);
    });
  }

  /* seed overdue / due-soon alerts */
  function seedAlerts() {
    if (!window.state || !state.tasks || !state.tasks.length) return;
    var stored = loadFromStorage();
    var alreadySeeded = stored.some(function(n) { return n.type === 'overdue' || n.type === 'due_soon'; });
    var now = Date.now();
    state.tasks.forEach(function(task) {
      if (!task || task.archived || task.status === 'Completed') { snapshotTask(task); return; }
      if (!alreadySeeded && task.dueDate) {
        var due  = new Date(task.dueDate).getTime();
        var diff = due - now;
        if (diff < 0)
          push('overdue', task.id, task.title, '"' + (task.title||'Task') + '" is overdue');
        else if (diff < 2 * 86400000)
          push('due_soon', task.id, task.title, '"' + (task.title||'Task') + '" is due soon');
      }
      snapshotTask(task);
    });
  }

  function waitForTasksAndSeed() {
    var tries = 0;
    var iv = setInterval(function() {
      if (window.state && state.tasks && state.tasks.length > 0) {
        clearInterval(iv); seedAlerts();
      } else if (++tries > 80) { clearInterval(iv); }
    }, 300);
  }

  /* expose globally */
  window.pushBellNotification = push;

  /* boot */
  function boot() {
    restoreFromStorage();
    wireBellClick();
    patchCreate();
    patchUpdate();
    hookCommentBtn();
    waitForTasksAndSeed();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
