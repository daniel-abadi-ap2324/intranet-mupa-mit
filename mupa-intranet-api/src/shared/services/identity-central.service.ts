import { env, type IdentityConfig } from '../../config/env.ts'
import { DomainError } from '../errors/domain-error.ts'
import { ValidationError, type FieldError } from '../errors/validation-error.ts'

/** Lo que interesa de /connect/token (id_token y expires_in no se usan: la hora de vencimiento sale del token verificado). */
export type IssuedTokens = { accessToken: string; refreshToken: string }

/** Alta en el central. `identityNumber` es la cédula: el central la guarda; la intranet no. */
export type Registration = { identityNumber: string; fullName: string; email?: string; password: string; phoneNumber?: string }

export type EmailCodeSent = { maskedEmail: string | null; expiresInMinutes: number | null }

// Campos de validación del central (ProblemDetails de ASP.NET) → campos del registro de la intranet.
const REGISTRATION_FIELDS: Record<string, string> = {
  identitynumber: 'identityNumber',
  email: 'email',
  password: 'password',
  confirmpassword: 'password',
  fullname: 'firstName',
  phonenumber: 'mobile',
}

const TOO_MANY_CODES = 'Pediste varios códigos seguidos. Espera unos minutos y vuelve a intentarlo.'

/**
 * Dos formatos de error: los de OpenIddict ({ error, error_description }, p. ej.
 * invalid_scope) y los propios del central ({ statusCode, message, isSuccess }).
 * Medido en el servidor de desarrollo (2026-09-24): una contraseña mala o un usuario
 * que no existe dan 401 con message "Número de identificación/email o contraseña
 * incorrectos" (la guía documenta 400 invalid_grant: se aceptan los dos), y la falta
 * de rol en la app da 401 "No tienes acceso a esta aplicación" (§2).
 */
type OAuthError = { error?: string; error_description?: string; message?: string }

// Errores que son de configuración de ESTE backend, no de la persona (§6): 500.
const CONFIG_ERRORS = new Set(['invalid_client', 'unauthorized_client', 'invalid_scope', 'unsupported_grant_type', 'invalid_request'])

// Solo el mensaje distingue "sin acceso a la app" de "credenciales malas" (los dos son 401).
// Si no se reconoce, se trata como credenciales malas: así no se revela si el usuario existe.
const isNoAppAccess = (body: OAuthError) => /acceso a esta aplicaci/i.test(`${body.message ?? ''} ${body.error_description ?? ''}`)

/** Mensaje de una respuesta propia del central ({ message, errors: [...] }), en español. */
function centralMessage(body: Record<string, unknown>): string {
  const parts = [typeof body.message === 'string' ? body.message : '']
  if (Array.isArray(body.errors)) {
    for (const e of body.errors) {
      if (typeof e === 'string') parts.push(e)
      else if (e && typeof e === 'object') parts.push(String((e as Record<string, unknown>).description ?? (e as Record<string, unknown>).message ?? ''))
    }
  }
  return [...new Set(parts.map((p) => p.trim()).filter(Boolean))].join(' ')
}

/** Errores de validación del central ({ errors: { Email: ["…"] } }) con los nombres de campo del registro. */
function validationFields(body: Record<string, unknown>): FieldError[] {
  if (!body.errors || typeof body.errors !== 'object' || Array.isArray(body.errors)) return []
  const fields = new Map<string, string>()
  for (const [key, messages] of Object.entries(body.errors as Record<string, unknown>)) {
    const field = REGISTRATION_FIELDS[key.toLowerCase()] ?? key.charAt(0).toLowerCase() + key.slice(1)
    const message = Array.isArray(messages) ? String(messages[0] ?? '') : String(messages ?? '')
    if (message && !fields.has(field)) fields.set(field, message)
  }
  return [...fields].map(([field, message]) => ({ field, message }))
}

const failed = (r: { ok: boolean; body: Record<string, unknown> }) => !r.ok || r.body.isSuccess === false

const UNAVAILABLE = 'El servicio de inicio de sesión de la Alcaldía no responde. Intenta de nuevo en unos minutos.'
const ADMIN_FAILED = 'No se pudo quitar el acceso en Identity Central. La cuenta no se borró; revisa la cuenta de servicio de la API o inténtalo de nuevo.'
const UPSTREAM_ERROR = 'El servicio de inicio de sesión de la Alcaldía tuvo un problema. Intenta de nuevo en unos minutos.'

/**
 * Cliente HTTP de Identity Central (OpenIddict): pide, renueva y revoca tokens; da de
 * alta cuentas y confirma correos con código (el correo lo manda el central).
 * Solo este backend conoce el client_secret; nunca sale en respuestas ni en logs,
 * y tampoco se registran tokens ni cuerpos de las peticiones.
 */
export class IdentityCentralService {
  private readonly config: IdentityConfig

  constructor(config: IdentityConfig) {
    this.config = config
  }

  /** Login con usuario y contraseña (grant `password`, §3.1). */
  async passwordGrant(username: string, password: string): Promise<IssuedTokens> {
    const r = await this.post('/connect/token', {
      grant_type: 'password',
      username,
      password,
      scope: this.config.scopes.join(' '),
    })
    if (r.ok) return this.readTokens(r.body)
    if (r.status === 401 && isNoAppAccess(r.body)) {
      // Contraseña correcta, pero sin rol en la intranet (falta el rol por defecto de la app, §2).
      throw new DomainError('Tu usuario no tiene acceso a la intranet.', 403, 'APP_ACCESS_DENIED')
    }
    if ((r.status === 400 && r.body.error === 'invalid_grant') || (r.status === 401 && !CONFIG_ERRORS.has(r.body.error ?? ''))) {
      throw new DomainError('El usuario o la contraseña no son correctos.', 401, 'INVALID_CREDENTIALS')
    }
    return this.fail('/connect/token (password)', r)
  }

  /** Renueva con el refresh token (§3.2). SIN scope: si se manda, el central rechaza la petición. Devuelve un refresh token NUEVO (§7.1). */
  async refreshGrant(refreshToken: string): Promise<IssuedTokens> {
    const r = await this.post('/connect/token', { grant_type: 'refresh_token', refresh_token: refreshToken })
    if (r.ok) return this.readTokens(r.body)
    if (r.status === 401 && isNoAppAccess(r.body)) {
      throw new DomainError('Tu usuario ya no tiene acceso a la intranet.', 403, 'APP_ACCESS_DENIED')
    }
    // Vencido, revocado o ya canjeado (pasada la ventana de ~30 s).
    if ((r.status === 400 && r.body.error === 'invalid_grant') || (r.status === 401 && !CONFIG_ERRORS.has(r.body.error ?? ''))) {
      throw new DomainError('Tu sesión venció. Vuelve a iniciar sesión.', 401, 'SESSION_EXPIRED')
    }
    return this.fail('/connect/token (refresh_token)', r)
  }

  /** Revoca el refresh token (§3.3). Un 4xx (ya revocado o vencido) también es un cierre de sesión exitoso (§7.4). */
  async revoke(refreshToken: string): Promise<void> {
    const r = await this.post('/connect/revocation', { token: refreshToken, token_type_hint: 'refresh_token' })
    if (r.ok || (r.status >= 400 && r.status < 500)) return
    this.fail('/connect/revocation', r)
  }

  /**
   * Crea la cuenta en el central, con el rol por defecto de la intranet (applicationId).
   * Los errores de validación del central vuelven como ValidationError con los campos
   * del formulario, para que la persona sepa qué corregir.
   */
  async register(data: Registration): Promise<void> {
    const r = await this.send('/api/auth/register', { ...data, confirmPassword: data.password, applicationId: this.config.clientId })
    if (!failed(r)) return
    if (r.status === 429) throw new DomainError('Hubo muchos registros seguidos. Espera unos minutos y vuelve a intentarlo.', 429, 'RATE_LIMITED')
    if (r.status >= 500 || (!r.ok && r.status !== 400 && r.status !== 409)) return this.fail('/api/auth/register', r)

    const fields = validationFields(r.body)
    if (fields.length) throw new ValidationError(fields)
    const message = centralMessage(r.body)
    if (r.status === 409 || /exist|registrad|en uso|already|taken|duplicad/i.test(message)) {
      throw new DomainError('Ya hay una cuenta con esa cédula o ese correo. Entra con ella o recupera tu contraseña.', 409, 'ALREADY_REGISTERED')
    }
    if (/contrase|password/i.test(message)) throw new ValidationError([{ field: 'password', message }])
    throw new DomainError(message || 'El servicio de la Alcaldía no aceptó el registro.', 400, 'REGISTRATION_REJECTED')
  }

  /** Manda (el central, por correo) un código para confirmar ese correo. */
  async requestEmailCode(email: string): Promise<EmailCodeSent> {
    const r = await this.send('/auth/email-verification/request-code', { email, clientId: this.config.clientId })
    if (!failed(r)) {
      const data = (r.body.data ?? {}) as Record<string, unknown>
      return {
        maskedEmail: typeof data.maskedEmail === 'string' ? data.maskedEmail : null,
        expiresInMinutes: typeof data.expiresInMinutes === 'number' ? data.expiresInMinutes : null,
      }
    }
    if (r.status === 429) throw new DomainError(TOO_MANY_CODES, 429, 'RATE_LIMITED')
    if (r.status >= 500 || (r.status !== 400 && !r.ok)) return this.fail('/auth/email-verification/request-code', r)
    throw new DomainError(centralMessage(r.body) || 'No se pudo enviar el código a tu correo.', 400, 'EMAIL_CODE_REJECTED')
  }

  /** Confirma el correo con el código que le llegó a la persona. */
  async verifyEmailCode(email: string, code: string): Promise<void> {
    const r = await this.send('/auth/email-verification/verify', { email, code })
    if (!failed(r) && r.body.data === true) return
    if (r.status === 429) throw new DomainError(TOO_MANY_CODES, 429, 'RATE_LIMITED')
    if (r.status >= 500 || (r.status !== 400 && !r.ok)) return this.fail('/auth/email-verification/verify', r)
    throw new DomainError('El código no es correcto o ya venció. Pide uno nuevo.', 400, 'INVALID_EMAIL_CODE')
  }

  /**
   * Le quita a la persona (su `sub`) el acceso a ESTA aplicación en el central: es lo que hace efectivo «Borrar»,
   * porque la cuenta del central no se puede borrar desde aquí y sirve en otras apps. Usa la cuenta de servicio
   * (IDENTITY_ADMIN_USER). Devuelve false, sin hacer nada, si no está configurada. Si la persona ya no tenía
   * acceso (404), cuenta como hecho.
   */
  async revokeAppAccess(userId: string): Promise<boolean> {
    const admin = this.config.admin
    if (!admin) return false
    const issued = await this.passwordGrant(admin.user, admin.password).catch((err) => {
      if (err instanceof DomainError && err.statusCode < 500) {
        console.error(`Identity Central rechazó la cuenta de servicio (IDENTITY_ADMIN_USER): ${err.code}`)
        throw new DomainError(ADMIN_FAILED, 502, 'IDENTITY_ADMIN_FAILED')
      }
      throw err
    })
    try {
      const query = new URLSearchParams({ userId, applicationId: this.config.clientId })
      const r = await this.send('/api/user-applications/revoke?' + query, {}, { Authorization: 'Bearer ' + issued.accessToken })
      if (r.status === 404 || (r.ok && r.body.isSuccess !== false)) return true
      if (r.status === 401 || r.status === 403) {
        console.error(`Identity Central no dejó quitar el acceso (${r.status}): ¿la cuenta de servicio tiene permisos de administración?`)
        throw new DomainError(ADMIN_FAILED, 502, 'IDENTITY_ADMIN_FAILED')
      }
      return this.fail('/api/user-applications/revoke', r)
    } finally {
      await this.revoke(issued.refreshToken).catch(() => undefined)
    }
  }

  /** Endpoints de OAuth (/connect/*): formulario con las credenciales del cliente. */
  private post(path: string, fields: Record<string, string>) {
    return this.send(path, new URLSearchParams({ ...fields, client_id: this.config.clientId, client_secret: this.config.clientSecret }))
  }

  /** Formulario (URLSearchParams) o JSON (los endpoints propios del central, que no piden el secret). */
  private async send(
    path: string,
    payload: URLSearchParams | Record<string, unknown>,
    extraHeaders: Record<string, string> = {},
  ): Promise<{ ok: boolean; status: number; body: Record<string, unknown> & OAuthError }> {
    const form = payload instanceof URLSearchParams
    let res: Response
    try {
      res = await fetch(this.config.url + path, {
        method: 'POST',
        headers: { 'Content-Type': form ? 'application/x-www-form-urlencoded' : 'application/json', Accept: 'application/json', ...extraHeaders },
        body: form ? payload : JSON.stringify(payload),
        redirect: 'manual',
        signal: AbortSignal.timeout(this.config.timeoutMs),
      })
    } catch (err) {
      console.error(`Identity Central no respondió a ${path}: ${(err as Error).name}`)
      throw new DomainError(UNAVAILABLE, 503, 'IDENTITY_UNAVAILABLE')
    }

    const text = await res.text().catch(() => '')
    let body: Record<string, unknown> | undefined
    try {
      const parsed: unknown = text ? JSON.parse(text) : {}
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) body = parsed as Record<string, unknown>
    } catch {
      // se trata abajo
    }
    const isJson = /\bjson\b/i.test(res.headers.get('content-type') ?? '') && body !== undefined
    // Un 2xx que no es JSON NO es un éxito: en producción las rutas sin el prefijo del
    // proxy caen en un front de Angular que responde 200 con HTML a todo (§7.6).
    if (res.ok && !isJson) {
      console.error(`Identity Central respondió ${res.status} sin JSON en ${path}. ¿IDENTITY_URL apunta al servicio correcto? (guía §7.6)`)
      throw new DomainError(UPSTREAM_ERROR, 502, 'IDENTITY_ERROR')
    }
    return { ok: res.ok, status: res.status, body: isJson ? (body as Record<string, unknown>) : {} }
  }

  private readTokens(body: Record<string, unknown>): IssuedTokens {
    const { access_token: accessToken, refresh_token: refreshToken } = body
    if (typeof accessToken !== 'string' || typeof refreshToken !== 'string') {
      console.error('Identity Central no devolvió access_token y refresh_token. ¿Falta el scope offline_access o el grant refresh_token?')
      throw new DomainError(UPSTREAM_ERROR, 502, 'IDENTITY_ERROR')
    }
    return { accessToken, refreshToken }
  }

  /** 5xx → 502. Cualquier otra cosa inesperada es de configuración: 500 genérico, con el código OAuth solo en el log. */
  private fail(what: string, r: { status: number; body: OAuthError }): never {
    if (r.status >= 500) {
      console.error(`Identity Central respondió ${r.status} en ${what}`)
      throw new DomainError(UPSTREAM_ERROR, 502, 'IDENTITY_ERROR')
    }
    throw new Error(`Identity Central rechazó ${what}: HTTP ${r.status} ${r.body.error ?? '(sin código)'}. Revisa IDENTITY_CLIENT_ID, IDENTITY_CLIENT_SECRET, IDENTITY_SCOPES y los grants del cliente.`)
  }
}

export const identityCentralService = env.identity ? new IdentityCentralService(env.identity) : null
