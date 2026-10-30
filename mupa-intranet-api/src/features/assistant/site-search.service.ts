import { env } from '../../config/env.ts'
import { normalizeSearch } from '../../shared/services/pdf-text.service.ts'
import { plainText } from '../../shared/services/wordpress.service.ts'
import { coverage, questionTerms } from './content-search.service.ts'

/** Un texto de mupa.gob.pa que el asistente puede citar: una página (el alcalde, cada director…) o una noticia. */
export type SitePage = { kind: 'pagina' | 'noticia'; title: string; url: string; date: string | null; text: string }

const PAGES_TTL_MS = 12 * 60 * 60 * 1000
const TIMEOUT_MS = 4000
const MAX_PAGES = 3
const MAX_POSTS = 2
const PAGE_CHARS = 1500
const POST_CHARS = 700

// Páginas que no son texto para leer: formularios, listados armados con plugins, flipbooks.
const NOT_TEXT = /formDisplay|rt-tpg|FB3D_CLIENT_DATA|Se requiere JavaScript|\[[a-z_]+\]/
// Cédulas panameñas (8-123-4567, PE-1-234…): algunas páginas públicas las listan; el asistente no las repite.
const CEDULA = /\b(?:\d{1,2}|PE|E|N|[1-9]?AV|[1-9]?PI)-\d{1,4}-\d{1,6}\b/gi

type Fetch = typeof fetch

const clean = (html: string, max: number) => plainText(html).replace(CEDULA, '[dato personal]').slice(0, max)

/**
 * Busca en mupa.gob.pa (el WordPress público de la Alcaldía, solo lectura y sin login) lo que responde la pregunta:
 * las páginas del sitio (alcalde, vicealcalde, cada director con su correo, «Sobre la Alcaldía», mercados…) se guardan
 * en memoria 12 h y se puntúan aquí; las noticias se buscan en vivo con la búsqueda del propio sitio. Si el sitio no
 * responde a tiempo, devuelve lo que tenga (o nada) y el asistente contesta igual.
 */
export class SiteSearchService {
  private pages: { page: SitePage; text: string }[] = []
  private loadedAt = 0
  private loading: Promise<void> | null = null
  private readonly base: string | null
  private readonly fetchFn: Fetch

  constructor(base: string | null, fetchFn: Fetch = fetch) {
    this.base = base
    this.fetchFn = fetchFn
  }

  isEnabled(): boolean {
    return this.base !== null
  }

  private async json<T>(pathAndQuery: string): Promise<T> {
    const r = await this.fetchFn(this.base + pathAndQuery, { signal: AbortSignal.timeout(TIMEOUT_MS), headers: { Accept: 'application/json' } })
    if (!r.ok) throw new Error('mupa.gob.pa respondió ' + r.status)
    return (await r.json()) as T
  }

  private async refreshPages(): Promise<void> {
    type WpPage = { title: { rendered: string }; content: { rendered: string }; link: string }
    const list = await this.json<WpPage[]>('/wp-json/wp/v2/pages?per_page=100&_fields=title,content,link')
    this.pages = list
      .filter((p) => !NOT_TEXT.test(p.content.rendered) && plainText(p.content.rendered).length > 60)
      .map((p) => {
        const page: SitePage = { kind: 'pagina', title: plainText(p.title.rendered), url: p.link, date: null, text: clean(p.content.rendered, PAGE_CHARS) }
        return { page, text: normalizeSearch(page.title + ' ' + page.title + ' ' + page.text) }
      })
    this.loadedAt = Date.now()
  }

  /** Las páginas del sitio, cargadas como mucho cada 12 h. Si falla, se queda con las que tenía. */
  private async ensurePages(): Promise<void> {
    if (Date.now() - this.loadedAt < PAGES_TTL_MS) return
    this.loading ??= this.refreshPages()
      .catch((e) => {
        console.warn('[asistente] no se pudieron leer las páginas de mupa.gob.pa:', e instanceof Error ? e.message : 'error')
        this.loadedAt = Date.now() - PAGES_TTL_MS + 10 * 60 * 1000 // reintenta en 10 min
      })
      .finally(() => (this.loading = null))
    await this.loading
  }

  private async findPages(terms: string[]): Promise<SitePage[]> {
    await this.ensurePages()
    if (!this.pages.length) return []
    const scores = coverage(
      this.pages.map((p) => p.text),
      terms,
    )
    const best = Math.max(...scores)
    if (best <= 0) return []
    return scores
      .map((s, i) => ({ s, p: this.pages[i].page }))
      .filter((x) => x.s >= best * 0.6)
      .sort((a, b) => b.s - a.s)
      .slice(0, MAX_PAGES)
      .map((x) => x.p)
  }

  private async findPosts(question: string): Promise<SitePage[]> {
    type Hit = { id: number }
    type WpPost = { title: { rendered: string }; content: { rendered: string }; link: string; date: string }
    const find = (q: string) => this.json<Hit[]>(`/wp-json/wp/v2/search?subtype=post&per_page=${MAX_POSTS}&search=${encodeURIComponent(q)}`)
    // WordPress pide todas las palabras: si con todas no hay nada, se prueba con la primera.
    let hits = await find(question)
    if (!hits.length && question.includes(' ')) hits = await find(question.split(' ')[0])
    if (!hits.length) return []
    const posts = await this.json<WpPost[]>(`/wp-json/wp/v2/posts?include=${hits.map((h) => h.id).join(',')}&_fields=title,content,link,date`)
    return posts.map((p) => ({ kind: 'noticia', title: plainText(p.title.rendered), url: p.link, date: p.date.slice(0, 10), text: clean(p.content.rendered, POST_CHARS) }))
  }

  async search(question: string): Promise<SitePage[]> {
    if (!this.base) return []
    const terms = questionTerms(question)
    if (!terms.length) return []
    const [pages, posts] = await Promise.all([
      this.findPages(terms).catch(() => []),
      // La búsqueda del sitio con las palabras que importan (no con la pregunta entera: WordPress pide todas).
      this.findPosts(terms.slice(0, 3).join(' ')).catch((e) => {
        console.warn('[asistente] no se pudo buscar en mupa.gob.pa:', e instanceof Error ? e.message : 'error')
        return [] as SitePage[]
      }),
    ])
    const seen = new Set(pages.map((p) => p.url))
    return [...pages, ...posts.filter((p) => !seen.has(p.url))]
  }
}

export const siteSearchService = new SiteSearchService(env.wpSync?.url ?? null)
