import ExcelJS from 'exceljs'
import { parseCellAsNumber, parseCellAsString, parseCellAsDate } from '../utils/excelParser'
import { haversineDistance } from '../utils/haversine'

interface GeneratorTypeInfo {
  id: string
  typeName: string
  consumptionRate: number
}

interface ExistingStation {
  stationCode: string
  latitude?: number | null
  longitude?: number | null
}

export interface ParsedRow {
  rowNum: number
  stationCode: string
  stationName: string
  address: string
  latitude: number | null
  longitude: number | null
  generatorTypeName: string
  consumptionRateExcel: number | null
  consumptionRateDb: number | null     // resolved from DB for existing types
  maxCapacity: number | null
  fuelAdded: number | null
  hoursRun: number | null
  actualFuel: number | null
  recordedDate: Date | null
  notes: string
  isNewStation: boolean
  isNewGeneratorType: boolean
  hasFuelActivity: boolean
  errors: string[]
  warnings: string[]
}

export async function parseAndValidate(
  buffer: Buffer,
  existingStations: ExistingStation[],
  existingGenTypes: GeneratorTypeInfo[],
  importDate: Date
): Promise<ParsedRow[]> {
  const wb = new ExcelJS.Workbook()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await wb.xlsx.load(buffer as any)
  const ws = wb.worksheets[0]
  if (!ws) throw new Error('Excel file has no worksheets')

  const genTypeMap = new Map(existingGenTypes.map(g => [g.typeName, g]))
  const stationCodeMap = new Map(existingStations.map(s => [s.stationCode, s]))
  const seenCodes = new Set<string>()
  const rows: ParsedRow[] = []

  ws.eachRow((row, rowNum) => {
    if (rowNum === 1) return // header

    const stationCode = parseCellAsString(row.getCell(1))
    const stationName = parseCellAsString(row.getCell(2))
    const address = parseCellAsString(row.getCell(3))
    const latParsed = parseCellAsNumber(row.getCell(4))
    const lonParsed = parseCellAsNumber(row.getCell(5))
    const generatorTypeName = parseCellAsString(row.getCell(6))
    const maxCapParsed = parseCellAsNumber(row.getCell(7))
    const consumptionRateParsed = parseCellAsNumber(row.getCell(8))
    const fuelAddedParsed = parseCellAsNumber(row.getCell(9))
    const hoursRunParsed = parseCellAsNumber(row.getCell(10))
    const actualFuelParsed = parseCellAsNumber(row.getCell(11))
    const dateCell = row.getCell(12)
    const notes = parseCellAsString(row.getCell(13))

    if (!stationCode && !stationName && !generatorTypeName) return // blank row

    const errors: string[] = []
    const warnings: string[] = []

    // Rule 1, 2: station_code
    if (!stationCode) errors.push('Mã trạm là bắt buộc')
    else if (stationCode.length > 50) errors.push('Mã trạm tối đa 50 ký tự')

    // Rule 17: duplicate in file
    if (stationCode && seenCodes.has(stationCode)) {
      errors.push(`Mã trạm "${stationCode}" bị trùng trong file`)
    }
    if (stationCode) seenCodes.add(stationCode)

    const isNewStation = !stationCodeMap.has(stationCode)

    // Rule 3: station_name for new station
    if (isNewStation && !stationName) errors.push('Tên trạm là bắt buộc cho trạm mới')

    // Rules 4-7: lat/lon
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

    // Rule 8: max_capacity
    let maxCapacity: number | null = null
    if (maxCapParsed.type === 'invalid') errors.push(`Dung tích tối đa không hợp lệ: "${maxCapParsed.raw}"`)
    else if (maxCapParsed.type === 'valid') {
      if (maxCapParsed.value <= 0) errors.push('Dung tích tối đa phải > 0')
      else maxCapacity = maxCapParsed.value
    }

    // Generator type + consumption_rate
    const existingGenType = genTypeMap.get(generatorTypeName)
    const isNewGeneratorType = !existingGenType

    let consumptionRateExcel: number | null = null
    let consumptionRateDb: number | null = null

    if (consumptionRateParsed.type === 'invalid') {
      errors.push(`Định mức tiêu thụ không hợp lệ: "${consumptionRateParsed.raw}"`)
    } else if (consumptionRateParsed.type === 'valid') {
      consumptionRateExcel = consumptionRateParsed.value
    }

    if (isNewGeneratorType) {
      // Rule 9: new type requires consumption_rate
      if (consumptionRateExcel == null || consumptionRateExcel <= 0) {
        errors.push(`Loại máy phát mới "${generatorTypeName}" cần nhập định mức tiêu thụ hợp lệ (> 0)`)
      }
    } else {
      // Rule 10: existing type — warn if different, always use DB rate
      consumptionRateDb = existingGenType!.consumptionRate
      if (consumptionRateExcel != null && Math.abs(consumptionRateExcel - consumptionRateDb) > 0.0005) {
        warnings.push(`Định mức ${generatorTypeName} trong Excel (${consumptionRateExcel} L/giờ) khác hệ thống (${consumptionRateDb} L/giờ). Dùng định mức hệ thống.`)
      }
    }

    // Fuel fields (rules 11-12)
    let fuelAdded: number | null = null
    let hoursRun: number | null = null
    let actualFuel: number | null = null

    if (fuelAddedParsed.type === 'invalid') errors.push(`Nhiên liệu bổ sung không hợp lệ: "${fuelAddedParsed.raw}"`)
    else if (fuelAddedParsed.type === 'valid') {
      if (fuelAddedParsed.value < 0) errors.push('Nhiên liệu bổ sung không thể âm')
      else fuelAdded = fuelAddedParsed.value
    }

    if (hoursRunParsed.type === 'invalid') errors.push(`Số giờ chạy không hợp lệ: "${hoursRunParsed.raw}"`)
    else if (hoursRunParsed.type === 'valid') {
      if (hoursRunParsed.value < 0) errors.push('Số giờ chạy không thể âm')
      else hoursRun = hoursRunParsed.value
    }

    if (actualFuelParsed.type === 'invalid') errors.push(`Nhiên liệu tồn không hợp lệ: "${actualFuelParsed.raw}"`)
    else if (actualFuelParsed.type === 'valid') {
      if (actualFuelParsed.value < 0) errors.push('Nhiên liệu tồn không thể âm')
      else if (maxCapacity != null && actualFuelParsed.value > maxCapacity) errors.push(`Nhiên liệu tồn (${actualFuelParsed.value}) vượt dung tích (${maxCapacity})`)
      else actualFuel = actualFuelParsed.value
    }

    const hasFuelActivity = fuelAdded != null || hoursRun != null || actualFuel != null

    // Rule 16: new station with activity but no actual_fuel
    if (isNewStation && hasFuelActivity && actualFuel == null) {
      errors.push('Trạm mới cần nhập Nhiên liệu tồn ban đầu')
    }

    // Rule: recorded_date
    let recordedDate: Date | null = parseCellAsDate(dateCell)
    if (!recordedDate && hasFuelActivity) {
      recordedDate = importDate  // default to import date if activity exists
    }

    // Rule 18: haversine check (only for new stations with lat/lon)
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
      address,
      latitude,
      longitude,
      generatorTypeName,
      consumptionRateExcel,
      consumptionRateDb,
      maxCapacity,
      fuelAdded,
      hoursRun,
      actualFuel,
      recordedDate,
      notes,
      isNewStation,
      isNewGeneratorType,
      hasFuelActivity,
      errors,
      warnings,
    })
  })

  return rows
}
