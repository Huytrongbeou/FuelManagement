import { test, expect } from '@playwright/test';
import { getAuthHeaders, loginViaUi, navigateTo } from './helpers/auth';
import { createDisposableStation, getStationApi } from './helpers/stations';
import { getLatestFuelRecordApi, expectFuelMath, ddmmyyyyDaysAgo } from './helpers/fuel';
import { captureFuelSnapshot, expectFuelSideEffect } from './helpers/assertions';
import { createExcelFile, uploadImportViaUi } from './helpers/import';

test.describe('05 — Manager Excel import', () => {
  test('IMPORT-02 Import Excel hợp lệ qua UI, FuelRecord + CurrentFuelState đúng công thức', async ({ page, request }) => {
    const adminHeaders = await getAuthHeaders('admin');
    const station = await createDisposableStation(request, adminHeaders, {
      prefix: 'IMPORT', initialFuel: 100, maxCapacity: 1000, consumptionRate: 10,
    });
    const before = await captureFuelSnapshot(request, adminHeaders, station.id);

    // Dated 3 days back and written dd/mm/yyyy — the way a real Vietnamese user fills the sheet.
    // Also keeps it off "today", so the station's own genesis record can't muddy the assertion.
    const recordedDate = ddmmyyyyDaysAgo(3);
    const filePath = createExcelFile(
      [{ stationCode: station.stationCode, fuelAdded: 100, hoursRun: 2, recordedDate }],
      `import02-${station.stationCode}.xlsx`
    );

    await loginViaUi(page, 'manager');
    await navigateTo(page, 'import');
    await expect(page.getByRole('heading', { name: 'Import Excel' })).toBeVisible();

    await uploadImportViaUi(page, filePath);
    await expect(page.getByText('Tổng dòng')).toBeVisible({ timeout: 20000 });

    await page.click('button:has-text("Tiếp theo")');
    const ackCheckbox = page.locator('input[type="checkbox"]');
    if (await ackCheckbox.isVisible({ timeout: 2000 }).catch(() => false)) await ackCheckbox.check();

    await page.getByRole('button', { name: /xác nhận import/i }).click();
    await expect(page.getByText(/import thành công/i)).toBeVisible({ timeout: 25000 });

    // 100 + 100 - (2 * 10) = 180
    await expectFuelSideEffect(request, adminHeaders, station.id, before, { currentFuel: 180, recordDelta: 1 });

    const latest = await getLatestFuelRecordApi(request, adminHeaders, station.id);
    expectFuelMath(latest!, { previousFuel: 100, added: 100, hoursRun: 2, consumed: 20, endFuel: 180 });
    expect(latest!.source, 'a file import must be recorded with source=import').toBe('import');

    // Fuel import must never write master data
    const after = await getStationApi(request, adminHeaders, station.id);
    expect(Number(after.maxCapacity), 'import must not change maxCapacity').toBe(1000);
    expect(Number(after.fuelRate), 'import must not change consumptionRate').toBe(10);
  });
});
