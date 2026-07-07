# Production Readiness Report — VNPT Fuel Management System (Cao Lãnh)

**Date:** 2026-07-07
**Branch:** `refactor/layered-mvc-services`
**Scope:** Full production-readiness fix pass (P0 blockers, P0.9 import-correctness hardening, P1 hardening, P2 E2E stabilization, P3 regression pack)

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
- `services/import-export-service/src/services/import-orchestrator.service.ts`
- `services/import-export-service/src/services/manual-entry.service.ts`
- `services/import-export-service/src/services/excel-validator.service.ts`
- `services/import-export-service/src/controllers/import.controller.ts`
- `services/import-export-service/src/controllers/manual-entry.controller.ts`
- `services/import-export-service/src/routes/import.routes.ts`
- `services/import-export-service/src/clients/station.client.ts`
- `services/fuel-service/src/services/import-commit.service.ts`
- `services/fuel-service/src/services/current-state-init.service.ts` (new)
- `services/fuel-service/src/controllers/fuel-record.controller.ts`
- `services/fuel-service/src/routes/fuel-record.routes.ts`
- `services/fuel-service/scripts/backfill-current-fuel-state.ts` (new)
- `services/fuel-service/package.json`
- `services/station-service/src/services/station.service.ts`
- `services/station-service/src/services/generator-model.service.ts`
- `services/station-service/src/controllers/station.controller.ts`
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
**Final result: 49 passed, 1 skipped, 0 failed** (50 tests total: 37 original F01–F20 + 13 new FI/SEC regression tests).
Report: `D:\fuel-frontend-test-runner\reports\frontend-e2e-result-20260707110615.txt`

The single skip (F08.3, station-list status filter) has a documented reason: no status-filter UI element found on the page — not a setup failure.

Progression during this session: 9 pass/24 fail/4 skip (original baseline) → 36/37 (Phase 1, prior E2E-only pass) → 49/50 (this pass, after all P0/P1 backend+frontend fixes plus the new regression file).

New regression pack detail (`FI-import-regression.spec.ts`):
| Test | Verifies |
|---|---|
| FI-02 | Unknown stationCode → red error, no station created |
| FI-03 / FI-14 | Station disabled between preview and confirm → confirm rejects (422) |
| FI-04 / FI-21 | 1 valid + 1 unknown station in one batch → confirm 422, station fuel level unchanged |
| FI-05 | Admin import with mismatched stationName/consumptionRate/maxCapacity → warning only, DB master data unchanged |
| FI-09 | Negative fuelAdded/hoursRun → row error, not silently treated as no-activity |
| FI-10/11 | fuelAfter < 0 or > maxCapacity → red error |
| FI-12 | Station created via bulk-upsert (bypasses fuel-init) → missing CurrentFuelState is a red error at preview |
| FI-13 | Confirming the same job twice → idempotent (`already_committed`), no double-commit |
| FI-16 | Same station, two fuel-activity rows in one batch → red error on both |
| FI-17 | Warning row confirm without `acknowledgeWarnings` → 422; with it → success |
| FI-22 | Batch of only no-activity rows → confirm 422, no commit |
| SEC-1 | Spoofed `X-User-Role` header does not escalate privilege (gateway strips it) |
| SEC-2 | No-auth GET/POST on 6 sensitive endpoints → all 401 |

---

## 4. Remaining Risks

| Risk | Severity | Why it exists | Recommendation |
|---|---|---|---|
| In-memory duplicate guard (`batchSubmitCache` in manual-entry.service.ts) | LOW | Single-instance deployment confirmed by user; Map doesn't survive across replicas or process restarts | If scaling to multiple replicas, replace with Redis TTL 60s. Comment already documents this in the source. |
| Gateway fail-open for GET when auth-service is degraded | ACCEPTED | Deliberate tradeoff — reads (dashboard, station list) stay available during an auth-service hiccup rather than going fully dark; writes are fail-closed | Documented behavior, not a gap. Revisit if audit requirements tighten. |
| `POST /fuel/records` (direct manual-record creation) has no frontend caller anymore | LOW | Endpoint is still role-guarded (admin/manager) and has its own validation/transaction — just orphaned from the UI after removing the two bypasses | Candidate for deprecation in a future cleanup; not touched this session per surgical-change scope. |
| Manual-entry (DirectEntry) preview never generates warning rows | LOW/UX | `toParsedRow` in manual-entry.service.ts only ever pushes to `errors`, never `warnings` — feature parity gap with Excel import's `previewImport`, which does run the same-date-different-value check | The `acknowledgeWarnings` enforcement and DirectEntry's warning-ack dialog are correctly wired but currently dormant for this path (verified: FI-17 needed the Excel-import path to exercise a real warning). Not a defect — a safety net waiting for equivalent DirectEntry warning detection, out of this session's scope. |
| Disabled station is not flagged at **preview** time, only at **confirm** (revalidation) | LOW/UX | `isActive` check exists only in manual-entry.service.ts's `confirm()`, not in `toParsedRow`/preview | Confirm-time rejection is the safety-critical guarantee and is verified (FI-03/FI-14); preview just doesn't warn the user early. Minor UX gap, pre-existing, not introduced this session. |
| `station-bulk-upsert.service.ts` (station-service, admin-only) does not call fuel-init | LOW | Endpoint is reserved for a future Station Master Import module and currently has no live caller (import-export-service's `bulkUpsert` client was removed as dead code this session) | If this endpoint is wired to a real caller later, it must also call `fuelClient.initCurrentState` or route affected stations through the backfill script. |
| Station-service → fuel-service cold-start ordering | LOW | `fuel-service` depends_on `station-service: service_started` (not `service_healthy`); `station-service` has no depends_on `fuel-service` (would create a circular dependency, since fuel-service already depends on station-service) | A station created in the narrow window before fuel-service is ready gets `currentFuelStateInitialized: false` with a warning (not a silent failure) and is caught by the next backfill dry-run. Acceptable for current deployment; would need a proper readiness-gate if this becomes frequent. |
| `.env-test` / other local dev files at repo root | NONE | Not tracked by git before or after this session (verified via `git ls-files`); newly gitignored to prevent future accidental commit | No action needed. |

---

## 5. Production Readiness Conclusion

**READY** — with the remaining risks above understood and accepted (all LOW severity or explicitly accepted tradeoffs; none block core business rules).

Rationale, checked against the required criteria:

- ✅ 0 CRITICAL, 0 HIGH open findings
- ✅ Auth / RBAC (frontend + backend) — pass, including the Staff-quick-update-bypass fix (previously the most severe finding this session)
- ✅ Manual-entry / DirectEntry — pass (preview/confirm, negative-value rejection, warning-ack dialog wired)
- ✅ Import (Excel + manual-entry) — pass: fuel-only for all roles, all-or-nothing, atomic job claim, same-station-multi-row guard, missing-fuel-state guard
- ✅ Adjustment (create/approve/reject) — pass (F14.1/F14.4/F14.7)
- ✅ Gateway security — pass: JWT validation, X-User-* header stripping, fail-closed writes on auth-service degradation, spoofed-header test (SEC-1)
- ✅ No-auth sensitive endpoints — pass (SEC-2, 6 endpoints checked)
- ✅ No fake success in UI — pass (disable-station now calls the real API; the two direct-write bypasses are removed)
- ✅ No DirectEntry bypass — pass (both FuelEntryModal and StationDetail's quick-update form removed)
- ✅ Fuel Import never touches master data — pass (FI-05)
- ✅ E2E core flows — 49/50 pass, 1 skip with documented non-blocking reason, 0 fail

Everything above was verified with evidence in Section 3, not asserted from memory. The 7 residual items in Section 4 are documented tradeoffs or pre-existing minor gaps, not blockers.
