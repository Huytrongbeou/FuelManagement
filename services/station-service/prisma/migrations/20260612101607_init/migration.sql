-- CreateTable
CREATE TABLE "generator_types" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "type_name" VARCHAR(100) NOT NULL,
    "consumption_rate" DECIMAL(6,3) NOT NULL,
    "notes" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "generator_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "station_code" VARCHAR(50) NOT NULL,
    "station_name" VARCHAR(200) NOT NULL,
    "address" TEXT,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "generator_type_id" UUID NOT NULL,
    "max_capacity" DECIMAL(8,2) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "stations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "generator_types_type_name_key" ON "generator_types"("type_name");

-- CreateIndex
CREATE UNIQUE INDEX "stations_station_code_key" ON "stations"("station_code");

-- CreateIndex
CREATE INDEX "idx_stations_code" ON "stations"("station_code");

-- AddForeignKey
ALTER TABLE "stations" ADD CONSTRAINT "stations_generator_type_id_fkey" FOREIGN KEY ("generator_type_id") REFERENCES "generator_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
