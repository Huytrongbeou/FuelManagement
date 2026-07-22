import { Router } from 'express'
import { getRecords, getAllCurrentStates, getCurrentState, postImportCommit, postCheckExactDuplicates, postPreviewValidate, postInitCurrentState, getActivityStats } from '../controllers/fuel-record.controller'
import { requireRole } from '../middleware/require-role'

const router = Router()

router.get('/stats/activity', getActivityStats)
router.get('/current', getAllCurrentStates)
router.get('/current/:station_id', getCurrentState)
router.post('/current/init', requireRole('admin'), postInitCurrentState)
router.get('/records/:station_id', getRecords)
router.post('/records/preview-validate', requireRole('admin', 'manager'), postPreviewValidate)
router.post('/records/check-exact-duplicates', requireRole('admin', 'manager'), postCheckExactDuplicates)
router.post('/import-commit', requireRole('admin', 'manager'), postImportCommit)

export default router
