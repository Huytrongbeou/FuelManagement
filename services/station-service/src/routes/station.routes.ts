import { Router } from 'express'
import { list, getOne, create, update, deactivate, reactivate, bulkUpsertHandler } from '../controllers/station.controller'
import { requireRole } from '../middleware/require-role'

const router = Router()

router.get('/', list)
router.get('/:id', getOne)
router.post('/', requireRole('admin'), create)
router.post('/bulk-upsert', requireRole('admin'), bulkUpsertHandler)
router.put('/:id', requireRole('admin'), update)
router.patch('/:id/deactivate', requireRole('admin'), deactivate)
router.patch('/:id/reactivate', requireRole('admin'), reactivate)

export default router
