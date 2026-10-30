import { and, desc, eq, sql, type SQL } from 'drizzle-orm'

import { db, type Database } from '../../config/database.ts'
import { eventAudit, type EventAuditRow, type NewEventAuditRow } from '../../database/schema/index.ts'

export type AuditFilter = { type?: string; subjectType?: string; subjectId?: number; limit: number }

export class AuditRepository {
  private readonly db: Database

  constructor(database: Database) {
    this.db = database
  }

  /**
   * Guarda el evento. Es un upsert porque la entrega (addDeliveries) puede llegar
   * antes: el orden de las dos escrituras no importa.
   */
  async upsertEvent(row: Omit<NewEventAuditRow, 'deliveredCount'>): Promise<void> {
    await this.db
      .insert(eventAudit)
      .values(row)
      .onConflictDoUpdate({
        target: eventAudit.id,
        set: { type: row.type, actorId: row.actorId, subjectType: row.subjectType, subjectId: row.subjectId, payload: row.payload, createdAt: row.createdAt },
      })
  }

  /** Suma entregas al evento (crea la fila si todavía no existe; upsertEvent la completa). */
  async addDeliveries(id: string, type: string, count: number): Promise<void> {
    await this.db
      .insert(eventAudit)
      .values({ id, type, deliveredCount: count })
      .onConflictDoUpdate({ target: eventAudit.id, set: { deliveredCount: sql`${eventAudit.deliveredCount} + ${count}` } })
  }

  async findMany(filter: AuditFilter): Promise<EventAuditRow[]> {
    const conditions: SQL[] = []
    if (filter.type) conditions.push(eq(eventAudit.type, filter.type))
    if (filter.subjectType) conditions.push(eq(eventAudit.subjectType, filter.subjectType))
    if (filter.subjectId) conditions.push(eq(eventAudit.subjectId, filter.subjectId))
    return this.db
      .select()
      .from(eventAudit)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(eventAudit.createdAt))
      .limit(filter.limit)
  }
}

export const auditRepository = new AuditRepository(db)
