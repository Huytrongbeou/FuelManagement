import { test, expect, request as pwRequest, type APIRequestContext } from '@playwright/test';
import { api, createRequestContextForRole, loginViaUi, navigateTo, RUN_ID } from './helpers/auth';

/**
 * User administration: add / change role / reset password / deactivate, admin-only.
 *
 * Every write is verified against the backend, and each test cleans up the account it created so
 * repeated runs don't accumulate logins. Accounts are namespaced with RUN_ID.
 */

interface ManagedUser {
  id: string;
  username: string;
  role: 'admin' | 'manager' | 'staff';
  isActive: boolean;
}

const created: string[] = [];

function newUsername(tag: string) {
  const name = `utest_${tag}_${RUN_ID}`.toLowerCase();
  created.push(name);
  return name;
}

async function listUsers(ctx: APIRequestContext): Promise<ManagedUser[]> {
  const res = await ctx.get(api('/users'));
  expect(res.status(), 'admin should be able to list users').toBe(200);
  return res.json();
}

async function findUser(ctx: APIRequestContext, username: string): Promise<ManagedUser | undefined> {
  return (await listUsers(ctx)).find(u => u.username === username);
}

/**
 * Logs in on a throwaway context. Must never reuse the admin context: a successful login sets the
 * gateway's HttpOnly `fuel_token` cookie, and the gateway reads that cookie in preference to the
 * Authorization header — so checking another account's login on the admin context would silently
 * downgrade every later admin call to that account's role.
 */
async function loginStatus(username: string, password: string): Promise<number> {
  const ctx = await pwRequest.newContext();
  try {
    return (await ctx.post(api('/auth/login'), { data: { username, password } })).status();
  } finally {
    await ctx.dispose();
  }
}

test.describe('USER - Admin user management', () => {
  test.use({ storageState: undefined });

  let admin: APIRequestContext;

  test.beforeAll(async () => {
    admin = await createRequestContextForRole('admin');
  });

  test.afterAll(async () => {
    // Hard-delete is not exposed by the API (deactivate is the product behaviour), so leftover
    // test accounts are deactivated to keep them unusable.
    for (const username of created) {
      const u = await findUser(admin, username);
      if (u?.isActive) await admin.delete(api(`/users/${u.id}`));
    }
    await admin.dispose();
  });

  test('USER-01 Admin creates an account through the UI and it can actually log in', async ({ page }) => {
    test.info().annotations.push({ type: 'module', description: 'USER' });
    const username = newUsername('create');
    const password = 'MatKhauManh@2026';

    await loginViaUi(page, 'admin');
    await navigateTo(page, 'users');

    await page.getByRole('button', { name: 'Thêm người dùng' }).click();
    await page.fill('#new-username', username);
    await page.fill('#new-password', password);
    await page.selectOption('#new-role', 'manager');
    await page.getByRole('button', { name: 'Tạo tài khoản' }).click();

    await expect(page.getByTestId(`user-row-${username}`)).toBeVisible({ timeout: 10000 });

    // Backend truth, not just the row appearing.
    const backendUser = await findUser(admin, username);
    expect(backendUser, 'user must exist in the backend').toBeDefined();
    expect(backendUser!.role).toBe('manager');
    expect(backendUser!.isActive).toBe(true);

    // The account is genuinely usable — the password was stored and hashed correctly.
    expect(await loginStatus(username, password), 'the new account should be able to log in').toBe(200);
  });

  test('USER-02 Changing role in the UI updates the backend', async ({ page }) => {
    test.info().annotations.push({ type: 'module', description: 'USER' });
    const username = newUsername('role');

    const create = await admin.post(api('/users'), {
      data: { username, password: 'MatKhauManh@2026', role: 'staff' },
    });
    expect(create.status()).toBe(201);

    await loginViaUi(page, 'admin');
    await navigateTo(page, 'users');
    await page.getByTestId(`user-role-${username}`).selectOption('manager');

    await expect
      .poll(async () => (await findUser(admin, username))?.role, { timeout: 10000 })
      .toBe('manager');
  });

  test('USER-03 Deactivating blocks login; reactivating restores it', async ({ page }) => {
    test.info().annotations.push({ type: 'module', description: 'USER' });
    const username = newUsername('deact');
    const password = 'MatKhauManh@2026';

    await admin.post(api('/users'), { data: { username, password, role: 'staff' } });
    expect(await loginStatus(username, password)).toBe(200);

    await loginViaUi(page, 'admin');
    await navigateTo(page, 'users');
    await page.getByTestId(`user-toggle-${username}`).click();
    await page.getByRole('button', { name: 'Vô hiệu hóa', exact: true }).last().click();

    await expect
      .poll(async () => (await findUser(admin, username))?.isActive, { timeout: 10000 })
      .toBe(false);

    expect(await loginStatus(username, password),
      'a deactivated account must not be able to log in').toBe(401);

    // Reactivate and confirm it is a reversible action, not a destructive one.
    const u = await findUser(admin, username);
    expect((await admin.patch(api(`/users/${u!.id}`), { data: { isActive: true } })).status()).toBe(200);
    expect(await loginStatus(username, password)).toBe(200);
  });

  test('USER-04 Password reset replaces the old password', async () => {
    test.info().annotations.push({ type: 'module', description: 'USER' });
    const username = newUsername('pwd');
    const oldPassword = 'MatKhauCu@2026';
    const newPassword = 'MatKhauMoi@2026';

    await admin.post(api('/users'), { data: { username, password: oldPassword, role: 'staff' } });
    const u = await findUser(admin, username);

    expect((await admin.patch(api(`/users/${u!.id}`), { data: { password: newPassword } })).status()).toBe(200);

    expect(await loginStatus(username, newPassword)).toBe(200);
    expect(await loginStatus(username, oldPassword),
      'the old password must stop working').toBe(401);
  });

  test('USER-05 Non-admins cannot reach user administration at all', async () => {
    test.info().annotations.push({ type: 'module', description: 'USER' });

    for (const role of ['manager', 'staff'] as const) {
      const ctx = await createRequestContextForRole(role);
      try {
        expect((await ctx.get(api('/users'))).status(), `${role} must not list users`).toBe(403);
        const create = await ctx.post(api('/users'), {
          data: { username: `utest_forbidden_${RUN_ID}`, password: 'MatKhauManh@2026', role: 'admin' },
        });
        expect(create.status(), `${role} must not create users`).toBe(403);
      } finally {
        await ctx.dispose();
      }
    }

    // No side effect: the blocked account was never created.
    expect(await findUser(admin, `utest_forbidden_${RUN_ID}`)).toBeUndefined();
  });

  test('USER-06 Validation and self-lockout guards are enforced by the backend', async () => {
    test.info().annotations.push({ type: 'module', description: 'USER' });
    const username = newUsername('valid');

    await admin.post(api('/users'), { data: { username, password: 'MatKhauManh@2026', role: 'staff' } });

    const duplicate = await admin.post(api('/users'), {
      data: { username, password: 'MatKhauManh@2026', role: 'staff' },
    });
    expect(duplicate.status(), 'duplicate username must be rejected').toBe(409);

    const weak = await admin.post(api('/users'), {
      data: { username: `${username}_weak`, password: 'abc', role: 'staff' },
    });
    expect(weak.status(), 'short password must be rejected').toBe(400);

    const badRole = await admin.post(api('/users'), {
      data: { username: `${username}_role`, password: 'MatKhauManh@2026', role: 'superuser' },
    });
    expect(badRole.status(), 'unknown role must be rejected').toBe(400);

    // A malformed id must not surface a database driver error to the caller.
    const malformed = await admin.patch(api('/users/not-a-uuid'), { data: { role: 'staff' } });
    expect(malformed.status()).toBe(404);
    expect(await malformed.text(), 'must not leak internal paths or driver detail')
      .not.toMatch(/prisma|\/app\/src/i);

    // An admin must not be able to strip their own access and lock everyone out.
    const meRes = await admin.get(api('/auth/me'));
    const me = await meRes.json();
    expect((await admin.patch(api(`/users/${me.id}`), { data: { role: 'staff' } })).status(),
      'self role change must be refused').toBe(422);
    expect((await admin.delete(api(`/users/${me.id}`))).status(),
      'self deactivation must be refused').toBe(422);

    // And the refusal was real — the acting admin is untouched.
    const stillAdmin = await findUser(admin, me.username);
    expect(stillAdmin!.role).toBe('admin');
    expect(stillAdmin!.isActive).toBe(true);
  });
});
