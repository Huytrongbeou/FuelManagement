-- CreateTable
CREATE TABLE "generator_brands" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(100) NOT NULL,
    "normalized_name" VARCHAR(100) NOT NULL,
    "country" VARCHAR(100),
    "note" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "generator_brands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "generator_models" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "brand_id" UUID NOT NULL,
    "model_name" VARCHAR(100) NOT NULL,
    "normalized_model_name" VARCHAR(100) NOT NULL,
    "power_kva" DECIMAL(8,2),
    "fuel_type" VARCHAR(50) NOT NULL DEFAULT 'diesel',
    "suggested_consumption_rate" DECIMAL(6,3),
    "suggested_max_capacity" DECIMAL(8,2),
    "note" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "generator_models_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stations" (
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
    "notes" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "deactivated_at" TIMESTAMPTZ,
    "deactivation_reason" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "stations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "generator_brands_normalized_name_key" ON "generator_brands"("normalized_name");

-- CreateIndex
CREATE UNIQUE INDEX "generator_models_brand_id_normalized_model_name_key" ON "generator_models"("brand_id", "normalized_model_name");

-- CreateIndex
CREATE UNIQUE INDEX "stations_station_code_key" ON "stations"("station_code");

-- CreateIndex
CREATE INDEX "idx_stations_code" ON "stations"("station_code");

-- CreateIndex
CREATE INDEX "idx_stations_latlon" ON "stations"("latitude", "longitude");

-- CreateIndex
CREATE INDEX "idx_stations_active" ON "stations"("is_active");

-- AddForeignKey
ALTER TABLE "generator_models" ADD CONSTRAINT "generator_models_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "generator_brands"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stations" ADD CONSTRAINT "stations_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "generator_brands"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stations" ADD CONSTRAINT "stations_model_id_fkey" FOREIGN KEY ("model_id") REFERENCES "generator_models"("id") ON DELETE SET NULL ON UPDATE CASCADE;
