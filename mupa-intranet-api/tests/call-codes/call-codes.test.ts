/**
 * Solicitudes de código de llamada (GET /api/call-codes/requests): la cédula sale de la sesión (la que la persona usó
 * para entrar, cifrada con su cookie) y las solicitudes, de la API de códigos de llamada (falsa, con el contrato de su
 * documentación). Personas y cédulas ficticias.
 */
import request from 'supertest'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import { app } from '../../src/app.ts'
import { createUser, PASSWORD } from '../helpers.ts'
import { startFakeIdentity, type FakeIdentity, type FakeUser } from '../identity/fake-identity.ts'
import { startFakeCallCodes, type FakeCallCodes, type FakeSolicitud } from './fake-callcode.ts'

let central: FakeIdentity
let codigos: FakeCallCodes
let logs: string[] = []

beforeAll(async () => {
  central = await startFakeIdentity({ url: process.env.IDENTITY_URL!, clientId: process.env.IDENTITY_CLIENT_ID!, clientSecret: process.env.IDENTITY_CLIENT_SECRET! })
  codigos = await startFakeCallCodes({ url: process.env.CALLCODE_API_URL!, apiKey: process.env.CALLCODE_API_KEY! })
  for (const level of ['error', 'warn'] as const) vi.spyOn(console, level).mockImplementation((...a: unknown[]) => void logs.push(a.map(String).join(' ')))
})
afterAll(async () => {
  await central.close()
  await codigos.close()
})
// Lo que se registra en consola nunca lleva la llave ni una cédula.
afterEach(() => {
  for (const line of logs) {
    expect(line).not.toContain(process.env.CALLCODE_API_KEY!)
    expect(line).not.toMatch(/\b8-\d{3}-\d{3,4}\b/)
  }
  logs = []
})

const solicitud = (requestNumber: number, statusId: number, status: string, extra: Partial<FakeSolicitud> = {}): FakeSolicitud => ({
  requestNumber,
  statusId,
  status,
  createdDate: '2026-09-15T10:32:00',
  lastModifiedDate: '2026-09-17T14:05:00',
  location: 'Dirección Ficticia',
  lineType: 'LOCALES',
  extension: '4521',
  rejectionReason: null,
  history: [{ action: 'CREATE', date: '2026-09-15T10:32:00' }],
  ...extra,
})

let n = 0
function persona(extra: Partial<FakeUser> = {}): FakeUser {
  n++
  return central.addUser({ username: `8-810-${String(n).padStart(3, '0')}`, password: `clave-${n}`, sub: crypto.randomUUID(), fullName: `Nombre${n} Apellido`, email: `k${n}@alcaldia.test`, ...extra })
}
async function entrar(u: Pick<FakeUser, 'username' | 'password'>) {
  const agent = request.agent(app)
  const r = await agent.post('/api/auth/login').send({ username: u.username, password: u.password })
  expect(r.status).toBe(200)
  return { agent, userId: r.body.id as number }
}

describe('GET /api/call-codes/requests', () => {
  it('sin sesión es 401', async () => {
    expect((await request(app).get('/api/call-codes/requests')).status).toBe(401)
  })

  it('trae las solicitudes de la persona por la cédula con la que entró (con guiones), con la llave en X-Api-Key', async () => {
    const u = persona()
    codigos.addPersona(u.username, [
      solicitud(125, 6, 'Procesado', { lineType: 'NACIONAL LDN', history: [{ action: 'CREATE', date: '2026-09-15T10:32:00' }, { action: 'PROCESS', date: '2026-09-17T14:05:00' }] }),
      solicitud(98, 5, 'Rechazado', { rejectionReason: 'Falta autorización del jefe inmediato.' }),
    ])
    const { agent } = await entrar(u)
    const r = await agent.get('/api/call-codes/requests')
    expect(r.status).toBe(200)
    expect(r.body).toMatchObject({ available: true, knownCedula: true, total: 2 })
    expect(r.body.requests[0]).toEqual({
      number: 125,
      statusId: 6,
      status: 'Procesado',
      createdAt: '2026-09-15T10:32:00',
      updatedAt: '2026-09-17T14:05:00',
      location: 'Dirección Ficticia',
      lineType: 'NACIONAL LDN',
      extension: '4521',
      rejectionReason: null,
      history: [{ action: 'CREATE', date: '2026-09-15T10:32:00' }, { action: 'PROCESS', date: '2026-09-17T14:05:00' }],
    })
    expect(r.body.requests[1]).toMatchObject({ number: 98, statusId: 5, rejectionReason: 'Falta autorización del jefe inmediato.' })
    const consulta = codigos.requests.at(-1)!
    expect(consulta.path).toBe('/api/external/pin-requests')
    expect(consulta.query).toEqual({ identityNumber: u.username })
    expect(consulta.key).toBe(process.env.CALLCODE_API_KEY)
  })

  it('el motivo de rechazo solo se muestra en las rechazadas', async () => {
    const u = persona()
    codigos.addPersona(u.username, [solicitud(1, 1, 'Pendiente de Aprobación por Director', { rejectionReason: 'texto suelto' })])
    const r = await (await entrar(u)).agent.get('/api/call-codes/requests')
    expect(r.body.requests[0].rejectionReason).toBeNull()
  })

  it('cada persona ve solo las suyas: la cédula nunca viene del navegador', async () => {
    const a = persona()
    const b = persona()
    codigos.addPersona(a.username, [solicitud(10, 1, 'Pendiente de Aprobación por Director')])
    codigos.addPersona(b.username, [solicitud(20, 4, 'Aprobado'), solicitud(21, 7, 'Anulado')])
    const ra = await (await entrar(a)).agent.get('/api/call-codes/requests')
    const rb = await (await entrar(b)).agent.get('/api/call-codes/requests')
    expect(ra.body.requests.map((s: { number: number }) => s.number)).toEqual([10])
    expect(rb.body.requests.map((s: { number: number }) => s.number)).toEqual([20, 21])
    // Una cédula en la consulta no cambia de quién son las solicitudes.
    expect((await (await entrar(a)).agent.get(`/api/call-codes/requests?identityNumber=${b.username}`)).status).toBe(400)
  })

  it('quien no tiene solicitudes: lista vacía', async () => {
    const r = await (await entrar(persona())).agent.get('/api/call-codes/requests')
    expect(r.body).toEqual({ available: true, knownCedula: true, total: 0, requests: [] })
  })

  it('entrando con el correo, la cédula sale del claim identity_number del token', async () => {
    const u = persona({ username: `correo${++n}@alcaldia.test`, identityNumber: '8-811-001' })
    codigos.addPersona('8-811-001', [solicitud(40, 2, 'Pendiente de Aprobación por Tecnología')])
    const r = await (await entrar(u)).agent.get('/api/call-codes/requests')
    expect(r.body.knownCedula).toBe(true)
    expect(r.body.requests.map((s: { number: number }) => s.number)).toEqual([40])
  })

  it('sin forma de saber la cédula (cuenta de prueba) no se consulta nada: knownCedula false', async () => {
    const local = await createUser('local-codigos@prueba.test', ['funcionario'])
    const agent = request.agent(app)
    expect((await agent.post('/api/auth/login').send({ username: local.email, password: PASSWORD })).status).toBe(200)
    const consultas = codigos.requests.length
    const r = await agent.get('/api/call-codes/requests')
    expect(r.body).toEqual({ available: true, knownCedula: false, total: 0, requests: [] })
    expect(codigos.requests.length).toBe(consultas)
  })

  it('si el sistema no responde: 503 CALLCODE_UNAVAILABLE; con error o formato raro: 502 CALLCODE_ERROR', async () => {
    const { agent } = await entrar(persona())
    codigos.failNext('drop')
    const caida = await agent.get('/api/call-codes/requests')
    expect(caida.status).toBe(503)
    expect(caida.body.error).toBe('CALLCODE_UNAVAILABLE')
    codigos.failNext({ status: 500, body: '{"statusCode":500,"data":null}' })
    expect((await agent.get('/api/call-codes/requests')).body.error).toBe('CALLCODE_ERROR')
    codigos.failNext({ status: 200, body: '{"algo":"raro"}' })
    expect((await agent.get('/api/call-codes/requests')).body.error).toBe('CALLCODE_ERROR')
    codigos.failNext({ status: 401, body: '{}' })
    expect((await agent.get('/api/call-codes/requests')).body.error).toBe('CALLCODE_ERROR')
    codigos.failNext({ status: 400, body: '{}' })
    expect((await agent.get('/api/call-codes/requests')).body.error).toBe('CALLCODE_REJECTED')
  })
})
