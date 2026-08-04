import { Router } from 'express'
import { list, getOne, create, update, deactivate, reactivate, bulkUpsertHandler } from '../controllers/station.controller'
import { listForStation, createForStation, listMachineChanges } from '../controllers/maintenance.controller'
import { requireRole } from '../middlewares/require-role'

const router = Router()

router.get('/', list)
router.get('/:id', getOne)
router.post('/', requireRole('admin'), create)
router.post('/bulk-upsert', requireRole('admin'), bulkUpsertHandler)
router.put('/:id', requireRole('admin'), update)
router.patch('/:id/deactivate', requireRole('admin'), deactivate)
router.patch('/:id/reactivate', requireRole('admin'), reactivate)

// Per-station maintenance log + generator-change audit (reached via the /api/stations* proxy).
router.get('/:id/maintenance', listForStation)
router.post('/:id/maintenance', requireRole('admin', 'manager'), createForStation)
router.get('/:id/machine-changes', listMachineChanges)

export default router
