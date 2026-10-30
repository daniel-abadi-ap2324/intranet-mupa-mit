import { Router } from 'express'

import { validate } from '../../shared/middlewares/validate.middleware.ts'
import { CONTENT_EDITORS } from '../../shared/roles.ts'
import { requireRole } from '../auth/auth.middleware.ts'
import { bulletinQueryDto } from './dtos/bulletin-query.dto.ts'
import { createBulletinDto } from './dtos/create-bulletin.dto.ts'
import { bulletinParamsDto } from './dtos/bulletin-params.dto.ts'
import { updateBulletinDto } from './dtos/update-bulletin.dto.ts'
import { bulletinController } from './bulletins.controller.ts'

export const bulletinsRoutes = Router()

// Lectura: cualquiera ve lo publicado.
bulletinsRoutes.get('/', validate({ query: bulletinQueryDto }), bulletinController.listPublished)

// Panel de Comunicación.
bulletinsRoutes.get('/manage', requireRole(...CONTENT_EDITORS), bulletinController.listAll)
bulletinsRoutes.post('/', requireRole(...CONTENT_EDITORS), validate({ body: createBulletinDto }), bulletinController.create)
bulletinsRoutes.patch('/:id', requireRole(...CONTENT_EDITORS), validate({ params: bulletinParamsDto, body: updateBulletinDto }), bulletinController.update)
bulletinsRoutes.delete('/:id', requireRole(...CONTENT_EDITORS), validate({ params: bulletinParamsDto }), bulletinController.delete)
