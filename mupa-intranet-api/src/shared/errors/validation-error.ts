export type FieldError = { field: string; message: string }

/** Datos de la petición que no cumplen el DTO. Lleva TODOS los campos inválidos. */
export class ValidationError extends Error {
  readonly fields: FieldError[]

  constructor(fields: FieldError[], message = 'Los datos enviados no son válidos') {
    super(message)
    this.name = 'ValidationError'
    this.fields = fields
  }
}
