// ================================================================
// shadow-view-kit.js - ShadowViewKit (SVK)
// Unified Board & List View Components for Shadow ToDo
// Board View (Kanban) + List View (Grouped Table)
// Drag & Drop, Collapsible Groups, Manage Fields, State per userId
// ================================================================
(function () {
'use strict';

  /* ====== USER CACHE (Issue 4 Fix) ======
   * Loads all users from Supabase and provides sync lookup by ID
   */
  var _userCache = {};
  var _userCacheLoaded = false;

  function _loadUserCache(cb) {
    if (_userCacheLoaded) { cb && cb(); return; }
    var sb = window.ShadowDB && ShadowDB._sb;
    if (!sb) { cb && cb(); return; }
    sb.from('users').select('id,name,avatar,color').then(function(res) {
      if (res.data) {
        res.data.forEach(function(u) { _userCache[u.id] = u; });
        _userCacheLoaded = true;
      }
      cb && cb();
    });
  }

  function resolveUser(id) {
    if (!id) return null;
    return _userCache[id] || null;
  }

  function getAssigneeName(assigneeVal) {
    /* assigneeVal may be a UUID or a plain name string */
    if (!assigneeVal) return '';
    var user = resolveUser(assigneeVal);
    if (user) return user.name;
    /* If not a UUID (no dashes in UUID pattern), return as-is */
    if (assigneeVal.length < 36 || assigneeVal.indexOf('-') === -1) return assigneeVal;
    /* UUID but not in cache yet - return first 8 chars as fallback */
    return assigneeVal.substring(0, 8) + '...';
  }

  function getAssigneeAvatar(assigneeVal) {
    if (!assigneeVal) return '';
    var user = resolveUser(assigneeVal);
    if (user && user.avatar) return user.avatar;
    var name = getAssigneeName(assigneeVal);
    return name ? name[0].toUpperCase() : '?';
  }

  function getAssigneeColor(assigneeVal) {
    if (!assigneeVal) return '#6b7280';
    var user = resolveUser(assigneeVal);
    if (user && user.color) return user.color;
    return '#6b7280';
  }

  /* Trigger user cache load on init */
  // Load user cache when app is ready (event-based + longer fallback)
window._loadUserCacheGlobal = function() { _loadUserCache(); };
document.addEventListener('shadow_app_ready', function() { setTimeout(_loadUserCache, 100); });
setTimeout(function() { _loadUserCache(); }, 3000);
// Expose user-resolution helpers globally for app.js
window.getAssigneeName = getAssigneeName;
window.getAssigneeAvatar = getAssigneeAvatar;
window.getAssigneeColor = getAssigneeColor;


window.SVK = window.SVK || {};
var SVK = window.SVK;

// ÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ Escape helper ÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ
SVK.esc = function (s) {
  if (s == null) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
};
SVK.getInitials = function (name) {
  if (!name) return '?';
  var p = name.trim().split(/\s+/);
  return p.length === 1 ? p[0][0].toUpperCase() : (p[0][0] + p[p.length - 1][0]).toUpperCase();
};
SVK.avatarColor = function (name) {
  var c = ['#4285f4','#ea4335','#34a853','#fbbc04','#9c27b0','#00acc1','#e67e22','#1abc9c'];
  if (!name) return c[0];
  var h = 0;
  for (var i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffffff;
  return c[Math.abs(h) % c.length];
};
SVK.fmtDate = function (ds) {
  if (!ds) return '';
  return new Date(ds + 'T00:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
};
SVK.isOverdue = function (ds) { return ds && new Date(ds + 'T23:59:59') < new Date(); };
SVK.isDone = function (t) {
  var s = (t && t.status) ? String(t.status).toLowerCase() : '';
  return s === 'completed' || s === 'done' || s === 'closed' || s === 'fixed';
};

// ÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ State persistence (per userId) ÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ
SVK.STATE_KEY_PREFIX = 'svk_state_';
SVK._collapsedGroups = {};
SVK.getPersistedState = function (userId) {
  try { var r = localStorage.getItem(SVK.STATE_KEY_PREFIX + (userId||'anon')); return r ? JSON.parse(r) : {}; } catch(e) { return {}; }
};
SVK.persistState = function (userId, data) {
  try {
    var m = Object.assign({}, SVK.getPersistedState(userId), data);
    localStorage.setItem(SVK.STATE_KEY_PREFIX + (userId||'anon'), JSON.stringify(m));
    if (window.ShadowDB && window.ShadowDB._sb && userId) {
      window.ShadowDB._sb.from('user_view_prefs').upsert({user_id:userId,prefs:JSON.stringify(m),updated_at:new Date().toISOString()},{onConflict:'user_id'}).then(function(){}).catch(function(){});
    }
  } catch(e) {}
};
SVK.isGroupCollapsed = function (key, userId) {
  if (SVK._collapsedGroups.hasOwnProperty(key)) return SVK._collapsedGroups[key];
  var ps = SVK.getPersistedState(userId);
  return !!(ps.collapsedGroups && ps.collapsedGroups[key]);
};
SVK.toggleGroupCollapse = function (key, userId) {
  SVK._collapsedGroups[key] = !SVK.isGroupCollapsed(key, userId);
  var ps = SVK.getPersistedState(userId);
  if (!ps.collapsedGroups) ps.collapsedGroups = {};
  ps.collapsedGroups[key] = SVK._collapsedGroups[key];
  SVK.persistState(userId, {collapsedGroups: ps.collapsedGroups});
};
SVK.initFromPersistedState = function (userId) {
  if (!userId) return;
  var ps = SVK.getPersistedState(userId);
  var s = window.state; if (!s) return;
  if (ps.manageFields) {
    if (!s.manageFields) s.manageFields = {};
    if (ps.manageFields.board) s.manageFields.board = Object.assign({}, SVK.DEFAULT_FIELDS_BOARD, ps.manageFields.board);
    if (ps.manageFields.list) s.manageFields.list = Object.assign({}, SVK.DEFAULT_FIELDS_LIST, ps.manageFields.list);
  }
  if (ps.collapsedGroups) Object.assign(SVK._collapsedGroups, ps.collapsedGroups);
};

// ÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ Colors & Grouping Helpers ÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ
SVK.DEFAULT_STATUSES = [
  {name:'Open',color:'#e53e3e'},{name:'In Progress',color:'#d69e2e'},
  {name:'Fixed',color:'#3182ce'},{name:'Completed',color:'#38a169'},
  {name:'Closed',color:'#718096'},{name:'None',color:'#718096'}
];
SVK.GROUP_COLORS = ['#e53e3e','#dd6b20','#d69e2e','#38a169','#3182ce','#805ad5','#d53f8c','#00acc1','#e67e22','#1abc9c','#9c27b0','#4285f4'];
SVK.getGroupColor = function (gid) {
  var s = window.state; if (!s) return '#4285f4';
  var g = (s.groups||[]).find(function(g){return g.id===gid;});
  if (g && g.color) return g.color;
  var idx = (s.groups||[]).findIndex(function(g){return g.id===gid;});
  return SVK.GROUP_COLORS[Math.max(0,idx) % SVK.GROUP_COLORS.length];
};
SVK.getStatusColor = function (name, gid) {
  var s = window.state;
  if (s) {
    var g = (s.groups||[]).find(function(g){return g.id===gid;});
    if (g && g.statuses) { var st = g.statuses.find(function(x){return x.name===name;}); if (st) return st.color; }
  }
  var def = SVK.DEFAULT_STATUSES.find(function(x){return x.name===name;});
  return def ? def.color : '#718096';
};
SVK.priColor = function (p) { return p==='High'?'#ea4335':p==='Medium'?'#f59f00':p==='Low'?'#34a853':'#9aa0a6'; };
SVK.getGroupName = function (gid) {
  var s = window.state; if (!s) return gid||'';
  var g = (s.groups||[]).find(function(g){return g.id===gid;});
  return g ? g.name : (gid||'');
};
SVK.getGroupingKey = function (task, gb) {
  if (gb==='category') return task.category||'Uncategorized';
  if (gb==='status') return task.status||'Open';
  if (gb==='priority') return task.priority||'None';
  if (gb==='assignee') return getAssigneeName(task.assignee)||'Unassigned';
  if (gb==='dueDate') {
    if (!task.dueDate) return 'No Due Date';
    var today=new Date(); today.setHours(0,0,0,0);
    var d=new Date(task.dueDate+'T00:00:00');
    if (d<today) return 'Overdue';
    var tom=new Date(today); tom.setDate(tom.getDate()+1);
    if (d.getTime()===today.getTime()) return 'Today';
    if (d.getTime()===tom.getTime()) return 'Tomorrow';
    var ew=new Date(today); ew.setDate(today.getDate()+7);
    if (d<=ew) return 'This Week';
    var em=new Date(today); em.setDate(today.getDate()+30);
    if (d<=em) return 'This Month';
    return 'Upcoming';
  }
  if (gb==='createdDay') return task.createdAt ? task.createdAt.substring(0,10) : 'No Date';
  if (gb==='group') return SVK.getGroupName(task.group||task.groupId);
  return 'All Tasks';
};
SVK.groupSortOrder = function (key, gb) {
  if (gb==='dueDate') { var o={Overdue:0,Today:1,Tomorrow:2,'This Week':3,'This Month':4,Upcoming:5,'No Due Date':6}; return o.hasOwnProperty(key)?o[key]:99; }
  if (gb==='priority') { var o2={High:0,Medium:1,Low:2,None:3}; return o2.hasOwnProperty(key)?o2[key]:99; }
  if (gb==='status') { var o3={Open:0,'In Progress':1,Fixed:2,Completed:3,Closed:4,None:5}; return o3.hasOwnProperty(key)?o3[key]:99; }
  return key;
};
SVK.getGroupColorByKey = function (key, gb) {
  if (gb==='status') return SVK.getStatusColor(key,null);
  if (gb==='priority') return SVK.priColor(key);
  if (gb==='dueDate') { var m={Overdue:'#e53e3e',Today:'#f59f00',Tomorrow:'#fbbc04','This Week':'#4285f4','This Month':'#34a853',Upcoming:'#38a169','No Due Date':'#718096'}; return m[key]||'#4285f4'; }
  return '#4285f4';
};

// ÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ Manage Fields ÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ
SVK.FIELD_DEFS_BOARD = [
  {key:'assignee',label:'Assignee',icon:'fa-user'},{key:'status',label:'Status',icon:'fa-circle-half-stroke'},
  {key:'dueDate',label:'Due Date',icon:'fa-calendar'},{key:'priority',label:'Priority',icon:'fa-circle-exclamation'},
  {key:'tags',label:'Tags',icon:'fa-tag'},{key:'subtasks',label:'Subtask Progress',icon:'fa-square-check'},
  {key:'attachments',label:'Attachments',icon:'fa-paperclip'},{key:'category',label:'Category',icon:'fa-folder'}
];
SVK.FIELD_DEFS_LIST = [
  {key:'assignee',label:'Assignee',icon:'fa-user'},{key:'status',label:'Status',icon:'fa-circle-half-stroke'},
  {key:'dueDate',label:'Due Date',icon:'fa-calendar'},{key:'priority',label:'Priority',icon:'fa-circle-exclamation'},
  {key:'tags',label:'Tags',icon:'fa-tag'},{key:'subtasks',label:'Subtask Progress',icon:'fa-square-check'},
  {key:'attachments',label:'Attachments',icon:'fa-paperclip'},{key:'category',label:'Category',icon:'fa-folder'},
  {key:'createdDate',label:'Created Date',icon:'fa-clock'},{key:'group',label:'Group',icon:'fa-users'}
];
SVK.DEFAULT_FIELDS_BOARD = {assignee:true,status:true,dueDate:true,priority:true,tags:true,subtasks:true,attachments:false,category:false};
SVK.DEFAULT_FIELDS_LIST = {assignee:true,status:true,dueDate:true,priority:false,tags:false,subtasks:true,attachments:false,category:true,createdDate:false,group:false};
SVK.getFields = function (viewType) {
  var s = window.state; if (!s) return {};
  var key = viewType || s.currentDisplay || 'board';
  if (!s.manageFields) s.manageFields = {};
  if (!s.manageFields[key]) {
    var def = key==='board' ? SVK.DEFAULT_FIELDS_BOARD : SVK.DEFAULT_FIELDS_LIST;
    s.manageFields[key] = Object.assign({}, def);
    if (s.currentUserId) {
      var ps = SVK.getPersistedState(s.currentUserId);
      if (ps.manageFields && ps.manageFields[key]) s.manageFields[key] = Object.assign({}, def, ps.manageFields[key]);
    }
  }
  return s.manageFields[key];
};
SVK.saveFields = function (viewType, fields) {
  var s = window.state; if (!s) return;
  if (!s.manageFields) s.manageFields = {};
  s.manageFields[viewType] = fields;
  if (s.currentUserId) {
    var ps = SVK.getPersistedState(s.currentUserId);
    if (!ps.manageFields) ps.manageFields = {};
    ps.manageFields[viewType] = fields;
    SVK.persistState(s.currentUserId, {manageFields: ps.manageFields});
  }
};

// ÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ CSS Injection ÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ
if (!document.getElementById('svk-styles')) {
  var svkStyle = document.createElement('style');
  svkStyle.id = 'svk-styles';
  svkStyle.textContent = '.svk-board{display:flex;gap:16px;padding:16px;overflow-x:auto;min-height:calc(100vh - 140px);align-items:flex-start}'
    +'.svk-col{min-width:280px;max-width:300px;flex-shrink:0;display:flex;flex-direction:column;background:var(--bg-secondary,#16213e);border-radius:10px;border:1px solid var(--border-color,#2d3748);overflow:hidden}'
    +'.svk-col__header{padding:12px 14px 10px;border-bottom:1px solid var(--border-color,#2d3748);position:sticky;top:0;background:var(--bg-secondary,#16213e);z-index:10}'
    +'.svk-col__header-top{display:flex;align-items:center;justify-content:space-between}'
    +'.svk-col__title{font-size:13px;font-weight:600;color:var(--text-primary,#e0e0e0)}'
    +'.svk-col__count{font-size:12px;color:var(--text-muted,#6c6c7c);background:var(--bg-tertiary,#0f3460);padding:2px 7px;border-radius:10px}'
    +'.svk-add-task-btn{background:none;border:none;cursor:pointer;color:var(--text-muted,#6c6c7c);padding:2px 5px;border-radius:4px;font-size:13px;display:inline-flex;align-items:center;justify-content:center;line-height:1;transition:color .15s,background .15s}'
    +'.svk-add-task-btn:hover{color:var(--accent-blue,#1a73e8);background:rgba(26,115,232,.12)}'
    +'.svk-list-add-task-btn{background:none;border:none;cursor:pointer;color:var(--text-muted,#6c6c7c);padding:2px 8px;border-radius:4px;font-size:12px;display:inline-flex;align-items:center;gap:4px;line-height:1;transition:color .15s,background .15s;margin-left:4px}'
    +'.svk-list-add-task-btn:hover{color:var(--accent-blue,#1a73e8);background:rgba(26,115,232,.12)}'
    +'.svk-col__body{padding:10px;display:flex;flex-direction:column;gap:8px;min-height:60px;flex:1}'
    +'.svk-col__empty{text-align:center;padding:20px 10px;color:var(--text-muted,#6c6c7c);font-size:13px;font-style:italic}'
    +'.svk-card{background:var(--bg-primary,#1a1a2e);border:1px solid var(--border-color,#2d3748);border-radius:8px;padding:12px;cursor:pointer;transition:box-shadow .15s,border-color .15s;position:relative}'
    +'.svk-card:hover{box-shadow:0 4px 12px rgba(0,0,0,.3);border-color:var(--accent-blue,#1a73e8)}'
    +'.svk-card.active-card{border-color:var(--accent-blue,#1a73e8);box-shadow:0 0 0 2px rgba(26,115,232,.3)}'
    +'.svk-card.dragging{opacity:.5;border:2px dashed var(--accent-blue,#1a73e8)}'
    +'.svk-card__header{display:flex;align-items:flex-start;gap:8px;margin-bottom:8px}'
    +'.svk-card__checkbox{width:16px;height:16px;border-radius:4px;flex-shrink:0;margin-top:2px;cursor:pointer;accent-color:var(--accent-blue,#1a73e8)}'
    +'.svk-card__title{font-size:13px;font-weight:500;color:var(--text-primary,#e0e0e0);line-height:1.4;flex:1}'
    +'.svk-card__title.done{text-decoration:line-through;color:var(--text-muted,#6c6c7c)}'
    +'.svk-card__pri{width:8px;height:8px;border-radius:50%;flex-shrink:0;margin-top:5px}'
    +'.svk-card__status{display:inline-flex;align-items:center;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600;margin-bottom:6px}'
    +'.svk-card__fields{display:flex;flex-direction:column;gap:5px;margin-top:6px}'
    +'.svk-card__field{display:flex;align-items:center;gap:6px;font-size:11px;color:var(--text-secondary,#a0a0b0)}'
    +'.svk-card__footer{display:flex;align-items:center;justify-content:space-between;margin-top:8px;padding-top:8px;border-top:1px solid var(--border-color,#2d3748)}'
    +'.svk-card__avatar{width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-size:9px;font-weight:700;flex-shrink:0}'
    +'.svk-card__due{font-size:11px;display:flex;align-items:center;gap:4px}'
    +'.svk-card__due.overdue{color:#ea4335}'
    +'.svk-card__tags{display:flex;flex-wrap:wrap;gap:3px;margin-top:4px}'
    +'.svk-card__tag{padding:1px 6px;border-radius:8px;font-size:10px;color:#fff;font-weight:500}'
    +'.svk-card__subtasks{font-size:11px;display:flex;align-items:center;gap:4px;color:var(--text-muted,#6c6c7c)}'
    +'.svk-drag-handle{position:absolute;left:4px;top:50%;transform:translateY(-50%);cursor:grab;color:var(--text-muted,#6c6c7c);font-size:11px;opacity:0;transition:opacity .15s}'
    +'.svk-card:hover .svk-drag-handle{opacity:1}'
    +'.svk-col.drag-target-over{background:rgba(26,115,232,.07)}'
    +'.svk-drop-zone{height:4px;background:transparent;transition:background .15s}'
    +'.svk-drop-zone.drag-over{background:var(--accent-blue,#1a73e8);border-radius:2px;height:6px}'
    +'.svk-list{width:100%;display:flex;flex-direction:column}'
    +'.svk-list-table{width:100%;border-collapse:separate;border-spacing:0}'
    +'.svk-list-thead th{position:sticky;top:0;background:var(--bg-secondary,#16213e);padding:8px 12px;font-size:11px;font-weight:600;color:var(--text-secondary,#a0a0b0);text-transform:uppercase;letter-spacing:.5px;border-bottom:2px solid var(--border-color,#2d3748);white-space:nowrap;z-index:20;text-align:left}'
    +'.svk-list-thead th:first-child{padding-left:16px}'
    +'.svk-list-group-header{background:var(--bg-secondary,#16213e)}'
    +'.svk-list-group-header td{padding:10px 12px;font-size:13px;font-weight:600;color:var(--text-primary,#e0e0e0);border-bottom:1px solid var(--border-color,#2d3748);position:sticky;top:40px;z-index:15}'
    +'.svk-list-group-header td:first-child{border-left:4px solid var(--group-color,#4285f4);padding-left:12px}'
    +'.svk-group-toggle-btn{background:none;border:none;cursor:pointer;color:var(--text-muted,#6c6c7c);padding:0 4px;transition:transform .2s;display:inline-flex;align-items:center}'
    +'.svk-group-toggle-btn.collapsed{transform:rotate(-90deg)}'
    +'.svk-group-label{display:inline-flex;align-items:center;gap:8px}'
    +'.svk-group-color-dot{width:10px;height:10px;border-radius:50%;flex-shrink:0}'
    +'.svk-group-count{font-size:11px;color:var(--text-muted,#6c6c7c);background:var(--bg-tertiary,#0f3460);padding:1px 6px;border-radius:8px;margin-left:6px}'
    +'.svk-list-row{border-bottom:1px solid var(--border-color,#2d3748);cursor:pointer;transition:background .1s}'
    +'.svk-list-row:hover{background:var(--bg-hover,#253a5c)}'
    +'.svk-list-row.active-row{background:rgba(26,115,232,.12)}'
    +'.svk-list-row.drag-over{background:rgba(26,115,232,.15);border-top:2px solid var(--accent-blue,#1a73e8)}'
    +'.svk-list-row td{padding:9px 12px;font-size:13px;color:var(--text-primary,#e0e0e0);vertical-align:middle}'
    +'.svk-list-row td:first-child{padding-left:16px}'
    +'.svk-row-title{display:flex;align-items:center;gap:8px}'
    +'.svk-row-title-text{flex:1;font-weight:500}'
    +'.svk-row-title-text.done{text-decoration:line-through;color:var(--text-muted,#6c6c7c)}'
    +'.svk-row-assignee{display:flex;align-items:center;gap:6px;white-space:nowrap}'
    +'.svk-row-avatar{width:22px;height:22px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;color:#fff;font-size:9px;font-weight:700;flex-shrink:0}'
    +'.svk-row-status{display:inline-flex;align-items:center;padding:2px 10px;border-radius:12px;font-size:11px;font-weight:600;white-space:nowrap}'
    +'.svk-row-date{display:flex;align-items:center;gap:4px;white-space:nowrap;font-size:12px}'
    +'.svk-row-date.overdue{color:#ea4335}'
    +'.svk-row-tags{display:flex;flex-wrap:wrap;gap:3px}'
    +'.svk-tag-pill{padding:1px 6px;border-radius:8px;font-size:10px;color:#fff;font-weight:500}'
    +'.svk-row-subtasks{font-size:12px;color:var(--text-secondary,#a0a0b0);display:flex;align-items:center;gap:4px}'
    +'.svk-row-pri-dot{width:8px;height:8px;border-radius:50%}'
    +'.svk-row-drag-handle{cursor:grab;color:var(--text-muted,#6c6c7c);opacity:0;transition:opacity .15s;padding:0 4px}'
    +'.svk-list-row:hover .svk-row-drag-handle{opacity:1}';
  document.head.appendChild(svkStyle);
}

// ÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ TaskCard (Board) Renderer ÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ
SVK.renderTaskCard = function (task, ctx) {
  var fields = SVK.getFields('board');
  var s = window.state;
  var esc = SVK.esc;
  var done = SVK.isDone(task);
  var gid = task.group || task.groupId;
  var statusColor = SVK.getStatusColor(task.status, gid);
  var priCol = SVK.priColor(task.priority);
  var isSelected = s && s.selectedTaskId === task.id;

  var statusHtml = fields.status && task.status ?
    '<span class="svk-card__status" style="background:'+statusColor+'22;color:'+statusColor+';border:1px solid '+statusColor+'55">'+esc(task.status)+'</span>' : '';

  var assigneeHtml = fields.assignee && getAssigneeName(task.assignee) ?
    '<span class="svk-card__avatar" style="background:'+SVK.avatarColor(getAssigneeName(task.assignee))+'" title="'+esc(task.assignee)+'">'+esc(SVK.getInitials(getAssigneeName(task.assignee)))+'</span>' : '';

  var dueDateHtml = '';
  if (fields.dueDate && task.dueDate) {
    var oc = (!done && SVK.isOverdue(task.dueDate)) ? ' overdue' : '';
    dueDateHtml = '<span class="svk-card__due'+oc+'"><i class="fa-regular fa-calendar"></i>'+esc(SVK.fmtDate(task.dueDate))+'</span>';
  }

  var tagsHtml = '';
  if (fields.tags && task.tags && task.tags.length) {
    tagsHtml = '<div class="svk-card__tags">'+task.tags.map(function(tid){
      var tag=(s&&s.tags||[]).find(function(t){return t.id===tid||t.name===tid;});
      return '<span class="svk-card__tag" style="background:'+(tag?tag.color:'#888')+'">'+esc(tag?tag.name:tid)+'</span>';
    }).join('')+'</div>';
  }

  var subtasksHtml = '';
  if (fields.subtasks && task.subtasks && task.subtasks.length) {
    var dc = task.subtasks.filter(function(st){return st.completed;}).length;
    subtasksHtml = '<span class="svk-card__subtasks"><i class="fa-regular fa-square-check"></i>'+dc+'/'+task.subtasks.length+'</span>';
  }

  var attachHtml = '';
  if (fields.attachments && task.attachments && task.attachments.length) {
    attachHtml = '<span class="svk-card__field"><i class="fa-solid fa-paperclip"></i>'+task.attachments.length+'</span>';
  }

  var catHtml = fields.category && task.category ?
    '<span class="svk-card__field"><i class="fa-solid fa-folder"></i>'+esc(task.category)+'</span>' : '';

  var priHtml = task.priority && task.priority!=='None' ?
    '<span class="svk-card__pri" style="background:'+priCol+'" title="'+esc(task.priority)+'"></span>' :
    '<span class="svk-card__pri" style="background:transparent"></span>';

  var groupName = SVK.getGroupName(gid);

  return '<div class="svk-card'+(isSelected?' active-card':'')+(done?' done-card':'')+'" data-taskid="'+esc(task.id)+'" draggable="true" data-group="'+esc(gid)+'">'
    +'<i class="fa-solid fa-grip-dots-vertical svk-drag-handle"></i>'
    +'<div class="svk-card__header">'
      +'<input type="checkbox" class="svk-card__checkbox svk-check" data-taskid="'+esc(task.id)+'"'+(done?' checked':'')+'>'
      +priHtml
      +'<div class="svk-card__title'+(done?' done':'')+'">'+esc(task.title||'(untitled)')+'</div>'
    +'</div>'
    +(statusHtml?'<div>'+statusHtml+'</div>':'')
    +tagsHtml
    +((catHtml||attachHtml||subtasksHtml)?'<div class="svk-card__fields">'+catHtml+(subtasksHtml?'<span class="svk-card__field">'+subtasksHtml+'</span>':'')+(attachHtml?'<span class="svk-card__field">'+attachHtml+'</span>':'')+'</div>':'')
    +'<div class="svk-card__footer">'
      +assigneeHtml
      +'<div style="display:flex;align-items:center;gap:8px;">'
        +dueDateHtml
        +'<span style="font-size:10px;color:var(--accent-blue,#1a73e8);font-weight:500;">'+esc(groupName)+'</span>'
      +'</div>'
    +'</div>'
  +'</div>';
};

// ÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ TaskRow (List) Renderer ÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ
SVK.renderTaskRow = function (task, ctx, totalCols) {
  var fields = SVK.getFields('list');
  var s = window.state;
  var esc = SVK.esc;
  var done = SVK.isDone(task);
  var gid = task.group || task.groupId;
  var statusColor = SVK.getStatusColor(task.status, gid);
  var priCol = SVK.priColor(task.priority);
  var avBg = SVK.avatarColor(getAssigneeName(task.assignee));
  var isSelected = s && s.selectedTaskId === task.id;

  var tagsHtml = (task.tags && task.tags.length) ? task.tags.map(function(tid){
    var tag=(s&&s.tags||[]).find(function(t){return t.id===tid||t.name===tid;});
    return '<span class="svk-tag-pill" style="background:'+(tag?tag.color:'#888')+'">'+esc(tag?tag.name:tid)+'</span>';
  }).join('') : '';

  var subtasksText = '';
  if (task.subtasks && task.subtasks.length) {
    var dc=task.subtasks.filter(function(st){return st.completed;}).length;
    subtasksText = dc+'/'+task.subtasks.length;
  }

  var dueCls = (!done && SVK.isOverdue(task.dueDate)) ? ' overdue' : '';
  var groupName = SVK.getGroupName(gid);
  var cells = '';

  cells += '<td><div class="svk-row-title">'
    +'<i class="fa-solid fa-grip-dots-vertical svk-row-drag-handle"></i>'
    +'<input type="checkbox" class="svk-card__checkbox svk-check" data-taskid="'+esc(task.id)+'"'+(done?' checked':'')+'>'
    +(task.priority&&task.priority!=='None'?'<span class="svk-row-pri-dot" style="background:'+priCol+'" title="'+esc(task.priority)+'"></span>':'')
    +'<span class="svk-row-title-text'+(done?' done':'')+'">'+esc(task.title||'(untitled)')+'</span>'
  +'</div></td>';

  if (fields.assignee) cells += '<td><div class="svk-row-assignee">'+(task.assignee?'<span class="svk-row-avatar" style="background:'+avBg+'">'+esc(SVK.getInitials(getAssigneeName(task.assignee)))+'</span>':'')+'<span style="font-size:12px">'+esc(getAssigneeName(task.assignee)||'')+'</span></div></td>';
  if (fields.status) cells += '<td><span class="svk-row-status" style="background:'+statusColor+'22;color:'+statusColor+';border:1px solid '+statusColor+'55">'+esc(task.status||'Open')+'</span></td>';
  if (fields.dueDate) cells += '<td><div class="svk-row-date'+dueCls+'">'+(task.dueDate?'<i class="fa-regular fa-calendar"></i>'+esc(SVK.fmtDate(task.dueDate)):'<span style="color:var(--text-muted)">&#8212;</span>')+'</div></td>';
  if (fields.priority) cells += '<td>'+(task.priority&&task.priority!=='None'?'<div class="svk-row-pri"><span class="svk-row-pri-dot" style="background:'+priCol+'"></span><span style="font-size:12px">'+esc(task.priority)+'</span></div>':'<span style="color:var(--text-muted)">&#8212;</span>')+'</td>';
  if (fields.tags) cells += '<td><div class="svk-row-tags">'+(tagsHtml||'<span style="color:var(--text-muted)">&#8212;</span>')+'</div></td>';
  if (fields.subtasks) cells += '<td><div class="svk-row-subtasks">'+(subtasksText?'<i class="fa-regular fa-square-check"></i>'+subtasksText:'<span style="color:var(--text-muted)">&#8212;</span>')+'</div></td>';
  if (fields.attachments) cells += '<td>'+(task.attachments&&task.attachments.length?'<span style="display:flex;align-items:center;gap:4px;font-size:12px"><i class="fa-solid fa-paperclip"></i>'+task.attachments.length+'</span>':'<span style="color:var(--text-muted)">&#8212;</span>')+'</td>';
  if (fields.category) cells += '<td><span style="font-size:12px">'+esc(task.category||'')+'</span></td>';
  if (fields.createdDate) cells += '<td><div class="svk-row-date">'+(task.createdAt?'<i class="fa-regular fa-clock"></i>'+esc(SVK.fmtDate(task.createdAt.substring(0,10))):'<span style="color:var(--text-muted)">&#8212;</span>')+'</div></td>';
  if (fields.group) cells += '<td><span style="font-size:12px;color:var(--accent-blue,#1a73e8)">'+esc(groupName)+'</span></td>';

  return '<tr class="svk-list-row'+(isSelected?' active-row':'')+'" data-taskid="'+esc(task.id)+'" data-group="'+esc(gid)+'" draggable="true">'+cells+'</tr>';
};

// ÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ Board View Renderer ÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ
SVK.renderBoard = function (container, tasks, ctx) {
  if (!container) return;
  var s = window.state;
  var userId = s ? s.currentUserId : null;
  var gb = (s && s.groupBy) || 'status';
  var grouped = {}, groupOrder = [];

  tasks.forEach(function(t) {
    var key = SVK.getGroupingKey(t, gb);
    if (!grouped[key]) { grouped[key] = []; groupOrder.push(key); }
    grouped[key].push(t);
  });

  groupOrder.sort(function(a, b) {
    var oa = SVK.groupSortOrder(a, gb), ob = SVK.groupSortOrder(b, gb);
    if (typeof oa === 'number' && typeof ob === 'number') return oa - ob;
    return String(a).localeCompare(String(b));
  });

  if (!groupOrder.length) {
    container.innerHTML = '<div class="svk-board"><div style="color:var(--text-muted);padding:40px;text-align:center;width:100%">No tasks found</div></div>';
    return;
  }

  var cols = groupOrder.map(function(key) {
    var colTasks = grouped[key] || [];
    var color = SVK.getGroupColorByKey(key, gb);
    if (gb === 'group') {
      var grp = (s && s.groups || []).find(function(g) { return g.name === key; });
      if (grp) color = SVK.getGroupColor(grp.id);
    }
    var cards = colTasks.map(function(t) { return SVK.renderTaskCard(t, ctx); }).join('');
    if (!cards) cards = '<div class="svk-col__empty">No tasks</div>';
    return '<div class="svk-col" data-group-key="'+SVK.esc(key)+'" data-groupby="'+SVK.esc(gb)+'">'
      +'<div class="svk-col__header" style="border-top:4px solid '+color+'">'
        +'<div class="svk-col__header-top">'
          +'<span class="svk-col__title">'+SVK.esc(key)+'</span>'
          +'<span style="display:flex;align-items:center;gap:6px">'
            +'<span class="svk-col__count">'+colTasks.length+'</span>'
            +'<button class="svk-add-task-btn" title="Add task" data-group-key="'+SVK.esc(key)+'">'
              +'<i class="fa-solid fa-plus"></i>'
            +'</button>'
          +'</span>'
        +'</div>'
      +'</div>'
      +'<div class="svk-col__body" data-group-key="'+SVK.esc(key)+'">'+cards
        +'<div class="svk-drop-zone" data-group-key="'+SVK.esc(key)+'"></div>'
      +'</div>'
    +'</div>';
  }).join('');

  container.innerHTML = '<div class="svk-board">' + cols + '</div>';
  SVK.bindBoardInteractions(container, ctx);
  SVK.bindBoardDragDrop(container, ctx);
};

// ÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ List View Renderer ÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ
SVK.renderList = function (container, tasks, ctx) {
  if (!container) return;
  var s = window.state;
  var userId = s ? s.currentUserId : null;
  var gb = (s && s.groupBy) || 'status';
  var fields = SVK.getFields('list');

  var headers = '<th>Task Title</th>';
  if (fields.assignee) headers += '<th><i class="fa-solid fa-user" style="margin-right:4px"></i>Assignee</th>';
  if (fields.status) headers += '<th>Status</th>';
  if (fields.dueDate) headers += '<th><i class="fa-regular fa-calendar" style="margin-right:4px"></i>Due Date</th>';
  if (fields.priority) headers += '<th>Priority</th>';
  if (fields.tags) headers += '<th>Tags</th>';
  if (fields.subtasks) headers += '<th>Subtasks</th>';
  if (fields.attachments) headers += '<th>Attachments</th>';
  if (fields.category) headers += '<th>Category</th>';
  if (fields.createdDate) headers += '<th>Created</th>';
  if (fields.group) headers += '<th>Group</th>';

  var totalCols = 1 + (fields.assignee?1:0) + (fields.status?1:0) + (fields.dueDate?1:0)
    + (fields.priority?1:0) + (fields.tags?1:0) + (fields.subtasks?1:0)
    + (fields.attachments?1:0) + (fields.category?1:0) + (fields.createdDate?1:0) + (fields.group?1:0);

  var grouped = {}, groupOrder = [];
  tasks.forEach(function(t) {
    var key = SVK.getGroupingKey(t, gb);
    if (!grouped[key]) { grouped[key] = []; groupOrder.push(key); }
    grouped[key].push(t);
  });
  groupOrder.sort(function(a, b) {
    var oa = SVK.groupSortOrder(a, gb), ob = SVK.groupSortOrder(b, gb);
    if (typeof oa === 'number' && typeof ob === 'number') return oa - ob;
    return String(a).localeCompare(String(b));
  });

  var bodyRows = groupOrder.map(function(key) {
    var grpTasks = grouped[key] || [];
    var collapsed = SVK.isGroupCollapsed(key, userId);
    var color = SVK.getGroupColorByKey(key, gb);
    if (gb === 'group') {
      var grp = (s && s.groups || []).find(function(g) { return g.name === key; });
      if (grp) color = SVK.getGroupColor(grp.id);
    }

    var headerRow = '<tr class="svk-list-group-header" data-group-key="'+SVK.esc(key)+'">'
      +'<td colspan="'+totalCols+'" style="--group-color:'+color+'">'
        +'<div class="svk-group-label">'
          +'<button class="svk-group-toggle-btn'+(collapsed?' collapsed':'')+'" data-group-key="'+SVK.esc(key)+'">'
            +'<i class="fa-solid fa-chevron-down"></i>'
          +'</button>'
          +'<span class="svk-group-color-dot" style="background:'+color+'"></span>'
          +'<span>'+SVK.esc(key)+'</span>'
          +'<span class="svk-group-count">'+grpTasks.length+'</span>'
          +'<button class="svk-list-add-task-btn" title="Add task" data-group-key="'+SVK.esc(key)+'">'
            +'<i class="fa-solid fa-plus"></i> New task'
          +'</button>'
        +'</div>'
      +'</td>'
    +'</tr>';

    var taskRows = collapsed ? '' : grpTasks.map(function(t) { return SVK.renderTaskRow(t, ctx, totalCols); }).join('');
    return headerRow + taskRows;
  }).join('');

  if (!bodyRows) bodyRows = '<tr><td colspan="'+totalCols+'" style="text-align:center;padding:40px;color:var(--text-muted)">No tasks found</td></tr>';

  container.innerHTML = '<div class="svk-list"><table class="svk-list-table"><thead class="svk-list-thead"><tr>'+headers+'</tr></thead><tbody>'+bodyRows+'</tbody></table></div>';
  SVK.bindListInteractions(container, ctx);
  SVK.bindListDragDrop(container, ctx);
};

// ÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ Board Interactions & Drag-Drop ÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ
SVK.bindBoardInteractions = function (container, ctx) {
  var s = window.state;
  container.querySelectorAll('.svk-add-task-btn').forEach(function(btn) {
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      var s = window.state || {};
      var gb = (s.groupBy) || 'status';
      var groupKey = btn.getAttribute('data-group-key') || '';
      var opts = {};
      if (s.currentView === 'group' && s.filterGroup) {
        opts.groupId = s.filterGroup;
      } else {
        opts.groupId = '';
      }
      if (gb === 'status') {
        opts.status = groupKey;
      } else if (gb === 'category') {
        opts.category = groupKey;
      } else if (gb === 'group') {
        var grp = (s.groups||[]).find(function(g){ return g.name === groupKey; });
        if (grp) { opts.groupId = grp.id; }
      }
      if (typeof window.ntmResetAndOpenWith === 'function') window.ntmResetAndOpenWith(opts);
      else if (typeof window.ntmResetAndOpen === 'function') window.ntmResetAndOpen();
      else if (document.getElementById('newTaskBtn')) document.getElementById('newTaskBtn').click();
    });
  });
  container.querySelectorAll('.svk-card').forEach(function(card) {
    card.addEventListener('click', function(e) {
      if (e.target.closest('.svk-check') || e.target.closest('.svk-drag-handle')) return;
      var id = this.dataset.taskid;
      if (id && typeof window.showTaskDetail === 'function') window.showTaskDetail(id, 'panel');
      else if (ctx && ctx.onTaskClick) ctx.onTaskClick(id);
    });
  });
  container.querySelectorAll('.svk-check').forEach(function(cb) {
    cb.addEventListener('change', async function(e) {
      e.stopPropagation();
      var id = this.dataset.taskid; if (!id || !s) return;
      var task = s.tasks.find(function(t){return t.id===id;}); if (!task) return;
      task.status = this.checked ? 'Completed' : 'Open';
      task.completedAt = this.checked ? new Date().toISOString() : null;
      task.modifiedDate = new Date().toISOString();
      await window.ShadowDB.Tasks.update(task);
      if (typeof window.renderView === 'function') window.renderView();
      else document.querySelector('.view-tab.active') && document.querySelector('.view-tab.active').click();
    });
  });
};

SVK.bindBoardDragDrop = function (container, ctx) {
  var s = window.state;
  container.querySelectorAll('.svk-card').forEach(function(card) {
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
    var groupBy = col.dataset.groupby;
    col.addEventListener('dragover', function(e) { e.preventDefault(); this.classList.add('drag-target-over'); });
    col.addEventListener('dragleave', function(e) { if (!this.contains(e.relatedTarget)) this.classList.remove('drag-target-over'); });
    col.addEventListener('drop', async function(e) {
      e.preventDefault();
      this.classList.remove('drag-target-over');
      var taskId = e.dataTransfer.getData('text/plain') || SVK._draggingTaskId;
      if (!taskId || !s) return;
      var task = s.tasks.find(function(t){return t.id===taskId;}); if (!task) return;
      var changed = false;
      if (groupBy==='status' && task.status!==groupKey) { task.status=groupKey; changed=true; }
      else if (groupBy==='priority' && task.priority!==groupKey) { task.priority=groupKey; changed=true; }
      else if (groupBy==='category' && task.category!==groupKey) { task.category=groupKey; changed=true; }
      else if (groupBy==='assignee') { task.assignee=groupKey==='Unassigned'?null:groupKey; changed=true; }
      else if (groupBy==='group') {
        var grp=(s.groups||[]).find(function(g){return g.name===groupKey;});
        if (grp && task.group!==grp.id) { task.group=grp.id; changed=true; }
      }
      if (changed) {
        task.modifiedDate = new Date().toISOString();
        await window.ShadowDB.Tasks.update(task);
        var activeTab = document.querySelector('.view-tab.active');
        if (activeTab) activeTab.click();
      }
    });
  });
};

// ÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ List Interactions & Drag-Drop ÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ
SVK.bindListInteractions = function (container, ctx) {
  var s = window.state;
  var userId = s ? s.currentUserId : null;
  container.querySelectorAll('.svk-list-row').forEach(function(row) {
    row.addEventListener('click', function(e) {
      if (e.target.closest('.svk-check') || e.target.closest('.svk-row-drag-handle')) return;
      var id = this.dataset.taskid;
      if (id && typeof window.showTaskDetail === 'function') window.showTaskDetail(id, 'panel');
      else if (ctx && ctx.onTaskClick) ctx.onTaskClick(id);
    });
  });
  container.querySelectorAll('.svk-check').forEach(function(cb) {
    cb.addEventListener('change', async function(e) {
      e.stopPropagation();
      var id = this.dataset.taskid; if (!id || !s) return;
      var task = s.tasks.find(function(t){return t.id===id;}); if (!task) return;
      task.status = this.checked ? 'Completed' : 'Open';
      task.completedAt = this.checked ? new Date().toISOString() : null;
      task.modifiedDate = new Date().toISOString();
      await window.ShadowDB.Tasks.update(task);
      var activeTab = document.querySelector('.view-tab.active');
      if (activeTab) activeTab.click();
    });
  });
  container.querySelectorAll('.svk-list-add-task-btn').forEach(function(btn) {
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      var s = window.state || {};
      var gb = (s.groupBy) || 'status';
      var groupKey = btn.getAttribute('data-group-key') || '';
      var opts = {};
      if (s.currentView === 'group' && s.filterGroup) {
        opts.groupId = s.filterGroup;
      } else {
        opts.groupId = '';
      }
      if (gb === 'status') {
        opts.status = groupKey;
      } else if (gb === 'category') {
        opts.category = groupKey;
      } else if (gb === 'group') {
        var grp = (s.groups||[]).find(function(g){ return g.name === groupKey; });
        if (grp) { opts.groupId = grp.id; }
      }
      if (typeof window.ntmResetAndOpenWith === 'function') window.ntmResetAndOpenWith(opts);
      else if (typeof window.ntmResetAndOpen === 'function') window.ntmResetAndOpen();
      else if (document.getElementById('newTaskBtn')) document.getElementById('newTaskBtn').click();
    });
  });
  container.querySelectorAll('.svk-group-toggle-btn').forEach(function(btn) {
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      var key = this.dataset.groupKey;
      SVK.toggleGroupCollapse(key, userId);
      this.classList.toggle('collapsed');
      var headerRow = this.closest('tr'); if (!headerRow) return;
      var next = headerRow.nextElementSibling;
      var hide = this.classList.contains('collapsed');
      while (next && !next.classList.contains('svk-list-group-header')) {
        next.style.display = hide ? 'none' : '';
        next = next.nextElementSibling;
      }
    });
  });
};

SVK.bindListDragDrop = function (container, ctx) {
  var s = window.state;
  container.querySelectorAll('.svk-list-row').forEach(function(row) {
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
    row.addEventListener('dragover', function(e) { e.preventDefault(); if (this.dataset.taskid !== SVK._draggingTaskId) this.classList.add('drag-over'); });
    row.addEventListener('dragleave', function() { this.classList.remove('drag-over'); });
    row.addEventListener('drop', async function(e) {
      e.preventDefault(); this.classList.remove('drag-over');
      var taskId = e.dataTransfer.getData('text/plain') || SVK._draggingTaskId;
      if (!taskId || !s || taskId === this.dataset.taskid) return;
      var task = s.tasks.find(function(t){return t.id===taskId;}); if (!task) return;
      var gb = (s && s.groupBy) || 'status';
      var targetGroupKey = null;
      var prev = this.previousElementSibling;
      while (prev) {
        if (prev.classList.contains('svk-list-group-header')) { targetGroupKey = prev.dataset.groupKey; break; }
        prev = prev.previousElementSibling;
      }
      if (targetGroupKey) await SVK._applyGroupChange(task, targetGroupKey, gb);
    });
  });
  container.querySelectorAll('.svk-list-group-header').forEach(function(headerRow) {
    headerRow.addEventListener('dragover', function(e) { e.preventDefault(); this.style.background='rgba(26,115,232,.1)'; });
    headerRow.addEventListener('dragleave', function() { this.style.background=''; });
    headerRow.addEventListener('drop', async function(e) {
      e.preventDefault(); this.style.background='';
      var taskId = e.dataTransfer.getData('text/plain') || SVK._draggingTaskId;
      if (!taskId || !s) return;
      var task = s.tasks.find(function(t){return t.id===taskId;}); if (!task) return;
      await SVK._applyGroupChange(task, this.dataset.groupKey, (s&&s.groupBy)||'status');
    });
  });
};

SVK._applyGroupChange = async function (task, targetGroupKey, gb) {
  var s = window.state; if (!s) return;
  var changed = false;
  if (gb==='status' && task.status!==targetGroupKey) { task.status=targetGroupKey; changed=true; }
  else if (gb==='category' && task.category!==targetGroupKey) { task.category=targetGroupKey; changed=true; }
  else if (gb==='priority' && task.priority!==targetGroupKey) { task.priority=targetGroupKey; changed=true; }
  else if (gb==='assignee') { task.assignee=targetGroupKey==='Unassigned'?null:targetGroupKey; changed=true; }
  else if (gb==='group') {
    var grp=(s.groups||[]).find(function(g){return g.name===targetGroupKey;});
    if (grp && task.group!==grp.id) { task.group=grp.id; changed=true; }
  }
  if (changed) {
    task.modifiedDate = new Date().toISOString();
    await window.ShadowDB.Tasks.update(task);
    var activeTab = document.querySelector('.view-tab.active');
    if (activeTab) activeTab.click();
  }
};

// ÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ Enhanced Manage Fields Dropdown ÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ
window.showManageFieldsDropdown = function () {
  document.querySelectorAll('.dropdown-menu').forEach(function(m){m.remove();});
  var btn = document.getElementById('manageFieldsBtn');
  var rect = btn ? btn.getBoundingClientRect() : {right:200,bottom:0};
  var menu = document.createElement('div');
  menu.className = 'dropdown-menu';
  menu.style.cssText = 'position:fixed;right:'+(window.innerWidth-rect.right)+'px;top:'+(rect.bottom+4)+'px;z-index:9000;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:10px;padding:8px 0;min-width:260px;box-shadow:0 4px 24px rgba(0,0,0,.4);max-height:80vh;overflow-y:auto;';

  var bFields = SVK.getFields('board');
  var lFields = SVK.getFields('list');

  function mkSection(title, fieldDefs, fields, cls) {
    return '<div style="padding:8px 16px 4px;font-size:11px;font-weight:700;color:var(--text-secondary);text-transform:uppercase;letter-spacing:.7px;border-bottom:1px solid var(--border-color);margin-bottom:2px;">'+title+'</div>'
      + fieldDefs.map(function(f){
          return '<label style="display:flex;align-items:center;justify-content:space-between;padding:7px 16px;cursor:pointer;font-size:13px;gap:8px">'
            +'<span style="display:flex;align-items:center;gap:7px;"><i class="fa-solid '+f.icon+'" style="width:14px;color:var(--text-muted);font-size:12px;"></i>'+f.label+'</span>'
            +'<input type="checkbox" class="'+cls+'" data-key="'+f.key+'"'+(fields[f.key]?' checked':'')+' style="width:15px;height:15px;cursor:pointer;accent-color:var(--accent-blue)">'
          +'</label>';
        }).join('');
  }

  var s = window.state;
  var subtaskDefaults = {agenda:true,myday:true,createdbyme:true,assignedtome:true,personal:false,group:false,unified:false,sharedwithme:false};
  var showSub = s && s.showAllSubtasks != null ? s.showAllSubtasks : (subtaskDefaults[s&&s.currentView] !== false);

  menu.innerHTML = mkSection('Board View Fields', SVK.FIELD_DEFS_BOARD, bFields, 'mf-board')
    + '<div style="height:1px;background:var(--border-color);margin:4px 0"></div>'
    + mkSection('List View Fields', SVK.FIELD_DEFS_LIST, lFields, 'mf-list')
    + '<div style="height:1px;background:var(--border-color);margin:4px 0"></div>'
    + '<label style="display:flex;align-items:center;justify-content:space-between;padding:8px 16px;cursor:pointer;font-size:13px;">'
      +'<span style="display:flex;align-items:center;gap:7px;"><i class="fa-solid fa-list-check" style="width:14px;color:var(--text-muted);font-size:12px;"></i>Show all Subtasks</span>'
      +'<input type="checkbox" id="mfShowSubtasks"'+(showSub?' checked':'')+' style="width:15px;height:15px;cursor:pointer;accent-color:var(--accent-blue)">'
    +'</label>';

  document.body.appendChild(menu);

  menu.querySelectorAll('.mf-board').forEach(function(cb){
    cb.addEventListener('change', function(){
      bFields[this.dataset.key] = this.checked;
      SVK.saveFields('board', bFields);
      var activeTab = document.querySelector('.view-tab.active');
      if (activeTab) activeTab.click();
    });
  });
  menu.querySelectorAll('.mf-list').forEach(function(cb){
    cb.addEventListener('change', function(){
      lFields[this.dataset.key] = this.checked;
      SVK.saveFields('list', lFields);
      var activeTab = document.querySelector('.view-tab.active');
      if (activeTab) activeTab.click();
    });
  });
  var subCb = menu.querySelector('#mfShowSubtasks');
  if (subCb) subCb.addEventListener('change', function(){
    if (window.state) window.state.showAllSubtasks = this.checked;
    var activeTab = document.querySelector('.view-tab.active');
    if (activeTab) activeTab.click();
  });
  setTimeout(function(){
    document.addEventListener('click', function h(e){ if (!menu.contains(e.target)){menu.remove();document.removeEventListener('click',h);} });
  }, 10);
};

// ÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ Wire into existing app ÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ
// Patch ShadowAgenda to delegate group/unified/personal views to SVK
var SVK_VIEWS = ['group','unified','createdbyme','assignedtome','sharedwithme','personal','agenda'];

function svkWire() {
  if (!window.ShadowAgenda) { setTimeout(svkWire, 200); return; }

  var _origBoard = window.ShadowAgenda.renderBoard;
  var _origList = window.ShadowAgenda.renderList;

  window.ShadowAgenda.renderBoard = function (container, tasks, ctx) {
    var v = window.state && window.state.currentView;
    if (SVK_VIEWS.indexOf(v) >= 0) SVK.renderBoard(container, tasks, ctx);
    else _origBoard.call(this, container, tasks, ctx);
  };
  window.ShadowAgenda.renderList = function (container, tasks, ctx) {
    var v = window.state && window.state.currentView;
    if (SVK_VIEWS.indexOf(v) >= 0) SVK.renderList(container, tasks, ctx);
    else _origList.call(this, container, tasks, ctx);
  };

  // Rebind Manage Fields button to SVK's enhanced dropdown
  var mfBtn = document.getElementById('manageFieldsBtn');
  if (mfBtn) {
    var newMfBtn = mfBtn.cloneNode(true);
    mfBtn.parentNode.replaceChild(newMfBtn, mfBtn);
    newMfBtn.addEventListener('click', function(e) { e.stopPropagation(); window.showManageFieldsDropdown(); });
  }

  // Load persisted state for current user
  function tryInit() {
    if (window.state && window.state.currentUserId) {
      SVK.initFromPersistedState(window.state.currentUserId);
    } else {
      var r = 0, t = setInterval(function() {
        if (++r > 40 || (window.state && window.state.currentUserId)) {
          if (window.state && window.state.currentUserId) SVK.initFromPersistedState(window.state.currentUserId);
          clearInterval(t);
        }
      }, 250);
    }
  }
  tryInit();
}

// Run after DOM + other scripts are ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', svkWire);
} else {
  svkWire();
}

// Expose ShadowViewKit alias for any external callers
window.ShadowViewKit = {
  renderBoard: function(c,t,x){ SVK.renderBoard(c,t,x); },
  renderList: function(c,t,x){ SVK.renderList(c,t,x); }
};

// ÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ Settings Merge: Group Settings ÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ Master Settings ÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ
// Merges the small group settings modal into the master settings page.
// Clicking the gear icon on a group now opens master settings,
// navigates to the group, and lands on Task Settings.
// Also adds Preferences + Workflows & Rules tabs to the group detail.
(function svkSettingsMerge() {

  function injectMergedGroupTabs() {
    var gd = document.getElementById('groupDetailView');
    if (!gd) return;
    var tabsContainer = gd.querySelector('.group-detail-tabs');
    if (!tabsContainer) return;

    if (!tabsContainer.querySelector('[data-tab="preferences"]')) {
      var prefBtn = document.createElement('button');
      prefBtn.className = 'group-tab';
      prefBtn.dataset.tab = 'preferences';
      prefBtn.textContent = 'Preferences';
      tabsContainer.appendChild(prefBtn);
    }

    if (!tabsContainer.querySelector('[data-tab="workflows"]')) {
      var wfBtn = document.createElement('button');
      wfBtn.className = 'group-tab';
      wfBtn.dataset.tab = 'workflows';
      wfBtn.textContent = 'Workflows & Rules';
      tabsContainer.appendChild(wfBtn);
    }

    if (!document.getElementById('tab-preferences')) {
      var prefContent = document.createElement('div');
      prefContent.className = 'group-tab-content';
      prefContent.id = 'tab-preferences';
      prefContent.innerHTML = '<div id="svk-prefs-body"></div>';
      var tsc = document.getElementById('tab-taskSettings');
      if (tsc && tsc.parentNode) tsc.parentNode.insertBefore(prefContent, tsc.nextSibling);
      else gd.appendChild(prefContent);
    }

    if (!document.getElementById('tab-workflows')) {
      var wfContent = document.createElement('div');
      wfContent.className = 'group-tab-content';
      wfContent.id = 'tab-workflows';
      wfContent.innerHTML = '<div id="svk-workflows-body"></div>';
      var pce = document.getElementById('tab-preferences');
      if (pce && pce.parentNode) pce.parentNode.insertBefore(wfContent, pce.nextSibling);
      else gd.appendChild(wfContent);
    }

    tabsContainer.querySelectorAll('.group-tab').forEach(function(tab) {
      if (!tab._svkWired) {
        tab._svkWired = true;
        tab.addEventListener('click', function() {
          tabsContainer.querySelectorAll('.group-tab').forEach(function(t){ t.classList.remove('active'); });
          tab.classList.add('active');
          document.querySelectorAll('.group-tab-content').forEach(function(c){ c.classList.remove('active'); });
          var tgt = document.getElementById('tab-' + tab.dataset.tab);
          if (tgt) tgt.classList.add('active');
          if (tab.dataset.tab === 'preferences') svkRenderPreferences();
          if (tab.dataset.tab === 'workflows') svkRenderWorkflows();
        });
      }
    });
  }

  function svkRenderPreferences() {
    var body = document.getElementById('svk-prefs-body');
    if (!body) return;
    var groupId = (typeof currentGroupId !== 'undefined') ? currentGroupId : null;
    var group = groupId && window.state ? (window.state.groups||[]).find(function(g){return g.id===groupId;}) : null;
    if (!group) { body.innerHTML = '<p style="color:var(--text-secondary);padding:16px;">No group selected.</p>'; return; }

    var esc = SVK.esc || function(s){ return s == null ? '' : String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); };
    body.innerHTML = '<div style="display:flex;flex-direction:column;gap:16px;padding:4px 0;">'
      + '<label style="display:flex;flex-direction:column;gap:4px;font-size:13px;">'
      + '<span style="color:var(--text-secondary,#64748b);font-size:12px;">Group name</span>'
      + '<input id="svkPrefName" type="text" value="' + esc(group.name||'') + '" style="padding:8px 10px;border:1px solid var(--border-color,#334155);background:var(--bg-secondary,#0f172a);color:inherit;border-radius:7px;font-size:13px;">'
      + '</label>'
      + '<label style="display:flex;flex-direction:column;gap:4px;font-size:13px;">'
      + '<span style="color:var(--text-secondary,#64748b);font-size:12px;">Description</span>'
      + '<textarea id="svkPrefDesc" rows="3" style="padding:8px 10px;border:1px solid var(--border-color,#334155);background:var(--bg-secondary,#0f172a);color:inherit;border-radius:7px;font-size:13px;resize:vertical;">' + esc(group.description||'') + '</textarea>'
      + '</label>'
      + '<label style="display:flex;flex-direction:column;gap:4px;font-size:13px;">'
      + '<span style="color:var(--text-secondary,#64748b);font-size:12px;">Default categories (comma-separated)</span>'
      + '<input id="svkPrefCats" type="text" value="' + esc((group.defaultCategories||[]).join(', ')) + '" style="padding:8px 10px;border:1px solid var(--border-color,#334155);background:var(--bg-secondary,#0f172a);color:inherit;border-radius:7px;font-size:13px;">'
      + '</label>'
      + '<div><button id="svkPrefSave" style="padding:8px 20px;border:none;border-radius:7px;background:var(--accent,#4285f4);color:#fff;font-size:13px;cursor:pointer;font-weight:500;display:inline-flex;align-items:center;gap:6px;"><i class=\'fa-solid fa-save\'></i>Save Preferences</button></div>'
      + '</div>';

    var saveBtn = body.querySelector('#svkPrefSave');
    if (saveBtn) saveBtn.addEventListener('click', async function() {
      var patch = {
        name: (body.querySelector('#svkPrefName').value||'').trim() || group.name,
        description: body.querySelector('#svkPrefDesc').value,
        defaultCategories: body.querySelector('#svkPrefCats').value.split(',').map(function(s){return s.trim();}).filter(Boolean)
      };
      Object.assign(group, patch);
      try {
        if (window.ShadowDB && window.ShadowDB.Groups && window.ShadowDB.Groups.update) {
          await window.ShadowDB.Groups.update(groupId, patch);
        }
        if (typeof window.renderSidebar === 'function') window.renderSidebar();
        var titleEl = document.getElementById('groupDetailName');
        if (titleEl) titleEl.textContent = group.name;
        saveBtn.innerHTML = '<i class=\'fa-solid fa-check\'></i> Saved!';
        setTimeout(function(){ saveBtn.innerHTML = '<i class=\'fa-solid fa-save\'></i> Save Preferences'; }, 2000);
      } catch(e) { alert('Could not save: ' + e.message); }
    });
  }

  function svkRenderWorkflows() {
    var body = document.getElementById('svk-workflows-body');
    if (!body) return;
    var groupId = (typeof currentGroupId !== 'undefined') ? currentGroupId : null;
    if (!groupId) { body.innerHTML = '<p style="color:var(--text-secondary);padding:16px;">No group selected.</p>'; return; }

    var engine = window.WorkflowEngine;
    if (!engine || typeof engine.getRulesByGroup !== 'function') {
      body.innerHTML = '<div style="padding:24px;text-align:center;color:var(--text-secondary);font-size:13px;">Workflow engine not available.</div>';
      return;
    }

    var rules = engine.getRulesByGroup(groupId) || [];
    var canManage = engine.canManage ? engine.canManage(groupId) : true;

    var html = '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;padding:4px 0;">'
      + '<span style="font-size:12px;color:var(--text-secondary);">' + rules.length + ' rule(s) mapped to this group</span>'
      + (canManage ? '<div style="display:flex;gap:8px;">'
        + '<button id="svkWfNewRule" style="padding:6px 14px;border:1px solid var(--border-color);border-radius:6px;background:var(--accent,#4285f4);color:#fff;font-size:12px;cursor:pointer;display:inline-flex;align-items:center;gap:5px;"><i class=\'fa-solid fa-plus\'></i> New Rule</button>'
        + '<a href="workflow.html?groupId=' + encodeURIComponent(groupId) + '" style="padding:6px 14px;border:1px solid var(--border-color);border-radius:6px;font-size:12px;color:var(--accent,#4285f4);text-decoration:none;display:inline-flex;align-items:center;gap:5px;"><i class=\'fa-solid fa-up-right-from-square\'></i> Open Workflow Window</a>'
        + '</div>' : '') + '</div>';

    if (rules.length === 0) {
      html += '<div style="text-align:center;padding:32px;color:var(--text-secondary);font-size:13px;border:1px dashed var(--border-color);border-radius:8px;">No rules yet for this group.</div>';
    } else {
      html += '<div>' + rules.map(function(r) {
        var st = (r.state||'draft').toLowerCase();
        return '<div style="display:flex;align-items:center;gap:10px;padding:10px 12px;border:1px solid var(--border-color);border-radius:7px;margin-bottom:6px;">'
          + '<i class=\'fa-solid fa-bolt\' style=\'color:#4285f4;\'></i>'
          + '<span style=\'flex:1;font-size:13px;\'>' + (r.name||'Untitled rule') + '</span>'
          + '<span style=\'font-size:11px;padding:2px 8px;border-radius:8px;background:rgba(66,133,244,.15);color:#4285f4;\'>' + st + '</span>'
          + (canManage ? '<button data-rule-id=\"' + r.id + '\" class=\"svk-wf-edit-btn\" style=\"background:none;border:none;cursor:pointer;color:var(--text-secondary);font-size:12px;padding:4px 6px;\" title=\"Edit\"><i class=\"fa-solid fa-pen\"></i></button>' : '')
          + '</div>';
      }).join('') + '</div>';
    }

    body.innerHTML = html;

    var newRuleBtn = body.querySelector('#svkWfNewRule');
    if (newRuleBtn) newRuleBtn.addEventListener('click', function() {
      if (window.ShadowWorkflowBuilder && window.ShadowWorkflowBuilder.openBuilder) {
        window.ShadowWorkflowBuilder.openBuilder({groupId: groupId, lockGroup: true});
        document.getElementById('settingsOverlay').style.display = 'none';
      } else {
        window.location.href = 'workflow.html?groupId=' + encodeURIComponent(groupId) + '&new=1';
      }
    });

    body.querySelectorAll('.svk-wf-edit-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var id = btn.getAttribute('data-rule-id');
        window.location.href = 'workflow.html?groupId=' + encodeURIComponent(groupId) + '&ruleId=' + encodeURIComponent(id);
      });
    });
  }

  // Redirect openGroupSettings to master settings
  SVK.openGroupInMasterSettings = function(groupId, initialTab) {
    initialTab = initialTab || 'taskSettings';
    var overlay = document.getElementById('settingsOverlay');
    if (!overlay) return;
    overlay.style.display = 'flex';

    // Activate groups section in left nav
    var groupsNavItem = document.querySelector('.settings-nav-item[data-section="groups"]');
    if (groupsNavItem) groupsNavItem.click();

    function doOpen() {
      if (typeof window.openGroupDetail === 'function') {
        window.openGroupDetail(groupId);
        requestAnimationFrame(function() {
          injectMergedGroupTabs();
          var targetTab = document.querySelector('.group-tab[data-tab="' + initialTab + '"]');
          if (targetTab && !targetTab.classList.contains('active')) {
            targetTab.click();
          }
          if (initialTab === 'preferences') svkRenderPreferences();
          if (initialTab === 'workflows') svkRenderWorkflows();
        });
      }
    }
    setTimeout(doOpen, 120);
  };

  // Override window.openGroupSettings to redirect to master settings
  window.openGroupSettings = function(groupId, tab) {
    var tabMap = { workflows: 'taskSettings', general: 'general', members: 'members', preferences: 'preferences' };
    var mappedTab = tabMap[tab] || 'taskSettings';
    SVK.openGroupInMasterSettings(groupId, mappedTab);
  };

  // Patch openGroupDetail to always inject new tabs after render
  var _origOpenGroupDetail = window.openGroupDetail;
  if (typeof _origOpenGroupDetail === 'function') {
    window.openGroupDetail = function(groupId) {
      _origOpenGroupDetail.call(this, groupId);
      requestAnimationFrame(function() { injectMergedGroupTabs(); });
    };
  }

  // Watch settingsOverlay visibility to inject tabs when it opens
  var _settingsOverlay = document.getElementById('settingsOverlay');
  if (_settingsOverlay) {
    var _soObserver = new MutationObserver(function(mutations) {
      mutations.forEach(function(m) {
        if (m.type === 'attributes' && m.attributeName === 'style' && _settingsOverlay.style.display !== 'none') {
          requestAnimationFrame(injectMergedGroupTabs);
        }
      });
    });
    _soObserver.observe(_settingsOverlay, {attributes: true});
  }

  // Initial injection in case settings is already open
  injectMergedGroupTabs();

})(); // end svkSettingsMerge
})(); // end IIFE
// ================================================================
// shadow-view-kit.js - ShadowViewKit (SVK)
// Unified Board & List View Components for Shadow ToDo
// Board View (Kanban) + List View (Grouped Table)
// Drag & Drop, Collapsible Groups, Manage Fields, State per userId
// ================================================================
(function () {
'use strict';

window.SVK = window.SVK || {};
var SVK = window.SVK;

// ÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂ Escape helper ÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂ
SVK.esc = function (s) {
  if (s == null) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
};
SVK.getInitials = function (name) {
  if (!name) return '?';
  var p = name.trim().split(/\s+/);
  return p.length === 1 ? p[0][0].toUpperCase() : (p[0][0] + p[p.length - 1][0]).toUpperCase();
};
SVK.avatarColor = function (name) {
  var c = ['#4285f4','#ea4335','#34a853','#fbbc04','#9c27b0','#00acc1','#e67e22','#1abc9c'];
  if (!name) return c[0];
  var h = 0;
  for (var i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffffff;
  return c[Math.abs(h) % c.length];
};
SVK.fmtDate = function (ds) {
  if (!ds) return '';
  return new Date(ds + 'T00:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
};
SVK.isOverdue = function (ds) { return ds && new Date(ds + 'T23:59:59') < new Date(); };
SVK.isDone = function (t) {
  var s = (t && t.status) ? String(t.status).toLowerCase() : '';
  return s === 'completed' || s === 'done' || s === 'closed' || s === 'fixed';
};

// ÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂ State persistence (per userId) ÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂ
SVK.STATE_KEY_PREFIX = 'svk_state_';
SVK._collapsedGroups = {};
SVK.getPersistedState = function (userId) {
  try { var r = localStorage.getItem(SVK.STATE_KEY_PREFIX + (userId||'anon')); return r ? JSON.parse(r) : {}; } catch(e) { return {}; }
};
SVK.persistState = function (userId, data) {
  try {
    var m = Object.assign({}, SVK.getPersistedState(userId), data);
    localStorage.setItem(SVK.STATE_KEY_PREFIX + (userId||'anon'), JSON.stringify(m));
    if (window.ShadowDB && window.ShadowDB._sb && userId) {
      window.ShadowDB._sb.from('user_view_prefs').upsert({user_id:userId,prefs:JSON.stringify(m),updated_at:new Date().toISOString()},{onConflict:'user_id'}).then(function(){}).catch(function(){});
    }
  } catch(e) {}
};
SVK.isGroupCollapsed = function (key, userId) {
  if (SVK._collapsedGroups.hasOwnProperty(key)) return SVK._collapsedGroups[key];
  var ps = SVK.getPersistedState(userId);
  return !!(ps.collapsedGroups && ps.collapsedGroups[key]);
};
SVK.toggleGroupCollapse = function (key, userId) {
  SVK._collapsedGroups[key] = !SVK.isGroupCollapsed(key, userId);
  var ps = SVK.getPersistedState(userId);
  if (!ps.collapsedGroups) ps.collapsedGroups = {};
  ps.collapsedGroups[key] = SVK._collapsedGroups[key];
  SVK.persistState(userId, {collapsedGroups: ps.collapsedGroups});
};
SVK.initFromPersistedState = function (userId) {
  if (!userId) return;
  var ps = SVK.getPersistedState(userId);
  var s = window.state; if (!s) return;
  if (ps.manageFields) {
    if (!s.manageFields) s.manageFields = {};
    if (ps.manageFields.board) s.manageFields.board = Object.assign({}, SVK.DEFAULT_FIELDS_BOARD, ps.manageFields.board);
    if (ps.manageFields.list) s.manageFields.list = Object.assign({}, SVK.DEFAULT_FIELDS_LIST, ps.manageFields.list);
  }
  if (ps.collapsedGroups) Object.assign(SVK._collapsedGroups, ps.collapsedGroups);
};

// ÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂ Colors & Grouping Helpers ÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂ
SVK.DEFAULT_STATUSES = [
  {name:'Open',color:'#e53e3e'},{name:'In Progress',color:'#d69e2e'},
  {name:'Fixed',color:'#3182ce'},{name:'Completed',color:'#38a169'},
  {name:'Closed',color:'#718096'},{name:'None',color:'#718096'}
];
SVK.GROUP_COLORS = ['#e53e3e','#dd6b20','#d69e2e','#38a169','#3182ce','#805ad5','#d53f8c','#00acc1','#e67e22','#1abc9c','#9c27b0','#4285f4'];
SVK.getGroupColor = function (gid) {
  var s = window.state; if (!s) return '#4285f4';
  var g = (s.groups||[]).find(function(g){return g.id===gid;});
  if (g && g.color) return g.color;
  var idx = (s.groups||[]).findIndex(function(g){return g.id===gid;});
  return SVK.GROUP_COLORS[Math.max(0,idx) % SVK.GROUP_COLORS.length];
};
SVK.getStatusColor = function (name, gid) {
  var s = window.state;
  if (s) {
    var g = (s.groups||[]).find(function(g){return g.id===gid;});
    if (g && g.statuses) { var st = g.statuses.find(function(x){return x.name===name;}); if (st) return st.color; }
  }
  var def = SVK.DEFAULT_STATUSES.find(function(x){return x.name===name;});
  return def ? def.color : '#718096';
};
SVK.priColor = function (p) { return p==='High'?'#ea4335':p==='Medium'?'#f59f00':p==='Low'?'#34a853':'#9aa0a6'; };
SVK.getGroupName = function (gid) {
  var s = window.state; if (!s) return gid||'';
  var g = (s.groups||[]).find(function(g){return g.id===gid;});
  return g ? g.name : (gid||'');
};
SVK.getGroupingKey = function (task, gb) {
  if (gb==='category') return task.category||'Uncategorized';
  if (gb==='status') return task.status||'Open';
  if (gb==='priority') return task.priority||'None';
  if (gb==='assignee') return task.assignee||'Unassigned';
  if (gb==='dueDate') {
    if (!task.dueDate) return 'No Due Date';
    var today=new Date(); today.setHours(0,0,0,0);
    var d=new Date(task.dueDate+'T00:00:00');
    if (d<today) return 'Overdue';
    var tom=new Date(today); tom.setDate(tom.getDate()+1);
    if (d.getTime()===today.getTime()) return 'Today';
    if (d.getTime()===tom.getTime()) return 'Tomorrow';
    var ew=new Date(today); ew.setDate(today.getDate()+7);
    if (d<=ew) return 'This Week';
    var em=new Date(today); em.setDate(today.getDate()+30);
    if (d<=em) return 'This Month';
    return 'Upcoming';
  }
  if (gb==='createdDay') return task.createdAt ? task.createdAt.substring(0,10) : 'No Date';
  if (gb==='group') return SVK.getGroupName(task.group||task.groupId);
  return 'All Tasks';
};
SVK.groupSortOrder = function (key, gb) {
  if (gb==='dueDate') { var o={Overdue:0,Today:1,Tomorrow:2,'This Week':3,'This Month':4,Upcoming:5,'No Due Date':6}; return o.hasOwnProperty(key)?o[key]:99; }
  if (gb==='priority') { var o2={High:0,Medium:1,Low:2,None:3}; return o2.hasOwnProperty(key)?o2[key]:99; }
  if (gb==='status') { var o3={Open:0,'In Progress':1,Fixed:2,Completed:3,Closed:4,None:5}; return o3.hasOwnProperty(key)?o3[key]:99; }
  return key;
};
SVK.getGroupColorByKey = function (key, gb) {
  if (gb==='status') return SVK.getStatusColor(key,null);
  if (gb==='priority') return SVK.priColor(key);
  if (gb==='dueDate') { var m={Overdue:'#e53e3e',Today:'#f59f00',Tomorrow:'#fbbc04','This Week':'#4285f4','This Month':'#34a853',Upcoming:'#38a169','No Due Date':'#718096'}; return m[key]||'#4285f4'; }
  return '#4285f4';
};

// ÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂ Manage Fields ÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂ
SVK.FIELD_DEFS_BOARD = [
  {key:'assignee',label:'Assignee',icon:'fa-user'},{key:'status',label:'Status',icon:'fa-circle-half-stroke'},
  {key:'dueDate',label:'Due Date',icon:'fa-calendar'},{key:'priority',label:'Priority',icon:'fa-circle-exclamation'},
  {key:'tags',label:'Tags',icon:'fa-tag'},{key:'subtasks',label:'Subtask Progress',icon:'fa-square-check'},
  {key:'attachments',label:'Attachments',icon:'fa-paperclip'},{key:'category',label:'Category',icon:'fa-folder'}
];
SVK.FIELD_DEFS_LIST = [
  {key:'assignee',label:'Assignee',icon:'fa-user'},{key:'status',label:'Status',icon:'fa-circle-half-stroke'},
  {key:'dueDate',label:'Due Date',icon:'fa-calendar'},{key:'priority',label:'Priority',icon:'fa-circle-exclamation'},
  {key:'tags',label:'Tags',icon:'fa-tag'},{key:'subtasks',label:'Subtask Progress',icon:'fa-square-check'},
  {key:'attachments',label:'Attachments',icon:'fa-paperclip'},{key:'category',label:'Category',icon:'fa-folder'},
  {key:'createdDate',label:'Created Date',icon:'fa-clock'},{key:'group',label:'Group',icon:'fa-users'}
];
SVK.DEFAULT_FIELDS_BOARD = {assignee:true,status:true,dueDate:true,priority:true,tags:true,subtasks:true,attachments:false,category:false};
SVK.DEFAULT_FIELDS_LIST = {assignee:true,status:true,dueDate:true,priority:false,tags:false,subtasks:true,attachments:false,category:true,createdDate:false,group:false};
SVK.getFields = function (viewType) {
  var s = window.state; if (!s) return {};
  var key = viewType || s.currentDisplay || 'board';
  if (!s.manageFields) s.manageFields = {};
  if (!s.manageFields[key]) {
    var def = key==='board' ? SVK.DEFAULT_FIELDS_BOARD : SVK.DEFAULT_FIELDS_LIST;
    s.manageFields[key] = Object.assign({}, def);
    if (s.currentUserId) {
      var ps = SVK.getPersistedState(s.currentUserId);
      if (ps.manageFields && ps.manageFields[key]) s.manageFields[key] = Object.assign({}, def, ps.manageFields[key]);
    }
  }
  return s.manageFields[key];
};
SVK.saveFields = function (viewType, fields) {
  var s = window.state; if (!s) return;
  if (!s.manageFields) s.manageFields = {};
  s.manageFields[viewType] = fields;
  if (s.currentUserId) {
    var ps = SVK.getPersistedState(s.currentUserId);
    if (!ps.manageFields) ps.manageFields = {};
    ps.manageFields[viewType] = fields;
    SVK.persistState(s.currentUserId, {manageFields: ps.manageFields});
  }
};

// ÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂ CSS Injection ÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂ
if (!document.getElementById('svk-styles')) {
  var svkStyle = document.createElement('style');
  svkStyle.id = 'svk-styles';
  svkStyle.textContent = '.svk-board{display:flex;gap:16px;padding:16px;overflow-x:auto;min-height:calc(100vh - 140px);align-items:flex-start}'
    +'.svk-col{min-width:280px;max-width:300px;flex-shrink:0;display:flex;flex-direction:column;background:var(--bg-secondary,#16213e);border-radius:10px;border:1px solid var(--border-color,#2d3748);overflow:hidden}'
    +'.svk-col__header{padding:12px 14px 10px;border-bottom:1px solid var(--border-color,#2d3748);position:sticky;top:0;background:var(--bg-secondary,#16213e);z-index:10}'
    +'.svk-col__header-top{display:flex;align-items:center;justify-content:space-between}'
    +'.svk-col__title{font-size:13px;font-weight:600;color:var(--text-primary,#e0e0e0)}'
    +'.svk-col__count{font-size:12px;color:var(--text-muted,#6c6c7c);background:var(--bg-tertiary,#0f3460);padding:2px 7px;border-radius:10px}'
    +'.svk-add-task-btn{background:none;border:none;cursor:pointer;color:var(--text-muted,#6c6c7c);padding:2px 5px;border-radius:4px;font-size:13px;display:inline-flex;align-items:center;justify-content:center;line-height:1;transition:color .15s,background .15s}'
    +'.svk-add-task-btn:hover{color:var(--accent-blue,#1a73e8);background:rgba(26,115,232,.12)}'
    +'.svk-list-add-task-btn{background:none;border:none;cursor:pointer;color:var(--text-muted,#6c6c7c);padding:2px 8px;border-radius:4px;font-size:12px;display:inline-flex;align-items:center;gap:4px;line-height:1;transition:color .15s,background .15s;margin-left:4px}'
    +'.svk-list-add-task-btn:hover{color:var(--accent-blue,#1a73e8);background:rgba(26,115,232,.12)}'
    +'.svk-col__body{padding:10px;display:flex;flex-direction:column;gap:8px;min-height:60px;flex:1}'
    +'.svk-col__empty{text-align:center;padding:20px 10px;color:var(--text-muted,#6c6c7c);font-size:13px;font-style:italic}'
    +'.svk-card{background:var(--bg-primary,#1a1a2e);border:1px solid var(--border-color,#2d3748);border-radius:8px;padding:12px;cursor:pointer;transition:box-shadow .15s,border-color .15s;position:relative}'
    +'.svk-card:hover{box-shadow:0 4px 12px rgba(0,0,0,.3);border-color:var(--accent-blue,#1a73e8)}'
    +'.svk-card.active-card{border-color:var(--accent-blue,#1a73e8);box-shadow:0 0 0 2px rgba(26,115,232,.3)}'
    +'.svk-card.dragging{opacity:.5;border:2px dashed var(--accent-blue,#1a73e8)}'
    +'.svk-card__header{display:flex;align-items:flex-start;gap:8px;margin-bottom:8px}'
    +'.svk-card__checkbox{width:16px;height:16px;border-radius:4px;flex-shrink:0;margin-top:2px;cursor:pointer;accent-color:var(--accent-blue,#1a73e8)}'
    +'.svk-card__title{font-size:13px;font-weight:500;color:var(--text-primary,#e0e0e0);line-height:1.4;flex:1}'
    +'.svk-card__title.done{text-decoration:line-through;color:var(--text-muted,#6c6c7c)}'
    +'.svk-card__pri{width:8px;height:8px;border-radius:50%;flex-shrink:0;margin-top:5px}'
    +'.svk-card__status{display:inline-flex;align-items:center;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600;margin-bottom:6px}'
    +'.svk-card__fields{display:flex;flex-direction:column;gap:5px;margin-top:6px}'
    +'.svk-card__field{display:flex;align-items:center;gap:6px;font-size:11px;color:var(--text-secondary,#a0a0b0)}'
    +'.svk-card__footer{display:flex;align-items:center;justify-content:space-between;margin-top:8px;padding-top:8px;border-top:1px solid var(--border-color,#2d3748)}'
    +'.svk-card__avatar{width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-size:9px;font-weight:700;flex-shrink:0}'
    +'.svk-card__due{font-size:11px;display:flex;align-items:center;gap:4px}'
    +'.svk-card__due.overdue{color:#ea4335}'
    +'.svk-card__tags{display:flex;flex-wrap:wrap;gap:3px;margin-top:4px}'
    +'.svk-card__tag{padding:1px 6px;border-radius:8px;font-size:10px;color:#fff;font-weight:500}'
    +'.svk-card__subtasks{font-size:11px;display:flex;align-items:center;gap:4px;color:var(--text-muted,#6c6c7c)}'
    +'.svk-drag-handle{position:absolute;left:4px;top:50%;transform:translateY(-50%);cursor:grab;color:var(--text-muted,#6c6c7c);font-size:11px;opacity:0;transition:opacity .15s}'
    +'.svk-card:hover .svk-drag-handle{opacity:1}'
    +'.svk-col.drag-target-over{background:rgba(26,115,232,.07)}'
    +'.svk-drop-zone{height:4px;background:transparent;transition:background .15s}'
    +'.svk-drop-zone.drag-over{background:var(--accent-blue,#1a73e8);border-radius:2px;height:6px}'
    +'.svk-list{width:100%;display:flex;flex-direction:column}'
    +'.svk-list-table{width:100%;border-collapse:separate;border-spacing:0}'
    +'.svk-list-thead th{position:sticky;top:0;background:var(--bg-secondary,#16213e);padding:8px 12px;font-size:11px;font-weight:600;color:var(--text-secondary,#a0a0b0);text-transform:uppercase;letter-spacing:.5px;border-bottom:2px solid var(--border-color,#2d3748);white-space:nowrap;z-index:20;text-align:left}'
    +'.svk-list-thead th:first-child{padding-left:16px}'
    +'.svk-list-group-header{background:var(--bg-secondary,#16213e)}'
    +'.svk-list-group-header td{padding:10px 12px;font-size:13px;font-weight:600;color:var(--text-primary,#e0e0e0);border-bottom:1px solid var(--border-color,#2d3748);position:sticky;top:40px;z-index:15}'
    +'.svk-list-group-header td:first-child{border-left:4px solid var(--group-color,#4285f4);padding-left:12px}'
    +'.svk-group-toggle-btn{background:none;border:none;cursor:pointer;color:var(--text-muted,#6c6c7c);padding:0 4px;transition:transform .2s;display:inline-flex;align-items:center}'
    +'.svk-group-toggle-btn.collapsed{transform:rotate(-90deg)}'
    +'.svk-group-label{display:inline-flex;align-items:center;gap:8px}'
    +'.svk-group-color-dot{width:10px;height:10px;border-radius:50%;flex-shrink:0}'
    +'.svk-group-count{font-size:11px;color:var(--text-muted,#6c6c7c);background:var(--bg-tertiary,#0f3460);padding:1px 6px;border-radius:8px;margin-left:6px}'
    +'.svk-list-row{border-bottom:1px solid var(--border-color,#2d3748);cursor:pointer;transition:background .1s}'
    +'.svk-list-row:hover{background:var(--bg-hover,#253a5c)}'
    +'.svk-list-row.active-row{background:rgba(26,115,232,.12)}'
    +'.svk-list-row.drag-over{background:rgba(26,115,232,.15);border-top:2px solid var(--accent-blue,#1a73e8)}'
    +'.svk-list-row td{padding:9px 12px;font-size:13px;color:var(--text-primary,#e0e0e0);vertical-align:middle}'
    +'.svk-list-row td:first-child{padding-left:16px}'
    +'.svk-row-title{display:flex;align-items:center;gap:8px}'
    +'.svk-row-title-text{flex:1;font-weight:500}'
    +'.svk-row-title-text.done{text-decoration:line-through;color:var(--text-muted,#6c6c7c)}'
    +'.svk-row-assignee{display:flex;align-items:center;gap:6px;white-space:nowrap}'
    +'.svk-row-avatar{width:22px;height:22px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;color:#fff;font-size:9px;font-weight:700;flex-shrink:0}'
    +'.svk-row-status{display:inline-flex;align-items:center;padding:2px 10px;border-radius:12px;font-size:11px;font-weight:600;white-space:nowrap}'
    +'.svk-row-date{display:flex;align-items:center;gap:4px;white-space:nowrap;font-size:12px}'
    +'.svk-row-date.overdue{color:#ea4335}'
    +'.svk-row-tags{display:flex;flex-wrap:wrap;gap:3px}'
    +'.svk-tag-pill{padding:1px 6px;border-radius:8px;font-size:10px;color:#fff;font-weight:500}'
    +'.svk-row-subtasks{font-size:12px;color:var(--text-secondary,#a0a0b0);display:flex;align-items:center;gap:4px}'
    +'.svk-row-pri-dot{width:8px;height:8px;border-radius:50%}'
    +'.svk-row-drag-handle{cursor:grab;color:var(--text-muted,#6c6c7c);opacity:0;transition:opacity .15s;padding:0 4px}'
    +'.svk-list-row:hover .svk-row-drag-handle{opacity:1}';
  document.head.appendChild(svkStyle);
}

// ÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂ TaskCard (Board) Renderer ÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂ
SVK.renderTaskCard = function (task, ctx) {
  var fields = SVK.getFields('board');
  var s = window.state;
  var esc = SVK.esc;
  var done = SVK.isDone(task);
  var gid = task.group || task.groupId;
  var statusColor = SVK.getStatusColor(task.status, gid);
  var priCol = SVK.priColor(task.priority);
  var isSelected = s && s.selectedTaskId === task.id;

  var statusHtml = fields.status && task.status ?
    '<span class="svk-card__status" style="background:'+statusColor+'22;color:'+statusColor+';border:1px solid '+statusColor+'55">'+esc(task.status)+'</span>' : '';

  var assigneeHtml = fields.assignee && task.assignee ?
    '<span class="svk-card__avatar" style="background:'+SVK.avatarColor(task.assignee)+'" title="'+esc(task.assignee)+'">'+esc(SVK.getInitials(task.assignee))+'</span>' : '';

  var dueDateHtml = '';
  if (fields.dueDate && task.dueDate) {
    var oc = (!done && SVK.isOverdue(task.dueDate)) ? ' overdue' : '';
    dueDateHtml = '<span class="svk-card__due'+oc+'"><i class="fa-regular fa-calendar"></i>'+esc(SVK.fmtDate(task.dueDate))+'</span>';
  }

  var tagsHtml = '';
  if (fields.tags && task.tags && task.tags.length) {
    tagsHtml = '<div class="svk-card__tags">'+task.tags.map(function(tid){
      var tag=(s&&s.tags||[]).find(function(t){return t.id===tid||t.name===tid;});
      return '<span class="svk-card__tag" style="background:'+(tag?tag.color:'#888')+'">'+esc(tag?tag.name:tid)+'</span>';
    }).join('')+'</div>';
  }

  var subtasksHtml = '';
  if (fields.subtasks && task.subtasks && task.subtasks.length) {
    var dc = task.subtasks.filter(function(st){return st.completed;}).length;
    subtasksHtml = '<span class="svk-card__subtasks"><i class="fa-regular fa-square-check"></i>'+dc+'/'+task.subtasks.length+'</span>';
  }

  var attachHtml = '';
  if (fields.attachments && task.attachments && task.attachments.length) {
    attachHtml = '<span class="svk-card__field"><i class="fa-solid fa-paperclip"></i>'+task.attachments.length+'</span>';
  }

  var catHtml = fields.category && task.category ?
    '<span class="svk-card__field"><i class="fa-solid fa-folder"></i>'+esc(task.category)+'</span>' : '';

  var priHtml = task.priority && task.priority!=='None' ?
    '<span class="svk-card__pri" style="background:'+priCol+'" title="'+esc(task.priority)+'"></span>' :
    '<span class="svk-card__pri" style="background:transparent"></span>';

  var groupName = SVK.getGroupName(gid);

  return '<div class="svk-card'+(isSelected?' active-card':'')+(done?' done-card':'')+'" data-taskid="'+esc(task.id)+'" draggable="true" data-group="'+esc(gid)+'">'
    +'<i class="fa-solid fa-grip-dots-vertical svk-drag-handle"></i>'
    +'<div class="svk-card__header">'
      +'<input type="checkbox" class="svk-card__checkbox svk-check" data-taskid="'+esc(task.id)+'"'+(done?' checked':'')+'>'
      +priHtml
      +'<div class="svk-card__title'+(done?' done':'')+'">'+esc(task.title||'(untitled)')+'</div>'
    +'</div>'
    +(statusHtml?'<div>'+statusHtml+'</div>':'')
    +tagsHtml
    +((catHtml||attachHtml||subtasksHtml)?'<div class="svk-card__fields">'+catHtml+(subtasksHtml?'<span class="svk-card__field">'+subtasksHtml+'</span>':'')+(attachHtml?'<span class="svk-card__field">'+attachHtml+'</span>':'')+'</div>':'')
    +'<div class="svk-card__footer">'
      +assigneeHtml
      +'<div style="display:flex;align-items:center;gap:8px;">'
        +dueDateHtml
        +'<span style="font-size:10px;color:var(--accent-blue,#1a73e8);font-weight:500;">'+esc(groupName)+'</span>'
      +'</div>'
    +'</div>'
  +'</div>';
};

// ÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂ TaskRow (List) Renderer ÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂ
SVK.renderTaskRow = function (task, ctx, totalCols) {
  var fields = SVK.getFields('list');
  var s = window.state;
  var esc = SVK.esc;
  var done = SVK.isDone(task);
  var gid = task.group || task.groupId;
  var statusColor = SVK.getStatusColor(task.status, gid);
  var priCol = SVK.priColor(task.priority);
  var avBg = SVK.avatarColor(task.assignee);
  var isSelected = s && s.selectedTaskId === task.id;

  var tagsHtml = (task.tags && task.tags.length) ? task.tags.map(function(tid){
    var tag=(s&&s.tags||[]).find(function(t){return t.id===tid||t.name===tid;});
    return '<span class="svk-tag-pill" style="background:'+(tag?tag.color:'#888')+'">'+esc(tag?tag.name:tid)+'</span>';
  }).join('') : '';

  var subtasksText = '';
  if (task.subtasks && task.subtasks.length) {
    var dc=task.subtasks.filter(function(st){return st.completed;}).length;
    subtasksText = dc+'/'+task.subtasks.length;
  }

  var dueCls = (!done && SVK.isOverdue(task.dueDate)) ? ' overdue' : '';
  var groupName = SVK.getGroupName(gid);
  var cells = '';

  cells += '<td><div class="svk-row-title">'
    +'<i class="fa-solid fa-grip-dots-vertical svk-row-drag-handle"></i>'
    +'<input type="checkbox" class="svk-card__checkbox svk-check" data-taskid="'+esc(task.id)+'"'+(done?' checked':'')+'>'
    +(task.priority&&task.priority!=='None'?'<span class="svk-row-pri-dot" style="background:'+priCol+'" title="'+esc(task.priority)+'"></span>':'')
    +'<span class="svk-row-title-text'+(done?' done':'')+'">'+esc(task.title||'(untitled)')+'</span>'
  +'</div></td>';

  if (fields.assignee) cells += '<td><div class="svk-row-assignee">'+(task.assignee?'<span class="svk-row-avatar" style="background:'+avBg+'">'+esc(SVK.getInitials(task.assignee))+'</span>':'')+'<span style="font-size:12px">'+esc(task.assignee||'')+'</span></div></td>';
  if (fields.status) cells += '<td><span class="svk-row-status" style="background:'+statusColor+'22;color:'+statusColor+';border:1px solid '+statusColor+'55">'+esc(task.status||'Open')+'</span></td>';
  if (fields.dueDate) cells += '<td><div class="svk-row-date'+dueCls+'">'+(task.dueDate?'<i class="fa-regular fa-calendar"></i>'+esc(SVK.fmtDate(task.dueDate)):'<span style="color:var(--text-muted)">&#8212;</span>')+'</div></td>';
  if (fields.priority) cells += '<td>'+(task.priority&&task.priority!=='None'?'<div class="svk-row-pri"><span class="svk-row-pri-dot" style="background:'+priCol+'"></span><span style="font-size:12px">'+esc(task.priority)+'</span></div>':'<span style="color:var(--text-muted)">&#8212;</span>')+'</td>';
  if (fields.tags) cells += '<td><div class="svk-row-tags">'+(tagsHtml||'<span style="color:var(--text-muted)">&#8212;</span>')+'</div></td>';
  if (fields.subtasks) cells += '<td><div class="svk-row-subtasks">'+(subtasksText?'<i class="fa-regular fa-square-check"></i>'+subtasksText:'<span style="color:var(--text-muted)">&#8212;</span>')+'</div></td>';
  if (fields.attachments) cells += '<td>'+(task.attachments&&task.attachments.length?'<span style="display:flex;align-items:center;gap:4px;font-size:12px"><i class="fa-solid fa-paperclip"></i>'+task.attachments.length+'</span>':'<span style="color:var(--text-muted)">&#8212;</span>')+'</td>';
  if (fields.category) cells += '<td><span style="font-size:12px">'+esc(task.category||'')+'</span></td>';
  if (fields.createdDate) cells += '<td><div class="svk-row-date">'+(task.createdAt?'<i class="fa-regular fa-clock"></i>'+esc(SVK.fmtDate(task.createdAt.substring(0,10))):'<span style="color:var(--text-muted)">&#8212;</span>')+'</div></td>';
  if (fields.group) cells += '<td><span style="font-size:12px;color:var(--accent-blue,#1a73e8)">'+esc(groupName)+'</span></td>';

  return '<tr class="svk-list-row'+(isSelected?' active-row':'')+'" data-taskid="'+esc(task.id)+'" data-group="'+esc(gid)+'" draggable="true">'+cells+'</tr>';
};

// ÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂ Board View Renderer ÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂ
SVK.renderBoard = function (container, tasks, ctx) {
  if (!container) return;
  var s = window.state;
  var userId = s ? s.currentUserId : null;
  var gb = (s && s.groupBy) || 'status';
  var grouped = {}, groupOrder = [];

  tasks.forEach(function(t) {
    var key = SVK.getGroupingKey(t, gb);
    if (!grouped[key]) { grouped[key] = []; groupOrder.push(key); }
    grouped[key].push(t);
  });

  groupOrder.sort(function(a, b) {
    var oa = SVK.groupSortOrder(a, gb), ob = SVK.groupSortOrder(b, gb);
    if (typeof oa === 'number' && typeof ob === 'number') return oa - ob;
    return String(a).localeCompare(String(b));
  });

  if (!groupOrder.length) {
    container.innerHTML = '<div class="svk-board"><div style="color:var(--text-muted);padding:40px;text-align:center;width:100%">No tasks found</div></div>';
    return;
  }

  var cols = groupOrder.map(function(key) {
    var colTasks = grouped[key] || [];
    var color = SVK.getGroupColorByKey(key, gb);
    if (gb === 'group') {
      var grp = (s && s.groups || []).find(function(g) { return g.name === key; });
      if (grp) color = SVK.getGroupColor(grp.id);
    }
    var cards = colTasks.map(function(t) { return SVK.renderTaskCard(t, ctx); }).join('');
    if (!cards) cards = '<div class="svk-col__empty">No tasks</div>';
    return '<div class="svk-col" data-group-key="'+SVK.esc(key)+'" data-groupby="'+SVK.esc(gb)+'">'
      +'<div class="svk-col__header" style="border-top:4px solid '+color+'">'
        +'<div class="svk-col__header-top">'
          +'<span class="svk-col__title">'+SVK.esc(key)+'</span>'
          +'<span style="display:flex;align-items:center;gap:6px">'
            +'<span class="svk-col__count">'+colTasks.length+'</span>'
            +'<button class="svk-add-task-btn" title="Add task" data-group-key="'+SVK.esc(key)+'">'
              +'<i class="fa-solid fa-plus"></i>'
            +'</button>'
          +'</span>'
        +'</div>'
      +'</div>'
      +'<div class="svk-col__body" data-group-key="'+SVK.esc(key)+'">'+cards
        +'<div class="svk-drop-zone" data-group-key="'+SVK.esc(key)+'"></div>'
      +'</div>'
    +'</div>';
  }).join('');

  container.innerHTML = '<div class="svk-board">' + cols + '</div>';
  SVK.bindBoardInteractions(container, ctx);
  SVK.bindBoardDragDrop(container, ctx);
};

// ÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂ List View Renderer ÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂ
SVK.renderList = function (container, tasks, ctx) {
  if (!container) return;
  var s = window.state;
  var userId = s ? s.currentUserId : null;
  var gb = (s && s.groupBy) || 'status';
  var fields = SVK.getFields('list');

  var headers = '<th>Task Title</th>';
  if (fields.assignee) headers += '<th><i class="fa-solid fa-user" style="margin-right:4px"></i>Assignee</th>';
  if (fields.status) headers += '<th>Status</th>';
  if (fields.dueDate) headers += '<th><i class="fa-regular fa-calendar" style="margin-right:4px"></i>Due Date</th>';
  if (fields.priority) headers += '<th>Priority</th>';
  if (fields.tags) headers += '<th>Tags</th>';
  if (fields.subtasks) headers += '<th>Subtasks</th>';
  if (fields.attachments) headers += '<th>Attachments</th>';
  if (fields.category) headers += '<th>Category</th>';
  if (fields.createdDate) headers += '<th>Created</th>';
  if (fields.group) headers += '<th>Group</th>';

  var totalCols = 1 + (fields.assignee?1:0) + (fields.status?1:0) + (fields.dueDate?1:0)
    + (fields.priority?1:0) + (fields.tags?1:0) + (fields.subtasks?1:0)
    + (fields.attachments?1:0) + (fields.category?1:0) + (fields.createdDate?1:0) + (fields.group?1:0);

  var grouped = {}, groupOrder = [];
  tasks.forEach(function(t) {
    var key = SVK.getGroupingKey(t, gb);
    if (!grouped[key]) { grouped[key] = []; groupOrder.push(key); }
    grouped[key].push(t);
  });
  groupOrder.sort(function(a, b) {
    var oa = SVK.groupSortOrder(a, gb), ob = SVK.groupSortOrder(b, gb);
    if (typeof oa === 'number' && typeof ob === 'number') return oa - ob;
    return String(a).localeCompare(String(b));
  });

  var bodyRows = groupOrder.map(function(key) {
    var grpTasks = grouped[key] || [];
    var collapsed = SVK.isGroupCollapsed(key, userId);
    var color = SVK.getGroupColorByKey(key, gb);
    if (gb === 'group') {
      var grp = (s && s.groups || []).find(function(g) { return g.name === key; });
      if (grp) color = SVK.getGroupColor(grp.id);
    }

    var headerRow = '<tr class="svk-list-group-header" data-group-key="'+SVK.esc(key)+'">'
      +'<td colspan="'+totalCols+'" style="--group-color:'+color+'">'
        +'<div class="svk-group-label">'
          +'<button class="svk-group-toggle-btn'+(collapsed?' collapsed':'')+'" data-group-key="'+SVK.esc(key)+'">'
            +'<i class="fa-solid fa-chevron-down"></i>'
          +'</button>'
          +'<span class="svk-group-color-dot" style="background:'+color+'"></span>'
          +'<span>'+SVK.esc(key)+'</span>'
          +'<span class="svk-group-count">'+grpTasks.length+'</span>'
          +'<button class="svk-list-add-task-btn" title="Add task" data-group-key="'+SVK.esc(key)+'">'
            +'<i class="fa-solid fa-plus"></i> New task'
          +'</button>'
        +'</div>'
      +'</td>'
    +'</tr>';

    var taskRows = collapsed ? '' : grpTasks.map(function(t) { return SVK.renderTaskRow(t, ctx, totalCols); }).join('');
    return headerRow + taskRows;
  }).join('');

  if (!bodyRows) bodyRows = '<tr><td colspan="'+totalCols+'" style="text-align:center;padding:40px;color:var(--text-muted)">No tasks found</td></tr>';

  container.innerHTML = '<div class="svk-list"><table class="svk-list-table"><thead class="svk-list-thead"><tr>'+headers+'</tr></thead><tbody>'+bodyRows+'</tbody></table></div>';
  SVK.bindListInteractions(container, ctx);
  SVK.bindListDragDrop(container, ctx);
};

// ÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂ Board Interactions & Drag-Drop ÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂ
SVK.bindBoardInteractions = function (container, ctx) {
  var s = window.state;
  container.querySelectorAll('.svk-add-task-btn').forEach(function(btn) {
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      var s = window.state || {};
      var gb = (s.groupBy) || 'status';
      var groupKey = btn.getAttribute('data-group-key') || '';
      var opts = {};
      if (s.currentView === 'group' && s.filterGroup) {
        opts.groupId = s.filterGroup;
      } else {
        opts.groupId = '';
      }
      if (gb === 'status') {
        opts.status = groupKey;
      } else if (gb === 'category') {
        opts.category = groupKey;
      } else if (gb === 'group') {
        var grp = (s.groups||[]).find(function(g){ return g.name === groupKey; });
        if (grp) { opts.groupId = grp.id; }
      }
      if (typeof window.ntmResetAndOpenWith === 'function') window.ntmResetAndOpenWith(opts);
      else if (typeof window.ntmResetAndOpen === 'function') window.ntmResetAndOpen();
      else if (document.getElementById('newTaskBtn')) document.getElementById('newTaskBtn').click();
    });
  });
  container.querySelectorAll('.svk-card').forEach(function(card) {
    card.addEventListener('click', function(e) {
      if (e.target.closest('.svk-check') || e.target.closest('.svk-drag-handle')) return;
      var id = this.dataset.taskid;
      if (id && typeof window.showTaskDetail === 'function') window.showTaskDetail(id, 'panel');
      else if (ctx && ctx.onTaskClick) ctx.onTaskClick(id);
    });
  });
  container.querySelectorAll('.svk-check').forEach(function(cb) {
    cb.addEventListener('change', async function(e) {
      e.stopPropagation();
      var id = this.dataset.taskid; if (!id || !s) return;
      var task = s.tasks.find(function(t){return t.id===id;}); if (!task) return;
      task.status = this.checked ? 'Completed' : 'Open';
      task.completedAt = this.checked ? new Date().toISOString() : null;
      task.modifiedDate = new Date().toISOString();
      await window.ShadowDB.Tasks.update(task);
      if (typeof window.renderView === 'function') window.renderView();
      else document.querySelector('.view-tab.active') && document.querySelector('.view-tab.active').click();
    });
  });
};

SVK.bindBoardDragDrop = function (container, ctx) {
  var s = window.state;
  container.querySelectorAll('.svk-card').forEach(function(card) {
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
    var groupBy = col.dataset.groupby;
    col.addEventListener('dragover', function(e) { e.preventDefault(); this.classList.add('drag-target-over'); });
    col.addEventListener('dragleave', function(e) { if (!this.contains(e.relatedTarget)) this.classList.remove('drag-target-over'); });
    col.addEventListener('drop', async function(e) {
      e.preventDefault();
      this.classList.remove('drag-target-over');
      var taskId = e.dataTransfer.getData('text/plain') || SVK._draggingTaskId;
      if (!taskId || !s) return;
      var task = s.tasks.find(function(t){return t.id===taskId;}); if (!task) return;
      var changed = false;
      if (groupBy==='status' && task.status!==groupKey) { task.status=groupKey; changed=true; }
      else if (groupBy==='priority' && task.priority!==groupKey) { task.priority=groupKey; changed=true; }
      else if (groupBy==='category' && task.category!==groupKey) { task.category=groupKey; changed=true; }
      else if (groupBy==='assignee') { task.assignee=groupKey==='Unassigned'?null:groupKey; changed=true; }
      else if (groupBy==='group') {
        var grp=(s.groups||[]).find(function(g){return g.name===groupKey;});
        if (grp && task.group!==grp.id) { task.group=grp.id; changed=true; }
      }
      if (changed) {
        task.modifiedDate = new Date().toISOString();
        await window.ShadowDB.Tasks.update(task);
        var activeTab = document.querySelector('.view-tab.active');
        if (activeTab) activeTab.click();
      }
    });
  });
};

// ÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂ List Interactions & Drag-Drop ÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂ
SVK.bindListInteractions = function (container, ctx) {
  var s = window.state;
  var userId = s ? s.currentUserId : null;
  container.querySelectorAll('.svk-list-row').forEach(function(row) {
    row.addEventListener('click', function(e) {
      if (e.target.closest('.svk-check') || e.target.closest('.svk-row-drag-handle')) return;
      var id = this.dataset.taskid;
      if (id && typeof window.showTaskDetail === 'function') window.showTaskDetail(id, 'panel');
      else if (ctx && ctx.onTaskClick) ctx.onTaskClick(id);
    });
  });
  container.querySelectorAll('.svk-check').forEach(function(cb) {
    cb.addEventListener('change', async function(e) {
      e.stopPropagation();
      var id = this.dataset.taskid; if (!id || !s) return;
      var task = s.tasks.find(function(t){return t.id===id;}); if (!task) return;
      task.status = this.checked ? 'Completed' : 'Open';
      task.completedAt = this.checked ? new Date().toISOString() : null;
      task.modifiedDate = new Date().toISOString();
      await window.ShadowDB.Tasks.update(task);
      var activeTab = document.querySelector('.view-tab.active');
      if (activeTab) activeTab.click();
    });
  });
  container.querySelectorAll('.svk-list-add-task-btn').forEach(function(btn) {
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      var s = window.state || {};
      var gb = (s.groupBy) || 'status';
      var groupKey = btn.getAttribute('data-group-key') || '';
      var opts = {};
      if (s.currentView === 'group' && s.filterGroup) {
        opts.groupId = s.filterGroup;
      } else {
        opts.groupId = '';
      }
      if (gb === 'status') {
        opts.status = groupKey;
      } else if (gb === 'category') {
        opts.category = groupKey;
      } else if (gb === 'group') {
        var grp = (s.groups||[]).find(function(g){ return g.name === groupKey; });
        if (grp) { opts.groupId = grp.id; }
      }
      if (typeof window.ntmResetAndOpenWith === 'function') window.ntmResetAndOpenWith(opts);
      else if (typeof window.ntmResetAndOpen === 'function') window.ntmResetAndOpen();
      else if (document.getElementById('newTaskBtn')) document.getElementById('newTaskBtn').click();
    });
  });
  container.querySelectorAll('.svk-group-toggle-btn').forEach(function(btn) {
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      var key = this.dataset.groupKey;
      SVK.toggleGroupCollapse(key, userId);
      this.classList.toggle('collapsed');
      var headerRow = this.closest('tr'); if (!headerRow) return;
      var next = headerRow.nextElementSibling;
      var hide = this.classList.contains('collapsed');
      while (next && !next.classList.contains('svk-list-group-header')) {
        next.style.display = hide ? 'none' : '';
        next = next.nextElementSibling;
      }
    });
  });
};

SVK.bindListDragDrop = function (container, ctx) {
  var s = window.state;
  container.querySelectorAll('.svk-list-row').forEach(function(row) {
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
    row.addEventListener('dragover', function(e) { e.preventDefault(); if (this.dataset.taskid !== SVK._draggingTaskId) this.classList.add('drag-over'); });
    row.addEventListener('dragleave', function() { this.classList.remove('drag-over'); });
    row.addEventListener('drop', async function(e) {
      e.preventDefault(); this.classList.remove('drag-over');
      var taskId = e.dataTransfer.getData('text/plain') || SVK._draggingTaskId;
      if (!taskId || !s || taskId === this.dataset.taskid) return;
      var task = s.tasks.find(function(t){return t.id===taskId;}); if (!task) return;
      var gb = (s && s.groupBy) || 'status';
      var targetGroupKey = null;
      var prev = this.previousElementSibling;
      while (prev) {
        if (prev.classList.contains('svk-list-group-header')) { targetGroupKey = prev.dataset.groupKey; break; }
        prev = prev.previousElementSibling;
      }
      if (targetGroupKey) await SVK._applyGroupChange(task, targetGroupKey, gb);
    });
  });
  container.querySelectorAll('.svk-list-group-header').forEach(function(headerRow) {
    headerRow.addEventListener('dragover', function(e) { e.preventDefault(); this.style.background='rgba(26,115,232,.1)'; });
    headerRow.addEventListener('dragleave', function() { this.style.background=''; });
    headerRow.addEventListener('drop', async function(e) {
      e.preventDefault(); this.style.background='';
      var taskId = e.dataTransfer.getData('text/plain') || SVK._draggingTaskId;
      if (!taskId || !s) return;
      var task = s.tasks.find(function(t){return t.id===taskId;}); if (!task) return;
      await SVK._applyGroupChange(task, this.dataset.groupKey, (s&&s.groupBy)||'status');
    });
  });
};

SVK._applyGroupChange = async function (task, targetGroupKey, gb) {
  var s = window.state; if (!s) return;
  var changed = false;
  if (gb==='status' && task.status!==targetGroupKey) { task.status=targetGroupKey; changed=true; }
  else if (gb==='category' && task.category!==targetGroupKey) { task.category=targetGroupKey; changed=true; }
  else if (gb==='priority' && task.priority!==targetGroupKey) { task.priority=targetGroupKey; changed=true; }
  else if (gb==='assignee') { task.assignee=targetGroupKey==='Unassigned'?null:targetGroupKey; changed=true; }
  else if (gb==='group') {
    var grp=(s.groups||[]).find(function(g){return g.name===targetGroupKey;});
    if (grp && task.group!==grp.id) { task.group=grp.id; changed=true; }
  }
  if (changed) {
    task.modifiedDate = new Date().toISOString();
    await window.ShadowDB.Tasks.update(task);
    var activeTab = document.querySelector('.view-tab.active');
    if (activeTab) activeTab.click();
  }
};

// ÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂ Enhanced Manage Fields Dropdown ÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂ
window.showManageFieldsDropdown = function () {
  document.querySelectorAll('.dropdown-menu').forEach(function(m){m.remove();});
  var btn = document.getElementById('manageFieldsBtn');
  var rect = btn ? btn.getBoundingClientRect() : {right:200,bottom:0};
  var menu = document.createElement('div');
  menu.className = 'dropdown-menu';
  menu.style.cssText = 'position:fixed;right:'+(window.innerWidth-rect.right)+'px;top:'+(rect.bottom+4)+'px;z-index:9000;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:10px;padding:8px 0;min-width:260px;box-shadow:0 4px 24px rgba(0,0,0,.4);max-height:80vh;overflow-y:auto;';

  var bFields = SVK.getFields('board');
  var lFields = SVK.getFields('list');

  function mkSection(title, fieldDefs, fields, cls) {
    return '<div style="padding:8px 16px 4px;font-size:11px;font-weight:700;color:var(--text-secondary);text-transform:uppercase;letter-spacing:.7px;border-bottom:1px solid var(--border-color);margin-bottom:2px;">'+title+'</div>'
      + fieldDefs.map(function(f){
          return '<label style="display:flex;align-items:center;justify-content:space-between;padding:7px 16px;cursor:pointer;font-size:13px;gap:8px">'
            +'<span style="display:flex;align-items:center;gap:7px;"><i class="fa-solid '+f.icon+'" style="width:14px;color:var(--text-muted);font-size:12px;"></i>'+f.label+'</span>'
            +'<input type="checkbox" class="'+cls+'" data-key="'+f.key+'"'+(fields[f.key]?' checked':'')+' style="width:15px;height:15px;cursor:pointer;accent-color:var(--accent-blue)">'
          +'</label>';
        }).join('');
  }

  var s = window.state;
  var subtaskDefaults = {agenda:true,myday:true,createdbyme:true,assignedtome:true,personal:false,group:false,unified:false,sharedwithme:false};
  var showSub = s && s.showAllSubtasks != null ? s.showAllSubtasks : (subtaskDefaults[s&&s.currentView] !== false);

  menu.innerHTML = mkSection('Board View Fields', SVK.FIELD_DEFS_BOARD, bFields, 'mf-board')
    + '<div style="height:1px;background:var(--border-color);margin:4px 0"></div>'
    + mkSection('List View Fields', SVK.FIELD_DEFS_LIST, lFields, 'mf-list')
    + '<div style="height:1px;background:var(--border-color);margin:4px 0"></div>'
    + '<label style="display:flex;align-items:center;justify-content:space-between;padding:8px 16px;cursor:pointer;font-size:13px;">'
      +'<span style="display:flex;align-items:center;gap:7px;"><i class="fa-solid fa-list-check" style="width:14px;color:var(--text-muted);font-size:12px;"></i>Show all Subtasks</span>'
      +'<input type="checkbox" id="mfShowSubtasks"'+(showSub?' checked':'')+' style="width:15px;height:15px;cursor:pointer;accent-color:var(--accent-blue)">'
    +'</label>';

  document.body.appendChild(menu);

  menu.querySelectorAll('.mf-board').forEach(function(cb){
    cb.addEventListener('change', function(){
      bFields[this.dataset.key] = this.checked;
      SVK.saveFields('board', bFields);
      var activeTab = document.querySelector('.view-tab.active');
      if (activeTab) activeTab.click();
    });
  });
  menu.querySelectorAll('.mf-list').forEach(function(cb){
    cb.addEventListener('change', function(){
      lFields[this.dataset.key] = this.checked;
      SVK.saveFields('list', lFields);
      var activeTab = document.querySelector('.view-tab.active');
      if (activeTab) activeTab.click();
    });
  });
  var subCb = menu.querySelector('#mfShowSubtasks');
  if (subCb) subCb.addEventListener('change', function(){
    if (window.state) window.state.showAllSubtasks = this.checked;
    var activeTab = document.querySelector('.view-tab.active');
    if (activeTab) activeTab.click();
  });
  setTimeout(function(){
    document.addEventListener('click', function h(e){ if (!menu.contains(e.target)){menu.remove();document.removeEventListener('click',h);} });
  }, 10);
};

// ÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂ Wire into existing app ÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂ
// Patch ShadowAgenda to delegate group/unified/personal views to SVK
var SVK_VIEWS = ['group','unified','createdbyme','assignedtome','sharedwithme','personal','agenda'];

function svkWire() {
  if (!window.ShadowAgenda) { setTimeout(svkWire, 200); return; }

  var _origBoard = window.ShadowAgenda.renderBoard;
  var _origList = window.ShadowAgenda.renderList;

  window.ShadowAgenda.renderBoard = function (container, tasks, ctx) {
    var v = window.state && window.state.currentView;
    if (SVK_VIEWS.indexOf(v) >= 0) SVK.renderBoard(container, tasks, ctx);
    else _origBoard.call(this, container, tasks, ctx);
  };
  window.ShadowAgenda.renderList = function (container, tasks, ctx) {
    var v = window.state && window.state.currentView;
    if (SVK_VIEWS.indexOf(v) >= 0) SVK.renderList(container, tasks, ctx);
    else _origList.call(this, container, tasks, ctx);
  };

  // Rebind Manage Fields button to SVK's enhanced dropdown
  var mfBtn = document.getElementById('manageFieldsBtn');
  if (mfBtn) {
    var newMfBtn = mfBtn.cloneNode(true);
    mfBtn.parentNode.replaceChild(newMfBtn, mfBtn);
    newMfBtn.addEventListener('click', function(e) { e.stopPropagation(); window.showManageFieldsDropdown(); });
  }

  // Load persisted state for current user
  function tryInit() {
    if (window.state && window.state.currentUserId) {
      SVK.initFromPersistedState(window.state.currentUserId);
    } else {
      var r = 0, t = setInterval(function() {
        if (++r > 40 || (window.state && window.state.currentUserId)) {
          if (window.state && window.state.currentUserId) SVK.initFromPersistedState(window.state.currentUserId);
          clearInterval(t);
        }
      }, 250);
    }
  }
  tryInit();
}

// Run after DOM + other scripts are ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', svkWire);
} else {
  svkWire();
}

// Expose ShadowViewKit alias for any external callers
window.ShadowViewKit = {
  renderBoard: function(c,t,x){ SVK.renderBoard(c,t,x); },
  renderList: function(c,t,x){ SVK.renderList(c,t,x); }
};

// ÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂ Settings Merge: Group Settings ÃÂÃÂ¢ÃÂÃÂÃÂÃÂ Master Settings ÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂ
// Merges the small group settings modal into the master settings page.
// Clicking the gear icon on a group now opens master settings,
// navigates to the group, and lands on Task Settings.
// Also adds Preferences + Workflows & Rules tabs to the group detail.
(function svkSettingsMerge() {

  function injectMergedGroupTabs() {
    var gd = document.getElementById('groupDetailView');
    if (!gd) return;
    var tabsContainer = gd.querySelector('.group-detail-tabs');
    if (!tabsContainer) return;

    if (!tabsContainer.querySelector('[data-tab="preferences"]')) {
      var prefBtn = document.createElement('button');
      prefBtn.className = 'group-tab';
      prefBtn.dataset.tab = 'preferences';
      prefBtn.textContent = 'Preferences';
      tabsContainer.appendChild(prefBtn);
    }

    if (!tabsContainer.querySelector('[data-tab="workflows"]')) {
      var wfBtn = document.createElement('button');
      wfBtn.className = 'group-tab';
      wfBtn.dataset.tab = 'workflows';
      wfBtn.textContent = 'Workflows & Rules';
      tabsContainer.appendChild(wfBtn);
    }

    if (!document.getElementById('tab-preferences')) {
      var prefContent = document.createElement('div');
      prefContent.className = 'group-tab-content';
      prefContent.id = 'tab-preferences';
      prefContent.innerHTML = '<div id="svk-prefs-body"></div>';
      var tsc = document.getElementById('tab-taskSettings');
      if (tsc && tsc.parentNode) tsc.parentNode.insertBefore(prefContent, tsc.nextSibling);
      else gd.appendChild(prefContent);
    }

    if (!document.getElementById('tab-workflows')) {
      var wfContent = document.createElement('div');
      wfContent.className = 'group-tab-content';
      wfContent.id = 'tab-workflows';
      wfContent.innerHTML = '<div id="svk-workflows-body"></div>';
      var pce = document.getElementById('tab-preferences');
      if (pce && pce.parentNode) pce.parentNode.insertBefore(wfContent, pce.nextSibling);
      else gd.appendChild(wfContent);
    }

    tabsContainer.querySelectorAll('.group-tab').forEach(function(tab) {
      if (!tab._svkWired) {
        tab._svkWired = true;
        tab.addEventListener('click', function() {
          tabsContainer.querySelectorAll('.group-tab').forEach(function(t){ t.classList.remove('active'); });
          tab.classList.add('active');
          document.querySelectorAll('.group-tab-content').forEach(function(c){ c.classList.remove('active'); });
          var tgt = document.getElementById('tab-' + tab.dataset.tab);
          if (tgt) tgt.classList.add('active');
          if (tab.dataset.tab === 'preferences') svkRenderPreferences();
          if (tab.dataset.tab === 'workflows') svkRenderWorkflows();
        });
      }
    });
  }

  function svkRenderPreferences() {
    var body = document.getElementById('svk-prefs-body');
    if (!body) return;
    var groupId = (typeof currentGroupId !== 'undefined') ? currentGroupId : null;
    var group = groupId && window.state ? (window.state.groups||[]).find(function(g){return g.id===groupId;}) : null;
    if (!group) { body.innerHTML = '<p style="color:var(--text-secondary);padding:16px;">No group selected.</p>'; return; }

    var esc = SVK.esc || function(s){ return s == null ? '' : String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); };
    body.innerHTML = '<div style="display:flex;flex-direction:column;gap:16px;padding:4px 0;">'
      + '<label style="display:flex;flex-direction:column;gap:4px;font-size:13px;">'
      + '<span style="color:var(--text-secondary,#64748b);font-size:12px;">Group name</span>'
      + '<input id="svkPrefName" type="text" value="' + esc(group.name||'') + '" style="padding:8px 10px;border:1px solid var(--border-color,#334155);background:var(--bg-secondary,#0f172a);color:inherit;border-radius:7px;font-size:13px;">'
      + '</label>'
      + '<label style="display:flex;flex-direction:column;gap:4px;font-size:13px;">'
      + '<span style="color:var(--text-secondary,#64748b);font-size:12px;">Description</span>'
      + '<textarea id="svkPrefDesc" rows="3" style="padding:8px 10px;border:1px solid var(--border-color,#334155);background:var(--bg-secondary,#0f172a);color:inherit;border-radius:7px;font-size:13px;resize:vertical;">' + esc(group.description||'') + '</textarea>'
      + '</label>'
      + '<label style="display:flex;flex-direction:column;gap:4px;font-size:13px;">'
      + '<span style="color:var(--text-secondary,#64748b);font-size:12px;">Default categories (comma-separated)</span>'
      + '<input id="svkPrefCats" type="text" value="' + esc((group.defaultCategories||[]).join(', ')) + '" style="padding:8px 10px;border:1px solid var(--border-color,#334155);background:var(--bg-secondary,#0f172a);color:inherit;border-radius:7px;font-size:13px;">'
      + '</label>'
      + '<div><button id="svkPrefSave" style="padding:8px 20px;border:none;border-radius:7px;background:var(--accent,#4285f4);color:#fff;font-size:13px;cursor:pointer;font-weight:500;display:inline-flex;align-items:center;gap:6px;"><i class=\'fa-solid fa-save\'></i>Save Preferences</button></div>'
      + '</div>';

    var saveBtn = body.querySelector('#svkPrefSave');
    if (saveBtn) saveBtn.addEventListener('click', async function() {
      var patch = {
        name: (body.querySelector('#svkPrefName').value||'').trim() || group.name,
        description: body.querySelector('#svkPrefDesc').value,
        defaultCategories: body.querySelector('#svkPrefCats').value.split(',').map(function(s){return s.trim();}).filter(Boolean)
      };
      Object.assign(group, patch);
      try {
        if (window.ShadowDB && window.ShadowDB.Groups && window.ShadowDB.Groups.update) {
          await window.ShadowDB.Groups.update(groupId, patch);
        }
        if (typeof window.renderSidebar === 'function') window.renderSidebar();
        var titleEl = document.getElementById('groupDetailName');
        if (titleEl) titleEl.textContent = group.name;
        saveBtn.innerHTML = '<i class=\'fa-solid fa-check\'></i> Saved!';
        setTimeout(function(){ saveBtn.innerHTML = '<i class=\'fa-solid fa-save\'></i> Save Preferences'; }, 2000);
      } catch(e) { alert('Could not save: ' + e.message); }
    });
  }

  function svkRenderWorkflows() {
    var body = document.getElementById('svk-workflows-body');
    if (!body) return;
    var groupId = (typeof currentGroupId !== 'undefined') ? currentGroupId : null;
    if (!groupId) { body.innerHTML = '<p style="color:var(--text-secondary);padding:16px;">No group selected.</p>'; return; }

    var engine = window.WorkflowEngine;
    if (!engine || typeof engine.getRulesByGroup !== 'function') {
      body.innerHTML = '<div style="padding:24px;text-align:center;color:var(--text-secondary);font-size:13px;">Workflow engine not available.</div>';
      return;
    }

    var rules = engine.getRulesByGroup(groupId) || [];
    var canManage = engine.canManage ? engine.canManage(groupId) : true;

    var html = '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;padding:4px 0;">'
      + '<span style="font-size:12px;color:var(--text-secondary);">' + rules.length + ' rule(s) mapped to this group</span>'
      + (canManage ? '<div style="display:flex;gap:8px;">'
        + '<button id="svkWfNewRule" style="padding:6px 14px;border:1px solid var(--border-color);border-radius:6px;background:var(--accent,#4285f4);color:#fff;font-size:12px;cursor:pointer;display:inline-flex;align-items:center;gap:5px;"><i class=\'fa-solid fa-plus\'></i> New Rule</button>'
        + '<a href="workflow.html?groupId=' + encodeURIComponent(groupId) + '" style="padding:6px 14px;border:1px solid var(--border-color);border-radius:6px;font-size:12px;color:var(--accent,#4285f4);text-decoration:none;display:inline-flex;align-items:center;gap:5px;"><i class=\'fa-solid fa-up-right-from-square\'></i> Open Workflow Window</a>'
        + '</div>' : '') + '</div>';

    if (rules.length === 0) {
      html += '<div style="text-align:center;padding:32px;color:var(--text-secondary);font-size:13px;border:1px dashed var(--border-color);border-radius:8px;">No rules yet for this group.</div>';
    } else {
      html += '<div>' + rules.map(function(r) {
        var st = (r.state||'draft').toLowerCase();
        return '<div style="display:flex;align-items:center;gap:10px;padding:10px 12px;border:1px solid var(--border-color);border-radius:7px;margin-bottom:6px;">'
          + '<i class=\'fa-solid fa-bolt\' style=\'color:#4285f4;\'></i>'
          + '<span style=\'flex:1;font-size:13px;\'>' + (r.name||'Untitled rule') + '</span>'
          + '<span style=\'font-size:11px;padding:2px 8px;border-radius:8px;background:rgba(66,133,244,.15);color:#4285f4;\'>' + st + '</span>'
          + (canManage ? '<button data-rule-id=\"' + r.id + '\" class=\"svk-wf-edit-btn\" style=\"background:none;border:none;cursor:pointer;color:var(--text-secondary);font-size:12px;padding:4px 6px;\" title=\"Edit\"><i class=\"fa-solid fa-pen\"></i></button>' : '')
          + '</div>';
      }).join('') + '</div>';
    }

    body.innerHTML = html;

    var newRuleBtn = body.querySelector('#svkWfNewRule');
    if (newRuleBtn) newRuleBtn.addEventListener('click', function() {
      if (window.ShadowWorkflowBuilder && window.ShadowWorkflowBuilder.openBuilder) {
        window.ShadowWorkflowBuilder.openBuilder({groupId: groupId, lockGroup: true});
        document.getElementById('settingsOverlay').style.display = 'none';
      } else {
        window.location.href = 'workflow.html?groupId=' + encodeURIComponent(groupId) + '&new=1';
      }
    });

    body.querySelectorAll('.svk-wf-edit-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var id = btn.getAttribute('data-rule-id');
        window.location.href = 'workflow.html?groupId=' + encodeURIComponent(groupId) + '&ruleId=' + encodeURIComponent(id);
      });
    });
  }

  // Redirect openGroupSettings to master settings
  SVK.openGroupInMasterSettings = function(groupId, initialTab) {
    initialTab = initialTab || 'taskSettings';
    var overlay = document.getElementById('settingsOverlay');
    if (!overlay) return;
    overlay.style.display = 'flex';

    // Activate groups section in left nav
    var groupsNavItem = document.querySelector('.settings-nav-item[data-section="groups"]');
    if (groupsNavItem) groupsNavItem.click();

    function doOpen() {
      if (typeof window.openGroupDetail === 'function') {
        window.openGroupDetail(groupId);
        requestAnimationFrame(function() {
          injectMergedGroupTabs();
          var targetTab = document.querySelector('.group-tab[data-tab="' + initialTab + '"]');
          if (targetTab && !targetTab.classList.contains('active')) {
            targetTab.click();
          }
          if (initialTab === 'preferences') svkRenderPreferences();
          if (initialTab === 'workflows') svkRenderWorkflows();
        });
      }
    }
    setTimeout(doOpen, 120);
  };

  // Override window.openGroupSettings to redirect to master settings
  window.openGroupSettings = function(groupId, tab) {
    var tabMap = { workflows: 'taskSettings', general: 'general', members: 'members', preferences: 'preferences' };
    var mappedTab = tabMap[tab] || 'taskSettings';
    SVK.openGroupInMasterSettings(groupId, mappedTab);
  };

  // Patch openGroupDetail to always inject new tabs after render
  var _origOpenGroupDetail = window.openGroupDetail;
  if (typeof _origOpenGroupDetail === 'function') {
    window.openGroupDetail = function(groupId) {
      _origOpenGroupDetail.call(this, groupId);
      requestAnimationFrame(function() { injectMergedGroupTabs(); });
    };
  }

  // Watch settingsOverlay visibility to inject tabs when it opens
  var _settingsOverlay = document.getElementById('settingsOverlay');
  if (_settingsOverlay) {
    var _soObserver = new MutationObserver(function(mutations) {
      mutations.forEach(function(m) {
        if (m.type === 'attributes' && m.attributeName === 'style' && _settingsOverlay.style.display !== 'none') {
          requestAnimationFrame(injectMergedGroupTabs);
        }
      });
    });
    _soObserver.observe(_settingsOverlay, {attributes: true});
  }

  // Initial injection in case settings is already open
  injectMergedGroupTabs();

})(); // end svkSettingsMerge
})(); // end IIFE
