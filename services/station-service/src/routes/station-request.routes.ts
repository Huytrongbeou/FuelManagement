import { Router } from 'express'
import { list, getOne, create, approve, reject } from '../controllers/station-request.controller'
import { requireRole } from '../middleware/require-role'

const router = Router()

// Any signed-in role may propose a station — that is the point of the feature: staff in the field
// submit what they find. Only manager/admin may turn a proposal into a real station.
router.get('/', list)
router.get('/:id', getOne)
router.post('/', create)
router.post('/:id/approve', requireRole('admin', 'manager'), approve)
router.post('/:id/reject', requireRole('admin', 'manager'), reject)

export default router
