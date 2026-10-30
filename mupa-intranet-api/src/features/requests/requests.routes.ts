import { Router } from 'express'

import { validate } from '../../shared/middlewares/validate.middleware.ts'
import { REQUEST_HANDLERS } from '../../shared/roles.ts'
import { requireAuth, requireRole } from '../auth/auth.middleware.ts'
import { createRequestDto } from './dtos/create-request.dto.ts'
import { createMessageDto, listRequestsDto, requestParamsDto, updateRequestStatusDto } from './dtos/manage-request.dto.ts'
import { requestsController } from './requests.controller.ts'

export const requestsRoutes = Router()

// La persona: enviar y ver las suyas.
requestsRoutes.post('/', requireAuth, validate({ body: createRequestDto }), requestsController.submit)
requestsRoutes.get('/mine', requireAuth, requestsController.mine)

// Quien gestiona (hoy, cualquier gestor): la bandeja, el estado y las respuestas.
requestsRoutes.get('/manage', requireRole(...REQUEST_HANDLERS), validate({ query: listRequestsDto }), requestsController.list)
requestsRoutes.patch('/:id', requireRole(...REQUEST_HANDLERS), validate({ params: requestParamsDto, body: updateRequestStatusDto }), requestsController.setStatus)
requestsRoutes.post('/:id/messages', requireRole(...REQUEST_HANDLERS), validate({ params: requestParamsDto, body: createMessageDto }), requestsController.reply)

// Detalle: la persona que la envió o el Gestor (lo decide el servicio).
requestsRoutes.get('/:id', requireAuth, validate({ params: requestParamsDto }), requestsController.detail)
