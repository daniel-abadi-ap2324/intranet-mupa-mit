import { timingSafeEqual } from 'node:crypto'

import type { NextFunction, Request, Response } from 'express'

import { env } from '../../config/env.ts'
import { DomainError } from '../../shared/errors/domain-error.ts'

/**
 * Para las rutas de servicio a servicio (el MCP): piden la cabecera `X-Internal-Key` con la llave
 * compartida (MCP_INTERNAL_KEY). Sin llave configurada, la ruta no existe (404): queda apagada.
 */
export function requireInternalKey(req: Request, _res: Response, next: NextFunction) {
  const expected = env.MCP_INTERNAL_KEY
  if (!expected) throw new DomainError('La ruta no existe.', 404, 'ROUTE_NOT_FOUND')
  const given = Buffer.from(String(req.get('x-internal-key') ?? ''))
  const wanted = Buffer.from(expected)
  // Misma longitud primero: timingSafeEqual la exige, y comparar en tiempo constante evita adivinar la llave por el tiempo.
  if (given.length !== wanted.length || !timingSafeEqual(given, wanted)) throw new DomainError('La llave interna no es válida.', 401, 'INVALID_INTERNAL_KEY')
  next()
}
