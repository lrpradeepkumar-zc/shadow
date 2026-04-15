/**
 * Shadow ToDo - Approval Workflow Backend (PRD-Compliant)
 * Full state machine, in-flight preservation, field locking,
 * mandate approval, deleted approver fallback, audit logging.
 * Reuses ShadowDB connection to avoid IndexedDB version conflicts.
 */
const ApprovalWorkflow = (function() {
  'use strict';

  const STORES = {
    approvalRequests: 'approvalRequests',
    approvalAuditLogs: 'approvalAuditLogs',
    approvalSettings: 'approvalSettings'
  };

  /* ── State Machine ── */
  const ApprovalState = {
    PENDING_APPROVAL: 'pending_approval',
    APPROVED: 'approved',
    CHANGES_REQUESTED: 'changes_requested'
  };

  const VALID_TRANSITIONS = {
    [ApprovalState.PENDING_APPROVAL]: [ApprovalState.APPROVED, ApprovalState.CHANGES_REQUESTED],
    [ApprovalState.CHANGES_REQUESTED]: [ApprovalState.PENDING_APPROVAL],
    [ApprovalState.APPROVED]: []
  };

  const REJECTION_CATEGORIES = [
    'Incomplete Work',
    'Quality Issues',
    'Missing Requirements',
    'Incorrect Implementation',
    'Needs More Testing',
    'Other'
  ];

  const LOCKED_FIELDS  = ['title','dueDate','assignee','attachments','startDate','priority','status'];
  const EDITABLE_FIELDS = ['comments','subtasks'];

  const eventListeners = {};

  /* ── DB helpers (reuse ShadowDB connection) ── */
  async function getDB() {
    if (ShadowDB._db) return ShadowDB._db;
    await ShadowDB.init();
    return ShadowDB._db;
  }

  async function dbOp(storeName, mode, operation) {
    const database = await getDB();
    return new Promise((resolve, reject) => {
      const tx = database.transaction(storeName, mode);
      const store = tx.objectStore(storeName);
      const result = operation(store);
      if (result && result.onsuccess !== undefined) {
        result.onsuccess = () => resolve(result.result);
        result.onerror  = () => reject(result.error);
      } else {
        tx.oncomplete = () => resolve(result);
        tx.onerror    = () => reject(tx.error);
      }
    });
  }

  /* ── Event Bus ── */
  function emit(event, data) {
    if (eventListeners[event]) eventListeners[event].forEach(fn => fn(data));
  }
  function on(event, callback) {
    if (!eventListeners[event]) eventListeners[event] = [];
    eventListeners[event].push(callback);
  }
  function off(event, callback) {
    if (eventListeners[event])
      eventListeners[event] = eventListeners[event].filter(fn => fn !== callback);
  }

  /* ══════════════════════════════════════════
     1.  GROUP ADMINISTRATION & CONFIGURATION
     ══════════════════════════════════════════ */
  const Settings = {
    async get(groupId) {
      try {
        const r = await dbOp(STORES.approvalSettings, 'readonly', s => s.get(groupId));
        return r || {
          groupId,
          enabled: false,
          mandateApproval: false,
          defaultApprover: null,
          defaultApproverType: 'member'
        };
      } catch (e) {
        return {
          groupId,
          enabled: false,
          mandateApproval: false,
          defaultApprover: null,
          defaultApproverType: 'member'
        };
      }
    },

    async save(settings) {
      /* In-Flight Preservation: toggling OFF does NOT cancel pending requests */
      await dbOp(STORES.approvalSettings, 'readwrite', s => s.put(settings));
      emit('approval:settings:changed', settings);
      await AuditLog.log({
        taskId: null,
        requestId: null,
        actorId: 'System',
        actionType: 'settings_updated',
        notes: 'Settings updated for group ' + settings.groupId,
        metadata: { settings }
      });
      return settings;
    },

    async isEnabled(groupId) {
      const s = await this.get(groupId);
      return s.enabled;
    },

    async isMandatory(groupId) {
      const s = await this.get(groupId);
      return s.enabled && s.mandateApproval;
    },

    /* Deleted-approver fallback: if default approver is removed,
       route to group admin and flag a warning. */
    async resolveApprover(groupId) {
      const s = await this.get(groupId);
      if (!s.defaultApprover) return null;
      try {
        const members = await ShadowDB.Members.getAll();
        const exists = members.some(m => m.name === s.defaultApprover);
        if (exists) return s.defaultApprover;
        /* Fallback to admin/owner */
        const admin = members.find(m =>
          m.role === 'Owner' || m.role === 'Admin' || m.role === 'Moderator'
        );
        const fallback = admin ? admin.name : null;
        s.defaultApprover = fallback;
        s._approverDeleted = true;
        await this.save(s);
        emit('approval:approver:deleted', {
          groupId,
          fallback,
          message: 'Default approver was removed. Requests now route to ' + (fallback || 'group admin') + '.'
        });
        return fallback;
      } catch (e) {
        return s.defaultApprover;
      }
    }
  };

  /* ══════════════════════════════════════════
     2.  REQUEST INITIATION (CRUD)
     ══════════════════════════════════════════ */
  const Requests = {
    async getActiveForTask(taskId) {
      const db = await getDB();
      return new Promise((resolve, reject) => {
        const tx  = db.transaction(STORES.approvalRequests, 'readonly');
        const idx = tx.objectStore(STORES.approvalRequests).index('taskId_status');
        const r   = idx.getAll(IDBKeyRange.only([taskId, ApprovalState.PENDING_APPROVAL]));
        r.onsuccess = () => resolve(r.result.length > 0 ? r.result[0] : null);
        r.onerror   = () => reject(r.error);
      });
    },

    async getAllForTask(taskId) {
      const db = await getDB();
      return new Promise((resolve, reject) => {
        const r = db.transaction(STORES.approvalRequests, 'readonly')
          .objectStore(STORES.approvalRequests).index('taskId').getAll(taskId);
        r.onsuccess = () => resolve(r.result || []);
        r.onerror   = () => reject(r.error);
      });
    },

    async getById(id) {
      return dbOp(STORES.approvalRequests, 'readonly', s => s.get(id));
    },

    async getAllPending() {
      const db = await getDB();
      return new Promise((resolve, reject) => {
        const r = db.transaction(STORES.approvalRequests, 'readonly')
          .objectStore(STORES.approvalRequests).index('status')
          .getAll(ApprovalState.PENDING_APPROVAL);
        r.onsuccess = () => resolve(r.result || []);
        r.onerror   = () => reject(r.error);
      });
    },

    /* ── Submit: Single Active Request constraint ── */
    async submit({ taskId, requesterId, approverId, note, groupId }) {
      const settings = await Settings.get(groupId);
      if (!settings.enabled) throw new Error('Approval workflow is not enabled for this group');

      /* Single active request per task */
      const existing = await this.getActiveForTask(taskId);
      if (existing) throw new Error('Task already has an active approval request');

      /* Self-approve guard */
      const resolvedApprover = approverId || await Settings.resolveApprover(groupId);
      if (resolvedApprover === requesterId)
        throw new Error('Task owners cannot approve their own tasks');

      if (!resolvedApprover)
        throw new Error('No approver selected and no default approver configured');

      if (note && note.length > 500)
        throw new Error('Note must be 500 characters or fewer');

      const req = {
        taskId,
        groupId,
        requesterId,
        approverId: resolvedApprover,
        status: ApprovalState.PENDING_APPROVAL,
        note: note || '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        resolvedAt: null,
        decisionNote: null,
        rejectionCategory: null
      };

      const id = await dbOp(STORES.approvalRequests, 'readwrite', s => s.add(req));
      req.id = id;

      await AuditLog.log({
        taskId, requestId: id,
        actorId: requesterId,
        actionType: 'approval_requested',
        notes: note || 'Approval requested',
        metadata: { approverId: req.approverId }
      });

      emit('approval:requested', req);
      emit('approval:notification', {
        type: 'approval_requested',
        recipientId: req.approverId,
        taskId,
        requestId: id,
        message: requesterId + ' requested your approval'
      });
      return req;
    },

    /* ── Approve ── */
    async approve({ requestId, approverId, note }) {
      const req = await this.getById(requestId);
      if (!req) throw new Error('Approval request not found');
      if (req.status !== ApprovalState.PENDING_APPROVAL) throw new Error('Request is not pending');
      if (req.approverId !== approverId) throw new Error('Only the designated approver can take action');

      req.status      = ApprovalState.APPROVED;
      req.updatedAt   = new Date().toISOString();
      req.resolvedAt  = new Date().toISOString();
      req.decisionNote = note || '';

      await dbOp(STORES.approvalRequests, 'readwrite', s => s.put(req));
      await AuditLog.log({
        taskId: req.taskId, requestId,
        actorId: approverId,
        actionType: 'approved',
        notes: note || 'Approved'
      });

      emit('approval:approved', req);
      emit('approval:notification', {
        type: 'approved',
        recipientId: req.requesterId,
        taskId: req.taskId,
        requestId,
        message: approverId + ' approved your request'
      });
      return req;
    },

    /* ── Reject (requires category + reason, max 1000 chars) ── */
    async reject({ requestId, approverId, category, reason }) {
      if (!category) throw new Error('Rejection category is required');
      if (!reason)   throw new Error('Rejection reason is required');
      if (reason.length > 1000) throw new Error('Reason must be 1000 characters or fewer');
      if (!REJECTION_CATEGORIES.includes(category)) throw new Error('Invalid rejection category');

      const req = await this.getById(requestId);
      if (!req) throw new Error('Approval request not found');
      if (req.status !== ApprovalState.PENDING_APPROVAL) throw new Error('Request is not pending');
      if (req.approverId !== approverId) throw new Error('Only the designated approver can take action');

      req.status            = ApprovalState.CHANGES_REQUESTED;
      req.updatedAt         = new Date().toISOString();
      req.resolvedAt        = new Date().toISOString();
      req.rejectionCategory = category;
      req.decisionNote      = reason;

      await dbOp(STORES.approvalRequests, 'readwrite', s => s.put(req));
      await AuditLog.log({
        taskId: req.taskId, requestId,
        actorId: approverId,
        actionType: 'rejected',
        notes: '[' + category + '] ' + reason
      });

      emit('approval:rejected', req);
      emit('approval:notification', {
        type: 'changes_requested',
        recipientId: req.requesterId,
        taskId: req.taskId,
        requestId,
        message: approverId + ' rejected: ' + category
      });
      return req;
    },

    /* ── Request Changes (requires feedback) ── */
    async requestChanges({ requestId, approverId, feedback }) {
      if (!feedback) throw new Error('Feedback is required');
      if (feedback.length > 1000) throw new Error('Feedback must be 1000 characters or fewer');

      const req = await this.getById(requestId);
      if (!req) throw new Error('Approval request not found');
      if (req.status !== ApprovalState.PENDING_APPROVAL) throw new Error('Request is not pending');
      if (req.approverId !== approverId) throw new Error('Only the designated approver can take action');

      req.status       = ApprovalState.CHANGES_REQUESTED;
      req.updatedAt    = new Date().toISOString();
      req.resolvedAt   = new Date().toISOString();
      req.decisionNote = feedback;

      await dbOp(STORES.approvalRequests, 'readwrite', s => s.put(req));
      await AuditLog.log({
        taskId: req.taskId, requestId,
        actorId: approverId,
        actionType: 'changes_requested',
        notes: feedback
      });

      emit('approval:changes_requested', req);
      emit('approval:notification', {
        type: 'changes_requested',
        recipientId: req.requesterId,
        taskId: req.taskId,
        requestId,
        message: approverId + ' requested changes'
      });
      return req;
    },

    /* ── Resubmit after changes requested ── */
    async resubmit({ requestId, requesterId, note }) {
      const old = await this.getById(requestId);
      if (!old) throw new Error('Original request not found');
      if (old.status !== ApprovalState.CHANGES_REQUESTED)
        throw new Error('Can only resubmit after changes were requested');

      const req = {
        taskId: old.taskId,
        groupId: old.groupId,
        requesterId,
        approverId: old.approverId,
        status: ApprovalState.PENDING_APPROVAL,
        note: note || 'Resubmitted',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        resolvedAt: null,
        decisionNote: null,
        rejectionCategory: null,
        previousRequestId: requestId
      };

      const id = await dbOp(STORES.approvalRequests, 'readwrite', s => s.add(req));
      req.id = id;

      await AuditLog.log({
        taskId: old.taskId, requestId: id,
        actorId: requesterId,
        actionType: 'resubmitted',
        notes: note || 'Resubmitted for approval'
      });

      emit('approval:resubmitted', req);
      emit('approval:notification', {
        type: 'approval_requested',
        recipientId: req.approverId,
        taskId: req.taskId,
        requestId: id,
        message: requesterId + ' resubmitted for approval'
      });
      return req;
    },

    /* ── Admin Abort ── */
    async abort({ requestId, adminId, reason }) {
      const req = await this.getById(requestId);
      if (!req) throw new Error('Request not found');
      if (req.status !== ApprovalState.PENDING_APPROVAL) throw new Error('Request is not pending');

      req.status       = ApprovalState.CHANGES_REQUESTED;
      req.updatedAt    = new Date().toISOString();
      req.resolvedAt   = new Date().toISOString();
      req.decisionNote = 'Aborted by admin: ' + (reason || 'No reason provided');
      req.abortedBy    = adminId;

      await dbOp(STORES.approvalRequests, 'readwrite', s => s.put(req));
      await AuditLog.log({
        taskId: req.taskId, requestId,
        actorId: adminId,
        actionType: 'aborted',
        notes: 'Admin abort: ' + (reason || 'No reason provided')
      });

      emit('approval:aborted', req);
      emit('approval:notification', {
        type: 'changes_requested',
        recipientId: req.requesterId,
        taskId: req.taskId,
        requestId,
        message: 'Approval aborted by admin ' + adminId
      });
      emit('approval:notification', {
        type: 'changes_requested',
        recipientId: req.approverId,
        taskId: req.taskId,
        requestId,
        message: 'Approval aborted by admin ' + adminId
      });
      return req;
    }
  };

  /* ══════════════════════════════════════════
     5.  AUDIT LOG (Timeline)
     ══════════════════════════════════════════ */
  const AuditLog = {
    async log({ taskId, requestId, actorId, actionType, notes, metadata }) {
      const entry = {
        taskId,
        requestId,
        actorId,
        actionType,
        notes: notes || '',
        timestamp: new Date().toISOString(),
        metadata: metadata || {}
      };
      const id = await dbOp(STORES.approvalAuditLogs, 'readwrite', s => s.add(entry));
      entry.id = id;
      emit('approval:audit:logged', entry);
      return entry;
    },

    async getForTask(taskId) {
      const db = await getDB();
      return new Promise((resolve, reject) => {
        const r = db.transaction(STORES.approvalAuditLogs, 'readonly')
          .objectStore(STORES.approvalAuditLogs).index('taskId').getAll(taskId);
        r.onsuccess = () => {
          const res = r.result || [];
          res.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
          resolve(res);
        };
        r.onerror = () => reject(r.error);
      });
    },

    async getForRequest(requestId) {
      const db = await getDB();
      return new Promise((resolve, reject) => {
        const r = db.transaction(STORES.approvalAuditLogs, 'readonly')
          .objectStore(STORES.approvalAuditLogs).index('requestId').getAll(requestId);
        r.onsuccess = () => resolve(r.result || []);
        r.onerror   = () => reject(r.error);
      });
    },

    async getAll() {
      return dbOp(STORES.approvalAuditLogs, 'readonly', s => s.getAll());
    }
  };

  /* ══════════════════════════════════════════
     4.  TASK STATE / FIELD LOCKING
     ══════════════════════════════════════════ */
  const TaskLock = {
    async isLocked(taskId) {
      return !!(await Requests.getActiveForTask(taskId));
    },

    isFieldEditable(fieldName, isApprover) {
      if (isApprover) return true;
      if (EDITABLE_FIELDS.includes(fieldName)) return true;
      return !LOCKED_FIELDS.includes(fieldName);
    },

    async getLockInfo(taskId) {
      const a = await Requests.getActiveForTask(taskId);
      if (!a) return { locked: false, lockedFields: [], request: null };
      return {
        locked: true,
        lockedFields: LOCKED_FIELDS,
        editableFields: EDITABLE_FIELDS,
        request: a,
        approverId: a.approverId
      };
    },

    async validateFieldUpdate(taskId, fieldName, currentUserId) {
      const a = await Requests.getActiveForTask(taskId);
      if (!a) return { allowed: true };
      if (currentUserId === a.approverId) return { allowed: true };
      if (EDITABLE_FIELDS.includes(fieldName)) return { allowed: true };
      if (LOCKED_FIELDS.includes(fieldName))
        return { allowed: false, reason: 'Field is locked while approval is pending.' };
      return { allowed: true };
    },

    /* Mandate Approval: block completion/closing unless approved */
    async validateTaskCompletion(taskId, groupId) {
      const s = await Settings.get(groupId);
      if (s.enabled && s.mandateApproval) {
        const all = await Requests.getAllForTask(taskId);
        if (!all.some(r => r.status === ApprovalState.APPROVED))
          return { allowed: false, reason: 'Task must be approved before it can be completed or closed.' };
      }
      return { allowed: true };
    }
  };

  /* ══════════════════════════════════════════
     6.  NOTIFICATIONS (in-memory queue)
     ══════════════════════════════════════════ */
  const Notifications = {
    queue: [],

    async send(n) {
      n.id = 'notif_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
      n.timestamp = new Date().toISOString();
      n.read = false;
      this.queue.push(n);
      emit('approval:notification:new', n);
      return n;
    },

    getUnread(userId) {
      return this.queue.filter(n => n.recipientId === userId && !n.read);
    },

    markRead(id) {
      const n = this.queue.find(x => x.id === id);
      if (n) n.read = true;
    },

    getAll(userId) {
      return this.queue.filter(n => n.recipientId === userId);
    }
  };

  on('approval:notification', data => Notifications.send(data));

  /* ══════════════════════════════════════════
     PUBLIC API
     ══════════════════════════════════════════ */
  return {
    ApprovalState,
    VALID_TRANSITIONS,
    REJECTION_CATEGORIES,
    LOCKED_FIELDS,
    EDITABLE_FIELDS,
    Settings,
    Requests,
    AuditLog,
    TaskLock,
    Notifications,
    on, off, emit,

    async init() {
      await ShadowDB.init();
      console.log('[ApprovalWorkflow] Initialized (reusing ShadowDB connection)');
      return true;
    },

    /* Access-control helpers */
    canRequestApproval(task, currentUserId) {
      return task.assignee === currentUserId || task.createdBy === currentUserId;
    },

    async isApprover(taskId, userId) {
      const a = await Requests.getActiveForTask(taskId);
      return a && a.approverId === userId;
    },

    async getAvailableApprovers(groupId) {
      try {
        const m = await ShadowDB.Members.getAll();
        return m.filter(x => x.name !== 'System');
      } catch (e) {
        return [
          { id: 1, name: 'Pradeep Kumar', role: 'Owner' },
          { id: 2, name: 'Sarah Chen', role: 'Member' },
          { id: 3, name: 'Alex Johnson', role: 'Moderator' },
          { id: 4, name: 'Rachel Kim', role: 'Moderator' }
        ];
      }
    },

    /* Check if user is group admin */
    async isGroupAdmin(groupId, userId) {
      try {
        const members = await ShadowDB.Members.getAll();
        const member = members.find(m => m.name === userId);
        return member && (member.role === 'Owner' || member.role === 'Admin' || member.role === 'Moderator');
      } catch (e) {
        return userId === 'Pradeep Kumar' || userId === 'Pradeep';
      }
    }
  };
})();
