import ExcelJS from 'exceljs'
import { parseCellAsNumber, parseCellAsString, parseCellAsDate } from '../utils/excelParser'
import { haversineDistance } from '../utils/haversine'
import type { Station } from '../clients/stationClient'

export interface ParsedRow {
  rowNum: number
  stationCode: string
  stationName: string
  generatorName: string | null
  address: string
  latitude: number | null
  longitude: number | null
  currentAdminUnitName: string | null
  legacyAreaName: string | null
  operationAreaName: string | null
  brandName: string | null
  modelName: string | null
  powerKva: number | null
  fuelType: string | null
  consumptionRate: number | null
  maxCapacity: number | null
  fuelAdded: number | null
  hoursRun: number | null
  recordedDate: Date | null
  notes: string
  isNewStation: boolean
  hasFuelActivity: boolean
  errors: string[]
  warnings: string[]
}

// 26-column layout:
// A(1)  Mã trạm
// B(2)  Tên trạm
// C(3)  Tên máy phát
// D(4)  Địa chỉ
// E(5)  Lat
// F(6)  Long
// G(7)  Đơn vị hành chính hiện tại
// H(8)  Địa bàn cũ
// I(9)  Khu vực quản lý nội bộ
// J(10) Hãng máy
// K(11) Model máy
// L(12) Công suất kVA
// M(13) Loại nhiên liệu
// N(14) Định mức tiêu hao L/giờ
// O(15) Dung tích tối đa L
// P(16) Nhiên liệu bổ sung L
// Q(17) Số giờ chạy
// R(18) Ngày ghi nhận
// S(19) Ghi chú
// T-Z (20-26): system columns — IGNORED

export async function parseAndValidate(
  buffer: Buffer,
  existingStations: Station[],
  importDate: Date
): Promise<ParsedRow[]> {
  const wb = new ExcelJS.Workbook()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await wb.xlsx.load(buffer as any)
  const ws = wb.worksheets[0]
  if (!ws) throw new Error('Excel file has no worksheets')

  const stationCodeMap = new Map(existingStations.map(s => [s.stationCode, s]))
  const seenCodes = new Set<string>()
  const rows: ParsedRow[] = []

  ws.eachRow((row, rowNum) => {
    if (rowNum === 1) return // header

    const stationCode    = parseCellAsString(row.getCell(1))
    const stationName    = parseCellAsString(row.getCell(2))
    const generatorName  = parseCellAsString(row.getCell(3)) || null
    const address        = parseCellAsString(row.getCell(4))
    const latParsed      = parseCellAsNumber(row.getCell(5))
    const lonParsed      = parseCellAsNumber(row.getCell(6))
    const adminUnit      = parseCellAsString(row.getCell(7)) || null
    const legacyArea     = parseCellAsString(row.getCell(8)) || null
    const opArea         = parseCellAsString(row.getCell(9)) || null
    const brandName      = parseCellAsString(row.getCell(10)) || null
    const modelName      = parseCellAsString(row.getCell(11)) || null
    const powerKvaParsed = parseCellAsNumber(row.getCell(12))
    const fuelType       = parseCellAsString(row.getCell(13)) || null
    const rateParsed     = parseCellAsNumber(row.getCell(14))
    const maxCapParsed   = parseCellAsNumber(row.getCell(15))
    const fuelAddedP     = parseCellAsNumber(row.getCell(16))
    const hoursRunP      = parseCellAsNumber(row.getCell(17))
    const dateCell       = row.getCell(18)
    const notes          = parseCellAsString(row.getCell(19))
    // cols 20-26 (T-Z) are system/read-only — skip completely

    if (!stationCode && !stationName) return // blank row

    const errors: string[] = []
    const warnings: string[] = []

    // station_code
    if (!stationCode) errors.push('Mã trạm là bắt buộc')
    else if (stationCode.length > 50) errors.push('Mã trạm tối đa 50 ký tự')

    // duplicate in file
    if (stationCode && seenCodes.has(stationCode)) {
      errors.push(`Mã trạm "${stationCode}" bị trùng trong file`)
    }
    if (stationCode) seenCodes.add(stationCode)

    const isNewStation = !stationCodeMap.has(stationCode)

    // station_name required for new station
    if (isNewStation && !stationName) errors.push('Tên trạm là bắt buộc cho trạm mới')

    // lat/lon
    let latitude: number | null = null
    let longitude: number | null = null
    if (latParsed.type === 'invalid') errors.push(`Vĩ độ không hợp lệ: "${latParsed.raw}"`)
    else if (latParsed.type === 'valid') {
      if (latParsed.value < -90 || latParsed.value > 90) errors.push('Vĩ độ phải trong khoảng -90 đến 90')
      else latitude = latParsed.value
    }
    if (lonParsed.type === 'invalid') errors.push(`Kinh độ không hợp lệ: "${lonParsed.raw}"`)
    else if (lonParsed.type === 'valid') {
      if (lonParsed.value < -180 || lonParsed.value > 180) errors.push('Kinh độ phải trong khoảng -180 đến 180')
      else longitude = lonParsed.value
    }

    // power_kva
    let powerKva: number | null = null
    if (powerKvaParsed.type === 'invalid') errors.push(`Công suất kVA không hợp lệ: "${powerKvaParsed.raw}"`)
    else if (powerKvaParsed.type === 'valid') powerKva = powerKvaParsed.value

    // consumption_rate
    let consumptionRate: number | null = null
    if (rateParsed.type === 'invalid') errors.push(`Định mức tiêu thụ không hợp lệ: "${rateParsed.raw}"`)
    else if (rateParsed.type === 'valid') {
      if (rateParsed.value <= 0) errors.push('Định mức tiêu thụ phải > 0')
      else consumptionRate = rateParsed.value
    }
    if (isNewStation && consumptionRate == null) {
      errors.push('Trạm mới cần nhập định mức tiêu thụ (cột N)')
    }

    // max_capacity
    let maxCapacity: number | null = null
    if (maxCapParsed.type === 'invalid') errors.push(`Dung tích tối đa không hợp lệ: "${maxCapParsed.raw}"`)
    else if (maxCapParsed.type === 'valid') {
      if (maxCapParsed.value <= 0) errors.push('Dung tích tối đa phải > 0')
      else maxCapacity = maxCapParsed.value
    }
    if (isNewStation && maxCapacity == null) {
      errors.push('Trạm mới cần nhập dung tích tối đa (cột O)')
    }

    // fuel fields
    let fuelAdded: number | null = null
    let hoursRun: number | null = null

    if (fuelAddedP.type === 'invalid') errors.push(`Nhiên liệu bổ sung không hợp lệ: "${fuelAddedP.raw}"`)
    else if (fuelAddedP.type === 'valid') {
      if (fuelAddedP.value < 0) errors.push('Nhiên liệu bổ sung không thể âm')
      else fuelAdded = fuelAddedP.value
    }

    if (hoursRunP.type === 'invalid') errors.push(`Số giờ chạy không hợp lệ: "${hoursRunP.raw}"`)
    else if (hoursRunP.type === 'valid') {
      if (hoursRunP.value < 0) errors.push('Số giờ chạy không thể âm')
      else hoursRun = hoursRunP.value
    }

    const hasFuelActivity = (fuelAdded ?? 0) > 0 || (hoursRun ?? 0) > 0

    let recordedDate: Date | null = parseCellAsDate(dateCell)
    if (!recordedDate && hasFuelActivity) {
      recordedDate = importDate
    }

    // haversine proximity check
    if (isNewStation && latitude != null && longitude != null) {
      for (const [code, s] of stationCodeMap) {
        if (s.latitude == null || s.longitude == null) continue
        const dist = haversineDistance(latitude, longitude, Number(s.latitude), Number(s.longitude))
        if (dist < 20) {
          warnings.push(`Trạm "${stationCode}" cách trạm "${code}" chỉ ${dist.toFixed(1)}m (< 20m), có thể bị trùng vị trí`)
        }
      }
    }

    rows.push({
      rowNum,
      stationCode,
      stationName,
      generatorName,
      address,
      latitude,
      longitude,
      currentAdminUnitName: adminUnit,
      legacyAreaName: legacyArea,
      operationAreaName: opArea,
      brandName,
      modelName,
      powerKva,
      fuelType,
      consumptionRate,
      maxCapacity,
      fuelAdded,
      hoursRun,
      recordedDate,
      notes,
      isNewStation,
      hasFuelActivity,
      errors,
      warnings,
    })
  })

  return rows
}
