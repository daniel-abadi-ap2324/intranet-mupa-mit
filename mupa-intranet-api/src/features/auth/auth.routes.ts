import { Router } from 'express'

import { env } from '../../config/env.ts'
import { rateLimit } from '../../shared/middlewares/rate-limit.middleware.ts'
import { validate } from '../../shared/middlewares/validate.middleware.ts'
import { authController } from './auth.controller.ts'
import { authenticate } from './auth.middleware.ts'
import { loginDto } from './dtos/login.dto.ts'

export const authRoutes = Router()

// Sin `authenticate`: sirven para obtener, renovar o cerrar la sesión, no la exigen.
// Freno a adivinar contraseñas: por IP (aún no hay sesión). 100 intentos cada 10 min deja trabajar a una oficina entera detrás de la misma IP.
const loginLimit = rateLimit({ max: env.LOGIN_RATE_LIMIT, windowMs: 10 * 60_000, message: 'Demasiados intentos de entrar. Espera unos minutos e inténtalo de nuevo.' })
authRoutes.post('/login', loginLimit, validate({ body: loginDto }), authController.login)
authRoutes.post('/refresh', authController.refresh)
authRoutes.post('/logout', authController.logout)

authRoutes.get('/session', authenticate, authController.session)
