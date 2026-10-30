import { env } from '../../config/env.ts'
import { normalizeSearch } from '../../shared/services/pdf-text.service.ts'
import { bulletinService, type BulletinsService } from '../bulletins/bulletins.service.ts'
import { formsService, type FormsService } from '../forms/forms.service.ts'
import { newsService, type NewsService } from '../news/news.service.ts'

/** Un contenido concreto de la intranet al que el asistente puede llevar (un boletín, una noticia, un formulario). */
export type ContentItem = {
  /** Id estable para el modelo: b12 (boletín), n7 (noticia), f3 (formulario). */
  id: string
  kind: 'boletin' | 'noticia' | 'formulario'
  title: string
  /** Ruta de la intranet (o el enlace original de una noticia sin texto propio). */
  path: string
  /** Fecha o área, para mostrarlo debajo del título. */
  meta: string | null
  /** Lo que el modelo lee para decidir (titulares, resumen). */
  about: string
}

const MAX_ITEMS = 8

// Palabras de la pregunta que no distinguen nada (sin tildes: se comparan normalizadas).
const STOP = new Set(
  (
    'a al algo alguna alguno como cual cuales cuando de del donde el ella en es esa ese esta este hay la las le lo los me mi mis ' +
    'necesito para por que quiero se sobre su sus te tengo un una unas unos y ya o ver busco buscar encontrar dame muestrame ' +
    'llevame ir abrir hablame dime saber informacion info puedo pueden puede hacer tiene tienen esta estan fue son hola gracias favor'
  ).split(' '),
)
// Palabras que dicen QUÉ tipo de contenido se busca (no cuentan como tema).
const KIND_WORDS: Record<ContentItem['kind'], string[]> = {
  boletin: ['boletin', 'boletines', 'alcaldia al dia'],
  noticia: ['noticia', 'noticias', 'comunicado', 'comunicados'],
  formulario: ['formulario', 'formularios', 'solicitud', 'solicitar', 'pedir'],
}
const RECENT = ['ultimo', 'ultima', 'ultimos', 'ultimas', 'reciente', 'recientes', 'nuevo', 'nuevos', 'hoy', 'semana']

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
/** "2026-10-07" → "7 de octubre de 2026". */
const fechaLarga = (iso: string) => `${Number(iso.slice(8, 10))} de ${MESES[Number(iso.slice(5, 7)) - 1]} de ${iso.slice(0, 4)}`
const oneLine = (s: string | null | undefined, max: number) => (s ?? '').replace(/\s+/g, ' ').trim().slice(0, max)

/** Las palabras de la pregunta que sirven para buscar (sin tildes, sin palabras vacías ni de tipo). */
export function questionTerms(question: string): string[] {
  const kindWords = new Set(Object.values(KIND_WORDS).flat())
  return [...new Set(normalizeSearch(question).replace(/[^\p{L}\p{N} ]/gu, ' ').split(' '))]
    // Los números cuentan aunque sean cortos: el día de un boletín («del 2 de octubre»).
    .filter((w) => (w.length > 2 || /^\d+$/.test(w)) && !STOP.has(w) && !kindWords.has(w) && !RECENT.includes(w))
    .slice(0, 10)
}

/** Si la palabra está en el texto (normalizado): un número, como palabra entera; las de 6+ letras, también por su raíz. */
function has(text: string, w: string): boolean {
  if (/^\d+$/.test(w)) return new RegExp(`(^|\\D)${w}(\\D|$)`).test(text)
  return text.includes(w) || (w.length >= 6 && text.includes(w.slice(0, w.length - 2)))
}

/**
 * Qué parte de la pregunta cubre cada texto, de 0 a 1. Cada palabra pesa según qué tan rara es entre todos los textos
 * (la que aparece en casi todo pesa poco); la que no aparece en ninguno no cuenta (es relleno o algo que no hay).
 */
export function coverage(texts: string[], terms: string[]): number[] {
  const n = texts.length
  const weight = terms.map((w) => {
    const df = texts.filter((t) => has(t, w)).length
    return df ? Math.log(1 + n / df) : 0
  })
  const total = weight.reduce((a, b) => a + b, 0)
  if (!total) return texts.map(() => 0)
  return texts.map((t) => terms.reduce((sum, w, i) => sum + (has(t, w) ? weight[i] : 0), 0) / total)
}

/**
 * Busca, con las palabras de la pregunta, los boletines, noticias y formularios PUBLICADOS a los que el asistente puede
 * llevar. Solo lee lo que ya ve cualquiera en la intranet (los formularios, solo en la edición completa). Si la pregunta pide «el último boletín» sin tema, trae los más recientes.
 */
export class ContentSearchService {
  private readonly bulletins: BulletinsService
  private readonly news: NewsService | null
  private readonly forms: FormsService | null

  constructor(bulletins: BulletinsService, news: NewsService | null, forms: FormsService | null) {
    this.bulletins = bulletins
    this.news = news
    this.forms = forms
  }

  async search(question: string, limit = MAX_ITEMS): Promise<ContentItem[]> {
    const q = normalizeSearch(question)
    const terms = questionTerms(question)
    const wants = (k: ContentItem['kind']) => KIND_WORDS[k].some((w) => q.includes(w))
    const recent = RECENT.some((w) => q.split(' ').includes(w))
    if (!terms.length && !Object.keys(KIND_WORDS).some((k) => wants(k as ContentItem['kind']))) return []

    const [bulletins, news, forms] = await Promise.all([this.bulletins.listPublished(), this.news?.listPublished() ?? [], this.forms?.listPublished() ?? []])
    const all: { item: ContentItem; text: string; date: string }[] = [
      ...bulletins.map((b) => {
        const about = oneLine(b.summary, 240) || oneLine(b.keywords, 160)
        // La fecha también busca: «boletín del 7 de octubre».
        const text = normalizeSearch(`${fechaLarga(b.date)} ${b.searchText ?? ''} ${about}`)
        const item: ContentItem = { id: `b${b.id}`, kind: 'boletin', title: `Boletín del ${fechaLarga(b.date)}`, path: b.pdfUrl ? `/boletines/${b.id}` : '/boletines', meta: 'Alcaldía al día', about }
        return { item, text, date: b.date }
      }),
      ...news.map((x) => {
        const item: ContentItem = { id: `n${x.id}`, kind: 'noticia', title: oneLine(x.title, 160), path: x.body ? `/noticias/${x.id}` : (x.link ?? '/noticias'), meta: fechaLarga(x.date), about: oneLine(x.summary, 240) }
        return { item, text: normalizeSearch(`${x.title} ${x.summary ?? ''} ${fechaLarga(x.date)}`), date: x.date }
      }),
      ...forms.map((f) => {
        const item: ContentItem = { id: `f${f.id}`, kind: 'formulario', title: oneLine(f.title, 160), path: `/formularios/${f.slug}`, meta: f.area, about: oneLine(f.intro, 200) }
        return { item, text: normalizeSearch(`${f.title} ${f.area} ${f.intro}`), date: '' }
      }),
    ]

    // Con tema: lo que cubre al menos la mitad de la pregunta (pesada por rareza). Sin tema pero con tipo
    // («el último boletín»): lo más reciente de ese tipo.
    const cov = coverage(all.map((x) => x.text), terms)
    // Si se nombró el tipo («boletín de…»), ese tipo va primero.
    let hits = all.flatMap((x, i) => (terms.length && cov[i] >= 0.5 ? [{ ...x, score: cov[i] + (wants(x.item.kind) ? 0.15 : 0) }] : []))
    if (!hits.length && (recent || !terms.length)) {
      // «El último boletín»: solo el más reciente (el modelo no ordena fechas bien); «los últimos»: los 3 más recientes.
      const uno = ['ultimo', 'ultima', 'reciente', 'nuevo'].some((w) => q.split(' ').includes(w))
      const delTipo = all.filter((x) => wants(x.item.kind) && x.item.kind !== 'formulario').sort((a, b) => b.date.localeCompare(a.date))
      return delTipo.slice(0, uno ? 1 : Math.min(limit, 3)).map((x) => x.item)
    }
    return hits
      .sort((a, b) => b.score - a.score || b.date.localeCompare(a.date))
      .slice(0, limit)
      .map((x) => x.item)
  }
}

export const contentSearchService = new ContentSearchService(bulletinService, newsService, env.EDICION === 'completa' ? formsService : null)
