/**
 * Shadow ToDo - Workflow Engine (POC)
 * Rule-based automation engine that integrates with ShadowDB
 * Supports triggers, conditions, actions, templates, and execution logging
 */
const WorkflowEngine = (function() {
  'use strict';

  const RuleState = {
    DRAFT: 'draft',
    TESTING: 'testing',
    PUBLISHED: 'published',
    DISABLED: 'disabled'
  };

  const TriggerTypes = {
    TASK_CREATED: { id: 'task_created', label: 'Task Created', icon: 'fa-plus-circle', description: 'When a new task is created', event: 'task:created', fields: ['group', 'category', 'priority', 'assignee'] },
    TASK_UPDATED: { id: 'task_updated', label: 'Task Updated', icon: 'fa-pen-to-square', description: 'When a task is modified', event: 'task:updated', fields: ['status', 'priority', 'assignee', 'dueDate'] },
    STATUS_CHANGED: { id: 'status_changed', label: 'Status Changed', icon: 'fa-arrows-rotate', description: 'When task status changes', event: 'task:updated', fields: ['status', 'previousStatus'] },
    DUE_DATE_APPROACHING: { id: 'due_date_approaching', label: 'Due Date Approaching', icon: 'fa-clock', description: 'When due date is within threshold', event: 'schedule:check', fields: ['daysBeforeDue'] },
    TASK_OVERDUE: { id: 'task_overdue', label: 'Task Overdue', icon: 'fa-triangle-exclamation', description: 'When a task passes its due date', event: 'schedule:check', fields: [] },
    TASK_COMPLETED: { id: 'task_completed', label: 'Task Completed', icon: 'fa-circle-check', description: 'When a task is marked complete', event: 'task:updated', fields: ['group', 'category'] },
    ASSIGNMENT_CHANGED: { id: 'assignment_changed', label: 'Assignment Changed', icon: 'fa-user-pen', description: 'When task assignee changes', event: 'task:updated', fields: ['assignee', 'previousAssignee'] }
  };

  const ConditionOperators = {
    EQUALS: { id: 'equals', label: 'equals', symbol: '==' },
    NOT_EQUALS: { id: 'not_equals', label: 'does not equal', symbol: '!=' },
    CONTAINS: { id: 'contains', label: 'contains', symbol: 'includes' },
    GREATER_THAN: { id: 'greater_than', label: 'greater than', symbol: '>' },
    LESS_THAN: { id: 'less_than', label: 'less than', symbol: '<' },
    IS_EMPTY: { id: 'is_empty', label: 'is empty', symbol: '==""' },
    IS_NOT_EMPTY: { id: 'is_not_empty', label: 'is not empty', symbol: '!=""' },
    IN_LIST: { id: 'in_list', label: 'is one of', symbol: 'in' }
  };

  const ActionTypes = {
    UPDATE_TASK: { id: 'update_task', label: 'Update Task Field', icon: 'fa-pen', description: 'Change a field value on the triggering task', params: ['field', 'value'] },
    CREATE_TASK: { id: 'create_task', label: 'Create New Task', icon: 'fa-plus', description: 'Create a new task with specified properties', params: ['title', 'group', 'category', 'priority', 'assignee', 'dueDate', 'status'] },
    ASSIGN_TASK: { id: 'assign_task', label: 'Assign Task', icon: 'fa-user-plus', description: 'Assign task to a specific member', params: ['assignee'] },
    CHANGE_STATUS: { id: 'change_status', label: 'Change Status', icon: 'fa-arrows-rotate', description: 'Update the task status', params: ['status'] },
    SET_PRIORITY: { id: 'set_priority', label: 'Set Priority', icon: 'fa-exclamation', description: 'Change the task priority', params: ['priority'] },
    MOVE_TO_GROUP: { id: 'move_to_group', label: 'Move to Group', icon: 'fa-folder-open', description: 'Move task to different group', params: ['group'] },
    ADD_TAG: { id: 'add_tag', label: 'Add Tag', icon: 'fa-tag', description: 'Add a tag to the task', params: ['tag'] },
    SEND_NOTIFICATION: { id: 'send_notification', label: 'Send Notification', icon: 'fa-bell', description: 'Send an in-app notification', params: ['message', 'recipients'] },
    SET_DUE_DATE: { id: 'set_due_date', label: 'Set Due Date', icon: 'fa-calendar', description: 'Set or adjust due date', params: ['dateMode', 'value'] },
    DUPLICATE_TASK: { id: 'duplicate_task', label: 'Duplicate Task', icon: 'fa-copy', description: 'Create a copy of the task', params: ['group', 'suffix'] },
    REQUEST_APPROVAL: { id: 'request_approval', label: 'Request Approval', icon: 'fa-stamp', description: 'Submit task for approval via approval workflow', params: ['approverId', 'note'] }
  };

  const TaskFields = {
    status: { label: 'Status', type: 'select', options: ['Open', 'In Progress', 'Fixed', 'Closed', 'Completed'] },
    priority: { label: 'Priority', type: 'select', options: ['None', 'Low', 'Medium', 'High'] },
    assignee: { label: 'Assignee', type: 'text' },
    group: { label: 'Group', type: 'select', dynamic: true },
    category: { label: 'Category', type: 'text' },
    dueDate: { label: 'Due Date', type: 'date' },
    title: { label: 'Title', type: 'text' },
    description: { label: 'Description', type: 'text' }
  };

  // ===== RULE DATA MODEL =====
  function createRule(data) {
    return {
      id: data.id || 'rule_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
      name: data.name || 'Untitled Rule',
      description: data.description || '',
      trigger: data.trigger || { type: null, config: {} },
      conditions: data.conditions || [],
      conditionLogic: data.conditionLogic || 'AND',
      actions: data.actions || [],
      state: data.state || RuleState.DRAFT,
      scope: data.scope || 'personal',
      groupId: data.groupId || null,
      createdAt: data.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: data.createdBy || 'current_user',
      executionCount: data.executionCount || 0,
      lastExecutedAt: data.lastExecutedAt || null,
      order: data.order || 0
    };
  }

  // ===== STORAGE =====
  let rules = [];
  let logs = [];
  let listeners = {};

  async function loadRules() {
    try {
      const stored = await ShadowDB.Settings.get('workflow_rules');
      rules = stored ? JSON.parse(stored) : [];
    } catch(e) { rules = []; }
    return rules;
  }

  async function saveRules() {
    try { await ShadowDB.Settings.set('workflow_rules', JSON.stringify(rules)); } catch(e) { console.error('WorkflowEngine: save failed', e); }
  }

  async function loadLogs() {
    try {
      const stored = await ShadowDB.Settings.get('workflow_logs');
      logs = stored ? JSON.parse(stored) : [];
    } catch(e) { logs = []; }
    return logs;
  }

  async function saveLogs() {
    try {
      if (logs.length > 500) logs = logs.slice(-500);
      await ShadowDB.Settings.set('workflow_logs', JSON.stringify(logs));
    } catch(e) { console.error('WorkflowEngine: log save failed', e); }
  }

  // ===== RULE CRUD =====
  async function addRule(ruleData) {
    const rule = createRule(ruleData);
    rules.push(rule);
    await saveRules();
    emit('rule:created', rule);
    return rule;
  }

  async function updateRule(ruleId, updates) {
    const idx = rules.findIndex(r => r.id === ruleId);
    if (idx === -1) throw new Error('Rule not found: ' + ruleId);
    rules[idx] = { ...rules[idx], ...updates, updatedAt: new Date().toISOString() };
    await saveRules();
    emit('rule:updated', rules[idx]);
    return rules[idx];
  }

  async function deleteRule(ruleId) {
    rules = rules.filter(r => r.id !== ruleId);
    await saveRules();
    emit('rule:deleted', { id: ruleId });
    return true;
  }

  function getRule(ruleId) { return rules.find(r => r.id === ruleId) || null; }
  function getAllRules() { return [...rules]; }
  function getRulesByScope(scope, groupId) {
    return rules.filter(r => {
      if (scope === 'group' && groupId) return r.scope === 'group' && r.groupId === groupId;
      return r.scope === scope;
    });
  }

  // ===== CONDITION EVALUATION =====
  function evaluateCondition(condition, taskData) {
    const { field, operator, value } = condition;
    const taskValue = taskData[field];
    switch(operator) {
      case 'equals': return String(taskValue).toLowerCase() === String(value).toLowerCase();
      case 'not_equals': return String(taskValue).toLowerCase() !== String(value).toLowerCase();
      case 'contains': return String(taskValue).toLowerCase().includes(String(value).toLowerCase());
      case 'greater_than': return Number(taskValue) > Number(value);
      case 'less_than': return Number(taskValue) < Number(value);
      case 'is_empty': return !taskValue || taskValue === '';
      case 'is_not_empty': return taskValue && taskValue !== '';
      case 'in_list':
        const list = String(value).split(',').map(v => v.trim().toLowerCase());
        return list.includes(String(taskValue).toLowerCase());
      default: return false;
    }
  }

  function evaluateConditions(conditions, logic, taskData) {
    if (!conditions || conditions.length === 0) return true;
    return logic === 'AND' ? conditions.every(c => evaluateCondition(c, taskData)) : conditions.some(c => evaluateCondition(c, taskData));
  }

  // ===== ACTION EXECUTION =====
  async function executeAction(action, taskData, rule) {
    const result = { success: false, action: action.type, details: '' };
    try {
      switch(action.type) {
        case 'update_task': {
          const t = { ...taskData }; t[action.params.field] = action.params.value;
          await ShadowDB.Tasks.update(t);
          result.success = true; result.details = 'Updated ' + action.params.field + ' to ' + action.params.value; break;
        }
        case 'create_task': {
          const nt = { title: action.params.title || 'Auto: ' + rule.name, group: action.params.group || taskData.group, category: action.params.category || 'General', priority: action.params.priority || 'Medium', assignee: action.params.assignee || taskData.assignee, dueDate: action.params.dueDate || null, status: action.params.status || 'Open', description: 'Created by rule: ' + rule.name, tags: [], subtasks: [] };
          await ShadowDB.Tasks.create(nt);
          result.success = true; result.details = 'Created task: ' + nt.title; break;
        }
        case 'assign_task': {
          await ShadowDB.Tasks.update({ ...taskData, assignee: action.params.assignee });
          result.success = true; result.details = 'Assigned to ' + action.params.assignee; break;
        }
        case 'change_status': {
          await ShadowDB.Tasks.update({ ...taskData, status: action.params.status });
          result.success = true; result.details = 'Status changed to ' + action.params.status; break;
        }
        case 'set_priority': {
          await ShadowDB.Tasks.update({ ...taskData, priority: action.params.priority });
          result.success = true; result.details = 'Priority set to ' + action.params.priority; break;
        }
        case 'move_to_group': {
          await ShadowDB.Tasks.update({ ...taskData, group: action.params.group });
          result.success = true; result.details = 'Moved to group ' + action.params.group; break;
        }
        case 'add_tag': {
          const tagged = { ...taskData }; if (!tagged.tags) tagged.tags = [];
          if (!tagged.tags.includes(action.params.tag)) tagged.tags.push(action.params.tag);
          await ShadowDB.Tasks.update(tagged);
          result.success = true; result.details = 'Added tag: ' + action.params.tag; break;
        }
        case 'send_notification': {
          emit('notification:sent', { type: 'workflow', message: action.params.message || 'Notification from: ' + rule.name, recipients: action.params.recipients || 'all', taskId: taskData.id, ruleId: rule.id, timestamp: new Date().toISOString() });
          result.success = true; result.details = 'Notification sent: ' + (action.params.message || rule.name); break;
        }
        case 'set_due_date': {
          const du = { ...taskData };
          if (action.params.dateMode === 'relative') { const d = new Date(); d.setDate(d.getDate() + parseInt(action.params.value || 7)); du.dueDate = d.toISOString().split('T')[0]; }
          else { du.dueDate = action.params.value; }
          await ShadowDB.Tasks.update(du);
          result.success = true; result.details = 'Due date set to ' + du.dueDate; break;
        }
        case 'duplicate_task': {
          const dup = { title: taskData.title + (action.params.suffix || ' (Copy)'), group: action.params.group || taskData.group, category: taskData.category, priority: taskData.priority, assignee: taskData.assignee, dueDate: taskData.dueDate, status: 'Open', description: taskData.description, tags: [...(taskData.tags || [])], subtasks: [] };
          await ShadowDB.Tasks.create(dup);
          result.success = true; result.details = 'Duplicated as: ' + dup.title; break;
        }
        case 'request_approval': {
          try {
            if (typeof ApprovalWorkflow !== 'undefined') {
              const settings = await ApprovalWorkflow.Settings.get(taskData.group);
              if (settings.enabled) {
                await ApprovalWorkflow.Requests.submit({
                  taskId: taskData.id,
                  requesterId: taskData.assignee || 'current_user',
                  approverId: action.params.approverId || settings.defaultApprover,
                  note: action.params.note || 'Auto-submitted by workflow rule: ' + rule.name,
                  groupId: taskData.group
                });
                result.success = true;
                result.details = 'Approval requested from ' + (action.params.approverId || settings.defaultApprover);
              } else {
                result.details = 'Approval workflow not enabled for group: ' + taskData.group;
              }
            } else {
              result.details = 'ApprovalWorkflow module not loaded';
            }
          } catch(approvalErr) {
            result.details = 'Approval error: ' + approvalErr.message;
          }
          break;
        }
        default: result.details = 'Unknown action: ' + action.type;
      }
    } catch(e) { result.details = 'Error: ' + e.message; }
    return result;
  }

  // ===== RULE EXECUTION =====
  async function executeRule(rule, taskData, options) {
    const isDryRun = options && options.dryRun;
    const logEntry = { id: 'log_' + Date.now(), ruleId: rule.id, ruleName: rule.name, triggeredBy: rule.trigger.type, taskId: taskData.id, taskTitle: taskData.title, timestamp: new Date().toISOString(), dryRun: isDryRun || false, conditionsMet: false, actions: [], success: false, error: null };
    try {
      const conditionsMet = evaluateConditions(rule.conditions, rule.conditionLogic, taskData);
      logEntry.conditionsMet = conditionsMet;
      if (!conditionsMet) { logEntry.details = 'Conditions not met'; logs.push(logEntry); await saveLogs(); emit('rule:skipped', logEntry); return logEntry; }
      for (const action of rule.actions) {
        let ar;
        if (isDryRun) { ar = { success: true, action: action.type, details: '[DRY RUN] ' + action.type }; }
        else { ar = await executeAction(action, taskData, rule); }
        logEntry.actions.push(ar);
      }
      logEntry.success = logEntry.actions.every(a => a.success);
      if (!isDryRun) { rule.executionCount = (rule.executionCount || 0) + 1; rule.lastExecutedAt = new Date().toISOString(); await saveRules(); }
    } catch(e) { logEntry.error = e.message; logEntry.success = false; }
    logs.push(logEntry); await saveLogs(); emit('rule:executed', logEntry);
    return logEntry;
  }

  // ===== TRIGGER LISTENERS =====
  function setupTriggerListeners() {
    ShadowDB.on('task:created', async (task) => {
      const active = rules.filter(r => r.state === RuleState.PUBLISHED && r.trigger.type === 'task_created');
      for (const rule of active) await executeRule(rule, task);
    });
    ShadowDB.on('task:updated', async (task) => {
      const active = rules.filter(r => r.state === RuleState.PUBLISHED && ['task_updated', 'status_changed', 'assignment_changed', 'task_completed'].includes(r.trigger.type));
      for (const rule of active) {
        if (rule.trigger.type === 'task_completed' && task.status !== 'Completed') continue;
        await executeRule(rule, task);
      }
    });
  }

  async function checkScheduledTriggers() {
    const now = new Date();
    const active = rules.filter(r => r.state === RuleState.PUBLISHED && ['due_date_approaching', 'task_overdue'].includes(r.trigger.type));
    if (active.length === 0) return;
    const allTasks = await ShadowDB.Tasks.getAll();
    for (const rule of active) {
      for (const task of allTasks) {
        if (!task.dueDate || task.status === 'Completed') continue;
        const dueDate = new Date(task.dueDate);
        if (rule.trigger.type === 'task_overdue' && dueDate < now) await executeRule(rule, task);
        else if (rule.trigger.type === 'due_date_approaching') {
          const days = parseInt(rule.trigger.config.daysBeforeDue || 2);
          const threshold = new Date(now); threshold.setDate(threshold.getDate() + days);
          if (dueDate <= threshold && dueDate >= now) await executeRule(rule, task);
        }
      }
    }
  }

  // ===== PRE-BUILT TEMPLATES =====
  const Templates = [
    { id: 'tpl_1', name: 'Auto-assign High Priority Tasks', description: 'Assign high-priority tasks to team lead on creation', category: 'Assignment', icon: 'fa-user-plus',
      rule: { trigger: { type: 'task_created', config: {} }, conditions: [{ field: 'priority', operator: 'equals', value: 'High' }], conditionLogic: 'AND', actions: [{ type: 'assign_task', params: { assignee: 'Team Lead' } }, { type: 'send_notification', params: { message: 'High priority task assigned', recipients: 'Team Lead' } }] } },
    { id: 'tpl_2', name: 'Overdue Task Escalation', description: 'Escalate priority and notify when task becomes overdue', category: 'Escalation', icon: 'fa-triangle-exclamation',
      rule: { trigger: { type: 'task_overdue', config: {} }, conditions: [{ field: 'priority', operator: 'not_equals', value: 'High' }], conditionLogic: 'AND', actions: [{ type: 'set_priority', params: { priority: 'High' } }, { type: 'send_notification', params: { message: 'Task overdue - escalated', recipients: 'group_owner' } }] } },
    { id: 'tpl_3', name: 'Task Completion Notifier', description: 'Notify team when any task is completed', category: 'Notification', icon: 'fa-bell',
      rule: { trigger: { type: 'task_completed', config: {} }, conditions: [], conditionLogic: 'AND', actions: [{ type: 'send_notification', params: { message: 'Task completed!', recipients: 'all' } }] } },
    { id: 'tpl_4', name: 'Due Date Reminder (2 days)', description: 'Remind assignee 2 days before due date', category: 'Reminder', icon: 'fa-clock',
      rule: { trigger: { type: 'due_date_approaching', config: { daysBeforeDue: 2 } }, conditions: [{ field: 'status', operator: 'not_equals', value: 'Completed' }], conditionLogic: 'AND', actions: [{ type: 'send_notification', params: { message: 'Task due in 2 days!', recipients: 'assignee' } }] } },
    { id: 'tpl_5', name: 'Auto-categorize Bugs', description: 'Tag and prioritize tasks with bug in title', category: 'Organization', icon: 'fa-bug',
      rule: { trigger: { type: 'task_created', config: {} }, conditions: [{ field: 'title', operator: 'contains', value: 'bug' }], conditionLogic: 'OR', actions: [{ type: 'add_tag', params: { tag: 'Bug Fix' } }, { type: 'set_priority', params: { priority: 'High' } }] } },
    { id: 'tpl_6', name: 'Status Progression to QA', description: 'When Fixed, assign to QA and notify', category: 'Workflow', icon: 'fa-arrows-rotate',
      rule: { trigger: { type: 'status_changed', config: {} }, conditions: [{ field: 'status', operator: 'equals', value: 'Fixed' }], conditionLogic: 'AND', actions: [{ type: 'assign_task', params: { assignee: 'QA Team' } }, { type: 'send_notification', params: { message: 'Ready for QA', recipients: 'QA Team' } }] } },
    { id: 'tpl_7', name: 'Auto-Duplicate on Completion', description: 'Copy task when completed for recurring work', category: 'Automation', icon: 'fa-copy',
      rule: { trigger: { type: 'task_completed', config: {} }, conditions: [], conditionLogic: 'AND', actions: [{ type: 'duplicate_task', params: { suffix: ' (Next Cycle)' } }] } },
    { id: 'tpl_8', name: 'New Task Review Creation', description: 'Create a review task when group task added', category: 'Workflow', icon: 'fa-list-check',
      rule: { trigger: { type: 'task_created', config: {} }, conditions: [{ field: 'group', operator: 'is_not_empty', value: '' }], conditionLogic: 'AND', actions: [{ type: 'create_task', params: { title: 'Review new task', priority: 'Medium', status: 'Open' } }] } },
    { id: 'tpl_approval_1', name: 'Task Approval Gate', description: 'Require approval before high-priority tasks can proceed. Automatically submits for approval when a task is marked as Fixed.', category: 'Approval', icon: 'fa-stamp',
      rule: { trigger: { type: 'status_changed', config: {} }, conditions: [{ field: 'status', operator: 'equals', value: 'Fixed' }, { field: 'priority', operator: 'equals', value: 'High' }], conditionLogic: 'AND', actions: [{ type: 'request_approval', params: { approverId: 'Team Lead', note: 'High-priority task ready for review' } }, { type: 'send_notification', params: { message: 'Approval required for high-priority task', recipients: 'Team Lead' } }] } },
    { id: 'tpl_approval_2', name: 'Completion Approval Workflow', description: 'When a task is completed, submit it for manager approval and notify the team.', category: 'Approval', icon: 'fa-clipboard-check',
      rule: { trigger: { type: 'task_completed', config: {} }, conditions: [{ field: 'group', operator: 'is_not_empty', value: '' }], conditionLogic: 'AND', actions: [{ type: 'request_approval', params: { approverId: 'Manager', note: 'Task completed - pending approval' } }, { type: 'send_notification', params: { message: 'Task completed and sent for approval', recipients: 'all' } }] } },
    { id: 'tpl_approval_3', name: 'New Task Approval Required', description: 'Automatically request approval when a new high-priority task is created in any group.', category: 'Approval', icon: 'fa-file-circle-check',
      rule: { trigger: { type: 'task_created', config: {} }, conditions: [{ field: 'priority', operator: 'equals', value: 'High' }], conditionLogic: 'AND', actions: [{ type: 'request_approval', params: { approverId: 'Team Lead', note: 'New high-priority task needs approval' } }, { type: 'assign_task', params: { assignee: 'Team Lead' } }] } }
  ];

  // ===== AI PROMPT-TO-RULE (Simulated NLP) =====
  function parsePromptToRule(prompt) {
    const lower = prompt.toLowerCase();
    const rule = { name: 'AI: ' + prompt.substring(0, 50), description: 'From prompt: ' + prompt, trigger: { type: null, config: {} }, conditions: [], conditionLogic: 'AND', actions: [] };

    // Detect trigger
    if (lower.includes('when') && lower.includes('creat')) rule.trigger.type = 'task_created';
    else if (lower.includes('when') && lower.includes('complet')) rule.trigger.type = 'task_completed';
    else if (lower.includes('when') && lower.includes('overdue')) rule.trigger.type = 'task_overdue';
    else if (lower.includes('when') && lower.includes('status')) rule.trigger.type = 'status_changed';
    else if (lower.includes('due') && (lower.includes('approaching') || lower.includes('remind'))) {
      rule.trigger.type = 'due_date_approaching';
      const dm = lower.match(/(\d+)\s*day/); if (dm) rule.trigger.config.daysBeforeDue = parseInt(dm[1]);
    }
    else if (lower.includes('when') && lower.includes('assign')) rule.trigger.type = 'assignment_changed';
    else rule.trigger.type = 'task_created';

    // Detect conditions
    if (lower.includes('high priority')) rule.conditions.push({ field: 'priority', operator: 'equals', value: 'High' });
    if (lower.includes('medium priority')) rule.conditions.push({ field: 'priority', operator: 'equals', value: 'Medium' });
    if (lower.includes('low priority')) rule.conditions.push({ field: 'priority', operator: 'equals', value: 'Low' });
    if (lower.includes('bug')) rule.conditions.push({ field: 'title', operator: 'contains', value: 'bug' });

    // Detect actions
    const am = lower.match(/assign(?:ed)?\s+(?:to\s+)?(\w+(?:\s+\w+)?)/);
    if (am) rule.actions.push({ type: 'assign_task', params: { assignee: am[1] } });
    if (lower.includes('notify') || lower.includes('alert')) rule.actions.push({ type: 'send_notification', params: { message: 'Automated: ' + rule.name, recipients: 'all' } });
    if (lower.includes('set priority')) {
      const pm = lower.match(/set\s+priority\s+(?:to\s+)?(high|medium|low)/i);
      if (pm) rule.actions.push({ type: 'set_priority', params: { priority: pm[1].charAt(0).toUpperCase() + pm[1].slice(1) } });
    }
    if (lower.includes('duplicate') || lower.includes('copy')) rule.actions.push({ type: 'duplicate_task', params: { suffix: ' (Copy)' } });
    if (rule.actions.length === 0) rule.actions.push({ type: 'send_notification', params: { message: 'Rule triggered: ' + rule.name, recipients: 'all' } });
    return rule;
  }

  // ===== EVENT BUS =====
  function on(event, cb) { if (!listeners[event]) listeners[event] = []; listeners[event].push(cb); return () => { listeners[event] = listeners[event].filter(c => c !== cb); }; }
  function emit(event, data) { if (listeners[event]) listeners[event].forEach(cb => cb(data)); }

  // ===== LOGS API =====
  function getLogs(ruleId) { return ruleId ? logs.filter(l => l.ruleId === ruleId) : [...logs]; }
  function getRecentLogs(limit) { return logs.slice(-(limit || 50)).reverse(); }
  async function clearLogs(ruleId) { logs = ruleId ? logs.filter(l => l.ruleId !== ruleId) : []; await saveLogs(); }

  // ===== INIT =====
  let initialized = false;
  let schedulerInterval = null;

  async function init() {
    if (initialized) return;
    await loadRules(); await loadLogs();
    setupTriggerListeners();
    schedulerInterval = setInterval(checkScheduledTriggers, 60000);
    setTimeout(checkScheduledTriggers, 5000);
    initialized = true;
    emit('engine:ready', { rulesCount: rules.length });
    console.log('WorkflowEngine initialized with', rules.length, 'rules');
    return true;
  }

  function destroy() { if (schedulerInterval) clearInterval(schedulerInterval); listeners = {}; initialized = false; }

  return {
    init, destroy,
    addRule, updateRule, deleteRule, getRule, getAllRules, getRulesByScope,
    executeRule, checkScheduledTriggers,
    parsePromptToRule,
    getLogs, getRecentLogs, clearLogs,
    on, emit,
    TriggerTypes, ConditionOperators, ActionTypes, TaskFields, Templates, RuleState,
    createRule, evaluateConditions
  };
})();

if (typeof window !== 'undefined') window.WorkflowEngine = WorkflowEngine;
