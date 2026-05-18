/**
 * notification-bell.js
 * Wires the header notification bell with real task-lifecycle notifications.
 * Works with the existing NotificationsModule in app.js (pushNotification / state.notifications).
 *
 * Features:
 *  - Persists notifications to localStorage (survives page refresh)
 *  - Intercepts ShadowDB.Tasks.create  -> "Task Created" notification
 *  - Intercepts ShadowDB.Tasks.update  -> detects status/priority/dueDate/assignee changes
 *  - Hooks comment submit button       -> "Comment Added" notification
 *  - Seeds overdue / due-soon alerts from existing tasks on boot
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
      status:       task.status,
      priority:     task.priority,
      dueDate:      task.dueDate,
      assigneeId:   task.assigneeId || task.assignee || ''
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
        /* snapshot existing loaded tasks */
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

  /* seed overdue / due-soon alerts (only once per session via storage check) */
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

  /* sync read flags back to storage after mark-all-read / clear-all */
  function hookMarkClear() {
    document.addEventListener('click', function(e) {
      if (e.target && e.target.id === 'notifMarkAllRead') {
        setTimeout(function() {
          var stored = loadFromStorage();
          stored.forEach(function(n) { n.read = true; });
          saveToStorage(stored);
        }, 50);
      }
      if (e.target && e.target.id === 'notifClearAll') {
        setTimeout(function() { saveToStorage([]); }, 50);
      }
    });
  }

  /* expose globally */
  window.pushBellNotification = push;

  /* boot */
  function boot() {
    restoreFromStorage();
    patchCreate();
    patchUpdate();
    hookCommentBtn();
    hookMarkClear();
    waitForTasksAndSeed();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
