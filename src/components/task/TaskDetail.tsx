import { cn } from '@/utils/cn'
import { formatDate } from '@/utils/date'
import { PriorityBadge, StatusBadge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { TaskForm } from './TaskForm'
import { useTask, useDeleteTask, useCompleteTask } from '@/hooks/useTasks'
import { useAppStore } from '@/store/appStore'
import { useAuthStore } from '@/store/authStore'
import { useState } from 'react'

export function TaskDetail() {
  const { selectedTaskId, setSelectedTask } = useAppStore()
  const { hasPermission } = useAuthStore()
  const [editing, setEditing] = useState(false)

  const { data: task, isLoading } = useTask(selectedTaskId ?? '')
  const deleteTask = useDeleteTask()
  const completeTask = useCompleteTask()

  if (!selectedTaskId) return null

  return (
    <aside
      className={cn(
        'fixed right-0 top-12 bottom-0 w-[480px] bg-white dark:bg-gray-900 border-l',
        'flex flex-col shadow-modal z-20 overflow-hidden'
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b shrink-0">
        <h2 className="flex-1 text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
          {task?.title ?? 'Task Details'}
        </h2>
        <button
          onClick={() => setSelectedTask(null)}
          className="size-7 flex items-center justify-center rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800"
          aria-label="Close"
        >
          ×
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="size-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
          </div>
        ) : task ? (
          editing ? (
            <TaskForm
              task={task}
              onSuccess={() => setEditing(false)}
              onCancel={() => setEditing(false)}
            />
          ) : (
            <div className="space-y-4">
              {/* Status + Priority */}
              <div className="flex items-center gap-2">
                <StatusBadge status={task.status} />
                <PriorityBadge priority={task.priority} />
              </div>

              {/* Description */}
              {task.description ? (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">Description</p>
                  <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                    {task.description}
                  </p>
                </div>
              ) : null}

              {/* Meta fields */}
              <dl className="grid grid-cols-2 gap-3 text-sm">
                {task.dueDate ? (
                  <>
                    <dt className="text-xs text-gray-500">Due Date</dt>
                    <dd className="text-xs text-gray-900 dark:text-gray-100">
                      {formatDate(task.dueDate)}
                    </dd>
                  </>
                ) : null}
                {task.startDate ? (
                  <>
                    <dt className="text-xs text-gray-500">Start Date</dt>
                    <dd className="text-xs text-gray-900 dark:text-gray-100">
                      {formatDate(task.startDate)}
                    </dd>
                  </>
                ) : null}
                <dt className="text-xs text-gray-500">Created</dt>
                <dd className="text-xs text-gray-900 dark:text-gray-100">
                  {formatDate(task.createdAt)}
                </dd>
              </dl>

              {/* Subtasks */}
              {task.subtasks.length > 0 ? (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-2">
                    Subtasks ({task.subtasks.filter((s) => s.done).length}/{task.subtasks.length})
                  </p>
                  <div className="space-y-1.5">
                    {task.subtasks.map((sub) => (
                      <div key={sub.id} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={sub.done}
                          readOnly
                          className="size-3.5 rounded accent-blue-600"
                        />
                        <span
                          className={cn(
                            'text-sm',
                            sub.done && 'line-through text-gray-400'
                          )}
                        >
                          {sub.title}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          )
        ) : (
          <p className="text-sm text-gray-400 text-center mt-8">Task not found</p>
        )}
      </div>

      {/* Actions */}
      {task && !editing ? (
        <div className="shrink-0 border-t p-3 flex gap-2">
          {hasPermission('editTask') ? (
            <Button size="sm" onClick={() => setEditing(true)}>
              Edit
            </Button>
          ) : null}
          {task.status !== 'Completed' ? (
            <Button
              size="sm"
              variant="primary"
              onClick={() => completeTask.mutate(task.id)}
              loading={completeTask.isPending}
            >
              Complete
            </Button>
          ) : null}
          {hasPermission('deleteTask') ? (
            <Button
              size="sm"
              variant="danger"
              className="ml-auto"
              onClick={async () => {
                await deleteTask.mutateAsync(task.id)
                setSelectedTask(null)
              }}
              loading={deleteTask.isPending}
            >
              Delete
            </Button>
          ) : null}
        </div>
      ) : null}
    </aside>
  )
}
