import { test, expect } from '@playwright/test';
import { getAuthHeaders, loginViaUi, navigateTo } from './helpers/auth';
import { createDisposableStation, deleteCurrentFuelStateOnlyForTest, getCurrentFuelApi } from './helpers/stations';
import {
  countFuelRecordsApi, getLatestFuelRecordApi, expectFuelMath,
  directEntryPreviewApi, todayIso,
} from './helpers/fuel';
import { captureFuelSnapshot, expectNoFuelSideEffect, expectFuelSideEffect } from './helpers/assertions';

/** Loads the station table on the DirectEntry page and returns the row for a station code. */
async function openDirectEntryRow(page: import('@playwright/test').Page, stationCode: string) {
  await navigateTo(page, 'directEntry');
  await page.getByRole('button', { name: /tải dữ liệu hiện tại/i }).click();
  const row = page.getByTestId(`direct-entry-row-${stationCode}`);
  await expect(row, `DirectEntry must list station ${stationCode}`).toBeVisible({ timeout: 20000 });
  return row;
}

test.describe('04 — Manager direct entry', () => {
  test('DIRECT-01 Manager nhập nhiên liệu hợp lệ qua UI, backend state đúng công thức', async ({ page, request }) => {
    const adminHeaders = await getAuthHeaders('admin');
    const station = await createDisposableStation(request, adminHeaders, {
      prefix: 'SAFE', initialFuel: 100, maxCapacity: 500, consumptionRate: 10,
    });
    const before = await captureFuelSnapshot(request, adminHeaders, station.id);

    await loginViaUi(page, 'manager');
    const row = await openDirectEntryRow(page, station.stationCode);

    await page.getByTestId(`fuel-added-input-${station.stationCode}`).fill('50');
    await page.getByTestId(`hours-run-input-${station.stationCode}`).fill('2');

    await page.getByRole('button', { name: /kiểm tra dữ liệu/i }).click();
    // 100 + 50 - (2 * 10) = 130 must be shown before the user commits
    await expect(row.getByText('130', { exact: false }).first()).toBeVisible({ timeout: 15000 });

    await page.getByRole('button', { name: /xác nhận lưu/i }).click();
    const ack = page.getByRole('button', { name: /vẫn tạo|tiếp tục lưu/i });
    if (await ack.isVisible({ timeout: 3000 }).catch(() => false)) await ack.click();
    // Target the visible success heading specifically — the dialog also renders an sr-only
    // title with the same wording, which makes a loose text match ambiguous.
    await expect(page.getByRole('heading', { name: 'Lưu thành công!' })).toBeVisible({ timeout: 20000 });

    // Backend is the source of truth — verify the record and the resulting balance.
    await expectFuelSideEffect(request, adminHeaders, station.id, before, { currentFuel: 130, recordDelta: 1 });

    const latest = await getLatestFuelRecordApi(request, adminHeaders, station.id);
    expect(latest, 'a FuelRecord must exist after a successful direct entry').toBeTruthy();
    expectFuelMath(latest!, { previousFuel: 100, added: 50, hoursRun: 2, consumed: 20, endFuel: 130 });
    expect(latest!.source, 'direct entry must be recorded with a non-import source').not.toBe('adjustment');
  });

  test('DIRECT-06 finalFuel âm bị chặn, không có side effect', async ({ page, request }) => {
    const adminHeaders = await getAuthHeaders('admin');
    // 10 + 0 - (2 * 10) = -10
    const station = await createDisposableStation(request, adminHeaders, {
      prefix: 'NEG', initialFuel: 10, maxCapacity: 500, consumptionRate: 10,
    });
    const before = await captureFuelSnapshot(request, adminHeaders, station.id);

    await loginViaUi(page, 'manager');
    await openDirectEntryRow(page, station.stationCode);
    await page.getByTestId(`hours-run-input-${station.stationCode}`).fill('2');
    await page.getByRole('button', { name: /kiểm tra dữ liệu/i }).click();

    // UI must refuse to commit
    await expect(page.getByRole('button', { name: /xác nhận lưu/i })).toBeDisabled({ timeout: 15000 });

    // API must independently flag it as a row error (UI is only a convenience layer)
    const previewRes = await directEntryPreviewApi(request, adminHeaders, [
      { stationCode: station.stationCode, fuelAdded: 0, hoursRun: 2, recordedDate: todayIso() },
    ]);
    const preview = await previewRes.json();
    expect(preview.rows[0].errors.length, 'negative resulting fuel must be a red error').toBeGreaterThan(0);

    await expectNoFuelSideEffect(request, adminHeaders, station.id, before);
  });

  test('DIRECT-07 finalFuel vượt maxCapacity bị chặn, không có side effect', async ({ page, request }) => {
    const adminHeaders = await getAuthHeaders('admin');
    // 480 + 50 - 0 = 530 > 500
    const station = await createDisposableStation(request, adminHeaders, {
      prefix: 'OVER', initialFuel: 480, maxCapacity: 500, consumptionRate: 10,
    });
    const before = await captureFuelSnapshot(request, adminHeaders, station.id);

    await loginViaUi(page, 'manager');
    await openDirectEntryRow(page, station.stationCode);
    await page.getByTestId(`fuel-added-input-${station.stationCode}`).fill('50');
    await page.getByRole('button', { name: /kiểm tra dữ liệu/i }).click();

    await expect(page.getByRole('button', { name: /xác nhận lưu/i })).toBeDisabled({ timeout: 15000 });

    const previewRes = await directEntryPreviewApi(request, adminHeaders, [
      { stationCode: station.stationCode, fuelAdded: 50, hoursRun: 0, recordedDate: todayIso() },
    ]);
    const preview = await previewRes.json();
    expect(preview.rows[0].errors.length, 'exceeding maxCapacity must be a red error').toBeGreaterThan(0);

    await expectNoFuelSideEffect(request, adminHeaders, station.id, before);
  });

  test('DIRECT-09 Trạm thiếu CurrentFuelState: UI khoá input, API red error, không auto-create', async ({ page, request }) => {
    const adminHeaders = await getAuthHeaders('admin');
    const station = await createDisposableStation(request, adminHeaders, {
      prefix: 'NOSTATE', initialFuel: 100, maxCapacity: 500, consumptionRate: 10,
    });

    // Simulate legacy data: fuel state gone, station still active. No public API can do this
    // any more, which is the point — the guard must still hold for pre-existing rows.
    deleteCurrentFuelStateOnlyForTest(station.id);
    expect(await getCurrentFuelApi(request, adminHeaders, station.id)).toBeNull();
    const recordsBefore = await countFuelRecordsApi(request, adminHeaders, station.id);

    await loginViaUi(page, 'manager');
    await openDirectEntryRow(page, station.stationCode);

    // UI must not offer data entry for a station with no baseline
    await expect(page.getByTestId(`fuel-added-input-${station.stationCode}`)).toBeDisabled();
    await expect(page.getByTestId(`hours-run-input-${station.stationCode}`)).toBeDisabled();

    // And the API must reject it rather than bootstrapping a state from 0
    const previewRes = await directEntryPreviewApi(request, adminHeaders, [
      { stationCode: station.stationCode, fuelAdded: 5, hoursRun: 1, recordedDate: todayIso() },
    ]);
    const preview = await previewRes.json();
    expect(
      preview.rows[0].errors.some((e: string) => e.includes('tồn nhiên liệu ban đầu')),
      'missing CurrentFuelState must be a red error'
    ).toBe(true);

    expect(await getCurrentFuelApi(request, adminHeaders, station.id), 'preview must not auto-create CurrentFuelState').toBeNull();
    expect(await countFuelRecordsApi(request, adminHeaders, station.id)).toBe(recordsBefore);
  });

  test('DIRECT-02 Chỉ thêm nhiên liệu (không chạy máy): 100 + 40 - 0 = 140', async ({ page, request }) => {
    const adminHeaders = await getAuthHeaders('admin');
    const station = await createDisposableStation(request, adminHeaders, {
      prefix: 'ADDONLY', initialFuel: 100, maxCapacity: 500, consumptionRate: 10,
    });
    const before = await captureFuelSnapshot(request, adminHeaders, station.id);

    await loginViaUi(page, 'manager');
    const row = await openDirectEntryRow(page, station.stationCode);
    await page.getByTestId(`fuel-added-input-${station.stationCode}`).fill('40');
    await page.getByRole('button', { name: /kiểm tra dữ liệu/i }).click();
    await expect(row.getByText('140', { exact: false }).first()).toBeVisible({ timeout: 15000 });

    await page.getByRole('button', { name: /xác nhận lưu/i }).click();
    const ack = page.getByRole('button', { name: /vẫn tạo|tiếp tục lưu/i });
    if (await ack.isVisible({ timeout: 3000 }).catch(() => false)) await ack.click();
    await expect(page.getByRole('heading', { name: 'Lưu thành công!' })).toBeVisible({ timeout: 20000 });

    await expectFuelSideEffect(request, adminHeaders, station.id, before, { currentFuel: 140, recordDelta: 1 });
    const latest = await getLatestFuelRecordApi(request, adminHeaders, station.id);
    expectFuelMath(latest!, { previousFuel: 100, added: 40, hoursRun: 0, consumed: 0, endFuel: 140 });
  });

  test('DIRECT-03 Chỉ chạy máy (không thêm nhiên liệu): 100 + 0 - 3×10 = 70', async ({ page, request }) => {
    const adminHeaders = await getAuthHeaders('admin');
    const station = await createDisposableStation(request, adminHeaders, {
      prefix: 'RUNONLY', initialFuel: 100, maxCapacity: 500, consumptionRate: 10,
    });
    const before = await captureFuelSnapshot(request, adminHeaders, station.id);

    await loginViaUi(page, 'manager');
    const row = await openDirectEntryRow(page, station.stationCode);
    await page.getByTestId(`hours-run-input-${station.stationCode}`).fill('3');
    await page.getByRole('button', { name: /kiểm tra dữ liệu/i }).click();
    await expect(row.getByText('70', { exact: false }).first()).toBeVisible({ timeout: 15000 });

    await page.getByRole('button', { name: /xác nhận lưu/i }).click();
    const ack = page.getByRole('button', { name: /vẫn tạo|tiếp tục lưu/i });
    if (await ack.isVisible({ timeout: 3000 }).catch(() => false)) await ack.click();
    await expect(page.getByRole('heading', { name: 'Lưu thành công!' })).toBeVisible({ timeout: 20000 });

    await expectFuelSideEffect(request, adminHeaders, station.id, before, { currentFuel: 70, recordDelta: 1 });
    const latest = await getLatestFuelRecordApi(request, adminHeaders, station.id);
    expectFuelMath(latest!, { previousFuel: 100, added: 0, hoursRun: 3, consumed: 30, endFuel: 70 });
  });

  test('DIRECT-12 Nhập nhiều trạm một lần: chỉ trạm được sửa mới tạo record, trạm khác giữ nguyên', async ({ page, request }) => {
    const adminHeaders = await getAuthHeaders('admin');
    const a = await createDisposableStation(request, adminHeaders, { prefix: 'MB_A', suffix: 'a', initialFuel: 100, maxCapacity: 500, consumptionRate: 10 });
    const b = await createDisposableStation(request, adminHeaders, { prefix: 'MB_B', suffix: 'b', initialFuel: 200, maxCapacity: 1000, consumptionRate: 5 });
    const c = await createDisposableStation(request, adminHeaders, { prefix: 'MB_C', suffix: 'c', initialFuel: 50, maxCapacity: 500, consumptionRate: 10 });

    const beforeA = await captureFuelSnapshot(request, adminHeaders, a.id);
    const beforeB = await captureFuelSnapshot(request, adminHeaders, b.id);
    const beforeC = await captureFuelSnapshot(request, adminHeaders, c.id);

    await loginViaUi(page, 'manager');
    // load the table once, then target each station by its testid
    await openDirectEntryRow(page, a.stationCode);
    await expect(page.getByTestId(`direct-entry-row-${b.stationCode}`)).toBeVisible();
    await expect(page.getByTestId(`direct-entry-row-${c.stationCode}`)).toBeVisible();

    // A: +50, no run  -> 150 ; B: +100, no run -> 300 ; C: untouched
    await page.getByTestId(`fuel-added-input-${a.stationCode}`).fill('50');
    await page.getByTestId(`fuel-added-input-${b.stationCode}`).fill('100');

    await page.getByRole('button', { name: /kiểm tra dữ liệu/i }).click();
    await page.getByRole('button', { name: /xác nhận lưu/i }).click();
    const ack = page.getByRole('button', { name: /vẫn tạo|tiếp tục lưu/i });
    if (await ack.isVisible({ timeout: 3000 }).catch(() => false)) await ack.click();
    await expect(page.getByRole('heading', { name: 'Lưu thành công!' })).toBeVisible({ timeout: 20000 });

    await expectFuelSideEffect(request, adminHeaders, a.id, beforeA, { currentFuel: 150, recordDelta: 1 });
    await expectFuelSideEffect(request, adminHeaders, b.id, beforeB, { currentFuel: 300, recordDelta: 1 });
    // C was never edited — it must have no new record and an unchanged balance
    await expectNoFuelSideEffect(request, adminHeaders, c.id, beforeC);
  });
});
