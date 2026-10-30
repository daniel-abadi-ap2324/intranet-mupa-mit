import { and, eq, gt, lte } from 'drizzle-orm'

import { db, type Database } from '../../config/database.ts'
import { sessions, type SessionRow } from '../../database/schema/index.ts'

export class AuthRepository {
  private readonly db: Database

  constructor(database: Database) {
    this.db = database
  }

  async create(data: { tokenHash: string; userId: number; expiresAt: Date; refreshToken?: string; accessExpiresAt?: Date; cedula?: string }): Promise<void> {
    await this.db.insert(sessions).values(data)
  }

  /** Sesión vigente (no vencida) con ese token. */
  async findByTokenHash(tokenHash: string, now: Date): Promise<SessionRow | undefined> {
    const [row] = await this.db
      .select()
      .from(sessions)
      .where(and(eq(sessions.tokenHash, tokenHash), gt(sessions.expiresAt, now)))
      .limit(1)
    return row
  }

  async updateTokens(id: number, data: { refreshToken: string; accessExpiresAt: Date }): Promise<void> {
    await this.db.update(sessions).set(data).where(eq(sessions.id, id))
  }

  /** Borra la sesión y la devuelve (aunque ya hubiera vencido), para poder revocar su refresh token. */
  async deleteByTokenHash(tokenHash: string): Promise<SessionRow | undefined> {
    const [row] = await this.db.delete(sessions).where(eq(sessions.tokenHash, tokenHash)).returning()
    return row
  }

  async deleteById(id: number): Promise<void> {
    await this.db.delete(sessions).where(eq(sessions.id, id))
  }

  async deleteExpiredByUserId(userId: number, now: Date): Promise<void> {
    await this.db.delete(sessions).where(and(eq(sessions.userId, userId), lte(sessions.expiresAt, now)))
  }
}

export const authRepository = new AuthRepository(db)
