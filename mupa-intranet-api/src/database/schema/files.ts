import { integer, pgTable, text, timestamp } from 'drizzle-orm/pg-core'

import { users } from './users.ts'

/**
 * Archivos subidos por Comunicación (PDF de boletines, imágenes de noticias). El
 * contenido vive en disco (UPLOADS_DIR, con nombre propio `stored_name`); aquí va
 * el nombre original, el tipo comprobado y quién lo subió.
 */
export const files = pgTable('files', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  storedName: text('stored_name').notNull().unique(),
  originalName: text('original_name').notNull(),
  mimeType: text('mime_type').notNull(),
  size: integer('size').notNull(),
  createdBy: integer('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export type FileRow = typeof files.$inferSelect
export type NewFileRow = typeof files.$inferInsert
