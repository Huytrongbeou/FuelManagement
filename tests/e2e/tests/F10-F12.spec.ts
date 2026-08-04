import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

// Read context written by global-setup
function readCtx() {
  const p = path.join(__dirname, '../fixtures/run_context.json');
  if (!fs.existsSync(p)) return { stationCode: 'MISSING', stationName: 'MISSING' };
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

// ─── F10 — Manual fuel entry (DirectEntry page) ──────────────────────────────

test.describe('F10 - Manual fuel entry UI', () => {
  test.use({ storageState: undefined });

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.fill('input[placeholder="Nhập tên đăng nhập"]', process.env.MANAGER_USERNAME || 'manager');
    await page.fill('input[placeholder="Nhập mật khẩu"]', process.env.MANAGER_PASSWORD || 'manager123');
    await page.click('button:has-text("Đăng nhập")');
    await expect(page.getByText('Quản lý', { exact: true })).toBeVisible();
    await page.click('button:has-text("Nhập dữ liệu trực tiếp")');
  });

  test('F10.2 Input hợp lệ fuelAdded=51', async ({ page }) => {
    test.info().annotations.push({ type: 'module', description: 'F10' });
    if (process.env.RUN_MODE === 'production' && process.env.ALLOW_WRITE_TESTS !== 'true') {
      test.skip(true, 'Skipped write test in production');
    }

    const { stationCode } = readCtx();

    // Load current station list into the table
    await page.click('button:has-text("Tải dữ liệu hiện tại")');
    await expect(page.locator('table tbody tr').first()).toBeVisible({ timeout: 10000 });

    // Find the row containing the test station code
    const row = page.locator('tr', { hasText: stationCode });
    await expect(row).toBeVisible({ timeout: 5000 });

    // Fill fuel inputs using row-scoped aria-label (starts-with to avoid exact-name dependency)
    await row.locator('[aria-label^="NL bổ sung"]').fill('51');
    await row.locator('[aria-label^="Số giờ chạy"]').fill('2');

    // Validate before confirm
    await page.click('button:has-text("Kiểm tra dữ liệu")');
    await expect(page.locator('button:has-text("Xác nhận lưu")')).toBeEnabled({ timeout: 10000 });

    // Submit — station already has records today from setup, so this may land as a
    // warning requiring the ack dialog before it actually saves.
    await page.click('button:has-text("Xác nhận lưu")');
    const ackContinueBtn = page.getByRole('button', { name: /vẫn tạo|tiếp tục lưu/i });
    if (await ackContinueBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await ackContinueBtn.click();
    }
    // Success shows a Dialog modal ("Lưu thành công!"), not a toast
    await expect(page.getByText('Lưu thành công!')).toBeVisible({ timeout: 10000 });
  });

  test('F10.5 Negative fuelAdded bị từ chối', async ({ page }) => {
    test.info().annotations.push({ type: 'module', description: 'F10' });

    const { stationCode } = readCtx();

    await page.click('button:has-text("Tải dữ liệu hiện tại")');
    await expect(page.locator('table tbody tr').first()).toBeVisible({ timeout: 10000 });

    const row = page.locator('tr', { hasText: stationCode });
    await expect(row).toBeVisible({ timeout: 5000 });

    await row.locator('[aria-label^="NL bổ sung"]').fill('-5');
    await page.click('button:has-text("Kiểm tra dữ liệu")');

    // Either "Xác nhận lưu" stays disabled, or a validation message appears
    const confirmDisabled = await page.locator('button:has-text("Xác nhận lưu")').isDisabled();
    const errorVisible = await page.locator('text=/không hợp lệ|lớn hơn 0|âm/i').isVisible();
    expect(confirmDisabled || errorVisible).toBeTruthy();
  });
});

// ─── F11 — Excel Import UI ────────────────────────────────────────────────────

test.describe('F11 - Excel import UI', () => {
  test.use({ storageState: undefined });

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.fill('input[placeholder="Nhập tên đăng nhập"]', process.env.ADMIN_USERNAME || 'admin');
    await page.fill('input[placeholder="Nhập mật khẩu"]', process.env.ADMIN_PASSWORD || 'admin123');
    await page.click('button:has-text("Đăng nhập")');
    await expect(page.locator('text=Quản trị viên')).toBeVisible();
    await page.click('button:has-text("Import Excel")');
    await expect(page.getByRole('heading', { name: 'Import Excel' })).toBeVisible();
  });

  async function uploadFile(page: any, filePath: string) {
    const fileInput = page.locator('[aria-label="Chọn file Excel (.xlsx)"]');
    if (await fileInput.count() > 0) {
      await fileInput.setInputFiles(filePath);
    } else {
      const [fc] = await Promise.all([
        page.waitForEvent('filechooser'),
        page.click('[aria-label="Khu vực tải file — kéo thả hoặc nhấn để chọn file Excel"]'),
      ]);
      await fc.setFiles(filePath);
    }
  }

  test('F11.2 Upload valid-1row.xlsx thành công', async ({ page }) => {
    test.info().annotations.push({ type: 'module', description: 'F11' });
    if (process.env.RUN_MODE === 'production' && process.env.ALLOW_WRITE_TESTS !== 'true') {
      test.skip(true, 'Skipped write test in production');
    }

    const fixturePath = path.join(__dirname, '../fixtures/excel/valid-1row.xlsx');
    if (!fs.existsSync(fixturePath)) {
      test.skip(true, 'Fixture valid-1row.xlsx not found — run global-setup first');
    }

    await uploadFile(page, fixturePath);
    await page.click('button:has-text("Tiếp theo")'); // step1 → step2 (upload)
    await expect(page.locator('text=Tổng dòng')).toBeVisible({ timeout: 15000 });

    await page.click('button:has-text("Tiếp theo")'); // step2 → step3 (preview → confirm)

    // Station already has records today from setup — this may land as a warning row requiring ack
    const ackCheckbox = page.locator('input[type="checkbox"]');
    if (await ackCheckbox.isVisible({ timeout: 2000 }).catch(() => false)) {
      await ackCheckbox.check();
    }

    await page.getByRole('button', { name: /xác nhận import/i }).click();
    await expect(page.getByText('Import thành công!')).toBeVisible({ timeout: 15000 });
  });

  test('F11.3 Reject file sai extension (.txt)', async ({ page }) => {
    test.info().annotations.push({ type: 'module', description: 'F11' });

    const tmpPath = path.join(__dirname, '../fixtures/invalid_test.txt');
    fs.writeFileSync(tmpPath, 'dummy text');

    try {
      await uploadFile(page, tmpPath);
      await expect(page.locator('[data-sonner-toast]')).toContainText(/chỉ chấp nhận file/i, { timeout: 5000 });
    } finally {
      fs.unlinkSync(tmpPath);
    }
  });

  test('F11.4 partial-invalid → all-or-nothing: confirm block hoặc trả lỗi', async ({ page }) => {
    test.info().annotations.push({ type: 'module', description: 'F11' });
    test.info().annotations.push({ type: 'severity', description: 'HIGH' });

    const fixturePath = path.join(__dirname, '../fixtures/excel/partial-invalid.xlsx');
    if (!fs.existsSync(fixturePath)) test.skip(true, 'Fixture partial-invalid.xlsx not found');

    await uploadFile(page, fixturePath);
    await page.click('button:has-text("Tiếp theo")'); // step1 → step2
    await expect(page.locator('text=Tổng dòng')).toBeVisible({ timeout: 15000 });

    // Step2's "Tiếp theo" (proceed to confirm) must be disabled while errorRows > 0 — all-or-nothing
    const nextBtn = page.locator('button:has-text("Tiếp theo")');
    await expect(nextBtn).toBeDisabled({ timeout: 5000 });
    await expect(page.locator('text=/không thể xác nhận/i')).toBeVisible();
  });

  test('F11.5 all-invalid → không có record nào được tạo', async ({ page }) => {
    test.info().annotations.push({ type: 'module', description: 'F11' });

    const fixturePath = path.join(__dirname, '../fixtures/excel/all-invalid.xlsx');
    if (!fs.existsSync(fixturePath)) test.skip(true, 'Fixture all-invalid.xlsx not found');

    await uploadFile(page, fixturePath);
    await page.click('button:has-text("Tiếp theo")');
    await expect(page.locator('text=Tổng dòng')).toBeVisible({ timeout: 15000 });

    const nextBtn = page.locator('button:has-text("Tiếp theo")');
    await expect(nextBtn).toBeDisabled({ timeout: 5000 });
  });

  test('F11.6 wrong-format.xlsx → không crash, không tạo record', async ({ page }) => {
    test.info().annotations.push({ type: 'module', description: 'F11' });

    const fixturePath = path.join(__dirname, '../fixtures/excel/wrong-format.xlsx');
    if (!fs.existsSync(fixturePath)) test.skip(true, 'Fixture wrong-format.xlsx not found');

    await uploadFile(page, fixturePath);
    await page.click('button:has-text("Tiếp theo")');
    await page.waitForTimeout(3000);

    // Must NOT show an unhandled crash
    await expect(page.locator('text=Uncaught')).not.toBeVisible();
    await expect(page.locator('text=Cannot read')).not.toBeVisible();

    // Either upload failed (error toast, stayed on step1) or reached step2 — either way, no crash and no record created
    const onStep2 = await page.locator('text=Tổng dòng').isVisible();
    if (!onStep2) {
      await expect(page.locator('[data-sonner-toast]')).toContainText(/lỗi|không thể|không hợp lệ|thất bại/i, { timeout: 5000 });
    }
  });
});

// ─── F12 — Export Excel UI ────────────────────────────────────────────────────

test.describe('F12 - Export Excel UI', () => {
  test.use({ storageState: undefined });

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.fill('input[placeholder="Nhập tên đăng nhập"]', process.env.MANAGER_USERNAME || 'manager');
    await page.fill('input[placeholder="Nhập mật khẩu"]', process.env.MANAGER_PASSWORD || 'manager123');
    await page.click('button:has-text("Đăng nhập")');
    await expect(page.getByText('Quản lý', { exact: true })).toBeVisible();
  });

  test('F12.1 Export từ danh sách trạm không rỗng', async ({ page }) => {
    test.info().annotations.push({ type: 'module', description: 'F12' });

    await page.click('button:has-text("Danh sách trạm")');
    const exportBtn = page.locator('button:has-text("Export")');
    if (!(await exportBtn.isVisible())) {
      test.skip(true, 'Export button not found on station list');
    }

    const downloadPromise = page.waitForEvent('download');
    await exportBtn.click();
    const download = await downloadPromise;

    const filePath = await download.path();
    expect(filePath).not.toBeNull();
    const stat = fs.statSync(filePath!);
    expect(stat.size).toBeGreaterThan(0);
  });

  test('F12.2 Export file tổng từ trang Import Excel', async ({ page }) => {
    test.info().annotations.push({ type: 'module', description: 'F12' });

    // beforeEach already logged in as Manager — log out before switching to Admin
    await page.locator('[title="Đăng xuất"]').click();
    await expect(page.locator('#login-username')).toBeVisible({ timeout: 5000 });

    await page.fill('input[placeholder="Nhập tên đăng nhập"]', process.env.ADMIN_USERNAME || 'admin');
    await page.fill('input[placeholder="Nhập mật khẩu"]', process.env.ADMIN_PASSWORD || 'admin123');
    await page.click('button:has-text("Đăng nhập")');
    await expect(page.locator('text=Quản trị viên')).toBeVisible();

    await page.getByRole('button', { name: 'Import Excel' }).click();
    await expect(page.getByRole('heading', { name: 'Import Excel' })).toBeVisible();

    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 30000 }),
      page.getByRole('button', { name: /Export file tổng/i }).click(),
    ]);
    expect(download.suggestedFilename()).toContain('.xlsx');
    await download.cancel();
  });
});
