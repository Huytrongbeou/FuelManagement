import { Router } from 'express'
import { getUsers, postUser, patchUser, deleteUser } from '../controllers/user.controller'
import { requireRole } from '../middleware/require-role'

const router = Router()

// Every route here is admin-only — user administration is not delegated.
router.use(requireRole('admin'))

router.get('/', getUsers)
router.post('/', postUser)
router.patch('/:id', patchUser)
router.delete('/:id', deleteUser)

export default router
