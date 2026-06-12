import { Router } from 'express'
import { list, getOne, create, update, remove, bulkUpsertHandler } from '../controllers/stationController'

const router = Router()

router.get('/', list)
router.post('/', create)
router.post('/bulk-upsert', bulkUpsertHandler)
router.get('/:id', getOne)
router.put('/:id', update)
router.delete('/:id', remove)

export default router
