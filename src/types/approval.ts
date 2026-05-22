export type ApprovalStatus = 'pending_approval' | 'approved' | 'changes_requested'

export type RejectionCategory =
  | 'incomplete_work'
  | 'quality_issues'
  | 'missing_requirements'
  | 'wrong_approach'
  | 'other'

export type ApprovalActionType =
  | 'approval_requested'
  | 'approved'
  | 'rejected'
  | 'changes_requested'
  | 'aborted'
  | 'resubmitted'

export interface ApprovalRequest {
  id: string
  taskId: string
  groupId: string
  requesterId: string
  approverId: string
  status: ApprovalStatus
  note?: string
  createdAt: string
  updatedAt: string
  resolvedAt?: string | null
  decisionNote?: string
  rejectionCategory?: RejectionCategory
  previousRequestId?: string | null
}

export interface ApprovalSettings {
  groupId: string
  enabled: boolean
  mandateApproval: boolean
  defaultApprover?: string | null
  defaultApproverType?: 'member'
  _approverDeleted?: boolean
}

export interface ApprovalAuditLog {
  id: string
  taskId: string
  requestId: string
  actorId: string
  actionType: ApprovalActionType
  notes?: string
  timestamp: string
  metadata?: Record<string, unknown>
}

export const APPROVAL_LOCKED_FIELDS = [
  'title',
  'dueDate',
  'assignee',
  'attachments',
  'startDate',
  'priority',
  'status',
] as const

export type ApprovalLockedField = (typeof APPROVAL_LOCKED_FIELDS)[number]
