import { test, expect } from '@playwright/test';

test.describe('F15 - Error handling frontend', () => {
  test('F15.4 Network offline', async ({ page, context }) => {
    test.info().annotations.push({ type: 'module', description: 'F15' });

    await page.goto('/');
    await context.setOffline(true);

    await page.fill('input[placeholder="Nhập tên đăng nhập"]', process.env.ADMIN_USERNAME || 'admin');
    await page.fill('input[placeholder="Nhập mật khẩu"]', process.env.ADMIN_PASSWORD || 'admin123');

    try {
      await page.click('button:has-text("Đăng nhập")');
    } catch (_) {
      // Network error is expected
    }

    // Page must not white-screen; login form should still be visible
    await expect(page.locator('input[placeholder="Nhập tên đăng nhập"]')).toBeVisible();
    await context.setOffline(false);
  });
});

test.describe('F16 - Security frontend', () => {
  test('F16.1 XSS-safe rendering', async ({ page }) => {
    test.info().annotations.push({ type: 'module', description: 'F16' });
    test.info().annotations.push({ type: 'severity', description: 'CRITICAL' });
    if (process.env.RUN_MODE === 'production' && process.env.ALLOW_WRITE_TESTS !== 'true') {
      test.skip(true, 'Skipped write test in production');
    }

    let alertCount = 0;
    let pageErrorCount = 0;
    page.on('dialog', d => { alertCount++; d.dismiss(); });
    page.on('pageerror', () => { pageErrorCount++; });

    await page.goto('/');
    await page.fill('input[placeholder="Nhập tên đăng nhập"]', process.env.ADMIN_USERNAME || 'admin');
    await page.fill('input[placeholder="Nhập mật khẩu"]', process.env.ADMIN_PASSWORD || 'admin123');
    await page.click('button:has-text("Đăng nhập")');

    const runId = process.env.RUN_ID || Date.now().toString();
    const xssString = `<img src=x onerror=alert('xss-${runId}')> <script>alert('xss-${runId}')</script>`;

    await page.click('button:has-text("Hãng máy phát")');
    await page.click('button:has-text("Thêm hãng")');
    await page.fill('input[placeholder="Ví dụ: Cummins"]', xssString);
    await page.click('button:has-text("Lưu")');

    await expect(page.locator('[data-sonner-toast]')).toBeHidden({ timeout: 5000 }).catch(() => {});
    await expect(page.locator('table').getByText(xssString, { exact: true })).toBeVisible({ timeout: 5000 });
    expect(alertCount).toBe(0);
    expect(pageErrorCount).toBe(0);
  });
});

test.describe('F17 - Accessibility', () => {
  test('F17.1 Login bằng keyboard', async ({ page }) => {
    test.info().annotations.push({ type: 'module', description: 'F17' });
    await page.goto('/');

    // Tab to username — verify by element ID (confirmed in Login.tsx: id="login-username")
    await page.keyboard.press('Tab');
    const focusedId = await page.evaluate(() => document.activeElement?.id);
    expect(focusedId).toBe('login-username');

    await page.keyboard.type(process.env.ADMIN_USERNAME || 'admin');

    // Tab to password — id="login-password"
    await page.keyboard.press('Tab');
    const focusedId2 = await page.evaluate(() => document.activeElement?.id);
    expect(focusedId2).toBe('login-password');

    await page.keyboard.type(process.env.ADMIN_PASSWORD || 'admin123');

    // Enter within the password field submits the form directly — tab order past
    // password includes the show/hide-password toggle before the submit button.
    await page.keyboard.press('Enter');

    await expect(page.locator('text=Dashboard')).toBeVisible({ timeout: 10000 });
  });
});

test.describe('F18 - Responsive smoke', () => {
  const viewports = [
    { width: 1366, height: 768 },
    { width: 1280, height: 800 },
    { width: 390,  height: 844 },
  ];

  for (const vp of viewports) {
    test(`F18 Viewport ${vp.width}x${vp.height}`, async ({ page }) => {
      test.info().annotations.push({ type: 'module', description: 'F18' });
      await page.setViewportSize(vp);

      await page.goto('/');
      await page.fill('input[placeholder="Nhập tên đăng nhập"]', process.env.MANAGER_USERNAME || 'manager');
      await page.fill('input[placeholder="Nhập mật khẩu"]', process.env.MANAGER_PASSWORD || 'manager123');
      await page.click('button:has-text("Đăng nhập")');

      await expect(page.locator('text=Tổng số trạm')).toBeVisible();

      if (vp.width <= 768) {
        const hasMobileMenu = await page.locator('button:has(.lucide-menu), button[title="Mở menu"]').isVisible();
        if (hasMobileMenu) {
          test.info().annotations.push({ type: 'severity', description: 'LOW' });
        }
      }
    });
  }
});
