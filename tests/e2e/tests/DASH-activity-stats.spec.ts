import { test, expect, type APIRequestContext } from '@playwright/test';
import { execFileSync } from 'child_process';
import { api, createRequestContextForRole, loginViaUi, navigateTo } from './helpers/auth';

/**
 * Dashboard "Hôm nay / Tuần / Tháng / Năm" used to be a purely cosmetic toggle — clicking it
 * changed nothing on screen. It now drives GET /fuel/stats/activity, which aggregates
 * fuel_records per period. These tests assert the UI shows what the backend actually computed,
 * and that the backend's own numbers match the database — so a broken date range or a wrong
 * source filter fails here instead of silently shipping wrong numbers to the user.
 */

type Period = 'today' | 'week' | 'month' | 'year';

interface Stats {
  period: Period;
  from: string;
  to: string;
  entryCount: number;
  totalAdded: number;
  totalHours: number;
  totalConsumed: number;
  stationsUpdated: number;
}

async function fetchStats(ctx: APIRequestContext, period: Period): Promise<Stats> {
  const res = await ctx.get(api(`/fuel/stats/activity?period=${period}`));
  expect(res.status(), `GET stats?period=${period}`).toBe(200);
  return res.json();
}

/** Same aggregate, straight from Postgres — the independent source of truth for DASH-4. */
function aggregateFromDb(from: string, toInclusive: string) {
  const user = process.env.POSTGRES_USER || 'fuelapp';
  const sql = `SELECT count(*), COALESCE(sum(fuel_added),0), COALESCE(sum(hours_run),0), count(DISTINCT station_id)
               FROM fuel_records
               WHERE source IN ('direct','import','manual')
                 AND recorded_date >= DATE '${from}' AND recorded_date <= DATE '${toInclusive}';`;
  const out = execFileSync(
    'docker',
    ['exec', 'fuel_postgres', 'psql', '-U', user, '-d', 'fuel_db', '-t', '-A', '-F', '|', '-c', sql],
    { encoding: 'utf8' }
  ).trim();
  const [count, added, hours, stations] = out.split('|');
  return {
    entryCount: Number(count),
    totalAdded: Number(added),
    totalHours: Number(hours),
    stationsUpdated: Number(stations),
  };
}

/** Reads the activity cards off the dashboard by their value testids. */
async function readActivityCards(page: import('@playwright/test').Page) {
  await expect(page.getByTestId('activity-stats')).toBeVisible({ timeout: 15000 });
  return {
    entryCount: (await page.getByTestId('activity-entry-count').innerText()).trim(),
    stationsUpdated: (await page.getByTestId('activity-stations-updated').innerText()).trim(),
  };
}

test.describe('DASH - Dashboard activity stats by period', () => {
  test.use({ storageState: undefined });

  let ctx: APIRequestContext;

  test.beforeAll(async () => {
    ctx = await createRequestContextForRole('manager');
  });

  test.afterAll(async () => {
    await ctx.dispose();
  });

  test('DASH-1 Dashboard shows the backend activity numbers for the default period', async ({ page }) => {
    test.info().annotations.push({ type: 'module', description: 'DASH' });

    const expected = await fetchStats(ctx, 'today');

    await loginViaUi(page, 'manager');
    await navigateTo(page, 'dashboard');

    const cards = await readActivityCards(page);
    expect(cards.entryCount, 'entry count card must equal the API value').toBe(String(expected.entryCount));
    expect(cards.stationsUpdated, 'stations-updated card must equal the API value').toBe(String(expected.stationsUpdated));

    // The header must state the real period, not the old hard-coded "12/06/2026 08:30".
    const [y, m, d] = expected.to.split('-');
    await expect(page.getByText(`Hoạt động ngày ${d}/${m}/${y}`)).toBeVisible();
  });

  test('DASH-2 Switching the period actually re-queries and updates the cards', async ({ page }) => {
    test.info().annotations.push({ type: 'module', description: 'DASH' });

    const today = await fetchStats(ctx, 'today');
    const year = await fetchStats(ctx, 'year');

    // If both periods happen to hold the same count, a still-static toggle would pass this test
    // vacuously. Skip loudly rather than report a green that proves nothing.
    test.skip(
      today.entryCount === year.entryCount,
      `today and year both report ${year.entryCount} entries — cannot distinguish a working filter from a static one`
    );

    await loginViaUi(page, 'manager');
    await navigateTo(page, 'dashboard');
    expect((await readActivityCards(page)).entryCount).toBe(String(today.entryCount));

    await page.getByRole('button', { name: 'Năm', exact: true }).click();

    await expect
      .poll(async () => (await readActivityCards(page)).entryCount, { timeout: 10000 })
      .toBe(String(year.entryCount));

    const [y, m, d] = year.from.split('-');
    await expect(page.getByText(`Hoạt động từ ${d}/${m}/${y}`, { exact: false })).toBeVisible();
  });

  test('DASH-3 Widening the period never shrinks the totals, and bad input is rejected', async () => {
    test.info().annotations.push({ type: 'module', description: 'DASH' });

    const [today, week, month, year] = await Promise.all([
      fetchStats(ctx, 'today'),
      fetchStats(ctx, 'week'),
      fetchStats(ctx, 'month'),
      fetchStats(ctx, 'year'),
    ]);

    // Each period starts earlier and ends on the same day, so counts are monotonically
    // non-decreasing. A wrong week-start or an off-by-one date range breaks this.
    expect(week.entryCount).toBeGreaterThanOrEqual(today.entryCount);
    expect(month.entryCount).toBeGreaterThanOrEqual(week.entryCount);
    expect(year.entryCount).toBeGreaterThanOrEqual(month.entryCount);
    expect(new Date(year.from).getTime()).toBeLessThanOrEqual(new Date(month.from).getTime());
    expect(new Date(month.from).getTime()).toBeLessThanOrEqual(new Date(week.from).getTime());
    expect(new Date(week.from).getTime()).toBeLessThanOrEqual(new Date(today.from).getTime());
    expect(today.from).toBe(today.to);

    const bad = await ctx.get(api('/fuel/stats/activity?period=decade'));
    expect(bad.status(), 'unknown period must be rejected, not silently defaulted').toBe(400);
  });

  test('DASH-4 Backend totals match the database, excluding initial_state and adjustment rows', async () => {
    test.info().annotations.push({ type: 'module', description: 'DASH' });

    const stats = await fetchStats(ctx, 'year');
    const db = aggregateFromDb(stats.from, stats.to);

    expect(stats.entryCount, 'entry count must match the DB').toBe(db.entryCount);
    expect(stats.stationsUpdated, 'distinct stations must match the DB').toBe(db.stationsUpdated);
    expect(stats.totalAdded, 'litres added must match the DB').toBeCloseTo(db.totalAdded, 2);
    expect(stats.totalHours, 'hours run must match the DB').toBeCloseTo(db.totalHours, 2);

    // The genesis rows must not be counted as user activity — otherwise every station would look
    // "updated" on the day it was created.
    const user = process.env.POSTGRES_USER || 'fuelapp';
    const genesis = Number(
      execFileSync(
        'docker',
        ['exec', 'fuel_postgres', 'psql', '-U', user, '-d', 'fuel_db', '-t', '-A', '-c',
          `SELECT count(*) FROM fuel_records WHERE source = 'initial_state' AND recorded_date >= DATE '${stats.from}' AND recorded_date <= DATE '${stats.to}';`],
        { encoding: 'utf8' }
      ).trim()
    );
    expect(genesis, 'seed data must contain initial_state rows in range for this exclusion test to bite')
      .toBeGreaterThan(0);
  });
});
