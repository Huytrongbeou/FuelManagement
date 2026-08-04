import { expect, type APIRequestContext } from '@playwright/test';
import { countFuelRecordsApi } from './fuel';
import { getCurrentFuelApi } from './stations';
import { getAdjustmentRequestApi } from './adjustments';

export interface FuelSnapshot {
  currentFuel: number | null;
  recordCount: number;
}

/** Captures the exact state a failing flow must leave untouched. */
export async function captureFuelSnapshot(
  request: APIRequestContext,
  headers: Record<string, string>,
  stationId: string
): Promise<FuelSnapshot> {
  const state = await getCurrentFuelApi(request, headers, stationId);
  return {
    currentFuel: state ? Number(state.currentFuel) : null,
    recordCount: await countFuelRecordsApi(request, headers, stationId),
  };
}

/**
 * The core "failed flow must be inert" assertion: no new FuelRecord and CurrentFuelState
 * byte-identical to before. Used by every negative write test.
 */
export async function expectNoFuelSideEffect(
  request: APIRequestContext,
  headers: Record<string, string>,
  stationId: string,
  before: FuelSnapshot
) {
  const after = await captureFuelSnapshot(request, headers, stationId);
  expect(after.recordCount, 'a failed flow must not create any FuelRecord').toBe(before.recordCount);
  if (before.currentFuel === null) {
    expect(after.currentFuel, 'a failed flow must not auto-create CurrentFuelState').toBeNull();
  } else {
    expect(after.currentFuel, 'a failed flow must not change CurrentFuelState').toBeCloseTo(before.currentFuel, 2);
  }
}

/** The positive counterpart: exactly `recordDelta` new records and the expected new balance. */
export async function expectFuelSideEffect(
  request: APIRequestContext,
  headers: Record<string, string>,
  stationId: string,
  before: FuelSnapshot,
  expected: { currentFuel: number; recordDelta: number }
) {
  const after = await captureFuelSnapshot(request, headers, stationId);
  expect(after.recordCount - before.recordCount, 'FuelRecord count delta').toBe(expected.recordDelta);
  expect(after.currentFuel, 'CurrentFuelState after commit').not.toBeNull();
  expect(Number(after.currentFuel), 'CurrentFuelState after commit').toBeCloseTo(expected.currentFuel, 2);
}

export async function expectNoAdjustmentSideEffect(
  request: APIRequestContext,
  headers: Record<string, string>,
  stationId: string,
  adjustmentId: string,
  before: FuelSnapshot,
  expectedStatus = 'pending'
) {
  await expectNoFuelSideEffect(request, headers, stationId, before);
  const req = await getAdjustmentRequestApi(request, headers, adjustmentId);
  expect(req, `adjustment request ${adjustmentId} should still exist`).toBeTruthy();
  expect(req.status, 'a rejected approve must leave the request unchanged').toBe(expectedStatus);
}
