// Shadow ToDo - Application Logic
(function() {
  'use strict';

  // ===== DATA STORE =====
  let state = {
    tasks: [],
    groups: [
      { id: 'personal', name: 'Personal tasks', categories: ['General', 'My tasks'], color: '#4285f4' },
      { id: 'g1', name: 'ZMClient', categories: ['General', 'Task', 'Notes'], color: '#ea4335' },
      { id: 'g2', name: 'Mail suite-Calendar', categories: ['General', 'Calendar', 'Event'], color: '#e91e63' },
      { id: 'g3', name: 'ZMC Team', categories: ['General', 'WCAG'], color: '#9b59b6' }
    ],
    tags: [
      { id: 't1', name: 'P1 Items', color: '#e67e22' },
      { id: 't2', name: 'General Notes', color: '#e67e22' },
      { id: 't3', name: 'HR', color: '#e67e22' },
      { id: 't4', name: 'IP notes', color: '#e74c3c' },
      { id: 't5', name: 'Task Items in progress', color: '#9b59b6' },
      { id: 't6', name: 'Task Notes', color: '#2ecc71' },
      { id: 't7', name: 'Task QA - Items', color: '#e67e22' },
      { id: 't8', name: 'Task Enhancement', color: '#3498db' }
    ],
    currentView: 'agenda',
    currentViewType: 'board',
    selectedTaskId: null,
    sortBy: 'dueDate',
    sortDirection: 'desc',
    nextTaskId: 100
  };

  // Sample tasks
  const sampleTasks = [
    { id: 1, title: 'Overdue date', status: 'Open', priority: 'High', assignee: 'Pradeep', group: 'personal', category: 'General', dueDate: '2026-03-19', startDate: '2026-03-12', description: '', notes: 'NA', subtasks: [], tags: [], createdAt: '2026-03-11T11:59:00', createdBy: 'Pradeep' },
    { id: 2, title: 'Server', status: 'Open', priority: 'Medium', assignee: 'Pradeep', group: 'personal', category: 'General', dueDate: '2026-03-19', startDate: '', description: '', notes: 'NA', subtasks: [], tags: [], createdAt: '2026-03-15T10:00:00', createdBy: 'Pradeep' },
    { id: 3, title: 'HTML', status: 'Open', priority: 'Medium', assignee: 'Pradeep', group: 'personal', category: 'General', dueDate: '2026-03-19', startDate: '', description: '', notes: 'NA', subtasks: [], tags: [], createdAt: '2026-03-16T10:00:00', createdBy: 'Pradeep' },
    { id: 4, title: 'Analysis - <Feature Name>', status: 'Open', priority: 'Medium', assignee: 'Pradeep', group: 'personal', category: 'General', dueDate: '2026-03-19', startDate: '', description: '', notes: 'NA', subtasks: [{id: 's1', title: 'Sub 1', done: false},{id: 's2', title: 'Sub 2', done: false},{id: 's3', title: 'Sub 3', done: false},{id: 's4', title: 'Sub 4', done: false},{id: 's5', title: 'Sub 5', done: false}], tags: [], createdAt: '2026-03-17T10:00:00', createdBy: 'Pradeep' },
    { id: 5, title: 'Task', status: 'Open', priority: 'High', assignee: 'Pradeep', group: 'personal', category: 'General', dueDate: '2026-03-11T14:50:00', startDate: '', description: '', notes: 'NA', subtasks: [], tags: [], createdAt: '2026-03-10T10:00:00', createdBy: 'Pradeep' },
    { id: 6, title: 'Client', status: 'Open', priority: 'Medium', assignee: 'Pradeep', group: 'personal', category: 'General', dueDate: '2026-02-27', startDate: '', description: '', notes: 'NA', subtasks: [], tags: [], createdAt: '2026-02-25T10:00:00', createdBy: 'Pradeep' },
    { id: 7, title: 'Design', status: 'Open', priority: 'Medium', assignee: 'Pradeep', group: 'personal', category: 'General', dueDate: '2026-02-27', startDate: '', description: '', notes: 'NA', subtasks: [], tags: [], createdAt: '2026-02-24T10:00:00', createdBy: 'Pradeep' },
    { id: 8, title: 'Recur', status: 'Open', priority: 'Medium', assignee: 'Pradeep', group: 'personal', category: 'General', dueDate: '', startDate: '', description: '', notes: 'NA', subtasks: [], tags: [], createdAt: '2026-03-14T10:00:00', createdBy: 'Pradeep' },
    { id: 9, title: 'Unified Agenda Sync [ Design ]', status: 'Open', priority: 'Medium', assignee: '', group: 'g1', category: 'General', dueDate: '', startDate: '', description: '', notes: 'NA', subtasks: [], tags: [], createdAt: '2026-03-20T10:00:00', createdBy: 'Pradeep' },
    { id: 10, title: 'Unified Agenda Sync [ Server ]', status: 'Open', priority: 'Medium', assignee: 'Pradeep', group: 'g1', category: 'General', dueDate: '', startDate: '', description: '', notes: 'NA', subtasks: [], tags: [], createdAt: '2026-03-20T11:00:00', createdBy: 'Pradeep' },
    { id: 11, title: 'Google Interoperability - [Help]', status: 'Open', priority: 'Medium', assignee: 'Pradeep', group: 'g2', category: 'General', dueDate: '', startDate: '', description: '', notes: 'NA', subtasks: [], tags: [], createdAt: '2026-03-18T10:00:00', createdBy: 'Pradeep' },
    { id: 12, title: 'Co-Host - Attendee View permission handling', status: 'Open', priority: 'Medium', assignee: 'Pradeep', group: 'g2', category: 'General', dueDate: '', startDate: '', description: '', notes: 'NA', subtasks: [{id: 's6', title: 'Review permissions', done: false}], tags: [], createdAt: '2026-03-17T10:00:00', createdBy: 'Pradeep' },
    { id: 13, title: 'Meeting noted at 5PM tomorrow.', status: 'Open', priority: 'Medium', assignee: 'Pradeep', group: 'personal', category: 'General', dueDate: '2026-09-09', startDate: '', description: '', notes: 'NA', subtasks: [{id: 's7', title: 'Prepare agenda', done: false}], tags: ['t2'], createdAt: '2025-09-08T10:00:00', createdBy: 'Pradeep' },
    { id: 14, title: 'test', status: 'Open', priority: 'Medium', assignee: 'Pradeep', group: 'personal', category: 'General', dueDate: '2025-10-10', startDate: '', description: '', notes: 'NA', subtasks: [], tags: [], createdAt: '2025-10-09T10:00:00', createdBy: 'Pradeep' }
  ];
  state.tasks = sampleTasks;

  // ===== HELPER FUNCTIONS =====
  function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return d.getDate() + ' ' + months[d.getMonth()] + ' ' + d.getFullYear();
  }

  function isOverdue(dateStr) {
    if (!dateStr) return false;
    return new Date(dateStr) < new Date();
  }

  function getDateCategory(dateStr) {
    if (!dateStr) return 'nodate';
    const d = new Date(dateStr);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const taskDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const diff = taskDate - today;
    const dayMs = 86400000;
    if (diff < 0) return 'delayed';
    if (diff === 0) return 'today';
    if (diff <= 7 * dayMs) return 'thisweek';
    return 'thismonth';
  }

  function statusClass(status) {
    return status.toLowerCase().replace(/\s+/g, '-');
  }

  function getGroupName(groupId) {
    const g = state.groups.find(g => g.id === groupId);
    return g ? g.name : groupId;
  }

  // ===== RENDER FUNCTIONS =====
  function renderSidebar() {
    const groupsList = document.getElementById('groupsList');
    groupsList.innerHTML = state.groups.filter(g => g.id !== 'personal').map(g => {
      const count = state.tasks.filter(t => t.group === g.id).length;
      return '<div class="group-item" data-group="' + g.id + '"><i class="fa-solid fa-chevron-right" style="font-size:10px"></i> ' + g.name + (count ? ' <span class="count">' + count + '</span>' : '') + '</div>';
    }).join('');

    const tagsList = document.getElementById('tagsList');
    tagsList.innerHTML = state.tags.map(t => 
      '<div class="tag-item" data-tag="' + t.id + '"><span class="tag-dot" style="background:' + t.color + '"></span> ' + t.name + '</div>'
    ).join('');

    const personalCount = state.tasks.filter(t => t.group === 'personal').length;
    document.getElementById('personalCount').textContent = personalCount;
  }

  function renderBoardView() {
    const columns = document.getElementById('boardColumns');
    let tasks = getFilteredTasks();
    
    if (state.currentView === 'agenda') {
      const categories = {
        delayed: { label: 'Delayed', class: 'delayed', tasks: [] },
        today: { label: 'Today', class: 'today', tasks: [] },
        thisweek: { label: 'This week', class: 'thisweek', tasks: [] },
        thismonth: { label: 'This month', class: 'thismonth', tasks: [] }
      };
      tasks.forEach(t => {
        const cat = getDateCategory(t.dueDate);
        if (categories[cat]) categories[cat].tasks.push(t);
      });
      columns.innerHTML = Object.values(categories).map(cat =>
        '<div class="board-column"><div class="column-header ' + cat.class + '">' + cat.label + (cat.tasks.length ? ' <span class="column-count">' + cat.tasks.length + '</span>' : '') + '</div><div class="column-body">' + cat.tasks.map(t => renderTaskCard(t)).join('') + '</div></div>'
      ).join('');
    } else {
      const grouped = {};
      tasks.forEach(t => {
        const gName = getGroupName(t.group);
        if (!grouped[gName]) grouped[gName] = [];
        grouped[gName].push(t);
      });
      columns.innerHTML = Object.entries(grouped).map(([name, tasks]) =>
        '<div class="board-column"><div class="column-header">' + name + ' <span class="column-count">' + tasks.length + '</span></div><div class="column-body">' + tasks.map(t => renderTaskCard(t)).join('') + '</div></div>'
      ).join('');
    }
  }

  function renderTaskCard(task) {
    const priorityIcon = task.priority === 'High' ? '<span class="priority-indicator high">!</span>' : (task.priority === 'Low' ? '<span class="priority-indicator low">!</span>' : '');
    const subtaskHtml = task.subtasks.length ? '<div class="subtask-count"><i class="fa-regular fa-square-check"></i> ' + task.subtasks.length + '</div>' : '';
    const dateHtml = task.dueDate ? '<div class="task-card-date' + (isOverdue(task.dueDate) ? ' overdue' : '') + '"><i class="fa-regular fa-calendar"></i> ' + formatDate(task.dueDate) + '</div>' : '';
    
    return '<div class="task-card" data-taskid="' + task.id + '">' +
      '<div class="task-card-title">' + priorityIcon + ' ' + task.title + '</div>' +
      '<div class="task-card-meta"><span class="task-card-status ' + statusClass(task.status) + '">' + task.status + '</span>' +
      (task.assignee ? '<span class="task-card-assignee"><span class="avatar-sm" style="width:20px;height:20px;font-size:10px">' + task.assignee.charAt(0) + '</span> ' + task.assignee + '</span>' : '') +
      '</div>' + subtaskHtml + dateHtml + '</div>';
  }

  function renderListView() {
    const listBody = document.getElementById('listBody');
    let tasks = getFilteredTasks();
    
    if (state.currentView === 'agenda') {
      const categories = { delayed: [], today: [], thisweek: [], thismonth: [] };
      const labels = { delayed: 'Delayed', today: 'Today', thisweek: 'This week', thismonth: 'This month' };
      const colors = { delayed: '#34a853', today: '#ea4335', thisweek: '#e91e63', thismonth: '#4285f4' };
      tasks.forEach(t => {
        const cat = getDateCategory(t.dueDate);
        if (categories[cat]) categories[cat].push(t);
      });
      let html = '';
      Object.entries(categories).forEach(([key, tasks]) => {
        if (tasks.length || key === 'delayed') {
          html += '<div class="list-group-header"><div class="check-circle"></div><div class="group-color" style="background:' + colors[key] + '"></div>' + labels[key] + ' ' + tasks.length + '</div>';
          tasks.forEach(t => { html += renderListRow(t); });
        }
      });
      listBody.innerHTML = html;
    } else {
      const grouped = {};
      tasks.forEach(t => {
        const gName = t.category || 'General';
        if (!grouped[gName]) grouped[gName] = [];
        grouped[gName].push(t);
      });
      let html = '';
      Object.entries(grouped).forEach(([name, tasks]) => {
        html += '<div class="list-group-header"><div class="check-circle"></div><div class="group-color" style="background:#e67e22"></div>' + name + ' ' + tasks.length + '</div>';
        tasks.forEach(t => { html += renderListRow(t); });
      });
      listBody.innerHTML = html;
    }
  }

  function renderListRow(task) {
    const priorityIcon = task.priority === 'High' ? '<span class="priority-indicator high" style="font-size:14px">!</span> ' : '';
    const tagHtml = task.tags.map(tid => {
      const tag = state.tags.find(t => t.id === tid);
      return tag ? '<span class="tag-badge" style="background:' + tag.color + '33;color:' + tag.color + '">' + tag.name.substring(0,12) + '</span>' : '';
    }).join('');
    
    return '<div class="list-row" data-taskid="' + task.id + '">' +
      '<div class="list-col task-title-col"><div class="check-circle"></div>' + priorityIcon + task.title + (tagHtml ? ' ' + tagHtml : '') +
      (task.subtasks.length ? ' <span class="subtask-count"><i class="fa-regular fa-square-check"></i> ' + task.subtasks.length + '</span>' : '') + '</div>' +
      '<div class="list-col assignee-col">' + (task.assignee ? '<span class="avatar-sm" style="width:22px;height:22px;font-size:10px">' + task.assignee.charAt(0) + '</span> ' + task.assignee : '') + '</div>' +
      '<div class="list-col status-col"><span class="status-badge ' + statusClass(task.status) + '">' + task.status + '</span></div>' +
      '<div class="list-col due-date-col">' + (task.dueDate ? '<i class="fa-regular fa-calendar"></i> ' + formatDate(task.dueDate) : '') + '</div></div>';
  }

  function getFilteredTasks() {
    let tasks = [...state.tasks];
    if (state.currentView === 'personal') tasks = tasks.filter(t => t.group === 'personal');
    else if (state.currentView === 'createdbyme') tasks = tasks.filter(t => t.createdBy === 'Pradeep');
    else if (state.currentView === 'assignedtome') tasks = tasks.filter(t => t.assignee === 'Pradeep');
    else if (state.currentView === 'myday') {
      const today = new Date().toISOString().split('T')[0];
      tasks = tasks.filter(t => t.dueDate && t.dueDate.startsWith(today));
    }
    else if (state.currentView === 'agenda') tasks = tasks.filter(t => t.dueDate);

    // Sort
    tasks.sort((a, b) => {
      let va = a[state.sortBy] || '';
      let vb = b[state.sortBy] || '';
      if (state.sortBy === 'priority') {
        const prio = { High: 3, Medium: 2, Low: 1, None: 0 };
        va = prio[a.priority] || 0;
        vb = prio[b.priority] || 0;
      }
      const cmp = va > vb ? 1 : va < vb ? -1 : 0;
      return state.sortDirection === 'desc' ? -cmp : cmp;
    });
    return tasks;
  }

  function renderView() {
    if (state.currentViewType === 'board') {
      document.getElementById('boardView').style.display = '';
      document.getElementById('listView').style.display = 'none';
      renderBoardView();
    } else {
      document.getElementById('boardView').style.display = 'none';
      document.getElementById('listView').style.display = '';
      renderListView();
    }
    updateStats();
  }

  function updateStats() {
    const tasks = getFilteredTasks();
    document.getElementById('statsCount').textContent = tasks.length;
  }

  function showTaskDetail(taskId) {
    const task = state.tasks.find(t => t.id === taskId);
    if (!task) return;
    state.selectedTaskId = taskId;
    const panel = document.getElementById('taskDetailPanel');
    panel.style.display = '';
    
    document.getElementById('detailTaskTitle').textContent = task.title;
    document.getElementById('detailStatusBtn').textContent = task.status;
    document.getElementById('detailStatusBtn').className = 'status-btn ' + statusClass(task.status);
    document.getElementById('detailAssigneeName').textContent = task.assignee || 'Unassigned';
    document.getElementById('detailStartDate').textContent = task.startDate ? formatDate(task.startDate) : 'Yet to set';
    document.getElementById('detailDueDate').textContent = task.dueDate ? formatDate(task.dueDate) : 'Yet to set';
    document.getElementById('detailGroup').textContent = getGroupName(task.group);
    document.getElementById('detailCategory').textContent = task.category;
    document.getElementById('detailPriority').innerHTML = '<i class="fa-solid fa-exclamation"></i> ' + task.priority;
    document.getElementById('detailDescription').value = task.description || '';
    document.getElementById('detailNotes').value = task.notes || 'NA';

    // Subtasks
    const subtasksList = document.getElementById('subtasksList');
    subtasksList.innerHTML = task.subtasks.map(s =>
      '<div class="subtask-item"><div class="check-circle' + (s.done ? ' completed' : '') + '" data-subtask="' + s.id + '"></div><span>' + s.title + '</span></div>'
    ).join('');

    // Timeline
    const timelineList = document.getElementById('timelineList');
    timelineList.innerHTML = '<div class="timeline-item"><span><span class="timeline-user">' + task.createdBy + '</span> created this task.</span><span class="timeline-date">' + formatDate(task.createdAt) + '</span></div>';
  }

  function hideTaskDetail() {
    document.getElementById('taskDetailPanel').style.display = 'none';
    state.selectedTaskId = null;
  }

  // ===== EVENT LISTENERS =====
  // Nav items
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', function() {
      document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
      this.classList.add('active');
      state.currentView = this.dataset.view;
      const titleMap = { agenda: 'Agenda', myday: 'My Day', createdbyme: 'Created by Me', assignedtome: 'Assigned to me', sharedwithme: 'Shared with me', personal: 'Personal tasks', unified: 'Unified view' };
      document.getElementById('viewTitle').textContent = titleMap[state.currentView] || 'ToDo';
      hideTaskDetail();
      renderView();
    });
  });

  // View tabs (Board/List)
  document.querySelectorAll('.view-tab').forEach(tab => {
    tab.addEventListener('click', function() {
      document.querySelectorAll('.view-tab').forEach(t => t.classList.remove('active'));
      this.classList.add('active');
      state.currentViewType = this.dataset.viewtype;
      renderView();
    });
  });

  // New Task
  document.getElementById('newTaskBtn').addEventListener('click', function() {
    document.getElementById('taskModal').style.display = '';
    document.getElementById('modalTaskTitle').value = '';
    document.getElementById('modalDescription').value = '';
    document.getElementById('modalNotes').value = 'NA';
    document.getElementById('modalTaskTitle').focus();
  });

  // Close modal
  document.getElementById('closeModalBtn').addEventListener('click', () => {
    document.getElementById('taskModal').style.display = 'none';
  });
  document.getElementById('cancelTaskBtn').addEventListener('click', () => {
    document.getElementById('taskModal').style.display = 'none';
  });

  // Save task
  document.getElementById('saveTaskBtn').addEventListener('click', function() {
    const title = document.getElementById('modalTaskTitle').value.trim();
    if (!title) return;
    const newTask = {
      id: state.nextTaskId++,
      title: title,
      status: 'Open',
      priority: document.getElementById('modalPriority').value,
      assignee: 'Pradeep',
      group: document.getElementById('modalGroup').value,
      category: document.getElementById('modalCategory').value,
      dueDate: document.getElementById('modalDueDate').value || '',
      startDate: document.getElementById('modalStartDate').value || '',
      description: document.getElementById('modalDescription').value,
      notes: document.getElementById('modalNotes').value,
      subtasks: [],
      tags: [],
      createdAt: new Date().toISOString(),
      createdBy: 'Pradeep'
    };
    state.tasks.unshift(newTask);
    document.getElementById('taskModal').style.display = 'none';
    renderSidebar();
    renderView();
  });

  // Task click (board)
  document.getElementById('boardColumns').addEventListener('click', function(e) {
    const card = e.target.closest('.task-card');
    if (card) showTaskDetail(parseInt(card.dataset.taskid));
  });

  // Task click (list)
  document.getElementById('listBody').addEventListener('click', function(e) {
    const row = e.target.closest('.list-row');
    if (row) showTaskDetail(parseInt(row.dataset.taskid));
  });

  // Close detail
  document.getElementById('closeDetailBtn').addEventListener('click', hideTaskDetail);

  // Sort button
  document.getElementById('sortBtn').addEventListener('click', function(e) {
    const dd = document.getElementById('sortDropdown');
    const rect = this.getBoundingClientRect();
    dd.style.top = rect.bottom + 4 + 'px';
    dd.style.left = rect.left + 'px';
    dd.style.display = dd.style.display === 'none' ? '' : 'none';
  });

  // Sort options
  document.getElementById('sortDropdown').addEventListener('click', function(e) {
    const item = e.target.closest('.dropdown-item');
    if (!item) return;
    if (item.dataset.sort) {
      state.sortBy = item.dataset.sort;
      document.querySelector('.sort-badge').textContent = item.textContent.toUpperCase();
    }
    if (item.dataset.direction) {
      state.sortDirection = item.dataset.direction;
      document.querySelector('.sort-direction').textContent = item.dataset.direction === 'desc' ? 'Newest on top' : 'Oldest on top';
    }
    this.style.display = 'none';
    renderView();
  });

  // Add group
  document.getElementById('addGroupBtn').addEventListener('click', function() {
    document.getElementById('groupModal').style.display = '';
    document.getElementById('groupNameInput').value = '';
    document.getElementById('groupNameInput').focus();
  });
  document.getElementById('cancelGroupBtn').addEventListener('click', () => {
    document.getElementById('groupModal').style.display = 'none';
  });
  document.getElementById('saveGroupBtn').addEventListener('click', function() {
    const name = document.getElementById('groupNameInput').value.trim();
    if (!name) return;
    state.groups.push({ id: 'g' + Date.now(), name: name, categories: ['General'], color: '#4285f4' });
    document.getElementById('groupModal').style.display = 'none';
    renderSidebar();
    // Update modal selects
    updateGroupSelects();
  });

  // Add tag
  document.getElementById('addTagBtn').addEventListener('click', function() {
    document.getElementById('tagModal').style.display = '';
    document.getElementById('tagNameInput').value = '';
    document.getElementById('tagNameInput').focus();
  });
  document.getElementById('cancelTagBtn').addEventListener('click', () => {
    document.getElementById('tagModal').style.display = 'none';
  });
  let selectedTagColor = '#e67e22';
  document.querySelectorAll('.color-dot').forEach(dot => {
    dot.addEventListener('click', function() {
      document.querySelectorAll('.color-dot').forEach(d => d.classList.remove('selected'));
      this.classList.add('selected');
      selectedTagColor = this.dataset.color;
    });
  });
  document.getElementById('saveTagBtn').addEventListener('click', function() {
    const name = document.getElementById('tagNameInput').value.trim();
    if (!name) return;
    state.tags.push({ id: 't' + Date.now(), name: name, color: selectedTagColor });
    document.getElementById('tagModal').style.display = 'none';
    renderSidebar();
  });

  // Close dropdowns on click outside
  document.addEventListener('click', function(e) {
    if (!e.target.closest('#sortBtn') && !e.target.closest('#sortDropdown')) {
      document.getElementById('sortDropdown').style.display = 'none';
    }
  });

  // Modal overlay close
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', function(e) {
      if (e.target === this) this.style.display = 'none';
    });
  });

  // Subtask input
  document.getElementById('newSubtaskInput').addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && this.value.trim() && state.selectedTaskId) {
      const task = state.tasks.find(t => t.id === state.selectedTaskId);
      if (task) {
        task.subtasks.push({ id: 's' + Date.now(), title: this.value.trim(), done: false });
        this.value = '';
        showTaskDetail(state.selectedTaskId);
        renderView();
      }
    }
  });

  // Comment input
  document.getElementById('commentInput').addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && this.value.trim()) {
      this.value = '';
    }
  });

  // Detail field updates
  document.getElementById('detailDescription').addEventListener('change', function() {
    const task = state.tasks.find(t => t.id === state.selectedTaskId);
    if (task) task.description = this.value;
  });
  document.getElementById('detailNotes').addEventListener('change', function() {
    const task = state.tasks.find(t => t.id === state.selectedTaskId);
    if (task) task.notes = this.value;
  });
  document.getElementById('detailTaskTitle').addEventListener('blur', function() {
    const task = state.tasks.find(t => t.id === state.selectedTaskId);
    if (task) { task.title = this.textContent; renderView(); }
  });

  // Search
  document.getElementById('globalSearch').addEventListener('input', function() {
    // Simple search filter - re-render with filtered tasks
    renderView();
  });

  // Theme toggle
  document.getElementById('themeToggle').addEventListener('click', function() {
    document.body.classList.toggle('light-theme');
  });

  function updateGroupSelects() {
    const selects = [document.getElementById('modalGroup')];
    selects.forEach(sel => {
      sel.innerHTML = state.groups.map(g => '<option value="' + g.id + '">' + g.name + '</option>').join('');
    });
  }

  // ===== INITIALIZATION =====
  function init() {
    renderSidebar();
    updateGroupSelects();
    renderView();
  }

      // Settings button - navigate to settings page
      var settingsBtn = document.querySelector('.sidebar-icons button[title="Settings"]');
      if (settingsBtn) {
                settingsBtn.addEventListener('click', function() {
                              window.location.href = 'settings.html';
                });
      }

  init();
})();
