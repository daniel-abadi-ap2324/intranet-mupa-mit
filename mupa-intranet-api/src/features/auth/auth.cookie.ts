import type { CookieOptions, Request } from 'express'

import { env } from '../../config/env.ts'

/** Cookie de sesión: HttpOnly (JavaScript no la lee) y SameSite=Lax (no viaja en POST desde otros sitios). */
export const SESSION_COOKIE = 'mupa_sesion'

export function sessionCookieOptions(expires?: Date): CookieOptions {
  return { httpOnly: true, sameSite: 'lax', secure: env.COOKIE_SECURE, path: '/', ...(expires ? { expires } : {}) }
}

export function readSessionToken(req: Request): string | undefined {
  for (const part of (req.headers.cookie ?? '').split(';')) {
    const i = part.indexOf('=')
    if (i > 0 && part.slice(0, i).trim() === SESSION_COOKIE) return part.slice(i + 1).trim() || undefined
  }
  return undefined
}
