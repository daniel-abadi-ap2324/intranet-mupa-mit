import { index, integer, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core'

import { forms } from './forms.ts'
import { users } from './users.ts'

/**
 * Solicitudes enviadas con un formulario que recibe solicitudes. Guardan una copia
 * del formulario tal como estaba al enviarla (título, área y secciones): editarlo
 * después no cambia lo que la persona pidió.
 *  - data: las respuestas (solo las de los campos que estaban en juego).
 *  - summary: lo mismo, legible: [{ titulo, filas: [{ dt, dd }] }].
 *  - seen_by_owner_at: la última vez que la persona abrió su solicitud (para "Nueva respuesta").
 */
export const requests = pgTable(
  'requests',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    folio: text('folio').unique(),
    formId: integer('form_id')
      .notNull()
      .references(() => forms.id, { onDelete: 'restrict' }),
    formTitle: text('form_title').notNull(),
    formArea: text('form_area').notNull(),
    formSections: jsonb('form_sections').notNull(),
    userId: integer('user_id')
      .notNull()
      // Si se borra la cuenta, se borran sus solicitudes (y su línea de tiempo).
      .references(() => users.id, { onDelete: 'cascade' }),
    data: jsonb('data').notNull(),
    summary: jsonb('summary').notNull(),
    status: text('status').notNull().default('recibida'),
    seenByOwnerAt: timestamp('seen_by_owner_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index('requests_user_idx').on(t.userId, t.createdAt), index('requests_status_idx').on(t.status, t.createdAt)],
)

/** Línea de tiempo de cada solicitud: cuándo se creó, cada cambio de estado y cada mensaje del Gestor. Solo texto. */
export const requestEvents = pgTable(
  'request_events',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    requestId: integer('request_id')
      .notNull()
      .references(() => requests.id, { onDelete: 'cascade' }),
    authorId: integer('author_id').references(() => users.id, { onDelete: 'set null' }),
    type: text('type').notNull(),
    status: text('status'),
    body: text('body'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('request_events_request_idx').on(t.requestId, t.createdAt)],
)

export type RequestRow = typeof requests.$inferSelect
export type NewRequestRow = typeof requests.$inferInsert
export type RequestEventRow = typeof requestEvents.$inferSelect
