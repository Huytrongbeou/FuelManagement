import { test, expect } from '@playwright/test';

// F04: Staff RBAC
test.describe('F04 - Staff RBAC', () => {
  test.use({ storageState: undefined }); // Don't share auth state
  
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.fill('input[placeholder="Nhập tên đăng nhập"]', process.env.STAFF_USERNAME || 'staff');
    await page.fill('input[placeholder="Nhập mật khẩu"]', process.env.STAFF_PASSWORD || 'staff123');
    await page.click('button:has-text("Đăng nhập")');
    await expect(page.locator('text=Nhân viên')).toBeVisible();
  });

  test('F04.1 & F04.2 Staff xem dashboard/station/map', async ({ page }) => {
    test.info().annotations.push({ type: 'module', description: 'F04' }, { type: 'role', description: 'Staff' });
    
    // Check Dashboard
    await expect(page.locator('text=Tổng số trạm')).toBeVisible();
    
    // Check Station List
    await page.click('button:has-text("Danh sách trạm")');
    await expect(page.locator('text=Tên trạm')).toBeVisible();
    
    // Check Map
    await page.click('button:has-text("Bản đồ trạm")');
    await expect(page.locator('.leaflet-container')).toBeVisible();
  });

  test('F04.3 Staff không thấy manual-entry/import/station edit', async ({ page }) => {
    test.info().annotations.push({ type: 'module', description: 'F04' }, { type: 'role', description: 'Staff' });

    // Should not see Import Excel
    await expect(page.locator('button:has-text("Import Excel")')).not.toBeVisible();

    // Should not see Nhập dữ liệu trực tiếp
    await expect(page.locator('button:has-text("Nhập dữ liệu trực tiếp")')).not.toBeVisible();

    // Staff may now start a station, but only as a proposal for review — the button opens the
    // "Đề xuất trạm mới" form, never a direct create. Creating a station outright is still
    // admin-only at the API and is asserted by RBAC-02.
    await page.click('button:has-text("Danh sách trạm")');
    await expect(page.locator('button:has-text("Thêm trạm")')).toBeVisible();
    await page.click('button:has-text("Thêm trạm")');
    await expect(page.getByText('Đề xuất trạm mới')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Gửi đề xuất' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Tạo trạm' })).toHaveCount(0);
    await page.keyboard.press('Escape');

    // Staff must not be able to review proposals either.
    await expect(page.locator('button:has-text("Duyệt đề xuất trạm")')).not.toBeVisible();

    // Staff is read-only on station rows: no "Nhập NL", no edit/disable dropdown — only view-detail
    const firstRow = page.locator('table tbody tr').first();
    await expect(firstRow).toBeVisible({ timeout: 10000 });
    await expect(firstRow.locator('button:has-text("Nhập NL")')).not.toBeVisible();
    await expect(firstRow.getByLabel('Xem chi tiết')).toBeVisible();
    await expect(firstRow.locator('button')).toHaveCount(1);
  });

  test('F04.5 Staff tamper localStorage role', async ({ page }) => {
    test.info().annotations.push({ type: 'module', description: 'F04' }, { type: 'role', description: 'Staff' });
    test.info().annotations.push({ type: 'severity', description: 'HIGH' });
    
    // Tamper with localStorage
    await page.evaluate(() => {
      const raw = localStorage.getItem('fuel:v1:user');
      if (raw) {
        const user = JSON.parse(raw);
        user.role = 'admin';
        localStorage.setItem('fuel:v1:user', JSON.stringify(user));
      }
    });
    
    // Refresh page
    await page.reload();
    
    // Verify backend still blocks or UI doesn't allow admin actions (assuming JWT token role is used by backend)
    // The UI might show admin menus because we modified local storage, but API calls should fail.
    // If it doesn't show admin menus, even better.
    const hasAdminMenu = await page.locator('button:has-text("Hãng máy phát")').isVisible();
    if (hasAdminMenu) {
      // Try to navigate to Brands
      await page.click('button:has-text("Hãng máy phát")');
      // Look for a failure or at least we couldn't create one
      await page.click('button:has-text("Thêm hãng")');
      await page.fill('input[placeholder="Ví dụ: Cummins"]', 'TamperBrand');
      await page.click('button:has-text("Lưu")');
      // Should see some error toast
      await expect(page.locator('li[data-sonner-toast]')).toContainText(/lỗi|error|không có quyền/i);
    } else {
      expect(hasAdminMenu).toBe(false);
    }
  });
});

// F05: Manager RBAC
test.describe('F05 - Manager RBAC', () => {
  test.use({ storageState: undefined });

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.fill('input[placeholder="Nhập tên đăng nhập"]', process.env.MANAGER_USERNAME || 'manager');
    await page.fill('input[placeholder="Nhập mật khẩu"]', process.env.MANAGER_PASSWORD || 'manager123');
    await page.click('button:has-text("Đăng nhập")');
    await expect(page.getByText('Quản lý', { exact: true })).toBeVisible();
  });

  test('F05.1 & F05.2 & F05.3 Manager được manual-entry/import', async ({ page }) => {
    test.info().annotations.push({ type: 'module', description: 'F05' }, { type: 'role', description: 'Manager' });
    
    await expect(page.locator('button:has-text("Nhập dữ liệu trực tiếp")')).toBeVisible();
    await page.click('button:has-text("Nhập dữ liệu trực tiếp")');
    await expect(page.locator('button:has-text("Tải dữ liệu hiện tại")')).toBeVisible();
    
    await expect(page.locator('button:has-text("Import Excel")')).toBeVisible();
    await page.click('button:has-text("Import Excel")');
    await expect(page.locator('text=Kéo và thả file Excel vào đây')).toBeVisible();
  });

  test('F05.4 Manager không được quản lý master data', async ({ page }) => {
    test.info().annotations.push({ type: 'module', description: 'F05' }, { type: 'role', description: 'Manager' });

    await expect(page.locator('button:has-text("Hãng máy phát")')).not.toBeVisible();
    await expect(page.locator('button:has-text("Model máy phát")')).not.toBeVisible();

    await page.click('button:has-text("Danh sách trạm")');
    // Like staff, a manager starts a station as a proposal — direct creation stays admin-only at
    // the API (asserted by RBAC-03). A manager may then approve it, which is their remit.
    await expect(page.locator('button:has-text("Thêm trạm")')).toBeVisible();
    await page.click('button:has-text("Thêm trạm")');
    await expect(page.getByText('Đề xuất trạm mới')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Tạo trạm' })).toHaveCount(0);
    await page.keyboard.press('Escape');

    // Manager can enter fuel data but not edit/disable stations: "Nhập NL" + view-detail only, no dropdown
    const firstRow = page.locator('table tbody tr').first();
    await expect(firstRow).toBeVisible({ timeout: 10000 });
    await expect(firstRow.locator('button:has-text("Nhập NL")')).toBeVisible();
    await expect(firstRow.getByLabel('Xem chi tiết')).toBeVisible();
    await expect(firstRow.locator('button')).toHaveCount(2);
  });
});

// F06: Admin RBAC
test.describe('F06 - Admin RBAC', () => {
  test.use({ storageState: undefined });

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.fill('input[placeholder="Nhập tên đăng nhập"]', process.env.ADMIN_USERNAME || 'admin');
    await page.fill('input[placeholder="Nhập mật khẩu"]', process.env.ADMIN_PASSWORD || 'admin123');
    await page.click('button:has-text("Đăng nhập")');
    await expect(page.locator('text=Quản trị viên')).toBeVisible();
  });

  test('F06.1 Admin thấy và thao tác được mọi nơi', async ({ page }) => {
    test.info().annotations.push({ type: 'module', description: 'F06' }, { type: 'role', description: 'Admin' });
    test.info().annotations.push({ type: 'severity', description: 'HIGH' });
    
    await expect(page.locator('button:has-text("Dashboard")')).toBeVisible();
    await expect(page.locator('button:has-text("Danh sách trạm")')).toBeVisible();
    await expect(page.locator('button:has-text("Bản đồ trạm")')).toBeVisible();
    await expect(page.locator('button:has-text("Nhập dữ liệu trực tiếp")')).toBeVisible();
    await expect(page.locator('button:has-text("Import Excel")')).toBeVisible();
    await expect(page.locator('button:has-text("Hãng máy phát")')).toBeVisible();
    await expect(page.locator('button:has-text("Model máy phát")')).toBeVisible();

    // Admin sees full station-row actions: Nhập NL, view-detail, edit/disable dropdown trigger
    await page.click('button:has-text("Danh sách trạm")');
    await expect(page.locator('button:has-text("Thêm trạm")')).toBeVisible();
    const firstRow = page.locator('table tbody tr').first();
    await expect(firstRow).toBeVisible({ timeout: 10000 });
    await expect(firstRow.locator('button:has-text("Nhập NL")')).toBeVisible();
    await expect(firstRow.getByLabel('Xem chi tiết')).toBeVisible();
    await expect(firstRow.locator('button')).toHaveCount(3);
  });
});
