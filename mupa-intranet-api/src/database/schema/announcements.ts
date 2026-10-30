import { date, index, integer, pgTable, text, timestamp } from 'drizzle-orm/pg-core'

import { users } from './users.ts'

/**
 * Anuncios institucionales del Inicio, publicados por Comunicación.
 * Solo texto (sin HTML). Se ven en el Inicio si status = 'publicado' y hoy
 * (hora de Panamá) está entre publish_from y publish_until (inclusive; sin
 * publish_until no vencen). Las fechas son `date` ("AAAA-MM-DD"), sin hora ni zona.
 * 'retirado' lo saca del Inicio sin borrarlo.
 */
export const announcements = pgTable(
  'announcements',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    title: text('title').notNull(),
    body: text('body'),
    level: text('level').notNull().default('normal'),
    link: text('link'),
    status: text('status').notNull().default('borrador'),
    publishFrom: date('publish_from').notNull(),
    publishUntil: date('publish_until'),
    createdBy: integer('created_by').references(() => users.id, { onDelete: 'set null' }),
    updatedBy: integer('updated_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index('announcements_status_publish_from_idx').on(t.status, t.publishFrom)],
)

export type AnnouncementRow = typeof announcements.$inferSelect
export type NewAnnouncementRow = typeof announcements.$inferInsert
