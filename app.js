// Shadow ToDo - Application Logic (ShadowDB Backend Integration)
(function() {
    'use strict';

   // ===== LOCAL STATE (synced from ShadowDB) =====
   let state = {
         tasks: [],
         groups: [],
         tags: [],
         currentView: 'agenda',
         currentViewType: 'board',
         selectedTaskId: null,
         sortBy: 'dueDate',
         sortDirection: 'desc',
         searchQuery: ''
   };

   let dbReady = false;

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
         return g ? g.name : 'Personal tasks';
   }

   function getGroupColor(groupId) {
         const g = state.groups.find(g => g.id === groupId);
         return g ? g.color : '#4285f4';
   }

   // ===== RENDER FUNCTIONS =====
   function renderSidebar() {
         const groupsList = document.getElementById('groupsList');
         groupsList.innerHTML = state.groups.filter(g => g.type !== 'personal').map(g => {
                 const count = state.tasks.filter(t => t.group === g.id).length;
                 return '<div class="group-item" data-group="' + g.id + '"><i class="fa-solid fa-chevron-right" style="font-size:10px"></i> ' + g.name + (count ? '<span class="count">' + count + '</span>' : '') + '</div>';
         }).join('');

      const tagsList = document.getElementById('tagsList');
         tagsList.innerHTML = state.tags.map(t =>
                 '<div class="tag-item" data-tag="' + t.id + '"><span class="tag-dot" style="background:' + t.color + '"></span> ' + t.name + '</div>'
                                                 ).join('');

      const personalCount = state.tasks.filter(t => {
              const g = state.groups.find(gr => gr.id === t.group);
              return g && g.type === 'personal';
      }).length;
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
         const dateHtml = task.dueDate ? '<div class="task-card-date ' + (isOverdue(task.dueDate) ? 'overdue' : '') + '"><i class="fa-regular fa-calendar"></i> ' + formatDate(task.dueDate) + '</div>' : '';
         const subtaskHtml = task.subtasks && task.subtasks.length ? '<div class="task-card-subtasks"><i class="fa-regular fa-square-check"></i> ' + task.subtasks.filter(s => s.done).length + '/' + task.subtasks.length + '</div>' : '';
         return '<div class="task-card" data-taskid="' + task.id + '">' +
                 '<div class="task-card-title">' + (task.priority === 'High' ? '<span class="priority-indicator">!</span> ' : '') + task.title + '</div>' +
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
                                    html += '<div class="list-group-header"><div class="check-circle"></div><div class="group-color" style="background:' + colors[key] + '"></div>' + labels[key] + '</div>';
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
                        html += '<div class="list-group-header"><div class="check-circle"></div><div class="group-color" style="background:#e67e22"></div>' + name + '</div>';
                        tasks.forEach(t => { html += renderListRow(t); });
              });
              listBody.innerHTML = html;
      }
   }

   function renderListRow(task) {
         return '<div class="list-row" data-taskid="' + task.id + '">' +
                 '<div class="list-col title-col"><div class="check-circle"></div>' + (task.priority === 'High' ? '<span class="priority-indicator">!</span> ' : '') + task.title +
                 (task.subtasks && task.subtasks.length ? ' <span class="subtask-count"><i class="fa-regular fa-square-check"></i> ' + task.subtasks.filter(s=>s.done).length + '/' + task.subtasks.length + '</span>' : '') + '</div>' +
                 '<div class="list-col assignee-col">' + (task.assignee ? '<span class="avatar-sm" style="width:22px;height:22px;font-size:10px">' + task.assignee.charAt(0) + '</span> ' + task.assignee : '') + '</div>' +
                 '<div class="list-col status-col"><span class="status-badge ' + statusClass(task.status) + '">' + task.status + '</span></div>' +
                 '<div class="list-col due-date-col">' + (task.dueDate ? '<i class="fa-regular fa-calendar"></i> ' + formatDate(task.dueDate) : '') + '</div></div>';
   }

   // ===== FILTERING & SORTING =====
   function getFilteredTasks() {
         let tasks = [...state.tasks];
         // View filter
      if (state.currentView === 'personal') {
              tasks = tasks.filter(t => {
                        const g = state.groups.find(gr => gr.id === t.group);
                        return g && g.type === 'personal';
              });
      } else if (state.currentView === 'createdbyme') {
              tasks = tasks.filter(t => t.assignee === 'Pradeep');
      } else if (state.currentView === 'assignedtome') {
              tasks = tasks.filter(t => t.assignee === 'Pradeep');
      } else if (state.currentView === 'myday') {
              const today = new Date().toISOString().split('T')[0];
              tasks = tasks.filter(t => t.dueDate && t.dueDate.startsWith(today));
      } else if (state.currentView === 'agenda') {
              tasks = tasks.filter(t => t.dueDate);
      }
         /// Search filter
      if (state.searchQuery) {
              const q = state.searchQuery.toLowerCase();
              tasks = tasks.filter(t => t.title.toLowerCase().includes(q) || (t.description && t.description.toLowerCase().includes(q)));
      }
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
   }

   // ===== TASK DETAIL PANEL =====
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
         subtasksList.innerHTML = (task.subtasks || []).map(s =>
                 '<div class="subtask-item"><div class="check-circle' + (s.done ? ' completed' : '') + '" data-subtask="' + s.id + '"></div><span>' + s.title + '</span></div>'
                                                                ).join('');

      // Timeline
      const timelineList = document.getElementById('timelineList');
         timelineList.innerHTML = '<div class="timeline-item"><span><span class="timeline-user">' + (task.assignee || 'System') + '</span> created this task.</span><span class="timeline-date">' + formatDate(task.createdAt) + '</span></div>';
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
                 renderView();
         });
   });

   // View tabs (Board / List)
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

   // Save task (to ShadowDB)
   document.getElementById('saveTaskBtn').addEventListener('click', async function() {
         const title = document.getElementById('modalTaskTitle').value.trim();
         if (!title) return;
         const groupSelect = document.getElementById('modalGroup');
         const groupId = groupSelect.value ? parseInt(groupSelect.value) : (state.groups.length ? state.groups[0].id : null);
         const newTask = {
                 title: title,
                 status: 'Open',
                 priority: document.getElementById('modalPriority').value,
                 assignee: 'Pradeep',
                 group: groupId,
                 category: document.getElementById('modalCategory').value || 'General',
                 dueDate: document.getElementById('modalDueDate').value || '',
                 startDate: document.getElementById('modalStartDate').value || '',
                 description: document.getElementById('modalDescription').value,
                 notes: document.getElementById('modalNotes').value,
                 tags: [],
                 subtasks: [],
                 recurrence: null,
                 reminder: null,
                 customFields: {},
                 completedAt: null,
                 order: 0
         };
         try {
                 await ShadowDB.Tasks.create(newTask);
                 state.tasks = await ShadowDB.Tasks.getAll();
                 document.getElementById('taskModal').style.display = 'none';
                 renderSidebar();
                 renderView();
         } catch(e) {
                 console.error('Failed to create task:', e);
         }
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

   // Status dropdown in detail panel
   document.getElementById('detailStatusBtn').addEventListener('click', function(e) {
         const dd = document.getElementById('statusDropdown');
         const rect = this.getBoundingClientRect();
         dd.style.top = rect.bottom + 4 + 'px';
         dd.style.left = rect.left + 'px';
         dd.style.display = dd.style.display === 'none' ? '' : 'none';
   });

   document.getElementById('statusDropdown').addEventListener('click', async function(e) {
         const item = e.target.closest('.status-option');
         if (!item) return;
         const newStatus = item.dataset.status;
         const task = state.tasks.find(t => t.id === state.selectedTaskId);
         if (task) {
                 task.status = newStatus;
                 try {
                           await ShadowDB.Tasks.update(task);
                           state.tasks = await ShadowDB.Tasks.getAll();
                 } catch(e) { console.error('Failed to update status:', e); }
                 document.getElementById('detailStatusBtn').textContent = newStatus;
                 document.getElementById('detailStatusBtn').className = 'status-btn ' + statusClass(newStatus);
                 renderView();
         }
         this.style.display = 'none';
   });

   // Priority dropdown in detail panel
   document.getElementById('detailPriority').addEventListener('click', function(e) {
         const dd = document.getElementById('priorityDropdown');
         const rect = this.getBoundingClientRect();
         dd.style.top = rect.bottom + 4 + 'px';
         dd.style.left = rect.left + 'px';
         dd.style.display = dd.style.display === 'none' ? '' : 'none';
   });

   document.getElementById('priorityDropdown').addEventListener('click', async function(e) {
         const item = e.target.closest('.priority-option');
         if (!item) return;
         const newPriority = item.dataset.priority;
         const task = state.tasks.find(t => t.id === state.selectedTaskId);
         if (task) {
                 task.priority = newPriority;
                 try {
                           await ShadowDB.Tasks.update(task);
                           state.tasks = await ShadowDB.Tasks.getAll();
                 } catch(e) { console.error('Failed to update priority:', e); }
                 document.getElementById('detailPriority').innerHTML = '<i class="fa-solid fa-exclamation"></i> ' + newPriority;
                 renderView();
         }
         this.style.display = 'none';
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
    document.getElementById('saveGroupBtn').addEventListener('click', async function() {
          const name = document.getElementById('groupNameInput').value.trim();
          if (!name) return;
          try {
                  await ShadowDB.Groups.create({
                            name: name,
                            description: '',
                            color: '#4285f4',
                            type: 'org-email',
                            streams: true,
                            hidden: false,
                            categories: ['General'],
                            statuses: ['Open', 'In Progress', 'Completed'],
                            icon: null,
                            order: 0
                  });
                  state.groups = await ShadowDB.Groups.getAll();
                  document.getElementById('groupModal').style.display = 'none';
                  renderSidebar();
                  updateGroupSelects();
          } catch(e) { console.error('Failed to create group:', e); }
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
    document.getElementById('saveTagBtn').addEventListener('click', async function() {
          const name = document.getElementById('tagNameInput').value.trim();
          if (!name) return;
          try {
                  await ShadowDB.Tags.create({ name: name, color: selectedTagColor });
                  state.tags = await ShadowDB.Tags.getAll();
                  document.getElementById('tagModal').style.display = 'none';
                  renderSidebar();
          } catch(e) { console.error('Failed to create tag:', e); }
    });

   // Close dropdowns on click outside
   document.addEventListener('click', function(e) {
         if (!e.target.closest('#sortBtn') && !e.target.closest('#sortDropdown')) {
                 document.getElementById('sortDropdown').style.display = 'none';
         }
         if (!e.target.closest('#detailStatusBtn') && !e.target.closest('#statusDropdown')) {
                 document.getElementById('statusDropdown').style.display = 'none';
         }
         if (!e.target.closest('#detailPriority') && !e.target.closest('#priorityDropdown')) {
                 document.getElementById('priorityDropdown').style.display = 'none';
         }
   });

   // Subtask toggle
   document.getElementById('subtasksList').addEventListener('click', async function(e) {
         const circle = e.target.closest('.check-circle');
         if (!circle || !circle.dataset.subtask) return;
         const task = state.tasks.find(t => t.id === state.selectedTaskId);
         if (task) {
                 const subtask = task.subtasks.find(s => s.id === circle.dataset.subtask);
                 if (subtask) {
                           subtask.done = !subtask.done;
                           try {
                                       await ShadowDB.Tasks.update(task);
                                       state.tasks = await ShadowDB.Tasks.getAll();
                           } catch(e) { console.error('Failed to toggle subtask:', e); }
                           showTaskDetail(state.selectedTaskId);
                           renderView();
                 }
         }
   });

   // Subtask input
   document.getElementById('newSubtaskInput').addEventListener('keydown', async function(e) {
         if (e.key === 'Enter' && this.value.trim() && state.selectedTaskId) {
                 const task = state.tasks.find(t => t.id === state.selectedTaskId);
                 if (task) {
                           if (!task.subtasks) task.subtasks = [];
                           task.subtasks.push({ id: 's' + Date.now(), title: this.value.trim(), done: false });
                           this.value = '';
                           try {
                                       await ShadowDB.Tasks.update(task);
                                       state.tasks = await ShadowDB.Tasks.getAll();
                           } catch(e) { console.error('Failed to add subtask:', e); }
                           showTaskDetail(state.selectedTaskId);
                           renderView();
                 }
         }
   });

   // Comment input
   document.getElementById('commentInput').addEventListener('keydown', async function(e) {
         if (e.key === 'Enter' && this.value.trim()) {
                 const comment = this.value.trim();
                 this.value = '';
                 if (state.selectedTaskId) {
                           try {
                                       await ShadowDB.Comments.create({
                                                     taskId: state.selectedTaskId,
                                                     text: comment,
                                                     author: 'Pradeep'
                                       });
                           } catch(e) { console.error('Failed to add comment:', e); }
                 }
         }
   });

   // Detail field updates
   document.getElementById('detailDescription').addEventListener('change', async function() {
         const task = state.tasks.find(t => t.id === state.selectedTaskId);
         if (task) {
                 task.description = this.value;
                 try {
                           await ShadowDB.Tasks.update(task);
                           state.tasks = await ShadowDB.Tasks.getAll();
                 } catch(e) { console.error('Failed to update description:', e); }
         }
   });
    document.getElementById('detailNotes').addEventListener('change', async function() {
          const task = state.tasks.find(t => t.id === state.selectedTaskId);
          if (task) {
                  task.notes = this.value;
                  try {
                            await ShadowDB.Tasks.update(task);
                            state.tasks = await ShadowDB.Tasks.getAll();
                  } catch(e) { console.error('Failed to update notes:', e); }
          }
    });
    document.getElementById('detailTaskTitle').addEventListener('blur', async function() {
          const task = state.tasks.find(t => t.id === state.selectedTaskId);
          if (task) {
                  task.title = this.textContent;
                  try {
                            await ShadowDB.Tasks.update(task);
                            state.tasks = await ShadowDB.Tasks.getAll();
                  } catch(e) { console.error('Failed to update title:', e); }
                  renderView();
          }
    });

   // Search
   document.getElementById('globalSearch').addEventListener('input', function() {
         state.searchQuery = this.value;
         renderView();
   });

   // Theme toggle
   document.querySelector('.theme-toggle').addEventListener('click', function() {
         document.body.classList.toggle('light-theme');
   });

   // ===== GROUP SELECT UPDATES =====
   function updateGroupSelects() {
         const selects = [document.getElementById('modalGroup')];
         selects.forEach(sel => {
                 sel.innerHTML = state.groups.map(g => '<option value="' + g.id + '">' + g.name + '</option>').join('');
         });
   }

   // ===== INITIALIZATION =====
   async function init() {
         try {
                 await ShadowDB.init();
                 dbReady = true;
                 // Load all data from ShadowDB
           state.tasks = await ShadowDB.Tasks.getAll();
                 state.groups = await ShadowDB.Groups.getAll();
                 state.tags = await ShadowDB.Tags.getAll();
                 // Render
           renderSidebar();
                 updateGroupSelects();
                 renderView();
                 console.log('Shadow ToDo initialized with ShadowDB -', state.tasks.length, 'tasks,', state.groups.length, 'groups,', state.tags.length, 'tags');
         } catch(e) {
                 console.error('Failed to initialize ShadowDB:', e);
                 // Fallback: render empty state
           renderSidebar();
                 renderView();
         }
   }

   // Listen for data changes from ShadowDB event bus
   ShadowDB.on('data:changed', async function(data) {
         if (data && data.entity === 'tasks') {
                 state.tasks = await ShadowDB.Tasks.getAll();
         } else if (data && data.entity === 'groups') {
                 state.groups = await ShadowDB.Groups.getAll();
         } else if (data && data.entity === 'tags') {
                 state.tags = await ShadowDB.Tags.getAll();
         }
         renderSidebar();
         renderView();
   });

   // Settings button - navigate to settings page
   var settingsBtn = document.querySelector('.sidebar-icons button[title="Settings"]');
    if (settingsBtn) {
          settingsBtn.addEventListener('click', function() {
                  window.location.href = 'settings.html';
          });
    }

   // Playground button - add to header
   var headerRight = document.querySelector('.header-right');
    if (headerRight) {
          var playgroundBtn = document.createElement('button');
          playgroundBtn.className = 'icon-btn';
          playgroundBtn.title = 'Playground';
          playgroundBtn.innerHTML = '<i class="fa-solid fa-flask"></i>';
          playgroundBtn.style.cssText = 'color:#58a6ff;font-size:16px;';
          playgroundBtn.addEventListener('click', function() {
                  window.location.href = 'playground.html';
          });
          headerRight.insertBefore(playgroundBtn, headerRight.firstChild);
    }

   init();
})();
