import * as fs from 'fs';
import * as path from 'path';
import * as xlsx from 'xlsx';
import { expect, type APIRequestContext, type Page } from '@playwright/test';
import { api } from './auth';

export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** The 19 input columns, in the exact order export.controller.ts writes them (A..S). */
export const INPUT_HEADERS = [
  'Mã trạm', 'Tên trạm', 'Tên máy phát', 'Địa chỉ', 'Lat', 'Long',
  'Đơn vị hành chính hiện tại', 'Địa bàn cũ', 'Khu vực quản lý nội bộ',
  'Hãng máy', 'Model máy', 'Công suất kVA', 'Loại nhiên liệu',
  'Định mức tiêu hao L/giờ', 'Dung tích tối đa L',
  'Nhiên liệu bổ sung L', 'Số giờ chạy', 'Ngày ghi nhận', 'Ghi chú',
];

// 0-based positions inside a data row
export const COL = {
  stationCode: 0,
  stationName: 1,
  consumptionRate: 13,
  maxCapacity: 14,
  fuelAdded: 15,
  hoursRun: 16,
  recordedDate: 17,
  notes: 18,
} as const;

export interface ImportRow {
  stationCode: string;
  fuelAdded?: number | string | null;
  hoursRun?: number | string | null;
  recordedDate?: number | string | null;
  stationName?: string;
  consumptionRate?: number | string;
  maxCapacity?: number | string;
  notes?: string;
}

export function buildRow(r: ImportRow): unknown[] {
  const row: unknown[] = new Array(INPUT_HEADERS.length).fill('');
  row[COL.stationCode] = r.stationCode;
  if (r.stationName !== undefined) row[COL.stationName] = r.stationName;
  if (r.consumptionRate !== undefined) row[COL.consumptionRate] = r.consumptionRate;
  if (r.maxCapacity !== undefined) row[COL.maxCapacity] = r.maxCapacity;
  row[COL.fuelAdded] = r.fuelAdded ?? '';
  row[COL.hoursRun] = r.hoursRun ?? '';
  row[COL.recordedDate] = r.recordedDate ?? '';
  if (r.notes !== undefined) row[COL.notes] = r.notes;
  return row;
}

const FIXTURE_DIR = path.join(__dirname, '..', '..', 'fixtures', 'excel');

/** Writes a real .xlsx to fixtures/excel and returns its absolute path. */
export function createExcelFile(rows: ImportRow[], filename: string): string {
  fs.mkdirSync(FIXTURE_DIR, { recursive: true });
  const ws = xlsx.utils.aoa_to_sheet([INPUT_HEADERS, ...rows.map(buildRow)]);
  const wb = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(wb, ws, 'Nhiên liệu');
  const filePath = path.join(FIXTURE_DIR, filename);
  xlsx.writeFile(wb, filePath);
  return filePath;
}

export function createExcelBuffer(rows: ImportRow[]): Buffer {
  const ws = xlsx.utils.aoa_to_sheet([INPUT_HEADERS, ...rows.map(buildRow)]);
  const wb = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(wb, ws, 'Nhiên liệu');
  return xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

/** A file with an .xlsx name whose bytes are not a valid zip/xlsx container. */
export function createCorruptXlsx(filename: string): string {
  fs.mkdirSync(FIXTURE_DIR, { recursive: true });
  const filePath = path.join(FIXTURE_DIR, filename);
  fs.writeFileSync(filePath, 'this is definitely not a valid xlsx container');
  return filePath;
}

export async function uploadImportViaApi(
  request: APIRequestContext,
  headers: Record<string, string>,
  buffer: Buffer,
  name = 'import.xlsx'
) {
  return request.post(api('/import/upload'), {
    headers,
    multipart: { file: { name, mimeType: XLSX_MIME, buffer } },
  });
}

/** Drives the real Import Excel wizard: pick file -> step 2 (preview). */
export async function uploadImportViaUi(page: Page, filePath: string) {
  const fileInput = page.locator('[aria-label="Chọn file Excel (.xlsx)"]');
  if (await fileInput.count() > 0) {
    await fileInput.setInputFiles(filePath);
  } else {
    const [fc] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.click('[aria-label="Khu vực tải file — kéo thả hoặc nhấn để chọn file Excel"]'),
    ]);
    await fc.setFiles(filePath);
  }
  await page.click('button:has-text("Tiếp theo")');
}

export async function confirmImportApi(
  request: APIRequestContext,
  headers: Record<string, string>,
  jobId: string,
  options: { acknowledgeWarnings?: boolean } = {}
) {
  return request.post(api(`/import/jobs/${jobId}/confirm`), { headers, data: options });
}

export async function getImportJobApi(
  request: APIRequestContext,
  headers: Record<string, string>,
  jobId: string
) {
  const res = await request.get(api(`/import/jobs/${jobId}`), { headers });
  if (!res.ok()) throw new Error(`getImportJobApi failed: ${res.status()}`);
  return res.json();
}

export async function expectImportJobStatus(
  request: APIRequestContext,
  headers: Record<string, string>,
  jobId: string,
  expected: { status?: string; failureStage?: string; retryable?: boolean }
) {
  const job = await getImportJobApi(request, headers, jobId);
  if (expected.status !== undefined) expect(job.status, `ImportJob ${jobId} status`).toBe(expected.status);
  if (expected.failureStage !== undefined) expect(job.failureStage, 'failureStage').toBe(expected.failureStage);
  if (expected.retryable !== undefined) expect(job.retryable, 'retryable').toBe(expected.retryable);
  return job;
}

/** Asserts a job never reached a committed state. */
export async function expectNoImportCommit(
  request: APIRequestContext,
  headers: Record<string, string>,
  jobId: string
) {
  const job = await getImportJobApi(request, headers, jobId);
  expect(job.status, `ImportJob ${jobId} must not be committed`).not.toBe('committed');
  expect(job.committedAt, `ImportJob ${jobId} committedAt must stay null`).toBeFalsy();
  return job;
}
