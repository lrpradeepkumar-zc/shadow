export type UserRole = 'admin' | 'member' | 'viewer'

export interface UserProfile {
  id: string
  name: string
  email: string
  role: UserRole
  avatar?: string
  color?: string
  createdAt?: string
  updatedAt?: string
}

export interface Permission {
  createTask: boolean
  editTask: boolean
  deleteTask: boolean
  createGroup: boolean
  editGroup: boolean
  deleteGroup: boolean
  manageMembers: boolean
  manageSettings: boolean
  viewAdmin: boolean
  assignTask: boolean
}

export type PermissionKey = keyof Permission

export const DEFAULT_PERMISSIONS: Record<UserRole, Permission> = {
  admin: {
    createTask: true,
    editTask: true,
    deleteTask: true,
    createGroup: true,
    editGroup: true,
    deleteGroup: true,
    manageMembers: true,
    manageSettings: true,
    viewAdmin: true,
    assignTask: true,
  },
  member: {
    createTask: true,
    editTask: true,
    deleteTask: false,
    createGroup: true,
    editGroup: true,
    deleteGroup: false,
    manageMembers: false,
    manageSettings: false,
    viewAdmin: false,
    assignTask: true,
  },
  viewer: {
    createTask: false,
    editTask: false,
    deleteTask: false,
    createGroup: false,
    editGroup: false,
    deleteGroup: false,
    manageMembers: false,
    manageSettings: false,
    viewAdmin: false,
    assignTask: false,
  },
}
