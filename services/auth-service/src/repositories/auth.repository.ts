import { prisma } from '../lib/prisma'

export async function findByUsername(username: string) {
  return prisma.user.findUnique({ where: { username } })
}

export async function findById(id: string) {
  return prisma.user.findUnique({ where: { id } })
}
