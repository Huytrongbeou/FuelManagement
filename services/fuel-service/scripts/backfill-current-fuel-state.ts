// One-shot backfill for active stations missing CurrentFuelState.
//
// Default (no flags): dry-run only — lists affected stations, makes no changes.
// This is the only mode allowed to run automatically as part of deploy.
//
// --apply --confirm-zero : manual, human-run only. Initializes every listed
//   station's fuel state to 0 L. Never run this unattended — a station that
//   actually has fuel in its tank would start reporting 0 until its next
//   real update, which can trigger false "empty tank" alerts.
//
// Usage:
//   npx ts-node-dev --transpile-only scripts/backfill-current-fuel-state.ts
//   npx ts-node-dev --transpile-only scripts/backfill-current-fuel-state.ts --apply --confirm-zero

import axios from 'axios'
import { prisma } from '../src/config/prisma'
import { initCurrentState } from '../src/services/current-state-init.service'

const STATION_URL = process.env.STATION_SERVICE_URL || 'http://localhost:3002'

interface StationDto {
  id: string
  stationCode: string
  stationName: string
  consumptionRate: number
  maxCapacity: number
  isActive: boolean
}

async function main() {
  const args = process.argv.slice(2)
  const apply = args.includes('--apply')
  const confirmZero = args.includes('--confirm-zero')

  const { data: stations } = await axios.get<StationDto[]>(`${STATION_URL}/stations`, { params: { active: 'true' } })
  const existingStates = await prisma.currentFuelState.findMany({ select: { stationId: true } })
  const existingIds = new Set(existingStates.map(s => s.stationId))

  const missing = stations.filter(s => !existingIds.has(s.id))

  if (missing.length === 0) {
    console.log('No active stations missing CurrentFuelState. Nothing to do.')
    return
  }

  console.log(`Found ${missing.length} active station(s) missing CurrentFuelState:`)
  for (const s of missing) {
    console.log(`  - ${s.stationCode} (${s.stationName}) id=${s.id}`)
  }

  if (!apply) {
    console.log('\nDry-run only — no changes made.')
    console.log('Re-run with --apply --confirm-zero to initialize the stations listed above to 0 L.')
    return
  }

  if (!confirmZero) {
    console.log('\n--apply requires --confirm-zero: this acknowledges every station listed above')
    console.log('will be initialized to 0 L because no real initial fuel level was supplied.')
    console.log('If any of these stations actually has fuel in its tank, use the Station Detail')
    console.log('page to set the correct value instead — do not zero-fill it here.')
    return
  }

  for (const s of missing) {
    const result = await initCurrentState({
      stationId: s.id,
      stationCode: s.stationCode,
      consumptionRate: Number(s.consumptionRate),
      maxCapacity: Number(s.maxCapacity),
      initialFuel: 0,
    })
    console.log(`  ${result.created ? 'Initialized' : 'Already existed (race)'}: ${s.stationCode} = 0 L`)
  }
}

main()
  .catch(err => { console.error(err); process.exit(1) })
  .finally(() => prisma.$disconnect())
