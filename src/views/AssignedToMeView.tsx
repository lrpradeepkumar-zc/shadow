import { useMemo } from 'react'
import { useTasks } from '@/hooks/useTasks'
import { useGroups, useTags } from '@/hooks/useGroups'
import { useAuthStore } from '@/store/authStore'
import { useAppStore } from '@/store/appStore'
import { FilteredListView } from '@/views/FilteredListView'

export function AssignedToMeView() {
  const { user } = useAuthStore()
  const { currentDisplay, filters, sortBy, sortDir } = useAppStore()
  const { data: tasks = [], isLoading } = useTasks()
  const { data: groups = [] } = useGroups()
  const { data: tags = [] } = useTags()

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
      if (!user || t.assignee !== user.id) return false
      if (filters.archived !== true && t.archived) return false
      if (filters.status && t.status !== filters.status) return false
      if (filters.priority && t.priority !== filters.priority) return false
      if (filters.group && t.group !== filters.group) return false
      if (filters.tag && !t.tags.includes(filters.tag)) return false
      if (filters.searchQuery) {
        const q = filters.searchQuery.toLowerCase()
        if (!t.title.toLowerCase().includes(q)) return false
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
  }, [tasks, filters, user, sortBy, sortDir])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="size-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
      </div>
    )
  }

  if (filtered.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-400">
        <span className="text-4xl">👤</span>
        <p className="text-sm">No tasks are assigned to you.</p>
      </div>
    )
  }

  return <FilteredListView tasks={filtered} memberMap={memberMap} tagMap={tagMap} display={currentDisplay} />
}
