import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import type { UserProfile, UserRole } from '@/types'

export function useAuthInit() {
  const { setUser, setLoading } = useAuthStore()

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const profile = await fetchProfile(session.user.id)
        setUser(profile)
      } else {
        setUser(null)
      }
      setLoading(false)
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        const profile = await fetchProfile(session.user.id)
        setUser(profile)
      } else if (event === 'SIGNED_OUT') {
        setUser(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [setUser, setLoading])
}

async function fetchProfile(userId: string): Promise<UserProfile> {
  const { data } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single()

  if (data) {
    return {
      id: data.id as string,
      name: data.name as string,
      email: data.email as string,
      role: (data.role as UserRole) ?? 'member',
      avatar: data.avatar as string | undefined,
      color: data.color as string | undefined,
    }
  }

  // Fallback: build profile from auth user
  const { data: { user } } = await supabase.auth.getUser()
  return {
    id: userId,
    name: user?.user_metadata?.name as string ?? user?.email?.split('@')[0] ?? 'User',
    email: user?.email ?? '',
    role: 'member',
  }
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}

export async function signUp(email: string, password: string, name: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { name } },
  })
  if (error) throw error
  return data
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}
