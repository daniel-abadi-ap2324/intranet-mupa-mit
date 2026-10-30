import { beforeAll, describe, expect, it } from 'vitest'

import { anonymous, createUser, loginAs } from './helpers.ts'

type Agente = Awaited<ReturnType<typeof loginAs>>
let comu: Agente
let ana: Agente

beforeAll(async () => {
  await createUser('comu@prueba.test', ['comunicacion'], 'Carla')
  await createUser('ana@prueba.test', ['funcionario'])
  await createUser('gestor@prueba.test', ['gestorSolicitudes'])
  comu = await loginAs('comu@prueba.test')
  ana = await loginAs('ana@prueba.test')
})

const PDF = Buffer.from('%PDF-1.4\n1 0 obj << >> endobj\n%%EOF\n')
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0])

const subir = (agente: Agente | ReturnType<typeof anonymous>, contenido: Buffer, nombre: string) =>
  agente.post('/api/files').set('Content-Type', 'application/octet-stream').set('X-File-Name', encodeURIComponent(nombre)).send(contenido)

describe('archivos', () => {
  it('Comunicación sube un PDF y cualquiera lo puede abrir, con su tipo y sin adivinarlo', async () => {
    const r = await subir(comu, PDF, 'Boletín 5 de agosto.pdf')
    expect(r.status).toBe(201)
    expect(r.body).toMatchObject({ originalName: 'Boletin-5-de-agosto.pdf', mimeType: 'application/pdf', size: PDF.length })
    expect(r.body.url).toMatch(/^\/api\/files\/\d+\/Boletin-5-de-agosto\.pdf$/)

    const d = await anonymous().get(r.body.url)
    expect(d.status).toBe(200)
    expect(d.headers['content-type']).toBe('application/pdf')
    expect(d.headers['x-content-type-options']).toBe('nosniff')
    expect(Buffer.from(d.body).equals(PDF)).toBe(true)
    expect((await anonymous().get(`/api/files/${r.body.id}`)).status).toBe(200)
  })

  it('el tipo se decide por el contenido: una imagen con nombre .pdf es PNG; un texto o un vacío no se aceptan', async () => {
    expect((await subir(comu, PNG, 'truco.pdf')).body).toMatchObject({ mimeType: 'image/png', originalName: 'truco.png' })
    const texto = await subir(comu, Buffer.from('<script>alert(1)</script>'), 'boletin.pdf')
    expect(texto.status).toBe(400)
    expect(texto.body.error).toBe('FILE_TYPE_NOT_ALLOWED')
    expect((await subir(comu, Buffer.alloc(0), 'vacio.pdf')).body.error).toBe('FILE_EMPTY')
  })

  it('sin sesión 401; sin el rol 403; un id que no existe 404', async () => {
    expect((await subir(anonymous(), PDF, 'x.pdf')).status).toBe(401)
    expect((await subir(ana, PDF, 'x.pdf')).status).toBe(403)
    expect((await subir(await loginAs('gestor@prueba.test'), PDF, 'x.pdf')).status).toBe(403)
    expect((await anonymous().get('/api/files/99999/x.pdf')).status).toBe(404)
  })
})

describe('boletines, noticias y videos', () => {
  it('permisos: leer lo publicado es público; el panel y los cambios son de Comunicación', async () => {
    for (const ruta of ['/api/bulletins', '/api/news', '/api/videos']) {
      expect((await anonymous().get(ruta)).status, ruta).toBe(200)
      expect((await anonymous().get(ruta + '/manage')).status, ruta).toBe(401)
      expect((await ana.get(ruta + '/manage')).status, ruta).toBe(403)
      expect((await ana.post(ruta).send({})).status, ruta).toBe(403)
      expect((await comu.get(ruta + '/manage')).status, ruta).toBe(200)
    }
  })

  it('un boletín se publica con su PDF, se oculta y se borra', async () => {
    const pdf = (await subir(comu, PDF, 'boletin.pdf')).body
    const r = await comu.post('/api/bulletins').send({ date: '2026-09-28', pdfUrl: pdf.url })
    expect(r.status).toBe(201)
    expect(r.body).toMatchObject({ date: '2026-09-28', pdfUrl: pdf.url, flipbookUrl: null, note: '', published: true, updatedByName: 'Carla' })
    const publicos = async () => (await anonymous().get('/api/bulletins')).body.map((b: { id: number }) => b.id)
    expect(await publicos()).toContain(r.body.id)

    await comu.patch(`/api/bulletins/${r.body.id}`).send({ published: false })
    expect(await publicos()).not.toContain(r.body.id)
    expect((await comu.delete(`/api/bulletins/${r.body.id}`)).status).toBe(204)
    expect((await comu.delete(`/api/bulletins/${r.body.id}`)).body.error).toBe('BULLETIN_NOT_FOUND')
  })

  it('valida fechas y enlaces (sin IPs ni http en anuncios; los enlaces siguen la regla del catálogo)', async () => {
    const r = await comu.post('/api/bulletins').send({ date: '28/09/2026', pdfUrl: 'http://10.0.0.1/b.pdf' })
    expect(r.status).toBe(400)
    expect(r.body.fields.map((f: { field: string }) => f.field).sort()).toEqual(['date', 'pdfUrl'])
    expect((await comu.post('/api/videos').send({ title: 'Sin dirección', url: '' })).body.fields[0].field).toBe('url')
    expect((await comu.post('/api/news').send({ title: 'x', date: '2026-09-28', html: '<b>' })).status).toBe(400)
  })

  it('una noticia en borrador no se ve; publicada sí, las más nuevas primero', async () => {
    const vieja = (await comu.post('/api/news').send({ title: 'Vieja', date: '2020-01-01', status: 'publicado' })).body
    const borrador = (await comu.post('/api/news').send({ title: 'Borrador', date: '2026-09-27' })).body
    const nueva = (await comu.post('/api/news').send({ title: 'Nueva', date: '2026-09-28', status: 'publicado', type: 'tip', summary: '  ' })).body
    expect(nueva).toMatchObject({ type: 'tip', summary: null, status: 'publicado' })
    const ids = (await anonymous().get('/api/news')).body.map((n: { id: number }) => n.id)
    expect(ids).not.toContain(borrador.id)
    expect(ids.indexOf(nueva.id)).toBeLessThan(ids.indexOf(vieja.id))
  })

  it('los videos salen primero los instructivos', async () => {
    await comu.post('/api/videos').send({ title: 'Otro', url: 'https://www.youtube.com/watch?v=abc', category: 'otro' })
    await comu.post('/api/videos').send({ title: 'Instructivo', url: '/sitio/parte1.mp4', category: 'instructivo' })
    const lista = (await anonymous().get('/api/videos')).body as { category: string }[]
    expect(lista[0].category).toBe('instructivo')
  })
})

describe('secciones del Inicio', () => {
  it('Comunicación edita una sección y el resto del contenido queda igual', async () => {
    const enlaces = [
      { t: 'Gaceta Oficial', g: '▤', h: 'https://www.gacetaoficial.gob.pa' },
      { t: 'Sin enlace todavía', h: '' },
    ]
    const r = await comu.put('/api/home/content/enlaces').send({ value: enlaces })
    expect(r.status).toBe(200)
    await comu.put('/api/home/content/intro').send({ value: 'Bienvenida de prueba' })
    const contenido = (await anonymous().get('/api/home/content')).body
    expect(contenido.enlaces).toEqual([enlaces[0], { t: 'Sin enlace todavía', h: null }])
    expect(contenido.intro).toBe('Bienvenida de prueba')
  })

  it('valida cada sección; sin el rol 403; una sección que no se edita no existe', async () => {
    expect((await ana.put('/api/home/content/intro').send({ value: 'x' })).status).toBe(403)
    const ip = await comu.put('/api/home/content/enlaces').send({ value: [{ t: 'IP', h: 'http://10.0.0.1' }] })
    expect(ip.status).toBe(400)
    expect(ip.body.fields[0].field).toBe('value.0.h')
    expect((await comu.put('/api/home/content/frecuentes').send({ value: { items: [{ t: '' }] } })).status).toBe(400)
    // Beneficios e indicadores ya no son bloques del Inicio.
    expect((await comu.put('/api/home/content/beneficios').send({ value: { items: [] } })).status).toBe(404)
    expect((await comu.put('/api/home/content/indicadores').send({ value: [] })).status).toBe(404)
  })
})
