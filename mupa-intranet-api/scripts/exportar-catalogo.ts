/**
 * Escribe el catálogo de endpoints (el mismo de GET /api/meta/catalog) en un archivo JSON.
 * Es la copia de respaldo del servidor MCP (mupa-intranet-mcp/catalog.snapshot.json): la usa mientras
 * la API no responde, y las pruebas del MCP trabajan con ella.
 *
 * Uso (desde mupa-intranet-api):  npm run catalogo:exportar
 * Se vuelve a correr cuando se agrega, quita o cambia un endpoint o una página del asistente
 * (tests/meta.test.ts avisa si la copia quedó atrás).
 */
import fs from 'node:fs'

// La app arma sus rutas al importarse: tiene que ir ANTES de pedir el catálogo.
await import('../src/app.ts')
const { metaService } = await import('../src/features/meta/meta.service.ts')

const salida = process.argv[2] ?? '../mupa-intranet-mcp/catalog.snapshot.json'
const catalogo = metaService.catalog()
fs.writeFileSync(salida, JSON.stringify(catalogo, null, 2) + '\n')
console.log(`${catalogo.endpoints.length} endpoints y ${catalogo.pages.length} páginas (edición ${catalogo.edition}) → ${salida}`)
process.exit(0)
