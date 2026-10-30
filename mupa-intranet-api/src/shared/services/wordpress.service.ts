import { XMLParser } from 'fast-xml-parser'
import { z } from 'zod'

import { env, type WpSyncConfig } from '../../config/env.ts'

/**
 * Cliente de SOLO LECTURA de mupa.gob.pa (WordPress). Usa lo que el sitio ya publica sin login:
 *  - la API de entradas (`/wp-json/wp/v2/posts`) para las noticias,
 *  - el RSS de los flipbooks (`/3d-flip-book/feed/`) y la página de cada flipbook para los
 *    boletines «AlcalDía» (el plugin 3D FlipBook no está en la REST API y sus PDF salen ocultos).
 * Nunca escribe en el sitio. Las descargas solo salen de `/wp-content/uploads/` de ese mismo sitio.
 */

const postsSchema = z.array(
  z.object({
    id: z.number(),
    date: z.string(),
    link: z.url(),
    title: z.object({ rendered: z.string() }),
    excerpt: z.object({ rendered: z.string() }),
    content: z.object({ rendered: z.string() }),
    featured_media: z.number().default(0),
  }),
)

const mediaSchema = z.object({
  mime_type: z.string(),
  source_url: z.url(),
  media_details: z.object({ sizes: z.record(z.string(), z.object({ source_url: z.url() })).optional() }).optional(),
})

/** Lo que el plugin deja en la página de cada boletín (base64 → JSON). */
const flipbookDataSchema = z.object({ posts: z.record(z.string(), z.object({ ID: z.number(), title: z.string(), data: z.object({ guid: z.string() }) })) })

export type WpPost = { id: number; date: string; link: string; title: string; summary: string; body: string; featuredMedia: number }
export type WpFeedItem = { title: string; link: string; pubDate: Date }
export type WpFlipbook = { wpId: number; title: string; pdfUrl: string }

const NAMED_ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', hellip: '…', laquo: '«', raquo: '»', ndash: '–', mdash: '—' }

/** Texto plano de lo que devuelve WordPress: sin etiquetas, con las entidades HTML ya decodificadas. */
export function plainText(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
      if (e[0] === '#') {
        const code = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)
        return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : ' '
      }
      return NAMED_ENTITIES[e.toLowerCase()] ?? m
    })
    .replace(/\s+/g, ' ')
    .trim()
}

/** Lo más que se guarda del texto de una noticia (las más largas del sitio rondan los 5 000 caracteres). */
const MAX_BODY_CHARS = 20_000

/**
 * El texto de una noticia (Elementor la arma con <div>, <p>, <br> y a veces galerías y estilos):
 * un párrafo por línea, sin HTML ni imágenes, separados por una línea en blanco. Vacío si no hay texto.
 */
export function articleText(html: string): string {
  const text = html
    .replace(/<(script|style|figure|dl|noscript)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<\/(p|div|h[1-6]|li|blockquote|tr|section)>|<br\s*\/?>/gi, '\n')
  return text
    .split('\n')
    .map((line) => plainText(line))
    .filter(Boolean)
    .join('\n\n')
    .slice(0, MAX_BODY_CHARS)
    .trim()
}

export class WordpressService {
  private readonly config: WpSyncConfig
  private readonly xml = new XMLParser({ ignoreAttributes: true })

  constructor(config: WpSyncConfig) {
    this.config = config
  }

  /** Dónde se permite descargar archivos: las subidas del propio sitio. */
  get uploadsPrefix(): string {
    return `${this.config.url}/wp-content/uploads/`
  }

  async listPosts(params: { after: string; page: number; categories: number[] }): Promise<{ posts: WpPost[]; totalPages: number }> {
    const query = new URLSearchParams({
      per_page: '100',
      page: String(params.page),
      orderby: 'date',
      order: 'desc',
      after: params.after,
      _fields: 'id,date,link,title,excerpt,content,featured_media',
    })
    if (params.categories.length) query.set('categories', params.categories.join(','))
    const res = await this.request(`/wp-json/wp/v2/posts?${query}`)
    const body = postsSchema.safeParse(await res.json().catch(() => null))
    if (!body.success) throw new Error('Respuesta inesperada de la lista de entradas')
    return {
      totalPages: Number(res.headers.get('x-wp-totalpages')) || 1,
      posts: body.data.map((p) => ({
        id: p.id,
        date: p.date.slice(0, 10),
        link: p.link,
        title: plainText(p.title.rendered),
        summary: plainText(p.excerpt.rendered),
        body: articleText(p.content.rendered),
        featuredMedia: p.featured_media,
      })),
    }
  }

  /** La imagen destacada de una entrada, en tamaño mediano si existe; null si no hay o no se puede leer. */
  async getImageUrl(mediaId: number): Promise<string | null> {
    if (!mediaId) return null
    const res = await this.request(`/wp-json/wp/v2/media/${mediaId}?_fields=mime_type,source_url,media_details`).catch(() => null)
    if (!res) return null
    const body = mediaSchema.safeParse(await res.json().catch(() => null))
    if (!body.success) return null
    return body.data.media_details?.sizes?.['psacp-medium']?.source_url ?? body.data.source_url
  }

  /** Una página del RSS de los boletines (5 por página), del más nuevo al más viejo. */
  async listFlipbookFeed(page: number): Promise<WpFeedItem[]> {
    const res = await this.request(`/3d-flip-book/feed/?paged=${page}`, 'application/rss+xml')
    const parsed = this.xml.parse(await res.text())
    const raw = parsed?.rss?.channel?.item
    const items: unknown[] = Array.isArray(raw) ? raw : raw ? [raw] : []
    const feed: WpFeedItem[] = []
    for (const it of items as { title?: unknown; link?: unknown; pubDate?: unknown }[]) {
      const pubDate = new Date(String(it.pubDate ?? ''))
      if (typeof it.title !== 'string' || typeof it.link !== 'string' || Number.isNaN(pubDate.getTime())) continue
      feed.push({ title: plainText(it.title), link: it.link.trim(), pubDate })
    }
    return feed
  }

  /** Abre la página del boletín y saca el enlace de su PDF del bloque de datos del plugin. */
  async getFlipbook(link: string): Promise<WpFlipbook> {
    if (!link.startsWith(`${this.config.url}/3d-flip-book/`)) throw new Error('El enlace del boletín no es de mupa.gob.pa')
    const html = await (await this.request(new URL(link).pathname, 'text/html')).text()
    for (const m of html.matchAll(/FB3D_CLIENT_DATA\.push\('([A-Za-z0-9+/=]+)'\)/g)) {
      let json: unknown
      try {
        json = JSON.parse(Buffer.from(m[1], 'base64').toString('utf8'))
      } catch {
        continue
      }
      const data = flipbookDataSchema.safeParse(json)
      if (!data.success) continue
      const books = Object.values(data.data.posts)
      const book = books.find((p) => /[.]pdf$/i.test(p.data.guid))
      if (book) return { wpId: book.ID, title: plainText(book.title), pdfUrl: book.data.guid }
      // El plugin respondió pero el boletín no tiene PDF (en el sitio quedó armado con imágenes): no es un cambio del plugin.
      if (books.length) throw new Error('El boletín no tiene PDF en mupa.gob.pa')
    }
    throw new Error('La página del boletín no trae el PDF (¿cambió el plugin?)')
  }

  /** Baja un archivo de las subidas del sitio, con tope de tamaño. Rechaza cualquier otra dirección. */
  async download(url: string, maxBytes: number): Promise<Buffer> {
    if (!url.startsWith(this.uploadsPrefix) || url.includes('..')) throw new Error('Archivo fuera de /wp-content/uploads/')
    const res = await this.fetchOrThrow(url, '*/*')
    const declared = Number(res.headers.get('content-length'))
    if (declared > maxBytes) throw new Error('Archivo demasiado grande')
    const chunks: Buffer[] = []
    let size = 0
    for await (const chunk of res.body as unknown as AsyncIterable<Uint8Array>) {
      size += chunk.length
      if (size > maxBytes) throw new Error('Archivo demasiado grande')
      chunks.push(Buffer.from(chunk))
    }
    return Buffer.concat(chunks)
  }

  private request(path: string, accept = 'application/json'): Promise<Response> {
    return this.fetchOrThrow(this.config.url + path, accept)
  }

  /** Redirecciones a mano y solo dentro del mismo sitio (WordPress redirige, p. ej., ?paged=1 a la página 1). */
  private async fetchOrThrow(url: string, accept: string): Promise<Response> {
    let target = url
    for (let hop = 0; hop < 3; hop++) {
      const res = await fetch(target, {
        headers: { Accept: accept, 'User-Agent': 'IntranetMUPA-sync/1.0' },
        redirect: 'manual',
        signal: AbortSignal.timeout(this.config.timeoutMs),
      })
      const location = res.headers.get('location')
      if (res.status >= 300 && res.status < 400 && location) {
        const next = new URL(location, target).href
        if (!next.startsWith(`${this.config.url}/`)) throw new Error(`Redirección fuera de mupa.gob.pa en ${new URL(url).pathname}`)
        target = next
        continue
      }
      if (!res.ok) throw new Error(`HTTP ${res.status} en ${new URL(url).pathname}`)
      return res
    }
    throw new Error(`Demasiadas redirecciones en ${new URL(url).pathname}`)
  }
}

export const wordpressService = env.wpSync ? new WordpressService(env.wpSync) : null
