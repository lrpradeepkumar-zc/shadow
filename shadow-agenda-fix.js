// shadow-agenda-fix.js
// Patches SVK for Agenda view: correct date buckets, hide Group by, show all 7 buckets, drag-drop date change
// Agenda view shows ONLY tasks assigned to the current user
(function() {
'use strict';

var BUCKETS = [
{k:'Delayed', c:'#e53e3e', e:'No delayed tasks'},
{k:'Today', c:'#f59f00', e:'No tasks for today'},
{k:'Tomorrow', c:'#fbbc04', e:'No tasks for tomorrow'},
{k:'This Week', c:'#4285f4', e:'No tasks this week'},
{k:'This Month', c:'#34a853', e:'No tasks this month'},
{k:'Upcoming', c:'#38a169', e:'No upcoming tasks'},
{k:'No Due Date', c:'#718096', e:'No tasks without due date'}
];

function pad(n) { return n < 10 ? '0'+n : ''+n; }
function toISO(d) { return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate()); }

function bucketToDueDate(key) {
var today = new Date(); today.setHours(0,0,0,0);
if (key === 'Today') return toISO(today);
if (key === 'Tomorrow') { var t = new Date(today); t.setDate(t.getDate()+1); return toISO(t); }
if (key === 'This Week') { var w = new Date(today); w.setDate(w.getDate()+7); return toISO(w); }
if (key === 'This Month') return toISO(new Date(today.getFullYear(), today.getMonth()+1, 0));
if (key === 'Upcoming') return toISO(new Date(today.getFullYear(), today.getMonth()+4, 0));
if (key === 'Delayed') return toISO(today);
if (key === 'No Due Date') return null;
return null;
}

function agendaKey(task) {
if (!task.dueDate) return 'No Due Date';
var today = new Date(); today.setHours(0,0,0,0);
var d = new Date(task.dueDate + 'T00:00:00');
if (d < today) return 'Delayed';
var tom = new Date(today); tom.setDate(tom.getDate()+1);
if (d.getTime() === today.getTime()) return 'Today';
if (d.getTime() === tom.getTime()) return 'Tomorrow';
var ew = new Date(today); ew.setDate(today.getDate()+7);
if (d <= ew) return 'This Week';
var em = new Date(today.getFullYear(), today.getMonth()+1, 0);
if (d <= em) return 'This Month';
var eu = new Date(today.getFullYear(), today.getMonth()+4, 0);
if (d <= eu) return 'Upcoming';
return 'No Due Date';
}

function filterMyTasks(tasks) {
var uid = window.state && window.state.currentUserId;
if (!uid) return tasks;
return tasks.filter(function(t) {
if (Array.isArray(t.assignee)) return t.assignee.indexOf(uid) !== -1;
return t.assignee === uid;
});
}

function groupByBuckets(tasks) {
var g = {}; BUCKETS.forEach(function(b){g[b.k]=[];});
tasks.forEach(function(t){ var k=agendaKey(t); if(g[k])g[k].push(t); else g['No Due Date'].push(t); });
return g;
}

function boot() {
var SVK = window.SVK || (window.SVK = {});
if (!SVK.renderBoard || !SVK.renderList) { setTimeout(boot, 200); return; }

var _origGK = SVK.getGroupingKey;
SVK.getGroupingKey = function(task, gb) {
if (gb === 'dueDate') return agendaKey(task);
return _origGK ? _origGK.call(this, task, gb) : 'All Tasks';
};

var _origGSO = SVK.groupSortOrder;
SVK.groupSortOrder = function(key, gb) {
if (gb === 'dueDate') {
var o = {Delayed:0,Today:1,Tomorrow:2,'This Week':3,'This Month':4,Upcoming:5,'No Due Date':6};
return o.hasOwnProperty(key) ? o[key] : 99;
}
return _origGSO ? _origGSO.call(this, key, gb) : key;
};

var _origGCK = SVK.getGroupColorByKey;
SVK.getGroupColorByKey = function(key, gb) {
if (gb === 'dueDate') {
var m={Delayed:'#e53e3e',Today:'#f59f00',Tomorrow:'#fbbc04','This Week':'#4285f4','This Month':'#34a853',Upcoming:'#38a169','No Due Date':'#718096'};
return m[key] || '#4285f4';
}
return _origGCK ? _origGCK.call(this, key, gb) : '#4285f4';
};

var _origAGC = SVK._applyGroupChange;
SVK._applyGroupChange = async function(task, targetGroupKey, gb) {
if (gb === 'dueDate') {
var newDate = bucketToDueDate(targetGroupKey);
if (newDate !== task.dueDate) {
task.dueDate = newDate;
task.modifiedDate = new Date().toISOString();
await window.ShadowDB.Tasks.update(task);
var activeTab = document.querySelector('.view-tab.active');
if (activeTab) activeTab.click();
}
return;
}
return _origAGC ? _origAGC.call(this, task, targetGroupKey, gb) : undefined;
};

var _origRB = SVK.renderBoard;
SVK.renderBoard = function(container, tasks, ctx) {
var v = window.state && window.state.currentView;
if (v === 'agenda') {
tasks = filterMyTasks(tasks);
var g = groupByBuckets(tasks);
var cols = BUCKETS.map(function(b) {
var ct = g[b.k] || [];
var cards = ct.map(function(t){return SVK.renderTaskCard(t,ctx);}).join('');
if (!cards) cards = '<div class="svk-col__empty">' + b.e + '</div>';
return '<div class="svk-col" data-group-key="' + SVK.esc(b.k) + '" data-groupby="dueDate">'
+ '<div class="svk-col__header" style="border-top:4px solid ' + b.c + '">'
+ '<div class="svk-col__header-top">'
+ '<span class="svk-col__title">' + SVK.esc(b.k) + '</span>'
+ '<span style="display:flex;align-items:center;gap:6px">'
+ '<span class="svk-col__count">' + ct.length + '</span>'
+ '<button class="svk-add-task-btn" title="Add task" data-group-key="' + SVK.esc(b.k) + '"><i class="fa-solid fa-plus"></i></button>'
+ '</span>'
+ '</div></div>'
+ '<div class="svk-col__body" data-group-key="' + SVK.esc(b.k) + '">' + cards
+ '<div class="svk-drop-zone" data-group-key="' + SVK.esc(b.k) + '"></div>'
+ '</div></div>';
}).join('');
container.innerHTML = '<div class="svk-board">' + cols + '</div>';
SVK.bindBoardInteractions(container, ctx);
SVK.bindAgendaBoardDragDrop(container, ctx);
return;
}
_origRB.call(this, container, tasks, ctx);
};

SVK.bindAgendaBoardDragDrop = function(container, ctx) {
var s = window.state;
container.querySelectorAll('.svk-card').forEach(function(card) {
card.setAttribute('draggable', 'true');
card.addEventListener('dragstart', function(e) {
SVK._draggingTaskId = this.dataset.taskid;
this.classList.add('dragging');
e.dataTransfer.effectAllowed = 'move';
e.dataTransfer.setData('text/plain', SVK._draggingTaskId);
});
card.addEventListener('dragend', function() {
this.classList.remove('dragging');
container.querySelectorAll('.svk-col').forEach(function(c){c.classList.remove('drag-target-over');});
container.querySelectorAll('.svk-drop-zone').forEach(function(z){z.classList.remove('drag-over');});
SVK._draggingTaskId = null;
});
});
container.querySelectorAll('.svk-col').forEach(function(col) {
var groupKey = col.dataset.groupKey;
col.addEventListener('dragover', function(e) { e.preventDefault(); this.classList.add('drag-target-over'); });
col.addEventListener('dragleave', function(e) { if (!this.contains(e.relatedTarget)) this.classList.remove('drag-target-over'); });
col.addEventListener('drop', function(e) {
e.preventDefault();
this.classList.remove('drag-target-over');
var taskId = e.dataTransfer.getData('text/plain') || SVK._draggingTaskId;
if (!taskId || !s) return;
var task = s.tasks.find(function(t){return t.id===taskId;}); if (!task) return;
SVK._applyGroupChange(task, groupKey, 'dueDate');
});
});
};

var _origRL = SVK.renderList;
SVK.renderList = function(container, tasks, ctx) {
var v = window.state && window.state.currentView;
if (v === 'agenda') {
tasks = filterMyTasks(tasks);
var s = window.state, u = s ? s.currentUserId : null;
var f = SVK.getFields('list');
var h = '<th>Task Title</th>';
if(f.assignee) h += '<th>Assignee</th>';
if(f.status) h += '<th>Status</th>';
if(f.dueDate) h += '<th>Due Date</th>';
if(f.priority) h += '<th>Priority</th>';
if(f.tags) h += '<th>Tags</th>';
if(f.subtasks) h += '<th>Subtasks</th>';
if(f.attachments) h += '<th>Attachments</th>';
if(f.category) h += '<th>Category</th>';
if(f.createdDate) h += '<th>Created</th>';
if(f.group) h += '<th>Group</th>';
var tc = 1+(f.assignee?1:0)+(f.status?1:0)+(f.dueDate?1:0)+(f.priority?1:0)+(f.tags?1:0)+(f.subtasks?1:0)+(f.attachments?1:0)+(f.category?1:0)+(f.createdDate?1:0)+(f.group?1:0);
var g = groupByBuckets(tasks);
var rows = BUCKETS.map(function(b) {
var ct = g[b.k] || [], cl = SVK.isGroupCollapsed(b.k, u);
var hdr = '<tr class="svk-list-group-header" data-group-key="' + SVK.esc(b.k) + '" style="--group-color:' + b.c + '">'
+ '<td colspan="' + tc + '">'
+ '<div class="svk-group-label">'
+ '<button class="svk-group-toggle-btn' + (cl?' collapsed':'') + '" data-group-key="' + SVK.esc(b.k) + '">'
+ '<i class="fa-solid fa-chevron-down"></i></button>'
+ '<span class="svk-group-color-dot" style="background:' + b.c + '"></span>'
+ '<span>' + SVK.esc(b.k) + '</span>'
+ '<span class="svk-group-count">' + ct.length + '</span>'
+ '<button class="svk-list-add-task-btn" title="Add task" data-group-key="' + SVK.esc(b.k) + '"><i class="fa-solid fa-plus"></i> New task</button>'
+ '</div></td></tr>';
var r = cl ? '' : ct.map(function(t){return SVK.renderTaskRow(t,ctx,tc);}).join('');
return hdr + r;
}).join('');
container.innerHTML = '<div class="svk-list"><table class="svk-list-table">'
+ '<thead class="svk-list-thead"><tr>' + h + '</tr></thead>'
+ '<tbody>' + rows + '</tbody></table></div>';
SVK.bindListInteractions(container, ctx);
SVK.bindAgendaListDragDrop(container, ctx);
return;
}
_origRL.call(this, container, tasks, ctx);
};

SVK.bindAgendaListDragDrop = function(container, ctx) {
var s = window.state;
container.querySelectorAll('.svk-list-row').forEach(function(row) {
row.setAttribute('draggable', 'true');
row.addEventListener('dragstart', function(e) {
SVK._draggingTaskId = this.dataset.taskid;
this.classList.add('dragging');
e.dataTransfer.effectAllowed = 'move';
e.dataTransfer.setData('text/plain', SVK._draggingTaskId);
});
row.addEventListener('dragend', function() {
this.classList.remove('dragging');
container.querySelectorAll('.svk-list-row').forEach(function(r){r.classList.remove('drag-over');});
SVK._draggingTaskId = null;
});
row.addEventListener('dragover', function(e) {
e.preventDefault();
if (this.dataset.taskid !== SVK._draggingTaskId) this.classList.add('drag-over');
});
row.addEventListener('dragleave', function() { this.classList.remove('drag-over'); });
row.addEventListener('drop', function(e) {
e.preventDefault(); this.classList.remove('drag-over');
var taskId = e.dataTransfer.getData('text/plain') || SVK._draggingTaskId;
if (!taskId || !s || taskId === this.dataset.taskid) return;
var task = s.tasks.find(function(t){return t.id===taskId;}); if (!task) return;
var targetKey = null;
var prev = this.previousElementSibling;
while (prev) {
if (prev.classList.contains('svk-list-group-header')) { targetKey = prev.dataset.groupKey; break; }
prev = prev.previousElementSibling;
}
if (targetKey) SVK._applyGroupChange(task, targetKey, 'dueDate');
});
});
container.querySelectorAll('.svk-list-group-header').forEach(function(headerRow) {
headerRow.addEventListener('dragover', function(e) { e.preventDefault(); this.style.background='rgba(26,115,232,.1)'; });
headerRow.addEventListener('dragleave', function() { this.style.background=''; });
headerRow.addEventListener('drop', function(e) {
e.preventDefault(); this.style.background='';
var taskId = e.dataTransfer.getData('text/plain') || SVK._draggingTaskId;
if (!taskId || !s) return;
var task = s.tasks.find(function(t){return t.id===taskId;}); if (!task) return;
SVK._applyGroupChange(task, this.dataset.groupKey, 'dueDate');
});
});
};

setInterval(function() {
var btn = document.getElementById('groupByBtn');
var v = window.state && window.state.currentView;
if (btn) btn.style.display = (v === 'agenda') ? 'none' : '';
}, 250);

console.log('[AgendaFix] Loaded: drag-drop + assigned-to-me filter');
}

if (document.readyState === 'loading') {
document.addEventListener('DOMContentLoaded', boot);
} else {
setTimeout(boot, 500);
}
})();
