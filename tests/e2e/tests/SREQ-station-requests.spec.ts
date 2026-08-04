import { test, expect, type APIRequestContext } from '@playwright/test';
import { execFileSync } from 'child_process';
import { api, createRequestContextForRole, loginViaUi, navigateTo, RUN_ID } from './helpers/auth';

/**
 * Station proposals: staff submit, manager/admin approve.
 *
 * The point of interest is SREQ-03 — a manager and an admin approving the same proposal at the
 * same instant must not produce two stations. Everything is asserted against the database, since
 * "one station exists" is the only claim that actually matters here.
 */

interface StationRequest {
  id: string;
  stationCode: string;
  stationName: string;
  status: 'pending' | 'approving' | 'approved' | 'rejected';
  createdStationId: string | null;
  reviewedBy: string | null;
  rejectionReason: string | null;
}

/** Removes a UI-created proposal, whose auto CL-NNN code the global teardown can't identify. */
function deleteRequestByCode(stationCode: string) {
  const user = process.env.POSTGRES_USER || 'fuelapp';
  execFileSync('docker', ['exec', 'fuel_postgres', 'psql', '-U', user, '-d', 'station_db', '-c',
    `DELETE FROM station_requests WHERE station_code='${stationCode.replace(/'/g, "''")}';`]);
}

const codes: string[] = [];

function newCode(tag: string) {
  const code = `SREQ${tag}${RUN_ID}`.toUpperCase().slice(0, 40);
  codes.push(code);
  return code;
}

/** Counts real station rows straight from Postgres — the authority on "did we duplicate?". */
function countStationsInDb(stationCode: string): number {
  const user = process.env.POSTGRES_USER || 'fuelapp';
  const out = execFileSync(
    'docker',
    ['exec', 'fuel_postgres', 'psql', '-U', user, '-d', 'station_db', '-t', '-A', '-c',
      `SELECT count(*) FROM stations WHERE station_code = '${stationCode}';`],
    { encoding: 'utf8' }
  ).trim();
  return Number(out);
}

// Deliberately no coordinates: these tests exercise code-based dedup and the approval race, not
// the proximity guard. Omitting lat/lng keeps the ~200m proximity check out of the picture (that
// behaviour has its own coverage in PROX-*), so a proposal near the seeded Cao Lãnh cluster isn't
// flagged here.
async function submitRequest(ctx: APIRequestContext, stationCode: string, extra: Record<string, unknown> = {}) {
  const res = await ctx.post(api('/station-requests'), {
    data: {
      stationCode,
      stationName: `Tram de xuat ${stationCode}`,
      consumptionRate: 5,
      maxCapacity: 200,
      initialFuel: 50,
      ...extra,
    },
  });
  return res;
}

async function getRequest(ctx: APIRequestContext, id: string): Promise<StationRequest> {
  const res = await ctx.get(api(`/station-requests/${id}`));
  expect(res.status()).toBe(200);
  return res.json();
}

test.describe('SREQ - Station proposal and approval', () => {
  test.use({ storageState: undefined });

  let admin: APIRequestContext;
  let manager: APIRequestContext;
  let staff: APIRequestContext;

  test.beforeAll(async () => {
    admin = await createRequestContextForRole('admin');
    manager = await createRequestContextForRole('manager');
    staff = await createRequestContextForRole('staff');
  });

  test.afterAll(async () => {
    // Remove anything these tests created, in FK-safe order.
    const user = process.env.POSTGRES_USER || 'fuelapp';
    const like = `station_code LIKE 'SREQ%'`;
    try {
      execFileSync('docker', ['exec', '-i', 'fuel_postgres', 'psql', '-U', user, '-d', 'fuel_db'], {
        input: `DELETE FROM current_fuel_state WHERE ${like}; DELETE FROM fuel_records WHERE ${like};`,
        encoding: 'utf8',
      });
      execFileSync('docker', ['exec', '-i', 'fuel_postgres', 'psql', '-U', user, '-d', 'station_db'], {
        input: `DELETE FROM station_requests WHERE ${like}; DELETE FROM stations WHERE ${like};`,
        encoding: 'utf8',
      });
    } catch { /* cleanup must never fail the run */ }
    await Promise.all([admin.dispose(), manager.dispose(), staff.dispose()]);
  });

  test('SREQ-01 Staff submits a proposal through the UI; no station exists yet', async ({ page }) => {
    test.info().annotations.push({ type: 'module', description: 'SREQ' });
    // The code is auto-assigned, so identify the proposal by its unique name.
    const stationName = `Tram de xuat UI ${RUN_ID}`;

    await loginViaUi(page, 'staff');
    await navigateTo(page, 'stations');
    await page.getByRole('button', { name: 'Thêm trạm' }).click();

    await expect(page.getByText('Đề xuất trạm mới')).toBeVisible();
    await page.fill('#station-name', stationName);
    await page.fill('#consumption-rate', '5');
    await page.fill('#max-capacity', '200');
    await page.getByRole('button', { name: 'Gửi đề xuất' }).click();

    let created: StationRequest | undefined;
    await expect
      .poll(async () => {
        const list = await (await staff.get(api('/station-requests?status=pending'))).json() as StationRequest[];
        created = list.find(r => r.stationName === stationName);
        return !!created;
      }, { timeout: 10000 })
      .toBe(true);

    expect(created!.stationCode, 'proposal gets an auto CL-NNN code').toMatch(/^CL-\d+$/);
    try {
      // Crucially: proposing must not create a station.
      expect(countStationsInDb(created!.stationCode), 'a proposal alone must not create a station').toBe(0);
    } finally {
      deleteRequestByCode(created!.stationCode);
    }
  });

  test('SREQ-02 Staff cannot approve; manager can, and approval creates exactly one station', async () => {
    test.info().annotations.push({ type: 'module', description: 'SREQ' });
    const code = newCode('APR');

    const created = await submitRequest(staff, code);
    expect(created.status()).toBe(201);
    const request: StationRequest = await created.json();

    const staffAttempt = await staff.post(api(`/station-requests/${request.id}/approve`));
    expect(staffAttempt.status(), 'staff must not be able to approve').toBe(403);
    expect(countStationsInDb(code), 'a refused approval must have no side effect').toBe(0);

    const approve = await manager.post(api(`/station-requests/${request.id}/approve`));
    expect(approve.status()).toBe(200);

    expect(countStationsInDb(code)).toBe(1);
    const after = await getRequest(admin, request.id);
    expect(after.status).toBe('approved');
    expect(after.createdStationId).not.toBeNull();
  });

  test('SREQ-03 Manager and admin approving simultaneously produce exactly one station', async () => {
    test.info().annotations.push({ type: 'module', description: 'SREQ' });

    // Repeated deliberately: a race that passes once may simply have missed the window. Ten
    // rounds against a fresh proposal each time is what makes a green here mean something.
    const ROUNDS = 10;

    for (let round = 1; round <= ROUNDS; round++) {
      const code = newCode(`RACE${round}`);
      const created = await submitRequest(staff, code);
      expect(created.status()).toBe(201);
      const request: StationRequest = await created.json();

      // Fired together on purpose — this is the double-approval the guard exists for.
      const [a, b] = await Promise.all([
        admin.post(api(`/station-requests/${request.id}/approve`)),
        manager.post(api(`/station-requests/${request.id}/approve`)),
      ]);

      const statuses = [a.status(), b.status()].sort();
      expect(statuses, `round ${round}: exactly one approval should win, the other refused with 409`)
        .toEqual([200, 409]);

      // The claim that actually matters.
      expect(countStationsInDb(code), `round ${round}: a double approval must never create two stations`)
        .toBe(1);

      const after = await getRequest(admin, request.id);
      expect(after.status, `round ${round}: request must end approved, never stuck in 'approving'`)
        .toBe('approved');
      expect(after.createdStationId).not.toBeNull();
    }
  });

  test('SREQ-04 Approving an already-approved request is idempotent, not a second station', async () => {
    test.info().annotations.push({ type: 'module', description: 'SREQ' });
    const code = newCode('IDEM');

    const created = await submitRequest(staff, code);
    const request: StationRequest = await created.json();

    const first = await admin.post(api(`/station-requests/${request.id}/approve`));
    expect(first.status()).toBe(200);
    const firstStationId = (await first.json()).station.id;

    const second = await admin.post(api(`/station-requests/${request.id}/approve`));
    expect(second.status(), 'a repeated approval should return the existing station, not fail').toBe(200);
    expect((await second.json()).station.id, 'must be the same station').toBe(firstStationId);

    expect(countStationsInDb(code)).toBe(1);
  });

  test('SREQ-05 Duplicate codes are refused, both against real stations and open proposals', async () => {
    test.info().annotations.push({ type: 'module', description: 'SREQ' });
    const code = newCode('DUP');

    expect((await submitRequest(staff, code)).status()).toBe(201);

    const second = await submitRequest(staff, code);
    expect(second.status(), 'a second open proposal for the same code must be refused').toBe(409);

    // Approve the first, then the code belongs to a real station.
    const pending = (await (await admin.get(api('/station-requests?status=pending'))).json() as StationRequest[])
      .find(r => r.stationCode === code)!;
    expect((await admin.post(api(`/station-requests/${pending.id}/approve`))).status()).toBe(200);

    const afterApproval = await submitRequest(staff, code);
    expect(afterApproval.status(), 'proposing a code that is now a real station must be refused').toBe(409);

    expect(countStationsInDb(code)).toBe(1);
  });

  test('SREQ-06 Rejecting closes the request, creates nothing, and frees the code', async () => {
    test.info().annotations.push({ type: 'module', description: 'SREQ' });
    const code = newCode('REJ');

    const created = await submitRequest(staff, code);
    const request: StationRequest = await created.json();

    const noReason = await manager.post(api(`/station-requests/${request.id}/reject`), { data: { reason: '  ' } });
    expect(noReason.status(), 'a rejection must carry a reason').toBe(400);

    const rejected = await manager.post(api(`/station-requests/${request.id}/reject`), {
      data: { reason: 'Trùng với trạm đã có' },
    });
    expect(rejected.status()).toBe(200);

    const after = await getRequest(admin, request.id);
    expect(after.status).toBe('rejected');
    expect(after.rejectionReason).toContain('Trùng');
    expect(countStationsInDb(code), 'rejecting must not create a station').toBe(0);

    // Approving a rejected request must not resurrect it.
    const lateApprove = await admin.post(api(`/station-requests/${request.id}/approve`));
    expect(lateApprove.status(), 'a rejected request must not be approvable').toBe(409);
    expect(countStationsInDb(code)).toBe(0);

    // The code is free again, since the partial unique index only covers open requests.
    expect((await submitRequest(staff, code)).status()).toBe(201);
  });
});
