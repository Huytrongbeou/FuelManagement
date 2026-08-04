import { execFileSync } from 'child_process';

/**
 * Removes everything the suite created, so repeated runs don't silently fill the database with
 * disposable stations and junk brands (a previous accumulation reached 319 test stations and
 * 112 junk brands, which made the app's own dashboard/map numbers meaningless).
 *
 * Deletes strictly by the naming patterns the tests use. Real seed data (CL-*, Cummins,
 * Mitsubishi, ...) never matches these and is left untouched.
 *
 * Primary rule: every disposable station is namespaced with the run's RUN_ID timestamp, so its
 * code ends in `_<10+ digits>` (TST_*, FI##_*, ADJ1_*, API_*, HIST_*, NEARBY_*, …). That one
 * regex catches them all — real codes are `CL-NNN` and never carry a timestamp suffix. The LIKE
 * clauses cover the few specs (SREQ*, PROX*) that concatenate RUN_ID without a leading underscore.
 */
const TEST_STATION_PATTERNS = String.raw`station_code ~ '_[0-9]{10,}$' OR station_code LIKE 'TST\_%' OR station_code LIKE 'SMOKE\_%' OR station_code LIKE 'UNKNOWN\_%' OR station_code LIKE 'SREQ%' OR station_code LIKE 'PROX%'`;

const TEST_BRAND_PATTERNS = String.raw`name ~ '_[0-9]{10,}$'
   OR name LIKE 'FE\_BRAND\_%' OR name LIKE 'API\_BRAND\_%' OR name LIKE 'RBAC\_BRAND\_%'
   OR name LIKE 'TEST\_BRAND\_%' OR name LIKE 'SPOOF\_TEST\_%'
   OR name LIKE '%<img%' OR name LIKE '%script%'`;

/** Accounts created by USER-* tests. Never matches the seeded admin/manager/staff logins. */
const TEST_USER_PATTERNS = String.raw`username LIKE 'utest\_%'`;

function psql(db: string, sql: string) {
  const user = process.env.POSTGRES_USER || 'fuelapp';
  return execFileSync('docker', ['exec', '-i', 'fuel_postgres', 'psql', '-U', user, '-d', db], {
    input: sql,
    encoding: 'utf8',
  });
}

export default async function globalTeardown() {
  if (process.env.SKIP_TEST_CLEANUP === 'true') {
    console.log('Bỏ qua dọn dữ liệu test (SKIP_TEST_CLEANUP=true)');
    return;
  }

  try {
    // Fuel data first — it references stations, and fuel_records self-references via adjustments.
    psql('fuel_db', `
BEGIN;
DELETE FROM adjustment_requests WHERE station_id IN (
  SELECT DISTINCT station_id FROM fuel_records WHERE ${TEST_STATION_PATTERNS}
);
DELETE FROM current_fuel_state WHERE ${TEST_STATION_PATTERNS};
UPDATE fuel_records SET adjustment_for_id = NULL WHERE ${TEST_STATION_PATTERNS};
DELETE FROM fuel_records WHERE ${TEST_STATION_PATTERNS};
COMMIT;`);

    psql('station_db', `
BEGIN;
DELETE FROM station_requests WHERE ${TEST_STATION_PATTERNS};
DELETE FROM stations WHERE ${TEST_STATION_PATTERNS};
UPDATE stations SET model_id = NULL WHERE model_id IN (
  SELECT m.id FROM generator_models m JOIN generator_brands b ON m.brand_id = b.id WHERE ${TEST_BRAND_PATTERNS}
);
DELETE FROM generator_models WHERE brand_id IN (SELECT id FROM generator_brands WHERE ${TEST_BRAND_PATTERNS});
DELETE FROM generator_models WHERE model_name LIKE 'FE\\_MODEL\\_%' OR model_name LIKE 'TEST\\_MODEL\\_%';
UPDATE stations SET brand_id = NULL WHERE brand_id IN (SELECT id FROM generator_brands WHERE ${TEST_BRAND_PATTERNS});
DELETE FROM generator_brands WHERE ${TEST_BRAND_PATTERNS};
COMMIT;`);

    psql('auth_db', `DELETE FROM users WHERE ${TEST_USER_PATTERNS};`);

    console.log('Đã dọn dữ liệu test khỏi database.');
  } catch (err) {
    // Never fail the run over cleanup — the results themselves are what matter.
    console.warn('Không dọn được dữ liệu test:', (err as Error).message);
  }
}
