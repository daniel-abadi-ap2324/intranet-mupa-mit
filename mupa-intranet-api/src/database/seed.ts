/**
 * `npm run db:seed` (y el servicio `migrate` de Docker): carga los datos
 * iniciales. Con SEED_DEMO_USERS=true crea además las cuentas ficticias.
 */
import { closeDatabase } from '../config/database.ts'
import { env } from '../config/env.ts'
import { DEMO_USERS, runSeed } from './seeder.ts'

try {
  const r = await runSeed({ demoUsers: env.SEED_DEMO_USERS })
  console.log(`Datos iniciales: ${r.applications} aplicaciones y ${r.departments} departamentos nuevos.`)
  if (env.SEED_DEMO_USERS) {
    console.warn(`Cuentas FICTICIAS de prueba (${r.users} nuevas): ${DEMO_USERS.map((u) => u.email).join(', ')}. No usar en el servidor real.`)
  }
} catch (err) {
  console.error('No se pudieron cargar los datos iniciales:', err)
  process.exitCode = 1
} finally {
  await closeDatabase()
}
