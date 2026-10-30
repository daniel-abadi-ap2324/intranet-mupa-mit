/**
 * «Mis citas» (GET /api/clinic/appointments): la cédula sale de la sesión (la que la persona usó para entrar,
 * cifrada con su cookie) y las citas, de la API de la Clínica (falsa, con el contrato de su guía).
 * Personas y cédulas ficticias.
 */
import { eq } from 'drizzle-orm'
import request from 'supertest'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import { app } from '../../src/app.ts'
import { db } from '../../src/config/database.ts'
import { sessions } from '../../src/database/schema/index.ts'
import { createUser, PASSWORD } from '../helpers.ts'
import { startFakeIdentity, type FakeIdentity, type FakeUser } from '../identity/fake-identity.ts'
import { startFakeClinic, type FakeCita, type FakeClinic } from './fake-clinic.ts'

let central: FakeIdentity
let clinic: FakeClinic
let logs: string[] = []

beforeAll(async () => {
  central = await startFakeIdentity({ url: process.env.IDENTITY_URL!, clientId: process.env.IDENTITY_CLIENT_ID!, clientSecret: process.env.IDENTITY_CLIENT_SECRET! })
  clinic = await startFakeClinic({ url: process.env.CLINIC_API_URL!, apiKey: process.env.CLINIC_API_KEY! })
  for (const level of ['error', 'warn'] as const) vi.spyOn(console, level).mockImplementation((...a: unknown[]) => void logs.push(a.map(String).join(' ')))
})
afterAll(async () => {
  await central.close()
  await clinic.close()
})
// Lo que se registra en consola nunca lleva la llave de la Clínica ni una cédula.
afterEach(() => {
  for (const line of logs) {
    expect(line).not.toContain(process.env.CLINIC_API_KEY!)
    expect(line).not.toMatch(/\b8-\d{3}-\d{3,4}\b/)
  }
  logs = []
})

const cita = (id: number, fecha: string, estado: string, extra: Partial<FakeCita> = {}): FakeCita => ({
  id, fecha, hora: '09:30', tipo: 'CONSULTA', especialidad: 'Medicina general', medico: 'Dra. Ficticia', estado, asistio: estado === 'ATENDIDA', atendido: estado === 'ATENDIDA', cancelado: estado === 'CANCELADA', ...extra,
})

let n = 0
function persona(extra: Partial<FakeUser> = {}): FakeUser {
  n++
  return central.addUser({ username: `8-800-${String(n).padStart(3, '0')}`, password: `clave-${n}`, sub: crypto.randomUUID(), fullName: `Nombre${n} Apellido`, email: `c${n}@alcaldia.test`, ...extra })
}
async function entrar(u: Pick<FakeUser, 'username' | 'password'>) {
  const agent = request.agent(app)
  const r = await agent.post('/api/auth/login').send({ username: u.username, password: u.password })
  expect(r.status).toBe(200)
  return { agent, userId: r.body.id as number }
}

describe('GET /api/clinic/appointments', () => {
  it('sin sesión es 401', async () => {
    expect((await request(app).get('/api/clinic/appointments')).status).toBe(401)
  })

  it('trae las citas de la persona por la cédula con la que entró, con la llave en X-Api-Key', async () => {
    const u = persona()
    clinic.addPaciente(u.username, [cita(1, '2026-09-01', 'ATENDIDA'), cita(2, '2026-11-20', 'AGENDADA', { hora: null })])
    const { agent } = await entrar(u)
    const r = await agent.get('/api/clinic/appointments')
    expect(r.status).toBe(200)
    expect(r.body).toMatchObject({ available: true, knownCedula: true, patientFound: true, total: 2 })
    expect(r.body.appointments).toEqual([
      { id: '1', date: '2026-09-01', time: '09:30', type: 'CONSULTA', specialty: 'Medicina general', doctor: 'Dra. Ficticia', status: 'ATENDIDA', attended: true, cancelled: false },
      { id: '2', date: '2026-11-20', time: null, type: 'CONSULTA', specialty: 'Medicina general', doctor: 'Dra. Ficticia', status: 'AGENDADA', attended: false, cancelled: false },
    ])
    const consulta = clinic.requests.at(-1)!
    expect(consulta.path).toBe(`/recepcion/integracion/historial/${u.username}`)
    expect(consulta.key).toBe(process.env.CLINIC_API_KEY)
  })

  it('cada persona ve solo las suyas: la cédula nunca viene del navegador', async () => {
    const a = persona()
    const b = persona()
    clinic.addPaciente(a.username, [cita(10, '2026-10-10', 'AGENDADA')])
    clinic.addPaciente(b.username, [cita(20, '2026-10-11', 'AGENDADA'), cita(21, '2026-10-12', 'CANCELADA')])
    const ra = await (await entrar(a)).agent.get('/api/clinic/appointments')
    const rb = await (await entrar(b)).agent.get('/api/clinic/appointments')
    expect(ra.body.appointments.map((c: { id: string }) => c.id)).toEqual(['10'])
    expect(rb.body.appointments.map((c: { id: string }) => c.id)).toEqual(['20', '21'])
    expect(rb.body.appointments[1].cancelled).toBe(true)
    // Una cédula en la URL o en la consulta no cambia de quién son las citas.
    const intento = await (await entrar(a)).agent.get(`/api/clinic/appointments?cedula=${b.username}`)
    expect(intento.status).toBe(400)
  })

  it('pasa el rango desde/hasta a la Clínica y valida el formato', async () => {
    const u = persona()
    clinic.addPaciente(u.username, [cita(30, '2026-01-15', 'ATENDIDA'), cita(31, '2026-06-15', 'ATENDIDA')])
    const { agent } = await entrar(u)
    const r = await agent.get('/api/clinic/appointments?from=2026-03-01&to=2026-12-31')
    expect(r.body.appointments.map((c: { id: string }) => c.id)).toEqual(['31'])
    expect(clinic.requests.at(-1)!.query).toEqual({ desde: '2026-03-01', hasta: '2026-12-31' })
    expect((await agent.get('/api/clinic/appointments?from=ayer')).status).toBe(400)
  })

  it('quien no es paciente de la Clínica: sin citas y patientFound false', async () => {
    const { agent } = await entrar(persona())
    const r = await agent.get('/api/clinic/appointments')
    expect(r.body).toMatchObject({ available: true, knownCedula: true, patientFound: false, total: 0, appointments: [] })
  })

  it('entrando con el correo, la cédula sale del claim identity_number del token', async () => {
    const u = persona({ username: `correo${++n}@alcaldia.test`, identityNumber: '8-801-001' })
    clinic.addPaciente('8-801-001', [cita(40, '2026-10-01', 'EN_ESPERA')])
    const r = await (await entrar(u)).agent.get('/api/clinic/appointments')
    expect(r.body.knownCedula).toBe(true)
    expect(r.body.appointments.map((c: { id: string }) => c.id)).toEqual(['40'])
  })

  it('sin forma de saber la cédula (cuenta de prueba) no se consulta nada: knownCedula false', async () => {
    const local = await createUser('local-citas@prueba.test', ['funcionario'])
    const agent = request.agent(app)
    expect((await agent.post('/api/auth/login').send({ username: local.email, password: PASSWORD })).status).toBe(200)
    const consultas = clinic.requests.length
    const r = await agent.get('/api/clinic/appointments')
    expect(r.body).toEqual({ available: true, knownCedula: false, patientFound: false, total: 0, appointments: [] })
    expect(clinic.requests.length).toBe(consultas)
  })

  it('la cédula de la sesión está cifrada en la sesión y se va con ella (en users solo queda en la columna cedula, para administración)', async () => {
    const u = persona()
    const { agent, userId } = await entrar(u)
    const [fila] = await db.select().from(sessions).where(eq(sessions.userId, userId))
    expect(fila.cedula).toBeTruthy()
    expect(fila.cedula).not.toContain(u.username)
    const cuenta = await db.query.users.findFirst({ where: (t, { eq: igual }) => igual(t.id, userId) })
    expect(cuenta!.cedula).toBe(u.username)
    expect(JSON.stringify({ ...cuenta, cedula: null })).not.toContain(u.username)
    await agent.post('/api/auth/logout')
    expect(await db.select().from(sessions).where(eq(sessions.userId, userId))).toHaveLength(0)
  })

  it('si la Clínica no responde: 503 CLINIC_UNAVAILABLE; con error o formato raro: 502 CLINIC_ERROR', async () => {
    const { agent } = await entrar(persona())
    clinic.failNext('drop')
    const caida = await agent.get('/api/clinic/appointments')
    expect(caida.status).toBe(503)
    expect(caida.body.error).toBe('CLINIC_UNAVAILABLE')

    clinic.failNext({ status: 500, body: '{"success":false}' })
    expect((await agent.get('/api/clinic/appointments')).body.error).toBe('CLINIC_ERROR')
    clinic.failNext({ status: 200, body: '{"cosa":"rara"}' })
    expect((await agent.get('/api/clinic/appointments')).body.error).toBe('CLINIC_ERROR')
    clinic.failNext({ status: 401, body: '{"success":false}' })
    expect((await agent.get('/api/clinic/appointments')).body.error).toBe('CLINIC_ERROR')
    clinic.failNext({ status: 429, body: '{"success":false}' })
    expect((await agent.get('/api/clinic/appointments')).body.error).toBe('CLINIC_BUSY')
  })

  it('con un Bearer (otra app) no hay sesión donde esté la cédula: knownCedula false', async () => {
    const u = persona()
    clinic.addPaciente(u.username, [cita(50, '2026-10-01', 'AGENDADA')])
    const login = await request(app).post('/api/auth/login').send({ username: u.username, password: u.password })
    expect(login.status).toBe(200)
    const token = await central.sign({ sub: u.sub, client_id: 'intranet_prueba', app_id: 'intranet_prueba', app_role: 'User', iss: `${process.env.IDENTITY_URL}/` })
    const r = await request(app).get('/api/clinic/appointments').set('Authorization', `Bearer ${token}`)
    expect(r.status).toBe(200)
    expect(r.body.knownCedula).toBe(false)
  })
})
