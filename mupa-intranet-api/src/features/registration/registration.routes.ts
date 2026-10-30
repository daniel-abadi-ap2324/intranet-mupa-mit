import { Router } from 'express'

import { rateLimit } from '../../shared/middlewares/rate-limit.middleware.ts'
import { validate } from '../../shared/middlewares/validate.middleware.ts'
import { registerDto } from './dtos/register.dto.ts'
import { registrationController } from './registration.controller.ts'

export const registrationRoutes = Router()

// Por IP y holgado: en la Alcaldía mucha gente sale por la misma red. El central tiene su propio límite.
const registerLimit = rateLimit({ max: 20, windowMs: 60 * 60_000, message: 'Hubo muchos registros desde esta red. Espera un rato y vuelve a intentarlo.' })

// Sin `authenticate`: es para quien todavía no tiene cuenta.
registrationRoutes.post('/', validate({ body: registerDto }), registerLimit, registrationController.register)
