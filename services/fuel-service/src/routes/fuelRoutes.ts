import { Router } from 'express'
import { postRecord, getRecords, getAllCurrentStates, getCurrentState, postImportCommit } from '../controllers/fuelController'

const router = Router()

router.post('/records', postRecord)
router.get('/records/:station_id', getRecords)
router.get('/current', getAllCurrentStates)
router.get('/current/:station_id', getCurrentState)
router.post('/import-commit', postImportCommit)

export default router
