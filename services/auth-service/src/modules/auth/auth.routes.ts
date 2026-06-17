import { Router } from 'express'
import { login, me } from './auth.controller'
import { validateLogin } from '../../shared/middleware/validate-login'
import { authenticate } from '../../shared/middleware/authenticate'

const router = Router()

// /auth/health — accessible when routed through gateway /api/auth/health
router.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'auth-service' })
})
router.post('/login', validateLogin, login)
router.get('/me', authenticate, me)

export default router
