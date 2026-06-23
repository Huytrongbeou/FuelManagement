import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import * as userRepo from '../repositories/auth.repository'
import type { LoginDto, LoginResponse, UserPayload, UserRole } from '../models/auth.types'

function loadJwtSecret(): string {
  const s = process.env.JWT_SECRET ?? process.env.AUTH_JWT_SECRET ?? ''
  if (!s || s.length < 32 || s.toLowerCase().includes('change_me')) {
    console.error('FATAL: JWT_SECRET missing, too short, or using placeholder value. Exiting.')
    process.exit(1)
  }
  return s
}

const JWT_SECRET = loadJwtSecret()
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

  const payload: UserPayload = {
    id: user.id,
    username: user.username,
    role: user.role as UserRole,
    isActive: user.isActive,
  }
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'] })

  return { token, expiresIn: JWT_EXPIRES_IN, user: payload }
}

export async function me(userId: string): Promise<UserPayload> {
  const user = await userRepo.findById(userId)
  if (!user || !user.isActive) {
    throw Object.assign(new Error('User not found'), { status: 404 })
  }
  return { id: user.id, username: user.username, role: user.role as UserRole, isActive: user.isActive }
}

export function verifyToken(token: string): UserPayload {
  try {
    return jwt.verify(token, JWT_SECRET) as UserPayload
  } catch {
    throw Object.assign(new Error('Invalid token'), { status: 401 })
  }
}
