import { Router } from 'express'
import { exportSnapshot, exportTemplate } from './export.controller'

const router = Router()

router.get('/snapshot', exportSnapshot)
router.get('/template', exportTemplate)

export default router
