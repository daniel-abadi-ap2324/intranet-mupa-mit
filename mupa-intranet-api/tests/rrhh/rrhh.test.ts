/**
 * RRHH Express dentro de la intranet, contra un RH Link falso (tests/rrhh/fake-rhlink.ts)
 * en el puerto de RRHH_API_URL. Personas y cédulas ficticias.
 */
import { createHash } from 'node:crypto'

import { eq } from 'drizzle-orm'
import request from 'supertest'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { app } from '../../src/app.ts'
import { db } from '../../src/config/database.ts'
import { rrhhConnections, rrhhGuestConnections, sessions } from '../../src/database/schema/index.ts'
import { CEDULA_PURPOSE } from '../../src/features/auth/auth.service.ts'
import { connectLimiter } from '../../src/features/rrhh/rrhh.limiter.ts'
import { eventBus } from '../../src/shared/services/event-bus.service.ts'
import { tokenService } from '../../src/shared/services/token.service.ts'
import { PASSWORD, anonymous, createUser, loginAs } from '../helpers.ts'
import { startFakeRhLink, type FakeEmployee, type FakeRhLink } from './fake-rhlink.ts'

let rh: FakeRhLink
let logs: string[] = []

beforeEach(async () => {
  connectLimiter.reset()
  await db.delete(rrhhGuestConnections)
})

beforeAll(async () => {
  rh = await startFakeRhLink({ url: process.env.RRHH_API_URL! })
  for (const level of ['error', 'warn'] as const) vi.spyOn(console, level).mockImplementation((...a: unknown[]) => void logs.push(a.map(String).join(' ')))
})
afterAll(() => rh.close())

let n = 0
/** Funcionario ficticio en RH Link y una persona de la intranet con sesión iniciada. */
async function conPersona(extra: Partial<FakeEmployee> = {}) {
  n++
  const empleado = rh.addEmployee({ cedula: `8-000-${100 + n}`, password: `clave-rrhh-${n}`, nombre: `Persona Ficticia ${n}`, ...extra })
  const user = await createUser(`rrhh${n}@ejemplo.test`, ['funcionario'])
  const agent = await loginAs(user.email!)
  return { empleado, user, agent }
}
async function conectada(extra: Partial<FakeEmployee> = {}) {
  const p = await conPersona(extra)
  const r = await p.agent.post('/api/rrhh/conexion').send({ cedula: p.empleado.cedula, password: p.empleado.password })
  expect(r.status).toBe(200)
  return p
}

// Nunca en los logs: contraseñas, cédulas ni tokens de RH Link.
afterEach(() => {
  for (const line of logs) {
    expect(line).not.toMatch(/clave-rrhh-|8-000-\d|eyJ/)
  }
  logs = []
})

describe('conectar la cuenta de RRHH Express', () => {
  it('sin sesión: dice si está disponible; lo demás pide sesión o conexión de invitado (401)', async () => {
    expect((await anonymous().get('/api/rrhh/conexion')).body).toEqual({ available: true, connected: false, knownCedula: false, guest: false, name: null, expiresAt: null })
    expect((await anonymous().get('/api/rrhh/expediente')).status).toBe(401)
      })

  it('sin conectar: disponible y desconectada', async () => {
    const { agent } = await conPersona()
    const r = await agent.get('/api/rrhh/conexion')
    expect(r.status).toBe(200)
    expect(r.body).toEqual({ available: true, connected: false, knownCedula: false, guest: false, name: null, expiresAt: null })
  })

  it('con las credenciales buenas queda conectada; se guarda solo el token cifrado', async () => {
    const { agent, empleado, user } = await conPersona()
    const r = await agent.post('/api/rrhh/conexion').send({ cedula: empleado.cedula, password: empleado.password })
    expect(r.status).toBe(200)
    expect(r.body).toMatchObject({ available: true, connected: true, name: empleado.nombre })
    expect(JSON.stringify(r.body)).not.toContain(empleado.cedula)

    const [row] = await db.select().from(rrhhConnections).where(eq(rrhhConnections.userId, user.id))
    expect(row).toBeDefined()
    // Ni el token en claro (un JWT empieza con eyJ), ni la cédula, ni la contraseña.
    expect(row.token).not.toMatch(/^eyJ/)
    expect(row.token).not.toContain(empleado.cedula)
    expect(row.token).not.toContain(empleado.password)
    expect((await agent.get('/api/rrhh/conexion')).body.connected).toBe(true)
  })

  it('con la contraseña mala: 401 RRHH_CREDENCIALES y no se guarda nada', async () => {
    const { agent, empleado, user } = await conPersona()
    const r = await agent.post('/api/rrhh/conexion').send({ cedula: empleado.cedula, password: 'otra' })
    expect(r.status).toBe(401)
    expect(r.body.error).toBe('RRHH_CREDENCIALES')
    expect(await db.select().from(rrhhConnections).where(eq(rrhhConnections.userId, user.id))).toHaveLength(0)
  })

  it('cédula con formato inválido: 400', async () => {
    const { agent } = await conPersona()
    const r = await agent.post('/api/rrhh/conexion').send({ cedula: '8000100', password: 'x' })
    expect(r.status).toBe(400)
    expect(r.body.fields.map((f: { field: string }) => f.field)).toContain('cedula')
  })

  it('RH Link caído: 503 RRHH_UNAVAILABLE', async () => {
    const { agent, empleado } = await conPersona()
    rh.failNext('drop')
    const r = await agent.post('/api/rrhh/conexion').send({ cedula: empleado.cedula, password: empleado.password })
    expect(r.status).toBe(503)
    expect(r.body.error).toBe('RRHH_UNAVAILABLE')
  })

  it('RH Link responde HTML (proxy mal configurado): 502', async () => {
    const { agent, empleado } = await conPersona()
    rh.failNext({ status: 200, body: '<html></html>', contentType: 'text/html' })
    const r = await agent.post('/api/rrhh/conexion').send({ cedula: empleado.cedula, password: empleado.password })
    expect(r.status).toBe(502)
  })

  it('limita los intentos: al sexto en 15 minutos, 429', async () => {
    const { agent, empleado } = await conPersona()
    for (let i = 0; i < 5; i++) await agent.post('/api/rrhh/conexion').send({ cedula: empleado.cedula, password: 'mala' })
    const r = await agent.post('/api/rrhh/conexion').send({ cedula: empleado.cedula, password: empleado.password })
    expect(r.status).toBe(429)
  })

  it('desconectar borra la conexión', async () => {
    const { agent, user } = await conectada()
    expect((await agent.delete('/api/rrhh/conexion')).status).toBe(204)
    expect(await db.select().from(rrhhConnections).where(eq(rrhhConnections.userId, user.id))).toHaveLength(0)
    expect((await agent.get('/api/rrhh/marcaciones?year=2026&month=9')).body.error).toBe('RRHH_DESCONECTADO')
  })

  it('al cerrar la sesión de la intranet desaparece la conexión', async () => {
    const { agent, user } = await conectada()
    await agent.post('/api/auth/logout')
    expect(await db.select().from(sessions).where(eq(sessions.userId, user.id))).toHaveLength(0)
    expect(await db.select().from(rrhhConnections).where(eq(rrhhConnections.userId, user.id))).toHaveLength(0)
  })

  it('va atada a la sesión: otra sesión de la misma persona no la ve', async () => {
    const { user } = await conectada()
    const otra = await loginAs(user.email!)
    expect((await otra.get('/api/rrhh/conexion')).body.connected).toBe(false)
  })

  it('una copia de la base no sirve sin la cookie: con otra cookie no se descifra', async () => {
    const { agent, user } = await conectada()
    const otra = await loginAs(user.email!)
    // Se mueve la conexión a la otra sesión: su cookie no descifra el token.
    const [s] = await db.select().from(sessions).where(eq(sessions.userId, user.id)).orderBy(sessions.id)
    const [s2] = (await db.select().from(sessions).where(eq(sessions.userId, user.id)).orderBy(sessions.id)).slice(-1)
    await db.update(rrhhConnections).set({ sessionId: s2.id }).where(eq(rrhhConnections.sessionId, s.id))
    const r = await otra.get('/api/rrhh/marcaciones?year=2026&month=9')
    expect(r.status).toBe(401)
    expect(r.body.error).toBe('RRHH_DESCONECTADO')
    expect((await agent.get('/api/rrhh/conexion')).body.connected).toBe(false)
  })

  it('con Bearer (otra app) no se puede conectar: 403 RRHH_SOLO_SESION', async () => {
    const { empleado } = await conPersona()
    // Sin Identity Central configurado, un Bearer no autentica: queda en 401 antes de llegar.
    const r = await anonymous().post('/api/rrhh/conexion').set('Authorization', 'Bearer x').send({ cedula: empleado.cedula, password: empleado.password })
    expect([401, 403]).toContain(r.status)
  })
})

describe('datos de la propia persona', () => {
  it('sin conectar: 401 RRHH_DESCONECTADO', async () => {
    const { agent } = await conPersona()
    const r = await agent.get('/api/rrhh/expediente')
    expect(r.status).toBe(401)
    expect(r.body.error).toBe('RRHH_DESCONECTADO')
  })

  it('marcaciones del mes: siempre con la cédula del token', async () => {
    const { agent, empleado } = await conectada()
    const r = await agent.get('/api/rrhh/marcaciones?year=2026&month=9&cedula=8-999-999')
    expect(r.status).toBe(200)
    expect(r.body.summary).toEqual({ present: 1, late: 1, absent: 0, daysOff: 0 })
    expect(r.body.days[1]).toMatchObject({ date: '2026-09-02', firstPunch: '08:20', late: '00:20' })
    expect(r.body.days[2]).toMatchObject({ status: 'FERIADO', holiday: 'Día ficticio' })
    const pedido = rh.requests.findLast((x) => x.path.startsWith('/api/marcaciones/'))!
    expect(pedido.path).toBe(`/api/marcaciones/${encodeURIComponent(empleado.cedula)}?anio=2026&mes=9`)
  })

  it('mes inválido: 400', async () => {
    const { agent } = await conectada()
    expect((await agent.get('/api/rrhh/marcaciones?year=2026&month=13')).status).toBe(400)
  })

  it('comprobantes: historial con la cuenta enmascarada y sin la cédula', async () => {
    const { agent, empleado } = await conectada()
    const r = await agent.get('/api/rrhh/comprobantes')
    expect(r.status).toBe(200)
    expect(r.body).toMatchObject({ page: 1, pages: 1, total: 2 })
    expect(r.body.items[0]).toMatchObject({
      payroll: 902,
      date: '2026-09-30',
      period: { year: 2026, month: 9, half: 2 },
      gross: 1000,
      net: 852,
      bank: '71',
      account: '••••7890',
      deductions: { socialSecurity: 97.5, educationInsurance: 12.5, incomeTax: 10, total: 148 },
    })
    const texto = JSON.stringify(r.body)
    expect(texto).not.toContain(empleado.cedula)
    expect(texto).not.toContain('0401234567890')
    expect(texto).not.toContain('123456789')
  })

  it('resumen del año y detalle de un pago', async () => {
    const { agent } = await conectada()
    const año = await agent.get('/api/rrhh/comprobantes/resumen/2026')
    expect(año.body.totals).toEqual({ gross: 2000, deductions: 296, net: 1704 })
    expect(año.body.items).toHaveLength(2)
    const det = await agent.get('/api/rrhh/comprobantes/detalle?payroll=902')
    expect(det.body).toEqual({ payroll: 902, lines: [{ code: '120-000123', type: '01', amount: 20, balance: 180 }] })
    const no = await agent.get('/api/rrhh/comprobantes/detalle?payroll=404')
    expect(no.status).toBe(404)
    expect(no.body.message).toMatch(/No se encontraron/)
  })

  it('expediente: sin la cédula propia, sin el dato médico y con los dependientes enmascarados', async () => {
    const { agent, empleado } = await conectada()
    const r = await agent.get('/api/rrhh/expediente')
    expect(r.status).toBe(200)
    expect(r.body.job).toMatchObject({ jobTitle: 'Analista de prueba', department: 'Dirección de Prueba', startDate: '2015-03-01', positionNumber: 1234 })
    expect(r.body.personal.socialSecurity).toBe('•••789')
    expect(r.body.dependents[0]).toMatchObject({ name: 'Hijo Ficticio', idNumber: '•••999', primary: true })
    const texto = JSON.stringify(r.body)
    expect(texto).not.toContain(empleado.cedula)
    expect(texto).not.toContain('8-000-999')
    expect(texto).not.toContain('DATO MEDICO')
  })

  it('si RH Link ya no acepta el token: 401 RRHH_DESCONECTADO y se borra la conexión', async () => {
    const { agent, user } = await conectada()
    rh.revokeAll()
    const r = await agent.get('/api/rrhh/expediente')
    expect(r.status).toBe(401)
    expect(r.body.error).toBe('RRHH_DESCONECTADO')
    expect(await db.select().from(rrhhConnections).where(eq(rrhhConnections.userId, user.id))).toHaveLength(0)
  })

  it('si la conexión venció: 401 y se borra', async () => {
    const { agent, user } = await conectada()
    await db.update(rrhhConnections).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(rrhhConnections.userId, user.id))
    expect((await agent.get('/api/rrhh/compensatorio')).body.error).toBe('RRHH_DESCONECTADO')
    expect(await db.select().from(rrhhConnections).where(eq(rrhhConnections.userId, user.id))).toHaveLength(0)
  })
})

describe('tiempo compensatorio', () => {
  it('saldo, vencimientos y solicitudes', async () => {
    const { agent } = await conectada({ saldoMin: 240 })
    const r = await agent.get('/api/rrhh/compensatorio')
    expect(r.status).toBe(200)
    expect(r.body).toMatchObject({ workdayMinutes: 480, totalAvailable: 240, balances: { after: { available: 240, used: 30 } }, requests: [] })
    expect(r.body.expiring[0]).toMatchObject({ type: 'DESPUES', date: '2027-01-15', minutes: 240 })
  })

  it('días que se pueden reclamar', async () => {
    const { agent } = await conectada()
    const r = await agent.get('/api/rrhh/compensatorio/candidatos?from=2026-09-01&to=2026-09-30')
    expect(r.body).toEqual([{ date: '2026-09-10', type: 'DESPUES', minutes: 45 }])
    expect(rh.requests.findLast((x) => x.path.includes('/candidatos/'))!.path).toMatch(/\?desde=2026-09-01&hasta=2026-09-30$/)
  })

  it('pedir acreditación manda la cédula del token', async () => {
    const { agent, empleado } = await conectada()
    const r = await agent.post('/api/rrhh/compensatorio/acreditacion').send({ type: 'DESPUES', workedDate: '2026-09-10', reason: 'Cierre de mes' })
    expect(r.status).toBe(201)
    expect(r.body).toMatchObject({ minutes: 45 })
    expect(rh.requests.findLast((x) => x.path.endsWith('/acreditacion'))!.body).toMatchObject({ cedula: empleado.cedula, tipo: 'DESPUES', fecha_trabajada: '2026-09-10' })
  })

  it('usar horas: se pasan a minutos; sin saldo, 409 con el mensaje de RH Link', async () => {
    const { agent } = await conectada({ saldoMin: 120 })
    const ok = await agent.post('/api/rrhh/compensatorio/uso').send({ type: 'DESPUES', unit: 'HORAS', amount: 1.5, from: '2026-10-05' })
    expect(ok.status).toBe(201)
    expect(rh.requests.findLast((x) => x.path.endsWith('/uso'))!.body).toMatchObject({ unidad: 'HORAS', minutos: 90, fecha_hasta: '2026-10-05' })
    const no = await agent.post('/api/rrhh/compensatorio/uso').send({ type: 'DESPUES', unit: 'DIAS', amount: 1, from: '2026-10-06' })
    expect(no.status).toBe(409)
    expect(no.body).toMatchObject({ error: 'RRHH_RECHAZADO' })
    expect(no.body.message).toMatch(/Saldo insuficiente/)
  })

  it('fechas al revés: 400', async () => {
    const { agent } = await conectada()
    const r = await agent.post('/api/rrhh/compensatorio/uso').send({ type: 'DESPUES', unit: 'DIAS', amount: 1, from: '2026-10-06', to: '2026-10-01' })
    expect(r.status).toBe(400)
  })

  it('cancelar la propia solicitud; la de otra persona no', async () => {
    const a = await conectada({ saldoMin: 600 })
    const b = await conectada()
    const creada = await a.agent.post('/api/rrhh/compensatorio/uso').send({ type: 'DESPUES', unit: 'HORAS', amount: 1, from: '2026-10-07' })
    // RH Link responde 403 a la de otra cédula: se rechaza, pero b sigue conectada.
    const ajena = await b.agent.patch(`/api/rrhh/compensatorio/solicitudes/${creada.body.id}/cancelar`)
    expect(ajena.status).toBe(403)
    expect(ajena.body.error).toBe('RRHH_RECHAZADO')
    expect((await b.agent.get('/api/rrhh/conexion')).body.connected).toBe(true)
    expect((await a.agent.patch(`/api/rrhh/compensatorio/solicitudes/${creada.body.id}/cancelar`)).status).toBe(204)
    const lista = await a.agent.get('/api/rrhh/compensatorio')
    expect(lista.body.requests.find((s: { id: number }) => s.id === creada.body.id).status).toBe('CANCELADA')
  })
})

// ---------- Sin sesión (invitado) y con la cédula ya conocida ----------

const empleado = () => {
  n++
  return rh.addEmployee({ cedula: `8-001-${200 + n}`, password: `cargo-${n}`, nombre: `Persona Invitada ${n}` })
}
const cookieValue = (r: request.Response, name: string) => {
  const raw = (r.headers['set-cookie'] as unknown as string[] | undefined)?.find((c) => c.startsWith(`${name}=`))
  return raw?.split(';')[0].slice(name.length + 1)
}
const sha = (s: string) => createHash('sha256').update(s).digest('hex')
const guestRows = () => db.select().from(rrhhGuestConnections)

/** Cuenta de la intranet cuya sesión ya conoce la cédula (como si hubiera entrado con Identity Central). */
async function conCedulaConocida(cedula: string) {
  const user = await createUser(`conocida${++n}@ejemplo.test`, ['funcionario'])
  const agent = request.agent(app)
  const r = await agent.post('/api/auth/login').send({ username: user.email, password: PASSWORD })
  const cookie = cookieValue(r, 'mupa_sesion')!
  await db
    .update(sessions)
    .set({ cedula: tokenService.encrypt(cedula, cookie, CEDULA_PURPOSE) })
    .where(eq(sessions.tokenHash, sha(cookie)))
  return { agent, user }
}

describe('con sesión que conoce la cédula: solo el número de cargo', () => {
  it('el estado avisa knownCedula y conectar usa la cédula de la sesión', async () => {
    const e = empleado()
    const { agent } = await conCedulaConocida(e.cedula)
    expect((await agent.get('/api/rrhh/conexion')).body).toMatchObject({ available: true, connected: false, knownCedula: true, guest: false })
    const r = await agent.post('/api/rrhh/conexion').send({ password: e.password })
    expect(r.status).toBe(200)
    expect(r.body).toMatchObject({ connected: true, knownCedula: true, guest: false, name: e.nombre })
    expect(JSON.stringify(r.body)).not.toContain(e.cedula)
    expect(rh.requests.findLast((x) => x.path === '/api/auth/login-cedula')!.body.cedula).toBe(e.cedula)
    expect((await agent.get('/api/rrhh/marcaciones?year=2026&month=9')).status).toBe(200)
    expect(await guestRows()).toHaveLength(0)
  })

  it('si el cuerpo trae una cédula (la suya o la de otra persona): 400 y no se llama a RH Link', async () => {
    const e = empleado()
    const otro = empleado()
    const { agent } = await conCedulaConocida(e.cedula)
    const antes = rh.requests.length
    for (const cedula of [e.cedula, otro.cedula]) {
      const r = await agent.post('/api/rrhh/conexion').send({ cedula, password: otro.password })
      expect(r.status).toBe(400)
      expect(r.body.error).toBe('RRHH_CEDULA_CONOCIDA')
    }
    expect(rh.requests.length).toBe(antes)
  })

  it('el número de cargo malo: 401 y el mismo mensaje que con una cédula que no existe', async () => {
    const e = empleado()
    const { agent } = await conCedulaConocida(e.cedula)
    const mala = await agent.post('/api/rrhh/conexion').send({ password: 'no-es' })
    const inexistente = await request(app).post('/api/rrhh/conexion').send({ cedula: '8-009-999', password: 'no-es' })
    expect(mala.status).toBe(401)
    expect(mala.body.error).toBe('RRHH_CREDENCIALES')
    expect(inexistente.body).toEqual(mala.body)
  })

  it('con sesión sin cédula conocida (cuenta de prueba) la cédula sigue siendo obligatoria', async () => {
    const user = await createUser(`local${++n}@ejemplo.test`, ['funcionario'])
    const agent = request.agent(app)
    await agent.post('/api/auth/login').send({ username: user.email, password: PASSWORD })
    expect((await agent.get('/api/rrhh/conexion')).body.knownCedula).toBe(false)
    const r = await agent.post('/api/rrhh/conexion').send({ password: 'x' })
    expect(r.status).toBe(400)
    expect(r.body.error).toBe('RRHH_CEDULA_REQUERIDA')
    const e = empleado()
    expect((await agent.post('/api/rrhh/conexion').send({ cedula: e.cedula, password: e.password })).status).toBe(200)
  })

  it('la conexión de la sesión se borra al desconectar y no crea conexión de invitado', async () => {
    const e = empleado()
    const { agent, user } = await conCedulaConocida(e.cedula)
    await agent.post('/api/rrhh/conexion').send({ password: e.password })
    expect(await db.select().from(rrhhConnections).where(eq(rrhhConnections.userId, user.id))).toHaveLength(1)
    expect((await agent.delete('/api/rrhh/conexion')).status).toBe(204)
    expect(await db.select().from(rrhhConnections).where(eq(rrhhConnections.userId, user.id))).toHaveLength(0)
  })
})

describe('sin sesión: conexión de invitado', () => {
  it('conecta con cédula y número de cargo: cookie propia y solo el token cifrado en la base', async () => {
    const e = empleado()
    const agent = request.agent(app)
    const r = await agent.post('/api/rrhh/conexion').send({ cedula: e.cedula, password: e.password })
    expect(r.status).toBe(200)
    expect(r.body).toMatchObject({ available: true, connected: true, guest: true, knownCedula: false, name: e.nombre })
    expect(JSON.stringify(r.body)).not.toContain(e.cedula)
    const setCookie = (r.headers['set-cookie'] as unknown as string[]).find((c) => c.startsWith('mupa_invitado='))!
    expect(setCookie).toMatch(/HttpOnly/i)
    expect(setCookie).toMatch(/SameSite=Lax/i)
    expect(setCookie).toMatch(/Path=\/api\/rrhh/)
    expect(setCookie).not.toContain(e.cedula)

    const cookie = cookieValue(r, 'mupa_invitado')!
    const [row] = await guestRows()
    expect(row.id).toBe(sha(cookie))
    for (const dato of [e.cedula, e.password, cookie]) expect(JSON.stringify(row)).not.toContain(dato)
    expect(row.token).not.toMatch(/^eyJ/)
    // Vence en minutos, no en las ~8 horas del token de RH Link.
    expect(row.expiresAt.getTime() - Date.now()).toBeLessThanOrEqual(30 * 60_000)

    expect((await agent.get('/api/rrhh/conexion')).body).toMatchObject({ connected: true, guest: true })
  })

  it('con la conexión de invitado se ven los datos propios y la cédula sale del token', async () => {
    const e = empleado()
    const agent = request.agent(app)
    await agent.post('/api/rrhh/conexion').send({ cedula: e.cedula, password: e.password })
    const m = await agent.get('/api/rrhh/marcaciones?year=2026&month=9&cedula=8-999-999')
    expect(m.status).toBe(200)
    expect(rh.requests.findLast((x) => x.path.startsWith('/api/marcaciones/'))!.path).toContain(encodeURIComponent(e.cedula))
    expect((await agent.get('/api/rrhh/comprobantes')).status).toBe(200)
    expect((await agent.get('/api/rrhh/compensatorio')).status).toBe(200)
    expect((await agent.get('/api/rrhh/expediente')).status).toBe(200)
  })

  it('dos invitados a la vez no ven los datos del otro', async () => {
    const a = empleado()
    const b = empleado()
    const ga = request.agent(app)
    const gb = request.agent(app)
    await ga.post('/api/rrhh/conexion').send({ cedula: a.cedula, password: a.password })
    await gb.post('/api/rrhh/conexion').send({ cedula: b.cedula, password: b.password })
    await ga.get('/api/rrhh/marcaciones?year=2026&month=9')
    expect(rh.requests.findLast((x) => x.path.startsWith('/api/marcaciones/'))!.path).toContain(encodeURIComponent(a.cedula))
    await gb.get('/api/rrhh/marcaciones?year=2026&month=9')
    expect(rh.requests.findLast((x) => x.path.startsWith('/api/marcaciones/'))!.path).toContain(encodeURIComponent(b.cedula))
    expect((await ga.get('/api/rrhh/conexion')).body.name).toBe(a.nombre)
  })

  it('sin cédula: 400; sin ninguna conexión, las rutas piden sesión o invitado (401)', async () => {
    const r = await request(app).post('/api/rrhh/conexion').send({ password: 'x' })
    expect(r.status).toBe(400)
    for (const ruta of ['marcaciones?year=2026&month=9', 'comprobantes', 'compensatorio', 'expediente']) {
      const x = await request(app).get(`/api/rrhh/${ruta}`)
      expect(x.status).toBe(401)
      expect(x.body.error).toBe('AUTHENTICATION_REQUIRED')
    }
    expect((await request(app).post('/api/rrhh/compensatorio/uso').send({})).status).toBe(401)
  })

  it('una cookie inventada no abre nada: 401 RRHH_DESCONECTADO', async () => {
    const r = await request(app).get('/api/rrhh/expediente').set('Cookie', 'mupa_invitado=inventada')
    expect(r.status).toBe(401)
    expect(r.body.error).toBe('RRHH_DESCONECTADO')
  })

  it('desconectar borra la conexión y la cookie', async () => {
    const e = empleado()
    const agent = request.agent(app)
    await agent.post('/api/rrhh/conexion').send({ cedula: e.cedula, password: e.password })
    const d = await agent.delete('/api/rrhh/conexion')
    expect(d.status).toBe(204)
    expect(String(d.headers['set-cookie'])).toMatch(/mupa_invitado=;/)
    expect(await guestRows()).toHaveLength(0)
    expect((await agent.get('/api/rrhh/expediente')).status).toBe(401)
  })

  it('vence: pasados los minutos sin uso se borra y pide conectar de nuevo', async () => {
    const e = empleado()
    const agent = request.agent(app)
    await agent.post('/api/rrhh/conexion').send({ cedula: e.cedula, password: e.password })
    await db.update(rrhhGuestConnections).set({ expiresAt: new Date(Date.now() - 1000) })
    const r = await agent.get('/api/rrhh/marcaciones?year=2026&month=9')
    expect(r.status).toBe(401)
    expect(r.body.error).toBe('RRHH_DESCONECTADO')
    expect(await guestRows()).toHaveLength(0)
    expect((await agent.get('/api/rrhh/conexion')).body.connected).toBe(false)
  })

  it('cada uso la renueva, pero nunca pasa de 2 horas desde que se abrió', async () => {
    const e = empleado()
    const agent = request.agent(app)
    await agent.post('/api/rrhh/conexion').send({ cedula: e.cedula, password: e.password })
    await db.update(rrhhGuestConnections).set({ expiresAt: new Date(Date.now() + 60_000) })
    expect((await agent.get('/api/rrhh/expediente')).status).toBe(200)
    const [row] = await guestRows()
    expect(row.expiresAt.getTime() - Date.now()).toBeGreaterThan(25 * 60_000)

    await db.update(rrhhGuestConnections).set({ createdAt: new Date(Date.now() - 121 * 60_000) })
    expect((await agent.get('/api/rrhh/expediente')).body.error).toBe('RRHH_DESCONECTADO')
    expect(await guestRows()).toHaveLength(0)
  })

  it('al conectar se purgan las vencidas', async () => {
    const a = empleado()
    const b = empleado()
    await request.agent(app).post('/api/rrhh/conexion').send({ cedula: a.cedula, password: a.password })
    await db.update(rrhhGuestConnections).set({ expiresAt: new Date(Date.now() - 1000) })
    await request.agent(app).post('/api/rrhh/conexion').send({ cedula: b.cedula, password: b.password })
    expect(await guestRows()).toHaveLength(1)
  })

  it('avisa por el bus que alguien conectó, sin datos personales', async () => {
    const e = empleado()
    const vistos: unknown[] = []
    const off = eventBus.on('rrhh.conectado', (s) => void vistos.push(s.datos))
    await request(app).post('/api/rrhh/conexion').send({ cedula: e.cedula, password: e.password })
    await new Promise((r) => setTimeout(r, 30))
    off()
    expect(vistos).toEqual([{ tipo: 'invitado' }])
  })
})

describe('límite de intentos al conectar', () => {
  it('por cédula: 5 fallos en 15 minutos y el sexto intento, aunque sea correcto, da 429 (sin importar sesión ni cookie)', async () => {
    const e = empleado()
    for (let i = 0; i < 5; i++) {
      expect((await request(app).post('/api/rrhh/conexion').send({ cedula: e.cedula, password: 'mala' })).status).toBe(401)
    }
    const local = await createUser(`local${++n}@ejemplo.test`, ['funcionario'])
    const otro = { agent: request.agent(app) }
    await otro.agent.post('/api/auth/login').send({ username: local.email, password: PASSWORD })
    const r = await otro.agent.post('/api/rrhh/conexion').send({ cedula: e.cedula, password: e.password })
    expect(r.status).toBe(429)
    expect(r.body.error).toBe('RRHH_DEMASIADOS_INTENTOS')
    expect(JSON.stringify(r.body)).not.toContain(e.cedula)
    expect((await request(app).post('/api/rrhh/conexion').send({ cedula: e.cedula, password: e.password })).status).toBe(429)
  })

  it('por IP: 20 fallos con cédulas distintas y el siguiente da 429', async () => {
    for (let i = 0; i < 20; i++) {
      expect((await request(app).post('/api/rrhh/conexion').send({ cedula: `8-777-${100 + i}`, password: 'mala' })).status).toBe(401)
    }
    const e = empleado()
    const r = await request(app).post('/api/rrhh/conexion').send({ cedula: e.cedula, password: e.password })
    expect(r.status).toBe(429)
    expect(r.body.error).toBe('RRHH_DEMASIADOS_INTENTOS')
  })

  it('los aciertos y las caídas de RH Link no gastan cupo', async () => {
    const e = empleado()
    for (let i = 0; i < 6; i++) expect((await request(app).post('/api/rrhh/conexion').send({ cedula: e.cedula, password: e.password })).status).toBe(200)
    for (let i = 0; i < 6; i++) {
      rh.failNext('drop')
      expect((await request(app).post('/api/rrhh/conexion').send({ cedula: e.cedula, password: e.password })).status).toBe(503)
    }
    expect((await request(app).post('/api/rrhh/conexion').send({ cedula: e.cedula, password: e.password })).status).toBe(200)
  })

  it('la cédula no queda en claro en el límite', () => {
    const limiter = connectLimiter as unknown as { hits: Map<string, unknown> }
    connectLimiter.reserve('8-123-456', '10.0.0.1')
    expect([...limiter.hits.keys()].join(' ')).not.toContain('8-123-456')
  })
})
