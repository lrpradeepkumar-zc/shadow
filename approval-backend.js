/**
 * Shadow ToDo - Approval Workflow Backend
 * Reuses ShadowDB connection to avoid IndexedDB version conflicts.
 */
const ApprovalWorkflow = (function() {
          'use strict';
          const STORES = { approvalRequests: 'approvalRequests', approvalAuditLogs: 'approvalAuditLogs', approvalSettings: 'approvalSettings' };
          const ApprovalState = { PENDING_APPROVAL: 'pending_approval', APPROVED: 'approved', CHANGES_REQUESTED: 'changes_requested' };
          const VALID_TRANSITIONS = { [ApprovalState.PENDING_APPROVAL]: [ApprovalState.APPROVED, ApprovalState.CHANGES_REQUESTED], [ApprovalState.CHANGES_REQUESTED]: [ApprovalState.PENDING_APPROVAL], [ApprovalState.APPROVED]: [] };
          const REJECTION_CATEGORIES = ['Incomplete Work','Quality Issues','Missing Requirements','Incorrect Implementation','Needs More Testing','Other'];
          const LOCKED_FIELDS = ['title','dueDate','assignee','attachments','startDate','priority','status'];
          const EDITABLE_FIELDS = ['comments','subtasks'];
          const eventListeners = {};

                              async function getDB() { if (ShadowDB._db) return ShadowDB._db; await ShadowDB.init(); return ShadowDB._db; }

                              async function dbOp(storeName, mode, operation) {
                                            const database = await getDB();
                                            return new Promise((resolve, reject) => {
                                                              const tx = database.transaction(storeName, mode);
                                                              const store = tx.objectStore(storeName);
                                                              const result = operation(store);
                                                              if (result && result.onsuccess !== undefined) { result.onsuccess = () => resolve(result.result); result.onerror = () => reject(result.error); }
                                                              else { tx.oncomplete = () => resolve(result); tx.onerror = () => reject(tx.error); }
                                            });
                              }

                              function emit(event, data) { if (eventListeners[event]) eventListeners[event].forEach(fn => fn(data)); }
          function on(event, callback) { if (!eventListeners[event]) eventListeners[event] = []; eventListeners[event].push(callback); }
          function off(event, callback) { if (eventListeners[event]) eventListeners[event] = eventListeners[event].filter(fn => fn !== callback); }

                              const Settings = {
                                            async get(groupId) { try { const r = await dbOp(STORES.approvalSettings,'readonly',s=>s.get(groupId)); return r||{groupId,enabled:false,mandateApproval:false,defaultApprover:null,defaultApproverType:'member'}; } catch(e) { return {groupId,enabled:false,mandateApproval:false,defaultApprover:null,defaultApproverType:'member'}; } },
                                            async save(settings) { await dbOp(STORES.approvalSettings,'readwrite',s=>s.put(settings)); emit('approval:settings:changed',settings); await AuditLog.log({taskId:null,requestId:null,actorId:'System',actionType:'settings_updated',notes:'Settings updated for group '+settings.groupId,metadata:{settings}}); return settings; },
                                            async isEnabled(groupId) { const s = await this.get(groupId); return s.enabled; },
                                            async isMandatory(groupId) { const s = await this.get(groupId); return s.enabled && s.mandateApproval; }
                              };

                              const Requests = {
                                            async getActiveForTask(taskId) { const db = await getDB(); return new Promise((resolve,reject) => { const tx=db.transaction(STORES.approvalRequests,'readonly'); const idx=tx.objectStore(STORES.approvalRequests).index('taskId_status'); const r=idx.getAll(IDBKeyRange.only([taskId,ApprovalState.PENDING_APPROVAL])); r.onsuccess=()=>resolve(r.result.length>0?r.result[0]:null); r.onerror=()=>reject(r.error); }); },
                                            async getAllForTask(taskId) { const db = await getDB(); return new Promise((resolve,reject) => { const tx=db.transaction(STORES.approvalRequests,'readonly'); const r=tx.objectStore(STORES.approvalRequests).index('taskId').getAll(taskId); r.onsuccess=()=>resolve(r.result||[]); r.onerror=()=>reject(r.error); }); },
                                            async getById(id) { return dbOp(STORES.approvalRequests,'readonly',s=>s.get(id)); },
                                            async submit({taskId,requesterId,approverId,note,groupId}) {
                                                              const settings=await Settings.get(groupId); if(!settings.enabled) throw new Error('Approval workflow is not enabled for this group');
                                                              const existing=await this.getActiveForTask(taskId); if(existing) throw new Error('Task already has an active approval request');
                                                              if(note&&note.length>500) throw new Error('Note must be 500 characters or fewer');
                                                              const req={taskId,groupId,requesterId,approverId:approverId||settings.defaultApprover,status:ApprovalState.PENDING_APPROVAL,note:note||'',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),resolvedAt:null,decisionNote:null,rejectionCategory:null};
                                                              const id=await dbOp(STORES.approvalRequests,'readwrite',s=>s.add(req)); req.id=id;
                                                              await AuditLog.log({taskId,requestId:id,actorId:requesterId,actionType:'approval_requested',notes:note||'Approval requested',metadata:{approverId:req.approverId}});
                                                              emit('approval:requested',req); emit('approval:notification',{type:'approval_requested',recipientId:req.approverId,taskId,requestId:id,message:requesterId+' requested your approval'}); return req;
                                            },
                                            async approve({requestId,approverId,note}) {
                                                              const req=await this.getById(requestId); if(!req) throw new Error('Not found'); if(req.status!==ApprovalState.PENDING_APPROVAL) throw new Error('Not pending');
                                                              req.status=ApprovalState.APPROVED; req.updatedAt=new Date().toISOString(); req.resolvedAt=new Date().toISOString(); req.decisionNote=note||'';
                                                              await dbOp(STORES.approvalRequests,'readwrite',s=>s.put(req));
                                                              await AuditLog.log({taskId:req.taskId,requestId,actorId:approverId,actionType:'approved',notes:note||'Approved'});
                                                              emit('approval:approved',req); emit('approval:notification',{type:'approved',recipientId:req.requesterId,taskId:req.taskId,requestId,message:approverId+' approved your request'}); return req;
                                            },
                                            async reject({requestId,approverId,category,reason}) {
                                                              if(!category) throw new Error('Category required'); if(!reason) throw new Error('Reason required'); if(!REJECTION_CATEGORIES.includes(category)) throw new Error('Invalid category');
                                                              const req=await this.getById(requestId); if(!req) throw new Error('Not found'); if(req.status!==ApprovalState.PENDING_APPROVAL) throw new Error('Not pending');
                                                              req.status=ApprovalState.CHANGES_REQUESTED; req.updatedAt=new Date().toISOString(); req.resolvedAt=new Date().toISOString(); req.rejectionCategory=category; req.decisionNote=reason;
                                                              await dbOp(STORES.approvalRequests,'readwrite',s=>s.put(req));
                                                              await AuditLog.log({taskId:req.taskId,requestId,actorId:approverId,actionType:'rejected',notes:'['+category+'] '+reason});
                                                              emit('approval:rejected',req); emit('approval:notification',{type:'changes_requested',recipientId:req.requesterId,taskId:req.taskId,requestId,message:approverId+' requested changes: '+category}); return req;
                                            },
                                            async requestChanges({requestId,approverId,feedback}) {
                                                              if(!feedback) throw new Error('Feedback required');
                                                              const req=await this.getById(requestId); if(!req) throw new Error('Not found'); if(req.status!==ApprovalState.PENDING_APPROVAL) throw new Error('Not pending');
                                                              req.status=ApprovalState.CHANGES_REQUESTED; req.updatedAt=new Date().toISOString(); req.resolvedAt=new Date().toISOString(); req.decisionNote=feedback;
                                                              await dbOp(STORES.approvalRequests,'readwrite',s=>s.put(req));
                                                              await AuditLog.log({taskId:req.taskId,requestId,actorId:approverId,actionType:'changes_requested',notes:feedback});
                                                              emit('approval:changes_requested',req); emit('approval:notification',{type:'changes_requested',recipientId:req.requesterId,taskId:req.taskId,requestId,message:approverId+' requested changes'}); return req;
                                            },
                                            async resubmit({requestId,requesterId,note}) {
                                                              const old=await this.getById(requestId); if(!old) throw new Error('Not found'); if(old.status!==ApprovalState.CHANGES_REQUESTED) throw new Error('Can only resubmit after changes requested');
                                                              const req={taskId:old.taskId,groupId:old.groupId,requesterId,approverId:old.approverId,status:ApprovalState.PENDING_APPROVAL,note:note||'Resubmitted',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),resolvedAt:null,decisionNote:null,rejectionCategory:null,previousRequestId:requestId};
                                                              const id=await dbOp(STORES.approvalRequests,'readwrite',s=>s.add(req)); req.id=id;
                                                              await AuditLog.log({taskId:old.taskId,requestId:id,actorId:requesterId,actionType:'resubmitted',notes:note||'Resubmitted'}); emit('approval:resubmitted',req); return req;
                                            }
                              };

                              const AuditLog = {
                                            async log({taskId,requestId,actorId,actionType,notes,metadata}) { const e={taskId,requestId,actorId,actionType,notes:notes||'',timestamp:new Date().toISOString(),metadata:metadata||{}}; const id=await dbOp(STORES.approvalAuditLogs,'readwrite',s=>s.add(e)); e.id=id; emit('approval:audit:logged',e); return e; },
                                            async getForTask(taskId) { const db=await getDB(); return new Promise((resolve,reject) => { const r=db.transaction(STORES.approvalAuditLogs,'readonly').objectStore(STORES.approvalAuditLogs).index('taskId').getAll(taskId); r.onsuccess=()=>{const res=r.result||[]; res.sort((a,b)=>new Date(b.timestamp)-new Date(a.timestamp)); resolve(res);}; r.onerror=()=>reject(r.error); }); },
                                            async getForRequest(requestId) { const db=await getDB(); return new Promise((resolve,reject) => { const r=db.transaction(STORES.approvalAuditLogs,'readonly').objectStore(STORES.approvalAuditLogs).index('requestId').getAll(requestId); r.onsuccess=()=>resolve(r.result||[]); r.onerror=()=>reject(r.error); }); },
                                            async getAll() { return dbOp(STORES.approvalAuditLogs,'readonly',s=>s.getAll()); }
                              };

                              const TaskLock = {
                                            async isLocked(taskId) { return !!(await Requests.getActiveForTask(taskId)); },
                                            isFieldEditable(fieldName,isApprover) { if(isApprover) return true; if(EDITABLE_FIELDS.includes(fieldName)) return true; return !LOCKED_FIELDS.includes(fieldName); },
                                            async getLockInfo(taskId) { const a=await Requests.getActiveForTask(taskId); if(!a) return {locked:false,lockedFields:[],request:null}; return {locked:true,lockedFields:LOCKED_FIELDS,editableFields:EDITABLE_FIELDS,request:a,approverId:a.approverId}; },
                                            async validateFieldUpdate(taskId,fieldName,currentUserId) { const a=await Requests.getActiveForTask(taskId); if(!a) return {allowed:true}; if(currentUserId===a.approverId) return {allowed:true}; if(EDITABLE_FIELDS.includes(fieldName)) return {allowed:true}; if(LOCKED_FIELDS.includes(fieldName)) return {allowed:false,reason:'Field locked during pending approval.'}; return {allowed:true}; },
                                            async validateTaskCompletion(taskId,groupId) { const s=await Settings.get(groupId); if(s.enabled&&s.mandateApproval){const all=await Requests.getAllForTask(taskId); if(!all.some(r=>r.status===ApprovalState.APPROVED)) return {allowed:false,reason:'Task must be approved first.'};} return {allowed:true}; }
                              };

                              const Notifications = {
                                            queue: [],
                                            async send(n) { n.id='notif_'+Date.now()+'_'+Math.random().toString(36).substr(2,5); n.timestamp=new Date().toISOString(); n.read=false; this.queue.push(n); emit('approval:notification:new',n); return n; },
                                            getUnread(userId) { return this.queue.filter(n=>n.recipientId===userId&&!n.read); },
                                            markRead(id) { const n=this.queue.find(x=>x.id===id); if(n) n.read=true; },
                                            getAll(userId) { return this.queue.filter(n=>n.recipientId===userId); }
                              };

                              on('approval:notification', data => Notifications.send(data));

                              return {
                                            ApprovalState, VALID_TRANSITIONS, REJECTION_CATEGORIES, LOCKED_FIELDS, EDITABLE_FIELDS,
                                            Settings, Requests, AuditLog, TaskLock, Notifications, on, off, emit,
                                            async init() { await ShadowDB.init(); console.log('[ApprovalWorkflow] Initialized (reusing ShadowDB connection)'); return true; },
                                            canRequestApproval(task,currentUserId) { return task.assignee===currentUserId||task.createdBy===currentUserId; },
                                            async isApprover(taskId,userId) { const a=await Requests.getActiveForTask(taskId); return a&&a.approverId===userId; },
                                            async getAvailableApprovers(groupId) { try { const m=await ShadowDB.Members.getAll(); return m.filter(x=>x.name!=='System'); } catch(e) { return [{id:1,name:'Pradeep',role:'Admin'},{id:2,name:'Sarah',role:'Developer'},{id:3,name:'Alex',role:'Developer'},{id:4,name:'Rachel',role:'Designer'}]; } }
                              };
})();
