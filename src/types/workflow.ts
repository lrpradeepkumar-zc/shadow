export type RuleState = 'draft' | 'testing' | 'published' | 'disabled'
export type ConditionLogic = 'AND' | 'OR'

export type TriggerTypeId =
  | 'TASK_CREATED' | 'TASK_UPDATED' | 'STATUS_CHANGED' | 'TASK_COMPLETED' | 'TASK_DELETED'
  | 'DUE_DATE_APPROACHING' | 'TASK_OVERDUE' | 'DUE_DATE_SET' | 'SCHEDULED_TIME'
  | 'ASSIGNMENT_CHANGED' | 'TASK_ASSIGNED'
  | 'COMMENT_ADDED' | 'ATTACHMENT_ADDED' | 'TAG_ADDED'
  | 'GROUP_TASK_CREATED' | 'GROUP_TASK_UPDATED'
  | 'PRIORITY_CHANGED' | 'CUSTOM_FIELD_CHANGED' | 'SUBTASKS_COMPLETED'

export type ConditionOperator =
  | 'EQUALS' | 'NOT_EQUALS' | 'CONTAINS' | 'NOT_CONTAINS'
  | 'GREATER_THAN' | 'LESS_THAN'
  | 'IN_LIST' | 'CHANGED_TO'
  | 'IS_EMPTY' | 'IS_NOT_EMPTY' | 'IS_SET' | 'IS_NOT_SET'
  | 'BEFORE' | 'AFTER'

export type ConditionFieldId =
  | 'STATUS' | 'PRIORITY' | 'DUE_DATE' | 'ASSIGNMENT' | 'GROUP' | 'TAG'
  | 'CREATED_BY' | 'CUSTOM_FIELD' | 'CHECKLIST' | 'COMMENT_COUNT'
  | 'TASK_AGE' | 'LAST_UPDATED_BY' | 'FIELD_CHANGED' | 'RECURRENCE'

export type ActionTypeId =
  | 'UPDATE_TASK' | 'CHANGE_STATUS' | 'SET_PRIORITY' | 'CHANGE_ASSIGNEE' | 'SET_DUE_DATE'
  | 'CREATE_TASK' | 'DUPLICATE_TASK' | 'ARCHIVE_TASK' | 'DELETE_TASK'
  | 'REQUEST_APPROVAL' | 'MOVE_TO_GROUP'
  | 'ADD_TAG' | 'ADD_COMMENT' | 'ADD_SUBTASK'
  | 'SEND_NOTIFICATION' | 'SEND_EMAIL' | 'SEND_PUSH'
  | 'SCHEDULE_RECURRING' | 'CREATE_PROJECT' | 'EXPORT_TASKS'

export interface TriggerNode {
  id: string
  typeId: TriggerTypeId
  config: Record<string, unknown>
}

export interface ConditionNode {
  id: string
  fieldId: ConditionFieldId
  operator: ConditionOperator
  value: unknown
}

export interface ActionNode {
  id: string
  typeId: ActionTypeId
  params: Record<string, unknown>
}

export interface WorkflowRule {
  id: string
  name: string
  groupId: string
  state: RuleState
  trigger: TriggerNode
  conditionLogic: ConditionLogic
  conditions: ConditionNode[]
  actions: ActionNode[]
  createdBy: string
  createdAt: string
  updatedAt: string
  executionCount: number
  lastExecutedAt?: string | null
  order: number
}

export interface WorkflowInstance {
  id: string
  ruleId: string
  taskId: string
  status: 'running' | 'completed' | 'failed' | 'waiting'
  startedAt: string
  completedAt?: string
  error?: string
  metadata?: Record<string, unknown>
}

export interface WorkflowLog {
  id: string
  ruleId: string
  instanceId?: string
  taskId?: string
  success: boolean
  error?: string
  executedAt: string
  duration?: number
}
