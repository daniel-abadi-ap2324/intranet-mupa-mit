import { env } from '../../config/env.ts'
import { DomainError } from '../../shared/errors/domain-error.ts'
import { renderPdfCover } from '../../shared/services/pdf-cover.service.ts'
import { wordpressService, type WordpressService } from '../../shared/services/wordpress.service.ts'
import { bulletinService, type BulletinsService } from '../bulletins/bulletins.service.ts'
import { filesService, type FilesService } from '../files/files.service.ts'
import { newsService, type NewsService } from '../news/news.service.ts'
import type { SyncResult, SyncSection } from './dtos/sync-result.dto.ts'

/** Mismo tope que la subida manual (files.routes.ts). */
const MAX_FILE_BYTES = 10 * 1024 * 1024
/** Cada página del RSS trae 5 boletines: 60 páginas = 300, de sobra para cualquier ventana razonable. */
const MAX_FEED_PAGES = 60
const MAX_POST_PAGES = 30
const DAY_MS = 24 * 60 * 60 * 1000
/** Panamá no tiene horario de verano: siempre UTC−5. */
const PANAMA_OFFSET_MS = -5 * 60 * 60 * 1000

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

const message = (e: unknown) => (e instanceof Error ? e.message : String(e))
const section = (): SyncSection => ({ nuevos: 0, omitidos: 0, avisos: [], errores: [] })

/** "AlcalDía 30 de septiembre. 2026" → "2026-09-30". Null si el título no trae una fecha válida. */
export function dateFromTitle(title: string): string | null {
  const m = /(\d{1,2})\s+de\s+([a-záéíóúñ]+)\.?\s*(?:de\s+)?(\d{4})/i.exec(title)
  if (!m) return null
  const month = MONTHS.indexOf(m[2].toLowerCase().replace('setiembre', 'septiembre'))
  if (month < 0) return null
  const d = new Date(Date.UTC(Number(m[3]), month, Number(m[1])))
  return d.getUTCMonth() === month && d.getUTCDate() === Number(m[1]) ? d.toISOString().slice(0, 10) : null
}

const panamaDay = (d: Date) => new Date(d.getTime() + PANAMA_OFFSET_MS).toISOString().slice(0, 10)

/**
 * Fecha de un boletín: la del título («30 de septiembre. 2026»). Si el título no la trae, o está
 * a más de 45 días de cuando se publicó (un año mal escrito), la de publicación en hora de Panamá.
 */
export function bulletinDate(title: string, published: Date): string {
  const fromTitle = dateFromTitle(title)
  const fromPublished = panamaDay(published)
  if (!fromTitle) return fromPublished
  return Math.abs(Date.parse(fromTitle) - Date.parse(fromPublished)) > 45 * DAY_MS ? fromPublished : fromTitle
}

const slugOf = (link: string) => new URL(link).pathname.split('/').filter(Boolean).pop() ?? link

/**
 * Trae de mupa.gob.pa las noticias y los boletines «AlcalDía» nuevos. Solo lee el sitio y solo
 * AGREGA: lo ya importado no se toca (Comunicación puede ocultarlo o corregirlo sin que se pise).
 */
export class WordpressSyncService {
  private readonly wordpress: WordpressService | null
  private readonly news: NewsService
  private readonly bulletins: BulletinsService
  private readonly files: FilesService
  private readonly settings: { windowDays: number; categories: number[]; intervalMinutes: number; newsEnabled: boolean }
  private running = false
  private last: SyncResult | null = null
  private timer: NodeJS.Timeout | null = null

  constructor(
    wordpress: WordpressService | null,
    news: NewsService,
    bulletins: BulletinsService,
    files: FilesService,
    settings: { windowDays: number; categories: number[]; intervalMinutes: number; newsEnabled: boolean },
  ) {
    this.wordpress = wordpress
    this.news = news
    this.bulletins = bulletins
    this.files = files
    this.settings = settings
  }

  status() {
    return { enabled: Boolean(this.wordpress), running: this.running, intervalMinutes: this.settings.intervalMinutes, windowDays: this.settings.windowDays, last: this.last }
  }

  /** Arranca la pasada automática: una al medio minuto de iniciar y luego cada `intervalMinutes`. Una sola instancia de la API. */
  start(): void {
    if (!this.wordpress || this.timer) return
    const run = () => void this.run().catch((e) => console.error('[wordpress-sync]', message(e)))
    const first = setTimeout(() => {
      run()
      this.timer = setInterval(run, this.settings.intervalMinutes * 60_000)
      this.timer.unref()
    }, 30_000)
    first.unref()
    this.timer = first
  }

  stop(): void {
    // clearTimeout y clearInterval valen para cualquiera de los dos temporizadores.
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
  }

  /**
   * Para el botón «Sincronizar ahora»: arranca la pasada en segundo plano y devuelve enseguida el estado.
   * La primera puede tardar minutos (cada foto y cada PDF se bajan por separado), más que el límite de nginx.
   */
  trigger() {
    if (!this.wordpress) throw new DomainError('La sincronización con mupa.gob.pa no está configurada.', 503, 'WP_SYNC_DISABLED')
    if (this.running) throw new DomainError('Ya hay una sincronización en curso.', 409, 'WP_SYNC_RUNNING')
    void this.run().catch((e) => console.error('[wordpress-sync]', message(e)))
    return this.status()
  }

  async run(): Promise<SyncResult> {
    const wordpress = this.wordpress
    if (!wordpress) throw new DomainError('La sincronización con mupa.gob.pa no está configurada.', 503, 'WP_SYNC_DISABLED')
    if (this.running) throw new DomainError('Ya hay una sincronización en curso.', 409, 'WP_SYNC_RUNNING')
    this.running = true
    const startedAt = new Date()
    try {
      const noticias = this.settings.newsEnabled ? await this.guard(() => this.syncNews(wordpress)) : null
      const boletines = await this.guard(() => this.syncBulletins(wordpress))
      this.last = { startedAt, finishedAt: new Date(), noticias, boletines }
      return this.last
    } finally {
      this.running = false
    }
  }

  /** Un fallo de toda la sección (el sitio no responde) se anota y no frena a la otra sección. */
  private async guard(job: () => Promise<SyncSection>): Promise<SyncSection> {
    const result = section()
    try {
      return await job()
    } catch (e) {
      console.error('[wordpress-sync]', message(e))
      result.errores.push(message(e))
      return result
    }
  }

  private async syncNews(wordpress: WordpressService): Promise<SyncSection> {
    const result = section()
    const after = new Date(Date.now() - this.settings.windowDays * DAY_MS).toISOString().slice(0, 19)
    const posts = []
    for (let page = 1, pages = 1; page <= pages && page <= MAX_POST_PAGES; page++) {
      const batch = await wordpress.listPosts({ after, page, categories: this.settings.categories })
      pages = batch.totalPages
      posts.push(...batch.posts)
    }
    const known = await this.news.findBySourceIds(posts.map((p) => `wp-post-${p.id}`))
    for (const post of posts.reverse()) {
      const sourceId = `wp-post-${post.id}`
      const ya = known.get(sourceId)
      if (ya) {
        // Importada antes de que se guardara el texto: se completa solo eso, sin tocar lo que Comunicación haya cambiado.
        if (!ya.hasBody && post.body) await this.news.fillBody(ya.id, post.body).catch((e) => result.errores.push(`Noticia ${post.id}: ${message(e)}`))
        continue
      }
      if (!post.title) {
        result.omitidos++
        continue
      }
      try {
        await this.news.importFromSource({
          sourceId,
          title: post.title.slice(0, 160),
          summary: post.summary.replace(/\s*\[…\]$/, '').slice(0, 500) || null,
          type: 'noticia',
          date: post.date,
          link: post.link,
          body: post.body || null,
          imageUrl: await this.importImage(wordpress, post.featuredMedia),
          status: 'publicado',
        })
        result.nuevos++
      } catch (e) {
        result.errores.push(`Noticia ${post.id}: ${message(e)}`)
      }
    }
    return result
  }

  /** La foto de la noticia, copiada a la intranet (la CSP no deja cargarla desde mupa.gob.pa). Sin foto válida, null. */
  private async importImage(wordpress: WordpressService, mediaId: number): Promise<string | null> {
    try {
      const url = await wordpress.getImageUrl(mediaId)
      if (!url) return null
      const stored = await this.files.upload(null, await wordpress.download(url, MAX_FILE_BYTES), new URL(url).pathname.split('/').pop() ?? 'imagen')
      return stored.mimeType.startsWith('image/') ? stored.url : null
    } catch {
      return null
    }
  }

  private async syncBulletins(wordpress: WordpressService): Promise<SyncSection> {
    const result = section()
    const cutoff = Date.now() - this.settings.windowDays * DAY_MS
    const items = []
    for (let page = 1; page <= MAX_FEED_PAGES; page++) {
      let feed
      try {
        feed = await wordpress.listFlipbookFeed(page)
      } catch (e) {
        if (page === 1) throw e
        break // más allá de la última página el sitio responde 404
      }
      if (!feed.length) break
      items.push(...feed.filter((i) => i.pubDate.getTime() >= cutoff))
      if (feed.some((i) => i.pubDate.getTime() < cutoff)) break
    }
    const known = await this.bulletins.findSourceIds(items.map((i) => `wp-flipbook:${slugOf(i.link)}`))
    for (const item of items.reverse()) {
      const sourceId = `wp-flipbook:${slugOf(item.link)}`
      if (known.has(sourceId)) continue
      const date = bulletinDate(item.title, item.pubDate)
      try {
        // Los boletines que ya estaban cargados a mano (o de la intranet anterior) no llevan source_id: se reconocen por la fecha.
        if (await this.bulletins.existsOnDate(date)) {
          result.omitidos++
          continue
        }
        const flipbook = await wordpress.getFlipbook(item.link)
        const pdf = await wordpress.download(flipbook.pdfUrl, MAX_FILE_BYTES)
        const stored = await this.files.upload(null, pdf, `Boletin-${date}.pdf`)
        const coverUrl = await this.importCover(pdf, date, result)
        await this.bulletins.importFromSource({ sourceId, date, pdfUrl: stored.url, coverUrl, note: '', published: true })
        result.nuevos++
      } catch (e) {
        result.errores.push(`Boletín «${item.title}»: ${message(e)}`)
      }
    }
    return result
  }

  /** La portada es un extra: si no se puede dibujar, el boletín entra igual y se avisa. */
  private async importCover(pdf: Buffer, date: string, result: SyncSection): Promise<string | null> {
    try {
      return (await this.files.upload(null, await renderPdfCover(pdf), `Portada-${date}.png`)).url
    } catch (e) {
      result.avisos.push(`Boletín ${date}: sin portada (${message(e)})`)
      return null
    }
  }
}

export const wordpressSyncService = new WordpressSyncService(wordpressService, newsService, bulletinService, filesService, {
  windowDays: env.wpSync?.windowDays ?? 90,
  categories: env.wpSync?.categories ?? [],
  intervalMinutes: env.wpSync?.intervalMinutes ?? 60,
  newsEnabled: true,
})
