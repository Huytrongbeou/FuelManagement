import { Router } from 'express'
import { postRecord, getRecords, getAllCurrentStates, getCurrentState, postImportCommit, postCheckExactDuplicates, postPreviewValidate } from '../controllers/fuel-record.controller'
import { requireRole } from '../middleware/require-role'

const router = Router()

router.get('/current', getAllCurrentStates)
router.get('/current/:station_id', getCurrentState)
router.get('/records/:station_id', getRecords)
router.post('/records', requireRole('admin', 'manager'), postRecord)
router.post('/records/preview-validate', requireRole('admin', 'manager'), postPreviewValidate)
router.post('/records/check-exact-duplicates', requireRole('admin', 'manager'), postCheckExactDuplicates)
router.post('/import-commit', requireRole('admin', 'manager'), postImportCommit)

export default router
