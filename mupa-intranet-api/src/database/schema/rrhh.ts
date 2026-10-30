import { index, integer, pgTable, text, timestamp } from 'drizzle-orm/pg-core'

import { sessions } from './sessions.ts'
import { users } from './users.ts'

/**
 * Cuentas de RRHH Express conectadas, una por sesión. Se guarda solo el token de
 * RH Link, cifrado con una clave que sale de la cookie de la sesión (sin ella no
 * sirve). Ni la contraseña ni la cédula: la cédula va dentro del token.
 * Al cerrarse o borrarse la sesión, la conexión desaparece con ella.
 */
export const rrhhConnections = pgTable(
  'rrhh_conexiones',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    sessionId: integer('session_id')
      .notNull()
      .unique()
      .references(() => sessions.id, { onDelete: 'cascade' }),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    token: text('token').notNull(),
    // Cuando vence el token de RH Link (su `exp`).
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('rrhh_conexiones_user_id_idx').on(t.userId)],
)

export type RrhhConnectionRow = typeof rrhhConnections.$inferSelect

/**
 * Conexiones de RRHH Express de quien NO tiene sesión en la intranet (cédula y número de cargo).
 * `id` es el SHA-256 de la cookie `mupa_invitado` (la cookie en sí no se guarda). Solo el token
 * de RH Link, cifrado con una clave que sale de esa cookie; ni cédula ni contraseña.
 * Vencen solas (`expires_at`) y se purgan al conectar.
 */
export const rrhhGuestConnections = pgTable('rrhh_conexiones_invitado', {
  id: text('id').primaryKey(),
  token: text('token').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export type RrhhGuestConnectionRow = typeof rrhhGuestConnections.$inferSelect
