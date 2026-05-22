import { useAppStore } from '@/store/appStore'
import { Button } from '@/components/ui/Button'
import { cn } from '@/utils/cn'
import type { SortField, GroupByField } from '@/types'

const VIEW_LABELS: Record<string, string> = {
  agenda: 'Agenda',
  myday: 'My Day',
  createdbyme: 'Created by Me',
  assignedtome: 'Assigned to Me',
  sharedwithme: 'Shared with Me',
  personal: 'Personal',
  unified: 'All Tasks',
  group: 'Group',
}

interface HeaderProps {
  onCreateTask?: () => void
}

export function Header({ onCreateTask }: HeaderProps) {
  const {
    currentView,
    currentDisplay,
    setDisplay,
    sortBy,
    sortDir,
    setSortBy,
    setSortDir,
    groupBy,
    setGroupBy,
    filters,
    setFilters,
  } = useAppStore()

  const viewLabel = VIEW_LABELS[currentView] ?? currentView

  return (
    <header className="col-span-2 h-12 flex items-center gap-3 px-4 border-b bg-white dark:bg-gray-900 shrink-0">
      <h1 className="text-sm font-semibold text-gray-900 dark:text-gray-100 min-w-max">
        {viewLabel}
      </h1>

      {/* Search */}
      <input
        type="search"
        placeholder="Search tasks…"
        value={filters.searchQuery ?? ''}
        onChange={(e) => setFilters({ searchQuery: e.target.value })}
        className={cn(
          'h-7 flex-1 max-w-xs rounded-md border bg-gray-50 px-3 text-xs',
          'placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500',
          'dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100'
        )}
      />

      <div className="flex items-center gap-1 ml-auto">
        {/* Group by */}
        <select
          value={groupBy}
          onChange={(e) => setGroupBy(e.target.value as GroupByField)}
          className="h-7 rounded border bg-transparent px-2 text-xs text-gray-600 dark:text-gray-400 dark:border-gray-700 focus:outline-none"
          title="Group by"
        >
          <option value="dueDate">Group: Date</option>
          <option value="priority">Group: Priority</option>
          <option value="status">Group: Status</option>
          <option value="assignee">Group: Assignee</option>
          <option value="category">Group: Category</option>
          <option value="group">Group: Group</option>
        </select>

        {/* Sort */}
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortField)}
          className="h-7 rounded border bg-transparent px-2 text-xs text-gray-600 dark:text-gray-400 dark:border-gray-700 focus:outline-none"
          title="Sort by"
        >
          <option value="dueDate">Sort: Due Date</option>
          <option value="createdAt">Sort: Created</option>
          <option value="modifiedDate">Sort: Modified</option>
          <option value="priority">Sort: Priority</option>
          <option value="title">Sort: Title</option>
        </select>

        <button
          onClick={() => setSortDir(sortDir === 'asc' ? 'desc' : 'asc')}
          className="size-7 flex items-center justify-center rounded border text-xs text-gray-600 dark:text-gray-400 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800"
          title={`Sort ${sortDir === 'asc' ? 'descending' : 'ascending'}`}
        >
          {sortDir === 'asc' ? '↑' : '↓'}
        </button>

        {/* Display toggle */}
        <div className="flex items-center border rounded-md overflow-hidden dark:border-gray-700">
          <button
            onClick={() => setDisplay('board')}
            className={cn(
              'h-7 px-2 text-xs flex items-center gap-1 transition-colors',
              currentDisplay === 'board'
                ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
                : 'text-gray-500 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800'
            )}
          >
            ⊞ Board
          </button>
          <button
            onClick={() => setDisplay('list')}
            className={cn(
              'h-7 px-2 text-xs flex items-center gap-1 transition-colors border-l dark:border-gray-700',
              currentDisplay === 'list'
                ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
                : 'text-gray-500 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800'
            )}
          >
            ≡ List
          </button>
        </div>

        {/* New task */}
        <Button variant="primary" size="sm" onClick={onCreateTask}>
          + New Task
        </Button>
      </div>
    </header>
  )
}
