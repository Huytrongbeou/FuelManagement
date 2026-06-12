import API from './client'

export interface UserPayload {
  id: string
  username: string
  isActive: boolean
}

export async function login(username: string, password: string): Promise<{ token: string; user: UserPayload }> {
  const { data } = await API.post('/api/auth/login', { username, password })
  return data
}

export async function me(): Promise<UserPayload> {
  const { data } = await API.get('/api/auth/me')
  return data
}
