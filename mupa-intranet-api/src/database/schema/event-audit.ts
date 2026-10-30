import { index, integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

import { users } from './users.ts'

/**
 * Auditoría de los eventos del bus (shared/services/event-bus.service.ts): una fila
 * por evento, con quién lo provocó, sobre qué fue y a cuántas personas se les
 * entregó en vivo. La llena el feature `audit`; nunca guarda cédulas ni las
 * respuestas de los formularios (solo lo que viaja en el evento).
 *  - id: el id del sobre del evento (lo pone el bus).
 *  - subject_type / subject_id: sobre qué es ("request" + id de la solicitud).
 *  - delivered_count: a cuántas conexiones de notificaciones se mandó.
 */
export const eventAudit = pgTable(
  'event_audit',
  {
    id: uuid('id').primaryKey(),
    type: text('type').notNull(),
    actorId: integer('actor_id').references(() => users.id, { onDelete: 'set null' }),
    subjectType: text('subject_type'),
    subjectId: integer('subject_id'),
    payload: jsonb('payload').notNull().default({}),
    deliveredCount: integer('delivered_count').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('event_audit_type_created_idx').on(t.type, t.createdAt), index('event_audit_subject_idx').on(t.subjectType, t.subjectId)],
)

export type EventAuditRow = typeof eventAudit.$inferSelect
export type NewEventAuditRow = typeof eventAudit.$inferInsert
