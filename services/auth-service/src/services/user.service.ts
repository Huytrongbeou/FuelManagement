import bcrypt from 'bcryptjs'
import * as userRepo from '../repositories/user.repository'
import * as authRepo from '../repositories/auth.repository'

const ROLES = ['admin', 'manager', 'staff']
const MIN_PASSWORD_LENGTH = 8
const BCRYPT_ROUNDS = 10
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function fail(message: string, status = 400) {
  return Object.assign(new Error(message), { status })
}

export interface CreateUserDto {
  username?: unknown
  password?: unknown
  role?: unknown
}

export interface UpdateUserDto {
  role?: unknown
  isActive?: unknown
  password?: unknown
}

export async function listUsers() {
  return userRepo.findAll()
}

export async function createUser(dto: CreateUserDto) {
  const username = String(dto.username ?? '').trim()
  const password = String(dto.password ?? '')
  const role = String(dto.role ?? 'staff')

  if (!username) throw fail('Tên đăng nhập là bắt buộc')
  if (!ROLES.includes(role)) throw fail('Vai trò không hợp lệ')
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw fail(`Mật khẩu phải có ít nhất ${MIN_PASSWORD_LENGTH} ký tự`)
  }
  if (await authRepo.findByUsername(username)) {
    throw fail('Tên đăng nhập đã tồn tại', 409)
  }

  return userRepo.createUser({
    username,
    passwordHash: await bcrypt.hash(password, BCRYPT_ROUNDS),
    role,
  })
}

/**
 * `actorId` is the admin making the change. Two things are refused outright, because both end
 * with nobody able to administer the system: an admin stripping their own access, and the last
 * active admin being demoted or disabled by anyone.
 */
export async function updateUser(id: string, dto: UpdateUserDto, actorId: string) {
  // Checked before hitting Prisma: the id column is uuid, so a malformed id raises a driver
  // error that would surface to the caller as a 500 carrying internal file paths.
  if (!UUID_RE.test(id)) throw fail('Không tìm thấy người dùng', 404)

  const target = await authRepo.findById(id)
  if (!target) throw fail('Không tìm thấy người dùng', 404)

  const data: { role?: string; isActive?: boolean; passwordHash?: string } = {}

  if (dto.role !== undefined) {
    const role = String(dto.role)
    if (!ROLES.includes(role)) throw fail('Vai trò không hợp lệ')
    if (id === actorId && role !== target.role) {
      throw fail('Không thể tự đổi vai trò của chính mình', 422)
    }
    data.role = role
  }

  if (dto.isActive !== undefined) {
    const isActive = Boolean(dto.isActive)
    if (id === actorId && !isActive) {
      throw fail('Không thể tự vô hiệu hóa tài khoản của mình', 422)
    }
    data.isActive = isActive
  }

  if (dto.password !== undefined) {
    const password = String(dto.password)
    if (password.length < MIN_PASSWORD_LENGTH) {
      throw fail(`Mật khẩu phải có ít nhất ${MIN_PASSWORD_LENGTH} ký tự`)
    }
    data.passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS)
  }

  if (Object.keys(data).length === 0) throw fail('Không có thay đổi nào để lưu')

  const wasActiveAdmin = target.role === 'admin' && target.isActive
  const willBeAdmin = (data.role ?? target.role) === 'admin'
  const willBeActive = data.isActive ?? target.isActive
  if (wasActiveAdmin && !(willBeAdmin && willBeActive)) {
    if ((await userRepo.countOtherActiveAdmins(id)) === 0) {
      throw fail('Hệ thống phải còn ít nhất một quản trị viên đang hoạt động', 422)
    }
  }

  return userRepo.updateUser(id, data)
}

/**
 * Deactivate rather than delete: fuel records and import jobs record who performed them by
 * username, and those trails should keep resolving to a real account. Reversible by setting
 * isActive back to true.
 */
export async function deactivateUser(id: string, actorId: string) {
  return updateUser(id, { isActive: false }, actorId)
}
