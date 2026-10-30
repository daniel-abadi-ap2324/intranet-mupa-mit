import { Router } from 'express'

import { validate } from '../../shared/middlewares/validate.middleware.ts'
import { CONTENT_EDITORS } from '../../shared/roles.ts'
import { requireRole } from '../auth/auth.middleware.ts'
import { announcementsController } from './announcements.controller.ts'
import { announcementParamsDto } from './dtos/announcement-params.dto.ts'
import { createAnnouncementDto } from './dtos/create-announcement.dto.ts'
import { updateAnnouncementDto } from './dtos/update-announcement.dto.ts'

export const announcementsRoutes = Router()

// Lectura: cualquiera ve los vigentes (el Inicio).
announcementsRoutes.get('/', announcementsController.listActive)

// Panel de Comunicación: todos los anuncios y su gestión.
announcementsRoutes.get('/manage', requireRole(...CONTENT_EDITORS), announcementsController.listAll)
announcementsRoutes.post('/', requireRole(...CONTENT_EDITORS), validate({ body: createAnnouncementDto }), announcementsController.create)
announcementsRoutes.patch(
  '/:id',
  requireRole(...CONTENT_EDITORS),
  validate({ params: announcementParamsDto, body: updateAnnouncementDto }),
  announcementsController.update,
)
announcementsRoutes.delete('/:id', requireRole(...CONTENT_EDITORS), validate({ params: announcementParamsDto }), announcementsController.delete)
