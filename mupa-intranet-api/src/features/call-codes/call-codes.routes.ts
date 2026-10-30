import { Router } from 'express'

import { rateLimit } from '../../shared/middlewares/rate-limit.middleware.ts'
import { validate } from '../../shared/middlewares/validate.middleware.ts'
import { requireAuth } from '../auth/auth.middleware.ts'
import { callCodesController } from './call-codes.controller.ts'
import { callCodeRequestsQueryDto } from './dtos/call-code-requests.dto.ts'

export const callCodesRoutes = Router()

// Las solicitudes de código de llamada de la propia persona (por su cédula, que sale de su sesión): solo con sesión y con freno por cuenta.
const requestsLimit = rateLimit({ max: 30, windowMs: 5 * 60_000, message: 'Consultaste tus solicitudes de códigos de llamada muchas veces seguidas. Espera unos minutos.' })
callCodesRoutes.get('/requests', requireAuth, requestsLimit, validate({ query: callCodeRequestsQueryDto }), callCodesController.getMyRequests)
