import { test, expect } from '@playwright/test';
import { getAuthHeaders, api, RUN_ID } from './helpers/auth';
import { createDisposableStation, getStationByCodeApi } from './helpers/stations';

/**
 * Phase 1 — RBAC enforced by the BACKEND, not just hidden in the UI.
 * A Staff account driving the API directly must be refused on every write/privileged endpoint.
 */
test.describe('01 — AUTH / RBAC real usage', () => {
  test('RBAC-02 Staff không vượt quyền qua API (backend enforce, không chỉ ẩn UI)', async ({ request }) => {
    const adminHeaders = await getAuthHeaders('admin');
    const staffHeaders = await getAuthHeaders('staff');

    // A real station id so the deactivate attempt is not rejected merely for a bad id.
    const station = await createDisposableStation(request, adminHeaders, { prefix: 'RBAC', initialFuel: 50 });

    const attempts: { name: string; run: () => Promise<{ status: () => number }> }[] = [
      {
        name: 'POST /manual-entry/preview',
        run: () => request.post(api('/manual-entry/preview'), {
          headers: staffHeaders,
          data: { rows: [{ stationCode: station.stationCode, fuelAdded: 5, hoursRun: 1 }] },
        }),
      },
      {
        name: 'POST /import/upload',
        run: () => request.post(api('/import/upload'), {
          headers: staffHeaders,
          multipart: { file: { name: 'x.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: Buffer.from('x') } },
        }),
      },
      { name: 'GET /import/jobs', run: () => request.get(api('/import/jobs'), { headers: staffHeaders }) },
      {
        name: 'POST /stations',
        run: () => request.post(api('/stations'), {
          headers: staffHeaders,
          data: { stationCode: `TST_RBAC_DENY_${RUN_ID}`, stationName: 'should never exist', consumptionRate: 1, maxCapacity: 100, initialFuel: 0 },
        }),
      },
      {
        name: 'PATCH /stations/:id/deactivate',
        run: () => request.patch(api(`/stations/${station.id}/deactivate`), { headers: staffHeaders, data: { reason: 'rbac probe' } }),
      },
      {
        name: 'POST /brands',
        run: () => request.post(api('/brands'), { headers: staffHeaders, data: { name: `RBAC_BRAND_${RUN_ID}`, country: 'VN' } }),
      },
      {
        name: 'PATCH /fuel/adjustment-requests/:id/approve',
        run: () => request.patch(api('/fuel/adjustment-requests/00000000-0000-0000-0000-000000000000/approve'), { headers: staffHeaders }),
      },
    ];

    for (const attempt of attempts) {
      const res = await attempt.run();
      expect(res.status(), `Staff ${attempt.name} must be refused with 403`).toBe(403);
    }

    // Side-effect proof: the refusals actually refused — station untouched, nothing created.
    const after = await getStationByCodeApi(request, adminHeaders, station.stationCode);
    expect(after?.active, 'station must still be active after staff deactivate attempt').toBe(true);
    const denied = await getStationByCodeApi(request, adminHeaders, `TST_RBAC_DENY_${RUN_ID}`);
    expect(denied, 'staff must not have created a station').toBeUndefined();
  });

  test('RBAC-03 Manager không quản trị station / master data (backend 403 + no side effect)', async ({ request }) => {
    const adminHeaders = await getAuthHeaders('admin');
    const managerHeaders = await getAuthHeaders('manager');

    const station = await createDisposableStation(request, adminHeaders, { prefix: 'RBAC3', initialFuel: 50 });

    const attempts: { name: string; run: () => Promise<{ status: () => number }> }[] = [
      {
        name: 'POST /stations',
        run: () => request.post(api('/stations'), {
          headers: managerHeaders,
          data: { stationCode: `TST_MGR_DENY_${RUN_ID}`, stationName: 'manager should not create', consumptionRate: 1, maxCapacity: 100, initialFuel: 0 },
        }),
      },
      {
        name: 'PATCH /stations/:id/deactivate',
        run: () => request.patch(api(`/stations/${station.id}/deactivate`), { headers: managerHeaders, data: { reason: 'rbac probe' } }),
      },
      { name: 'POST /brands', run: () => request.post(api('/brands'), { headers: managerHeaders, data: { name: `MGR_BRAND_${RUN_ID}`, country: 'VN' } }) },
      { name: 'POST /models', run: () => request.post(api('/models'), { headers: managerHeaders, data: { brandId: '00000000-0000-0000-0000-000000000000', modelName: `MGR_MODEL_${RUN_ID}` } }) },
      { name: 'PATCH approve', run: () => request.patch(api('/fuel/adjustment-requests/00000000-0000-0000-0000-000000000000/approve'), { headers: managerHeaders }) },
      { name: 'PATCH reject', run: () => request.patch(api('/fuel/adjustment-requests/00000000-0000-0000-0000-000000000000/reject'), { headers: managerHeaders, data: { rejectionReason: 'x' } }) },
    ];

    for (const attempt of attempts) {
      const res = await attempt.run();
      expect(res.status(), `Manager ${attempt.name} must be refused with 403`).toBe(403);
    }

    const after = await getStationByCodeApi(request, adminHeaders, station.stationCode);
    expect(after?.active, 'station must remain active after manager deactivate attempt').toBe(true);
    expect(await getStationByCodeApi(request, adminHeaders, `TST_MGR_DENY_${RUN_ID}`), 'manager must not have created a station').toBeUndefined();
  });
});
