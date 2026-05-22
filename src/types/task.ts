export type Priority = 'None' | 'Low' | 'Medium' | 'High'
export type Status = 'Open' | 'In Progress' | 'Fixed' | 'Completed' | 'Closed'

export interface Subtask {
  id: string
  title: string
  done: boolean
}

export interface Attachment {
  id: string
  name: string
  url: string
  size?: number
  type?: string
  uploadedAt: string
  uploadedBy: string
}

export interface Comment {
  id: string
  taskId: string
  authorId: string
  text: string
  createdAt: string
  updatedAt?: string
}

export interface ActivityEntry {
  id: string
  taskId: string
  actorId: string
  actionType: string
  timestamp: string
  metadata?: Record<string, unknown>
}

export interface RecurrenceRule {
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly'
  interval: number
  endDate?: string
  count?: number
  daysOfWeek?: number[]
}

export interface ReminderConfig {
  time: string
  type: 'email' | 'push' | 'in-app'
  minutesBefore?: number
}

export interface Task {
  id: string
  title: string
  description?: string
  notes?: string
  status: Status
  priority: Priority
  dueDate?: string
  startDate?: string
  completedAt?: string
  assignee?: string
  group?: string
  category?: string
  tags: string[]
  subtasks: Subtask[]
  attachments: Attachment[]
  sharedWith: string[]
  customFields: Record<string, unknown>
  recurrence?: RecurrenceRule
  reminder?: ReminderConfig
  createdBy: string
  createdAt: string
  modifiedDate: string
  order?: number
  archived?: boolean
}

export interface TaskFilters {
  group?: string | null
  tag?: string | null
  assignee?: string | null
  createdBy?: string | null
  status?: Status | null
  priority?: Priority | null
  delayed?: boolean
  archived?: boolean
  searchQuery?: string
}

export type DateCategory = 'delayed' | 'today' | 'week' | 'month' | 'upcoming' | 'noDate'
export type GroupByField = 'dueDate' | 'priority' | 'status' | 'assignee' | 'category' | 'group'
export type SortField = 'dueDate' | 'createdAt' | 'modifiedDate' | 'priority' | 'title'
export type SortDir = 'asc' | 'desc'
