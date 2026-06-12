import type { Request, Response } from 'express'
import ExcelJS from 'exceljs'
import * as stationClient from '../clients/stationClient'
import * as fuelClient from '../clients/fuelClient'

export async function exportSnapshot(_req: Request, res: Response): Promise<void> {
  try {
    const [stations, fuelStates] = await Promise.all([
      stationClient.getAllStations(),
      fuelClient.getAllCurrentStates(),
    ])

    const fuelMap = new Map(fuelStates.map(s => [s.stationId, s]))
    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet('Nhiên liệu')

    // Headers A-U
    const headers = [
      'Mã trạm', 'Tên trạm', 'Địa chỉ', 'Lat', 'Long',
      'Loại máy phát', 'Dung tích tối đa (L)', 'Định mức (L/giờ)',
      'Nhiên liệu bổ sung (L)', 'Số giờ chạy', 'Nhiên liệu tồn (L)', 'Ngày ghi nhận', 'Ghi chú',
      'Tồn trước cập nhật (L)', 'Tiêu hao theo định mức (L)', 'Tồn hệ thống tự tính (L)',
      'Chênh lệch (L)', 'Tồn cuối cùng (L)', 'Trạng thái cảnh báo', 'Ngày export', 'Mã lần import gần nhất',
    ]
    ws.addRow(headers)

    // Style header row
    ws.getRow(1).font = { bold: true }
    ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD3D3D3' } }
    ws.views = [{ state: 'frozen', ySplit: 1 }]

    const exportDate = new Date().toISOString().slice(0, 10)

    for (const station of stations) {
      const fuel = fuelMap.get(station.id)
      ws.addRow([
        station.stationCode,
        station.stationName,
        station.address || '',
        station.latitude ?? '',
        station.longitude ?? '',
        station.generatorType?.typeName || '',
        Number(station.maxCapacity),
        Number(station.generatorType?.consumptionRate || 0),
        '', '', '', '', '',  // I-M: user fills
        '',  // N: fuel_before — system fills on next import
        '',  // O: fuel_consumed
        '',  // P: fuel_calculated
        '',  // Q: fuel_difference
        fuel ? Number(fuel.currentFuel) : '',  // R: current fuel
        fuel ? fuel.fuelStatus : 'unknown',    // S: status
        exportDate,
        '',  // U: last import job
      ])
    }

    // Lock columns N-U (grey fill, read-only visual hint)
    const systemCols = [14, 15, 16, 17, 18, 19, 20, 21]
    for (const col of systemCols) {
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
    const headers = [
      'Mã trạm', 'Tên trạm', 'Địa chỉ', 'Lat', 'Long',
      'Loại máy phát', 'Dung tích tối đa (L)', 'Định mức (L/giờ)',
      'Nhiên liệu bổ sung (L)', 'Số giờ chạy', 'Nhiên liệu tồn (L)', 'Ngày ghi nhận', 'Ghi chú',
    ]
    ws.addRow(headers)
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
