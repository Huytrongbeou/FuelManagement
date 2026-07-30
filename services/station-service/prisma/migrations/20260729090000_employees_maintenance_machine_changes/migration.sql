-- CreateTable: field employees (managing staff), not login accounts
CREATE TABLE "employees" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(150) NOT NULL,
    "phone" VARCHAR(30),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "idx_employees_active" ON "employees"("is_active");

-- CreateTable: maintenance events per station
CREATE TABLE "maintenance_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "station_id" UUID NOT NULL,
    "station_code" VARCHAR(50) NOT NULL,
    "performed_at" DATE NOT NULL,
    "note" TEXT,
    "recorded_by" VARCHAR(100),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "maintenance_logs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "idx_maintenance_station" ON "maintenance_logs"("station_id");

-- CreateTable: audit of generator brand/model changes
CREATE TABLE "station_machine_changes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "station_id" UUID NOT NULL,
    "station_code" VARCHAR(50) NOT NULL,
    "old_brand_name" VARCHAR(200),
    "old_model_name" VARCHAR(200),
    "new_brand_name" VARCHAR(200),
    "new_model_name" VARCHAR(200),
    "changed_by" VARCHAR(100),
    "changed_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "station_machine_changes_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "idx_machine_change_station" ON "station_machine_changes"("station_id");

-- AlterTable: assign a managing employee to a station and to a proposal
ALTER TABLE "stations" ADD COLUMN "managed_by_employee_id" UUID;
ALTER TABLE "stations" ADD CONSTRAINT "stations_managed_by_employee_id_fkey"
    FOREIGN KEY ("managed_by_employee_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "station_requests" ADD COLUMN "managed_by_employee_id" UUID;
