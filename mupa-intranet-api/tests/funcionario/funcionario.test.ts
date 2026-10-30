/**
 * Entrar y registrarse exigen ser funcionario ACTIVO en RH Link (la API pregunta con su cuenta de AD:
 * GET empleados/cedula/:cedula). Identity Central falso + RH Link falso (vitest.config.ts, proyecto «funcionario»).
 * Personas y cédulas ficticias.
 */
import { eq } from 'drizzle-orm'
import request from 'supertest'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import { app } from '../../src/app.ts'
import { db } from '../../src/config/database.ts'
import { departments, sessions, users } from '../../src/database/schema/index.ts'
import { startFakeIdentity, type FakeIdentity, type FakeUser } from '../identity/fake-identity.ts'
import { startFakeRhLink, type FakeRhLink } from '../rrhh/fake-rhlink.ts'

let central: FakeIdentity
let rh: FakeRhLink
let logs: string[] = []
let departamentoRrhhId = 0
let otroRrhhId = 0

beforeAll(async () => {
  central = await startFakeIdentity({ url: process.env.IDENTITY_URL!, clientId: process.env.IDENTITY_CLIENT_ID!, clientSecret: process.env.IDENTITY_CLIENT_SECRET! })
  rh = await startFakeRhLink({ url: process.env.RRHH_API_URL!, adUser: process.env.RRHH_API_USER, adPassword: process.env.RRHH_API_PASSWORD })
  // Direcciones de la intranet con su código de RH Link (el seed trae las reales; aquí los de prueba).
  const [a, b] = await db.insert(departments).values([{ name: 'Dirección de prueba A', rrhhCode: 15607 }, { name: 'Dirección de prueba B', rrhhCode: 15608 }]).returning()
  departamentoRrhhId = a.id
  otroRrhhId = b.id
  for (const level of ['error', 'warn'] as const) vi.spyOn(console, level).mockImplementation((...a: unknown[]) => void logs.push(a.map(String).join(' ')))
})
afterAll(async () => {
  await central.close()
  await rh.close()
})
// Lo que se registra en consola nunca lleva la cédula ni la contraseña de la cuenta de la API.
afterEach(() => {
  for (const line of logs) {
    expect(line).not.toContain(process.env.RRHH_API_PASSWORD!)
    expect(line).not.toMatch(/\b8-\d{3}-\d{3,4}\b/)
  }
  logs = []
})

let n = 0
/** Persona ficticia en el central; su usuario es la cédula (como entra la gente). */
function persona(extra: Partial<FakeUser> = {}): FakeUser {
  n++
  const cedula = `8-700-${String(n).padStart(3, '0')}`
  return central.addUser({ username: cedula, password: `clave-${n}`, sub: crypto.randomUUID(), fullName: `Nombre${n} Apellido`, email: `p${n}@alcaldia.test`, ...extra })
}
const login = (u: Pick<FakeUser, 'username' | 'password'>) => request(app).post('/api/auth/login').send({ username: u.username, password: u.password })
const cuentas = async (sub: string) => db.select().from(users).where(eq(users.identitySub, sub))
const sesiones = async () => (await db.select().from(sessions)).length

describe('entrar (POST /api/auth/login)', () => {
  it('un funcionario ACTIVO en RH Link entra', async () => {
    const u = persona()
    rh.addFuncionario(u.username)
    const r = await login(u)
    expect(r.status).toBe(200)
    expect(r.body.email).toBe(u.email!.toLowerCase())
  })

  it('una cédula que no aparece en RH Link no entra: 403 NOT_FUNCIONARIO, sin cuenta ni sesión, y se revoca el token del central', async () => {
    const u = persona()
    const antes = await sesiones()
    const revocaciones = central.requests.filter((x) => x.path === '/revocation').length
    const r = await login(u)
    expect(r.status).toBe(403)
    expect(r.body.error).toBe('NOT_FUNCIONARIO')
    expect(r.body.message).toContain('Recursos Humanos')
    expect(r.headers['set-cookie']).toBeUndefined()
    expect(await cuentas(u.sub)).toHaveLength(0)
    expect(await sesiones()).toBe(antes)
    expect(central.requests.filter((x) => x.path === '/revocation')).toHaveLength(revocaciones + 1)
  })

  it('un funcionario que no está ACTIVA (inactivo, jubilado…) tampoco entra', async () => {
    const u = persona()
    rh.addFuncionario(u.username, 'INACTIVA')
    expect((await login(u)).body.error).toBe('NOT_FUNCIONARIO')
  })

  it('con la contraseña mala sigue siendo 401: RH Link ni se consulta', async () => {
    const u = persona()
    const consultas = rh.requests.length
    const r = await login({ username: u.username, password: 'mala' })
    expect(r.status).toBe(401)
    expect(r.body.error).toBe('INVALID_CREDENTIALS')
    expect(rh.requests.length).toBe(consultas)
  })

  it('entrando con el correo, la cédula sale del claim identity_number del token', async () => {
    const u = persona({ username: `correo${++n}@alcaldia.test`, identityNumber: '8-701-001' })
    rh.addFuncionario('8-701-001')
    expect((await login(u)).status).toBe(200)

    const sin = persona({ username: `correo${++n}@alcaldia.test`, identityNumber: '8-701-002' })
    const r = await login(sin)
    expect(r.status).toBe(403)
    expect(r.body.error).toBe('NOT_FUNCIONARIO')
  })

  it('sin forma de saber la cédula (correo y sin claim con formato de cédula) no entra', async () => {
    const u = persona({ username: `correo${++n}@alcaldia.test`, identityNumber: 'no-es-cedula' })
    const r = await login(u)
    expect(r.status).toBe(403)
    expect(r.body.error).toBe('CEDULA_REQUIRED')
    expect(r.body.message).toContain('cédula')
    expect(await cuentas(u.sub)).toHaveLength(0)
  })

  it('si RH Link no responde, no se entra (503) y no queda cuenta ni sesión', async () => {
    const u = persona()
    rh.addFuncionario(u.username)
    rh.failNext('drop')
    const r = await login(u)
    expect(r.status).toBe(503)
    expect(r.body.error).toBe('RRHH_UNAVAILABLE')
    expect(await cuentas(u.sub)).toHaveLength(0)
    // Cuando RH Link vuelve, entra.
    expect((await login(u)).status).toBe(200)
  })

  it('RH Link con error 5xx: 502 RRHH_ERROR, no se entra', async () => {
    const u = persona()
    rh.addFuncionario(u.username)
    rh.failNext({ status: 500, body: '{"success":false}' })
    const r = await login(u)
    expect(r.status).toBe(502)
    expect(r.body.error).toBe('RRHH_ERROR')
  })

  it('el token de AD de la API se reutiliza, y si RH Link lo revoca se vuelve a pedir una vez', async () => {
    const a = persona()
    const b = persona()
    rh.addFuncionario(a.username)
    rh.addFuncionario(b.username)
    expect((await login(a)).status).toBe(200)
    const logins = rh.adLogins
    expect((await login(b)).status).toBe(200)
    expect(rh.adLogins).toBe(logins) // mismo token

    rh.revokeAdTokens()
    const c = persona()
    rh.addFuncionario(c.username)
    expect((await login(c)).status).toBe(200)
    expect(rh.adLogins).toBe(logins + 1)
  })

  it('las cuentas locales (de prueba) no pasan por RH Link', async () => {
    const consultas = rh.requests.length
    const { createUser, PASSWORD } = await import('../helpers.ts')
    const local = await createUser('local@prueba.test', ['funcionario'])
    const r = await request(app).post('/api/auth/login').send({ username: local.email, password: PASSWORD })
    expect(r.status).toBe(200)
    expect(rh.requests.length).toBe(consultas)
  })

  it('renovar la sesión no vuelve a preguntarle a RH Link (solo se verifica al entrar)', async () => {
    const u = persona()
    rh.addFuncionario(u.username)
    const agent = request.agent(app)
    expect((await agent.post('/api/auth/login').send({ username: u.username, password: u.password })).status).toBe(200)
    const consultas = rh.requests.length
    expect((await agent.post('/api/auth/refresh')).status).toBe(200)
    expect(rh.requests.length).toBe(consultas)
  })
})

describe('el departamento sale de RH Link', () => {
  it('al entrar queda el departamento que RH Link dice (por su código de ubicación), sin pedírselo a la persona', async () => {
    const u = persona()
    rh.addFuncionario(u.username, 'ACTIVA', 15607)
    const r = await login(u)
    expect(r.status).toBe(200)
    expect(r.body.departmentId).toBe(departamentoRrhhId)
  })

  it('si RH Link lo cambia de dirección, el próximo ingreso lo actualiza (RH Link manda)', async () => {
    const u = persona()
    rh.addFuncionario(u.username, 'ACTIVA', 15607)
    expect((await login(u)).body.departmentId).toBe(departamentoRrhhId)
    rh.addFuncionario(u.username, 'ACTIVA', 15608)
    expect((await login(u)).body.departmentId).toBe(otroRrhhId)
  })

  it('si su ubicación no es una de las direcciones de la intranet, entra sin departamento (la intranet se lo pedirá)', async () => {
    const u = persona()
    rh.addFuncionario(u.username, 'ACTIVA', 424242)
    const r = await login(u)
    expect(r.status).toBe(200)
    expect(r.body.departmentId).toBeNull()
  })

  it('sin verificación el departamento no se toca: se queda el que ya tenía', async () => {
    const { createUser, PASSWORD } = await import('../helpers.ts')
    const local = await createUser('local-dep@prueba.test', ['funcionario'])
    const r = await request(app).post('/api/auth/login').send({ username: local.email, password: PASSWORD })
    expect(r.status).toBe(200)
    expect(r.body.departmentId).toBeNull()
  })
})

describe('registro (POST /api/auth/register)', () => {
  const datos = (cedula: string) => ({ identityNumber: cedula, password: 'Clave-de-registro-1', email: `r${cedula}@pty.gob.pa` })

  it('quien no es funcionario no se registra: 403 y no se crea nada en el central', async () => {
    const cedula = '8-702-001'
    const r = await request(app).post('/api/auth/register').send(datos(cedula))
    expect(r.status).toBe(403)
    expect(r.body.error).toBe('NOT_FUNCIONARIO')
    expect(central.requests.some((x) => x.path === '/auth/register' && x.form.identityNumber === cedula)).toBe(false)
  })

  it('un funcionario activo se registra sin nombre ni departamento: queda con sesión, con su nombre y departamento de RH Link', async () => {
    const cedula = '8-702-002'
    rh.addFuncionario(cedula, 'ACTIVA', 15607, 'JUAN CARLOS PEREZ GOMEZ')
    const r = await request(app).post('/api/auth/register').send(datos(cedula))
    expect(r.status).toBe(201)
    expect(r.headers['set-cookie']).toBeDefined()
    expect(r.body).toMatchObject({ firstName: 'Juan Carlos', lastName: 'Perez Gomez', departmentId: departamentoRrhhId })
    // En el central se creó con el nombre completo de RH Link.
    expect(central.requests.find((x) => x.path === '/auth/register' && x.form.identityNumber === cedula)!.form.fullName).toBe('Juan Carlos Perez Gomez')
  })

  it('lo que la persona escriba (nombre, apellido) manda sobre RH Link', async () => {
    const cedula = '8-702-003'
    rh.addFuncionario(cedula, 'ACTIVA', 15607, 'JUAN CARLOS PEREZ GOMEZ')
    const r = await request(app).post('/api/auth/register').send({ ...datos(cedula), firstName: 'Juanito', lastName: 'Pérez' })
    expect(r.status).toBe(201)
    expect(r.body).toMatchObject({ firstName: 'Juanito', lastName: 'Pérez' })
  })

  it('si RH Link no trae el nombre, se pide (400 con firstName y lastName) y no se crea nada en el central', async () => {
    const cedula = '8-702-004'
    rh.addFuncionario(cedula, 'ACTIVA', 15607, '   ')
    const r = await request(app).post('/api/auth/register').send(datos(cedula))
    expect(r.status).toBe(400)
    expect(r.body.fields.map((f: { field: string }) => f.field).sort()).toEqual(['firstName', 'lastName'])
    expect(central.requests.some((x) => x.path === '/auth/register' && x.form.identityNumber === cedula)).toBe(false)
  })
})

describe('ficha de administración (GET /api/users/:id)', () => {
  it('al entrar se guarda la cédula; administración la ve en la ficha con lo que dice RH Link, y la busca en la lista', async () => {
    const { createUser, loginAs } = await import('../helpers.ts')
    const u = persona()
    rh.addFuncionario(u.username, 'ACTIVA', 15607, 'NOMBRE EN PLANILLA')
    expect((await login(u)).status).toBe(200)
    const [cuenta] = await cuentas(u.sub)
    expect(cuenta.cedula).toBe(u.username)

    await createUser('admin-ficha@prueba.test', ['admin'])
    const admin = await loginAs('admin-ficha@prueba.test')
    const r = await admin.get(`/api/users/${cuenta.id}`)
    expect(r.status).toBe(200)
    expect(r.body).toMatchObject({
      cedula: u.username,
      identitySub: u.sub,
      source: 'identity',
      departmentName: 'Dirección de prueba A',
      activeSessions: 1,
      requests: 0,
      rrhh: { status: 'found', active: true, fullName: 'NOMBRE EN PLANILLA', locationCode: 15607, locationDepartment: 'Dirección de prueba A' },
    })
    expect(r.body).not.toHaveProperty('passwordHash')
    // La cédula solo sale en la ficha: ni en la lista ni en /me.
    const lista = await admin.get('/api/users').query({ q: u.username })
    expect(lista.body.map((p: { id: number }) => p.id)).toEqual([cuenta.id])
    expect(lista.body[0]).not.toHaveProperty('cedula')

    // Abrir la ficha queda auditado: quién y de quién, sin la cédula.
    let filas: { type: string; actorId: number; payload: unknown }[] = []
    for (let i = 0; i < 50 && !filas.length; i++) {
      filas = (await admin.get('/api/audit/events').query({ subject: `user:${cuenta.id}` })).body
      if (!filas.length) await new Promise((res) => setTimeout(res, 20))
    }
    expect(filas).toHaveLength(1)
    expect(filas[0]).toMatchObject({ type: 'usuario.ficha_vista', actorId: expect.any(Number), payload: { userId: cuenta.id } })
    expect(JSON.stringify(filas[0])).not.toContain(u.username)
  })

  it('si RH Link no responde, la ficha sale igual (rrhh: error); sin cédula, no-cedula; solo admin la abre', async () => {
    const { createUser, loginAs } = await import('../helpers.ts')
    const u = persona()
    rh.addFuncionario(u.username)
    expect((await login(u)).status).toBe(200)
    const [cuenta] = await cuentas(u.sub)
    const local = await createUser('sin-cedula-ficha@prueba.test', ['funcionario'])

    await createUser('admin-ficha2@prueba.test', ['admin'])
    const admin = await loginAs('admin-ficha2@prueba.test')
    rh.failNext('drop')
    expect((await admin.get(`/api/users/${cuenta.id}`)).body.rrhh).toEqual({ status: 'error' })
    expect((await admin.get(`/api/users/${local.id}`)).body).toMatchObject({ cedula: null, source: 'local', rrhh: { status: 'no-cedula' } })
    expect((await admin.get('/api/users/999999')).status).toBe(404)

    await createUser('gestor-ficha@prueba.test', ['gestorSolicitudes'])
    const gestor = await loginAs('gestor-ficha@prueba.test')
    expect((await gestor.get(`/api/users/${cuenta.id}`)).status).toBe(403)
  })
})
