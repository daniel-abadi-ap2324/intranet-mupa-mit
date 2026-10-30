/** `npm run db:migrate` (y el servicio `migrate` de Docker): aplica las migraciones y termina. */
import { closeDatabase, databaseDriver } from '../config/database.ts'
import { runMigrations } from './migrator.ts'

try {
  await runMigrations()
  console.log(`Migraciones aplicadas (${databaseDriver}).`)
} catch (err) {
  console.error('No se pudieron aplicar las migraciones:', err)
  process.exitCode = 1
} finally {
  await closeDatabase()
}
