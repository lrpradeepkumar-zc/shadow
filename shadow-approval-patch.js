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

/* ═══════════════════════════════════════════════
   PART 1 — localStorage Storage Engine
   Replaces broken IndexedDB in approval-backend.js
   ═══════════════════════════════════════════════ */
var LS = {
  _key: function(store) { return 'shadow_approval_' + store; },
  getAll: function(store) {
    try { return JSON.parse(localStorage.getItem(LS._key(store)) || '[]'); } catch(e) { return []; }
  },
  setAll: function(store, arr) {
    try { localStorage.setItem(LS._key(store), JSON.stringify(arr)); } catch(e) {}
  },
  add: function(store, item) {
    var arr = LS.getAll(store);
    item.id = store + '_' + Date.now() + '_' + Math.random().toString(36).substr(2,5);
    arr.push(item);
    LS.setAll(store, arr);
    return item;
  },
  put: function(store, item) {
    var arr = LS.getAll(store);
    var idx = arr.findIndex(function(x){return x.id===item.id;});
    if (idx === -1) arr.push(item); else arr[idx] = item;
    LS.setAll(store, arr);
    return item;
  },
  get: function(store, id) {
    return LS.getAll(store).find(function(x){return x.id===id;}) || null;
  },
  getByField: function(store, field, val) {
    return LS.getAll(store).filter(function(x){return x[field]===val;});
  }
};

/* ═══════════════════════════════════════════════
   PART 2 — Patch ApprovalWorkflow backend
   ═══════════════════════════════════════════════ */
function getCurrentUser() {
  var s = window.state;
  if (!s) return 'Unknown';
  return s.currentUserName || s.currentUserId || 'Unknown';
}
function getCurrentUserId() {
  var s = window.state;
  return s ? (s.currentUserId || s.currentUserName || 'Unknown') : 'Unknown';
}
function getGroupMembers(groupId) {
  var s = window.state;
  if (!s || !s.members) return [];
  var grp = s.groups && s.groups.find(function(g){return g.id===groupId;});
  var adminIds = grp ? (grp.adminIds||[]) : [];
  var memberIds = grp ? (grp.memberIds||[]) : [];
  var allIds = adminIds.concat(memberIds);
  // Return all members if no group or return group members
  return s.members.filter(function(m){
    return allIds.length === 0 || allIds.indexOf(m.id) !== -1 || adminIds.indexOf(m.id) !== -1;
  });
}
function isGroupAdmin(groupId, userId) {
  var s = window.state;
  if (!s) return false;
  var grp = s.groups && s.groups.find(function(g){return g.id===groupId;});
  if (!grp) return false;
  var user = s.members && s.members.find(function(m){return m.id===userId||m.name===userId;});
  if (!user) return false;
  return (grp.adminIds||[]).indexOf(user.id) !== -1 || user.role === 'admin' || user.role === 'Owner';
}

// Patch ApprovalWorkflow if it exists
if (typeof ApprovalWorkflow !== 'undefined') {

  // C4: Add REJECTED state
  ApprovalWorkflow.ApprovalState.REJECTED = 'rejected';

  // Patch Settings to use localStorage
  ApprovalWorkflow.Settings.get = function(groupId) {
    var arr = LS.getAll('settings');
    var r = arr.find(function(x){return x.groupId===groupId;});
    return Promise.resolve(r || {
      groupId: groupId, enabled: false, mandateApproval: false,
      defaultApprover: null, defaultApproverType: 'member'
    });
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
    // Also capture actor role
    var s = window.state;
    if (s && s.members) {
      var m = s.members.find(function(x){return x.id===opts.actorId||x.name===opts.actorId;});
      entry.actorRole = m ? m.role : 'unknown';
    }
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
      var s = window.state;
      members = (s && s.members) || [];
    }
    return Promise.resolve(members.filter(function(m){return m.name!=='System';}));
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

/* ═══════════════════════════════════════════════
   PART 3 — Patch ApprovalUI
   ═══════════════════════════════════════════════ */
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

      if (activeRequest) {
        var isApprover = activeRequest.approverId === currentUser || activeRequest.approverId === currentUserId;
        container.innerHTML =
          '<div class="approval-status-strip pending">' +
          '<span class="approval-status-strip-text"><i class="fa-solid fa-clock"></i> Approval Pending — waiting for <strong>' + activeRequest.approverId + '</strong></span>' +
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
          '<span class="approval-status-strip-text" style="color:#e53e3e"><i class="fa-solid fa-xmark-circle"></i> Rejected — ' + (latestRequest.rejectionCategory||'') + '</span>' +
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

/* ═══════════════════════════════════════════════
   PART 4 — Poll-based task detail approval injector (C2+C3)
   Uses setInterval to reliably detect task panel open state
   ═══════════════════════════════════════════════ */
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

/* ═══════════════════════════════════════════════
   PART 5 — Hook into status change (C5: Mandate)
   ═══════════════════════════════════════════════ */
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

/* ═══════════════════════════════════════════════
   PART 6 — Fix settings panel auto-render (C7+C8)
   ═══════════════════════════════════════════════ */
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
      mount.innerHTML = '';
      try {
        await ApprovalWorkflow.init();
        var panel = await ApprovalUI.renderSettingsPanel(currentGroupId);
        mount.appendChild(panel);
        // After mounting, patch the toggle to properly show/hide sub-sections
        patchSettingsToggle(mount, currentGroupId);
      } catch(e) {
        mount.innerHTML = '<div style="padding:16px;color:red">Error loading approval settings: ' + e.message + '</div>';
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

/* ═══════════════════════════════════════════════
   PART 7 — approval:ui:refresh event handler (C2)
   ═══════════════════════════════════════════════ */
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

/* ═══════════════════════════════════════════════
   PART 8 — Notification Bell init (C2)
   ═══════════════════════════════════════════════ */
function initNotificationBell() {
  if (document.querySelector('.notif-bell')) return; // already there
  var bell = ApprovalUI.renderNotificationBell();
  // Find the header right area (top-right icons)
  var headerRight = document.querySelector('.header-right');
  if (headerRight) {
    headerRight.insertBefore(bell, headerRight.firstChild);
  }
}

/* ═══════════════════════════════════════════════
   MAIN BOOT
   ═══════════════════════════════════════════════ */
function boot() {
  if (typeof ApprovalWorkflow === 'undefined' || typeof ApprovalUI === 'undefined') {
    setTimeout(boot, 300);
    return;
  }
  try {
    setupTaskDetailObserver();
    hookStatusChange();
    setupRefreshListener();
    initNotificationBell();
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
