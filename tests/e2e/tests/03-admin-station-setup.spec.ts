import { test, expect, type Page } from '@playwright/test';
import { getAuthHeaders, loginViaUi, navigateTo, RUN_ID } from './helpers/auth';
import {
  createDisposableStation, getStationByCodeApi, getStationByNameApi, getCurrentFuelApi,
  deleteStationByCodeViaDb,
} from './helpers/stations';

/** Opens the "Thêm trạm" modal from the station list. */
async function openAddStationModal(page: Page) {
  await navigateTo(page, 'stations');
  await page.getByRole('button', { name: /thêm trạm/i }).first().click();
  await expect(page.getByText('Thêm trạm mới')).toBeVisible();
}

/**
 * Phase 1 — Admin sets a station up through the real UI, and the fuel state that the rest of
 * the system treats as source of truth must match what was typed into the form.
 */
test.describe('03 — Admin station setup', () => {
  test('ADMIN-01 Admin tạo trạm qua UI với initialFuel, CurrentFuelState khớp đúng', async ({ page, request }) => {
    const adminHeaders = await getAuthHeaders('admin');
    // The code is auto-assigned now, so the unique name is how we find the station afterwards.
    const stationName = `Trạm kiểm thử ${RUN_ID}`;

    await loginViaUi(page, 'admin');
    await navigateTo(page, 'stations');

    await page.getByRole('button', { name: /thêm trạm/i }).first().click();
    await expect(page.getByText('Thêm trạm mới')).toBeVisible();

    await page.locator('#station-name').fill(stationName);
    await page.locator('#station-address').fill('Cao Lãnh, Đồng Tháp');
    await page.locator('#consumption-rate').fill('10');
    await page.locator('#max-capacity').fill('500');
    await page.locator('#initial-fuel').fill('120');

    await page.getByRole('button', { name: 'Tạo trạm' }).click();

    // The modal must close — a station that failed to save must not look like a success.
    await expect(page.getByText('Thêm trạm mới')).toBeHidden({ timeout: 15000 });

    // Backend truth: station exists with the typed master data and an auto-assigned CL-NNN code...
    const station = await getStationByNameApi(request, adminHeaders, stationName);
    expect(station, `station "${stationName}" must exist after UI create`).toBeTruthy();
    expect(station!.code, 'code must be auto-assigned in the CL-NNN series').toMatch(/^CL-\d+$/);
    expect(Number(station!.maxCapacity)).toBe(500);
    expect(Number(station!.fuelRate)).toBe(10);
    expect(station!.active).toBe(true);

    try {
      // ...and CurrentFuelState was initialised to exactly the initialFuel that was typed,
      // not silently defaulted to 0.
      const state = await getCurrentFuelApi(request, adminHeaders, station!.id);
      expect(state, 'CurrentFuelState must be initialised at station creation').not.toBeNull();
      expect(Number(state!.currentFuel), 'CurrentFuelState must equal the initialFuel entered').toBe(120);
    } finally {
      deleteStationByCodeViaDb(station!.code);
    }
  });

  test('ADMIN-02 Để trống initialFuel: UI nói rõ = 0 L, backend CurrentFuelState = 0 (không âm thầm)', async ({ page, request }) => {
    const adminHeaders = await getAuthHeaders('admin');
    const stationName = `Trạm tồn 0 ${RUN_ID}`;

    await loginViaUi(page, 'admin');
    await openAddStationModal(page);

    await page.locator('#station-name').fill(stationName);
    await page.locator('#consumption-rate').fill('10');
    await page.locator('#max-capacity').fill('200');
    // deliberately leave #initial-fuel empty — the UI must state the consequence, not hide it
    await expect(page.getByText(/tồn ban đầu = 0 L/i)).toBeVisible();

    await page.getByRole('button', { name: 'Tạo trạm' }).click();
    await expect(page.getByText('Thêm trạm mới')).toBeHidden({ timeout: 15000 });

    const station = await getStationByNameApi(request, adminHeaders, stationName);
    expect(station, 'station must exist').toBeTruthy();
    try {
      const state = await getCurrentFuelApi(request, adminHeaders, station!.id);
      expect(state, 'even with 0 fuel, CurrentFuelState must be initialised').not.toBeNull();
      expect(Number(state!.currentFuel), 'empty initialFuel must resolve to exactly 0').toBe(0);
    } finally {
      deleteStationByCodeViaDb(station!.code);
    }
  });

  test('ADMIN-03 initialFuel > maxCapacity bị từ chối, không tạo trạm', async ({ page, request }) => {
    const adminHeaders = await getAuthHeaders('admin');
    const stationName = `Trạm quá tồn ${RUN_ID}`;

    await loginViaUi(page, 'admin');
    await openAddStationModal(page);

    await page.locator('#station-name').fill(stationName);
    await page.locator('#consumption-rate').fill('10');
    await page.locator('#max-capacity').fill('100');
    await page.locator('#initial-fuel').fill('150'); // 150 > 100

    await page.getByRole('button', { name: 'Tạo trạm' }).click();

    // The create must be refused — the modal stays open (no fake success)
    await expect(page.getByText('Thêm trạm mới')).toBeVisible();

    // Backend truth: the station must NOT have been created, not even partially.
    // Poll briefly to rule out a lagging async create.
    for (let i = 0; i < 4; i++) {
      const found = await getStationByNameApi(request, adminHeaders, stationName);
      expect(found, 'an over-capacity initialFuel must not create a station').toBeUndefined();
      await page.waitForTimeout(500);
    }
  });

  test('ADMIN-05 Admin vô hiệu hóa trạm qua UI, backend chuyển inactive', async ({ page, request }) => {
    const adminHeaders = await getAuthHeaders('admin');
    const station = await createDisposableStation(request, adminHeaders, { prefix: 'DEACT', initialFuel: 50 });

    await loginViaUi(page, 'admin');
    await navigateTo(page, 'stations');

    // Filter the list down to the disposable station so its row is on-screen
    await page.getByLabel('Tìm trạm theo mã, tên hoặc địa chỉ').fill(station.stationCode);
    const row = page.locator('tr', { hasText: station.stationCode });
    await expect(row, 'the station row must appear after searching').toBeVisible({ timeout: 15000 });

    // Open the row's actions menu, then "Vô hiệu hóa"
    await row.getByRole('button').last().click();
    await page.getByRole('menuitem', { name: /vô hiệu hóa/i }).click();

    // Confirmation dialog: reason + explicit confirm checkbox, then the destructive action
    await expect(page.getByText('Vô hiệu hóa trạm?')).toBeVisible({ timeout: 10000 });
    await page.locator('#deactivate-reason').fill('Ngừng hoạt động để bảo trì (test)');
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: /xác nhận vô hiệu hóa/i }).click();

    // Backend truth: the station is actually inactive (no fake success)
    await expect.poll(
      async () => (await getStationByCodeApi(request, adminHeaders, station.stationCode))?.active,
      { message: 'station must be inactive in the backend after UI deactivate', timeout: 15000 }
    ).toBe(false);
  });
});
