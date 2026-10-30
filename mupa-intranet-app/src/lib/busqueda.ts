/**
 * Índice de la búsqueda (la caja del Inicio y el buscador de la barra). Se arma con
 * lo que esta persona puede ver: el catálogo ya viene filtrado por el backend.
 */
import type { PersonaDirectorio } from '../data/directorio'
import { DOCUMENTOS } from '../data/documentos'
import { COMO_SOLICITAR_RRHH, SE_SOLICITAN_EN_RRHH } from '../data/rrhh'
import { AREAS, etiquetas, norm, type App } from './catalogo'
import { rutaVisible } from './edicion'
import type { Noticia } from './contenido'
import { fechaCorta } from './fechas'
import type { Formulario } from './formularios'
import { MENU, MENU_SESION, PIE_MENU } from './menu'
import { esExterna } from './url'

export type Resultado = { t: string; meta?: string; kind: string; h: string; ext?: boolean; g?: string; k?: string; tags?: string[] }

type Enlace = { t: string; g?: string | null; h?: string | null }

/** Personas del directorio y noticias publicadas: opcionales (sin ellas, el índice funciona igual). */
type Extra = { personas?: PersonaDirectorio[]; noticias?: Noticia[] }

export function indiceBusqueda(apps: App[], enlaces: Enlace[], formularios: Formulario[], extra: Extra = {}): Resultado[] {
  const idx: Resultado[] = []
  // Los ítems del menú que son un formulario (Carta de trabajo…) salen una sola vez,
  // como formulario con su título real; su nombre del menú queda como palabra clave.
  const enMenu = new Map(MENU.flatMap((m) => m.children || []).filter((c) => c.h.startsWith('/formularios/')).map((c) => [c.h, c]))
  MENU.forEach((m) => {
    idx.push({ t: m.t, meta: 'Destino principal', kind: 'Sección', h: m.h, g: m.g, k: m.k })
    ;(m.children || []).forEach((c) => {
      if (enMenu.has(c.h)) return
      const clinica = c.kind === 'Clínica'
      idx.push({
        t: c.t,
        meta: m.t,
        kind: clinica ? 'Clínica' : c.pdf ? 'PDF' : c.ext ? 'Sistema' : 'Sección',
        h: c.h,
        ext: c.ext,
        g: m.g,
        k: c.k,
      })
    })
  })
  PIE_MENU.forEach((it) => idx.push({ t: it.t, meta: 'Herramienta de la intranet', kind: 'Sección', h: it.h, g: it.g }))
  // "Mis solicitudes" (solo si la edición la tiene): la página pide iniciar sesión si hace falta.
  MENU_SESION.forEach((it) => idx.push({ t: it.t, meta: 'Tus solicitudes y su estado', kind: 'Sección', h: it.h, g: it.g, k: it.k }))

  formularios.forEach((f) => {
    const h = '/formularios/' + f.slug
    const m = enMenu.get(h)
    idx.push({
      t: f.title,
      meta: 'Form. ' + f.id + ' · ' + f.area + ' · ' + f.intro,
      kind: 'Formulario',
      h,
      g: '▤',
      k: [f.slug.replace(/-/g, ' '), m?.t, m?.k].filter(Boolean).join(' '),
    })
  })

  // «Cómo solicitar» de RRHH: cada trámite se encuentra y lleva a la pestaña de RRHH (o al PDF del ACH).
  // Sin la página de Recursos Humanos (apagada en la edición) no se ofrece ninguno.
  const conRrhh = rutaVisible('/recursos-humanos')
  if (conRrhh) COMO_SOLICITAR_RRHH.forEach((s) =>
    idx.push({ t: s.t, meta: 'Recursos Humanos · ' + s.meta, kind: s.h && /\.pdf$/i.test(s.h) ? 'PDF' : 'Sección', h: s.h ?? '/recursos-humanos', g: s.g, k: 'rrhh tramite solicitud como pedir solicitar' }),
  )

  if (conRrhh) SE_SOLICITAN_EN_RRHH.forEach((t) =>
    idx.push({ t, meta: 'Recursos Humanos · Se solicita directamente en Recursos Humanos', kind: 'Sección', h: '/recursos-humanos', g: '▣', k: 'rrhh tramite solicitud como pedir solicitar' }),
  )

  apps.forEach((a) => {
    const extra = (a.status ? ' · ' + a.status : '') + (a.acceso === 'sesion' ? ' · requiere sesión' : '') + (a.confirmado === false ? ' · por confirmar' : '')
    idx.push({ t: a.name, meta: a.desc + extra, kind: 'Sistema', h: a.h || '/aplicaciones', ext: !!(a.h && a.ext), g: a.g, k: a.k + ' ' + a.tags.join(' '), tags: a.tags })
  })

  // Áreas: "Trámites" ofrece el catálogo filtrado por esa área.
  AREAS.forEach((area) => {
    const n = apps.filter((a) => a.cat === area).length
    if (n) idx.push({ t: area, meta: 'Área · ' + n + (n === 1 ? ' aplicación' : ' aplicaciones'), kind: 'Área', h: '/aplicaciones?area=' + encodeURIComponent(area), g: '▦', k: 'area categoria' })
  })

  // Los que aún no tienen archivo («Próximamente») no se buscan: no llevarían a ningún lado.
  DOCUMENTOS.filter((d) => d.h).forEach((d) => idx.push({ t: d.title, meta: d.cat + ' · ' + d.meta, kind: 'Documento', h: d.h!, ext: !!d.ext, g: d.pdf ? '▤' : '◧', k: 'documento ' + d.cat }))

  // Etiquetas: "salud" ofrece el catálogo ya filtrado por Salud.
  etiquetas(apps).forEach((t) =>
    idx.push({ t: t.name, meta: 'Etiqueta · ' + t.count + (t.count === 1 ? ' aplicación' : ' aplicaciones'), kind: 'Etiqueta', h: '/aplicaciones?etiqueta=' + t.slug, g: '#', k: 'etiqueta' }),
  )

  // Personas: llevan al Directorio ya filtrado por su nombre.
  ;(extra.personas ?? []).forEach((p) => {
    // Las oficinas (Recepción, Ingeniería…) no tienen apellido.
    const nombre = [p.nombre, p.apellido].filter(Boolean).join(' ')
    idx.push({ t: nombre, meta: p.direccion + ' · ext. ' + p.ext + (p.ubicacion ? ' · ' + p.ubicacion : ''), kind: 'Persona', h: '/directorio?q=' + encodeURIComponent(nombre), g: '◉', k: 'persona extension ' + p.ext })
  })

  ;(extra.noticias ?? []).forEach((n) =>
    idx.push({ t: n.t, meta: fechaCorta(n.fecha) + (n.meta ? ' · ' + n.meta : ''), kind: 'Noticia', h: n.h || '/noticias', ext: !!n.h && esExterna(n.h), g: '◫', k: 'noticia ' + n.tipo }),
  )

  // Un enlace sin destino no se indexa: el buscador nunca lleva a algo que no abre.
  enlaces
    .filter((l) => l.h)
    .forEach((l) => idx.push({ t: l.t, meta: 'Enlace institucional', kind: 'Enlace', h: l.h!, ext: true, g: l.g || '◈', k: 'gobierno institucional' }))
  return sinRepetidos(idx)
}

/**
 * Un resultado por destino: si dos llevan al mismo lugar (el ítem del menú "Directorio"
 * y la aplicación "Directorio telefónico"), queda el primero, que es el del menú. El
 * nombre y las palabras del repetido pasan a sus palabras clave, así se sigue
 * encontrando por cualquiera de los dos nombres. No cuentan como repetidos los
 * que comparten una página de lista sin ser ella: las aplicaciones sin enlace
 * (llevan al catálogo), las noticias (a /noticias) y las personas (al Directorio).
 */
function sinRepetidos(idx: Resultado[]): Resultado[] {
  const porDestino = new Map<string, Resultado>()
  const salida: Resultado[] = []
  for (const r of idx) {
    const clave = r.h.replace(/\/+$/, '') || '/'
    const noCuenta = (r.kind === 'Sistema' && r.h === '/aplicaciones') || r.kind === 'Noticia' || r.kind === 'Persona'
    const previo = noCuenta ? undefined : porDestino.get(clave)
    if (previo) {
      previo.k = [previo.k, r.t, r.k].filter(Boolean).join(' ')
      continue
    }
    if (!noCuenta) porDestino.set(clave, r)
    salida.push(r)
  }
  return salida
}

// ---------- Búsqueda (la usan el buscador de la barra y la caja del Inicio) ----------

/** Orden de los tipos cuando empatan. */
export const ORDEN = ['Área', 'Etiqueta', 'Sección', 'Sistema', 'Formulario', 'Persona', 'Documento', 'Clínica', 'PDF', 'Noticia', 'Enlace']

/** Categorías del buscador: qué tipos entran en cada una (null = todos). */
export const ALCANCES = [
  { id: 'todo', t: 'Todo', kinds: null },
  { id: 'apps', t: 'Aplicaciones', kinds: ['Sistema', 'Área', 'Etiqueta'] },
  { id: 'forms', t: 'Formularios', kinds: ['Formulario'] },
  { id: 'people', t: 'Personas', kinds: ['Persona'] },
  { id: 'docs', t: 'Documentos', kinds: ['Documento', 'PDF'] },
  { id: 'news', t: 'Noticias', kinds: ['Noticia'] },
  { id: 'pages', t: 'Páginas', kinds: ['Sección', 'Clínica'] },
  { id: 'links', t: 'Enlaces', kinds: ['Enlace'] },
] as const
export type AlcanceId = (typeof ALCANCES)[number]['id']

export const enAlcance = (r: Resultado, id: AlcanceId) => {
  const k = ALCANCES.find((a) => a.id === id)!.kinds as readonly string[] | null
  return !k || k.includes(r.kind)
}

/**
 * Resultados para un texto y una categoría. Sin texto: en "Todo", las áreas para
 * explorar; en otra categoría, todo lo de esa categoría. Con texto: se busca por
 * RAÍZ de palabra y por el INICIO de la palabra (sin tildes, sin plurales: «marcaciones»
 * encuentra «marcación»; «ari» no encuentra «Ariadna» si hay algo que se llame ARI).
 * No hace falta que estén todas las palabras: se ordena por cuántas coinciden
 * (las raras pesan más) y dónde (título, palabras clave, descripción), con un mínimo para no dar ruido.
 * `conteos`: cuántos hay en cada categoría.
 */
// Palabras que no ayudan a encontrar nada: artículos, preposiciones y verbos genéricos de pedir
// («cómo pido…», «quiero…», «dónde hago…»). Las de pregunta que sí aportan («extensión», «ver») no están aquí.
const VACIAS = new Set(
  ['de', 'del', 'la', 'las', 'el', 'los', 'lo', 'y', 'o', 'a', 'al', 'en', 'para', 'por', 'con', 'sin', 'mi', 'mis', 'un', 'una', 'unos', 'unas', 'que', 'como', 'cual', 'cuales', 'donde', 'cuando', 'me', 'se', 'es', 'hay', 'pido', 'pedir', 'puedo', 'quiero', 'necesito', 'tengo', 'hacer', 'hago', 'busco', 'dame', 'esta', 'este'].map(norm),
)

/** Raíz de una palabra ya normalizada: sin plural ni vocal final («marcaciones» y «marcación» dan lo mismo). */
export function raiz(w: string): string {
  if (w.length <= 3) return w
  if (w.length > 4 && w.endsWith('ones')) w = w.slice(0, -2)
  else if (w.length > 4 && w.endsWith('es')) w = w.slice(0, -2)
  else if (w.endsWith('s')) w = w.slice(0, -1)
  if (w.length > 4 && /[aeo]$/.test(w)) w = w.slice(0, -1)
  return w
}

const palabrasDe = (texto: string) => norm(texto).split(/[^a-z0-9]+/).filter(Boolean).map(raiz)

type Fichas = { titulo: string[]; claves: string[]; meta: string[]; tnorm: string }
const FICHAS = new WeakMap<Resultado, Fichas>()
function ficha(r: Resultado): Fichas {
  let f = FICHAS.get(r)
  if (!f) {
    f = { titulo: palabrasDe(r.t), claves: palabrasDe(r.k || ''), meta: palabrasDe((r.meta || '') + ' ' + r.kind), tnorm: norm(r.t) }
    FICHAS.set(r, f)
  }
  return f
}

const PESO_CAMPO = { titulo: 3, claves: 2, meta: 1 } as const

export function buscar(indice: Resultado[], q: string, alcance: AlcanceId, limite = alcance === 'todo' ? 12 : 60): { hits: Resultado[]; conteos: Record<AlcanceId, number> } {
  const nq = norm(q.trim())
  let base: Resultado[] = indice
  let puntos: Map<Resultado, number> | null = null
  if (nq) {
    const todas = nq.split(/[^a-z0-9]+/).filter(Boolean)
    const utiles = todas.filter((w) => !VACIAS.has(w))
    const consulta = [...new Set((utiles.length ? utiles : todas).map(raiz))]
    const fichas = indice.map(ficha)
    // Una palabra corta (una sigla como ARI) solo vale entera si hay algo que se llame así; si no, también por su inicio.
    const exactaEnTitulo = consulta.map((w) => fichas.some((f) => f.titulo.includes(w)))
    const coincide = (palabras: string[], w: string, i: number) => {
      if (palabras.includes(w)) return 1.5
      if (w.length >= 4) return palabras.some((d) => d.startsWith(w)) ? 1 : 0
      return !exactaEnTitulo[i] && w.length >= 2 && palabras.some((d) => d.startsWith(w)) ? 0.6 : 0
    }
    // Por palabra: qué resultados la tienen y dónde (para pesar las raras más).
    const aciertos = consulta.map((w, i) =>
      fichas.map((f) => Math.max(coincide(f.titulo, w, i) * PESO_CAMPO.titulo, coincide(f.claves, w, i) * PESO_CAMPO.claves, coincide(f.meta, w, i) * PESO_CAMPO.meta)),
    )
    const rareza = aciertos.map((a) => Math.log(1 + indice.length / Math.max(1, a.filter((x) => x > 0).length)))
    const cuantas = indice.map((_, n) => aciertos.filter((a) => a[n] > 0).length)
    const mejor = Math.max(0, ...cuantas)
    const minimo = Math.max(1, Math.ceil(consulta.length / 2), consulta.length >= 3 ? mejor - 1 : consulta.length === 2 ? Math.min(2, mejor) : 1)
    puntos = new Map()
    base = []
    indice.forEach((r, n) => {
      if (cuantas[n] < minimo) return
      let p = aciertos.reduce((suma, a, i) => suma + a[n] * rareza[i], 0)
      if (fichas[n].tnorm.startsWith(nq)) p *= 1.6
      else if (fichas[n].tnorm.includes(nq)) p *= 1.2
      // Las personas (cientos) no deben tapar páginas y sistemas.
      if (r.kind === 'Persona') p *= 0.6
      puntos!.set(r, p)
      base.push(r)
    })
  }
  let lista = nq ? base : alcance === 'todo' ? indice.filter((r) => r.kind === 'Área') : indice.slice()
  const conteos = Object.fromEntries(ALCANCES.map((a) => [a.id, base.filter((r) => enAlcance(r, a.id)).length])) as Record<AlcanceId, number>
  lista = lista.filter((r) => enAlcance(r, alcance))
  lista.sort(
    puntos
      ? (a, b) => puntos!.get(b)! - puntos!.get(a)! || ORDEN.indexOf(a.kind) - ORDEN.indexOf(b.kind)
      : (a, b) => ORDEN.indexOf(a.kind) - ORDEN.indexOf(b.kind) || a.t.localeCompare(b.t, 'es'),
  )
  return { hits: lista.slice(0, limite), conteos }
}

export type Grupo = { id: Exclude<AlcanceId, 'todo'>; t: string; items: Resultado[] }

/** Los resultados por categoría, en el orden de ALCANCES y sin las vacías (la caja del Inicio). */
export function agrupar(hits: Resultado[]): Grupo[] {
  return ALCANCES.filter((a) => a.id !== 'todo')
    .map((a) => ({ id: a.id as Grupo['id'], t: a.t, items: hits.filter((r) => enAlcance(r, a.id)) }))
    .filter((g) => g.items.length > 0)
}
