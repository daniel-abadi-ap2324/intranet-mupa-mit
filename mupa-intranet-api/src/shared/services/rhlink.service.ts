import type { ZodType } from 'zod'

import { env, type RrhhConfig, type RrhhVerification } from '../../config/env.ts'
import { DomainError } from '../errors/domain-error.ts'

const UNAVAILABLE = 'El sistema de RRHH no responde. Intenta de nuevo en unos minutos.'
const UPSTREAM_ERROR = 'El sistema de RRHH tuvo un problema. Intenta de nuevo en unos minutos.'

type Method = 'GET' | 'POST' | 'PATCH'

/** Lo único que la intranet toma de la ficha del funcionario en RH Link. */
export type FuncionarioRrhh = { active: boolean; locationCode: number | null; /** Solo se usa para crear la cuenta de esa misma persona al registrarse. */ fullName: string | null }

/**
 * Cliente HTTP de RH Link, el backend de RRHH (el mismo que usa RRHH Express, el
 * autoservicio del personal). Se entra con cédula y contraseña de RRHH Express y
 * RH Link devuelve un token que SOLO abre los datos de esa cédula (lo controla RH Link).
 *
 * Nunca se registran la contraseña, la cédula, el token ni los cuerpos: en los logs
 * va solo el método, la ruta sin parámetros y el estado.
 */
export class RhLinkService {
  private readonly config: RrhhConfig
  private readonly verification: RrhhVerification | null
  // Token de AD de la cuenta de la API (solo para preguntar quién es funcionario) y hasta cuándo sirve.
  private adToken: { token: string; until: number } | null = null
  private adLogin: Promise<string> | null = null

  constructor(config: RrhhConfig, verification: RrhhVerification | null = null) {
    this.config = config
    this.verification = verification
  }

  /** Si la API tiene cuenta de AD para verificar funcionarios (RRHH_API_USER y RRHH_API_PASSWORD). */
  get canVerifyFuncionarios(): boolean {
    return this.verification !== null
  }

  /**
   * El funcionario de esa cédula en RH Link, o null si no está. Se pregunta con la cuenta de AD de la API
   * (GET empleados/cedula/:cedula). De la ficha solo se lee el estado (ACTIVA), el código de su ubicación (para
   * saber su departamento) y, al registrarse, su nombre (para no pedírselo); salario, fecha de nacimiento… no se leen ni se guardan, y la cédula no se
   * registra en logs. Si RH Link no responde lanza el error (503/502): quien llama decide, y al entrar se niega el paso.
   */
  async findFuncionario(cedula: string): Promise<FuncionarioRrhh | null> {
    for (let attempt = 0; attempt < 2; attempt++) {
      const token = await this.adAccessToken(attempt > 0)
      const r = await this.send('GET', `/empleados/cedula/${encodeURIComponent(cedula)}`, token)
      // Token de AD vencido o revocado: se vuelve a entrar una vez.
      if (r.status === 401 || r.status === 403) {
        this.adToken = null
        continue
      }
      if (r.status === 404) return null
      if (!r.ok || r.body.success === false) return this.fail('GET empleados/cedula', r.status)
      const data = (r.body.data ?? {}) as Record<string, unknown>
      const code = Number(data.ubicacion_codigo)
      return {
        active: typeof data.estado_funcionario === 'string' && data.estado_funcionario.trim().toUpperCase() === 'ACTIVA',
        locationCode: data.ubicacion_codigo != null && Number.isInteger(code) ? code : null,
        fullName: typeof data.nombre === 'string' && data.nombre.trim() ? data.nombre.trim().replace(/\s+/g, ' ') : null,
      }
    }
    console.error('RH Link rechazó dos veces el token de la cuenta de la API (RRHH_API_USER): ¿cambió la contraseña o el permiso?')
    throw new DomainError(UPSTREAM_ERROR, 502, 'RRHH_ERROR')
  }

  /** Token de AD de la cuenta de la API: se reutiliza hasta poco antes de vencer; un solo login a la vez. */
  private async adAccessToken(force: boolean): Promise<string> {
    if (!force && this.adToken && this.adToken.until > Date.now()) return this.adToken.token
    this.adLogin ??= this.loginAd().finally(() => {
      this.adLogin = null
    })
    return this.adLogin
  }

  private async loginAd(): Promise<string> {
    if (!this.verification) throw new DomainError(UPSTREAM_ERROR, 502, 'RRHH_ERROR')
    const r = await this.send('POST', '/api/login', undefined, { username: this.verification.user, password: this.verification.password })
    const tokens = (r.body.tokens ?? {}) as Record<string, unknown>
    if (r.status === 401 || r.status === 400) {
      console.error('RH Link no aceptó la cuenta de AD de la API (RRHH_API_USER / RRHH_API_PASSWORD).')
      throw new DomainError(UPSTREAM_ERROR, 502, 'RRHH_ERROR')
    }
    if (!r.ok || r.body.success === false || typeof tokens.accessToken !== 'string') return this.fail('POST api/login', r.status)
    this.adToken = { token: tokens.accessToken, until: tokenExpiry(tokens.accessToken) }
    return tokens.accessToken
  }

  /** Login de RRHH Express. Devuelve el token (JWT de RH Link, ~8 h). */
  async loginCedula(cedula: string, password: string): Promise<string> {
    const r = await this.send('POST', '/api/auth/login-cedula', undefined, { cedula, password })
    if (r.status === 401 || r.status === 400) {
      throw new DomainError('La cédula o la contraseña de RRHH Express no son correctas, o la cuenta no está activa.', 401, 'RRHH_CREDENCIALES')
    }
    if (!r.ok || r.body.success === false || typeof r.body.token !== 'string') return this.fail('POST login-cedula', r.status)
    return r.body.token
  }

  /** Petición con el token de la persona. La respuesta se valida con `schema` (solo se toma lo que se usa). */
  async request<T>(method: Method, path: string, token: string, schema: ZodType<T>, body?: Record<string, unknown>): Promise<T> {
    const r = await this.send(method, path, token, body)
    const what = `${method} ${path.split('?')[0].replace(/\/[^/]*\d[^/]*/g, '/:x')}`
    const message = typeof r.body.message === 'string' ? r.body.message : typeof r.body.mensaje === 'string' ? r.body.mensaje : ''
    // Token vencido, revocado o que no es de funcionario: hay que volver a conectar. RH Link también
    // responde 403 a "no es tuyo" (otra cédula u otra solicitud): eso no desconecta.
    if (r.status === 401 || (r.status === 403 && (!message || /token/i.test(message)))) {
      throw new DomainError('Tu conexión con RRHH Express venció. Vuelve a conectarla.', 401, 'RRHH_DESCONECTADO')
    }
    // Reglas de RH Link (saldo insuficiente, día ya reclamado, sin datos, no es tuyo…): su mensaje ya está en español.
    if (r.status === 400 || r.status === 403 || r.status === 404 || r.status === 409) {
      throw new DomainError(message.trim() || 'RRHH no aceptó la solicitud.', r.status, 'RRHH_RECHAZADO')
    }
    if (!r.ok || r.body.success === false) return this.fail(what, r.status)
    const parsed = schema.safeParse(r.body)
    if (!parsed.success) {
      console.error(`RH Link respondió con un formato inesperado en ${what}: ${parsed.error.issues.map((i) => i.path.join('.')).join(', ')}`)
      throw new DomainError(UPSTREAM_ERROR, 502, 'RRHH_ERROR')
    }
    return parsed.data
  }

  private async send(method: Method, path: string, token: string | undefined, body?: Record<string, unknown>) {
    const headers: Record<string, string> = { Accept: 'application/json' }
    if (token) headers.Authorization = `Bearer ${token}`
    if (body) headers['Content-Type'] = 'application/json'
    let res: Response
    try {
      res = await fetch(this.config.url + path, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        redirect: 'manual',
        signal: AbortSignal.timeout(this.config.timeoutMs),
      })
    } catch (err) {
      console.error(`RH Link no respondió (${(err as Error).name})`)
      throw new DomainError(UNAVAILABLE, 503, 'RRHH_UNAVAILABLE')
    }
    const text = await res.text().catch(() => '')
    let parsed: unknown
    try {
      parsed = text ? JSON.parse(text) : {}
    } catch {
      parsed = undefined
    }
    const isJson = parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)
    // Un 2xx sin JSON (p. ej. una página HTML de un proxy) no es un éxito.
    if (res.ok && !isJson) {
      console.error(`RH Link respondió ${res.status} sin JSON. ¿RRHH_API_URL apunta al servicio correcto?`)
      throw new DomainError(UPSTREAM_ERROR, 502, 'RRHH_ERROR')
    }
    return { ok: res.ok, status: res.status, body: (isJson ? parsed : {}) as Record<string, unknown> }
  }

  private fail(what: string, status: number): never {
    console.error(`RH Link respondió ${status} en ${what}`)
    throw new DomainError(UPSTREAM_ERROR, 502, 'RRHH_ERROR')
  }
}

/** Hasta cuándo sirve un JWT (su `exp`, con un minuto de margen). Si no se puede leer, 10 minutos. */
function tokenExpiry(token: string): number {
  try {
    const exp = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8')).exp
    if (typeof exp === 'number') return exp * 1000 - 60_000
  } catch {
    // sin exp legible: el margen de abajo
  }
  return Date.now() + 10 * 60_000
}

export const rhLinkService = env.rrhh ? new RhLinkService(env.rrhh, env.rrhhVerification) : null
