import { eq } from 'drizzle-orm'

import { db, type Database } from '../../config/database.ts'
import { files, type FileRow, type NewFileRow } from '../../database/schema/index.ts'

export class FilesRepository {
  private readonly db: Database

  constructor(database: Database) {
    this.db = database
  }

  async findById(id: number): Promise<FileRow | undefined> {
    const [row] = await this.db.select().from(files).where(eq(files.id, id)).limit(1)
    return row
  }

  async create(data: NewFileRow): Promise<FileRow> {
    const [row] = await this.db.insert(files).values(data).returning()
    return row
  }
}

export const filesRepository = new FilesRepository(db)
