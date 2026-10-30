/**
 * Tickets de la Mesa de Ayuda (GET /api/glpi/tickets): la cédula sale de la sesión (la que la persona usó para entrar,
 * cifrada con su cookie); la persona se busca en un GLPI falso por esa cédula en el campo «Teléfono» de su usuario y se
 * traen los tickets donde es solicitante. Personas, cédulas y tickets ficticios.
 */
import request from 'supertest'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import { app } from '../../src/app.ts'
import { createUser, PASSWORD } from '../helpers.ts'
import { startFakeIdentity, type FakeIdentity, type FakeUser } from '../identity/fake-identity.ts'
import { startFakeGlpi, type FakeGlpi, type FakeTicket } from './fake-glpi.ts'

let central: FakeIdentity
let glpi: FakeGlpi
let logs: string[] = []

beforeAll(async () => {
  central = await startFakeIdentity({ url: process.env.IDENTITY_URL!, clientId: process.env.IDENTITY_CLIENT_ID!, clientSecret: process.env.IDENTITY_CLIENT_SECRET! })
  glpi = await startFakeGlpi({ url: process.env.GLPI_API_URL!, appToken: process.env.GLPI_APP_TOKEN!, login: process.env.GLPI_USER_ID!, password: process.env.GLPI_USER_PASS! })
  for (const level of ['error', 'warn'] as const) vi.spyOn(console, level).mockImplementation((...a: unknown[]) => void logs.push(a.map(String).join(' ')))
})
afterAll(async () => {
  await central.close()
  await glpi.close()
})
// Lo que se registra en consola nunca lleva las llaves, la contraseña ni una cédula; y cada sesión de GLPI se cierra.
afterEach(() => {
  for (const line of logs) {
    for (const secreto of [process.env.GLPI_APP_TOKEN!, process.env.GLPI_USER_PASS!]) expect(line).not.toContain(secreto)
    expect(line).not.toMatch(/\b8-\d{3}-\d{3,4}\b/)
  }
  logs = []
  expect(glpi.openSessions()).toBe(0)
})

let numero = 45000
const ticket = (requester: number, extra: Partial<FakeTicket> = {}): FakeTicket => ({
  id: ++numero,
  title: `Soporte – Dirección Ficticia (${numero})`,
  status: 1,
  date: '2026-10-01 09:30:00',
  date_mod: '2026-10-02 11:00:00',
  requester,
  content: 'Solicitante: Persona Ficticia, cédula 8-000-0000',
  ...extra,
})

let n = 0
function persona(extra: Partial<FakeUser> = {}): FakeUser {
  n++
  return central.addUser({ username: `8-820-${String(n).padStart(3, '0')}`, password: `clave-${n}`, sub: crypto.randomUUID(), fullName: `Nombre${n} Apellido`, email: `g${n}@alcaldia.test`, ...extra })
}
async function entrar(u: Pick<FakeUser, 'username' | 'password'>) {
  const agent = request.agent(app)
  const r = await agent.post('/api/auth/login').send({ username: u.username, password: u.password })
  expect(r.status).toBe(200)
  return agent
}

describe('GET /api/glpi/tickets', () => {
  it('sin sesión es 401', async () => {
    expect((await request(app).get('/api/glpi/tickets')).status).toBe(401)
  })

  it('busca a la persona por su cédula en «Teléfono» y trae sus tickets, sin la descripción', async () => {
    const u = persona()
    glpi.addUser(4100, u.username)
    glpi.addTicket(ticket(4100, { status: 6, date: '2026-09-01 08:00:00', date_mod: '2026-09-03 10:00:00' }))
    const nuevo = ticket(4100, { status: 2, date: '2026-10-05 14:20:00' })
    glpi.addTicket(nuevo)
    glpi.addTicket(ticket(9999))
    const r = await (await entrar(u)).get('/api/glpi/tickets')
    expect(r.status).toBe(200)
    expect(r.body).toMatchObject({ available: true, knownCedula: true, userFound: true, total: 2 })
    expect(r.body.tickets[0]).toEqual({ id: nuevo.id, title: nuevo.title, status: 2, openedAt: '2026-10-05 14:20:00', updatedAt: '2026-10-02 11:00:00' })
    expect(r.body.tickets[1].status).toBe(6)
    expect(JSON.stringify(r.body)).not.toContain('Solicitante:')
    // Nunca se pide la descripción (campo 21) y la sesión de GLPI se cerró.
    const busqueda = glpi.calls.find((c) => c.path.endsWith('/search/Ticket'))!
    expect(JSON.stringify(busqueda.query)).not.toContain('"21"')
    expect(glpi.killed.length).toBeGreaterThan(0)
  })

  it('si dos usuarios de GLPI tienen la misma cédula (cuentas repetidas), junta los tickets de los dos', async () => {
    const u = persona()
    glpi.addUser(4200, u.username)
    glpi.addUser(4201, u.username)
    glpi.addTicket(ticket(4200))
    glpi.addTicket(ticket(4201))
    const r = await (await entrar(u)).get('/api/glpi/tickets')
    expect(r.body.total).toBe(2)
  })

  it('si su cédula no está en «Teléfono» de ningún usuario: userFound false y sin tickets', async () => {
    const u = persona()
    glpi.addUser(4300, '8-820-9999')
    glpi.addTicket(ticket(4300))
    const r = await (await entrar(u)).get('/api/glpi/tickets')
    expect(r.body).toEqual({ available: true, knownCedula: true, userFound: false, total: 0, tickets: [] })
  })

  it('cada persona ve solo los suyos: la cédula nunca viene del navegador', async () => {
    const a = persona()
    const b = persona()
    glpi.addUser(4400, b.username)
    glpi.addTicket(ticket(4400))
    expect((await (await entrar(a)).get(`/api/glpi/tickets?cedula=${b.username}`)).status).toBe(400)
    expect((await (await entrar(a)).get('/api/glpi/tickets')).body.userFound).toBe(false)
  })

  it('entrando con el correo, la cédula sale del claim identity_number del token', async () => {
    const u = persona({ username: `correo-glpi${++n}@alcaldia.test`, identityNumber: '8-821-001' })
    glpi.addUser(4500, '8-821-001')
    glpi.addTicket(ticket(4500))
    const r = await (await entrar(u)).get('/api/glpi/tickets')
    expect(r.body).toMatchObject({ knownCedula: true, userFound: true, total: 1 })
  })

  it('sin forma de saber la cédula (cuenta de prueba) no se consulta nada: knownCedula false', async () => {
    const local = await createUser('local-glpi@prueba.test', ['funcionario'])
    const agent = request.agent(app)
    expect((await agent.post('/api/auth/login').send({ username: local.email, password: PASSWORD })).status).toBe(200)
    const antes = glpi.calls.length
    const r = await agent.get('/api/glpi/tickets')
    expect(r.body).toEqual({ available: true, knownCedula: false, userFound: false, total: 0, tickets: [] })
    expect(glpi.calls.length).toBe(antes)
  })

  it('si GLPI no responde: 503 GLPI_UNAVAILABLE; si rechaza la llave o la cuenta: 502 GLPI_ERROR', async () => {
    const agent = await entrar(persona())
    glpi.failNext('drop')
    const r1 = await agent.get('/api/glpi/tickets')
    expect(r1.status).toBe(503)
    expect(r1.body.error).toBe('GLPI_UNAVAILABLE')

    glpi.failNext({ status: 400, body: '["ERROR_WRONG_APP_TOKEN_PARAMETER",""]' })
    const r2 = await agent.get('/api/glpi/tickets')
    expect(r2.status).toBe(502)
    expect(r2.body.error).toBe('GLPI_ERROR')
    expect(logs.some((l) => l.includes('GLPI_APP_TOKEN'))).toBe(true)
  })
})
