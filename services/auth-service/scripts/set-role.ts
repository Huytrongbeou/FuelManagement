/**
 * Assign a role to a user account.
 * Usage: npx ts-node --transpile-only scripts/set-role.ts --username=<user> --role=<admin|manager|staff>
 *
 * Requires DATABASE_URL in environment (or .env at auth-service root).
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const VALID_ROLES = ['admin', 'manager', 'staff'] as const
type ValidRole = typeof VALID_ROLES[number]

async function main() {
  const args = process.argv.slice(2)
  const username = args.find(a => a.startsWith('--username='))?.split('=').slice(1).join('=')
  const role = args.find(a => a.startsWith('--role='))?.split('=')[1]

  if (!username || !role) {
    console.error('Usage: npx ts-node --transpile-only scripts/set-role.ts --username=<user> --role=<admin|manager|staff>')
    process.exit(1)
  }

  if (!(VALID_ROLES as readonly string[]).includes(role)) {
    console.error(`Invalid role "${role}". Must be one of: ${VALID_ROLES.join(', ')}`)
    process.exit(1)
  }

  const user = await prisma.user.findUnique({ where: { username } })
  if (!user) {
    console.error(`User "${username}" not found.`)
    process.exit(1)
  }

  await prisma.user.update({ where: { username }, data: { role: role as ValidRole } })
  console.log(`Done: "${username}" → role "${role}"`)
}

main().finally(() => prisma.$disconnect())
