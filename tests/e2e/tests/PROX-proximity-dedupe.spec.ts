import { test, expect, type APIRequestContext } from '@playwright/test';
import { execFileSync } from 'child_process';
import { api, createRequestContextForRole, loginViaUi, navigateTo, RUN_ID } from './helpers/auth';

/**
 * Proximity-duplicate guard: two stations within 200 m are treated as a likely duplicate and
 * require an explicit confirm to proceed. Verified at all three entry points — staff proposal,
 * direct admin create, and approval — plus the "no false positive when far apart" case.
 *
 * Each test works in its own empty patch of map (lat spaced 0.02° ≈ 2.2 km apart) so stations
 * created by one test never trip another. Coordinates 11.9x/106.9x are well away from the seeded
 * Cao Lãnh cluster.
 */

const codes: string[] = [];
function code(tag: string) {
  const c = `PROX${tag}${RUN_ID}`.toUpperCase().slice(0, 40);
  codes.push(c);
  return c;
}

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

interface Nearby { stationCode: string; distanceM: number }

test.describe('PROX - Proximity duplicate detection (~200m)', () => {
  test.use({ storageState: undefined });

  let admin: APIRequestContext;
  let staff: APIRequestContext;
  let manager: APIRequestContext;

  test.beforeAll(async () => {
    admin = await createRequestContextForRole('admin');
    staff = await createRequestContextForRole('staff');
    manager = await createRequestContextForRole('manager');
  });

  test.afterAll(async () => {
    const user = process.env.POSTGRES_USER || 'fuelapp';
    const like = `station_code LIKE 'PROX%'`;
    try {
      execFileSync('docker', ['exec', '-i', 'fuel_postgres', 'psql', '-U', user, '-d', 'fuel_db'], {
        input: `DELETE FROM current_fuel_state WHERE ${like}; DELETE FROM fuel_records WHERE ${like};`,
        encoding: 'utf8',
      });
      execFileSync('docker', ['exec', '-i', 'fuel_postgres', 'psql', '-U', user, '-d', 'station_db'], {
        input: `DELETE FROM station_requests WHERE ${like}; DELETE FROM stations WHERE ${like};`,
        encoding: 'utf8',
      });
    } catch { /* cleanup never fails the run */ }
    await Promise.all([admin.dispose(), staff.dispose(), manager.dispose()]);
  });

  async function createAnchor(ctx: APIRequestContext, stationCode: string, lat: number, lng: number) {
    const res = await ctx.post(api('/stations'), {
      data: { stationCode, stationName: `Anchor ${stationCode}`, consumptionRate: 5, maxCapacity: 200, initialFuel: 50, latitude: lat, longitude: lng, confirmNearby: true },
    });
    expect(res.status(), 'anchor create').toBe(201)
  }

  test('PROX-01 Proposal within 200m is blocked with the nearby list, and passes once confirmed', async () => {
    test.info().annotations.push({ type: 'module', description: 'PROX' });
    const lat = 11.90, lng = 106.90;
    const anchor = code('A1');
    await createAnchor(admin, anchor, lat, lng);

    // ~150 m north of the anchor.
    const near = { latitude: lat + 0.00135, longitude: lng };
    const blocked = await staff.post(api('/station-requests'), {
      data: { stationCode: code('B1'), stationName: 'Gan', consumptionRate: 5, maxCapacity: 200, ...near },
    });
    expect(blocked.status()).toBe(409);
    const body = await blocked.json();
    expect(body.code).toBe('NEARBY_DUPLICATE');
    const list = body.nearbyStations as Nearby[];
    expect(list.map(s => s.stationCode)).toContain(anchor);
    expect(list[0].distanceM).toBeGreaterThan(140);
    expect(list[0].distanceM).toBeLessThan(160);

    const confirmed = await staff.post(api('/station-requests'), {
      data: { stationCode: code('B1b'), stationName: 'Gan', consumptionRate: 5, maxCapacity: 200, ...near, confirmNearby: true },
    });
    expect(confirmed.status(), 'confirmNearby lets a genuine second station through').toBe(201);
  });

  test('PROX-02 A proposal comfortably farther than 200m is not flagged', async () => {
    test.info().annotations.push({ type: 'module', description: 'PROX' });
    const lat = 11.92, lng = 106.90;
    await createAnchor(admin, code('A2'), lat, lng);

    // ~560 m north — outside the radius.
    const res = await staff.post(api('/station-requests'), {
      data: { stationCode: code('B2'), stationName: 'Xa', consumptionRate: 5, maxCapacity: 200, latitude: lat + 0.005, longitude: lng },
    });
    expect(res.status(), 'a station well outside 200m must not be treated as a duplicate').toBe(201);
  });

  test('PROX-03 Direct admin create within 200m is blocked, then allowed with confirm', async () => {
    test.info().annotations.push({ type: 'module', description: 'PROX' });
    const lat = 11.94, lng = 106.90;
    await createAnchor(admin, code('A3'), lat, lng);

    const near = { latitude: lat + 0.0009, longitude: lng }; // ~100 m
    const dupCode = code('B3');
    const blocked = await admin.post(api('/stations'), {
      data: { stationCode: dupCode, stationName: 'Gan', consumptionRate: 5, maxCapacity: 200, ...near },
    });
    expect(blocked.status()).toBe(409);
    expect((await blocked.json()).code).toBe('NEARBY_DUPLICATE');
    expect(countStationsInDb(dupCode), 'the blocked create made no station').toBe(0);

    const ok = await admin.post(api('/stations'), {
      data: { stationCode: dupCode, stationName: 'Gan', consumptionRate: 5, maxCapacity: 200, ...near, confirmNearby: true },
    });
    expect(ok.status()).toBe(201);
    expect(countStationsInDb(dupCode)).toBe(1);
  });

  test('PROX-04 Approval re-checks proximity for a station added after the proposal', async () => {
    test.info().annotations.push({ type: 'module', description: 'PROX' });
    const lat = 11.96, lng = 106.90;

    // A proposal in an empty spot — no warning at submit time.
    const reqCode = code('R4');
    const proposal = await staff.post(api('/station-requests'), {
      data: { stationCode: reqCode, stationName: 'De xuat', consumptionRate: 5, maxCapacity: 200, latitude: lat, longitude: lng },
    });
    expect(proposal.status()).toBe(201);
    const reqId = (await proposal.json()).id;

    // A station appears ~120 m away before the reviewer acts.
    await createAnchor(admin, code('A4'), lat + 0.00108, lng);

    const blocked = await manager.post(api(`/station-requests/${reqId}/approve`));
    expect(blocked.status(), 'approval must re-check and block on the new nearby station').toBe(409);
    expect((await blocked.json()).code).toBe('NEARBY_DUPLICATE');
    expect(countStationsInDb(reqCode), 'the blocked approval created no station').toBe(0);

    const ok = await manager.post(api(`/station-requests/${reqId}/approve`), { data: { confirmNearby: true } });
    expect(ok.status()).toBe(200);
    expect(countStationsInDb(reqCode)).toBe(1);
  });

  test('PROX-05 The review list surfaces nearby stations for a pending proposal', async () => {
    test.info().annotations.push({ type: 'module', description: 'PROX' });
    const lat = 11.98, lng = 106.90;
    const anchor = code('A5');
    await createAnchor(admin, anchor, lat, lng);

    const reqCode = code('R5');
    const created = await staff.post(api('/station-requests'), {
      data: { stationCode: reqCode, stationName: 'Gan', consumptionRate: 5, maxCapacity: 200, latitude: lat + 0.0012, longitude: lng, confirmNearby: true },
    });
    expect(created.status()).toBe(201);

    const list = await (await manager.get(api('/station-requests?status=pending'))).json();
    const mine = (list as Array<{ stationCode: string; nearbyStations?: Nearby[] }>).find(r => r.stationCode === reqCode);
    expect(mine, 'the proposal is in the pending list').toBeTruthy();
    expect((mine!.nearbyStations ?? []).map(s => s.stationCode), 'list carries the nearby station for the reviewer')
      .toContain(anchor);
  });

  test('PROX-06 Staff proposing near an existing station sees the confirm dialog and can proceed', async ({ page }) => {
    test.info().annotations.push({ type: 'module', description: 'PROX' });
    const lat = 12.00, lng = 106.90;
    await createAnchor(admin, code('A6'), lat, lng);

    await loginViaUi(page, 'staff');
    await navigateTo(page, 'stations');
    await page.getByRole('button', { name: 'Thêm trạm' }).click();
    await expect(page.getByText('Đề xuất trạm mới')).toBeVisible();

    // The code is auto-assigned, so identify the UI proposal by its unique name.
    const reqName = `Gan UI ${RUN_ID}`;
    await page.fill('#station-name', reqName);
    await page.fill('#consumption-rate', '5');
    await page.fill('#max-capacity', '200');
    await page.fill('#station-lat', String(lat + 0.0009)); // ~100 m
    await page.fill('#station-lng', String(lng));
    await page.getByRole('button', { name: 'Gửi đề xuất' }).click();

    // The proximity confirm dialog appears instead of a silent submit.
    await expect(page.getByText('Có trạm ở gần vị trí này')).toBeVisible({ timeout: 10000 });
    await page.getByRole('button', { name: 'Vẫn tiếp tục' }).click();

    let reqCode: string | undefined;
    await expect
      .poll(async () => {
        const list = await (await staff.get(api('/station-requests?status=pending'))).json();
        const found = (list as Array<{ stationCode: string; stationName: string }>).find(r => r.stationName === reqName);
        reqCode = found?.stationCode;
        return !!found;
      }, { timeout: 10000 })
      .toBe(true);

    // This proposal gets an auto CL-NNN code that the PROX% teardown can't match — remove it here.
    const user = process.env.POSTGRES_USER || 'fuelapp';
    execFileSync('docker', ['exec', 'fuel_postgres', 'psql', '-U', user, '-d', 'station_db', '-c',
      `DELETE FROM station_requests WHERE station_code='${reqCode}';`]);
  });
});
