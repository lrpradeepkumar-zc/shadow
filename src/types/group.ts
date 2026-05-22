export type GroupType = 'personal' | 'group'
export type MemberRole = 'Owner' | 'Admin' | 'Moderator' | 'Member' | 'Viewer'

export interface Category {
  id: string
  groupId: string
  name: string
}

export interface CustomField {
  id: string
  groupId: string
  name: string
  fieldType: 'text' | 'number' | 'select' | 'date' | 'checkbox'
  options?: string[]
}

export interface Member {
  id: string
  groupId: string
  userId: string
  name: string
  email: string
  role: MemberRole
  avatar?: string
  color?: string
}

export interface GroupSettings {
  approvalWorkflowEnabled: boolean
  defaultApprover?: string | null
  mandateApproval: boolean
}

export interface Group {
  id: string
  name: string
  type: GroupType
  owner?: string | null
  description?: string | null
  createdAt: string
  members: Member[]
  categories: Category[]
  customFields: CustomField[]
  settings: GroupSettings
}

export interface Tag {
  id: string
  name: string
  color: string
  groupId?: string
}
