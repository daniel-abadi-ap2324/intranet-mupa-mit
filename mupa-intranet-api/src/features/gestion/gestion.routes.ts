import { Router } from 'express'

import { GESTORES } from '../../shared/roles.ts'
import { requireRole } from '../auth/auth.middleware.ts'
import { gestionController } from './gestion.controller.ts'

export const gestionRoutes = Router()

// Centro de Gestión: cualquier gestor (qué áreas trae lo decide el servicio).
gestionRoutes.get('/panel', requireRole(...GESTORES), gestionController.panel)
