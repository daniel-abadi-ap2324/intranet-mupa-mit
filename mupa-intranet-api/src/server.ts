import { app } from './app.ts'
import { closeDatabase, databaseDriver } from './config/database.ts'
import { env } from './config/env.ts'
import { runMigrations } from './database/migrator.ts'
import { runSeed } from './database/seeder.ts'
import { bulletinService } from './features/bulletins/bulletins.service.ts'
import { directoryService } from './features/directory/directory.service.ts'
import { notificationsService } from './features/notifications/notifications.service.ts'
import { wordpressSyncService } from './features/wordpress-sync/wordpress-sync.service.ts'

if (!env.identity && !env.LOCAL_LOGIN_ENABLED) {
  console.error('Configuración inválida:\n  - IDENTITY_URL: configura Identity Central o pon LOCAL_LOGIN_ENABLED=true: si no, nadie puede entrar')
  process.exit(1)
}

// Con DB_AUTO_SETUP (desarrollo con PGlite, pruebas de punta a punta) la base se
// prepara sola al arrancar. En Docker lo hace el servicio `migrate` antes de la API.
if (env.DB_AUTO_SETUP) {
  await runMigrations()
  await runSeed({ demoUsers: env.SEED_DEMO_USERS })
}

const server = app.listen(env.PORT, () => {
  console.log(`API de la intranet en http://localhost:${env.PORT}/api (base: ${databaseDriver})`)
})

// Los boletines sin descripción ni texto para buscar (los de antes, o subidos a mano) se completan leyendo su PDF, sin frenar el arranque.
void bulletinService
  .describeMissing()
  .then((n) => n && console.log(`[boletines] ${n} boletines con descripción y texto para buscar`))
  .catch((e) => console.error('[boletines]', e instanceof Error ? e.message : e))

// Con WP_SYNC_URL, trae las noticias y boletines nuevos de mupa.gob.pa cada WP_SYNC_INTERVAL_MINUTES.
wordpressSyncService.start()

// Con UCM_URL, copia las extensiones de la central telefónica al arrancar y cada UCM_SYNC_MINUTOS (0 = nunca sola).
directoryService.start()

// docker stop manda SIGTERM: se terminan las peticiones en curso y se cierra la base.
// Los streams de avisos se cierran primero: si no, server.close() espera hasta el SIGKILL.
function shutdown() {
  wordpressSyncService.stop()
  directoryService.stop()
  notificationsService.cerrarTodo()
  server.close(() => {
    closeDatabase().finally(() => process.exit(0))
  })
}
process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)
