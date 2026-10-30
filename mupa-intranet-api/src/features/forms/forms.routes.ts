import { Router } from 'express'

import { validate } from '../../shared/middlewares/validate.middleware.ts'
import { REQUEST_MANAGERS } from '../../shared/roles.ts'
import { requireRole } from '../auth/auth.middleware.ts'
import { createFormDto } from './dtos/create-form.dto.ts'
import { formIdParamsDto, formSlugParamsDto } from './dtos/form-params.dto.ts'
import { updateFormDto } from './dtos/update-form.dto.ts'
import { formsController } from './forms.controller.ts'

export const formsRoutes = Router()

// Panel del Gestor de Solicitudes (antes de /:slug para que "manage" no se lea como slug).
formsRoutes.get('/manage', requireRole(...REQUEST_MANAGERS), formsController.listAll)
formsRoutes.post('/', requireRole(...REQUEST_MANAGERS), validate({ body: createFormDto }), formsController.create)
formsRoutes.patch('/:id', requireRole(...REQUEST_MANAGERS), validate({ params: formIdParamsDto, body: updateFormDto }), formsController.update)
formsRoutes.delete('/:id', requireRole(...REQUEST_MANAGERS), validate({ params: formIdParamsDto }), formsController.delete)

// Lectura: cualquiera ve los publicados.
formsRoutes.get('/', formsController.listPublished)
formsRoutes.get('/:slug', validate({ params: formSlugParamsDto }), formsController.getPublished)
