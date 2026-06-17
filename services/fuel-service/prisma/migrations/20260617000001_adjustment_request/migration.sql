-- Add adjustment fields to fuel_records
ALTER TABLE "fuel_records"
  ADD COLUMN "adjustment_amount" DECIMAL(8,2),
  ADD COLUMN "adjustment_for_id" UUID REFERENCES fuel_records(id);

-- Create adjustment_requests table
CREATE TABLE "adjustment_requests" (
  "id"                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "original_record_id" UUID NOT NULL,
  "station_id"        UUID NOT NULL,
  "reason"            TEXT NOT NULL,
  "new_fuel_added"    DECIMAL(8,2) NOT NULL,
  "new_hours_run"     DECIMAL(8,2) NOT NULL,
  "new_notes"         TEXT,
  "requested_by_id"   VARCHAR(100) NOT NULL,
  "requested_by_name" VARCHAR(100) NOT NULL,
  "status"            VARCHAR(20) NOT NULL DEFAULT 'pending',
  "rejection_reason"  TEXT,
  "approved_by_id"    VARCHAR(100),
  "approved_by_name"  VARCHAR(100),
  "approved_at"       TIMESTAMPTZ,
  "created_at"        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Partial unique indexes to prevent duplicate pending/approved per original record
CREATE UNIQUE INDEX "uniq_adjustment_pending"
  ON "adjustment_requests"("original_record_id")
  WHERE status = 'pending';

CREATE UNIQUE INDEX "uniq_adjustment_approved"
  ON "adjustment_requests"("original_record_id")
  WHERE status = 'approved';
