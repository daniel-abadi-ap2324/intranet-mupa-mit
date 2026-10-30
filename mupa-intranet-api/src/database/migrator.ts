import path from 'node:path'

import { databaseDriver, db } from '../config/database.ts'

/** Carpeta de las migraciones de drizzle-kit (en la imagen se copia junto al código compilado). */
const migrationsFolder = path.join(import.meta.dirname, 'migrations')

/** Aplica las migraciones pendientes (Drizzle lleva el registro en drizzle.__drizzle_migrations). */
export async function runMigrations(): Promise<void> {
  if (databaseDriver === 'pglite') {
    const { migrate } = await import('drizzle-orm/pglite/migrator')
    await migrate(db as unknown as Parameters<typeof migrate>[0], { migrationsFolder })
  } else {
    const { migrate } = await import('drizzle-orm/node-postgres/migrator')
    await migrate(db, { migrationsFolder })
  }
}
