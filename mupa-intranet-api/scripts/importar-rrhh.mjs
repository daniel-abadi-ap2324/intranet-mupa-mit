/**
 * Trae de las tablas viejas de RRHH (la herramienta de migración de RHLink) los
 * catálogos que usa la intranet: las direcciones (cabeceras activas de
 * MUNICIPIO.dbo.ubicaciones) y los cargos (MUNICIPIO.dbo.cargos_carrera).
 * Solo nombres de unidades y de cargos: nunca datos de personas, y la cédula no
 * se valida contra estas tablas (están desactualizadas).
 *
 *   RRHH_MIGRACION_URL=http://… node scripts/importar-rrhh.mjs
 *
 * La URL es interna: va por variable de entorno, nunca en el repo.
 * Escribe src/database/seed-data/departamentos.json y ../mupa-intranet-app/src/data/cargos.json.
 */
import fs from 'node:fs'

const base = process.env.RRHH_MIGRACION_URL?.replace(/\/+$/, '')
if (!base) {
  console.error('Falta RRHH_MIGRACION_URL (la dirección de la herramienta de migración de RRHH).')
  process.exit(1)
}

async function tabla(nombre) {
  const r = await fetch(`${base}/api/source/table/MUNICIPIO/dbo/${nombre}?limit=5000`, { signal: AbortSignal.timeout(30_000) })
  if (!r.ok) throw new Error(`${nombre}: HTTP ${r.status}`)
  const d = await r.json()
  if (d.shown !== d.total) throw new Error(`${nombre}: vinieron ${d.shown} de ${d.total} filas`)
  return d.rows
}

// Las tablas están en mayúsculas y a veces sin tildes o con errores de tipeo.
const CORRECCIONES = {
  DEPARTAMENETO: 'DEPARTAMENTO',
  INGENERIA: 'INGENIERÍA',
  DIRECCION: 'DIRECCIÓN',
  GESTION: 'GESTIÓN',
  PLANIFICACION: 'PLANIFICACIÓN',
  PARTICIPACION: 'PARTICIPACIÓN',
  COOPERACION: 'COOPERACIÓN',
  INNOVACION: 'INNOVACIÓN',
  TECNOLOGIA: 'TECNOLOGÍA',
  ASESORIA: 'ASESORÍA',
  AUDITORIA: 'AUDITORÍA',
  PLANEACION: 'PLANEACIÓN',
  LOGISTICA: 'LOGÍSTICA',
  ELECTRONICA: 'ELECTRÓNICA',
  PUBLICAS: 'PÚBLICAS',
  ESTRATEGICA: 'ESTRATÉGICA',
  ADMINISTRACION: 'ADMINISTRACIÓN',
  RIO: 'RÍO',
  TECNICO: 'TÉCNICO',
}
const MENORES = new Set(['de', 'del', 'la', 'las', 'los', 'el', 'y', 'e', 'a', 'en', 'para', 'por', 'con', 'o'])
const ROMANO = /^(ii|iii|iv|vi|vii|viii|ix)$/i

/** "DIRECCION  DE TECNOLOGIA E INNOVACION" → "Dirección de Tecnología e Innovación". */
function nombrePropio(texto) {
  const limpio = String(texto).trim().replace(/\s+/g, ' ')
  // En una junta comunal lo que sigue a "de" es un lugar: "de Las Cumbres", no "de las Cumbres".
  const lugar = /^junta comunal /i.test(limpio)
  return limpio
    .split(' ')
    .map((palabra, i) =>
      palabra
        .split('-')
        .map((parte) => {
          if (ROMANO.test(parte)) return parte.toUpperCase()
          const p = (CORRECCIONES[parte.toUpperCase()] ?? parte).toLocaleLowerCase('es')
          if (i > 0 && MENORES.has(p) && !(lugar && p !== 'de')) return p
          return p.charAt(0).toLocaleUpperCase('es') + p.slice(1)
        })
        .join('-'),
    )
    .join(' ')
}

const unicos = (lista, clave) => lista.filter((x, i) => lista.findIndex((y) => clave(y) === clave(x)) === i)

// Cabeceras: unidades activas que son su propio padre (direcciones, juntas comunales, Concejo).
const ubicaciones = await tabla('ubicaciones')
const direcciones = unicos(
  ubicaciones
    .filter((u) => u.estado === 'AC' && u.codigo_padre === u.codigo && u.nombre?.trim())
    .map((u) => ({ codigoRrhh: u.codigo, nombre: nombrePropio(u.nombre) }))
    .sort((a, b) => a.codigoRrhh - b.codigoRrhh),
  (d) => d.nombre.toLocaleLowerCase('es'),
).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))

const cargos = unicos(
  (await tabla('cargos_carrera')).map((c) => c.descripcion?.trim()).filter(Boolean).map(nombrePropio),
  (c) => c.toLocaleLowerCase('es'),
).sort((a, b) => a.localeCompare(b, 'es'))

const escribir = (ruta, datos) => fs.writeFileSync(new URL(ruta, import.meta.url), JSON.stringify(datos, null, 2) + '\n')
escribir('../src/database/seed-data/departamentos.json', {
  _nota: 'Direcciones de la Alcaldía: cabeceras activas de MUNICIPIO.dbo.ubicaciones (RRHH). codigoRrhh es su código allí. Lo genera scripts/importar-rrhh.mjs.',
  departamentos: direcciones,
})
escribir('../../mupa-intranet-app/src/data/cargos.json', {
  _nota: 'Cargos del catálogo de RRHH (MUNICIPIO.dbo.cargos_carrera): sugerencias en el registro. Lo genera mupa-intranet-api/scripts/importar-rrhh.mjs.',
  cargos,
})
console.log(`${direcciones.length} direcciones y ${cargos.length} cargos.`)
