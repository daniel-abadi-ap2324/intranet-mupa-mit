/**
 * Falla esperada de una regla de negocio. Su mensaje se muestra tal cual al
 * cliente: escríbelo para la persona que usa la intranet.
 */
export class DomainError extends Error {
  readonly statusCode: number
  readonly code: string

  constructor(message: string, statusCode: number, code: string) {
    super(message)
    this.name = 'DomainError'
    this.statusCode = statusCode
    this.code = code
  }
}
