import { index, integer, pgTable, text, timestamp } from 'drizzle-orm/pg-core'

import { users } from './users.ts'

/**
 * Sesiones abiertas. La cookie lleva un token al azar; aquí solo se guarda su
 * hash (SHA-256), así una copia de la base no sirve para entrar.
 *
 * Las de Identity Central guardan además su refresh token, cifrado con una clave
 * que sale del token de la cookie (tampoco sirve sin ella), y cuándo vence el
 * access token: a partir de ahí la sesión se renueva contra Identity Central.
 *
 * `cedula`: la cédula con la que la persona entró (o el claim identity_number del token), cifrada igual
 * que el refresh token y borrada con la sesión. No está en `users`: la intranet no guarda cédulas. Sirve
 * para consultar sistemas que se buscan por cédula (p. ej. las citas de la Clínica).
 */
export const sessions = pgTable(
  'sessions',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    tokenHash: text('token_hash').notNull().unique(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    // ~3 KB (es un JWE): text, nunca varchar(255) (§7.9).
    refreshToken: text('refresh_token'),
    accessExpiresAt: timestamp('access_expires_at', { withTimezone: true }),
    cedula: text('cedula'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('sessions_user_id_idx').on(t.userId)],
)

export type SessionRow = typeof sessions.$inferSelect
