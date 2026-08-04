import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

function readCtx() {
  const p = path.join(__dirname, '../fixtures/run_context.json');
  if (!fs.existsSync(p)) return { stationCode: 'MISSING', stationName: 'MISSING', adjRecords: [] };
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

// Station list is paginated (10/page) — filter by code first so the row is on the visible page.
// "Xem chi tiết" is targeted by aria-label since the other action buttons (Nhập NL,
// edit/disable dropdown) are conditionally rendered by role — position isn't stable across roles.
async function openStationDetail(page: import('@playwright/test').Page, stationCode: string) {
  await page.fill('input[placeholder="Mã / tên / địa chỉ trạm..."]', stationCode);
  const row = page.locator('tr', { hasText: stationCode });
  await expect(row).toBeVisible({ timeout: 5000 });
  await row.getByLabel('Xem chi tiết').click();
}

// ─── F13 — Fuel history UI ────────────────────────────────────────────────────

test.describe('F13 - Fuel history UI', () => {
  test.use({ storageState: undefined });

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.fill('input[placeholder="Nhập tên đăng nhập"]', process.env.MANAGER_USERNAME || 'manager');
    await page.fill('input[placeholder="Nhập mật khẩu"]', process.env.MANAGER_PASSWORD || 'manager123');
    await page.click('button:has-text("Đăng nhập")');
    await expect(page.getByText('Quản lý', { exact: true })).toBeVisible();
  });

  test('F13.1 History viewable on station detail', async ({ page }) => {
    test.info().annotations.push({ type: 'module', description: 'F13' });
    const { stationCode } = readCtx();

    await page.click('button:has-text("Danh sách trạm")');
    await openStationDetail(page, stationCode);
    await expect(page.locator('text=Lịch sử nhiên liệu')).toBeVisible();
  });
});

// ─── F14 — Adjustment UI ─────────────────────────────────────────────────────

test.describe('F14 - Adjustment UI', () => {
  test.use({ storageState: undefined });

  test('F14.1 Manager tạo adjustment request', async ({ page }) => {
    test.info().annotations.push({ type: 'module', description: 'F14' });
    test.info().annotations.push({ type: 'role', description: 'Manager' });
    if (process.env.RUN_MODE === 'production' && process.env.ALLOW_WRITE_TESTS !== 'true') {
      test.skip(true, 'Skipped write test in production');
    }

    await page.goto('/');
    await page.fill('input[placeholder="Nhập tên đăng nhập"]', process.env.MANAGER_USERNAME || 'manager');
    await page.fill('input[placeholder="Nhập mật khẩu"]', process.env.MANAGER_PASSWORD || 'manager123');
    await page.click('button:has-text("Đăng nhập")');

    const { stationCode } = readCtx();

    await page.click('button:has-text("Danh sách trạm")');
    await openStationDetail(page, stationCode);

    // "Yêu cầu điều chỉnh" button appears per row in the fuel history table
    const adjButton = page.locator('button:has-text("Yêu cầu điều chỉnh")').first();
    const adjVisible = await adjButton.isVisible({ timeout: 5000 }).catch(() => false);
    if (!adjVisible) {
      test.skip(true, 'No fuel records found to create adjustment request on');
    }
    await adjButton.click();

    // IDs confirmed from AdjustmentModal.tsx
    await page.fill('#adj-fuel-added', '10');
    await page.fill('#adj-hours-run', '1');
    await page.fill('#adj-notes', 'Ghi chú test');
    await page.fill('#adj-reason', 'Nhập sai số liệu ban đầu, cần điều chỉnh lại');
    await page.click('button:has-text("Gửi yêu cầu")');

    await expect(page.locator('[data-sonner-toast]')).toContainText(/thành công|đã được gửi/i, { timeout: 10000 });
  });

  test('F14.4 & F14.5 Admin approve adjustment', async ({ page }) => {
    test.info().annotations.push({ type: 'module', description: 'F14' });
    test.info().annotations.push({ type: 'role', description: 'Admin' });
    if (process.env.RUN_MODE === 'production' && process.env.ALLOW_WRITE_TESTS !== 'true') {
      test.skip(true, 'Skipped write test in production');
    }

    await page.goto('/');
    await page.fill('input[placeholder="Nhập tên đăng nhập"]', process.env.ADMIN_USERNAME || 'admin');
    await page.fill('input[placeholder="Nhập mật khẩu"]', process.env.ADMIN_PASSWORD || 'admin123');
    await page.click('button:has-text("Đăng nhập")');
    await expect(page.locator('text=Quản trị viên')).toBeVisible();

    // Adjustment approval lives on Settings → "Yêu cầu điều chỉnh" tab (admin-only), not on station detail
    await page.click('button:has-text("Tài khoản / Cài đặt")');
    await page.click('button:has-text("Yêu cầu điều chỉnh")');

    const approveBtn = page.locator('button:has-text("Phê duyệt")').first();
    const approveVisible = await approveBtn.isVisible({ timeout: 5000 }).catch(() => false);
    if (!approveVisible) {
      test.skip(true, 'No pending adjustment request found — run F14.1 first');
    }
    await approveBtn.click();
    await expect(page.locator('[data-sonner-toast]')).toContainText(/thành công|đã duyệt|đã phê duyệt/i, { timeout: 10000 });
  });

  test('F14.7 Staff không thấy adjustment actions', async ({ page }) => {
    test.info().annotations.push({ type: 'module', description: 'F14' });
    test.info().annotations.push({ type: 'role', description: 'Staff' });

    await page.goto('/');
    await page.fill('input[placeholder="Nhập tên đăng nhập"]', process.env.STAFF_USERNAME || 'staff');
    await page.fill('input[placeholder="Nhập mật khẩu"]', process.env.STAFF_PASSWORD || 'staff123');
    await page.click('button:has-text("Đăng nhập")');

    const { stationCode } = readCtx();

    await page.click('button:has-text("Danh sách trạm")');
    await openStationDetail(page, stationCode);

    await expect(page.locator('button:has-text("Yêu cầu điều chỉnh")')).not.toBeVisible();

    // Adjustment approval tab is admin-only — staff shouldn't even see the Settings tab trigger
    await page.click('button:has-text("Tài khoản / Cài đặt")');
    await expect(page.locator('button:has-text("Yêu cầu điều chỉnh")')).not.toBeVisible();
  });
});
