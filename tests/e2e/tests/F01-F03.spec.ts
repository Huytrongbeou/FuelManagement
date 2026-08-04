import { test, expect } from '@playwright/test';

test.describe('F01 - Frontend readiness', () => {
  test('F01.1 Load app without white screen', async ({ page }) => {
    test.info().annotations.push({ type: 'module', description: 'F01' });
    const res = await page.goto('/');
    expect(res?.status()).toBe(200);
    
    // Should see VNPT or login form
    await expect(page.locator('body')).not.toBeEmpty();
    const hasLogin = await page.locator('input[placeholder="Nhập tên đăng nhập"]').count();
    const hasDashboard = await page.locator('text=Dashboard').count();
    expect(hasLogin + hasDashboard).toBeGreaterThan(0);
  });

  test('F01.3 Console error check', async ({ page }) => {
    test.info().annotations.push({ type: 'module', description: 'F01' });
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Ignore harmless Vite/React warnings if any, but fail on severe ones
    const severeErrors = errors.filter(e => !e.includes('favicon') && !e.includes('404'));
    if (severeErrors.length > 0) {
      test.info().annotations.push({ type: 'severity', description: 'HIGH' });
    }
    expect(severeErrors).toHaveLength(0);
  });
});

test.describe('F02 - Authentication UI', () => {
  test('F02.1 Login Admin thành công', async ({ page }) => {
    test.info().annotations.push({ type: 'module', description: 'F02' });
    test.info().annotations.push({ type: 'role', description: 'Admin' });
    await page.goto('/');
    await page.fill('input[placeholder="Nhập tên đăng nhập"]', process.env.ADMIN_USERNAME || 'admin');
    await page.fill('input[placeholder="Nhập mật khẩu"]', process.env.ADMIN_PASSWORD || 'admin123');
    await page.click('button:has-text("Đăng nhập")');
    
    // Wait for Dashboard to appear
    await expect(page.locator('text=Dashboard')).toBeVisible();
    await expect(page.locator('text=Quản trị viên')).toBeVisible();
  });

  test('F02.4 Sai password', async ({ page }) => {
    test.info().annotations.push({ type: 'module', description: 'F02' });
    await page.goto('/');
    await page.fill('input[placeholder="Nhập tên đăng nhập"]', 'admin');
    await page.fill('input[placeholder="Nhập mật khẩu"]', 'wrongpass123');
    await page.click('button:has-text("Đăng nhập")');

    await page.waitForTimeout(2000);
    await expect(page.locator('#login-username')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=Tổng số trạm')).not.toBeVisible();
    test.info().annotations.push({
      type: 'warn',
      description: 'MEDIUM: Wrong password causes silent page reload — no user-facing error message shown',
    });
  });

  test('F02.5 Logout', async ({ page }) => {
    test.info().annotations.push({ type: 'module', description: 'F02' });
    await page.goto('/');
    await page.fill('input[placeholder="Nhập tên đăng nhập"]', process.env.ADMIN_USERNAME || 'admin');
    await page.fill('input[placeholder="Nhập mật khẩu"]', process.env.ADMIN_PASSWORD || 'admin123');
    await page.click('button:has-text("Đăng nhập")');

    await expect(page.locator('text=Dashboard')).toBeVisible();

    const logoutBtn = page.locator('[title="Đăng xuất"]');
    if (!(await logoutBtn.isVisible())) {
      const expandBtn = page.locator('button[title*="Mở"], .lucide-panel-left').first();
      if (await expandBtn.isVisible()) await expandBtn.click();
    }
    await expect(logoutBtn).toBeVisible({ timeout: 3000 });
    await logoutBtn.click();

    await expect(page.locator('#login-username')).toBeVisible({ timeout: 5000 });

    // SPA has no router — verify reload doesn't restore the authenticated session
    await page.reload();
    await expect(page.locator('#login-username')).toBeVisible();
  });
});

test.describe('F03 - Route guard', () => {
  test('Test không login truy cập trực tiếp', async ({ page }) => {
    test.info().annotations.push({ type: 'module', description: 'F03' });
    // Since this is an SPA without actual URL routes handled by the server (besides serving index.html),
    // and no react-router is used, we test by visiting `/` when not logged in.
    // The application logic shows the Login page by default if not logged in.
    await page.goto('/');
    await expect(page.locator('input[placeholder="Nhập tên đăng nhập"]')).toBeVisible();
    await expect(page.locator('text=Dashboard')).not.toBeVisible();
  });
});
