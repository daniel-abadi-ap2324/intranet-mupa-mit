import type { NextFunction, Request, Response } from 'express'
import { z, type ZodType } from 'zod'

import { ValidationError, type FieldError } from '../errors/validation-error.ts'

// Mensajes de Zod en español ("Correo electrónico inválido"…).
z.config(z.locales.es())

type Schemas = { params?: ZodType; query?: ZodType; body?: ZodType }

/**
 * Valida params, query y body con los DTO de la ruta. Si algo falla, lanza un
 * ValidationError con todos los campos; si pasa, deja en la petición los datos
 * ya convertidos (números, valores por defecto…).
 */
export function validate(schemas: Schemas) {
  const middleware = (req: Request, _res: Response, next: NextFunction) => {
    const fields: FieldError[] = []
    for (const part of ['params', 'query', 'body'] as const) {
      const schema = schemas[part]
      if (!schema) continue
      const result = schema.safeParse(req[part] ?? {})
      if (!result.success) {
        for (const issue of result.error.issues) fields.push({ field: issue.path.join('.') || part, message: issue.message })
        continue
      }
      // En Express 5 req.query es de solo lectura: se reemplaza en la propia petición.
      Object.defineProperty(req, part, { value: result.data, writable: true, enumerable: true, configurable: true })
    }
    if (fields.length) throw new ValidationError(fields)
    next()
  }
  // Los DTO quedan a la vista para describir qué recibe el endpoint (features/meta).
  return Object.assign(middleware, { validates: schemas })
}
