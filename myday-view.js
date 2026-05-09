/* ============================================================
 * Shadow ToDo - My Day View  (MS ToDo inspired)
 * Exposes window.ShadowMyDay
 * Features:
 *   - Date header with day/date
 *   - Quick-add task form (sets isMyDay=true, dueDate=today)
 *   - Task list (tasks with isMyDay===true or dueDate===today)
 *   - Completed tasks section (collapsible)
 *   - Suggestions panel (other tasks not in My Day)
 *   - Add to My Day / Remove from My Day toggle
 *   - Inline task completion toggle
 *   - Task click → opens detail panel
 * ============================================================ */

(function (global) {
  'use strict';

  /* ── helpers ─────────────────────────────────────── */
  function esc(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function pad2(n) { return String(n).padStart(2, '0'); }

  function todayStr() {
    var d = new Date();
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  function prettyDate(d) {
    var days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    var months = ['January','February','March','April','May','June',
                  'July','August','September','October','November','December'];
    return days[d.getDay()] + ', ' + months[d.getMonth()] + ' ' + d.getDate();
  }

  function getGreeting() {
    var h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  }

  function getPriorityIcon(p) {
    if (!p || p === 'None') return '';
    var map = { High: '!!! ', Medium: '!! ', Low: '! ' };
    return map[p] || '';
  }

  function getPriorityClass(p) {
    if (!p || p === 'None') return '';
    return 'priority-' + p.toLowerCase();
  }

  /* ── filtering & sorting ─────────────────────────── */
  function isInMyDay(task, today) {
    return task.isMyDay === true || task.dueDate === today;
  }

  function isDone(task) {
    return task.status === 'Closed' || task.status === 'Fixed' || task.completed === true;
  }

  function filterMyDay(tasks, today) {
    today = today || todayStr();
    return tasks.filter(function (t) { return isInMyDay(t, today); });
  }

  function filterSuggestions(tasks, today) {
    today = today || todayStr();
    // Tasks NOT in My Day, not completed, not due today
    return tasks.filter(function (t) {
      return !isInMyDay(t, today) && !isDone(t);
    }).slice(0, 10); // Show up to 10 suggestions
  }

  function sortMyDay(list) {
    var rank = { Open: 0, 'In Progress': 1, Fixed: 2, Closed: 3 };
    var pri = { High: 0, Medium: 1, Low: 2, None: 3 };
    list.sort(function (a, b) {
      var sa = rank[a.status] || 0, sb = rank[b.status] || 0;
      if (sa !== sb) return sa - sb;
      var pa = pri[a.priority] || 3, pb = pri[b.priority] || 3;
      if (pa !== pb) return pa - pb;
      return (a.title || '').localeCompare(b.title || '');
    });
  }

  /* ── task row HTML ───────────────────────────────── */
  function TaskRow(task, opts) {
    opts = opts || {};
    var done = isDone(task);
    var priClass = getPriorityClass(task.priority);
    var priIcon = getPriorityIcon(task.priority);
    var dueStr = task.dueDate || '';
    var today = todayStr();
    var isOverdue = dueStr && dueStr < today && !done;
    var dueTxt = '';
    if (dueStr) {
      if (dueStr === today) dueTxt = 'Today';
      else if (isOverdue) dueTxt = 'Overdue: ' + dueStr;
      else dueTxt = dueStr;
    }

    var rowClass = 'myday-row' +
      (done ? ' myday-row--done' : '') +
      (priClass ? ' ' + priClass : '') +
      (isOverdue ? ' myday-row--overdue' : '');

    var addBtn = opts.isSuggestion
      ? '<button class="myday-add-btn" data-action="add-to-myday" data-id="' + esc(task.id) + '" title="Add to My Day"><i class="fa fa-sun-o"></i> Add to My Day</button>'
      : '<button class="myday-remove-btn" data-action="remove-from-myday" data-id="' + esc(task.id) + '" title="Remove from My Day"><i class="fa fa-times"></i></button>';

    return '<div class="' + rowClass + '" data-id="' + esc(task.id) + '">' +
      '<button class="myday-row__check" data-action="toggle" data-id="' + esc(task.id) + '" title="' + (done ? 'Reopen' : 'Complete') + '">' +
        '<i class="fa ' + (done ? 'fa-check-circle' : 'fa-circle-o') + '"></i>' +
      '</button>' +
      '<div class="myday-row__body" data-action="open" data-id="' + esc(task.id) + '">' +
        '<span class="myday-row__title">' + (priIcon ? '<span class="myday-row__pri">' + priIcon + '</span>' : '') + esc(task.title) + '</span>' +
        (task.groupName ? '<span class="myday-row__list">' + esc(task.groupName) + '</span>' : '') +
        (dueTxt ? '<span class="myday-row__due' + (isOverdue ? ' overdue' : '') + '"><i class="fa fa-calendar-o"></i> ' + esc(dueTxt) + '</span>' : '') +
        (task.note ? '<span class="myday-row__note"><i class="fa fa-sticky-note-o"></i></span>' : '') +
      '</div>' +
      addBtn +
    '</div>';
  }

  /* ── suggestion row HTML ─────────────────────────── */
  function SuggestionRow(task) {
    return TaskRow(task, { isSuggestion: true });
  }

  /* ── main list renderer ──────────────────────────── */
  function renderList(container, tasks, ctx) {
    if (!container) return;
    ctx = ctx || {};
    var today = ctx.today || todayStr();
    var subset = filterMyDay(tasks, today);
    sortMyDay(subset);

    var openList = [], doneList = [];
    for (var i = 0; i < subset.length; i++) {
      (isDone(subset[i]) ? doneList : openList).push(subset[i]);
    }

    var suggestions = filterSuggestions(tasks, today);

    var html = '';
    html += '<div class="myday-view">';

    // ── Header ──
    html += '<div class="myday-header">';
    html += '<div class="myday-header__left">';
    html += '<h1 class="myday-title-h1">My Day</h1>';
    html += '<div class="myday-date">' + esc(prettyDate(new Date())) + '</div>';
    html += '</div>';
    html += '</div>';

    // ── Quick-add form ──
    html += '<form class="myday-quickadd" data-action="quickadd" autocomplete="off">';
    html += '<span class="myday-quickadd__icon"><i class="fa fa-plus"></i></span>';
    html += '<input type="text" class="myday-quickadd__input" placeholder="Add a task for today..." maxlength="500" />';
    html += '</form>';

    // ── Open tasks ──
    if (openList.length === 0 && doneList.length === 0) {
      html += '<div class="myday-empty">';
      html += '<i class="fa fa-sun-o myday-empty__icon"></i>';
      html += '<p class="myday-empty__text">Focus on today. Add tasks to get started.</p>';
      html += '</div>';
    } else {
      html += '<div class="myday-list" id="myday-open-list">';
      for (var j = 0; j < openList.length; j++) {
        html += TaskRow(openList[j]);
      }
      html += '</div>';
    }

    // ── Completed tasks ──
    if (doneList.length > 0) {
      html += '<details class="myday-done-section">';
      html += '<summary class="myday-done-summary"><i class="fa fa-check"></i> Completed (' + doneList.length + ')</summary>';
      html += '<div class="myday-list myday-list--done">';
      for (var k = 0; k < doneList.length; k++) {
        html += TaskRow(doneList[k]);
      }
      html += '</div>';
      html += '</details>';
    }

    // ── Suggestions panel ──
    if (suggestions.length > 0) {
      html += '<div class="myday-suggestions">';
      html += '<div class="myday-suggestions__header">';
      html += '<i class="fa fa-lightbulb-o"></i> Suggestions';
      html += '<button class="myday-suggestions__close" data-action="close-suggestions" title="Close suggestions">&#10005;</button>';
      html += '</div>';
      html += '<div class="myday-suggestions__list">';
      for (var m = 0; m < suggestions.length; m++) {
        html += SuggestionRow(suggestions[m]);
      }
      html += '</div>';
      html += '</div>';
    }

    html += '</div>'; // .myday-view

    container.innerHTML = html;
    wireEvents(container, ctx);
  }

  /* ── event wiring ───────────────────────────────── */
  function wireEvents(container, ctx) {
    ctx = ctx || {};

    // Quick-add form
    var form = container.querySelector('form.myday-quickadd');
    if (form) {
      form.addEventListener('submit', function (ev) {
        ev.preventDefault();
        var input = form.querySelector('input.myday-quickadd__input');
        var title = (input ? input.value : '').trim();
        if (!title) return;
        var today = todayStr();
        var newTask = {
          title: title,
          dueDate: today,
          isMyDay: true,
          status: 'Open',
          priority: 'None',
          createdAt: new Date().toISOString()
        };
        if (window.ShadowDB && window.ShadowDB.Tasks) {
          ShadowDB.Tasks.create(newTask).then(function () {
            if (input) input.value = '';
            // Re-render
            ShadowDB.Tasks.getAll().then(function (allTasks) {
              renderList(container, allTasks, ctx);
            });
          }).catch(function (e) {
            console.error('Failed to create task:', e);
          });
        } else {
          // Fallback: trigger app refresh
          if (input) input.value = '';
          if (typeof window.renderView === 'function') window.renderView();
        }
      });
    }

    // Delegation for task actions
    container.addEventListener('click', function (ev) {
      var target = ev.target;
      // Walk up to find action element
      while (target && target !== container) {
        var action = target.getAttribute && target.getAttribute('data-action');
        if (action && action !== 'open') {
          ev.preventDefault();
          handleAction(action, target, container, ctx);
          return;
        }
        if (action === 'open') {
          handleAction(action, target, container, ctx);
          return;
        }
        target = target.parentNode;
      }
    });

    // Close suggestions
    var closeSugBtn = container.querySelector('[data-action="close-suggestions"]');
    if (closeSugBtn) {
      closeSugBtn.addEventListener('click', function () {
        var sug = container.querySelector('.myday-suggestions');
        if (sug) sug.style.display = 'none';
      });
    }
  }

  function handleAction(action, el, container, ctx) {
    var id = el.getAttribute('data-id');
    if (!id) return;

    if (action === 'toggle') {
      // Toggle task completion (fetch first to preserve all fields)
      if (window.ShadowDB && window.ShadowDB.Tasks) {
        ShadowDB.Tasks.getById(id).then(function (task) {
          if (!task) return;
          var newStatus = isDone(task) ? 'Open' : 'Closed';
          var merged = Object.assign({}, task, { status: newStatus });
          ShadowDB.Tasks.update(merged).then(function () {
            ShadowDB.Tasks.getAll().then(function (allTasks) {
              renderList(container, allTasks, ctx);
            });
          });
        });
      }
      return;
    }

    if (action === 'add-to-myday') {
      // Add task to My Day (fetch first to preserve all fields)
      if (window.ShadowDB && window.ShadowDB.Tasks) {
        ShadowDB.Tasks.getById(id).then(function (task) {
          if (!task) return;
          var merged = Object.assign({}, task, { isMyDay: true });
          ShadowDB.Tasks.update(merged).then(function () {
            ShadowDB.Tasks.getAll().then(function (allTasks) {
              renderList(container, allTasks, ctx);
            });
          });
        });
      }
      return;
    }

    if (action === 'remove-from-myday') {
      // Remove task from My Day (fetch first to preserve all fields)
      if (window.ShadowDB && window.ShadowDB.Tasks) {
        ShadowDB.Tasks.getById(id).then(function (task) {
          if (!task) return;
          var merged = Object.assign({}, task, { isMyDay: false });
          ShadowDB.Tasks.update(merged).then(function () {
            ShadowDB.Tasks.getAll().then(function (allTasks) {
              renderList(container, allTasks, ctx);
            });
          });
        });
      }
      return;
    }

    if (action === 'open') {
      // Open task detail panel
      if (typeof window.openTaskDetail === 'function') {
        window.openTaskDetail(id);
      } else if (typeof window.ShadowViewKit !== 'undefined' && typeof ShadowViewKit.openDetail === 'function') {
        ShadowViewKit.openDetail(id);
      }
      return;
    }
  }

  /* ── board renderer (called by app.js renderBoardView) ── */
  function renderBoard(container, tasks, ctx) {
    if (!container) return;
    // If tasks not provided, fetch from DB
    if (!tasks || !tasks.length) {
      if (window.ShadowDB && window.ShadowDB.Tasks) {
        ShadowDB.Tasks.getAll().then(function (allTasks) {
          _doRenderBoard(container, allTasks, ctx);
        });
      } else {
        _doRenderBoard(container, [], ctx);
      }
    } else {
      _doRenderBoard(container, tasks, ctx);
    }
  }

  function _doRenderBoard(container, tasks, ctx) {
    container.innerHTML = '<div class="myday-board"><div class="myday-board__col"></div></div>';
    var col = container.querySelector('.myday-board__col');
    renderList(col, tasks, ctx);
  }

  /* ── list view renderer (called by app.js renderListView) ── */
  function renderListView(container, tasks, ctx) {
    if (!container) return;
    if (!tasks || !tasks.length) {
      if (window.ShadowDB && window.ShadowDB.Tasks) {
        ShadowDB.Tasks.getAll().then(function (allTasks) {
          renderList(container, allTasks, ctx);
        });
      } else {
        renderList(container, [], ctx);
      }
    } else {
      renderList(container, tasks, ctx);
    }
  }

  /* ── Public API ─────────────────────────────────── */
  global.ShadowMyDay = {
    filterMyDay: filterMyDay,
    sortMyDay: sortMyDay,
    TaskRow: TaskRow,
    renderList: renderList,
    renderBoard: renderBoard,
    renderListView: renderListView,
    todayStr: todayStr,
    prettyDate: prettyDate
  };

}(window));
