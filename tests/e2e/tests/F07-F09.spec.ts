import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

function readCtx() {
  const p = path.join(__dirname, '../fixtures/run_context.json');
  if (!fs.existsSync(p)) return { stationCode: 'MISSING' };
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

test.describe('F07 & F08 - Dashboard and Station List', () => {
  test.use({ storageState: undefined });

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.fill('input[placeholder="Nhập tên đăng nhập"]', process.env.MANAGER_USERNAME || 'manager');
    await page.fill('input[placeholder="Nhập mật khẩu"]', process.env.MANAGER_PASSWORD || 'manager123');
    await page.click('button:has-text("Đăng nhập")');
    await expect(page.getByText('Quản lý', { exact: true })).toBeVisible();
  });

  test('F07.1 Dashboard cards', async ({ page }) => {
    test.info().annotations.push({ type: 'module', description: 'F07' });
    await expect(page.locator('text=Tổng số trạm')).toBeVisible();
    await expect(page.locator('text=Tổng NL tồn (L)')).toBeVisible();

    const bodyText = await page.innerText('body');
    expect(bodyText).not.toContain('NaN');
    expect(bodyText).not.toContain('undefined');
    expect(bodyText).not.toContain('null');
  });

  test('F08.1 Station list load và tìm kiếm', async ({ page }) => {
    test.info().annotations.push({ type: 'module', description: 'F08' });
    const { stationCode } = readCtx();

    await page.click('button:has-text("Danh sách trạm")');
    await expect(page.locator('text=Tên trạm')).toBeVisible();

    const searchInput = page.locator('input[placeholder="Tìm kiếm trạm..."]');
    if (await searchInput.isVisible()) {
      await searchInput.fill(stationCode);
      await expect(page.locator(`text=${stationCode}`)).toBeVisible();
    }
  });

  test('F08.3 Station filter theo trạng thái', async ({ page }) => {
    test.info().annotations.push({ type: 'module', description: 'F08' });

    await page.click('button:has-text("Danh sách trạm")');
    await expect(page.locator('text=Tên trạm')).toBeVisible();

    // Look for a status filter (dropdown or radio/tab)
    const statusFilter = page.locator('select[name="status"], [aria-label*="trạng thái"], button:has-text("Hoạt động"), button:has-text("Ngừng")');
    if (!(await statusFilter.first().isVisible())) {
      test.skip(true, 'No status filter found on station list');
    }

    // Click "Hoạt động" (active) filter
    const activeFilter = page.locator('button:has-text("Hoạt động"), option:has-text("Hoạt động")').first();
    if (await activeFilter.isVisible()) {
      await activeFilter.click();
      await page.waitForTimeout(500);
      // All visible rows should be active stations
      const bodyText = await page.locator('table tbody').innerText();
      expect(bodyText).not.toContain('Ngừng hoạt động');
    }
  });

  test('F08.4 Map render', async ({ page }) => {
    test.info().annotations.push({ type: 'module', description: 'F08' });
    await page.click('button:has-text("Bản đồ trạm")');
    await expect(page.locator('.leaflet-container')).toBeVisible();
  });
});

test.describe('F09 - Admin station/brand/model UI', () => {
  test.use({ storageState: undefined });

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.fill('input[placeholder="Nhập tên đăng nhập"]', process.env.ADMIN_USERNAME || 'admin');
    await page.fill('input[placeholder="Nhập mật khẩu"]', process.env.ADMIN_PASSWORD || 'admin123');
    await page.click('button:has-text("Đăng nhập")');
    await expect(page.locator('text=Quản trị viên')).toBeVisible();
  });

  test('F09.1 Create brand', async ({ page }) => {
    test.info().annotations.push({ type: 'module', description: 'F09' });
    if (process.env.RUN_MODE === 'production' && process.env.ALLOW_WRITE_TESTS !== 'true') {
      test.skip(true, 'Skipped write test in production');
    }

    const runId = process.env.RUN_ID || Date.now().toString();
    const brandName = `FE_BRAND_UI_${runId}`;

    await page.click('button:has-text("Hãng máy phát")');
    await page.click('button:has-text("Thêm hãng")');
    await page.fill('input[placeholder="Ví dụ: Cummins"]', brandName);
    await page.fill('input[placeholder="Ví dụ: Mỹ"]', 'VN');
    await page.click('button:has-text("Lưu")');

    await expect(page.locator('[data-sonner-toast]')).toBeHidden({ timeout: 5000 }).catch(() => {});
    await expect(page.locator('table').getByText(brandName, { exact: true })).toBeVisible({ timeout: 5000 });
  });

  test('F09.3 Reject negative consumption rate', async ({ page }) => {
    test.info().annotations.push({ type: 'module', description: 'F09' });
    test.info().annotations.push({ type: 'severity', description: 'HIGH' });
    if (process.env.RUN_MODE === 'production' && process.env.ALLOW_WRITE_TESTS !== 'true') {
      test.skip(true, 'Skipped write test in production');
    }

    const runId = process.env.RUN_ID || Date.now().toString();

    await page.click('button:has-text("Model máy phát")');
    await page.click('button:has-text("Thêm model")');

    // Wait for modal to open
    await expect(page.locator('[role="dialog"]')).toBeVisible();

    // Fill all required fields using confirmed IDs from GeneratorModels.tsx
    const brandSelect = page.locator('#gen-model-brand');
    if (await brandSelect.isVisible()) {
      // Select first non-empty option
      const options = await brandSelect.locator('option').allTextContents();
      const firstReal = options.find(o => o.trim() && !o.includes('Chọn'));
      if (firstReal) await brandSelect.selectOption({ label: firstReal });
    }

    await page.fill('#gen-model-name', `MODEL_NEG_${runId}`);
    await page.fill('#gen-model-power-kva', '100');

    const fuelTypeSelect = page.locator('#gen-model-fuel-type');
    if (await fuelTypeSelect.isVisible()) {
      await fuelTypeSelect.selectOption('diesel');
    }

    // Set negative consumption rate — the field under test
    await page.fill('#gen-model-suggested-rate', '-1');
    await page.fill('#gen-model-suggested-capacity', '200');

    await page.click('button:has-text("Lưu")');

    // Modal must stay open (not close) because the value is invalid
    await expect(page.locator('[role="dialog"]')).toBeVisible();
  });
});
