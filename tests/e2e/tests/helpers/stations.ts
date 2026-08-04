import { execFileSync } from 'child_process';
import type { APIRequestContext } from '@playwright/test';
import { api, RUN_ID } from './auth';

/**
 * Shape returned by the gateway's merged station DTO (gateway/controllers/stations.controller.ts).
 * Note the field names differ from the station-service model: code/name/fuelRate/active.
 */
export interface StationDto {
  id: string;
  code: string;
  name: string;
  fuelRate: number | null;
  maxCapacity: number | null;
  currentFuel: number | null;
  fuelStatus: string;
  active: boolean;
}

export interface CreateStationPayload {
  stationCode: string;
  stationName?: string;
  consumptionRate?: number;
  maxCapacity?: number;
  initialFuel?: number;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

/** Raw create — returns the response so negative tests can assert status/body themselves. */
export async function createStationRaw(
  request: APIRequestContext,
  headers: Record<string, string>,
  payload: CreateStationPayload
) {
  return request.post(api('/stations'), { headers, data: payload });
}

export async function createStationApi(
  request: APIRequestContext,
  headers: Record<string, string>,
  payload: CreateStationPayload
) {
  const res = await createStationRaw(request, headers, payload);
  if (res.status() !== 201) {
    throw new Error(`createStationApi failed (${res.status()}): ${await res.text()}`);
  }
  return res.json();
}

/**
 * Creates a throwaway station namespaced by RUN_ID. Every write test must use one of these —
 * never a seed station — so a failing test can never corrupt shared data.
 */
export async function createDisposableStation(
  request: APIRequestContext,
  headers: Record<string, string>,
  options: {
    prefix: string;
    initialFuel?: number;
    maxCapacity?: number;
    consumptionRate?: number;
    suffix?: string;
  }
) {
  const stationCode = `TST_${options.prefix}_${RUN_ID}${options.suffix ? `_${options.suffix}` : ''}`;
  const station = await createStationApi(request, headers, {
    stationCode,
    stationName: `Test ${options.prefix} ${RUN_ID}`,
    consumptionRate: options.consumptionRate ?? 10,
    maxCapacity: options.maxCapacity ?? 500,
    initialFuel: options.initialFuel ?? 100,
  });
  return { ...station, stationCode, code: stationCode } as StationDto & { stationCode: string };
}

export async function getStationApi(request: APIRequestContext, headers: Record<string, string>, stationId: string) {
  const res = await request.get(api(`/stations/${stationId}/full`), { headers });
  if (!res.ok()) throw new Error(`getStationApi ${stationId} failed: ${res.status()}`);
  return res.json();
}

export async function listStationsApi(
  request: APIRequestContext,
  headers: Record<string, string>,
  active: 'true' | 'false' | 'all' = 'all'
): Promise<StationDto[]> {
  const res = await request.get(api(`/stations?active=${active}`), { headers });
  if (!res.ok()) throw new Error(`listStationsApi failed: ${res.status()}`);
  return res.json();
}

export async function getStationByCodeApi(
  request: APIRequestContext,
  headers: Record<string, string>,
  stationCode: string
): Promise<StationDto | undefined> {
  const all = await listStationsApi(request, headers, 'all');
  return all.find(s => s.code === stationCode);
}

/**
 * Finds a station by its (unique, RUN_ID-stamped) name. Needed because the add-station form no
 * longer lets a test choose the code — the backend auto-assigns CL-NNN — so the name is the only
 * handle the test controls.
 */
export async function getStationByNameApi(
  request: APIRequestContext,
  headers: Record<string, string>,
  stationName: string
): Promise<StationDto | undefined> {
  const all = await listStationsApi(request, headers, 'all');
  return all.find(s => s.name === stationName);
}

export async function deactivateStationApi(
  request: APIRequestContext,
  headers: Record<string, string>,
  stationId: string,
  reason = 'test cleanup'
) {
  return request.patch(api(`/stations/${stationId}/deactivate`), { headers, data: { reason } });
}

export async function updateStationApi(
  request: APIRequestContext,
  headers: Record<string, string>,
  stationId: string,
  payload: Record<string, unknown>
) {
  return request.put(api(`/stations/${stationId}`), { headers, data: payload });
}

/** null when the station has no CurrentFuelState (fuel-service returns 404). */
export async function getCurrentFuelApi(
  request: APIRequestContext,
  headers: Record<string, string>,
  stationId: string
): Promise<{ currentFuel: number; snapshotVersion: number } | null> {
  const res = await request.get(api(`/fuel/current/${stationId}`), { headers });
  if (res.status() === 404) return null;
  if (!res.ok()) throw new Error(`getCurrentFuelApi failed: ${res.status()}`);
  return res.json();
}

function psql(sql: string) {
  const user = process.env.POSTGRES_USER || 'fuelapp';
  execFileSync('docker', ['exec', 'fuel_postgres', 'psql', '-U', user, '-d', 'fuel_db', '-c', sql]);
}

function psqlOn(db: string, sql: string) {
  const user = process.env.POSTGRES_USER || 'fuelapp';
  execFileSync('docker', ['exec', 'fuel_postgres', 'psql', '-U', user, '-d', db, '-c', sql]);
}

/**
 * TEST-ONLY. Fully removes a station created through the UI, plus its fuel rows. Such stations get
 * an auto-assigned CL-NNN code that the global teardown deliberately can't tell apart from real
 * seed/production data, so the test that created one must delete it explicitly.
 */
export function deleteStationByCodeViaDb(stationCode: string) {
  const esc = stationCode.replace(/'/g, "''");
  psqlOn('fuel_db', `DELETE FROM current_fuel_state WHERE station_code='${esc}'; UPDATE fuel_records SET adjustment_for_id=NULL WHERE station_code='${esc}'; DELETE FROM fuel_records WHERE station_code='${esc}';`);
  psqlOn('station_db', `DELETE FROM stations WHERE station_code='${esc}';`);
}

/** TEST-ONLY. Removes a station proposal created through the UI by its auto-assigned CL-NNN code. */
export function deleteStationRequestByCodeViaDb(stationCode: string) {
  const esc = stationCode.replace(/'/g, "''");
  psqlOn('station_db', `DELETE FROM station_requests WHERE station_code='${esc}';`);
}

/**
 * TEST-ONLY. Deletes ONLY current_fuel_state so an existing FuelRecord (e.g. an adjustment's
 * originalRecordId) still resolves. Simulates legacy/corrupted data — there is deliberately no
 * public API that can produce this state any more.
 * Runs from the test process via docker exec; adds no test-only endpoint to any service.
 */
export function deleteCurrentFuelStateOnlyForTest(stationId: string) {
  psql(`DELETE FROM current_fuel_state WHERE station_id='${stationId}';`);
}

/** TEST-ONLY. Deletes both fuel_records and current_fuel_state for a disposable station. */
export function deleteFuelStateAndRecordsForTest(stationId: string) {
  psql(`DELETE FROM fuel_records WHERE station_id='${stationId}'; DELETE FROM current_fuel_state WHERE station_id='${stationId}';`);
}
