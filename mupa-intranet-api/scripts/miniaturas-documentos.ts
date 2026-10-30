/**
 * Miniaturas de los documentos en PDF de la web (Documentos y Manuales): dibuja la primera página de cada PDF de
 * ../mupa-intranet-app/public/sitio/ que citan src/data/documentos.ts y src/data/manuales.ts, y la guarda en
 * public/sitio/miniaturas/<misma ruta>.webp. También escribe src/data/miniaturas.json con la lista de las que existen,
 * para que la web sepa cuáles tiene (las demás siguen con el recuadro «PDF»).
 *
 * Los PDF los sirve la web, no la API, así que se hace UNA vez, aquí, y se guardan en git.
 * Uso (desde mupa-intranet-api): node scripts/miniaturas-documentos.ts
 * Al agregar un PDF a esos archivos de datos, se vuelve a correr.
 */
import fs from 'node:fs'
import path from 'node:path'

import { createCanvas } from '@napi-rs/canvas'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'

/** Ancho en píxeles: la tarjeta mide unos 270 px, así se ve nítida en pantallas de doble densidad. */
const ANCHO = 540

const WEB = path.resolve(import.meta.dirname, '../../mupa-intranet-app')
const DATOS = ['src/data/documentos.ts', 'src/data/manuales.ts'].map((f) => fs.readFileSync(path.join(WEB, f), 'utf8')).join('\n')

// Rutas "/sitio/…pdf" escritas enteras o como UP + '…pdf' (manuales.ts).
const rutas = new Set<string>()
for (const m of DATOS.matchAll(/\/sitio\/([^'"]+?\.pdf)/g)) rutas.add(m[1])
for (const m of DATOS.matchAll(/UP \+ '([^']+?\.pdf)'/g)) rutas.add(m[1])

async function dibujar(pdf: Buffer): Promise<Buffer> {
  const task = getDocument({ data: new Uint8Array(pdf), disableFontFace: true, verbosity: 0 })
  try {
    const page = await (await task.promise).getPage(1)
    const viewport = page.getViewport({ scale: ANCHO / page.getViewport({ scale: 1 }).width })
    const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height))
    const context = canvas.getContext('2d')
    context.fillStyle = '#fff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    await page.render({ canvasContext: context as never, viewport, canvas: canvas as never }).promise
    return canvas.toBuffer('image/webp', 80)
  } finally {
    await task.destroy()
  }
}

const hechas: string[] = []
for (const ruta of [...rutas].sort()) {
  const origen = path.join(WEB, 'public/sitio', ruta)
  if (!fs.existsSync(origen)) {
    console.warn('No está el PDF:', ruta)
    continue
  }
  try {
    const destino = path.join(WEB, 'public/sitio/miniaturas', ruta.replace(/\.pdf$/, '.webp'))
    fs.mkdirSync(path.dirname(destino), { recursive: true })
    fs.writeFileSync(destino, await dibujar(fs.readFileSync(origen)))
    hechas.push('/sitio/' + ruta)
    console.log('OK', ruta)
  } catch (e) {
    console.warn('No se pudo dibujar', ruta, (e as Error).message)
  }
}
fs.writeFileSync(path.join(WEB, 'src/data/miniaturas.json'), JSON.stringify(hechas, null, 2) + '\n')
console.log(hechas.length, 'miniaturas')
