import { and, desc, eq, getTableColumns, inArray, isNull, like } from 'drizzle-orm'

import { db, type Database } from '../../config/database.ts'
import { bulletins, users, type NewBulletinRow, type BulletinRow } from '../../database/schema/index.ts'

/** Los % _ y \ del texto buscado valen por sí mismos, no como comodines de LIKE. */
const escapeLike = (text: string) => text.replace(/[\\%_]/g, (c) => '\\' + c)

export type BulletinWithEditor =BulletinRow & { editorFirstName: string | null; editorLastName: string | null }

export class BulletinsRepository {
  private readonly db: Database

  constructor(database: Database) {
    this.db = database
  }

  /** terms: palabras ya normalizadas (sin tildes ni mayúsculas); el boletín tiene que traer todas. */
  async findMany(filter: { publishedOnly: boolean; terms: string[] }): Promise<BulletinWithEditor[]> {
    const conditions = [
      filter.publishedOnly ? eq(bulletins.published, true) : undefined,
      ...filter.terms.map((t) => like(bulletins.searchText, `%${escapeLike(t)}%`)),
    ]
    return this.selectWithEditor()
      .where(and(...conditions))
      .orderBy(desc(bulletins.date), desc(bulletins.id))
  }

  /** Los que todavía no tienen su texto para buscar. */
  async findWithoutSearchText(): Promise<BulletinWithEditor[]> {
    return this.selectWithEditor().where(isNull(bulletins.searchText)).orderBy(desc(bulletins.date))
  }

  async findById(id: number): Promise<BulletinWithEditor | undefined> {
    const [row] = await this.selectWithEditor().where(eq(bulletins.id, id)).limit(1)
    return row
  }

  /** De esos source_id, los que ya están guardados (los importó la sincronización). */
  async findSourceIds(sourceIds: string[]): Promise<Set<string>> {
    if (!sourceIds.length) return new Set()
    const rows = await this.db.select({ sourceId: bulletins.sourceId }).from(bulletins).where(inArray(bulletins.sourceId, sourceIds))
    return new Set(rows.map((r) => r.sourceId!))
  }

  async existsByDate(date: string): Promise<boolean> {
    const [row] = await this.db.select({ id: bulletins.id }).from(bulletins).where(eq(bulletins.date, date)).limit(1)
    return Boolean(row)
  }

  async create(data: NewBulletinRow): Promise<BulletinWithEditor> {
    const [row] = await this.db.insert(bulletins).values(data).returning({ id: bulletins.id })
    return (await this.findById(row.id))!
  }

  async update(id: number, data: Partial<NewBulletinRow>): Promise<BulletinWithEditor> {
    await this.db.update(bulletins).set(data).where(eq(bulletins.id, id))
    return (await this.findById(id))!
  }

  async delete(id: number): Promise<void> {
    await this.db.delete(bulletins).where(eq(bulletins.id, id))
  }

  private selectWithEditor() {
    return this.db
      .select({ ...getTableColumns(bulletins), editorFirstName: users.firstName, editorLastName: users.lastName })
      .from(bulletins)
      .leftJoin(users, eq(users.id, bulletins.updatedBy))
  }
}

export const bulletinRepository = new BulletinsRepository(db)
