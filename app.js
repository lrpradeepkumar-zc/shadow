// Shadow ToDo - Application Logic (ShadowDB Backend Integration)
// UPDATED: List view columns, Board->Modal popup, List->Expanded side panel
(function() {
  'use strict';

  let state = {
    tasks: [], groups: [], tags: [],
    currentView: 'agenda',
    currentViewType: 'board',
    selectedTaskId: null,
    taskDetailMode: null,
    sortBy: 'dueDate', sortDirection: 'desc', searchQuery: ''
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
  function isOverdue(ds) { return ds && new Date(ds) < new Date(); }
  function getDateCategory(ds) {
    if (!ds) return 'nodate';
    const d=new Date(ds),now=new Date(),today=new Date(now.getFullYear(),now.getMonth(),now.getDate()),
      td=new Date(d.getFullYear(),d.getMonth(),d.getDate()),diff=td-today,day=86400000;
    if(diff<0) return 'delayed'; if(diff===0) return 'today';
    if(diff<=7*day) return 'thisweek'; return 'thismonth';
  }
  function statusClass(s) { return s.toLowerCase().replace(/\s+/g,'-'); }
  function getGroupName(id) { const g=state.groups.find(g=>g.id===id); return g?g.name:'Personal tasks'; }

  function renderSidebar() {
    document.getElementById('groupsList').innerHTML = state.groups.filter(g=>g.type!=='personal').map(g=>{
      const c=state.tasks.filter(t=>t.group===g.id).length;
      return '<div class="group-item" data-group="'+g.id+'"><i class="fa-solid fa-chevron-right" style="font-size:10px"></i> '+g.name+(c?'<span class="count">'+c+'</span>':'')+'</div>';
    }).join('');
    document.getElementById('tagsList').innerHTML = state.tags.map(t=>'<div class="tag-item" data-tag="'+t.id+'"><span class="tag-dot" style="background:'+t.color+'"></span> '+t.name+'</div>').join('');
    document.getElementById('personalCount').textContent = state.tasks.filter(t=>{
      const g=state.groups.find(gr=>gr.id===t.group); return g&&g.type==='personal';
    }).length;
  }

  function renderTaskCard(t) {
    const dt=t.dueDate?'<div class="task-card-date '+(isOverdue(t.dueDate)?'overdue':'')+'"><i class="fa-regular fa-calendar"></i> '+formatDate(t.dueDate)+'</div>':'';
    const st=t.subtasks&&t.subtasks.length?'<div class="task-card-subtasks"><i class="fa-regular fa-square-check"></i> '+t.subtasks.filter(s=>s.done).length+'/'+t.subtasks.length+'</div>':'';
    return '<div class="task-card" data-taskid="'+t.id+'"><div class="task-card-title">'+(t.priority==='High'?'<span class="priority-indicator">!</span> ':'')+t.title+'</div><div class="task-card-meta"><span class="task-card-status '+statusClass(t.status)+'">'+t.status+'</span>'+(t.assignee?'<span class="task-card-assignee"><span class="avatar-sm" style="width:20px;height:20px;font-size:10px">'+t.assignee.charAt(0)+'</span> '+t.assignee+'</span>':'')+'</div>'+st+dt+'</div>';
  }

  function renderBoardView() {
    const cols=document.getElementById('boardColumns'); let tasks=getFilteredTasks();
    if (state.currentView==='agenda') {
      const cats={delayed:{label:'Delayed',class:'delayed',tasks:[]},today:{label:'Today',class:'today',tasks:[]},thisweek:{label:'This week',class:'thisweek',tasks:[]},thismonth:{label:'This month',class:'thismonth',tasks:[]}};
      tasks.forEach(t=>{const c=getDateCategory(t.dueDate);if(cats[c])cats[c].tasks.push(t);});
      cols.innerHTML=Object.values(cats).map(c=>'<div class="board-column"><div class="column-header '+c.class+'">'+c.label+(c.tasks.length?' <span class="column-count">'+c.tasks.length+'</span>':'')+'</div><div class="column-body">'+c.tasks.map(t=>renderTaskCard(t)).join('')+'</div></div>').join('');
    } else {
      const gr={}; tasks.forEach(t=>{const n=getGroupName(t.group);if(!gr[n])gr[n]=[];gr[n].push(t);});
      cols.innerHTML=Object.entries(gr).map(([n,ts])=>'<div class="board-column"><div class="column-header">'+n+' <span class="column-count">'+ts.length+'</span></div><div class="column-body">'+ts.map(t=>renderTaskCard(t)).join('')+'</div></div>').join('');
    }
  }
  // ===== LIST ROW — aligned to reference screenshot =====
  function renderListRow(t) {
    // Meta counts (subtasks, comments) — separate area in title column
    var metaCounts = '';
    var hasMeta = false;
    if (t.subtasks && t.subtasks.length) {
      metaCounts += '<span class="list-meta-count"><i class="fa-solid fa-list-check"></i> '+t.subtasks.length+'</span>';
      hasMeta = true;
    }
    // Comment count placeholder (could be added later)
    var metaHtml = hasMeta ? '<div class="list-meta-counts">'+metaCounts+'</div>' : '';

    var createdDate = t.createdAt ? formatDateFull(t.createdAt) : '';
    var category = t.category || 'General';

    return '<div class="list-row" data-taskid="'+t.id+'">' +
      '<div class="list-col title-col">' +
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

  // Compact list row for when panel is open
  function renderCompactListRow(t) {
    return '<div class="list-row' + (t.id === state.selectedTaskId ? ' active-row' : '') + '" data-taskid="'+t.id+'">' +
      '<div class="list-col title-col" style="width:100%">' +
        '<div class="check-circle"><i class="fa-solid fa-check" style="font-size:10px"></i></div>' +
        (t.priority==='High'?'<span class="priority-indicator">!</span> ':'') +
        '<span class="list-task-name">'+t.title+'</span>' +
      '</div>' +
    '</div>';
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
      lh.innerHTML =
        '<div class="list-col title-col">TASK TITLE</div>' +
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
    if (isPanelOpen) { listView.classList.add('list-with-panel'); }
    else { listView.classList.remove('list-with-panel'); }
  }
  function getFilteredTasks() {
    var tasks=[].concat(state.tasks);
    if(state.currentView==='personal'){tasks=tasks.filter(function(t){var g=state.groups.find(function(gr){return gr.id===t.group});return g&&g.type==='personal';});}
    else if(state.currentView==='createdbyme'){tasks=tasks.filter(function(t){return t.assignee==='Pradeep';});}
    else if(state.currentView==='assignedtome'){tasks=tasks.filter(function(t){return t.assignee==='Pradeep';});}
    else if(state.currentView==='myday'){var td=new Date().toISOString().split('T')[0];tasks=tasks.filter(function(t){return t.dueDate&&t.dueDate.startsWith(td);});}
    else if(state.currentView==='agenda'){tasks=tasks.filter(function(t){return t.dueDate;});}
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
    document.getElementById('subtasksList').innerHTML=(task.subtasks||[]).map(function(s){return '<div class="subtask-item"><div class="check-circle'+(s.done?' completed':'')+'" data-subtask="'+s.id+'"></div><span>'+s.title+'</span></div>';}).join('');
    document.getElementById('timelineList').innerHTML='<div class="timeline-item"><span><span class="timeline-user">'+(task.assignee||'System')+'</span> created this task.</span><span class="timeline-date">'+formatDate(task.createdAt)+'</span></div>';
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

  function hideTaskDetail() {
    document.getElementById('taskDetailPanel').style.display='none';
    document.getElementById('taskDetailModalOverlay').style.display='none';
    document.getElementById('taskDetailPanel').classList.remove('modal-mode','panel-mode');
    state.selectedTaskId=null;state.taskDetailMode=null;
    if (state.currentViewType === 'list') { renderListView(); }
  }
  // Nav items
  document.querySelectorAll('.nav-item').forEach(function(item){item.addEventListener('click',function(){document.querySelectorAll('.nav-item').forEach(function(n){n.classList.remove('active')});this.classList.add('active');state.currentView=this.dataset.view;hideTaskDetail();renderView();});});
  document.querySelectorAll('.view-tab').forEach(function(tab){tab.addEventListener('click',function(){document.querySelectorAll('.view-tab').forEach(function(t){t.classList.remove('active')});this.classList.add('active');state.currentViewType=this.dataset.viewtype;hideTaskDetail();renderView();});});

  // New Task
  document.getElementById('newTaskBtn').addEventListener('click',function(){document.getElementById('taskModal').style.display='';document.getElementById('modalTaskTitle').value='';document.getElementById('modalDescription').value='';document.getElementById('modalNotes').value='NA';document.getElementById('modalTaskTitle').focus();});
  document.getElementById('closeModalBtn').addEventListener('click',function(){document.getElementById('taskModal').style.display='none';});
  document.getElementById('cancelTaskBtn').addEventListener('click',function(){document.getElementById('taskModal').style.display='none';});

  // Save task
  document.getElementById('saveTaskBtn').addEventListener('click',async function(){
    var title=document.getElementById('modalTaskTitle').value.trim();if(!title)return;
    var gs=document.getElementById('modalGroup'),gid=gs.value?parseInt(gs.value):(state.groups.length?state.groups[0].id:null);
    try{await ShadowDB.Tasks.create({title:title,status:'Open',priority:document.getElementById('modalPriority').value,assignee:'Pradeep',group:gid,category:document.getElementById('modalCategory').value||'General',dueDate:document.getElementById('modalDueDate').value||'',startDate:document.getElementById('modalStartDate').value||'',description:document.getElementById('modalDescription').value,notes:document.getElementById('modalNotes').value,tags:[],subtasks:[],recurrence:null,reminder:null,customFields:{},completedAt:null,order:0});state.tasks=await ShadowDB.Tasks.getAll();document.getElementById('taskModal').style.display='none';renderSidebar();renderView();}catch(e){console.error('Failed:',e);}
  });

  // Task clicks
  document.getElementById('boardColumns').addEventListener('click',function(e){var c=e.target.closest('.task-card');if(c)showTaskDetail(parseInt(c.dataset.taskid),'modal');});
  document.getElementById('listBody').addEventListener('click',function(e){var r=e.target.closest('.list-row');if(r)showTaskDetail(parseInt(r.dataset.taskid),'panel');});
  document.getElementById('closeDetailBtn').addEventListener('click',hideTaskDetail);
  document.getElementById('taskDetailModalOverlay').addEventListener('click',hideTaskDetail);

  // Sort
  document.getElementById('sortBtn').addEventListener('click',function(){var dd=document.getElementById('sortDropdown'),r=this.getBoundingClientRect();dd.style.top=r.bottom+4+'px';dd.style.left=r.left+'px';dd.style.display=dd.style.display==='none'?'':'none';});
  document.getElementById('sortDropdown').addEventListener('click',function(e){var i=e.target.closest('.dropdown-item');if(!i)return;if(i.dataset.sort){state.sortBy=i.dataset.sort;document.querySelector('.sort-badge').textContent=i.textContent.toUpperCase();}if(i.dataset.direction){state.sortDirection=i.dataset.direction;document.querySelector('.sort-direction').textContent=i.dataset.direction==='desc'?'Newest on top':'Oldest on top';}this.style.display='none';renderView();});

  // Status & Priority dropdowns
  document.getElementById('detailStatusBtn').addEventListener('click',function(){var dd=document.getElementById('statusDropdown'),r=this.getBoundingClientRect();dd.style.top=r.bottom+4+'px';dd.style.left=r.left+'px';dd.style.display=dd.style.display==='none'?'':'none';});
  document.getElementById('statusDropdown').addEventListener('click',async function(e){var i=e.target.closest('.status-option');if(!i)return;var ns=i.dataset.status,task=state.tasks.find(function(t){return t.id===state.selectedTaskId;});if(task){task.status=ns;try{await ShadowDB.Tasks.update(task);state.tasks=await ShadowDB.Tasks.getAll();}catch(e){}document.getElementById('detailStatusBtn').textContent=ns;document.getElementById('detailStatusBtn').className='status-btn '+statusClass(ns);renderView();}this.style.display='none';});
  document.getElementById('detailPriority').addEventListener('click',function(){var dd=document.getElementById('priorityDropdown'),r=this.getBoundingClientRect();dd.style.top=r.bottom+4+'px';dd.style.left=r.left+'px';dd.style.display=dd.style.display==='none'?'':'none';});
  document.getElementById('priorityDropdown').addEventListener('click',async function(e){var i=e.target.closest('.priority-option');if(!i)return;var np=i.dataset.priority,task=state.tasks.find(function(t){return t.id===state.selectedTaskId;});if(task){task.priority=np;try{await ShadowDB.Tasks.update(task);state.tasks=await ShadowDB.Tasks.getAll();}catch(e){}document.getElementById('detailPriority').innerHTML='<i class="fa-solid fa-exclamation"></i> '+np;renderView();}this.style.display='none';});

  // Groups & Tags
  document.getElementById('addGroupBtn').addEventListener('click',function(){document.getElementById('groupModal').style.display='';document.getElementById('groupNameInput').value='';document.getElementById('groupNameInput').focus();});
  document.getElementById('cancelGroupBtn').addEventListener('click',function(){document.getElementById('groupModal').style.display='none';});
  document.getElementById('saveGroupBtn').addEventListener('click',async function(){var n=document.getElementById('groupNameInput').value.trim();if(!n)return;try{await ShadowDB.Groups.create({name:n,description:'',color:'#4285f4',type:'org-email',streams:true,hidden:false,categories:['General'],statuses:['Open','In Progress','Completed'],icon:null,order:0});state.groups=await ShadowDB.Groups.getAll();document.getElementById('groupModal').style.display='none';renderSidebar();updateGroupSelects();}catch(e){console.error(e);}});
  document.getElementById('addTagBtn').addEventListener('click',function(){document.getElementById('tagModal').style.display='';document.getElementById('tagNameInput').value='';document.getElementById('tagNameInput').focus();});
  document.getElementById('cancelTagBtn').addEventListener('click',function(){document.getElementById('tagModal').style.display='none';});
  var selectedTagColor='#e67e22';
  document.querySelectorAll('.color-dot').forEach(function(d){d.addEventListener('click',function(){document.querySelectorAll('.color-dot').forEach(function(x){x.classList.remove('selected')});this.classList.add('selected');selectedTagColor=this.dataset.color;});});
  document.getElementById('saveTagBtn').addEventListener('click',async function(){var n=document.getElementById('tagNameInput').value.trim();if(!n)return;try{await ShadowDB.Tags.create({name:n,color:selectedTagColor});state.tags=await ShadowDB.Tags.getAll();document.getElementById('tagModal').style.display='none';renderSidebar();}catch(e){console.error(e);}});

  // Close dropdowns
  document.addEventListener('click',function(e){if(!e.target.closest('#sortBtn')&&!e.target.closest('#sortDropdown'))document.getElementById('sortDropdown').style.display='none';if(!e.target.closest('#detailStatusBtn')&&!e.target.closest('#statusDropdown'))document.getElementById('statusDropdown').style.display='none';if(!e.target.closest('#detailPriority')&&!e.target.closest('#priorityDropdown'))document.getElementById('priorityDropdown').style.display='none';});
  // Subtasks & Comments
  document.getElementById('subtasksList').addEventListener('click',async function(e){var c=e.target.closest('.check-circle');if(!c||!c.dataset.subtask)return;var task=state.tasks.find(function(t){return t.id===state.selectedTaskId;});if(task){var s=task.subtasks.find(function(x){return x.id===c.dataset.subtask;});if(s){s.done=!s.done;try{await ShadowDB.Tasks.update(task);state.tasks=await ShadowDB.Tasks.getAll();}catch(e){}showTaskDetail(state.selectedTaskId,state.taskDetailMode);renderView();}}});
  document.getElementById('newSubtaskInput').addEventListener('keydown',async function(e){if(e.key==='Enter'&&this.value.trim()&&state.selectedTaskId){var task=state.tasks.find(function(t){return t.id===state.selectedTaskId;});if(task){if(!task.subtasks)task.subtasks=[];task.subtasks.push({id:'s'+Date.now(),title:this.value.trim(),done:false});this.value='';try{await ShadowDB.Tasks.update(task);state.tasks=await ShadowDB.Tasks.getAll();}catch(e){}showTaskDetail(state.selectedTaskId,state.taskDetailMode);renderView();}}});
  document.getElementById('commentInput').addEventListener('keydown',async function(e){if(e.key==='Enter'&&this.value.trim()){var c=this.value.trim();this.value='';if(state.selectedTaskId){try{await ShadowDB.Comments.create({taskId:state.selectedTaskId,text:c,author:'Pradeep'});}catch(e){}}}});

  // Detail field updates
  document.getElementById('detailDescription').addEventListener('change',async function(){var t=state.tasks.find(function(x){return x.id===state.selectedTaskId;});if(t){t.description=this.value;try{await ShadowDB.Tasks.update(t);state.tasks=await ShadowDB.Tasks.getAll();}catch(e){}}});
  document.getElementById('detailNotes').addEventListener('change',async function(){var t=state.tasks.find(function(x){return x.id===state.selectedTaskId;});if(t){t.notes=this.value;try{await ShadowDB.Tasks.update(t);state.tasks=await ShadowDB.Tasks.getAll();}catch(e){}}});
  document.getElementById('detailTaskTitle').addEventListener('blur',async function(){var t=state.tasks.find(function(x){return x.id===state.selectedTaskId;});if(t){t.title=this.textContent;try{await ShadowDB.Tasks.update(t);state.tasks=await ShadowDB.Tasks.getAll();}catch(e){}renderView();}});

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
    try{await ShadowDB.init();dbReady=true;state.tasks=await ShadowDB.Tasks.getAll();state.groups=await ShadowDB.Groups.getAll();state.tags=await ShadowDB.Tags.getAll();renderSidebar();updateGroupSelects();renderView();if(typeof ApprovalUI!=='undefined'){await ApprovalUI.init();}console.log('Shadow ToDo initialized -',state.tasks.length,'tasks,',state.groups.length,'groups');}catch(e){console.error('Init failed:',e);renderSidebar();renderView();}
  }

  ShadowDB.on('data:changed',async function(d){if(d&&d.entity==='tasks'){state.tasks=await ShadowDB.Tasks.getAll();}else if(d&&d.entity==='groups'){state.groups=await ShadowDB.Groups.getAll();}else if(d&&d.entity==='tags'){state.tags=await ShadowDB.Tags.getAll();}renderSidebar();renderView();});

  init();
})();
