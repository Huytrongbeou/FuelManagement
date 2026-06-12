import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import { login as apiLogin } from '../api/auth'
import type { UserPayload } from '../api/auth'

interface AuthContextValue {
  user: UserPayload | null
  token: string | null
  login: (username: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserPayload | null>(() => {
    const u = localStorage.getItem('user')
    return u ? (JSON.parse(u) as UserPayload) : null
  })
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'))

  const login = useCallback(async (username: string, password: string) => {
    const result = await apiLogin(username, password)
    localStorage.setItem('token', result.token)
    localStorage.setItem('user', JSON.stringify(result.user))
    setToken(result.token)
    setUser(result.user)
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setToken(null)
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, token, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
