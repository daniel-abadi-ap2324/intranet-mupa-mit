import type { CookieOptions, NextFunction, Request, Response } from 'express'

import { env } from '../../config/env.ts'
import { DomainError } from '../errors/domain-error.ts'

/**
 * Cookie de la conexión de invitado a RRHH Express (quien no tiene sesión en la intranet).
 * HttpOnly, SameSite=Lax y solo viaja a /api/rrhh: ninguna otra ruta la ve.
 */
export const GUEST_COOKIE = 'mupa_invitado'
export const GUEST_COOKIE_PATH = '/api/rrhh'

export function guestCookieOptions(): CookieOptions {
  return { httpOnly: true, sameSite: 'lax', secure: env.COOKIE_SECURE, path: GUEST_COOKIE_PATH }
}

export function readGuestToken(req: Request): string | undefined {
  for (const part of (req.headers.cookie ?? '').split(';')) {
    const i = part.indexOf('=')
    if (i > 0 && part.slice(0, i).trim() === GUEST_COOKIE) return part.slice(i + 1).trim() || undefined
  }
  return undefined
}

/**
 * Deja pasar a quien tiene sesión de la intranet (`req.user`, lo llena `authenticate`) o, si no,
 * a quien trae la cookie de invitado (`req.guestToken`; el servicio comprueba que siga vigente).
 * Sin ninguna de las dos: 401.
 */
export function authenticateOrGuest(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) {
    const guest = req.headers.authorization ? undefined : readGuestToken(req)
    if (!guest) throw new DomainError('Inicia sesión o conecta tu cuenta de RRHH Express para continuar.', 401, 'AUTHENTICATION_REQUIRED')
    req.guestToken = guest
  }
  next()
}
