import { test, expect, request as pwRequest } from '@playwright/test';
import * as xlsx from 'xlsx';
import { execFileSync } from 'child_process';

const EXCEL_HEADERS = [
  'Mã trạm', 'Tên trạm', 'Tên máy phát', 'Địa chỉ', 'Lat', 'Long',
  'Đơn vị hành chính hiện tại', 'Địa bàn cũ', 'Khu vực quản lý nội bộ',
  'Hãng máy', 'Model máy', 'Công suất kVA', 'Loại nhiên liệu',
  'Định mức tiêu hao L/giờ', 'Dung tích tối đa L',
  'Nhiên liệu bổ sung L', 'Số giờ chạy', 'Ngày ghi nhận', 'Ghi chú',
];

function buildExcelRow(stationCode: string, fuelAdded: number, hoursRun: number, date: string): Buffer {
  const row = new Array(19).fill('');
  row[0] = stationCode;
  row[15] = fuelAdded;
  row[16] = hoursRun;
  row[17] = date;
  const ws = xlsx.utils.aoa_to_sheet([EXCEL_HEADERS, row]);
  const wb = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(wb, ws, 'Nhiên liệu');
  return xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

function buildExcelRows(entries: { stationCode: string; fuelAdded: number; hoursRun: number; date: string }[]): Buffer {
  const aoa = [EXCEL_HEADERS, ...entries.map(e => {
    const row = new Array(19).fill('');
    row[0] = e.stationCode;
    row[15] = e.fuelAdded;
    row[16] = e.hoursRun;
    row[17] = e.date;
    return row;
  })];
  const ws = xlsx.utils.aoa_to_sheet(aoa);
  const wb = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(wb, ws, 'Nhiên liệu');
  return xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

// API-level regression pack for Fuel Import / manual-entry correctness rules.
// Uses Playwright's `request` fixture directly — no UI needed, fast and precise.

function api(path: string): string {
  const base = (process.env.GATEWAY_URL || 'http://localhost:3000/api/').replace(/\/$/, '');
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

// A fresh, isolated APIRequestContext per login — the shared `request` fixture keeps a
// cookie jar, and the gateway prefers a cookie over the Authorization header, so logging
// in as two roles against the SAME context makes the later login's cookie silently win
// even when an explicit Bearer header for the earlier role is passed alongside it.
async function authHeaders(role: 'admin' | 'manager' | 'staff') {
  const creds = {
    admin: [process.env.ADMIN_USERNAME || 'admin', process.env.ADMIN_PASSWORD || 'admin123'],
    manager: [process.env.MANAGER_USERNAME || 'manager', process.env.MANAGER_PASSWORD || 'manager123'],
    staff: [process.env.STAFF_USERNAME || 'staff', process.env.STAFF_PASSWORD || 'staff123'],
  }[role];
  const ctx = await pwRequest.newContext();
  const res = await ctx.post(api('/auth/login'), { data: { username: creds[0], password: creds[1] } });
  if (!res.ok()) throw new Error(`login failed for ${role}: ${res.status()}`);
  const data = await res.json();
  await ctx.dispose();
  const token = data.token || data.accessToken;
  return { Authorization: `Bearer ${token}` };
}

async function getActiveStationWithFuelState(request: import('@playwright/test').APIRequestContext, headers: Record<string, string>) {
  const res = await request.get(api('/stations?active=true'), { headers });
  const stations = await res.json();
  return stations.find((s: { currentFuel: number | null }) => s.currentFuel != null);
}

const todayStr = () => new Date().toISOString().slice(0, 10);

// Vietnamese dd/mm/yyyy for a date N days ago — used to exercise the real user date format
// without tripping the >30-day stale-date warning or the same-day-as-genesis-record warning.
function ddmmyyyyDaysAgo(days: number): string {
  const d = new Date(Date.now() - days * 86_400_000);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
}

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

// Test-only DB cleanup — deletes fuel_records/current_fuel_state rows for a station directly
// via docker exec + psql, simulating legacy data missing CurrentFuelState. Does NOT add any
// HTTP endpoint to the service; runs entirely from the test process against the fuel_postgres
// container that docker-compose.dev.yml already exposes.
function deleteFuelStateForStation(stationId: string) {
  const user = process.env.POSTGRES_USER || 'fuelapp';
  execFileSync('docker', [
    'exec', 'fuel_postgres', 'psql', '-U', user, '-d', 'fuel_db', '-c',
    `DELETE FROM fuel_records WHERE station_id='${stationId}'; DELETE FROM current_fuel_state WHERE station_id='${stationId}';`,
  ]);
}

// Deletes ONLY current_fuel_state, leaving fuel_records intact — needed when a test still
// needs an existing FuelRecord.id to resolve (e.g. an adjustment request's originalRecordId)
// while simulating a station that has lost its CurrentFuelState.
function deleteCurrentFuelStateOnly(stationId: string) {
  const user = process.env.POSTGRES_USER || 'fuelapp';
  execFileSync('docker', [
    'exec', 'fuel_postgres', 'psql', '-U', user, '-d', 'fuel_db', '-c',
    `DELETE FROM current_fuel_state WHERE station_id='${stationId}';`,
  ]);
}

test.describe('FI - Fuel Import / manual-entry regression pack', () => {
  test('FI-02 Unknown stationCode is a red error, no station created', async ({ request }) => {
    const headers = await authHeaders('manager');
    const unknownCode = `FI02_UNKNOWN_${Date.now()}`;
    const res = await request.post(api('/manual-entry/preview'), {
      headers,
      data: { rows: [{ stationCode: unknownCode, fuelAdded: 5, hoursRun: 1, recordedDate: todayStr() }] },
    });
    expect(res.status()).toBe(201);
    const data = await res.json();
    expect(data.rows[0].errors.length).toBeGreaterThan(0);

    const stationsRes = await request.get(api('/stations?active=all'), { headers });
    const stations = await stationsRes.json();
    expect(stations.some((s: { stationCode: string }) => s.stationCode === unknownCode)).toBe(false);
  });

  test('FI-03 / FI-14 Disabled station is rejected at confirm (revalidation)', async ({ request }) => {
    // Note: preview does not flag a disabled station as a row error (pre-existing gap,
    // out of this session's scope) — but confirm always re-fetches active stations and
    // rejects the whole batch if any targeted station isn't active. That's the guarantee
    // that actually matters for data safety, so this test verifies confirm, not preview.
    const adminHeaders = await authHeaders('admin');
    const managerHeaders = await authHeaders('manager');

    const code = `FI03_DISABLED_${Date.now()}`;
    const createRes = await request.post(api('/stations'), {
      headers: adminHeaders,
      data: { stationCode: code, stationName: 'FI-03 Disabled Station', consumptionRate: 2, maxCapacity: 200, initialFuel: 50 },
    });
    expect(createRes.status()).toBe(201);
    const station = await createRes.json();
    expect(station.currentFuelStateInitialized).toBe(true);

    const previewRes = await request.post(api('/manual-entry/preview'), {
      headers: managerHeaders,
      data: { rows: [{ stationCode: code, fuelAdded: 5, hoursRun: 1, recordedDate: todayStr() }] },
    });
    const previewData = await previewRes.json();
    const jobId = previewData.jobId;

    // Disable the station AFTER preview, simulating FI-14 (staleness between preview and confirm)
    const deactivateRes = await request.patch(api(`/stations/${station.id}/deactivate`), { headers: adminHeaders });
    expect(deactivateRes.ok()).toBe(true);

    const confirmRes = await request.post(api('/manual-entry/confirm'), { headers: managerHeaders, data: { jobId } });
    expect(confirmRes.status()).toBe(422);
  });

  test('FI-04 / FI-21 1 valid + 1 unknown station in one batch -> confirm 422, no side effects at all', async ({ request }) => {
    const headers = await authHeaders('manager');
    const station = await getActiveStationWithFuelState(request, headers);
    expect(station).toBeTruthy();

    const before = station.currentFuel;

    const previewRes = await request.post(api('/manual-entry/preview'), {
      headers,
      data: {
        rows: [
          { stationCode: station.code, fuelAdded: 1, hoursRun: 0.1, recordedDate: todayStr() },
          { stationCode: `FI04_UNKNOWN_${Date.now()}`, fuelAdded: 5, hoursRun: 1, recordedDate: todayStr() },
        ],
      },
    });
    const previewData = await previewRes.json();
    const jobId = previewData.jobId;

    const confirmRes = await request.post(api('/manual-entry/confirm'), { headers, data: { jobId } });
    expect(confirmRes.status()).toBe(422);

    const afterRes = await request.get(api('/stations?active=true'), { headers });
    const afterStations = await afterRes.json();
    const afterStation = afterStations.find((s: { id: string }) => s.id === station.id);
    expect(afterStation.currentFuel).toBe(before);
  });

  test('FI-05 Admin import with mismatched master data: warning only, DB unchanged', async ({ request }) => {
    const adminHeaders = await authHeaders('admin');
    const code = `FI05_MISMATCH_${Date.now()}`;
    const createRes = await request.post(api('/stations'), {
      headers: adminHeaders,
      data: { stationCode: code, stationName: 'Original Name', consumptionRate: 2, maxCapacity: 200, initialFuel: 50 },
    });
    const station = await createRes.json();

    // manual-entry rows don't carry master-data columns the way Excel does, but DirectEntryRow
    // does accept stationName/consumptionRate/maxCapacity as reference-only fields — confirm
    // they never get written even if supplied with different values than DB.
    const previewRes = await request.post(api('/manual-entry/preview'), {
      headers: adminHeaders,
      data: {
        rows: [{
          stationCode: code,
          stationName: 'MISMATCHED NAME FROM IMPORT',
          consumptionRate: 999,
          maxCapacity: 999,
          fuelAdded: 5,
          hoursRun: 1,
          recordedDate: todayStr(),
        }],
      },
    });
    const previewData = await previewRes.json();
    expect(previewData.rows[0].errors.length).toBe(0);
    const jobId = previewData.jobId;
    const confirmRes = await request.post(api('/manual-entry/confirm'), { headers: adminHeaders, data: { jobId } });
    expect(confirmRes.ok()).toBe(true);

    const afterRes = await request.get(api(`/stations/${station.id}/full`), { headers: adminHeaders });
    const after = await afterRes.json();
    expect(after.name).toBe('Original Name');
    expect(after.fuelRate).toBe(2);
    expect(after.maxCapacity).toBe(200);
  });

  test('FI-09 Negative fuelAdded/hoursRun -> red error, not silent skip', async ({ request }) => {
    const headers = await authHeaders('manager');
    const station = await getActiveStationWithFuelState(request, headers);

    const res1 = await request.post(api('/manual-entry/preview'), {
      headers,
      data: { rows: [{ stationCode: station.code, fuelAdded: -5, hoursRun: 0, recordedDate: todayStr() }] },
    });
    const data1 = await res1.json();
    expect(data1.rows[0].errors.some((e: string) => e.includes('âm'))).toBe(true);

    const res2 = await request.post(api('/manual-entry/preview'), {
      headers,
      data: { rows: [{ stationCode: station.code, fuelAdded: 0, hoursRun: -1, recordedDate: todayStr() }] },
    });
    const data2 = await res2.json();
    expect(data2.rows[0].errors.some((e: string) => e.includes('âm'))).toBe(true);
  });

  test('FI-10 / FI-11 fuelAfter out of range -> red error', async ({ request }) => {
    const adminHeaders = await authHeaders('admin');
    const code = `FI10_RANGE_${Date.now()}`;
    const createRes = await request.post(api('/stations'), {
      headers: adminHeaders,
      data: { stationCode: code, stationName: 'FI-10 Range Station', consumptionRate: 5, maxCapacity: 100, initialFuel: 10 },
    });
    const station = await createRes.json();

    // fuelAfter < 0: 10 (before) + 0 (added) - 5*10 (consumed) = -40
    const negRes = await request.post(api('/manual-entry/preview'), {
      headers: adminHeaders,
      data: { rows: [{ stationCode: code, fuelAdded: 0, hoursRun: 10, recordedDate: todayStr() }] },
    });
    const negData = await negRes.json();
    expect(negData.rows[0].errors.length).toBeGreaterThan(0);

    // fuelAfter > maxCapacity: 10 (before) + 200 (added) - 0 (consumed) = 210 > 100
    const overRes = await request.post(api('/manual-entry/preview'), {
      headers: adminHeaders,
      data: { rows: [{ stationCode: code, fuelAdded: 200, hoursRun: 0, recordedDate: todayStr() }] },
    });
    const overData = await overRes.json();
    expect(overData.rows[0].errors.length).toBeGreaterThan(0);
  });

  test('FI-12 Missing CurrentFuelState (legacy data) -> red error at preview, blocked at confirm', async ({ request }) => {
    const adminHeaders = await authHeaders('admin');
    const code = `FI12_NOSTATE_${Date.now()}`;

    // Both POST /stations and POST /stations/bulk-upsert now always initialize CurrentFuelState
    // (see Fix D) — there is no public API left that produces a station missing it. To keep
    // coverage for the guard itself, create a normal station and then simulate legacy data by
    // deleting its fuel state directly in the DB (test-only, no service endpoint involved).
    const createRes = await request.post(api('/stations'), {
      headers: adminHeaders,
      data: { stationCode: code, stationName: 'FI-12 No State Station', consumptionRate: 2, maxCapacity: 200, initialFuel: 50 },
    });
    expect(createRes.status()).toBe(201);
    const station = await createRes.json();
    expect(station.currentFuelStateInitialized).toBe(true);

    deleteFuelStateForStation(station.id);

    const previewRes = await request.post(api('/manual-entry/preview'), {
      headers: adminHeaders,
      data: { rows: [{ stationCode: code, fuelAdded: 5, hoursRun: 1, recordedDate: todayStr() }] },
    });
    const previewData = await previewRes.json();
    expect(previewData.rows[0].errors.some((e: string) => e.includes('tồn nhiên liệu ban đầu'))).toBe(true);

    const confirmRes = await request.post(api('/manual-entry/confirm'), { headers: adminHeaders, data: { jobId: previewData.jobId } });
    expect(confirmRes.status()).toBe(422);
  });

  test('FI-13 Confirming the same job twice does not double-commit', async ({ request }) => {
    const headers = await authHeaders('manager');
    const station = await getActiveStationWithFuelState(request, headers);

    // Unique fuelAdded per run — the exact-duplicate guard looks back 24h on
    // (station, date, fuelAdded, hoursRun), so a fixed value would collide with
    // this same test's own commit from an earlier run today.
    const uniqueFuelAdded = 0.01 + (Date.now() % 1000) / 100000;
    const previewRes = await request.post(api('/manual-entry/preview'), {
      headers,
      data: { rows: [{ stationCode: station.code, fuelAdded: uniqueFuelAdded, hoursRun: 0.01, recordedDate: todayStr() }] },
    });
    const previewData = await previewRes.json();
    const jobId = previewData.jobId;

    // A shared active station may already carry another entry for today, which the content-dedup
    // check surfaces as a same-date warning (verified identical on pre-refactor d31a84f — not a
    // refactor regression). It is unrelated to the double-commit idempotency this test exercises,
    // so acknowledge it explicitly on the first confirm.
    const confirm1 = await request.post(api('/manual-entry/confirm'), { headers, data: { jobId, acknowledgeWarnings: true } });
    expect(confirm1.ok()).toBe(true);
    const result1 = await confirm1.json();

    // Route the second confirm through the generic /import/jobs/:id/confirm endpoint
    // (same underlying confirmImport / ImportJob row — source doesn't gate this route)
    // rather than /manual-entry/confirm again, since that path has its own unrelated
    // 60-second batch-signature duplicate guard that would otherwise reject this call
    // for a reason that has nothing to do with the already-committed/idempotency claim
    // this test is actually checking.
    const confirm2 = await request.post(api(`/import/jobs/${jobId}/confirm`), { headers });
    expect(confirm2.ok()).toBe(true);
    const result2 = await confirm2.json();
    expect(result2.already_committed).toBe(true);
    expect(result2.result).toEqual(result1.result);
  });

  test('FI-16 Same station with two fuel-activity rows in one batch -> red error on both', async ({ request }) => {
    const headers = await authHeaders('manager');
    const station = await getActiveStationWithFuelState(request, headers);

    const res = await request.post(api('/manual-entry/preview'), {
      headers,
      data: {
        rows: [
          { stationCode: station.code, fuelAdded: 1, hoursRun: 0.1, recordedDate: todayStr() },
          { stationCode: station.code, fuelAdded: 2, hoursRun: 0.2, recordedDate: todayStr() },
        ],
      },
    });
    const data = await res.json();
    expect(data.rows[0].errors.some((e: string) => e.includes('nhiều dòng'))).toBe(true);
    expect(data.rows[1].errors.some((e: string) => e.includes('nhiều dòng'))).toBe(true);
  });

  test('FI-17 Warning row requires explicit acknowledgeWarnings on confirm', async ({ request }) => {
    // Note: manual-entry (DirectEntry) preview never populates row.warnings — only
    // Excel import's previewImport runs the same-date-different-value duplicate check.
    // So this test goes through Excel import to actually exercise a warning row, even
    // though the acknowledgeWarnings enforcement itself is shared code (confirmImport).
    const adminHeaders = await authHeaders('admin');

    const code = `FI17_WARN_${Date.now()}`;
    const createRes = await request.post(api('/stations'), {
      headers: adminHeaders,
      data: { stationCode: code, stationName: 'FI-17 Warning Station', consumptionRate: 2, maxCapacity: 200, initialFuel: 50 },
    });
    expect(createRes.status()).toBe(201);

    const today = todayStr();

    // First submission establishes a record for today via manual-entry (clean, no warning).
    const firstPreview = await request.post(api('/manual-entry/preview'), {
      headers: adminHeaders,
      data: { rows: [{ stationCode: code, fuelAdded: 1, hoursRun: 0.1, recordedDate: today }] },
    });
    const firstData = await firstPreview.json();
    expect(firstData.rows[0].errors.length).toBe(0);
    const confirmFirst = await request.post(api('/manual-entry/confirm'), { headers: adminHeaders, data: { jobId: firstData.jobId } });
    expect(confirmFirst.ok()).toBe(true);

    // Second submission, same station + same date, different value, via Excel import —
    // this path's previewImport checks existing FuelRecords and flags a warning.
    const fileBuffer = buildExcelRow(code, 3, 0.1, today);
    const uploadRes = await request.post(api('/import/upload'), {
      headers: adminHeaders,
      multipart: { file: { name: 'fi17-warning.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: fileBuffer } },
    });
    expect(uploadRes.status()).toBe(201);
    const uploadData = await uploadRes.json();
    expect(uploadData.warningRows).toBeGreaterThan(0);

    const confirmNoAck = await request.post(api(`/import/jobs/${uploadData.id}/confirm`), { headers: adminHeaders });
    expect(confirmNoAck.status()).toBe(422);

    const confirmWithAck = await request.post(api(`/import/jobs/${uploadData.id}/confirm`), {
      headers: adminHeaders,
      data: { acknowledgeWarnings: true },
    });
    expect(confirmWithAck.ok()).toBe(true);
  });

  test('FI-22 Batch with only no-activity rows -> confirm 422, no commit', async ({ request }) => {
    const headers = await authHeaders('manager');
    const station = await getActiveStationWithFuelState(request, headers);

    const previewRes = await request.post(api('/manual-entry/preview'), {
      headers,
      data: { rows: [{ stationCode: station.code, fuelAdded: 0, hoursRun: 0, recordedDate: todayStr() }] },
    });
    const previewData = await previewRes.json();
    const confirmRes = await request.post(api('/manual-entry/confirm'), { headers, data: { jobId: previewData.jobId } });
    expect(confirmRes.status()).toBe(422);
  });

  test('FI-23 Job with row errors is marked failed (not stuck committing), and cannot be reclaimed', async ({ request }) => {
    // Uses Excel import (not manual-entry): manual-entry's own confirm() does its own
    // station-liveness pre-check and throws before ever reaching confirmImport, which would
    // mask the exact regression this test guards (confirmImport's row-error handling, Fix A).
    // Excel import's confirm route calls confirmImport directly with no such wrapper.
    const adminHeaders = await authHeaders('admin');
    // Dedicated station (not the shared base station used across the suite) with generous
    // capacity — avoids flaky capacity-exceeded/exact-duplicate errors from other tests'
    // accumulated same-day activity when this spec runs as part of the full suite.
    const code = `FI23_STATION_${Date.now()}`;
    const createRes = await request.post(api('/stations'), {
      headers: adminHeaders,
      data: { stationCode: code, stationName: 'FI-23 Station', consumptionRate: 1, maxCapacity: 100000, initialFuel: 50000 },
    });
    expect(createRes.status()).toBe(201);
    const today = todayStr();
    const unknownCode = `FI23_UNKNOWN_${Date.now()}`;

    const fileBuffer = buildExcelRows([
      { stationCode: code, fuelAdded: 10, hoursRun: 1, date: today },
      { stationCode: unknownCode, fuelAdded: 5, hoursRun: 1, date: today },
    ]);
    const uploadRes = await request.post(api('/import/upload'), {
      headers: adminHeaders,
      multipart: { file: { name: 'fi23-rowerror.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: fileBuffer } },
    });
    expect(uploadRes.status()).toBe(201);
    const uploadData = await uploadRes.json();
    expect(uploadData.invalidRows).toBeGreaterThan(0);
    const jobId = uploadData.id;

    // acknowledgeWarnings:true rules out the unrelated "warning row" gate (which the shared
    // test station can trip after many same-day commits from earlier test runs) so this test
    // exercises exactly the row-error path Fix A guards, not a different early-exit branch.
    const confirm1 = await request.post(api(`/import/jobs/${jobId}/confirm`), { headers: adminHeaders, data: { acknowledgeWarnings: true } });
    expect(confirm1.status()).toBe(422);

    const jobRes1 = await request.get(api(`/import/jobs/${jobId}`), { headers: adminHeaders });
    const job1 = await jobRes1.json();
    expect(job1.status).toBe('failed');
    expect(job1.failureStage).toBe('validation');
    expect(job1.retryable).toBe(false);

    // Confirming the same failed-validation job again must stay blocked and must NOT
    // transition it into 'committing' — this is exactly the regression this test guards.
    const confirm2 = await request.post(api(`/import/jobs/${jobId}/confirm`), { headers: adminHeaders, data: { acknowledgeWarnings: true } });
    expect([409, 422]).toContain(confirm2.status());

    const jobRes2 = await request.get(api(`/import/jobs/${jobId}`), { headers: adminHeaders });
    const job2 = await jobRes2.json();
    expect(job2.status).toBe('failed');
    expect(job2.status).not.toBe('committing');

    // previewData is immutable — fixing the error requires a brand new job via a fresh upload,
    // not re-confirming the same jobId. Confirm that a new job with clean data works normally.
    const fixedBuffer = buildExcelRow(code, 20, 1, today);
    const fixedUploadRes = await request.post(api('/import/upload'), {
      headers: adminHeaders,
      multipart: { file: { name: 'fi23-fixed.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: fixedBuffer } },
    });
    const fixedUploadData = await fixedUploadRes.json();
    expect(fixedUploadData.id).not.toBe(jobId);
    const confirmFixed = await request.post(api(`/import/jobs/${fixedUploadData.id}/confirm`), { headers: adminHeaders, data: { acknowledgeWarnings: true } });
    expect(confirmFixed.ok()).toBe(true);
  });

  test('FI-24 manual-entry unknown stationCode is always a red error, even with new-station fields', async ({ request }) => {
    const headers = await authHeaders('manager');
    const unknownCode = `FI24_UNKNOWN_${Date.now()}`;
    const res = await request.post(api('/manual-entry/preview'), {
      headers,
      data: {
        rows: [{
          stationCode: unknownCode,
          stationName: 'Would-be new station',
          consumptionRate: 5,
          maxCapacity: 500,
          fuelAdded: 5,
          hoursRun: 1,
          recordedDate: todayStr(),
        }],
      },
    });
    const data = await res.json();
    expect(data.rows[0].errors.some((e: string) => e.includes('Mã trạm không tồn tại'))).toBe(true);
  });

  test('FI-25 bulk-upsert requires initial_fuel for new stations, initializes CurrentFuelState explicitly', async ({ request }) => {
    const adminHeaders = await authHeaders('admin');

    // Case 1: new station, initial_fuel omitted -> has_errors, no station created, no silent default
    const codeMissing = `FI25_MISSING_${Date.now()}`;
    const resMissing = await request.post(api('/stations/bulk-upsert'), {
      headers: adminHeaders,
      data: { stations: [{ station_code: codeMissing, station_name: 'FI-25 Missing', consumption_rate: 2, max_capacity: 200 }] },
    });
    expect(resMissing.status()).toBe(422);
    const dataMissing = await resMissing.json();
    expect(dataMissing.has_errors).toBe(true);
    expect(dataMissing.errors.some((e: string) => e.includes('bắt buộc'))).toBe(true);
    const stationsResMissing = await request.get(api('/stations?active=all'), { headers: adminHeaders });
    const stationsMissing = await stationsResMissing.json();
    expect(stationsMissing.some((s: { code: string }) => s.code === codeMissing)).toBe(false);

    // Case 1b: new station, initial_fuel:0 EXPLICIT -> succeeds (proves explicit zero differs from omitted)
    const code1 = `FI25_DEFAULT_${Date.now()}`;
    const res1 = await request.post(api('/stations/bulk-upsert'), {
      headers: adminHeaders,
      data: { stations: [{ station_code: code1, station_name: 'FI-25 Default', consumption_rate: 2, max_capacity: 200, initial_fuel: 0 }] },
    });
    expect(res1.ok()).toBe(true);
    const data1 = await res1.json();
    expect(data1.results[0].action).toBe('created');
    expect(data1.results[0].currentFuelStateInitialized).toBe(true);
    expect(data1.results[0].initialFuel).toBe(0);

    // Case 2: new station, with initial_fuel:75 -> reflected in response and in fuel-service
    const code2 = `FI25_CUSTOM_${Date.now()}`;
    const res2 = await request.post(api('/stations/bulk-upsert'), {
      headers: adminHeaders,
      data: { stations: [{ station_code: code2, station_name: 'FI-25 Custom', consumption_rate: 2, max_capacity: 200, initial_fuel: 75 }] },
    });
    expect(res2.ok()).toBe(true);
    const data2 = await res2.json();
    expect(data2.results[0].initialFuel).toBe(75);
    const stationsRes = await request.get(api('/stations?active=true'), { headers: adminHeaders });
    const stations = await stationsRes.json();
    const created2 = stations.find((s: { code: string }) => s.code === code2);
    expect(created2.currentFuel).toBe(75);

    // Case 3: negative initial_fuel -> has_errors, no station created
    const code3 = `FI25_NEG_${Date.now()}`;
    const res3 = await request.post(api('/stations/bulk-upsert'), {
      headers: adminHeaders,
      data: { stations: [{ station_code: code3, station_name: 'FI-25 Negative', consumption_rate: 2, max_capacity: 200, initial_fuel: -5 }] },
    });
    expect(res3.status()).toBe(422);
    const data3 = await res3.json();
    expect(data3.has_errors).toBe(true);
    const stationsRes3 = await request.get(api('/stations?active=all'), { headers: adminHeaders });
    const stations3 = await stationsRes3.json();
    expect(stations3.some((s: { code: string }) => s.code === code3)).toBe(false);

    // Case 4: initial_fuel over max_capacity -> has_errors, no station created
    const code4 = `FI25_OVER_${Date.now()}`;
    const res4 = await request.post(api('/stations/bulk-upsert'), {
      headers: adminHeaders,
      data: { stations: [{ station_code: code4, station_name: 'FI-25 Over Capacity', consumption_rate: 2, max_capacity: 200, initial_fuel: 500 }] },
    });
    expect(res4.status()).toBe(422);
    const data4 = await res4.json();
    expect(data4.has_errors).toBe(true);
    const stationsRes4 = await request.get(api('/stations?active=all'), { headers: adminHeaders });
    const stations4 = await stationsRes4.json();
    expect(stations4.some((s: { code: string }) => s.code === code4)).toBe(false);

    // Case 5: existing station updated with initial_fuel -> warning, fuel state untouched
    const beforeRes = await request.get(api('/stations?active=true'), { headers: adminHeaders });
    const beforeStations = await beforeRes.json();
    const existing = beforeStations.find((s: { code: string }) => s.code === code1);
    const fuelBefore = existing.currentFuel;

    const res5 = await request.post(api('/stations/bulk-upsert'), {
      headers: adminHeaders,
      data: { stations: [{ station_code: code1, station_name: 'FI-25 Default Updated', initial_fuel: 999 }] },
    });
    expect(res5.ok()).toBe(true);
    const data5 = await res5.json();
    expect(data5.results[0].action).toBe('updated');
    expect(data5.results[0].warning).toContain('chỉ áp dụng khi tạo trạm mới');

    const afterRes = await request.get(api('/stations?active=true'), { headers: adminHeaders });
    const afterStations = await afterRes.json();
    const afterExisting = afterStations.find((s: { code: string }) => s.code === code1);
    expect(afterExisting.currentFuel).toBe(fuelBefore);
  });

  test('FI-26 Deterministic fuel-commit validation error is retryable:false, not a generic 500', async ({ request }) => {
    const adminHeaders = await authHeaders('admin');
    const code = `FI26_STATION_${Date.now()}`;
    const createRes = await request.post(api('/stations'), {
      headers: adminHeaders,
      data: { stationCode: code, stationName: 'FI-26 Station', consumptionRate: 1, maxCapacity: 1000, initialFuel: 100 },
    });
    expect(createRes.status()).toBe(201);
    const station = await createRes.json();

    const today = todayStr();
    // fuelConsumed = 50*1 = 50, fuelAfter = 100+0-50 = 50 -> passes preview fine at consumptionRate:1
    const fileBuffer = buildExcelRow(code, 0, 50, today);
    const uploadRes = await request.post(api('/import/upload'), {
      headers: adminHeaders,
      multipart: { file: { name: 'fi26.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: fileBuffer } },
    });
    expect(uploadRes.status()).toBe(201);
    const uploadData = await uploadRes.json();
    expect(uploadData.invalidRows).toBe(0);

    // Raise consumptionRate between preview and confirm — fuel-service's commitImport
    // re-fetches the station fresh, so this makes fuelAfter deterministically negative
    // at actual commit time: fuelConsumed = 50*10 = 500, fuelAfter = 100-500 = -400.
    const patchRes = await request.put(api(`/stations/${station.id}`), {
      headers: adminHeaders,
      data: { consumptionRate: 10 },
    });
    expect(patchRes.ok()).toBe(true);

    // acknowledgeWarnings:true rules out an unrelated pre-existing quirk: checkExactDuplicates'
    // same-date check doesn't exclude source:'initial_state' genesis records, so a station's
    // own init-time genesis record trips a same-day "different values" warning on any same-day
    // import — a separate, real gap (documented in the report), but not what this test targets.
    const confirmRes = await request.post(api(`/import/jobs/${uploadData.id}/confirm`), { headers: adminHeaders, data: { acknowledgeWarnings: true } });
    expect([400, 422]).toContain(confirmRes.status());
    expect(confirmRes.status()).not.toBe(500);

    const jobRes = await request.get(api(`/import/jobs/${uploadData.id}`), { headers: adminHeaders });
    const job = await jobRes.json();
    expect(job.status).toBe('failed');
    expect(job.retryable).toBe(false);
  });

  test('FI-27 manual-entry confirm marks job failed on station-liveness rejection (not left previewing)', async ({ request }) => {
    const adminHeaders = await authHeaders('admin');
    const code = `FI27_STATION_${Date.now()}`;
    const createRes = await request.post(api('/stations'), {
      headers: adminHeaders,
      data: { stationCode: code, stationName: 'FI-27 Station', consumptionRate: 1, maxCapacity: 1000, initialFuel: 500 },
    });
    expect(createRes.status()).toBe(201);
    const station = await createRes.json();

    const previewRes = await request.post(api('/manual-entry/preview'), {
      headers: adminHeaders,
      data: { rows: [{ stationCode: code, fuelAdded: 10, hoursRun: 1, recordedDate: todayStr() }] },
    });
    const previewData = await previewRes.json();
    const jobId = previewData.jobId;

    // Disable the station AFTER preview — manual-entry's own confirm() pre-check catches this
    // (a separate code path from confirmImport/Fix A), and must now also mark the job bookkeeping.
    const deactivateRes = await request.patch(api(`/stations/${station.id}/deactivate`), { headers: adminHeaders });
    expect(deactivateRes.ok()).toBe(true);

    const confirmRes = await request.post(api('/manual-entry/confirm'), { headers: adminHeaders, data: { jobId } });
    expect(confirmRes.status()).toBe(422);

    const jobRes = await request.get(api(`/import/jobs/${jobId}`), { headers: adminHeaders });
    const job = await jobRes.json();
    expect(job.status).toBe('failed');
    expect(job.failureStage).toBe('validation');
    expect(job.retryable).toBe(false);
  });

  test('FI-28 dd/mm/yyyy string date parsed as day/month/year (VN format), not misparsed as MM/DD', async ({ request }) => {
    const adminHeaders = await authHeaders('admin');
    const code = `FI28_STATION_${Date.now()}`;
    const createRes = await request.post(api('/stations'), {
      headers: adminHeaders,
      data: { stationCode: code, stationName: 'FI-28 Station', consumptionRate: 1, maxCapacity: 1000, initialFuel: 500 },
    });
    expect(createRes.status()).toBe(201);

    // The date cell is the STRING "05/03/2026" (dd/mm/yyyy = 5 March) — how a Vietnamese user's
    // text-formatted date arrives in a real file. The old `new Date(raw)` parser silently read
    // this as 3 May (MM/DD/YYYY); it must now parse as 5 March, with no "wrong format" error.
    // (5 March is >30 days before "today" so a stale-date WARNING is expected — not an error.)
    const buffer = buildExcelRow(code, 10, 1, '05/03/2026');
    const uploadRes = await request.post(api('/import/upload'), {
      headers: adminHeaders,
      multipart: { file: { name: 'fi28-vndate.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer } },
    });
    expect(uploadRes.status()).toBe(201);
    const uploadData = await uploadRes.json();
    const row = uploadData.previewData[0];
    expect(row.errors.some((e: string) => e.toLowerCase().includes('định dạng'))).toBe(false);
    expect(String(row.recordedDate).startsWith('2026-03-05')).toBe(true);
  });

  test('FI-29 comma-decimal number "51,5" (VN text cell) parses as 51.5, not rejected', async ({ request }) => {
    const adminHeaders = await authHeaders('admin');
    const code = `FI29_STATION_${Date.now()}`;
    const createRes = await request.post(api('/stations'), {
      headers: adminHeaders,
      data: { stationCode: code, stationName: 'FI-29 Station', consumptionRate: 1, maxCapacity: 1000, initialFuel: 100 },
    });
    expect(createRes.status()).toBe(201);

    // The fuelAdded cell is the STRING "51,5" — a Vietnamese decimal in a text-formatted cell.
    // The old Number("51,5") = NaN rejected it as "không hợp lệ"; it must now parse as 51.5.
    const buffer = buildExcelRow(code, '51,5' as unknown as number, 1, todayStr());
    const uploadRes = await request.post(api('/import/upload'), {
      headers: adminHeaders,
      multipart: { file: { name: 'fi29-comma.xlsx', mimeType: XLSX_MIME, buffer } },
    });
    expect(uploadRes.status()).toBe(201);
    const uploadData = await uploadRes.json();
    const row = uploadData.previewData[0];
    expect(row.errors.some((e: string) => e.includes('Nhiên liệu bổ sung'))).toBe(false);
    expect(row.fuelAdded).toBe(51.5);
  });

  test('FI-30 export snapshot -> fill fuel columns in Excel -> re-import round-trips correctly', async ({ request }) => {
    const adminHeaders = await authHeaders('admin');
    const code = `FI30_STATION_${Date.now()}`;
    const createRes = await request.post(api('/stations'), {
      headers: adminHeaders,
      data: { stationCode: code, stationName: 'FI-30 Station', consumptionRate: 1, maxCapacity: 1000, initialFuel: 100 },
    });
    expect(createRes.status()).toBe(201);
    const station = await createRes.json();

    // 1. Download the REAL file the app produces — the snapshot the user actually works from
    //    (its own headers + every station, incl. the read-only system columns T-Z).
    const snapRes = await request.get(api('/export/snapshot'), { headers: adminHeaders });
    expect(snapRes.ok()).toBe(true);
    const snapBuf = await snapRes.body();
    const wb = xlsx.read(snapBuf, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const aoa = xlsx.utils.sheet_to_json(ws, { header: 1, defval: '' }) as unknown as unknown[][];
    const header = aoa[0];
    const myRow = aoa.find((r) => r[0] === code);
    expect(myRow).toBeTruthy();

    // 2. Fill the fuel columns exactly as a user would: P(15)=added, Q(16)=hours, R(17)=date
    //    as a dd/mm/yyyy text cell. System columns T-Z stay populated from the snapshot — a
    //    correct import must ignore them (they're the read-only "system-calculated" columns).
    const dateStr = ddmmyyyyDaysAgo(3);
    myRow![15] = 30;
    myRow![16] = 2;
    myRow![17] = dateStr;

    // 3. Rebuild a small file (header + just this row) so we don't re-upload every station.
    const outWs = xlsx.utils.aoa_to_sheet([header, myRow!]);
    const outWb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(outWb, outWs, 'Nhiên liệu');
    const outBuf = xlsx.write(outWb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;

    // 4. Re-import the filled snapshot row through the real upload flow
    const uploadRes = await request.post(api('/import/upload'), {
      headers: adminHeaders,
      multipart: { file: { name: 'fi30-roundtrip.xlsx', mimeType: XLSX_MIME, buffer: outBuf } },
    });
    expect(uploadRes.status()).toBe(201);
    const uploadData = await uploadRes.json();
    const prow = uploadData.previewData[0];
    expect(prow.errors.length).toBe(0);
    // dd/mm/yyyy (3 days ago) parsed to the correct calendar day
    const [dd, mm, yyyy] = dateStr.split('/');
    expect(String(prow.recordedDate).startsWith(`${yyyy}-${mm}-${dd}`)).toBe(true);

    // 5. Confirm and verify the running balance committed: 100 + 30 - 2*1 = 128
    const confirmRes = await request.post(api(`/import/jobs/${uploadData.id}/confirm`), { headers: adminHeaders, data: { acknowledgeWarnings: true } });
    expect(confirmRes.ok()).toBe(true);
    const stateRes = await request.get(api(`/fuel/current/${station.id}`), { headers: adminHeaders });
    const state = await stateRes.json();
    expect(state.currentFuel).toBe(128);
  });
});

test.describe('STATION - Station management regression pack', () => {
  test('STATION-1 Update rejects lowering maxCapacity below current fuel level', async ({ request }) => {
    const adminHeaders = await authHeaders('admin');
    const code = `STATION1_${Date.now()}`;
    const createRes = await request.post(api('/stations'), {
      headers: adminHeaders,
      data: { stationCode: code, stationName: 'STATION-1 Station', consumptionRate: 1, maxCapacity: 1000, initialFuel: 900 },
    });
    expect(createRes.status()).toBe(201);
    const station = await createRes.json();

    const updateRes = await request.put(api(`/stations/${station.id}`), {
      headers: adminHeaders,
      data: { maxCapacity: 500 },
    });
    expect(updateRes.status()).toBe(422);

    const getRes = await request.get(api(`/stations/${station.id}/full`), { headers: adminHeaders });
    const after = await getRes.json();
    expect(after.maxCapacity).toBe(1000);
  });
});

test.describe('ADJ - Adjustment regression pack', () => {
  test('ADJ-1 Adjustment approve rejects (422) instead of auto-creating missing CurrentFuelState', async ({ request }) => {
    const adminHeaders = await authHeaders('admin');
    const code = `ADJ1_STATION_${Date.now()}`;
    const createRes = await request.post(api('/stations'), {
      headers: adminHeaders,
      data: { stationCode: code, stationName: 'ADJ-1 Station', consumptionRate: 1, maxCapacity: 1000, initialFuel: 500 },
    });
    expect(createRes.status()).toBe(201);
    const station = await createRes.json();

    // Create one real fuel record to adjust against
    const previewRes = await request.post(api('/manual-entry/preview'), {
      headers: adminHeaders,
      data: { rows: [{ stationCode: code, fuelAdded: 10, hoursRun: 1, recordedDate: todayStr() }] },
    });
    const previewData = await previewRes.json();
    const confirmRes = await request.post(api('/manual-entry/confirm'), { headers: adminHeaders, data: { jobId: previewData.jobId } });
    expect(confirmRes.ok()).toBe(true);

    // Fetch the real record id — commitImport's response has no per-row IDs, so this is
    // the only reliable way to get one.
    const recordsRes = await request.get(api(`/fuel/records/${station.id}`), { headers: adminHeaders });
    const records = await recordsRes.json();
    expect(records.length).toBeGreaterThan(0);
    const originalRecordId = records[0].id;

    // Simulate legacy/corrupted data: CurrentFuelState deleted after the record was written.
    // Only current_fuel_state is deleted (NOT fuel_records) so originalRecordId still resolves.
    deleteCurrentFuelStateOnly(station.id);

    const reqRes = await request.post(api('/fuel/adjustment-requests'), {
      headers: adminHeaders,
      data: { originalRecordId, reason: 'ADJ-1 test', newFuelAdded: 20, newHoursRun: 1 },
    });
    expect(reqRes.status()).toBe(201);
    const adjReq = await reqRes.json();

    const approveRes = await request.patch(api(`/fuel/adjustment-requests/${adjReq.id}/approve`), { headers: adminHeaders });
    expect(approveRes.status()).toBe(422);

    // Request must stay pending, not silently approved
    const listRes = await request.get(api('/fuel/adjustment-requests'), { headers: adminHeaders });
    const list = await listRes.json();
    const found = list.find((r: { id: string }) => r.id === adjReq.id);
    expect(found.status).toBe('pending');

    // Fuel state still must not exist — approve must not have auto-created it
    const stateRes = await request.get(api(`/fuel/current/${station.id}`), { headers: adminHeaders });
    expect(stateRes.status()).toBe(404);

    // Cleanup: deactivate this disposable station so no active station with a missing
    // CurrentFuelState is left behind after the test run.
    await request.patch(api(`/stations/${station.id}/deactivate`), { headers: adminHeaders });
  });
});

test.describe('SEC - Security regression pack', () => {
  test('SEC-1 Spoofed X-User-Role header does not escalate privilege', async ({ request }) => {
    const staffHeaders = await authHeaders('staff');
    const res = await request.post(api('/brands'), {
      headers: { ...staffHeaders, 'X-User-Role': 'admin' },
      data: { name: `SPOOF_TEST_${Date.now()}`, country: 'VN' },
    });
    expect(res.status()).toBe(403);
  });

  test('SEC-2 No-auth sensitive endpoints all reject', async ({ request }) => {
    const endpoints = [
      { method: 'GET', path: '/stations' },
      { method: 'GET', path: '/fuel/current' },
      { method: 'GET', path: '/import/jobs' },
      { method: 'GET', path: '/export/snapshot' },
      { method: 'GET', path: '/fuel/adjustment-requests' },
      { method: 'POST', path: '/manual-entry/preview' },
    ];
    for (const ep of endpoints) {
      const res = await request.fetch(api(ep.path), { method: ep.method, data: ep.method === 'POST' ? {} : undefined });
      expect(res.status(), `${ep.method} ${ep.path} should reject without auth`).toBe(401);
    }
  });

  test('SEC-3 POST /fuel/records is gone — dead endpoint no longer reachable via gateway', async ({ request }) => {
    const headers = await authHeaders('admin');
    const res = await request.post(api('/fuel/records'), {
      headers,
      data: { stationId: 'x', stationCode: 'x', recordedDate: todayStr(), fuelAdded: 1, hoursRun: 1 },
    });
    expect(res.status()).toBe(404);
  });

  test('SEC-INTERNAL-INIT-1 POST /fuel/current/init is blocked at gateway (internal-only endpoint)', async ({ request }) => {
    const headers = await authHeaders('admin');
    const res = await request.post(api('/fuel/current/init'), {
      headers,
      data: { stationId: 'x', stationCode: 'x', consumptionRate: 1, maxCapacity: 100 },
    });
    expect(res.status()).toBe(403);
  });
});
