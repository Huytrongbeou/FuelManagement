export interface UserPayload {
  id: string
  username: string
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
