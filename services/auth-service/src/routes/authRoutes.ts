import { Router } from 'express'
import { login, me } from '../controllers/authController'
import { validateLogin } from '../middleware/validateLogin'
import { authenticate } from '../middleware/authenticate'

const router = Router()

// /auth/health — accessible when routed through gateway /api/auth/health
router.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'auth-service' })
})
router.post('/login', validateLogin, login)
router.get('/me', authenticate, me)

export default router
