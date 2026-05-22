import { useMemo } from 'react'
import { useTasks, useTasksRealtime } from '@/hooks/useTasks'
import { useGroups, useTags } from '@/hooks/useGroups'
import { useAuthStore } from '@/store/authStore'
import { useAppStore } from '@/store/appStore'
import { TaskCard } from '@/components/task/TaskCard'
import { isToday, isOverdue } from '@/utils/date'

export function MyDayView() {
  useTasksRealtime()

  const { data: tasks = [], isLoading } = useTasks()
  const { data: groups = [] } = useGroups()
  const { data: tags = [] } = useTags()
  const { user } = useAuthStore()
  const { filters } = useAppStore()

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

  const { overdue, today } = useMemo(() => {
    const base = tasks.filter((t) => {
      if (t.archived) return false
      if (t.status === 'Completed' || t.status === 'Closed') return false
      // My Day: assigned to me OR created by me
      if (user && t.assignee !== user.id && t.createdBy !== user.id) return false
      if (filters.group && t.group !== filters.group) return false
      if (filters.tag && !t.tags.includes(filters.tag)) return false
      if (filters.priority && t.priority !== filters.priority) return false
      if (filters.searchQuery) {
        const q = filters.searchQuery.toLowerCase()
        if (!t.title.toLowerCase().includes(q)) return false
      }
      return true
    })

    return {
      overdue: base.filter((t) => isOverdue(t.dueDate)),
      today: base.filter((t) => isToday(t.dueDate)),
    }
  }, [tasks, filters, user])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="size-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
      </div>
    )
  }

  const totalCount = overdue.length + today.length

  if (totalCount === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-400">
        <span className="text-4xl">☀️</span>
        <p className="text-sm">Nothing due today. Enjoy your day!</p>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-2xl mx-auto py-6 px-4 space-y-6">
        {overdue.length > 0 ? (
          <section>
            <div className="flex items-center gap-2 mb-3 pl-3 border-l-2 border-l-red-400">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">⚠ Overdue</h2>
              <span className="text-xs text-gray-400 bg-gray-100 dark:bg-gray-800 rounded-full px-1.5 py-0.5">
                {overdue.length}
              </span>
            </div>
            <div className="space-y-2">
              {overdue.map((task) => (
                <TaskCard key={task.id} task={task} memberMap={memberMap} tagMap={tagMap} />
              ))}
            </div>
          </section>
        ) : null}

        {today.length > 0 ? (
          <section>
            <div className="flex items-center gap-2 mb-3 pl-3 border-l-2 border-l-amber-400">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">☀ Today</h2>
              <span className="text-xs text-gray-400 bg-gray-100 dark:bg-gray-800 rounded-full px-1.5 py-0.5">
                {today.length}
              </span>
            </div>
            <div className="space-y-2">
              {today.map((task) => (
                <TaskCard key={task.id} task={task} memberMap={memberMap} tagMap={tagMap} />
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  )
}
