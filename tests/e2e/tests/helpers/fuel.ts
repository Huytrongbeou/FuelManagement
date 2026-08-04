import { expect, type APIRequestContext } from '@playwright/test';
import { api } from './auth';
import { getCurrentFuelApi } from './stations';

/**
 * Shape returned by fuel-service's toFuelRecordDto — NOTE the names are NOT the DB column
 * names. previousFuel=fuelBefore, added=fuelAdded, consumed=fuelConsumed, endFuel=fuelAfter.
 * Asserting on `fuelBefore` etc. would silently compare against undefined.
 */
export interface FuelRecordDto {
  id: string;
  stationId: string;
  stationCode: string;
  date: string;
  previousFuel: number | null;
  added: number | null;
  hoursRun: number | null;
  consumed: number | null;
  systemCalculated: number | null;
  endFuel: number | null;
  adjustmentAmount: number | null;
  adjustmentForId: string | null;
  status: string;
  source: string;
  note: string | null;
  createdAt: string;
}

export async function getFuelRecordsApi(
  request: APIRequestContext,
  headers: Record<string, string>,
  stationId: string
): Promise<FuelRecordDto[]> {
  const res = await request.get(api(`/fuel/records/${stationId}`), { headers });
  if (!res.ok()) throw new Error(`getFuelRecordsApi failed: ${res.status()}`);
  return res.json();
}

/**
 * The API sorts by recordedDate DESC, which ties for same-day records (a station's genesis
 * record and a same-day entry). Sort by createdAt so "latest" is deterministic.
 */
export async function getLatestFuelRecordApi(
  request: APIRequestContext,
  headers: Record<string, string>,
  stationId: string
): Promise<FuelRecordDto | undefined> {
  const records = await getFuelRecordsApi(request, headers, stationId);
  return [...records].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0];
}

export async function countFuelRecordsApi(
  request: APIRequestContext,
  headers: Record<string, string>,
  stationId: string
): Promise<number> {
  return (await getFuelRecordsApi(request, headers, stationId)).length;
}

export interface DirectEntryRow {
  stationCode: string;
  fuelAdded?: number | string | null;
  hoursRun?: number | string | null;
  recordedDate?: string | null;
  notes?: string | null;
}

export async function directEntryPreviewApi(
  request: APIRequestContext,
  headers: Record<string, string>,
  rows: DirectEntryRow[]
) {
  return request.post(api('/manual-entry/preview'), { headers, data: { rows } });
}

export async function directEntryConfirmApi(
  request: APIRequestContext,
  headers: Record<string, string>,
  jobId: string,
  options: { acknowledgeWarnings?: boolean } = {}
) {
  return request.post(api('/manual-entry/confirm'), { headers, data: { jobId, ...options } });
}

export async function expectCurrentFuel(
  request: APIRequestContext,
  headers: Record<string, string>,
  stationId: string,
  expected: number
) {
  const state = await getCurrentFuelApi(request, headers, stationId);
  expect(state, `station ${stationId} should have a CurrentFuelState`).not.toBeNull();
  expect(Number(state!.currentFuel), 'CurrentFuelState.currentFuel').toBeCloseTo(expected, 2);
}

export async function expectFuelRecordCountDelta(
  request: APIRequestContext,
  headers: Record<string, string>,
  stationId: string,
  before: number,
  delta: number
) {
  const after = await countFuelRecordsApi(request, headers, stationId);
  expect(after - before, `FuelRecord count delta for ${stationId}`).toBe(delta);
}

/** Asserts the core fuel formula on a record: fuelAfter = fuelBefore + added - hoursRun*rate. */
export function expectFuelMath(
  record: FuelRecordDto,
  expected: { previousFuel: number; added: number; hoursRun: number; consumed: number; endFuel: number }
) {
  expect(Number(record.previousFuel), 'fuelBefore').toBeCloseTo(expected.previousFuel, 2);
  expect(Number(record.added), 'fuelAdded').toBeCloseTo(expected.added, 2);
  expect(Number(record.hoursRun), 'hoursRun').toBeCloseTo(expected.hoursRun, 2);
  expect(Number(record.consumed), 'fuelConsumed').toBeCloseTo(expected.consumed, 2);
  expect(Number(record.endFuel), 'fuelAfter').toBeCloseTo(expected.endFuel, 2);
  // the invariant itself, independent of the individual expectations above
  expect(
    Number(record.previousFuel) + Number(record.added) - Number(record.consumed),
    'fuelBefore + fuelAdded - fuelConsumed must equal fuelAfter'
  ).toBeCloseTo(Number(record.endFuel), 2);
}

export const todayIso = () => new Date().toISOString().slice(0, 10);

/** Vietnamese dd/mm/yyyy N days back — the format real users type into Excel. */
export function ddmmyyyyDaysAgo(days: number): string {
  const d = new Date(Date.now() - days * 86_400_000);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}
