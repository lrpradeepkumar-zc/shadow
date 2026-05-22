import { cn } from '@/utils/cn'
import { formatDateShort, isOverdue, isToday } from '@/utils/date'
import { Avatar } from '@/components/ui/Avatar'
import { useAppStore } from '@/store/appStore'
import type { Task } from '@/types'

interface TaskCardProps {
  task: Task
  compact?: boolean
  className?: string
  memberMap?: Record<string, { name: string; color?: string }>
  tagMap?: Record<string, { name: string; color: string }>
}

export function TaskCard({ task, compact, className, memberMap = {}, tagMap = {} }: TaskCardProps) {
  const { setSelectedTask, selectedBulkTaskIds, toggleBulkTask } = useAppStore()
  const isSelected = selectedBulkTaskIds.includes(task.id)
  const overdue = isOverdue(task.dueDate) && task.status !== 'Completed' && task.status !== 'Closed'
  const dueToday = isToday(task.dueDate)
  const completedSubtasks = task.subtasks.filter((s) => s.done).length
  const totalSubtasks = task.subtasks.length

  const assignee = task.assignee ? memberMap[task.assignee] : null
  const visibleTags = task.tags.slice(0, 3)

  return (
    <div
      onClick={() => setSelectedTask(task.id)}
      className={cn(
        'group relative bg-white dark:bg-gray-800 rounded-lg border cursor-pointer',
        'hover:border-blue-300 dark:hover:border-blue-700 transition-colors',
        'hover:shadow-panel',
        isSelected && 'border-blue-500 ring-1 ring-blue-500',
        task.status === 'Completed' && 'opacity-60',
        compact ? 'p-2.5' : 'p-3',
        className
      )}
    >
      {/* Bulk select checkbox */}
      <div
        className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={(e) => { e.stopPropagation(); toggleBulkTask(task.id) }}
      >
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => {}}
          className="size-3.5 rounded accent-blue-600"
          aria-label="Select task"
        />
      </div>

      {/* Priority indicator */}
      <div
        className={cn(
          'absolute left-0 top-2 bottom-2 w-0.5 rounded-r',
          task.priority === 'High' && 'bg-red-500',
          task.priority === 'Medium' && 'bg-amber-500',
          task.priority === 'Low' && 'bg-green-500',
          task.priority === 'None' && 'bg-transparent'
        )}
      />

      <div className="pl-1">
        {/* Title */}
        <p
          className={cn(
            'text-sm text-gray-900 dark:text-gray-100 leading-snug',
            task.status === 'Completed' && 'line-through text-gray-400'
          )}
        >
          {task.title}
        </p>

        {/* Tags */}
        {visibleTags.length > 0 ? (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {visibleTags.map((tagId) => {
              const tag = tagMap[tagId]
              return tag ? (
                <span
                  key={tagId}
                  className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                  style={{ backgroundColor: tag.color + '20', color: tag.color }}
                >
                  {tag.name}
                </span>
              ) : null
            })}
            {task.tags.length > 3 ? (
              <span className="text-[10px] text-gray-400">+{task.tags.length - 3}</span>
            ) : null}
          </div>
        ) : null}

        {/* Footer */}
        {!compact ? (
          <div className="flex items-center justify-between mt-2.5 gap-2">
            <div className="flex items-center gap-2 min-w-0">
              {/* Due date */}
              {task.dueDate ? (
                <span
                  className={cn(
                    'text-[11px]',
                    overdue && 'text-red-500 font-medium',
                    dueToday && !overdue && 'text-amber-600 dark:text-amber-400 font-medium',
                    !overdue && !dueToday && 'text-gray-400'
                  )}
                >
                  {overdue ? '⚠ ' : dueToday ? '⏰ ' : '📅 '}
                  {formatDateShort(task.dueDate)}
                </span>
              ) : null}

              {/* Subtasks progress */}
              {totalSubtasks > 0 ? (
                <span className="text-[11px] text-gray-400">
                  ☑ {completedSubtasks}/{totalSubtasks}
                </span>
              ) : null}

              {/* Comments count */}
              {task.attachments.length > 0 ? (
                <span className="text-[11px] text-gray-400">📎 {task.attachments.length}</span>
              ) : null}
            </div>

            {/* Assignee */}
            {assignee ? (
              <Avatar name={assignee.name} color={assignee.color} size="xs" />
            ) : task.assignee ? (
              <Avatar name={task.assignee} size="xs" />
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}
