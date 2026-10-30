import { Router } from 'express'

import { rateLimit } from '../../shared/middlewares/rate-limit.middleware.ts'
import { validate } from '../../shared/middlewares/validate.middleware.ts'
import { requireAuth } from '../auth/auth.middleware.ts'
import { clinicController } from './clinic.controller.ts'
import { appointmentsQueryDto } from './dtos/appointments.dto.ts'

export const clinicRoutes = Router()

// Información pública de la Clínica (la misma que publica su formulario de citas): cualquiera.
clinicRoutes.get('/', clinicController.getInfo)

// Las citas de la propia persona (por su cédula, que sale de su sesión). Son datos de salud: solo con sesión y con freno por cuenta.
const appointmentsLimit = rateLimit({ max: 30, windowMs: 5 * 60_000, message: 'Consultaste tus citas muchas veces seguidas. Espera unos minutos.' })
clinicRoutes.get('/appointments', requireAuth, appointmentsLimit, validate({ query: appointmentsQueryDto }), clinicController.getMyAppointments)
