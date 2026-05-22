import { cn } from '@/utils/cn'
import { useAppStore, type ViewId } from '@/store/appStore'
import { useGroups, useTags } from '@/hooks/useGroups'
import { useAuthStore } from '@/store/authStore'
import { Avatar } from '@/components/ui/Avatar'
import { signOut } from '@/hooks/useAuth'

interface NavItemProps {
  id: ViewId
  label: string
  icon: string
  active: boolean
  onClick: () => void
}

function NavItem({ label, icon, active, onClick }: NavItemProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-2.5 px-3 py-1.5 rounded-md text-sm transition-colors text-left',
        active
          ? 'bg-blue-50 text-blue-700 font-medium dark:bg-blue-900/20 dark:text-blue-400'
          : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
      )}
    >
      <span className="text-base w-4 text-center">{icon}</span>
      <span className="truncate">{label}</span>
    </button>
  )
}

export function Sidebar() {
  const { currentView, setView, activeGroupId, setActiveGroup, theme, setTheme } = useAppStore()
  const { user } = useAuthStore()
  const { data: groups = [] } = useGroups()
  const { data: tags = [] } = useTags()

  const personalViews: Array<{ id: ViewId; label: string; icon: string }> = [
    { id: 'agenda', label: 'Agenda', icon: '📅' },
    { id: 'myday', label: 'My Day', icon: '☀️' },
    { id: 'createdbyme', label: 'Created by Me', icon: '✏️' },
    { id: 'assignedtome', label: 'Assigned to Me', icon: '👤' },
    { id: 'sharedwithme', label: 'Shared with Me', icon: '🤝' },
    { id: 'personal', label: 'Personal', icon: '🔒' },
    { id: 'unified', label: 'All Tasks', icon: '📋' },
  ]

  return (
    <aside className="flex flex-col bg-white dark:bg-gray-900 border-r h-full overflow-hidden">
      {/* Header */}
      <div className="h-12 flex items-center px-4 border-b shrink-0">
        <span className="text-base font-semibold text-gray-900 dark:text-gray-100">Shadow</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {/* Personal views */}
        <div className="mb-2">
          {personalViews.map((v) => (
            <NavItem
              key={v.id}
              id={v.id}
              label={v.label}
              icon={v.icon}
              active={currentView === v.id && !activeGroupId}
              onClick={() => { setView(v.id) }}
            />
          ))}
        </div>

        {/* Groups */}
        {groups.length > 0 ? (
          <div className="mt-4">
            <p className="px-3 mb-1 text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-600">
              Groups
            </p>
            {groups.map((g) => (
              <button
                key={g.id}
                onClick={() => setActiveGroup(g.id)}
                className={cn(
                  'w-full flex items-center gap-2.5 px-3 py-1.5 rounded-md text-sm transition-colors text-left',
                  activeGroupId === g.id && currentView === 'group'
                    ? 'bg-blue-50 text-blue-700 font-medium dark:bg-blue-900/20 dark:text-blue-400'
                    : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
                )}
              >
                <span className="text-base w-4 text-center">👥</span>
                <span className="truncate">{g.name}</span>
              </button>
            ))}
          </div>
        ) : null}

        {/* Tags */}
        {tags.length > 0 ? (
          <div className="mt-4">
            <p className="px-3 mb-1 text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-600">
              Tags
            </p>
            {tags.map((t) => (
              <button
                key={t.id}
                onClick={() => useAppStore.getState().setFilters({ tag: t.id })}
                className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-md text-sm transition-colors text-left text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
              >
                <span
                  className="size-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: t.color }}
                />
                <span className="truncate">{t.name}</span>
              </button>
            ))}
          </div>
        ) : null}
      </nav>

      {/* Footer */}
      <div className="shrink-0 border-t p-2 space-y-1">
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-md text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 transition-colors"
        >
          <span>{theme === 'dark' ? '☀️' : '🌙'}</span>
          <span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
        </button>

        {user ? (
          <div className="flex items-center gap-2 px-3 py-1.5">
            <Avatar name={user.name} color={user.color} size="sm" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate text-gray-900 dark:text-gray-100">{user.name}</p>
              <p className="text-[10px] text-gray-400 capitalize">{user.role}</p>
            </div>
            <button
              onClick={signOut}
              className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              title="Sign out"
            >
              ↩
            </button>
          </div>
        ) : null}
      </div>
    </aside>
  )
}
