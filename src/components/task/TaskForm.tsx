import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { useCreateTask, useUpdateTask } from '@/hooks/useTasks'
import { useGroups } from '@/hooks/useGroups'
import { useAuthStore } from '@/store/authStore'
import { toInputDate } from '@/utils/date'
import type { Task, Priority, Status } from '@/types'

interface TaskFormProps {
  task?: Task
  defaultGroupId?: string
  onSuccess?: () => void
  onCancel?: () => void
}

export function TaskForm({ task, defaultGroupId, onSuccess, onCancel }: TaskFormProps) {
  const { user } = useAuthStore()
  const { data: groups = [] } = useGroups()
  const createTask = useCreateTask()
  const updateTask = useUpdateTask()

  const [title, setTitle] = useState(task?.title ?? '')
  const [description, setDescription] = useState(task?.description ?? '')
  const [priority, setPriority] = useState<Priority>(task?.priority ?? 'None')
  const [status, setStatus] = useState<Status>(task?.status ?? 'Open')
  const [dueDate, setDueDate] = useState(toInputDate(task?.dueDate))
  const [groupId, setGroupId] = useState(task?.group ?? defaultGroupId ?? '')
  const [assignee] = useState(task?.assignee ?? '')
  const [error, setError] = useState('')

  const isEditing = !!task

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) { setError('Title is required'); return }
    setError('')

    const payload: Partial<Task> = {
      title: title.trim(),
      description: description || undefined,
      priority,
      status,
      dueDate: dueDate || undefined,
      group: groupId || undefined,
      assignee: assignee || undefined,
      tags: task?.tags ?? [],
      subtasks: task?.subtasks ?? [],
      attachments: task?.attachments ?? [],
      sharedWith: task?.sharedWith ?? [],
      customFields: task?.customFields ?? {},
    }

    try {
      if (isEditing) {
        await updateTask.mutateAsync({ ...payload, id: task.id })
      } else {
        await createTask.mutateAsync({
          ...payload as Omit<Task, 'id' | 'createdAt' | 'modifiedDate'>,
          createdBy: user?.id ?? '',
        })
      }
      onSuccess?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    }
  }

  const isPending = createTask.isPending || updateTask.isPending

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <Input
        label="Title"
        placeholder="Task title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        required
        autoFocus
      />

      <div>
        <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">
          Description
        </label>
        <textarea
          placeholder="Optional description…"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="w-full rounded-md border bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-800 dark:text-gray-100 dark:border-gray-700 resize-none"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Select
          label="Priority"
          value={priority}
          onChange={(e) => setPriority(e.target.value as Priority)}
        >
          <option value="None">None</option>
          <option value="Low">Low</option>
          <option value="Medium">Medium</option>
          <option value="High">High</option>
        </Select>

        <Select
          label="Status"
          value={status}
          onChange={(e) => setStatus(e.target.value as Status)}
        >
          <option value="Open">Open</option>
          <option value="In Progress">In Progress</option>
          <option value="Fixed">Fixed</option>
          <option value="Completed">Completed</option>
          <option value="Closed">Closed</option>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Due Date"
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
        />

        {groups.length > 0 ? (
          <Select
            label="Group"
            value={groupId}
            onChange={(e) => setGroupId(e.target.value)}
          >
            <option value="">No group</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </Select>
        ) : null}
      </div>

      {error ? (
        <p className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 rounded p-2">{error}</p>
      ) : null}

      <div className="flex gap-2 pt-1">
        <Button type="submit" variant="primary" loading={isPending}>
          {isEditing ? 'Save Changes' : 'Create Task'}
        </Button>
        {onCancel ? (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
      </div>
    </form>
  )
}
