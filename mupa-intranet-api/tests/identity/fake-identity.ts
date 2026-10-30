/**
 * Identity Central FALSO para las pruebas: imita lo que la guía capturó del servidor
 * real (OpenIddict). Tokens RS256 con typ "at+jwt", el refresh rota el token y trae
 * menos claims, rechaza `scope` en el refresh, y la revocación responde {} siempre.
 * Todas las personas son ficticias.
 */
import { randomBytes, randomUUID } from 'node:crypto'
import type { Server } from 'node:http'

import express, { type Response } from 'express'
import { exportJWK, generateKeyPair, SignJWT, type JWTPayload } from 'jose'

export type FakeUser = {
  username: string
  password: string
  sub: string
  fullName: string
  email?: string
  emailVerified?: boolean
  appRole?: string | string[]
  /** true = el token del refresh llega sin app_role (la guía dice que sí viene; se prueba por si acaso). */
  omitAppRoleOnRefresh?: boolean
  role?: string | string[]
  /** false = existe pero no tiene rol en la aplicación (401 "No tienes acceso a esta aplicación"). */
  access?: boolean
  /** El claim identity_number del token (por defecto, el username). */
  identityNumber?: string
}

type RefreshEntry = { username: string; redeemedAt?: number; revoked?: boolean }
type Override = { status: number; body?: string; contentType?: string } | 'drop'

export async function startFakeIdentity(options: { url: string; clientId: string; clientSecret: string; accessTokenTtl?: string | number }) {
  const { publicKey, privateKey } = await generateKeyPair('RS256', { extractable: true })
  const kid = 'clave-de-prueba'
  const issuer = options.url + '/'
  const users = new Map<string, FakeUser>()
  const refreshTokens = new Map<string, RefreshEntry>()
  const requests: { path: string; form: Record<string, string> }[] = []
  /** Correo → último código enviado. */
  const emailCodes = new Map<string, string>()
  // emailRequired: como el servidor de desarrollo el 2026-09-29 ("El email es requerido").
  const state = { jwksRequests: 0, next: null as Override | null, issuer, emailRequired: true, codesSent: 0 }

  async function sign(payload: JWTPayload, header: { typ?: string; kid?: string } = {}, key = privateKey, expiresIn: string | number = '1h') {
    return new SignJWT(payload)
      .setProtectedHeader({ alg: 'RS256', kid, typ: 'at+jwt', ...header })
      .setIssuedAt()
      .setExpirationTime(expiresIn)
      .sign(key)
  }

  /** Claims como en la captura real de la guía (§4). El del refresh no trae email, email_verified, preferred_username ni full_name (§7.1). */
  function claimsFor(u: FakeUser, fromRefresh: boolean): JWTPayload {
    const base: JWTPayload = {
      iss: state.issuer,
      scope: 'openid profile email offline_access roles',
      jti: randomUUID(),
      sub: u.sub,
      name: u.fullName,
      identity_number: u.identityNumber ?? u.username,
      role: u.role ?? 'User',
      app_id: options.clientId,
      app_role: u.appRole ?? 'User',
      client_id: options.clientId,
      oi_prst: options.clientId,
      oi_au_id: randomUUID(),
      oi_tkn_id: randomUUID(),
    }
    if (fromRefresh && u.omitAppRoleOnRefresh) delete base.app_role
    if (fromRefresh) return base
    return { ...base, email: u.email, email_verified: String(u.emailVerified ?? false), preferred_username: u.username, full_name: u.fullName }
  }

  async function issue(res: Response, u: FakeUser, fromRefresh: boolean) {
    const refreshToken = randomBytes(2200).toString('base64url') // ~3 KB, como el JWE real (§7.9)
    refreshTokens.set(refreshToken, { username: u.username })
    res.json({
      access_token: await sign(claimsFor(u, fromRefresh), {}, privateKey, options.accessTokenTtl),
      token_type: 'Bearer',
      expires_in: 3600,
      id_token: await sign({ iss: state.issuer, sub: u.sub, aud: options.clientId }, { typ: 'JWT' }),
      refresh_token: refreshToken,
      // El login NO devuelve scope; el refresh sí (§3.1).
      ...(fromRefresh ? { scope: 'openid profile email offline_access roles' } : {}),
    })
  }

  const app = express()
  app.use(express.urlencoded({ extended: false }))
  app.use(express.json())

  app.get('/.well-known/jwks', async (_req, res) => {
    state.jwksRequests++
    res.json({ keys: [{ ...(await exportJWK(publicKey)), kid, alg: 'RS256', use: 'sig' }] })
  })

  // Respuesta forzada para la próxima petición al central (errores del central).
  app.use(['/connect', '/api', '/auth'], (req, res, next) => {
    requests.push({ path: req.path, form: { ...req.body } })
    const o = state.next
    if (!o) return next()
    state.next = null
    if (o === 'drop') return req.socket.destroy()
    res.status(o.status).type(o.contentType ?? 'application/json').send(o.body ?? '')
  })

  const oauthError = (res: Response, status: number, error: string, description: string) =>
    res.status(status).json({ error, error_description: description })
  // Formato propio del central (no OAuth), medido en el servidor de desarrollo el 2026-09-24.
  const centralError = (res: Response, message: string) =>
    res.status(401).json({ statusCode: 401, data: null, message, isSuccess: false, errors: null, timestamp: new Date().toISOString() })

  app.post('/connect/token', async (req, res) => {
    const f = req.body as Record<string, string>
    if (f.client_id !== options.clientId || f.client_secret !== options.clientSecret) {
      return oauthError(res, 400, 'invalid_client', 'The specified client credentials are invalid.')
    }
    if (f.grant_type === 'password') {
      if (/\b(phone|address)\b/.test(f.scope ?? '')) return oauthError(res, 400, 'invalid_scope', 'The specified scope is invalid.')
      const u = users.get(f.username)
      if (!u || u.password !== f.password) return centralError(res, 'Número de identificación/email o contraseña incorrectos')
      if (u.access === false) return centralError(res, 'No tienes acceso a esta aplicación')
      return issue(res, u, false)
    }
    if (f.grant_type === 'refresh_token') {
      if (f.scope !== undefined) return oauthError(res, 400, 'invalid_request', 'The scope parameter is not allowed here.')
      const entry = refreshTokens.get(f.refresh_token)
      if (!entry || entry.revoked) return oauthError(res, 400, 'invalid_grant', 'The specified refresh token is no longer valid.')
      // Rota: el viejo sirve ~30 s más (peticiones concurrentes) y después ya no (§7.1).
      if (entry.redeemedAt && Date.now() - entry.redeemedAt > 30_000) {
        return oauthError(res, 400, 'invalid_grant', 'The specified refresh token has already been redeemed.')
      }
      entry.redeemedAt ??= Date.now()
      const u = users.get(entry.username)
      if (!u) return oauthError(res, 400, 'invalid_grant', 'The specified refresh token is no longer valid.')
      if (u.access === false) return centralError(res, 'No tienes acceso a esta aplicación')
      return issue(res, u, true)
    }
    return oauthError(res, 400, 'unsupported_grant_type', 'The specified grant type is not supported.')
  })

  // Respuestas propias del central (BaseResponse) y de validación de ASP.NET (ProblemDetails), como las del servidor real.
  const baseResponse = (res: Response, status: number, data: unknown, message: string | null = null) =>
    res.status(status).json({ statusCode: status, data, message, isSuccess: status < 300, errors: null, timestamp: new Date().toISOString() })
  const problem = (res: Response, errors: Record<string, string[]>) =>
    res
      .status(400)
      .type('application/problem+json')
      .send(JSON.stringify({ type: 'https://tools.ietf.org/html/rfc9110#section-15.5.1', title: 'One or more validation errors occurred.', status: 400, errors }))

  app.post('/api/auth/register', (req, res) => {
    const b = req.body as Record<string, string | undefined>
    const errors: Record<string, string[]> = {}
    if (!b.identityNumber) errors.IdentityNumber = ['El número de identificación es requerido.']
    if (!b.email && state.emailRequired) errors.Email = ['El email es requerido.', 'El email no es válido.']
    if (!b.password || b.password.length < 8) errors.Password = ['La contraseña debe tener al menos 8 caracteres.']
    if (b.password !== b.confirmPassword) errors.ConfirmPassword = ['Las contraseñas no coinciden.']
    if (Object.keys(errors).length) return problem(res, errors)
    if (users.has(b.identityNumber!) || (b.email && users.has(b.email))) {
      return baseResponse(res, 400, null, 'Ya existe un usuario con ese número de identificación.')
    }
    const u: FakeUser = {
      username: b.identityNumber!,
      password: b.password!,
      sub: randomUUID(),
      fullName: b.fullName ?? '',
      email: b.email,
      // Con el applicationId de la app, queda con su rol por defecto.
      access: b.applicationId === options.clientId,
    }
    users.set(u.username, u)
    if (u.email) users.set(u.email, u)
    baseResponse(res, 200, { userId: u.sub, identityNumber: u.username, email: u.email ?? null, fullName: u.fullName })
  })

  app.post('/auth/email-verification/request-code', (req, res) => {
    const { email } = req.body as { email?: string }
    if (!email) return problem(res, { Email: ['El email es requerido', 'Email inválido'] })
    const code = String(100_000 + ++state.codesSent)
    emailCodes.set(email.toLowerCase(), code)
    baseResponse(res, 200, { maskedEmail: email.replace(/^(.{2}).*@/, '$1***@'), expiresInMinutes: 10 })
  })

  app.post('/auth/email-verification/verify', (req, res) => {
    const { email, code } = req.body as { email?: string; code?: string }
    if (!email || !code || emailCodes.get(email.toLowerCase()) !== code) return baseResponse(res, 400, false, 'Código inválido o expirado.')
    emailCodes.delete(email.toLowerCase())
    for (const u of users.values()) if (u.email?.toLowerCase() === email.toLowerCase()) u.emailVerified = true
    baseResponse(res, 200, true)
  })

  // Quitar el acceso a una app (cuenta de servicio con Bearer de un admin). Guarda lo pedido en `revokedAccess`.
  const revokedAccess: { userId: string; applicationId: string }[] = []
  app.post('/api/user-applications/revoke', (req, res) => {
    if (!/^Bearer \S+/.test(req.headers.authorization ?? '')) return baseResponse(res, 401, false, 'No autorizado')
    const userId = String(req.query.userId ?? '')
    const applicationId = String(req.query.applicationId ?? '')
    if ([...users.values()].every((u) => u.sub !== userId)) return baseResponse(res, 404, false, 'Usuario no encontrado')
    revokedAccess.push({ userId, applicationId })
    baseResponse(res, 200, true)
  })

  app.post('/connect/revocation', (req, res) => {
    const f = req.body as Record<string, string>
    if (f.client_id !== options.clientId || f.client_secret !== options.clientSecret) {
      return oauthError(res, 400, 'invalid_client', 'The specified client credentials are invalid.')
    }
    const entry = refreshTokens.get(f.token)
    if (entry) entry.revoked = true
    // Idempotente: repetir la revocación sigue respondiendo 200 (§3.3).
    res.json({})
  })

  const { port } = new URL(options.url)
  const server: Server = await new Promise((resolve) => {
    const s = app.listen(Number(port), '127.0.0.1', () => resolve(s))
  })

  return {
    issuer,
    kid,
    users,
    refreshTokens,
    requests,
    revokedAccess,
    state,
    addUser(u: FakeUser) {
      users.set(u.username, u)
      return u
    },
    /** Último código de verificación que "llegó" a ese correo. */
    codeFor(email: string) {
      return emailCodes.get(email.toLowerCase())
    },
    /** Último refresh token emitido a esa persona. */
    lastRefreshTokenFor(username: string) {
      return [...refreshTokens].filter(([, e]) => e.username === username).at(-1)?.[0]
    },
    /** Access token como el del login (o el del refresh), para probar la validación con Bearer. */
    accessTokenFor(u: FakeUser, fromRefresh = false) {
      return sign(claimsFor(u, fromRefresh))
    },
    sign,
    /** Otra clave RSA: firma válida, pero no es la del JWKS. */
    async otherKey() {
      return (await generateKeyPair('RS256')).privateKey
    },
    /** Fuerza la respuesta de la próxima petición a /connect/*; 'drop' corta la conexión (central inalcanzable). */
    failNext(o: Override) {
      state.next = o
    },
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  }
}

export type FakeIdentity = Awaited<ReturnType<typeof startFakeIdentity>>
