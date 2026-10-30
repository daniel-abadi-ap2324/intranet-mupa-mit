import { and, asc, count, eq, exists, inArray, ne, notExists, or, sql, type SQL } from 'drizzle-orm'

import { db, type Database } from '../../config/database.ts'
import {
  applicationDepartments,
  applications,
  applicationTags,
  departments,
  tags,
  type ApplicationRow,
  type NewApplicationRow,
  type TagRow,
} from '../../database/schema/index.ts'

export type ApplicationDepartment = { id: number; name: string }

/** Con sus etiquetas y los departamentos que la ven (vacío = todos). */
export type ApplicationWithTags = ApplicationRow & { tags: TagRow[]; departments: ApplicationDepartment[] }

export type ApplicationFilter = {
  /** Solo las publicadas (sin borradores). */
  publishedOnly: boolean
  /** Deja fuera un nivel de acceso (por ejemplo 'sesion' para quien no inició sesión). */
  excludeAccess?: string
  /**
   * Departamento de quien mira. undefined = sin filtro (administración); null = solo las
   * que no están restringidas; un id = esas más las restringidas a ese departamento.
   */
  visibleToDepartment?: number | null
}

export class ApplicationsRepository {
  private readonly db: Database

  constructor(database: Database) {
    this.db = database
  }

  async findMany(filter: ApplicationFilter): Promise<ApplicationWithTags[]> {
    const conditions: SQL[] = []
    if (filter.publishedOnly) conditions.push(eq(applications.published, true))
    if (filter.excludeAccess) conditions.push(ne(applications.access, filter.excludeAccess))
    if (filter.visibleToDepartment !== undefined) conditions.push(this.visibleTo(filter.visibleToDepartment))
    const rows = await this.db
      .select()
      .from(applications)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(asc(applications.name))
    return this.withTags(rows)
  }

  async findById(id: number): Promise<ApplicationWithTags | undefined> {
    const rows = await this.db.select().from(applications).where(eq(applications.id, id)).limit(1)
    return (await this.withTags(rows))[0]
  }

  async findByUrl(url: string): Promise<ApplicationRow | undefined> {
    const [row] = await this.db.select().from(applications).where(eq(applications.url, url)).limit(1)
    return row
  }

  async existsBySlug(slug: string): Promise<boolean> {
    const rows = await this.db.select({ id: applications.id }).from(applications).where(eq(applications.slug, slug)).limit(1)
    return rows.length > 0
  }

  /** Crea la aplicación, sus etiquetas y sus departamentos en una sola transacción. */
  async create(data: NewApplicationRow, tagIds: number[], departmentIds: number[]): Promise<ApplicationWithTags> {
    const id = await this.db.transaction(async (tx) => {
      const [row] = await tx.insert(applications).values(data).returning({ id: applications.id })
      if (tagIds.length) await tx.insert(applicationTags).values(tagIds.map((tagId) => ({ applicationId: row.id, tagId })))
      if (departmentIds.length) await tx.insert(applicationDepartments).values(departmentIds.map((departmentId) => ({ applicationId: row.id, departmentId })))
      return row.id
    })
    return (await this.findById(id))!
  }

  /** Cambia los campos y, si llegan, reemplaza las etiquetas y los departamentos; todo en una transacción. */
  async update(id: number, data: Partial<NewApplicationRow>, tagIds?: number[], departmentIds?: number[]): Promise<ApplicationWithTags> {
    await this.db.transaction(async (tx) => {
      if (Object.keys(data).length) await tx.update(applications).set(data).where(eq(applications.id, id))
      if (tagIds) {
        await tx.delete(applicationTags).where(eq(applicationTags.applicationId, id))
        if (tagIds.length) await tx.insert(applicationTags).values(tagIds.map((tagId) => ({ applicationId: id, tagId })))
      }
      if (departmentIds) {
        await tx.delete(applicationDepartments).where(eq(applicationDepartments.applicationId, id))
        if (departmentIds.length) await tx.insert(applicationDepartments).values(departmentIds.map((departmentId) => ({ applicationId: id, departmentId })))
      }
    })
    return (await this.findById(id))!
  }

  /** Cuántos de estos ids existen. */
  async countExisting(ids: number[]): Promise<number> {
    const [row] = await this.db.select({ n: count() }).from(applications).where(inArray(applications.id, ids))
    return row.n
  }

  /** Reemplaza los departamentos de varias aplicaciones en una sola transacción: o cambian todas o ninguna. */
  async replaceDepartments(items: { applicationId: number; departmentIds: number[] }[]): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx.delete(applicationDepartments).where(inArray(applicationDepartments.applicationId, items.map((i) => i.applicationId)))
      const rows = items.flatMap((i) => i.departmentIds.map((departmentId) => ({ applicationId: i.applicationId, departmentId })))
      // Por tandas: el límite de parámetros de PostgreSQL (65535) no se acerca con 500 x 500 / 2.
      for (let n = 0; n < rows.length; n += 5000) await tx.insert(applicationDepartments).values(rows.slice(n, n + 5000))
    })
  }

  /** Cuántas hay publicadas y en borrador. */
  async countByPublished(): Promise<{ published: number; drafts: number }> {
    const rows = await this.db.select({ published: applications.published, n: count() }).from(applications).groupBy(applications.published)
    return { published: rows.find((r) => r.published)?.n ?? 0, drafts: rows.find((r) => !r.published)?.n ?? 0 }
  }

  async delete(id: number): Promise<void> {
    await this.db.delete(applications).where(eq(applications.id, id))
  }

  /** Sin departamentos (abierta), o con el departamento de quien mira. */
  private visibleTo(departmentId: number | null): SQL {
    const linked = (extra?: SQL) =>
      this.db
        .select({ x: sql`1` })
        .from(applicationDepartments)
        .where(and(eq(applicationDepartments.applicationId, applications.id), extra))
    const open = notExists(linked())
    return departmentId === null ? open : or(open, exists(linked(eq(applicationDepartments.departmentId, departmentId))))!
  }

  /** Agrega a cada aplicación sus etiquetas y departamentos (una consulta de cada uno para todas). */
  private async withTags(rows: ApplicationRow[]): Promise<ApplicationWithTags[]> {
    if (!rows.length) return []
    const ids = rows.map((r) => r.id)
    const deps = await this.db
      .select({ applicationId: applicationDepartments.applicationId, id: departments.id, name: departments.name })
      .from(applicationDepartments)
      .innerJoin(departments, eq(departments.id, applicationDepartments.departmentId))
      .where(inArray(applicationDepartments.applicationId, ids))
      .orderBy(asc(departments.name))
    const depsByApp = new Map<number, ApplicationDepartment[]>()
    for (const { applicationId, ...d } of deps) depsByApp.set(applicationId, [...(depsByApp.get(applicationId) ?? []), d])
    const links = await this.db
      .select({ applicationId: applicationTags.applicationId, id: tags.id, name: tags.name, audience: tags.audience })
      .from(applicationTags)
      .innerJoin(tags, eq(tags.id, applicationTags.tagId))
      .where(
        inArray(
          applicationTags.applicationId,
          rows.map((r) => r.id),
        ),
      )
      .orderBy(asc(tags.name))
    const byApp = new Map<number, TagRow[]>()
    for (const { applicationId, ...tag } of links) byApp.set(applicationId, [...(byApp.get(applicationId) ?? []), tag])
    return rows.map((r) => ({ ...r, tags: byApp.get(r.id) ?? [], departments: depsByApp.get(r.id) ?? [] }))
  }
}

export const applicationsRepository = new ApplicationsRepository(db)
