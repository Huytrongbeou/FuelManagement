import { prisma } from '../config/prisma'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function brandName(brandId: string | null | undefined): Promise<string | null> {
  if (!brandId) return null
  const b = await prisma.generatorBrand.findUnique({ where: { id: brandId }, select: { name: true } })
  return b?.name ?? null
}

async function modelName(modelId: string | null | undefined): Promise<string | null> {
  if (!modelId) return null
  const m = await prisma.generatorModel.findUnique({ where: { id: modelId }, select: { modelName: true } })
  return m?.modelName ?? null
}

/**
 * Records a brand/model change as an audit row, resolving the ids to names so the history stays
 * readable even if a brand/model is later renamed or removed. No-op when neither changed.
 * Called from station update inside the same flow; failure here must not fail the update, so the
 * caller wraps it defensively.
 */
export async function recordIfChanged(
  station: { id: string; stationCode: string; brandId: string | null; modelId: string | null },
  next: { brandId?: string | null; modelId?: string | null },
  changedBy?: string
): Promise<void> {
  const brandChanged = next.brandId !== undefined && (next.brandId ?? null) !== (station.brandId ?? null)
  const modelChanged = next.modelId !== undefined && (next.modelId ?? null) !== (station.modelId ?? null)
  if (!brandChanged && !modelChanged) return

  const [oldBrand, oldModel, newBrand, newModel] = await Promise.all([
    brandName(station.brandId),
    modelName(station.modelId),
    brandName(brandChanged ? next.brandId : station.brandId),
    modelName(modelChanged ? next.modelId : station.modelId),
  ])

  await prisma.stationMachineChange.create({
    data: {
      stationId: station.id,
      stationCode: station.stationCode,
      oldBrandName: oldBrand,
      oldModelName: oldModel,
      newBrandName: newBrand,
      newModelName: newModel,
      changedBy: changedBy ?? null,
    },
  })
}

export async function listForStation(stationId: string) {
  if (!UUID_RE.test(stationId)) throw Object.assign(new Error('Không tìm thấy trạm'), { status: 404 })
  return prisma.stationMachineChange.findMany({
    where: { stationId },
    orderBy: { changedAt: 'desc' },
    take: 100,
  })
}
