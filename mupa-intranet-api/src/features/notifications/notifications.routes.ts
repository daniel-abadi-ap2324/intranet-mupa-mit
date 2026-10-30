import { Router } from 'express'

import { REQUEST_HANDLERS } from '../../shared/roles.ts'
import { requireRole } from '../auth/auth.middleware.ts'
import { notificationsController } from './notifications.controller.ts'

export const notificationsRoutes = Router()

// Solo quienes atienden solicitudes. Sin sesión: 401; otro rol: 403 (en JSON, antes de abrir el stream).
notificationsRoutes.get('/', requireRole(...REQUEST_HANDLERS), notificationsController.list)
notificationsRoutes.get('/stream', requireRole(...REQUEST_HANDLERS), notificationsController.stream)
