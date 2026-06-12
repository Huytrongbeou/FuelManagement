import type { Request, Response } from 'express'
import ExcelJS from 'exceljs'
import * as stationClient from '../clients/stationClient'
import * as fuelClient from '../clients/fuelClient'

const INPUT_HEADERS = [
  'Mã trạm', 'Tên trạm', 'Tên máy phát', 'Địa chỉ', 'Lat', 'Long',
  'Đơn vị hành chính hiện tại', 'Địa bàn cũ', 'Khu vực quản lý nội bộ',
  'Hãng máy', 'Model máy', 'Công suất kVA', 'Loại nhiên liệu',
  'Định mức tiêu hao L/giờ', 'Dung tích tối đa L',
  'Nhiên liệu bổ sung L', 'Số giờ chạy', 'Nhiên liệu tồn L',
  'Ngày ghi nhận', 'Ghi chú',
]
const SYSTEM_HEADERS = [
  'Tồn trước cập nhật L', 'Tiêu hao theo định mức L', 'Tồn hệ thống tự tính L',
  'Chênh lệch L', 'Tồn cuối cùng L', 'Trạng thái cảnh báo',
  'Ngày export', 'Mã lần import gần nhất',
]
const ALL_HEADERS = [...INPUT_HEADERS, ...SYSTEM_HEADERS]

export async function exportSnapshot(_req: Request, res: Response): Promise<void> {
  try {
    const [stations, fuelStates] = await Promise.all([
      stationClient.getAllStations({ active: 'all' }),
      fuelClient.getAllCurrentStates(),
    ])

    const fuelMap = new Map(fuelStates.map(s => [s.stationId, s]))
    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet('Nhiên liệu')

    ws.addRow(ALL_HEADERS)
    ws.getRow(1).font = { bold: true }
    ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD3D3D3' } }
    ws.views = [{ state: 'frozen', ySplit: 1 }]

    const exportDate = new Date().toISOString().slice(0, 10)

    for (const station of stations) {
      const fuel = fuelMap.get(station.id)
      ws.addRow([
        // A-T: input columns
        station.stationCode,
        station.stationName,
        station.generatorName || '',
        station.address || '',
        station.latitude ?? '',
        station.longitude ?? '',
        station.currentAdminUnitName || '',
        station.legacyAreaName || '',
        station.operationAreaName || '',
        station.brand?.name || '',
        station.model?.modelName || '',
        station.powerKva != null ? Number(station.powerKva) : '',
        station.fuelType || 'diesel',
        Number(station.consumptionRate),
        Number(station.maxCapacity),
        '', '', '',              // P-R: user fills (fuel_added, hours_run, actual_fuel)
        '',                      // S: recorded_date
        '',                      // T: notes
        // U-AB: system columns (read-only)
        fuel ? Number(fuel.currentFuel) : '',  // U: current fuel (fuel_before for next entry)
        '',                                     // V: consumed
        '',                                     // W: calculated
        '',                                     // X: difference
        fuel ? Number(fuel.currentFuel) : '',  // Y: end fuel
        fuel ? fuel.fuelStatus : '',           // Z: status
        exportDate,                             // AA
        '',                                     // AB: last import job id
      ])
    }

    // System columns U-AB: grey fill
    for (let col = 21; col <= 28; col++) {
      ws.getColumn(col).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD3D3D3' } } as ExcelJS.Fill
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', `attachment; filename="fuel-snapshot-${exportDate}.xlsx"`)
    await wb.xlsx.write(res)
    res.end()
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message })
  }
}

export async function exportTemplate(_req: Request, res: Response): Promise<void> {
  try {
    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet('Template')
    ws.addRow(INPUT_HEADERS)
    ws.getRow(1).font = { bold: true }
    ws.views = [{ state: 'frozen', ySplit: 1 }]

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', 'attachment; filename="import-template.xlsx"')
    await wb.xlsx.write(res)
    res.end()
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message })
  }
}
