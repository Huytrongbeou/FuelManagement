import { prisma } from '../config/prisma'

/** Never selects passwordHash — nothing outside auth.service has any business reading it. */
const PUBLIC_FIELDS = {
  id: true,
  username: true,
  role: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const

export async function findAll() {
  return prisma.user.findMany({
    select: PUBLIC_FIELDS,
    orderBy: [{ isActive: 'desc' }, { username: 'asc' }],
  })
}

export async function createUser(data: { username: string; passwordHash: string; role: string }) {
  return prisma.user.create({ data, select: PUBLIC_FIELDS })
}

export async function updateUser(
  id: string,
  data: { role?: string; isActive?: boolean; passwordHash?: string }
) {
  return prisma.user.update({ where: { id }, data, select: PUBLIC_FIELDS })
}

/** Guards against removing the last way into the system. */
export async function countOtherActiveAdmins(excludeId: string) {
  return prisma.user.count({ where: { role: 'admin', isActive: true, id: { not: excludeId } } })
}
