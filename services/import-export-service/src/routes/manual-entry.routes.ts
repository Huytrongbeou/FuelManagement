import { Router } from 'express'
import { previewHandler, confirmHandler } from '../controllers/manual-entry.controller'
import { requireRole } from '../middleware/require-role'

const router = Router()

router.post('/preview', requireRole('admin', 'manager'), previewHandler)
router.post('/confirm', requireRole('admin', 'manager'), confirmHandler)

export default router
