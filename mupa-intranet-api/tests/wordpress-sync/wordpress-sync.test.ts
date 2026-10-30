/**
 * Sincronización con mupa.gob.pa contra un WordPress falso (tests/wordpress-sync/fake-wordpress.ts)
 * en el puerto de WP_SYNC_URL. Todo ficticio.
 */
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { db } from '../../src/config/database.ts'
import { bulletins, news } from '../../src/database/schema/index.ts'
import { bulletinService } from '../../src/features/bulletins/bulletins.service.ts'
import { filesService } from '../../src/features/files/files.service.ts'
import { newsService } from '../../src/features/news/news.service.ts'
import { WordpressSyncService } from '../../src/features/wordpress-sync/wordpress-sync.service.ts'
import { WordpressService } from '../../src/shared/services/wordpress.service.ts'
import { anonymous, createUser, loginAs } from '../helpers.ts'
import { startFakeWordpress, tinyPdf, TINY_PNG, type FakeWordpress } from './fake-wordpress.ts'

const URL_BASE = process.env.WP_SYNC_URL!
let wp: FakeWordpress
let comu: Awaited<ReturnType<typeof loginAs>>

/** Fecha de WordPress ("2026-10-02T08:12:21") a hace `days` días. */
const wpDate = (days: number) => new Date(Date.now() - days * 86_400_000 - 5 * 3600_000).toISOString().slice(0, 19)
const isoDay = (days: number) => wpDate(days).slice(0, 10)
const longDate = (day: string) => {
  const [y, m, d] = day.split('-').map(Number)
  return `${d} de ${['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'][m - 1]}. ${y}`
}

beforeAll(async () => {
  wp = await startFakeWordpress({ url: URL_BASE })
  await createUser('comu-wp@prueba.test', ['comunicacion'], 'Carla')
  await createUser('func-wp@prueba.test', ['funcionario'])
  comu = await loginAs('comu-wp@prueba.test')
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
})
afterAll(() => wp.close())

beforeEach(async () => {
  wp.reset()
  await db.delete(news)
  await db.delete(bulletins)
})

type Seccion = { nuevos: number; omitidos: number; avisos: string[]; errores: string[] }

/** «Sincronizar ahora»: la ruta responde 202 y la pasada sigue en segundo plano; se espera a que termine. */
const sync = async () => {
  const r = await comu.post('/api/wordpress-sync/run')
  expect(r.status).toBe(202)
  expect(r.body.running).toBe(true)
  for (let i = 0; i < 200; i++) {
    const s = (await comu.get('/api/wordpress-sync/status')).body
    if (!s.running) return s.last as { noticias: Seccion | null; boletines: Seccion }
    await new Promise((resolve) => setTimeout(resolve, 25))
  }
  throw new Error('La sincronización no terminó')
}

describe('permisos', () => {
  it('solo Comunicación y administración', async () => {
    expect((await anonymous().post('/api/wordpress-sync/run')).status).toBe(401)
    const func = await loginAs('func-wp@prueba.test')
    expect((await func.post('/api/wordpress-sync/run')).status).toBe(403)
    expect((await func.get('/api/wordpress-sync/status')).status).toBe(403)
  })

  it('el estado dice que está encendida y cómo le fue la última vez', async () => {
    const antes = (await comu.get('/api/wordpress-sync/status')).body
    expect(antes).toMatchObject({ enabled: true, running: false, windowDays: 30 })
    await sync()
    const despues = (await comu.get('/api/wordpress-sync/status')).body
    expect(despues.last.boletines).toMatchObject({ nuevos: 0 })
  })
})

describe('noticias', () => {
  it('importa las nuevas, publicadas, con su foto copiada a la intranet', async () => {
    wp.state.uploads.set('foto-1.png', TINY_PNG)
    wp.state.posts.push(
      { id: 101, date: wpDate(1), title: 'Alcald&#237;a de Panam&#225; &#8211; &#8220;Empleo 2.0&#8221;', excerpt: '<p>Resumen de la noticia&nbsp;[&hellip;]</p>', media: { id: 901, file: 'foto-1.png' } },
      { id: 102, date: wpDate(2), title: 'Sin foto', excerpt: '<p>Otra</p>' },
    )
    const r = await sync()
    expect(r.noticias).toMatchObject({ nuevos: 2, omitidos: 0, errores: [] })

    const lista = (await anonymous().get('/api/news')).body
    expect(lista).toHaveLength(2)
    const con = lista.find((n: { title: string }) => n.title.startsWith('Alcaldía'))
    expect(con).toMatchObject({ title: 'Alcaldía de Panamá – “Empleo 2.0”', summary: 'Resumen de la noticia', type: 'noticia', link: `${URL_BASE}/noticia-101/` })
    expect(con.imageUrl).toMatch(/^\/api\/files\/\d+\/foto-1\.png$/)
    const foto = await anonymous().get(con.imageUrl)
    expect(foto.status).toBe(200)
    expect(foto.headers['content-type']).toBe('image/png')
    expect(lista.find((n: { title: string }) => n.title === 'Sin foto').imageUrl).toBeNull()

    const [fila] = await db.select().from(news).where(eq(news.sourceId, 'wp-post-101'))
    expect(fila).toMatchObject({ status: 'publicado', createdBy: null, updatedBy: null })
  })

  it('guarda el texto de la noticia y se puede leer completa; la lista no lo trae', async () => {
    wp.state.posts.push({ id: 601, date: wpDate(1), title: 'Con texto', excerpt: 'Resumen', content: '<div dir="auto">Primero.</div><div dir="auto"> </div><div dir="auto">Segundo con &laquo;comillas&raquo;.</div><style>.x{}</style>' })
    await sync()
    const [item] = (await anonymous().get('/api/news')).body
    expect(item).toMatchObject({ title: 'Con texto', hasBody: true })
    expect(item).not.toHaveProperty('body')
    const leida = await anonymous().get('/api/news/' + item.id)
    expect(leida.status).toBe(200)
    expect(leida.body).toMatchObject({ id: item.id, title: 'Con texto', body: ['Primero.', 'Segundo con «comillas».'].join('\n\n') })
  })

  it('una noticia sin texto, oculta o que no existe no se lee aquí (404)', async () => {
    wp.state.posts.push({ id: 602, date: wpDate(1), title: 'Sin texto', excerpt: '', content: '<div> </div>' }, { id: 603, date: wpDate(2), title: 'Se oculta', excerpt: '' })
    await sync()
    const filas = await db.select().from(news)
    const sinTexto = filas.find((n) => n.title === 'Sin texto')!
    const oculta = filas.find((n) => n.title === 'Se oculta')!
    expect((await anonymous().get('/api/news/' + sinTexto.id)).body.error).toBe('NEWS_WITHOUT_BODY')
    expect((await anonymous().get('/api/news')).body.find((n: { id: number }) => n.id === sinTexto.id).hasBody).toBe(false)
    await comu.patch('/api/news/' + oculta.id).send({ status: 'borrador' })
    expect((await anonymous().get('/api/news/' + oculta.id)).status).toBe(404)
    expect((await anonymous().get('/api/news/999999')).status).toBe(404)
    // La ruta fija /manage no se confunde con un id.
    expect((await comu.get('/api/news/manage')).status).toBe(200)
  })

  it('las ya importadas sin texto lo reciben en la siguiente pasada, sin tocar lo demás', async () => {
    wp.state.posts.push({ id: 604, date: wpDate(1), title: 'Antigua', excerpt: '' })
    await sync()
    const [fila] = await db.select().from(news)
    await db.update(news).set({ body: null, title: 'Título cambiado por Comunicación' }).where(eq(news.id, fila.id))
    expect((await anonymous().get('/api/news/' + fila.id)).status).toBe(404)
    const r = await sync()
    expect(r.noticias).toMatchObject({ nuevos: 0, errores: [] })
    const leida = await anonymous().get('/api/news/' + fila.id)
    expect(leida.body).toMatchObject({ title: 'Título cambiado por Comunicación', body: 'Texto completo de la noticia 604.' })
  })

  it('no repite lo ya importado ni pisa lo que Comunicación cambió', async () => {
    wp.state.posts.push({ id: 201, date: wpDate(1), title: 'Original', excerpt: '' })
    expect((await sync()).noticias?.nuevos).toBe(1)
    const [fila] = await db.select().from(news)
    await comu.patch(`/api/news/${fila.id}`).send({ title: 'Corregida por Comunicación', status: 'borrador' })
    wp.state.posts[0].title = 'Cambió en mupa.gob.pa'

    expect((await sync()).noticias?.nuevos).toBe(0)
    const [despues] = await db.select().from(news)
    expect(despues).toMatchObject({ title: 'Corregida por Comunicación', status: 'borrador' })
    expect(await db.$count(news)).toBe(1)
  })

  it('solo mira la ventana de días y las categorías pedidas', async () => {
    wp.state.posts.push({ id: 301, date: wpDate(5), title: 'Reciente', excerpt: '' }, { id: 302, date: wpDate(90), title: 'Muy vieja', excerpt: '' })
    const r = await sync()
    expect(r.noticias?.nuevos).toBe(1)
    expect((await anonymous().get('/api/news')).body.map((n: { title: string }) => n.title)).toEqual(['Reciente'])

    // Con categorías: solo las de esa lista llegan (el filtro lo hace WordPress).
    const soloUna = new WordpressSyncService(new WordpressService({ url: URL_BASE, intervalMinutes: 60, windowDays: 30, categories: [7], timeoutMs: 1500 }), newsService, bulletinService, filesService, {
      windowDays: 30,
      categories: [7],
      intervalMinutes: 60,
      newsEnabled: true,
    })
    await db.delete(news)
    wp.state.posts.push({ id: 303, date: wpDate(1), title: 'De la categoría 7', excerpt: '', categories: [7] }, { id: 304, date: wpDate(1), title: 'De otra', excerpt: '', categories: [8] })
    expect((await soloUna.run()).noticias?.nuevos).toBe(1)
    expect((await db.select().from(news))[0].title).toBe('De la categoría 7')
  })

  it('una foto que no es imagen no frena la noticia', async () => {
    wp.state.uploads.set('falsa.png', Buffer.from('esto no es una imagen'))
    wp.state.posts.push({ id: 401, date: wpDate(1), title: 'Con foto rota', excerpt: '', media: { id: 902, file: 'falsa.png' } })
    const r = await sync()
    expect(r.noticias).toMatchObject({ nuevos: 1, errores: [] })
    expect((await db.select().from(news))[0].imageUrl).toBeNull()
  })

  it('en la edición publicación las noticias no se importan', async () => {
    wp.state.posts.push({ id: 501, date: wpDate(1), title: 'No debe entrar', excerpt: '' })
    const service = new WordpressSyncService(new WordpressService({ url: URL_BASE, intervalMinutes: 60, windowDays: 30, categories: [], timeoutMs: 1500 }), newsService, bulletinService, filesService, {
      windowDays: 30,
      categories: [],
      intervalMinutes: 60,
      newsEnabled: false,
    })
    const r = await service.run()
    expect(r.noticias).toBeNull()
    expect(await db.$count(news)).toBe(0)
    expect(wp.state.hits.some((h) => h.startsWith('/wp-json/wp/v2/posts'))).toBe(false)
  })
})

describe('boletines', () => {
  const libro = (days: number, pdf = 'boletin.pdf') => ({ slug: `alcaldia-${days}`, title: `AlcalDía ${longDate(isoDay(days))}`, pubDate: new Date(Date.now() - days * 86_400_000), pdf, wpId: 9000 + days })

  it('importa el PDF y su portada, con la fecha del título', async () => {
    wp.state.uploads.set('boletin.pdf', tinyPdf())
    wp.state.books.push(libro(1))
    const r = await sync()
    expect(r.boletines).toMatchObject({ nuevos: 1, omitidos: 0, avisos: [], errores: [] })

    const [b] = (await anonymous().get('/api/bulletins')).body
    expect(b).toMatchObject({ date: isoDay(1), note: '' })
    expect(b.pdfUrl).toMatch(/^\/api\/files\/\d+\/Boletin-\d{4}-\d{2}-\d{2}\.pdf$/)
    expect(b.coverUrl).toMatch(/^\/api\/files\/\d+\/Portada-\d{4}-\d{2}-\d{2}\.png$/)
    const pdf = await anonymous().get(b.pdfUrl).buffer(true).parse((res, cb) => {
      const chunks: Buffer[] = []
      res.on('data', (c: Buffer) => chunks.push(c))
      res.on('end', () => cb(null, Buffer.concat(chunks)))
    })
    expect((pdf.body as Buffer).subarray(0, 5).toString()).toBe('%PDF-')
    const portada = await anonymous().get(b.coverUrl).buffer(true).parse((res, cb) => {
      const chunks: Buffer[] = []
      res.on('data', (c: Buffer) => chunks.push(c))
      res.on('end', () => cb(null, Buffer.concat(chunks)))
    })
    expect(portada.headers['content-type']).toBe('image/png')
    expect((portada.body as Buffer).subarray(1, 4).toString()).toBe('PNG')

    const [fila] = await db.select().from(bulletins)
    expect(fila).toMatchObject({ sourceId: 'wp-flipbook:alcaldia-1', published: true, createdBy: null })
  })

  it('no repite lo ya importado', async () => {
    wp.state.uploads.set('boletin.pdf', tinyPdf())
    wp.state.books.push(libro(1), libro(2))
    expect((await sync()).boletines.nuevos).toBe(2)
    const segunda = await sync()
    expect(segunda.boletines).toMatchObject({ nuevos: 0, omitidos: 0, errores: [] })
    expect(await db.$count(bulletins)).toBe(2)
  })

  it('pasa de página en el RSS (5 por página) y se detiene en la ventana', async () => {
    wp.state.uploads.set('boletin.pdf', tinyPdf())
    for (const d of [1, 2, 3, 4, 5, 6, 7]) wp.state.books.push(libro(d))
    wp.state.books.push(libro(120)) // fuera de la ventana de 30 días
    const r = await sync()
    expect(r.boletines.nuevos).toBe(7)
    expect(await db.$count(bulletins)).toBe(7)
  })

  it('omite el boletín de una fecha que ya estaba cargada a mano', async () => {
    wp.state.uploads.set('boletin.pdf', tinyPdf())
    await db.insert(bulletins).values({ date: isoDay(3), pdfUrl: '/sitio/Boletin-viejo.pdf' })
    wp.state.books.push(libro(3), libro(4))
    const r = await sync()
    expect(r.boletines).toMatchObject({ nuevos: 1, omitidos: 1 })
    expect(await db.$count(bulletins)).toBe(2)
  })

  it('un PDF falso o fuera de /wp-content/uploads/ se rechaza y los demás entran', async () => {
    wp.state.uploads.set('boletin.pdf', tinyPdf())
    wp.state.uploads.set('falso.pdf', Buffer.from('<html>no soy un PDF</html>'))
    wp.state.books.push(libro(1), libro(2, 'falso.pdf'), libro(3, `${URL_BASE}/otra-carpeta/boletin.pdf`), libro(4, 'https://ejemplo.test/wp-content/uploads/x.pdf'))
    const r = await sync()
    expect(r.boletines.nuevos).toBe(1)
    expect(r.boletines.errores).toHaveLength(3)
    expect(r.boletines.errores.join(' ')).toMatch(/Solo se aceptan PDF/)
    expect(r.boletines.errores.join(' ')).toMatch(/fuera de \/wp-content\/uploads\//)
    expect(await db.$count(bulletins)).toBe(1)
    // Y se reintentan en la siguiente pasada (no quedaron guardados a medias).
    expect((await sync()).boletines.errores).toHaveLength(3)
  })

  it('un boletín que en mupa.gob.pa no tiene PDF se anota con su motivo y los demás entran', async () => {
    wp.state.uploads.set('boletin.pdf', tinyPdf())
    wp.state.books.push({ ...libro(1), sinPdf: true }, libro(2))
    const r = await sync()
    expect(r.boletines.nuevos).toBe(1)
    expect(r.boletines.errores).toEqual([expect.stringContaining('no tiene PDF en mupa.gob.pa')])
  })

  it('si no se puede dibujar la portada, el boletín entra igual y se avisa', async () => {
    wp.state.uploads.set('roto.pdf', Buffer.from('%PDF-1.4\nesto no es un PDF de verdad\n'))
    wp.state.books.push(libro(1, 'roto.pdf'))
    const r = await sync()
    expect(r.boletines).toMatchObject({ nuevos: 1, errores: [] })
    expect(r.boletines.avisos).toHaveLength(1)
    expect(r.boletines.avisos[0]).toMatch(/sin portada/)
    const [b] = await db.select().from(bulletins)
    expect(b.coverUrl).toBeNull()
    expect(b.pdfUrl).toMatch(/^\/api\/files\//)
  })

  it('si la página del boletín no trae el PDF (el plugin cambió), lo anota sin guardar nada', async () => {
    wp.state.uploads.set('boletin.pdf', tinyPdf())
    wp.state.books.push({ ...libro(1), sinBloque: true }, libro(2))
    const r = await sync()
    expect(r.boletines.nuevos).toBe(1)
    expect(r.boletines.errores).toHaveLength(1)
    expect(r.boletines.errores[0]).toMatch(/¿cambió el plugin\?/)
    expect(await db.$count(bulletins)).toBe(1)
  })
})

describe('el sitio no responde', () => {
  it('un fallo de las noticias no frena a los boletines y se anota', async () => {
    wp.state.uploads.set('boletin.pdf', tinyPdf())
    wp.state.books.push({ slug: 'alcaldia-1', title: `AlcalDía ${longDate(isoDay(1))}`, pubDate: new Date(Date.now() - 86_400_000), pdf: 'boletin.pdf' })
    const caido = new WordpressSyncService(new WordpressService({ url: 'http://127.0.0.1:9', intervalMinutes: 60, windowDays: 30, categories: [], timeoutMs: 500 }), newsService, bulletinService, filesService, {
      windowDays: 30,
      categories: [],
      intervalMinutes: 60,
      newsEnabled: true,
    })
    const r = await caido.run()
    expect(r.noticias?.errores).toHaveLength(1)
    expect(r.boletines.errores).toHaveLength(1)
    expect(await db.$count(news)).toBe(0)
    expect(await db.$count(bulletins)).toBe(0)
  })

  it('dos sincronizaciones a la vez: la segunda espera su turno (409)', async () => {
    wp.state.postsDelayMs = 300
    const primera = await comu.post('/api/wordpress-sync/run')
    const segunda = await comu.post('/api/wordpress-sync/run')
    expect([primera.status, segunda.status]).toEqual([202, 409])
    expect(segunda.body.error).toBe('WP_SYNC_RUNNING')
    // Espera a que la primera termine para no dejar trabajo suelto en la prueba siguiente.
    for (let i = 0; i < 200 && (await comu.get('/api/wordpress-sync/status')).body.running; i++) await new Promise((r) => setTimeout(r, 25))
  })
})
