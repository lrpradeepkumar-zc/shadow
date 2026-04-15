/**
 * Shadow ToDo - Approval Workflow Backend
 * IndexedDB-powered approval system with state machine, audit trail, and task locking
 * 
 * State Machine: PENDING_APPROVAL -> APPROVED | CHANGES_REQUESTED
 * Single Active Request constraint per task enforced at DB level
 * In-Flight Preservation: toggling feature OFF does NOT cancel existing requests
 */
const ApprovalWorkflow = (function() {
      'use strict';

                              const DB_NAME = 'ShadowToDoDB';
      const DB_VERSION = 3; // Bump version to add new stores
                              const STORES = {
                                        approvalRequests: 'approvalRequests',
                                        approvalAuditLogs: 'approvalAuditLogs',
                                        approvalSettings: 'approvalSettings'
                              };

                              // ===== STATE MACHINE DEFINITION =====
                              const ApprovalState = {
                                        PENDING_APPROVAL: 'pending_approval',
                                        APPROVED: 'approved',
                                        CHANGES_REQUESTED: 'changes_requested'
                              };

                              const VALID_TRANSITIONS = {
                                        [ApprovalState.PENDING_APPROVAL]: [ApprovalState.APPROVED, ApprovalState.CHANGES_REQUESTED],
                                        [ApprovalState.CHANGES_REQUESTED]: [ApprovalState.PENDING_APPROVAL],
                                        [ApprovalState.APPROVED]: [] // Terminal state
                              };

                              const REJECTION_CATEGORIES = [
                                        'Incomplete Work',
                                        'Quality Issues',
                                        'Missing Requirements',
                                        'Incorrect Implementation',
                                        'Needs More Testing',
                                        'Other'
                                    ];

                              // Fields locked during pending approval
                              const LOCKED_FIELDS = ['title', 'dueDate', 'assignee', 'attachments', 'startDate', 'priority', 'status'];
      // Fields that remain editable
                              const EDITABLE_FIELDS = ['comments', 'subtasks'];

                              let db = null;
      const eventListeners = {};

                              // ===== DATABASE INITIALIZATION =====
                              function openDB() {
                                        return new Promise((resolve, reject) => {
                                                      if (db) { resolve(db); return; }
                                                      const request = indexedDB.open(DB_NAME, DB_VERSION);
                                                      request.onerror = () => reject(request.error);
                                                      request.onsuccess = () => { db = request.result; resolve(db); };
                                                      request.onupgradeneeded = (e) => {
                                                                        const d = e.target.result;

                                                                        // Create ApprovalRequests store
                                                                        if (!d.objectStoreNames.contains(STORES.approvalRequests)) {
                                                                                              const arStore = d.createObjectStore(STORES.approvalRequests, { keyPath: 'id', autoIncrement: true });
                                                                                              arStore.createIndex('taskId', 'taskId', { unique: false });
                                                                                              arStore.createIndex('status', 'status', { unique: false });
                                                                                              arStore.createIndex('taskId_status', ['taskId', 'status'], { unique: false });
                                                                                              arStore.createIndex('approverId', 'approverId', { unique: false });
                                                                                              arStore.createIndex('requesterId', 'requesterId', { unique: false });
                                                                                              arStore.createIndex('createdAt', 'createdAt', { unique: false });
                                                                        }

                                                                        // Create ApprovalAuditLogs store (immutable)
                                                                        if (!d.objectStoreNames.contains(STORES.approvalAuditLogs)) {
                                                                                              const alStore = d.createObjectStore(STORES.approvalAuditLogs, { keyPath: 'id', autoIncrement: true });
                                                                                              alStore.createIndex('taskId', 'taskId', { unique: false });
                                                                                              alStore.createIndex('requestId', 'requestId', { unique: false });
                                                                                              alStore.createIndex('timestamp', 'timestamp', { unique: false });
                                                                                              alStore.createIndex('actionType', 'actionType', { unique: false });
                                                                                              alStore.createIndex('actorId', 'actorId', { unique: false });
                                                                        }

                                                                        // Create ApprovalSettings store (group-level settings)
                                                                        if (!d.objectStoreNames.contains(STORES.approvalSettings)) {
                                                                                              const asStore = d.createObjectStore(STORES.approvalSettings, { keyPath: 'groupId' });
                                                                        }
                                                      };
                                        });
                              }

                              // ===== GENERIC DB OPERATIONS =====
                              async function dbOp(storeName, mode, operation) {
                                        const database = await openDB();
                                        return new Promise((resolve, reject) => {
                                                      const tx = database.transaction(storeName, mode);
                                                      const store = tx.objectStore(storeName);
                                                      const result = operation(store);
                                                      if (result && result.onsuccess !== undefined) {
                                                                        result.onsuccess = () => resolve(result.result);
                                                                        result.onerror = () => reject(result.error);
                                                      } else {
                                                                        tx.oncomplete = () => resolve(result);
                                                                        tx.onerror = () => reject(tx.error);
                                                      }
                                        });
                              }

                              // ===== EVENT SYSTEM =====
                              function emit(event, data) {
                                        if (eventListeners[event]) {
                                                      eventListeners[event].forEach(fn => fn(data));
                                        }
                              }

                              function on(event, callback) {
                                        if (!eventListeners[event]) eventListeners[event] = [];
                                        eventListeners[event].push(callback);
                              }

                              function off(event, callback) {
                                        if (eventListeners[event]) {
                                                      eventListeners[event] = eventListeners[event].filter(fn => fn !== callback);
                                        }
                              }

                              // ===== APPROVAL SETTINGS (Admin Controls) =====
                              const Settings = {
                                        async get(groupId) {
                                                      try {
                                                                        const result = await dbOp(STORES.approvalSettings, 'readonly', store => store.get(groupId));
                                                                        return result || {
                                                                                              groupId: groupId,
                                                                                              enabled: false,           // Enable Approval Workflow (Default: OFF)
                                                                                              mandateApproval: false,    // Prevent close/complete without approval
                                                                                              defaultApprover: null,     // Default approver (member name or role)
                                                                                              defaultApproverType: 'member' // 'member' or 'role'
                                                                        };
                                                      } catch (e) {
                                                                        return {
                                                                                              groupId: groupId,
                                                                                              enabled: false,
                                                                                              mandateApproval: false,
                                                                                              defaultApprover: null,
                                                                                              defaultApproverType: 'member'
                                                                        };
                                                      }
                                        },

                                        async save(settings) {
                                                      await dbOp(STORES.approvalSettings, 'readwrite', store => store.put(settings));
                                                      emit('approval:settings:changed', settings);
                                                      await AuditLog.log({
                                                                        taskId: null,
                                                                        requestId: null,
                                                                        actorId: 'System',
                                                                        actionType: 'settings_updated',
                                                                        notes: 'Approval settings updated for group ' + settings.groupId,
                                                                        metadata: { settings }
                                                      });
                                                      return settings;
                                        },

                                        async isEnabled(groupId) {
                                                      const settings = await this.get(groupId);
                                                      return settings.enabled;
                                        },

                                        async isMandatory(groupId) {
                                                      const settings = await this.get(groupId);
                                                      return settings.enabled && settings.mandateApproval;
                                        }
                              };

                              // ===== APPROVAL REQUESTS =====
                              const Requests = {
                                        /**
                                                   * Get the active (pending) approval request for a task.
                                         * Enforces Single Active Request constraint.
                                         */
                                        async getActiveForTask(taskId) {
                                                      const database = await openDB();
                                                      return new Promise((resolve, reject) => {
                                                                        const tx = database.transaction(STORES.approvalRequests, 'readonly');
                                                                        const store = tx.objectStore(STORES.approvalRequests);
                                                                        const index = store.index('taskId_status');
                                                                        const range = IDBKeyRange.only([taskId, ApprovalState.PENDING_APPROVAL]);
                                                                        const request = index.getAll(range);
                                                                        request.onsuccess = () => resolve(request.result.length > 0 ? request.result[0] : null);
                                                                        request.onerror = () => reject(request.error);
                                                      });
                                        },

                                        async getAllForTask(taskId) {
                                                      const database = await openDB();
                                                      return new Promise((resolve, reject) => {
                                                                        const tx = database.transaction(STORES.approvalRequests, 'readonly');
                                                                        const store = tx.objectStore(STORES.approvalRequests);
                                                                        const index = store.index('taskId');
                                                                        const request = index.getAll(taskId);
                                                                        request.onsuccess = () => resolve(request.result || []);
                                                                        request.onerror = () => reject(request.error);
                                                      });
                                        },

                                        async getById(id) {
                                                      return dbOp(STORES.approvalRequests, 'readonly', store => store.get(id));
                                        },

                                        /**
                                                   * Submit a new approval request.
                                         * Enforces: single active request per task, workflow must be enabled.
                                         */
                                        async submit({ taskId, requesterId, approverId, note, groupId }) {
                                                      // Validate workflow is enabled
                                            const settings = await Settings.get(groupId);
                                                      if (!settings.enabled) {
                                                                        throw new Error('Approval workflow is not enabled for this group');
                                                      }

                                            // Enforce single active request
                                            const existing = await this.getActiveForTask(taskId);
                                                      if (existing) {
                                                                        throw new Error('Task already has an active approval request');
                                                      }

                                            // Validate note length
                                            if (note && note.length > 500) {
                                                              throw new Error('Note must be 500 characters or fewer');
                                            }

                                            const newRequest = {
                                                              taskId: taskId,
                                                              groupId: groupId,
                                                              requesterId: requesterId,
                                                              approverId: approverId || settings.defaultApprover,
                                                              status: ApprovalState.PENDING_APPROVAL,
                                                              note: note || '',
                                                              createdAt: new Date().toISOString(),
                                                              updatedAt: new Date().toISOString(),
                                                              resolvedAt: null,
                                                              decisionNote: null,
                                                              rejectionCategory: null
                                            };

                                            const id = await dbOp(STORES.approvalRequests, 'readwrite', store => store.add(newRequest));
                                                      newRequest.id = id;

                                            // Log to audit trail
                                            await AuditLog.log({
                                                              taskId,
                                                              requestId: id,
                                                              actorId: requesterId,
                                                              actionType: 'approval_requested',
                                                              notes: note || 'Approval requested',
                                                              metadata: { approverId: newRequest.approverId }
                                            });

                                            emit('approval:requested', newRequest);
                                                      emit('approval:notification', {
                                                                        type: 'approval_requested',
                                                                        recipientId: newRequest.approverId,
                                                                        taskId,
                                                                        requestId: id,
                                                                        message: requesterId + ' requested your approval'
                                                      });

                                            return newRequest;
                                        },

                                        /**
                                                   * Approve a request. Only the designated approver can do this.
                                         */
                                        async approve({ requestId, approverId, note }) {
                                                      const request = await this.getById(requestId);
                                                      if (!request) throw new Error('Approval request not found');
                                                      if (request.status !== ApprovalState.PENDING_APPROVAL) {
                                                                        throw new Error('Request is not in pending state');
                                                      }

                                            // Validate state transition
                                            if (!VALID_TRANSITIONS[request.status].includes(ApprovalState.APPROVED)) {
                                                              throw new Error('Invalid state transition');
                                            }

                                            request.status = ApprovalState.APPROVED;
                                                      request.updatedAt = new Date().toISOString();
                                                      request.resolvedAt = new Date().toISOString();
                                                      request.decisionNote = note || '';

                                            await dbOp(STORES.approvalRequests, 'readwrite', store => store.put(request));

                                            await AuditLog.log({
                                                              taskId: request.taskId,
                                                              requestId: requestId,
                                                              actorId: approverId,
                                                              actionType: 'approved',
                                                              notes: note || 'Request approved'
                                            });

                                            emit('approval:approved', request);
                                                      emit('approval:notification', {
                                                                        type: 'approved',
                                                                        recipientId: request.requesterId,
                                                                        taskId: request.taskId,
                                                                        requestId,
                                                                        message: approverId + ' approved your request'
                                                      });

                                            return request;
                                        },

                                        /**
                                                   * Reject a request. Requires mandatory category and reason.
                                         */
                                        async reject({ requestId, approverId, category, reason }) {
                                                      if (!category) throw new Error('Rejection category is required');
                                                      if (!reason) throw new Error('Rejection reason is required');
                                                      if (!REJECTION_CATEGORIES.includes(category)) {
                                                                        throw new Error('Invalid rejection category');
                                                      }

                                            const request = await this.getById(requestId);
                                                      if (!request) throw new Error('Approval request not found');
                                                      if (request.status !== ApprovalState.PENDING_APPROVAL) {
                                                                        throw new Error('Request is not in pending state');
                                                      }

                                            request.status = ApprovalState.CHANGES_REQUESTED;
                                                      request.updatedAt = new Date().toISOString();
                                                      request.resolvedAt = new Date().toISOString();
                                                      request.rejectionCategory = category;
                                                      request.decisionNote = reason;

                                            await dbOp(STORES.approvalRequests, 'readwrite', store => store.put(request));

                                            await AuditLog.log({
                                                              taskId: request.taskId,
                                                              requestId,
                                                              actorId: approverId,
                                                              actionType: 'rejected',
                                                              notes: '[' + category + '] ' + reason
                                            });

                                            emit('approval:rejected', request);
                                                      emit('approval:notification', {
                                                                        type: 'changes_requested',
                                                                        recipientId: request.requesterId,
                                                                        taskId: request.taskId,
                                                                        requestId,
                                                                        message: approverId + ' requested changes: ' + category
                                                      });

                                            return request;
                                        },

                                        /**
                                                   * Request changes. Requires a feedback note.
                                         */
                                        async requestChanges({ requestId, approverId, feedback }) {
                                                      if (!feedback) throw new Error('Feedback note is required');

                                            const request = await this.getById(requestId);
                                                      if (!request) throw new Error('Approval request not found');
                                                      if (request.status !== ApprovalState.PENDING_APPROVAL) {
                                                                        throw new Error('Request is not in pending state');
                                                      }

                                            request.status = ApprovalState.CHANGES_REQUESTED;
                                                      request.updatedAt = new Date().toISOString();
                                                      request.resolvedAt = new Date().toISOString();
                                                      request.decisionNote = feedback;

                                            await dbOp(STORES.approvalRequests, 'readwrite', store => store.put(request));

                                            await AuditLog.log({
                                                              taskId: request.taskId,
                                                              requestId,
                                                              actorId: approverId,
                                                              actionType: 'changes_requested',
                                                              notes: feedback
                                            });

                                            emit('approval:changes_requested', request);
                                                      emit('approval:notification', {
                                                                        type: 'changes_requested',
                                                                        recipientId: request.requesterId,
                                                                        taskId: request.taskId,
                                                                        requestId,
                                                                        message: approverId + ' requested changes'
                                                      });

                                            return request;
                                        },

                                        /**
                                                   * Re-submit after changes requested (back to PENDING).
                                         */
                                        async resubmit({ requestId, requesterId, note }) {
                                                      const oldRequest = await this.getById(requestId);
                                                      if (!oldRequest) throw new Error('Approval request not found');
                                                      if (oldRequest.status !== ApprovalState.CHANGES_REQUESTED) {
                                                                        throw new Error('Can only resubmit after changes requested');
                                                      }

                                            // Create new request (old one stays as historical record)
                                            const newRequest = {
                                                              taskId: oldRequest.taskId,
                                                              groupId: oldRequest.groupId,
                                                              requesterId: requesterId,
                                                              approverId: oldRequest.approverId,
                                                              status: ApprovalState.PENDING_APPROVAL,
                                                              note: note || 'Resubmitted after changes',
                                                              createdAt: new Date().toISOString(),
                                                              updatedAt: new Date().toISOString(),
                                                              resolvedAt: null,
                                                              decisionNote: null,
                                                              rejectionCategory: null,
                                                              previousRequestId: requestId
                                            };

                                            const id = await dbOp(STORES.approvalRequests, 'readwrite', store => store.add(newRequest));
                                                      newRequest.id = id;

                                            await AuditLog.log({
                                                              taskId: oldRequest.taskId,
                                                              requestId: id,
                                                              actorId: requesterId,
                                                              actionType: 'resubmitted',
                                                              notes: note || 'Resubmitted for approval'
                                            });

                                            emit('approval:resubmitted', newRequest);
                                                      return newRequest;
                                        }
                              };

                              // ===== AUDIT LOG (Immutable) =====
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
                                                      const id = await dbOp(STORES.approvalAuditLogs, 'readwrite', store => store.add(entry));
                                                      entry.id = id;
                                                      emit('approval:audit:logged', entry);
                                                      return entry;
                                        },

                                        async getForTask(taskId) {
                                                      const database = await openDB();
                                                      return new Promise((resolve, reject) => {
                                                                        const tx = database.transaction(STORES.approvalAuditLogs, 'readonly');
                                                                        const store = tx.objectStore(STORES.approvalAuditLogs);
                                                                        const index = store.index('taskId');
                                                                        const request = index.getAll(taskId);
                                                                        request.onsuccess = () => {
                                                                                              const results = request.result || [];
                                                                                              results.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
                                                                                              resolve(results);
                                                                        };
                                                                        request.onerror = () => reject(request.error);
                                                      });
                                        },

                                        async getForRequest(requestId) {
                                                      const database = await openDB();
                                                      return new Promise((resolve, reject) => {
                                                                        const tx = database.transaction(STORES.approvalAuditLogs, 'readonly');
                                                                        const store = tx.objectStore(STORES.approvalAuditLogs);
                                                                        const index = store.index('requestId');
                                                                        const request = index.getAll(requestId);
                                                                        request.onsuccess = () => resolve(request.result || []);
                                                                        request.onerror = () => reject(request.error);
                                                      });
                                        },

                                        async getAll() {
                                                      return dbOp(STORES.approvalAuditLogs, 'readonly', store => store.getAll());
                                        }
                              };

                              // ===== TASK LOCKING MECHANISM =====
                              const TaskLock = {
                                        /**
                                                   * Check if a task is locked (has active pending approval).
                                         */
                                        async isLocked(taskId) {
                                                      const active = await Requests.getActiveForTask(taskId);
                                                      return !!active;
                                        },

                                        /**
                                                   * Check if a specific field is editable on a locked task.
                                         */
                                        isFieldEditable(fieldName, isApprover) {
                                                      if (isApprover) return true; // Approver can edit locked fields
                                            if (EDITABLE_FIELDS.includes(fieldName)) return true;
                                                      return !LOCKED_FIELDS.includes(fieldName);
                                        },

                                        /**
                                                   * Get lock info for a task (for UI rendering).
                                         */
                                        async getLockInfo(taskId) {
                                                      const active = await Requests.getActiveForTask(taskId);
                                                      if (!active) {
                                                                        return { locked: false, lockedFields: [], request: null };
                                                      }
                                                      return {
                                                                        locked: true,
                                                                        lockedFields: LOCKED_FIELDS,
                                                                        editableFields: EDITABLE_FIELDS,
                                                                        request: active,
                                                                        approverId: active.approverId
                                                      };
                                        },

                                        /**
                                                   * Validate if a task field update is allowed.
                                         * Returns { allowed: boolean, reason: string }
                                         */
                                        async validateFieldUpdate(taskId, fieldName, currentUserId) {
                                                      const active = await Requests.getActiveForTask(taskId);
                                                      if (!active) return { allowed: true };

                                            if (currentUserId === active.approverId) {
                                                              return { allowed: true };
                                            }

                                            if (EDITABLE_FIELDS.includes(fieldName)) {
                                                              return { allowed: true };
                                            }

                                            if (LOCKED_FIELDS.includes(fieldName)) {
                                                              return {
                                                                                    allowed: false,
                                                                                    reason: 'Field "' + fieldName + '" is locked during pending approval. Only the approver (' + active.approverId + ') can modify it.'
                                                              };
                                            }

                                            return { allowed: true };
                                        },

                                        /**
                                                   * Validate if a task can be closed/completed.
                                         * Enforces Mandate Approval toggle.
                                         */
                                        async validateTaskCompletion(taskId, groupId) {
                                                      const settings = await Settings.get(groupId);

                                            // If mandate approval is on, check for approved request
                                            if (settings.enabled && settings.mandateApproval) {
                                                              const allRequests = await Requests.getAllForTask(taskId);
                                                              const hasApproved = allRequests.some(r => r.status === ApprovalState.APPROVED);
                                                              if (!hasApproved) {
                                                                                    return {
                                                                                                              allowed: false,
                                                                                                              reason: 'Task cannot be closed or marked "Complete" until it has been approved. Please submit for approval first.'
                                                                                      };
                                                              }
                                            }

                                            return { allowed: true };
                                        }
                              };

                              // ===== NOTIFICATION SYSTEM =====
                              const Notifications = {
                                        queue: [],

                                        async send(notification) {
                                                      notification.id = 'notif_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
                                                      notification.timestamp = new Date().toISOString();
                                                      notification.read = false;
                                                      this.queue.push(notification);

                                            // In-app notification
                                            emit('approval:notification:new', notification);

                                            // Email notification (simulated - would integrate with email service)
                                            console.log('[Approval Notification] To: ' + notification.recipientId + ' | ' + notification.message);

                                            return notification;
                                        },

                                        getUnread(userId) {
                                                      return this.queue.filter(n => n.recipientId === userId && !n.read);
                                        },

                                        markRead(notificationId) {
                                                      const notif = this.queue.find(n => n.id === notificationId);
                                                      if (notif) notif.read = true;
                                        },

                                        getAll(userId) {
                                                      return this.queue.filter(n => n.recipientId === userId);
                                        }
                              };

                              // Wire up notification sending
                              on('approval:notification', (data) => {
                                        Notifications.send(data);
                              });

                              // ===== PUBLIC API =====
                              return {
                                        // Constants
                                        ApprovalState,
                                        VALID_TRANSITIONS,
                                        REJECTION_CATEGORIES,
                                        LOCKED_FIELDS,
                                        EDITABLE_FIELDS,

                                        // Modules
                                        Settings,
                                        Requests,
                                        AuditLog,
                                        TaskLock,
                                        Notifications,

                                        // Event system
                                        on,
                                        off,
                                        emit,

                                        // Initialize
                                        async init() {
                                                      await openDB();
                                                      console.log('[ApprovalWorkflow] Initialized with stores:', Object.values(STORES).join(', '));
                                                      return true;
                                        },

                                        // Helper: Check if user can request approval (owner/assignee only)
                                        canRequestApproval(task, currentUserId) {
                                                      return task.assignee === currentUserId || task.createdBy === currentUserId;
                                        },

                                        // Helper: Check if user is the approver for active request
                                        async isApprover(taskId, userId) {
                                                      const active = await Requests.getActiveForTask(taskId);
                                                      return active && active.approverId === userId;
                                        },

                                        // Helper: Get members list for approver selection
                                        async getAvailableApprovers(groupId) {
                                                      // Integrate with ShadowDB members
                                            try {
                                                              const members = await ShadowDB.Members.getAll();
                                                              return members.filter(m => m.name !== 'System');
                                            } catch(e) {
                                                              return [
                                                                { id: 1, name: 'Pradeep', role: 'Admin' },
                                                                { id: 2, name: 'Sarah', role: 'Developer' },
                                                                { id: 3, name: 'Alex', role: 'Developer' },
                                                                { id: 4, name: 'Rachel', role: 'Designer' }
                                                                                ];
                                            }
                                        }
                              };
})();
