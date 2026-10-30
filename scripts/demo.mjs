/**
 * Demostración local sin Docker: instala lo que falte y levanta la API (con PGlite, un PostgreSQL
 * guardado en mupa-intranet-api/.data) y la web, en edición completa y con las cuentas ficticias.
 *
 *   npm run demo        →  http://localhost:5173   (la API queda en http://localhost:3000/api)
 *
 * Si esos puertos están ocupados: DEMO_PUERTO_WEB=5180 DEMO_PUERTO_API=3010 npm run demo
 * Ctrl+C apaga las dos. Los datos quedan en mupa-intranet-api/.data/demo; bórralo para empezar de cero.
 */
import { spawn, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const api = path.join(raiz, 'mupa-intranet-api')
const web = path.join(raiz, 'mupa-intranet-app')
const enWindows = process.platform === 'win32'
const puertoApi = process.env.DEMO_PUERTO_API || '3000'
const puertoWeb = process.env.DEMO_PUERTO_WEB || '5173'

for (const dir of [api, web]) {
  if (fs.existsSync(path.join(dir, 'node_modules'))) continue
  console.log(`Instalando dependencias en ${path.basename(dir)}…`)
  const r = spawnSync('npm', ['ci'], { cwd: dir, stdio: 'inherit', shell: enWindows })
  if (r.status !== 0) process.exit(r.status ?? 1)
}

const entorno = {
  ...process.env,
  NODE_ENV: 'development',
  PORT: puertoApi,
  EDICION: 'completa',
  DB_AUTO_SETUP: 'true',
  SEED_DEMO_USERS: 'true',
  LOCAL_LOGIN_ENABLED: 'true',
  PGLITE_DATA_DIR: './.data/demo',
  VITE_EDICION: 'completa',
  API_URL: `http://localhost:${puertoApi}`,
}

const procesos = [
  spawn('npm', ['run', 'dev'], { cwd: api, env: entorno, stdio: 'inherit', shell: enWindows }),
  spawn('npm', ['run', 'dev', '--', '--port', puertoWeb, '--strictPort'], { cwd: web, env: entorno, stdio: 'inherit', shell: enWindows }),
]
console.log(`\nIntranet en http://localhost:${puertoWeb} · cuentas ficticias: admin@, comunicacion@, gestor@, prueba1@ o prueba2@ejemplo.test, contraseña "password"\n`)

const apagar = () => {
  for (const p of procesos) p.kill()
  process.exit(0)
}
process.on('SIGINT', apagar)
process.on('SIGTERM', apagar)
for (const p of procesos) p.on('exit', (codigo) => codigo && apagar())
