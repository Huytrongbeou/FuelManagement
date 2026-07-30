import { prisma } from '../lib/prisma'

export async function findMany(includeInactive: boolean) {
  return prisma.employee.findMany({
    where: includeInactive ? undefined : { isActive: true },
    orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
  })
}

export async function findById(id: string) {
  return prisma.employee.findUnique({ where: { id } })
}

export async function create(data: { name: string; phone?: string | null }) {
  return prisma.employee.create({ data })
}

export async function update(id: string, data: { name?: string; phone?: string | null; isActive?: boolean }) {
  return prisma.employee.update({ where: { id }, data })
}
