/**
 * Shadow ToDo - Workflow UI Logic
 * Handles the visual rule builder, template gallery, logs viewer, and AI prompt interface
 */
(function() {
  'use strict';

  let currentTab = 'rules';
  let editingRuleId = null;
  let currentRule = { trigger: { type: null, config: {} }, conditions: [], conditionLogic: 'AND', actions: [] };

  // ===== INITIALIZATION =====
  async function init() {
    await ShadowDB.init();
    await WorkflowEngine.init();
    populateTriggerOptions();
    renderRules();
    renderTemplates();
    renderLogs();
    setupEventListeners();
    console.log('Workflow UI initialized');
  }

  // ===== TAB NAVIGATION =====
  function showTab(tab) {
    currentTab = tab;
    document.querySelectorAll('.wf-tab-content').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.wf-sidebar-item[data-tab]').forEach(el => el.classList.remove('active'));

    const tabMap = { rules: 'tabRules', templates: 'tabTemplates', logs: 'tabLogs', ai: 'tabAi', builder: 'ruleBuilder' };
    const el = document.getElementById(tabMap[tab]);
    if (el) el.style.display = '';

    const sideItem = document.querySelector('.wf-sidebar-item[data-tab="' + tab + '"]');
    if (sideItem) sideItem.classList.add('active');

    if (tab === 'rules') renderRules();
    if (tab === 'logs') renderLogs();
  }
  window.showTab = showTab;

  // ===== RENDER RULES LIST =====
  function renderRules(filter) {
    let rules = WorkflowEngine.getAllRules();
    if (filter && filter !== 'all') rules = rules.filter(r => r.state === filter);

    const grid = document.getElementById('rulesGrid');
    const empty = document.getElementById('rulesEmpty');
    document.getElementById('rulesCount').textContent = rules.length;

    if (rules.length === 0) {
      grid.style.display = 'none';
      empty.style.display = '';
      return;
    }

    grid.style.display = '';
    empty.style.display = 'none';

    grid.innerHTML = rules.map(r => {
      const trigger = Object.values(WorkflowEngine.TriggerTypes).find(t => t.id === r.trigger.type);
      const stateClass = r.state === 'published' ? 'published' : r.state === 'testing' ? 'testing' : r.state === 'disabled' ? 'disabled' : '';
      return '<div class="wf-rule-card" data-rule-id="' + r.id + '">' +
        '<div class="wf-rule-toggle"><label class="toggle-switch"><input type="checkbox" ' + (r.state === 'published' ? 'checked' : '') + ' data-toggle="' + r.id + '"><span class="toggle-slider"></span></label></div>' +
        '<div class="rule-name">' + r.name + '</div>' +
        '<div class="rule-desc">' + (r.description || 'No description') + '</div>' +
        '<div class="rule-meta">' +
          '<span class="wf-rule-badge trigger"><i class="fa-solid ' + (trigger ? trigger.icon : 'fa-bolt') + '"></i> ' + (trigger ? trigger.label : r.trigger.type) + '</span>' +
          '<span class="wf-rule-badge actions"><i class="fa-solid fa-play"></i> ' + r.actions.length + ' action' + (r.actions.length !== 1 ? 's' : '') + '</span>' +
          '<span class="wf-rule-badge state ' + stateClass + '">' + r.state + '</span>' +
        '</div>' +
        '<div class="rule-stats"><span><i class="fa-solid fa-play"></i> ' + (r.executionCount || 0) + ' runs</span>' +
          (r.lastExecutedAt ? '<span><i class="fa-regular fa-clock"></i> ' + new Date(r.lastExecutedAt).toLocaleString() + '</span>' : '') +
        '</div>' +
      '</div>';
    }).join('');
  }

  // ===== RENDER TEMPLATES =====
  function renderTemplates() {
    const grid = document.getElementById('templatesGrid');
    grid.innerHTML = WorkflowEngine.Templates.map(t =>
      '<div class="wf-template-card" data-template="' + t.id + '">' +
        '<div class="wf-template-icon"><i class="fa-solid ' + t.icon + '"></i></div>' +
        '<div class="wf-template-name">' + t.name + '</div>' +
        '<div class="wf-template-desc">' + t.description + '</div>' +
        '<span class="wf-template-category">' + t.category + '</span>' +
      '</div>'
    ).join('');
  }

  // ===== RENDER LOGS =====
  function renderLogs() {
    const logs = WorkflowEngine.getRecentLogs(100);
    const body = document.getElementById('logsBody');
    const empty = document.getElementById('logsEmpty');

    if (logs.length === 0) {
      body.innerHTML = '';
      empty.style.display = '';
      return;
    }

    empty.style.display = 'none';
    body.innerHTML = logs.map(l => {
      const cls = l.dryRun ? 'log-dry' : l.success ? 'log-success' : !l.conditionsMet ? 'log-skip' : 'log-fail';
      const icon = l.dryRun ? 'fa-flask' : l.success ? 'fa-circle-check' : !l.conditionsMet ? 'fa-forward' : 'fa-circle-xmark';
      const details = l.dryRun ? 'Dry Run' : l.actions.map(a => a.details).join('; ') || l.details || '';
      return '<tr>' +
        '<td>' + new Date(l.timestamp).toLocaleString() + '</td>' +
        '<td>' + l.ruleName + '</td>' +
        '<td>' + (l.taskTitle || 'Task #' + l.taskId) + '</td>' +
        '<td>' + (l.triggeredBy || '-') + '</td>' +
        '<td class="' + cls + '"><i class="fa-solid ' + icon + '"></i> ' + (l.dryRun ? 'Dry Run' : l.success ? 'Success' : !l.conditionsMet ? 'Skipped' : 'Failed') + '</td>' +
        '<td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="' + details + '">' + details + '</td>' +
      '</tr>';
    }).join('');
  }

  // ===== POPULATE TRIGGER DROPDOWN =====
  function populateTriggerOptions() {
    const sel = document.getElementById('triggerType');
    Object.values(WorkflowEngine.TriggerTypes).forEach(t => {
      const opt = document.createElement('option');
      opt.value = t.id;
      opt.textContent = t.label + ' - ' + t.description;
      sel.appendChild(opt);
    });
  }

  // ===== RULE BUILDER =====
  function openRuleBuilder(ruleData, ruleId) {
    // Normalize: accept both legacy shape (trigger.type, cond.field, action.type)
    // and builder shape (trigger.typeId, cond.fieldId, action.typeId) from AI / drag-builder.
    var rd = ruleData || null;
    var normTrigger = { type: null, config: {} };
    var normConditions = [];
    var normActions = [];
    var normLogic = 'AND';
    var normName = '';
    if (rd) {
      if (rd.trigger) {
        normTrigger.type = rd.trigger.type || rd.trigger.typeId || null;
        normTrigger.config = rd.trigger.config || {};
      }
      (rd.conditions || []).forEach(function(c){
        normConditions.push({
          field: c.field || c.fieldId || 'status',
          operator: c.operator || 'equals',
          value: c.value != null ? c.value : ''
        });
      });
      (rd.actions || []).forEach(function(a){
        normActions.push({
          type: a.type || a.typeId,
          params: a.params || getDefaultParams(a.type || a.typeId)
        });
      });
      normLogic = rd.conditionLogic || 'AND';
      normName = rd.name || '';
    }
    editingRuleId = ruleId || (rd && rd.id) || null;
    currentRule = {
      trigger: normTrigger,
      conditions: normConditions,
      conditionLogic: normLogic,
      actions: normActions
    };

    document.getElementById('ruleName').value = normName;
    document.getElementById('triggerType').value = currentRule.trigger.type || '';
    renderTriggerConfig();
    renderConditions();
    renderActions();
    updateConditionLogicUI();
    showTab('builder');
  }

  function renderTriggerConfig() {
    const container = document.getElementById('triggerConfig');
    container.innerHTML = '';
    if (currentRule.trigger.type === 'due_date_approaching') {
      container.innerHTML = '<label style="font-size:12px;color:var(--text-secondary)">Days before due:</label>' +
        '<input type="number" id="triggerDays" value="' + (currentRule.trigger.config.daysBeforeDue || 2) + '" min="1" max="30" style="width:80px">';
    }
  }

  function renderConditions() {
    const list = document.getElementById('conditionsList');
    list.innerHTML = currentRule.conditions.map((c, i) => {
      const fieldOpts = Object.entries(WorkflowEngine.TaskFields).map(([k, v]) =>
        '<option value="' + k + '"' + (c.field === k ? ' selected' : '') + '>' + v.label + '</option>'
      ).join('');
      const opOpts = Object.values(WorkflowEngine.ConditionOperators).map(op =>
        '<option value="' + op.id + '"' + (c.operator === op.id ? ' selected' : '') + '>' + op.label + '</option>'
      ).join('');
      return '<div class="condition-row" data-index="' + i + '">' +
        '<select class="cond-field" data-idx="' + i + '">' + fieldOpts + '</select>' +
        '<select class="cond-op" data-idx="' + i + '">' + opOpts + '</select>' +
        '<input type="text" class="cond-val" data-idx="' + i + '" value="' + (c.value || '') + '" placeholder="Value">' +
        '<button class="remove-btn" data-remove-cond="' + i + '" title="Remove"><i class="fa-solid fa-xmark"></i></button>' +
      '</div>';
    }).join('');
  }

  function renderActions() {
    const list = document.getElementById('actionsList');
    list.innerHTML = currentRule.actions.map((a, i) => {
      const typeOpts = Object.values(WorkflowEngine.ActionTypes).map(at =>
        '<option value="' + at.id + '"' + (a.type === at.id ? ' selected' : '') + '>' + at.label + '</option>'
      ).join('');
      let paramsHtml = '';
      if (a.params) {
        Object.entries(a.params).forEach(([k, v]) => {
          paramsHtml += '<div style="display:flex;gap:4px;align-items:center;margin-top:4px;">' +
            '<label style="font-size:11px;color:var(--text-muted);min-width:60px">' + k + ':</label>' +
            '<input type="text" class="action-param" data-action="' + i + '" data-param="' + k + '" value="' + (v || '') + '" style="flex:1">' +
          '</div>';
        });
      }
      return '<div class="wf-step" style="margin-bottom:8px;padding:12px;" data-action-idx="' + i + '">' +
        '<div style="display:flex;justify-content:space-between;align-items:center">' +
          '<select class="action-type" data-idx="' + i + '" style="flex:1">' + typeOpts + '</select>' +
          '<button class="remove-btn" data-remove-action="' + i + '" title="Remove"><i class="fa-solid fa-xmark"></i></button>' +
        '</div>' +
        '<div class="action-params" data-action="' + i + '">' + paramsHtml + '</div>' +
      '</div>';
    }).join('');
  }

  function updateConditionLogicUI() {
    document.querySelectorAll('.condition-logic button').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.logic === currentRule.conditionLogic);
    });
  }

  function collectRuleData() {
    // Collect conditions from UI
    currentRule.conditions = [];
    document.querySelectorAll('.condition-row').forEach((row, i) => {
      currentRule.conditions.push({
        field: row.querySelector('.cond-field').value,
        operator: row.querySelector('.cond-op').value,
        value: row.querySelector('.cond-val').value
      });
    });
    // Collect action params from UI
    document.querySelectorAll('.action-param').forEach(input => {
      const actionIdx = parseInt(input.dataset.action);
      const paramKey = input.dataset.param;
      if (currentRule.actions[actionIdx]) {
        if (!currentRule.actions[actionIdx].params) currentRule.actions[actionIdx].params = {};
        currentRule.actions[actionIdx].params[paramKey] = input.value;
      }
    });
    // Trigger config
    const triggerDays = document.getElementById('triggerDays');
    if (triggerDays) currentRule.trigger.config.daysBeforeDue = parseInt(triggerDays.value);

    return {
      name: document.getElementById('ruleName').value || 'Untitled Rule',
      trigger: currentRule.trigger,
      conditions: currentRule.conditions,
      conditionLogic: currentRule.conditionLogic,
      actions: currentRule.actions
    };
  }

  // ===== TOAST NOTIFICATIONS =====
  function showToast(message, type) {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = 'wf-toast ' + (type || 'info');
    const icon = type === 'success' ? 'fa-circle-check' : type === 'error' ? 'fa-circle-xmark' : 'fa-circle-info';
    toast.innerHTML = '<i class="fa-solid ' + icon + '" style="font-size:18px"></i><span>' + message + '</span>';
    container.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 4000);
  }

  // ===== ACTION PARAM DEFAULTS =====
  function getDefaultParams(actionType) {
    switch(actionType) {
      case 'assign_task': return { assignee: '' };
      case 'change_status': return { status: 'In Progress' };
      case 'set_priority': return { priority: 'High' };
      case 'create_task': return { title: '', priority: 'Medium', status: 'Open' };
      case 'send_notification': return { message: '', recipients: 'all' };
      case 'set_due_date': return { dateMode: 'relative', value: '7' };
      case 'move_to_group': return { group: '' };
      case 'add_tag': return { tag: '' };
      case 'duplicate_task': return { suffix: ' (Copy)' };
      case 'update_task': return { field: 'status', value: '' };
      case 'request_approval': return { approverId: '', note: '' };
      default: return {};
    }
  }

  // ===== EVENT LISTENERS =====
  function setupEventListeners() {
    // Sidebar navigation
    document.querySelectorAll('.wf-sidebar-item[data-tab]').forEach(item => {
      item.addEventListener('click', () => showTab(item.dataset.tab));
    });

    // Sidebar filter
    document.querySelectorAll('.wf-sidebar-item[data-filter]').forEach(item => {
      item.addEventListener('click', () => renderRules(item.dataset.filter));
    });

    // New Rule
    document.getElementById('newRuleBtn').addEventListener('click', () => openRuleBuilder());

    // Rule card click (edit)
    document.getElementById('rulesGrid').addEventListener('click', (e) => {
      const card = e.target.closest('.wf-rule-card');
      if (!card) return;
      // If toggle was clicked, handle enable/disable
      const toggle = e.target.closest('.toggle-switch');
      if (toggle) {
        const checkbox = toggle.querySelector('input');
        const ruleId = checkbox.dataset.toggle;
        const rule = WorkflowEngine.getRule(ruleId);
        if (rule) {
          const newState = checkbox.checked ? 'published' : 'disabled';
          WorkflowEngine.updateRule(ruleId, { state: newState }).then(() => {
            showToast('Rule ' + (newState === 'published' ? 'published' : 'disabled'), newState === 'published' ? 'success' : 'info');
            renderRules();
          });
        }
        return;
      }
      // Edit rule
      const ruleId = card.dataset.ruleId;
      const rule = WorkflowEngine.getRule(ruleId);
      if (rule) openRuleBuilder(rule, ruleId);
    });

    // Template click
    document.getElementById('templatesGrid').addEventListener('click', (e) => {
      const card = e.target.closest('.wf-template-card');
      if (!card) return;
      const tplId = card.dataset.template;
      const tpl = WorkflowEngine.Templates.find(t => t.id === tplId);
      if (tpl) {
        openRuleBuilder({ name: tpl.name, description: tpl.description, ...tpl.rule });
      }
    });

    // Trigger change
    document.getElementById('triggerType').addEventListener('change', function() {
      currentRule.trigger.type = this.value;
      currentRule.trigger.config = {};
      renderTriggerConfig();
    });

    // Condition logic toggle
    document.querySelectorAll('.condition-logic button').forEach(btn => {
      btn.addEventListener('click', () => {
        currentRule.conditionLogic = btn.dataset.logic;
        updateConditionLogicUI();
      });
    });

    // Add condition
    document.getElementById('addConditionBtn').addEventListener('click', () => {
      currentRule.conditions.push({ field: 'status', operator: 'equals', value: '' });
      renderConditions();
    });

    // Remove condition (delegated)
    document.getElementById('conditionsList').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-remove-cond]');
      if (btn) {
        currentRule.conditions.splice(parseInt(btn.dataset.removeCond), 1);
        renderConditions();
      }
    });

    // Add action
    document.getElementById('addActionBtn').addEventListener('click', () => {
      currentRule.actions.push({ type: 'send_notification', params: getDefaultParams('send_notification') });
      renderActions();
    });

    // Remove action (delegated)
    document.getElementById('actionsList').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-remove-action]');
      if (btn) {
        currentRule.actions.splice(parseInt(btn.dataset.removeAction), 1);
        renderActions();
      }
    });

    // Action type change (delegated)
    document.getElementById('actionsList').addEventListener('change', (e) => {
      if (e.target.classList.contains('action-type')) {
        const idx = parseInt(e.target.dataset.idx);
        const newType = e.target.value;
        currentRule.actions[idx] = { type: newType, params: getDefaultParams(newType) };
        renderActions();
      }
    });

    // Save Draft
    document.getElementById('saveRuleBtn').addEventListener('click', async () => {
      const data = collectRuleData();
      data.state = 'draft';
      try {
        if (editingRuleId) {
          await WorkflowEngine.updateRule(editingRuleId, data);
          showToast('Rule updated as draft', 'success');
        } else {
          await WorkflowEngine.addRule(data);
          showToast('Rule saved as draft', 'success');
        }
        showTab('rules');
      } catch(e) {
        showToast('Error saving rule: ' + e.message, 'error');
      }
    });

    // Publish Rule
    document.getElementById('publishRuleBtn').addEventListener('click', async () => {
      const data = collectRuleData();
      if (!data.trigger.type) { showToast('Please select a trigger', 'error'); return; }
      if (data.actions.length === 0) { showToast('Please add at least one action', 'error'); return; }
      data.state = 'published';
      try {
        if (editingRuleId) {
          await WorkflowEngine.updateRule(editingRuleId, data);
          showToast('Rule published!', 'success');
        } else {
          await WorkflowEngine.addRule(data);
          showToast('Rule created and published!', 'success');
        }
        showTab('rules');
      } catch(e) {
        showToast('Error: ' + e.message, 'error');
      }
    });

    // Test Rule (dry run)
    document.getElementById('testRuleBtn').addEventListener('click', async () => {
      const data = collectRuleData();
      if (!data.trigger.type) { showToast('Please select a trigger first', 'error'); return; }
      try {
        const allTasks = await ShadowDB.Tasks.getAll();
        if (allTasks.length === 0) { showToast('No tasks to test against', 'error'); return; }
        const testTask = allTasks[0];
        const rule = WorkflowEngine.createRule(data);
        const result = await WorkflowEngine.executeRule(rule, testTask, { dryRun: true });
        if (result.conditionsMet) {
          showToast('Test passed! ' + result.actions.length + ' actions would execute on: ' + testTask.title, 'success');
        } else {
          showToast('Test: Conditions not met for task: ' + testTask.title, 'info');
        }
        renderLogs();
      } catch(e) {
        showToast('Test error: ' + e.message, 'error');
      }
    });

    // Cancel
    document.getElementById('cancelRuleBtn').addEventListener('click', () => {
      editingRuleId = null;
      showTab('rules');
    });

    // Clear Logs
    document.getElementById('clearLogsBtn').addEventListener('click', async () => {
      await WorkflowEngine.clearLogs();
      renderLogs();
      showToast('Logs cleared', 'info');
    });

    // Run Scheduled Triggers
    document.getElementById('runScheduledBtn').addEventListener('click', async () => {
      await WorkflowEngine.checkScheduledTriggers();
      showToast('Scheduled triggers checked', 'success');
      renderLogs();
    });

    // AI Generate
    document.getElementById('aiGenerateBtn').addEventListener('click', () => {
      const prompt = document.getElementById('aiPromptInput').value.trim();
      if (!prompt) { showToast('Please enter a prompt', 'error'); return; }
      const ruleData = WorkflowEngine.parsePromptToRule(prompt);
      const resultDiv = document.getElementById('aiResult');
      resultDiv.style.display = '';
      resultDiv.innerHTML = '<div class="wf-step" style="margin-bottom:12px;">' +
        '<h4 style="margin-bottom:8px;">Generated Rule Preview</h4>' +
        '<div style="font-size:13px;margin-bottom:8px;"><strong>Name:</strong> ' + ruleData.name + '</div>' +
        '<div style="font-size:13px;margin-bottom:8px;"><strong>Trigger:</strong> ' + ruleData.trigger.type + '</div>' +
        '<div style="font-size:13px;margin-bottom:8px;"><strong>Conditions:</strong> ' + (ruleData.conditions.length ? ruleData.conditions.map(c => c.field + ' ' + c.operator + ' ' + c.value).join(', ') : 'None') + '</div>' +
        '<div style="font-size:13px;margin-bottom:12px;"><strong>Actions:</strong> ' + ruleData.actions.map(a => a.type).join(', ') + '</div>' +
        '<div style="display:flex;gap:8px;">' +
          '<button class="wf-btn primary" id="aiUseRule"><i class="fa-solid fa-check"></i> Use This Rule</button>' +
          '<button class="wf-btn" id="aiEditRule"><i class="fa-solid fa-pen"></i> Edit in Builder</button>' +
        '</div>' +
      '</div>';
      document.getElementById('aiUseRule').addEventListener('click', async () => {
        ruleData.state = 'draft';
        await WorkflowEngine.addRule(ruleData);
        showToast('AI rule saved as draft!', 'success');
        showTab('rules');
      });
      document.getElementById('aiEditRule').addEventListener('click', () => {
        openRuleBuilder(ruleData);
      });
    });

    // AI Examples
    document.getElementById('aiExamples').addEventListener('click', (e) => {
      const card = e.target.closest('.ai-example');
      if (card) document.getElementById('aiPromptInput').value = card.textContent;
    });

    // Listen for engine events
    WorkflowEngine.on('rule:executed', (log) => {
      if (!log.dryRun) showToast('Rule executed: ' + log.ruleName + (log.success ? ' (success)' : ' (failed)'), log.success ? 'success' : 'error');
      if (currentTab === 'logs') renderLogs();
    });

    WorkflowEngine.on('notification:sent', (n) => {
      showToast(n.message, 'info');
    });
  }

  // Start
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // ===== Public API for cross-module calls (used by workflow-builder.js AI prompt) =====
  window.ShadowWorkflowUI = {
    showBuilder: openRuleBuilder,
    openRuleBuilder: openRuleBuilder,
    showTab: showTab
  };
})();
