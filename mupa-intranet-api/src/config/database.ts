/**
 * Conexión a la base.
 *  - Con DATABASE_URL: PostgreSQL (node-postgres). Es lo que corre en Docker y en el servidor.
 *  - Sin DATABASE_URL (solo desarrollo y pruebas): PGlite, un PostgreSQL real
 *    compilado a WASM que guarda en PGLITE_DATA_DIR. Sirve para trabajar sin
 *    Docker; usa las mismas migraciones. Se carga solo si hace falta (es devDependency).
 */
import fs from 'node:fs'

import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres'
import pg from 'pg'

import * as schema from '../database/schema/index.ts'
import { env } from './env.ts'

export type Database = NodePgDatabase<typeof schema>
export type DatabaseDriver = 'postgres' | 'pglite'

async function connect(): Promise<{ db: Database; driver: DatabaseDriver; close: () => Promise<void> }> {
  if (env.DATABASE_URL) {
    const pool = new pg.Pool({ connectionString: env.DATABASE_URL, max: 10 })
    return { db: drizzle(pool, { schema }), driver: 'postgres', close: () => pool.end() }
  }

  const { PGlite } = await import('@electric-sql/pglite')
  const { drizzle: drizzlePglite } = await import('drizzle-orm/pglite')
  const dir = env.PGLITE_DATA_DIR
  if (!dir.startsWith('memory://')) fs.mkdirSync(dir, { recursive: true })
  const client = new PGlite(dir)
  // Mismo API de consultas que node-postgres: se usa con el mismo tipo.
  const db = drizzlePglite(client, { schema }) as unknown as Database
  return { db, driver: 'pglite', close: () => client.close() }
}

const connection = await connect()

export const db = connection.db
export const databaseDriver = connection.driver
export const closeDatabase = connection.close
