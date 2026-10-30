import { asc, inArray } from 'drizzle-orm'

import { db, type Database } from '../../config/database.ts'
import { tags, type TagRow } from '../../database/schema/index.ts'

export class TagsRepository {
  private readonly db: Database

  constructor(database: Database) {
    this.db = database
  }

  findMany(): Promise<TagRow[]> {
    return this.db.select().from(tags).orderBy(asc(tags.name))
  }

  findByIds(ids: number[]): Promise<TagRow[]> {
    if (!ids.length) return Promise.resolve([])
    return this.db.select().from(tags).where(inArray(tags.id, ids))
  }
}

export const tagsRepository = new TagsRepository(db)
