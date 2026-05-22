import { useMemo } from 'react'
import { useTasks } from '@/hooks/useTasks'
import { useGroups, useTags } from '@/hooks/useGroups'
import { useAppStore } from '@/store/appStore'
import { TaskCard } from '@/components/task/TaskCard'
import { getDateCategory } from '@/utils/date'
import { cn } from '@/utils/cn'
import type { Task, Status } from '@/types'

const STATUS_COLUMNS: Status[] = ['Open', 'In Progress', 'Fixed', 'Completed', 'Closed']

const STATUS_COLORS: Record<Status, string> = {
  Open: 'bg-gray-50 dark:bg-gray-900/50',
  'In Progress': 'bg-blue-50/50 dark:bg-blue-900/10',
  Fixed: 'bg-purple-50/50 dark:bg-purple-900/10',
  Completed: 'bg-green-50/50 dark:bg-green-900/10',
  Closed: 'bg-gray-100 dark:bg-gray-900/70',
}

export function BoardView() {
  const { data: tasks = [], isLoading } = useTasks()
  const { data: groups = [] } = useGroups()
  const { data: tags = [] } = useTags()
  const { filters, sortBy, sortDir } = useAppStore()

  const memberMap = useMemo(() => {
    const map: Record<string, { name: string; color?: string }> = {}
    groups.forEach((g) => g.members.forEach((m) => { map[m.userId] = { name: m.name, color: m.color } }))
    return map
  }, [groups])

  const tagMap = useMemo(() => {
    const map: Record<string, { name: string; color: string }> = {}
    tags.forEach((t) => { map[t.id] = { name: t.name, color: t.color } })
    return map
  }, [tags])

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

  const columns = useMemo(() => {
    const grouped: Record<Status, Task[]> = {
      Open: [], 'In Progress': [], Fixed: [], Completed: [], Closed: [],
    }
    filtered.forEach((t) => { grouped[t.status]?.push(t) })
    return grouped
  }, [filtered])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="size-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="h-full overflow-x-auto">
      <div className="flex gap-3 p-4 h-full min-w-max">
        {STATUS_COLUMNS.map((status) => (
          <BoardColumn
            key={status}
            status={status}
            tasks={columns[status]}
            memberMap={memberMap}
            tagMap={tagMap}
          />
        ))}
      </div>
    </div>
  )
}

interface BoardColumnProps {
  status: Status
  tasks: Task[]
  memberMap: Record<string, { name: string; color?: string }>
  tagMap: Record<string, { name: string; color: string }>
}

function BoardColumn({ status, tasks, memberMap, tagMap }: BoardColumnProps) {
  return (
    <div className={cn('flex flex-col rounded-xl w-[280px] shrink-0', STATUS_COLORS[status])}>
      {/* Column header */}
      <div className="flex items-center justify-between px-3 py-2.5">
        <span className="text-xs font-semibold text-gray-600 dark:text-gray-400">{status}</span>
        <span className="text-xs text-gray-400 bg-gray-200 dark:bg-gray-700 rounded-full px-1.5 py-0.5 font-medium">
          {tasks.length}
        </span>
      </div>

      {/* Cards */}
      <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-2">
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            memberMap={memberMap}
            tagMap={tagMap}
          />
        ))}
        {tasks.length === 0 ? (
          <p className="text-xs text-gray-300 dark:text-gray-700 text-center py-6">No tasks</p>
        ) : null}
      </div>
    </div>
  )
}
