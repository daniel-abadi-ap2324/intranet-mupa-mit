import { env } from '../../config/env.ts'
import type { SessionRow, UserRow } from '../../database/schema/index.ts'
import { CEDULA } from '../../shared/cedula.ts'
import { DomainError } from '../../shared/errors/domain-error.ts'
import { rolesFromAppRoles } from '../../shared/roles.ts'
import { hashService, type HashService } from '../../shared/services/hash.service.ts'
import { rhLinkService, type FuncionarioRrhh } from '../../shared/services/rhlink.service.ts'
import { identityCentralService, type IdentityCentralService } from '../../shared/services/identity-central.service.ts'
import { identityTokenService, type IdentityClaims, type IdentityTokenService } from '../../shared/services/identity-token.service.ts'
import { tokenService, type TokenService } from '../../shared/services/token.service.ts'
import { usersService, type UsersService } from '../users/users.service.ts'
import { authRepository, type AuthRepository } from './auth.repository.ts'

/** La cédula de la sesión se cifra con una clave propia (derivada de la cookie): no se descifra con la de otro secreto. */
export const CEDULA_PURPOSE = 'mupa-intranet:session-cedula'

const MAX_FAILED_ATTEMPTS = 5
const LOCK_MINUTES = 10

/** clientId: el de la intranet. Solo en SUS tokens el app_role es un rol de la intranet. */
type Identity = { central: IdentityCentralService; tokens: IdentityTokenService; clientId: string }
type OpenedSession = { user: UserRow; token: string; expiresAt: Date }
/** Quien dice si una cédula es de un funcionario activo (RH Link). */
type FuncionarioVerifier = { findFuncionario(cedula: string): Promise<FuncionarioRrhh | null> }

const suspendedError = (user: UserRow) =>
  new DomainError(user.deletedAt ? 'Tu cuenta fue eliminada. Comunícate con administración.' : 'Tu cuenta está suspendida. Comunícate con administración.', 403, 'ACCOUNT_SUSPENDED')

function splitName(fullName: string): { firstName: string; lastName: string | null } {
  const [firstName, ...rest] = fullName.trim().split(/\s+/)
  return { firstName, lastName: rest.join(' ') || null }
}

/**
 * Con la verificación de funcionarios prendida (RRHH_API_USER en el .env), quien entra por Identity Central
 * tiene que ser un funcionario ACTIVO en RH Link: si no, no hay sesión. Las cuentas locales (de prueba) no la pasan.
 *
 * Entrar y salir. Dos caminos, y los dos terminan en la misma sesión propia
 * (cookie HttpOnly con un token opaco):
 *  - Identity Central (login de la Alcaldía): este backend hace de intermediario;
 *    los tokens del central nunca llegan al navegador.
 *  - Cuentas locales con contraseña (las ficticias de prueba), solo con LOCAL_LOGIN_ENABLED.
 */
export class AuthService {
  private readonly repository: AuthRepository
  private readonly users: UsersService
  private readonly hash: HashService
  private readonly tokens: TokenService
  private readonly identity: Identity | null
  private readonly localLogin: boolean
  private readonly funcionarios: FuncionarioVerifier | null
  // Una renovación por sesión a la vez: la SPA pide varias cosas en paralelo al cargar.
  private readonly refreshing = new Map<number, Promise<UserRow>>()

  constructor(
    repository: AuthRepository,
    users: UsersService,
    hash: HashService,
    tokens: TokenService,
    identity: Identity | null,
    localLogin: boolean,
    funcionarios: FuncionarioVerifier | null = null,
  ) {
    this.repository = repository
    this.users = users
    this.hash = hash
    this.tokens = tokens
    this.identity = identity
    this.localLogin = localLogin
    this.funcionarios = funcionarios
  }

  /** Si el usuario es el correo de una cuenta local (y están permitidas), entra con ella; si no, con Identity Central. */
  async login(username: string, password: string): Promise<OpenedSession> {
    const local = this.localLogin ? await this.users.findLocalByEmail(username) : undefined
    if (local || !this.identity) return this.loginLocal(local, password)

    const issued = await this.identity.central.passwordGrant(username, password)
    const claims = await this.verifyIssued(this.identity, issued.accessToken)
    // Antes de crear la cuenta o la sesión: quien no es funcionario no deja rastro aquí.
    const cedula = this.cedulaOf(username, claims)
    const funcionario = await this.verifyFuncionario(this.identity, cedula, issued.refreshToken)
    // El departamento sale de RH Link: no se le pide a la persona lo que ya está ahí.
    const synced = await this.users.applyRrhhDepartment(await this.syncUser(claims), funcionario?.locationCode)
    // Administración la ve en la ficha de la persona (/gestion/usuarios).
    const user = await this.users.recordCedula(synced, cedula)
    return this.openSession(user, { refreshToken: issued.refreshToken, accessExpiresAt: claims.expiresAt, cedula })
  }

  /**
   * La cédula de quien tiene esta sesión (la que usó para entrar), o undefined si no se conoce (cuentas de
   * prueba, o entró con un correo sin claim identity_number). Solo se descifra con la cookie de esa misma sesión.
   */
  async findSessionCedula(sessionToken: string): Promise<string | undefined> {
    const session = await this.findSession(sessionToken)
    if (!session?.cedula) return undefined
    try {
      return this.tokens.decrypt(session.cedula, sessionToken, CEDULA_PURPOSE)
    } catch {
      return undefined
    }
  }

  /** Lo que la persona escribió si es una cédula o, si entró con el correo, el claim identity_number del token. */
  private cedulaOf(username: string, claims: IdentityClaims): string | undefined {
    const typed = username.trim()
    if (CEDULA.test(typed)) return typed.toUpperCase()
    return claims.identityNumber && CEDULA.test(claims.identityNumber) ? claims.identityNumber.toUpperCase() : undefined
  }

  /**
   * Lanza 403 NOT_FUNCIONARIO si la cédula no es de un funcionario activo en RH Link. Sin verificación
   * configurada no hace nada. Si RH Link no responde, lanza su error (503/502): ante la duda no se entra.
   */
  async assertIsFuncionario(cedula: string): Promise<FuncionarioRrhh | null> {
    if (!this.funcionarios) return null
    const funcionario = await this.funcionarios.findFuncionario(cedula.trim().toUpperCase())
    if (!funcionario?.active) {
      throw new DomainError(
        'Tu cédula no aparece como funcionario activo en Recursos Humanos, así que no puedes entrar a la intranet. Si crees que es un error, comunícate con Recursos Humanos (506-9692, ext. 9171 o 9172).',
        403,
        'NOT_FUNCIONARIO',
      )
    }
    return funcionario
  }

  /**
   * La cédula sale de lo que la persona escribió o, si entró con el correo, del claim identity_number del
   * token. Sin cédula no se puede verificar y no se entra. Si se niega el paso, el refresh token que el
   * central acaba de emitir se revoca (no queda una sesión suelta en el central).
   */
  private async verifyFuncionario(identity: Identity, cedula: string | undefined, refreshToken: string): Promise<FuncionarioRrhh | null> {
    if (!this.funcionarios) return null
    try {
      if (!cedula) {
        throw new DomainError('No pudimos saber tu cédula. Entra escribiendo tu cédula (con guiones, por ejemplo 8-123-456) en lugar del correo.', 403, 'CEDULA_REQUIRED')
      }
      return await this.assertIsFuncionario(cedula)
    } catch (err) {
      await identity.central.revoke(refreshToken).catch(() => console.warn('No se pudo revocar el refresh token de un ingreso que se negó.'))
      throw err
    }
  }

  /**
   * Renueva la sesión contra Identity Central (grant refresh_token). Una sesión local
   * no tiene nada que renovar: devuelve la cuenta tal cual.
   */
  async refresh(token: string | undefined): Promise<UserRow> {
    const session = token ? await this.repository.findByTokenHash(this.tokens.hash(token), new Date()) : undefined
    if (!token || !session) throw new DomainError('Inicia sesión para continuar.', 401, 'AUTHENTICATION_REQUIRED')
    if (!session.refreshToken) {
      const user = await this.users.findById(session.userId)
      if (!user || user.suspendedAt) throw new DomainError('Inicia sesión para continuar.', 401, 'AUTHENTICATION_REQUIRED')
      return user
    }
    return this.refreshSession(session, token)
  }

  /**
   * Cierra la sesión local y revoca su refresh token en Identity Central. Si el central
   * no responde, la salida igual se completa: el refresh token solo existía (cifrado)
   * en esta sesión, que ya se borró, así que nadie puede usarlo.
   */
  async logout(token: string): Promise<void> {
    const session = await this.repository.deleteByTokenHash(this.tokens.hash(token))
    if (!session?.refreshToken || !this.identity) return
    try {
      await this.identity.central.revoke(this.tokens.decrypt(session.refreshToken, token))
    } catch (err) {
      console.warn(`No se pudo revocar el refresh token en Identity Central (${err instanceof DomainError ? err.code : 'error'}); la sesión local ya se cerró.`)
    }
  }

  /**
   * Persona dueña de una sesión vigente, o undefined. Si la sesión es de Identity
   * Central y su access token ya venció (1 h), se renueva aquí mismo.
   */
  async findUserBySessionToken(token: string): Promise<UserRow | undefined> {
    const session = await this.repository.findByTokenHash(this.tokens.hash(token), new Date())
    if (!session) return undefined
    if (!session.refreshToken || !session.accessExpiresAt || session.accessExpiresAt > new Date()) {
      const user = await this.users.findById(session.userId)
      return user?.suspendedAt ? undefined : user
    }
    try {
      return await this.refreshSession(session, token)
    } catch (err) {
      if (!(err instanceof DomainError)) throw err
      // 401/403: la sesión ya se borró. 5xx: el central no responde; no se da por buena
      // una identidad sin revisar, pero la sesión se conserva y se reintenta en la próxima petición.
      if (err.statusCode >= 500) console.warn(`No se pudo renovar una sesión con Identity Central (${err.code}).`)
      return undefined
    }
  }

  /**
   * Persona dueña de un access token de Identity Central (Authorization: Bearer).
   * Lanza 401 si el token no sirve o venció, 403 si es de una app fuera de
   * ALLOWED_CLIENT_IDS. Si el `sub` no se había visto, crea su cuenta.
   */
  async findUserByAccessToken(accessToken: string): Promise<UserRow> {
    if (!this.identity) throw new DomainError('Este servidor no acepta tokens de Identity Central.', 401, 'INVALID_TOKEN')
    const claims = await this.identity.tokens.verify(accessToken)
    const user = await this.syncUser(claims)
    if (user.suspendedAt) throw suspendedError(user)
    // Token de otra app permitida: su app_role es un rol en ESA app. Aquí solo identifica.
    return claims.clientId === this.identity.clientId ? user : { ...user, roles: ['funcionario'] }
  }

  /** Sesión vigente de ese token de cookie (para guardar datos atados a ella), o undefined. */
  findSession(token: string): Promise<SessionRow | undefined> {
    return this.repository.findByTokenHash(this.tokens.hash(token), new Date())
  }

  private refreshSession(session: SessionRow, token: string): Promise<UserRow> {
    const running = this.refreshing.get(session.id)
    if (running) return running
    const task = this.doRefresh(session, token).finally(() => this.refreshing.delete(session.id))
    this.refreshing.set(session.id, task)
    return task
  }

  private async doRefresh(session: SessionRow, token: string): Promise<UserRow> {
    if (!this.identity || !session.refreshToken) throw new DomainError('Inicia sesión para continuar.', 401, 'AUTHENTICATION_REQUIRED')
    let refreshToken: string
    try {
      refreshToken = this.tokens.decrypt(session.refreshToken, token)
    } catch {
      await this.repository.deleteById(session.id)
      throw new DomainError('Tu sesión venció. Vuelve a iniciar sesión.', 401, 'SESSION_EXPIRED')
    }

    let issued: Awaited<ReturnType<IdentityCentralService['refreshGrant']>>
    try {
      issued = await this.identity.central.refreshGrant(refreshToken)
    } catch (err) {
      // Vencida, revocada o sin acceso a la app: la sesión se termina.
      if (err instanceof DomainError && err.statusCode < 500) await this.repository.deleteById(session.id)
      throw err
    }

    const claims = await this.verifyIssued(this.identity, issued.accessToken)
    // El token del refresh trae menos claims: se fusiona, no se reemplaza (§7.1).
    const user = await this.syncUser(claims)
    if (user.suspendedAt) {
      await this.repository.deleteById(session.id)
      throw suspendedError(user)
    }
    // El refresh token ROTA: se guarda siempre el nuevo.
    await this.repository.updateTokens(session.id, {
      refreshToken: this.tokens.encrypt(issued.refreshToken, token),
      accessExpiresAt: claims.expiresAt,
    })
    return user
  }

  private async loginLocal(user: UserRow | undefined, password: string): Promise<OpenedSession> {
    const now = new Date()
    if (user?.lockedUntil && user.lockedUntil > now) {
      throw new DomainError(`Demasiados intentos fallidos. La cuenta está bloqueada ${LOCK_MINUTES} minutos.`, 429, 'ACCOUNT_LOCKED')
    }

    // Se verifica aunque la cuenta no exista (mismo tiempo de respuesta).
    const valid = await this.hash.verify(password, user?.passwordHash ?? null)
    if (!user || !valid) {
      if (user) {
        // Si el bloqueo anterior ya venció, se empieza a contar de nuevo.
        const previous = user.lockedUntil ? 0 : user.failedLoginAttempts
        const attempts = previous + 1
        const lockedUntil = attempts >= MAX_FAILED_ATTEMPTS ? new Date(now.getTime() + LOCK_MINUTES * 60_000) : null
        await this.users.updateLoginState(user.id, { failedLoginAttempts: lockedUntil ? 0 : attempts, lockedUntil })
      }
      throw new DomainError('El usuario o la contraseña no son correctos.', 401, 'INVALID_CREDENTIALS')
    }

    if (user.failedLoginAttempts || user.lockedUntil) {
      await this.users.updateLoginState(user.id, { failedLoginAttempts: 0, lockedUntil: null })
    }
    return this.openSession(user)
  }

  private async openSession(user: UserRow, identityTokens?: { refreshToken: string; accessExpiresAt: Date; cedula?: string }): Promise<OpenedSession> {
    if (user.suspendedAt) {
      if (identityTokens && this.identity) await this.identity.central.revoke(identityTokens.refreshToken).catch(() => undefined)
      throw suspendedError(user)
    }
    const now = new Date()
    await this.repository.deleteExpiredByUserId(user.id, now)
    await this.users.markLogin(user.id)

    const token = this.tokens.generate()
    const expiresAt = new Date(now.getTime() + env.SESSION_TTL_HOURS * 3_600_000)
    await this.repository.create({
      tokenHash: this.tokens.hash(token),
      userId: user.id,
      expiresAt,
      ...(identityTokens && {
        refreshToken: this.tokens.encrypt(identityTokens.refreshToken, token),
        accessExpiresAt: identityTokens.accessExpiresAt,
        ...(identityTokens.cedula && { cedula: this.tokens.encrypt(identityTokens.cedula, token, CEDULA_PURPOSE) }),
      }),
    })
    return { user, token, expiresAt }
  }

  /**
   * Un token que el central ACABA de emitirnos y no pasa la validación es un error de
   * configuración nuestro (issuer sin la barra final, JWKS equivocado, whitelist sin el
   * client_id propio), no de la persona: 500 con la pista en el log.
   */
  private async verifyIssued(identity: Identity, accessToken: string): Promise<IdentityClaims> {
    try {
      return await identity.tokens.verify(accessToken)
    } catch (err) {
      if (err instanceof DomainError && err.statusCode < 500) {
        throw new Error(
          `El token recién emitido por Identity Central no pasó la validación (${err.code}). Revisa JWT_ISSUER (con la barra final), JWT_JWKS_URI y ALLOWED_CLIENT_IDS.`,
        )
      }
      throw err
    }
  }

  /**
   * Cuenta local del `sub` (se crea la primera vez). Roles desde app_role, nunca desde
   * role (§7.3), y solo si el token es de la intranet; los de otra app no los tocan.
   */
  private syncUser(claims: IdentityClaims): Promise<UserRow> {
    // Sin el claim app_role no se tocan los roles: si faltara en un token renovado, un admin no debe quedar como funcionario.
    const ownToken = claims.clientId === this.identity?.clientId && claims.appRoles.length > 0
    return this.users.syncIdentityUser({
      sub: claims.sub,
      roles: ownToken ? rolesFromAppRoles(claims.appRoles) : undefined,
      email: claims.email,
      emailVerified: claims.emailVerified,
      // full_name solo viene en el token del login; name viene siempre, pero solo se usa para crear la cuenta.
      name: claims.fullName ? splitName(claims.fullName) : undefined,
      fallbackName: splitName(claims.name ?? 'Usuario'),
    })
  }
}

export const authService = new AuthService(
  authRepository,
  usersService,
  hashService,
  tokenService,
  env.identity && identityCentralService && identityTokenService
    ? { central: identityCentralService, tokens: identityTokenService, clientId: env.identity.clientId }
    : null,
  env.LOCAL_LOGIN_ENABLED,
  rhLinkService?.canVerifyFuncionarios ? rhLinkService : null,
)
