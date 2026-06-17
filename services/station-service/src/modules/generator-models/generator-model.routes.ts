import { Router } from 'express'
import { list, getOne, create, update, deactivate, reactivate } from './generator-model.controller'

const router = Router()

router.get('/', list)
router.post('/', create)
router.get('/:id', getOne)
router.put('/:id', update)
router.patch('/:id/deactivate', deactivate)
router.patch('/:id/reactivate', reactivate)

export default router
