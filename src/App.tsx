import { useState, useEffect } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { queryClient } from '@/lib/queryClient'
import { AuthGuard } from '@/components/layout/AuthGuard'
import { Sidebar } from '@/components/layout/Sidebar'
import { Header } from '@/components/layout/Header'
import { TaskDetail } from '@/components/task/TaskDetail'
import { Modal } from '@/components/ui/Modal'
import { TaskForm } from '@/components/task/TaskForm'
import { AgendaView } from '@/views/AgendaView'
import { MyDayView } from '@/views/MyDayView'
import { BoardView } from '@/views/BoardView'
import { ListView } from '@/views/ListView'
import { CreatedByMeView } from '@/views/CreatedByMeView'
import { AssignedToMeView } from '@/views/AssignedToMeView'
import { SharedWithMeView } from '@/views/SharedWithMeView'
import { UnifiedView } from '@/views/UnifiedView'
import { GroupView } from '@/views/GroupView'
import { useAuthInit } from '@/hooks/useAuth'
import { useAppStore } from '@/store/appStore'
import { cn } from '@/utils/cn'

function AppShell() {
  useAuthInit()

  const { currentView, currentDisplay, selectedTaskId, sidebarCollapsed, theme } = useAppStore()
  const [createOpen, setCreateOpen] = useState(false)

  // Apply theme class on mount and changes
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])

  function renderMainView() {
    if (currentView === 'agenda') return <AgendaView />
    if (currentView === 'myday') return <MyDayView />
    if (currentView === 'createdbyme') return <CreatedByMeView />
    if (currentView === 'assignedtome') return <AssignedToMeView />
    if (currentView === 'sharedwithme') return <SharedWithMeView />
    if (currentView === 'unified') return <UnifiedView />
    if (currentView === 'group') return <GroupView />
    // personal view uses board/list display
    if (currentDisplay === 'list') return <ListView />
    return <BoardView />
  }

  return (
    <div
      className={cn(
        'app-shell',
        sidebarCollapsed && 'sidebar-collapsed'
      )}
    >
      {/* Sidebar spans rows 1-2 */}
      <div className="row-span-2">
        <Sidebar />
      </div>

      {/* Header */}
      <Header onCreateTask={() => setCreateOpen(true)} />

      {/* Main content */}
      <main
        className={cn(
          'overflow-hidden relative',
          selectedTaskId && 'pr-[480px]'
        )}
      >
        {renderMainView()}
      </main>

      {/* Task detail panel */}
      <TaskDetail />

      {/* Create task modal */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="New Task"
      >
        <TaskForm onSuccess={() => setCreateOpen(false)} onCancel={() => setCreateOpen(false)} />
      </Modal>
    </div>
  )
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthGuard>
        <AppShell />
      </AuthGuard>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  )
}
