import { integer, pgTable, text, timestamp } from 'drizzle-orm/pg-core'

/**
 * Última copia buena de las extensiones de la central telefónica (Grandstream UCM). Ley 81: solo la
 * extensión y el nombre que tiene en la central; todo lo demás que devuelve la central se descarta antes
 * de guardar. La copia entera se reemplaza en cada sincronización que trae datos.
 */
export const directoryExtensions = pgTable('directorio_extensiones', {
  ext: text('ext').primaryKey(),
  name: text('name').notNull(),
  seenAt: timestamp('seen_at', { withTimezone: true }).notNull().defaultNow(),
})

/** Estado de la sincronización con la central: una sola fila (id = 1). */
export const directorySync = pgTable('directorio_sincronizacion', {
  id: integer('id').primaryKey(),
  lastOkAt: timestamp('last_ok_at', { withTimezone: true }),
  lastAttemptAt: timestamp('last_attempt_at', { withTimezone: true }),
  // Mensaje corto y sin datos de la central (nunca su dirección, usuario ni respuesta).
  lastError: text('last_error'),
  count: integer('count').notNull().default(0),
})

export type DirectoryExtensionRow = typeof directoryExtensions.$inferSelect
export type DirectorySyncRow = typeof directorySync.$inferSelect
