import { Router } from 'express'
import { list, getOne, create, update, remove } from '../controllers/generatorTypeController'

const router = Router()

router.get('/', list)
router.post('/', create)
router.get('/:id', getOne)
router.put('/:id', update)
router.delete('/:id', remove)

export default router
