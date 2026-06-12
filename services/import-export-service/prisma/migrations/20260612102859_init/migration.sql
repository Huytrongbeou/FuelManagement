-- CreateTable
CREATE TABLE "import_jobs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "idempotency_key" VARCHAR(255) NOT NULL,
    "filename" VARCHAR(255) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "retryable" BOOLEAN NOT NULL DEFAULT false,
    "failure_stage" VARCHAR(50),
    "total_rows" INTEGER,
    "valid_rows" INTEGER,
    "invalid_rows" INTEGER,
    "warning_rows" INTEGER,
    "preview_data" JSONB,
    "validation_errors" JSONB,
    "backup_stations" JSONB,
    "backup_generator_types" JSONB,
    "backup_fuel_states" JSONB,
    "fuel_state_versions_at_preview" JSONB,
    "station_upsert_results" JSONB,
    "commit_result" JSONB,
    "committed_at" TIMESTAMPTZ,
    "committed_by" VARCHAR(100),
    "error_message" TEXT,
    "source" VARCHAR(20) NOT NULL DEFAULT 'excel',
    "created_by" VARCHAR(100),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "import_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "import_jobs_idempotency_key_key" ON "import_jobs"("idempotency_key");
