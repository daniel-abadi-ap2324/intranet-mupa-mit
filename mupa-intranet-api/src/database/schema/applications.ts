import { sql } from 'drizzle-orm'
import { boolean, integer, pgTable, primaryKey, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core'

import { departments } from './departments.ts'
import { tags } from './tags.ts'

/**
 * Catálogo de aplicaciones. Los valores de area, access y status son los mismos
 * que usa el frontend (lib/catalogo.ts). published = false es un borrador.
 */
export const applications = pgTable(
  'applications',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    slug: text('slug').notNull().unique(),
    name: text('name').notNull(),
    description: text('description').notNull(),
    url: text('url'),
    area: text('area').notNull(),
    icon: text('icon').notNull().default('▦'),
    access: text('access').notNull().default('todos'),
    status: text('status').notNull().default('publicado'),
    external: boolean('external').notNull().default(false),
    pdf: boolean('pdf').notNull().default(false),
    featured: boolean('featured').notNull().default(false),
    confirmed: boolean('confirmed').notNull().default(false),
    keywords: text('keywords').notNull().default(''),
    note: text('note').notNull().default(''),
    origin: text('origin').notNull().default('panel'),
    published: boolean('published').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  // Dos aplicaciones no pueden apuntar a la misma dirección.
  (t) => [uniqueIndex('applications_url_unique').on(t.url).where(sql`${t.url} is not null`)],
)

export const applicationTags = pgTable(
  'application_tags',
  {
    applicationId: integer('application_id')
      .notNull()
      .references(() => applications.id, { onDelete: 'cascade' }),
    tagId: integer('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.applicationId, t.tagId] })],
)

/**
 * Departamentos que ven una aplicación. Sin filas: la ven todos (según `access`).
 * Con filas: solo las personas de esos departamentos (y administración).
 */
export const applicationDepartments = pgTable(
  'application_departments',
  {
    applicationId: integer('application_id')
      .notNull()
      .references(() => applications.id, { onDelete: 'cascade' }),
    departmentId: integer('department_id')
      .notNull()
      .references(() => departments.id, { onDelete: 'restrict' }),
  },
  (t) => [primaryKey({ columns: [t.applicationId, t.departmentId] })],
)

export type ApplicationRow = typeof applications.$inferSelect
export type NewApplicationRow = typeof applications.$inferInsert
