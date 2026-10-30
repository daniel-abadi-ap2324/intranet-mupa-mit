import type { NextFunction, Request, Response } from 'express'

import { DomainError } from '../../shared/errors/domain-error.ts'
import { hasRole, type Role } from '../../shared/roles.ts'
import { userResponseDto } from '../users/dtos/user-response.dto.ts'
import { readSessionToken } from './auth.cookie.ts'
import { authService } from './auth.service.ts'

/** Token de `Authorization: Bearer <token>`; undefined si no viene ese encabezado. */
function readBearerToken(req: Request): string | undefined {
  const match = /^Bearer(?:\s+(.*))?$/i.exec(req.headers.authorization?.trim() ?? '')
  return match ? (match[1] ?? '').trim() : undefined
}

/**
 * Identifica a la persona y la deja en req.user. Dos credenciales:
 *  - `Authorization: Bearer <access token de Identity Central>` (Postman, otras apps
 *    de ALLOWED_CLIENT_IDS): se verifica el JWT en cada petición. Si no sirve,
 *    responde 401 (403 si es de una app no permitida), para que el cliente renueve.
 *  - la cookie de sesión de la SPA: si no es válida, la petición sigue sin sesión
 *    (el sitio público se ve igual).
 * No va en login, refresh ni logout: su propósito es obtener o cerrar la sesión (§1).
 */
export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  const bearer = readBearerToken(req)
  if (bearer !== undefined) {
    if (!bearer) throw new DomainError('El token no es válido.', 401, 'INVALID_TOKEN')
    req.user = userResponseDto.parse(await authService.findUserByAccessToken(bearer))
    return next()
  }
  const token = readSessionToken(req)
  if (token) {
    const user = await authService.findUserBySessionToken(token)
    if (user) req.user = userResponseDto.parse(user)
  }
  next()
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) throw new DomainError('Inicia sesión para continuar.', 401, 'AUTHENTICATION_REQUIRED')
  next()
}
// Marca para describir el endpoint (features/meta): pide sesión, sin un rol en particular.
Object.assign(requireAuth, { requiresSession: true })

export function requireRole(...roles: Role[]) {
  const middleware = (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) throw new DomainError('Inicia sesión para continuar.', 401, 'AUTHENTICATION_REQUIRED')
    if (!hasRole(req.user, ...roles)) throw new DomainError('No tienes permiso para hacer esto.', 403, 'FORBIDDEN')
    next()
  }
  // Los roles quedan a la vista para describir el endpoint (features/meta), sin repetirlos a mano.
  return Object.assign(middleware, { requiredRoles: roles as readonly Role[] })
}
