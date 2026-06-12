import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const hash = await bcrypt.hash('admin123', 10)
  await prisma.user.upsert({
    where: { username: 'admin' },
    update: { passwordHash: hash, isActive: true },
    create: { username: 'admin', passwordHash: hash, isActive: true },
  })
  console.log('Auth seed done: admin/admin123')
}

main().finally(() => prisma.$disconnect())
