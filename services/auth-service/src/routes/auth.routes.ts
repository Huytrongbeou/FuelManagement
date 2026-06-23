import { Router } from 'express'
import { login, logout, me } from '../controllers/auth.controller'
import { validateLogin } from '../middleware/validate-login'
import { authenticate } from '../middleware/authenticate'

const router = Router()

// /auth/health — accessible when routed through gateway /api/auth/health
router.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'auth-service' })
})
router.post('/login', validateLogin, login)
router.post('/logout', logout)
router.get('/me', authenticate, me)

export default router
