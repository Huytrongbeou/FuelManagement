import { Router } from 'express'
import { list, getOne, create, update, deactivate, reactivate, bulkUpsertHandler } from '../controllers/station.controller'

const router = Router()

router.get('/', list)
router.post('/', create)
router.post('/bulk-upsert', bulkUpsertHandler)
router.get('/:id', getOne)
router.put('/:id', update)
router.patch('/:id/deactivate', deactivate)
router.patch('/:id/reactivate', reactivate)

export default router
