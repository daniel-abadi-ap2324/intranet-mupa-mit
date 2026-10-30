import { Router } from 'express'

import { validate } from '../../shared/middlewares/validate.middleware.ts'
import { CONTENT_EDITORS } from '../../shared/roles.ts'
import { requireRole } from '../auth/auth.middleware.ts'
import { createNewsDto } from './dtos/create-news.dto.ts'
import { newsParamsDto } from './dtos/news-params.dto.ts'
import { updateNewsDto } from './dtos/update-news.dto.ts'
import { newsController } from './news.controller.ts'

export const newsRoutes = Router()

// Lectura: cualquiera ve lo publicado.
newsRoutes.get('/', newsController.listPublished)

// Panel de Comunicación.
newsRoutes.get('/manage', requireRole(...CONTENT_EDITORS), newsController.listAll)
// Una publicada con su texto, para leerla dentro de la intranet (la ruta fija /manage va antes).
newsRoutes.get('/:id', validate({ params: newsParamsDto }), newsController.getOne)
newsRoutes.post('/', requireRole(...CONTENT_EDITORS), validate({ body: createNewsDto }), newsController.create)
newsRoutes.patch('/:id', requireRole(...CONTENT_EDITORS), validate({ params: newsParamsDto, body: updateNewsDto }), newsController.update)
newsRoutes.delete('/:id', requireRole(...CONTENT_EDITORS), validate({ params: newsParamsDto }), newsController.delete)
