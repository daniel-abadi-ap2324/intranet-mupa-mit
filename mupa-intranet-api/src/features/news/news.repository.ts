import { desc, eq, getTableColumns, inArray } from 'drizzle-orm'

import { db, type Database } from '../../config/database.ts'
import { news, users, type NewNewsRow, type NewsRow } from '../../database/schema/index.ts'

export type NewsWithEditor = NewsRow & { editorFirstName: string | null; editorLastName: string | null }

export class NewsRepository {
  private readonly db: Database

  constructor(database: Database) {
    this.db = database
  }

  async findMany(filter: { publishedOnly: boolean }): Promise<NewsWithEditor[]> {
    return this.selectWithEditor()
      .where(filter.publishedOnly ? eq(news.status, 'publicado') : undefined)
      .orderBy(desc(news.date), desc(news.id))
  }

  async findById(id: number): Promise<NewsWithEditor | undefined> {
    const [row] = await this.selectWithEditor().where(eq(news.id, id)).limit(1)
    return row
  }

  /** De esos source_id, los que ya están guardados (los importó la sincronización) y si ya tienen su texto. */
  async findBySourceIds(sourceIds: string[]): Promise<Map<string, { id: number; hasBody: boolean }>> {
    if (!sourceIds.length) return new Map()
    const rows = await this.db.select({ id: news.id, sourceId: news.sourceId, body: news.body }).from(news).where(inArray(news.sourceId, sourceIds))
    return new Map(rows.map((r) => [r.sourceId!, { id: r.id, hasBody: Boolean(r.body) }]))
  }

  async create(data: NewNewsRow): Promise<NewsWithEditor> {
    const [row] = await this.db.insert(news).values(data).returning({ id: news.id })
    return (await this.findById(row.id))!
  }

  async update(id: number, data: Partial<NewNewsRow>): Promise<NewsWithEditor> {
    await this.db.update(news).set(data).where(eq(news.id, id))
    return (await this.findById(id))!
  }

  async delete(id: number): Promise<void> {
    await this.db.delete(news).where(eq(news.id, id))
  }

  private selectWithEditor() {
    return this.db
      .select({ ...getTableColumns(news), editorFirstName: users.firstName, editorLastName: users.lastName })
      .from(news)
      .leftJoin(users, eq(users.id, news.updatedBy))
  }
}

export const newsRepository = new NewsRepository(db)
