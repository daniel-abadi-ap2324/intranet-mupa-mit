/**
 * Avisos en vivo por SSE: se prueba contra un servidor de verdad (app.listen) porque
 * supertest espera a que la respuesta termine, y un stream no termina.
 */
import http from 'node:http'
import type { AddressInfo } from 'node:net'

import request from 'supertest'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'

import { app } from '../src/app.ts'
import { MAX_POR_PERSONA } from '../src/features/notifications/notifications.constants.ts'
import { createUser, loginAs, PASSWORD } from './helpers.ts'
import { FORM_PRUEBA, RESPUESTAS_BIEN } from './solicitudes-fixture.ts'

type Stream = { status: number; headers: http.IncomingHttpHeaders; texto: () => string; cerrar: () => void }

let server: http.Server
let base: string
let slug: string
let prueba: string
const abiertos: Stream[] = []

async function cookieDe(email: string) {
  const r = await request(app).post('/api/auth/login').send({ username: email, password: PASSWORD })
  return (r.headers['set-cookie'] as unknown as string[]).map((c) => c.split(';')[0]).join('; ')
}

/** Abre el stream y resuelve al llegar las cabeceras; el texto se va acumulando. */
function abrir(cookie?: string): Promise<Stream> {
  return new Promise((resolve, reject) => {
    const req = http.get(base + '/api/notifications/stream', { headers: cookie ? { cookie } : {} }, (res) => {
      let texto = ''
      res.setEncoding('utf8')
      res.on('data', (c: string) => (texto += c))
      res.on('error', () => undefined)
      const s: Stream = { status: res.statusCode!, headers: res.headers, texto: () => texto, cerrar: () => req.destroy() }
      abiertos.push(s)
      resolve(s)
    })
    req.on('error', (err) => (err.message === 'socket hang up' ? undefined : reject(err)))
  })
}

async function esperar(condicion: () => boolean, ms = 2000, antes?: () => Promise<void>) {
  const hasta = Date.now() + ms
  while ((await antes?.(), !condicion())) {
    if (Date.now() > hasta) return false
    await new Promise((r) => setTimeout(r, 20))
  }
  return true
}

const mensajes = (s: Stream) =>
  s
    .texto()
    .split('\n\n')
    .filter((b) => b.startsWith('event: '))
    .map((b) => ({ evento: b.split('\n')[0].slice(7), datos: JSON.parse(b.split('\n')[1].slice(6)) }))

let admin: string
let gestor: string
let ana: string
let comunicacion: string
let anaAgente: Awaited<ReturnType<typeof loginAs>>
let adminAgente: Awaited<ReturnType<typeof loginAs>>

beforeAll(async () => {
  server = app.listen(0)
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  await createUser('admin-sse@prueba.test', ['admin'], 'Ada')
  await createUser('gestor-sse@prueba.test', ['gestorSolicitudes'], 'Gina')
  await createUser('ana-sse@prueba.test', ['funcionario'], 'Ana')
  await createUser('com-sse@prueba.test', ['comunicacion'], 'Coco')
  ;[admin, gestor, ana, comunicacion] = await Promise.all(
    ['admin-sse', 'gestor-sse', 'ana-sse', 'com-sse'].map((u) => cookieDe(u + '@prueba.test')),
  )
  anaAgente = await loginAs('ana-sse@prueba.test')
  adminAgente = await loginAs('admin-sse@prueba.test')
  const g = await loginAs('gestor-sse@prueba.test')
  slug = (await g.post('/api/forms').send(FORM_PRUEBA)).body.slug
  prueba = (await g.post('/api/forms').send({ ...FORM_PRUEBA, title: 'SSE de prueba', accepting: false })).body.slug
})

afterEach(async () => {
  abiertos.splice(0).forEach((s) => s.cerrar())
  await new Promise((r) => setTimeout(r, 30)) // que el servidor vea el cierre y desconecte
})

afterAll(() => new Promise<void>((r) => server.close(() => r())))

describe('notificaciones en vivo (SSE)', () => {
  it('sin sesión 401; funcionario 403, en JSON y sin abrir el stream', async () => {
    expect((await abrir()).status).toBe(401)
    const s = await abrir(ana)
    expect(s.status).toBe(403)
    expect(s.headers['content-type']).toContain('application/json')
  })

  it('abre un stream de eventos que nginx no guarda en su buffer', async () => {
    const s = await abrir(gestor)
    expect(s.status).toBe(200)
    expect(s.headers['content-type']).toContain('text/event-stream')
    expect(s.headers['x-accel-buffering']).toBe('no')
    expect(s.headers['cache-control']).toBe('no-cache, no-transform')
    expect(await esperar(() => s.texto().includes('retry: 5000'))).toBe(true)
  })

  it('admin y gestor reciben la solicitud que envía otra persona, con folio y formulario', async () => {
    const [sa, sg] = await Promise.all([abrir(admin), abrir(gestor)])
    const r = await anaAgente.post('/api/requests').send({ form: slug, respuestas: RESPUESTAS_BIEN })
    expect(r.status).toBe(201)
    for (const s of [sa, sg]) {
      expect(await esperar(() => mensajes(s).length > 0)).toBe(true)
      const [m] = mensajes(s)
      expect(m.evento).toBe('solicitud.creada')
      expect(m.datos).toMatchObject({ id: r.body.id, folio: r.body.folio, formulario: 'Solicitud de equipo', solicitante: 'Ana' })
      expect(JSON.stringify(m.datos)).not.toContain('Otro nombre')
    }
    // La auditoría cuenta las dos entregas.
    let entregas = 0
    await esperar(() => entregas === 2, 2000, async () => {
      const [fila] = (await adminAgente.get('/api/audit/events').query({ subject: 'request:' + r.body.id })).body
      entregas = fila?.deliveredCount ?? 0
    })
    expect(entregas).toBe(2)
  })

  it('quien envía no se avisa a sí mismo', async () => {
    const [sa, sg] = await Promise.all([abrir(admin), abrir(gestor)])
    expect((await adminAgente.post('/api/requests').send({ form: slug, respuestas: RESPUESTAS_BIEN })).status).toBe(201)
    expect(await esperar(() => mensajes(sg).length > 0)).toBe(true)
    expect(mensajes(sa)).toEqual([])
  })

  it('un envío de prueba (409) no avisa a nadie', async () => {
    const s = await abrir(gestor)
    expect((await anaAgente.post('/api/requests').send({ form: prueba, respuestas: RESPUESTAS_BIEN })).status).toBe(409)
    await new Promise((r) => setTimeout(r, 150))
    expect(mensajes(s)).toEqual([])
  })

  it(`la conexión ${MAX_POR_PERSONA + 1} de la misma persona da 429; al cerrar una, vuelve a entrar`, async () => {
    const streams = await Promise.all(Array.from({ length: MAX_POR_PERSONA }, () => abrir(gestor)))
    expect(streams.every((s) => s.status === 200)).toBe(true)
    expect((await abrir(gestor)).status).toBe(429)
    expect((await abrir(admin)).status).toBe(200) // el límite es por persona
    streams[0].cerrar()
    await new Promise((r) => setTimeout(r, 50))
    expect((await abrir(gestor)).status).toBe(200)
  })
})

describe('campana de admin y Gestor (GET /api/notifications)', () => {
  it('sin sesión 401; funcionario 403; Comunicación también atiende solicitudes (hoy todos los gestores)', async () => {
    expect((await request(app).get('/api/notifications')).status).toBe(401)
    expect((await request(app).get('/api/notifications').set('Cookie', ana)).status).toBe(403)
    expect((await request(app).get('/api/notifications').set('Cookie', comunicacion)).status).toBe(200)
  })

  it('lista las solicitudes recibidas sin atender, de la más nueva a la más vieja; al atenderla deja de salir', async () => {
    const primera = (await anaAgente.post('/api/requests').send({ form: slug, respuestas: RESPUESTAS_BIEN })).body
    const segunda = (await anaAgente.post('/api/requests').send({ form: slug, respuestas: RESPUESTAS_BIEN })).body
    const g = await loginAs('gestor-sse@prueba.test')

    const antes = (await g.get('/api/notifications')).body
    expect(antes.items[0]).toEqual({ id: segunda.id, folio: segunda.folio, formulario: 'Solicitud de equipo', area: expect.any(String), solicitante: 'Ana', fecha: expect.any(String) })
    expect(antes.items.map((n: { id: number }) => n.id)).toContain(primera.id)
    expect(antes.total).toBe(antes.items.length)
    expect(JSON.stringify(antes)).not.toContain('Otro nombre') // nada de las respuestas del formulario

    expect((await g.patch('/api/requests/' + segunda.id).send({ status: 'en_revision' })).status).toBe(200)
    const despues = (await g.get('/api/notifications')).body
    expect(despues.items.map((n: { id: number }) => n.id)).not.toContain(segunda.id)
    expect(despues.total).toBe(antes.total - 1)
  })
})
