/**
 * Describe los boletines de la intranet anterior (PDF copiados en ../mupa-intranet-app/public/sitio/):
 * lee cada PDF y le saca su descripción corta, palabras clave y texto para buscar.
 *
 * La API no puede leer esos PDF (los sirve nginx desde la web, no están en su disco), así que se hace UNA vez, aquí:
 *   1. Guarda `summary`, `keywords` y `searchText` en src/database/seed-data/boletines.json (las bases nuevas los traen).
 *   2. Escribe src/database/migrations/<migración>.sql: un UPDATE por boletín para las bases que ya existen
 *      (solo donde todavía no tienen texto para buscar: no pisa lo que ya se haya completado).
 *
 * Uso (desde mupa-intranet-api): node scripts/describir-boletines-sitio.ts <archivo-de-migración.sql>
 * Los boletines nuevos no pasan por aquí: la API los describe sola al guardarlos (bulletins.service.ts).
 */
import fs from 'node:fs'
import path from 'node:path'

import { dateWords, describePdf, normalizeSearch } from '../src/shared/services/pdf-text.service.ts'

const salida = process.argv[2]
if (!salida) {
  console.error('Indica el archivo de la migración, p. ej. src/database/migrations/0022_boletines-sitio-descritos.sql')
  process.exit(1)
}

const json = new URL('../src/database/seed-data/boletines.json', import.meta.url)
const sitio = new URL('../../mupa-intranet-app/public/', import.meta.url)
const datos = JSON.parse(fs.readFileSync(json, 'utf8')) as { boletines: { date: string; pdfUrl: string | null; summary?: string | null; keywords?: string | null; searchText?: string }[] }

const sql = (s: string | null) => (s === null ? 'NULL' : `'${s.replace(/'/g, "''")}'`)
const updates: string[] = []

for (const b of datos.boletines) {
  if (!b.pdfUrl?.startsWith('/sitio/')) continue
  const archivo = path.join(sitio.pathname.replace(/^\/([A-Za-z]:)/, '$1'), decodeURIComponent(b.pdfUrl.slice(1)))
  const info = fs.existsSync(archivo) ? await describePdf(fs.readFileSync(archivo)) : null
  b.summary = info?.summary ?? null
  b.keywords = info?.keywords.length ? info.keywords.join(',') : null
  b.searchText = normalizeSearch([dateWords(b.date), info?.searchText ?? ''].join(' '))
  updates.push(
    `UPDATE "bulletins" SET "summary" = ${sql(b.summary)}, "keywords" = ${sql(b.keywords)}, "search_text" = ${sql(b.searchText)} WHERE "pdf_url" = ${sql(b.pdfUrl)} AND "search_text" IS NULL;`,
  )
  console.log(b.date, '|', (b.summary ?? '(sin descripción)').slice(0, 90))
}

fs.writeFileSync(json, JSON.stringify(datos, null, 2) + '\n')
fs.writeFileSync(salida, updates.join('\n--> statement-breakpoint\n') + '\n')
console.log(`\n${updates.length} boletines descritos → ${path.basename(json.pathname)} y ${salida}`)
