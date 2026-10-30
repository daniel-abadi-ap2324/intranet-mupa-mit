import { boolean, date, index, integer, pgTable, text, timestamp } from 'drizzle-orm/pg-core'

import { users } from './users.ts'

const edition = () => ({
  createdBy: integer('created_by').references(() => users.id, { onDelete: 'set null' }),
  updatedBy: integer('updated_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
})

/**
 * Boletines "Alcaldía al día". pdf_url: el PDF (subido a /api/files/… o copiado
 * en /sitio/…); null si no hay (el del 13 de mayo de 2025 no se pudo migrar).
 * flipbook_url: la versión hojeable del sitio actual, si existe.
 * cover_url: portada (página 1 del PDF), solo en los que importa la sincronización con mupa.gob.pa.
 * source_id: de dónde viene si lo importó la sincronización (evita duplicarlo); null si lo cargó alguien.
 */
export const bulletins = pgTable(
  'bulletins',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    date: date('date').notNull(),
    pdfUrl: text('pdf_url'),
    flipbookUrl: text('flipbook_url'),
    coverUrl: text('cover_url'),
    /** Descripción corta: los titulares del boletín, sacados de su PDF. */
    summary: text('summary'),
    /** Palabras clave, separadas por coma, sacadas de su PDF. */
    keywords: text('keywords'),
    /** Para buscar: fecha, titulares, palabras clave y texto del PDF, sin tildes ni mayúsculas (shared/services/pdf-text.service.ts). */
    searchText: text('search_text'),
    note: text('note').notNull().default(''),
    published: boolean('published').notNull().default(true),
    sourceId: text('source_id').unique(),
    ...edition(),
  },
  (t) => [index('bulletins_date_idx').on(t.date)],
)

/** Noticias y consejos ("tips") de la sección Noticias y del bloque del Inicio. Solo texto. */
export const news = pgTable(
  'news',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    title: text('title').notNull(),
    summary: text('summary'),
    type: text('type').notNull().default('noticia'),
    date: date('date').notNull(),
    link: text('link'),
    imageUrl: text('image_url'),
    /** El texto completo (solo texto, párrafos separados por una línea en blanco), para leerla dentro de la intranet. Solo las que trae la sincronización. */
    body: text('body'),
    status: text('status').notNull().default('borrador'),
    sourceId: text('source_id').unique(),
    ...edition(),
  },
  (t) => [index('news_status_date_idx').on(t.status, t.date)],
)

/** Videos: instructivos de la Mesa de Servicios, del canal de YouTube y otros. Se abren en otra pestaña (CSP). */
export const videos = pgTable('videos', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  title: text('title').notNull(),
  url: text('url').notNull(),
  category: text('category').notNull().default('otro'),
  description: text('description').notNull().default(''),
  date: date('date'),
  published: boolean('published').notNull().default(true),
  ...edition(),
})

export type BulletinRow = typeof bulletins.$inferSelect
export type NewBulletinRow = typeof bulletins.$inferInsert
export type NewsRow = typeof news.$inferSelect
export type NewNewsRow = typeof news.$inferInsert
export type VideoRow = typeof videos.$inferSelect
export type NewVideoRow = typeof videos.$inferInsert
