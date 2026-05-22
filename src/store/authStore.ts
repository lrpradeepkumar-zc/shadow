import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { UserProfile, PermissionKey } from '@/types'
import { DEFAULT_PERMISSIONS } from '@/types'

interface AuthState {
  user: UserProfile | null
  isLoading: boolean
  setUser: (user: UserProfile | null) => void
  setLoading: (loading: boolean) => void
  hasPermission: (key: PermissionKey) => boolean
  clear: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isLoading: true,
      setUser: (user) => set({ user }),
      setLoading: (isLoading) => set({ isLoading }),
      hasPermission: (key) => {
        const { user } = get()
        if (!user) return false
        return DEFAULT_PERMISSIONS[user.role]?.[key] ?? false
      },
      clear: () => set({ user: null }),
    }),
    {
      name: 'shadow-auth',
      partialize: (state) => ({ user: state.user }),
    }
  )
)
