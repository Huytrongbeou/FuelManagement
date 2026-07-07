# Production Readiness Report — VNPT Fuel Management System (Cao Lãnh)

**Date:** 2026-07-07 (Round 1) / 2026-07-07 (Round 2)
**Branch:** `refactor/layered-mvc-services`
**Scope:** Full production-readiness fix pass (P0 blockers, P0.9 import-correctness hardening, P1 hardening, P2 E2E stabilization, P3 regression pack), plus a **Round 2** follow-up fix pass closing 4 issues found by the user's independent post-Round-1 code audit.

---

## 0. Round 2 — Post-Audit Fix Pass

After Round 1 concluded READY, the user performed an independent audit of the actual code (not the report) and found that Round 1's own atomic-claim hardening had introduced a **regression**, plus 3 other real gaps the report had under-weighted or missed. All 4 were verified against live code before being fixed — none were false positives:

| ID | Severity | Location | Issue | Fix |
|---|---|---|---|---|
| A | BLOCKER (self-introduced regression) | `import-orchestrator.service.ts` `confirmImport` | Atomic claim set `status:'committing'` **before** checking `previewRows` for row errors. If a row error existed, the code threw 422 but never reset status — job stuck in `committing` forever, blocking all future confirms. | Moved the row-error/valid-row check before the atomic claim; on row error, job is explicitly marked `status:'failed', failureStage:'validation', retryable:false` before throwing. Tightened the claim's `where` clause so it only claims `previewing` or `failed AND retryable:true AND committedAt:null` — a validation-failed job can never be reclaimed into `committing` again. |
| B | BLOCKER (live bypass) | `fuel-service` `POST /fuel/records` (`createManualRecord`) | Still defaulted `fuelBefore=0` and auto-upserted `CurrentFuelState` when missing — bypassed preview/confirm, duplicate-guard, `acknowledgeWarnings`, the ImportJob lifecycle, and the missing-CurrentFuelState guard. Round 1 removed its only frontend caller but left the backend route live. | Removed `postRecord`, `createManualRecord`, `requireFiniteNonNeg`, and the route itself (verified via grep: 0 remaining callers anywhere in the repo). `fuel-record.service.ts` deleted (became empty). |
| C | SHOULD FIX | `manual-entry.service.ts` `toParsedRow` | Round 1's fuel-only enforcement (unknown stationCode = red error) was only applied to the Excel-import validator (`excel-validator.service.ts`); DirectEntry/manual-entry had its own independent row parser that still accepted an unknown stationCode if `stationName`/`consumptionRate`/`maxCapacity` were supplied ("new station" path). | Removed the new-station validation branch; unknown stationCode is now unconditionally a red error in DirectEntry too, matching Excel import. |
| D | SHOULD FIX | `station-bulk-upsert.service.ts` | `POST /stations/bulk-upsert` created stations directly via `tx.station.create` without calling fuel-service's init endpoint — a second (undocumented) way to produce a station missing `CurrentFuelState`, inconsistent with `station.service.ts`'s `create()`. | Bulk-upsert now calls `fuelClient.initCurrentState(...)` for every newly created station, post-transaction, reading only from the transaction's `results` (not out-of-scope local vars). `initial_fuel` is validated (finite, ≥0, ≤resolvedMaxCapacity), applies only to new stations (existing-station `initial_fuel` is ignored with an appended warning, never silently dropped or used to overwrite fuel state), and is reported back explicitly in the response (`initialFuel`, `currentFuelStateInitialized`) — no silent defaulting, no fake success on init failure. |

A 5th finding from the user's audit (a possible ZIP/bundle containing `.env`/cert files) was explicitly deferred by the user's own decision and is **not** addressed by Round 2.

New regression tests added (all passing, see Section 3): **FI-23** (job-stuck-committing regression + re-confirm-blocked assertion), **FI-24** (manual-entry unknown-station-always-red-error), **FI-25** (bulk-upsert `initial_fuel`: default-0, custom value, negative-invalid, over-capacity-invalid, existing-station-warning-no-overwrite), **SEC-3** (`POST /fuel/records` via gateway → 404). **FI-12** was reworked: since Round 2 closes the last public API path that could produce a station missing `CurrentFuelState`, the test now simulates legacy data via a test-only DB cleanup (`docker exec` + `psql` from the test-runner process — no test-only HTTP endpoint added to any service) instead of relying on the now-fixed bulk-upsert gap.

---

## 1. Change Summary

### Backend

- **Import all-or-nothing enforced.** `confirmImport` previously filtered out error rows and committed the rest (partial success). Now any row with an error rejects the whole confirm (422) before any write. A file where every row is "no activity" also now rejects instead of silently committing zero records.
- **Fuel Import is fuel-only for every role.** Removed the `isFuelOnly = userRole === 'manager'` branch — Admin no longer gets a separate "full import" code path. Preview always runs in `'fuel-only'` mode; unknown stationCode is a red error for Admin too. Dead `bulkUpsert` client removed from import-export-service (the station-service endpoint itself is untouched, reserved for a future Station Master Import module).
- **Import job list/detail restricted to Manager/Admin.** `GET /import/jobs` and `GET /import/jobs/:id` had no role guard while the write endpoints did.
- **Same-station multi-row guard.** A file/batch with two or more fuel-activity rows for the same station is now rejected — preview validated each row independently against the same starting fuel level, which would have disagreed with commit's sequential running-balance chain.
- **Atomic job claim.** `confirmImport` now atomically claims the job (`previewing|failed` → `committing`) before any side effect, closing a race where two concurrent confirms for the same job could both proceed.
- **Explicit warning acknowledgement enforced server-side.** Confirm now rejects (422) if `warningRows > 0` and the caller didn't pass `acknowledgeWarnings: true` — previously only the UI checkbox gated this, so a direct API call could commit unreviewed warnings.
- **CurrentFuelState is never silently created by Fuel Import.** `import-commit.service.ts` used to bootstrap a station's fuel state from 0 the first time it saw fuel data for that station. Now a missing state is a hard preview-time row error and a hard commit-time 400. Initializing fuel state is Station Management's job:
  - New internal `POST /fuel/current/init` (fuel-service, admin-only, idempotent) — creates a genesis `FuelRecord` (`source='initial_state'`) so `CurrentFuelState.lastRecordId` (NOT NULL by schema) has something to point to.
  - `station-service`'s create flow calls this right after creating a station. Station creation itself never rolls back on init failure — the response reports `currentFuelStateInitialized: false` + a warning instead of a bare success that hides the gap.
  - One-shot backfill script (`services/fuel-service/scripts/backfill-current-fuel-state.ts`, `npm run backfill:current-fuel-state`) for stations that predate this wiring. Dry-run by default; `--apply --confirm-zero` is manual/human-run only, never part of any deploy step.
- **Gateway fails closed for writes when the active-user check is unavailable.** `checkActive` now distinguishes `active | inactive | unknown`. `unknown` (auth-service unreachable/erroring) previously fell through to fail-open for everything. Now GET/HEAD/OPTIONS still proceed (a dashboard shouldn't go blind over an auth-service hiccup); POST/PUT/PATCH/DELETE get 503 instead of being forwarded with an unverified identity.
- **Validation gaps closed:** `suggestedConsumptionRate`/`suggestedMaxCapacity` on generator models now reject ≤ 0 (station-level consumptionRate/maxCapacity was already correct — audit initially misread the controller's null-check as the only check and missed the service-layer range check). Direct-entry `fuelAdded`/`hoursRun` now parsed with `Number.isFinite` before comparison — a non-numeric or negative value was previously coerced to falling into the "no activity, skip" branch instead of surfacing as an error.

### Frontend

- **RBAC gating on station-row actions.** New `shared/auth/permissions.ts` (`canManageStations`, `canEnterFuel`). StationList's "Nhập NL" button, edit/disable dropdown, and "Thêm trạm" were all rendered unconditionally regardless of role; backend already enforced via `requireRole`, but the UI offered actions a Staff/Manager couldn't actually use.
- **Real disable-station API.** `StationList.handleDeactivate` only called `toast.success` with no request at all — the station stayed active in the DB. Now calls the (already role-guarded) `PATCH /stations/:id/deactivate` and only reports success after it resolves, then reloads the station list.
- **Two direct-write bypasses of DirectEntry's preview/confirm flow removed**, both calling `POST /fuel/records` directly:
  - StationList's `FuelEntryModal` (opened via "Nhập NL") — deleted, along with its only consumer `InfoChip.tsx` and the now-unused `postFuelRecord` API function.
  - StationDetail's inline "Cập nhật nhiên liệu" quick-update form — this one was rendered for **every role including Staff**, who is supposed to be read-only. This was the most severe of the two: Staff could submit fuel data bypassing all validation, duplicate-guard, and revalidation. Replaced with a role-gated button that navigates to DirectEntry.
- **Two pre-existing dead-UI bugs fixed** (found via testing, unrelated to the plan's original scope but blocking real functionality):
  - Topbar's global "Export" button had no `onClick` handler at all.
  - Settings page's entire tab bar (including the admin adjustment-approval queue) rendered completely blank — `Tabs.Trigger` wrapped a native `<button>` whose children was a render-prop function; React never invokes a function passed as children to a host DOM element.
- `.xlsx` extension validated in the file-picker path (previously only drag-drop validated it).
- New "Tồn nhiên liệu ban đầu (L)" field in `StationFormModal` for the initial-fuel-state flow above.

### Infrastructure

- `docker-compose.yml`: added missing `FUEL_SERVICE_URL` env var to `station-service` (found via E2E testing — station creation was silently failing to initialize fuel state because the new station→fuel-service call defaulted to `localhost:3003`, unreachable inside the container network).
- `.gitignore`: `.env-test` and other `.env.*` variants were not covered by any existing pattern and would have been committed by a plain `git add .`.

### Tests

- Frontend E2E suite (`D:\fuel-frontend-test-runner`, 37 pre-existing tests) fully stabilized — see Section 3.
- New API-level regression pack (`tests/FI-import-regression.spec.ts`, 13 tests: FI-02 through FI-22 + SEC-1/SEC-2) added and passing.

---

## 2. Files Changed

**Backend:**
- `services/import-export-service/src/services/import-orchestrator.service.ts` (Round 2: Fix A — row-error check moved before atomic claim, tightened claim condition)
- `services/import-export-service/src/services/manual-entry.service.ts` (Round 2: Fix C — removed new-station validation branch)
- `services/import-export-service/src/services/excel-validator.service.ts`
- `services/import-export-service/src/controllers/import.controller.ts`
- `services/import-export-service/src/controllers/manual-entry.controller.ts`
- `services/import-export-service/src/routes/import.routes.ts`
- `services/import-export-service/src/clients/station.client.ts`
- `services/fuel-service/src/services/import-commit.service.ts`
- `services/fuel-service/src/services/current-state-init.service.ts` (new)
- `services/fuel-service/src/services/fuel-record.service.ts` (Round 2: deleted — `createManualRecord` was its only content)
- `services/fuel-service/src/controllers/fuel-record.controller.ts` (Round 2: removed `postRecord`/`requireFiniteNonNeg`)
- `services/fuel-service/src/routes/fuel-record.routes.ts` (Round 2: removed `POST /records`)
- `services/fuel-service/scripts/backfill-current-fuel-state.ts` (new)
- `services/fuel-service/package.json`
- `services/station-service/src/services/station.service.ts`
- `services/station-service/src/services/station-bulk-upsert.service.ts` (Round 2: init CurrentFuelState for new stations, `initial_fuel` handling)
- `services/station-service/src/services/generator-model.service.ts`
- `services/station-service/src/controllers/station.controller.ts` (Round 2: forward `userCtx` to `bulkUpsert`)
- `services/station-service/src/models/station.types.ts` (Round 2: `initial_fuel` on `BulkUpsertRow`, extended `BulkUpsertResult`)
- `services/station-service/src/clients/fuel.client.ts` (new)
- `services/gateway/src/middleware/auth.middleware.ts`

**Frontend:**
- `apps/web/src/app/App.tsx`
- `apps/web/src/shared/auth/permissions.ts` (new)
- `apps/web/src/shared/components/layout/Topbar.tsx`
- `apps/web/src/features/settings/pages/Settings.tsx`
- `apps/web/src/features/stations/pages/StationList.tsx`
- `apps/web/src/features/stations/pages/StationDetail.tsx`
- `apps/web/src/features/stations/api/stationApi.ts`
- `apps/web/src/features/stations/components/StationFormModal.tsx`
- `apps/web/src/features/fuel/api/fuelApi.ts`
- `apps/web/src/features/fuel/components/FuelEntryModal.tsx` (deleted)
- `apps/web/src/features/fuel/components/InfoChip.tsx` (deleted)
- `apps/web/src/features/import-export/pages/ImportExcel.tsx`
- `apps/web/src/features/import-export/api/importApi.ts`
- `apps/web/src/features/direct-entry/pages/DirectEntry.tsx`
- `apps/web/src/features/direct-entry/api/manualEntryApi.ts`

**Infrastructure:**
- `docker-compose.yml`
- `.gitignore`

**Tests (outside main repo, `D:\fuel-frontend-test-runner`, not version-controlled):**
- `tests/F01-F03.spec.ts` through `tests/F15-F20.spec.ts` (selector/RBAC fixes)
- `tests/F13-F14.spec.ts` (station-detail navigation helper)
- `tests/FI-import-regression.spec.ts` (new, 13 tests)
- `global-setup.ts`

Full commit list: `54c4e20..720701e` (18 commits on `refactor/layered-mvc-services`).

---

## 3. Test Evidence

### Backend build
```
cd services/{import-export-service,fuel-service,station-service,gateway} && npx tsc --noEmit
```
All four clean, no errors, after every backend edit in this session.

### Docker rebuild + restart
```
docker compose build gateway station-service fuel-service import-export-service
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d
```
All 9 containers healthy post-restart (`docker ps`). Frontend runs via Vite dev server (HMR — no rebuild needed for frontend changes).

### Backfill dry-run
```
npm run backfill:current-fuel-state   # (dry-run, default)
```
Correctly identified 5 real active stations missing `CurrentFuelState` (2 legacy: CL-008, CL-009; 3 stale test stations from prior sessions before the docker-compose fix). No changes made — dry-run confirmed working end-to-end against live data.

### Smoke API tests (ad-hoc, post-rebuild)
9/9 passed: staff GET /import/jobs → 403; no-token GET /stations → 401; 1-valid+1-unknown manual-entry batch → confirm 422 + station fuel unchanged; all-no-activity batch → confirm 422; same-station-multi-row → red error both rows; negative suggestedConsumptionRate → 400; negative fuelAdded → row error (not silent skip).

### Frontend E2E suite (Playwright, `D:\fuel-frontend-test-runner`)
```
npx playwright test
```
**Round 1 final result: 49 passed, 1 skipped, 0 failed** (50 tests total: 37 original F01–F20 + 13 FI/SEC regression tests).
Report: `D:\fuel-frontend-test-runner\reports\frontend-e2e-result-20260707110615.txt`

**Round 2 final result: 53 passed, 1 skipped, 0 failed** (54 tests total: 37 original F01–F20 + 17 FI/SEC regression tests, after adding FI-23/24/25 and SEC-3 and reworking FI-12).
Report: `D:\fuel-frontend-test-runner\reports\frontend-e2e-result-20260707124253.txt`

The single skip (F08.3, station-list status filter) has a documented reason: no status-filter UI element found on the page — not a setup failure.

Progression: 9 pass/24 fail/4 skip (original baseline) → 36/37 (Phase 1, E2E-only pass) → 49/50 (Round 1, after all P0/P1 backend+frontend fixes) → 53/54 (Round 2, after Fixes A–D and 4 new regression tests).

Regression pack detail (`FI-import-regression.spec.ts`):
| Test | Verifies |
|---|---|
| FI-02 | Unknown stationCode → red error, no station created |
| FI-03 / FI-14 | Station disabled between preview and confirm → confirm rejects (422) |
| FI-04 / FI-21 | 1 valid + 1 unknown station in one batch → confirm 422, station fuel level unchanged |
| FI-05 | Admin import with mismatched stationName/consumptionRate/maxCapacity → warning only, DB master data unchanged |
| FI-09 | Negative fuelAdded/hoursRun → row error, not silently treated as no-activity |
| FI-10/11 | fuelAfter < 0 or > maxCapacity → red error |
| FI-12 | Legacy data (fuel state deleted via test-only DB cleanup) → missing CurrentFuelState is a red error at preview and blocked at confirm (Round 2: reworked — bulk-upsert can no longer produce this state after Fix D) |
| FI-13 | Confirming the same job twice → idempotent (`already_committed`), no double-commit |
| FI-16 | Same station, two fuel-activity rows in one batch → red error on both |
| FI-17 | Warning row confirm without `acknowledgeWarnings` → 422; with it → success |
| FI-22 | Batch of only no-activity rows → confirm 422, no commit |
| FI-23 *(Round 2, new)* | Job with a row error is marked `failed`/`failureStage:'validation'`/`retryable:false` (not stuck in `committing`); re-confirming the same job stays blocked; a fresh job with clean data confirms normally |
| FI-24 *(Round 2, new)* | manual-entry unknown stationCode is a red error even when `stationName`/`consumptionRate`/`maxCapacity` are supplied |
| FI-25 *(Round 2, new)* | bulk-upsert initializes CurrentFuelState for new stations; `initial_fuel` explicit default-0, custom value, negative/over-capacity rejected, existing-station `initial_fuel` warns without touching fuel state |
| SEC-1 | Spoofed `X-User-Role` header does not escalate privilege (gateway strips it) |
| SEC-2 | No-auth GET/POST on 6 sensitive endpoints → all 401 |
| SEC-3 *(Round 2, new)* | `POST /fuel/records` via gateway → 404 (dead endpoint confirmed removed) |

---

## 4. Remaining Risks

| Risk | Severity | Why it exists | Recommendation |
|---|---|---|---|
| In-memory duplicate guard (`batchSubmitCache` in manual-entry.service.ts) | LOW | Single-instance deployment confirmed by user; Map doesn't survive across replicas or process restarts | If scaling to multiple replicas, replace with Redis TTL 60s. Comment already documents this in the source. |
| Gateway fail-open for GET when auth-service is degraded | ACCEPTED | Deliberate tradeoff — reads (dashboard, station list) stay available during an auth-service hiccup rather than going fully dark; writes are fail-closed | Documented behavior, not a gap. Revisit if audit requirements tighten. |
| Manual-entry (DirectEntry) preview never generates warning rows | LOW/UX | `toParsedRow` in manual-entry.service.ts only ever pushes to `errors`, never `warnings` — feature parity gap with Excel import's `previewImport`, which does run the same-date-different-value check | The `acknowledgeWarnings` enforcement and DirectEntry's warning-ack dialog are correctly wired but currently dormant for this path (verified: FI-17 needed the Excel-import path to exercise a real warning). Not a defect — a safety net waiting for equivalent DirectEntry warning detection, out of this session's scope. |
| Disabled station is not flagged at **preview** time, only at **confirm** (revalidation) | LOW/UX | `isActive` check exists only in manual-entry.service.ts's `confirm()`, not in `toParsedRow`/preview | Confirm-time rejection is the safety-critical guarantee and is verified (FI-03/FI-14); preview just doesn't warn the user early. Minor UX gap, pre-existing, not introduced this session. |
| manual-entry's `confirm()` has its own station-liveness re-check ahead of `confirmImport`, separate from Fix A | LOW | Found while building FI-23 (Round 2): if that pre-check rejects a batch (unknown/inactive station), it throws 422 directly without ever touching the `ImportJob` row — the job is left in `previewing` rather than `failed`, since `confirmImport`'s Fix A logic is never reached via this specific path. Excel import's confirm route has no such wrapper. | Not a "stuck committing" regression (job never leaves `previewing`, so it isn't blocked from ever being retried), so it doesn't reproduce Finding A's failure mode — but it is an inconsistency in job-status bookkeeping across the two confirm entry points. Out of Round 2's approved scope (not one of the 4 audited findings); flag for a future cleanup pass. |
| ZIP/bundle possibly containing `.env`/cert files (user's original Finding 5) | UNRESOLVED | User explicitly deferred this out of Round 2's scope; no zip-creation script was found in the repo during Round 1, so its origin was never confirmed | Still needs user follow-up: locate/confirm the bundle, sanitize or delete it, rotate secrets if it was ever shared or committed anywhere. Not addressed by any code change in this report. |
| Station-service → fuel-service cold-start ordering | LOW | `fuel-service` depends_on `station-service: service_started` (not `service_healthy`); `station-service` has no depends_on `fuel-service` (would create a circular dependency, since fuel-service already depends on station-service) | A station created in the narrow window before fuel-service is ready gets `currentFuelStateInitialized: false` with a warning (not a silent failure) and is caught by the next backfill dry-run. Acceptable for current deployment; would need a proper readiness-gate if this becomes frequent. |
| `.env-test` / other local dev files at repo root | NONE | Not tracked by git before or after this session (verified via `git ls-files`); newly gitignored to prevent future accidental commit | No action needed. |

---

## 5. Production Readiness Conclusion

**READY** — Round 2 closes all 4 findings from the user's independent code audit, including the one self-introduced regression (Fix A), with the remaining risks in Section 4 understood and accepted (all LOW severity, explicitly accepted tradeoffs, or explicitly deferred by the user; none block core business rules).

Gating criteria for this conclusion (per the user's requirement — READY only if **all** of the following passed after Round 2's fixes, otherwise the conclusion must be PARTIAL):

- ✅ FI-23 (job-stuck-committing regression closed, re-confirm-blocked) — pass
- ✅ FI-24 (manual-entry unknown-station-always-red-error) — pass
- ✅ FI-25 (bulk-upsert CurrentFuelState init + `initial_fuel` handling, 5 sub-cases) — pass
- ✅ SEC-3 (`POST /fuel/records` unreachable via gateway) — pass
- ✅ Full E2E suite rerun after all Round 2 fixes — 53/54 pass, 1 documented skip, 0 fail

All 5 conditions are met (Section 3). Round 1's criteria remain valid and were not touched by Round 2:

- ✅ 0 CRITICAL, 0 HIGH open findings
- ✅ Auth / RBAC (frontend + backend) — pass, including the Staff-quick-update-bypass fix
- ✅ Manual-entry / DirectEntry — pass (preview/confirm, negative-value rejection, warning-ack dialog wired, fuel-only enforced universally as of Round 2 Fix C)
- ✅ Import (Excel + manual-entry) — pass: fuel-only for all roles, all-or-nothing, atomic job claim (Round 2: claim condition tightened and race with row-error check closed), same-station-multi-row guard, missing-fuel-state guard (Round 2: closed for the bulk-upsert path too, Fix D)
- ✅ Adjustment (create/approve/reject) — pass (F14.1/F14.4/F14.7)
- ✅ Gateway security — pass: JWT validation, X-User-* header stripping, fail-closed writes on auth-service degradation, spoofed-header test (SEC-1)
- ✅ No-auth sensitive endpoints — pass (SEC-2, 6 endpoints checked)
- ✅ No fake success in UI — pass (disable-station calls the real API; direct-write bypasses removed, including the last live one — `POST /fuel/records` — in Round 2 Fix B)
- ✅ No DirectEntry bypass — pass (FuelEntryModal, StationDetail's quick-update form, and the backend `POST /fuel/records` route are all removed)
- ✅ Fuel Import never touches master data — pass (FI-05)

Everything above was verified with evidence in Section 3, not asserted from memory. The residual items in Section 4 are documented tradeoffs, pre-existing minor gaps, or (for the ZIP/bundle item) explicitly out of scope per the user's own decision — not blockers to this conclusion.
