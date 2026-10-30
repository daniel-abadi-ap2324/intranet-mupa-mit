import { Router } from 'express'

import { validate } from '../../shared/middlewares/validate.middleware.ts'
import { CONTENT_EDITORS } from '../../shared/roles.ts'
import { requireRole } from '../auth/auth.middleware.ts'
import { createVideoDto } from './dtos/create-video.dto.ts'
import { videoParamsDto } from './dtos/video-params.dto.ts'
import { updateVideoDto } from './dtos/update-video.dto.ts'
import { videoController } from './videos.controller.ts'

export const videosRoutes = Router()

// Lectura: cualquiera ve lo publicado.
videosRoutes.get('/', videoController.listPublished)

// Panel de Comunicación.
videosRoutes.get('/manage', requireRole(...CONTENT_EDITORS), videoController.listAll)
videosRoutes.post('/', requireRole(...CONTENT_EDITORS), validate({ body: createVideoDto }), videoController.create)
videosRoutes.patch('/:id', requireRole(...CONTENT_EDITORS), validate({ params: videoParamsDto, body: updateVideoDto }), videoController.update)
videosRoutes.delete('/:id', requireRole(...CONTENT_EDITORS), validate({ params: videoParamsDto }), videoController.delete)
