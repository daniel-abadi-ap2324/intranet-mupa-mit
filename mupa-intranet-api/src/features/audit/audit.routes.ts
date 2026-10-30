import { Router } from 'express'

import { validate } from '../../shared/middlewares/validate.middleware.ts'
import { requireRole } from '../auth/auth.middleware.ts'
import { auditController } from './audit.controller.ts'
import { listAuditDto } from './dtos/list-audit.dto.ts'

export const auditRoutes = Router()

// Solo administración consulta la auditoría de eventos.
auditRoutes.get('/events', requireRole('admin'), validate({ query: listAuditDto }), auditController.list)
