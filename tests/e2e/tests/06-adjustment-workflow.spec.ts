import { test, expect } from '@playwright/test';
import { getAuthHeaders } from './helpers/auth';
import { createDisposableStation, deactivateStationApi, deleteCurrentFuelStateOnlyForTest, getCurrentFuelApi } from './helpers/stations';
import { directEntryPreviewApi, directEntryConfirmApi, getFuelRecordsApi, getLatestFuelRecordApi, todayIso } from './helpers/fuel';
import { createAdjustmentApi, approveAdjustmentApi, rejectAdjustmentApi, getAdjustmentRequestApi } from './helpers/adjustments';
import { captureFuelSnapshot, expectNoAdjustmentSideEffect } from './helpers/assertions';

/** Creates one real committed FuelRecord on a disposable station and returns it. */
async function seedOneFuelRecord(
  request: import('@playwright/test').APIRequestContext,
  headers: Record<string, string>,
  stationCode: string,
  fuelAdded: number,
  hoursRun: number
) {
  const pv = await directEntryPreviewApi(request, headers, [
    { stationCode, fuelAdded, hoursRun, recordedDate: todayIso() },
  ]);
  const pvData = await pv.json();
  expect(pvData.rows[0].errors.length, 'seed entry must be valid').toBe(0);
  const cf = await directEntryConfirmApi(request, headers, pvData.jobId, { acknowledgeWarnings: true });
  expect(cf.ok(), 'seed entry must commit').toBe(true);
}

test.describe('06 — Adjustment workflow', () => {
  test('ADJ-03 Admin duyệt adjustment: tạo record source=adjustment, record gốc bất biến, tồn đổi đúng', async ({ request }) => {
    const adminHeaders = await getAuthHeaders('admin');
    const managerHeaders = await getAuthHeaders('manager');
    const station = await createDisposableStation(request, adminHeaders, {
      prefix: 'ADJ', initialFuel: 100, maxCapacity: 1000, consumptionRate: 10,
    });

    // Manager records 50 L added over 2 h  ->  100 + 50 - 20 = 130
    await seedOneFuelRecord(request, managerHeaders, station.stationCode, 50, 2);
    const original = await getLatestFuelRecordApi(request, adminHeaders, station.id);
    expect(original, 'seeded record must exist').toBeTruthy();
    expect(Number(original!.endFuel)).toBeCloseTo(130, 2);

    const beforeAdjust = await captureFuelSnapshot(request, adminHeaders, station.id);

    // Manager realises it should have been 70 L, not 50 L
    const createRes = await createAdjustmentApi(request, managerHeaders, {
      originalRecordId: original!.id,
      reason: 'Ghi nhầm lượng nhiên liệu bổ sung',
      newFuelAdded: 70,
      newHoursRun: 2,
    });
    expect(createRes.status(), 'manager may raise an adjustment request').toBe(201);
    const adjReq = await createRes.json();

    const approve = await approveAdjustmentApi(request, adminHeaders, adjReq.id);
    expect(approve.ok(), 'admin may approve').toBe(true);

    // Request is approved
    const stored = await getAdjustmentRequestApi(request, adminHeaders, adjReq.id);
    expect(stored.status).toBe('approved');

    // A NEW record with source=adjustment was created — the original stays byte-identical
    const records = await getFuelRecordsApi(request, adminHeaders, station.id);
    const adjustmentRecords = records.filter(r => r.source === 'adjustment');
    expect(adjustmentRecords.length, 'approval must create exactly one adjustment record').toBe(1);
    expect(adjustmentRecords[0].adjustmentForId, 'adjustment must point at the original record').toBe(original!.id);

    const originalAfter = records.find(r => r.id === original!.id);
    expect(originalAfter, 'the original FuelRecord must still exist').toBeTruthy();
    expect(Number(originalAfter!.added), 'FuelRecord is immutable — original must not be edited').toBeCloseTo(50, 2);
    expect(Number(originalAfter!.endFuel)).toBeCloseTo(130, 2);

    // Balance moved by the adjustment effect only: +20 L (70 - 50) -> 150
    const state = await getCurrentFuelApi(request, adminHeaders, station.id);
    expect(Number(state!.currentFuel), 'CurrentFuelState must move by the adjustment delta').toBeCloseTo(
      beforeAdjust.currentFuel! + 20, 2
    );
  });

  test('ADJ-06 Duyệt adjustment khi thiếu CurrentFuelState = 422, không tạo state từ 0', async ({ request }) => {
    const adminHeaders = await getAuthHeaders('admin');
    const managerHeaders = await getAuthHeaders('manager');
    const station = await createDisposableStation(request, adminHeaders, {
      prefix: 'ADJNOSTATE', initialFuel: 100, maxCapacity: 1000, consumptionRate: 10,
    });

    await seedOneFuelRecord(request, managerHeaders, station.stationCode, 50, 2);
    const original = await getLatestFuelRecordApi(request, adminHeaders, station.id);
    expect(original).toBeTruthy();

    const createRes = await createAdjustmentApi(request, managerHeaders, {
      originalRecordId: original!.id,
      reason: 'ADJ-06 missing state probe',
      newFuelAdded: 70,
      newHoursRun: 2,
    });
    expect(createRes.status()).toBe(201);
    const adjReq = await createRes.json();

    // Simulate legacy/corrupted data — remove ONLY the fuel state, keep the records so the
    // adjustment's originalRecordId still resolves.
    deleteCurrentFuelStateOnlyForTest(station.id);
    expect(await getCurrentFuelApi(request, adminHeaders, station.id)).toBeNull();
    const before = await captureFuelSnapshot(request, adminHeaders, station.id);

    const approve = await approveAdjustmentApi(request, adminHeaders, adjReq.id);
    expect(approve.status(), 'approve must refuse rather than bootstrap a state from 0').toBe(422);

    // Nothing created, request rolled back to pending
    await expectNoAdjustmentSideEffect(request, adminHeaders, station.id, adjReq.id, before, 'pending');
    expect(await getCurrentFuelApi(request, adminHeaders, station.id), 'approve must not auto-create CurrentFuelState').toBeNull();

    // Leave no active station without a fuel state behind
    await deactivateStationApi(request, adminHeaders, station.id, 'ADJ-06 cleanup');
  });

  test('ADJ-04 Reject: thiếu reason bị chặn; có reason → rejected, không tạo record, tồn không đổi', async ({ request }) => {
    const adminHeaders = await getAuthHeaders('admin');
    const managerHeaders = await getAuthHeaders('manager');
    const station = await createDisposableStation(request, adminHeaders, {
      prefix: 'ADJREJ', initialFuel: 100, maxCapacity: 1000, consumptionRate: 10,
    });
    await seedOneFuelRecord(request, managerHeaders, station.stationCode, 50, 2);
    const original = await getLatestFuelRecordApi(request, adminHeaders, station.id);

    const createRes = await createAdjustmentApi(request, managerHeaders, {
      originalRecordId: original!.id, reason: 'ADJ-04 reject flow', newFuelAdded: 70, newHoursRun: 2,
    });
    expect(createRes.status()).toBe(201);
    const adjReq = await createRes.json();

    const before = await captureFuelSnapshot(request, adminHeaders, station.id);

    // Reject without a reason must be refused
    const noReason = await rejectAdjustmentApi(request, adminHeaders, adjReq.id, '');
    expect(noReason.status(), 'reject without a reason must be blocked').toBe(422);

    // Reject with a reason succeeds and is inert on fuel data
    const rejected = await rejectAdjustmentApi(request, adminHeaders, adjReq.id, 'Số liệu gốc đã đúng, không cần điều chỉnh');
    expect(rejected.ok(), 'reject with a reason should succeed').toBe(true);

    const stored = await getAdjustmentRequestApi(request, adminHeaders, adjReq.id);
    expect(stored.status).toBe('rejected');

    // No adjustment record created, balance untouched
    const records = await getFuelRecordsApi(request, adminHeaders, station.id);
    expect(records.some(r => r.source === 'adjustment'), 'a rejected request must not create an adjustment record').toBe(false);
    const state = await getCurrentFuelApi(request, adminHeaders, station.id);
    expect(Number(state!.currentFuel), 'reject must not change CurrentFuelState').toBeCloseTo(before.currentFuel!, 2);
  });

  test('ADJ-05 Manager không được approve/reject adjustment (backend 403)', async ({ request }) => {
    const adminHeaders = await getAuthHeaders('admin');
    const managerHeaders = await getAuthHeaders('manager');
    const station = await createDisposableStation(request, adminHeaders, {
      prefix: 'ADJRBAC', initialFuel: 100, maxCapacity: 1000, consumptionRate: 10,
    });
    await seedOneFuelRecord(request, managerHeaders, station.stationCode, 50, 2);
    const original = await getLatestFuelRecordApi(request, adminHeaders, station.id);

    const createRes = await createAdjustmentApi(request, managerHeaders, {
      originalRecordId: original!.id, reason: 'ADJ-05 rbac', newFuelAdded: 70, newHoursRun: 2,
    });
    const adjReq = await createRes.json();
    const before = await captureFuelSnapshot(request, adminHeaders, station.id);

    const approve = await approveAdjustmentApi(request, managerHeaders, adjReq.id);
    expect(approve.status(), 'manager must not approve').toBe(403);
    const reject = await rejectAdjustmentApi(request, managerHeaders, adjReq.id, 'manager should not reject');
    expect(reject.status(), 'manager must not reject').toBe(403);

    // Request still pending, nothing changed
    await expectNoAdjustmentSideEffect(request, adminHeaders, station.id, adjReq.id, before, 'pending');
  });

  test('ADJ-07 Không thể tạo adjustment hai lần cho cùng một record', async ({ request }) => {
    const adminHeaders = await getAuthHeaders('admin');
    const managerHeaders = await getAuthHeaders('manager');
    const station = await createDisposableStation(request, adminHeaders, {
      prefix: 'ADJDUP', initialFuel: 100, maxCapacity: 1000, consumptionRate: 10,
    });
    await seedOneFuelRecord(request, managerHeaders, station.stationCode, 50, 2);
    const original = await getLatestFuelRecordApi(request, adminHeaders, station.id);

    const first = await createAdjustmentApi(request, managerHeaders, {
      originalRecordId: original!.id, reason: 'ADJ-07 first', newFuelAdded: 60, newHoursRun: 2,
    });
    expect(first.status()).toBe(201);
    const firstReq = await first.json();

    // A second request while one is pending must be refused
    const secondWhilePending = await createAdjustmentApi(request, managerHeaders, {
      originalRecordId: original!.id, reason: 'ADJ-07 second', newFuelAdded: 65, newHoursRun: 2,
    });
    expect(secondWhilePending.status(), 'a second request while one is pending must be blocked').toBe(409);

    // Approve the first, then a request for the already-adjusted record must also be refused
    const approve = await approveAdjustmentApi(request, adminHeaders, firstReq.id);
    expect(approve.ok()).toBe(true);
    const afterApproved = await createAdjustmentApi(request, managerHeaders, {
      originalRecordId: original!.id, reason: 'ADJ-07 after approved', newFuelAdded: 80, newHoursRun: 2,
    });
    expect(afterApproved.status(), 'an already-adjusted record cannot be adjusted again').toBe(409);
  });
});
