import { cn } from '@/utils/cn'
import type { Priority, Status } from '@/types'

interface BadgeProps {
  children: React.ReactNode
  className?: string
  variant?: 'default' | 'outline'
}

export function Badge({ children, className, variant = 'default' }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium',
        variant === 'outline' && 'border',
        className
      )}
    >
      {children}
    </span>
  )
}

const priorityConfig: Record<Priority, { label: string; className: string }> = {
  High: { label: 'High', className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  Medium: { label: 'Medium', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  Low: { label: 'Low', className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  None: { label: 'None', className: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400' },
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  const config = priorityConfig[priority]
  return <Badge className={config.className}>{config.label}</Badge>
}

const statusConfig: Record<Status, { label: string; className: string }> = {
  Open: { label: 'Open', className: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' },
  'In Progress': { label: 'In Progress', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  Fixed: { label: 'Fixed', className: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
  Completed: { label: 'Completed', className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  Closed: { label: 'Closed', className: 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300' },
}

export function StatusBadge({ status }: { status: Status }) {
  const config = statusConfig[status]
  return <Badge className={config.className}>{config.label}</Badge>
}
