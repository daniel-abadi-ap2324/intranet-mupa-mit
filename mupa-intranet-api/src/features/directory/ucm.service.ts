import crypto from 'node:crypto'
import http from 'node:http'
import https from 'node:https'

import type { UcmConfig } from '../../config/env.ts'

/** Lo único que la intranet toma de cada cuenta de la central (Ley 81): extensión y nombre. */
export type UcmExtension = { ext: string; name: string }

/**
 * Falla de la central. El mensaje nunca lleva la dirección, el usuario ni la respuesta de la central:
 * solo qué paso falló y su código de estado (p. ej. -37 = usuario o contraseña incorrectos).
 */
export class UcmError extends Error {
  readonly status: number | null
  constructor(message: string, status: number | null = null) {
    super(message)
    this.name = 'UcmError'
    this.status = status
  }
}

/** -37: la central rechazó el usuario o la contraseña (y descuenta un intento antes de bloquear la cuenta). */
export const UCM_BAD_CREDENTIALS = -37

const PAGE_SIZE = 1000
const MAX_PAGES = 50

type UcmResponse = { status?: number; response?: Record<string, unknown> }

/**
 * Cliente de solo lectura de la API HTTPS de la central (Grandstream UCM63xx): challenge → login con
 * MD5(challenge + contraseña) → listAccount por páginas → logout. Ninguna acción que cambie la central.
 * El certificado puede ser autofirmado: con tlsVerify = false lo acepta solo este cliente (su propio agente).
 */
export class UcmService {
  private readonly config: UcmConfig
  private readonly endpoint: URL
  private readonly agent: http.Agent

  constructor(config: UcmConfig) {
    this.config = config
    this.endpoint = new URL(/\/api$/.test(config.url) ? config.url : `${config.url}/api`)
    this.agent = this.endpoint.protocol === 'https:' ? new https.Agent({ rejectUnauthorized: config.tlsVerify, keepAlive: false }) : new http.Agent()
  }

  /** Todas las extensiones de la central, solo con su número y nombre. */
  async listExtensions(): Promise<UcmExtension[]> {
    const cookie = await this.login()
    try {
      const out: UcmExtension[] = []
      for (let page = 1; page <= MAX_PAGES; page++) {
        // options: pide solo esas dos columnas (si la central lo ignora, lo demás se descarta igual aquí abajo).
        const r = await this.call('listAccount', { cookie, page, item_num: PAGE_SIZE, sidx: 'extension', sord: 'asc', options: 'extension,fullname' })
        const accounts = Array.isArray(r.account) ? r.account : []
        for (const a of accounts) {
          const ext = typeof a?.extension === 'string' || typeof a?.extension === 'number' ? String(a.extension).trim() : ''
          const name = typeof a?.fullname === 'string' ? a.fullname.replace(/\s+/g, ' ').trim() : ''
          if (/^\d{2,8}$/.test(ext)) out.push({ ext, name })
        }
        const totalPages = Number(r.total_page)
        if (!accounts.length || !Number.isFinite(totalPages) || page >= totalPages) break
      }
      return out
    } finally {
      await this.call('logout', { cookie }).catch(() => undefined)
    }
  }

  private async login(): Promise<string> {
    const c = await this.call('challenge', { user: this.config.user, version: '1.0' })
    if (typeof c.challenge !== 'string') throw new UcmError('la central no devolvió el challenge')
    const token = crypto.createHash('md5').update(c.challenge + this.config.password).digest('hex')
    const l = await this.call('login', { user: this.config.user, token })
    if (typeof l.cookie !== 'string') throw new UcmError('la central no devolvió la sesión')
    return l.cookie
  }

  private async call(action: string, fields: Record<string, unknown>): Promise<Record<string, unknown>> {
    const body = JSON.stringify({ request: { action, ...fields } })
    const json = await this.post(body, action)
    if (json.status !== 0) throw new UcmError(`la central respondió ${action} con estado ${json.status ?? 'desconocido'}`, json.status ?? null)
    return json.response ?? {}
  }

  private post(body: string, action: string): Promise<UcmResponse> {
    const transport = this.endpoint.protocol === 'https:' ? https : http
    return new Promise((resolve, reject) => {
      const req = transport.request(
        this.endpoint,
        {
          method: 'POST',
          agent: this.agent,
          timeout: this.config.timeoutMs,
          headers: { 'Content-Type': 'application/json;charset=UTF-8', 'Content-Length': Buffer.byteLength(body) },
        },
        (res) => {
          const chunks: Buffer[] = []
          res.on('data', (c: Buffer) => chunks.push(c))
          res.on('end', () => {
            if ((res.statusCode ?? 0) >= 400) return reject(new UcmError(`la central respondió ${action} con HTTP ${res.statusCode}`))
            try {
              resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')) as UcmResponse)
            } catch {
              reject(new UcmError(`la central no respondió JSON en ${action}`))
            }
          })
        },
      )
      req.on('timeout', () => req.destroy(new UcmError(`la central no respondió ${action} a tiempo`)))
      // Errores de red o de certificado: solo su código (ECONNREFUSED, SELF_SIGNED_CERT…), nunca la dirección.
      req.on('error', (e: NodeJS.ErrnoException) => reject(e instanceof UcmError ? e : new UcmError(`no se pudo conectar con la central en ${action} (${e.code ?? 'error de red'})`)))
      req.end(body)
    })
  }
}
