const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function main() {
  // ── Brands ────────────────────────────────────────────────────────────────
  const brandsData = [
    { name: 'Cummins',    country: 'USA',   normalized: 'cummins'    },
    { name: 'Mitsubishi', country: 'Japan', normalized: 'mitsubishi' },
    { name: 'Denyo',      country: 'Japan', normalized: 'denyo'      },
    { name: 'Honda',      country: 'Japan', normalized: 'honda'      },
    { name: 'Perkins',    country: 'UK',    normalized: 'perkins'    },
  ]

  const brandMap = {}
  for (const b of brandsData) {
    const brand = await prisma.generatorBrand.upsert({
      where: { normalizedName: b.normalized },
      update: { name: b.name, country: b.country },
      create: { name: b.name, normalizedName: b.normalized, country: b.country },
    })
    brandMap[b.normalized] = brand.id
  }
  console.log('Brands seeded:', Object.keys(brandMap).length)

  // ── Models ─────────────────────────────────────────────────────────────────
  const modelsData = [
    { brand: 'cummins',    modelName: 'C100D5',       powerKva: 100, rate: 10.0, cap: 200 },
    { brand: 'cummins',    modelName: 'C150D5',       powerKva: 150, rate: 14.0, cap: 300 },
    { brand: 'mitsubishi', modelName: 'S6R2-PTAW2',   powerKva: 150, rate: 15.0, cap: 300 },
    { brand: 'denyo',      modelName: 'DCA-60ESI',    powerKva: 60,  rate: 6.5,  cap: 120 },
    { brand: 'denyo',      modelName: 'DCA-100SPK',   powerKva: 100, rate: 10.5, cap: 200 },
    { brand: 'honda',      modelName: 'EM10000',      powerKva: 10,  rate: 2.5,  cap: 25  },
    { brand: 'perkins',    modelName: '1106A-70TG1',  powerKva: 80,  rate: 8.0,  cap: 150 },
    { brand: 'perkins',    modelName: '1104A-44TG1',  powerKva: 50,  rate: 5.5,  cap: 100 },
  ]

  const modelMap = {}
  for (const m of modelsData) {
    const brandId = brandMap[m.brand]
    const normalizedModelName = m.modelName.toLowerCase()
    const model = await prisma.generatorModel.upsert({
      where: { brandId_normalizedModelName: { brandId, normalizedModelName } },
      update: { powerKva: m.powerKva, suggestedConsumptionRate: m.rate, suggestedMaxCapacity: m.cap },
      create: {
        brandId,
        modelName: m.modelName,
        normalizedModelName,
        powerKva: m.powerKva,
        fuelType: 'diesel',
        suggestedConsumptionRate: m.rate,
        suggestedMaxCapacity: m.cap,
      },
    })
    modelMap[`${m.brand}|${normalizedModelName}`] = model.id
  }
  console.log('Models seeded:', Object.keys(modelMap).length)

  // ── Stations ──────────────────────────────────────────────────────────────
  const stationsData = [
    // Green targets (4)
    {
      code: 'CL-001', name: 'Trạm Phường 1', genName: 'Máy phát chính',
      brandK: 'cummins', modelK: 'c100d5', powerKva: 100, rate: 10.0, cap: 200,
      lat: 10.4574, lng: 105.6379,
      adminUnit: 'Phường Cao Lãnh', oldTerritory: 'Phường 1 cũ', zone: 'Cao Lãnh trung tâm',
    },
    {
      code: 'CL-002', name: 'Trạm Phường 3', genName: 'Máy phát dự phòng',
      brandK: 'cummins', modelK: 'c150d5', powerKva: 150, rate: 14.0, cap: 300,
      lat: 10.4592, lng: 105.6401,
      adminUnit: 'Phường Cao Lãnh', oldTerritory: 'Phường 3 cũ', zone: 'Cao Lãnh trung tâm',
    },
    {
      code: 'CL-003', name: 'Trạm Phường 4', genName: 'Máy phát Mitsubishi',
      brandK: 'mitsubishi', modelK: 's6r2-ptaw2', powerKva: 150, rate: 15.0, cap: 300,
      lat: 10.4551, lng: 105.6362,
      adminUnit: 'Phường Cao Lãnh', oldTerritory: 'Phường 4 cũ', zone: 'Cao Lãnh trung tâm',
    },
    {
      code: 'CL-011', name: 'Trạm Hòa An 2', genName: 'Máy phát Denyo',
      brandK: 'denyo', modelK: 'dca-60esi', powerKva: 60, rate: 6.5, cap: 120,
      lat: 10.4489, lng: 105.6445,
      adminUnit: 'Phường Cao Lãnh', oldTerritory: 'Hòa An cũ', zone: 'Ven trung tâm',
    },
    // Yellow targets (3)
    {
      code: 'CL-004', name: 'Trạm Phường 6', genName: 'Máy phát nhỏ',
      brandK: 'denyo', modelK: 'dca-60esi', powerKva: 60, rate: 6.5, cap: 120,
      lat: 10.4610, lng: 105.6425,
      adminUnit: 'Phường Cao Lãnh', oldTerritory: 'Phường 6 cũ', zone: 'Cao Lãnh trung tâm',
    },
    {
      code: 'CL-005', name: 'Trạm Hòa Thuận', genName: 'Máy phát Denyo 100',
      brandK: 'denyo', modelK: 'dca-100spk', powerKva: 100, rate: 10.5, cap: 200,
      lat: 10.4523, lng: 105.6318,
      adminUnit: 'Phường Cao Lãnh', oldTerritory: 'Hòa Thuận cũ', zone: 'Ven trung tâm',
    },
    {
      code: 'CL-012', name: 'Trạm Tịnh Thới 2', genName: 'Máy phát Cummins',
      brandK: 'cummins', modelK: 'c100d5', powerKva: 100, rate: 10.0, cap: 200,
      lat: 10.4475, lng: 105.6502,
      adminUnit: 'Phường Cao Lãnh', oldTerritory: 'Tịnh Thới cũ', zone: 'Ven trung tâm',
    },
    // Red targets (2)
    {
      code: 'CL-006', name: 'Trạm Hòa An', genName: 'Máy phát Honda',
      brandK: 'honda', modelK: 'em10000', powerKva: 10, rate: 2.5, cap: 25,
      lat: 10.4498, lng: 105.6437,
      adminUnit: 'Phường Cao Lãnh', oldTerritory: 'Hòa An cũ', zone: 'Ven trung tâm',
    },
    {
      code: 'CL-007', name: 'Trạm Tịnh Thới', genName: 'Máy phát Perkins',
      brandK: 'perkins', modelK: '1106a-70tg1', powerKva: 80, rate: 8.0, cap: 150,
      lat: 10.4462, lng: 105.6495,
      adminUnit: 'Phường Cao Lãnh', oldTerritory: 'Tịnh Thới cũ', zone: 'Ven trung tâm',
    },
    // Gray — no fuel records seeded (3, includes 1 with no coords)
    {
      code: 'CL-008', name: 'Trạm Tân Thuận Tây', genName: 'Máy phát Cummins dự phòng',
      brandK: 'cummins', modelK: 'c100d5', powerKva: 100, rate: 10.0, cap: 200,
      lat: 10.4538, lng: 105.6558,
      adminUnit: 'Phường Cao Lãnh', oldTerritory: 'Tân Thuận Tây cũ', zone: 'Chưa phân loại',
    },
    {
      code: 'CL-009', name: 'Trạm Tân Thuận Đông', genName: 'Máy phát Perkins 50kVA',
      brandK: 'perkins', modelK: '1104a-44tg1', powerKva: 50, rate: 5.5, cap: 100,
      lat: 10.4561, lng: 105.6587,
      adminUnit: 'Phường Cao Lãnh', oldTerritory: 'Tân Thuận Đông cũ', zone: 'Chưa phân loại',
    },
    {
      code: 'CL-010', name: 'Trạm Phường 3 Dự Phòng', genName: 'Máy phát Mitsubishi',
      brandK: 'mitsubishi', modelK: 's6r2-ptaw2', powerKva: 150, rate: 15.0, cap: 300,
      lat: null, lng: null,
      adminUnit: 'Phường Cao Lãnh', oldTerritory: 'Phường 3 cũ', zone: 'Chưa phân loại',
    },
  ]

  let stationCount = 0
  for (const s of stationsData) {
    const brandId = brandMap[s.brandK]
    const modelId = modelMap[`${s.brandK}|${s.modelK}`]
    await prisma.station.upsert({
      where: { stationCode: s.code },
      update: {
        stationName: s.name,
        generatorName: s.genName,
        brandId,
        modelId,
        powerKva: s.powerKva,
        consumptionRate: s.rate,
        maxCapacity: s.cap,
        latitude: s.lat,
        longitude: s.lng,
        currentAdminUnitName: s.adminUnit,
        legacyAreaName: s.oldTerritory,
        operationAreaName: s.zone,
      },
      create: {
        stationCode: s.code,
        stationName: s.name,
        generatorName: s.genName,
        brandId,
        modelId,
        powerKva: s.powerKva,
        fuelType: 'diesel',
        consumptionRate: s.rate,
        maxCapacity: s.cap,
        latitude: s.lat,
        longitude: s.lng,
        currentAdminUnitName: s.adminUnit,
        legacyAreaName: s.oldTerritory,
        operationAreaName: s.zone,
      },
    })
    stationCount++
  }
  console.log('Stations seeded:', stationCount)
}

main().finally(() => prisma.$disconnect())
