import { Router } from 'express'

import { validate } from '../../shared/middlewares/validate.middleware.ts'
import { requireRole } from '../auth/auth.middleware.ts'
import { departmentsController } from './departments.controller.ts'
import { departmentParamsDto } from './dtos/department-params.dto.ts'
import { saveDepartmentDto } from './dtos/save-department.dto.ts'

export const departmentsRoutes = Router()

// Pública: la lista de nombres para el formulario de registro.
departmentsRoutes.get('/options', departmentsController.options)

// El resto es de administración.
departmentsRoutes.get('/', requireRole('admin'), departmentsController.list)
departmentsRoutes.post('/', requireRole('admin'), validate({ body: saveDepartmentDto }), departmentsController.create)
departmentsRoutes.patch('/:id', requireRole('admin'), validate({ params: departmentParamsDto, body: saveDepartmentDto }), departmentsController.update)
departmentsRoutes.delete('/:id', requireRole('admin'), validate({ params: departmentParamsDto }), departmentsController.delete)
