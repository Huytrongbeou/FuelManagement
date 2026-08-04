// Idempotently seed the E2E test accounts (admin / manager / staff) into auth_db.
//
// WHY: the monorepo's auth seed only creates `admin/admin123`. The kit needs three
// accounts whose passwords match this kit's .env — previously provisioned by hand,
// which is exactly the kind of manual DB step that makes a kit un-runnable later.
//
// HOW: hashing + upsert run *inside* the running `fuel_auth` container, reusing its
// bcryptjs + Prisma client + schema — so this script needs no extra deps here and
// never guesses column names. Safe to run repeatedly (upsert).
//
// PREREQ: the backend stack is up (container `fuel_auth` healthy). Run:
//   node scripts/seed-test-accounts.mjs

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// Minimal .env parser (kit already depends on dotenv, but keep this standalone).
const env = Object.fromEntries(
  readFileSync(resolve(root, '.env'), 'utf8')
    .split(/\r?\n/)
    .filter((l) => /^[A-Za-z_][A-Za-z0-9_]*=/.test(l))
    // strip surrounding quotes: .env values like ADMIN_PASSWORD="Vnpt#123" are common
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^(['"])([\s\S]*)\1$/, '$2')]; })
);

const users = [
  ['admin', env.ADMIN_USERNAME, env.ADMIN_PASSWORD],
  ['manager', env.MANAGER_USERNAME, env.MANAGER_PASSWORD],
  ['staff', env.STAFF_USERNAME, env.STAFF_PASSWORD],
];

// Runs in fuel_auth; reads U/P/R from env so no secrets land in argv or logs.
const snippet = `
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
(async () => {
  const prisma = new PrismaClient();
  const passwordHash = await bcrypt.hash(process.env.P, 10);
  await prisma.user.upsert({
    where: { username: process.env.U },
    update: { passwordHash, role: process.env.R, isActive: true },
    create: { username: process.env.U, passwordHash, role: process.env.R, isActive: true },
  });
  await prisma.$disconnect();
  console.log('  seeded ' + process.env.U + ' (' + process.env.R + ')');
})().catch((e) => { console.error(e.message); process.exit(1); });
`;

for (const [role, username, password] of users) {
  if (!username || !password) {
    console.error(`Missing ${role.toUpperCase()}_USERNAME/PASSWORD in .env`);
    process.exit(1);
  }
  execFileSync(
    'docker',
    ['exec', '-e', `U=${username}`, '-e', `P=${password}`, '-e', `R=${role}`, 'fuel_auth', 'node', '-e', snippet],
    { stdio: 'inherit' }
  );
}

console.log('Test accounts seeded (admin/manager/staff). You can now run the kit.');
