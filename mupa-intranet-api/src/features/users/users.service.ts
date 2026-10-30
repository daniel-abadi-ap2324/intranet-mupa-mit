import type { UserRow } from '../../database/schema/index.ts'
import { DomainError } from '../../shared/errors/domain-error.ts'
import type { Role } from '../../shared/roles.ts'
import { identityCentralService, type EmailCodeSent, type IdentityCentralService } from '../../shared/services/identity-central.service.ts'
import { eventBus, type EventBusService } from '../../shared/services/event-bus.service.ts'
import { rhLinkService, type FuncionarioRrhh } from '../../shared/services/rhlink.service.ts'
import { departmentsService, type DepartmentsService } from '../departments/departments.service.ts'
import { usersRepository, type UserActivity, type UserFilter, type UsersRepository, type UserStats, type UserWithDepartment } from './users.repository.ts'

/**
 * La persona según RH Link, consultada en vivo con su cédula al abrir la ficha (no se guarda nada):
 * unconfigured = la API no tiene cuenta de RH Link; no-cedula = todavía no se conoce su cédula;
 * not-found = RH Link no la tiene; error = RH Link no respondió.
 */
export type RrhhLookup =
  | { status: 'unconfigured' | 'no-cedula' | 'not-found' | 'error' }
  | { status: 'found'; active: boolean; fullName: string | null; locationCode: number | null; locationDepartment: string | null }

/** Todo lo que administración ve de una persona (menos la contraseña). */
export type UserDetail = UserWithDepartment & UserActivity & { rrhh: RrhhLookup }

type FuncionarioLookup = { findFuncionario(cedula: string): Promise<FuncionarioRrhh | null> }

/** Lo que la persona declara al registrarse. */
export type SelfDeclaredProfile = {
  firstName: string
  lastName: string
  phone: string | null
  jobTitle: string | null
  /** Sin él (undefined) no se toca el que ya tenga (p. ej. el que entró de RH Link). */
  departmentId?: number | null
}

type Name = { firstName: string; lastName: string | null }
const fullName = (n: Name) => `${n.firstName} ${n.lastName ?? ''}`.trim().replace(/\s+/g, ' ')

/**
 * Datos de una persona según Identity Central. Lo que venga undefined NO se toca:
 * el token del refresh trae menos claims que el del login (§7.1).
 */
export type IdentityProfile = {
  sub: string
  /** undefined = no tocar los roles guardados (una cuenta nueva queda como funcionario). */
  roles?: Role[]
  email?: string
  emailVerified?: boolean
  name?: { firstName: string; lastName: string | null }
  /** Nombre para crear la cuenta si el token no trae `name`. */
  fallbackName: { firstName: string; lastName: string | null }
}

export class UsersService {
  private readonly repository: UsersRepository
  private readonly departments: DepartmentsService
  private readonly identity: IdentityCentralService | null
  private readonly funcionarios: FuncionarioLookup | null
  private readonly eventos: EventBusService | null

  constructor(
    repository: UsersRepository,
    departments: DepartmentsService,
    identity: IdentityCentralService | null,
    funcionarios: FuncionarioLookup | null = null,
    eventos: EventBusService | null = null,
  ) {
    this.repository = repository
    this.departments = departments
    this.identity = identity
    this.funcionarios = funcionarios
    this.eventos = eventos
  }

  /** La cédula con la que la persona acaba de entrar (se guarda para la ficha de administración). */
  async recordCedula(user: UserRow, cedula: string | undefined): Promise<UserRow> {
    if (!cedula || cedula === user.cedula || user.deletedAt) return user
    return (await this.repository.update(user.id, { cedula })) ?? user
  }

  /**
   * La ficha de una persona para administración: sus datos, su actividad y lo que dice RH Link de su cédula.
   * Trae la cédula, así que cada apertura queda en la auditoría (quién vio la ficha de quién).
   */
  async detail(actorId: number, id: number): Promise<UserDetail> {
    const user = await this.repository.findWithDepartmentById(id)
    if (!user || user.deletedAt) throw new DomainError('La persona no existe.', 404, 'USER_NOT_FOUND')
    this.eventos?.emit('usuario.ficha_vista', { userId: id }, actorId)
    const [activity, rrhh] = await Promise.all([this.repository.activity(id, new Date()), this.lookupRrhh(user.cedula)])
    return { ...user, ...activity, rrhh }
  }

  private async lookupRrhh(cedula: string | null): Promise<RrhhLookup> {
    if (!this.funcionarios) return { status: 'unconfigured' }
    if (!cedula) return { status: 'no-cedula' }
    try {
      const f = await this.funcionarios.findFuncionario(cedula)
      if (!f) return { status: 'not-found' }
      const department = f.locationCode == null ? undefined : await this.departments.findByRrhhCode(f.locationCode)
      return { status: 'found', active: f.active, fullName: f.fullName, locationCode: f.locationCode, locationDepartment: department?.name ?? null }
    } catch {
      // La ficha se muestra igual; RH Link ya dejó su error (sin la cédula) en el log.
      return { status: 'error' }
    }
  }

  /** Datos que la persona dio al registrarse. El departamento lo puede corregir administración después. */
  async updateProfile(id: number, profile: SelfDeclaredProfile): Promise<UserRow> {
    const updated = await this.repository.update(id, profile)
    if (!updated) throw new DomainError('La persona no existe.', 404, 'USER_NOT_FOUND')
    return updated
  }

  /**
   * El departamento sale de RH Link (código de ubicación del funcionario): si es uno de los de la intranet, queda
   * ese, aunque la persona o administración hubieran puesto otro (RH Link manda). Si no coincide con ninguno, o
   * no hay verificación, no se toca y, si la persona no tiene departamento, la intranet se lo pide al entrar.
   */
  async applyRrhhDepartment(user: UserRow, locationCode: number | null | undefined): Promise<UserRow> {
    if (locationCode == null) return user
    const department = await this.departments.findByRrhhCode(locationCode)
    if (!department || department.id === user.departmentId) return user
    return (await this.repository.update(user.id, { departmentId: department.id })) ?? user
  }

  /** Pide al central un código para el correo de la cuenta (nunca otro: así no sirve para mandar correos a terceros). */
  async requestEmailCode(id: number): Promise<EmailCodeSent> {
    const { central, email } = await this.emailToVerify(id)
    return central.requestEmailCode(email)
  }

  async verifyEmail(id: number, code: string): Promise<UserRow> {
    const { central, email } = await this.emailToVerify(id)
    await central.verifyEmailCode(email, code)
    return (await this.repository.update(id, { emailVerified: true }))!
  }

  private async emailToVerify(id: number): Promise<{ central: IdentityCentralService; email: string }> {
    const user = await this.repository.findById(id)
    if (!user) throw new DomainError('La persona no existe.', 404, 'USER_NOT_FOUND')
    if (!this.identity || !user.identitySub) {
      throw new DomainError('Esta cuenta no confirma correo: es una cuenta de prueba.', 409, 'EMAIL_VERIFICATION_UNAVAILABLE')
    }
    if (!user.email) throw new DomainError('Tu cuenta no tiene correo.', 409, 'NO_EMAIL')
    if (user.emailVerified) throw new DomainError('Tu correo ya está confirmado.', 409, 'EMAIL_ALREADY_VERIFIED')
    return { central: this.identity, email: user.email }
  }

  findById(id: number): Promise<UserRow | undefined> {
    return this.repository.findById(id)
  }

  /** Panel de administración. Una persona aparece después de su primer ingreso. */
  list(filter: UserFilter): Promise<UserWithDepartment[]> {
    return this.repository.findMany(filter)
  }

  /** Asigna (o quita, con null) el departamento. Lo decide administración; el login no lo toca. */
  async setDepartment(id: number, departmentId: number | null): Promise<UserWithDepartment> {
    if (!(await this.repository.findById(id))) throw new DomainError('La persona no existe.', 404, 'USER_NOT_FOUND')
    if (departmentId !== null) await this.departments.assertExist([departmentId])
    await this.repository.update(id, { departmentId })
    return (await this.repository.findWithDepartmentById(id))!
  }

  /** Suspende la cuenta: no entra y sus sesiones se cierran. Administración no se suspende a sí misma. */
  async suspend(actorId: number, id: number): Promise<UserWithDepartment> {
    await this.assertOtherUser(actorId, id)
    await this.repository.update(id, { suspendedAt: new Date() })
    await this.repository.deleteSessions(id)
    return (await this.repository.findWithDepartmentById(id))!
  }

  async reactivate(id: number): Promise<UserWithDepartment> {
    const user = await this.repository.findById(id)
    if (!user || user.deletedAt) throw new DomainError('La persona no existe.', 404, 'USER_NOT_FOUND')
    await this.repository.update(id, { suspendedAt: null })
    return (await this.repository.findWithDepartmentById(id))!
  }

  /**
   * Borra la cuenta y sus solicitudes. Las cuentas de prueba (locales) se borran del todo. Las de Identity Central
   * no se pueden borrar allá: se les quita el acceso a la intranet en el central (si hay cuenta de servicio) y
   * queda un registro mínimo bloqueado, para que no se cree otra al volver a entrar.
   */
  async remove(actorId: number, id: number): Promise<void> {
    await this.assertOtherUser(actorId, id)
    const user = (await this.repository.findById(id))!
    if (user.identitySub) {
      // Primero en el central: si falla, no se borra nada aquí y administración puede reintentar.
      await this.identity?.revokeAppAccess(user.identitySub)
      await this.repository.anonymize(id)
    } else await this.repository.delete(id)
  }

  /** Reinicia el perfil local sin revocar el acceso central: el próximo ingreso lo crea de nuevo. */
  async reset(actorId: number, id: number): Promise<void> {
    await this.assertOtherUser(actorId, id)
    const user = (await this.repository.findById(id))!
    if (!user.identitySub) throw new DomainError('Solo se pueden reiniciar perfiles de Identity Central.', 409, 'IDENTITY_PROFILE_REQUIRED')
    // Reiniciar borra la fila y con ella la suspensión: una cuenta suspendida se reactiva (o se borra) en vez de reiniciarse.
    if (user.suspendedAt) throw new DomainError('Reactiva la cuenta antes de reiniciar su perfil.', 409, 'ACCOUNT_SUSPENDED')
    await this.repository.delete(id)
  }

  private async assertOtherUser(actorId: number, id: number): Promise<void> {
    if (actorId === id) throw new DomainError('No puedes hacerlo con tu propia cuenta.', 409, 'CANNOT_MODIFY_SELF')
    const user = await this.repository.findById(id)
    if (!user || user.deletedAt) throw new DomainError('La persona no existe.', 404, 'USER_NOT_FOUND')
  }

  /**
   * La persona sin departamento elige el suyo (es obligatorio al entrar). Una sola vez: el departamento decide
   * qué aplicaciones ve, así que cambiarlo después lo hace administración.
   */
  async chooseOwnDepartment(id: number, departmentId: number): Promise<UserRow> {
    const user = await this.repository.findById(id)
    if (!user) throw new DomainError('La persona no existe.', 404, 'USER_NOT_FOUND')
    if (user.departmentId !== null) {
      throw new DomainError('Tu departamento ya está asignado. Si no es el tuyo, pídele a administración que lo cambie.', 409, 'DEPARTMENT_ALREADY_SET')
    }
    await this.departments.assertExist([departmentId])
    return (await this.repository.update(id, { departmentId }))!
  }

  countWithoutDepartment(): Promise<number> {
    return this.repository.countWithoutDepartment()
  }

  /** La persona vio o saltó el recorrido del Inicio. Se guarda la primera vez; después no cambia. */
  stats(since: Date): Promise<UserStats> {
    return this.repository.stats(since)
  }

  async markTourSeen(id: number): Promise<void> {
    const user = await this.repository.findById(id)
    if (!user) throw new DomainError('La persona no existe.', 404, 'USER_NOT_FOUND')
    if (!user.tourSeenAt) await this.repository.update(id, { tourSeenAt: new Date() })
  }

  async markLogin(id: number): Promise<void> {
    await this.repository.update(id, { lastLoginAt: new Date() })
  }

  /** Cuenta local (las ficticias de prueba). Los correos se guardan y se buscan en minúsculas. */
  findLocalByEmail(email: string): Promise<UserRow | undefined> {
    return this.repository.findLocalByEmail(email.trim().toLowerCase())
  }

  /** Intentos fallidos y bloqueo temporal de la cuenta (la regla vive en AuthService). */
  async updateLoginState(id: number, state: { failedLoginAttempts: number; lockedUntil: Date | null }): Promise<void> {
    await this.repository.update(id, state)
  }

  /**
   * La cuenta local de un `sub` de Identity Central: la crea la primera vez que se ve
   * (§7.7) y, si ya existe, le fusiona los datos nuevos. Nunca borra un dato porque
   * el claim no vino. Los roles, cuando vienen, se reemplazan: los decide el central.
   */
  async syncIdentityUser(profile: IdentityProfile): Promise<UserRow> {
    const email = profile.email?.toLowerCase()
    const existing = await this.repository.findByIdentitySub(profile.sub)
    if (!existing) {
      const created = await this.repository.createForIdentity({
        identitySub: profile.sub,
        email: email ?? null,
        emailVerified: profile.emailVerified ?? null,
        firstName: (profile.name ?? profile.fallbackName).firstName,
        lastName: (profile.name ?? profile.fallbackName).lastName,
        roles: profile.roles ?? ['funcionario'],
      })
      if (created) return created
      // Otra petición la creó a la vez: se sigue con esa.
      return this.syncIdentityUser(profile)
    }

    // Cuenta borrada: no se le devuelven los datos; el login la rechaza.
    if (existing.deletedAt) return existing

    const changes: Parameters<UsersRepository['update']>[1] = {}
    if (email !== undefined && email !== existing.email) changes.email = email
    if (profile.emailVerified !== undefined && profile.emailVerified !== existing.emailVerified) changes.emailVerified = profile.emailVerified
    // El central solo guarda el nombre completo: "Juan Carlos Pérez" llega partido como "Juan" + "Carlos Pérez".
    // Si el nombre completo es el mismo, se respeta cómo lo separó la persona al registrarse.
    if (profile.name && fullName(profile.name) !== fullName(existing)) {
      if (profile.name.firstName !== existing.firstName) changes.firstName = profile.name.firstName
      if (profile.name.lastName !== existing.lastName) changes.lastName = profile.name.lastName
    }
    if (profile.roles && profile.roles.join() !== existing.roles.join()) changes.roles = profile.roles
    if (!Object.keys(changes).length) return existing
    return (await this.repository.update(existing.id, changes)) ?? existing
  }
}

export const usersService = new UsersService(
  usersRepository,
  departmentsService,
  identityCentralService,
  rhLinkService?.canVerifyFuncionarios ? rhLinkService : null,
  eventBus,
)
