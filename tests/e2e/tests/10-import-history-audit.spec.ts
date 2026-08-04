import { test, expect } from '@playwright/test';
import { getAuthHeaders, loginViaUi, navigateTo, RUN_ID } from './helpers/auth';
import { createDisposableStation } from './helpers/stations';
import { ddmmyyyyDaysAgo } from './helpers/fuel';
import { createExcelBuffer, uploadImportViaApi, confirmImportApi, getImportJobApi } from './helpers/import';

/**
 * Import history / audit trail. The history LIST is real data from GET /import/jobs; these
 * tests verify a committed and a failed import each surface there with the correct status.
 * (The per-job DETAIL dialog is a separate, documented UX bug — see the scenarios report.)
 */
test.describe('10 — Import history audit', () => {
  test('HIST-01 Import thành công xuất hiện trong Lịch sử với đúng trạng thái/số liệu', async ({ page, request }) => {
    const managerHeaders = await getAuthHeaders('manager');
    const adminHeaders = await getAuthHeaders('admin');
    const station = await createDisposableStation(request, adminHeaders, {
      prefix: 'HIST1', initialFuel: 100, maxCapacity: 1000, consumptionRate: 10,
    });

    const filename = `hist01-${RUN_ID}.xlsx`;
    const buffer = createExcelBuffer([{ stationCode: station.stationCode, fuelAdded: 30, hoursRun: 1, recordedDate: ddmmyyyyDaysAgo(3) }]);
    const upload = await uploadImportViaApi(request, managerHeaders, buffer, filename);
    expect(upload.status()).toBe(201);
    const job = await upload.json();
    const confirm = await confirmImportApi(request, managerHeaders, job.id, { acknowledgeWarnings: true });
    expect(confirm.ok(), 'setup import must commit').toBe(true);

    // Backend truth first
    const committed = await getImportJobApi(request, managerHeaders, job.id);
    expect(committed.status).toBe('committed');

    // Now the manager reviews the history through the real UI
    await loginViaUi(page, 'manager');
    await navigateTo(page, 'history');
    await expect(page.getByRole('heading', { name: 'Lịch sử import' })).toBeVisible({ timeout: 15000 });

    const row = page.locator('tr', { hasText: filename });
    await expect(row, `the committed import "${filename}" must appear in history`).toBeVisible({ timeout: 15000 });
    await expect(row.getByText('Thành công')).toBeVisible();

    // Detail dialog must show THIS job's real data (BUG-1 fix), not hardcoded placeholders.
    await row.getByRole('button', { name: /chi tiết/i }).click();
    const affected = page.getByTestId('import-detail-affected');
    await expect(affected, 'detail must show the real station updated by this import').toContainText(station.stationCode);
    // the old hardcoded mock codes must be gone entirely
    await expect(page.getByText('ST001', { exact: true })).toHaveCount(0);
    await expect(page.getByText('STXXX', { exact: true })).toHaveCount(0);
  });

  test('HIST-02 Import thất bại xuất hiện trong Lịch sử với trạng thái Thất bại', async ({ page, request }) => {
    const managerHeaders = await getAuthHeaders('manager');
    const adminHeaders = await getAuthHeaders('admin');
    const station = await createDisposableStation(request, adminHeaders, {
      prefix: 'HIST2', initialFuel: 100, maxCapacity: 1000, consumptionRate: 10,
    });

    // A file with an unknown-station row: clean row + red row. Confirm drives it to failed.
    const filename = `hist02-${RUN_ID}.xlsx`;
    const date = ddmmyyyyDaysAgo(3);
    const buffer = createExcelBuffer([
      { stationCode: station.stationCode, fuelAdded: 20, hoursRun: 1, recordedDate: date },
      { stationCode: `HIST2_UNKNOWN_${RUN_ID}`, fuelAdded: 20, hoursRun: 1, recordedDate: date },
    ]);
    const upload = await uploadImportViaApi(request, managerHeaders, buffer, filename);
    const job = await upload.json();
    expect(job.invalidRows, 'the file must have a red row').toBeGreaterThan(0);
    const confirm = await confirmImportApi(request, managerHeaders, job.id, { acknowledgeWarnings: true });
    expect(confirm.status(), 'confirming a file with a red row must fail').toBe(422);

    const failed = await getImportJobApi(request, managerHeaders, job.id);
    expect(failed.status).toBe('failed');

    await loginViaUi(page, 'manager');
    await navigateTo(page, 'history');
    await expect(page.getByRole('heading', { name: 'Lịch sử import' })).toBeVisible({ timeout: 15000 });

    const row = page.locator('tr', { hasText: filename });
    await expect(row, `the failed import "${filename}" must appear in history`).toBeVisible({ timeout: 15000 });
    await expect(row.getByText('Thất bại')).toBeVisible();

    // BUG-1 fix: the detail dialog must show the REAL error for this job — the unknown station
    // code from the actual file — and none of the old hardcoded placeholders.
    await row.getByRole('button', { name: /chi tiết/i }).click();
    const errorsPanel = page.getByTestId('import-detail-errors');
    await expect(errorsPanel, 'detail must list the real unknown-station error from this job').toContainText(`HIST2_UNKNOWN_${RUN_ID}`);
    await expect(page.getByText('STXXX', { exact: true })).toHaveCount(0);
    await expect(page.getByText('ST011', { exact: true })).toHaveCount(0);
  });
});
