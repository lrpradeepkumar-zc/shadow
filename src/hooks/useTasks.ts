import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { Task } from '@/types'

// ── helpers ──────────────────────────────────────────────────────────────────

function rowToTask(row: Record<string, unknown>): Task {
  const data = (row.data as Record<string, unknown>) ?? {}
  return {
    id: row.id as string,
    title: (data.title ?? '') as string,
    description: data.description as string | undefined,
    notes: data.notes as string | undefined,
    status: (row.status ?? data.status ?? 'Open') as Task['status'],
    priority: (data.priority ?? 'None') as Task['priority'],
    dueDate: data.dueDate as string | undefined,
    startDate: data.startDate as string | undefined,
    completedAt: data.completedAt as string | undefined,
    assignee: (row.assignee_id ?? data.assignee) as string | undefined,
    group: (row.group_id ?? data.group) as string | undefined,
    category: data.category as string | undefined,
    tags: (data.tags as string[]) ?? [],
    subtasks: (data.subtasks as Task['subtasks']) ?? [],
    attachments: (data.attachments as Task['attachments']) ?? [],
    sharedWith: (data.sharedWith as string[]) ?? [],
    customFields: (data.customFields as Record<string, unknown>) ?? {},
    recurrence: data.recurrence as Task['recurrence'],
    reminder: data.reminder as Task['reminder'],
    createdBy: (row.owner_id ?? data.createdBy) as string,
    createdAt: (row.created_at ?? data.createdAt) as string,
    modifiedDate: (row.updated_at ?? data.modifiedDate) as string,
    order: data.order as number | undefined,
    archived: data.archived as boolean | undefined,
  }
}

function taskToRow(task: Partial<Task>): Record<string, unknown> {
  const { id, group, assignee, status, createdBy, createdAt, modifiedDate, ...rest } = task
  return {
    ...(id ? { id } : {}),
    ...(group ? { group_id: group } : {}),
    ...(assignee ? { assignee_id: assignee } : {}),
    ...(status ? { status } : {}),
    ...(createdBy ? { owner_id: createdBy } : {}),
    data: { ...rest, assignee, group, status, createdBy, createdAt, modifiedDate },
  }
}

// ── query keys ────────────────────────────────────────────────────────────────

export const taskKeys = {
  all: ['tasks'] as const,
  detail: (id: string) => ['tasks', id] as const,
}

// ── queries ───────────────────────────────────────────────────────────────────

export function useTasks() {
  return useQuery({
    queryKey: taskKeys.all,
    queryFn: async (): Promise<Task[]> => {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []).map((r) => rowToTask(r as Record<string, unknown>))
    },
  })
}

export function useTask(id: string) {
  return useQuery({
    queryKey: taskKeys.detail(id),
    queryFn: async (): Promise<Task> => {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('id', id)
        .single()
      if (error) throw error
      return rowToTask(data as Record<string, unknown>)
    },
    enabled: !!id,
  })
}

// ── mutations ─────────────────────────────────────────────────────────────────

export function useCreateTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (task: Omit<Task, 'id' | 'createdAt' | 'modifiedDate'>): Promise<Task> => {
      const now = new Date().toISOString()
      const row = taskToRow({ ...task, createdAt: now, modifiedDate: now })
      const { data, error } = await supabase.from('tasks').insert(row).select().single()
      if (error) throw error
      return rowToTask(data as Record<string, unknown>)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: taskKeys.all }),
  })
}

export function useUpdateTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (task: Partial<Task> & { id: string }): Promise<Task> => {
      const now = new Date().toISOString()
      const row = taskToRow({ ...task, modifiedDate: now })
      const { data, error } = await supabase
        .from('tasks')
        .update(row)
        .eq('id', task.id)
        .select()
        .single()
      if (error) throw error
      return rowToTask(data as Record<string, unknown>)
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: taskKeys.all })
      qc.invalidateQueries({ queryKey: taskKeys.detail(vars.id) })
    },
  })
}

export function useDeleteTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const { error } = await supabase.from('tasks').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: taskKeys.all }),
  })
}

export function useCompleteTask() {
  const update = useUpdateTask()
  return useMutation({
    mutationFn: (id: string) =>
      update.mutateAsync({ id, status: 'Completed', completedAt: new Date().toISOString() }),
  })
}

// ── realtime ──────────────────────────────────────────────────────────────────

export function useTasksRealtime() {
  const qc = useQueryClient()
  useEffect(() => {
    const channel = supabase
      .channel('tasks-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => {
        qc.invalidateQueries({ queryKey: taskKeys.all })
      })
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [qc])
}
