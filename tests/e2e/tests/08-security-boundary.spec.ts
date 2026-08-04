import { test, expect } from '@playwright/test';
import { api, getAuthHeaders, createAnonymousContext, type Role } from './helpers/auth';

/**
 * Phase 1 — internal-only endpoints must be unreachable through the public gateway for EVERY
 * caller, including an authenticated admin. The gateway blocks these before the proxy, so even
 * an unauthenticated request gets 403 rather than 401.
 */
test.describe('08 — Security boundary', () => {
  test('SEC-01 POST /fuel/current/init bị chặn ở gateway với mọi role', async ({ request }) => {
    const payload = { stationId: 'x', stationCode: 'x', consumptionRate: 1, maxCapacity: 100, initialFuel: 0 };

    // Unauthenticated
    const anon = await createAnonymousContext();
    try {
      const res = await anon.post(api('/fuel/current/init'), { data: payload });
      expect(res.status(), 'no-auth must be blocked at the gateway').toBe(403);
    } finally {
      await anon.dispose();
    }

    // Every authenticated role — including admin, who has the role the service itself requires
    for (const role of ['staff', 'manager', 'admin'] as Role[]) {
      const headers = await getAuthHeaders(role);
      const res = await request.post(api('/fuel/current/init'), { headers, data: payload });
      expect(res.status(), `${role} must not reach the internal init endpoint via the gateway`).toBe(403);
      expect(res.status(), `${role} must never get a 200 from the internal init endpoint`).not.toBe(200);
    }
  });

  test('SEC-02 POST /fuel/import-commit bị chặn ở gateway với mọi role', async ({ request }) => {
    const payload = { import_job_id: 'x', idempotency_key: 'x', fuel_state_versions: {}, records: [] };

    const anon = await createAnonymousContext();
    try {
      const res = await anon.post(api('/fuel/import-commit'), { data: payload });
      expect(res.status(), 'no-auth import-commit must be blocked at the gateway').toBe(403);
    } finally {
      await anon.dispose();
    }

    for (const role of ['staff', 'manager', 'admin'] as Role[]) {
      const headers = await getAuthHeaders(role);
      const res = await request.post(api('/fuel/import-commit'), { headers, data: payload });
      expect(res.status(), `${role} must not reach the internal import-commit endpoint via the gateway`).toBe(403);
      expect(res.status(), `${role} must never get a 200 from import-commit`).not.toBe(200);
    }
  });
});
