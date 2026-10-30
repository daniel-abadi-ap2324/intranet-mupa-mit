/**
 * mupa.gob.pa falso (WordPress) para las pruebas, con lo que el sitio real publica sin login
 * (medido el 2026-10-02): la lista de entradas de la REST API, el RSS de los flipbooks (5 por
 * página), la página de cada boletín con el bloque FB3D_CLIENT_DATA del plugin y las subidas.
 * Todo ficticio.
 */
import type { Server } from 'node:http'

import express from 'express'

export type FakePost = { id: number; date: string; title: string; excerpt: string; /** HTML del contenido; por defecto un párrafo. */ content?: string; media?: { id: number; file: string } | null; categories?: number[] }
export type FakeBook = { slug: string; /** guid vacío, como un boletín de mupa.gob.pa armado sin PDF. */ sinPdf?: boolean; title: string; pubDate: Date; pdf: string; wpId?: number; /** La página sin el bloque de datos del plugin (como si el plugin hubiera cambiado). */ sinBloque?: boolean }

/** Un PDF de una página, con un rectángulo de color (sin fuentes): lo justo para dibujar la portada. */
export function tinyPdf(): Buffer {
  const stream = '0.2 0.4 0.8 rg 20 20 160 220 re f'
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 260] /Contents 4 0 R /Resources << >> >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  ]
  let out = '%PDF-1.4\n'
  const offsets: number[] = []
  objs.forEach((o, i) => {
    offsets.push(out.length)
    out += `${i + 1} 0 obj\n${o}\nendobj\n`
  })
  const xref = out.length
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return Buffer.from(out, 'latin1')
}

/** PNG de 1×1. */
export const TINY_PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64')

export async function startFakeWordpress(options: { url: string }) {
  const base = options.url
  const state = {
    posts: [] as FakePost[],
    books: [] as FakeBook[],
    /** Archivos de /wp-content/uploads/<nombre>. */
    uploads: new Map<string, Buffer>(),
    /** Espera antes de responder la lista de entradas (para probar dos sincronizaciones a la vez). */
    postsDelayMs: 0,
    hits: [] as string[],
  }

  const app = express()
  app.use((req, _res, next) => {
    state.hits.push(req.originalUrl)
    next()
  })

  app.get('/wp-json/wp/v2/posts', async (req, res) => {
    if (state.postsDelayMs) await new Promise((r) => setTimeout(r, state.postsDelayMs))
    const after = String(req.query.after ?? '')
    const categories = String(req.query.categories ?? '').split(',').filter(Boolean).map(Number)
    const list = state.posts
      .filter((p) => !after || p.date > after)
      .filter((p) => !categories.length || (p.categories ?? []).some((c) => categories.includes(c)))
      .sort((a, b) => b.date.localeCompare(a.date))
    res.set('X-WP-Total', String(list.length)).set('X-WP-TotalPages', '1')
    res.json(
      list.map((p) => ({
        id: p.id,
        date: p.date,
        link: `${base}/noticia-${p.id}/`,
        title: { rendered: p.title },
        excerpt: { rendered: p.excerpt },
        content: { rendered: p.content ?? `<div class="elementor"><div dir="auto">Texto completo de la noticia ${p.id}.</div></div>` },
        featured_media: p.media?.id ?? 0,
      })),
    )
  })

  app.get('/wp-json/wp/v2/media/:id', (req, res) => {
    const post = state.posts.find((p) => p.media?.id === Number(req.params.id))
    if (!post?.media) return res.status(404).json({ code: 'rest_post_invalid_id' })
    const url = `${base}/wp-content/uploads/${post.media.file}`
    res.json({ mime_type: 'image/png', source_url: url, media_details: { sizes: { 'psacp-medium': { source_url: url } } } })
  })

  app.get('/3d-flip-book/feed/', (req, res) => {
    const page = Math.max(1, Number(req.query.paged ?? 1))
    const sorted = [...state.books].sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime())
    const items = sorted.slice((page - 1) * 5, page * 5)
    if (page > 1 && !items.length) return res.status(404).type('text/html').send('no hay')
    res.type('application/rss+xml').send(
      `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>3D FlipBook</title>${items
        .map((b) => `<item><title>${b.title}</title><link>${base}/3d-flip-book/${b.slug}/</link><pubDate>${b.pubDate.toUTCString()}</pubDate></item>`)
        .join('')}</channel></rss>`,
    )
  })

  app.get('/3d-flip-book/:slug/', (req, res) => {
    const book = state.books.find((b) => b.slug === req.params.slug)
    if (!book) return res.status(404).type('text/html').send('no existe')
    if (book.sinBloque) return res.type('text/html').send('<html><body>Otro plugin</body></html>')
    const data = { posts: { [book.wpId ?? 1]: { ID: book.wpId ?? 1, title: book.title, data: { guid: book.sinPdf ? '' : book.pdf.startsWith('http') ? book.pdf : `${base}/wp-content/uploads/${book.pdf}` } } } }
    res.type('text/html').send(`<html><body><script>window.FB3D_CLIENT_DATA = window.FB3D_CLIENT_DATA || [];FB3D_CLIENT_DATA.push('${Buffer.from(JSON.stringify(data)).toString('base64')}');</script></body></html>`)
  })

  app.get('/wp-content/uploads/:file', (req, res) => {
    const file = state.uploads.get(req.params.file)
    if (!file) return res.status(404).end()
    res.type('application/octet-stream').send(file)
  })

  const server: Server = await new Promise((resolve, reject) => {
    const s = app.listen(Number(new URL(base).port), '127.0.0.1', () => resolve(s))
    s.on('error', reject)
  })

  return {
    state,
    reset() {
      state.posts = []
      state.books = []
      state.uploads = new Map()
      state.postsDelayMs = 0
      state.hits = []
    },
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  }
}

export type FakeWordpress = Awaited<ReturnType<typeof startFakeWordpress>>
