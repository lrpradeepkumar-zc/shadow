import { useMemo } from 'react'
import { useTasks } from '@/hooks/useTasks'
import { useGroups } from '@/hooks/useGroups'
import { useAppStore } from '@/store/appStore'
import { PriorityBadge, StatusBadge } from '@/components/ui/Badge'
import { Avatar } from '@/components/ui/Avatar'
import { formatDateShort, isOverdue, getDateCategory } from '@/utils/date'
import { cn } from '@/utils/cn'
import type { Task, SortField } from '@/types'

export function ListView() {
  const { data: tasks = [], isLoading } = useTasks()
  const { data: groups = [] } = useGroups()
  const { filters, sortBy, setSortBy, sortDir, setSortDir, setSelectedTask } = useAppStore()

  const memberMap = useMemo(() => {
    const map: Record<string, { name: string; color?: string }> = {}
    groups.forEach((g) => g.members.forEach((m) => { map[m.userId] = { name: m.name, color: m.color } }))
    return map
  }, [groups])

  const filtered = useMemo(() => {
    let result = tasks.filter((t) => {
      if (filters.archived !== true && t.archived) return false
      if (filters.group && t.group !== filters.group) return false
      if (filters.tag && !t.tags.includes(filters.tag)) return false
      if (filters.assignee && t.assignee !== filters.assignee) return false
      if (filters.status && t.status !== filters.status) return false
      if (filters.priority && t.priority !== filters.priority) return false
      if (filters.delayed && getDateCategory(t.dueDate) !== 'delayed') return false
      if (filters.searchQuery) {
        const q = filters.searchQuery.toLowerCase()
        if (!t.title.toLowerCase().includes(q) && !t.description?.toLowerCase().includes(q)) return false
      }
      return true
    })

    result = result.sort((a, b) => {
      let aVal: string | number = 0
      let bVal: string | number = 0
      if (sortBy === 'dueDate') { aVal = a.dueDate ?? ''; bVal = b.dueDate ?? '' }
      else if (sortBy === 'createdAt') { aVal = a.createdAt ?? ''; bVal = b.createdAt ?? '' }
      else if (sortBy === 'modifiedDate') { aVal = a.modifiedDate ?? ''; bVal = b.modifiedDate ?? '' }
      else if (sortBy === 'title') { aVal = a.title; bVal = b.title }
      else if (sortBy === 'priority') {
        const p = { High: 0, Medium: 1, Low: 2, None: 3 }
        aVal = p[a.priority]; bVal = p[b.priority]
      }
      const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0
      return sortDir === 'asc' ? cmp : -cmp
    })

    return result
  }, [tasks, filters, sortBy, sortDir])

  const handleSort = (field: SortField) => {
    if (sortBy === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(field)
      setSortDir('asc')
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="size-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="h-full overflow-auto">
      <table className="w-full text-sm">
        <thead className="sticky top-0 z-10 bg-white dark:bg-gray-900 border-b">
          <tr>
            <th className="w-8 px-3 py-2" />
            <SortTh field="title" current={sortBy} dir={sortDir} onSort={handleSort}>
              Title
            </SortTh>
            <SortTh field="dueDate" current={sortBy} dir={sortDir} onSort={handleSort}>
              Due Date
            </SortTh>
            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 dark:text-gray-400">
              Status
            </th>
            <SortTh field="priority" current={sortBy} dir={sortDir} onSort={handleSort}>
              Priority
            </SortTh>
            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 dark:text-gray-400">
              Assignee
            </th>
            <SortTh field="createdAt" current={sortBy} dir={sortDir} onSort={handleSort}>
              Created
            </SortTh>
          </tr>
        </thead>
        <tbody>
          {filtered.map((task) => (
            <TaskRow key={task.id} task={task} memberMap={memberMap} onClick={() => setSelectedTask(task.id)} />
          ))}
          {filtered.length === 0 ? (
            <tr>
              <td colSpan={7} className="text-center py-12 text-sm text-gray-400">
                No tasks match your filters
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  )
}

interface SortThProps {
  field: SortField
  current: SortField
  dir: 'asc' | 'desc'
  onSort: (field: SortField) => void
  children: React.ReactNode
}

function SortTh({ field, current, dir, onSort, children }: SortThProps) {
  return (
    <th className="px-3 py-2 text-left">
      <button
        onClick={() => onSort(field)}
        className="flex items-center gap-1 text-xs font-semibold text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
      >
        {children}
        {current === field ? (
          <span>{dir === 'asc' ? '↑' : '↓'}</span>
        ) : null}
      </button>
    </th>
  )
}

interface TaskRowProps {
  task: Task
  memberMap: Record<string, { name: string; color?: string }>
  onClick: () => void
}

function TaskRow({ task, memberMap, onClick }: TaskRowProps) {
  const overdue = isOverdue(task.dueDate) && task.status !== 'Completed' && task.status !== 'Closed'
  const assignee = task.assignee ? memberMap[task.assignee] : null

  return (
    <tr
      onClick={onClick}
      className="border-b hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer transition-colors group"
    >
      {/* Checkbox */}
      <td className="w-8 px-3 py-2">
        <input
          type="checkbox"
          className="size-3.5 rounded accent-blue-600 opacity-0 group-hover:opacity-100"
          onClick={(e) => e.stopPropagation()}
          readOnly
        />
      </td>

      {/* Title */}
      <td className="px-3 py-2 max-w-xs">
        <span
          className={cn(
            'text-sm text-gray-900 dark:text-gray-100',
            task.status === 'Completed' && 'line-through text-gray-400'
          )}
        >
          {task.title}
        </span>
        {task.subtasks.length > 0 ? (
          <span className="ml-2 text-xs text-gray-400">
            {task.subtasks.filter((s) => s.done).length}/{task.subtasks.length}
          </span>
        ) : null}
      </td>

      {/* Due date */}
      <td className="px-3 py-2 whitespace-nowrap">
        <span className={cn('text-xs', overdue && 'text-red-500 font-medium', !overdue && 'text-gray-500')}>
          {task.dueDate ? formatDateShort(task.dueDate) : '—'}
        </span>
      </td>

      {/* Status */}
      <td className="px-3 py-2">
        <StatusBadge status={task.status} />
      </td>

      {/* Priority */}
      <td className="px-3 py-2">
        <PriorityBadge priority={task.priority} />
      </td>

      {/* Assignee */}
      <td className="px-3 py-2">
        {assignee ? (
          <div className="flex items-center gap-1.5">
            <Avatar name={assignee.name} color={assignee.color} size="xs" />
            <span className="text-xs text-gray-600 dark:text-gray-400 truncate max-w-[80px]">
              {assignee.name}
            </span>
          </div>
        ) : (
          <span className="text-xs text-gray-300">—</span>
        )}
      </td>

      {/* Created */}
      <td className="px-3 py-2 whitespace-nowrap">
        <span className="text-xs text-gray-400">{formatDateShort(task.createdAt)}</span>
      </td>
    </tr>
  )
}
