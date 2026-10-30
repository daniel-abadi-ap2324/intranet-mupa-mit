import { boolean, integer, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core'

import { users } from './users.ts'

/**
 * Formularios de solicitud. `sections` es la definición completa (secciones y
 * campos, el mismo formato que pinta la web: src/lib/formularios.ts). Los crea y
 * edita el Gestor de Solicitudes.
 *  - accepting: el interruptor "Recibe solicitudes". Apagado, el envío es de prueba
 *    (no se guarda nada); se prende cuando el área aprueba el formulario.
 *  - pendingDefinition: «a definir con RRHH»: su alcance todavía no está decidido, así
 *    que no puede recibir solicitudes (el servicio rechaza prender `accepting`).
 *  - published: si se ve en la intranet.
 */
export const forms = pgTable('forms', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  slug: text('slug').notNull().unique(),
  /** "Form. 14": el número que usan las áreas para referirse al formulario. */
  number: integer('number').notNull().unique(),
  title: text('title').notNull(),
  /** Para agrupar: "Tecnología", "Recursos Humanos"… */
  area: text('area').notNull(),
  /** A quién llega, como se le muestra a la persona. */
  destination: text('destination').notNull().default(''),
  deadline: text('deadline'),
  intro: text('intro').notNull().default(''),
  notes: jsonb('notes').$type<string[]>().notNull().default([]),
  changes: jsonb('changes').$type<string[]>().notNull().default([]),
  sections: jsonb('sections').notNull(),
  accepting: boolean('accepting').notNull().default(false),
  pendingDefinition: boolean('pending_definition').notNull().default(false),
  published: boolean('published').notNull().default(true),
  createdBy: integer('created_by').references(() => users.id, { onDelete: 'set null' }),
  updatedBy: integer('updated_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
})

export type FormRow = typeof forms.$inferSelect
export type NewFormRow = typeof forms.$inferInsert
