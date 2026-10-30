import { Router } from 'express'
import { z } from 'zod'

import { validate } from '../../shared/middlewares/validate.middleware.ts'
import { CONTENT_EDITORS } from '../../shared/roles.ts'
import { requireAuth, requireRole } from '../auth/auth.middleware.ts'
import { HOME_SECTION_DTOS, HOME_SECTIONS } from './dtos/home-sections.dto.ts'
import { updateHomeLayoutDto } from './dtos/update-home-layout.dto.ts'
import { homeController } from './home.controller.ts'

export const homeRoutes = Router()

homeRoutes.get('/content', homeController.getContent)
// Comunicación edita cada sección por separado: PUT /content/intro, /content/enlaces…
for (const section of HOME_SECTIONS) {
  const body = z.object({ value: HOME_SECTION_DTOS[section] }).strict()
  homeRoutes.put('/content/' + section, requireRole(...CONTENT_EDITORS), validate({ body }), homeController.saveSection(section))
}
homeRoutes.get('/layout', homeController.getLayouts)
homeRoutes.put('/layout', requireAuth, validate({ body: updateHomeLayoutDto }), homeController.savePersonalLayout)
homeRoutes.put('/default-layout', requireRole('admin'), validate({ body: updateHomeLayoutDto }), homeController.saveDefaultLayout)
