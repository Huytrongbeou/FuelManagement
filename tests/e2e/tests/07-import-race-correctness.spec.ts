import { test, expect } from '@playwright/test';
import { getAuthHeaders, RUN_ID } from './helpers/auth';
import { createDisposableStation, deactivateStationApi, updateStationApi } from './helpers/stations';
import { ddmmyyyyDaysAgo, directEntryPreviewApi, directEntryConfirmApi, todayIso } from './helpers/fuel';
import { captureFuelSnapshot, expectNoFuelSideEffect } from './helpers/assertions';
import { createExcelBuffer, uploadImportViaApi, confirmImportApi, expectImportJobStatus, expectNoImportCommit } from './helpers/import';

/**
 * Phase 1 — the correctness rules that keep fuel data trustworthy: all-or-nothing, no partial
 * success, and confirm-time revalidation against state that moved after preview.
 */
test.describe('07 — Import correctness & race conditions', () => {
  test('IMPORT-07 1 dòng hợp lệ + 1 dòng lỗi = KHÔNG partial success', async ({ request }) => {
    const adminHeaders = await getAuthHeaders('admin');
    const station = await createDisposableStation(request, adminHeaders, {
      prefix: 'PARTIAL', initialFuel: 100, maxCapacity: 1000, consumptionRate: 10,
    });
    const before = await captureFuelSnapshot(request, adminHeaders, station.id);
    const date = ddmmyyyyDaysAgo(3);

    const buffer = createExcelBuffer([
      { stationCode: station.stationCode, fuelAdded: 50, hoursRun: 1, recordedDate: date },
      { stationCode: `UNKNOWN_${RUN_ID}`, fuelAdded: 50, hoursRun: 1, recordedDate: date },
    ]);
    const upload = await uploadImportViaApi(request, adminHeaders, buffer, 'import07.xlsx');
    expect(upload.status()).toBe(201);
    const job = await upload.json();
    expect(job.invalidRows, 'unknown station must be flagged at preview').toBeGreaterThan(0);

    const confirm = await confirmImportApi(request, adminHeaders, job.id, { acknowledgeWarnings: true });
    expect(confirm.status(), 'a file with any red row must be refused entirely').toBe(422);

    // The valid row must NOT have been committed
    await expectNoFuelSideEffect(request, adminHeaders, station.id, before);
    await expectNoImportCommit(request, adminHeaders, job.id);
    await expectImportJobStatus(request, adminHeaders, job.id, { status: 'failed', retryable: false });
  });

  test('IMPORT-10 Cùng một trạm nhiều dòng trong một file = red error, không commit', async ({ request }) => {
    const adminHeaders = await getAuthHeaders('admin');
    const station = await createDisposableStation(request, adminHeaders, {
      prefix: 'MULTIROW', initialFuel: 100, maxCapacity: 1000, consumptionRate: 10,
    });
    const before = await captureFuelSnapshot(request, adminHeaders, station.id);
    const date = ddmmyyyyDaysAgo(3);

    const buffer = createExcelBuffer([
      { stationCode: station.stationCode, fuelAdded: 20, hoursRun: 1, recordedDate: date },
      { stationCode: station.stationCode, fuelAdded: 30, hoursRun: 2, recordedDate: date },
    ]);
    const upload = await uploadImportViaApi(request, adminHeaders, buffer, 'import10.xlsx');
    expect(upload.status()).toBe(201);
    const job = await upload.json();
    expect(job.invalidRows, 'duplicate station rows must be flagged').toBeGreaterThan(0);

    const confirm = await confirmImportApi(request, adminHeaders, job.id, { acknowledgeWarnings: true });
    expect(confirm.status()).toBe(422);
    await expectNoFuelSideEffect(request, adminHeaders, station.id, before);
    await expectNoImportCommit(request, adminHeaders, job.id);
  });

  test('IMPORT-18 File toàn dòng không phát sinh = confirm 422, không tạo record', async ({ request }) => {
    const adminHeaders = await getAuthHeaders('admin');
    const station = await createDisposableStation(request, adminHeaders, {
      prefix: 'NOACT', initialFuel: 100, maxCapacity: 1000, consumptionRate: 10,
    });
    const before = await captureFuelSnapshot(request, adminHeaders, station.id);

    const buffer = createExcelBuffer([{ stationCode: station.stationCode, fuelAdded: '', hoursRun: '', recordedDate: '' }]);
    const upload = await uploadImportViaApi(request, adminHeaders, buffer, 'import18.xlsx');
    expect(upload.status()).toBe(201);
    const job = await upload.json();

    const confirm = await confirmImportApi(request, adminHeaders, job.id, { acknowledgeWarnings: true });
    expect(confirm.status(), 'a file with no fuel activity must not commit').toBe(422);

    await expectNoFuelSideEffect(request, adminHeaders, station.id, before);
    await expectImportJobStatus(request, adminHeaders, job.id, { status: 'failed', failureStage: 'no_activity', retryable: false });
  });

  test('IMPORT-20 Trạm bị vô hiệu hóa sau preview, trước confirm = 422, không side effect', async ({ request }) => {
    const adminHeaders = await getAuthHeaders('admin');
    const station = await createDisposableStation(request, adminHeaders, {
      prefix: 'DISABLED', initialFuel: 100, maxCapacity: 1000, consumptionRate: 10,
    });
    const before = await captureFuelSnapshot(request, adminHeaders, station.id);

    const buffer = createExcelBuffer([
      { stationCode: station.stationCode, fuelAdded: 50, hoursRun: 1, recordedDate: ddmmyyyyDaysAgo(3) },
    ]);
    const upload = await uploadImportViaApi(request, adminHeaders, buffer, 'import20.xlsx');
    const job = await upload.json();
    expect(job.invalidRows, 'file must be clean at preview time').toBe(0);

    // The world changes between preview and confirm
    const deact = await deactivateStationApi(request, adminHeaders, station.id, 'IMPORT-20 race');
    expect(deact.ok()).toBe(true);

    const confirm = await confirmImportApi(request, adminHeaders, job.id, { acknowledgeWarnings: true });
    expect(confirm.status(), 'confirm must revalidate station state, not trust the preview').toBe(422);

    await expectNoFuelSideEffect(request, adminHeaders, station.id, before);
    await expectImportJobStatus(request, adminHeaders, job.id, { status: 'failed', retryable: false });
  });

  test('IMPORT-21 CurrentFuel đổi sau preview (stale) = 409, không commit', async ({ request }) => {
    const adminHeaders = await getAuthHeaders('admin');
    const station = await createDisposableStation(request, adminHeaders, {
      prefix: 'STALE', initialFuel: 100, maxCapacity: 1000, consumptionRate: 10,
    });

    const buffer = createExcelBuffer([
      { stationCode: station.stationCode, fuelAdded: 50, hoursRun: 1, recordedDate: ddmmyyyyDaysAgo(5) },
    ]);
    const upload = await uploadImportViaApi(request, adminHeaders, buffer, 'import21.xlsx');
    const job = await upload.json();
    expect(job.invalidRows).toBe(0);

    // Someone else moves the fuel level in between, invalidating the previewed snapshot version
    const pv = await directEntryPreviewApi(request, adminHeaders, [
      { stationCode: station.stationCode, fuelAdded: 10, hoursRun: 0, recordedDate: todayIso() },
    ]);
    const pvData = await pv.json();
    expect(pvData.rows[0].errors.length, 'the interfering entry itself must be valid').toBe(0);
    const cf = await directEntryConfirmApi(request, adminHeaders, pvData.jobId, { acknowledgeWarnings: true });
    expect(cf.ok(), 'the interfering direct entry should commit').toBe(true);

    const afterInterference = await captureFuelSnapshot(request, adminHeaders, station.id);
    expect(afterInterference.currentFuel).toBeCloseTo(110, 2);

    const confirm = await confirmImportApi(request, adminHeaders, job.id, { acknowledgeWarnings: true });
    expect(confirm.status(), 'a stale preview must be rejected with 409').toBe(409);

    // The stale confirm must change nothing beyond what the interfering entry already did
    await expectNoFuelSideEffect(request, adminHeaders, station.id, afterInterference);
    await expectImportJobStatus(request, adminHeaders, job.id, { status: 'failed', failureStage: 'stale_data', retryable: false });
  });

  test('IMPORT-22 maxCapacity bị hạ sau preview = lỗi validation 400/422 (không phải 500), không side effect', async ({ request }) => {
    const adminHeaders = await getAuthHeaders('admin');
    const station = await createDisposableStation(request, adminHeaders, {
      prefix: 'CAPDROP', initialFuel: 100, maxCapacity: 1000, consumptionRate: 10,
    });
    const before = await captureFuelSnapshot(request, adminHeaders, station.id);

    // Previewed result 100 + 500 - 10 = 590, comfortably under the 1000 cap at preview time
    const buffer = createExcelBuffer([
      { stationCode: station.stationCode, fuelAdded: 500, hoursRun: 1, recordedDate: ddmmyyyyDaysAgo(3) },
    ]);
    const upload = await uploadImportViaApi(request, adminHeaders, buffer, 'import22.xlsx');
    const job = await upload.json();
    expect(job.invalidRows).toBe(0);

    // Admin lowers the cap to 500 — still above the CURRENT 100 L, so the update is legal,
    // but it makes the previewed 590 L result impossible.
    const upd = await updateStationApi(request, adminHeaders, station.id, { maxCapacity: 500 });
    expect(upd.ok(), 'lowering the cap above current fuel must be allowed').toBe(true);

    const confirm = await confirmImportApi(request, adminHeaders, job.id, { acknowledgeWarnings: true });
    expect([400, 422], 'a deterministic validation failure must not surface as a generic 500')
      .toContain(confirm.status());
    expect(confirm.status()).not.toBe(500);

    await expectNoFuelSideEffect(request, adminHeaders, station.id, before);
    await expectImportJobStatus(request, adminHeaders, job.id, { status: 'failed', retryable: false });
  });

  test('IMPORT-12 Exact duplicate với dữ liệu đã có trong DB → red error, không tạo record thứ hai', async ({ request }) => {
    const adminHeaders = await getAuthHeaders('admin');
    const station = await createDisposableStation(request, adminHeaders, {
      prefix: 'DUPDB', initialFuel: 100, maxCapacity: 1000, consumptionRate: 10,
    });
    const date = ddmmyyyyDaysAgo(4);

    // First import commits a record for (station, date, 77 L, 2 h)
    const first = createExcelBuffer([{ stationCode: station.stationCode, fuelAdded: 77, hoursRun: 2, recordedDate: date }]);
    const up1 = await uploadImportViaApi(request, adminHeaders, first, 'import12-a.xlsx');
    const job1 = await up1.json();
    expect(job1.invalidRows).toBe(0);
    const cf1 = await confirmImportApi(request, adminHeaders, job1.id, { acknowledgeWarnings: true });
    expect(cf1.ok(), 'first import must commit').toBe(true);

    const afterFirst = await captureFuelSnapshot(request, adminHeaders, station.id);
    expect(afterFirst.recordCount).toBeGreaterThan(0);

    // Re-importing the exact same values must be flagged as a likely duplicate (red error)
    const second = createExcelBuffer([{ stationCode: station.stationCode, fuelAdded: 77, hoursRun: 2, recordedDate: date }]);
    const up2 = await uploadImportViaApi(request, adminHeaders, second, 'import12-b.xlsx');
    const job2 = await up2.json();
    expect(job2.invalidRows, 'an exact duplicate of a committed record must be a red error at preview').toBeGreaterThan(0);

    const cf2 = await confirmImportApi(request, adminHeaders, job2.id, { acknowledgeWarnings: true });
    expect(cf2.status(), 'the duplicate must not commit a second record').toBe(422);

    // Balance/record count identical to after the first import
    await expectNoFuelSideEffect(request, adminHeaders, station.id, afterFirst);
  });
});
