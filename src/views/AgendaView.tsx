import { useMemo } from 'react'
import { useTasks, useTasksRealtime } from '@/hooks/useTasks'
import { useGroups, useTags } from '@/hooks/useGroups'
import { useAppStore } from '@/store/appStore'
import { TaskCard } from '@/components/task/TaskCard'
import { getDateCategory } from '@/utils/date'
import type { Task, DateCategory } from '@/types'

const SECTION_ORDER: DateCategory[] = ['delayed', 'today', 'week', 'month', 'upcoming', 'noDate']

const SECTION_LABELS: Record<DateCategory, string> = {
  delayed: '⚠ Delayed',
  today: '☀ Today',
  week: '📅 This Week',
  month: '🗓 This Month',
  upcoming: '🔮 Upcoming',
  noDate: '◦ No Date',
}

const SECTION_COLORS: Partial<Record<DateCategory, string>> = {
  delayed: 'border-l-red-400',
  today: 'border-l-amber-400',
}

export function AgendaView() {
  useTasksRealtime()

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

  const sections = useMemo(() => {
    let filtered = tasks.filter((t) => {
      if (t.archived) return false
      if (t.status === 'Completed' || t.status === 'Closed') return false
      if (filters.group && t.group !== filters.group) return false
      if (filters.tag && !t.tags.includes(filters.tag)) return false
      if (filters.assignee && t.assignee !== filters.assignee) return false
      if (filters.status && t.status !== filters.status) return false
      if (filters.priority && t.priority !== filters.priority) return false
      if (filters.searchQuery) {
        const q = filters.searchQuery.toLowerCase()
        if (!t.title.toLowerCase().includes(q)) return false
      }
      return true
    })

    filtered = filtered.sort((a, b) => {
      const aDate = a.dueDate ?? ''
      const bDate = b.dueDate ?? ''
      return sortDir === 'asc' ? aDate.localeCompare(bDate) : bDate.localeCompare(aDate)
    })

    const grouped = new Map<DateCategory, Task[]>()
    SECTION_ORDER.forEach((s) => grouped.set(s, []))
    filtered.forEach((t) => {
      const cat = getDateCategory(t.dueDate)
      grouped.get(cat)?.push(t)
    })
    return grouped
  }, [tasks, filters, sortBy, sortDir])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="size-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
      </div>
    )
  }

  const hasAnyTasks = SECTION_ORDER.some((s) => (sections.get(s)?.length ?? 0) > 0)

  if (!hasAnyTasks) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-400">
        <span className="text-4xl">✓</span>
        <p className="text-sm">All caught up! No pending tasks.</p>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto py-6 px-4 space-y-8">
        {SECTION_ORDER.map((section) => {
          const sectionTasks = sections.get(section) ?? []
          if (sectionTasks.length === 0) return null
          return (
            <AgendaSection
              key={section}
              category={section}
              tasks={sectionTasks}
              memberMap={memberMap}
              tagMap={tagMap}
            />
          )
        })}
      </div>
    </div>
  )
}

interface AgendaSectionProps {
  category: DateCategory
  tasks: Task[]
  memberMap: Record<string, { name: string; color?: string }>
  tagMap: Record<string, { name: string; color: string }>
}

function AgendaSection({ category, tasks, memberMap, tagMap }: AgendaSectionProps) {
  const borderColor = SECTION_COLORS[category] ?? 'border-l-gray-300'

  return (
    <section>
      <div className={`flex items-center gap-2 mb-3 pl-3 border-l-2 ${borderColor}`}>
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
          {SECTION_LABELS[category]}
        </h2>
        <span className="text-xs text-gray-400 bg-gray-100 dark:bg-gray-800 rounded-full px-1.5 py-0.5">
          {tasks.length}
        </span>
      </div>
      <div className="space-y-2">
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            memberMap={memberMap}
            tagMap={tagMap}
          />
        ))}
      </div>
    </section>
  )
}
