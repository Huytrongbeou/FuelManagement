-- CreateTable
CREATE TABLE "fuel_import_commits" (
    "import_job_id" UUID NOT NULL,
    "idempotency_key" VARCHAR(255) NOT NULL,
    "status" VARCHAR(20) NOT NULL,
    "committed_at" TIMESTAMPTZ,
    "rows_committed" INTEGER,
    "error_message" TEXT,
    "result" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fuel_import_commits_pkey" PRIMARY KEY ("import_job_id")
);

-- CreateTable
CREATE TABLE "fuel_records" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "station_id" UUID NOT NULL,
    "station_code" VARCHAR(50) NOT NULL,
    "recorded_date" DATE NOT NULL,
    "fuel_before" DECIMAL(8,2) NOT NULL,
    "fuel_added" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "hours_run" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "consumption_rate" DECIMAL(6,3) NOT NULL,
    "max_capacity" DECIMAL(8,2) NOT NULL,
    "fuel_consumed" DECIMAL(8,2) NOT NULL,
    "fuel_calculated" DECIMAL(8,2) NOT NULL,
    "actual_fuel" DECIMAL(8,2),
    "fuel_after" DECIMAL(8,2) NOT NULL,
    "fuel_difference" DECIMAL(8,2),
    "fuel_status" VARCHAR(10) NOT NULL,
    "notes" TEXT,
    "recorded_by" VARCHAR(100),
    "source" VARCHAR(20) NOT NULL DEFAULT 'manual',
    "import_job_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fuel_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "current_fuel_state" (
    "station_id" UUID NOT NULL,
    "station_code" VARCHAR(50) NOT NULL,
    "current_fuel" DECIMAL(8,2) NOT NULL,
    "fuel_status" VARCHAR(10) NOT NULL,
    "last_updated" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_record_id" UUID NOT NULL,
    "snapshot_version" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "current_fuel_state_pkey" PRIMARY KEY ("station_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "fuel_import_commits_idempotency_key_key" ON "fuel_import_commits"("idempotency_key");

-- CreateIndex
CREATE INDEX "idx_fuel_station" ON "fuel_records"("station_id");

-- CreateIndex
CREATE INDEX "idx_fuel_station_date" ON "fuel_records"("station_id", "recorded_date" DESC);
