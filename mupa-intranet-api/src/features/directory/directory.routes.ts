import { Router } from 'express'

import { requireRole } from '../auth/auth.middleware.ts'
import { directoryController } from './directory.controller.ts'

export const directoryRoutes = Router()

// Público, como la página /directorio: lee la última copia guardada (nunca llama a la central).
directoryRoutes.get('/', directoryController.list)
// Solo administración: la comparación trae nombres de la central que todavía no se publican.
directoryRoutes.get('/comparison', requireRole('admin'), directoryController.comparison)
