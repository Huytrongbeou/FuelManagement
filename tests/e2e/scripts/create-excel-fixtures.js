'use strict';
const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');

const INPUT_HEADERS = [
  'Mã trạm', 'Tên trạm', 'Tên máy phát', 'Địa chỉ', 'Lat', 'Long',
  'Đơn vị hành chính hiện tại', 'Địa bàn cũ', 'Khu vực quản lý nội bộ',
  'Hãng máy', 'Model máy', 'Công suất kVA', 'Loại nhiên liệu',
  'Định mức tiêu hao L/giờ', 'Dung tích tối đa L',
  'Nhiên liệu bổ sung L', 'Số giờ chạy', 'Ngày ghi nhận', 'Ghi chú',
];

function todayVN() {
  const VN_OFFSET_MS = 7 * 60 * 60 * 1000;
  return new Date(Date.now() + VN_OFFSET_MS).toISOString().slice(0, 10);
}

function makeRow(stationCode, fuelAdded, hoursRun, date) {
  const r = new Array(19).fill('');
  r[0]  = stationCode;
  r[15] = fuelAdded;
  r[16] = hoursRun;
  r[17] = date || todayVN();
  return r;
}

function writeXlsx(filePath, dataRows) {
  const ws = xlsx.utils.aoa_to_sheet([INPUT_HEADERS, ...dataRows]);
  const wb = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(wb, ws, 'Nhiên liệu');
  xlsx.writeFile(wb, filePath);
}

function createAll(baseCode, outDir) {
  fs.mkdirSync(outDir, { recursive: true });
  const today = todayVN();

  // fuelAdded=61 to avoid duplicate-signature clash with F10 (fuelAdded=51)
  writeXlsx(path.join(outDir, 'valid-1row.xlsx'), [
    makeRow(baseCode, 61, 2, today),
  ]);

  // 1 valid row (fuelAdded=62) + 2 invalid rows
  writeXlsx(path.join(outDir, 'partial-invalid.xlsx'), [
    makeRow(baseCode, 62, 2, today),
    makeRow('NONEXISTENT_TST_001', -10, 0, today),
    makeRow('', 5, 0, today),
  ]);

  writeXlsx(path.join(outDir, 'all-invalid.xlsx'), [
    makeRow('', 5, 0, today),
    makeRow('NONEXISTENT_TST_001', -10, 0, today),
    makeRow('NONEXISTENT_TST_002', 0, -1, today),
  ]);

  // Same code twice same day — backend should flag as duplicate
  writeXlsx(path.join(outDir, 'duplicate-codes.xlsx'), [
    makeRow(baseCode, 50, 1, today),
    makeRow(baseCode, 50, 1, today),
  ]);

  // Header only, no data rows
  writeXlsx(path.join(outDir, 'empty-data.xlsx'), []);

  // Wrong column structure — only 3 cols, data at wrong positions
  const ws = xlsx.utils.aoa_to_sheet([
    ['StationCode', 'Fuel', 'Hours'],
    [baseCode, 50, 2],
  ]);
  const wb = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(wb, ws, 'Nhiên liệu');
  xlsx.writeFile(wb, path.join(outDir, 'wrong-format.xlsx'));

  console.log(`Created 6 Excel fixtures in ${outDir}`);
}

module.exports = { createAll, todayVN };
