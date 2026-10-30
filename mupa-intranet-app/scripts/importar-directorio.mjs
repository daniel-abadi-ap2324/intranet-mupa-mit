/**
 * Importa el directorio telefónico publicado en la intranet vieja (tabla TablePress de
 * /directorio-telefonico-mupa/: nombre, apellido, dirección, extensión y ubicación) y
 * escribe src/data/directorio-personas.json. Es un dato que la intranet actual ya publica.
 *
 *   node scripts/importar-directorio.mjs <url de la página o archivo .html guardado>
 *
 * Las filas sin extensión y las extensiones «Disponible» (sin asignar) se descartan; las oficinas quedan sin apellido. Los textos vienen en mayúsculas y sin tildes:
 * se pasan a nombre propio y se corrigen las palabras más comunes.
 */
import fs from 'node:fs'

const origen = process.argv[2]
if (!origen) {
  console.error('Uso: node scripts/importar-directorio.mjs <url o archivo .html>')
  process.exit(1)
}
const html = /^https?:\/\//.test(origen) ? await (await fetch(origen, { signal: AbortSignal.timeout(30_000) })).text() : fs.readFileSync(origen, 'utf8')

const tabla = html.slice(html.indexOf('<table'), html.indexOf('</table>') + 8)
const entidades = { '&amp;': '&', '&#8211;': '–', '&nbsp;': ' ', '&quot;': '"', '&#039;': "'" }
const texto = (s) => s.replace(/<[^>]+>/g, '').replace(/&[#\w]+;/g, (e) => entidades[e] ?? e).replace(/\s+/g, ' ').trim()
const filas = [...tabla.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map((m) => [...m[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map((c) => texto(c[1]))).slice(1)
if (filas.length < 500 || filas.some((f) => f.length !== 5)) throw new Error(`La tabla no tiene la forma esperada (${filas.length} filas)`)

// Palabras que en la tabla vienen sin tilde.
const TILDES = {
  RECEPCION: 'RECEPCIÓN', DIRECCION: 'DIRECCIÓN', SUBDIRECCION: 'SUBDIRECCIÓN', ADMINISTRACION: 'ADMINISTRACIÓN', PARTICIPACION: 'PARTICIPACIÓN',
  TECNOLOGIA: 'TECNOLOGÍA', GESTION: 'GESTIÓN', TESORERIA: 'TESORERÍA', AUDITORIA: 'AUDITORÍA', CONTRALORIA: 'CONTRALORÍA', INNOVACION: 'INNOVACIÓN',
  PLANIFICACION: 'PLANIFICACIÓN', DESCENTRALIZACION: 'DESCENTRALIZACIÓN', COOPERACION: 'COOPERACIÓN', SECRETARIA: 'SECRETARÍA', TURISTICO: 'TURÍSTICO',
  INSPECCION: 'INSPECCIÓN', ATENCION: 'ATENCIÓN', ALMACEN: 'ALMACÉN', PUBLICAS: 'PÚBLICAS', TRAMITES: 'TRÁMITES', ANALISIS: 'ANÁLISIS', VEHICULO: 'VEHÍCULO',
  CUBICULO: 'CUBÍCULO', FOLCLORICO: 'FOLCLÓRICO', DISENOS: 'DISEÑOS', CURUNDU: 'CURUNDÚ', POLVORIN: 'POLVORÍN', AREAS: 'ÁREAS', RESILENCIA: 'RESILIENCIA',
}
const MENORES = new Set(['de', 'del', 'la', 'las', 'los', 'el', 'y', 'e', 'a', 'en', 'para', 'por', 'con', 'o', 'al'])
const SIGLAS = new Set(['TI', 'DTI', 'RRHH', 'SIVIMUPA', 'TX', 'PB'])

function nombrePropio(s) {
  return s
    .split(' ')
    .map((palabra, i) =>
      palabra.replace(/[\p{L}.]+/gu, (p) => {
        const base = p.toUpperCase()
        if (SIGLAS.has(base)) return base
        const w = (TILDES[base] ?? base).toLocaleLowerCase('es')
        if (i > 0 && MENORES.has(w)) return w
        return w.charAt(0).toLocaleUpperCase('es') + w.slice(1)
      }),
    )
    .join(' ')
}

// Dirección principal (lo que va antes del paréntesis) → nombre de la dirección.
const DIRECCIONES = {
  RRHH: 'Recursos Humanos', 'CONSEJO MUNICIPAL': 'Concejo Municipal', 'DIR. PRESUPUESTO': 'Dirección de Presupuesto', 'DIR.PRESUPUESTO': 'Dirección de Presupuesto',
  'DIR. ADMINISTRATIVA': 'Dirección Administrativa', 'CONTRATACIONES PUBLICAS': 'Dirección Administrativa', 'DIR. PARTICIPACION CIUDADANA': 'Participación Ciudadana',
  'S.GENERAL': 'Secretaría General', 'DIR. LEGAL Y JUSTICIA': 'Legal y Justicia', 'DIRECCION DE GESTION AMBIENTAL': 'Gestión Ambiental', 'EDUCACION AMBIENTAL': 'Gestión Ambiental',
  'SUBDIR. AREAS VERDES': 'Gestión Ambiental', 'SUB DIRECCION DE RESILENCIA': 'Gestión Ambiental', 'EL POLVORIN': 'Obras Comunitarias',
}

function direccion(s) {
  const m = s.match(/^([^(]*?)\s*(?:\((.*)\))?\s*$/)
  const principal = (m?.[1] ?? s).trim().replace(/\s+/g, ' ')
  const unidad = m?.[2]?.trim()
  return { direccion: principal ? (DIRECCIONES[principal.toUpperCase()] ?? nombrePropio(principal)) : '', unidad: unidad ? nombrePropio(unidad) : undefined }
}

function ubicacion(s) {
  return nombrePropio(
    s
      .replace(/torre\s*([abc])\s*[-,]?\s*,?\s*/i, 'Torre $1 · ')
      .replace(/(piso|nivel)\s*(\w+)/i, (_, a, b) => `${a} ${b}`)
      .replace(/piso pb/i, 'PB')
      .replace(/\s*·\s*$/, ''),
  )
    .replace(/\bTorre ([abc])\b/i, (_, t) => 'Torre ' + t.toUpperCase())
    .replace(/\bPb\b/, 'PB')
}

// Las oficinas (Recepción, Ingeniería…) vienen con el mismo texto en nombre y apellido: quedan sin apellido.
// «Disponible» es una extensión sin asignar: no es de nadie y no va.
const sinRepetir = (nombre, apellido) => (apellido.toLocaleLowerCase('es') === nombre.toLocaleLowerCase('es') ? '' : apellido)
const personas = filas
  .filter(([nombre, , , ext]) => /^\d{3,5}$/.test(ext) && !/^disponible$/i.test(nombre.trim()))
  .map(([nombre, apellido, dir, ext, ubic]) => ({ nombre: nombrePropio(nombre), apellido: sinRepetir(nombrePropio(nombre), nombrePropio(apellido)), ...direccion(dir), ext, ubicacion: ubicacion(ubic) }))
  .sort((a, b) => a.direccion.localeCompare(b.direccion, 'es') || a.apellido.localeCompare(b.apellido, 'es') || a.nombre.localeCompare(b.nombre, 'es'))

fs.writeFileSync(new URL('../src/data/directorio-personas.json', import.meta.url), JSON.stringify(personas, null, 1) + '\n')
console.log(`${personas.length} personas en ${new Set(personas.map((p) => p.direccion).filter(Boolean)).size} direcciones (${filas.length - personas.length} filas sin extensión descartadas).`)
