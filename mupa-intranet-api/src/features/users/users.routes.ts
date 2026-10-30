import { Router } from 'express'

import { rateLimit } from '../../shared/middlewares/rate-limit.middleware.ts'
import { validate } from '../../shared/middlewares/validate.middleware.ts'
import { requireAuth, requireRole } from '../auth/auth.middleware.ts'
import { chooseDepartmentDto } from './dtos/choose-department.dto.ts'
import { listUsersDto } from './dtos/list-users.dto.ts'
import { updateUserDto } from './dtos/update-user.dto.ts'
import { userParamsDto } from './dtos/user-params.dto.ts'
import { verifyEmailDto } from './dtos/verify-email.dto.ts'
import { usersController } from './users.controller.ts'

const codeLimit = rateLimit({ max: 3, windowMs: 10 * 60_000, message: 'Pediste varios códigos seguidos. Espera unos minutos y vuelve a intentarlo.' })
const verifyLimit = rateLimit({ max: 10, windowMs: 10 * 60_000, message: 'Demasiados intentos con el código. Espera unos minutos y pide uno nuevo.' })

export const usersRoutes = Router()

// Panel de administración: ver a las personas y asignarles un departamento.
usersRoutes.get('/', requireRole('admin'), validate({ query: listUsersDto }), usersController.list)
// La ficha completa (con la cédula y lo que dice RH Link): solo administración.
usersRoutes.get('/:id', requireRole('admin'), validate({ params: userParamsDto }), usersController.detail)
usersRoutes.patch('/:id', requireRole('admin'), validate({ params: userParamsDto, body: updateUserDto }), usersController.update)
usersRoutes.post('/:id/suspend', requireRole('admin'), validate({ params: userParamsDto }), usersController.suspend)
usersRoutes.post('/:id/reactivate', requireRole('admin'), validate({ params: userParamsDto }), usersController.reactivate)
usersRoutes.post('/:id/reset', requireRole('admin'), validate({ params: userParamsDto }), usersController.reset)
usersRoutes.delete('/:id', requireRole('admin'), validate({ params: userParamsDto }), usersController.remove)

// Lo de la propia persona (/api/me/…).
export const meRoutes = Router()
meRoutes.put('/tour', requireAuth, usersController.markTourSeen)
// Al entrar, quien no tiene departamento tiene que elegir el suyo (una sola vez; después solo administración lo cambia).
meRoutes.put('/department', requireAuth, validate({ body: chooseDepartmentDto }), usersController.chooseDepartment)
// Confirmar el correo de la cuenta con un código que manda Identity Central.
meRoutes.post('/email/code', requireAuth, codeLimit, usersController.requestEmailCode)
meRoutes.post('/email/verify', requireAuth, validate({ body: verifyEmailDto }), verifyLimit, usersController.verifyEmail)
