// Shadow ToDo - Application Logic (ShadowDB Backend Integration)
// UPDATED: Zoho ToDo feature parity - Views, Group By, Filter, Sort, Manage Fields
(function() {
  'use strict';

  let state = {
    tasks: [], groups: [], tags: [],
    currentView: 'agenda',
    currentViewType: 'board',
    selectedTaskId: null,
    taskDetailMode: null,
    sortBy: 'dueDate', sortDirection: 'desc', searchQuery: '',
    groupBy: null,
    filterGroup: null,
    filterTag: null,
    filterAssignee: null,
    filterCreatedBy: null,
    filterStatus: null,
    filterPriority: null,
    filterDelayed: false,
    filterArchived: false,
    showAllSubtasks: {
      agenda: true, createdbyme: true, assignedtome: true,
      personal: false, group: false, sharedwithme: false, myday: true, unified: false
    },
    manageFields: {},
    currentUserId: 1,
    modalSubtasks: [],
    modalTags: [],
    selectedBulkTasks: new Set()
  };

  let dbReady = false;

  // Default visible fields per view
  const DEFAULT_FIELDS = {
    board: { assignee: true, dueDate: true, priority: true, tags: true, subtasks: true, status: true },
    list:  { assignee: true, dueDate: true, priority: true, tags: true, subtasks: true, status: true, createdDate: true, category: true }
  };

  function getFields(viewType) {
    const key = state.currentView + '_' + viewType;
    if (!state.manageFields[key]) state.manageFields[key] = Object.assign({}, DEFAULT_FIELDS[viewType] || DEFAULT_FIELDS.board);
    return state.manageFields[key];
  }

  function formatDate(ds) {
    if (!ds) return '';
    const d = new Date(ds);
    const m = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return d.getDate()+' '+m[d.getMonth()]+' '+d.getFullYear();
  }
  function formatDateFull(ds) {
    if (!ds) return '';
    const d = new Date(ds);
    const day = String(d.getDate()).padStart(2,'0');
    const mon = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()];
    const year = d.getFullYear();
    return day+' '+mon+' '+year;
  }
  function toInputDate(ds) {
    if (!ds) return '';
    return ds.substring(0, 10);
  }
  function isOverdue(ds) { return ds && new Date(ds) < new Date(); }

  function getDateCategory(ds) {
    if (!ds) return 'nodate';
    const d = new Date(ds);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const td = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const diff = Math.floor((td - today) / 86400000);
    if (diff < 0) return 'delayed';
    if (diff === 0) return 'today';
    // end of current week (Sunday-end)
    const endOfWeek = new Date(today);
    endOfWeek.setDate(today.getDate() + (6 - today.getDay()));
    if (td <= endOfWeek) return 'thisweek';
    // end of current month
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    if (td <= endOfMonth) return 'thismonth';
    // upcoming = next month up to ~1 year
    return 'upcoming';
  }

  function statusClass(s) { return s.toLowerCase().replace(/\s+/g,'-'); }
  function getGroupName(id) { const g=state.groups.find(g=>g.id===id); return g?g.name:'Personal tasks'; }
  function getGroupById(id) { return state.groups.find(g=>g.id===id); }

  // ===== SORT OPTIONS per Zoho spec =====
  function getSortOptions() {
    const v = state.currentView;
    if (v === 'agenda') return [{key:'dueDate',label:'Due Date'}];
    if (v === 'sharedwithme') return [{key:'createdDate',label:'Created Time'}];
    if (state.groupBy === 'group') return [];
    return [
      {key:'createdDate', label:'Created Time'},
      {key:'dueDate',     label:'Due Date'},
      {key:'modifiedDate',label:'Modified Date'}
    ];
  }

  // ===== GROUP BY options per view =====
  function getGroupByOptions() {
    const v = state.currentView;
    if (v === 'agenda' || v === 'myday' || v === 'sharedwithme' || v === 'unified') return [];
    if (v === 'createdbyme' || v === 'assignedtome') return [
      {key:'priority', label:'Priority'},
      {key:'dueDate',  label:'Due Date'},
      {key:'group',    label:'Group'}
    ];
    if (v === 'personal') return [
      {key:'category', label:'Category'},
      {key:'status',   label:'Status'},
      {key:'priority', label:'Priority'},
      {key:'dueDate',  label:'Due Date'}
    ];
    // group view
    return [
      {key:'category', label:'Category'},
      {key:'status',   label:'Status'},
      {key:'assignee', label:'Assignee'},
      {key:'dueDate',  label:'Due Date'},
      {key:'priority', label:'Priority'}
    ];
  }

  // ===== SIDEBAR =====
  function renderSidebar() {
    document.getElementById('groupsList').innerHTML = state.groups.filter(g=>g.type!=='personal').map(g=>{
      const c=state.tasks.filter(t=>t.group===g.id).length;
      const active = state.currentView==='group' && state.filterGroup===g.id ? ' active' : '';
      return '<div class="group-item'+active+'" data-group="'+g.id+'"><i class="fa-solid fa-chevron-right" style="font-size:10px"></i> '+g.name+(c?'<span class="count">'+c+'</span>':'')+' '+'</div>';
    }).join('');
    document.getElementById('tagsList').innerHTML = state.tags.map(t=>{
      const active = state.filterTag===t.id ? ' active' : '';
      return '<div class="tag-item'+active+'" data-tag="'+t.id+'" style="cursor:pointer"><span class="tag-dot" style="background:'+t.color+'"></span>'+t.name+'</div>';
    }).join('');
    document.getElementById('personalCount').textContent = state.tasks.filter(t=>{
      const g=state.groups.find(gr=>gr.id===t.group);
      return g && g.type==='personal';
    }).length;
    // Re-bind group clicks
    document.querySelectorAll('.group-item').forEach(function(el) {
      el.addEventListener('click', function() {
        document.querySelectorAll('.nav-item').forEach(function(n){n.classList.remove('active')});
        document.querySelectorAll('.group-item').forEach(function(n){n.classList.remove('active')});
        this.classList.add('active');
        state.currentView = 'group';
        state.filterGroup = parseInt(this.dataset.group);
        state.groupBy = state.groupBy || null;
        renderSidebar();
        updateViewHeader();
        renderView();
      });
      el.addEventListener('contextmenu', function(e) {
        e.preventDefault();
        showGroupContextMenu(e, parseInt(this.dataset.group));
      });
    });
    // Re-bind tag clicks
    document.querySelectorAll('.tag-item').forEach(function(el) {
      el.addEventListener('click', function() {
        document.querySelectorAll('.nav-item').forEach(function(n){n.classList.remove('active')});
        const tagId = parseInt(this.dataset.tag);
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
    const v = state.currentView;
    const titleEl = document.getElementById('viewTitle');
    if (titleEl) {
      let label = titles[v] || v;
      if (v === 'group' && state.filterGroup) {
        const g = getGroupById(state.filterGroup);
        if (g) label = g.name;
      }
      titleEl.textContent = label;
    }
    // Update group-by chip in header
    const gbChip = document.getElementById('groupByChip');
    if (gbChip) {
      if (state.groupBy) {
        const opts = getGroupByOptions();
        const lbl = (opts.find(function(o){return o.key===state.groupBy;}) || {}).label || state.groupBy;
        gbChip.textContent = lbl;
        gbChip.style.display = 'inline-flex';
      } else {
        gbChip.style.display = 'none';
      }
    }
    // Show/hide group-by button based on view
    const gbBtn = document.getElementById('groupByBtn');
    if (gbBtn) {
      gbBtn.style.display = getGroupByOptions().length > 0 ? '' : 'none';
    }
    // Sort label
    const sortOpts = getSortOptions();
    const sortLabelEl = document.getElementById('sortLabel');
    if (sortLabelEl) {
      const cur = sortOpts.find(function(o){return o.key===state.sortBy;});
      sortLabelEl.textContent = cur ? cur.label : (sortOpts[0] ? sortOpts[0].label : '');
    }
  }

  // ===== GROUP CONTEXT MENU =====
  function showGroupContextMenu(e, groupId) {
    let menu = document.getElementById('groupContextMenu');
    if (!menu) {
      menu = document.createElement('div');
      menu.id = 'groupContextMenu';
      menu.className = 'context-menu';
      document.body.appendChild(menu);
    }
    menu.innerHTML = '<div class="dropdown-item" data-action="addCategory">Add Category</div>' +
      '<div class="dropdown-item" data-action="deleteGroup" style="color:#e74c3c">Delete Group</div>';
    menu.style.left = e.clientX+'px';
    menu.style.top = e.clientY+'px';
    menu.style.display = 'block';
    menu.dataset.groupId = groupId;
    menu.onclick = function(ev) {
      const item = ev.target.closest('.dropdown-item');
      if (!item) return;
      const action = item.dataset.action;
      if (action === 'addCategory') {
        const name = prompt('Category name:');
        if (name && name.trim()) {
          const g = getGroupById(groupId);
          if (g) {
            if (!g.categories) g.categories = [];
            g.categories.push(name.trim());
            ShadowDB.Groups.update(g).then(function(){ renderSidebar(); renderView(); });
          }
        }
      } else if (action === 'deleteGroup') {
        if (confirm('Delete this group?')) {
          ShadowDB.Groups.delete(groupId).then(function(){
            state.groups = state.groups.filter(function(g){return g.id!==groupId;});
            if (state.filterGroup === groupId) { state.filterGroup = null; state.currentView = 'agenda'; }
            renderSidebar();
            renderView();
          });
        }
      }
      menu.style.display = 'none';
    };
    setTimeout(function(){
      document.addEventListener('click', function hideMenu(ev) {
        if (!menu.contains(ev.target)) { menu.style.display='none'; document.removeEventListener('click',hideMenu); }
      });
    }, 10);
  }

  // ===== TASK CARD (Board View) =====
  function renderTaskCard(t) {
    const fields = getFields('board');
    const dt = t.dueDate ? '<div class="task-card-date '+(isOverdue(t.dueDate)?'overdue':'')+'">' +
      '<i class="fa-regular fa-calendar"></i> '+formatDate(t.dueDate)+'</div>' : '';
    const tagsHtml = (fields.tags && t.tags && t.tags.length) ?
      '<div class="task-card-tags">'+t.tags.map(function(tid){
        const tag=state.tags.find(function(tg){return tg.name===tid||tg.id===tid;});
        return tag?'<span class="tag-badge" style="background:'+tag.color+'">'+tag.name+'</span>':'';
      }).join('')+'</div>' : '';
    const subtasksHtml = (fields.subtasks && t.subtasks && t.subtasks.length) ?
      '<div class="task-card-subtasks"><i class="fa-regular fa-square-check"></i> '+
      t.subtasks.filter(function(s){return s.completed;}).length+'/'+t.subtasks.length+'</div>' : '';
    const assigneeHtml = fields.assignee && t.assignee ?
      '<span class="assignee-avatar">'+t.assignee[0].toUpperCase()+'</span>' : '';
    const priHtml = (t.priority==='High'||t.priority==='Medium') ?
      '<span class="priority-indicator'+(t.priority==='Medium'?' medium-priority':'')+'">!</span> ' : '';
    const statusHtml = fields.status ?
      '<span class="status-badge '+statusClass(t.status)+'">'+t.status+'</span>' : '';
    return '<div class="task-card'+(t.id===state.selectedTaskId?' active-card':'')+'" data-taskid="'+t.id+'">' +
      '<div class="task-card-title">'+priHtml+t.title+'</div>' +
      (statusHtml?'<div class="task-card-status">'+statusHtml+'</div>':'') +
      tagsHtml + subtasksHtml +
      '<div class="task-card-footer">'+assigneeHtml+(fields.dueDate?dt:'')+'</div>' +
      '</div>';
  }

  // ===== AGENDA SECTION DEFINITIONS =====
  const AGENDA_SECTIONS = [
    {key:'delayed',   label:'Delayed',            color:'#e74c3c'},
    {key:'today',     label:"Today's Tasks",      color:'#f39c12'},
    {key:'thisweek',  label:"This week's tasks",  color:'#3498db'},
    {key:'thismonth', label:"This month's tasks", color:'#9b59b6'},
    {key:'upcoming',  label:'Upcoming Tasks',     color:'#1abc9c'},
    {key:'nodate',    label:'No due date',         color:'#95a5a6'}
  ];

  // ===== APPLY GROUP BY =====
  function applyGroupBy(tasks) {
    const gb = state.groupBy;
    if (!gb) return null; // null = caller handles sections
    const groups = {};
    tasks.forEach(function(t) {
      let key = '';
      if (gb === 'priority') key = t.priority || 'None';
      else if (gb === 'status') key = t.status || 'Open';
      else if (gb === 'dueDate') key = getDateCategory(t.dueDate);
      else if (gb === 'category') key = t.category || 'Uncategorized';
      else if (gb === 'assignee') key = t.assignee || 'Unassigned';
      else if (gb === 'group') { const g=getGroupById(t.group); key = g?g.name:'Personal'; }
      if (!groups[key]) groups[key] = [];
      groups[key].push(t);
    });
    return groups;
  }

  // ===== BOARD VIEW =====
  function renderBoardView() {
    const area = document.getElementById('boardArea');
    if (!area) return;
    const tasks = getFilteredTasks();

    if (state.currentView === 'agenda') {
      // Agenda: always 6 fixed sections, sorted by dueDate
      let sorted = tasks.slice().sort(function(a,b){
        if (!a.dueDate && !b.dueDate) return 0;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return new Date(a.dueDate) - new Date(b.dueDate);
      });
      area.innerHTML = AGENDA_SECTIONS.map(function(sec) {
        const ts = sorted.filter(function(t){return getDateCategory(t.dueDate)===sec.key;});
        return '<div class="board-column" data-section="'+sec.key+'">' +
          '<div class="board-col-header"><span class="col-color-dot" style="background:'+sec.color+'"></span>' +
          '<span class="col-title">'+sec.label+'</span>' +
          '<span class="col-count">'+ts.length+'</span>' +
          '<button class="col-add-btn" data-section="'+sec.key+'">+</button></div>' +
          '<div class="board-col-body">'+ts.map(renderTaskCard).join('')+'</div>' +
          '</div>';
      }).join('');
    } else {
      // Other views: use groupBy or flat
      const grouped = applyGroupBy(tasks);
      if (grouped) {
        area.innerHTML = Object.entries(grouped).map(function(entry) {
          const key = entry[0], ts = entry[1];
          return '<div class="board-column" data-group-key="'+key+'">' +
            '<div class="board-col-header"><span class="col-title">'+key+'</span>' +
            '<span class="col-count">'+ts.length+'</span></div>' +
            '<div class="board-col-body">'+ts.map(renderTaskCard).join('')+'</div>' +
            '</div>';
        }).join('');
      } else {
        // no groupBy: single flat list column
        area.innerHTML = '<div class="board-column board-column-wide">' +
          '<div class="board-col-body">'+tasks.map(renderTaskCard).join('')+'</div>' +
          '</div>';
      }
    }
    bindCardClicks();
    bindBulkCheckboxes();
  }

  function bindCardClicks() {
    document.querySelectorAll('.task-card').forEach(function(card) {
      card.addEventListener('click', function(e) {
        if (e.target.closest('.bulk-checkbox')) return;
        showTaskDetail(parseInt(this.dataset.taskid), 'panel');
      });
    });
    document.querySelectorAll('.col-add-btn').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        // open new task modal
        document.getElementById('taskModal').style.display='flex';
        document.getElementById('modalTaskTitle').focus();
      });
    });
  }

  // ===== LIST VIEW =====
  function renderListRow(t) {
    const fields = getFields('list');
    const checked = state.selectedBulkTasks.has(t.id) ? ' checked' : '';
    const tagsHtml = (fields.tags && t.tags && t.tags.length) ? t.tags.map(function(tid){
      const tag=state.tags.find(function(tg){return tg.name===tid||tg.id===tid;});
      return tag?'<span class="tag-badge" style="background:'+tag.color+'">'+tag.name+'</span>':'';
    }).join('') : '';
    const metaHtml = tagsHtml ? '<div class="task-meta-tags">'+tagsHtml+'</div>' : '';
    let createdDate = '';
    if (fields.createdDate && t.createdAt) createdDate = formatDate(t.createdAt);
    const category = fields.category ? (t.category||'') : '';
    const subtasksCol = fields.subtasks && t.subtasks && t.subtasks.length ?
      '<i class="fa-regular fa-square-check"></i> '+t.subtasks.filter(function(s){return s.completed;}).length+'/'+t.subtasks.length : '';
    return '<div class="list-row'+(t.id===state.selectedTaskId?' active-row':'')+'" data-taskid="'+t.id+'">' +
      '<div class="list-col title-col">' +
      '<input type="checkbox" class="bulk-checkbox" data-taskid="'+t.id+'"'+checked+'>' +
      '<div class="check-circle"><i class="fa-solid fa-check" style="font-size:10px"></i></div>' +
      (t.priority==='High'?'<span class="priority-indicator">!</span> ':'') +
      '<span class="list-task-name">'+t.title+'</span>' +
      metaHtml + '</div>' +
      (fields.assignee ? '<div class="list-col assignee-col">'+(t.assignee||'')+'</div>' : '') +
      (fields.status ? '<div class="list-col status-col"><span class="status-badge '+statusClass(t.status)+'">'+t.status+'</span></div>' : '') +
      (fields.dueDate ? '<div class="list-col due-date-col">'+(t.dueDate?'<i class="fa-regular fa-calendar"></i> '+formatDate(t.dueDate):'')+'</div>' : '') +
      (fields.createdDate ? '<div class="list-col created-date-col">'+createdDate+'</div>' : '') +
      (fields.category ? '<div class="list-col category-col">'+category+'</div>' : '') +
      '</div>';
  }

  function renderCompactListRow(t) {
    return '<div class="list-row'+(t.id===state.selectedTaskId?' active-row':'')+'" data-taskid="'+t.id+'">' +
      '<div class="list-col title-col" style="width:100%">' +
      '<div class="check-circle"><i class="fa-solid fa-check" style="font-size:10px"></i></div>' +
      (t.priority==='High'?'<span class="priority-indicator">!</span> ':'') +
      '<span class="list-task-name">'+t.title+'</span>' +
      '</div></div>';
  }

  function renderListSection(key, label, color, tasks, compact) {
    if (!tasks.length && key !== 'delayed') return '';
    let h = '<div class="list-group-header"><div class="check-circle"></div>' +
      '<div class="group-color" style="background:'+color+'"></div>'+label+
      (tasks.length?' <span class="group-task-count">'+tasks.length+'</span>':'')+
      '</div>';
    h += tasks.map(compact ? renderCompactListRow : renderListRow).join('');
    return h;
  }

  function renderListView() {
    const area = document.getElementById('listArea');
    if (!area) return;
    const isPanelOpen = !!state.selectedTaskId;
    const lh = document.getElementById('listHeader');
    if (isPanelOpen) {
      lh.classList.add('compact-header');
    } else {
      const fields = getFields('list');
      lh.innerHTML = '<div class="list-col title-col">TASK TITLE</div>' +
        (fields.assignee ? '<div class="list-col assignee-col">ASSIGNEE</div>' : '') +
        (fields.status   ? '<div class="list-col status-col">STATUS</div>' : '') +
        (fields.dueDate  ? '<div class="list-col due-date-col">DUE DATE</div>' : '') +
        (fields.createdDate ? '<div class="list-col created-date-col">CREATED DATE</div>' : '') +
        (fields.category ? '<div class="list-col category-col">CATEGORY</div>' : '');
      lh.classList.remove('compact-header');
    }

    let h = '';
    const tasks = getFilteredTasks();

    if (state.currentView === 'agenda') {
      AGENDA_SECTIONS.forEach(function(sec) {
        const ts = tasks.filter(function(t){return getDateCategory(t.dueDate)===sec.key;});
        h += renderListSection(sec.key, sec.label, sec.color, ts, isPanelOpen);
      });
    } else {
      const grouped = applyGroupBy(tasks);
      if (grouped) {
        Object.entries(grouped).forEach(function(entry) {
          const key = entry[0], ts = entry[1];
          h += renderListSection(key, key, '#3498db', ts, isPanelOpen);
        });
      } else {
        h += tasks.map(isPanelOpen ? renderCompactListRow : renderListRow).join('');
      }
    }
    area.innerHTML = h;
    bindListRowClicks();
    bindBulkCheckboxes();
  }

  function bindListRowClicks() {
    document.querySelectorAll('.list-row').forEach(function(row) {
      row.addEventListener('click', function(e) {
        if (e.target.closest('.bulk-checkbox')) return;
        showTaskDetail(parseInt(this.dataset.taskid), 'panel');
      });
    });
  }

  function bindBulkCheckboxes() {
    document.querySelectorAll('.bulk-checkbox').forEach(function(cb) {
      cb.addEventListener('change', function() {
        const id = parseInt(this.dataset.taskid);
        if (this.checked) state.selectedBulkTasks.add(id);
        else state.selectedBulkTasks.delete(id);
        updateBulkBar();
      });
    });
  }

  // ===== RENDER VIEW =====
  function renderView() {
    const vt = state.currentViewType;
    const boardArea = document.getElementById('boardArea');
    const listArea = document.getElementById('listArea');
    if (boardArea) boardArea.style.display = vt==='board' ? '' : 'none';
    if (listArea)  listArea.style.display  = vt==='list'  ? '' : 'none';
    if (vt === 'board') renderBoardView();
    else renderListView();
    updateViewHeader();
    // sync Board/List tab active state
    document.querySelectorAll('.view-tab').forEach(function(t){
      t.classList.toggle('active', t.dataset.viewtype === vt);
    });
  }

  // ===== GET FILTERED TASKS =====
  function getFilteredTasks() {
    let tasks = state.tasks.slice();

    // search
    if (state.searchQuery) {
      const q = state.searchQuery.toLowerCase();
      tasks = tasks.filter(function(t){return t.title.toLowerCase().includes(q);});
    }

    // View-level filtering (this is the core per-view logic)
    const v = state.currentView;
    if (v === 'myday') {
      const today = new Date().toISOString().split('T')[0];
      tasks = tasks.filter(function(t){return t.dueDate && t.dueDate.startsWith(today);});
    } else if (v === 'createdbyme') {
      tasks = tasks.filter(function(t){return !t.createdBy || t.createdBy === state.currentUserId;});
    } else if (v === 'assignedtome') {
      const me = state.members && state.members.find(function(m){return m.id===state.currentUserId;});
      const myName = me ? me.name : 'Pradeep';
      tasks = tasks.filter(function(t){return t.assignee && (t.assignee===myName||t.assignee===String(state.currentUserId));});
    } else if (v === 'sharedwithme') {
      tasks = tasks.filter(function(t){return t.sharedWith && t.sharedWith.includes(state.currentUserId);});
    } else if (v === 'personal') {
      tasks = tasks.filter(function(t){
        const g = state.groups.find(function(gr){return gr.id===t.group;});
        return g && g.type==='personal';
      });
    } else if (v === 'group') {
      if (state.filterGroup) tasks = tasks.filter(function(t){return t.group===state.filterGroup;});
    } else if (v === 'unified') {
      // show all tasks
    }
    // agenda: no extra filter, all tasks shown in sections

    // Tag filter (sidebar tag click)
    if (state.filterTag) {
      tasks = tasks.filter(function(t){
        if (!t.tags || !t.tags.length) return false;
        const tag = state.tags.find(function(tg){return tg.id===state.filterTag;});
        if (!tag) return false;
        return t.tags.includes(tag.name) || t.tags.includes(state.filterTag);
      });
    }

    // Filter modal filters
    if (state.filterAssignee) {
      tasks = tasks.filter(function(t){return t.assignee===state.filterAssignee;});
    }
    if (state.filterStatus) {
      tasks = tasks.filter(function(t){return t.status===state.filterStatus;});
    }
    if (state.filterPriority) {
      tasks = tasks.filter(function(t){return t.priority===state.filterPriority;});
    }
    if (state.filterCreatedBy && v==='group') {
      tasks = tasks.filter(function(t){return t.createdBy===state.filterCreatedBy;});
    }
    if (!state.filterDelayed) {
      // no filter: show all; filterDelayed=true means show ONLY delayed
    }
    if (state.filterDelayed) {
      tasks = tasks.filter(function(t){return getDateCategory(t.dueDate)==='delayed';});
    }
    if (!state.filterArchived) {
      tasks = tasks.filter(function(t){return !t.archived;});
    }

    // Subtask expansion
    const showSub = state.showAllSubtasks[v];
    if (showSub) {
      const expanded = [];
      tasks.forEach(function(t) {
        expanded.push(t);
        if (t.subtasks && t.subtasks.length) {
          t.subtasks.forEach(function(st) {
            expanded.push({
              id: t.id+'_sub_'+st.id, title: st.title, status: st.completed?'Completed':'Open',
              priority: t.priority, group: t.group, assignee: t.assignee, dueDate: t.dueDate,
              tags: t.tags, _isSubtask: true, _parentId: t.id
            });
          });
        }
      });
      tasks = expanded;
    }

    // Sort
    const sortBy = state.sortBy;
    const dir = state.sortDirection === 'asc' ? 1 : -1;
    if (v !== 'agenda' && state.groupBy !== 'group') {
      tasks.sort(function(a, b) {
        let av, bv;
        if (sortBy === 'dueDate') { av = a.dueDate||'9999'; bv = b.dueDate||'9999'; }
        else if (sortBy === 'modifiedDate') { av = a.modifiedDate||a.createdAt||''; bv = b.modifiedDate||b.createdAt||''; }
        else { av = a.createdAt||''; bv = b.createdAt||''; }
        if (av < bv) return -1 * dir;
        if (av > bv) return 1 * dir;
        return 0;
      });
    }

    return tasks;
  }

  // ===== TASK DETAIL =====
  function showTaskDetail(taskId, source) {
    const task = state.tasks.find(function(t){return t.id===taskId;});
    if(!task) return;
    state.selectedTaskId = taskId;
    state.taskDetailMode = source || 'panel';
    const mode = state.taskDetailMode;
    document.getElementById('detailTitle').textContent = task.title;
    document.getElementById('detailTitle').dataset.taskid = taskId;
    document.getElementById('detailGroup').textContent = getGroupName(task.group);
    document.getElementById('detailCategory').textContent = task.category||'';
    document.getElementById('detailAssignee').textContent = task.assignee||'Unassigned';
    document.getElementById('detailStatus').value = task.status||'Open';
    document.getElementById('detailPriority').value = task.priority||'None';
    document.getElementById('detailStartDate').textContent = task.startDate ? formatDateFull(task.startDate) : 'Set start date';
    document.getElementById('detailDueDate').textContent = task.dueDate ? formatDateFull(task.dueDate) : 'Set due date';
    document.getElementById('detailDesc').textContent = task.description||'';
    // Subtasks
    document.getElementById('subtasksList').innerHTML=(task.subtasks||[]).map(function(s){
      return '<div class="subtask-item"><input type="checkbox" '+(s.completed?'checked':'')+' data-subtaskid="'+s.id+'"> '+s.title+'</div>';
    }).join('');
    // Tags display
    let tagsHtml = '';
    if (task.tags && task.tags.length) {
      tagsHtml = '<div class="detail-tags">' + task.tags.map(function(tid) {
        const tag = state.tags.find(function(tg){return tg.name===tid||tg.id===tid;});
        return tag ? '<span class="tag-badge" style="background:'+tag.color+'">'+tag.name+'</span>' : '';
      }).join('') + '</div>';
    }
    const tagsContainer = document.getElementById('detailTagsContainer');
    if (tagsContainer) tagsContainer.innerHTML = tagsHtml;
    // Recurrence display
    const recurrenceDisplay = task.recurrence ? task.recurrence.type : '';
    const recurEl = document.getElementById('detailRecurrence');
    if (recurEl && recurrenceDisplay) { recurEl.textContent = recurrenceDisplay; }
    // Reminder display
    const reminderDisplay = task.reminder ? formatDate(task.reminder.date)+' '+(task.reminder.time||'') : '';
    const reminderEl = document.getElementById('detailReminder');
    if (reminderEl && reminderDisplay) { reminderEl.textContent = reminderDisplay; }
    // Attachments display
    const attachSection = document.getElementById('detailAttachments');
    if (attachSection) {
      attachSection.innerHTML = task.attachments && task.attachments.length ?
        task.attachments.map(function(a, i) {
          return '<div class="attachment-item"><i class="fa-solid fa-paperclip"></i> '+a.name+
            ' <button class="del-attach-btn" data-idx="'+i+'"><i class="fa-solid fa-xmark"></i></button></div>';
        }).join('') : '';
    }
    // Timeline
    renderTimeline(task);
    // Show panel
    const panel = document.getElementById('taskDetailPanel');
    const modal = document.getElementById('taskDetailModal');
    if (mode === 'modal') {
      if (modal) { modal.style.display='flex'; }
    } else {
      panel.classList.add('panel-mode');
      panel.style.display='block';
      renderListView();
    }
  }

  function renderTimeline(task) {
    const entries = [];
    if (task.activity && task.activity.length) {
      task.activity.forEach(function(a) { entries.push(a); });
    }
    document.getElementById('timelineList').innerHTML = entries.map(function(e) {
      return '<div class="timeline-item"><span class="timeline-user">'+e.user+'</span> '+e.action+
        ' <span class="timeline-date">'+formatDate(e.date)+'</span></div>';
    }).join('');
  }

  function addTimelineEntry(task, action) {
    if (!task.activity) task.activity = [];
    task.activity.push({user: 'Pradeep', action: action, date: new Date().toISOString()});
  }

  function hideTaskDetail() {
    state.selectedTaskId = null;
    const panel = document.getElementById('taskDetailPanel');
    const modal = document.getElementById('taskDetailModal');
    panel.classList.remove('modal-mode','panel-mode');
    panel.style.display='none';
    if (modal) modal.style.display='none';
  }

  // ===== DYNAMIC CATEGORY UPDATES =====
  function updateCategorySelect(groupId, selectEl) {
    if (!selectEl) return;
    const g = getGroupById(groupId);
    const cats = g && g.categories ? g.categories : [];
    selectEl.innerHTML = '<option value="">-- Category --</option>' +
      cats.map(function(c){return '<option value="'+c+'">'+c+'</option>';}).join('');
  }

  // ===== RECURRENCE MODAL =====
  function showRecurrenceModal(callback) {
    let modal = document.getElementById('recurrenceModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'recurrenceModal';
      modal.className = 'modal-overlay';
      modal.innerHTML = '<div class="modal-content small-modal"><h3>Set Recurrence</h3>' +
        '<div style="margin:12px 0"><label>Type: </label><select id="recurrenceType" class="meta-select" style="width:auto"><option value="">None</option><option value="Daily">Daily</option><option value="Weekly">Weekly</option><option value="Monthly">Monthly</option><option value="Yearly">Yearly</option></select></div>' +
        '<div style="margin:12px 0"><button class="btn-primary" id="recurrenceSave">Save</button> <button class="btn-secondary" id="recurrenceCancel">Cancel</button></div>' +
        '</div>';
      document.body.appendChild(modal);
    }
    modal.style.display = 'flex';
    document.getElementById('recurrenceSave').onclick = function() {
      const t = document.getElementById('recurrenceType').value;
      modal.style.display='none';
      if (callback) callback(t ? {type:t} : null);
    };
    document.getElementById('recurrenceCancel').onclick = function() { modal.style.display='none'; };
  }

  // ===== REMINDER MODAL =====
  function showReminderModal(current, callback) {
    let modal = document.getElementById('reminderModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'reminderModal';
      modal.className = 'modal-overlay';
      modal.innerHTML = '<div class="modal-content small-modal"><h3>Set Reminder</h3>' +
        '<div style="margin:12px 0"><label>Date: </label><input type="date" id="reminderDate" class="meta-select"></div>' +
        '<div style="margin:12px 0"><label>Time: </label><input type="time" id="reminderTime" class="meta-select"></div>' +
        '<div style="margin:12px 0"><button class="btn-primary" id="reminderSave">Save</button> <button class="btn-secondary" id="reminderClear">Clear</button> <button class="btn-secondary" id="reminderCancel">Cancel</button></div>' +
        '</div>';
      document.body.appendChild(modal);
    }
    if (current) {
      document.getElementById('reminderDate').value = toInputDate(current.date)||'';
      document.getElementById('reminderTime').value = current.time||'';
    }
    modal.style.display = 'flex';
    document.getElementById('reminderSave').onclick = function() {
      const d = document.getElementById('reminderDate').value;
      const t = document.getElementById('reminderTime').value;
      modal.style.display='none';
      if (callback) callback(d ? {date:d, time:t} : null);
    };
    document.getElementById('reminderClear').onclick = function() { modal.style.display='none'; if (callback) callback(null); };
    document.getElementById('reminderCancel').onclick = function() { modal.style.display='none'; };
  }

  // ===== TAGS PICKER =====
  function showTagsPicker(currentTags, callback) {
    let modal = document.getElementById('tagsPickerModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'tagsPickerModal';
      modal.className = 'modal-overlay';
      document.body.appendChild(modal);
    }
    const selected = currentTags ? currentTags.slice() : [];
    modal.innerHTML = '<div class="modal-content small-modal"><h3>Select Tags</h3>' +
      '<div id="tagsPickerList" style="display:flex;flex-wrap:wrap;gap:8px;margin:12px 0">' +
      state.tags.map(function(t){
        const isSel = selected.includes(t.name)||selected.includes(t.id);
        return '<span class="tag-badge tag-picker-item'+(isSel?' selected':'')+'" style="background:'+t.color+';cursor:pointer" data-tagname="'+t.name+'">'+t.name+'</span>';
      }).join('') + '</div>' +
      '<button class="btn-primary" id="tagsPickerSave">Done</button> <button class="btn-secondary" id="tagsPickerCancel">Cancel</button>' +
      '</div>';
    modal.style.display = 'flex';
    modal.querySelectorAll('.tag-picker-item').forEach(function(el) {
      el.addEventListener('click', function() {
        const n = this.dataset.tagname;
        if (selected.includes(n)) { selected.splice(selected.indexOf(n),1); this.classList.remove('selected'); }
        else { selected.push(n); this.classList.add('selected'); }
      });
    });
    document.getElementById('tagsPickerSave').onclick = function() { modal.style.display='none'; if (callback) callback(selected); };
    document.getElementById('tagsPickerCancel').onclick = function() { modal.style.display='none'; };
  }

  // ===== COPY/MOVE MODAL =====
  function showCopyMoveModal(taskId, action) {
    const task = state.tasks.find(function(t){return t.id===taskId;});
    if (!task) return;
    let modal = document.getElementById('copyMoveModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'copyMoveModal';
      modal.className = 'modal-overlay';
      document.body.appendChild(modal);
    }
    modal.innerHTML = '<div class="modal-content small-modal"><h3>'+(action==='copy'?'Copy':'Move')+' Task</h3>' +
      '<div style="margin:12px 0"><label>To Group: </label><select id="copyMoveGroup" class="meta-select">'+
      state.groups.filter(function(g){return g.type!=='personal';}).map(function(g){return '<option value="'+g.id+'">'+g.name+'</option>';}).join('')+'</select></div>' +
      '<button class="btn-primary" id="copyMoveSave">'+(action==='copy'?'Copy':'Move')+'</button> <button class="btn-secondary" id="copyMoveCancel">Cancel</button>' +
      '</div>';
    modal.style.display = 'flex';
    document.getElementById('copyMoveSave').onclick = async function() {
      const newGroupId = parseInt(document.getElementById('copyMoveGroup').value);
      const newGroup = getGroupById(newGroupId);
      modal.style.display='none';
      if (action === 'copy') {
        const copy = Object.assign({}, task);
        delete copy.id;
        copy.group = newGroupId;
        addTimelineEntry(copy, 'copied task to ' + (newGroup?newGroup.name:'group'));
        await ShadowDB.Tasks.create(copy);
      } else {
        task.group = newGroupId;
        addTimelineEntry(task, 'moved task to ' + (newGroup?newGroup.name:'group'));
        await ShadowDB.Tasks.update(task);
      }
      const all = await ShadowDB.Tasks.getAll();
      state.tasks = all;
      hideTaskDetail();
      renderSidebar();
      renderView();
    };
    document.getElementById('copyMoveCancel').onclick = function() { modal.style.display='none'; };
  }

  // ===== DELETE / ARCHIVE TASK =====
  async function deleteTask(taskId) {
    if (!confirm('Delete this task?')) return;
    await ShadowDB.Tasks.delete(taskId);
    state.tasks = state.tasks.filter(function(t){return t.id!==taskId;});
    hideTaskDetail();
    renderSidebar();
    renderView();
  }

  async function archiveTask(taskId) {
    const task = state.tasks.find(function(t){return t.id===taskId;});
    if (!task) return;
    task.archived = true;
    addTimelineEntry(task, 'archived this task');
    await ShadowDB.Tasks.update(task);
    state.tasks = await ShadowDB.Tasks.getAll();
    hideTaskDetail();
    renderSidebar();
    renderView();
  }

  // ===== MORE ACTIONS MENU (Detail Panel) =====
  function showDetailMoreMenu(e) {
    let menu = document.getElementById('detailMoreMenu');
    if (!menu) {
      menu = document.createElement('div');
      menu.id = 'detailMoreMenu';
      menu.className = 'context-menu';
      document.body.appendChild(menu);
    }
    menu.innerHTML =
      '<div class="dropdown-item" data-action="copy"><i class="fa-regular fa-copy"></i> Copy Task</div>' +
      '<div class="dropdown-item" data-action="move"><i class="fa-solid fa-arrow-right"></i> Move Task</div>' +
      '<div class="dropdown-item" data-action="archive"><i class="fa-solid fa-box-archive"></i> Archive Task</div>' +
      '<div class="dropdown-item" data-action="delete" style="color:#e74c3c"><i class="fa-solid fa-trash"></i> Delete Task</div>' +
      '<div class="dropdown-divider"></div>' +
      '<div class="dropdown-item" data-action="permalink"><i class="fa-solid fa-link"></i> Copy permalink</div>';
    const rect = e.target.getBoundingClientRect();
    menu.style.left = rect.left+'px';
    menu.style.top = (rect.bottom+4)+'px';
    menu.style.display = 'block';
    menu.onclick = function(ev) {
      const item = ev.target.closest('.dropdown-item');
      if (!item) return;
      const action = item.dataset.action;
      menu.style.display='none';
      const tid = state.selectedTaskId;
      if (action==='delete') deleteTask(tid);
      else if (action==='archive') archiveTask(tid);
      else if (action==='copy') showCopyMoveModal(tid,'copy');
      else if (action==='move') showCopyMoveModal(tid,'move');
      else if (action==='permalink') {
        navigator.clipboard.writeText(window.location.href+'#task-'+tid).catch(function(){});
        alert('Permalink copied to clipboard!');
      }
    };
    setTimeout(function(){
      document.addEventListener('click', function hideMenu(ev) {
        if (!menu.contains(ev.target)) { menu.style.display='none'; document.removeEventListener('click',hideMenu); }
      });
    }, 10);
  }

  // ===== FILTER MODAL (Zoho spec) =====
  function showFilterModal() {
    let modal = document.getElementById('filterModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'filterModal';
      modal.className = 'modal-overlay';
      document.body.appendChild(modal);
    }
    const v = state.currentView;
    const isGroupView = v === 'group';
    // Assignee options
    const assigneeOptions = '<option value="">All Assignees</option>' +
      [...new Set(state.tasks.map(function(t){return t.assignee;}).filter(Boolean))].map(function(a){
        return '<option value="'+a+'"'+(state.filterAssignee===a?' selected':'')+'>'+a+'</option>';
      }).join('');
    // Created by options (groups only)
    const createdByHtml = isGroupView ? '<div style="margin:12px 0"><label>Created by: </label><select id="filterCreatedBy" class="meta-select" style="width:auto">' +
      '<option value="">All</option>' +
      [...new Set(state.tasks.map(function(t){return t.assignee;}).filter(Boolean))].map(function(a){
        return '<option value="'+a+'"'+(state.filterCreatedBy===a?' selected':'')+'>'+a+'</option>';
      }).join('') + '</select></div>' : '';
    // Status options
    const statusOptions = '<option value="">All Status</option>' +
      ['Open','In Progress','Fixed','Completed','Closed'].map(function(s){
        return '<option value="'+s+'"'+(state.filterStatus===s?' selected':'')+'>'+s+'</option>';
      }).join('');
    // Priority options
    const priorityOptions = '<option value="">All Priorities</option>' +
      ['High','Medium','Low','None'].map(function(p){
        return '<option value="'+p+'"'+(state.filterPriority===p?' selected':'')+'>'+p+'</option>';
      }).join('');

    modal.innerHTML = '<div class="modal-content small-modal">' +
      '<h3>Filter Tasks</h3>' +
      '<div style="margin:12px 0"><label>Assignee: </label><select id="filterAssigneeSelect" class="meta-select" style="width:auto">'+assigneeOptions+'</select></div>' +
      createdByHtml +
      '<div style="margin:12px 0"><label>Status: </label><select id="filterStatusSelect" class="meta-select" style="width:auto">'+statusOptions+'</select></div>' +
      '<div style="margin:12px 0"><label>Priority: </label><select id="filterPrioritySelect" class="meta-select" style="width:auto">'+priorityOptions+'</select></div>' +
      '<div style="margin:12px 0;display:flex;gap:16px;align-items:center">' +
        '<label><input type="checkbox" id="filterDelayedChk"'+(state.filterDelayed?' checked':'')+'>  Show Delayed only</label>' +
        '<label><input type="checkbox" id="filterArchivedChk"'+(state.filterArchived?' checked':'')+'>  Show Archived</label>' +
      '</div>' +
      '<div style="margin-top:16px"><button class="btn-primary" id="applyFilterBtn">Apply</button> ' +
      '<button class="btn-secondary" id="clearFilterBtn">Clear</button> ' +
      '<button class="btn-secondary" id="cancelFilterBtn">Cancel</button></div>' +
      '</div>';
    modal.style.display = 'flex';

    document.getElementById('applyFilterBtn').onclick = function() {
      state.filterAssignee  = document.getElementById('filterAssigneeSelect').value || null;
      state.filterStatus    = document.getElementById('filterStatusSelect').value || null;
      state.filterPriority  = document.getElementById('filterPrioritySelect').value || null;
      state.filterDelayed   = document.getElementById('filterDelayedChk').checked;
      state.filterArchived  = document.getElementById('filterArchivedChk').checked;
      if (isGroupView) state.filterCreatedBy = document.getElementById('filterCreatedBy').value || null;
      modal.style.display='none';
      renderSidebar();
      renderView();
    };
    document.getElementById('clearFilterBtn').onclick = function() {
      state.filterAssignee=null; state.filterCreatedBy=null; state.filterStatus=null;
      state.filterPriority=null; state.filterDelayed=false; state.filterArchived=false;
      modal.style.display='none';
      renderSidebar();
      renderView();
    };
    document.getElementById('cancelFilterBtn').onclick = function() { modal.style.display='none'; };
  }

  // ===== SORT DROPDOWN (Zoho spec) =====
  function showSortDropdown() {
    let menu = document.getElementById('sortDropdown');
    if (!menu) {
      menu = document.createElement('div');
      menu.id = 'sortDropdown';
      menu.className = 'dropdown-menu';
      document.body.appendChild(menu);
    }
    const opts = getSortOptions();
    const dirLabel = state.sortDirection==='asc' ? 'Oldest on top' : 'Newest on top';
    menu.innerHTML = '<div class="dropdown-title">Sort by</div>' +
      opts.map(function(o){
        return '<div class="dropdown-item'+(state.sortBy===o.key?' active':'')+'" data-sort="'+o.key+'">'+o.label+'</div>';
      }).join('') +
      (opts.length ? '<div class="dropdown-divider"></div>' +
        '<div class="dropdown-item" data-dir="desc">'+(state.sortDirection==='desc'?'<i class="fa-solid fa-check"></i> ':'')+' Newest on top</div>' +
        '<div class="dropdown-item" data-dir="asc">'+(state.sortDirection==='asc'?'<i class="fa-solid fa-check"></i> ':'')+' Oldest on top</div>' : '');
    const btn = document.getElementById('sortBtn');
    const rect = btn.getBoundingClientRect();
    menu.style.left = rect.left+'px';
    menu.style.top = (rect.bottom+4)+'px';
    menu.style.display = 'block';
    menu.onclick = function(ev) {
      const item = ev.target.closest('.dropdown-item');
      if (!item) return;
      if (item.dataset.sort) { state.sortBy = item.dataset.sort; }
      if (item.dataset.dir)  { state.sortDirection = item.dataset.dir; }
      menu.style.display='none';
      updateViewHeader();
      renderView();
    };
    setTimeout(function(){
      document.addEventListener('click', function hide(ev) {
        if (!menu.contains(ev.target) && ev.target.id!=='sortBtn') { menu.style.display='none'; document.removeEventListener('click',hide); }
      });
    }, 10);
  }

  // ===== GROUP BY DROPDOWN =====
  function showGroupByDropdown() {
    let menu = document.getElementById('groupByDropdown');
    if (!menu) {
      menu = document.createElement('div');
      menu.id = 'groupByDropdown';
      menu.className = 'dropdown-menu';
      document.body.appendChild(menu);
    }
    const opts = getGroupByOptions();
    menu.innerHTML = '<div class="dropdown-title">Group by</div>' +
      '<div class="dropdown-item'+(state.groupBy===null?' active':'')+'" data-groupby="">None</div>' +
      opts.map(function(o){
        return '<div class="dropdown-item'+(state.groupBy===o.key?' active':'')+'" data-groupby="'+o.key+'">'+o.label+'</div>';
      }).join('');
    const btn = document.getElementById('groupByBtn');
    const rect = btn.getBoundingClientRect();
    menu.style.left = rect.left+'px';
    menu.style.top = (rect.bottom+4)+'px';
    menu.style.display = 'block';
    menu.onclick = function(ev) {
      const item = ev.target.closest('.dropdown-item');
      if (!item) return;
      const val = item.dataset.groupby;
      state.groupBy = val || null;
      // When groupBy changes, reset sort if incompatible
      if (state.groupBy === 'group') state.sortBy = 'dueDate';
      else {
        const valid = getSortOptions().map(function(o){return o.key;});
        if (!valid.includes(state.sortBy) && valid.length) state.sortBy = valid[0];
      }
      menu.style.display='none';
      updateViewHeader();
      renderView();
    };
    setTimeout(function(){
      document.addEventListener('click', function hide(ev) {
        if (!menu.contains(ev.target) && ev.target.id!=='groupByBtn') { menu.style.display='none'; document.removeEventListener('click',hide); }
      });
    }, 10);
  }

  // ===== MANAGE FIELDS DROPDOWN =====
  function showManageFieldsDropdown() {
    let menu = document.getElementById('manageFieldsDropdown');
    if (!menu) {
      menu = document.createElement('div');
      menu.id = 'manageFieldsDropdown';
      menu.className = 'dropdown-menu manage-fields-menu';
      document.body.appendChild(menu);
    }
    const vt = state.currentViewType;
    const fields = getFields(vt);
    const fieldList = vt === 'list'
      ? [{key:'assignee',label:'Assignee'},{key:'status',label:'Status'},{key:'dueDate',label:'Due Date'},
         {key:'createdDate',label:'Created Date'},{key:'category',label:'Category'},{key:'tags',label:'Tags'},{key:'subtasks',label:'Subtasks'}]
      : [{key:'assignee',label:'Assignee'},{key:'status',label:'Status'},{key:'dueDate',label:'Due Date'},
         {key:'tags',label:'Tags'},{key:'subtasks',label:'Subtasks'}];
    menu.innerHTML = '<div class="dropdown-title">Manage Fields</div>' +
      fieldList.map(function(f){
        return '<div class="dropdown-item manage-field-item" data-field="'+f.key+'">' +
          '<input type="checkbox" '+(fields[f.key]!==false?'checked':'')+' style="pointer-events:none"> '+f.label+'</div>';
      }).join('') +
      '<div class="dropdown-divider"></div>' +
      '<div class="dropdown-item" id="showAllSubtasksToggle">' +
        '<input type="checkbox" '+(state.showAllSubtasks[state.currentView]?'checked':'')+' style="pointer-events:none"> Show all Subtasks</div>';
    const btn = document.getElementById('manageFieldsBtn');
    const rect = btn.getBoundingClientRect();
    menu.style.left = (rect.right - 220)+'px';
    menu.style.top = (rect.bottom+4)+'px';
    menu.style.display = 'block';
    menu.querySelectorAll('.manage-field-item').forEach(function(item) {
      item.addEventListener('click', function() {
        const f = this.dataset.field;
        fields[f] = !fields[f];
        const cb = this.querySelector('input[type=checkbox]');
        if (cb) cb.checked = fields[f];
        renderView();
      });
    });
    document.getElementById('showAllSubtasksToggle').addEventListener('click', function() {
      state.showAllSubtasks[state.currentView] = !state.showAllSubtasks[state.currentView];
      const cb = this.querySelector('input[type=checkbox]');
      if (cb) cb.checked = state.showAllSubtasks[state.currentView];
      renderView();
    });
    setTimeout(function(){
      document.addEventListener('click', function hide(ev) {
        if (!menu.contains(ev.target) && ev.target.id!=='manageFieldsBtn') { menu.style.display='none'; document.removeEventListener('click',hide); }
      });
    }, 10);
  }

  // ===== BULK ACTIONS =====
  function updateBulkBar() {
    let bar = document.getElementById('bulkActionBar');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'bulkActionBar';
      bar.className = 'bulk-bar';
      bar.innerHTML = '<span id="bulkCount"></span>' +
        '<button class="toolbar-btn bulk-btn" data-action="status">Status</button>' +
        '<button class="toolbar-btn bulk-btn" data-action="priority">Priority</button>' +
        '<button class="toolbar-btn bulk-btn" data-action="delete" style="color:#e74c3c">Delete</button>';
      document.body.appendChild(bar);
      bar.addEventListener('click', handleBulkAction);
    }
    if (state.selectedBulkTasks.size > 0) {
      bar.style.display='flex';
      document.getElementById('bulkCount').textContent = state.selectedBulkTasks.size + ' selected';
    } else {
      bar.style.display='none';
    }
  }

  async function handleBulkAction(e) {
    const btn = e.target.closest('.bulk-btn');
    if (!btn) return;
    const action = btn.dataset.action;
    const ids = [...state.selectedBulkTasks];
    if (action === 'delete') {
      if (!confirm('Delete ' + ids.length + ' tasks?')) return;
      for (const id of ids) await ShadowDB.Tasks.delete(id);
    } else if (action === 'status') {
      const ns = prompt('New status (Open / In Progress / Fixed / Completed / Closed):');
      if (!ns) return;
      for (const id of ids) {
        const t = state.tasks.find(function(t){return t.id===id;});
        if (t) { t.status=ns; t.modifiedDate=new Date().toISOString(); await ShadowDB.Tasks.update(t); }
      }
    } else if (action === 'priority') {
      const np = prompt('New priority (High / Medium / Low / None):');
      if (!np) return;
      for (const id of ids) {
        const t = state.tasks.find(function(t){return t.id===id;});
        if (t) { t.priority=np; t.modifiedDate=new Date().toISOString(); await ShadowDB.Tasks.update(t); }
      }
    }
    state.selectedBulkTasks.clear();
    state.tasks = await ShadowDB.Tasks.getAll();
    updateBulkBar();
    renderSidebar();
    renderView();
  }

  // ===== MODAL SUBTASKS =====
  function renderModalSubtasks() {
    const list = document.getElementById('modalSubtasksList');
    if (list) {
      list.innerHTML = state.modalSubtasks.map(function(s, i) {
        return '<div class="subtask-item"><i class="fa-regular fa-square"></i> '+s.title+' <i class="fa-solid fa-xmark" data-idx="'+i+'" style="cursor:pointer;margin-left:8px"></i></div>';
      }).join('');
      list.querySelectorAll('.fa-xmark').forEach(function(el) {
        el.addEventListener('click', function() {
          state.modalSubtasks.splice(parseInt(this.dataset.idx), 1);
          renderModalSubtasks();
        });
      });
    }
  }

  function renderModalTags() {
    const container = document.getElementById('modalTagsContainer');
    if (!container) return;
    container.innerHTML = state.modalTags.map(function(name) {
      const tag = state.tags.find(function(t){return t.name===name;});
      return tag ? '<span class="tag-badge" style="background:'+tag.color+'">'+tag.name+' <i class="fa-solid fa-xmark" data-tagname="'+name+'" style="cursor:pointer"></i></span>' : '';
    }).join('');
    container.querySelectorAll('.fa-xmark').forEach(function(el) {
      el.addEventListener('click', function() {
        state.modalTags = state.modalTags.filter(function(n){return n!==this.dataset.tagname;}.bind(this));
        renderModalTags();
      });
    });
  }

  function updateGroupSelects() {
    const groupOpts = state.groups.filter(function(g){return g.type!=='personal';}).map(function(g){
      return '<option value="'+g.id+'">'+g.name+'</option>';
    }).join('');
    ['modalGroup','detailGroupSelect'].forEach(function(id){
      const el = document.getElementById(id);
      if (el) el.innerHTML = groupOpts;
    });
  }

  function handleAttachment(callback) {
    const inp = document.createElement('input');
    inp.type='file'; inp.multiple=true;
    inp.onchange = function() {
      const files = [...this.files].map(function(f){return {name:f.name, size:f.size, type:f.type};});
      if (callback) callback(files);
    };
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
      state.currentViewType = this.dataset.viewtype;
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

  // More actions button (now shows Group By)
  document.getElementById('moreActionsBtn').addEventListener('click', function(e) {
    e.stopPropagation();
    showGroupByDropdown();
  });

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
      document.getElementById('modalStatus').value='Open';
      document.getElementById('modalPriority').value='None';
      document.getElementById('modalDueDate').value='';
      const startEl = document.getElementById('modalStartDate');
      if (startEl) startEl.value='';
      renderModalSubtasks();
      renderModalTags();
      updateCategorySelect(parseInt(document.getElementById('modalGroup').value), document.getElementById('modalCategory'));
      document.getElementById('modalTaskTitle').focus();
    }
  });

  // Group change -> Update category
  const modalGroupEl = document.getElementById('modalGroup');
  if (modalGroupEl) {
    modalGroupEl.addEventListener('change', function() {
      updateCategorySelect(parseInt(this.value), document.getElementById('modalCategory'));
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
        status: document.getElementById('modalStatus').value,
        priority: document.getElementById('modalPriority').value,
        group: parseInt(document.getElementById('modalGroup').value) || null,
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
        ShadowDB.Tasks.update(task).then(function(){ renderView(); showTaskDetail(state.selectedTaskId, state.taskDetailMode); });
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
      const stId = parseInt(cb.dataset.subtaskid);
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
  async function init() {
    await ShadowDB.init();
    state.tasks = await ShadowDB.Tasks.getAll();
    state.groups = await ShadowDB.Groups.getAll();
    state.tags = await ShadowDB.Tags.getAll();
    try { state.members = await ShadowDB.Members.getAll(); } catch(e){ state.members=[]; }
    dbReady = true;
    updateGroupSelects();
    renderSidebar();
    // Set initial active nav
    document.querySelectorAll('.nav-item').forEach(function(n){
      n.classList.toggle('active', n.dataset.view === state.currentView);
    });
    updateViewHeader();
    renderView();
  }

  init().catch(function(err){ console.error('Init error:', err); });

})();
