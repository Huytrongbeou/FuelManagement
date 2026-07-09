# Production Readiness Report — VNPT Fuel Management System (Cao Lãnh)

**Date:** 2026-07-07 (Round 1) / 2026-07-07 (Round 2) / 2026-07-09 (Round 3)
**Branch:** `refactor/layered-mvc-services`
**Scope:** Full production-readiness fix pass (P0 blockers, P0.9 import-correctness hardening, P1 hardening, P2 E2E stabilization, P3 regression pack), plus **Round 2** (4 issues from the user's first independent audit) and **Round 3** (8 issues from the user's second independent audit, including 2 refinements the user required before Round 3 implementation began).

---

## 0b. Round 3 — Second Post-Audit Fix Pass

After Round 2 concluded READY, the user reviewed Round 2's actual code again (not just the report) and found 6 more real issues, then required 8 specific refinements to the fix plan before implementation. All were verified against live code this round — none were false positives:

| # | Severity | Location | Issue | Fix |
|---|---|---|---|---|
| 1 | Real gap | `services/gateway/src/app.ts` | `POST /api/fuel/current/init` was reachable through the gateway's `/api/fuel*` wildcard proxy — unlike `POST /api/fuel/import-commit`, which was already explicitly blocked. | Added the same explicit 403 block for `/api/fuel/current/init`. Verified no legitimate caller goes through the gateway for this route (station-service and the backfill script both call fuel-service directly over the internal Docker network). **Documented remaining risk, not fixed this round:** fuel-service itself still has no service-to-service secret on this route — in production this is moot (base `docker-compose.yml` publishes no host port for fuel-service at all), but `docker-compose.dev.yml` does expose it for local debugging (a pre-existing, self-documented tradeoff). See Section 4. |
| 2 | Real bug (contradicted the just-established rule) | `services/fuel-service/src/services/adjustment-request.service.ts` `approveRequest` | If `CurrentFuelState` was missing, approve silently defaulted `fuelBefore=0` and auto-created the state — the exact anti-pattern Round 1/2 eliminated everywhere else. | Approve now throws 422 if `CurrentFuelState` is missing, inside the transaction (so the earlier claim rolls back too — request stays `pending`, nothing is created). |
| 3 | Real gap | `services/station-service/src/services/station-bulk-upsert.service.ts` (Round 2's Fix D) | Omitted `initial_fuel` for a new station silently defaulted to 0 with no warning — contradicted Round 2's "never silently defaulted" claim. | `initial_fuel` is now **required** for new-station rows in bulk-upsert (row error if omitted), matching the existing required-field pattern for `consumption_rate`/`max_capacity` in the same function. No more silent or warned default — omitting it is a hard validation error. |
| 4 | Real bug | `services/import-export-service/src/services/import-orchestrator.service.ts` `confirmImport` | Only `status===409` from fuel-service's commit was distinguished; every other error (including deterministic 400/422 validation failures) was mapped to `retryable:true` and a generic 500. | New `extractHttpError()` helper reads `err.response.status/data.error` (with fallbacks). 400/422 → `retryable:false`, fuel-service's real message surfaced, correct status code returned. `retryable:true`/500 reserved for genuinely transient failures. |
| 5 | Real bug (job bookkeeping) | `services/import-export-service/src/services/manual-entry.service.ts` `confirm()` | Its own station-liveness/fuel-math re-check (separate from `confirmImport`) threw directly on rejection without ever touching the `ImportJob` row — left stuck in `previewing` instead of `failed`. | New `failJobValidation(jobId, message)` helper, used at the 3 genuine data-validity throw sites (unknown station, inactive station, fuel-validate failure) — explicitly NOT used for the 60-second duplicate-resubmit throttle, which is a rate-limit, not a data-validity verdict (marking that failed/retryable:false would break legitimate retries after the window). |
| 6 | Process gap | `PRODUCTION-READINESS-REPORT.md` | Evidence only existed outside the repo; regression-pack table didn't explain the FI-01/06/07/08/15/18/19/20 ID gaps. | Evidence file now copied into this repo (`evidence/`); traceability appendix added (Section 3) explicitly addressing the ID gaps. |
| 7 | Security evidence (user-added) | Whole repo | Concern that a raw file bundle/zip might contain `.env`/`.env-test`/`apps/web/.env`/private keys. | **Verified, not just asserted:** `git log --all` full-history scan confirms these files were **never** committed, ever (not just currently gitignored). `.gitignore` covers all of them (`git check-ignore -v` confirmed). No zip/bundle-creation script exists anywhere in the repo. **User confirmed no raw bundle of this project was ever created or shared outside this machine.** Conclusion: verified clean, no rotation performed, no action needed. See Section 4 for the exact evidence commands and results. |
| 8 | Incidental hardening (found while building the Fix 4 regression test) | `services/station-service/src/services/station.service.ts` `update()` | `PUT /stations/:id` allowed lowering `maxCapacity` below the station's current fuel level with no guard — found while designing a repro for Fix 4, fixed outright rather than exploited-and-left. | `update()` now fetches the current fuel level (new `fuelClient.getCurrentState`) and rejects (422) a `maxCapacity` decrease below it. |

New regression tests (all passing, Section 3): **SEC-INTERNAL-INIT-1** (Fix 1), **ADJ-1** (Fix 2, uses a disposable station, deactivated after the test), **FI-25 updated** (Fix 3 — omitted `initial_fuel` now a row error, plus a new explicit-zero case), **FI-26** (Fix 4, via a `consumptionRate` race — not `maxCapacity`, since Fix 8 closes that specific gap), **FI-27** (Fix 5), **STATION-1** (Fix 8).

**A 9th issue was found (not in the original 8) while building FI-26's regression test**, and is documented — not fixed — in Section 4: `checkExactDuplicates`'s same-date check doesn't exclude a station's own `source:'initial_state'` genesis record, so importing fuel activity on the same day a station was created with `initialFuel>0` trips a spurious "same date, different values" warning. Low-severity (a warning requiring `acknowledgeWarnings`, not a silent bypass), out of this round's approved scope.

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
- `services/gateway/src/app.ts` (Round 3: Fix 1 — block `POST /api/fuel/current/init`)
- `services/fuel-service/src/services/adjustment-request.service.ts` (Round 3: Fix 2 — approve rejects missing CurrentFuelState)
- `services/station-service/src/clients/fuel.client.ts` (Round 3: Fix 8 — added `getCurrentState`)
- `services/station-service/src/services/station.service.ts` (Round 3: Fix 8 — `update()` rejects `maxCapacity` below current fuel)
- `services/station-service/src/controllers/station.controller.ts` (Round 3: Fix 8 — forward `userCtx` to `update()`)
- `services/station-service/src/services/station-bulk-upsert.service.ts` (Round 3: Fix 3 — `initial_fuel` required for new stations)
- `services/import-export-service/src/services/import-orchestrator.service.ts` (Round 3: Fix 4 — `extractHttpError` helper, deterministic vs transient fuel-commit error mapping)
- `services/import-export-service/src/services/manual-entry.service.ts` (Round 3: Fix 5 — `failJobValidation` helper)

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
- `.gitignore` (Round 3: added `docker-compose.local-override.yml`, a local-machine-only, gitignored port-conflict workaround — see note at the end of Section 3)

**Evidence (new, Round 3):**
- `evidence/frontend-e2e-result-20260709111539.txt` — final Round 3 full-suite run, copied into the repo so it travels with this report instead of only existing at the external test-runner path.

**Tests (outside main repo, `D:\fuel-frontend-test-runner`, not version-controlled):**
- `tests/F01-F03.spec.ts` through `tests/F15-F20.spec.ts` (selector/RBAC fixes)
- `tests/F13-F14.spec.ts` (station-detail navigation helper)
- `tests/FI-import-regression.spec.ts` (Round 2: +13 tests; Round 3: +6 tests — SEC-INTERNAL-INIT-1, ADJ-1, STATION-1, FI-26, FI-27, plus FI-25 updated — 22 tests total in this file)
- `global-setup.ts`

Full commit list: `54c4e20..720701e` (18 commits, Round 1) + 5 commits (Round 2) + Round 3 commits on `refactor/layered-mvc-services` (see `git log`).

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
| FI-25 *(Round 3: updated)* | bulk-upsert **requires** `initial_fuel` for new stations (row error if omitted, no more silent default); explicit `initial_fuel:0`, custom value, negative/over-capacity rejected, existing-station `initial_fuel` warns without touching fuel state |
| FI-26 *(Round 3, new)* | Deterministic fuel-commit validation error (via a `consumptionRate` race between preview and confirm) → `retryable:false`, real status code (400/422), not a generic 500 |
| FI-27 *(Round 3, new)* | manual-entry `confirm()`'s own station-liveness rejection now marks the job `failed`/`validation`/`retryable:false` instead of leaving it `previewing` |
| SEC-1 | Spoofed `X-User-Role` header does not escalate privilege (gateway strips it) |
| SEC-2 | No-auth GET/POST on 6 sensitive endpoints → all 401 |
| SEC-3 *(Round 2, new)* | `POST /fuel/records` via gateway → 404 (dead endpoint confirmed removed) |
| SEC-INTERNAL-INIT-1 *(Round 3, new)* | `POST /fuel/current/init` via gateway → 403 (internal-only endpoint blocked) |
| STATION-1 *(Round 3, new)* | `PUT /stations/:id` lowering `maxCapacity` below current fuel level → 422, `maxCapacity` unchanged |
| ADJ-1 *(Round 3, new)* | Adjustment approve with missing `CurrentFuelState` → 422, request stays `pending`, no `FuelRecord`/`CurrentFuelState` created |

**Round 3 final result: 58 passed, 1 skipped, 0 failed** (59 tests total: 37 original F01–F20 + 22 FI/SEC/STATION/ADJ regression tests, after adding SEC-INTERNAL-INIT-1/ADJ-1/STATION-1/FI-26/FI-27 and updating FI-25).
Report: `evidence/frontend-e2e-result-20260709111539.txt` (copied into this repo — see Section 2).

Progression (updated): 9 pass/24 fail/4 skip (original baseline) → 36/37 (Phase 1) → 49/50 (Round 1) → 53/54 (Round 2) → **58/59 (Round 3)**.

### Test ID traceability (Round 3, per user requirement)

Every `FI-`/`SEC-`/`STATION-`/`ADJ-` test that exists in `D:\fuel-frontend-test-runner\tests\FI-import-regression.spec.ts`, with its exact source location and the Round 3 evidence run's result:

| ID | File:line | Result |
|---|---|---|
| FI-02 | FI-import-regression.spec.ts:99 | PASS |
| FI-03 / FI-14 | FI-import-regression.spec.ts:115 | PASS |
| FI-04 / FI-21 | FI-import-regression.spec.ts:147 | PASS |
| FI-05 | FI-import-regression.spec.ts:175 | PASS |
| FI-09 | FI-import-regression.spec.ts:214 | PASS |
| FI-10 / FI-11 | FI-import-regression.spec.ts:233 | PASS |
| FI-12 | FI-import-regression.spec.ts:259 | PASS |
| FI-13 | FI-import-regression.spec.ts:288 | PASS |
| FI-16 | FI-import-regression.spec.ts:320 | PASS |
| FI-17 | FI-import-regression.spec.ts:338 | PASS |
| FI-22 | FI-import-regression.spec.ts:385 | PASS |
| FI-23 | FI-import-regression.spec.ts:398 | PASS |
| FI-24 | FI-import-regression.spec.ts:464 | PASS |
| FI-25 | FI-import-regression.spec.ts:485 | PASS |
| FI-26 | FI-import-regression.spec.ts:575 | PASS |
| FI-27 | FI-import-regression.spec.ts:619 | PASS |
| STATION-1 | FI-import-regression.spec.ts:653 | PASS |
| ADJ-1 | FI-import-regression.spec.ts:676 | PASS |
| SEC-1 | FI-import-regression.spec.ts:733 | PASS |
| SEC-2 | FI-import-regression.spec.ts:742 | PASS |
| SEC-3 | FI-import-regression.spec.ts:757 | PASS |
| SEC-INTERNAL-INIT-1 | FI-import-regression.spec.ts:766 | PASS |

**Honest gap disclosure:** `FI-01, FI-06, FI-07, FI-08, FI-15, FI-18, FI-19, FI-20` do not exist as tests in this file or anywhere else in either repo. A repo-wide grep (`grep -rn "FI-01\|FI-06\|FI-07\|FI-08\|FI-15\|FI-18\|FI-19\|FI-20"`) found zero references — no document defining what these IDs were meant to cover exists in this codebase. They are not silently-skipped or hidden tests; they simply were never written, and their original intended scope (if any) is not recoverable from this repo. Separately, the UI suite's own module list (F01–F20) shows `F19 Realtime` and `F20 Consistency` as "NOT RUN" in the evidence file — no tests exist for those modules either. If these represent specific requirements, they need to be defined and added as new tests in a future round.

### Note on this test environment (not part of the reviewable diff)

This machine had an unrelated project ("gymcoach") occupying the entire `3000-3005` host port range that `docker-compose.dev.yml` also uses, plus port `5173`. To run the suite at all in this session, three **local, uncommitted, gitignored** adjustments were made — none affect the actual application code or the production `docker-compose.yml`:
- `docker-compose.local-override.yml` (new, gitignored): drops the host port publish for auth/station/fuel/import-export-service (internal-only — reached over the Docker network regardless) and remaps gateway (3000→3010) and realtime-service (3005→3015), which the frontend does reach directly from the host.
- `apps/web/.env` and the root `.env`'s `CORS_ORIGIN`: updated to match the remapped ports/frontend port for this machine only (both already gitignored, confirmed via `git check-ignore -v` — see Fix 7 evidence above).
These are specific to this sandbox's port conflict and are not expected to be needed on a clean machine or in actual production (`docker-compose.yml` alone, unaffected by any of this).

---

## 4. Remaining Risks

| Risk | Severity | Why it exists | Recommendation |
|---|---|---|---|
| In-memory duplicate guard (`batchSubmitCache` in manual-entry.service.ts) | LOW | Single-instance deployment confirmed by user; Map doesn't survive across replicas or process restarts | If scaling to multiple replicas, replace with Redis TTL 60s. Comment already documents this in the source. |
| Gateway fail-open for GET when auth-service is degraded | ACCEPTED | Deliberate tradeoff — reads (dashboard, station list) stay available during an auth-service hiccup rather than going fully dark; writes are fail-closed | Documented behavior, not a gap. Revisit if audit requirements tighten. |
| Manual-entry (DirectEntry) preview never generates warning rows | LOW/UX | `toParsedRow` in manual-entry.service.ts only ever pushes to `errors`, never `warnings` — feature parity gap with Excel import's `previewImport`, which does run the same-date-different-value check | The `acknowledgeWarnings` enforcement and DirectEntry's warning-ack dialog are correctly wired but currently dormant for this path (verified: FI-17 needed the Excel-import path to exercise a real warning). Not a defect — a safety net waiting for equivalent DirectEntry warning detection, out of this session's scope. |
| Disabled station is not flagged at **preview** time, only at **confirm** (revalidation) | LOW/UX | `isActive` check exists only in manual-entry.service.ts's `confirm()`, not in `toParsedRow`/preview | Confirm-time rejection is the safety-critical guarantee and is verified (FI-03/FI-14); preview just doesn't warn the user early. Minor UX gap, pre-existing, not introduced this session. |
| Station-service → fuel-service cold-start ordering | LOW | `fuel-service` depends_on `station-service: service_started` (not `service_healthy`); `station-service` has no depends_on `fuel-service` (would create a circular dependency, since fuel-service already depends on station-service) | A station created in the narrow window before fuel-service is ready gets `currentFuelStateInitialized: false` with a warning (not a silent failure) and is caught by the next backfill dry-run. Acceptable for current deployment; would need a proper readiness-gate if this becomes frequent. |
| `.env-test` / other local dev files at repo root | NONE | Not tracked by git before or after this session (verified via `git ls-files`); newly gitignored to prevent future accidental commit | No action needed. |
| **(Round 3)** `fuel-service` has no service-to-service secret on `/fuel/current/init` | LOW | Gateway blocks the route (Fix 1), but fuel-service itself trusts any caller with `requireRole('admin')`. Production `docker-compose.yml` publishes no host port for fuel-service at all (verified — no `ports:` entry), so this is unreachable from outside the Docker network in production. `docker-compose.dev.yml` does expose it (self-documented dev-only, pre-existing) for local debugging. | If defense-in-depth is wanted, add a shared-secret header checked by fuel-service, threaded through every internal caller — a larger, infrastructure-wide change out of this round's scope. Not implemented; documented per the user's own explicit fallback for this item. |
| **(Round 3)** `checkExactDuplicates`' same-date check doesn't exclude `source:'initial_state'` genesis records | LOW | Found while building FI-26: a station's own genesis `FuelRecord` (created at init, dated "today") counts as a "same date" record for `hasSameDateDifferentValues`, so importing fuel activity on the same calendar day a station was created (with `initialFuel>0`) trips a spurious warning, requiring `acknowledgeWarnings`. Not a silent bypass — just an unnecessary warning. | Add `AND source != 'initial_state'` alongside the existing `AND source != 'adjustment'` filter in `checkExactDuplicates`'s same-date query (`fuel-record.repository.ts`). Not fixed this round — found incidentally while building an unrelated regression test, outside the 8 approved Round 3 items. |
| **(Round 3)** ZIP/bundle possibly containing `.env`/cert files (user's original audit Finding 5) | **RESOLVED — verified clean** | `git log --all` full-history scan (not just current tree) confirms `.env`/`.env-test`/`apps/web/.env`/`*.key` were never committed, ever. `.gitignore` covers all of them (`git check-ignore -v` confirmed). No zip/bundle-creation script exists anywhere in either repo. `POSTGRES_PASSWORD` is just the well-known default already in the tracked `docker-compose.yml` (not actually secret); `AUTH_JWT_SECRET`/`NVAPI_KEY`/the nginx `server.key` are real but were never in git and, per the user's explicit confirmation this round, were never bundled/shared outside this machine. | No rotation performed — none needed per the evidence above. If this determination is ever found to be wrong (e.g. a bundle surfaces later), rotate `AUTH_JWT_SECRET`, `NVAPI_KEY`, and the nginx cert/key immediately. |

---

## 5. Production Readiness Conclusion

**READY** — Round 3 closes all 8 approved findings from the user's second independent audit (plus incidentally discovering and fixing a 9th, Fix 8's `maxCapacity` guard), with the remaining risks in Section 4 understood and accepted (all LOW severity, explicitly accepted tradeoffs, or — for the ZIP/bundle item — positively verified clean this round, not merely deferred).

Gating criteria for this conclusion (per the user's requirement — READY only if **all** of the following passed after Round 3's fixes, otherwise the conclusion must be PARTIAL):

- ✅ SEC-INTERNAL-INIT-1 (`/fuel/current/init` blocked at gateway) — pass
- ✅ ADJ-1 (adjustment approve rejects missing CurrentFuelState) — pass
- ✅ FI-25 updated (bulk-upsert requires `initial_fuel` for new stations) — pass
- ✅ FI-26 (deterministic fuel-commit errors mapped to `retryable:false`) — pass
- ✅ FI-27 (manual-entry confirm bookkeeping on rejection) — pass
- ✅ Full E2E suite rerun after all Round 3 fixes — 58/59 pass, 1 documented skip, 0 fail
- ✅ Evidence file copied into the repo (`evidence/`) — done
- ✅ Sanitized-bundle evidence: no `.env`/private key ever committed, no bundle ever created/shared — verified this round
- ✅ Report traceability: every FI-/SEC-/STATION-/ADJ- test ID mapped to file:line and result, ID gaps explicitly disclosed

All 9 conditions are met (Section 3). Round 1 and Round 2's criteria remain valid and were not weakened by Round 3:

- ✅ 0 CRITICAL, 0 HIGH open findings
- ✅ Auth / RBAC (frontend + backend) — pass, including the Staff-quick-update-bypass fix
- ✅ Manual-entry / DirectEntry — pass (preview/confirm, negative-value rejection, warning-ack dialog wired, fuel-only enforced universally as of Round 2 Fix C, confirm-rejection bookkeeping fixed in Round 3 Fix 5)
- ✅ Import (Excel + manual-entry) — pass: fuel-only for all roles, all-or-nothing, atomic job claim (race with row-error check closed in Round 2, deterministic-vs-transient error mapping fixed in Round 3 Fix 4), same-station-multi-row guard, missing-fuel-state guard (closed for bulk-upsert in Round 2 Fix D, `initial_fuel` now required rather than defaulted in Round 3 Fix 3)
- ✅ Adjustment (create/approve/reject) — pass (F14.1/F14.4/F14.7 UI, ADJ-1 API-level missing-state guard added Round 3)
- ✅ Gateway security — pass: JWT validation, X-User-* header stripping, fail-closed writes on auth-service degradation, spoofed-header test (SEC-1), internal-only `/fuel/current/init` now blocked (Round 3 Fix 1)
- ✅ No-auth sensitive endpoints — pass (SEC-2, 6 endpoints checked)
- ✅ No fake success in UI — pass (disable-station calls the real API; direct-write bypasses removed, including the last live one — `POST /fuel/records` — in Round 2 Fix B)
- ✅ No DirectEntry bypass — pass (FuelEntryModal, StationDetail's quick-update form, and the backend `POST /fuel/records` route are all removed)
- ✅ Fuel Import never touches master data — pass (FI-05)
- ✅ CurrentFuelState is never silently auto-created by any write path — pass (Round 3 closes the last two gaps: adjustment approve, Fix 2; bulk-upsert's silent-default, Fix 3)

Everything above was verified with evidence in Section 3, not asserted from memory. The residual items in Section 4 are documented tradeoffs, pre-existing minor gaps, or a deliberately out-of-scope defense-in-depth item (service-to-service secret) — not blockers to this conclusion.
