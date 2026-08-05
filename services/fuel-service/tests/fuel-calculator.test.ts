// Unit test cho determineFuelStatus — phủ đủ 12 dòng bảng chân lý của A2 (giờ tự chủ).
// Repo chưa có test framework, nên dùng node:assert + chạy một lượt (xem package.json "test:unit").
// Chạy: cd services/fuel-service && npm run test:unit
import assert from 'node:assert/strict'
import { determineFuelStatus } from '../src/helpers/fuel-calculator'

// [#, fuel, rate, expected] — khớp đúng bảng ở A2-PLAN.md mục 2
const cases: Array<[string, number | null, number | null, string]> = [
  ['1',  21,    15,   'red'],     // 1.40h — ca kinh điển: quy tắc lít cũ cho 'green'
  ['2',  21,    2.5,  'green'],   // 8.40h
  ['3',  120,   15,   'yellow'],  // 8.00h — biên trên: đúng 8h là VÀNG, không phải xanh
  ['4',  120.1, 15,   'green'],   // 8.006h — ngay trên biên
  ['5',  60,    15,   'yellow'],  // 4.00h — biên dưới: đúng 4h là VÀNG, không phải đỏ
  ['6',  59.9,  15,   'red'],     // 3.99h — ngay dưới biên
  ['7',  0,     15,   'red'],     // 0h — cạn sạch
  ['8',  null,  15,   'gray'],    // chưa có tồn
  ['9',  50,    0,    'gray'],    // rate = 0: KHÔNG được thành 'green' (Infinity > 8)
  ['10', 50,    null, 'gray'],    // thiếu định mức
  ['11', 300,   14,   'green'],   // 21.4h — đầy bình lớn nhất
  ['12', 25,    2.5,  'green'],   // 10.0h — đầy bình Honda
]

let failed = 0
for (const [id, fuel, rate, expected] of cases) {
  const got = determineFuelStatus(fuel, rate)
  const ok = got === expected
  if (!ok) failed++
  console.log(`${ok ? 'PASS' : 'FAIL'}  #${id.padStart(2)}  fuel=${String(fuel).padStart(5)} rate=${String(rate).padStart(4)}  -> ${got}  (expect ${expected})`)
}

console.log('')
assert.equal(failed, 0, `${failed}/${cases.length} case sai`)
console.log(`Tất cả ${cases.length} case đúng.`)
