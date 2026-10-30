#!/usr/bin/env node
/**
 * Baja a local los PDF que hoy la intranet enlaza al WordPress en vivo
 * (https://intranet.mupa.gob.pa/wp-content/uploads/…), para que dejen de
 * depender de ese sitio. Mismo criterio que ya se usó para las imágenes de
 * public/sitio/: cada archivo se guarda en la misma ruta que tenía después de
 * /wp-content/uploads/.
 *
 * Uso: node scripts/descargar-pdfs.mjs  (o `npm run migrar:pdfs`)
 * Se puede correr de nuevo sin rehacer nada: si el archivo local ya existe con
 * el mismo tamaño, se salta.
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const RAIZ = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const DESTINO = path.join(RAIZ, 'public', 'sitio')
const SITIO = 'https://intranet.mupa.gob.pa'

// Las URLs de PDF directas: se arman leyendo boletines.ts/documentos.ts/manuales.ts/menu.ts con
// una expresión regular simple (son arrays de objetos con comillas dobles, no hace falta un
// parser de TS). Así la lista nunca se desincroniza de lo que el código realmente usa.
async function urlsDeDatos() {
  const archivos = ['src/data/boletines.ts', 'src/data/documentos.ts', 'src/data/manuales.ts', 'src/lib/menu.ts']
  const urls = new Set()
  for (const rel of archivos) {
    const texto = await fs.readFile(path.join(RAIZ, rel), 'utf8')
    for (const m of texto.matchAll(/https:\/\/intranet\.mupa\.gob\.pa\/wp-content\/uploads\/[^"'\s]+\.pdf/g)) urls.add(m[0])
  }
  return urls
}

// Los 3 documentos que hoy enlazan al visor "flipbook" (no a un PDF directo): se resuelve el
// PDF real contra la propia API pública de WordPress. No se hardcodean a mano porque los
// nombres reales traen tildes y símbolos (p. ej. "N°", "Panamá") que es fácil retipear mal.
const FLIPBOOKS = [
  { nombre: 'Reglamento Interno de Personal', busqueda: 'reglamento interno' },
  { nombre: 'Código de Ética', busqueda: 'codigo de etica' },
  { nombre: 'Guía de usuario TRANSDOC', busqueda: 'transdoc' },
]

async function resolverFlipbook(busqueda) {
  const r = await fetch(`${SITIO}/wp-json/wp/v2/media?search=${encodeURIComponent(busqueda)}&per_page=10`)
  if (!r.ok) return null
  const items = await r.json()
  return items.find((x) => /\.pdf$/i.test(x.source_url))?.source_url ?? null
}

// El nombre real de este archivo está mal codificado en el propio WordPress (confirmado: el
// mismo texto ilegible aparece también en el título del medio, no es un problema de nuestra
// descarga) — se guarda con un nombre legible en vez de arrastrar el nombre roto.
const NOMBRE_LIMPIO = { 'reglamento interno': 'Reglamento-Interno-de-Personal-Decreto-024-2019.pdf' }

/** URL → ruta local, preservando lo que sigue a /wp-content/uploads/. */
function rutaLocal(url) {
  const rel = decodeURI(new URL(url).pathname.replace(/^\/wp-content\/uploads\//, ''))
  if (rel.startsWith('..') || path.isAbsolute(rel)) throw new Error('Ruta sospechosa: ' + url)
  return path.join(DESTINO, ...rel.split('/'))
}

const FIRMA_PDF = Buffer.from('%PDF')

async function descargar(url, destino) {
  const existente = await fs.stat(destino).catch(() => null)
  let r
  try {
    r = await fetch(url)
  } catch (err) {
    return { ok: false, motivo: 'sin respuesta: ' + err.message }
  }
  if (!r.ok) return { ok: false, motivo: 'HTTP ' + r.status }

  const buf = Buffer.from(await r.arrayBuffer())
  if (!buf.subarray(0, 4).equals(FIRMA_PDF)) return { ok: false, motivo: 'la respuesta no empieza con %PDF (¿página de error?)' }

  if (existente && existente.size === buf.length) return { ok: true, salto: true }

  await fs.mkdir(path.dirname(destino), { recursive: true })
  await fs.writeFile(destino, buf)
  return { ok: true, salto: false, bytes: buf.length }
}

async function main() {
  const urls = await urlsDeDatos()
  const plan = [...urls].sort().map((url) => ({ url, destino: rutaLocal(url) }))

  for (const f of FLIPBOOKS) {
    const url = await resolverFlipbook(f.busqueda)
    if (!url) {
      console.warn(`⚠ no se encontró el PDF de "${f.nombre}" en la API de WordPress`)
      continue
    }
    const limpio = NOMBRE_LIMPIO[f.busqueda]
    const destino = limpio ? path.join(path.dirname(rutaLocal(url)), limpio) : rutaLocal(url)
    plan.push({ url, destino, nombre: f.nombre })
  }

  console.log(`${plan.length} archivos a revisar…\n`)
  let bajados = 0, saltados = 0, fallos = 0
  for (const { url, destino, nombre } of plan) {
    const etiqueta = nombre ? `${nombre} (${url})` : url
    const r = await descargar(url, destino)
    if (!r.ok) {
      fallos++
      console.log(`✗ FALLÓ  ${etiqueta}\n  → ${r.motivo}`)
    } else if (r.salto) {
      saltados++
    } else {
      bajados++
      console.log(`✓ ${(r.bytes / 1024).toFixed(0).padStart(5)} KB  ${etiqueta}`)
    }
    // Cortesía con el servidor del sitio actual: no golpearlo en ráfaga.
    await new Promise((res) => setTimeout(res, 150))
  }

  console.log(`\n${bajados} bajados, ${saltados} ya estaban, ${fallos} fallaron (de ${plan.length}).`)
  if (fallos) {
    console.log('Un fallo puede ser un PDF que ya no existe en el sitio actual (revisar a mano).')
    process.exitCode = 1
  }
}

main()
