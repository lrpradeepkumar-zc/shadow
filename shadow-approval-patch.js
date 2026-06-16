// shadow-approval-patch.js
// Fixes all critical approval workflow gaps:
// C1: localStorage-based storage (replaces broken IndexedDB backend)
// C2+C3: ApprovalUI.init() called, showTaskDetail hooked
// C4: Distinct REJECTED state added
// C5: validateTaskCompletion hooked into status change
// C6: validateFieldUpdate hooked into field saves
// C7+C8: Settings panel auto-render fixed, toggle show/hide fixed
// C9+C11: CURRENT_USER from window.state, members from state
// C12+C13: Badge text fixed, card badges wired in
(function() {
'use strict';

/* âââââââââââââââââââââââââââââââââââââââââââââââ
   PART 1 \u2014 localStorage Storage Engine
   Replaces broken IndexedDB in approval-backend.js
   âââââââââââââââââââââââââââââââââââââââââââââââ */
/* ============================================================
   Supabase Storage Engine
   Replaces localStorage-based storage (Issues Fixed: all approval data now persists across sessions/browsers)
   ============================================================ */
  var SB = {
    _cache: { settings: [], requests: [], audit: [] },
    _sb: function() { return (window.ShadowDB && ShadowDB._sb) ? ShadowDB._sb : null; },
    _tableMap: { settings: 'approval_settings_tbl', requests: 'approval_requests', audit: 'approval_audit' },

    /* Map app object (camelCase) -> DB row (snake_case) per store. Non-mapped stores pass through. */
    _toDb: function(store, obj) {
      if (store === 'settings') {
        var row = {
          group_id: obj.groupId,
          enabled: !!obj.enabled,
          mandate_approval: !!obj.mandateApproval,
          default_approver: obj.defaultApprover || null
        };
        return row;
      }
      return obj;
    },
    /* Map DB row -> app object */
    _fromDb: function(store, row) {
      if (!row) return row;
      if (store === 'settings') {
        return {
          groupId: row.group_id,
          enabled: !!row.enabled,
          mandateApproval: !!row.mandate_approval,
          defaultApprover: row.default_approver || null,
          defaultApproverType: 'member'
        };
      }
      return row;
    },
    /* Conflict column for upsert per store */
    _conflictKey: function(store) {
      return store === 'settings' ? 'group_id' : 'id';
    },
    /* Field used to locate a row when deleting (settings has no id) */
    _matchField: function(store, obj) {
      if (store === 'settings') return { col: 'group_id', val: obj && (obj.groupId || obj.group_id) };
      return { col: 'id', val: obj && obj.id };
    },

    /* Load all data for a store from Supabase into cache */
    preload: function(store, cb) {
      var sb = this._sb();
      var self = this;
      if (!sb) { cb && cb([]); return; }
      sb.from(self._tableMap[store]).select('*').then(function(res) {
        var rows = res.data || [];
        self._cache[store] = rows.map(function(r){ return self._fromDb(store, r); });
        cb && cb(self._cache[store]);
      });
    },

    getAll: function(store) { return this._cache[store] || []; },
    setAll: function(store, arr) {
      this._cache[store] = arr;
      /* Persist is done via put/add/del operations */
    },
    get: function(store, id) {
      return (this._cache[store] || []).find(function(x){ return x.id === id; }) || null;
    },
    getByField: function(store, field, val) {
      return (this._cache[store] || []).filter(function(x){ return x[field] === val; });
    },
    add: function(store, obj) {
      var sb = this._sb();
      var self = this;
      // Ensure object always has a unique id so subsequent get/put can locate it.
      if (!obj.id) {
        obj.id = (store==='requests' ? 'areq_' : store==='audit' ? 'aud_' : 'as_') +
                 Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
      }
      this._cache[store] = this._cache[store] || [];
      this._cache[store].push(obj);
      if (sb) {
        sb.from(self._tableMap[store]).insert(self._toDb(store, obj)).then(function(res) {
          if (res.error) console.warn('[Approval] insert error:', res.error.message);
        });
      }
      return obj.id;
    },
    put: function(store, obj) {
      var sb = this._sb();
      var self = this;
      var arr = this._cache[store] || [];
      var idx = arr.findIndex(function(x){ return x.id === obj.id; });
      if (idx >= 0) arr[idx] = obj; else arr.push(obj);
      this._cache[store] = arr;
      if (sb) {
        sb.from(self._tableMap[store]).upsert(self._toDb(store, obj), { onConflict: self._conflictKey(store) }).then(function(res) {
          if (res.error) console.warn('[Approval] upsert error:', res.error.message);
        });
      }
    },
    del: function(store, id) {
      var sb = this._sb();
      var self = this;
      this._cache[store] = (this._cache[store] || []).filter(function(x){ return x.id !== id; });
      if (sb) {
        sb.from(self._tableMap[store]).delete().eq('id', id).then(function(res) {
          if (res.error) console.warn('[Approval] delete error:', res.error.message);
        });
      }
    }
  };
  /* Alias LS to SB for backward compatibility */
  var LS = SB;;

/* âââââââââââââââââââââââââââââââââââââââââââââââ
   PART 2 \u2014 Patch ApprovalWorkflow backend
   âââââââââââââââââââââââââââââââââââââââââââââââ */
function getCurrentUser() {
  var s = window.state;
  if (!s) return 'Unknown';
  return s.currentUserName || s.currentUserId || 'Unknown';
}
function getCurrentUserId() {
  var s = window.state;
  return s ? (s.currentUserId || s.currentUserName || 'Unknown') : 'Unknown';
}
// Normalize members source: state.members can be array, plain object, or empty.
// Falls back to ShadowDB.Members cache to avoid crashes in approval flow.
function _normalizeMembers(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'object') {
    try { return Object.values(raw); } catch (e) { return []; }
  }
  return [];
}
function _allMembersSync() {
  var s = window.state;
  var arr = _normalizeMembers(s && s.members);
  if (arr.length > 0) return arr;
  // Fallback: ShadowDB cached list (already loaded at boot)
  try {
    if (typeof ShadowDB !== 'undefined' && ShadowDB.Members && ShadowDB.Members._cache) {
      var c = ShadowDB.Members._cache;
      if (Array.isArray(c)) return c;
    }
  } catch(e) {}
  return [];
}
function getGroupMembers(groupId) {
  var all = _allMembersSync();
  if (!all.length) return [];
  var s = window.state;
  var grp = s && s.groups && s.groups.find(function(g){return g.id===groupId;});
  var adminIds = (grp && grp.adminIds) || [];
  var memberIds = (grp && grp.memberIds) || [];
  var allIds = adminIds.concat(memberIds);
  // If group has no membership metadata, surface all known members
  if (!allIds.length) return all;
  return all.filter(function(m){
    var mid = m && (m.id || m.uid || m.userId);
    return allIds.indexOf(mid) !== -1;
  });
}
function isGroupAdmin(groupId, userId) {
  var s = window.state;
  if (!s) return false;
  var grp = s.groups && s.groups.find(function(g){return g.id===groupId;});
  // Normalize members source and tolerate missing user record
  var all = _allMembersSync();
  var user = all.find(function(m){
    return m && (m.id===userId || m.uid===userId || m.userId===userId || m.name===userId);
  });
  if (user) {
    var r = user.role;
    if (r === 'admin' || r === 'Admin' || r === 'Owner' || r === 'group_admin' || r === 'Moderator') return true;
    if (grp && (grp.adminIds||[]).indexOf(user.id) !== -1) return true;
  }
  // Fallback to state.currentUserRole for the active user
  if ((userId === (s.currentUserId) || userId === (s.currentUserName)) && s.currentUserRole) {
    var cr = String(s.currentUserRole).toLowerCase();
    if (cr === 'admin' || cr === 'owner' || cr === 'group_admin' || cr === 'moderator') return true;
  }
  return false;
}

// Patch ApprovalWorkflow if it exists
if (typeof ApprovalWorkflow !== 'undefined') {

  // C4: Add REJECTED state
  ApprovalWorkflow.ApprovalState.REJECTED = 'rejected';

  // Patch Settings to use localStorage
  ApprovalWorkflow.Settings.get = function(groupId) {
    var defaults = {
      groupId: groupId, enabled: false, mandateApproval: false,
      defaultApprover: null, defaultApproverType: 'member'
    };
    function lookup() {
      var arr = LS.getAll('settings');
      var r = arr.find(function(x){return x.groupId===groupId;});
      return r || defaults;
    }
    // If cache is empty and Supabase client is now available, preload once before returning.
    var arr0 = LS.getAll('settings');
    if ((!arr0 || arr0.length === 0) && LS._sb && LS._sb()) {
      return new Promise(function(resolve) {
        LS.preload('settings', function(){ resolve(lookup()); });
      });
    }
    return Promise.resolve(lookup());
  };
  ApprovalWorkflow.Settings.save = function(settings) {
    LS.put('settings', settings);
    ApprovalWorkflow.emit('approval:settings:changed', settings);
    ApprovalWorkflow.AuditLog.log({
      taskId: null, requestId: null, actorId: getCurrentUser(),
      actionType: 'settings_updated',
      notes: 'Settings updated for group ' + settings.groupId,
      metadata: { settings: settings }
    });
    return Promise.resolve(settings);
  };
  ApprovalWorkflow.Settings.isEnabled = function(groupId) {
    return ApprovalWorkflow.Settings.get(groupId).then(function(s){return s.enabled;});
  };
  ApprovalWorkflow.Settings.isMandatory = function(groupId) {
    return ApprovalWorkflow.Settings.get(groupId).then(function(s){return s.enabled && s.mandateApproval;});
  };
  ApprovalWorkflow.Settings.resolveApprover = function(groupId) {
    return ApprovalWorkflow.Settings.get(groupId).then(function(s) {
      if (!s.defaultApprover) return null;
      var members = getGroupMembers(groupId);
      var exists = members.some(function(m){return m.id===s.defaultApprover||m.name===s.defaultApprover;});
      if (exists) return s.defaultApprover;
      // Fallback to admin
      var admin = members.find(function(m){return m.role==='admin'||m.role==='Owner';});
      return admin ? (admin.id || admin.name) : null;
    });
  };

  // Patch Requests to use localStorage
  ApprovalWorkflow.Requests.getActiveForTask = function(taskId) {
    var all = LS.getByField('requests', 'taskId', taskId);
    var active = all.find(function(r){return r.status==='pending_approval';});
    return Promise.resolve(active || null);
  };
  ApprovalWorkflow.Requests.getAllForTask = function(taskId) {
    return Promise.resolve(LS.getByField('requests', 'taskId', taskId));
  };
  ApprovalWorkflow.Requests.getById = function(id) {
    return Promise.resolve(LS.get('requests', id));
  };
  ApprovalWorkflow.Requests.getAllPending = function() {
    return Promise.resolve(LS.getAll('requests').filter(function(r){return r.status==='pending_approval';}));
  };
  ApprovalWorkflow.Requests.submit = async function(opts) {
    var taskId=opts.taskId, requesterId=opts.requesterId, approverId=opts.approverId, note=opts.note, groupId=opts.groupId;
    var settings = await ApprovalWorkflow.Settings.get(groupId);
    if (!settings.enabled) throw new Error('Approval workflow is not enabled for this group');
    var existing = await ApprovalWorkflow.Requests.getActiveForTask(taskId);
    if (existing) throw new Error('Task already has an active approval request');
    var resolvedApprover = approverId || await ApprovalWorkflow.Settings.resolveApprover(groupId);
    if (!resolvedApprover) throw new Error('No approver selected and no default approver configured');
    if (resolvedApprover === requesterId) throw new Error('Task owners cannot approve their own tasks');
    if (note && note.length > 500) throw new Error('Note must be 500 characters or fewer');
    var req = {
      taskId:taskId, groupId:groupId, requesterId:requesterId, approverId:resolvedApprover,
      status:'pending_approval', note:note||'', createdAt:new Date().toISOString(),
      updatedAt:new Date().toISOString(), resolvedAt:null, decisionNote:null, rejectionCategory:null
    };
    LS.add('requests', req);
    await ApprovalWorkflow.AuditLog.log({taskId:taskId,requestId:req.id,actorId:requesterId,actionType:'approval_requested',notes:note||'Approval requested',metadata:{approverId:req.approverId}});
    ApprovalWorkflow.emit('approval:requested', req);
    ApprovalWorkflow.emit('approval:notification',{type:'approval_requested',recipientId:req.approverId,taskId:taskId,requestId:req.id,message:requesterId+' requested your approval'});
    return req;
  };
  ApprovalWorkflow.Requests.approve = async function(opts) {
    var requestId=opts.requestId, approverId=opts.approverId, note=opts.note;
    var req = await ApprovalWorkflow.Requests.getById(requestId);
    if (!req) throw new Error('Approval request not found');
    if (req.status !== 'pending_approval') throw new Error('Request is not pending');
    if (req.approverId !== approverId) throw new Error('Only the designated approver can take action');
    req.status='approved'; req.updatedAt=new Date().toISOString(); req.resolvedAt=new Date().toISOString(); req.decisionNote=note||'';
    LS.put('requests', req);
    await ApprovalWorkflow.AuditLog.log({taskId:req.taskId,requestId:requestId,actorId:approverId,actionType:'approved',notes:note||'Approved'});
    ApprovalWorkflow.emit('approval:approved', req);
    ApprovalWorkflow.emit('approval:notification',{type:'approved',recipientId:req.requesterId,taskId:req.taskId,requestId:requestId,message:approverId+' approved your request'});
    return req;
  };
  ApprovalWorkflow.Requests.reject = async function(opts) {
    var requestId=opts.requestId, approverId=opts.approverId, category=opts.category, reason=opts.reason;
    if (!category) throw new Error('Rejection category is required');
    if (!reason) throw new Error('Rejection reason is required');
    if (reason.length > 1000) throw new Error('Reason must be 1000 characters or fewer');
    if (!ApprovalWorkflow.REJECTION_CATEGORIES.includes(category)) throw new Error('Invalid rejection category');
    var req = await ApprovalWorkflow.Requests.getById(requestId);
    if (!req) throw new Error('Approval request not found');
    if (req.status !== 'pending_approval') throw new Error('Request is not pending');
    if (req.approverId !== approverId) throw new Error('Only the designated approver can take action');
    req.status='rejected'; req.updatedAt=new Date().toISOString(); req.resolvedAt=new Date().toISOString(); req.rejectionCategory=category; req.decisionNote=reason;
    LS.put('requests', req);
    await ApprovalWorkflow.AuditLog.log({taskId:req.taskId,requestId:requestId,actorId:approverId,actionType:'rejected',notes:'['+category+'] '+reason});
    ApprovalWorkflow.emit('approval:rejected', req);
    ApprovalWorkflow.emit('approval:notification',{type:'rejected',recipientId:req.requesterId,taskId:req.taskId,requestId:requestId,message:approverId+' rejected: '+category});
    return req;
  };
  ApprovalWorkflow.Requests.requestChanges = async function(opts) {
    var requestId=opts.requestId, approverId=opts.approverId, feedback=opts.feedback;
    if (!feedback) throw new Error('Feedback is required');
    if (feedback.length > 1000) throw new Error('Feedback must be 1000 characters or fewer');
    var req = await ApprovalWorkflow.Requests.getById(requestId);
    if (!req) throw new Error('Approval request not found');
    if (req.status !== 'pending_approval') throw new Error('Request is not pending');
    if (req.approverId !== approverId) throw new Error('Only the designated approver can take action');
    req.status='changes_requested'; req.updatedAt=new Date().toISOString(); req.resolvedAt=new Date().toISOString(); req.decisionNote=feedback;
    LS.put('requests', req);
    await ApprovalWorkflow.AuditLog.log({taskId:req.taskId,requestId:requestId,actorId:approverId,actionType:'changes_requested',notes:feedback});
    ApprovalWorkflow.emit('approval:changes_requested', req);
    ApprovalWorkflow.emit('approval:notification',{type:'changes_requested',recipientId:req.requesterId,taskId:req.taskId,requestId:requestId,message:approverId+' requested changes'});
    return req;
  };
  ApprovalWorkflow.Requests.resubmit = async function(opts) {
    var requestId=opts.requestId, requesterId=opts.requesterId, note=opts.note;
    var old = await ApprovalWorkflow.Requests.getById(requestId);
    if (!old) throw new Error('Original request not found');
    if (old.status !== 'changes_requested' && old.status !== 'rejected') throw new Error('Can only resubmit after changes were requested or rejection');
    var settings = await ApprovalWorkflow.Settings.get(old.groupId);
    if (!settings.enabled) throw new Error('Approval workflow is not enabled for this group');
    var req = {
      taskId:old.taskId, groupId:old.groupId, requesterId:requesterId, approverId:old.approverId,
      status:'pending_approval', note:note||'Resubmitted', createdAt:new Date().toISOString(),
      updatedAt:new Date().toISOString(), resolvedAt:null, decisionNote:null, rejectionCategory:null, previousRequestId:requestId
    };
    LS.add('requests', req);
    await ApprovalWorkflow.AuditLog.log({taskId:old.taskId,requestId:req.id,actorId:requesterId,actionType:'resubmitted',notes:note||'Resubmitted for approval'});
    ApprovalWorkflow.emit('approval:resubmitted', req);
    ApprovalWorkflow.emit('approval:notification',{type:'approval_requested',recipientId:req.approverId,taskId:req.taskId,requestId:req.id,message:requesterId+' resubmitted for approval'});
    return req;
  };
  ApprovalWorkflow.Requests.abort = async function(opts) {
    var requestId=opts.requestId, adminId=opts.adminId, reason=opts.reason;
    var req = await ApprovalWorkflow.Requests.getById(requestId);
    if (!req) throw new Error('Request not found');
    if (req.status !== 'pending_approval') throw new Error('Request is not pending');
    req.status='changes_requested'; req.updatedAt=new Date().toISOString(); req.resolvedAt=new Date().toISOString();
    req.decisionNote='Aborted by admin: '+(reason||'No reason provided'); req.abortedBy=adminId;
    LS.put('requests', req);
    await ApprovalWorkflow.AuditLog.log({taskId:req.taskId,requestId:requestId,actorId:adminId,actionType:'aborted',notes:'Admin abort: '+(reason||'No reason provided')});
    ApprovalWorkflow.emit('approval:aborted', req);
    ApprovalWorkflow.emit('approval:notification',{type:'changes_requested',recipientId:req.requesterId,taskId:req.taskId,requestId:requestId,message:'Approval aborted by admin '+adminId});
    ApprovalWorkflow.emit('approval:notification',{type:'changes_requested',recipientId:req.approverId,taskId:req.taskId,requestId:requestId,message:'Approval aborted by admin '+adminId});
    return req;
  };

  // Patch AuditLog to use localStorage
  ApprovalWorkflow.AuditLog.log = function(opts) {
    var entry = {taskId:opts.taskId,requestId:opts.requestId,actorId:opts.actorId,actionType:opts.actionType,notes:opts.notes||'',timestamp:new Date().toISOString(),metadata:opts.metadata||{}};
    // Also capture actor role (defensive: members may be array/object/missing)
    try {
      var _all = _allMembersSync();
      if (_all && _all.length) {
        var m = _all.find(function(x){return x && (x.id===opts.actorId||x.name===opts.actorId||x.uid===opts.actorId||x.userId===opts.actorId);});
        entry.actorRole = m ? m.role : 'unknown';
      }
    } catch(_e) { /* never block audit logging */ }
    LS.add('audit', entry);
    ApprovalWorkflow.emit('approval:audit:logged', entry);
    return Promise.resolve(entry);
  };
  ApprovalWorkflow.AuditLog.getForTask = function(taskId) {
    var logs = LS.getByField('audit', 'taskId', taskId);
    logs.sort(function(a,b){return new Date(b.timestamp)-new Date(a.timestamp);});
    return Promise.resolve(logs);
  };
  ApprovalWorkflow.AuditLog.getForRequest = function(requestId) {
    return Promise.resolve(LS.getByField('audit', 'requestId', requestId));
  };
  ApprovalWorkflow.AuditLog.getAll = function() {
    return Promise.resolve(LS.getAll('audit'));
  };

  // Patch TaskLock
  ApprovalWorkflow.TaskLock.validateTaskCompletion = async function(taskId, groupId) {
    var s = await ApprovalWorkflow.Settings.get(groupId);
    if (s.enabled && s.mandateApproval) {
      var all = await ApprovalWorkflow.Requests.getAllForTask(taskId);
      if (!all.some(function(r){return r.status==='approved';}))
        return {allowed:false, reason:'Task must be approved before it can be completed or closed.'};
    }
    return {allowed:true};
  };

  // Patch getAvailableApprovers to use window.state
  ApprovalWorkflow.getAvailableApprovers = function(groupId) {
    var members = getGroupMembers(groupId);
    if (!members || members.length === 0) {
      // Last-resort: try ShadowDB (async) so settings UI always populates.
      try {
        if (typeof ShadowDB !== 'undefined' && ShadowDB.Members && ShadowDB.Members.getAll) {
          return Promise.resolve(ShadowDB.Members.getAll()).then(function(arr){
            var out = _normalizeMembers(arr);
            return out.filter(function(m){ return m && m.name !== 'System'; });
          }).catch(function(){ return []; });
        }
      } catch(e) {}
      members = _allMembersSync();
    }
    return Promise.resolve(members.filter(function(m){ return m && m.name !== 'System'; }));
  };

  // Patch isGroupAdmin
  ApprovalWorkflow.isGroupAdmin = function(groupId, userId) {
    return Promise.resolve(isGroupAdmin(groupId, userId));
  };

  // Patch canRequestApproval to use userId
  ApprovalWorkflow.canRequestApproval = function(task, currentUserId) {
    return task.assignee === currentUserId || task.createdBy === currentUserId ||
      task.assignee === getCurrentUser() || task.createdBy === getCurrentUser() ||
      task.createdBy === getCurrentUserId();
  };

  // Patch init to not use ShadowDB._db
  ApprovalWorkflow.init = function() {
    return Promise.resolve(true);
  };

  console.log('[ApprovalPatch] Backend patched to use localStorage');
}

/* âââââââââââââââââââââââââââââââââââââââââââââââ
   PART 3 \u2014 Patch ApprovalUI
   âââââââââââââââââââââââââââââââââââââââââââââââ */
if (typeof ApprovalUI !== 'undefined') {

  // C11: CURRENT_USER from window.state (override the hardcoded 'Pradeep')
  Object.defineProperty(ApprovalUI, 'CURRENT_USER', {
    get: function() { return getCurrentUser(); },
    configurable: true
  });

  // C12: Fix approved badge text in injectHeaderBadge
  // Patch renderRequestButton to fix badge for 'approved' state
  var _origRRB = ApprovalUI.renderRequestButton;
  ApprovalUI.renderRequestButton = function(task, groupId) {
    var container = document.createElement('div');
    container.className = 'approval-request-section';
    var currentUser = getCurrentUser();
    var currentUserId = getCurrentUserId();

    ApprovalWorkflow.Settings.isEnabled(groupId).then(async function(enabled) {
      if (!enabled) return;
      var canRequest = ApprovalWorkflow.canRequestApproval(task, currentUserId) ||
        ApprovalWorkflow.canRequestApproval(task, currentUser);
      var activeRequest = await ApprovalWorkflow.Requests.getActiveForTask(task.id);
      var allRequests = await ApprovalWorkflow.Requests.getAllForTask(task.id);
      var latestRequest = allRequests.sort(function(a,b){return new Date(b.createdAt)-new Date(a.createdAt);})[0];
      var adminCheck = await ApprovalWorkflow.isGroupAdmin(groupId, currentUserId);
      var isAdmin = adminCheck || await ApprovalWorkflow.isGroupAdmin(groupId, currentUser);
      // Group admins can also request approval on behalf of the team
      canRequest = canRequest || isAdmin;

      if (activeRequest) {
        var isApprover = activeRequest.approverId === currentUser || activeRequest.approverId === currentUserId;
        container.innerHTML =
          '<div class="approval-status-strip pending">' +
          '<span class="approval-status-strip-text"><i class="fa-solid fa-clock"></i> Approval Pending \u2014 waiting for <strong>' + (function(id){try{var ms=_allMembersSync();var m=ms&&ms.find(function(x){return x && (x.id===id||x.name===id||x.uid===id||x.userId===id);});return (m && (m.name||m.id))||id;}catch(_){return id;}})(activeRequest.approverId) + '</strong></span>' +
          '</div>';
        injectBadge('pending');
        if (isApprover) container.appendChild(ApprovalUI.renderDecisionInterface(activeRequest));
        if (isAdmin && !isApprover) {
          var abortBtn = document.createElement('button');
          abortBtn.className = 'approval-btn abort-btn';
          abortBtn.innerHTML = '<i class="fa-solid fa-ban"></i> Abort Approval';
          abortBtn.addEventListener('click', function(){ showAbortModalPatch(activeRequest); });
          container.appendChild(abortBtn);
        }
      } else if (latestRequest && latestRequest.status === 'approved') {
        container.innerHTML =
          '<div class="approval-status-strip approved">' +
          '<span class="approval-status-strip-text"><i class="fa-solid fa-circle-check"></i> Approved by <strong>' + latestRequest.approverId + '</strong></span>' +
          '</div>';
        injectBadge('approved');
      } else if (latestRequest && latestRequest.status === 'rejected') {
        container.innerHTML =
          '<div class="approval-status-strip rejected" style="background:#fff5f5;border-left:4px solid #e53e3e">' +
          '<span class="approval-status-strip-text" style="color:#e53e3e"><i class="fa-solid fa-xmark-circle"></i> Rejected \u2014 ' + (latestRequest.rejectionCategory||'') + '</span>' +
          '</div>';
        injectBadge('rejected');
        if (canRequest) {
          var resubBtn = document.createElement('button');
          resubBtn.className = 'approval-btn resubmit';
          resubBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Resubmit for Approval';
          resubBtn.addEventListener('click', function(){ showResubmitModalPatch(latestRequest); });
          container.appendChild(resubBtn);
        }
      } else if (latestRequest && latestRequest.status === 'changes_requested') {
        container.innerHTML =
          '<div class="approval-status-strip changes-requested">' +
          '<span class="approval-status-strip-text"><i class="fa-solid fa-rotate-left"></i> Changes Requested</span>' +
          '</div>';
        injectBadge('changes');
        if (canRequest) {
          var resubBtn2 = document.createElement('button');
          resubBtn2.className = 'approval-btn resubmit';
          resubBtn2.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Resubmit for Approval';
          resubBtn2.addEventListener('click', function(){ showResubmitModalPatch(latestRequest); });
          container.appendChild(resubBtn2);
        }
      } else if (canRequest) {
        injectRequestBtn(task, groupId);
      }
    });
    return container;
  };

  function injectBadge(type) {
    var headerRight = document.querySelector('.tdp-header-actions');
    if (!headerRight) return;
    var old = headerRight.querySelector('.approval-header-badge,.request-approval-header-btn');
    if (old) old.remove();
    var badge = document.createElement('span');
    badge.className = 'approval-header-badge ' + type;
    var text = {
      pending: '<i class="fa-solid fa-clock"></i> Approval Requested',
      approved: '<i class="fa-solid fa-circle-check"></i> Approved',
      changes: '<i class="fa-solid fa-pen"></i> Changes Requested',
      rejected: '<i class="fa-solid fa-xmark"></i> Rejected'
    }[type] || 'Approval';
    badge.innerHTML = text;
    headerRight.insertBefore(badge, headerRight.firstChild);
  }

  function injectRequestBtn(task, groupId) {
    var headerRight = document.querySelector('.tdp-header-actions');
    if (!headerRight) return;
    var old = headerRight.querySelector('.approval-header-badge,.request-approval-header-btn');
    if (old) old.remove();
    var btn = document.createElement('button');
    btn.className = 'request-approval-header-btn';
    btn.textContent = 'Request Approval';
    btn.addEventListener('click', function(){
      showRequestModalPatch(task, groupId);
    });
    headerRight.insertBefore(btn, headerRight.firstChild);
  }

  // Local modal helpers (use ApprovalUI modals but with current user)
  function showRequestModalPatch(task, groupId) {
    var overlay = createModalPatch('request-approval-modal');
    var modal = overlay.querySelector('.modal-content');
    var currentUser = getCurrentUser();
    modal.innerHTML =
      '<div class="modal-header"><h3>Request Approval</h3><button class="modal-close">&times;</button></div>' +
      '<div class="modal-body">' +
        '<div class="form-group"><label class="form-label">Send to</label><select id="pModalApprover" class="form-select approver-field"></select></div>' +
        '<div class="form-group"><label class="form-label">Note (Optional)</label><textarea id="pModalNote" class="form-textarea" maxlength="500" rows="4" placeholder="Add context for the approver..."></textarea><div class="char-counter"><span id="pNoteCount">0</span>/500</div></div>' +
        '<div class="lock-info-banner"><i class="fa-solid fa-lock"></i><span>Task fields will be locked while the approval is pending.</span></div>' +
      '</div>' +
      '<div class="modal-footer"><button class="btn-cancel">Cancel</button><button class="btn-submit">Submit Request</button></div>';
    ApprovalWorkflow.getAvailableApprovers(groupId).then(function(members) {
      ApprovalWorkflow.Settings.get(groupId).then(function(settings) {
        var sel = modal.querySelector('#pModalApprover');
        members.filter(function(m){return m.name!==currentUser && m.id!==getCurrentUserId();}).forEach(function(m) {
          var opt = document.createElement('option');
          opt.value = m.id || m.name;
          var isDefault = settings.defaultApprover === m.id || settings.defaultApprover === m.name;
          opt.textContent = m.name + (m.role?' ('+m.role+')':'') + (isDefault?' (Default)':'');
          if (isDefault) opt.selected = true;
          sel.appendChild(opt);
        });
      });
    });
    modal.querySelector('#pModalNote').addEventListener('input', function(){modal.querySelector('#pNoteCount').textContent=this.value.length;});
    modal.querySelector('.btn-submit').addEventListener('click', async function() {
      var approverId = modal.querySelector('#pModalApprover').value;
      var note = modal.querySelector('#pModalNote').value;
      if (!approverId) { ApprovalUI.showToast('Please select an approver','error'); return; }
      try {
        await ApprovalWorkflow.Requests.submit({taskId:task.id,requesterId:getCurrentUserId()||currentUser,approverId:approverId,note:note,groupId:groupId});
        closeModalPatch(overlay);
        ApprovalUI.showToast('Approval request submitted!','success');
        refreshApprovalUI(task.id);
      } catch(e) { ApprovalUI.showToast(e.message,'error'); }
    });
    modal.querySelector('.btn-cancel').addEventListener('click', function(){closeModalPatch(overlay);});
    modal.querySelector('.modal-close').addEventListener('click', function(){closeModalPatch(overlay);});
  }

  function showAbortModalPatch(request) {
    var overlay = createModalPatch('abort-modal');
    var modal = overlay.querySelector('.modal-content');
    modal.innerHTML =
      '<div class="modal-header abort-header"><h3><i class="fa-solid fa-ban"></i> Abort Approval</h3><button class="modal-close">&times;</button></div>' +
      '<div class="modal-body"><p class="abort-warning-text">This will cancel the pending approval request. This action is reserved for Group Admins in exceptional cases.</p>' +
        '<div class="form-group"><label class="form-label">Reason (Optional)</label><textarea id="pAbortReason" class="form-textarea" rows="3" placeholder="Reason for aborting..."></textarea></div>' +
      '</div>' +
      '<div class="modal-footer"><button class="btn-cancel">Cancel</button><button class="btn-abort"><i class="fa-solid fa-ban"></i> Abort Approval</button></div>';
    modal.querySelector('.btn-abort').addEventListener('click', async function() {
      var reason = modal.querySelector('#pAbortReason').value;
      try {
        await ApprovalWorkflow.Requests.abort({requestId:request.id,adminId:getCurrentUserId()||getCurrentUser(),reason:reason});
        closeModalPatch(overlay);
        ApprovalUI.showToast('Approval aborted','warning');
        refreshApprovalUI(request.taskId);
      } catch(e) { ApprovalUI.showToast(e.message,'error'); }
    });
    modal.querySelector('.btn-cancel').addEventListener('click', function(){closeModalPatch(overlay);});
    modal.querySelector('.modal-close').addEventListener('click', function(){closeModalPatch(overlay);});
  }

  function showResubmitModalPatch(request) {
    var overlay = createModalPatch('resubmit-modal');
    var modal = overlay.querySelector('.modal-content');
    modal.innerHTML =
      '<div class="modal-header"><h3><i class="fa-solid fa-paper-plane"></i> Resubmit for Approval</h3><button class="modal-close">&times;</button></div>' +
      '<div class="modal-body"><div class="form-group"><label class="form-label">Note about changes made</label><textarea id="pResubNote" class="form-textarea" rows="3" placeholder="Describe the changes you made..."></textarea></div></div>' +
      '<div class="modal-footer"><button class="btn-cancel">Cancel</button><button class="btn-submit"><i class="fa-solid fa-paper-plane"></i> Resubmit</button></div>';
    modal.querySelector('.btn-submit').addEventListener('click', async function() {
      var note = modal.querySelector('#pResubNote').value;
      try {
        await ApprovalWorkflow.Requests.resubmit({requestId:request.id,requesterId:getCurrentUserId()||getCurrentUser(),note:note});
        closeModalPatch(overlay);
        ApprovalUI.showToast('Resubmitted for approval!','success');
        refreshApprovalUI(request.taskId);
      } catch(e) { ApprovalUI.showToast(e.message,'error'); }
    });
    modal.querySelector('.btn-cancel').addEventListener('click', function(){closeModalPatch(overlay);});
    modal.querySelector('.modal-close').addEventListener('click', function(){closeModalPatch(overlay);});
  }

  function createModalPatch(id) {
    var old = document.getElementById(id); if(old) old.remove();
    var overlay = document.createElement('div');
    overlay.className = 'approval-modal-overlay';
    overlay.id = id;
    overlay.innerHTML = '<div class="modal-content"></div>';
    overlay.addEventListener('click', function(e){if(e.target===overlay)closeModalPatch(overlay);});
    document.body.appendChild(overlay);
    return overlay;
  }

  function closeModalPatch(overlay) {
    overlay.classList.add('closing');
    setTimeout(function(){overlay.remove();},200);
  }

  // Override ApprovalUI decision interface to use current user
  var _origRDI = ApprovalUI.renderDecisionInterface;
  ApprovalUI.renderDecisionInterface = function(request) {
    var container = document.createElement('div');
    container.className = 'approval-decision-panel';
    container.innerHTML =
      '<h4><i class="fa-solid fa-gavel"></i> Your Decision Required</h4>' +
      (request.note ? '<div class="decision-note"><strong>Context:</strong> ' + request.note + '</div>' : '') +
      '<div class="decision-actions">' +
        '<button class="decision-btn approve" data-action="approve"><i class="fa-solid fa-check"></i> Approve</button>' +
        '<button class="decision-btn reject" data-action="reject"><i class="fa-solid fa-xmark"></i> Reject</button>' +
        '<button class="decision-btn changes" data-action="changes"><i class="fa-solid fa-pen"></i> Request Changes</button>' +
      '</div>';

    container.querySelector('[data-action="approve"]').addEventListener('click', function() {
      var overlay = createModalPatch('approve-modal');
      var modal = overlay.querySelector('.modal-content');
      modal.innerHTML =
        '<div class="modal-header approve-header"><h3><i class="fa-solid fa-check-circle"></i> Approve Task</h3><button class="modal-close">&times;</button></div>' +
        '<div class="modal-body"><div class="form-group"><label class="form-label">Approval Note (Optional)</label><textarea id="pApproveNote" class="form-textarea" rows="3" placeholder="Add a note..."></textarea></div></div>' +
        '<div class="modal-footer"><button class="btn-cancel">Cancel</button><button class="btn-approve-submit"><i class="fa-solid fa-check"></i> Approve</button></div>';
      modal.querySelector('.btn-approve-submit').addEventListener('click', async function() {
        var note = modal.querySelector('#pApproveNote').value;
        try {
          await ApprovalWorkflow.Requests.approve({requestId:request.id,approverId:getCurrentUserId()||getCurrentUser(),note:note});
          closeModalPatch(overlay); ApprovalUI.showToast('Task approved!','success'); refreshApprovalUI(request.taskId);
        } catch(e) { ApprovalUI.showToast(e.message,'error'); }
      });
      modal.querySelector('.btn-cancel').addEventListener('click', function(){closeModalPatch(overlay);});
      modal.querySelector('.modal-close').addEventListener('click', function(){closeModalPatch(overlay);});
    });

    container.querySelector('[data-action="reject"]').addEventListener('click', function() {
      var overlay = createModalPatch('reject-approval-modal');
      var modal = overlay.querySelector('.modal-content');
      modal.innerHTML =
        '<div class="modal-header reject-header"><h3><i class="fa-solid fa-xmark"></i> Reject Request</h3><button class="modal-close">&times;</button></div>' +
        '<div class="modal-body">' +
          '<div class="form-group"><label class="form-label">Rejection Category <span class="required">*</span></label>' +
          '<select id="pRejectCat" class="form-select"><option value="">Select a category...</option>' +
          ApprovalWorkflow.REJECTION_CATEGORIES.map(function(c){return '<option value="'+c+'">'+c+'</option>';}).join('') + '</select></div>' +
          '<div class="form-group"><label class="form-label">Explanation <span class="required">*</span> (<span id="pRejectCount">0</span>/1000)</label>' +
          '<textarea id="pRejectReason" class="form-textarea" rows="4" maxlength="1000" placeholder="Provide a reason for rejection..."></textarea></div>' +
        '</div>' +
        '<div class="modal-footer"><button class="btn-cancel">Cancel</button><button class="btn-reject"><i class="fa-solid fa-xmark"></i> Reject</button></div>';
      modal.querySelector('#pRejectReason').addEventListener('input', function(){modal.querySelector('#pRejectCount').textContent=this.value.length;});
      modal.querySelector('.btn-reject').addEventListener('click', async function() {
        var category = modal.querySelector('#pRejectCat').value;
        var reason = modal.querySelector('#pRejectReason').value;
        if (!category) { ApprovalUI.showToast('Please select a category','error'); return; }
        if (!reason) { ApprovalUI.showToast('Please provide a reason','error'); return; }
        try {
          await ApprovalWorkflow.Requests.reject({requestId:request.id,approverId:getCurrentUserId()||getCurrentUser(),category:category,reason:reason});
          closeModalPatch(overlay); ApprovalUI.showToast('Request rejected','warning'); refreshApprovalUI(request.taskId);
        } catch(e) { ApprovalUI.showToast(e.message,'error'); }
      });
      modal.querySelector('.btn-cancel').addEventListener('click', function(){closeModalPatch(overlay);});
      modal.querySelector('.modal-close').addEventListener('click', function(){closeModalPatch(overlay);});
    });

    container.querySelector('[data-action="changes"]').addEventListener('click', function() {
      var overlay = createModalPatch('changes-approval-modal');
      var modal = overlay.querySelector('.modal-content');
      modal.innerHTML =
        '<div class="modal-header changes-header"><h3><i class="fa-solid fa-pen"></i> Request Changes</h3><button class="modal-close">&times;</button></div>' +
        '<div class="modal-body"><div class="form-group"><label class="form-label">Feedback Note <span class="required">*</span></label><textarea id="pChangesFeedback" class="form-textarea" rows="4" maxlength="1000" placeholder="Describe what changes are needed..."></textarea></div></div>' +
        '<div class="modal-footer"><button class="btn-cancel">Cancel</button><button class="btn-changes"><i class="fa-solid fa-pen"></i> Request Changes</button></div>';
      modal.querySelector('.btn-changes').addEventListener('click', async function() {
        var feedback = modal.querySelector('#pChangesFeedback').value;
        if (!feedback) { ApprovalUI.showToast('Feedback is required','error'); return; }
        try {
          await ApprovalWorkflow.Requests.requestChanges({requestId:request.id,approverId:getCurrentUserId()||getCurrentUser(),feedback:feedback});
          closeModalPatch(overlay); ApprovalUI.showToast('Changes requested','info'); refreshApprovalUI(request.taskId);
        } catch(e) { ApprovalUI.showToast(e.message,'error'); }
      });
      modal.querySelector('.btn-cancel').addEventListener('click', function(){closeModalPatch(overlay);});
      modal.querySelector('.modal-close').addEventListener('click', function(){closeModalPatch(overlay);});
    });

    return container;
  };

  function refreshApprovalUI(taskId) {
    ApprovalWorkflow.emit('approval:ui:refresh', {taskId: taskId});
  }

  console.log('[ApprovalPatch] ApprovalUI patched');
}

/* âââââââââââââââââââââââââââââââââââââââââââââââ
   PART 4 \u2014 Poll-based task detail approval injector (C2+C3)
   Uses setInterval to reliably detect task panel open state
   âââââââââââââââââââââââââââââââââââââââââââââââ */
function setupTaskDetailObserver() {
  if (window._approvalObserverPatched) return;
  window._approvalObserverPatched = true;
  var lastInjectedTaskId = null;
  setInterval(async function() {
    try {
      var panel = document.getElementById('taskDetailPanel');
      if (!panel) return;
      var isOpen = panel.classList.contains('open') || panel.style.display === 'flex';
      if (!isOpen) { lastInjectedTaskId = null; return; }
      var s = window.state;
      if (!s) return;
      var taskId = s.selectedTaskId;
      if (!taskId || taskId === lastInjectedTaskId) return;
      lastInjectedTaskId = taskId;
      var task = s.tasks && s.tasks.find(function(t){return t.id===taskId;});
      if (!task || !task.group) return;
      var settings = await ApprovalWorkflow.Settings.get(task.group);
      if (!settings.enabled) return;
      // Clean up old approval UI
      panel.querySelectorAll('.approval-request-section,.approval-audit-trail,.task-lock-banner,.approval-status-strip').forEach(function(el){el.remove();});
      document.querySelectorAll('.approval-header-badge,.request-approval-header-btn').forEach(function(el){el.remove();});
      // Insert approval section at top of .tdp-body
      var reqSec = ApprovalUI.renderRequestButton(task, task.group);
      var tdpBody = panel.querySelector('.tdp-body');
      if (tdpBody) tdpBody.insertBefore(reqSec, tdpBody.firstChild);
      else panel.insertBefore(reqSec, panel.children[1] || panel.firstChild);
      // Insert audit trail after a short delay
      setTimeout(async function() {
        try {
          var tl = panel.querySelector('#timelineList');
          if (tl && tl.parentNode) {
            var ex = panel.querySelector('.approval-audit-trail'); if(ex) ex.remove();
            tl.parentNode.insertBefore(ApprovalUI.renderAuditTrail(taskId), tl);
          }
          ApprovalUI.applyFieldLocks(panel, taskId);
        } catch(e2) {}
      }, 400);
    } catch(e) { /* silent */ }
  }, 600);
  console.log('[ApprovalPatch] Task detail approval poller installed (600ms)');
}

/* âââââââââââââââââââââââââââââââââââââââââââââââ
   PART 5 \u2014 Hook into status change (C5: Mandate)
   âââââââââââââââââââââââââââââââââââââââââââââââ */
function hookStatusChange() {
  var detailStatus = document.getElementById('detailStatus');
  if (!detailStatus || detailStatus._approvalPatched) return;
  detailStatus.addEventListener('change', async function(e) {
    var s = window.state;
    if (!s || !s.selectedTaskId) return;
    var task = s.tasks && s.tasks.find(function(t){return t.id===s.selectedTaskId;});
    if (!task) return;
    var newStatus = this.value;
    if (newStatus === 'Completed' || newStatus === 'Closed' || newStatus === 'Done') {
      var groupId = task.group;
      if (groupId) {
        var result = await ApprovalWorkflow.TaskLock.validateTaskCompletion(task.id, groupId);
        if (!result.allowed) {
          e.preventDefault();
          e.stopImmediatePropagation();
          this.value = task.status; // revert
          ApprovalUI.showToast(result.reason, 'error');
          return;
        }
      }
    }
    // Also check field lock
    if (task) {
      var lockResult = await ApprovalWorkflow.TaskLock.validateFieldUpdate(task.id, 'status', getCurrentUserId());
      if (!lockResult.allowed) {
        e.preventDefault();
        e.stopImmediatePropagation();
        this.value = task.status;
        ApprovalUI.showToast(lockResult.reason, 'error');
        return;
      }
    }
  }, true); // capture phase to run before app.js handler
  detailStatus._approvalPatched = true;
  console.log('[ApprovalPatch] status change hooked');
}

/* âââââââââââââââââââââââââââââââââââââââââââââââ
   PART 6 \u2014 Fix settings panel auto-render (C7+C8)
   âââââââââââââââââââââââââââââââââââââââââââââââ */
function patchSettingsPanel() {
  document.querySelectorAll('.task-settings-nav-item').forEach(function(item) {
    if (item.dataset.tsection !== 'approvals' || item._approvalPatched) return;
    item._approvalPatched = true;
    item.addEventListener('click', async function() {
      var mount = document.getElementById('approvalSettingsMount');
      if (!mount) return;
      var s = window.state;
      var currentGroupId = s && s.filterGroup;
      if (!currentGroupId && s && s.groups && s.groups[0]) currentGroupId = s.groups[0].id;
      if (!currentGroupId || !mount) return;
      // Avoid duplicate render across concurrent click handlers (settings.js + this patch).
      // Use a synchronous lock on the mount so the second handler exits before doing async work.
      if (mount.dataset && mount.dataset.approvalRendering === '1') return;
      if (mount.querySelector && mount.querySelector('.approval-settings-card')) {
        try { patchSettingsToggle(mount, currentGroupId); } catch(_e) {}
        return;
      }
      if (mount.dataset) mount.dataset.approvalRendering = '1';
      mount.innerHTML = '';
      try {
        await ApprovalWorkflow.init();
        var panel = await ApprovalUI.renderSettingsPanel(currentGroupId);
        // Re-check after await in case another handler raced and already rendered
        if (mount.querySelector('.approval-settings-card')) {
          try { patchSettingsToggle(mount, currentGroupId); } catch(_e) {}
        } else {
          mount.appendChild(panel);
          patchSettingsToggle(mount, currentGroupId);
        }
      } catch(e) {
        mount.innerHTML = '<div style="padding:16px;color:red">Error loading approval settings: ' + e.message + '</div>';
      } finally {
        if (mount.dataset) delete mount.dataset.approvalRendering;
      }
    });
  });
}

function patchSettingsToggle(mount, groupId) {
  // C8: Re-attach toggle event that correctly shows/hides sub-sections
  var toggle = mount.querySelector('#approvalEnabled');
  if (!toggle) return;
  // Re-attach to ensure it shows mandate/approver blocks
  var orig = toggle.onchange;
  toggle.addEventListener('change', function() {
    var mandateBlock = mount.querySelector('#mandateBlock');
    var mandateDivider = mount.querySelector('#mandateDivider');
    var approverBlock = mount.querySelector('#approverBlock');
    if (this.checked) {
      if (mandateBlock) mandateBlock.style.display = '';
      if (mandateDivider) mandateDivider.style.display = '';
      if (approverBlock) approverBlock.style.display = '';
    } else {
      if (mandateBlock) mandateBlock.style.display = 'none';
      if (mandateDivider) mandateDivider.style.display = 'none';
      if (approverBlock) approverBlock.style.display = 'none';
    }
  });
  // Also patch the approver dropdown to populate correctly (C9)
  var approverSelect = mount.querySelector('#defaultApprover');
  if (approverSelect && approverSelect.options.length <= 1) {
    ApprovalWorkflow.getAvailableApprovers(groupId).then(function(members) {
      ApprovalWorkflow.Settings.get(groupId).then(function(settings) {
        members.forEach(function(m) {
          var opt = document.createElement('option');
          opt.value = m.id || m.name;
          opt.textContent = m.name + (m.role?' ('+m.role+')':'');
          if (settings.defaultApprover === m.id || settings.defaultApprover === m.name) opt.selected = true;
          approverSelect.appendChild(opt);
        });
      });
    });
  }
}

/* âââââââââââââââââââââââââââââââââââââââââââââââ
   PART 7 \u2014 approval:ui:refresh event handler (C2)
   âââââââââââââââââââââââââââââââââââââââââââââââ */
function setupRefreshListener() {
  if (window._approvalRefreshPatched) return;
  window._approvalRefreshPatched = true;
  ApprovalWorkflow.on('approval:ui:refresh', async function(data) {
    var taskId = data.taskId;
    var panel = document.getElementById('taskDetailPanel');
    if (!panel || !panel.classList.contains('open')) return;
    var s = window.state;
    var task = s && s.tasks && s.tasks.find(function(t){return t.id===taskId;});
    if (!task) return;
    var groupId = task.group;
    if (!groupId) return;

    panel.querySelectorAll('.approval-request-section,.approval-audit-trail,.approval-decision-panel,.task-lock-banner,.approval-status-strip').forEach(function(el){el.remove();});
    var oldBtn = panel.querySelector('.request-approval-header-btn');
    if (oldBtn) oldBtn.remove();
    var oldBadge = panel.querySelector('.approval-header-badge');
    if (oldBadge) oldBadge.remove();
    // Also remove from header right (badges/btns outside panel)
    var hdrBadge = document.querySelector('.approval-header-badge');
    if (hdrBadge) hdrBadge.remove();
    var hdrBtn = document.querySelector('.request-approval-header-btn');
    if (hdrBtn) hdrBtn.remove();

    var settings = await ApprovalWorkflow.Settings.get(groupId);
    if (!settings.enabled) return;

    var reqSection = ApprovalUI.renderRequestButton(task, groupId);
    var detailBody = panel.querySelector('.tdp-body');
    if (detailBody) detailBody.insertBefore(reqSection, detailBody.firstChild);

    setTimeout(async function() {
      var timelineSection = panel.querySelector('#timelineList');
      if (timelineSection && timelineSection.parentNode) {
        var existing = panel.querySelector('.approval-audit-trail');
        if (existing) existing.remove();
        var auditTrail = ApprovalUI.renderAuditTrail(taskId);
        timelineSection.parentNode.insertBefore(auditTrail, timelineSection);
      }
      ApprovalUI.applyFieldLocks(panel, taskId);
    }, 300);
  });
}

/* âââââââââââââââââââââââââââââââââââââââââââââââ
   PART 8 \u2014 Bridge Approval Notifications â Unified Bell
   Removes duplicate left bell; routes ApprovalWorkflow events to notification-bell.js
âââââââââââââââââââââââââââââââââââââââââââââââ */
function bridgeApprovalNotifications() {
  if (window._approvalBellBridged) return;
  window._approvalBellBridged = true;

  // Remove any stray .approval-notifications bells already in DOM
  function removeOldBell() {
    document.querySelectorAll('.approval-notifications').forEach(function(el) { el.remove(); });
  }
  removeOldBell();

  // Wait for ApprovalWorkflow and pushBellNotification to be ready
  var tries = 0;
  var iv = setInterval(function() {
    if (typeof ApprovalWorkflow !== 'undefined' && typeof window.pushBellNotification === 'function') {
      clearInterval(iv);

      // Remove any bell that may have been injected before bridge ran
      removeOldBell();

      // Bridge: ApprovalWorkflow approval:notification -> pushBellNotification (unified bell)
      ApprovalWorkflow.on('approval:notification', function(data) {
        var currentUser = getCurrentUser();
        var currentUserId = getCurrentUserId();
        // Only show to the intended recipient
        if (data.recipientId &&
            data.recipientId !== currentUser &&
            data.recipientId !== currentUserId) return;
        window.pushBellNotification(
          data.type || 'approval_requested',
          data.taskId || '',
          '',
          data.message || 'Approval notification'
        );
      });

      console.log('[ApprovalPatch] Approval notifications bridged to unified bell');
    } else if (++tries > 80) {
      clearInterval(iv);
      console.warn('[ApprovalPatch] Bridge timed out');
    }
  }, 150);

  // Guard: silently remove any future .approval-notifications injections
  var _bellObs = new MutationObserver(function(mutations) {
    mutations.forEach(function(m) {
      m.addedNodes.forEach(function(node) {
        if (node.nodeType === 1 && node.classList && node.classList.contains('approval-notifications')) {
          node.remove();
        }
      });
    });
  });
  _bellObs.observe(document.body || document.documentElement, { childList: true, subtree: true });
}

/* âââââââââââââââââââââââââââââââââââââââââââââââ
   MAIN BOOT
   âââââââââââââââââââââââââââââââââââââââââââââââ */
function boot() {
  /* Wait for ShadowDB Supabase client AND ApprovalWorkflow/UI before preloading & wiring. */
  var sbReady = !!(window.ShadowDB && window.ShadowDB._sb);
  if (!sbReady || typeof ApprovalWorkflow === 'undefined' || typeof ApprovalUI === 'undefined') {
    setTimeout(boot, 300);
    return;
  }
  /* === Preload Supabase data into SB cache (only now that _sb is ready) === */
  if (!window._approvalSbPreloaded) {
    window._approvalSbPreloaded = true;
    SB.preload('settings', function() {});
    SB.preload('requests', function() {});
    SB.preload('audit', function() {});
  }
  try {
    setupTaskDetailObserver();
    hookStatusChange();
    setupRefreshListener();
    bridgeApprovalNotifications();
    patchSettingsPanel();
    console.log('[ApprovalPatch] All hooks installed');
  } catch(e) {
    console.warn('[ApprovalPatch] Boot error:', e.message);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  setTimeout(boot, 600);
}

// Re-run settings patch on any master settings open (settings may re-render)
setInterval(function() {
  patchSettingsPanel();
}, 2000);

})();
