/**
 * Shadow ToDo - Approval Workflow UI (PRD-Compliant)
 * Request modal, decision panel, task locking, timeline, admin abort, notifications
 * Updated: Rules and Approval workflow in View Task popup with responsive layout
 */
const ApprovalUI = (function() {
  'use strict';

  const CURRENT_USER = 'Pradeep';

  /* ════════════════════════════════
     ADMIN SETTINGS PANEL (Group Settings)
     ════════════════════════════════ */
  function renderSettingsPanel(groupId) {
    return ApprovalWorkflow.Settings.get(groupId).then(settings => {
      const container = document.createElement('div');
      container.className = 'approval-settings-card';
      container.id = 'approvalSettingsCard';

      const mandateDisplay = settings.enabled ? '' : 'style="display:none"';
      const approverDisplay = settings.enabled ? '' : 'style="display:none"';

      container.innerHTML =
        '<div class="approval-settings-header-row">' +
          '<div class="approval-settings-icon"><i class="fa-solid fa-gear"></i></div>' +
          '<h3>Rules & Approvals</h3>' +
        '</div>' +
        '<div class="approval-settings-divider"></div>' +
        '<div class="approval-setting-block">' +
          '<div class="approval-setting-row">' +
            '<div class="setting-info">' +
              '<label>Enable Approval Workflow</label>' +
              '<span class="setting-desc">When turned on, task owners can trigger an approval before marking tasks done. A "Request Approval" button will appear on all tasks in this group.</span>' +
            '</div>' +
            '<label class="toggle-switch">' +
              '<input type="checkbox" id="approvalEnabled" ' + (settings.enabled ? 'checked' : '') + '>' +
              '<span class="toggle-slider"></span>' +
            '</label>' +
          '</div>' +
        '</div>' +
        '<div class="approval-settings-divider"></div>' +
        '<div class="approval-setting-block" id="mandateBlock" ' + mandateDisplay + '>' +
          '<div class="approval-setting-row">' +
            '<div class="setting-info">' +
              '<label>Mandate Approval</label>' +
              '<span class="setting-desc">Tasks cannot be moved to "Complete" or closed until an active approval has been granted. The system will block status changes.</span>' +
            '</div>' +
            '<label class="toggle-switch">' +
              '<input type="checkbox" id="mandateApproval" ' + (settings.mandateApproval ? 'checked' : '') + '>' +
              '<span class="toggle-slider"></span>' +
            '</label>' +
          '</div>' +
        '</div>' +
        '<div class="approval-settings-divider" id="mandateDivider" ' + mandateDisplay + '></div>' +
        '<div class="approval-setting-block" id="approverBlock" ' + approverDisplay + '>' +
          '<div class="setting-info" style="margin-bottom:12px">' +
            '<label><strong>Default Approver</strong></label>' +
            '<span class="setting-desc">Leave blank to let the task owner choose the approver when triggering the request.</span>' +
          '</div>' +
          '<div class="approver-dropdown-wrap">' +
            '<select id="defaultApprover" class="approver-select">' +
              '<option value="">Select a member or role...</option>' +
            '</select>' +
          '</div>' +
          '<div id="approverDeletedWarning" class="approver-warning" style="display:none">' +
            '<i class="fa-solid fa-triangle-exclamation"></i>' +
            '<span>The previously assigned default approver was removed. Requests are now routing to the Group Admin.</span>' +
          '</div>' +
        '</div>';

      // Populate approver dropdown
      ApprovalWorkflow.getAvailableApprovers(groupId).then(members => {
        const select = container.querySelector('#defaultApprover');
        members.filter(m => m.name !== 'System').forEach(m => {
          const opt = document.createElement('option');
          opt.value = m.name;
          opt.textContent = m.name + ' (' + m.role + ')';
          if (settings.defaultApprover === m.name) opt.selected = true;
          select.appendChild(opt);
        });
      });

      // Show deleted approver warning
      if (settings._approverDeleted) {
        setTimeout(() => {
          const warn = container.querySelector('#approverDeletedWarning');
          if (warn) warn.style.display = '';
        }, 100);
      }

      // Toggle enable
      container.querySelector('#approvalEnabled').addEventListener('change', async function() {
        settings.enabled = this.checked;
        await ApprovalWorkflow.Settings.save(settings);
        const mandate = container.querySelector('#mandateBlock');
        const mandateDiv = container.querySelector('#mandateDivider');
        const approver = container.querySelector('#approverBlock');
        if (this.checked) {
          if (mandate) mandate.style.display = '';
          if (mandateDiv) mandateDiv.style.display = '';
          if (approver) approver.style.display = '';
        } else {
          if (mandate) mandate.style.display = 'none';
          if (mandateDiv) mandateDiv.style.display = 'none';
          if (approver) approver.style.display = 'none';
        }
        showToast(this.checked ? 'Approval workflow enabled' : 'Approval workflow disabled');
      });

      container.querySelector('#mandateApproval').addEventListener('change', async function() {
        settings.mandateApproval = this.checked;
        await ApprovalWorkflow.Settings.save(settings);
        showToast(this.checked ? 'Mandate approval enabled' : 'Mandate approval disabled');
      });

      container.querySelector('#defaultApprover').addEventListener('change', async function() {
        settings.defaultApprover = this.value || null;
        settings._approverDeleted = false;
        await ApprovalWorkflow.Settings.save(settings);
        const warn = container.querySelector('#approverDeletedWarning');
        if (warn) warn.style.display = 'none';
        showToast(this.value ? 'Default approver set to ' + this.value : 'Default approver cleared');
      });

      return container;
    });
  }

  /* ════════════════════════════════
     REQUEST APPROVAL BUTTON / STATUS BANNER
     Matches reference images: button in header, banners below header
     ════════════════════════════════ */
  function renderRequestButton(task, groupId) {
    const container = document.createElement('div');
    container.className = 'approval-request-section';

    ApprovalWorkflow.Settings.isEnabled(groupId).then(async enabled => {
      if (!enabled) return;

      const canRequest = ApprovalWorkflow.canRequestApproval(task, CURRENT_USER);
      const activeRequest = await ApprovalWorkflow.Requests.getActiveForTask(task.id);
      const allRequests = await ApprovalWorkflow.Requests.getAllForTask(task.id);
      const latestRequest = allRequests.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
      const isAdmin = await ApprovalWorkflow.isGroupAdmin(groupId, CURRENT_USER);

      if (activeRequest) {
        const isApprover = activeRequest.approverId === CURRENT_USER;

        /* Status banner below header - matching reference image 3 (Approval Pending) */
        container.innerHTML =
          '<div class="approval-status-strip pending">' +
            '<span class="approval-status-strip-text">' +
              '<i class="fa-solid fa-clock"></i> Approval Pending' +
            '</span>' +
          '</div>';

        /* Header badge: "Approval Requested" in task header */
        injectHeaderBadge('pending');

        /* Approver decision panel */
        if (isApprover) {
          container.appendChild(renderDecisionInterface(activeRequest));
        }

        /* Admin abort button */
        if (isAdmin && !isApprover) {
          const abortBtn = document.createElement('button');
          abortBtn.className = 'approval-btn abort-btn';
          abortBtn.innerHTML = '<i class="fa-solid fa-ban"></i> Abort Approval';
          abortBtn.title = 'Admin: Cancel this approval request';
          abortBtn.addEventListener('click', () => showAbortModal(activeRequest));
          container.appendChild(abortBtn);
        }
      } else if (latestRequest && latestRequest.status === 'approved') {
        /* Status banner - matching reference image 2 (Approved - green strip) */
        container.innerHTML =
          '<div class="approval-status-strip approved">' +
            '<span class="approval-status-strip-text">' +
              '<i class="fa-solid fa-circle-check"></i> Approved' +
            '</span>' +
          '</div>';

        injectHeaderBadge('approved');
      } else if (latestRequest && latestRequest.status === 'changes_requested') {
        container.innerHTML =
          '<div class="approval-status-strip changes-requested">' +
            '<span class="approval-status-strip-text">' +
              '<i class="fa-solid fa-rotate-left"></i> Changes Requested' +
            '</span>' +
          '</div>';

        injectHeaderBadge('changes');

        if (canRequest) {
          const resubmitBtn = document.createElement('button');
          resubmitBtn.className = 'approval-btn resubmit';
          resubmitBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Resubmit for Approval';
          resubmitBtn.addEventListener('click', () => showResubmitModal(latestRequest));
          container.appendChild(resubmitBtn);
        }
      } else if (canRequest) {
        /* "Request Approval" button in task header (PRD: prominent in header) */
        injectHeaderButton(task, groupId);
      }
    });

    return container;
  }

  /* Inject "Request Approval" button into task detail header - matches reference image 1 */
  function injectHeaderButton(task, groupId) {
    const headerRight = document.querySelector('.detail-header-right');
    if (!headerRight) return;

    let existing = headerRight.querySelector('.request-approval-header-btn');
    if (existing) existing.remove();
    let oldBadge = headerRight.querySelector('.approval-header-badge');
    if (oldBadge) oldBadge.remove();

    const btn = document.createElement('button');
    btn.className = 'request-approval-header-btn';
    btn.innerHTML = 'Request Approval';
    btn.addEventListener('click', () => showRequestModal(task, groupId));

    /* Insert before the icon buttons (recurrence, attachment, etc.) */
    headerRight.insertBefore(btn, headerRight.firstChild);
  }

  /* Inject status badge into task detail header - matches reference images 2 & 3 */
  function injectHeaderBadge(type) {
    const headerRight = document.querySelector('.detail-header-right');
    if (!headerRight) return;

    let existing = headerRight.querySelector('.approval-header-badge');
    if (existing) existing.remove();
    let btn = headerRight.querySelector('.request-approval-header-btn');
    if (btn) btn.remove();

    const badge = document.createElement('span');
    badge.className = 'approval-header-badge ' + type;

    if (type === 'pending') {
      badge.innerHTML = 'Approval  Requested';
    } else if (type === 'approved') {
      badge.innerHTML = 'Approval  Requested';
    } else {
      badge.innerHTML = 'Changes  Requested';
    }

    headerRight.insertBefore(badge, headerRight.firstChild);
  }

  /* ════════════════════════════════
     APPROVER DECISION INTERFACE
     ════════════════════════════════ */
  function renderDecisionInterface(request) {
    const container = document.createElement('div');
    container.className = 'approval-decision-panel';
    container.innerHTML =
      '<h4><i class="fa-solid fa-gavel"></i> Your Decision Required</h4>' +
      (request.note ? '<div class="decision-note"><strong>Context from requester:</strong> ' + request.note + '</div>' : '') +
      '<div class="decision-actions">' +
        '<button class="decision-btn approve" data-action="approve"><i class="fa-solid fa-check"></i> Approve</button>' +
        '<button class="decision-btn reject" data-action="reject"><i class="fa-solid fa-xmark"></i> Reject</button>' +
        '<button class="decision-btn changes" data-action="changes"><i class="fa-solid fa-pen"></i> Request Changes</button>' +
      '</div>';

    container.querySelector('[data-action="approve"]').addEventListener('click', () => {
      showApproveModal(request);
    });
    container.querySelector('[data-action="reject"]').addEventListener('click', () => {
      showRejectModal(request);
    });
    container.querySelector('[data-action="changes"]').addEventListener('click', () => {
      showChangesModal(request);
    });

    return container;
  }

  /* ════════════════════════════════
     FIELD LOCKING (Task State)
     ════════════════════════════════ */
  function applyFieldLocks(taskDetailPanel, taskId) {
    ApprovalWorkflow.TaskLock.getLockInfo(taskId).then(lockInfo => {
      // Remove existing lock visuals
      taskDetailPanel.querySelectorAll('.field-lock-indicator').forEach(el => el.remove());
      taskDetailPanel.querySelectorAll('.field-locked').forEach(el => el.classList.remove('field-locked'));
      const existingBanner = taskDetailPanel.querySelector('.task-lock-banner');
      if (existingBanner) existingBanner.remove();

      if (!lockInfo.locked) return;

      const isApprover = lockInfo.approverId === CURRENT_USER;

      // Lock banner
      const banner = document.createElement('div');
      banner.className = 'task-lock-banner';
      banner.innerHTML =
        '<i class="fa-solid fa-lock"></i>' +
        '<span>Task fields locked \u2014 Pending approval from <strong>' + lockInfo.approverId + '</strong></span>';
      if (isApprover) {
        banner.innerHTML += '<span class="approver-badge">You are the approver</span>';
      }

      const detailBody = taskDetailPanel.querySelector('.detail-body');
      if (detailBody) detailBody.insertBefore(banner, detailBody.firstChild);

      // Lock individual fields if not approver
      if (!isApprover) {
        const titleEl = taskDetailPanel.querySelector('#detailTaskTitle');
        if (titleEl) {
          titleEl.classList.add('field-locked');
          titleEl.setAttribute('contenteditable', 'false');
        }
        const statusBtn = taskDetailPanel.querySelector('#detailStatusBtn');
        if (statusBtn) statusBtn.classList.add('field-locked');
        const priorityBtn = taskDetailPanel.querySelector('#detailPriority');
        if (priorityBtn) priorityBtn.classList.add('field-locked');
        const assigneeEl = taskDetailPanel.querySelector('#detailAssigneeName');
        if (assigneeEl) assigneeEl.classList.add('field-locked');
        const dueDateEl = taskDetailPanel.querySelector('#detailDueDate');
        if (dueDateEl) dueDateEl.classList.add('field-locked');
        const startDateEl = taskDetailPanel.querySelector('#detailStartDate');
        if (startDateEl) startDateEl.classList.add('field-locked');
      }
    });
  }

  /* ════════════════════════════════
     AUDIT TRAIL TIMELINE
     ════════════════════════════════ */
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
          '<h4>Approval Timeline</h4>' +
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
            '<div class="audit-timestamp">' + formatTimestampUTC(log.timestamp) + '</div>' +
          '</div>';
        timeline.appendChild(item);
      });

      container.appendChild(timeline);
    });

    return container;
  }

  /* ════════════════════════════════
     MODAL: Request Approval (PRD §2)
     ════════════════════════════════ */
  function showRequestModal(task, groupId) {
    const overlay = createModal('request-approval-modal');
    const modal = overlay.querySelector('.modal-content');

    modal.innerHTML =
      '<div class="modal-header">' +
        '<h3>Request Approval</h3>' +
        '<button class="modal-close">&times;</button>' +
      '</div>' +
      '<div class="modal-body">' +
        '<div class="form-group">' +
          '<label class="form-label">Send to</label>' +
          '<select id="modalApprover" class="form-select approver-field"></select>' +
        '</div>' +
        '<div class="form-group">' +
          '<label class="form-label">Note (Optional)</label>' +
          '<textarea id="modalNote" class="form-textarea" maxlength="500" rows="4" placeholder="Add context for the approver..."></textarea>' +
          '<div class="char-counter"><span id="noteCharCount">0</span> / 500</div>' +
        '</div>' +
        '<div class="lock-info-banner">' +
          '<i class="fa-solid fa-lock"></i>' +
          '<span>Task fields will be locked while the approval is pending.</span>' +
        '</div>' +
      '</div>' +
      '<div class="modal-footer">' +
        '<button class="btn-cancel">Cancel</button>' +
        '<button class="btn-submit">Submit Request</button>' +
      '</div>';

    // Populate approver dropdown
    ApprovalWorkflow.getAvailableApprovers(groupId).then(async members => {
      const select = modal.querySelector('#modalApprover');
      const settings = await ApprovalWorkflow.Settings.get(groupId);
      members.filter(m => m.name !== CURRENT_USER).forEach(m => {
        const opt = document.createElement('option');
        opt.value = m.name;
        const isDefault = settings.defaultApprover === m.name;
        opt.textContent = m.name + (isDefault ? ' (Default)' : '');
        if (isDefault) opt.selected = true;
        select.appendChild(opt);
      });
    });

    // Character counter
    modal.querySelector('#modalNote').addEventListener('input', function() {
      modal.querySelector('#noteCharCount').textContent = this.value.length;
    });

    // Submit
    modal.querySelector('.btn-submit').addEventListener('click', async () => {
      const approverId = modal.querySelector('#modalApprover').value;
      const note = modal.querySelector('#modalNote').value;
      if (!approverId) {
        showToast('Please select an approver', 'error');
        return;
      }
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
      } catch (e) {
        showToast(e.message, 'error');
      }
    });

    modal.querySelector('.btn-cancel').addEventListener('click', () => closeModal(overlay));
    modal.querySelector('.modal-close').addEventListener('click', () => closeModal(overlay));
  }

  /* ════════════════════════════════
     MODAL: Approve
     ════════════════════════════════ */
  function showApproveModal(request) {
    const overlay = createModal('approve-modal');
    const modal = overlay.querySelector('.modal-content');

    modal.innerHTML =
      '<div class="modal-header approve-header">' +
        '<h3><i class="fa-solid fa-check-circle"></i> Approve Task</h3>' +
        '<button class="modal-close">&times;</button>' +
      '</div>' +
      '<div class="modal-body">' +
        '<div class="form-group">' +
          '<label class="form-label">Approval Note (Optional)</label>' +
          '<textarea id="approveNote" class="form-textarea" rows="3" placeholder="Add a note..."></textarea>' +
        '</div>' +
      '</div>' +
      '<div class="modal-footer">' +
        '<button class="btn-cancel">Cancel</button>' +
        '<button class="btn-approve-submit"><i class="fa-solid fa-check"></i> Approve</button>' +
      '</div>';

    modal.querySelector('.btn-approve-submit').addEventListener('click', async () => {
      const note = modal.querySelector('#approveNote').value;
      try {
        await ApprovalWorkflow.Requests.approve({
          requestId: request.id,
          approverId: CURRENT_USER,
          note
        });
        closeModal(overlay);
        showToast('Task approved!', 'success');
        refreshTaskDetail(request.taskId);
      } catch (e) {
        showToast(e.message, 'error');
      }
    });

    modal.querySelector('.btn-cancel').addEventListener('click', () => closeModal(overlay));
    modal.querySelector('.modal-close').addEventListener('click', () => closeModal(overlay));
  }

  /* ════════════════════════════════
     MODAL: Reject (PRD §3 - category + explanation)
     ════════════════════════════════ */
  function showRejectModal(request) {
    const overlay = createModal('reject-approval-modal');
    const modal = overlay.querySelector('.modal-content');

    modal.innerHTML =
      '<div class="modal-header reject-header">' +
        '<h3><i class="fa-solid fa-xmark"></i> Reject Request</h3>' +
        '<button class="modal-close">&times;</button>' +
      '</div>' +
      '<div class="modal-body">' +
        '<div class="form-group">' +
          '<label class="form-label">Rejection Category <span class="required">*</span></label>' +
          '<select id="rejectCategory" class="form-select" required>' +
            '<option value="">Select a category...</option>' +
            ApprovalWorkflow.REJECTION_CATEGORIES.map(c => '<option value="' + c + '">' + c + '</option>').join('') +
          '</select>' +
        '</div>' +
        '<div class="form-group">' +
          '<label class="form-label">Explanation <span class="required">*</span> <span class="char-count-inline">(<span id="rejectCharCount">0</span>/1000)</span></label>' +
          '<textarea id="rejectReason" class="form-textarea" rows="4" maxlength="1000" required placeholder="Provide a reason for rejection..."></textarea>' +
        '</div>' +
      '</div>' +
      '<div class="modal-footer">' +
        '<button class="btn-cancel">Cancel</button>' +
        '<button class="btn-reject"><i class="fa-solid fa-xmark"></i> Reject</button>' +
      '</div>';

    modal.querySelector('#rejectReason').addEventListener('input', function() {
      modal.querySelector('#rejectCharCount').textContent = this.value.length;
    });

    modal.querySelector('.btn-reject').addEventListener('click', async () => {
      const category = modal.querySelector('#rejectCategory').value;
      const reason = modal.querySelector('#rejectReason').value;
      if (!category) { showToast('Please select a category', 'error'); return; }
      if (!reason) { showToast('Please provide a reason', 'error'); return; }
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
      } catch (e) {
        showToast(e.message, 'error');
      }
    });

    modal.querySelector('.btn-cancel').addEventListener('click', () => closeModal(overlay));
    modal.querySelector('.modal-close').addEventListener('click', () => closeModal(overlay));
  }

  /* ════════════════════════════════
     MODAL: Request Changes (PRD §3)
     ════════════════════════════════ */
  function showChangesModal(request) {
    const overlay = createModal('changes-approval-modal');
    const modal = overlay.querySelector('.modal-content');

    modal.innerHTML =
      '<div class="modal-header changes-header">' +
        '<h3><i class="fa-solid fa-pen"></i> Request Changes</h3>' +
        '<button class="modal-close">&times;</button>' +
      '</div>' +
      '<div class="modal-body">' +
        '<div class="form-group">' +
          '<label class="form-label">Feedback Note <span class="required">*</span></label>' +
          '<textarea id="changesFeedback" class="form-textarea" rows="4" maxlength="1000" required placeholder="Describe what changes are needed..."></textarea>' +
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
      } catch (e) {
        showToast(e.message, 'error');
      }
    });

    modal.querySelector('.btn-cancel').addEventListener('click', () => closeModal(overlay));
    modal.querySelector('.modal-close').addEventListener('click', () => closeModal(overlay));
  }

  /* ════════════════════════════════
     MODAL: Resubmit
     ════════════════════════════════ */
  function showResubmitModal(request) {
    const overlay = createModal('resubmit-modal');
    const modal = overlay.querySelector('.modal-content');

    modal.innerHTML =
      '<div class="modal-header">' +
        '<h3><i class="fa-solid fa-paper-plane"></i> Resubmit for Approval</h3>' +
        '<button class="modal-close">&times;</button>' +
      '</div>' +
      '<div class="modal-body">' +
        '<div class="form-group">' +
          '<label class="form-label">Note about changes made</label>' +
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
      } catch (e) {
        showToast(e.message, 'error');
      }
    });

    modal.querySelector('.btn-cancel').addEventListener('click', () => closeModal(overlay));
    modal.querySelector('.modal-close').addEventListener('click', () => closeModal(overlay));
  }

  /* ════════════════════════════════
     MODAL: Admin Abort (PRD §4)
     ════════════════════════════════ */
  function showAbortModal(request) {
    const overlay = createModal('abort-modal');
    const modal = overlay.querySelector('.modal-content');

    modal.innerHTML =
      '<div class="modal-header abort-header">' +
        '<h3><i class="fa-solid fa-ban"></i> Abort Approval</h3>' +
        '<button class="modal-close">&times;</button>' +
      '</div>' +
      '<div class="modal-body">' +
        '<p class="abort-warning-text">This will cancel the pending approval request. This action is reserved for Group Admins in exceptional cases.</p>' +
        '<div class="form-group">' +
          '<label class="form-label">Reason (Optional)</label>' +
          '<textarea id="abortReason" class="form-textarea" rows="3" placeholder="Reason for aborting..."></textarea>' +
        '</div>' +
      '</div>' +
      '<div class="modal-footer">' +
        '<button class="btn-cancel">Cancel</button>' +
        '<button class="btn-abort"><i class="fa-solid fa-ban"></i> Abort Approval</button>' +
      '</div>';

    modal.querySelector('.btn-abort').addEventListener('click', async () => {
      const reason = modal.querySelector('#abortReason').value;
      try {
        await ApprovalWorkflow.Requests.abort({
          requestId: request.id,
          adminId: CURRENT_USER,
          reason
        });
        closeModal(overlay);
        showToast('Approval aborted', 'warning');
        refreshTaskDetail(request.taskId);
      } catch (e) {
        showToast(e.message, 'error');
      }
    });

    modal.querySelector('.btn-cancel').addEventListener('click', () => closeModal(overlay));
    modal.querySelector('.modal-close').addEventListener('click', () => closeModal(overlay));
  }

  /* ════════════════════════════════
     NOTIFICATION BELL
     ════════════════════════════════ */
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
        list.innerHTML = notifs.slice(-20).reverse().map(n =>
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
      ApprovalWorkflow.Notifications.getUnread(CURRENT_USER).forEach(n => {
        ApprovalWorkflow.Notifications.markRead(n.id);
      });
      updateBadge();
    });

    document.addEventListener('click', () => {
      dropdown.style.display = 'none';
    });

    ApprovalWorkflow.on('approval:notification:new', () => updateBadge());
    updateBadge();

    return container;
  }

  /* ════════════════════════════════
     TASK CARD BADGE
     ════════════════════════════════ */
  function addApprovalBadgeToCard(cardElement, taskId) {
    ApprovalWorkflow.Requests.getActiveForTask(taskId).then(active => {
      if (active) {
        const badge = document.createElement('div');
        badge.className = 'card-approval-badge pending';
        badge.innerHTML = '<i class="fa-solid fa-lock"></i> Pending Approval';
        cardElement.appendChild(badge);
        return;
      }
      ApprovalWorkflow.Requests.getAllForTask(taskId).then(all => {
        const latest = all.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
        if (latest && latest.status === 'approved') {
          const badge = document.createElement('div');
          badge.className = 'card-approval-badge approved';
          badge.innerHTML = '<i class="fa-solid fa-circle-check"></i> Approved';
          cardElement.appendChild(badge);
        }
      });
    });
  }

  /* ════════════════════════════════
     HELPER FUNCTIONS
     ════════════════════════════════ */
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
      d.getHours().toString().padStart(2,'0') + ':' + d.getMinutes().toString().padStart(2,'0');
  }

  function formatTimestampUTC(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return d.getUTCDate() + ' ' + months[d.getUTCMonth()] + ' ' + d.getUTCFullYear() + ', ' +
      d.getUTCHours().toString().padStart(2,'0') + ':' + d.getUTCMinutes().toString().padStart(2,'0') + ' UTC';
  }

  function formatActionType(type) {
    const map = {
      approval_requested: 'requested approval',
      approved: 'approved the task',
      rejected: 'rejected the request',
      changes_requested: 'requested changes',
      resubmitted: 'resubmitted for approval',
      settings_updated: 'updated approval settings',
      aborted: 'aborted the approval'
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
      settings_updated: '<i class="fa-solid fa-gear"></i>',
      aborted: '<i class="fa-solid fa-ban"></i>'
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
    return {
      success: 'fa-check-circle',
      error: 'fa-exclamation-circle',
      warning: 'fa-exclamation-triangle',
      info: 'fa-info-circle'
    }[type] || 'fa-info-circle';
  }

  function refreshTaskDetail(taskId) {
    ApprovalWorkflow.emit('approval:ui:refresh', { taskId });
  }

  /* ════════════════════════════════
     INITIALIZATION
     ════════════════════════════════ */
  async function init() {
    await ApprovalWorkflow.init();

    // Inject notification bell
    const headerRight = document.querySelector('.header-right');
    if (headerRight) {
      const bell = renderNotificationBell();
      headerRight.insertBefore(bell, headerRight.firstChild);
    }

    // Listen for task detail refresh
    ApprovalWorkflow.on('approval:ui:refresh', async (data) => {
      const panel = document.getElementById('taskDetailPanel');
      if (!panel) return;

      // Clean old approval sections
      panel.querySelectorAll('.approval-request-section, .approval-audit-trail, .approval-decision-panel, .task-lock-banner').forEach(el => el.remove());
      const oldHeaderBtn = document.querySelector('.request-approval-header-btn');
      if (oldHeaderBtn) oldHeaderBtn.remove();
      const oldBadge = document.querySelector('.approval-header-badge');
      if (oldBadge) oldBadge.remove();
      // Remove old status strips
      panel.querySelectorAll('.approval-status-strip').forEach(el => el.remove());

      try {
        const task = await ShadowDB.Tasks.getById(data.taskId);
        if (!task) return;

        const groupId = task.group || 1;

        // Insert approval request/status section
        const requestSection = renderRequestButton(task, groupId);

        // Insert as first child of detail-body (status strip goes below header)
        const detailBody = panel.querySelector('.detail-body');
        if (detailBody) {
          detailBody.insertBefore(requestSection, detailBody.firstChild);
        }

        // Insert audit trail before timeline
        const timelineSection = panel.querySelector('#timelineList');
        if (timelineSection && timelineSection.parentNode) {
          const auditTrail = renderAuditTrail(task.id);
          timelineSection.parentNode.insertBefore(auditTrail, timelineSection);
        }

        // Apply field locks
        applyFieldLocks(panel, task.id);
      } catch (e) {
        console.error('[ApprovalUI] Error refreshing:', e);
      }
    });

    console.log('[ApprovalUI] Initialized');
  }

  /* ════════════════════════════════
     PUBLIC API
     ════════════════════════════════ */
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
