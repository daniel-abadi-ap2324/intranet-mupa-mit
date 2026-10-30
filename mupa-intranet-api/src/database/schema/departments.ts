import { integer, pgTable, text, timestamp } from 'drizzle-orm/pg-core'

/**
 * Departamentos (direcciones) de la Alcaldía. Cada persona elige el suyo al
 * registrarse y administración lo corrige: Identity Central no los informa. Deciden
 * qué aplicaciones del catálogo ve cada quien (application_departments).
 */
export const departments = pgTable('departments', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  name: text('name').notNull().unique(),
  // Código de la unidad en RRHH (MUNICIPIO.dbo.ubicaciones); null = creado desde la intranet.
  rrhhCode: integer('rrhh_code').unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export type DepartmentRow = typeof departments.$inferSelect
