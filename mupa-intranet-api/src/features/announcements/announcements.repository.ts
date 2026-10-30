import { and, desc, eq, getTableColumns, gte, isNull, lte, or, sql, type SQL } from 'drizzle-orm'

import { db, type Database } from '../../config/database.ts'
import { announcements, users, type AnnouncementRow, type NewAnnouncementRow } from '../../database/schema/index.ts'

/** El anuncio con el nombre de quien lo editó por última vez. */
export type AnnouncementWithEditor = AnnouncementRow & { editorFirstName: string | null; editorLastName: string | null }

export type AnnouncementFilter = {
  /** Solo los publicados que se ven ese día ("AAAA-MM-DD"). */
  activeOn?: string
}

// Primero los urgentes, después los importantes; dentro de cada nivel, los más recientes.
const LEVEL_ORDER = sql`case ${announcements.level} when 'urgente' then 0 when 'importante' then 1 else 2 end`

export class AnnouncementsRepository {
  private readonly db: Database

  constructor(database: Database) {
    this.db = database
  }

  async findMany(filter: AnnouncementFilter): Promise<AnnouncementWithEditor[]> {
    const conditions: SQL[] = []
    if (filter.activeOn) {
      conditions.push(
        eq(announcements.status, 'publicado'),
        lte(announcements.publishFrom, filter.activeOn),
        or(isNull(announcements.publishUntil), gte(announcements.publishUntil, filter.activeOn))!,
      )
    }
    return this.selectWithEditor()
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(LEVEL_ORDER, desc(announcements.publishFrom), desc(announcements.id))
  }

  async findById(id: number): Promise<AnnouncementWithEditor | undefined> {
    const [row] = await this.selectWithEditor().where(eq(announcements.id, id)).limit(1)
    return row
  }

  async create(data: NewAnnouncementRow): Promise<AnnouncementWithEditor> {
    const [row] = await this.db.insert(announcements).values(data).returning({ id: announcements.id })
    return (await this.findById(row.id))!
  }

  async update(id: number, data: Partial<NewAnnouncementRow>): Promise<AnnouncementWithEditor> {
    await this.db.update(announcements).set(data).where(eq(announcements.id, id))
    return (await this.findById(id))!
  }

  async delete(id: number): Promise<void> {
    await this.db.delete(announcements).where(eq(announcements.id, id))
  }

  private selectWithEditor() {
    return this.db
      .select({ ...getTableColumns(announcements), editorFirstName: users.firstName, editorLastName: users.lastName })
      .from(announcements)
      .leftJoin(users, eq(users.id, announcements.updatedBy))
      .$dynamic()
  }
}

export const announcementsRepository = new AnnouncementsRepository(db)
