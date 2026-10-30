import { boolean, integer, pgTable, text } from 'drizzle-orm/pg-core'

/** Etiquetas del catálogo: "para quién" (audience = true) y temas. */
export const tags = pgTable('tags', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  name: text('name').notNull().unique(),
  audience: boolean('audience').notNull().default(false),
})

export type TagRow = typeof tags.$inferSelect
