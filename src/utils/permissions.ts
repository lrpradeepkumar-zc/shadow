import type { UserRole, PermissionKey } from '@/types'
import { DEFAULT_PERMISSIONS } from '@/types'

export function hasPermission(role: UserRole | undefined, key: PermissionKey): boolean {
  if (!role) return false
  return DEFAULT_PERMISSIONS[role]?.[key] ?? false
}

export function canEditTask(role: UserRole | undefined, taskCreatedBy: string, currentUserId: string): boolean {
  if (!role) return false
  if (hasPermission(role, 'editTask')) return true
  return taskCreatedBy === currentUserId
}

export function canDeleteTask(role: UserRole | undefined): boolean {
  return hasPermission(role, 'deleteTask')
}
