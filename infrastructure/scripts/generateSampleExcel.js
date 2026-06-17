/**
 * Generate a sample Excel file for testing the import feature.
 * Run: node scripts/generateSampleExcel.js
 *
 * Column layout (28 cols):
 * A  Mã trạm              (required)
 * B  Tên trạm             (required for new station)
 * C  Tên máy phát
 * D  Địa chỉ
 * E  Lat
 * F  Long
 * G  Đơn vị hành chính hiện tại
 * H  Địa bàn cũ
 * I  Khu vực quản lý nội bộ
 * J  Hãng máy
 * K  Model máy
 * L  Công suất kVA
 * M  Loại nhiên liệu
 * N  Định mức tiêu hao L/giờ  (required for new station, > 0)
 * O  Dung tích tối đa L       (required for new station, > 0)
 * P  Nhiên liệu bổ sung L
 * Q  Số giờ chạy
 * R  Nhiên liệu tồn L         (required for new station with fuel activity)
 * S  Ngày ghi nhận
 * T  Ghi chú
 * U-AB  (hệ thống tự tính — để trống khi import)
 */

const ExcelJS = require('../services/import-export-service/node_modules/exceljs')
const path = require('path')
const fs = require('fs')

const OUTPUT = path.join(__dirname, 'mau_import_nhien_lieu.xlsx')

const HEADERS = [
  'Mã trạm',
  'Tên trạm',
  'Tên máy phát',
  'Địa chỉ',
  'Lat',
  'Long',
  'Đơn vị hành chính hiện tại',
  'Địa bàn cũ',
  'Khu vực quản lý nội bộ',
  'Hãng máy',
  'Model máy',
  'Công suất kVA',
  'Loại nhiên liệu',
  'Định mức tiêu hao L/giờ',
  'Dung tích tối đa L',
  'Nhiên liệu bổ sung L',
  'Số giờ chạy',
  'Nhiên liệu tồn L',
  'Ngày ghi nhận',
  'Ghi chú',
  // System cols (U-AB) — read-only, backend ignores these
  'Tồn trước cập nhật L',
  'Tiêu hao theo định mức L',
  'Tồn hệ thống tự tính L',
  'Chênh lệch L',
  'Tồn cuối cùng L',
  'Trạng thái cảnh báo',
  'Ngày export',
  'Mã lần import gần nhất',
]

// Sample data rows
// date: 2026-06-13
const TODAY = new Date(2026, 5, 13) // month is 0-indexed

const rows = [
  // ── EXISTING STATIONS — chỉ cập nhật nhiên liệu ──────────────────────────
  // CL-001: nhập thêm + giờ chạy (không cần điền tên/thông số nếu trạm đã có)
  {
    stationCode: 'CL-001', stationName: '', generatorName: '', address: '',
    lat: null, lng: null,
    adminUnit: '', legacyArea: '', opArea: '',
    brand: '', model: '', powerKva: null, fuelType: '',
    rate: null, maxCap: null,
    fuelAdded: 50, hoursRun: 5, actualFuel: null,
    date: TODAY,
    notes: 'Nạp đầu sau khi vận hành 5 giờ',
  },
  // CL-003: nhập thêm + kiểm kê thực tế
  {
    stationCode: 'CL-003', stationName: '', generatorName: '', address: '',
    lat: null, lng: null,
    adminUnit: '', legacyArea: '', opArea: '',
    brand: '', model: '', powerKva: null, fuelType: '',
    rate: null, maxCap: null,
    fuelAdded: 80, hoursRun: 8, actualFuel: 210,
    date: TODAY,
    notes: 'Kiểm kê cuối ngày',
  },
  // CL-005: chỉ kiểm kê tồn thực (không bổ sung)
  {
    stationCode: 'CL-005', stationName: '', generatorName: '', address: '',
    lat: null, lng: null,
    adminUnit: '', legacyArea: '', opArea: '',
    brand: '', model: '', powerKva: null, fuelType: '',
    rate: null, maxCap: null,
    fuelAdded: 0, hoursRun: 3, actualFuel: 120,
    date: TODAY,
    notes: '',
  },
  // CL-007: cập nhật số giờ chạy + bổ sung nhiên liệu
  {
    stationCode: 'CL-007', stationName: '', generatorName: '', address: '',
    lat: null, lng: null,
    adminUnit: '', legacyArea: '', opArea: '',
    brand: '', model: '', powerKva: null, fuelType: '',
    rate: null, maxCap: null,
    fuelAdded: 30, hoursRun: 4, actualFuel: null,
    date: TODAY,
    notes: '',
  },

  // ── NEW STATION — cần điền đầy đủ thông tin bắt buộc ────────────────────
  // CL-013: trạm mới, có nhiên liệu ban đầu
  {
    stationCode: 'CL-013', stationName: 'Trạm Phường 11', generatorName: 'Máy phát Phường 11',
    address: '45 Đường Nguyễn Huệ, Phường 11',
    lat: 10.4612, lng: 105.6401,
    adminUnit: 'TP. Cao Lãnh', legacyArea: 'Phường 11 cũ', opArea: 'Cao Lãnh trung tâm',
    brand: 'Cummins', model: 'C100D5', powerKva: 100, fuelType: 'diesel',
    rate: 10, maxCap: 200,          // bắt buộc cho trạm mới
    fuelAdded: 150, hoursRun: 0, actualFuel: 150,  // actualFuel bắt buộc cho trạm mới
    date: TODAY,
    notes: 'Trạm mới đưa vào vận hành',
  },
  // CL-014: trạm mới, chưa có nhiên liệu (chỉ đăng ký thông tin)
  {
    stationCode: 'CL-014', stationName: 'Trạm Mỹ Tân', generatorName: 'Máy phát Mỹ Tân',
    address: '12 Đường Lý Thường Kiệt, Phường Mỹ Tân',
    lat: 10.4530, lng: 105.6290,
    adminUnit: 'TP. Cao Lãnh', legacyArea: 'Tịnh Thới cũ', opArea: 'Ven trung tâm',
    brand: 'Denyo', model: 'DCA-60ESI', powerKva: 60, fuelType: 'diesel',
    rate: 6.5, maxCap: 120,         // bắt buộc cho trạm mới
    fuelAdded: null, hoursRun: null, actualFuel: null,  // không có hoạt động nhiên liệu
    date: null,
    notes: 'Đăng ký trạm mới, chưa vận hành',
  },
]

async function main() {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Nhập nhiên liệu')

  // ── Header row ──────────────────────────────────────────────────────────
  const headerRow = ws.addRow(HEADERS)
  headerRow.eachCell((cell, colNum) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1D4ED8' } }
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
    cell.border = {
      top: { style: 'thin' }, bottom: { style: 'thin' },
      left: { style: 'thin' }, right: { style: 'thin' }
    }
    // System cols (U=21 → colNum 21+) — different color to indicate read-only
    if (colNum >= 21) {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF64748B' } }
    }
  })
  headerRow.height = 30

  // ── Data rows ───────────────────────────────────────────────────────────
  rows.forEach((r, i) => {
    const isNew = ['CL-013', 'CL-014'].includes(r.stationCode)
    const dataRow = ws.addRow([
      r.stationCode,
      r.stationName,
      r.generatorName,
      r.address,
      r.lat,
      r.lng,
      r.adminUnit,
      r.legacyArea,
      r.opArea,
      r.brand,
      r.model,
      r.powerKva,
      r.fuelType,
      r.rate,
      r.maxCap,
      r.fuelAdded,
      r.hoursRun,
      r.actualFuel,
      r.date,
      r.notes,
      // System cols (U-AB) — empty
      null, null, null, null, null, null, null, null,
    ])

    const rowBg = isNew ? 'FFEFF6FF' : (i % 2 === 0 ? 'FFFFFFFF' : 'FFF8FAFC')
    dataRow.eachCell({ includeEmpty: true }, (cell, colNum) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colNum >= 21 ? 'FFF1F5F9' : rowBg } }
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      }
      cell.alignment = { vertical: 'middle' }
      if (colNum >= 21) {
        cell.font = { color: { argb: 'FF94A3B8' }, italic: true }
      }
    })

    // Format date cell (col 19 = S)
    if (r.date) {
      const dateCell = dataRow.getCell(19)
      dateCell.numFmt = 'dd/mm/yyyy'
    }
  })

  // ── Column widths ────────────────────────────────────────────────────────
  const widths = [
    10, 22, 22, 28, 10, 10, 20, 18, 20,
    12, 14, 12, 10, 16, 14,
    14, 12, 14, 14, 20,
    14, 18, 18, 12, 14, 14, 14, 20,
  ]
  widths.forEach((w, i) => { ws.getColumn(i + 1).width = w })

  // Freeze header row
  ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 1 }]

  // ── Legend sheet ─────────────────────────────────────────────────────────
  const legend = wb.addWorksheet('Hướng dẫn')
  const notes = [
    ['HƯỚNG DẪN NHẬP LIỆU'],
    [],
    ['Cột', 'Header', 'Bắt buộc', 'Mô tả'],
    ['A', 'Mã trạm', 'Luôn bắt buộc', 'Mã duy nhất, VD: CL-001'],
    ['B', 'Tên trạm', 'Bắt buộc với trạm MỚI', 'Tên đầy đủ của trạm'],
    ['C', 'Tên máy phát', 'Không', 'Tên máy phát điện'],
    ['D', 'Địa chỉ', 'Không', 'Địa chỉ trạm'],
    ['E', 'Lat', 'Không', 'Vĩ độ (-90 đến 90), VD: 10.4574'],
    ['F', 'Long', 'Không', 'Kinh độ (-180 đến 180), VD: 105.6379'],
    ['G', 'Đơn vị hành chính', 'Không', 'VD: TP. Cao Lãnh'],
    ['H', 'Địa bàn cũ', 'Không', 'VD: Phường 1 cũ'],
    ['I', 'Khu vực quản lý', 'Không', 'VD: Cao Lãnh trung tâm'],
    ['J', 'Hãng máy', 'Không', 'VD: Cummins, Denyo, Mitsubishi'],
    ['K', 'Model máy', 'Không', 'VD: C100D5'],
    ['L', 'Công suất kVA', 'Không', 'Số dương, VD: 100'],
    ['M', 'Loại nhiên liệu', 'Không', 'diesel / gasoline / other'],
    ['N', 'Định mức tiêu hao L/giờ', 'Bắt buộc với trạm MỚI', 'Số > 0, VD: 10.5'],
    ['O', 'Dung tích tối đa L', 'Bắt buộc với trạm MỚI', 'Số > 0, VD: 200'],
    ['P', 'Nhiên liệu bổ sung L', 'Không', 'Số >= 0, bỏ trống nếu không bổ sung'],
    ['Q', 'Số giờ chạy', 'Không', 'Số >= 0, giờ máy chạy trong kỳ'],
    ['R', 'Nhiên liệu tồn L', 'Bắt buộc với trạm MỚI có fuel activity', 'Kiểm kê thực tế, số >= 0'],
    ['S', 'Ngày ghi nhận', 'Không', 'dd/mm/yyyy, để trống = ngày import'],
    ['T', 'Ghi chú', 'Không', 'Ghi chú tự do'],
    [],
    ['Cột U-AB (màu xám)', '', '', 'HỆ THỐNG TỰ TÍNH — để trống khi import, backend sẽ bỏ qua'],
    [],
    ['LƯU Ý QUAN TRỌNG'],
    ['', '• Trạm CŨ: chỉ cần điền Mã trạm + số liệu nhiên liệu (cột P, Q, R)'],
    ['', '• Trạm MỚI: bắt buộc Mã trạm, Tên trạm, Định mức (N), Dung tích (O)'],
    ['', '• Trạm mới có hoạt động nhiên liệu: bắt buộc thêm Nhiên liệu tồn (R)'],
    ['', '• Không trùng Mã trạm trong cùng một file'],
  ]
  notes.forEach((row, i) => {
    const r = legend.addRow(row)
    if (i === 0) { r.font = { bold: true, size: 14 } }
    if (i === 2) { r.font = { bold: true }; r.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } } }
  })
  legend.getColumn(1).width = 12
  legend.getColumn(2).width = 26
  legend.getColumn(3).width = 30
  legend.getColumn(4).width = 50

  await wb.xlsx.writeFile(OUTPUT)
  console.log(`✓ File tạo thành công: ${OUTPUT}`)
  console.log(`  - ${rows.length} dòng dữ liệu (4 trạm cũ cập nhật nhiên liệu + 2 trạm mới)`)
  console.log(`  - Sheet "Hướng dẫn" chứa mô tả từng cột`)
}

main().catch(err => { console.error('Lỗi:', err.message); process.exit(1) })
