import { asc, eq } from 'drizzle-orm'

import { db, type Database } from '../../config/database.ts'
import { directoryExtensions, directorySync, type DirectoryExtensionRow, type DirectorySyncRow } from '../../database/schema/index.ts'

const STATE_ID = 1

export class DirectoryRepository {
  private readonly db: Database

  constructor(database: Database) {
    this.db = database
  }

  findMany(): Promise<DirectoryExtensionRow[]> {
    return this.db.select().from(directoryExtensions).orderBy(asc(directoryExtensions.ext))
  }

  async findState(): Promise<DirectorySyncRow | null> {
    const [row] = await this.db.select().from(directorySync).where(eq(directorySync.id, STATE_ID))
    return row ?? null
  }

  /** Cambia la copia entera por la nueva y anota la sincronización buena, todo junto. */
  async replaceAll(rows: { ext: string; name: string }[], at: Date): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx.delete(directoryExtensions)
      for (let i = 0; i < rows.length; i += 500) {
        await tx.insert(directoryExtensions).values(rows.slice(i, i + 500).map((r) => ({ ...r, seenAt: at })))
      }
      const state = { lastOkAt: at, lastAttemptAt: at, lastError: null, count: rows.length }
      await tx.insert(directorySync).values({ id: STATE_ID, ...state }).onConflictDoUpdate({ target: directorySync.id, set: state })
    })
  }

  /** Anota un intento fallido sin tocar la copia. */
  async saveFailure(message: string, at: Date): Promise<void> {
    await this.db
      .insert(directorySync)
      .values({ id: STATE_ID, lastAttemptAt: at, lastError: message })
      .onConflictDoUpdate({ target: directorySync.id, set: { lastAttemptAt: at, lastError: message } })
  }
}

export const directoryRepository = new DirectoryRepository(db)
