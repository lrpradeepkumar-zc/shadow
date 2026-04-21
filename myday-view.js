/* Shadow ToDo - My Day View module
 * Exposes window.ShadowMyDay with a focused single-list dashboard.
 * Contract: module is pure UI + data-shaping; all side-effects flow through ctx.
 */
(function(global){
  'use strict';

  // --- Utilities ---------------------------------------------------------
  function esc(s){ s = (s==null?'':String(s)); return s.replace(/[&<>"']/g, function(c){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'})[c]; }); }

  function pad2(n){ return (n<10?'0':'')+n; }
  function todayStr(d){ d = d || new Date(); return d.getFullYear()+'-'+pad2(d.getMonth()+1)+'-'+pad2(d.getDate()); }
  function prettyDate(d){
    d = d || new Date();
    var days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    var months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    return days[d.getDay()] + ', ' + months[d.getMonth()] + ' ' + d.getDate();
  }

  // --- Data filter -------------------------------------------------------
  // Union of: dueDate === today OR isMyDay === true. Dedupe by id.
  function filterMyDay(tasks, today){
    if (!Array.isArray(tasks)) return [];
    today = today || todayStr();
    var seen = Object.create(null);
    var out = [];
    for (var i=0;i<tasks.length;i++){
      var t = tasks[i];
      if (!t) continue;
      var keep = (t.dueDate === today) || (t.isMyDay === true);
      if (!keep) continue;
      if (seen[t.id]) continue;
      seen[t.id] = 1;
      out.push(t);
    }
    return out;
  }

  // --- Sort: open first, then priority, then alphabetical ---------------
  var PRI_RANK = { 'High':0, 'High Priority':0, 'Medium':1, 'Normal':1, 'Low':2, 'No Priority':3 };
  function priRank(p){ var r = PRI_RANK[p]; return (r==null?2:r); }
  function isDone(t){ return t && (t.status === 'Completed' || t.status === 'Done'); }
  function sortMyDay(list){
    list.sort(function(a,b){
      var da = isDone(a)?1:0, db = isDone(b)?1:0;
      if (da!==db) return da-db;
      var pa = priRank(a.priority), pb = priRank(b.priority);
      if (pa!==pb) return pa-pb;
      return String(a.title||'').toLowerCase().localeCompare(String(b.title||'').toLowerCase());
    });
    return list;
  }

  // --- TaskRow -----------------------------------------------------------
  // Renders a single task row. ctx provides color/click/toggle handlers.
  function TaskRow(task, ctx){
    var done = isDone(task);
    var pri = task.priority || 'Normal';
    var priColor = (ctx && ctx.priColor) ? ctx.priColor(pri) : '#9aa';
    var parentLabel = '';
    if (ctx && typeof ctx.parentLabel === 'function') parentLabel = ctx.parentLabel(task) || '';
    var pinned = task.isMyDay === true;
    var pinTitle = pinned ? 'Remove from My Day' : 'Add to My Day';
    var pinIcon  = pinned ? '\u2715' : '\u2606';
    var rowCls = 'myday-row' + (done ? ' myday-row--done' : '');
    var html = '';
    html += '<div class="'+rowCls+'" data-id="'+esc(task.id)+'">';
    html += '<button class="myday-check" data-action="toggle" aria-label="'+(done?'Mark open':'Mark complete')+'" aria-pressed="'+(done?'true':'false')+'">';
    html += done ? '\u2713' : '';
    html += '</button>';
    html += '<span class="myday-pri" style="background:'+esc(priColor)+'" title="'+esc(pri)+'"></span>';
    html += '<span class="myday-title" data-action="edit" title="Click to edit">'+esc(task.title||'(Untitled)')+'</span>';
    if (parentLabel) html += '<span class="myday-parent">'+esc(parentLabel)+'</span>';
    html += '<button class="myday-remove" data-action="pin" title="'+esc(pinTitle)+'" aria-label="'+esc(pinTitle)+'">'+pinIcon+'</button>';
    html += '</div>';
    return html;
  }

  // --- renderList: main focused My Day dashboard -------------------------
  function renderList(container, tasks, ctx){
    if (!container) return;
    ctx = ctx || {};
    var today = ctx.today || todayStr();
    var subset = filterMyDay(tasks, today);
    sortMyDay(subset);
    var openList = []; var doneList = [];
    for (var i=0;i<subset.length;i++){ (isDone(subset[i]) ? doneList : openList).push(subset[i]); }

    var html = '';
    html += '<div class="myday-view">';
    html += '<div class="myday-header">';
    html += '<h1 class="myday-title-h1">My Day</h1>';
    html += '<div class="myday-date">'+esc(prettyDate(new Date()))+'</div>';
    html += '</div>';

    html += '<form class="myday-quickadd" data-action="quickadd" autocomplete="off">';
    html += '<span class="myday-quickadd__icon">+</span>';
    html += '<input type="text" class="myday-quickadd__input" placeholder="Add a task for today..." maxlength="300" />';
    html += '</form>';

    if (openList.length === 0 && doneList.length === 0){
      html += '<div class="myday-empty">';
      html += '<div class="myday-empty__icon" aria-hidden="true">\u2600</div>';
      html += '<div class="myday-empty__text">What are you focusing on today?</div>';
      html += '</div>';
    } else {
      html += '<div class="myday-list" role="list">';
      if (openList.length === 0){
        html += '<div class="myday-empty myday-empty--inline"><em>All done. Nice work.</em></div>';
      } else {
        for (var j=0;j<openList.length;j++){ html += TaskRow(openList[j], ctx); }
      }
      html += '</div>';
    }

    if (doneList.length > 0){
      html += '<details class="myday-completed" open>';
      html += '<summary class="myday-completed__summary">Completed Today <span class="myday-completed__count">'+doneList.length+'</span></summary>';
      html += '<div class="myday-list myday-list--done">';
      for (var k=0;k<doneList.length;k++){ html += TaskRow(doneList[k], ctx); }
      html += '</div>';
      html += '</details>';
    }
    html += '</div>';

    container.innerHTML = html;
    wireEvents(container, ctx);
  }

  // --- Event wiring ------------------------------------------------------
  function wireEvents(container, ctx){
    var form = container.querySelector('form.myday-quickadd');
    if (form){
      form.addEventListener('submit', function(ev){
        ev.preventDefault();
        var input = form.querySelector('input.myday-quickadd__input');
        var val = input && input.value ? input.value.trim() : '';
        if (!val) return;
        if (typeof ctx.onQuickAdd === 'function') ctx.onQuickAdd(val);
        input.value = '';
      });
    }

    container.addEventListener('click', function(ev){
      var target = ev.target;
      if (!target) return;
      var action = target.getAttribute && target.getAttribute('data-action');
      var row = target.closest && target.closest('.myday-row');
      if (!row) return;
      var id = row.getAttribute('data-id');
      if (!id) return;
      if (action === 'toggle'){
        ev.stopPropagation();
        if (typeof ctx.onToggleComplete === 'function') ctx.onToggleComplete(id);
        return;
      }
      if (action === 'pin'){
        ev.stopPropagation();
        if (typeof ctx.onTogglePin === 'function') ctx.onTogglePin(id);
        return;
      }
      if (action === 'edit'){
        ev.stopPropagation();
        beginInlineEdit(target, id, ctx);
        return;
      }
      if (typeof ctx.onTaskClick === 'function') ctx.onTaskClick(id);
    });
  }

  function beginInlineEdit(titleEl, id, ctx){
    if (!titleEl || titleEl.dataset.editing === '1') return;
    titleEl.dataset.editing = '1';
    var original = titleEl.textContent;
    var input = document.createElement('input');
    input.type = 'text';
    input.className = 'myday-title-edit';
    input.value = original;
    input.maxLength = 300;
    titleEl.replaceWith(input);
    input.focus();
    input.select();
    var finished = false;
    function commit(save){
      if (finished) return; finished = true;
      var newVal = input.value.trim();
      if (save && newVal && newVal !== original && typeof ctx.onRenameTitle === 'function'){
        ctx.onRenameTitle(id, newVal);
      } else {
        var span = document.createElement('span');
        span.className = 'myday-title';
        span.setAttribute('data-action','edit');
        span.title = 'Click to edit';
        span.textContent = original;
        input.replaceWith(span);
      }
    }
    input.addEventListener('keydown', function(e){
      if (e.key === 'Enter'){ e.preventDefault(); commit(true); }
      else if (e.key === 'Escape'){ e.preventDefault(); commit(false); }
    });
    input.addEventListener('blur', function(){ commit(true); });
  }

  // --- renderBoard: focused single column for My Day --------------------
  function renderBoard(container, tasks, ctx){
    if (!container) return;
    container.innerHTML = '<div class="myday-board"><div class="myday-board__col"></div></div>';
    var col = container.querySelector('.myday-board__col');
    renderList(col, tasks, ctx);
  }

  // --- Public API --------------------------------------------------------
  global.ShadowMyDay = {
    filterMyDay: filterMyDay,
    sortMyDay: sortMyDay,
    TaskRow: TaskRow,
    renderList: renderList,
    renderBoard: renderBoard,
    todayStr: todayStr,
    prettyDate: prettyDate
  };
})(window);
