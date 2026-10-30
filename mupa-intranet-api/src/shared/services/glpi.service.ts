import { z } from 'zod'

import { env, type GlpiConfig } from '../../config/env.ts'
import { DomainError } from '../errors/domain-error.ts'

const UNAVAILABLE = 'La Mesa de Ayuda (GLPI) no responde. Intenta de nuevo en unos minutos.'
const UPSTREAM_ERROR = 'La Mesa de Ayuda (GLPI) tuvo un problema. Intenta de nuevo en unos minutos.'

/** Un ticket de la Mesa de Ayuda, solo lo que se muestra: nunca la descripción ni el seguimiento (traen datos personales). */
export type GlpiTicket = {
  id: number
  title: string
  /** 1 nuevo, 2 en curso (asignado), 3 en curso (planificado), 4 en espera, 5 resuelto, 6 cerrado; 0 si GLPI no lo mandó como número. */
  status: number
  /** "AAAA-MM-DD HH:MM:SS", hora del servidor de GLPI. */
  openedAt: string
  updatedAt: string
}

// Campos de búsqueda de GLPI (search options estándar). User: 2 id, 6 teléfono. Ticket: 1 título, 2 id, 4 solicitante,
// 12 estado, 15 fecha de apertura, 19 última modificación. Nunca se pide el 21 (la descripción).
const USER = { id: 2, phone: 6 }
const TICKET = { title: 1, id: 2, requester: 4, status: 12, openedAt: 15, updatedAt: 19 }
const MAX_TICKETS = 100

const cell = z.union([z.string(), z.number()]).nullish()
const searchSchema = z.object({ totalcount: z.number().optional(), data: z.array(z.record(z.string(), cell)).optional() })
const sessionSchema = z.object({ session_token: z.string().min(1) })

/** Lo que sale de una celda de búsqueda como texto (GLPI a veces manda números como texto y al revés). */
const texto = (v: unknown) => (v === null || v === undefined ? '' : String(v).trim())

/** La cédula como se compara: sin espacios y en mayúsculas («8-123-456», «PE-12-345», «E-8-1234»). */
export const normalizarCedula = (s: string) => s.replace(/\s+/g, '').toUpperCase()

/**
 * Cliente de la API REST de GLPI (Mesa de Ayuda), solo lectura: busca a la persona por su cédula en el campo «Teléfono»
 * de su usuario (así lo guarda la Alcaldía al sincronizar con el AD) y trae los tickets donde es solicitante. Cada consulta
 * abre una sesión con la cuenta de consulta (initSession, con App-Token) y la cierra al final (killSession). La cédula es
 * siempre la de la sesión de quien pregunta. Nunca se registran las llaves, la sesión, la cédula ni la respuesta.
 */
export class GlpiService {
  private readonly config: GlpiConfig

  constructor(config: GlpiConfig) {
    this.config = config
  }

  /** `userFound` false: ningún usuario de GLPI tiene esa cédula en «Teléfono». Si varios la tienen (cuentas repetidas), se juntan sus tickets. */
  async ticketsByCedula(cedula: string): Promise<{ userFound: boolean; tickets: GlpiTicket[] }> {
    const session = await this.openSession()
    try {
      const buscada = normalizarCedula(cedula)
      // «contains» con ^ y $ es la búsqueda exacta de GLPI; además se compara aquí, por si el campo trae espacios.
      const users = await this.search(session, 'User', [{ field: USER.phone, searchtype: 'contains', value: `^${cedula}$` }], [USER.id, USER.phone], 'range=0-9')
      const ids = [...new Set(users.filter((u) => normalizarCedula(texto(u[USER.phone])) === buscada).map((u) => Number(u[USER.id])).filter((n) => Number.isInteger(n) && n > 0))]
      if (!ids.length) return { userFound: false, tickets: [] }

      const rows = await this.search(
        session,
        'Ticket',
        ids.map((id, i) => ({ ...(i ? { link: 'OR' } : {}), field: TICKET.requester, searchtype: 'equals', value: String(id) })),
        [TICKET.id, TICKET.title, TICKET.status, TICKET.openedAt, TICKET.updatedAt],
        `sort=${TICKET.openedAt}&order=DESC&range=0-${MAX_TICKETS - 1}`,
      )
      const tickets = rows
        .map((r) => ({
          id: Number(r[TICKET.id]),
          title: texto(r[TICKET.title]) || 'Ticket sin título',
          status: Number(r[TICKET.status]) || 0,
          openedAt: texto(r[TICKET.openedAt]),
          updatedAt: texto(r[TICKET.updatedAt]) || texto(r[TICKET.openedAt]),
        }))
        .filter((t) => Number.isInteger(t.id) && t.id > 0)
      return { userFound: true, tickets }
    } finally {
      await this.closeSession(session)
    }
  }

  private headers(extra: Record<string, string> = {}): Record<string, string> {
    return { Accept: 'application/json', 'App-Token': this.config.appToken, ...extra }
  }

  private async call(path: string, headers: Record<string, string>): Promise<Response> {
    try {
      return await fetch(`${this.config.url}/${path}`, { headers, redirect: 'manual', signal: AbortSignal.timeout(this.config.timeoutMs) })
    } catch (err) {
      console.error(`GLPI no respondió (${(err as Error).name})`)
      throw new DomainError(UNAVAILABLE, 503, 'GLPI_UNAVAILABLE')
    }
  }

  private async openSession(): Promise<string> {
    const a = this.config.auth
    const authorization = 'userToken' in a ? `user_token ${a.userToken}` : `Basic ${Buffer.from(`${a.login}:${a.password}`).toString('base64')}`
    const res = await this.call('initSession', this.headers({ Authorization: authorization }))
    const parsed = sessionSchema.safeParse(await res.json().catch(() => null))
    if (!res.ok || !parsed.success) {
      // 400/401: la llave de la aplicación (GLPI_APP_TOKEN) o la cuenta de consulta no sirven.
      console.error(`GLPI no abrió la sesión de la cuenta de consulta (respondió ${res.status}). Revisa GLPI_APP_TOKEN y la cuenta.`)
      throw new DomainError(UPSTREAM_ERROR, 502, 'GLPI_ERROR')
    }
    return parsed.data.session_token
  }

  private async closeSession(session: string): Promise<void> {
    try {
      await fetch(`${this.config.url}/killSession`, { headers: this.headers({ 'Session-Token': session }), redirect: 'manual', signal: AbortSignal.timeout(this.config.timeoutMs) })
    } catch {
      // Si no se pudo cerrar, GLPI la vence sola.
    }
  }

  private async search(
    session: string,
    itemtype: 'User' | 'Ticket',
    criteria: { link?: string; field: number; searchtype: string; value: string }[],
    display: number[],
    extra: string,
  ): Promise<Record<string, string | number | null | undefined>[]> {
    const q = new URLSearchParams()
    criteria.forEach((c, i) => {
      if (c.link) q.set(`criteria[${i}][link]`, c.link)
      q.set(`criteria[${i}][field]`, String(c.field))
      q.set(`criteria[${i}][searchtype]`, c.searchtype)
      q.set(`criteria[${i}][value]`, c.value)
    })
    display.forEach((f, i) => q.set(`forcedisplay[${i}]`, String(f)))
    const res = await this.call(`search/${itemtype}?${q}&${extra}`, this.headers({ 'Session-Token': session }))
    // 206: la búsqueda trae solo una parte (el rango pedido); también vale.
    const parsed = searchSchema.safeParse(await res.json().catch(() => null))
    if (!(res.ok || res.status === 206) || !parsed.success) {
      console.error(`GLPI respondió ${res.status} al buscar ${itemtype}${res.ok ? ' con un formato inesperado' : ''}.`)
      throw new DomainError(UPSTREAM_ERROR, 502, 'GLPI_ERROR')
    }
    return parsed.data.data ?? []
  }
}

export const glpiService = env.glpi ? new GlpiService(env.glpi) : null
