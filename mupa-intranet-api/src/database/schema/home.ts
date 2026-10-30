import { integer, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core'

import { users } from './users.ts'

/** Diseño del Inicio que cada persona guardó (sin fila = usa el de todos). */
export const homeLayouts = pgTable('home_layouts', {
  userId: integer('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  layout: jsonb('layout').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
})

/**
 * Ajustes del Inicio, uno por clave:
 *  - 'content'         contenido del Inicio (noticias, enlaces…; los anuncios tienen su tabla)
 *  - 'default_layout'  diseño por defecto para todos (sin fila = el de la propuesta)
 */
export const homeSettings = pgTable('home_settings', {
  key: text('key').primaryKey(),
  value: jsonb('value').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
})
