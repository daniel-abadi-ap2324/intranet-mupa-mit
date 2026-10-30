import { asc, count, eq, inArray } from 'drizzle-orm'

import { db, type Database } from '../../config/database.ts'
import { applicationDepartments, departments, users, type DepartmentRow } from '../../database/schema/index.ts'

export type DepartmentWithCounts = DepartmentRow & { users: number; applications: number }

export class DepartmentsRepository {
  private readonly db: Database

  constructor(database: Database) {
    this.db = database
  }

  async findMany(): Promise<DepartmentWithCounts[]> {
    const rows = await this.db.select().from(departments).orderBy(asc(departments.name))
    return this.withCounts(rows)
  }

  /** Solo id y nombre, por nombre: para elegir uno (sin las cifras de administración). */
  findOptions(): Promise<Pick<DepartmentRow, 'id' | 'name'>[]> {
    return this.db.select({ id: departments.id, name: departments.name }).from(departments).orderBy(asc(departments.name))
  }

  async findById(id: number): Promise<DepartmentWithCounts | undefined> {
    const rows = await this.db.select().from(departments).where(eq(departments.id, id)).limit(1)
    return (await this.withCounts(rows))[0]
  }

  async findByName(name: string): Promise<DepartmentRow | undefined> {
    const [row] = await this.db.select().from(departments).where(eq(departments.name, name)).limit(1)
    return row
  }

  async findByRrhhCode(code: number): Promise<DepartmentRow | undefined> {
    const [row] = await this.db.select().from(departments).where(eq(departments.rrhhCode, code)).limit(1)
    return row
  }

  async countExisting(ids: number[]): Promise<number> {
    if (!ids.length) return 0
    const [row] = await this.db.select({ n: count() }).from(departments).where(inArray(departments.id, ids))
    return row.n
  }

  async create(name: string): Promise<DepartmentRow> {
    const [row] = await this.db.insert(departments).values({ name }).returning()
    return row
  }

  async update(id: number, name: string): Promise<void> {
    await this.db.update(departments).set({ name }).where(eq(departments.id, id))
  }

  async delete(id: number): Promise<void> {
    await this.db.delete(departments).where(eq(departments.id, id))
  }

  /** Cuántas personas y cuántas aplicaciones tiene cada departamento (dos consultas para todos). */
  private async withCounts(rows: DepartmentRow[]): Promise<DepartmentWithCounts[]> {
    if (!rows.length) return []
    const ids = rows.map((r) => r.id)
    const people = await this.db
      .select({ id: users.departmentId, n: count() })
      .from(users)
      .where(inArray(users.departmentId, ids))
      .groupBy(users.departmentId)
    const apps = await this.db
      .select({ id: applicationDepartments.departmentId, n: count() })
      .from(applicationDepartments)
      .where(inArray(applicationDepartments.departmentId, ids))
      .groupBy(applicationDepartments.departmentId)
    const byId = (list: { id: number | null; n: number }[]) => new Map(list.map((x) => [x.id, x.n]))
    const p = byId(people)
    const a = byId(apps)
    return rows.map((r) => ({ ...r, users: p.get(r.id) ?? 0, applications: a.get(r.id) ?? 0 }))
  }
}

export const departmentsRepository = new DepartmentsRepository(db)
