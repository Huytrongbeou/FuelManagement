export type UserRole = 'admin' | 'manager' | 'staff'

export interface UserPayload {
  id: string
  username: string
  role: UserRole
  isActive: boolean
}

export interface LoginDto {
  username: string
  password: string
}

export interface LoginResponse {
  token: string
  expiresIn: string
  user: UserPayload
}
