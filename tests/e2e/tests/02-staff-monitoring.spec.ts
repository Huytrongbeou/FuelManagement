import { test, expect } from '@playwright/test';
import { getAuthHeaders, loginViaUi, logoutViaUi } from './helpers/auth';
import { createDisposableStation } from './helpers/stations';

test.describe('02 — Staff monitoring', () => {
  test('STAFF-02 Staff tìm trạm từ ô search topbar và mở đúng Station Detail', async ({ page, request }) => {
    const adminHeaders = await getAuthHeaders('admin');
    const station = await createDisposableStation(request, adminHeaders, { prefix: 'SEARCH', initialFuel: 50 });

    await loginViaUi(page, 'staff');

    // Use the global topbar search — the way a field user finds a station fast
    await page.getByLabel('Tìm theo mã trạm / tên trạm').fill(station.stationCode);
    const result = page.getByRole('button', { name: new RegExp(station.stationCode) });
    await expect(result.first(), 'search must surface the station in the dropdown').toBeVisible({ timeout: 10000 });
    await result.first().click();

    // Clicking the result opens that station's detail
    await expect(page.getByText(station.stationName).first(), 'the correct Station Detail must open').toBeVisible({ timeout: 15000 });
  });

  test('STAFF-06 Nút Import trên topbar: manager mở được trang Import, staff không thấy nút', async ({ page }) => {
    // Manager: the topbar Import button must actually navigate (it used to be a dead button)
    await loginViaUi(page, 'manager');
    const importBtn = page.getByRole('button', { name: 'Import', exact: true });
    await expect(importBtn, 'manager must see the topbar Import button').toBeVisible({ timeout: 10000 });
    await importBtn.click();
    await expect(
      page.getByRole('heading', { name: 'Import Excel' }),
      'clicking topbar Import must open the Import Excel page'
    ).toBeVisible({ timeout: 15000 });

    await logoutViaUi(page);

    // Staff may not import — the button must not be offered at all (same rule as the sidebar)
    await loginViaUi(page, 'staff');
    await expect(
      page.getByRole('button', { name: 'Import', exact: true }),
      'staff must not see the topbar Import button'
    ).toHaveCount(0);
  });
});
