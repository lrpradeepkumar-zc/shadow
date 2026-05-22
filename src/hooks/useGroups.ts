import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Group, Tag, Member, Category, CustomField } from '@/types'

export const groupKeys = {
  all: ['groups'] as const,
  detail: (id: string) => ['groups', id] as const,
}

export const tagKeys = {
  all: ['tags'] as const,
}

function rowToGroup(row: Record<string, unknown>): Group {
  const data = (row.data as Record<string, unknown>) ?? {}
  return {
    id: row.id as string,
    name: (row.name ?? data.name ?? '') as string,
    type: (row.type ?? data.type ?? 'personal') as Group['type'],
    owner: (row.owner_id ?? data.owner) as string | null | undefined,
    description: data.description as string | undefined,
    createdAt: (row.created_at ?? data.createdAt) as string,
    members: (data.members as Member[]) ?? [],
    categories: (data.categories as Category[]) ?? [],
    customFields: (data.customFields as CustomField[]) ?? [],
    settings: (data.settings as Group['settings']) ?? {
      approvalWorkflowEnabled: false,
      defaultApprover: null,
      mandateApproval: false,
    },
  }
}

export function useGroups() {
  return useQuery({
    queryKey: groupKeys.all,
    queryFn: async (): Promise<Group[]> => {
      const { data, error } = await supabase
        .from('groups')
        .select('*')
        .order('created_at', { ascending: true })
      if (error) throw error
      return (data ?? []).map((r) => rowToGroup(r as Record<string, unknown>))
    },
  })
}

export function useGroup(id: string) {
  return useQuery({
    queryKey: groupKeys.detail(id),
    queryFn: async (): Promise<Group> => {
      const { data, error } = await supabase.from('groups').select('*').eq('id', id).single()
      if (error) throw error
      return rowToGroup(data as Record<string, unknown>)
    },
    enabled: !!id,
  })
}

export function useCreateGroup() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (group: Omit<Group, 'id' | 'createdAt'>): Promise<Group> => {
      const { data, error } = await supabase
        .from('groups')
        .insert({
          name: group.name,
          type: group.type,
          owner_id: group.owner,
          data: group,
        })
        .select()
        .single()
      if (error) throw error
      return rowToGroup(data as Record<string, unknown>)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: groupKeys.all }),
  })
}

export function useUpdateGroup() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (group: Partial<Group> & { id: string }): Promise<Group> => {
      const { data, error } = await supabase
        .from('groups')
        .update({ name: group.name, type: group.type, data: group })
        .eq('id', group.id)
        .select()
        .single()
      if (error) throw error
      return rowToGroup(data as Record<string, unknown>)
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: groupKeys.all })
      qc.invalidateQueries({ queryKey: groupKeys.detail(vars.id) })
    },
  })
}

export function useDeleteGroup() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const { error } = await supabase.from('groups').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: groupKeys.all }),
  })
}

// ── Tags ──────────────────────────────────────────────────────────────────────

function rowToTag(row: Record<string, unknown>): Tag {
  const data = (row.data as Record<string, unknown>) ?? {}
  return {
    id: row.id as string,
    name: (row.name ?? data.name ?? '') as string,
    color: (row.color ?? data.color ?? '#6b7280') as string,
    groupId: (row.group_id ?? data.groupId) as string | undefined,
  }
}

export function useTags() {
  return useQuery({
    queryKey: tagKeys.all,
    queryFn: async (): Promise<Tag[]> => {
      const { data, error } = await supabase.from('tags').select('*').order('name')
      if (error) throw error
      return (data ?? []).map((r) => rowToTag(r as Record<string, unknown>))
    },
  })
}

export function useCreateTag() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (tag: Omit<Tag, 'id'>): Promise<Tag> => {
      const { data, error } = await supabase
        .from('tags')
        .insert({ name: tag.name, color: tag.color, group_id: tag.groupId, data: tag })
        .select()
        .single()
      if (error) throw error
      return rowToTag(data as Record<string, unknown>)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: tagKeys.all }),
  })
}
