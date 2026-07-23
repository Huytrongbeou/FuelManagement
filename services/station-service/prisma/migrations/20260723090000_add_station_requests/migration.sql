-- CreateTable
CREATE TABLE "station_requests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "station_code" VARCHAR(50) NOT NULL,
    "station_name" VARCHAR(200) NOT NULL,
    "generator_name" VARCHAR(200),
    "address" TEXT,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "current_admin_unit_name" VARCHAR(100),
    "legacy_area_name" VARCHAR(100),
    "operation_area_name" VARCHAR(100),
    "brand_id" UUID,
    "model_id" UUID,
    "power_kva" DECIMAL(8,2),
    "fuel_type" VARCHAR(50) NOT NULL DEFAULT 'diesel',
    "consumption_rate" DECIMAL(6,3) NOT NULL,
    "max_capacity" DECIMAL(8,2) NOT NULL,
    "initial_fuel" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "requested_by" VARCHAR(100) NOT NULL,
    "requested_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_by" VARCHAR(100),
    "reviewed_at" TIMESTAMPTZ,
    "rejection_reason" TEXT,
    "created_station_id" UUID,

    CONSTRAINT "station_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_station_requests_status" ON "station_requests"("status");

-- Only one open request per station code. Partial unique index rather than a plain unique
-- constraint, so a code can be proposed again after an earlier request was rejected, and so
-- historical approved requests never block a later one.
CREATE UNIQUE INDEX "uq_station_requests_open_code"
    ON "station_requests"("station_code")
    WHERE "status" IN ('pending', 'approving');
