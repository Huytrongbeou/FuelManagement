import { test, expect } from '@playwright/test';
import { getAuthHeaders, loginViaUi, navigateMobile, RUN_ID } from './helpers/auth';
import { createDisposableStation, getStationByNameApi, getCurrentFuelApi, deleteStationByCodeViaDb } from './helpers/stations';
import { getLatestFuelRecordApi, expectFuelMath } from './helpers/fuel';
import { captureFuelSnapshot, expectFuelSideEffect } from './helpers/assertions';

/**
 * Field usage on a phone: the write flows must actually work on a 390px viewport where nav is
 * behind the hamburger drawer and forms/tables scroll. Backend side-effects are still verified.
 */
test.describe('11 — Mobile field usage', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('MOB-02 Manager nhập nhiên liệu qua mobile, backend state đúng', async ({ page, request }) => {
    const adminHeaders = await getAuthHeaders('admin');
    const station = await createDisposableStation(request, adminHeaders, {
      prefix: 'MOB2', initialFuel: 100, maxCapacity: 500, consumptionRate: 10,
    });
    const before = await captureFuelSnapshot(request, adminHeaders, station.id);

    await loginViaUi(page, 'manager');
    await navigateMobile(page, 'directEntry');

    await page.getByRole('button', { name: /tải dữ liệu hiện tại/i }).click();
    // On a phone viewport DirectEntry renders card layout (MobileEntryCard), not the desktop
    // table — its testids carry a `-mobile-` marker.
    const card = page.getByTestId(`direct-entry-card-${station.stationCode}`);
    await expect(card).toBeVisible({ timeout: 20000 });

    await page.getByTestId(`fuel-added-input-mobile-${station.stationCode}`).fill('30');
    await page.getByTestId(`hours-run-input-mobile-${station.stationCode}`).fill('1');
    await page.getByRole('button', { name: /kiểm tra dữ liệu/i }).click();

    await page.getByRole('button', { name: /xác nhận lưu/i }).click();
    const ack = page.getByRole('button', { name: /vẫn tạo|tiếp tục lưu/i });
    if (await ack.isVisible({ timeout: 3000 }).catch(() => false)) await ack.click();
    await expect(page.getByRole('heading', { name: 'Lưu thành công!' })).toBeVisible({ timeout: 20000 });

    // 100 + 30 - (1 * 10) = 120
    await expectFuelSideEffect(request, adminHeaders, station.id, before, { currentFuel: 120, recordDelta: 1 });
    const latest = await getLatestFuelRecordApi(request, adminHeaders, station.id);
    expectFuelMath(latest!, { previousFuel: 100, added: 30, hoursRun: 1, consumed: 10, endFuel: 120 });
  });

  test('MOB-03 Admin tạo trạm qua modal mobile (form scroll, nút submit dùng được)', async ({ page, request }) => {
    const adminHeaders = await getAuthHeaders('admin');
    const stationName = `Trạm mobile ${RUN_ID}`;

    await loginViaUi(page, 'admin');
    await navigateMobile(page, 'stations');

    await page.getByRole('button', { name: /thêm trạm/i }).first().click();
    await expect(page.getByText('Thêm trạm mới')).toBeVisible();

    await page.locator('#station-name').fill(stationName);
    await page.locator('#consumption-rate').fill('8');
    await page.locator('#max-capacity').fill('300');
    await page.locator('#initial-fuel').fill('90');

    // The submit button sits at the bottom of a scrollable form — it must be reachable/usable
    await page.getByRole('button', { name: 'Tạo trạm' }).click();
    await expect(page.getByText('Thêm trạm mới')).toBeHidden({ timeout: 15000 });

    const station = await getStationByNameApi(request, adminHeaders, stationName);
    expect(station, 'station must be created from the mobile modal').toBeTruthy();
    try {
      const state = await getCurrentFuelApi(request, adminHeaders, station!.id);
      expect(Number(state!.currentFuel), 'initialFuel from mobile form must be applied').toBe(90);
    } finally {
      deleteStationByCodeViaDb(station!.code);
    }
  });
});
