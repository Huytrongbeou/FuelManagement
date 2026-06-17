import { Router } from 'express'
import { requireRole } from '../middleware/require-role'
import {
  postAdjustmentRequest,
  getAdjustmentRequests,
  patchApprove,
  patchReject,
} from '../controllers/adjustment-request.controller'

const router = Router()

router.post('/adjustment-requests', requireRole('admin', 'manager'), postAdjustmentRequest)
router.get('/adjustment-requests', requireRole('admin', 'manager'), getAdjustmentRequests)
router.patch('/adjustment-requests/:id/approve', requireRole('admin'), patchApprove)
router.patch('/adjustment-requests/:id/reject', requireRole('admin'), patchReject)

export default router
