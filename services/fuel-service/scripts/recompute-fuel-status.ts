// Tính lại current_fuel_state.fuel_status theo quy tắc GIỜ TỰ CHỦ (A2).
//
// CHỈ cập nhật cột fuel_status. TUYỆT ĐỐI không đụng fuel_records (lịch sử = "hệ thống đánh giá
// thế nào tại thời điểm đó", giữ nguyên) và không đổi snapshotVersion (đây là phân loại lại, không
// phải giao dịch nhiên liệu).
//
// Mặc định: --dry-run — in bảng thay đổi + thống kê + DANH SÁCH GRAY (thiếu định mức), KHÔNG ghi gì.
// Chỉ ghi khi có --apply. Idempotent: chạy lần 2 phải ra 0 thay đổi.
//
// Chạy (từ host, đã map cổng postgres 5432 + station 3002):
//   cd services/fuel-service
//   DATABASE_URL=... STATION_SERVICE_URL=http://localhost:3002 \
//     npx ts-node-dev --transpile-only scripts/recompute-fuel-status.ts          # dry-run
//   ... --apply

import axios from 'axios'
import { prisma } from '../src/config/prisma'
import { determineFuelStatus, FUEL_AUTONOMY_GREEN_H, FUEL_AUTONOMY_YELLOW_H } from '../src/helpers/fuel-calculator'

const STATION_URL = process.env.STATION_SERVICE_URL || 'http://localhost:3002'

interface StationDto { id: string; stationCode: string; consumptionRate: number }

async function main() {
  const apply = process.argv.slice(2).includes('--apply')

  const { data: stations } = await axios.get<StationDto[]>(`${STATION_URL}/stations`, { params: { active: 'all' } })
  const rateById = new Map(stations.map(s => [s.id, Number(s.consumptionRate)]))

  const states = await prisma.currentFuelState.findMany({
    select: { stationId: true, stationCode: true, currentFuel: true, fuelStatus: true },
    orderBy: { stationCode: 'asc' },
  })

  console.log(`Quy tac: > ${FUEL_AUTONOMY_GREEN_H}h green | >= ${FUEL_AUTONOMY_YELLOW_H}h yellow | < ${FUEL_AUTONOMY_YELLOW_H}h red | rate<=0/null -> gray`)
  console.log(`Mode: ${apply ? 'APPLY (se ghi)' : 'DRY-RUN (khong ghi)'}\n`)
  console.log('code      fuel    rate  hours  old    -> new    change')

  const dir = new Map<string, number>()
  const newCount = new Map<string, number>()
  const grayInvalid: Array<{ code: string; fuel: number; rate: number | undefined }> = []
  const toUpdate: Array<{ stationId: string; neu: string }> = []

  for (const s of states) {
    const fuel = Number(s.currentFuel)
    const rate = rateById.get(s.stationId)
    const neu = determineFuelStatus(fuel, rate ?? null)
    const old = s.fuelStatus ?? '(null)'
    const hours = rate && rate > 0 ? (fuel / rate).toFixed(2) : '-'
    newCount.set(neu, (newCount.get(neu) ?? 0) + 1)
    if (neu === 'gray' && (!rate || rate <= 0)) grayInvalid.push({ code: s.stationCode, fuel, rate })
    const changed = neu !== old
    if (changed) {
      dir.set(`${old}->${neu}`, (dir.get(`${old}->${neu}`) ?? 0) + 1)
      toUpdate.push({ stationId: s.stationId, neu })
    }
    console.log(
      `${s.stationCode.padEnd(8)} ${fuel.toFixed(1).padStart(7)} ${String(rate ?? '?').padStart(5)} ${hours.padStart(6)}  ` +
      `${old.padEnd(6)} -> ${neu.padEnd(6)} ${changed ? '<== ' + old + '->' + neu : ''}`
    )
  }

  console.log(`\n== Tong: ${toUpdate.length}/${states.length} tram doi mau ==`)
  for (const [d, n] of [...dir.entries()].sort()) console.log(`   ${d}: ${n}`)
  console.log(`== Phan bo theo quy tac moi: ${JSON.stringify(Object.fromEntries([...newCount.entries()].sort()))}`)

  console.log('')
  if (grayInvalid.length) {
    console.log(`!!! ${grayInvalid.length} TRAM GRAY vi consumptionRate khong hop le (THIEU DU LIEU MASTER — can bo sung):`)
    for (const g of grayInvalid) console.log(`   - ${g.code}: fuel=${g.fuel}, rate=${g.rate}`)
  } else {
    console.log('(Khong tram nao gray vi rate xau.)')
  }

  if (!apply) {
    console.log('\nDRY-RUN — khong ghi gi. Chay lai voi --apply de cap nhat current_fuel_state.fuel_status.')
    return
  }

  let updated = 0
  for (const u of toUpdate) {
    await prisma.currentFuelState.update({ where: { stationId: u.stationId }, data: { fuelStatus: u.neu } })
    updated++
  }
  console.log(`\n--apply: da cap nhat ${updated} tram (chi cot fuel_status; snapshotVersion + fuel_records KHONG dung).`)
}

main()
  .catch(err => { console.error(err); process.exit(1) })
  .finally(() => prisma.$disconnect())
