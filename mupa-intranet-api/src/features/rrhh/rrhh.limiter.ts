import { createHmac, randomBytes } from 'node:crypto'

import { DomainError } from '../../shared/errors/domain-error.ts'
import { CONNECT_LIMIT_CEDULA, CONNECT_LIMIT_IP } from './rrhh.constants.ts'

const TOO_MANY = 'Hiciste varios intentos seguidos. Espera unos minutos e intenta de nuevo.'

/**
 * Límite de intentos para conectar RRHH Express: por cédula (sin importar IP ni sesión, para que no se
 * pueda adivinar el número de cargo de una persona desde varios lados) y por IP. Vive en memoria de un solo
 * proceso. La cédula nunca se guarda en claro: la clave del HMAC nace al arrancar y no se guarda en ningún lado.
 *
 * Cada intento se cuenta al empezar (para que peticiones en paralelo no se cuelen) y se devuelve si
 * RH Link acepta las credenciales: solo los fallos gastan el cupo.
 */
export class ConnectLimiter {
  private readonly salt = randomBytes(32)
  private readonly hits = new Map<string, number[]>()

  /** Cuenta un intento. Lanza 429 si ya se gastó el cupo de la cédula o de la IP. Devuelve cómo devolverlo. */
  reserve(cedula: string, ip: string | undefined): () => void {
    const now = Date.now()
    const keys: Array<[string, { max: number; windowMs: number }]> = [
      [`c:${createHmac('sha256', this.salt).update(cedula.toUpperCase()).digest('hex')}`, CONNECT_LIMIT_CEDULA],
      [`i:${ip ?? 'desconocida'}`, CONNECT_LIMIT_IP],
    ]
    this.sweep(now)
    for (const [key, limit] of keys) {
      const recent = this.recent(key, limit.windowMs, now)
      if (recent.length >= limit.max) {

        throw new DomainError(TOO_MANY, 429, 'RRHH_DEMASIADOS_INTENTOS')
      }
    }
    const marks = keys.map(([key, limit]) => {
      const list = this.recent(key, limit.windowMs, now)
      list.push(now)
      this.hits.set(key, list)
      return { key, list, at: now }
    })
    return () => {
      for (const m of marks) {
        const i = m.list.indexOf(m.at)
        if (i >= 0) m.list.splice(i, 1)
      }
    }
  }

  /** Solo para las pruebas. */
  reset() {
    this.hits.clear()
  }

  private recent(key: string, windowMs: number, now: number): number[] {
    return (this.hits.get(key) ?? []).filter((t) => t > now - windowMs)
  }

  private sweep(now: number) {
    if (this.hits.size < 5_000) return
    const oldest = now - Math.max(CONNECT_LIMIT_CEDULA.windowMs, CONNECT_LIMIT_IP.windowMs)
    for (const [k, times] of this.hits) if (!times.length || times[times.length - 1] <= oldest) this.hits.delete(k)
  }
}

export const connectLimiter = new ConnectLimiter()
