import { Router } from 'express'
import { requireRole } from '../middleware/require-role'
import { postAdjustmentRequest, getAdjustmentRequests } from '../controllers/adjustment-request.controller'

const router = Router()

router.post('/adjustment-requests', requireRole('admin', 'manager'), postAdjustmentRequest)
router.get('/adjustment-requests', requireRole('admin', 'manager'), getAdjustmentRequests)

export default router
