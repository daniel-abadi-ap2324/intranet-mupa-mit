import { eq, lte } from 'drizzle-orm'

import { db, type Database } from '../../config/database.ts'
import { rrhhConnections, rrhhGuestConnections, type RrhhConnectionRow, type RrhhGuestConnectionRow } from '../../database/schema/index.ts'

export class RrhhRepository {
  private readonly db: Database

  constructor(database: Database) {
    this.db = database
  }

  async findBySessionId(sessionId: number): Promise<RrhhConnectionRow | undefined> {
    const [row] = await this.db.select().from(rrhhConnections).where(eq(rrhhConnections.sessionId, sessionId)).limit(1)
    return row
  }

  /** Una conexión por sesión: si ya había una, se reemplaza. */
  async upsert(data: { sessionId: number; userId: number; token: string; expiresAt: Date }): Promise<void> {
    await this.db
      .insert(rrhhConnections)
      .values(data)
      .onConflictDoUpdate({ target: rrhhConnections.sessionId, set: { token: data.token, expiresAt: data.expiresAt, createdAt: new Date() } })
  }

  async deleteBySessionId(sessionId: number): Promise<void> {
    await this.db.delete(rrhhConnections).where(eq(rrhhConnections.sessionId, sessionId))
  }

  // ---------- Conexiones de invitado (sin sesión de la intranet) ----------

  async findGuest(id: string): Promise<RrhhGuestConnectionRow | undefined> {
    const [row] = await this.db.select().from(rrhhGuestConnections).where(eq(rrhhGuestConnections.id, id)).limit(1)
    return row
  }

  async insertGuest(data: { id: string; token: string; expiresAt: Date }): Promise<void> {
    await this.db.insert(rrhhGuestConnections).values(data)
  }

  async renewGuest(id: string, expiresAt: Date): Promise<void> {
    await this.db.update(rrhhGuestConnections).set({ expiresAt }).where(eq(rrhhGuestConnections.id, id))
  }

  async deleteGuest(id: string): Promise<void> {
    await this.db.delete(rrhhGuestConnections).where(eq(rrhhGuestConnections.id, id))
  }

  /** Borra las conexiones de invitado vencidas. */
  async purgeGuests(now: Date): Promise<void> {
    await this.db.delete(rrhhGuestConnections).where(lte(rrhhGuestConnections.expiresAt, now))
  }
}

export const rrhhRepository = new RrhhRepository(db)
