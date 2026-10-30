import { sql } from 'drizzle-orm'

import { db, type Database } from '../../config/database.ts'

export class HealthRepository {
  private readonly db: Database

  constructor(database: Database) {
    this.db = database
  }

  async ping(): Promise<void> {
    await this.db.execute(sql`select 1`)
  }
}

export const healthRepository = new HealthRepository(db)
