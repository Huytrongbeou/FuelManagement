import { request as pwRequest, expect, type APIRequestContext, type Page } from '@playwright/test';

export type Role = 'admin' | 'manager' | 'staff';

/** Unique per test run — every disposable entity is namespaced with it so runs never collide. */
export const RUN_ID = process.env.RUN_ID || String(Date.now());

/** Absolute gateway URL. All API calls go through the gateway, never direct at a service port. */
export function api(path: string): string {
  const base = (process.env.GATEWAY_URL || 'http://localhost:3000/api/').replace(/\/$/, '');
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

const CREDS: Record<Role, [string, string]> = {
  admin: [process.env.ADMIN_USERNAME || 'admin', process.env.ADMIN_PASSWORD || 'admin123'],
  manager: [process.env.MANAGER_USERNAME || 'manager', process.env.MANAGER_PASSWORD || 'manager123'],
  staff: [process.env.STAFF_USERNAME || 'staff', process.env.STAFF_PASSWORD || 'staff123'],
};

/** Text the app renders for each role — used to confirm a UI login actually landed. */
export const ROLE_LABEL: Record<Role, string> = {
  admin: 'Quản trị viên',
  manager: 'Quản lý',
  staff: 'Nhân viên',
};

/**
 * Logs in over the API and returns the raw JWT.
 * Uses a throwaway context: the gateway prefers its cookie over the Authorization header, so
 * logging in as two roles on one shared context makes the later login silently win.
 */
export async function loginViaApi(role: Role): Promise<string> {
  const [username, password] = CREDS[role];
  const ctx = await pwRequest.newContext();
  try {
    const res = await ctx.post(api('/auth/login'), { data: { username, password } });
    if (!res.ok()) throw new Error(`login failed for ${role}: ${res.status()} ${await res.text()}`);
    const data = await res.json();
    const token = data.token || data.accessToken;
    if (!token) throw new Error(`login for ${role} returned no token`);
    return token;
  } finally {
    await ctx.dispose();
  }
}

export async function getAuthHeaders(role: Role): Promise<Record<string, string>> {
  return { Authorization: `Bearer ${await loginViaApi(role)}` };
}

/** A dedicated APIRequestContext already carrying this role's bearer token. */
export async function createRequestContextForRole(role: Role): Promise<APIRequestContext> {
  const token = await loginViaApi(role);
  return pwRequest.newContext({ extraHTTPHeaders: { Authorization: `Bearer ${token}` } });
}

/** An unauthenticated context — for the no-auth boundary tests. */
export async function createAnonymousContext(): Promise<APIRequestContext> {
  return pwRequest.newContext();
}

/**
 * Drives the real login form like a user. Confirms success by the login screen disappearing —
 * viewport-agnostic (the role badge is hidden inside the collapsed sidebar on mobile), and still
 * checks the role badge is present in the DOM so we know the right account logged in.
 */
export async function loginViaUi(page: Page, role: Role): Promise<void> {
  const [username, password] = CREDS[role];
  await page.goto('/');
  await page.fill('input[placeholder="Nhập tên đăng nhập"]', username);
  await page.fill('input[placeholder="Nhập mật khẩu"]', password);
  await page.click('button:has-text("Đăng nhập")');
  await expect(page.locator('#login-username'), `UI login as ${role} should leave the login screen`).toBeHidden({ timeout: 15000 });
  await expect(page.getByText(ROLE_LABEL[role], { exact: true }).first(), `logged-in role should be ${role}`).toHaveCount(1);
}

export async function logoutViaUi(page: Page): Promise<void> {
  await page.locator('[title="Đăng xuất"]').click();
  await expect(page.locator('#login-username')).toBeVisible({ timeout: 10000 });
}

/**
 * The app is a state-driven SPA (no router/URLs) — navigation only happens by clicking the
 * sidebar. Centralised here so specs never hard-code button text.
 */
// Labels verified against apps/web/src/shared/components/layout/Sidebar.tsx — do not guess.
export const NAV = {
  dashboard: 'Dashboard',
  stations: 'Danh sách trạm',
  map: 'Bản đồ trạm',
  directEntry: 'Nhập dữ liệu trực tiếp',
  import: 'Import Excel',
  history: 'Lịch sử import',
  brands: 'Hãng máy phát',
  models: 'Model máy phát',
  stationRequests: 'Duyệt đề xuất trạm',
  users: 'Quản lý người dùng',
  settings: 'Tài khoản / Cài đặt',
} as const;

export async function navigateTo(page: Page, key: keyof typeof NAV): Promise<void> {
  await page.getByRole('button', { name: NAV[key] }).first().click();
}

/**
 * Mobile navigation: the desktop sidebar is display:none on small viewports (so its buttons are
 * out of the a11y tree), and the nav lives behind the topbar hamburger drawer. Opens the drawer
 * then clicks the nav item.
 */
export async function navigateMobile(page: Page, key: keyof typeof NAV): Promise<void> {
  await page.locator('button:has(.lucide-menu)').first().click();
  await page.getByRole('button', { name: NAV[key] }).first().click();
}
