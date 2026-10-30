import { sql } from 'drizzle-orm'
import { boolean, integer, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core'

import { departments } from './departments.ts'

/**
 * Personas con cuenta. Dos tipos:
 *  - de Identity Central (login de la Alcaldía): se enlazan por identity_sub, el
 *    `sub` (UUID) del token, que es su identidad. El correo es solo un dato para
 *    mostrar: puede cambiar, faltar o repetirse, así que no es único.
 *  - locales (identity_sub NULL): las cuentas ficticias de prueba, con clave.
 *    Para ellas el correo sí es único, porque es con lo que entran.
 * La cédula se guarda (decisión de Daniel, 8-oct-2026) para que administración la vea en la ficha de la persona
 * (/gestion/usuarios): la que usó para entrar o el claim identity_number, en cada ingreso. Solo la lee el rol admin
 * (GET /api/users/:id); nunca va en la lista, en /api/auth/me ni en los logs. Las cuentas de prueba no la tienen.
 */
export const users = pgTable(
  'users',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    identitySub: text('identity_sub').unique(),
    email: text('email'),
    emailVerified: boolean('email_verified'),
    firstName: text('first_name').notNull(),
    lastName: text('last_name'),
    // Cédula con guiones (8-123-456), la del último ingreso por Identity Central; null = todavía no se conoce.
    cedula: text('cedula'),
    passwordHash: text('password_hash'),
    roles: text('roles').array().notNull().default(['funcionario']),
    // Lo asigna administración; un departamento con personas no se puede borrar.
    departmentId: integer('department_id').references(() => departments.id, { onDelete: 'restrict' }),
    // Autodeclarados al registrarse; no se validan contra ningún sistema.
    phone: text('phone'),
    jobTitle: text('job_title'),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    // Cuándo vio (o saltó) el recorrido para usuarios nuevos; null = todavía no.
    tourSeenAt: timestamp('tour_seen_at', { withTimezone: true }),
    // Cuándo administración la suspendió; null = activa. Suspendida no entra ni conserva sesiones.
    suspendedAt: timestamp('suspended_at', { withTimezone: true }),
    // Cuenta borrada por administración: queda solo el registro mínimo (el `sub` de Identity Central, que no se
    // puede borrar allá) para que no se vuelva a crear al entrar. Siempre va junto con suspended_at; no se lista.
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    failedLoginAttempts: integer('failed_login_attempts').notNull().default(0),
    lockedUntil: timestamp('locked_until', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [uniqueIndex('users_local_email_unique').on(t.email).where(sql`${t.identitySub} is null`)],
)

export type UserRow = typeof users.$inferSelect
export type NewUserRow = typeof users.$inferInsert
