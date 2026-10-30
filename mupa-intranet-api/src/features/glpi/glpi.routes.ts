import { Router } from 'express'

import { rateLimit } from '../../shared/middlewares/rate-limit.middleware.ts'
import { validate } from '../../shared/middlewares/validate.middleware.ts'
import { requireAuth } from '../auth/auth.middleware.ts'
import { glpiTicketsQueryDto } from './dtos/glpi-tickets.dto.ts'
import { glpiController } from './glpi.controller.ts'

export const glpiRoutes = Router()

// Los tickets de la Mesa de Ayuda de la propia persona (por su cédula, que sale de su sesión): solo con sesión y con freno por cuenta.
const ticketsLimit = rateLimit({ max: 30, windowMs: 5 * 60_000, message: 'Consultaste tus tickets de la Mesa de Ayuda muchas veces seguidas. Espera unos minutos.' })
glpiRoutes.get('/tickets', requireAuth, ticketsLimit, validate({ query: glpiTicketsQueryDto }), glpiController.getMyTickets)
