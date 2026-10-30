import { and, asc, count, eq, getTableColumns, max, ne } from 'drizzle-orm'

import { db, type Database } from '../../config/database.ts'
import { forms, requests, users, type FormRow, type NewFormRow } from '../../database/schema/index.ts'

export type FormWithEditor = FormRow & { editorFirstName: string | null; editorLastName: string | null }

export class FormsRepository {
  private readonly db: Database

  constructor(database: Database) {
    this.db = database
  }

  /** Por área y número. */
  async findMany(filter: { publishedOnly: boolean }): Promise<FormWithEditor[]> {
    return this.selectWithEditor()
      .where(filter.publishedOnly ? eq(forms.published, true) : undefined)
      .orderBy(asc(forms.area), asc(forms.number))
  }

  async findById(id: number): Promise<FormWithEditor | undefined> {
    const [row] = await this.selectWithEditor().where(eq(forms.id, id)).limit(1)
    return row
  }

  async findBySlug(slug: string): Promise<FormWithEditor | undefined> {
    const [row] = await this.selectWithEditor().where(eq(forms.slug, slug)).limit(1)
    return row
  }

  async existsSlug(slug: string): Promise<boolean> {
    return (await this.db.select({ id: forms.id }).from(forms).where(eq(forms.slug, slug)).limit(1)).length > 0
  }

  /** ¿Otro formulario ya usa ese número? */
  async existsNumber(number: number, exceptId?: number): Promise<boolean> {
    const rows = await this.db
      .select({ id: forms.id })
      .from(forms)
      .where(exceptId ? and(eq(forms.number, number), ne(forms.id, exceptId)) : eq(forms.number, number))
      .limit(1)
    return rows.length > 0
  }

  /** Solicitudes recibidas con ese formulario. */
  async countRequests(formId: number): Promise<number> {
    const [row] = await this.db.select({ n: count() }).from(requests).where(eq(requests.formId, formId))
    return row.n
  }

  async maxNumber(): Promise<number> {
    const [row] = await this.db.select({ n: max(forms.number) }).from(forms)
    return row.n ?? 0
  }

  async create(data: NewFormRow): Promise<FormWithEditor> {
    const [row] = await this.db.insert(forms).values(data).returning({ id: forms.id })
    return (await this.findById(row.id))!
  }

  async update(id: number, data: Partial<NewFormRow>): Promise<FormWithEditor> {
    await this.db.update(forms).set(data).where(eq(forms.id, id))
    return (await this.findById(id))!
  }

  async delete(id: number): Promise<void> {
    await this.db.delete(forms).where(eq(forms.id, id))
  }

  private selectWithEditor() {
    return this.db
      .select({ ...getTableColumns(forms), editorFirstName: users.firstName, editorLastName: users.lastName })
      .from(forms)
      .leftJoin(users, eq(users.id, forms.updatedBy))
  }
}

export const formsRepository = new FormsRepository(db)
