import { and, asc, count, eq, gt, gte, ilike, isNotNull, isNull, not, or, sql, type SQL } from 'drizzle-orm'

import { db, type Database } from '../../config/database.ts'
import { departments, requests, sessions, users, type NewUserRow, type UserRow } from '../../database/schema/index.ts'

export type UserWithDepartment = UserRow & { departmentName: string | null }

export type UserStats = { total: number; active: number; created: number; withoutDepartment: number; unverifiedEmail: number }

export type UserFilter = { departmentId?: number; withoutDepartment?: boolean; q?: string }

/** Para la ficha de administración: sesiones abiertas y solicitudes de la persona. */
export type UserActivity = { activeSessions: number; requests: number; openRequests: number }

export class UsersRepository {
  private readonly db: Database

  constructor(database: Database) {
    this.db = database
  }

  async findById(id: number): Promise<UserRow | undefined> {
    const [row] = await this.db.select().from(users).where(eq(users.id, id)).limit(1)
    return row
  }

  async findWithDepartmentById(id: number): Promise<UserWithDepartment | undefined> {
    const [row] = await this.db
      .select({ user: users, departmentName: departments.name })
      .from(users)
      .leftJoin(departments, eq(departments.id, users.departmentId))
      .where(eq(users.id, id))
      .limit(1)
    return row && { ...row.user, departmentName: row.departmentName }
  }

  /** Panel de administración: personas con el nombre de su departamento, por apellido y nombre. */
  async findMany(filter: UserFilter): Promise<UserWithDepartment[]> {
    const conditions: SQL[] = [isNull(users.deletedAt)]
    if (filter.departmentId) conditions.push(eq(users.departmentId, filter.departmentId))
    if (filter.withoutDepartment) conditions.push(isNull(users.departmentId))
    if (filter.q) {
      const like = '%' + filter.q.replace(/[\\%_]/g, (c) => '\\' + c) + '%'
      conditions.push(or(ilike(users.firstName, like), ilike(users.lastName, like), ilike(users.email, like), ilike(users.cedula, like))!)
    }
    const rows = await this.db
      .select({ user: users, departmentName: departments.name })
      .from(users)
      .leftJoin(departments, eq(departments.id, users.departmentId))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(asc(users.lastName), asc(users.firstName))
    return rows.map((r) => ({ ...r.user, departmentName: r.departmentName }))
  }

  async activity(id: number, now: Date): Promise<UserActivity> {
    const [s] = await this.db.select({ n: count() }).from(sessions).where(and(eq(sessions.userId, id), gt(sessions.expiresAt, now)))
    const [r] = await this.db
      .select({ total: count(), open: sql<number>`count(*) filter (where ${requests.status} not in ('resuelta', 'rechazada'))`.mapWith(Number) })
      .from(requests)
      .where(eq(requests.userId, id))
    return { activeSessions: s.n, requests: r.total, openRequests: r.open }
  }

  async countWithoutDepartment(): Promise<number> {
    const [row] = await this.db.select({ n: count() }).from(users).where(and(isNull(users.departmentId), isNull(users.deletedAt)))
    return row.n
  }

  /** Cifras del Centro de Gestión: activos y nuevos desde `since`. */
  async stats(since: Date): Promise<UserStats> {
    const filtro = (cond: SQL) => sql<number>`count(*) filter (where ${cond})`.mapWith(Number)
    const [row] = await this.db
      .select({
        total: count(),
        active: filtro(gte(users.lastLoginAt, since)),
        created: filtro(gte(users.createdAt, since)),
        withoutDepartment: filtro(isNull(users.departmentId)),
        // Solo cuentas de Identity Central: las locales (de prueba) no confirman correo.
        unverifiedEmail: filtro(and(isNotNull(users.identitySub), isNotNull(users.email), not(sql`coalesce(${users.emailVerified}, false)`))!),
      })
      .from(users)
      .where(isNull(users.deletedAt))
    return row
  }

  /** Cuenta local (sin Identity Central) con ese correo. */
  async findLocalByEmail(email: string): Promise<UserRow | undefined> {
    const [row] = await this.db
      .select()
      .from(users)
      .where(and(eq(users.email, email), isNull(users.identitySub)))
      .limit(1)
    return row
  }

  async findByIdentitySub(identitySub: string): Promise<UserRow | undefined> {
    const [row] = await this.db.select().from(users).where(eq(users.identitySub, identitySub)).limit(1)
    return row
  }

  /** Crea la cuenta de un `sub`; si otra petición la creó al mismo tiempo, devuelve undefined. */
  async createForIdentity(data: NewUserRow & { identitySub: string }): Promise<UserRow | undefined> {
    const [row] = await this.db.insert(users).values(data).onConflictDoNothing({ target: users.identitySub }).returning()
    return row
  }

  async update(
    id: number,
    data: Partial<
      Pick<
        UserRow,
        | 'failedLoginAttempts'
        | 'lockedUntil'
        | 'email'
        | 'emailVerified'
        | 'firstName'
        | 'lastName'
        | 'cedula'
        | 'roles'
        | 'departmentId'
        | 'phone'
        | 'jobTitle'
        | 'lastLoginAt'
        | 'tourSeenAt'
        | 'suspendedAt'
        | 'deletedAt'
      >
    >,
  ): Promise<UserRow | undefined> {
    const [row] = await this.db.update(users).set(data).where(eq(users.id, id)).returning()
    return row
  }

  async deleteSessions(userId: number): Promise<void> {
    await this.db.delete(sessions).where(eq(sessions.userId, userId))
  }

  /** Borra la cuenta; sus sesiones, solicitudes y preferencias se van con ella (cascade). */
  async delete(id: number): Promise<void> {
    await this.db.delete(users).where(eq(users.id, id))
  }

  /**
   * Borra todo de la persona menos el registro mínimo (queda suspendido y marcado como borrado). Para las
   * cuentas de Identity Central, que no se pueden borrar allá: sin este registro volverían a crearse al entrar.
   */
  async anonymize(id: number): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx.delete(requests).where(eq(requests.userId, id))
      await tx.delete(sessions).where(eq(sessions.userId, id))
      const now = new Date()
      await tx
        .update(users)
        .set({ email: null, emailVerified: null, firstName: 'Cuenta eliminada', lastName: null, cedula: null, roles: ['funcionario'], departmentId: null, phone: null, jobTitle: null, suspendedAt: now, deletedAt: now })
        .where(eq(users.id, id))
    })
  }
}

export const usersRepository = new UsersRepository(db)
