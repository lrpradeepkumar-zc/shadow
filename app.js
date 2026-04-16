// Shadow ToDo - Application Logic (ShadowDB Backend Integration)
// UPDATED: Full Zoho ToDo feature parity - Create Task & Manage Tasks
(function() {
  'use strict';

  let state = {
    tasks: [], groups: [], tags: [],
    currentView: 'agenda',
    currentViewType: 'board',
    selectedTaskId: null,
    taskDetailMode: null,
    sortBy: 'dueDate', sortDirection: 'desc', searchQuery: '',
    filterGroup: null,
    filterTag: null,
    modalSubtasks: [],
    modalTags: [],
    selectedBulkTasks: new Set()
  };

  let dbReady = false;

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
    const d=new Date(ds),now=new Date(),today=new Date(now.getFullYear(),now.getMonth(),now.getDate()),
      td=new Date(d.getFullYear(),d.getMonth(),d.getDate()),diff=td-today,day=86400000;
    if(diff<0) return 'delayed';
    if(diff===0) return 'today';
    if(diff<=7*day) return 'thisweek';
    return 'thismonth';
  }
  function statusClass(s) { return s.toLowerCase().replace(/\s+/g,'-'); }
  function getGroupName(id) { const g=state.groups.find(g=>g.id===id); return g?g.name:'Personal tasks'; }
  function getGroupById(id) { return state.groups.find(g=>g.id===id); }

  // ===== SIDEBAR =====
  function renderSidebar() {
    document.getElementById('groupsList').innerHTML = state.groups.filter(g=>g.type!=='personal').map(g=>{
      const c=state.tasks.filter(t=>t.group===g.id).length;
      const active = state.filterGroup === g.id ? ' active' : '';
      return '<div class="group-item'+active+'" data-group="'+g.id+'"><i class="fa-solid fa-chevron-right" style="font-size:10px"></i> '+g.name+(c?'<span class="count">'+c+'</span>':'')+'</div>';
    }).join('');
    document.getElementById('tagsList').innerHTML = state.tags.map(t=>{
      const active = state.filterTag === t.id ? ' active' : '';
      return '<div class="tag-item'+active+'" data-tag="'+t.id+'"><span class="tag-dot" style="background:'+t.color+'"></span> '+t.name+'</div>';
    }).join('');
    document.getElementById('personalCount').textContent = state.tasks.filter(t=>{
      const g=state.groups.find(gr=>gr.id===t.group);
      return g&&g.type==='personal';
    }).length;
    // Re-bind group clicks
    document.querySelectorAll('.group-item').forEach(function(el) {
      el.addEventListener('click', function() {
        const gid = parseInt(this.dataset.group);
        state.filterGroup = state.filterGroup === gid ? null : gid;
        state.filterTag = null;
        state.currentView = 'group';
        document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
        renderSidebar();
        document.getElementById('viewTitle').textContent = getGroupName(gid);
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
        const tid = parseInt(this.dataset.tag);
        state.filterTag = state.filterTag === tid ? null : tid;
        state.filterGroup = null;
        state.currentView = 'tag';
        document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
        renderSidebar();
        const tag = state.tags.find(t=>t.id===tid);
        document.getElementById('viewTitle').textContent = tag ? tag.name : 'Tags';
        renderView();
      });
    });
  }

  // ===== GROUP CONTEXT MENU =====
  function showGroupContextMenu(e, groupId) {
    let menu = document.getElementById('groupContextMenu');
    if (!menu) {
      menu = document.createElement('div');
      menu.id = 'groupContextMenu';
      menu.className = 'dropdown-menu';
      document.body.appendChild(menu);
    }
    menu.innerHTML = '<div class="dropdown-item" data-action="addCategory">Add Category</div>' +
      '<div class="dropdown-item" data-action="deleteGroup">Delete Group</div>';
    menu.style.display = '';
    menu.style.top = e.clientY + 'px';
    menu.style.left = e.clientX + 'px';
    menu.style.position = 'fixed';
    menu.style.zIndex = '10000';
    menu.onclick = function(ev) {
      const item = ev.target.closest('.dropdown-item');
      if (!item) return;
      const action = item.dataset.action;
      if (action === 'addCategory') {
        const name = prompt('Enter category name:');
        if (name && name.trim()) {
          const g = state.groups.find(gr=>gr.id===groupId);
          if (g) {
            if (!g.categories) g.categories = ['General'];
            g.categories.push(name.trim());
            ShadowDB.Groups.update(g).then(()=>{ state.groups = state.groups.map(x=>x.id===g.id?g:x); renderSidebar(); });
          }
        }
      } else if (action === 'deleteGroup') {
        if (confirm('Delete this group?')) {
          ShadowDB.Groups.delete(groupId).then(async ()=>{ state.groups = await ShadowDB.Groups.getAll(); renderSidebar(); renderView(); });
        }
      }
      menu.style.display = 'none';
    };
    setTimeout(()=>{
      document.addEventListener('click', function hide() { menu.style.display = 'none'; document.removeEventListener('click', hide); });
    }, 10);
  }

  // ===== TASK CARD (Board View) =====
  function renderTaskCard(t) {
    const dt=t.dueDate?'<div class="task-card-date '+(isOverdue(t.dueDate)?'overdue':'')+'"><i class="fa-regular fa-calendar"></i> '+formatDate(t.dueDate)+'</div>':'';
    const st=t.subtasks&&t.subtasks.length?'<div class="task-card-subtasks"><i class="fa-regular fa-square-check"></i> '+t.subtasks.filter(s=>s.done).length+'/'+t.subtasks.length+'</div>':'';
    const tagHtml = (t.tags && t.tags.length) ? '<div class="task-card-tags">' + t.tags.map(tid => {
      const tag = state.tags.find(tg => tg.id === tid || tg.name === tid);
      return tag ? '<span class="task-tag" style="background:'+tag.color+'">'+tag.name+'</span>' : '';
    }).join('') + '</div>' : '';
    return '<div class="task-card" data-taskid="'+t.id+'"><div class="task-card-title">'+(t.priority==='High'?'<span class="priority-indicator">!</span> ':'')+t.title+'</div><div class="task-card-meta"><span class="task-card-status '+statusClass(t.status)+'">'+t.status+'</span>'+(t.assignee?'<span class="task-card-assignee"><span class="avatar-sm" style="width:20px;height:20px;font-size:10px">'+t.assignee.charAt(0)+'</span> '+t.assignee+'</span>':'')+'</div>'+tagHtml+st+dt+'</div>';
  }

  // ===== BOARD VIEW =====
  function renderBoardView() {
    const cols=document.getElementById('boardColumns');
    let tasks=getFilteredTasks();
    if (state.currentView==='agenda') {
      const cats={delayed:{label:'Delayed',class:'delayed',tasks:[]},today:{label:'Today',class:'today',tasks:[]},thisweek:{label:'This week',class:'thisweek',tasks:[]},thismonth:{label:'This month',class:'thismonth',tasks:[]}};
      tasks.forEach(t=>{const c=getDateCategory(t.dueDate);if(cats[c])cats[c].tasks.push(t);});
      cols.innerHTML=Object.values(cats).map(c=>'<div class="board-column"><div class="column-header '+c.class+'">'+c.label+(c.tasks.length?' <span class="column-count">'+c.tasks.length+'</span>':'')+'</div><div class="column-body">'+c.tasks.map(t=>renderTaskCard(t)).join('')+'</div></div>').join('');
    } else {
      const gr={};
      tasks.forEach(t=>{const n=getGroupName(t.group);if(!gr[n])gr[n]=[];gr[n].push(t);});
      cols.innerHTML=Object.entries(gr).map(([n,ts])=>'<div class="board-column"><div class="column-header">'+n+' <span class="column-count">'+ts.length+'</span></div><div class="column-body">'+ts.map(t=>renderTaskCard(t)).join('')+'</div></div>').join('');
    }
  }

  // ===== LIST VIEW =====
  function renderListRow(t) {
    var metaCounts = '';
    var hasMeta = false;
    if (t.subtasks && t.subtasks.length) {
      metaCounts += '<span class="list-meta-count"><i class="fa-solid fa-list-check"></i> '+t.subtasks.length+'</span>';
      hasMeta = true;
    }
    var metaHtml = hasMeta ? '<div class="list-meta-counts">'+metaCounts+'</div>' : '';
    var createdDate = t.createdAt ? formatDateFull(t.createdAt) : '';
    var category = t.category || 'General';
    var checked = state.selectedBulkTasks.has(t.id) ? ' checked' : '';
    return '<div class="list-row" data-taskid="'+t.id+'">' +
      '<div class="list-col title-col">' +
      '<input type="checkbox" class="bulk-checkbox" data-taskid="'+t.id+'"'+checked+'>' +
      '<div class="check-circle"><i class="fa-solid fa-check" style="font-size:10px"></i></div>' +
      (t.priority==='High'?'<span class="priority-indicator">!</span> ':'') +
      '<span class="list-task-name">'+t.title+'</span>' +
      metaHtml +
      '</div>' +
      '<div class="list-col assignee-col">' +
      (t.assignee?'<span class="avatar-sm" style="width:24px;height:24px;font-size:10px">'+t.assignee.charAt(0)+'</span> '+t.assignee:'') +
      '</div>' +
      '<div class="list-col status-col"><span class="status-badge '+statusClass(t.status)+'">'+t.status+'</span></div>' +
      '<div class="list-col due-date-col">' +
      (t.dueDate?'<i class="fa-regular fa-calendar"></i> '+formatDate(t.dueDate):'') +
      '</div>' +
      '<div class="list-col created-date-col">'+createdDate+'</div>' +
      '<div class="list-col category-col">'+category+'</div>' +
      '</div>';
  }

  function renderCompactListRow(t) {
    return '<div class="list-row' + (t.id === state.selectedTaskId ? ' active-row' : '') + '" data-taskid="'+t.id+'">' +
      '<div class="list-col title-col" style="width:100%">' +
      '<div class="check-circle"><i class="fa-solid fa-check" style="font-size:10px"></i></div>' +
      (t.priority==='High'?'<span class="priority-indicator">!</span> ':'') +
      '<span class="list-task-name">'+t.title+'</span>' +
      '</div></div>';
  }

  function renderListView() {
    var lb=document.getElementById('listBody');
    var lh=document.getElementById('listHeader');
    var tasks=getFilteredTasks();
    var isPanelOpen = state.taskDetailMode === 'panel' && state.selectedTaskId;
    if (isPanelOpen) {
      lh.innerHTML = '<div class="list-col title-col" style="width:100%">TASK TITLE</div>';
      lh.classList.add('compact-header');
    } else {
      lh.innerHTML = '<div class="list-col title-col">TASK TITLE</div>' +
        '<div class="list-col assignee-col">ASSIGNEE</div>' +
        '<div class="list-col status-col">STATUS</div>' +
        '<div class="list-col due-date-col">DUE DATE</div>' +
        '<div class="list-col created-date-col">CREATED DATE</div>' +
        '<div class="list-col category-col">CATEGORY</div>';
      lh.classList.remove('compact-header');
    }
    if (state.currentView==='agenda') {
      var cats={delayed:[],today:[],thisweek:[],thismonth:[]},
        labels={delayed:'Delayed',today:'Today',thisweek:'This week',thismonth:'This month'},
        colors={delayed:'#34a853',today:'#ea4335',thisweek:'#e91e63',thismonth:'#4285f4'};
      tasks.forEach(function(t){var c=getDateCategory(t.dueDate);if(cats[c])cats[c].push(t);});
      var h='';
      Object.entries(cats).forEach(function(entry){
        var k=entry[0],ts=entry[1];
        if(ts.length||k==='delayed'){
          h+='<div class="list-group-header"><div class="check-circle"></div><div class="group-color" style="background:'+colors[k]+'"></div>'+labels[k]+
            (ts.length?' <span class="group-task-count">'+ts.length+'</span>':'')+
            '</div>';
          ts.forEach(function(t){ h += isPanelOpen ? renderCompactListRow(t) : renderListRow(t); });
        }
      });
      lb.innerHTML=h;
    } else {
      var gr={};
      tasks.forEach(function(t){var n=t.category||'General';if(!gr[n])gr[n]=[];gr[n].push(t);});
      var h='';
      Object.entries(gr).forEach(function(entry){
        var n=entry[0],ts=entry[1];
        h+='<div class="list-group-header"><div class="check-circle"></div><div class="group-color" style="background:#e67e22"></div>'+n+'</div>';
        ts.forEach(function(t){ h += isPanelOpen ? renderCompactListRow(t) : renderListRow(t); });
      });
      lb.innerHTML=h;
    }
    var listView = document.getElementById('listView');
    if (isPanelOpen) { listView.classList.add('list-with-panel'); } else { listView.classList.remove('list-with-panel'); }
    updateBulkBar();
  }

  // ===== FILTERING =====
  function getFilteredTasks() {
    var tasks=[].concat(state.tasks);
    if(state.currentView==='personal'){tasks=tasks.filter(function(t){var g=state.groups.find(function(gr){return gr.id===t.group});return g&&g.type==='personal';});}
    else if(state.currentView==='createdbyme'){tasks=tasks.filter(function(t){return t.assignee==='Pradeep';});}
    else if(state.currentView==='assignedtome'){tasks=tasks.filter(function(t){return t.assignee==='Pradeep';});}
    else if(state.currentView==='myday'){var td=new Date().toISOString().split('T')[0];tasks=tasks.filter(function(t){return t.dueDate&&t.dueDate.startsWith(td);});}
    else if(state.currentView==='agenda'){tasks=tasks.filter(function(t){return t.dueDate;});}
    else if(state.currentView==='group' && state.filterGroup){tasks=tasks.filter(function(t){return t.group===state.filterGroup;});}
    else if(state.currentView==='tag' && state.filterTag){
      tasks=tasks.filter(function(t){
        if (!t.tags || !t.tags.length) return false;
        var tag = state.tags.find(function(tg){return tg.id===state.filterTag;});
        if (!tag) return false;
        return t.tags.indexOf(tag.id) !== -1 || t.tags.indexOf(tag.name) !== -1;
      });
    }
    if(state.searchQuery){var q=state.searchQuery.toLowerCase();tasks=tasks.filter(function(t){return t.title.toLowerCase().includes(q)||(t.description&&t.description.toLowerCase().includes(q));});}
    tasks.sort(function(a,b){var va=a[state.sortBy]||'',vb=b[state.sortBy]||'';if(state.sortBy==='priority'){var p={High:3,Medium:2,Low:1,None:0};va=p[a.priority]||0;vb=p[b.priority]||0;}var c=va>vb?1:va<vb?-1:0;return state.sortDirection==='desc'?-c:c;});
    return tasks;
  }

  function renderView() {
    if(state.currentViewType==='board'){
      document.getElementById('boardView').style.display='';
      document.getElementById('listView').style.display='none';
      renderBoardView();
    } else {
      document.getElementById('boardView').style.display='none';
      document.getElementById('listView').style.display='';
      renderListView();
    }
  }

  // ===== TASK DETAIL =====
  function showTaskDetail(taskId, source) {
    var task=state.tasks.find(function(t){return t.id===taskId;});
    if(!task) return;
    state.selectedTaskId=taskId;
    var mode = source || (state.currentViewType === 'board' ? 'modal' : 'panel');
    state.taskDetailMode = mode;
    document.getElementById('detailTaskTitle').textContent=task.title;
    document.getElementById('detailStatusBtn').textContent=task.status;
    document.getElementById('detailStatusBtn').className='status-btn '+statusClass(task.status);
    document.getElementById('detailAssigneeName').textContent=task.assignee||'Unassigned';
    document.getElementById('detailStartDate').textContent=task.startDate?formatDate(task.startDate):'Yet to set';
    document.getElementById('detailDueDate').textContent=task.dueDate?formatDate(task.dueDate):'Yet to set';
    document.getElementById('detailGroup').textContent=getGroupName(task.group);
    document.getElementById('detailCategory').textContent=task.category;
    document.getElementById('detailPriority').innerHTML='<i class="fa-solid fa-exclamation"></i> '+task.priority;
    document.getElementById('detailDescription').value=task.description||'';
    document.getElementById('detailNotes').value=task.notes||'NA';
    // Subtasks
    document.getElementById('subtasksList').innerHTML=(task.subtasks||[]).map(function(s){
      return '<div class="subtask-item"><div class="check-circle'+(s.done?' completed':'')+'" data-subtask="'+s.id+'"></div><span>'+s.title+'</span></div>';
    }).join('');
    // Tags display
    var tagsHtml = '';
    if (task.tags && task.tags.length) {
      tagsHtml = '<div class="detail-tags">' + task.tags.map(function(tid) {
        var tag = state.tags.find(function(tg){return tg.id === tid || tg.name === tid;});
        return tag ? '<span class="task-tag" style="background:'+tag.color+'">'+tag.name+' <i class="fa-solid fa-xmark tag-remove" data-tagid="'+tag.id+'"></i></span>' : '';
      }).join('') + '</div>';
    }
    var tagsSection = document.getElementById('detailTagsDisplay');
    if (tagsSection) tagsSection.innerHTML = tagsHtml;
    // Recurrence display
    var recurrenceDisplay = document.getElementById('detailRecurrenceDisplay');
    if (recurrenceDisplay) {
      recurrenceDisplay.textContent = task.recurrence ? ('Recurring: ' + task.recurrence.type + (task.recurrence.interval > 1 ? ' (every '+task.recurrence.interval+')' : '')) : '';
    }
    // Reminder display
    var reminderDisplay = document.getElementById('detailReminderDisplay');
    if (reminderDisplay) {
      reminderDisplay.textContent = task.reminder ? ('Reminder: ' + formatDate(task.reminder.date) + ' ' + (task.reminder.time||'')) : '';
    }
    // Attachments display
    var attachSection = document.getElementById('detailAttachments');
    if (attachSection) {
      attachSection.innerHTML = (task.attachments && task.attachments.length) ?
        task.attachments.map(function(a, i) {
          return '<div class="attachment-item"><i class="fa-solid fa-file"></i> '+a.name+' <i class="fa-solid fa-xmark attachment-remove" data-idx="'+i+'"></i></div>';
        }).join('') : '';
    }
    // Timeline
    renderTimeline(task);
    var panel = document.getElementById('taskDetailPanel');
    var modalOverlay = document.getElementById('taskDetailModalOverlay');
    if (mode === 'modal') {
      panel.style.display = '';panel.classList.add('modal-mode');panel.classList.remove('panel-mode');
      modalOverlay.style.display = '';
    } else {
      panel.style.display = '';panel.classList.add('panel-mode');panel.classList.remove('modal-mode');
      modalOverlay.style.display = 'none';
      renderListView();
    }
    if(typeof ApprovalWorkflow!=='undefined'){ApprovalWorkflow.emit('approval:ui:refresh',{taskId:taskId});}
  }

  function renderTimeline(task) {
    var entries = [{user: task.assignee||'System', action: 'created this task', date: task.createdAt}];
    if (task.activity && task.activity.length) {
      task.activity.forEach(function(a) { entries.push(a); });
    }
    document.getElementById('timelineList').innerHTML = entries.map(function(e) {
      return '<div class="timeline-item"><span><span class="timeline-user">'+(e.user||'System')+'</span> '+(e.action||'updated this task')+'</span><span class="timeline-date">'+formatDate(e.date)+'</span></div>';
    }).join('');
  }

  function addTimelineEntry(task, action) {
    if (!task.activity) task.activity = [];
    task.activity.push({user: 'Pradeep', action: action, date: new Date().toISOString()});
  }

  function hideTaskDetail() {
    document.getElementById('taskDetailPanel').style.display='none';
    document.getElementById('taskDetailModalOverlay').style.display='none';
    document.getElementById('taskDetailPanel').classList.remove('modal-mode','panel-mode');
    state.selectedTaskId=null;state.taskDetailMode=null;
    if (state.currentViewType === 'list') { renderListView(); }
  }

  // ===== DYNAMIC CATEGORY UPDATES =====
  function updateCategorySelect(groupId, selectEl) {
    var g = state.groups.find(function(gr){return gr.id === groupId;});
    var cats = (g && g.categories) ? g.categories : ['General'];
    selectEl.innerHTML = cats.map(function(c){ return '<option value="'+c+'">'+c+'</option>'; }).join('');
  }

  // ===== RECURRENCE MODAL =====
  function showRecurrenceModal(callback) {
    var modal = document.getElementById('recurrenceModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'recurrenceModal';
      modal.className = 'modal-overlay';
      modal.innerHTML = '<div class="modal-content small-modal"><h3>Set Recurrence</h3>' +
        '<div style="margin:12px 0"><label>Type: </label><select id="recurrenceType" class="meta-select" style="width:auto"><option value="">None</option><option value="Daily">Daily</option><option value="Weekly">Weekly</option><option value="Monthly">Monthly</option><option value="Yearly">Yearly</option></select></div>' +
        '<div style="margin:12px 0"><label>Repeat every: </label><input type="number" id="recurrenceInterval" value="1" min="1" max="365" style="width:60px;padding:4px 8px;border-radius:4px;border:1px solid #555;background:var(--bg-secondary);color:var(--text-primary)"></div>' +
        '<div class="modal-footer"><button class="save-btn" id="saveRecurrenceBtn">Save</button><button class="cancel-btn" id="cancelRecurrenceBtn">Cancel</button></div></div>';
      document.body.appendChild(modal);
    }
    modal.style.display = '';
    document.getElementById('recurrenceType').value = '';
    document.getElementById('recurrenceInterval').value = '1';
    document.getElementById('saveRecurrenceBtn').onclick = function() {
      var type = document.getElementById('recurrenceType').value;
      var interval = parseInt(document.getElementById('recurrenceInterval').value) || 1;
      modal.style.display = 'none';
      callback(type ? {type: type, interval: interval} : null);
    };
    document.getElementById('cancelRecurrenceBtn').onclick = function() { modal.style.display = 'none'; };
  }

  // ===== TAGS PICKER =====
  function showTagsPicker(selectedTags, callback) {
    var modal = document.getElementById('tagsPickerModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'tagsPickerModal';
      modal.className = 'modal-overlay';
      document.body.appendChild(modal);
    }
    var html = '<div class="modal-content small-modal"><h3>Select Tags</h3><div id="tagsPickerList" style="max-height:300px;overflow-y:auto">';
    state.tags.forEach(function(tag) {
      var checked = (selectedTags||[]).indexOf(tag.id) !== -1 || (selectedTags||[]).indexOf(tag.name) !== -1;
      html += '<label style="display:flex;align-items:center;gap:8px;padding:6px 0;cursor:pointer;color:var(--text-primary)"><input type="checkbox" class="tag-picker-cb" data-tagid="'+tag.id+'"'+(checked?' checked':'')+'><span class="tag-dot" style="background:'+tag.color+'"></span>'+tag.name+'</label>';
    });
    html += '</div><div class="modal-footer"><button class="save-btn" id="saveTagsPickerBtn">Save</button><button class="cancel-btn" id="cancelTagsPickerBtn">Cancel</button></div></div>';
    modal.innerHTML = html;
    modal.style.display = '';
    document.getElementById('saveTagsPickerBtn').onclick = function() {
      var selected = [];
      modal.querySelectorAll('.tag-picker-cb:checked').forEach(function(cb) { selected.push(parseInt(cb.dataset.tagid)); });
      modal.style.display = 'none';
      callback(selected);
    };
    document.getElementById('cancelTagsPickerBtn').onclick = function() { modal.style.display = 'none'; };
  }

  // ===== REMINDER MODAL =====
  function showReminderModal(existing, callback) {
    var modal = document.getElementById('reminderModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'reminderModal';
      modal.className = 'modal-overlay';
      document.body.appendChild(modal);
    }
    var existDate = existing && existing.date ? toInputDate(existing.date) : '';
    var existTime = existing && existing.time ? existing.time : '';
    modal.innerHTML = '<div class="modal-content small-modal"><h3>Set Reminder</h3>' +
      '<div style="margin:12px 0"><label>Date: </label><input type="date" id="reminderDate" value="'+existDate+'" style="padding:4px 8px;border-radius:4px;border:1px solid #555;background:var(--bg-secondary);color:var(--text-primary)"></div>' +
      '<div style="margin:12px 0"><label>Time: </label><input type="time" id="reminderTime" value="'+existTime+'" style="padding:4px 8px;border-radius:4px;border:1px solid #555;background:var(--bg-secondary);color:var(--text-primary)"></div>' +
      '<div style="margin:12px 0"><label><input type="checkbox" id="reminderNotify" checked> Send notification</label></div>' +
      '<div class="modal-footer"><button class="save-btn" id="saveReminderBtn">Save</button>'+(existing?'<button class="cancel-btn" id="clearReminderBtn">Clear</button>':'')+'<button class="cancel-btn" id="cancelReminderBtn">Cancel</button></div></div>';
    modal.style.display = '';
    document.getElementById('saveReminderBtn').onclick = function() {
      var date = document.getElementById('reminderDate').value;
      var time = document.getElementById('reminderTime').value;
      modal.style.display = 'none';
      callback(date ? {date: date, time: time, notify: document.getElementById('reminderNotify').checked} : null);
    };
    var clearBtn = document.getElementById('clearReminderBtn');
    if (clearBtn) clearBtn.onclick = function() { modal.style.display = 'none'; callback(null); };
    document.getElementById('cancelReminderBtn').onclick = function() { modal.style.display = 'none'; };
  }

  // ===== ATTACHMENT HANDLING =====
  function handleAttachment(callback) {
    var input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.onchange = function() {
      var files = Array.from(input.files).map(function(f) {
        return {name: f.name, size: f.size, type: f.type, addedAt: new Date().toISOString()};
      });
      callback(files);
    };
    input.click();
  }

  // ===== COPY TASK =====
  function showCopyMoveModal(taskId, action) {
    var task = state.tasks.find(function(t){return t.id===taskId;});
    if (!task) return;
    var modal = document.getElementById('copyMoveModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'copyMoveModal';
      modal.className = 'modal-overlay';
      document.body.appendChild(modal);
    }
    var groupOptions = state.groups.map(function(g){ return '<option value="'+g.id+'">'+g.name+'</option>'; }).join('');
    modal.innerHTML = '<div class="modal-content small-modal"><h3>'+(action==='copy'?'Copy':'Move')+' Task</h3>' +
      '<div style="margin:12px 0"><label>Group: </label><select id="copyMoveGroup" class="meta-select" style="width:auto">'+groupOptions+'</select></div>' +
      '<div style="margin:12px 0"><label><input type="checkbox" id="copyMoveComments" checked> Include comments</label></div>' +
      '<div class="modal-footer"><button class="save-btn" id="saveCopyMoveBtn">'+(action==='copy'?'Copy':'Move')+'</button><button class="cancel-btn" id="cancelCopyMoveBtn">Cancel</button></div></div>';
    modal.style.display = '';
    document.getElementById('copyMoveGroup').value = task.group;
    document.getElementById('saveCopyMoveBtn').onclick = async function() {
      var newGroupId = parseInt(document.getElementById('copyMoveGroup').value);
      var newGroup = state.groups.find(function(g){return g.id===newGroupId;});
      var newCat = (newGroup && newGroup.categories && newGroup.categories[0]) || 'General';
      if (action === 'copy') {
        var copy = Object.assign({}, task);
        delete copy.id;
        copy.group = newGroupId;
        copy.category = newCat;
        copy.createdAt = new Date().toISOString();
        await ShadowDB.Tasks.create(copy);
      } else {
        task.group = newGroupId;
        task.category = newCat;
        addTimelineEntry(task, 'moved task to ' + (newGroup?newGroup.name:'group'));
        await ShadowDB.Tasks.update(task);
      }
      state.tasks = await ShadowDB.Tasks.getAll();
      modal.style.display = 'none';
      hideTaskDetail();
      renderSidebar();
      renderView();
    };
    document.getElementById('cancelCopyMoveBtn').onclick = function() { modal.style.display = 'none'; };
  }

  // ===== DELETE TASK =====
  async function deleteTask(taskId) {
    if (!confirm('Delete this task?')) return;
    await ShadowDB.Tasks.delete(taskId);
    state.tasks = await ShadowDB.Tasks.getAll();
    hideTaskDetail();
    renderSidebar();
    renderView();
  }

  // ===== ARCHIVE TASK =====
  async function archiveTask(taskId) {
    var task = state.tasks.find(function(t){return t.id===taskId;});
    if (!task) return;
    task.status = 'Archived';
    addTimelineEntry(task, 'archived this task');
    await ShadowDB.Tasks.update(task);
    state.tasks = await ShadowDB.Tasks.getAll();
    hideTaskDetail();
    renderSidebar();
    renderView();
  }

  // ===== MORE ACTIONS MENU (Detail Panel) =====
  function showDetailMoreMenu(e) {
    var menu = document.getElementById('detailMoreMenu');
    if (!menu) {
      menu = document.createElement('div');
      menu.id = 'detailMoreMenu';
      menu.className = 'dropdown-menu';
      document.body.appendChild(menu);
    }
    menu.innerHTML =
      '<div class="dropdown-item" data-action="copy"><i class="fa-regular fa-copy"></i> Copy Task</div>' +
      '<div class="dropdown-item" data-action="move"><i class="fa-solid fa-arrow-right"></i> Move Task</div>' +
      '<div class="dropdown-item" data-action="archive"><i class="fa-solid fa-box-archive"></i> Archive Task</div>' +
      '<div class="dropdown-item" data-action="delete" style="color:#e74c3c"><i class="fa-solid fa-trash"></i> Delete Task</div>' +
      '<div class="dropdown-divider"></div>' +
      '<div class="dropdown-item" data-action="permalink"><i class="fa-solid fa-link"></i> Copy Permalink</div>';
    var r = e.target.closest('.icon-btn').getBoundingClientRect();
    menu.style.top = r.bottom + 4 + 'px';
    menu.style.left = (r.left - 120) + 'px';
    menu.style.display = '';
    menu.style.position = 'fixed';
    menu.style.zIndex = '10000';
    menu.onclick = function(ev) {
      var item = ev.target.closest('.dropdown-item');
      if (!item) return;
      var action = item.dataset.action;
      menu.style.display = 'none';
      if (action === 'copy') showCopyMoveModal(state.selectedTaskId, 'copy');
      else if (action === 'move') showCopyMoveModal(state.selectedTaskId, 'move');
      else if (action === 'delete') deleteTask(state.selectedTaskId);
      else if (action === 'archive') archiveTask(state.selectedTaskId);
      else if (action === 'permalink') {
        navigator.clipboard.writeText(window.location.href + '?task=' + state.selectedTaskId);
        alert('Permalink copied to clipboard!');
      }
    };
    setTimeout(function(){
      document.addEventListener('click', function hideMenu(ev) {
        if (!menu.contains(ev.target)) { menu.style.display = 'none'; document.removeEventListener('click', hideMenu); }
      });
    }, 10);
  }

  // ===== FILTER MODAL =====
  function showFilterModal() {
    var modal = document.getElementById('filterModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'filterModal';
      modal.className = 'modal-overlay';
      document.body.appendChild(modal);
    }
    var groupOptions = '<option value="">All Groups</option>' + state.groups.map(function(g){ return '<option value="'+g.id+'"'+(state.filterGroup===g.id?' selected':'')+'>'+g.name+'</option>'; }).join('');
    var tagOptions = '<option value="">All Tags</option>' + state.tags.map(function(t){ return '<option value="'+t.id+'"'+(state.filterTag===t.id?' selected':'')+'>'+t.name+'</option>'; }).join('');
    modal.innerHTML = '<div class="modal-content small-modal"><h3>Filter Tasks</h3>' +
      '<div style="margin:12px 0"><label>Group: </label><select id="filterGroupSelect" class="meta-select" style="width:auto">'+groupOptions+'</select></div>' +
      '<div style="margin:12px 0"><label>Tag: </label><select id="filterTagSelect" class="meta-select" style="width:auto">'+tagOptions+'</select></div>' +
      '<div class="modal-footer"><button class="save-btn" id="applyFilterBtn">Apply</button><button class="cancel-btn" id="clearFilterBtn">Clear</button><button class="cancel-btn" id="cancelFilterBtn">Cancel</button></div></div>';
    modal.style.display = '';
    document.getElementById('applyFilterBtn').onclick = function() {
      var gv = document.getElementById('filterGroupSelect').value;
      var tv = document.getElementById('filterTagSelect').value;
      state.filterGroup = gv ? parseInt(gv) : null;
      state.filterTag = tv ? parseInt(tv) : null;
      if (state.filterGroup) state.currentView = 'group';
      else if (state.filterTag) state.currentView = 'tag';
      modal.style.display = 'none';
      renderSidebar();
      renderView();
    };
    document.getElementById('clearFilterBtn').onclick = function() {
      state.filterGroup = null;
      state.filterTag = null;
      state.currentView = 'agenda';
      document.querySelectorAll('.nav-item').forEach(function(n){n.classList.remove('active');});
      document.querySelector('.nav-item[data-view="agenda"]').classList.add('active');
      modal.style.display = 'none';
      document.getElementById('viewTitle').textContent = 'Agenda';
      renderSidebar();
      renderView();
    };
    document.getElementById('cancelFilterBtn').onclick = function() { modal.style.display = 'none'; };
  }

  // ===== BULK ACTIONS =====
  function updateBulkBar() {
    var bar = document.getElementById('bulkActionsBar');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'bulkActionsBar';
      bar.style.cssText = 'display:none;position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;padding:8px 16px;z-index:1000;box-shadow:0 4px 12px rgba(0,0,0,0.3);gap:8px;align-items:center;';
      bar.innerHTML = '<span id="bulkCount" style="color:var(--text-primary);margin-right:8px"></span>' +
        '<button class="toolbar-btn bulk-btn" data-action="status">Status</button>' +
        '<button class="toolbar-btn bulk-btn" data-action="priority">Priority</button>' +
        '<button class="toolbar-btn bulk-btn" data-action="delete" style="color:#e74c3c">Delete</button>';
      document.body.appendChild(bar);
      bar.addEventListener('click', handleBulkAction);
    }
    if (state.selectedBulkTasks.size > 0) {
      bar.style.display = 'flex';
      document.getElementById('bulkCount').textContent = state.selectedBulkTasks.size + ' selected';
    } else {
      bar.style.display = 'none';
    }
  }

  async function handleBulkAction(e) {
    var btn = e.target.closest('.bulk-btn');
    if (!btn) return;
    var action = btn.dataset.action;
    var ids = Array.from(state.selectedBulkTasks);
    if (action === 'delete') {
      if (!confirm('Delete ' + ids.length + ' tasks?')) return;
      for (var i = 0; i < ids.length; i++) { await ShadowDB.Tasks.delete(ids[i]); }
    } else if (action === 'status') {
      var ns = prompt('Enter new status (Open, In Progress, Closed):');
      if (!ns) return;
      for (var i = 0; i < ids.length; i++) {
        var t = state.tasks.find(function(x){return x.id===ids[i];});
        if (t) { t.status = ns; await ShadowDB.Tasks.update(t); }
      }
    } else if (action === 'priority') {
      var np = prompt('Enter priority (None, Low, Medium, High):');
      if (!np) return;
      for (var i = 0; i < ids.length; i++) {
        var t = state.tasks.find(function(x){return x.id===ids[i];});
        if (t) { t.priority = np; await ShadowDB.Tasks.update(t); }
      }
    }
    state.selectedBulkTasks.clear();
    state.tasks = await ShadowDB.Tasks.getAll();
    renderSidebar();
    renderView();
  }

  // ===== EVENT BINDINGS =====

  // Nav items
  document.querySelectorAll('.nav-item').forEach(function(item){item.addEventListener('click',function(){
    document.querySelectorAll('.nav-item').forEach(function(n){n.classList.remove('active')});
    this.classList.add('active');
    state.currentView=this.dataset.view;
    state.filterGroup=null;
    state.filterTag=null;
    hideTaskDetail();
    var titles = {agenda:'Agenda',myday:'My Day',createdbyme:'Created by Me',assignedtome:'Assigned to me',sharedwithme:'Shared with me',personal:'Personal tasks',unified:'Unified view'};
    document.getElementById('viewTitle').textContent = titles[state.currentView] || 'Agenda';
    renderSidebar();
    renderView();
  });});

  // View tabs
  document.querySelectorAll('.view-tab').forEach(function(tab){tab.addEventListener('click',function(){document.querySelectorAll('.view-tab').forEach(function(t){t.classList.remove('active')});this.classList.add('active');state.currentViewType=this.dataset.viewtype;hideTaskDetail();renderView();});});

  // New Task button
  document.getElementById('newTaskBtn').addEventListener('click',function(){
    document.getElementById('taskModal').style.display='';
    document.getElementById('modalTaskTitle').value='';
    document.getElementById('modalDescription').value='';
    document.getElementById('modalNotes').value='NA';
    document.getElementById('modalStartDate').value='';
    document.getElementById('modalDueDate').value='';
    document.getElementById('modalPriority').value='Medium';
    state.modalSubtasks=[];
    state.modalTags=[];
    state.modalRecurrence=null;
    state.modalReminder=null;
    state.modalAttachments=[];
    renderModalSubtasks();
    renderModalTags();
    updateCategorySelect(parseInt(document.getElementById('modalGroup').value), document.getElementById('modalCategory'));
    document.getElementById('modalTaskTitle').focus();
  });

  // Group change -> Update category
  document.getElementById('modalGroup').addEventListener('change', function() {
    updateCategorySelect(parseInt(this.value), document.getElementById('modalCategory'));
  });

  // Modal close/cancel
  document.getElementById('closeModalBtn').addEventListener('click',function(){document.getElementById('taskModal').style.display='none';});
  document.getElementById('cancelTaskBtn').addEventListener('click',function(){document.getElementById('taskModal').style.display='none';});

  // Modal Recurrence button
  var modalRecurBtn = document.querySelector('#taskModal .modal-header-right [title="Recurrence"]');
  if (modalRecurBtn) {
    modalRecurBtn.addEventListener('click', function() {
      showRecurrenceModal(function(rec) {
        state.modalRecurrence = rec;
        modalRecurBtn.style.color = rec ? '#4285f4' : '';
        modalRecurBtn.title = rec ? 'Recurring: ' + rec.type : 'Recurrence';
      });
    });
  }

  // Modal Tags button
  var modalTagBtnEl = document.getElementById('modalTagBtn');
  if (modalTagBtnEl) {
    modalTagBtnEl.addEventListener('click', function() {
      showTagsPicker(state.modalTags, function(selected) {
        state.modalTags = selected;
        renderModalTags();
      });
    });
  }

  // Modal Attachment button
  var modalAttachBtn = document.querySelector('#taskModal .modal-header-right [title="Attachment"]');
  if (modalAttachBtn) {
    modalAttachBtn.addEventListener('click', function() {
      handleAttachment(function(files) {
        if (!state.modalAttachments) state.modalAttachments = [];
        state.modalAttachments = state.modalAttachments.concat(files);
        modalAttachBtn.title = 'Attachments (' + state.modalAttachments.length + ')';
        modalAttachBtn.style.color = '#4285f4';
      });
    });
  }

  // Modal Reminder button
  var modalReminderBtnEl = document.getElementById('modalReminderBtn');
  if (modalReminderBtnEl) {
    modalReminderBtnEl.addEventListener('click', function() {
      showReminderModal(state.modalReminder, function(reminder) {
        state.modalReminder = reminder;
        modalReminderBtnEl.innerHTML = reminder ?
          '<i class="fa-regular fa-calendar-check"></i> ' + formatDate(reminder.date) + ' ' + (reminder.time||'') :
          '<i class="fa-regular fa-calendar-check"></i> Set reminder';
      });
    });
  }

  // Modal subtask input
  function renderModalSubtasks() {
    var list = document.getElementById('modalSubtasksList');
    if (list) {
      list.innerHTML = state.modalSubtasks.map(function(s, i) {
        return '<div class="subtask-item"><div class="check-circle"></div><span>'+s.title+'</span><i class="fa-solid fa-xmark" data-idx="'+i+'" style="cursor:pointer;margin-left:auto;opacity:0.5"></i></div>';
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
    var container = document.getElementById('modalTagsDisplay');
    if (!container) {
      container = document.createElement('div');
      container.id = 'modalTagsDisplay';
      container.style.cssText = 'display:flex;gap:4px;flex-wrap:wrap;margin:4px 0;';
      var metaRow = document.querySelector('#taskModal .detail-meta');
      if (metaRow) metaRow.parentNode.insertBefore(container, metaRow.nextSibling);
    }
    if (container) {
      container.innerHTML = state.modalTags.map(function(tid) {
        var tag = state.tags.find(function(t){return t.id===tid;});
        return tag ? '<span class="task-tag" style="background:'+tag.color+'">'+tag.name+'</span>' : '';
      }).join('');
    }
  }

  document.getElementById('modalSubtaskInput').addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && this.value.trim()) {
      state.modalSubtasks.push({id: 's'+Date.now(), title: this.value.trim(), done: false});
      this.value = '';
      renderModalSubtasks();
    }
  });

  // Save task
  document.getElementById('saveTaskBtn').addEventListener('click', async function(){
    var title=document.getElementById('modalTaskTitle').value.trim();
    if(!title)return;
    var gs=document.getElementById('modalGroup'),gid=gs.value?parseInt(gs.value):(state.groups.length?state.groups[0].id:null);
    try{
      await ShadowDB.Tasks.create({
        title:title,
        status:'Open',
        priority:document.getElementById('modalPriority').value,
        assignee:'Pradeep',
        group:gid,
        category:document.getElementById('modalCategory').value||'General',
        dueDate:document.getElementById('modalDueDate').value||'',
        startDate:document.getElementById('modalStartDate').value||'',
        description:document.getElementById('modalDescription').value,
        notes:document.getElementById('modalNotes').value,
        tags:state.modalTags||[],
        subtasks:state.modalSubtasks||[],
        recurrence:state.modalRecurrence||null,
        reminder:state.modalReminder||null,
        attachments:state.modalAttachments||[],
        customFields:{},
        completedAt:null,
        order:0,
        activity:[]
      });
      state.tasks=await ShadowDB.Tasks.getAll();
      document.getElementById('taskModal').style.display='none';
      renderSidebar();renderView();
    }catch(e){console.error('Failed:',e);}
  });

  // Task clicks
  document.getElementById('boardColumns').addEventListener('click',function(e){var c=e.target.closest('.task-card');if(c)showTaskDetail(parseInt(c.dataset.taskid),'modal');});
  document.getElementById('listBody').addEventListener('click',function(e){
    // Handle bulk checkbox
    var cb = e.target.closest('.bulk-checkbox');
    if (cb) {
      var tid = parseInt(cb.dataset.taskid);
      if (cb.checked) state.selectedBulkTasks.add(tid);
      else state.selectedBulkTasks.delete(tid);
      updateBulkBar();
      return;
    }
    var r=e.target.closest('.list-row');if(r)showTaskDetail(parseInt(r.dataset.taskid),'panel');
  });
  document.getElementById('closeDetailBtn').addEventListener('click',hideTaskDetail);
  document.getElementById('taskDetailModalOverlay').addEventListener('click',hideTaskDetail);

  // Detail panel - More actions button
  var detailMoreBtn = document.querySelector('#taskDetailPanel .detail-header-right [title="More"]');
  if (detailMoreBtn) {
    detailMoreBtn.addEventListener('click', showDetailMoreMenu);
  }

  // Detail panel - Recurrence button
  var detailRecurBtn = document.querySelector('#taskDetailPanel .detail-header-right [title="Recurrence"]');
  if (detailRecurBtn) {
    detailRecurBtn.addEventListener('click', function() {
      var task = state.tasks.find(function(t){return t.id===state.selectedTaskId;});
      if (!task) return;
      showRecurrenceModal(function(rec) {
        task.recurrence = rec;
        addTimelineEntry(task, rec ? 'set recurrence to ' + rec.type : 'removed recurrence');
        ShadowDB.Tasks.update(task).then(function(){ state.tasks = state.tasks.map(function(x){return x.id===task.id?task:x;}); showTaskDetail(state.selectedTaskId, state.taskDetailMode); });
      });
    });
  }

  // Detail panel - Attachment button
  var detailAttachBtn = document.querySelector('#taskDetailPanel .detail-header-right [title="Attachment"]');
  if (detailAttachBtn) {
    detailAttachBtn.addEventListener('click', function() {
      var task = state.tasks.find(function(t){return t.id===state.selectedTaskId;});
      if (!task) return;
      handleAttachment(function(files) {
        if (!task.attachments) task.attachments = [];
        task.attachments = task.attachments.concat(files);
        addTimelineEntry(task, 'added ' + files.length + ' attachment(s)');
        ShadowDB.Tasks.update(task).then(function(){ state.tasks = state.tasks.map(function(x){return x.id===task.id?task:x;}); showTaskDetail(state.selectedTaskId, state.taskDetailMode); });
      });
    });
  }

  // Detail panel - Tags button
  var detailTagsBtn = document.querySelector('#taskDetailPanel .detail-header-right [title="Tags"]');
  if (detailTagsBtn) {
    detailTagsBtn.addEventListener('click', function() {
      var task = state.tasks.find(function(t){return t.id===state.selectedTaskId;});
      if (!task) return;
      showTagsPicker(task.tags||[], function(selected) {
        task.tags = selected;
        addTimelineEntry(task, 'updated tags');
        ShadowDB.Tasks.update(task).then(function(){ state.tasks = state.tasks.map(function(x){return x.id===task.id?task:x;}); showTaskDetail(state.selectedTaskId, state.taskDetailMode); renderView(); });
      });
    });
  }

  // Detail panel - Reminder button
  var detailReminderBtn = document.getElementById('detailReminderBtn');
  if (detailReminderBtn) {
    detailReminderBtn.addEventListener('click', function() {
      var task = state.tasks.find(function(t){return t.id===state.selectedTaskId;});
      if (!task) return;
      showReminderModal(task.reminder, function(reminder) {
        task.reminder = reminder;
        addTimelineEntry(task, reminder ? 'set reminder for ' + formatDate(reminder.date) : 'removed reminder');
        ShadowDB.Tasks.update(task).then(function(){
          state.tasks = state.tasks.map(function(x){return x.id===task.id?task:x;});
          showTaskDetail(state.selectedTaskId, state.taskDetailMode);
        });
      });
    });
  }

  // Detail panel - Start Date click to edit
  document.getElementById('detailStartDate').addEventListener('click', function() {
    var task = state.tasks.find(function(t){return t.id===state.selectedTaskId;});
    if (!task) return;
    var input = document.createElement('input');
    input.type = 'date';
    input.value = toInputDate(task.startDate);
    input.style.cssText = 'background:var(--bg-secondary);color:var(--text-primary);border:1px solid var(--border-color);border-radius:4px;padding:2px 4px;';
    this.innerHTML = '';
    this.appendChild(input);
    input.focus();
    input.addEventListener('change', async function() {
      task.startDate = this.value;
      addTimelineEntry(task, 'changed start date to ' + formatDate(this.value));
      await ShadowDB.Tasks.update(task);
      state.tasks = state.tasks.map(function(x){return x.id===task.id?task:x;});
      showTaskDetail(state.selectedTaskId, state.taskDetailMode);
      renderView();
    });
    input.addEventListener('blur', function() {
      document.getElementById('detailStartDate').textContent = task.startDate ? formatDate(task.startDate) : 'Yet to set';
    });
  });

  // Detail panel - Due Date click to edit
  document.getElementById('detailDueDate').addEventListener('click', function() {
    var task = state.tasks.find(function(t){return t.id===state.selectedTaskId;});
    if (!task) return;
    var input = document.createElement('input');
    input.type = 'date';
    input.value = toInputDate(task.dueDate);
    input.style.cssText = 'background:var(--bg-secondary);color:var(--text-primary);border:1px solid var(--border-color);border-radius:4px;padding:2px 4px;';
    this.innerHTML = '';
    this.appendChild(input);
    input.focus();
    input.addEventListener('change', async function() {
      task.dueDate = this.value;
      addTimelineEntry(task, 'changed due date to ' + formatDate(this.value));
      await ShadowDB.Tasks.update(task);
      state.tasks = state.tasks.map(function(x){return x.id===task.id?task:x;});
      showTaskDetail(state.selectedTaskId, state.taskDetailMode);
      renderView();
    });
    input.addEventListener('blur', function() {
      document.getElementById('detailDueDate').textContent = task.dueDate ? formatDate(task.dueDate) : 'Yet to set';
    });
  });

  // Sort
  document.getElementById('sortBtn').addEventListener('click',function(){var dd=document.getElementById('sortDropdown'),r=this.getBoundingClientRect();dd.style.top=r.bottom+4+'px';dd.style.left=r.left+'px';dd.style.display=dd.style.display==='none'?'':'none';});
  document.getElementById('sortDropdown').addEventListener('click',function(e){var i=e.target.closest('.dropdown-item');if(!i)return;if(i.dataset.sort){state.sortBy=i.dataset.sort;document.querySelector('.sort-badge').textContent=i.textContent.toUpperCase();}if(i.dataset.direction){state.sortDirection=i.dataset.direction;document.querySelector('.sort-direction').textContent=i.dataset.direction==='desc'?'Newest on top':'Oldest on top';}this.style.display='none';renderView();});

  // Status & Priority dropdowns
  document.getElementById('detailStatusBtn').addEventListener('click',function(){var dd=document.getElementById('statusDropdown'),r=this.getBoundingClientRect();dd.style.top=r.bottom+4+'px';dd.style.left=r.left+'px';dd.style.display=dd.style.display==='none'?'':'none';});
  document.getElementById('statusDropdown').addEventListener('click',async function(e){var i=e.target.closest('.status-option');if(!i)return;var ns=i.dataset.status,task=state.tasks.find(function(t){return t.id===state.selectedTaskId;});if(task){
    addTimelineEntry(task, 'changed status from '+task.status+' to '+ns);
    task.status=ns;
    if(ns==='Closed')task.completedAt=new Date().toISOString();
    try{await ShadowDB.Tasks.update(task);state.tasks=await ShadowDB.Tasks.getAll();}catch(e){}document.getElementById('detailStatusBtn').textContent=ns;document.getElementById('detailStatusBtn').className='status-btn '+statusClass(ns);renderView();}this.style.display='none';});
  document.getElementById('detailPriority').addEventListener('click',function(){var dd=document.getElementById('priorityDropdown'),r=this.getBoundingClientRect();dd.style.top=r.bottom+4+'px';dd.style.left=r.left+'px';dd.style.display=dd.style.display==='none'?'':'none';});
  document.getElementById('priorityDropdown').addEventListener('click',async function(e){var i=e.target.closest('.priority-option');if(!i)return;var np=i.dataset.priority,task=state.tasks.find(function(t){return t.id===state.selectedTaskId;});if(task){
    addTimelineEntry(task, 'changed priority from '+task.priority+' to '+np);
    task.priority=np;try{await ShadowDB.Tasks.update(task);state.tasks=await ShadowDB.Tasks.getAll();}catch(e){}document.getElementById('detailPriority').innerHTML='<i class="fa-solid fa-exclamation"></i> '+np;renderView();}this.style.display='none';});

  // Filter button
  document.getElementById('filterBtn').addEventListener('click', showFilterModal);

  // Groups & Tags creation
  document.getElementById('addGroupBtn').addEventListener('click',function(){document.getElementById('groupModal').style.display='';document.getElementById('groupNameInput').value='';document.getElementById('groupNameInput').focus();});
  document.getElementById('cancelGroupBtn').addEventListener('click',function(){document.getElementById('groupModal').style.display='none';});
  document.getElementById('saveGroupBtn').addEventListener('click',async function(){var n=document.getElementById('groupNameInput').value.trim();if(!n)return;try{await ShadowDB.Groups.create({name:n,description:'',color:'#4285f4',type:'org-email',streams:true,hidden:false,categories:['General'],statuses:['Open','In Progress','Completed'],icon:null,order:0});state.groups=await ShadowDB.Groups.getAll();document.getElementById('groupModal').style.display='none';renderSidebar();updateGroupSelects();}catch(e){console.error(e);}});

  document.getElementById('addTagBtn').addEventListener('click',function(){document.getElementById('tagModal').style.display='';document.getElementById('tagNameInput').value='';document.getElementById('tagNameInput').focus();});
  document.getElementById('cancelTagBtn').addEventListener('click',function(){document.getElementById('tagModal').style.display='none';});
  var selectedTagColor='#e67e22';
  document.querySelectorAll('.color-dot').forEach(function(d){d.addEventListener('click',function(){document.querySelectorAll('.color-dot').forEach(function(x){x.classList.remove('selected')});this.classList.add('selected');selectedTagColor=this.dataset.color;});});
  document.getElementById('saveTagBtn').addEventListener('click',async function(){var n=document.getElementById('tagNameInput').value.trim();if(!n)return;try{await ShadowDB.Tags.create({name:n,color:selectedTagColor});state.tags=await ShadowDB.Tags.getAll();document.getElementById('tagModal').style.display='none';renderSidebar();}catch(e){console.error(e);}});

  // Close dropdowns on outside click
  document.addEventListener('click',function(e){
    if(!e.target.closest('#sortBtn')&&!e.target.closest('#sortDropdown'))document.getElementById('sortDropdown').style.display='none';
    if(!e.target.closest('#detailStatusBtn')&&!e.target.closest('#statusDropdown'))document.getElementById('statusDropdown').style.display='none';
    if(!e.target.closest('#detailPriority')&&!e.target.closest('#priorityDropdown'))document.getElementById('priorityDropdown').style.display='none';
  });

  // Subtasks in detail panel
  document.getElementById('subtasksList').addEventListener('click',async function(e){var c=e.target.closest('.check-circle');if(!c||!c.dataset.subtask)return;var task=state.tasks.find(function(t){return t.id===state.selectedTaskId;});if(task){var s=task.subtasks.find(function(x){return x.id===c.dataset.subtask;});if(s){s.done=!s.done;addTimelineEntry(task,'marked subtask "'+s.title+'" as '+(s.done?'done':'not done'));try{await ShadowDB.Tasks.update(task);state.tasks=await ShadowDB.Tasks.getAll();}catch(e){}showTaskDetail(state.selectedTaskId,state.taskDetailMode);renderView();}}});

  document.getElementById('newSubtaskInput').addEventListener('keydown',async function(e){if(e.key==='Enter'&&this.value.trim()&&state.selectedTaskId){var task=state.tasks.find(function(t){return t.id===state.selectedTaskId;});if(task){if(!task.subtasks)task.subtasks=[];task.subtasks.push({id:'s'+Date.now(),title:this.value.trim(),done:false});addTimelineEntry(task,'added subtask "'+this.value.trim()+'"');this.value='';try{await ShadowDB.Tasks.update(task);state.tasks=await ShadowDB.Tasks.getAll();}catch(e){}showTaskDetail(state.selectedTaskId,state.taskDetailMode);renderView();}}});

  // Comments
  document.getElementById('commentInput').addEventListener('keydown',async function(e){if(e.key==='Enter'&&this.value.trim()){var c=this.value.trim();this.value='';if(state.selectedTaskId){try{await ShadowDB.Comments.create({taskId:state.selectedTaskId,text:c,author:'Pradeep'});}catch(e){}}}});

  // Detail field updates
  document.getElementById('detailDescription').addEventListener('change',async function(){var t=state.tasks.find(function(x){return x.id===state.selectedTaskId;});if(t){addTimelineEntry(t,'updated description');t.description=this.value;try{await ShadowDB.Tasks.update(t);state.tasks=await ShadowDB.Tasks.getAll();}catch(e){}}});
  document.getElementById('detailNotes').addEventListener('change',async function(){var t=state.tasks.find(function(x){return x.id===state.selectedTaskId;});if(t){t.notes=this.value;try{await ShadowDB.Tasks.update(t);state.tasks=await ShadowDB.Tasks.getAll();}catch(e){}}});
  document.getElementById('detailTaskTitle').addEventListener('blur',async function(){var t=state.tasks.find(function(x){return x.id===state.selectedTaskId;});if(t&&this.textContent!==t.title){addTimelineEntry(t,'changed title from "'+t.title+'" to "'+this.textContent+'"');t.title=this.textContent;try{await ShadowDB.Tasks.update(t);state.tasks=await ShadowDB.Tasks.getAll();}catch(e){}renderView();}});

  // Detail group/category click to change
  document.getElementById('detailGroup').addEventListener('click', async function() {
    var task = state.tasks.find(function(t){return t.id===state.selectedTaskId;});
    if (!task) return;
    var options = state.groups.map(function(g){return '<option value="'+g.id+'"'+(g.id===task.group?' selected':'')+'>'+g.name+'</option>';}).join('');
    var sel = document.createElement('select');
    sel.className = 'meta-select';
    sel.innerHTML = options;
    sel.style.cssText = 'background:var(--bg-secondary);color:var(--text-primary);border:1px solid var(--border-color);border-radius:4px;padding:2px 4px;';
    this.innerHTML = '';
    this.appendChild(sel);
    sel.focus();
    sel.addEventListener('change', async function() {
      var newGroupId = parseInt(this.value);
      var newGroup = state.groups.find(function(g){return g.id===newGroupId;});
      addTimelineEntry(task, 'moved to group ' + (newGroup?newGroup.name:''));
      task.group = newGroupId;
      task.category = (newGroup && newGroup.categories && newGroup.categories[0]) || 'General';
      await ShadowDB.Tasks.update(task);
      state.tasks = state.tasks.map(function(x){return x.id===task.id?task:x;});
      showTaskDetail(state.selectedTaskId, state.taskDetailMode);
      renderSidebar();
      renderView();
    });
  });

  document.getElementById('detailCategory').addEventListener('click', async function() {
    var task = state.tasks.find(function(t){return t.id===state.selectedTaskId;});
    if (!task) return;
    var g = state.groups.find(function(gr){return gr.id===task.group;});
    var cats = (g && g.categories) ? g.categories : ['General'];
    var options = cats.map(function(c){return '<option value="'+c+'"'+(c===task.category?' selected':'')+'>'+c+'</option>';}).join('');
    var sel = document.createElement('select');
    sel.className = 'meta-select';
    sel.innerHTML = options;
    sel.style.cssText = 'background:var(--bg-secondary);color:var(--text-primary);border:1px solid var(--border-color);border-radius:4px;padding:2px 4px;';
    this.innerHTML = '';
    this.appendChild(sel);
    sel.focus();
    sel.addEventListener('change', async function() {
      addTimelineEntry(task, 'changed category to ' + this.value);
      task.category = this.value;
      await ShadowDB.Tasks.update(task);
      state.tasks = state.tasks.map(function(x){return x.id===task.id?task:x;});
      showTaskDetail(state.selectedTaskId, state.taskDetailMode);
      renderView();
    });
  });

  // Remove tag from detail view
  document.addEventListener('click', function(e) {
    if (e.target.classList.contains('tag-remove')) {
      var tagId = parseInt(e.target.dataset.tagid);
      var task = state.tasks.find(function(t){return t.id===state.selectedTaskId;});
      if (task && task.tags) {
        task.tags = task.tags.filter(function(t){return t !== tagId;});
        addTimelineEntry(task, 'removed a tag');
        ShadowDB.Tasks.update(task).then(function(){ state.tasks = state.tasks.map(function(x){return x.id===task.id?task:x;}); showTaskDetail(state.selectedTaskId, state.taskDetailMode); renderView(); });
      }
    }
    // Remove attachment from detail view
    if (e.target.classList.contains('attachment-remove')) {
      var idx = parseInt(e.target.dataset.idx);
      var task = state.tasks.find(function(t){return t.id===state.selectedTaskId;});
      if (task && task.attachments) {
        task.attachments.splice(idx, 1);
        addTimelineEntry(task, 'removed an attachment');
        ShadowDB.Tasks.update(task).then(function(){ state.tasks = state.tasks.map(function(x){return x.id===task.id?task:x;}); showTaskDetail(state.selectedTaskId, state.taskDetailMode); });
      }
    }
  });

  // Search
  document.getElementById('globalSearch').addEventListener('input',function(){state.searchQuery=this.value;renderView();});

  // Theme toggle
  document.querySelector('.theme-toggle').addEventListener('click',function(){document.body.classList.toggle('light-theme');var l=document.body.classList.contains('light-theme');localStorage.setItem('shadow-theme',l?'light':'night');var i=this.querySelector('i');if(i)i.className=l?'fa-solid fa-sun':'fa-solid fa-circle-half-stroke';});
  (function(){var s=localStorage.getItem('shadow-theme');if(s==='light'){document.body.classList.add('light-theme');var i=document.querySelector('.theme-toggle i');if(i)i.className='fa-solid fa-sun';}else if(s==='system'&&window.matchMedia&&window.matchMedia('(prefers-color-scheme: light)').matches){document.body.classList.add('light-theme');var i=document.querySelector('.theme-toggle i');if(i)i.className='fa-solid fa-sun';}})();

  function updateGroupSelects(){document.getElementById('modalGroup').innerHTML=state.groups.map(function(g){return '<option value="'+g.id+'">'+g.name+'</option>';}).join('');}

  // Settings, Workflow, Playground buttons
  var settingsBtn=document.querySelector('.right-sidebar button[title="Settings"]');
  if(settingsBtn){settingsBtn.addEventListener('click',function(){window.location.href='settings.html';});}
  var headerRight=document.querySelector('.header-right');
  if(headerRight){
    var wfBtn=document.createElement('button');wfBtn.className='icon-btn';wfBtn.title='Workflows';wfBtn.innerHTML='<i class="fa-solid fa-bolt"></i>';wfBtn.style.cssText='color:#f4b400;font-size:16px;';wfBtn.addEventListener('click',function(){window.location.href='workflow.html';});headerRight.insertBefore(wfBtn,headerRight.firstChild);
    var pgBtn=document.createElement('button');pgBtn.className='icon-btn';pgBtn.title='Playground';pgBtn.innerHTML='<i class="fa-solid fa-flask"></i>';pgBtn.style.cssText='color:#58a6ff;font-size:16px;';pgBtn.addEventListener('click',function(){window.location.href='playground.html';});headerRight.insertBefore(pgBtn,headerRight.firstChild);
  }

  // INIT
  async function init(){
    try{
      await ShadowDB.init();
      dbReady=true;
      state.tasks=await ShadowDB.Tasks.getAll();
      state.groups=await ShadowDB.Groups.getAll();
      state.tags=await ShadowDB.Tags.getAll();
      renderSidebar();
      updateGroupSelects();
      renderView();
      if(typeof ApprovalUI!=='undefined'){await ApprovalUI.init();}
      console.log('Shadow ToDo initialized -',state.tasks.length,'tasks,',state.groups.length,'groups');
    }catch(e){console.error('Init failed:',e);renderSidebar();renderView();}
  }
  ShadowDB.on('data:changed',async function(d){
    if(d&&d.entity==='tasks'){state.tasks=await ShadowDB.Tasks.getAll();}
    else if(d&&d.entity==='groups'){state.groups=await ShadowDB.Groups.getAll();}
    else if(d&&d.entity==='tags'){state.tags=await ShadowDB.Tags.getAll();}
    renderSidebar();renderView();
  });
  init();
})();
