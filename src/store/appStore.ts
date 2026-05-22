import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { TaskFilters, GroupByField, SortField, SortDir } from '@/types'

export type ViewId =
  | 'agenda'
  | 'myday'
  | 'createdbyme'
  | 'assignedtome'
  | 'sharedwithme'
  | 'personal'
  | 'unified'
  | 'group'

export type DisplayMode = 'board' | 'list'

interface AppState {
  currentView: ViewId
  currentDisplay: DisplayMode
  activeGroupId: string | null
  sortBy: SortField
  sortDir: SortDir
  groupBy: GroupByField
  filters: TaskFilters
  selectedTaskId: string | null
  selectedBulkTaskIds: string[]
  sidebarCollapsed: boolean
  theme: 'light' | 'dark'

  setView: (view: ViewId) => void
  setDisplay: (display: DisplayMode) => void
  setActiveGroup: (groupId: string | null) => void
  setSortBy: (field: SortField) => void
  setSortDir: (dir: SortDir) => void
  setGroupBy: (field: GroupByField) => void
  setFilters: (filters: Partial<TaskFilters>) => void
  clearFilters: () => void
  setSelectedTask: (id: string | null) => void
  toggleBulkTask: (id: string) => void
  clearBulkSelection: () => void
  setSidebarCollapsed: (collapsed: boolean) => void
  setTheme: (theme: 'light' | 'dark') => void
}

const DEFAULT_FILTERS: TaskFilters = {
  group: null,
  tag: null,
  assignee: null,
  createdBy: null,
  status: null,
  priority: null,
  delayed: false,
  archived: false,
  searchQuery: '',
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      currentView: 'agenda',
      currentDisplay: 'board',
      activeGroupId: null,
      sortBy: 'dueDate',
      sortDir: 'desc',
      groupBy: 'dueDate',
      filters: DEFAULT_FILTERS,
      selectedTaskId: null,
      selectedBulkTaskIds: [],
      sidebarCollapsed: false,
      theme: 'dark',

      setView: (view) => set({ currentView: view, selectedTaskId: null }),
      setDisplay: (currentDisplay) => set({ currentDisplay }),
      setActiveGroup: (activeGroupId) => set({ activeGroupId, currentView: 'group' }),
      setSortBy: (sortBy) => set({ sortBy }),
      setSortDir: (sortDir) => set({ sortDir }),
      setGroupBy: (groupBy) => set({ groupBy }),
      setFilters: (filters) =>
        set((state) => ({ filters: { ...state.filters, ...filters } })),
      clearFilters: () => set({ filters: DEFAULT_FILTERS }),
      setSelectedTask: (selectedTaskId) => set({ selectedTaskId }),
      toggleBulkTask: (id) =>
        set((state) => {
          const ids = state.selectedBulkTaskIds
          return {
            selectedBulkTaskIds: ids.includes(id)
              ? ids.filter((x) => x !== id)
              : [...ids, id],
          }
        }),
      clearBulkSelection: () => set({ selectedBulkTaskIds: [] }),
      setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
      setTheme: (theme) => {
        set({ theme })
        document.documentElement.classList.toggle('dark', theme === 'dark')
        localStorage.setItem('shadow-theme', theme)
      },
    }),
    {
      name: 'shadow-app',
      partialize: (state) => ({
        currentView: state.currentView,
        currentDisplay: state.currentDisplay,
        sortBy: state.sortBy,
        sortDir: state.sortDir,
        groupBy: state.groupBy,
        sidebarCollapsed: state.sidebarCollapsed,
        theme: state.theme,
      }),
    }
  )
)
