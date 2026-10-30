import { asc, sql, eq, getTableColumns } from 'drizzle-orm'

import { db, type Database } from '../../config/database.ts'
import { videos, users, type NewVideoRow, type VideoRow } from '../../database/schema/index.ts'

export type VideoWithEditor = VideoRow & { editorFirstName: string | null; editorLastName: string | null }

// Primero los instructivos, luego los del canal y al final los demás.
const CATEGORY_ORDER = sql`case ${videos.category} when 'instructivo' then 0 when 'canal' then 1 else 2 end`

export class VideosRepository {
  private readonly db: Database

  constructor(database: Database) {
    this.db = database
  }

  async findMany(filter: { publishedOnly: boolean }): Promise<VideoWithEditor[]> {
    return this.selectWithEditor()
      .where(filter.publishedOnly ? eq(videos.published, true) : undefined)
      .orderBy(CATEGORY_ORDER, sql`${videos.date} desc nulls last`, asc(videos.id))
  }

  async findById(id: number): Promise<VideoWithEditor | undefined> {
    const [row] = await this.selectWithEditor().where(eq(videos.id, id)).limit(1)
    return row
  }

  async create(data: NewVideoRow): Promise<VideoWithEditor> {
    const [row] = await this.db.insert(videos).values(data).returning({ id: videos.id })
    return (await this.findById(row.id))!
  }

  async update(id: number, data: Partial<NewVideoRow>): Promise<VideoWithEditor> {
    await this.db.update(videos).set(data).where(eq(videos.id, id))
    return (await this.findById(id))!
  }

  async delete(id: number): Promise<void> {
    await this.db.delete(videos).where(eq(videos.id, id))
  }

  private selectWithEditor() {
    return this.db
      .select({ ...getTableColumns(videos), editorFirstName: users.firstName, editorLastName: users.lastName })
      .from(videos)
      .leftJoin(users, eq(users.id, videos.updatedBy))
  }
}

export const videoRepository = new VideosRepository(db)
