import { Router } from 'express'

import { CATALOG_EDITORS } from '../../shared/roles.ts'
import { validate } from '../../shared/middlewares/validate.middleware.ts'
import { requireRole } from '../auth/auth.middleware.ts'
import { applicationsController } from './applications.controller.ts'
import { applicationParamsDto } from './dtos/application-params.dto.ts'
import { createApplicationDto } from './dtos/create-application.dto.ts'
import { listApplicationsDto } from './dtos/list-applications.dto.ts'
import { setVisibilityDto } from './dtos/set-visibility.dto.ts'
import { updateApplicationDto } from './dtos/update-application.dto.ts'

export const applicationsRoutes = Router()

// Lectura: cualquiera (el servicio filtra según quién mira).
applicationsRoutes.get('/', validate({ query: listApplicationsDto }), applicationsController.list)
applicationsRoutes.get('/:id', validate({ params: applicationParamsDto }), applicationsController.getById)

// Escritura: solo administración.
applicationsRoutes.post('/', requireRole(...CATALOG_EDITORS), validate({ body: createApplicationDto }), applicationsController.create)
// Clasificación en lote: qué departamentos ven qué aplicaciones (todo o nada).
applicationsRoutes.put('/departments', requireRole(...CATALOG_EDITORS), validate({ body: setVisibilityDto }), applicationsController.setVisibility)
applicationsRoutes.patch(
  '/:id',
  requireRole(...CATALOG_EDITORS),
  validate({ params: applicationParamsDto, body: updateApplicationDto }),
  applicationsController.update,
)
applicationsRoutes.delete('/:id', requireRole(...CATALOG_EDITORS), validate({ params: applicationParamsDto }), applicationsController.delete)
