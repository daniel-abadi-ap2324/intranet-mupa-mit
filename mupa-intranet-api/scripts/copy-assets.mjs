// Después de `tsc`: copia a dist/ lo que no es TypeScript (migraciones SQL y datos iniciales).
import fs from 'node:fs'

for (const carpeta of ['migrations', 'seed-data']) {
  fs.cpSync(`src/database/${carpeta}`, `dist/database/${carpeta}`, { recursive: true })
}
