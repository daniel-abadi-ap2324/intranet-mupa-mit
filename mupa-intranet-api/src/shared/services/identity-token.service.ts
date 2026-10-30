import { createRemoteJWKSet, errors, jwtVerify } from 'jose'
import { z } from 'zod'

import { env, type IdentityConfig } from '../../config/env.ts'
import { DomainError } from '../errors/domain-error.ts'

/** Lo que la intranet usa de un access token ya verificado. */
export type IdentityClaims = {
  /** UUID de la persona en Identity Central: su identidad (§7.8). */
  sub: string
  clientId: string
  expiresAt: Date
  /** Rol EN la intranet: con esto se autoriza (§4). */
  appRoles: string[]
  // Solo vienen en el token del login, no en el del refresh (§7.1): pueden faltar.
  email?: string
  emailVerified?: boolean
  fullName?: string
  name?: string
  /** Puede ser la cédula. Solo se usa en el momento de entrar, para verificarla en RH Link: nunca se guarda ni se registra. */
  identityNumber?: string
}

// "Admin" o ["Admin", "User"] (§7.3): siempre como lista.
const stringOrList = z
  .union([z.string(), z.array(z.string())])
  .optional()
  .transform((v) => (v === undefined ? [] : Array.isArray(v) ? v : [v]).map((s) => s.trim()).filter(Boolean))

// Llega como el string "true"/"false", no como booleano (§7.2). "false" es truthy en JS.
const stringBool = z
  .union([z.boolean(), z.string()])
  .optional()
  .transform((v) => (typeof v === 'boolean' ? v : v?.trim().toLowerCase() === 'true' ? true : v?.trim().toLowerCase() === 'false' ? false : undefined))

const text = z
  .string()
  .optional()
  .transform((s) => s?.trim() || undefined)

/**
 * Claims que se leen. `role` (rol GLOBAL en el central) no se lee a propósito: no
 * sirve para autorizar aquí (un admin de otro sistema no es admin de la intranet).
 * `identity_number` (puede ser la cédula) se lee solo para verificarla en RH Link al entrar; no se guarda.
 */
const claimsSchema = z.object({
  sub: z.string().min(1),
  exp: z.number(),
  client_id: z.string().optional(),
  app_id: z.string().optional(),
  app_role: stringOrList,
  email: text,
  email_verified: stringBool,
  full_name: text,
  name: text,
  identity_number: text,
})

// Firma, formato o claims del token: el token no sirve (401).
const TOKEN_ERRORS = new Set([
  errors.JWSSignatureVerificationFailed.code,
  errors.JWSInvalid.code,
  errors.JWTInvalid.code,
  errors.JWTClaimValidationFailed.code,
  errors.JOSEAlgNotAllowed.code,
  errors.JOSENotSupported.code,
  errors.JWKSNoMatchingKey.code,
  errors.JWKSMultipleMatchingKeys.code,
])

/**
 * Verifica los access tokens de Identity Central (§5): firma RS256 contra el JWKS
 * (cacheado 10 minutos; se vuelve a pedir si llega un `kid` nuevo), `iss` exacto,
 * `exp`, y que el token sea de una aplicación permitida. No valida `aud`: el access
 * token no lo trae.
 */
export class IdentityTokenService {
  private readonly config: IdentityConfig
  private readonly jwks: ReturnType<typeof createRemoteJWKSet>

  constructor(config: IdentityConfig) {
    this.config = config
    this.jwks = createRemoteJWKSet(new URL(config.jwksUri), { cacheMaxAge: 10 * 60_000, timeoutDuration: config.timeoutMs })
  }

  async verify(token: string): Promise<IdentityClaims> {
    let payload: unknown
    try {
      ;({ payload } = await jwtVerify(token, this.jwks, {
        issuer: this.config.issuer,
        // Fijado: sin esto algunas librerías aceptan alg "none" o HS256 con la clave pública.
        algorithms: ['RS256'],
        // "at+jwt" = access token. Un id_token ("JWT") no sirve para autorizar.
        typ: 'at+jwt',
        requiredClaims: ['sub', 'exp'],
        clockTolerance: 30,
      }))
    } catch (err) {
      throw this.toDomainError(err)
    }

    const parsed = claimsSchema.safeParse(payload)
    if (!parsed.success) throw new DomainError('El token no es válido.', 401, 'INVALID_TOKEN')
    const c = parsed.data

    // El central es compartido: un token válido de OTRA app del municipio también pasa la firma.
    const clientId = c.client_id ?? c.app_id
    if (!clientId || ![c.client_id, c.app_id].every((id) => id === undefined || this.config.allowedClientIds.includes(id))) {
      throw new DomainError('Este token es de una aplicación que no tiene acceso a la intranet.', 403, 'CLIENT_NOT_ALLOWED')
    }

    return {
      sub: c.sub,
      clientId,
      expiresAt: new Date(c.exp * 1000),
      appRoles: c.app_role,
      email: c.email,
      emailVerified: c.email_verified,
      fullName: c.full_name,
      name: c.name,
      identityNumber: c.identity_number,
    }
  }

  private toDomainError(err: unknown): DomainError {
    const code = (err as { code?: string } | null)?.code
    if (code === errors.JWTExpired.code) return new DomainError('El token venció.', 401, 'TOKEN_EXPIRED')
    if (code && TOKEN_ERRORS.has(code)) return new DomainError('El token no es válido.', 401, 'INVALID_TOKEN')
    // No se pudo obtener el JWKS: el problema es del central o de la red, no del token.
    if (code === errors.JWKSTimeout.code || !(err instanceof errors.JOSEError)) {
      console.error(`No se pudo descargar el JWKS de Identity Central: ${(err as Error)?.name ?? 'error'}`)
      return new DomainError('El servicio de inicio de sesión de la Alcaldía no responde. Intenta de nuevo en unos minutos.', 503, 'IDENTITY_UNAVAILABLE')
    }
    console.error(`JWKS de Identity Central inválido (${code}). ¿JWT_JWKS_URI apunta al servicio correcto? (guía §7.6)`)
    return new DomainError('El servicio de inicio de sesión de la Alcaldía tuvo un problema. Intenta de nuevo en unos minutos.', 502, 'IDENTITY_ERROR')
  }
}

export const identityTokenService = env.identity ? new IdentityTokenService(env.identity) : null
