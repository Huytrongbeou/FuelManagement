import { Router } from 'express'
import { exportSnapshot, exportTemplate } from '../controllers/exportController'

const router = Router()

router.get('/snapshot', exportSnapshot)
router.get('/template', exportTemplate)

export default router
