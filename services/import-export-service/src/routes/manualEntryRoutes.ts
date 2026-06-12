import { Router } from 'express'
import { previewHandler, confirmHandler } from '../controllers/manualEntryController'

const router = Router()

router.post('/preview', previewHandler)
router.post('/confirm', confirmHandler)

export default router
