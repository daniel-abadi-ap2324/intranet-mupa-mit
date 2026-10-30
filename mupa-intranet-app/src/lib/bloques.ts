/**
 * Bloques del Inicio: la lista oficial (ids, tamaño por defecto, grupo de la
 * biblioteca) y la validación del diseño guardado. Se usa en el navegador
 * (Personalizar) y en el servidor (api/inicio), así que hay UNA sola lista.
 * Cómo se pinta cada bloque: components/inicio/bloques.tsx.
 */
import { activa, EDICION, type Funcion } from './edicion.ts'
import { urlSegura } from './url.ts'

export const ANCHOS = ['tercio', 'media', 'dos-tercios', 'completa'] as const
export type Ancho = (typeof ANCHOS)[number]
export const ANCHO_TEXTO: Record<Ancho, string> = {
  tercio: 'Pequeño · ⅓',
  media: 'Mediano · ½',
  'dos-tercios': 'Grande · ⅔',
  completa: 'Completo',
}

export type Grupo = 'dia' | 'sistemas' | 'servicios' | 'info'
export const GRUPOS: { id: Grupo; t: string }[] = [
  { id: 'dia', t: 'Tu día' },
  { id: 'sistemas', t: 'Sistemas y enlaces' },
  { id: 'servicios', t: 'Servicios al colaborador' },
  { id: 'info', t: activa('noticias') ? 'Documentos y noticias' : 'Documentos' },
]

/**
 * multi: se puede agregar varias veces. configurable: pide datos al agregarlo (tema, enlaces).
 * elegible: lista larga de la que cada persona elige qué ver ("Elegir qué mostrar").
 * pausa: hoy no funciona (nadie lo alimenta): no va en el Inicio por defecto y, si alguien lo agrega, el bloque
 * dice que no está funcionando. Para reactivarlo se quita `pausa` (y se vuelve a poner en DEFECTO).
 * condicional: solo se ve si la persona tiene esa conexión (hoy, RRHH Express); sin ella no ocupa lugar en el Inicio.
 */
export type DefBloque = { t: string; d: string; g: string; grupo: Grupo; ancho: Ancho; multi?: boolean; configurable?: boolean; elegible?: boolean; pausa?: boolean; condicional?: 'rrhh' }

/** De qué depende un bloque: una función (lib/edicion.ts) o solo la edición completa. */
type Requiere = { requiere?: Funcion | 'completa' }

const TODOS: Record<string, DefBloque & Requiere> = {
  resumen: { t: 'Mi resumen', g: '◎', grupo: 'dia', ancho: 'completa', condicional: 'rrhh', d: 'Tu tiempo compensatorio, tus marcaciones del mes y tu último comprobante de pago. Solo con RRHH Express conectado.' },
  anuncios: { t: 'Anuncios institucionales', g: '◔', grupo: 'dia', ancho: 'tercio', d: 'Avisos vigentes de la Alcaldía, marcados por urgencia.', requiere: 'anuncios', pausa: true },
  accesos: { t: 'Mis accesos rápidos', g: '▧', grupo: 'sistemas', ancho: 'dos-tercios', d: 'Tus aplicaciones favoritas (★). Si tienes pocas, se completan con otras del catálogo.' },
  solicitudes: { t: 'Mis solicitudes', g: '▥', grupo: 'dia', ancho: 'tercio', d: 'Estado de tus solicitudes y tickets: abiertas, cerradas o todas.', requiere: 'solicitudes' },
  noticias: { t: 'Noticias y comunicados', g: '◫', grupo: 'info', ancho: 'tercio', d: 'Las entradas más recientes publicadas en la intranet.', requiere: 'noticias' },
  directorio: { t: 'Directorio institucional', g: '◉', grupo: 'servicios', ancho: 'tercio', d: 'Buscador de personas, direcciones y extensiones.' },
  frecuentes: { t: 'Trámites frecuentes', g: '▤', grupo: 'servicios', ancho: 'tercio', elegible: true, d: 'Atajos a lo que más se pide: código de llamadas, WIFI, usuario de máquina, ACH.' },
  boletines: { t: 'Boletines informativos', g: '◫', grupo: 'info', ancho: 'completa', d: 'Los cuatro boletines "Alcaldía al día" más recientes, con su PDF.', requiere: 'boletines' },
  campanas: { t: 'Campañas y avisos', g: '◧', grupo: 'info', ancho: 'completa', d: 'Las imágenes del carrusel de campañas de la Alcaldía.', requiere: 'completa' },
  marca: { t: 'Identidad visual', g: '✎', grupo: 'info', ancho: 'completa', d: 'Logos oficiales, colores, tipografías, plantillas y la guía de uso del logo de la Alcaldía.' },
  enlaces: { t: 'Enlaces institucionales', g: '◈', grupo: 'sistemas', ancho: 'completa', elegible: true, d: 'Portales del Estado: Gaceta Oficial, PanamaCompra, CSS y otros.' },
  clinica: { t: 'Clínica Municipal', g: '✚', grupo: 'servicios', ancho: 'tercio', elegible: true, d: 'Agendar cita, solicitar recetas y medicamentos disponibles.' },
  mesa: { t: 'Soporte técnico · Mesa de Servicios', g: '☏', grupo: 'servicios', ancho: 'tercio', d: 'Extensión 1400, correo de la Mesa de Servicios y videos instructivos.' },
  formularios: { t: 'Formularios de solicitud', g: '▤', grupo: 'info', ancho: 'media', elegible: true, d: 'Los formularios en línea de Tecnología y Recursos Humanos.', requiere: 'formularios' },
  'apps-filtro': { t: 'Aplicaciones por tema', g: '#', grupo: 'sistemas', ancho: 'media', multi: true, configurable: true, d: 'Las aplicaciones de un área o una etiqueta que elijas (por ejemplo Salud, Tributos o Ciudadanía). Puedes agregar varias.' },
  'mis-enlaces': { t: 'Mis enlaces', g: '↗', grupo: 'sistemas', ancho: 'tercio', multi: true, configurable: true, d: 'Tus propios enlaces (páginas que usas a diario). Solo direcciones http o https.' },
}

const disponible = (d: Requiere) => !d.requiere || (d.requiere === 'completa' ? EDICION === 'completa' : activa(d.requiere))

/** Los bloques de esta edición: lo que no está aquí no se pinta, no se ofrece y un diseño guardado lo descarta. */
export const BLOQUES: Record<string, DefBloque> = Object.fromEntries(Object.entries(TODOS).filter(([, d]) => disponible(d)))

/**
 * Inicio por defecto, en cuadrícula bento de 12 columnas; cada fila se llena. El saludo,
 * la búsqueda y el asistente van en el encabezado fijo, arriba. Va por franjas: lo de
 * hoy, tus herramientas, los servicios y lo que hay para leer; los enlaces al final.
 *  - completa: accesos + directorio · Mesa + Clínica + frecuentes · solicitudes + noticias · boletines · enlaces · marca.
 *  - publicacion: lo mismo que completa, con los enlaces y la marca en la última fila.
 * Anuncios (`pausa`) no va: hoy no está funcionando.
 */
const DEFECTO: [string, Ancho?][] =
  EDICION === 'publicacion'
    ? // Oct-2026 (legibilidad): menos bloques y más anchos, de a dos por fila. El resto sigue en «Personalizar».
      [['accesos', 'completa'], ['directorio', 'media'], ['mesa', 'media'], ['solicitudes', 'media'], ['noticias', 'media'], ['boletines', 'completa'], ['clinica', 'media'], ['frecuentes', 'media'], ['enlaces', 'media'], ['marca', 'media']]
    : [['accesos', 'completa'], ['directorio', 'media'], ['mesa', 'media'], ['solicitudes', 'media'], ['noticias', 'media'], ['boletines', 'completa'], ['clinica', 'media'], ['frecuentes', 'media'], ['marca', 'completa']]

export const DEFECTO_IDS = DEFECTO.map(([id]) => id)

export type CfgFiltro = { tipo: 'etiqueta' | 'area'; valor: string; cantidad: 4 | 6 | 8 | 12; titulo?: string }
export type CfgEnlaces = { titulo: string; links: { t: string; h: string }[] }
/** "Elegir qué mostrar": lo que la persona ocultó (por destino). Se guarda lo oculto, no lo visible, para que lo nuevo aparezca solo. */
export type CfgElegir = { ocultos: string[] }
export type Cfg = CfgFiltro | CfgEnlaces | CfgElegir
export type Item = { id: string; uid: string; ancho: Ancho; cfg?: Cfg }
/** `buscador`: tamaño del bloque fijo del saludo y la búsqueda (sin él, completo). */
export type Diseno = { v: 1; items: Item[]; buscador?: Ancho }

export const MAX_BLOQUES = 30
export const MAX_OCULTOS = 40

const txt = (v: unknown, max: number) => String(v ?? '').replace(/[<>]/g, '').trim().slice(0, max)

export function limpiarCfg(id: string, c: unknown): Cfg | undefined {
  const cfg = (c && typeof c === 'object' ? c : {}) as Record<string, unknown>
  if (BLOQUES[id]?.elegible) {
    const ocultos = [...new Set((Array.isArray(cfg.ocultos) ? cfg.ocultos : []).map((x) => txt(x, 500)).filter(Boolean))].slice(0, MAX_OCULTOS)
    // Sin nada oculto no hay configuración (así el diseño queda igual al de siempre).
    return ocultos.length ? { ocultos } : undefined
  }
  if (id === 'apps-filtro') {
    const tipo = cfg.tipo === 'area' ? 'area' : 'etiqueta'
    let valor = txt(cfg.valor, 60)
    if (tipo === 'etiqueta') valor = valor.toLowerCase().replace(/[^a-z0-9-]/g, '')
    const n = Number(cfg.cantidad)
    const o: CfgFiltro = { tipo, valor, cantidad: ([4, 6, 8, 12].includes(n) ? n : 6) as CfgFiltro['cantidad'] }
    const titulo = txt(cfg.titulo, 60)
    if (titulo) o.titulo = titulo
    return o
  }
  if (id === 'mis-enlaces') {
    const links = (Array.isArray(cfg.links) ? cfg.links : [])
      .map((l: { t?: unknown; h?: unknown }) => {
        const h = urlSegura(l?.h)
        if (!h) return null
        return { t: txt(l.t, 60) || new URL(h).host.replace(/^www\./, ''), h }
      })
      .filter((x): x is { t: string; h: string } => !!x)
      .slice(0, 8)
    return { titulo: txt(cfg.titulo, 60) || 'Mis enlaces', links }
  }
  return undefined
}

function nuevoUid(id: string): string {
  return id + '-' + Math.random().toString(36).slice(2, 8)
}

/** Valida un diseño: ids conocidos, sin repetir los de una sola copia, tamaños y configuración válidos. */
export function limpiarDiseno(entrada: unknown): Diseno | null {
  const l = entrada as { items?: unknown; buscador?: unknown }
  if (!l || !Array.isArray(l.items)) return null
  const vistos = new Set<string>()
  const out: Item[] = []
  for (const raw of l.items as Record<string, unknown>[]) {
    if (out.length >= MAX_BLOQUES) break
    const id = raw && typeof raw.id === 'string' ? raw.id : ''
    const def = BLOQUES[id]
    if (!def || (!def.multi && vistos.has(id))) continue
    let uid = id
    if (def.multi) {
      const u = typeof raw.uid === 'string' ? raw.uid : ''
      uid = /^[a-z0-9-]{3,48}$/.test(u) && !vistos.has(u) ? u : nuevoUid(id)
    }
    vistos.add(id).add(uid)
    const ancho = (ANCHOS as readonly string[]).includes(raw.ancho as string) ? (raw.ancho as Ancho) : def.ancho
    const it: Item = { id, uid, ancho }
    if (def.configurable || def.elegible) {
      const cfg = limpiarCfg(id, raw.cfg)
      if (cfg) it.cfg = cfg
    }
    out.push(it)
  }
  // Completo es el de siempre: no se guarda, así el diseño queda igual al de antes.
  const buscador = (ANCHOS as readonly string[]).includes(l.buscador as string) && l.buscador !== 'completa' ? (l.buscador as Ancho) : undefined
  return buscador ? { v: 1, items: out, buscador } : { v: 1, items: out }
}

export function disenoPorDefecto(): Diseno {
  return limpiarDiseno({ items: DEFECTO.map(([id, ancho]) => ({ id, ancho })) })!
}

/** Mismos bloques, en el mismo orden, con los mismos tamaños y ajustes (no basta el orden). */
export function mismosBloques(a: Diseno, b: Diseno): boolean {
  return JSON.stringify(a.items) === JSON.stringify(b.items) && (a.buscador ?? 'completa') === (b.buscador ?? 'completa')
}

export function nuevoItem(id: string): Item {
  const def = BLOQUES[id]
  const it: Item = { id, uid: def.multi ? nuevoUid(id) : id, ancho: def.ancho }
  if (def.configurable) it.cfg = limpiarCfg(id, {})
  return it
}

/**
 * «Mi resumen» sale solo para quien tiene RRHH Express conectado. Un diseño guardado antes no lo trae (ni el de fábrica,
 * que no cambia): se muestra igual arriba de todo, sin tocar lo guardado, hasta que la persona lo quite en «Personalizar»
 * (se recuerda en este navegador: el formato del diseño guardado no cambia).
 */
export function conResumen(d: Diseno, quitado: boolean): Diseno {
  if (quitado || !BLOQUES.resumen || d.items.some((x) => x.id === 'resumen')) return d
  return { ...d, items: [{ id: 'resumen', uid: 'resumen', ancho: 'completa' }, ...d.items] }
}
