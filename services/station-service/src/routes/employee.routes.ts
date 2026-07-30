import { Router } from 'express'
import { list, create, update, remove } from '../controllers/employee.controller'
import { requireRole } from '../middleware/require-role'

const router = Router()

// Read is open to any signed-in role — the add/approve-station forms need the list to pick from.
// Managing the list (add/edit/deactivate) is admin-only.
router.get('/', list)
router.post('/', requireRole('admin'), create)
router.patch('/:id', requireRole('admin'), update)
router.delete('/:id', requireRole('admin'), remove)

export default router
