/**
 * notification-bell.js  v3
 * Self-contained notification bell - patches task lifecycle events and wires the UI.
 * Uses btn.onclick (not addEventListener) to avoid duplicate handler accumulation.
 */
(function NotificationBell() {
  'use strict';

  /* guard: run only once per page load */
  if (window._nbInitDone) return;
  window._nbInitDone = true;

  var STORAGE_KEY = 'shadow_bell_notifications';
  var MAX_NOTIFS  = 80;

  function actor() {
    return (window.state && (state.currentUserName || (state.currentUser && state.currentUser.name))) || 'You';
  }

  function loadFromStorage() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch(e) { return []; }
  }

  function saveToStorage(items) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_NOTIFS))); } catch(e) {}
  }

  /* push a notification */
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
    updateBadge();
    document.dispatchEvent(new CustomEvent('notifications:updated'));
  }

  /* restore persisted notifications into state */
  function restoreFromStorage() {
    var tries = 0;
    var iv = setInterval(function() {
      if (window.state) {
        clearInterval(iv);
        var items = loadFromStorage();
        state.notifications = items;
        updateBadge();
      } else if (++tries > 50) { clearInterval(iv); }
    }, 100);
  }

  /* badge */
  function updateBadge() {
    var badge = document.getElementById('notifBadge');
    if (!badge) return;
    var items = loadFromStorage();
    var unread = items.filter(function(n){ return !n.read; }).length;
    badge.textContent = unread;
    badge.hidden = unread === 0;
  }

  /* render panel list */
  function renderPanel() {
    var listEl  = document.getElementById('notifList');
    var emptyEl = document.getElementById('notifEmpty');
    if (!listEl || !emptyEl) return;
    var items = loadFromStorage();
    if (!items.length) {
      listEl.innerHTML = '';
      emptyEl.style.display = 'block';
      return;
    }
    emptyEl.style.display = 'none';
    function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
    function iconFor(t) {
      return {invite:'fa-user-plus',comment:'fa-comment',status:'fa-circle-check',task_created:'fa-plus-circle',
              priority:'fa-flag',due_date:'fa-calendar',assignee:'fa-user',overdue:'fa-clock',due_soon:'fa-bell',approval_requested:'fa-paper-plane',approved:'fa-circle-check',rejected:'fa-xmark',changes_requested:'fa-pen-to-square'}[t] || 'fa-bell';
    }
    function timeAgo(iso) {
      var m = Math.floor(Math.max(0,Date.now()-new Date(iso).getTime())/60000);
      if (m<1) return 'just now'; if (m<60) return m+'m ago';
      var h=Math.floor(m/60); if (h<24) return h+'h ago'; return Math.floor(h/24)+'d ago';
    }
    listEl.innerHTML = items.map(function(n) {
      return '<li class="notif-item'+(n.read?'':' unread')+'" data-id="'+esc(n.id)+'" data-task="'+esc(n.taskId)+'" data-type="'+esc(n.type)+'" role="menuitem">'+
             '<div class="n-icon"><i class="fa-solid '+iconFor(n.type)+'"></i></div>'+
             '<div><div class="n-body">'+esc(n.message)+'</div>'+
             '<div class="n-time">'+timeAgo(n.time)+'</div></div></li>';
    }).join('');
  }

  /* wire the bell UI - use onclick to prevent duplicate registration */
  function wireBellClick() {
    var tries = 0;
    var iv = setInterval(function() {
      var btn   = document.getElementById('notifBellBtn');
      var panel = document.getElementById('notifPanel');
      if (!btn || !panel) { if (++tries > 80) clearInterval(iv); return; }
      clearInterval(iv);

      /* ensure panel starts hidden */
      panel.hidden = true;

      function openPanel() {
        renderPanel();
        panel.hidden = false;
        btn.setAttribute('aria-expanded', 'true');
      }
      function closePanel() {
        panel.hidden = true;
        btn.setAttribute('aria-expanded', 'false');
      }
      function togglePanel() {
        if (panel.hidden) openPanel(); else closePanel();
      }

      /* use onclick - replaces any previous handler, prevents duplicates */
      /* use capture-phase addEventListener to fire before app.js bell handler */
      btn.addEventListener('click', function(e) { e.stopPropagation(); togglePanel(); }, true);

      /* close on outside click */
      document.addEventListener('click', function(e) {
        if (!panel.hidden && !(e.target.closest && e.target.closest('.notif-wrap'))) closePanel();
      });
      document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && !panel.hidden) closePanel();
      });

      /* mark all read */
      var markAll = document.getElementById('notifMarkAllRead');
      if (markAll) markAll.onclick = function(e) {
        e.stopPropagation();
        var stored = loadFromStorage(); stored.forEach(function(n){n.read=true;}); saveToStorage(stored);
        if (window.state) state.notifications = stored;
        updateBadge(); renderPanel();
      };

      /* clear all */
      var clearAllBtn = document.getElementById('notifClearAll');
      if (clearAllBtn) clearAllBtn.onclick = function(e) {
        e.stopPropagation(); saveToStorage([]);
        if (window.state) state.notifications = [];
        updateBadge(); renderPanel();
      };

      /* item click -> open task */
      var listEl = document.getElementById('notifList');
      if (listEl) listEl.onclick = function(e) {
        var li = e.target.closest && e.target.closest('.notif-item');
        if (!li) return;
        var stored = loadFromStorage();
        var item   = stored.find(function(n){ return n.id===li.dataset.id; });
        if (item) { item.read=true; saveToStorage(stored); if (window.state) state.notifications=stored; }
        updateBadge(); renderPanel();
        var taskId = li.dataset.task;
        if (taskId) {
          var opener = window.openTaskDetail || window.showTaskDetail;
          if (opener) { closePanel(); opener(taskId,'notification'); }
        }
      };

      /* react to push() calls */
      document.addEventListener('notifications:updated', function() {
        updateBadge();
        if (!panel.hidden) renderPanel();
      });

      updateBadge();

    }, 150);
  }

  /* patch ShadowDB.Tasks.create */
  function patchCreate() {
    var tries=0, iv=setInterval(function(){
      if (window.ShadowDB && ShadowDB.Tasks && ShadowDB.Tasks.create) {
        clearInterval(iv);
        var orig = ShadowDB.Tasks.create.bind(ShadowDB.Tasks);
        ShadowDB.Tasks.create = function(task) {
          return orig(task).then(function(created) {
            var t=created||task, title=t.title||'Untitled', grp=t.groupName||'';
            push('task_created',t.id||t._id,title,actor()+' created "'+title+'"'+(grp?' in '+grp:''));
            return created;
          });
        };
      } else if (++tries>100) clearInterval(iv);
    },150);
  }

  /* patch ShadowDB.Tasks.update */
  var _snap={};
  function snapshotTask(t){ if(t&&t.id) _snap[t.id]={status:t.status,priority:t.priority,dueDate:t.dueDate,assigneeId:t.assigneeId||t.assignee||''}; }
  function patchUpdate() {
    var tries=0, iv=setInterval(function(){
      if (window.ShadowDB && ShadowDB.Tasks && ShadowDB.Tasks.update) {
        clearInterval(iv);
        var orig = ShadowDB.Tasks.update.bind(ShadowDB.Tasks);
        ShadowDB.Tasks.update = function(task) {
          var prev=_snap[task.id];
          return orig(task).then(function(r){
            if (prev) {
              var title=task.title||'Untitled', id=task.id;
              if (prev.status!==task.status&&task.status) push('status',id,title,actor()+' changed "'+title+'" status to '+task.status);
              if (prev.priority!==task.priority&&task.priority) push('priority',id,title,actor()+' changed "'+title+'" priority to '+task.priority);
              if (prev.dueDate!==task.dueDate&&task.dueDate) push('due_date',id,title,actor()+' set due date of "'+title+'" to '+task.dueDate);
              var newA=task.assigneeId||task.assignee||'';
              if (newA&&prev.assigneeId!==newA) push('assignee',id,title,actor()+' assigned "'+title+'" to '+(task.assigneeName||newA));
            }
            snapshotTask(task); return r;
          });
        };
        if (window.state&&state.tasks) state.tasks.forEach(snapshotTask);
        document.addEventListener('tasks:loaded',function(){ if(state.tasks) state.tasks.forEach(snapshotTask); });
      } else if (++tries>100) clearInterval(iv);
    },150);
  }

  /* hook comment submit */
  function hookCommentBtn() {
    document.addEventListener('click', function(e) {
      var btn=e.target.closest&&(e.target.closest('#tdpCommentSend')||e.target.closest('.comment-send-btn')||e.target.closest('[data-action="send-comment"]'));
      if (!btn) return;
      var input=document.querySelector('#tdpCommentInput,.comment-input,[data-comment-input]');
      var text=input?(input.value||input.textContent||'').trim():'';
      if (!text) return;
      var taskId=window.state&&(state.selectedTaskId||state.currentTaskId);
      var task=window.state&&state.tasks&&state.tasks.find(function(t){return t.id===taskId;});
      var taskTitle=task?(task.title||'task'):'task';
      var snippet=text.length>60?text.substring(0,57)+'...':text;
      push('comment',taskId,taskTitle,actor()+' commented on "'+taskTitle+'": '+snippet);
    });
  }

  /* seed overdue/due-soon alerts once */
  function seedAlerts() {
    if (!window.state||!state.tasks||!state.tasks.length) return;
    var stored=loadFromStorage();
    var seeded=stored.some(function(n){return n.type==='overdue'||n.type==='due_soon';});
    var now=Date.now();
    state.tasks.forEach(function(task){
      if (!task||task.archived||task.status==='Completed'){snapshotTask(task);return;}
      if (!seeded&&task.dueDate){
        var due=new Date(task.dueDate).getTime(), diff=due-now;
        if (diff<0) push('overdue',task.id,task.title,'"'+(task.title||'Task')+'" is overdue');
        else if (diff<2*86400000) push('due_soon',task.id,task.title,'"'+(task.title||'Task')+'" is due soon');
      }
      snapshotTask(task);
    });
  }

  function waitForTasksAndSeed() {
    var tries=0, iv=setInterval(function(){
      if (window.state&&state.tasks&&state.tasks.length>0){clearInterval(iv);seedAlerts();}
      else if (++tries>80) clearInterval(iv);
    },300);
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

  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot);
  else boot();

})();
