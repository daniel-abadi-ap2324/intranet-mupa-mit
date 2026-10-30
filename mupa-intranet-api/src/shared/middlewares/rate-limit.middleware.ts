import type { NextFunction, Request, Response } from 'express'

import { DomainError } from '../errors/domain-error.ts'

/**
 * Límite simple de peticiones por persona (por cuenta si hay sesión; si no, por IP).
 * Vive en memoria del proceso: alcanza con una sola instancia de la API; con varias
 * réplicas haría falta un almacén compartido.
 */
export function rateLimit(options: { max: number; windowMs: number; message: string }) {
  const hits = new Map<string, number[]>()

  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now()
    const since = now - options.windowMs
    // Limpieza ocasional, para que el mapa no crezca sin fin.
    if (hits.size > 5_000) {
      for (const [k, times] of hits) if (times[times.length - 1] <= since) hits.delete(k)
    }

    const key = req.user ? `u:${req.user.id}` : `ip:${req.ip}`
    const recent = (hits.get(key) ?? []).filter((t) => t > since)
    if (recent.length >= options.max) {
      hits.set(key, recent)
      res.set('Retry-After', String(Math.ceil((recent[0] + options.windowMs - now) / 1000)))
      throw new DomainError(options.message, 429, 'RATE_LIMITED')
    }
    recent.push(now)
    hits.set(key, recent)
    next()
  }
}
