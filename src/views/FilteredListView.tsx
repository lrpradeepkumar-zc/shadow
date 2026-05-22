import { useMemo } from 'react'
import { TaskCard } from '@/components/task/TaskCard'
import { PriorityBadge, StatusBadge } from '@/components/ui/Badge'
import { Avatar } from '@/components/ui/Avatar'
import { formatDateShort, isOverdue } from '@/utils/date'
import { cn } from '@/utils/cn'
import { useAppStore } from '@/store/appStore'
import type { Task, Status, SortField } from '@/types'

const STATUS_COLUMNS: Status[] = ['Open', 'In Progress', 'Fixed', 'Completed', 'Closed']

const STATUS_COLORS: Record<Status, string> = {
  Open: 'bg-gray-50 dark:bg-gray-900/50',
  'In Progress': 'bg-blue-50/50 dark:bg-blue-900/10',
  Fixed: 'bg-purple-50/50 dark:bg-purple-900/10',
  Completed: 'bg-green-50/50 dark:bg-green-900/10',
  Closed: 'bg-gray-100 dark:bg-gray-900/70',
}

interface FilteredListViewProps {
  tasks: Task[]
  memberMap: Record<string, { name: string; color?: string }>
  tagMap: Record<string, { name: string; color: string }>
  display: 'board' | 'list'
}

export function FilteredListView({ tasks, memberMap, tagMap, display }: FilteredListViewProps) {
  if (display === 'list') {
    return <InlineListView tasks={tasks} memberMap={memberMap} />
  }

  return <InlineBoardView tasks={tasks} memberMap={memberMap} tagMap={tagMap} />
}

// ── Board ─────────────────────────────────────────────────────────────────────

function InlineBoardView({
  tasks,
  memberMap,
  tagMap,
}: {
  tasks: Task[]
  memberMap: Record<string, { name: string; color?: string }>
  tagMap: Record<string, { name: string; color: string }>
}) {
  const columns = useMemo(() => {
    const grouped: Record<Status, Task[]> = {
      Open: [], 'In Progress': [], Fixed: [], Completed: [], Closed: [],
    }
    tasks.forEach((t) => { grouped[t.status]?.push(t) })
    return grouped
  }, [tasks])

  return (
    <div className="h-full overflow-x-auto">
      <div className="flex gap-3 p-4 h-full min-w-max">
        {STATUS_COLUMNS.map((status) => (
          <div
            key={status}
            className={cn('flex flex-col rounded-xl w-[280px] shrink-0', STATUS_COLORS[status])}
          >
            <div className="flex items-center justify-between px-3 py-2.5">
              <span className="text-xs font-semibold text-gray-600 dark:text-gray-400">{status}</span>
              <span className="text-xs text-gray-400 bg-gray-200 dark:bg-gray-700 rounded-full px-1.5 py-0.5 font-medium">
                {columns[status].length}
              </span>
            </div>
            <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-2">
              {columns[status].map((task) => (
                <TaskCard key={task.id} task={task} memberMap={memberMap} tagMap={tagMap} />
              ))}
              {columns[status].length === 0 ? (
                <p className="text-xs text-gray-300 dark:text-gray-700 text-center py-6">No tasks</p>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── List ──────────────────────────────────────────────────────────────────────

function InlineListView({
  tasks,
  memberMap,
}: {
  tasks: Task[]
  memberMap: Record<string, { name: string; color?: string }>
}) {
  const { sortBy, sortDir, setSortBy, setSortDir, setSelectedTask } = useAppStore()

  const handleSort = (field: SortField) => {
    if (sortBy === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(field)
      setSortDir('asc')
    }
  }

  return (
    <div className="h-full overflow-auto">
      <table className="w-full text-sm">
        <thead className="sticky top-0 z-10 bg-white dark:bg-gray-900 border-b">
          <tr>
            <th className="w-8 px-3 py-2" />
            <SortTh field="title" current={sortBy} dir={sortDir} onSort={handleSort}>Title</SortTh>
            <SortTh field="dueDate" current={sortBy} dir={sortDir} onSort={handleSort}>Due Date</SortTh>
            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 dark:text-gray-400">Status</th>
            <SortTh field="priority" current={sortBy} dir={sortDir} onSort={handleSort}>Priority</SortTh>
            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 dark:text-gray-400">Assignee</th>
            <SortTh field="createdAt" current={sortBy} dir={sortDir} onSort={handleSort}>Created</SortTh>
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => (
            <TaskRowItem
              key={task.id}
              task={task}
              memberMap={memberMap}
              onClick={() => setSelectedTask(task.id)}
            />
          ))}
          {tasks.length === 0 ? (
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
        {current === field ? <span>{dir === 'asc' ? '↑' : '↓'}</span> : null}
      </button>
    </th>
  )
}

function TaskRowItem({
  task,
  memberMap,
  onClick,
}: {
  task: Task
  memberMap: Record<string, { name: string; color?: string }>
  onClick: () => void
}) {
  const overdue = isOverdue(task.dueDate) && task.status !== 'Completed' && task.status !== 'Closed'
  const assignee = task.assignee ? memberMap[task.assignee] : null

  return (
    <tr
      onClick={onClick}
      className="border-b hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer transition-colors group"
    >
      <td className="w-8 px-3 py-2">
        <input
          type="checkbox"
          className="size-3.5 rounded accent-blue-600 opacity-0 group-hover:opacity-100"
          onClick={(e) => e.stopPropagation()}
          readOnly
        />
      </td>
      <td className="px-3 py-2 max-w-xs">
        <span className={cn('text-sm text-gray-900 dark:text-gray-100', task.status === 'Completed' && 'line-through text-gray-400')}>
          {task.title}
        </span>
        {task.subtasks.length > 0 ? (
          <span className="ml-2 text-xs text-gray-400">
            {task.subtasks.filter((s) => s.done).length}/{task.subtasks.length}
          </span>
        ) : null}
      </td>
      <td className="px-3 py-2 whitespace-nowrap">
        <span className={cn('text-xs', overdue ? 'text-red-500 font-medium' : 'text-gray-500')}>
          {task.dueDate ? formatDateShort(task.dueDate) : '—'}
        </span>
      </td>
      <td className="px-3 py-2"><StatusBadge status={task.status} /></td>
      <td className="px-3 py-2"><PriorityBadge priority={task.priority} /></td>
      <td className="px-3 py-2">
        {assignee ? (
          <div className="flex items-center gap-1.5">
            <Avatar name={assignee.name} color={assignee.color} size="xs" />
            <span className="text-xs text-gray-600 dark:text-gray-400 truncate max-w-[80px]">{assignee.name}</span>
          </div>
        ) : (
          <span className="text-xs text-gray-300">—</span>
        )}
      </td>
      <td className="px-3 py-2 whitespace-nowrap">
        <span className="text-xs text-gray-400">{formatDateShort(task.createdAt)}</span>
      </td>
    </tr>
  )
}
