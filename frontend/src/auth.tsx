import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { api, ApiError, type Profile, type User } from './api/client'

interface AuthState {
  loading: boolean
  user: User | null
  profile: Profile | null
  refresh: () => Promise<void>
  setProfile: (p: Profile) => void
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)

  const refresh = useCallback(async () => {
    try {
      setUser(await api.me())
      try {
        setProfile(await api.getProfile())
      } catch (e) {
        if (!(e instanceof ApiError && e.status === 404)) throw e
        setProfile(null)
      }
    } catch {
      setUser(null)
      setProfile(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const logout = useCallback(async () => {
    await api.logout()
    setUser(null)
    setProfile(null)
  }, [])

  return (
    <AuthContext.Provider value={{ loading, user, profile, refresh, setProfile, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
