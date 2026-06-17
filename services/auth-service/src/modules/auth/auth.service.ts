import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import * as userRepo from './auth.repository'
import type { LoginDto, LoginResponse, UserPayload } from './auth.types'

const JWT_SECRET = process.env.JWT_SECRET || 'change_me_in_production'
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h'

export async function login(dto: LoginDto): Promise<LoginResponse> {
  const user = await userRepo.findByUsername(dto.username)
  if (!user || !user.isActive) {
    throw Object.assign(new Error('Invalid credentials'), { status: 401 })
  }

  const valid = await bcrypt.compare(dto.password, user.passwordHash)
  if (!valid) {
    throw Object.assign(new Error('Invalid credentials'), { status: 401 })
  }

  const payload: UserPayload = { id: user.id, username: user.username, isActive: user.isActive }
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'] })

  return { token, expiresIn: JWT_EXPIRES_IN, user: payload }
}

export async function me(userId: string): Promise<UserPayload> {
  const user = await userRepo.findById(userId)
  if (!user || !user.isActive) {
    throw Object.assign(new Error('User not found'), { status: 404 })
  }
  return { id: user.id, username: user.username, isActive: user.isActive }
}

export function verifyToken(token: string): UserPayload {
  try {
    return jwt.verify(token, JWT_SECRET) as UserPayload
  } catch {
    throw Object.assign(new Error('Invalid token'), { status: 401 })
  }
}
