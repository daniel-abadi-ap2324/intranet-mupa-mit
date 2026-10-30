import type { NextFunction, Request, Response } from 'express'

import { DomainError } from '../errors/domain-error.ts'
import { ValidationError } from '../errors/validation-error.ts'

// Errores de express.json() (cuerpo que no es JSON, o demasiado grande).
type ErrorDeCuerpo = { type?: string }

/**
 * Único manejador de errores. Solo los errores esperados (ValidationError y
 * DomainError) muestran su mensaje; cualquier otro responde un 500 genérico y
 * el detalle queda solo en el log del servidor.
 */
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ValidationError) {
    return res.status(400).json({ error: 'VALIDATION_ERROR', message: err.message, fields: err.fields })
  }
  if (err instanceof DomainError) {
    return res.status(err.statusCode).json({ error: err.code, message: err.message })
  }
  const tipo = (err as ErrorDeCuerpo | null)?.type
  if (tipo === 'entity.parse.failed') {
    return res.status(400).json({ error: 'INVALID_JSON', message: 'El cuerpo de la petición no es JSON válido' })
  }
  if (tipo === 'entity.too.large') {
    return res.status(413).json({ error: 'PAYLOAD_TOO_LARGE', message: 'La petición es demasiado grande' })
  }

  console.error(err)
  return res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Ocurrió un error inesperado' })
}
