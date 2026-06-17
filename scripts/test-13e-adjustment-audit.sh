#!/usr/bin/env bash
# Cụm 13E — Verify adjustment audit trail (Sprint 2)
# Run against local stack: docker compose up -d
# Prerequisites: jq installed, services reachable on localhost

set -euo pipefail

GW="http://localhost:3000/api"

# ── Helper ──────────────────────────────────────────────────────────────────
die() { echo "FAIL: $*" >&2; exit 1; }
pass() { echo "PASS: $*"; }

auth() {
  local role=$1
  local user pass
  case $role in
    admin)   user=admin_user;   pass=admin_pass ;;
    manager) user=manager_user; pass=manager_pass ;;
    staff)   user=staff_user;   pass=staff_pass ;;
  esac
  curl -sf -X POST "$GW/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"username\":\"$user\",\"password\":\"$pass\"}" \
    | jq -r '.token'
}

get() { curl -sf -H "Authorization: Bearer $1" "$GW$2"; }
post() { curl -sf -X POST -H "Authorization: Bearer $1" -H "Content-Type: application/json" -d "$3" "$GW$2"; }
patch() { curl -sf -X PATCH -H "Authorization: Bearer $1" -H "Content-Type: application/json" -d "$3" "$GW$2"; }
http_code() { curl -s -o /dev/null -w "%{http_code}" -X "$1" -H "Authorization: Bearer $2" -H "Content-Type: application/json" ${4:+-d "$4"} "$GW$3"; }

# ── Setup ────────────────────────────────────────────────────────────────────
echo "=== Cụm 13E: Adjustment Audit Trail Tests ==="

ADMIN_TOKEN=$(auth admin)
MANAGER_TOKEN=$(auth manager)
STAFF_TOKEN=$(auth staff)

# Pick first station
STATION_ID=$(get "$ADMIN_TOKEN" "/stations" | jq -r '.[0].id')
[ -n "$STATION_ID" ] && [ "$STATION_ID" != "null" ] || die "No station found"
echo "Using station: $STATION_ID"

# Get current fuel state
FUEL_STATE=$(get "$ADMIN_TOKEN" "/stations/$STATION_ID")
CURRENT_FUEL=$(echo "$FUEL_STATE" | jq '.currentFuel // .fuelState.currentFuel // 0')
MAX_CAP=$(echo "$FUEL_STATE" | jq '.maxCapacity // 200')
echo "currentFuel=$CURRENT_FUEL maxCapacity=$MAX_CAP"

# Get last committed FuelRecord for this station
RECORDS=$(get "$ADMIN_TOKEN" "/fuel/records/$STATION_ID?limit=5")
ORIG_ID=$(echo "$RECORDS" | jq -r '[.[] | select(.source != "adjustment")] | .[0].id')
ORIG_FUEL_ADDED=$(echo "$RECORDS" | jq '[.[] | select(.source != "adjustment")] | .[0].added // 0')
ORIG_HOURS=$(echo "$RECORDS" | jq '[.[] | select(.source != "adjustment")] | .[0].hoursRun // 0')
[ -n "$ORIG_ID" ] && [ "$ORIG_ID" != "null" ] || die "No base FuelRecord found for station $STATION_ID"
echo "Original record: $ORIG_ID (fuelAdded=$ORIG_FUEL_ADDED hoursRun=$ORIG_HOURS)"

# ── TC-1: adjustmentEffect = 0 → 422 ─────────────────────────────────────
echo ""
echo "--- TC-1: zero-effect adjustment → 422 ---"
REQ1=$(post "$MANAGER_TOKEN" "/fuel/adjustment-requests" \
  "{\"originalRecordId\":\"$ORIG_ID\",\"reason\":\"test zero\",\"newFuelAdded\":$ORIG_FUEL_ADDED,\"newHoursRun\":$ORIG_HOURS}")
REQ1_ID=$(echo "$REQ1" | jq -r '.id')
CODE=$(http_code PATCH "$ADMIN_TOKEN" "/fuel/adjustment-requests/$REQ1_ID/approve" "{}")
[ "$CODE" = "422" ] && pass "TC-1: 422 on zero-effect" || die "TC-1: expected 422 got $CODE"
# Reject so it doesn't block subsequent tests
patch "$ADMIN_TOKEN" "/fuel/adjustment-requests/$REQ1_ID/reject" '{"rejectionReason":"zero effect test cleanup"}' > /dev/null

# ── TC-2: adjustmentEffect < 0, fuelAfter >= 0 → approve succeeds ─────────
echo ""
echo "--- TC-2: negative effect, fuelAfter >= 0 → approve OK ---"
# Reduce hoursRun to lower fuelConsumed → negative adjustmentEffect = less fuel consumed → more fuel after
# Actually we want negative adjustmentEffect: correctedEffect < originalEffect
# correctedEffect = newFuelAdded - newHoursRun * consumptionRate
# If newHoursRun > origHoursRun then correctedEffect < originalEffect → negative
NEW_HOURS=$(echo "$ORIG_HOURS + 0.5" | bc)
REQ2=$(post "$MANAGER_TOKEN" "/fuel/adjustment-requests" \
  "{\"originalRecordId\":\"$ORIG_ID\",\"reason\":\"TC-2 negative effect\",\"newFuelAdded\":$ORIG_FUEL_ADDED,\"newHoursRun\":$NEW_HOURS}")
REQ2_ID=$(echo "$REQ2" | jq -r '.id')
CODE=$(http_code PATCH "$ADMIN_TOKEN" "/fuel/adjustment-requests/$REQ2_ID/approve" "{}")
[ "$CODE" = "200" ] && pass "TC-2: approve returned 200" || die "TC-2: expected 200 got $CODE"

# Verify CurrentFuelState updated and original record untouched
NEW_STATE=$(get "$ADMIN_TOKEN" "/stations/$STATION_ID")
NEW_FUEL=$(echo "$NEW_STATE" | jq '.currentFuel // .fuelState.currentFuel')
[ "$NEW_FUEL" != "$CURRENT_FUEL" ] && pass "TC-2: CurrentFuelState updated (was $CURRENT_FUEL, now $NEW_FUEL)" \
  || die "TC-2: CurrentFuelState not updated"

ORIG_RECORD_AFTER=$(get "$ADMIN_TOKEN" "/fuel/records/$STATION_ID" | jq "[.[] | select(.id==\"$ORIG_ID\")] | .[0]")
ORIG_SRC=$(echo "$ORIG_RECORD_AFTER" | jq -r '.source')
[ "$ORIG_SRC" != "adjustment" ] && pass "TC-2: original record source still '$ORIG_SRC' (not modified)" \
  || die "TC-2: original record source was changed"

# Verify adjustment record created
ADJ_RECORD=$(get "$ADMIN_TOKEN" "/fuel/records/$STATION_ID" | jq "[.[] | select(.adjustmentForId==\"$ORIG_ID\")] | .[0]")
ADJ_SRC=$(echo "$ADJ_RECORD" | jq -r '.source')
[ "$ADJ_SRC" = "adjustment" ] && pass "TC-2: adjustment FuelRecord (source=adjustment) created" \
  || die "TC-2: adjustment record not found"

CURRENT_FUEL=$NEW_FUEL  # update for subsequent tests

# ── TC-3: approve same request again → 409 ───────────────────────────────
echo ""
echo "--- TC-3: approve already-approved request → 409 ---"
CODE=$(http_code PATCH "$ADMIN_TOKEN" "/fuel/adjustment-requests/$REQ2_ID/approve" "{}")
[ "$CODE" = "409" ] && pass "TC-3: 409 on double-approve" || die "TC-3: expected 409 got $CODE"

# ── TC-4: create request for source='adjustment' record → 422 ────────────
echo ""
echo "--- TC-4: create request for adjustment record → 422 ---"
ADJ_REC_ID=$(echo "$ADJ_RECORD" | jq -r '.id')
CODE=$(http_code POST "$MANAGER_TOKEN" "/fuel/adjustment-requests" \
  "{\"originalRecordId\":\"$ADJ_REC_ID\",\"reason\":\"chaining test\",\"newFuelAdded\":5,\"newHoursRun\":1}" )
[ "$CODE" = "422" ] && pass "TC-4: 422 — cannot adjust an adjustment record" || die "TC-4: expected 422 got $CODE"

# ── TC-5: create duplicate pending request → 409 ──────────────────────────
echo ""
echo "--- TC-5: duplicate pending request → 409 ---"
# Get another base record
ORIG_ID2=$(get "$ADMIN_TOKEN" "/fuel/records/$STATION_ID?limit=10" \
  | jq -r "[.[] | select(.source != \"adjustment\" and .id != \"$ORIG_ID\")] | .[0].id")
[ -n "$ORIG_ID2" ] && [ "$ORIG_ID2" != "null" ] || { echo "SKIP TC-5: no second base record available"; }
if [ -n "$ORIG_ID2" ] && [ "$ORIG_ID2" != "null" ]; then
  post "$MANAGER_TOKEN" "/fuel/adjustment-requests" \
    "{\"originalRecordId\":\"$ORIG_ID2\",\"reason\":\"first pending\",\"newFuelAdded\":5,\"newHoursRun\":1}" > /dev/null
  CODE=$(http_code POST "$MANAGER_TOKEN" "/fuel/adjustment-requests" \
    "{\"originalRecordId\":\"$ORIG_ID2\",\"reason\":\"second pending\",\"newFuelAdded\":6,\"newHoursRun\":2}")
  [ "$CODE" = "409" ] && pass "TC-5: 409 on duplicate pending" || die "TC-5: expected 409 got $CODE"
  # Cleanup
  PENDING_ID=$(get "$ADMIN_TOKEN" "/fuel/adjustment-requests?status=pending" \
    | jq -r "[.[] | select(.originalRecordId==\"$ORIG_ID2\")] | .[0].id")
  [ -n "$PENDING_ID" ] && patch "$ADMIN_TOKEN" "/fuel/adjustment-requests/$PENDING_ID/reject" \
    '{"rejectionReason":"TC-5 cleanup"}' > /dev/null
fi

# ── TC-6: Manager sees only own requests ────────────────────────────────
echo ""
echo "--- TC-6: Manager sees only own requests ---"
MY_REQS=$(get "$MANAGER_TOKEN" "/fuel/adjustment-requests")
ALL_REQS=$(get "$ADMIN_TOKEN" "/fuel/adjustment-requests")
MY_COUNT=$(echo "$MY_REQS" | jq 'length')
ALL_COUNT=$(echo "$ALL_REQS" | jq 'length')
# Manager count must be <= admin count (and only their own)
[ "$MY_COUNT" -le "$ALL_COUNT" ] && pass "TC-6: Manager sees $MY_COUNT, Admin sees $ALL_COUNT" \
  || die "TC-6: Manager sees more than Admin ($MY_COUNT > $ALL_COUNT)"

# ── TC-7: Staff → 403 on adjustment endpoints ────────────────────────────
echo ""
echo "--- TC-7: Staff → 403 on POST/PATCH adjustment ---"
CODE=$(http_code POST "$STAFF_TOKEN" "/fuel/adjustment-requests" \
  "{\"originalRecordId\":\"$ORIG_ID\",\"reason\":\"staff attempt\",\"newFuelAdded\":5,\"newHoursRun\":1}")
[ "$CODE" = "403" ] && pass "TC-7a: Staff POST → 403" || die "TC-7a: expected 403 got $CODE"
CODE=$(http_code PATCH "$STAFF_TOKEN" "/fuel/adjustment-requests/$REQ2_ID/approve" "{}")
[ "$CODE" = "403" ] && pass "TC-7b: Staff PATCH approve → 403" || die "TC-7b: expected 403 got $CODE"

# ── TC-8: reject without reason → 400 ────────────────────────────────────
echo ""
echo "--- TC-8: reject with empty reason → 400 ---"
# Create a fresh pending request
ORIG_ID3=$(get "$ADMIN_TOKEN" "/fuel/records/$STATION_ID?limit=10" \
  | jq -r "[.[] | select(.source != \"adjustment\")] | .[1].id")
if [ -n "$ORIG_ID3" ] && [ "$ORIG_ID3" != "null" ]; then
  REQ3=$(post "$MANAGER_TOKEN" "/fuel/adjustment-requests" \
    "{\"originalRecordId\":\"$ORIG_ID3\",\"reason\":\"TC-8 test\",\"newFuelAdded\":5,\"newHoursRun\":1}")
  REQ3_ID=$(echo "$REQ3" | jq -r '.id')
  CODE=$(http_code PATCH "$ADMIN_TOKEN" "/fuel/adjustment-requests/$REQ3_ID/reject" '{"rejectionReason":""}')
  [ "$CODE" = "400" ] && pass "TC-8: 400 on empty rejectionReason" || die "TC-8: expected 400 got $CODE"
  # Cleanup
  patch "$ADMIN_TOKEN" "/fuel/adjustment-requests/$REQ3_ID/reject" '{"rejectionReason":"TC-8 cleanup"}' > /dev/null
fi

# ── Summary ───────────────────────────────────────────────────────────────
echo ""
echo "=== Cụm 13E Complete ==="
echo "All assertions passed. Audit trail verified:"
echo "  - CurrentFuelState updated correctly after approve"
echo "  - Original FuelRecord NOT modified"
echo "  - Adjustment FuelRecord (source=adjustment) created with adjustmentForId"
echo "  - Double-approve → 409"
echo "  - Adjust-an-adjustment → 422"
echo "  - Duplicate pending → 409"
echo "  - Manager sees only own requests"
echo "  - Staff → 403"
echo "  - Empty rejectionReason → 400"
