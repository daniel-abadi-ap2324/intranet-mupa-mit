import { Router } from 'express'

import { CONTENT_EDITORS } from '../../shared/roles.ts'
import { requireRole } from '../auth/auth.middleware.ts'
import { wordpressSyncController } from './wordpress-sync.controller.ts'

export const wordpressSyncRoutes = Router()

// Solo Comunicación y administración: el botón «Sincronizar ahora» de sus paneles.
wordpressSyncRoutes.get('/status', requireRole(...CONTENT_EDITORS), wordpressSyncController.status)
wordpressSyncRoutes.post('/run', requireRole(...CONTENT_EDITORS), wordpressSyncController.run)
