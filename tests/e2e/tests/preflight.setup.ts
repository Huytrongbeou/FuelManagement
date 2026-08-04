import { test as setup } from '@playwright/test';
import * as dotenv from 'dotenv';
dotenv.config();

function api(path: string): string {
  const base = (process.env.GATEWAY_URL || 'http://localhost:3000/api/').replace(/\/$/, '');
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

setup('preflight validation', async ({ request, page }) => {
  const frontendUrl = process.env.FRONTEND_URL;

  console.log(`Checking FRONTEND_URL: ${frontendUrl}`);
  try {
    const res = await page.goto(frontendUrl || 'http://localhost:5173');
    if (!res?.ok()) {
      throw new Error(`Frontend HTTP status ${res?.status()}`);
    }
  } catch (err) {
    console.error('FRONTEND_URL is not reachable or returned an error.');
    throw new Error('CONFIG_ERROR: FRONTEND_URL not reachable');
  }

  console.log(`Checking GATEWAY_URL: ${api('/auth/login')}`);
  try {
    const res = await request.post(api('/auth/login'), {
      data: { username: 'wrong_user_preflight', password: 'wrong_pass' },
      headers: { 'Content-Type': 'application/json' },
    });

    const ct = res.headers()['content-type'] || '';
    if (!ct.includes('application/json')) {
      throw new Error(`CONFIG_ERROR: Gateway trả "${ct}" thay vì JSON — URL sai hoặc nginx trả HTML`);
    }

    const status = res.status();
    if (status === 200 || status === 201) {
      throw new Error('CONFIG_ERROR: Gateway chấp nhận credentials sai — cực kỳ nghiêm trọng');
    }
    if (status === 404 || status === 405) {
      throw new Error(`CONFIG_ERROR: ${status} — route /api/auth/login không tồn tại, check gateway config`);
    }
    if (status === 500) {
      throw new Error('BACKEND_NOT_READY: Gateway 500 — backend chưa sẵn sàng');
    }
    if (status !== 400 && status !== 401) {
      throw new Error(`CONFIG_ERROR: Unexpected status ${status}`);
    }

    console.log(`✓ Preflight: gateway ${status} JSON — OK`);
  } catch (err: any) {
    console.error('Gateway validation failed:', err.message);
    throw err;
  }
});
