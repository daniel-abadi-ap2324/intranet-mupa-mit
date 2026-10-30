import { runMigrations } from '../src/database/migrator.ts'

// Cada archivo de prueba arranca con su base en memoria y todas las migraciones.
await runMigrations()
