// ============================================================
// Shadow ToDo — app.js  (Zoho-spec + UI/UX polish)
// ============================================================
(function () {
  'use strict';

  // ===== STATE =====
  const state = {
    currentView: 'agenda',
    currentDisplay: 'board',   // 'board' | 'list'
    sortBy: 'dueDate',
    sortDir: 'desc',
    groupBy: null,
    filterGroup: null,
    filterTag: null,
    filterAssignee: null,
    filterCreatedBy: null,
    filterStatus: null,
    filterPriority: null,
    filterDelayed: false,
    filterArchived: false,
    searchQuery: '',
    showAllSubtasks: null,     // null = use per-view default
    selectedTaskId: null,
    selectedBulkTasks: new Set(),
    tasks: [],
    groups: [],
    tags: [],
    members: [],
    categories: [],
    currentUserId: null,
    manageFields: {},
    _defaultFields: {
      board: { assignee: true, dueDate: true, priority: true, status: true, tags: true, subtasks: true },
      list:  { assignee: true, dueDate: true, priority: true, status: true, tags: false, subtasks: true, createdDate: true, category: true }
    }
  };

  function getFields(viewType) {
    const key = viewType || state.currentDisplay;
    if (!state.manageFields[key]) state.manageFields[key] = Object.assign({}, state._defaultFields[key]);
    return state.manageFields[key];
  }

  // ===== DATE UTILITIES =====
  function formatDate(ds) {
    if (!ds) return '';
    const d = new Date(ds + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
  function formatDateFull(ds) {
    if (!ds) return 'Yet to set';
    const d = new Date(ds + 'T00:00:00');
    return d.toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric', year:'numeric' });
  }
  function toInputDate(ds) {
    if (!ds) return '';
    return ds.length === 10 ? ds : new Date(ds).toISOString().split('T')[0];
  }
  function isOverdue(ds) { return ds && new Date(ds + 'T23:59:59') < new Date(); }

  function getDateCategory(ds) {
    if (!ds) return 'nodate';
    const today = new Date(); today.setHours(0,0,0,0);
    const d = new Date(ds + 'T00:00:00');
    if (d < today) return 'delayed';
    const tom = new Date(today); tom.setDate(tom.getDate()+1);
    if (d < tom) return 'today';
    const endWeek = new Date(today); endWeek.setDate(today.getDate()+7);
    if (d < endWeek) return 'week';
    const endMonth = new Date(today); endMonth.setDate(today.getDate()+30);
    if (d < endMonth) return 'month';
    return 'upcoming';
  }

  function statusClass(s) { return s.toLowerCase().replace(/\s+/g,'-'); }
  function priColor(p) { return p==='High'?'var(--accent-red)': p==='Medium'?'var(--accent-orange)':'var(--text-muted)'; }
  function getInitials(name) {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    return parts.length === 1 ? parts[0][0].toUpperCase() : (parts[0][0]+parts[parts.length-1][0]).toUpperCase();
  }
  function avatarColor(name) {
    const colors = ['#4285f4','#ea4335','#34a853','#fbbc04','#9c27b0','#00acc1','#e67e22','#1abc9c'];
    if (!name) return colors[0];
    let hash = 0;
    for (let c of name) hash = (hash*31 + c.charCodeAt(0)) & 0xffffffff;
    return colors[Math.abs(hash) % colors.length];
  }
  // ===== SORT OPTIONS per Zoho spec =====
  function getSortOptions() {
    const v = state.currentView;
    if (v === 'agenda' || v === 'myday') return [{ key:'dueDate', label:'Due Date' }];
    if (v === 'sharedwithme') return [{ key:'createdAt', label:'Created Time' }];
    return [
      { key:'createdAt',    label:'Created Time' },
      { key:'dueDate',      label:'Due Date' },
      { key:'modifiedDate', label:'Modified Date' }
    ];
  }

  // ===== GROUP BY options per view =====
  function getGroupByOptions() {
    const v = state.currentView;
    if (['agenda','myday','sharedwithme','unified'].includes(v)) return [];
    if (['createdbyme','assignedtome'].includes(v)) return [
      {key:'priority',label:'Priority'}, {key:'dueDate',label:'Due Date'}, {key:'group',label:'Group'}
    ];
    if (v === 'personal') return [
      {key:'category',label:'Category'}, {key:'status',label:'Status'},
      {key:'priority',label:'Priority'}, {key:'dueDate',label:'Due Date'}
    ];
    if (v === 'group') return [
      {key:'category',label:'Category'}, {key:'status',label:'Status'},
      {key:'assignee',label:'Assignee'}, {key:'dueDate',label:'Due Date'}, {key:'priority',label:'Priority'}
    ];
    return [];
  }

  // ===== SIDEBAR =====
  function renderSidebar() {
    // Deduplicate groups by name to handle seed duplicates
    const seenGroupNames = new Set();
    const uniqueGroups = state.groups.filter(g => {
      if (g.type === 'personal') return false; // Personal shown via "Personal tasks" nav
      if (seenGroupNames.has(g.name)) return false;
      seenGroupNames.add(g.name);
      return true;
    });

    document.getElementById('groupsList').innerHTML = uniqueGroups.map(g => {
      const taskCount = state.tasks.filter(t => t.group === g.id || t.groupId === g.id).length;
      const isActive = state.currentView === 'group' && state.filterGroup === g.id;
      return '<div class="group-item' + (isActive?' active':'') + '" data-group="'+g.id+'">' +
        '<i class="fa-solid fa-users"></i>' +
        '<span class="group-name">'+g.name+'</span>' +
        '<span class="group-count">'+taskCount+'</span>' +
        '</div>';
    }).join('');

    // Deduplicate tags by name
    const seenTagNames = new Set();
    const uniqueTags = state.tags.filter(t => {
      if (seenTagNames.has(t.name)) return false;
      seenTagNames.add(t.name);
      return true;
    });

    document.getElementById('tagsList').innerHTML = uniqueTags.map(t => {
      const isActive = state.filterTag && (state.filterTag === t.id || state.filterTag === t.name);
      return '<div class="tag-item' + (isActive?' active':'') + '" data-tag="'+t.id+'">' +
        '<span class="tag-dot" style="background:'+t.color+'"></span>' +
        '<span>'+t.name+'</span>' +
        '</div>';
    }).join('');

    const personalCount = state.tasks.filter(t => {
      const g = state.groups.find(gr => gr.id === (t.group || t.groupId));
      return g && g.type === 'personal';
    }).length;
    const pcEl = document.getElementById('personalCount');
    if (pcEl) pcEl.textContent = personalCount;

    // --- SHARED WITH ME COUNT ---------------------------------------------
    // TODO: Replace with the central task-count selector once wired
    //   e.g. useTaskStore(s => s.counts.sharedWithMe) or
    //        queryClient.getQueryData(['taskCounts']).sharedWithMe
    // For now derived from state.tasks (same source as personalCount).
    const sharedWithMeCount = state.tasks.filter(function (t) {
      return Array.isArray(t.sharedWith) && t.sharedWith.length > 0;
    }).length;
    const swmEl = document.getElementById('sharedWithMeCount');
    if (swmEl) {
      swmEl.textContent = sharedWithMeCount;
      swmEl.style.display = sharedWithMeCount > 0 ? '' : 'none';
    }

    // Rebind group clicks
    document.querySelectorAll('.group-item').forEach(function(el) {
      el.addEventListener('click', function() {
        document.querySelectorAll('.nav-item').forEach(function(n){n.classList.remove('active')});
        document.querySelectorAll('.group-item').forEach(function(n){n.classList.remove('active')});
        this.classList.add('active');
        state.currentView = 'group';
        state.filterGroup = this.dataset.group;
        state.groupBy = null;
        renderSidebar();
        updateViewHeader();
        renderView();
      });
      el.addEventListener('contextmenu', function(e) {
        e.preventDefault();
        showGroupContextMenu(e, this.dataset.group);
      });
    });

    // Rebind tag clicks
    document.querySelectorAll('.tag-item').forEach(function(el) {
      el.addEventListener('click', function() {
        document.querySelectorAll('.nav-item').forEach(function(n){n.classList.remove('active')});
        document.querySelectorAll('.group-item').forEach(function(n){n.classList.remove('active')});
        const tagId = this.dataset.tag;
        if (state.filterTag === tagId) {
          state.filterTag = null;
        } else {
          state.filterTag = tagId;
        }
        renderSidebar();
        renderView();
      });
    });
  }
  // ===== VIEW HEADER =====
  function updateViewHeader() {
    const titles = {
      agenda:'Agenda', myday:'My Day', createdbyme:'Created by Me',
      assignedtome:'Assigned to me', sharedwithme:'Shared with me',
      personal:'Personal tasks', unified:'Unified view', group:'Group'
    };
    const titleEl = document.getElementById('viewTitle');
    if (titleEl) {
      if (state.currentView === 'group' && state.filterGroup) {
        const grp = state.groups.find(g => g.id === state.filterGroup);
        titleEl.textContent = grp ? grp.name : 'Group';
      } else {
        titleEl.textContent = titles[state.currentView] || state.currentView;
      }
    }
    // Update sort badge
    const sortOpts = getSortOptions();
    const sortLabelEl = document.getElementById('sortLabel');
    if (sortLabelEl) {
      const opt = sortOpts.find(o => o.key === state.sortBy);
      sortLabelEl.textContent = opt ? opt.label.toUpperCase() : 'DUE DATE';
    }
    const sortDirEl = document.querySelector('.sort-direction');
    if (sortDirEl) sortDirEl.textContent = state.sortDir === 'desc' ? 'Newest on top' : 'Oldest on top';

    // Update groupBy chip
    const chip = document.getElementById('groupByChip');
    if (chip) {
      if (state.groupBy) {
        const opts = getGroupByOptions();
        const lbl = (opts.find(function(o){return o.key===state.groupBy;})||{}).label || state.groupBy;
        chip.textContent = lbl;
        chip.style.display = 'inline-flex';
      } else {
        chip.style.display = 'none';
      }
    }
    // Show/hide groupBy button
    const gbBtn = document.getElementById('groupByBtn');
    if (gbBtn) {
      gbBtn.style.display = getGroupByOptions().length > 0 ? '' : 'none';
    }
  }

  // ===== GROUP CONTEXT MENU =====
  function showGroupContextMenu(e, groupId) {
    document.querySelectorAll('.context-menu').forEach(function(m){m.remove()});
    const grp = state.groups.find(function(g){return g.id===groupId;});
    if (!grp) return;
    const menu = document.createElement('div');
    menu.className = 'context-menu';
    menu.style.cssText = 'position:fixed;left:'+e.clientX+'px;top:'+e.clientY+'px;z-index:9999;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;padding:6px 0;min-width:180px;box-shadow:0 4px 16px rgba(0,0,0,0.4)';
    menu.innerHTML =
      '<div class="ctx-item" data-action="rename" style="padding:8px 16px;cursor:pointer;font-size:13px;display:flex;align-items:center;gap:8px"><i class="fa-solid fa-pen"></i> Rename Group</div>' +
      '<div class="ctx-item" data-action="delete" style="padding:8px 16px;cursor:pointer;font-size:13px;display:flex;align-items:center;gap:8px;color:var(--accent-red)"><i class="fa-solid fa-trash"></i> Delete Group</div>';
    document.body.appendChild(menu);
    menu.querySelectorAll('.ctx-item').forEach(function(item) {
      item.addEventListener('click', function() {
        const action = this.dataset.action;
        menu.remove();
        if (action === 'rename') {
          const newName = prompt('Rename group:', grp.name);
          if (newName && newName.trim()) {
            grp.name = newName.trim();
            ShadowDB.Groups.update(grp).then(function(){ renderSidebar(); updateViewHeader(); });
          }
        } else if (action === 'delete') {
          if (confirm('Delete group "'+grp.name+'"?')) {
            ShadowDB.Groups.delete(groupId).then(function(){
              state.groups = state.groups.filter(function(g){return g.id!==groupId;});
              if (state.filterGroup === groupId) { state.filterGroup = null; state.currentView = 'agenda'; }
              renderSidebar();
              renderView();
            });
          }
        }
      });
      item.addEventListener('mouseenter', function(){ this.style.background = 'var(--bg-hover)'; });
      item.addEventListener('mouseleave', function(){ this.style.background = ''; });
    });
    setTimeout(function(){
      document.addEventListener('click', function handler(){ menu.remove(); document.removeEventListener('click',handler); }, {once:true});
    }, 10);
  }
  // ===== TASK CARD (Board View) =====
  function renderTaskCard(t) {
    const fields = getFields('board');
    const dt = t.dueDate ?
      '<div class="task-card-date' + (isOverdue(t.dueDate) ? ' overdue' : '') + '">' +
      '<i class="fa-regular fa-calendar"></i>' + formatDate(t.dueDate) + '</div>' : '';

    const tagsHtml = (fields.tags && t.tags && t.tags.length) ?
      '<div class="task-card-tags">' + t.tags.map(function(tid) {
        const tag = state.tags.find(function(tg){return tg.id===tid||tg.name===tid;});
        const color = tag ? tag.color : '#888';
        const name  = tag ? tag.name  : tid;
        return '<span class="task-tag" style="background:'+color+'">'+name+'</span>';
      }).join('') + '</div>' : '';

    const subtasksHtml = (fields.subtasks && t.subtasks && t.subtasks.length) ?
      '<div class="task-card-subtasks">' +
      '<i class="fa-regular fa-square-check"></i> ' +
      t.subtasks.filter(function(s){return s.completed;}).length + '/' + t.subtasks.length +
      '</div>' : '';

    // Assignee avatar
    const initials = getInitials(t.assignee);
    const bgColor  = avatarColor(t.assignee);
    const assigneeHtml = fields.assignee && t.assignee ?
      '<div class="task-card-assignee">' +
      '<span class="assignee-avatar" style="background:'+bgColor+'" title="'+t.assignee+'">'+initials+'</span>' +
      '</div>' : '';

    const priHtml = (t.priority==='High'||t.priority==='Medium') ?
      '<span class="priority-dot" style="background:'+priColor(t.priority)+'" title="'+t.priority+' priority"></span>' : '';

    const statusHtml = fields.status ?
      '<span class="task-card-status '+statusClass(t.status)+'">'+t.status+'</span>' : '';

    const subtaskIndicator = t._isSubtask ?
      '<span class="subtask-indent-indicator"></span>' : '';

    return '<div class="task-card' + (t.id===state.selectedTaskId?' active-card':'') +
      (t._isSubtask?' is-subtask':'') + '" data-taskid="'+t.id+'">' +
      '<div class="task-card-header">' + priHtml + subtaskIndicator +
      '<div class="task-card-title">'+t.title+'</div>' +
      '</div>' +
      (statusHtml ? '<div class="task-card-status-row">'+statusHtml+'</div>' : '') +
      tagsHtml +
      subtasksHtml +
      '<div class="task-card-footer">' + assigneeHtml + (fields.dueDate?dt:'') + '</div>' +
      '</div>';
  }

  // ===== AGENDA SECTION DEFINITIONS =====
  const AGENDA_SECTIONS = [
    { key:'delayed',  label:'Delayed Tasks',          color:'var(--accent-red)',    emptyMsg:'No delayed tasks' },
    { key:'today',    label:"Today's Tasks",           color:'var(--accent-orange)', emptyMsg:'No tasks for today' },
    { key:'week',     label:"This week's tasks",       color:'var(--column-blue)',   emptyMsg:'No tasks this week' },
    { key:'month',    label:"This month's tasks",      color:'var(--accent-blue)',   emptyMsg:'No tasks this month' },
    { key:'upcoming', label:'Upcoming Tasks',          color:'var(--accent-green)',  emptyMsg:'No upcoming tasks' },
    { key:'nodate',   label:'No due date',             color:'var(--text-muted)',    emptyMsg:'No tasks without due date' }
  ];

  // ===== APPLY GROUP BY =====
  function applyGroupBy(tasks) {
    const gb = state.groupBy;
    if (!gb) return null;
    const groups = {};
    tasks.forEach(function(t) {
      let key;
      if (gb === 'priority') key = t.priority || 'None';
      else if (gb === 'dueDate') key = getDateCategory(t.dueDate);
      else if (gb === 'status') key = t.status || 'None';
      else if (gb === 'category') key = t.category || 'Uncategorized';
      else if (gb === 'assignee') key = t.assignee || 'Unassigned';
      else if (gb === 'group') {
        const grp = state.groups.find(function(g){return g.id===(t.group||t.groupId);});
        key = grp ? grp.name : 'No Group';
      }
      else key = 'Other';
      if (!groups[key]) groups[key] = [];
      groups[key].push(t);
    });
    return groups;
  }

  // ===== BOARD VIEW =====

  // ===== Agenda View context builder =====
  // Dependency-injection bundle passed to window.ShadowAgenda
  function buildAgendaCtx() {
    return {
      groups:   state.groups,
      formatDate: formatDate,
      isOverdue:  isOverdue,
      priColor:   priColor,
      onTaskClick: function (id) { showTaskDetail(id, 'panel'); },
      onToggleComplete: async function (id, isChecked) {
        const task = state.tasks.find(function (t) { return t.id === id; });
        if (!task) return;
        if (isChecked) {
          task.status = 'Completed';
          task.completedAt = new Date().toISOString();
          task.modifiedDate = task.completedAt;
        } else {
          task.status = 'Open';
          task.completedAt = null;
          task.modifiedDate = new Date().toISOString();
        }
        await ShadowDB.Tasks.update(task);
        renderView();
      }
    };
  }

  // Build ctx for the ShadowMyDay module. Mirrors buildAgendaCtx but adds
  // quick-add, pin toggle, inline rename, and a single-parent-label helper.
  function buildMyDayCtx() {
    function localToday() {
      var d = new Date();
      return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
    }
    return {
      today: localToday(),
      priColor: priColor,
      parentLabel: function(t){ if (!t || !t.group) return 'Personal Task'; var g = (state.groups||[]).find(function(x){ return x && x.id === t.group; }); return (g && g.name) ? String(g.name) : String(t.group); },
      onTaskClick: function (id) { showTaskDetail(id, 'panel'); },
      onToggleComplete: async function (id) {
        var task = state.tasks.find(function (t) { return t.id === id; });
        if (!task) return;
        if (task.status === 'Completed') {
          task.status = 'Open';
          task.completedAt = null;
        } else {
          task.status = 'Completed';
          task.completedAt = new Date().toISOString();
        }
        task.modifiedDate = new Date().toISOString();
        await ShadowDB.Tasks.update(task);
        renderView();
      },
      onTogglePin: async function (id) {
        var task = state.tasks.find(function (t) { return t.id === id; });
        if (!task) return;
        task.isMyDay = !(task.isMyDay === true);
        task.modifiedDate = new Date().toISOString();
        await ShadowDB.Tasks.update(task);
        renderView();
      },
      onRenameTitle: async function (id, newTitle) {
        if (!newTitle) return;
        var task = state.tasks.find(function (t) { return t.id === id; });
        if (!task) return;
        task.title = String(newTitle).trim();
        task.modifiedDate = new Date().toISOString();
        await ShadowDB.Tasks.update(task);
        renderView();
      },
      onQuickAdd: async function (title) {
        title = String(title||'').trim();
        if (!title) return;
        var todayS = localToday();
        var created = await ShadowDB.Tasks.create({
          createdBy: state.currentUserId,
          title: title,
          status: 'Open',
          priority: 'Normal',
          group: 'Personal Task',
          dueDate: todayS,
          isMyDay: true
        });
        if (created && created.id) { state.tasks.push(created); }
        renderView();
      }
    };
  }

  // ===== BUILD CREATED-BY-ME CTX =====
  // Builds ctx for the ShadowCreatedByMe module.
  // Sub-filter (all/mine/delegated) is kept in-memory on state.cbmSub.
  function buildCreatedByMeCtx() {
    return {
      members: state.members,
      groups: state.groups,
      currentUserId: state.currentUserId,
      priColor: priColor,
      sub: state.cbmSub || 'all',
      onSubChange: function (key) {
        state.cbmSub = key;
        renderView();
      },
      onToggleComplete: async function (id) {
        const t = state.tasks.find(function (x) { return x.id === id; });
        if (!t) return;
        // Permissions placeholder: creator should not be able to toggle
        // delegated task completion in a full RBAC model. For the demo we
        // allow it; enforcement would go here.
        const done = t.status === 'Completed';
        t.status = done ? 'Open' : 'Completed';
        t.completedAt = done ? null : new Date().toISOString();
        t.modifiedDate = new Date().toISOString();
        await ShadowDB.Tasks.update(t);
        renderView();
      },
      onRename: async function (id, nextTitle) {
        const t = state.tasks.find(function (x) { return x.id === id; });
        if (!t) return;
        t.title = nextTitle;
        t.modifiedDate = new Date().toISOString();
        await ShadowDB.Tasks.update(t);
        renderView();
      },
      onNudge: function (id) {
        const t = state.tasks.find(function (x) { return x.id === id; });
        if (!t) return;
        const who = t.assignee || 'Unassigned';
        // Placeholder: real impl would trigger an email/slack ping.
        if (window.ShadowCreatedByMe && window.ShadowCreatedByMe.toast) {
          window.ShadowCreatedByMe.toast('Task Assigned to ' + who);
        }
      },
      onMove: async function (opts) {
        const { taskId, newStatus, beforeTaskId } = opts || {};
        const t = state.tasks.find(function (x) { return x.id === taskId; });
        if (!t) return;
        // Permission placeholder: in a full RBAC model the creator may not be allowed
        // to change status of a delegated task; for the demo we allow it.
        if (newStatus && t.status !== newStatus) {
          t.status = newStatus;
          t.completedAt = (newStatus === 'Completed') ? new Date().toISOString() : null;
        }
        // Re-order within state.tasks to respect drop position.
        const idxFrom = state.tasks.indexOf(t);
        if (idxFrom >= 0) state.tasks.splice(idxFrom, 1);
        let insertAt = state.tasks.length;
        if (beforeTaskId) {
          const idxBefore = state.tasks.findIndex(function (x) { return x.id === beforeTaskId; });
          if (idxBefore >= 0) insertAt = idxBefore;
        }
        state.tasks.splice(insertAt, 0, t);
        t.modifiedDate = new Date().toISOString();
        await ShadowDB.Tasks.update(t);
        renderView();
      },
      onRerender: function () { renderView(); }
    };
  }

  function buildUnifiedCtx(viewName) {
  var base = buildCreatedByMeCtx();
  // Per-view header titles/subtitles (Zoho-style)
  var map = {
    agenda:       { title: 'Agenda view',     subtitle: 'Plan your week by due date' },
    myday:        { title: 'My Day',          subtitle: "Today's focus list" },
    createdbyme:  { title: 'Created by me',   subtitle: 'Tasks you originated \u2014 track delegated work' },
    assignedtome: { title: 'Assigned to me',  subtitle: 'Tasks others assigned to you' },
    sharedwithme: { title: 'Shared with me',  subtitle: 'Tasks shared with you' },
    personal:     { title: 'Personal tasks',  subtitle: 'Your private to-dos' },
    unified:      { title: 'Unified view',    subtitle: 'All your tasks, everywhere' },
    group:        { title: 'Group',           subtitle: 'Tasks for this group' }
  };
  var info = map[viewName] || { title: viewName||'Tasks', subtitle: '' };
  // Override title for current group
  if (viewName === 'group' && state.filterGroup) {
    var g = (state.groups||[]).find(function(gr){ return gr.id === state.filterGroup; });
    if (g) { info.title = g.name; info.subtitle = 'Tasks in ' + g.name; }
  }
  base.viewName = viewName;
  base.title = info.title;
  base.subtitle = info.subtitle;
  // Sub-filter tabs only make sense for Created by me
  base.hideSubFilters = (viewName !== 'createdbyme');
  // Other views already come pre-filtered via getFilteredTasks(), so bypass owner filter
  base.skipOwnerFilter = (viewName !== 'createdbyme');
  return base;
}

function renderBoardView() {
  var area = document.getElementById('boardArea');
  if (!area) return;
  var tasks = getFilteredTasks();
  var kit = window.ShadowViewKit || window.ShadowCreatedByMe;
  if (kit && typeof kit.renderBoard === 'function') {
    kit.renderBoard(area, tasks, buildUnifiedCtx(state.currentView));
    return;
  }
  // Fallback (should not happen): empty area
  area.innerHTML = '';
}

function renderListView() {
  var listView = document.querySelector('.list-view');
  var area = document.getElementById('listArea');
  var lh = document.getElementById('listHeader');
  if (!area) return;
  // Hide the legacy column strip — ShadowViewKit renders its own columnar table.
  if (lh) { lh.innerHTML = ''; lh.classList.add('compact-header'); }
  var tasks = getFilteredTasks();
  var kit = window.ShadowViewKit || window.ShadowCreatedByMe;
  if (kit && typeof kit.renderList === 'function') {
    kit.renderList(area, tasks, buildUnifiedCtx(state.currentView));
    return;
  }
  area.innerHTML = '';
}


  function bindListRowClicks() {
    document.querySelectorAll('.list-row').forEach(function(row) {
      row.addEventListener('click', function(e) {
        if (e.target.closest('.bulk-checkbox-wrap')) return;
        const rawId = this.dataset.taskid;
        if (!rawId) return;
        if (rawId.includes('_sub_')) {
          showTaskDetail(rawId.split('_sub_')[0], 'panel');
        } else {
          showTaskDetail(rawId, 'panel');
        }
      });
    });
  }

  function bindBulkCheckboxes() {
    document.querySelectorAll('.bulk-checkbox').forEach(function(cb) {
      cb.addEventListener('change', function() {
        const id = this.dataset.id;
        if (this.checked) state.selectedBulkTasks.add(id);
        else state.selectedBulkTasks.delete(id);
        updateBulkBar();
      });
    });
  }
  // ===== RENDER VIEW =====
  function renderView() {
    const boardView = document.getElementById('boardView');
    const listViewEl = document.querySelector('.list-view');
    if (boardView) boardView.style.display = state.currentDisplay === 'board' ? '' : 'none';
    if (listViewEl) listViewEl.style.display = state.currentDisplay === 'list' ? '' : 'none';
    if (state.currentDisplay === 'board') renderBoardView();
    else renderListView();
    updateViewHeader();
    document.querySelectorAll('.view-tab').forEach(function(t){
      t.classList.toggle('active', t.dataset.viewtype === state.currentDisplay);
    });
  }

  // ===== GET FILTERED TASKS =====
  function getFilteredTasks() {
    let tasks = state.tasks.slice();
    const v = state.currentView;
    const today = new Date(); today.setHours(0,0,0,0);
    const todayStr = today.getFullYear() + '-' + String(today.getMonth()+1).padStart(2,'0') + '-' + String(today.getDate()).padStart(2,'0');

    // Search
    if (state.searchQuery) {
      const q = state.searchQuery.toLowerCase();
      tasks = tasks.filter(function(t){
        return t.title.toLowerCase().includes(q) ||
          (t.description||'').toLowerCase().includes(q) ||
          (t.assignee||'').toLowerCase().includes(q);
      });
    }

    // View-level filtering
    if (v === 'myday') {
      tasks = tasks.filter(function(t){ return t.dueDate === todayStr || t.isMyDay === true; });
    } else if (v === 'createdbyme') {
      tasks = tasks.filter(function(t){ return t.createdBy === state.currentUserId || !t.createdBy; });
    } else if (v === 'assignedtome') {
      const me = state.members.find(function(m){ return m.id === state.currentUserId; });
      const myName = me ? me.name : 'Pradeep Kumar';
      tasks = tasks.filter(function(t){ return t.assignee === myName || (t.assignee && myName.includes(t.assignee)) || (t.assignee && t.assignee.includes(myName.split(' ')[0])); });
    } else if (v === 'sharedwithme') {
      tasks = tasks.filter(function(t){ return t.sharedWith && t.sharedWith.length; });
    } else if (v === 'personal') {
      tasks = tasks.filter(function(t){
        const g = state.groups.find(function(gr){ return gr.id === (t.group||t.groupId); });
        return g && g.type === 'personal';
      });
    } else if (v === 'group') {
      if (state.filterGroup) {
        // Also match duplicate groups by name
        const targetGroup = state.groups.find(function(g){ return g.id === state.filterGroup; });
        const matchIds = targetGroup ? state.groups.filter(function(g){ return g.name === targetGroup.name; }).map(function(g){ return g.id; }) : [state.filterGroup];
        tasks = tasks.filter(function(t){ return matchIds.includes(t.group||t.groupId); });
      }
    } else if (v === 'unified') {
      // all tasks
    }
    // agenda: all tasks shown by date sections

    // Tag filter
    if (state.filterTag) {
      tasks = tasks.filter(function(t){
        if (!t.tags || !t.tags.length) return false;
        const tag = state.tags.find(function(tg){ return tg.id === state.filterTag || tg.name === state.filterTag; });
        if (!tag) return t.tags.includes(state.filterTag);
        return t.tags.includes(tag.name) || t.tags.includes(state.filterTag);
      });
    }

    // Filter modal filters
    if (state.filterAssignee) {
      tasks = tasks.filter(function(t){ return t.assignee === state.filterAssignee; });
    }
    if (state.filterStatus) {
      tasks = tasks.filter(function(t){ return t.status === state.filterStatus; });
    }
    if (state.filterPriority) {
      tasks = tasks.filter(function(t){ return t.priority === state.filterPriority; });
    }
    if (state.filterCreatedBy && v === 'group') {
      tasks = tasks.filter(function(t){ return t.createdBy === state.filterCreatedBy; });
    }
    if (state.filterDelayed) {
      tasks = tasks.filter(function(t){ return t.dueDate && new Date(t.dueDate+'T23:59:59') < new Date(); });
    }
    if (!state.filterArchived) {
      tasks = tasks.filter(function(t){ return !t.archived; });
    }

    // Subtask expansion (Show All Subtasks per-view default)
    const subtaskDefaults = {
      agenda:true, myday:true, createdbyme:true, assignedtome:true,
      personal:false, group:false, unified:false, sharedwithme:false
    };
    const showSub = state.showAllSubtasks !== null ? state.showAllSubtasks : (subtaskDefaults[v] !== false);
    if (showSub) {
      const expanded = [];
      tasks.forEach(function(t) {
        expanded.push(t);
        if (t.subtasks && t.subtasks.length) {
          t.subtasks.forEach(function(st) {
            expanded.push({
              id: t.id+'_sub_'+st.id, title: st.title,
              status: st.completed?'Completed':'Open',
              priority: t.priority, group: t.group, assignee: t.assignee,
              dueDate: t.dueDate, tags: t.tags,
              _isSubtask: true, _parentId: t.id, subtasks: [], createdAt: t.createdAt
            });
          });
        }
      });
      tasks = expanded;
    }

    // Sort (disabled when groupBy = 'group')
    if (state.groupBy !== 'group') {
      const dir = state.sortDir === 'desc' ? -1 : 1;
      tasks.sort(function(a,b){
        let va, vb;
        if (state.sortBy === 'dueDate') { va = a.dueDate||'9999'; vb = b.dueDate||'9999'; }
        else if (state.sortBy === 'createdAt') { va = a.createdAt||''; vb = b.createdAt||''; }
        else if (state.sortBy === 'modifiedDate') { va = a.modifiedDate||a.updatedAt||a.createdAt||''; vb = b.modifiedDate||b.updatedAt||b.createdAt||''; }
        else { va = a.title||''; vb = b.title||''; }
        return va < vb ? dir : va > vb ? -dir : 0;
      });
    }

    return tasks;
  }
  // ===== TASK DETAIL =====
  function showTaskDetail(taskId, source) {
    const task = state.tasks.find(function(t){return t.id===taskId;});
    if (!task) return;
    state.selectedTaskId = taskId;

    const panel = document.getElementById('taskDetailPanel');
    if (!panel) return;
    panel.style.display = 'flex'; panel.classList.add('open');

    // Status
    const statusSel = document.getElementById('detailStatus');
    if (statusSel) { statusSel.value = task.status; }

    // Assignee
    const assigneeEl = document.getElementById('detailAssignee');
    if (assigneeEl) assigneeEl.textContent = task.assignee || 'Unassigned';
    const avatarEl = document.getElementById('detailAssigneeAvatar');
    if (avatarEl) {
      avatarEl.textContent = getInitials(task.assignee);
      avatarEl.style.background = avatarColor(task.assignee);
    }

    // Dates
    const dueDateEl = document.getElementById('detailDueDate');
    if (dueDateEl) dueDateEl.textContent = task.dueDate ? formatDateFull(task.dueDate) : 'Yet to set';
    const startDateEl = document.getElementById('detailStartDate');
    if (startDateEl) startDateEl.textContent = task.startDate ? formatDateFull(task.startDate) : 'Yet to set';

    // Title (index.html uses detailTitle as contenteditable h2)
    const titleEl = document.getElementById('detailTitle');
    if (titleEl) { titleEl.textContent = task.title; titleEl.dataset.id = taskId; }

    // Description (index.html uses detailDesc)
    const descEl = document.getElementById('detailDesc');
    if (descEl) descEl.value = task.description || '';

    // Notes
    const notesEl = document.getElementById('detailNotes');
    if (notesEl && task.notes) notesEl.value = task.notes;

    // Priority
    const priSel = document.getElementById('detailPriority');
    if (priSel) priSel.value = task.priority || 'Medium';

    // Tags container (index.html uses detailTagsContainer)
    const tagsContainer = document.getElementById('detailTagsContainer');
    if (tagsContainer) {
      tagsContainer.innerHTML = (task.tags||[]).map(function(tid){
        const tag = state.tags.find(function(tg){return tg.id===tid||tg.name===tid;});
        const color = tag ? tag.color : '#888';
        const name  = tag ? tag.name  : tid;
        return '<span class="task-tag" style="background:'+color+'">'+name+
          '<span class="tag-remove" data-tag="'+tid+'" data-taskid="'+taskId+'">×</span></span>';
      }).join('');
      tagsContainer.querySelectorAll('.tag-remove').forEach(function(btn){
        btn.addEventListener('click', function(){
          const tid = this.dataset.tag; const tid2 = parseInt(tid)||tid;
          task.tags = task.tags.filter(function(t){return t!==tid&&t!==tid2;});
          task.modifiedDate = new Date().toISOString();
          ShadowDB.Tasks.update(task).then(function(){
            showTaskDetail(taskId,'panel'); renderView();
          });
        });
      });
    }

    // Subtasks (index.html uses subtasksList)
    renderModalSubtasks(taskId);
    renderTimeline(task);

    // Update main view to show selected
    document.querySelectorAll('.task-card,.list-row').forEach(function(el){
      el.classList.toggle('active-card', el.dataset.taskid == taskId);
      el.classList.toggle('active-row', el.dataset.taskid == taskId);
    });

    // Add class to list-view for compact mode
    const listViewEl = document.querySelector('.list-view');
    if (listViewEl) listViewEl.classList.add('list-with-panel');
    if (state.currentDisplay === 'list') renderListView();
  }

  
  function renderTimeline(task) {
    const el = document.getElementById('timelineList');
    if (!el) return;
    const entries = task.timeline || [];
    el.innerHTML = entries.length ?
      entries.map(function(e){
        return '<div class="timeline-entry"><span class="timeline-dot"></span>' +
          '<div><div class="timeline-action">'+e.action+'</div>' +
          '<div class="timeline-time">'+new Date(e.time).toLocaleString()+'</div></div></div>';
      }).join('') : '<div class="timeline-empty">No activity yet</div>';
  }

  function addTimelineEntry(task, action) {
    if (!task.timeline) task.timeline = [];
    task.timeline.unshift({ action, time: new Date().toISOString() });
    renderTimeline(task);
  }

  function hideTaskDetail() {
    const panel = document.getElementById('taskDetailPanel');
    if (panel) panel.classList.remove('open'); panel.style.display = 'none';
    state.selectedTaskId = null;
    const listViewEl = document.querySelector('.list-view');
    if (listViewEl) listViewEl.classList.remove('list-with-panel');
    document.querySelectorAll('.task-card,.list-row').forEach(function(el){
      el.classList.remove('active-card','active-row');
    });
    renderView();
  }

  // ===== DYNAMIC CATEGORY UPDATES =====
  function updateCategorySelect(groupId, selectEl) {
    if (!selectEl) return;
    ShadowDB.Categories.getAll().then(function(cats){
      const relevant = cats.filter(function(c){ return !c.group || c.group === groupId; });
      selectEl.innerHTML = relevant.map(function(c){
        return '<option value="'+c.name+'">'+c.name+'</option>';
      }).join('');
    });
  }
  // ===== RECURRENCE MODAL =====
  function showRecurrenceModal(callback) {
    const opts = ['None','Daily','Weekly','Monthly','Yearly'];
    const modal = document.createElement('div');
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;z-index:9000';
    modal.innerHTML = '<div style="background:var(--bg-secondary);border-radius:12px;padding:24px;min-width:280px">' +
      '<h3 style="margin:0 0 16px;font-size:16px">Set Recurrence</h3>' +
      '<div style="display:flex;flex-direction:column;gap:8px">' +
      opts.map(function(o){ return '<label style="display:flex;align-items:center;gap:8px;cursor:pointer;padding:6px 0">' +
        '<input type="radio" name="recurrence" value="'+o+'"> '+o+'</label>'; }).join('') +
      '</div>' +
      '<div style="display:flex;gap:8px;margin-top:16px;justify-content:flex-end">' +
      '<button id="recCancel" style="padding:8px 16px;border-radius:6px;border:1px solid var(--border-color);background:transparent;cursor:pointer;color:var(--text-primary)">Cancel</button>' +
      '<button id="recSave" style="padding:8px 16px;border-radius:6px;border:none;background:var(--accent-blue);color:#fff;cursor:pointer">Save</button>' +
      '</div></div>';
    document.body.appendChild(modal);
    modal.querySelector('#recCancel').addEventListener('click', function(){ modal.remove(); });
    modal.querySelector('#recSave').addEventListener('click', function(){
      const val = modal.querySelector('input[name=recurrence]:checked');
      callback(val ? val.value : null); modal.remove();
    });
  }

  // ===== REMINDER MODAL =====
  function showReminderModal(current, callback) {
    const modal = document.createElement('div');
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;z-index:9000';
    modal.innerHTML = '<div style="background:var(--bg-secondary);border-radius:12px;padding:24px;min-width:300px">' +
      '<h3 style="margin:0 0 16px;font-size:16px">Set Reminder</h3>' +
      '<input type="datetime-local" id="reminderInput" value="'+(current||'')+'" style="width:100%;padding:8px;border-radius:6px;border:1px solid var(--border-color);background:var(--bg-tertiary);color:var(--text-primary);font-size:14px">' +
      '<div style="display:flex;gap:8px;margin-top:16px;justify-content:flex-end">' +
      '<button id="remClear" style="padding:8px 16px;border-radius:6px;border:1px solid var(--border-color);background:transparent;cursor:pointer;color:var(--text-secondary)">Clear</button>' +
      '<button id="remCancel" style="padding:8px 16px;border-radius:6px;border:1px solid var(--border-color);background:transparent;cursor:pointer;color:var(--text-primary)">Cancel</button>' +
      '<button id="remSave" style="padding:8px 16px;border-radius:6px;border:none;background:var(--accent-blue);color:#fff;cursor:pointer">Save</button>' +
      '</div></div>';
    document.body.appendChild(modal);
    modal.querySelector('#remClear').addEventListener('click',function(){ callback(null); modal.remove(); });
    modal.querySelector('#remCancel').addEventListener('click',function(){ modal.remove(); });
    modal.querySelector('#remSave').addEventListener('click',function(){
      callback(modal.querySelector('#reminderInput').value||null); modal.remove();
    });
  }

  // ===== TAGS PICKER =====
  function showTagsPicker(currentTags, callback) {
    const modal = document.createElement('div');
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;z-index:9000';
    const selected = new Set((currentTags||[]).map(function(t){
      const tag = state.tags.find(function(tg){return tg.id===t||tg.name===t;});
      return tag ? tag.name : t;
    }));
    const tagsHtml = state.tags.map(function(t){
      return '<label style="display:flex;align-items:center;gap:8px;cursor:pointer;padding:6px 8px;border-radius:4px">' +
        '<input type="checkbox" name="tag" value="'+t.name+'"' +(selected.has(t.name)?' checked':'')+'>'+
        '<span class="tag-dot" style="background:'+t.color+'"></span>'+t.name+'</label>';
    }).join('');
    modal.innerHTML = '<div style="background:var(--bg-secondary);border-radius:12px;padding:24px;min-width:280px;max-height:60vh;overflow-y:auto">' +
      '<h3 style="margin:0 0 16px;font-size:16px">Select Tags</h3>' +
      '<div style="display:flex;flex-direction:column;gap:2px">'+tagsHtml+'</div>' +
      '<div style="display:flex;gap:8px;margin-top:16px;justify-content:flex-end">' +
      '<button id="tagCancel" style="padding:8px 16px;border-radius:6px;border:1px solid var(--border-color);background:transparent;cursor:pointer;color:var(--text-primary)">Cancel</button>' +
      '<button id="tagSave" style="padding:8px 16px;border-radius:6px;border:none;background:var(--accent-blue);color:#fff;cursor:pointer">Apply</button>' +
      '</div></div>';
    document.body.appendChild(modal);
    modal.querySelector('#tagCancel').addEventListener('click',function(){modal.remove();});
    modal.querySelector('#tagSave').addEventListener('click',function(){
      const checked = Array.from(modal.querySelectorAll('input[name=tag]:checked')).map(function(i){return i.value;});
      callback(checked); modal.remove();
    });
  }

  // ===== COPY/MOVE MODAL =====
  function showCopyMoveModal(taskId, action) {
    const task = state.tasks.find(function(t){return t.id===taskId;});
    if (!task) return;
    const modal = document.createElement('div');
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;z-index:9000';
    const groupOpts = state.groups.map(function(g){
      return '<option value="'+g.id+'">'+g.name+'</option>';
    }).join('');
    modal.innerHTML = '<div style="background:var(--bg-secondary);border-radius:12px;padding:24px;min-width:300px">' +
      '<h3 style="margin:0 0 16px;font-size:16px">'+(action==='copy'?'Copy':'Move')+' Task</h3>' +
      '<label style="display:block;margin-bottom:8px;font-size:13px;color:var(--text-secondary)">Select destination group:</label>' +
      '<select id="cmGroupSel" style="width:100%;padding:8px;border-radius:6px;border:1px solid var(--border-color);background:var(--bg-tertiary);color:var(--text-primary)">'+groupOpts+'</select>' +
      '<div style="display:flex;gap:8px;margin-top:16px;justify-content:flex-end">' +
      '<button id="cmCancel" style="padding:8px 16px;border-radius:6px;border:1px solid var(--border-color);background:transparent;cursor:pointer;color:var(--text-primary)">Cancel</button>' +
      '<button id="cmOk" style="padding:8px 16px;border-radius:6px;border:none;background:var(--accent-blue);color:#fff;cursor:pointer">'+(action==='copy'?'Copy':'Move')+'</button>' +
      '</div></div>';
    document.body.appendChild(modal);
    modal.querySelector('#cmCancel').addEventListener('click',function(){modal.remove();});
    modal.querySelector('#cmOk').addEventListener('click',function(){
      const targetGroupId = modal.querySelector('#cmGroupSel').value;
      modal.remove();
      if (action==='move') {
        task.group = targetGroupId; task.modifiedDate = new Date().toISOString();
        ShadowDB.Tasks.update(task).then(function(){ renderView(); });
      } else {
        const newTask = Object.assign({},task,{id:undefined,group:targetGroupId,createdAt:new Date().toISOString(),modifiedDate:new Date().toISOString()});
        newTask.createdBy = state.currentUserId;
        ShadowDB.Tasks.create(newTask).then(function(created){
          state.tasks.push(created); renderView();
        });
      }
    });
  }
  // ===== DELETE / ARCHIVE TASK =====
  async function deleteTask(taskId) {
    if (!confirm('Delete this task? This cannot be undone.')) return;
    await ShadowDB.Tasks.delete(taskId);
    state.tasks = state.tasks.filter(function(t){return t.id!==taskId;});
    hideTaskDetail();
    renderView();
  }

  async function archiveTask(taskId) {
    const task = state.tasks.find(function(t){return t.id===taskId;});
    if (!task) return;
    task.archived = true; task.modifiedDate = new Date().toISOString();
    await ShadowDB.Tasks.update(task);
    hideTaskDetail();
    renderView();
  }

  // ===== MORE ACTIONS MENU (Detail Panel) =====
  function showDetailMoreMenu(e) {
    document.querySelectorAll('.context-menu').forEach(function(m){m.remove();});
    const taskId = state.selectedTaskId;
    const items = [
      { icon:'fa-copy',    label:'Copy Task',    action:'copy' },
      { icon:'fa-arrows-up-down-left-right', label:'Move Task', action:'move' },
      { icon:'fa-box-archive', label:'Archive', action:'archive' },
      { icon:'fa-trash',   label:'Delete',      action:'delete', danger:true }
    ];
    const menu = document.createElement('div');
    menu.className = 'context-menu';
    menu.style.cssText = 'position:fixed;right:16px;top:'+(e.clientY+10)+'px;z-index:9999;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;padding:6px 0;min-width:180px;box-shadow:0 4px 16px rgba(0,0,0,.4)';
    menu.innerHTML = items.map(function(item){
      return '<div class="ctx-item" data-action="'+item.action+'" style="padding:8px 16px;cursor:pointer;font-size:13px;display:flex;align-items:center;gap:8px'+(item.danger?';color:var(--accent-red)':'')+'">' +
        '<i class="fa-solid '+item.icon+'"></i> '+item.label+'</div>';
    }).join('');
    document.body.appendChild(menu);
    menu.querySelectorAll('.ctx-item').forEach(function(item){
      item.addEventListener('mouseenter',function(){this.style.background='var(--bg-hover)';});
      item.addEventListener('mouseleave',function(){this.style.background='';});
      item.addEventListener('click', function(){
        const action = this.dataset.action; menu.remove();
        if (action==='delete') deleteTask(taskId);
        else if (action==='archive') archiveTask(taskId);
        else if (action==='copy'||action==='move') showCopyMoveModal(taskId,action);
      });
    });
    setTimeout(function(){
      document.addEventListener('click',function h(){menu.remove();document.removeEventListener('click',h);},{once:true});
    },10);
  }

  // ===== FILTER MODAL (Zoho spec) =====
  function showFilterModal() {
    document.querySelectorAll('.filter-modal-overlay').forEach(function(m){m.remove();});
    const v = state.currentView;

    // Build assignee options
    const assigneeOpts = '<option value="">All Assignees</option>' +
      state.members.map(function(m){ return '<option value="'+m.name+'"'+(state.filterAssignee===m.name?' selected':'')+'>'+m.name+'</option>'; }).join('');

    // Created by (Groups view only)
    const createdByRow = v === 'group' ?
      '<div class="filter-row"><label>Created by</label>' +
      '<select id="filterCreatedBy" class="filter-select">' +
      '<option value="">Anyone</option>' +
      state.members.map(function(m){ return '<option value="'+m.name+'"'+(state.filterCreatedBy===m.name?' selected':'')+'>'+m.name+'</option>'; }).join('') +
      '</select></div>' : '';

    const overlay = document.createElement('div');
    overlay.className = 'filter-modal-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;z-index:8000';
    overlay.innerHTML =
      '<div class="filter-modal" style="background:var(--bg-secondary);border-radius:12px;padding:24px;min-width:340px;max-width:420px;width:90%;box-shadow:0 8px 32px rgba(0,0,0,.4)">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">' +
      '<h3 style="margin:0;font-size:16px">Filter Tasks</h3>' +
      '<button id="filterClose" style="background:none;border:none;cursor:pointer;color:var(--text-secondary);font-size:18px">&times;</button>' +
      '</div>' +
      '<div class="filter-body" style="display:flex;flex-direction:column;gap:16px">' +

      '<div class="filter-row"><label style="display:block;font-size:12px;color:var(--text-secondary);margin-bottom:6px;text-transform:uppercase;letter-spacing:.5px">Assignee</label>' +
      '<select id="filterAssignee" class="filter-select" style="width:100%;padding:8px 12px;border-radius:6px;border:1px solid var(--border-color);background:var(--bg-tertiary);color:var(--text-primary);font-size:14px">'+assigneeOpts+'</select></div>' +

      createdByRow +

      '<div class="filter-row"><label style="display:block;font-size:12px;color:var(--text-secondary);margin-bottom:6px;text-transform:uppercase;letter-spacing:.5px">Status</label>' +
      '<select id="filterStatus" class="filter-select" style="width:100%;padding:8px 12px;border-radius:6px;border:1px solid var(--border-color);background:var(--bg-tertiary);color:var(--text-primary);font-size:14px">' +
      '<option value="">All Statuses</option>' +
      ['Open','In Progress','Fixed','Completed','Closed'].map(function(s){ return '<option value="'+s+'"'+(state.filterStatus===s?' selected':'')+'>'+s+'</option>'; }).join('') +
      '</select></div>' +

      '<div class="filter-row"><label style="display:block;font-size:12px;color:var(--text-secondary);margin-bottom:6px;text-transform:uppercase;letter-spacing:.5px">Priority</label>' +
      '<select id="filterPriority" class="filter-select" style="width:100%;padding:8px 12px;border-radius:6px;border:1px solid var(--border-color);background:var(--bg-tertiary);color:var(--text-primary);font-size:14px">' +
      '<option value="">All Priorities</option>' +
      ['High','Medium','Low'].map(function(p){ return '<option value="'+p+'"'+(state.filterPriority===p?' selected':'')+'>'+p+'</option>'; }).join('') +
      '</select></div>' +

      '<div style="display:flex;flex-direction:column;gap:10px;padding-top:4px">' +
      '<label style="display:flex;align-items:center;gap:10px;cursor:pointer;font-size:14px">' +
      '<input type="checkbox" id="filterDelayed"'+(state.filterDelayed?' checked':'')+' style="width:16px;height:16px"> Show Delayed tasks only</label>' +
      '<label style="display:flex;align-items:center;gap:10px;cursor:pointer;font-size:14px">' +
      '<input type="checkbox" id="filterArchived"'+(state.filterArchived?' checked':'')+' style="width:16px;height:16px"> Show Archived tasks</label>' +
      '</div>' +

      '</div>' +
      '<div style="display:flex;gap:8px;margin-top:20px;justify-content:flex-end">' +
      '<button id="filterClear" style="padding:8px 16px;border-radius:6px;border:1px solid var(--border-color);background:transparent;cursor:pointer;color:var(--text-secondary);font-size:14px">Clear All</button>' +
      '<button id="filterApply" style="padding:8px 20px;border-radius:6px;border:none;background:var(--accent-blue);color:#fff;cursor:pointer;font-size:14px;font-weight:500">Apply</button>' +
      '</div></div>';

    document.body.appendChild(overlay);

    overlay.querySelector('#filterClose').addEventListener('click',function(){overlay.remove();});
    overlay.addEventListener('click',function(e){if(e.target===overlay)overlay.remove();});
    overlay.querySelector('#filterClear').addEventListener('click',function(){
      state.filterAssignee=null;state.filterCreatedBy=null;state.filterStatus=null;
      state.filterPriority=null;state.filterDelayed=false;state.filterArchived=false;
      overlay.remove(); renderView();
    });
    overlay.querySelector('#filterApply').addEventListener('click',function(){
      state.filterAssignee = overlay.querySelector('#filterAssignee').value||null;
      const cb = overlay.querySelector('#filterCreatedBy');
      if (cb) state.filterCreatedBy = cb.value||null;
      state.filterStatus   = overlay.querySelector('#filterStatus').value||null;
      state.filterPriority = overlay.querySelector('#filterPriority').value||null;
      state.filterDelayed  = overlay.querySelector('#filterDelayed').checked;
      state.filterArchived = overlay.querySelector('#filterArchived').checked;
      overlay.remove(); renderView();
    });
  }
  // ===== SORT DROPDOWN (Zoho spec) =====
  function showSortDropdown() {
    document.querySelectorAll('.dropdown-menu').forEach(function(m){m.remove();});
    const opts = getSortOptions();
    if (!opts.length) return;
    const btn = document.getElementById('sortBtn');
    const rect = btn ? btn.getBoundingClientRect() : {left:0,bottom:0};
    const menu = document.createElement('div');
    menu.className = 'dropdown-menu';
    menu.style.cssText = 'position:fixed;left:'+rect.left+'px;top:'+(rect.bottom+4)+'px;z-index:9000;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;padding:6px 0;min-width:200px;box-shadow:0 4px 16px rgba(0,0,0,.4)';

    // Sort field options
    const fieldItems = opts.map(function(o){
      return '<div class="sort-item" data-key="'+o.key+'" style="padding:8px 16px;cursor:pointer;font-size:13px;display:flex;align-items:center;justify-content:space-between">' +
        '<span>'+o.label+'</span>' +
        (state.sortBy===o.key?'<i class="fa-solid fa-check" style="color:var(--accent-blue)"></i>':'') +
        '</div>';
    }).join('');

    // Sort direction
    const dirItems = [
      { key:'desc', label:'Newest on top', icon:'fa-arrow-down' },
      { key:'asc',  label:'Oldest on top', icon:'fa-arrow-up' }
    ].map(function(d){
      return '<div class="sort-dir-item" data-dir="'+d.key+'" style="padding:8px 16px;cursor:pointer;font-size:13px;display:flex;align-items:center;gap:8px'+(state.sortDir===d.key?';color:var(--accent-blue)':'')+'">' +
        '<i class="fa-solid '+d.icon+'"></i> '+d.label+'</div>';
    }).join('');

    menu.innerHTML =
      '<div style="padding:6px 16px 4px;font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px">Sort by</div>' +
      fieldItems +
      '<div style="height:1px;background:var(--border-color);margin:4px 0"></div>' +
      dirItems;

    document.body.appendChild(menu);
    menu.querySelectorAll('.sort-item').forEach(function(item){
      item.addEventListener('mouseenter',function(){this.style.background='var(--bg-hover)';});
      item.addEventListener('mouseleave',function(){this.style.background='';});
      item.addEventListener('click',function(){
        state.sortBy = this.dataset.key;
        menu.remove(); renderView();
      });
    });
    menu.querySelectorAll('.sort-dir-item').forEach(function(item){
      item.addEventListener('mouseenter',function(){this.style.background='var(--bg-hover)';});
      item.addEventListener('mouseleave',function(){this.style.background='';});
      item.addEventListener('click',function(){
        state.sortDir = this.dataset.dir;
        menu.remove(); renderView();
      });
    });
    setTimeout(function(){
      document.addEventListener('click',function h(){menu.remove();document.removeEventListener('click',h);},{once:true});
    },10);
  }

  // ===== GROUP BY DROPDOWN =====
  function showGroupByDropdown() {
    document.querySelectorAll('.dropdown-menu').forEach(function(m){m.remove();});
    const opts = getGroupByOptions();
    if (!opts.length) return;
    const btn = document.getElementById('groupByBtn') || document.getElementById('moreActionsBtn');
    const rect = btn ? btn.getBoundingClientRect() : {left:0,bottom:0};
    const menu = document.createElement('div');
    menu.className = 'dropdown-menu';
    menu.style.cssText = 'position:fixed;left:'+rect.left+'px;top:'+(rect.bottom+4)+'px;z-index:9000;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;padding:6px 0;min-width:200px;box-shadow:0 4px 16px rgba(0,0,0,.4)';
    const items = [{key:null,label:'None (No grouping)'}].concat(opts);
    menu.innerHTML =
      '<div style="padding:6px 16px 4px;font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px">Group by</div>' +
      items.map(function(o){
        return '<div class="gb-item" data-key="'+(o.key||'')+'" style="padding:8px 16px;cursor:pointer;font-size:13px;display:flex;align-items:center;justify-content:space-between">' +
          '<span>'+o.label+'</span>' +
          (state.groupBy===o.key?'<i class="fa-solid fa-check" style="color:var(--accent-blue)"></i>':'') +
          '</div>';
      }).join('');
    document.body.appendChild(menu);
    menu.querySelectorAll('.gb-item').forEach(function(item){
      item.addEventListener('mouseenter',function(){this.style.background='var(--bg-hover)';});
      item.addEventListener('mouseleave',function(){this.style.background='';});
      item.addEventListener('click',function(){
        state.groupBy = this.dataset.key||null;
        menu.remove(); renderView();
      });
    });
    setTimeout(function(){
      document.addEventListener('click',function h(){menu.remove();document.removeEventListener('click',h);},{once:true});
    },10);
  }

  // ===== MANAGE FIELDS DROPDOWN =====
  function showManageFieldsDropdown() {
    document.querySelectorAll('.dropdown-menu').forEach(function(m){m.remove();});
    const btn = document.getElementById('manageFieldsBtn');
    const rect = btn ? btn.getBoundingClientRect() : {right:200,bottom:0};
    const menu = document.createElement('div');
    menu.className = 'dropdown-menu';
    menu.style.cssText = 'position:fixed;right:'+(window.innerWidth-rect.right)+'px;top:'+(rect.bottom+4)+'px;z-index:9000;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:10px;padding:8px 0;min-width:240px;box-shadow:0 4px 24px rgba(0,0,0,.4)';

    const bFields = getFields('board');
    const lFields = getFields('list');

    const fieldDefs = [
      {key:'assignee',  label:'Assignee'},
      {key:'status',    label:'Status'},
      {key:'dueDate',   label:'Due Date'},
      {key:'tags',      label:'Tags'},
      {key:'subtasks',  label:'Subtask Progress'}
    ];

    const boardRows = fieldDefs.map(function(f){
      return '<label style="display:flex;align-items:center;justify-content:space-between;padding:6px 16px;cursor:pointer;font-size:13px">' +
        f.label +
        '<input type="checkbox" class="mf-board" data-key="'+f.key+'"'+(bFields[f.key]?' checked':'')+'></label>';
    }).join('');

    const listFieldDefs = fieldDefs.concat([
      {key:'createdDate', label:'Created Date'},
      {key:'category',    label:'Category'}
    ]);
    const listRows = listFieldDefs.map(function(f){
      return '<label style="display:flex;align-items:center;justify-content:space-between;padding:6px 16px;cursor:pointer;font-size:13px">' +
        f.label +
        '<input type="checkbox" class="mf-list" data-key="'+f.key+'"'+(lFields[f.key]?' checked':'')+'></label>';
    }).join('');

    // Show All Subtasks toggle
    const subtaskDefaults = {agenda:true,myday:true,createdbyme:true,assignedtome:true,personal:false,group:false,unified:false,sharedwithme:false};
    const showSub = state.showAllSubtasks !== null ? state.showAllSubtasks : (subtaskDefaults[state.currentView] !== false);
    const showSubRow = state.currentView !== 'sharedwithme' ?
      '<div style="height:1px;background:var(--border-color);margin:4px 0"></div>' +
      '<label style="display:flex;align-items:center;justify-content:space-between;padding:8px 16px;cursor:pointer;font-size:13px">' +
      'Show all Subtasks' +
      '<input type="checkbox" id="mfShowSubtasks"'+(showSub?' checked':'')+'></label>' : '';

    menu.innerHTML =
      '<div style="padding:8px 16px;font-size:12px;font-weight:600;color:var(--text-secondary);text-transform:uppercase;letter-spacing:.5px">Board View Fields</div>' +
      boardRows +
      '<div style="height:1px;background:var(--border-color);margin:4px 0"></div>' +
      '<div style="padding:8px 16px;font-size:12px;font-weight:600;color:var(--text-secondary);text-transform:uppercase;letter-spacing:.5px">List View Fields</div>' +
      listRows +
      showSubRow;

    document.body.appendChild(menu);

    menu.querySelectorAll('.mf-board').forEach(function(cb){
      cb.addEventListener('change',function(){
        bFields[this.dataset.key] = this.checked;
        renderView();
      });
    });
    menu.querySelectorAll('.mf-list').forEach(function(cb){
      cb.addEventListener('change',function(){
        lFields[this.dataset.key] = this.checked;
        renderView();
      });
    });
    const subCb = menu.querySelector('#mfShowSubtasks');
    if (subCb) {
      subCb.addEventListener('change',function(){
        state.showAllSubtasks = this.checked;
        renderView();
      });
    }

    setTimeout(function(){
      document.addEventListener('click',function h(e){
        if (!menu.contains(e.target)){menu.remove();document.removeEventListener('click',h);}
      },{once:false});
    },10);
  }
  // ===== BULK ACTIONS =====
  function updateBulkBar() {
    const bar = document.getElementById('bulkBar');
    const countEl = document.getElementById('bulkCount');
    if (!bar) return;
    const count = state.selectedBulkTasks.size;
    if (count > 0) {
      bar.style.display = 'flex';
      if (countEl) countEl.textContent = count + ' task' + (count>1?'s':'') + ' selected';
    } else {
      bar.style.display = 'none';
    }
  }

  async function handleBulkAction(e) {
    const action = e.target.dataset.action || e.target.closest('[data-action]')?.dataset?.action;
    if (!action) return;
    const ids = Array.from(state.selectedBulkTasks);
    if (!ids.length) return;

    if (action === 'delete') {
      if (!confirm('Delete ' + ids.length + ' task(s)?')) return;
      for (const id of ids) {
        await ShadowDB.Tasks.delete(id);
        state.tasks = state.tasks.filter(function(t){return t.id!==id;});
      }
    } else if (action === 'complete') {
      for (const id of ids) {
        const task = state.tasks.find(function(t){return t.id===id;});
        if (task) { task.status='Completed'; task.completedAt=new Date().toISOString(); task.modifiedDate=task.completedAt; await ShadowDB.Tasks.update(task); }
      }
    } else if (action === 'archive') {
      for (const id of ids) {
        const task = state.tasks.find(function(t){return t.id===id;});
        if (task) { task.archived=true; task.modifiedDate=new Date().toISOString(); await ShadowDB.Tasks.update(task); }
      }
    }
    state.selectedBulkTasks.clear();
    updateBulkBar();
    renderView();
  }

  // ===== MODAL SUBTASKS =====
  function renderModalSubtasks(taskId) {
    const task = state.tasks.find(function(t){return t.id===(taskId||state.selectedTaskId);});
    const el = document.getElementById('subtasksList');
    if (!el || !task) return;
    el.innerHTML = (task.subtasks||[]).map(function(st,i){
      return '<div class="subtask-item" data-idx="'+i+'">' +
        '<input type="checkbox" class="subtask-check"'+(st.completed?' checked':'')+' data-idx="'+i+'">' +
        '<span class="subtask-title'+(st.completed?' completed-text':'')+'">'+st.title+'</span>' +
        '<button class="subtask-del" data-idx="'+i+'" style="background:none;border:none;cursor:pointer;color:var(--text-muted);padding:0 4px;font-size:12px">×</button>' +
        '</div>';
    }).join('');

    el.querySelectorAll('.subtask-check').forEach(function(cb){
      cb.addEventListener('change',function(){
        const idx = parseInt(this.dataset.idx);
        task.subtasks[idx].completed = this.checked;
        task.modifiedDate = new Date().toISOString();
        ShadowDB.Tasks.update(task).then(function(){ renderView(); renderModalSubtasks(task.id); });
      });
    });
    el.querySelectorAll('.subtask-del').forEach(function(btn){
      btn.addEventListener('click',function(){
        const idx = parseInt(this.dataset.idx);
        task.subtasks.splice(idx,1);
        task.modifiedDate = new Date().toISOString();
        ShadowDB.Tasks.update(task).then(function(){ renderView(); renderModalSubtasks(task.id); });
      });
    });
  }

  function renderModalTags(taskId) {
    const task = state.tasks.find(function(t){return t.id===(taskId||state.selectedTaskId);});
    const el = document.getElementById('modalTagsContainer');
    if (!el || !task) return;
    el.innerHTML = (task.tags||[]).map(function(tid){
      const tag = state.tags.find(function(tg){return tg.id===tid||tg.name===tid;});
      const color = tag?tag.color:'#888';
      const name  = tag?tag.name:tid;
      return '<span class="task-tag" style="background:'+color+'">'+name+'</span>';
    }).join('');
  }

  function updateGroupSelects() {
    const groupSel = document.getElementById('modalGroup');
    if (!groupSel) return;
    groupSel.innerHTML = state.groups.map(function(g){
      return '<option value="'+g.id+'">'+g.name+'</option>';
    }).join('');
  }

  function handleAttachment(callback) {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.style.display = 'none';
    inp.addEventListener('change',function(){
      const f = inp.files[0];
      if (f) callback({name:f.name,size:f.size,type:f.type,url:URL.createObjectURL(f)});
      inp.remove();
    });
    document.body.appendChild(inp);
    inp.click();
  }
  // ===== EVENT BINDINGS =====

  // Nav items
  document.querySelectorAll('.nav-item').forEach(function(item){
    item.addEventListener('click', function(){
      document.querySelectorAll('.nav-item').forEach(function(n){n.classList.remove('active');});
      document.querySelectorAll('.group-item').forEach(function(n){n.classList.remove('active');});
      this.classList.add('active');
      state.currentView = this.dataset.view;
      state.filterGroup = null;
      // Reset groupBy when switching views if not applicable
      const validGb = getGroupByOptions().map(function(o){return o.key;});
      if (state.groupBy && !validGb.includes(state.groupBy)) state.groupBy = null;
      // Reset sort to valid option for view
      const validSort = getSortOptions().map(function(o){return o.key;});
      if (validSort.length && !validSort.includes(state.sortBy)) state.sortBy = validSort[0];
      updateViewHeader();
      renderSidebar();
      renderView();
    });
  });

  // Board / List tabs
  document.querySelectorAll('.view-tab').forEach(function(tab) {
    tab.addEventListener('click', function() {
      state.currentDisplay = this.dataset.viewtype;
      document.querySelectorAll('.view-tab').forEach(function(t){t.classList.remove('active');});
      this.classList.add('active');
      renderView();
    });
  });

  // Filter button
  document.getElementById('filterBtn').addEventListener('click', function() { showFilterModal(); });

  // Sort button
  document.getElementById('sortBtn').addEventListener('click', function(e) {
    e.stopPropagation();
    showSortDropdown();
  });

  // Manage Fields button
  document.getElementById('manageFieldsBtn').addEventListener('click', function(e) {
    e.stopPropagation();
    showManageFieldsDropdown();
  });

  // Group By button
  const groupByBtnEl = document.getElementById('groupByBtn');
  if (groupByBtnEl) {
    groupByBtnEl.addEventListener('click', function(e) {
      e.stopPropagation();
      showGroupByDropdown();
    });
  }

  // More actions button (task settings / other)
  const moreActionsBtnEl = document.getElementById('moreActionsBtn');
  if (moreActionsBtnEl) {
    moreActionsBtnEl.addEventListener('click', function(e) {
      e.stopPropagation();
      // Show task settings in future; for now open group by
      showGroupByDropdown();
    });
  }

  // New Task button
  document.getElementById('newTaskBtn').addEventListener('click', function(){
    state.modalSubtasks = [];
    state.modalTags = [];
    state.modalReminder = null;
    state.modalRecurrence = null;
    updateGroupSelects();
    const modal = document.getElementById('taskModal');
    if (modal) {
      modal.style.display='flex';
      document.getElementById('modalTaskTitle').value='';
      const descEl = document.getElementById('modalDesc');
      if (descEl) descEl.value='';
      document.getElementById('modalStatusBtn').value='Open';
      document.getElementById('modalPriority').value='None';
      document.getElementById('modalDueDate').value='';
      const startEl = document.getElementById('modalStartDate');
      if (startEl) startEl.value='';
      renderModalSubtasks();
      renderModalTags();
      updateCategorySelect(document.getElementById('modalGroup').value, document.getElementById('modalCategory'));
      document.getElementById('modalTaskTitle').focus();
    }
  });

  // Group change -> Update category
  const modalGroupEl = document.getElementById('modalGroup');
  if (modalGroupEl) {
    modalGroupEl.addEventListener('change', function() {
      updateCategorySelect(this.value, document.getElementById('modalCategory'));
    });
  }

  // Modal close/cancel
  const modalCancelBtn = document.getElementById('modalCancelBtn');
  if (modalCancelBtn) modalCancelBtn.addEventListener('click', function(){
    document.getElementById('taskModal').style.display='none';
  });

  // Modal Recurrence button
  const modalRecurBtn = document.getElementById('modalRecurBtn');
  if (modalRecurBtn) {
    modalRecurBtn.addEventListener('click', function() {
      showRecurrenceModal(function(rec) {
        state.modalRecurrence = rec;
        modalRecurBtn.innerHTML = rec ? '<i class="fa-solid fa-repeat"></i> '+rec.type : '<i class="fa-solid fa-repeat"></i> Recurrence';
      });
    });
  }

  // Modal Tags button
  const modalTagBtnEl = document.getElementById('modalTagBtn');
  if (modalTagBtnEl) {
    modalTagBtnEl.addEventListener('click', function() {
      showTagsPicker(state.modalTags, function(selected) {
        state.modalTags = selected;
        renderModalTags();
      });
    });
  }

  // Modal Attachment button
  const modalAttachBtn = document.getElementById('modalAttachBtn');
  if (modalAttachBtn) {
    modalAttachBtn.addEventListener('click', function() {
      handleAttachment(function(files) {
        if (!state.modalAttachments) state.modalAttachments = [];
        state.modalAttachments = state.modalAttachments.concat(files);
      });
    });
  }

  // Modal Reminder button
  const modalReminderBtnEl = document.getElementById('modalReminderBtn');
  if (modalReminderBtnEl) {
    modalReminderBtnEl.addEventListener('click', function() {
      showReminderModal(state.modalReminder, function(reminder) {
        state.modalReminder = reminder;
        modalReminderBtnEl.innerHTML = reminder ?
          '<i class="fa-regular fa-calendar-check"></i> ' + formatDate(reminder.date) + ' ' + (reminder.time||'') :
          '<i class="fa-regular fa-calendar-check"></i> Reminder';
      });
    });
  }

  // Modal subtask add
  const modalSubtaskInput = document.getElementById('modalSubtaskInput');
  const modalAddSubtaskBtn = document.getElementById('modalAddSubtaskBtn');
  if (modalAddSubtaskBtn && modalSubtaskInput) {
    modalAddSubtaskBtn.addEventListener('click', function() {
      const val = modalSubtaskInput.value.trim();
      if (val) { state.modalSubtasks.push({id: Date.now(), title: val, completed: false}); modalSubtaskInput.value=''; renderModalSubtasks(); }
    });
    modalSubtaskInput.addEventListener('keydown', function(e) {
      if (e.key==='Enter') { modalAddSubtaskBtn.click(); }
    });
  }

  // Modal Save (create task)
  const modalSaveBtn = document.getElementById('modalSaveBtn');
  if (modalSaveBtn) {
    modalSaveBtn.addEventListener('click', async function() {
      const title = document.getElementById('modalTaskTitle').value.trim();
      if (!title) { alert('Please enter a task title.'); return; }
      const descEl = document.getElementById('modalDesc');
      const startEl = document.getElementById('modalStartDate');
      const task = {
        title: title,
        description: descEl ? descEl.value : '',
        status: document.getElementById('modalStatusBtn').value,
        priority: document.getElementById('modalPriority').value,
        group: document.getElementById('modalGroup').value || null,
        category: document.getElementById('modalCategory').value,
        assignee: document.getElementById('modalAssignee').value,
        dueDate: document.getElementById('modalDueDate').value || null,
        startDate: startEl ? startEl.value || null : null,
        tags: state.modalTags.slice(),
        subtasks: state.modalSubtasks.slice(),
        recurrence: state.modalRecurrence || null,
        reminder: state.modalReminder || null,
        attachments: state.modalAttachments ? state.modalAttachments.slice() : [],
        createdBy: state.currentUserId,
        createdAt: new Date().toISOString(),
        modifiedDate: new Date().toISOString(),
        activity: []
      };
      task.createdBy = state.currentUserId;
      const created = await ShadowDB.Tasks.create(task);
      state.tasks = await ShadowDB.Tasks.getAll();
      document.getElementById('taskModal').style.display='none';
      state.modalSubtasks = [];
      state.modalTags = [];
      state.modalAttachments = [];
      renderSidebar();
      renderView();
      if (created && created.id) showTaskDetail(created.id, 'panel');
    });
  }

  // Task detail close button
  const detailCloseBtn = document.getElementById('detailCloseBtn');
  if (detailCloseBtn) detailCloseBtn.addEventListener('click', function(){ hideTaskDetail(); renderView(); });

  // Task detail more menu
  const detailMoreBtn = document.getElementById('detailMoreBtn');
  if (detailMoreBtn) detailMoreBtn.addEventListener('click', function(e){ e.stopPropagation(); showDetailMoreMenu(e); });

  // Detail panel title inline edit
  const detailTitle = document.getElementById('detailTitle');
  if (detailTitle) {
    detailTitle.addEventListener('blur', async function() {
      const task = state.tasks.find(function(t){return t.id===state.selectedTaskId;});
      if (!task || this.textContent.trim()===task.title) return;
      task.title = this.textContent.trim();
      task.modifiedDate = new Date().toISOString();
      addTimelineEntry(task, 'changed title');
      await ShadowDB.Tasks.update(task);
      renderSidebar();
      renderView();
    });
  }

  // Detail panel description inline edit
  const detailDesc = document.getElementById('detailDesc');
  if (detailDesc) {
    detailDesc.addEventListener('blur', async function() {
      const task = state.tasks.find(function(t){return t.id===state.selectedTaskId;});
      if (!task) return;
      task.description = this.textContent.trim();
      task.modifiedDate = new Date().toISOString();
      addTimelineEntry(task, 'updated description');
      await ShadowDB.Tasks.update(task);
    });
  }

  // Detail status & priority
  const detailStatus = document.getElementById('detailStatus');
  if (detailStatus) {
    detailStatus.addEventListener('change', async function() {
      const task = state.tasks.find(function(t){return t.id===state.selectedTaskId;});
      if (!task) return;
      const ns = this.value;
      addTimelineEntry(task, 'changed status from '+task.status+' to '+ns);
      task.status = ns;
      task.modifiedDate = new Date().toISOString();
      await ShadowDB.Tasks.update(task);
      renderSidebar(); renderView();
    });
  }
  const detailPriority = document.getElementById('detailPriority');
  if (detailPriority) {
    detailPriority.addEventListener('change', async function() {
      const task = state.tasks.find(function(t){return t.id===state.selectedTaskId;});
      if (!task) return;
      const np = this.value;
      addTimelineEntry(task, 'changed priority from '+task.priority+' to '+np);
      task.priority = np;
      task.modifiedDate = new Date().toISOString();
      await ShadowDB.Tasks.update(task);
      renderSidebar(); renderView();
    });
  }

  // Detail panel - Start Date click to edit
  const detailStartDateEl = document.getElementById('detailStartDate');
  if (detailStartDateEl) {
    detailStartDateEl.addEventListener('click', function() {
      const task = state.tasks.find(function(t){return t.id===state.selectedTaskId;});
      if (!task) return;
      if (this.querySelector('input')) return;
      const input = document.createElement('input');
      input.type='date'; input.className='inline-date-input';
      input.value = toInputDate(task.startDate)||'';
      this.innerHTML=''; this.appendChild(input); input.focus();
      input.addEventListener('change', async function() {
        task.startDate = this.value;
        task.modifiedDate = new Date().toISOString();
        addTimelineEntry(task, 'changed start date to '+formatDate(this.value));
        await ShadowDB.Tasks.update(task);
        detailStartDateEl.textContent = task.startDate ? formatDateFull(task.startDate) : 'Set start date';
        renderView();
      });
      input.addEventListener('blur', function() {
        if (!task.startDate) detailStartDateEl.textContent = 'Set start date';
      });
    });
  }

  // Detail panel - Due Date click to edit
  const detailDueDateEl = document.getElementById('detailDueDate');
  if (detailDueDateEl) {
    detailDueDateEl.addEventListener('click', function() {
      const task = state.tasks.find(function(t){return t.id===state.selectedTaskId;});
      if (!task) return;
      if (this.querySelector('input')) return;
      const input = document.createElement('input');
      input.type='date'; input.className='inline-date-input';
      input.value = toInputDate(task.dueDate)||'';
      this.innerHTML=''; this.appendChild(input); input.focus();
      input.addEventListener('change', async function() {
        task.dueDate = this.value;
        task.modifiedDate = new Date().toISOString();
        addTimelineEntry(task, 'changed due date to '+formatDate(this.value));
        await ShadowDB.Tasks.update(task);
        detailDueDateEl.textContent = task.dueDate ? formatDateFull(task.dueDate) : 'Set due date';
        renderView();
      });
      input.addEventListener('blur', function() {
        if (!task.dueDate) detailDueDateEl.textContent = 'Set due date';
      });
    });
  }

  // Detail panel - Tags button
  const detailTagsBtn = document.getElementById('detailTagsBtn');
  if (detailTagsBtn) {
    detailTagsBtn.addEventListener('click', function() {
      const task = state.tasks.find(function(t){return t.id===state.selectedTaskId;});
      if (!task) return;
      showTagsPicker(task.tags||[], function(selected) {
        task.tags = selected;
        task.modifiedDate = new Date().toISOString();
        addTimelineEntry(task, 'updated tags');
        ShadowDB.Tasks.update(task).then(function(){ renderView(); showTaskDetail(state.selectedTaskId, 'panel'); });
      });
    });
  }

  // Detail panel - Reminder button
  const detailReminderBtn = document.getElementById('detailReminderBtn');
  if (detailReminderBtn) {
    detailReminderBtn.addEventListener('click', function() {
      const task = state.tasks.find(function(t){return t.id===state.selectedTaskId;});
      if (!task) return;
      showReminderModal(task.reminder, function(reminder) {
        task.reminder = reminder;
        task.modifiedDate = new Date().toISOString();
        addTimelineEntry(task, reminder ? 'set reminder for '+formatDate(reminder.date) : 'removed reminder');
        ShadowDB.Tasks.update(task).then(function(){
          renderView();
          showTaskDetail(state.selectedTaskId, state.taskDetailMode);
        });
      });
    });
  }

  // Detail panel - Attachment button
  const detailAttachBtn = document.getElementById('detailAttachBtn');
  if (detailAttachBtn) {
    detailAttachBtn.addEventListener('click', function() {
      const task = state.tasks.find(function(t){return t.id===state.selectedTaskId;});
      if (!task) return;
      handleAttachment(function(files) {
        if (!task.attachments) task.attachments = [];
        task.attachments = task.attachments.concat(files);
        task.modifiedDate = new Date().toISOString();
        addTimelineEntry(task, 'added '+files.length+' attachment(s)');
        ShadowDB.Tasks.update(task).then(function(){
          showTaskDetail(state.selectedTaskId, state.taskDetailMode);
          renderView();
        });
      });
    });
  }

  // Detail panel - Subtask completion
  document.getElementById('taskDetailPanel').addEventListener('change', async function(e) {
    if (!e.target.classList.contains('subtask-checkbox') && e.target.closest('#subtasksList')) {
      const cb = e.target;
      const task = state.tasks.find(function(t){return t.id===state.selectedTaskId;});
      if (!task || !task.subtasks) return;
      const stId = cb.dataset.subtaskid;
      const sub = task.subtasks.find(function(s){return s.id===stId;});
      if (sub) {
        sub.completed = cb.checked;
        task.modifiedDate = new Date().toISOString();
        addTimelineEntry(task, (cb.checked?'completed':'reopened')+' subtask: '+sub.title);
        await ShadowDB.Tasks.update(task);
        renderView();
      }
    }
  });

  // Search
  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    searchInput.addEventListener('input', function() {
      state.searchQuery = this.value;
      renderView();
    });
  }

  // Keyboard shortcut: / to focus search
  document.addEventListener('keydown', function(e) {
    if (e.key==='/' && !e.target.matches('input,textarea,[contenteditable]')) {
      e.preventDefault();
      if (searchInput) searchInput.focus();
    }
    if (e.key==='Escape') {
      hideTaskDetail();
      const taskModal = document.getElementById('taskModal');
      if (taskModal) taskModal.style.display='none';
      renderView();
    }
  });

  // ===== INIT =====

  // ===== INIT =====
  async function init() {
    await ShadowDB.init();
    state.tasks    = await ShadowDB.Tasks.getAll();
    state.groups   = await ShadowDB.Groups.getAll();
    state.tags     = await ShadowDB.Tags.getAll();
    state.members  = await ShadowDB.Members.getAll();
    state.categories = await ShadowDB.Categories.getAll();

    // ── Auto-dedup: remove duplicate tasks (same title + group name + dueDate) ──
    const seenTaskKeys = new Set();
    for (const t of state.tasks.slice()) {
      const g = state.groups.find(function(gr){return gr.id===(t.group||t.groupId);});
      const key = t.title + '|' + (g?g.name:'none') + '|' + (t.dueDate||'');
      if (seenTaskKeys.has(key)) { await ShadowDB.Tasks.delete(t.id); }
      else seenTaskKeys.add(key);
    }
    // ── Auto-dedup: remove duplicate groups, tags, members by name ──
    const seenGroupNames = new Set();
    for (const g of state.groups.slice()) {
      if (seenGroupNames.has(g.name)) { await ShadowDB.Groups.delete(g.id); }
      else seenGroupNames.add(g.name);
    }
    const seenTagNames = new Set();
    for (const t of state.tags.slice()) {
      if (seenTagNames.has(t.name)) { await ShadowDB.Tags.delete(t.id); }
      else seenTagNames.add(t.name);
    }
    const seenMemberNames = new Set();
    for (const m of state.members.slice()) {
      if (seenMemberNames.has(m.name)) { await ShadowDB.Members.delete(m.id); }
      else seenMemberNames.add(m.name);
    }

    // Reload after cleanup
    state.tasks    = await ShadowDB.Tasks.getAll();
    state.groups   = await ShadowDB.Groups.getAll();
    state.tags     = await ShadowDB.Tags.getAll();
    state.members  = await ShadowDB.Members.getAll();
    state.categories = await ShadowDB.Categories.getAll();

    // Set currentUserId to first member (owner)
    const owner = state.members.find(function(m){return m.role==='Owner';});
    state.currentUserId = owner ? owner.id : (state.members[0]||{}).id;

    updateGroupSelects();
    renderSidebar();

    // Set initial active nav
    document.querySelectorAll('.nav-item').forEach(function(n){
      if (n.dataset.view === state.currentView) n.classList.add('active');
    });
    updateViewHeader();
    renderView();
  }

    // RHS sidebar navigation
  document.getElementById('workflowBtn').addEventListener('click', function() {
    window.location.href = 'workflow.html';
  });
  document.getElementById('playgroundBtn').addEventListener('click', function() {
    window.location.href = 'playground.html';
  });

  // Wait for Supabase backend to be ready, then run init (exactly once).
    window.__shadowAppInit = () => init().catch(function(err){ console.error('Init error:', err); });
    if (window.ShadowDB && window.ShadowDB._sb) window.__shadowAppInit();
    else document.addEventListener('shadowdb:ready', window.__shadowAppInit, { once: true });

    // --- Expose select internals for feature modules (invitee, notifications) ----
    // These are intentionally added as window globals so separate IIFE modules
    // appended to this file can access them without refactoring the whole app.
    try {
      window.state = state;
      if (typeof openTaskDetail === 'function') window.openTaskDetail = openTaskDetail;
      if (typeof showTaskDetail === 'function') window.showTaskDetail = showTaskDetail;
      if (typeof addTimelineEntry === 'function') window.addTimelineEntry = addTimelineEntry;
      if (typeof renderSidebar === 'function') window.renderSidebar = renderSidebar;
      if (typeof renderCurrentView === 'function') window.renderCurrentView = renderCurrentView;
    } catch (e) { /* no-op */ }
})();


/* =========================================================================
 * feature/shared-with-me  —  Invitee module
 *   - Invite User modal (search + select mock users)
 *   - "Enable invitee access" toggle is a setting only (does NOT touch sharedWith)
 *   - Emits per-invitee notifications + task timeline entries
 * ========================================================================= */
(function InviteeModule() {

  // MOCK directory — swap for ShadowDB.Members.list() when available.
  var MOCK_USERS = [
    { id: 'u1', name: 'Raghavan P',         email: 'raghavan.pk@zohocorp.com' },
    { id: 'u2', name: 'Raghavan Anandan',   email: 'raghavan.av@zohocorp.com' },
    { id: 'u3', name: 'Raghavan Balchand',  email: 'raghavan.balchand@zohocorp.com' },
    { id: 'u4', name: 'Raghav Balaji V',    email: 'raghav.balaji@zohocorp.com' },
    { id: 'u5', name: 'Raghav Iyer',        email: 'raghav.r@zohocorp.com' },
    { id: 'u6', name: 'Raghav M B',         email: 'raghav.mb@zohocorp.com' },
    { id: 'u7', name: 'Raghav S',           email: 'raghav.sr@zohocorp.com' },
    { id: 'u8', name: 'Raghav Subramaniam', email: 'raghav.subramaniam@zohocorp.com' }
  ];

  function $id(id) { return document.getElementById(id); }
  function overlay() { return $id('inviteModalOverlay'); }

  var draftInvitees = [];
  var draftAccessEnabled = true;

  function currentTask() {
    if (!window.state || !state.tasks) return null;
    var id = state.selectedTaskId || state.currentTaskId;
    return state.tasks.find(function (t) { return t.id === id; }) || null;
  }

  // TODO: replace with real notification store (ShadowDB.Notifications.create(...))
  function pushNotification(n) {
    state.notifications = state.notifications || [];
    state.notifications.unshift({
      id: 'n_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      type: n.type,
      taskId: n.taskId,
      actor: n.actor,
      target: n.target,
      message: n.message,
      time: new Date().toISOString(),
      read: false
    });
    document.dispatchEvent(new CustomEvent('notifications:updated'));
  }

  function openModal() {
    var task = currentTask();
    if (!task) return;
    draftInvitees = (task.sharedWith || []).slice();
    draftAccessEnabled = task.inviteeAccessEnabled !== false;
    var toggle = $id('inviteAccessToggle');
    if (toggle) toggle.checked = draftAccessEnabled;
    $id('inviteSearchInput').value = '';
    $id('inviteSuggestions').hidden = true;
    renderChips();
    overlay().style.display = 'flex';
  }

  function closeModal() { if (overlay()) overlay().style.display = 'none'; }

  function renderChips() {
    $id('inviteChosen').innerHTML = draftInvitees.map(function (u) {
      return '<span class="invite-chip" data-id="' + u.id + '">' + u.name +
             ' <span class="x" data-rm="' + u.id + '" aria-label="Remove">&#10005;</span></span>';
    }).join('');
  }

  function onSearch(e) {
    var q = e.target.value.trim().toLowerCase();
    var box = $id('inviteSuggestions');
    if (!q) { box.hidden = true; return; }
    var hits = MOCK_USERS.filter(function (u) {
      return u.name.toLowerCase().indexOf(q) !== -1 ||
             u.email.toLowerCase().indexOf(q) !== -1;
    }).slice(0, 8);
    box.innerHTML = hits.map(function (u) {
      return '<li data-id="' + u.id + '">' +
             '<div class="avatar-sm">' + u.name.charAt(0) + '</div>' +
             '<div><div class="u-name">' + u.name + '</div>' +
             '<div class="u-email">' + u.email + '</div></div></li>';
    }).join('');
    box.hidden = hits.length === 0;
  }

  function onPickSuggestion(e) {
    var li = e.target.closest && e.target.closest('li[data-id]');
    if (!li) return;
    var user = MOCK_USERS.find(function (u) { return u.id === li.dataset.id; });
    if (user && !draftInvitees.some(function (u) { return u.id === user.id; })) {
      draftInvitees.push(user);
      renderChips();
    }
    $id('inviteSearchInput').value = '';
    $id('inviteSuggestions').hidden = true;
  }

  function onRemoveChip(e) {
    var id = e.target.dataset && e.target.dataset.rm;
    if (!id) return;
    draftInvitees = draftInvitees.filter(function (u) { return u.id !== id; });
    renderChips();
  }

  // Toggle is setting-only; never mutates task.sharedWith.
  function onToggleAccess(e) { draftAccessEnabled = !!e.target.checked; }

  function confirmInvite() {
    var task = currentTask();
    if (!task) return;
    var previousIds = {};
    (task.sharedWith || []).forEach(function (u) { previousIds[u.id] = true; });
    var added = draftInvitees.filter(function (u) { return !previousIds[u.id]; });

    task.sharedWith = draftInvitees.slice();
    task.inviteeAccessEnabled = draftAccessEnabled;
    // TODO: ShadowDB.Tasks.update(task.id, { sharedWith, inviteeAccessEnabled })

    var actor = (state.currentUser && state.currentUser.name) || 'You';
    added.forEach(function (u) {
      if (typeof addTimelineEntry === 'function') {
        addTimelineEntry(task, actor + ' invited ' + u.name + ' to this task');
      }
      pushNotification({
        type: 'invite',
        taskId: task.id,
        actor: actor,
        target: u,
        message: actor + ' invited ' + u.name + ' (' + u.email + ') to "' + (task.title || 'task') + '"'
      });
    });

    showToast(added.length ? 'Invitee(s) has been added successfully' : 'Invitee list updated');
    closeModal();
    if (typeof renderSidebar === 'function') renderSidebar();
    if (typeof renderCurrentView === 'function') renderCurrentView();
  }

  function showToast(text) {
    var t = $id('inviteToast');
    if (!t) return;
    var span = t.querySelector('span');
    if (span) span.textContent = text;
    else t.innerHTML = '<i class="fa-solid fa-circle-check"></i> <span>' + text + '</span>';
    t.style.display = 'block';
    clearTimeout(showToast._id);
    showToast._id = setTimeout(function () { t.style.display = 'none'; }, 2200);
  }

  function init() {
    var add = $id('inviteeAddBtn'); if (add) add.addEventListener('click', openModal);
    var close = $id('inviteModalClose'); if (close) close.addEventListener('click', closeModal);
    var search = $id('inviteSearchInput'); if (search) search.addEventListener('input', onSearch);
    var sugg = $id('inviteSuggestions'); if (sugg) sugg.addEventListener('click', onPickSuggestion);
    var chosen = $id('inviteChosen'); if (chosen) chosen.addEventListener('click', onRemoveChip);
    var toggle = $id('inviteAccessToggle'); if (toggle) toggle.addEventListener('change', onToggleAccess);
    var confirm = $id('inviteConfirmBtn'); if (confirm) confirm.addEventListener('click', confirmInvite);
    var ov = overlay(); if (ov) ov.addEventListener('click', function (e) { if (e.target === ov) closeModal(); });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();


/* =========================================================================
 * feature/shared-with-me  —  Notifications dropdown module
 *   Header bell bound to state.notifications; listens for
 *   'notifications:updated' events from invitee flow (and future emitters).
 * ========================================================================= */
(function NotificationsModule() {
  function $id(id) { return document.getElementById(id); }

  // TODO: replace with real notification store (ShadowDB.Notifications.list/subscribe)
  function list() { return (window.state && state.notifications) || []; }
  function unreadCount() { return list().filter(function (n) { return !n.read; }).length; }

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
    switch (type) {
      case 'invite':  return 'fa-user-plus';
      case 'comment': return 'fa-comment';
      case 'status':  return 'fa-circle-check';
      default:        return 'fa-bell';
    }
  }

  function escapeHtml(s) {
    return String(s || '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function renderBadge() {
    var badge = $id('notifBadge');
    if (!badge) return;
    var n = unreadCount();
    badge.textContent = n;
    badge.hidden = n === 0;
  }

  function renderPanel() {
    var listEl = $id('notifList');
    var emptyEl = $id('notifEmpty');
    if (!listEl || !emptyEl) return;
    var items = list();
    if (!items.length) {
      listEl.innerHTML = '';
      emptyEl.style.display = 'block';
      return;
    }
    emptyEl.style.display = 'none';
    listEl.innerHTML = items.map(function (n) {
      return '<li class="notif-item ' + (n.read ? '' : 'unread') + '" ' +
             'data-id="' + n.id + '" data-task="' + (n.taskId || '') + '" role="menuitem">' +
             '<div class="n-icon"><i class="fa-solid ' + iconFor(n.type) + '"></i></div>' +
             '<div><div class="n-body">' + escapeHtml(n.message) + '</div>' +
             '<div class="n-time">' + timeAgo(n.time) + '</div></div></li>';
    }).join('');
  }

  function togglePanel(force) {
    var panel = $id('notifPanel');
    var btn = $id('notifBellBtn');
    if (!panel || !btn) return;
    var willOpen = typeof force === 'boolean' ? force : panel.hidden;
    panel.hidden = !willOpen;
    btn.setAttribute('aria-expanded', String(willOpen));
    if (willOpen) renderPanel();
  }

  function onItemClick(e) {
    var li = e.target.closest && e.target.closest('.notif-item');
    if (!li) return;
    var id = li.dataset.id;
    var taskId = li.dataset.task;
    var items = list();
    var item = items.find(function (n) { return n.id === id; });
    if (item) item.read = true;
    renderBadge();
    renderPanel();
    if (taskId) {
      var opener = (typeof window.openTaskDetail === 'function' && window.openTaskDetail) ||
                   (typeof window.showTaskDetail === 'function' && window.showTaskDetail);
      if (opener) { togglePanel(false); opener(taskId, 'notification'); }
    }
  }

  function markAllRead() {
    list().forEach(function (n) { n.read = true; });
    renderBadge();
    renderPanel();
  }

  function clearAll() {
    if (window.state) state.notifications = [];
    renderBadge();
    renderPanel();
  }

  function init() {
    if (window.state) state.notifications = state.notifications || [];

    var bell = $id('notifBellBtn');
    if (bell) bell.addEventListener('click', function (e) { e.stopPropagation(); togglePanel(); });
    var listEl = $id('notifList'); if (listEl) listEl.addEventListener('click', onItemClick);
    var mark = $id('notifMarkAllRead'); if (mark) mark.addEventListener('click', function (e) { e.stopPropagation(); markAllRead(); });
    var clr = $id('notifClearAll'); if (clr) clr.addEventListener('click', function (e) { e.stopPropagation(); clearAll(); });

    document.addEventListener('click', function (e) {
      var panel = $id('notifPanel');
      if (!panel || panel.hidden) return;
      if (!(e.target.closest && e.target.closest('.notif-wrap'))) togglePanel(false);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') togglePanel(false);
    });
    document.addEventListener('notifications:updated', function () {
      renderBadge();
      var panel = $id('notifPanel');
      if (panel && !panel.hidden) renderPanel();
    });

    renderBadge();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
