/**
 * Shadow ToDo - Approval Workflow UI
 * Frontend components for approval requests, decision interface, 
 * lock indicators, audit timeline, and admin settings panel
 */
const ApprovalUI = (function() {
      'use strict';

                        const CURRENT_USER = 'Pradeep'; // Simulated current user

                        // ===== ADMIN SETTINGS PANEL =====
                        function renderSettingsPanel(groupId) {
                                  return ApprovalWorkflow.Settings.get(groupId).then(settings => {
                                                const container = document.createElement('div');
                                                container.className = 'approval-settings-panel';
                                                container.innerHTML =
                                                                  '<div class="approval-settings-header">' +
                                                                      '<i class="fa-solid fa-shield-check"></i>' +
                                                                      '<h3>Approval Workflow</h3>' +
                                                                  '</div>' +
                                                                  '<div class="approval-setting-row">' +
                                                                      '<div class="setting-info">' +
                                                                          '<label>Enable Approval Workflow</label>' +
                                                                          '<span class="setting-desc">Require formal approval before tasks can be completed</span>' +
                                                                      '</div>' +
                                                                      '<label class="toggle-switch">' +
                                                                          '<input type="checkbox" id="approvalEnabled" ' + (settings.enabled ? 'checked' : '') + '>' +
                                                                          '<span class="toggle-slider"></span>' +
                                                                      '</label>' +
                                                                  '</div>' +
                                                                  '<div class="approval-setting-row">' +
                                                                      '<div class="setting-info">' +
                                                                          '<label>Mandate Approval</label>' +
                                                                          '<span class="setting-desc">Prevent tasks from being closed or marked Complete until approved</span>' +
                                                                      '</div>' +
                                                                      '<label class="toggle-switch">' +
                                                                          '<input type="checkbox" id="mandateApproval" ' + (settings.mandateApproval ? 'checked' : '') + '>' +
                                                                          '<span class="toggle-slider"></span>' +
                                                                      '</label>' +
                                                                  '</div>' +
                                                                  '<div class="approval-setting-row">' +
                                                                      '<div class="setting-info">' +
                                                                          '<label>Default Approver</label>' +
                                                                          '<span class="setting-desc">Set a default approver for all tasks in this group</span>' +
                                                                      '</div>' +
                                                                      '<select id="defaultApprover" class="approval-select">' +
                                                                          '<option value="">-- Select Approver --</option>' +
                                                                      '</select>' +
                                                                  '</div>';

                                                                                                 // Populate approver dropdown
                                                                                                 ApprovalWorkflow.getAvailableApprovers(groupId).then(members => {
                                                                                                                   const select = container.querySelector('#defaultApprover');
                                                                                                                   members.forEach(m => {
                                                                                                                                         const opt = document.createElement('option');
                                                                                                                                         opt.value = m.name;
                                                                                                                                         opt.textContent = m.name + ' (' + m.role + ')';
                                                                                                                                         if (settings.defaultApprover === m.name) opt.selected = true;
                                                                                                                                         select.appendChild(opt);
                                                                                                                     });
                                                                                                   });

                                                                                                 // Wire up event handlers
                                                                                                 container.querySelector('#approvalEnabled').addEventListener('change', async function() {
                                                                                                                   settings.enabled = this.checked;
                                                                                                                   await ApprovalWorkflow.Settings.save(settings);
                                                                                                                   showToast(this.checked ? 'Approval workflow enabled' : 'Approval workflow disabled');
                                                                                                   });

                                                                                                 container.querySelector('#mandateApproval').addEventListener('change', async function() {
                                                                                                                   settings.mandateApproval = this.checked;
                                                                                                                   await ApprovalWorkflow.Settings.save(settings);
                                                                                                                   showToast(this.checked ? 'Mandate approval enabled' : 'Mandate approval disabled');
                                                                                                   });

                                                                                                 container.querySelector('#defaultApprover').addEventListener('change', async function() {
                                                                                                                   settings.defaultApprover = this.value || null;
                                                                                                                   await ApprovalWorkflow.Settings.save(settings);
                                                                                                                   showToast(this.value ? 'Default approver set to ' + this.value : 'Default approver cleared');
                                                                                                   });

                                                                                                 return container;
                                  });
                        }

                        // ===== REQUEST APPROVAL BUTTON =====
                        function renderRequestButton(task, groupId) {
                                  const container = document.createElement('div');
                                  container.className = 'approval-request-section';

          ApprovalWorkflow.Settings.isEnabled(groupId).then(async enabled => {
                        if (!enabled) return;

                                                                        const canRequest = ApprovalWorkflow.canRequestApproval(task, CURRENT_USER);
                        const activeRequest = await ApprovalWorkflow.Requests.getActiveForTask(task.id);
                        const allRequests = await ApprovalWorkflow.Requests.getAllForTask(task.id);
                        const latestRequest = allRequests.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];

                                                                        if (activeRequest) {
                                                                                          // Show pending status with lock icon
                            container.innerHTML =
                                                  '<div class="approval-status-banner pending">' +
                                                      '<i class="fa-solid fa-lock"></i>' +
                                                      '<div class="approval-status-info">' +
                                                          '<strong>Pending Approval</strong>' +
                                                          '<span>Awaiting review from ' + activeRequest.approverId + '</span>' +
                                                      '</div>' +
                                                  '</div>';

                            // If current user is the approver, show decision interface
                            if (activeRequest.approverId === CURRENT_USER) {
                                                  container.appendChild(renderDecisionInterface(activeRequest));
                            }
                                                                        } else if (latestRequest && latestRequest.status === 'approved') {
                                                                                          container.innerHTML =
                                                                                                                '<div class="approval-status-banner approved">' +
                                                                                                                    '<i class="fa-solid fa-circle-check"></i>' +
                                                                                                                    '<div class="approval-status-info">' +
                                                                                                                        '<strong>Approved</strong>' +
                                                                                                                        '<span>Approved by ' + latestRequest.approverId + ' on ' + formatTimestamp(latestRequest.resolvedAt) + '</span>' +
                                                                                                                    '</div>' +
                                                                                                                '</div>';
                                                                        } else if (latestRequest && latestRequest.status === 'changes_requested') {
                                                                                          container.innerHTML =
                                                                                                                '<div class="approval-status-banner changes-requested">' +
                                                                                                                    '<i class="fa-solid fa-rotate-left"></i>' +
                                                                                                                    '<div class="approval-status-info">' +
                                                                                                                        '<strong>Changes Requested</strong>' +
                                                                                                                        '<span>' + (latestRequest.rejectionCategory || 'Feedback') + ': ' + latestRequest.decisionNote + '</span>' +
                                                                                                                    '</div>' +
                                                                                                                '</div>';
                                                                                          if (canRequest) {
                                                                                                                const resubmitBtn = document.createElement('button');
                                                                                                                resubmitBtn.className = 'approval-btn resubmit';
                                                                                                                resubmitBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Resubmit for Approval';
                                                                                                                resubmitBtn.addEventListener('click', () => showResubmitModal(latestRequest));
                                                                                                                container.appendChild(resubmitBtn);
                                                                                            }
                                                                        } else if (canRequest) {
                                                                                          const btn = document.createElement('button');
                                                                                          btn.className = 'approval-btn request';
                                                                                          btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Request Approval';
                                                                                          btn.addEventListener('click', () => showRequestModal(task, groupId));
                                                                                          container.appendChild(btn);
                                                                        }
          });

          return container;
                        }

                        // ===== APPROVER DECISION INTERFACE =====
                        function renderDecisionInterface(request) {
                                  const container = document.createElement('div');
                                  container.className = 'approval-decision-panel';
                                  container.innerHTML =
                                                '<h4><i class="fa-solid fa-gavel"></i> Your Decision</h4>' +
                                                '<div class="decision-note">' +
                                                    '<p><strong>Note from requester:</strong> ' + (request.note || 'No note provided') + '</p>' +
                                                '</div>' +
                                                '<div class="decision-actions">' +
                                                    '<button class="decision-btn approve" data-action="approve">' +
                                                        '<i class="fa-solid fa-check"></i> Approve' +
                                                    '</button>' +
                                                    '<button class="decision-btn reject" data-action="reject">' +
                                                        '<i class="fa-solid fa-xmark"></i> Reject' +
                                                    '</button>' +
                                                    '<button class="decision-btn changes" data-action="changes">' +
                                                        '<i class="fa-solid fa-pen"></i> Request Changes' +
                                                    '</button>' +
                                                '</div>';

          container.querySelector('[data-action="approve"]').addEventListener('click', async () => {
                        const note = prompt('Add an optional approval note:');
                        try {
                                          await ApprovalWorkflow.Requests.approve({
                                                                requestId: request.id,
                                                                approverId: CURRENT_USER,
                                                                note: note || ''
                                          });
                                          showToast('Task approved successfully!', 'success');
                                          refreshTaskDetail(request.taskId);
                        } catch(e) {
                                          showToast('Error: ' + e.message, 'error');
                        }
          });

          container.querySelector('[data-action="reject"]').addEventListener('click', () => {
                        showRejectModal(request);
          });

          container.querySelector('[data-action="changes"]').addEventListener('click', () => {
                        showChangesModal(request);
          });

          return container;
                        }

                        // ===== LOCK INDICATORS FOR TASK FIELDS =====
                        function applyFieldLocks(taskDetailPanel, taskId) {
                                  ApprovalWorkflow.TaskLock.getLockInfo(taskId).then(lockInfo => {
                                                if (!lockInfo.locked) {
                                                                  // Remove any existing lock indicators
                                                    taskDetailPanel.querySelectorAll('.field-lock-indicator').forEach(el => el.remove());
                                                                  taskDetailPanel.querySelectorAll('.field-locked').forEach(el => el.classList.remove('field-locked'));
                                                                  return;
                                                }

                                                                                                 const isApprover = lockInfo.approverId === CURRENT_USER;

                                                                                                 // Add lock banner at top
                                                                                                 let banner = taskDetailPanel.querySelector('.task-lock-banner');
                                                if (!banner) {
                                                                  banner = document.createElement('div');
                                                                  banner.className = 'task-lock-banner';
                                                                  const firstChild = taskDetailPanel.firstChild;
                                                                  if (firstChild) {
                                                                                        taskDetailPanel.insertBefore(banner, firstChild);
                                                                  } else {
                                                                                        taskDetailPanel.appendChild(banner);
                                                                  }
                                                }
                                                banner.innerHTML =
                                                                  '<i class="fa-solid fa-lock"></i>' +
                                                                  '<span>Task locked - Pending approval from <strong>' + lockInfo.approverId + '</strong></span>';
                                                if (isApprover) {
                                                                  banner.innerHTML += '<span class="approver-badge">You are the approver</span>';
                                                }

                                                                                                 // Lock individual fields
                                                                                                 lockInfo.lockedFields.forEach(fieldName => {
                                                                                                                   const fieldEl = taskDetailPanel.querySelector('[data-field="' + fieldName + '"]');
                                                                                                                   if (fieldEl && !isApprover) {
                                                                                                                                         fieldEl.classList.add('field-locked');
                                                                                                                                         fieldEl.setAttribute('contenteditable', 'false');
                                                                                                                     
                                                                                                                       // Add padlock icon
                                                                                                                       if (!fieldEl.querySelector('.field-lock-indicator')) {
                                                                                                                                                 const lockIcon = document.createElement('span');
                                                                                                                                                 lockIcon.className = 'field-lock-indicator';
                                                                                                                                                 lockIcon.innerHTML = '<i class="fa-solid fa-lock"></i>';
                                                                                                                                                 lockIcon.title = 'Locked during approval';
                                                                                                                                                 fieldEl.appendChild(lockIcon);
                                                                                                                         }
                                                                                                                     }
                                                                                                   });
                                  });
                        }

                        // ===== AUDIT TRAIL TIMELINE =====
                        function renderAuditTrail(taskId) {
                                  const container = document.createElement('div');
                                  container.className = 'approval-audit-trail';

          ApprovalWorkflow.AuditLog.getForTask(taskId).then(logs => {
                        if (logs.length === 0) {
                                          container.innerHTML = '<div class="audit-empty">No approval activity yet</div>';
                                          return;
                        }

                                                                        container.innerHTML =
                                                                                          '<div class="audit-trail-header">' +
                                                                                              '<i class="fa-solid fa-clock-rotate-left"></i>' +
                                                                                              '<h4>Approval History</h4>' +
                                                                                          '</div>';

                                                                        const timeline = document.createElement('div');
                        timeline.className = 'audit-timeline';

                                                                        logs.forEach(log => {
                                                                                          const item = document.createElement('div');
                                                                                          item.className = 'audit-timeline-item ' + log.actionType;
                                                                                          item.innerHTML =
                                                                                                                '<div class="audit-icon">' + getAuditIcon(log.actionType) + '</div>' +
                                                                                                                '<div class="audit-content">' +
                                                                                                                    '<div class="audit-header">' +
                                                                                                                        '<strong>' + log.actorId + '</strong>' +
                                                                                                                        '<span class="audit-action">' + formatActionType(log.actionType) + '</span>' +
                                                                                                                    '</div>' +
                                                                                                                    (log.notes ? '<div class="audit-notes">' + log.notes + '</div>' : '') +
                                                                                                                    '<div class="audit-timestamp">' + formatTimestamp(log.timestamp) + '</div>' +
                                                                                                                '</div>';
                                                                                          timeline.appendChild(item);
                                                                        });

                                                                        container.appendChild(timeline);
          });

          return container;
                        }

                        // ===== MODAL COMPONENTS =====
                        function showRequestModal(task, groupId) {
                                  const overlay = createModal('request-approval-modal');
                                  const modal = overlay.querySelector('.modal-content');

          modal.innerHTML =
                        '<div class="modal-header">' +
                            '<h3><i class="fa-solid fa-paper-plane"></i> Request Approval</h3>' +
                            '<button class="modal-close"><i class="fa-solid fa-xmark"></i></button>' +
                        '</div>' +
                        '<div class="modal-body">' +
                            '<div class="form-group">' +
                                '<label>Task</label>' +
                                '<div class="form-static">' + task.title + '</div>' +
                            '</div>' +
                            '<div class="form-group">' +
                                '<label>Select Approver <span class="required">*</span></label>' +
                                '<select id="modalApprover" class="form-select" required></select>' +
                            '</div>' +
                            '<div class="form-group">' +
                                '<label>Note <span class="char-count">(0/500)</span></label>' +
                                '<textarea id="modalNote" class="form-textarea" maxlength="500" rows="3" placeholder="Add context for the approver..."></textarea>' +
                            '</div>' +
                        '</div>' +
                        '<div class="modal-footer">' +
                            '<button class="btn-cancel">Cancel</button>' +
                            '<button class="btn-submit"><i class="fa-solid fa-paper-plane"></i> Submit Request</button>' +
                        '</div>';

          // Populate approver list
          ApprovalWorkflow.getAvailableApprovers(groupId).then(members => {
                        const select = modal.querySelector('#modalApprover');
                        members.filter(m => m.name !== CURRENT_USER).forEach(m => {
                                          const opt = document.createElement('option');
                                          opt.value = m.name;
                                          opt.textContent = m.name + ' (' + m.role + ')';
                                          select.appendChild(opt);
                        });

                                                                           // Pre-select default approver
                                                                           ApprovalWorkflow.Settings.get(groupId).then(settings => {
                                                                                             if (settings.defaultApprover) {
                                                                                                                   select.value = settings.defaultApprover;
                                                                                               }
                                                                           });
          });

          // Character count
          modal.querySelector('#modalNote').addEventListener('input', function() {
                        modal.querySelector('.char-count').textContent = '(' + this.value.length + '/500)';
          });

          // Submit
          modal.querySelector('.btn-submit').addEventListener('click', async () => {
                        const approverId = modal.querySelector('#modalApprover').value;
                        const note = modal.querySelector('#modalNote').value;
                        if (!approverId) { showToast('Please select an approver', 'error'); return; }
                        try {
                                          await ApprovalWorkflow.Requests.submit({
                                                                taskId: task.id,
                                                                requesterId: CURRENT_USER,
                                                                approverId,
                                                                note,
                                                                groupId
                                          });
                                          closeModal(overlay);
                                          showToast('Approval request submitted!', 'success');
                                          refreshTaskDetail(task.id);
                        } catch(e) {
                                          showToast('Error: ' + e.message, 'error');
                        }
          });

          modal.querySelector('.btn-cancel').addEventListener('click', () => closeModal(overlay));
                                  modal.querySelector('.modal-close').addEventListener('click', () => closeModal(overlay));
                        }

                        function showRejectModal(request) {
                                  const overlay = createModal('reject-approval-modal');
                                  const modal = overlay.querySelector('.modal-content');

          modal.innerHTML =
                        '<div class="modal-header reject">' +
                            '<h3><i class="fa-solid fa-xmark"></i> Reject Request</h3>' +
                            '<button class="modal-close"><i class="fa-solid fa-xmark"></i></button>' +
                        '</div>' +
                        '<div class="modal-body">' +
                            '<div class="form-group">' +
                                '<label>Rejection Category <span class="required">*</span></label>' +
                                '<select id="rejectCategory" class="form-select" required>' +
                                    '<option value="">-- Select Category --</option>' +
                                    ApprovalWorkflow.REJECTION_CATEGORIES.map(c =>
                                                                  '<option value="' + c + '">' + c + '</option>'
                                                                                                      ).join('') +
                                '</select>' +
                            '</div>' +
                            '<div class="form-group">' +
                                '<label>Reason <span class="required">*</span></label>' +
                                '<textarea id="rejectReason" class="form-textarea" rows="3" required placeholder="Provide a reason for rejection..."></textarea>' +
                            '</div>' +
                        '</div>' +
                        '<div class="modal-footer">' +
                            '<button class="btn-cancel">Cancel</button>' +
                            '<button class="btn-reject"><i class="fa-solid fa-xmark"></i> Reject</button>' +
                        '</div>';

          modal.querySelector('.btn-reject').addEventListener('click', async () => {
                        const category = modal.querySelector('#rejectCategory').value;
                        const reason = modal.querySelector('#rejectReason').value;
                        if (!category || !reason) { showToast('Category and reason are required', 'error'); return; }
                        try {
                                          await ApprovalWorkflow.Requests.reject({
                                                                requestId: request.id,
                                                                approverId: CURRENT_USER,
                                                                category,
                                                                reason
                                          });
                                          closeModal(overlay);
                                          showToast('Request rejected', 'warning');
                                          refreshTaskDetail(request.taskId);
                        } catch(e) {
                                          showToast('Error: ' + e.message, 'error');
                        }
          });

          modal.querySelector('.btn-cancel').addEventListener('click', () => closeModal(overlay));
                                  modal.querySelector('.modal-close').addEventListener('click', () => closeModal(overlay));
                        }

                        function showChangesModal(request) {
                                  const overlay = createModal('changes-approval-modal');
                                  const modal = overlay.querySelector('.modal-content');

          modal.innerHTML =
                        '<div class="modal-header changes">' +
                            '<h3><i class="fa-solid fa-pen"></i> Request Changes</h3>' +
                            '<button class="modal-close"><i class="fa-solid fa-xmark"></i></button>' +
                        '</div>' +
                        '<div class="modal-body">' +
                            '<div class="form-group">' +
                                '<label>Feedback Note <span class="required">*</span></label>' +
                                '<textarea id="changesFeedback" class="form-textarea" rows="4" required placeholder="Describe what changes are needed..."></textarea>' +
                            '</div>' +
                        '</div>' +
                        '<div class="modal-footer">' +
                            '<button class="btn-cancel">Cancel</button>' +
                            '<button class="btn-changes"><i class="fa-solid fa-pen"></i> Request Changes</button>' +
                        '</div>';

          modal.querySelector('.btn-changes').addEventListener('click', async () => {
                        const feedback = modal.querySelector('#changesFeedback').value;
                        if (!feedback) { showToast('Feedback is required', 'error'); return; }
                        try {
                                          await ApprovalWorkflow.Requests.requestChanges({
                                                                requestId: request.id,
                                                                approverId: CURRENT_USER,
                                                                feedback
                                          });
                                          closeModal(overlay);
                                          showToast('Changes requested', 'info');
                                          refreshTaskDetail(request.taskId);
                        } catch(e) {
                                          showToast('Error: ' + e.message, 'error');
                        }
          });

          modal.querySelector('.btn-cancel').addEventListener('click', () => closeModal(overlay));
                                  modal.querySelector('.modal-close').addEventListener('click', () => closeModal(overlay));
                        }

                        function showResubmitModal(request) {
                                  const overlay = createModal('resubmit-approval-modal');
                                  const modal = overlay.querySelector('.modal-content');

          modal.innerHTML =
                        '<div class="modal-header">' +
                            '<h3><i class="fa-solid fa-paper-plane"></i> Resubmit for Approval</h3>' +
                            '<button class="modal-close"><i class="fa-solid fa-xmark"></i></button>' +
                        '</div>' +
                        '<div class="modal-body">' +
                            '<div class="form-group">' +
                                '<label>Note about changes made</label>' +
                                '<textarea id="resubmitNote" class="form-textarea" rows="3" placeholder="Describe the changes you made..."></textarea>' +
                            '</div>' +
                        '</div>' +
                        '<div class="modal-footer">' +
                            '<button class="btn-cancel">Cancel</button>' +
                            '<button class="btn-submit"><i class="fa-solid fa-paper-plane"></i> Resubmit</button>' +
                        '</div>';

          modal.querySelector('.btn-submit').addEventListener('click', async () => {
                        const note = modal.querySelector('#resubmitNote').value;
                        try {
                                          await ApprovalWorkflow.Requests.resubmit({
                                                                requestId: request.id,
                                                                requesterId: CURRENT_USER,
                                                                note
                                          });
                                          closeModal(overlay);
                                          showToast('Resubmitted for approval!', 'success');
                                          refreshTaskDetail(request.taskId);
                        } catch(e) {
                                          showToast('Error: ' + e.message, 'error');
                        }
          });

          modal.querySelector('.btn-cancel').addEventListener('click', () => closeModal(overlay));
                                  modal.querySelector('.modal-close').addEventListener('click', () => closeModal(overlay));
                        }

                        // ===== NOTIFICATION BELL =====
                        function renderNotificationBell() {
                                  const container = document.createElement('div');
                                  container.className = 'approval-notifications';
                                  container.innerHTML =
                                                '<button class="notif-bell" title="Approval Notifications">' +
                                                    '<i class="fa-solid fa-bell"></i>' +
                                                    '<span class="notif-badge" style="display:none">0</span>' +
                                                '</button>' +
                                                '<div class="notif-dropdown" style="display:none">' +
                                                    '<div class="notif-header">Notifications</div>' +
                                                    '<div class="notif-list"></div>' +
                                                '</div>';

          const bell = container.querySelector('.notif-bell');
                                  const dropdown = container.querySelector('.notif-dropdown');
                                  const badge = container.querySelector('.notif-badge');
                                  const list = container.querySelector('.notif-list');

          function updateBadge() {
                        const unread = ApprovalWorkflow.Notifications.getUnread(CURRENT_USER);
                        badge.textContent = unread.length;
                        badge.style.display = unread.length > 0 ? '' : 'none';
          }

          function renderNotifs() {
                        const notifs = ApprovalWorkflow.Notifications.getAll(CURRENT_USER);
                        if (notifs.length === 0) {
                                          list.innerHTML = '<div class="notif-empty">No notifications</div>';
                        } else {
                                          list.innerHTML = notifs.map(n =>
                                                                '<div class="notif-item ' + (n.read ? '' : 'unread') + '" data-id="' + n.id + '">' +
                                                                    '<div class="notif-icon">' + getNotifIcon(n.type) + '</div>' +
                                                                    '<div class="notif-content">' +
                                                                        '<div class="notif-message">' + n.message + '</div>' +
                                                                        '<div class="notif-time">' + formatTimestamp(n.timestamp) + '</div>' +
                                                                    '</div>' +
                                                                '</div>'
                                                                                      ).join('');
                        }
          }

          bell.addEventListener('click', (e) => {
                        e.stopPropagation();
                        dropdown.style.display = dropdown.style.display === 'none' ? '' : 'none';
                        renderNotifs();
                        // Mark all as read
                                            ApprovalWorkflow.Notifications.getUnread(CURRENT_USER).forEach(n => {
                                                              ApprovalWorkflow.Notifications.markRead(n.id);
                                            });
                        updateBadge();
          });

          document.addEventListener('click', () => { dropdown.style.display = 'none'; });

          // Listen for new notifications
          ApprovalWorkflow.on('approval:notification:new', () => updateBadge());

          updateBadge();
                                  return container;
                        }

                        // ===== TASK CARD APPROVAL BADGE =====
                        function addApprovalBadgeToCard(cardElement, taskId) {
                                  ApprovalWorkflow.Requests.getActiveForTask(taskId).then(active => {
                                                if (!active) {
                                                                  // Check for approved
                                                    ApprovalWorkflow.Requests.getAllForTask(taskId).then(all => {
                                                                          const latest = all.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
                                                                          if (latest && latest.status === 'approved') {
                                                                                                    const badge = document.createElement('div');
                                                                                                    badge.className = 'card-approval-badge approved';
                                                                                                    badge.innerHTML = '<i class="fa-solid fa-circle-check"></i> Approved';
                                                                                                    cardElement.appendChild(badge);
                                                                          }
                                                    });
                                                                  return;
                                                }
                                                const badge = document.createElement('div');
                                                badge.className = 'card-approval-badge pending';
                                                badge.innerHTML = '<i class="fa-solid fa-lock"></i> Pending Approval';
                                                cardElement.appendChild(badge);
                                  });
                        }

                        // ===== HELPER FUNCTIONS =====
                        function createModal(id) {
                                  const overlay = document.createElement('div');
                                  overlay.className = 'approval-modal-overlay';
                                  overlay.id = id;
                                  overlay.innerHTML = '<div class="modal-content"></div>';
                                  overlay.addEventListener('click', (e) => {
                                                if (e.target === overlay) closeModal(overlay);
                                  });
                                  document.body.appendChild(overlay);
                                  return overlay;
                        }

                        function closeModal(overlay) {
                                  overlay.classList.add('closing');
                                  setTimeout(() => overlay.remove(), 200);
                        }

                        function showToast(message, type) {
                                  type = type || 'info';
                                  const toast = document.createElement('div');
                                  toast.className = 'approval-toast ' + type;
                                  toast.innerHTML = '<i class="fa-solid ' + getToastIcon(type) + '"></i> ' + message;
                                  document.body.appendChild(toast);
                                  setTimeout(() => toast.classList.add('show'), 10);
                                  setTimeout(() => {
                                                toast.classList.remove('show');
                                                setTimeout(() => toast.remove(), 300);
                                  }, 3000);
                        }

                        function formatTimestamp(ts) {
                                  if (!ts) return '';
                                  const d = new Date(ts);
                                  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
                                  return d.getDate() + ' ' + months[d.getMonth()] + ' ' + d.getFullYear() + ', ' +
                                                   d.getHours().toString().padStart(2,'0') + ':' + d.getMinutes().toString().padStart(2,'0') + ' UTC';
                        }

                        function formatActionType(type) {
                                  const map = {
                                                approval_requested: 'requested approval',
                                                approved: 'approved the task',
                                                rejected: 'rejected the request',
                                                changes_requested: 'requested changes',
                                                resubmitted: 'resubmitted for approval',
                                                settings_updated: 'updated approval settings'
                                  };
                                  return map[type] || type;
                        }

                        function getAuditIcon(type) {
                                  const map = {
                                                approval_requested: '<i class="fa-solid fa-paper-plane"></i>',
                                                approved: '<i class="fa-solid fa-check"></i>',
                                                rejected: '<i class="fa-solid fa-xmark"></i>',
                                                changes_requested: '<i class="fa-solid fa-pen"></i>',
                                                resubmitted: '<i class="fa-solid fa-rotate-right"></i>',
                                                settings_updated: '<i class="fa-solid fa-gear"></i>'
                                  };
                                  return map[type] || '<i class="fa-solid fa-circle"></i>';
                        }

                        function getNotifIcon(type) {
                                  const map = {
                                                approval_requested: '<i class="fa-solid fa-paper-plane"></i>',
                                                approved: '<i class="fa-solid fa-check-circle"></i>',
                                                changes_requested: '<i class="fa-solid fa-pen-to-square"></i>'
                                  };
                                  return map[type] || '<i class="fa-solid fa-bell"></i>';
                        }

                        function getToastIcon(type) {
                                  const map = {
                                                success: 'fa-check-circle',
                                                error: 'fa-exclamation-circle',
                                                warning: 'fa-exclamation-triangle',
                                                info: 'fa-info-circle'
                                  };
                                  return map[type] || 'fa-info-circle';
                        }

                        function refreshTaskDetail(taskId) {
                                  // Trigger a re-render of the task detail panel
          ApprovalWorkflow.emit('approval:ui:refresh', { taskId });
                        }

                        // ===== INITIALIZATION (inject into main app) =====
                        async function init() {
                                  await ApprovalWorkflow.init();

          // Inject notification bell into header
          const headerRight = document.querySelector('.header-right');
                                  if (headerRight) {
                                                const bell = renderNotificationBell();
                                                headerRight.insertBefore(bell, headerRight.firstChild);
                                  }

          // Listen for task detail open to inject approval UI
          ApprovalWorkflow.on('approval:ui:refresh', async (data) => {
                        const panel = document.getElementById('taskDetailPanel');
                        if (!panel) return;

                                          // Remove old approval sections
                                          panel.querySelectorAll('.approval-request-section, .approval-audit-trail, .approval-decision-panel').forEach(el => el.remove());

                                          // Get task from ShadowDB
                                          try {
                                                            const task = await ShadowDB.Tasks.getById(data.taskId);
                                                            if (!task) return;

                            const groupId = task.group || 1;

                            // Add approval request button/status
                            const requestSection = renderRequestButton(task, groupId);
                                                            const timelineSection = panel.querySelector('.timeline-section') || panel.querySelector('#timelineList');
                                                            if (timelineSection) {
                                                                                  timelineSection.parentNode.insertBefore(requestSection, timelineSection);
                                                            }

                            // Add audit trail
                            const auditTrail = renderAuditTrail(task.id);
                                                            if (timelineSection) {
                                                                                  timelineSection.parentNode.insertBefore(auditTrail, timelineSection);
                                                            }

                            // Apply field locks
                            applyFieldLocks(panel, task.id);
                                          } catch(e) {
                                                            console.error('[ApprovalUI] Error refreshing:', e);
                                          }
          });

          console.log('[ApprovalUI] Initialized');
                        }

                        // ===== PUBLIC API =====
                        return {
                                  init,
                                  renderSettingsPanel,
                                  renderRequestButton,
                                  renderDecisionInterface,
                                  renderAuditTrail,
                                  renderNotificationBell,
                                  applyFieldLocks,
                                  addApprovalBadgeToCard,
                                  showToast,
                                  CURRENT_USER
                        };
})();
