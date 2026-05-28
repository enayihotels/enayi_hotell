import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { setAuthTokens, clearAuthTokens } from '@/utils/api'

interface User {
  id: string; email: string; first_name: string; last_name: string;
  full_name: string; phone?: string; role: string; is_verified: boolean;
  date_joined: string; loyalty_points: number; newsletter: boolean;
  avatar?: string; nationality?: string; date_of_birth?: string;
}

interface AuthState {
  user: User | null; isAuthenticated: boolean; isLoading: boolean;
  login: (user: User, access: string, refresh: string) => void;
  logout: () => void;
  updateUser: (partial: Partial<User>) => void;
  setLoading: (v: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null, isAuthenticated: false, isLoading: false,
      login: (user, access, refresh) => {
        setAuthTokens(access, refresh)
        set({ user, isAuthenticated: true })
      },
      logout: () => {
        clearAuthTokens()
        set({ user: null, isAuthenticated: false })
      },
      updateUser: (partial) => set((s) => ({ user: s.user ? { ...s.user, ...partial } : null })),
      setLoading: (isLoading) => set({ isLoading }),
    }),
    { name: 'enayi-auth', partialize: (s) => ({ user: s.user, isAuthenticated: s.isAuthenticated }) }
  )
)
