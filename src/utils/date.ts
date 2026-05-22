import type { DateCategory } from '@/types'

export function formatDate(dateStr?: string | null): string {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return ''
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function formatDateShort(dateStr?: string | null): string {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return ''
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function isOverdue(dateStr?: string | null): boolean {
  if (!dateStr) return false
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return date < today
}

export function isToday(dateStr?: string | null): boolean {
  if (!dateStr) return false
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return false
  const today = new Date()
  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  )
}

export function getDateCategory(dateStr?: string | null): DateCategory {
  if (!dateStr) return 'noDate'
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return 'noDate'

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(date)
  target.setHours(0, 0, 0, 0)

  if (target < today) return 'delayed'
  if (target.getTime() === today.getTime()) return 'today'

  const weekEnd = new Date(today)
  weekEnd.setDate(today.getDate() + 7)
  if (target <= weekEnd) return 'week'

  const monthEnd = new Date(today)
  monthEnd.setDate(today.getDate() + 30)
  if (target <= monthEnd) return 'month'

  return 'upcoming'
}

export function toInputDate(dateStr?: string | null): string {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return ''
  return date.toISOString().split('T')[0]
}
