/**
 * Login contra Identity Central (guía GUIA_INTEGRACION_IDENTITY_PASSWORD.md), con un
 * central falso en el puerto de IDENTITY_URL (ver vitest.config.ts). Personas ficticias.
 */
import { eq } from 'drizzle-orm'
import request from 'supertest'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import { app } from '../../src/app.ts'
import { db } from '../../src/config/database.ts'
import { departments, sessions, users } from '../../src/database/schema/index.ts'
import { createUser, loginAs, PASSWORD } from '../helpers.ts'
import { startFakeIdentity, type FakeIdentity, type FakeUser } from './fake-identity.ts'

const SECRET = process.env.IDENTITY_CLIENT_SECRET!
let central: FakeIdentity
let logs: string[] = []

beforeAll(async () => {
  central = await startFakeIdentity({ url: process.env.IDENTITY_URL!, clientId: process.env.IDENTITY_CLIENT_ID!, clientSecret: SECRET })
})
afterAll(() => central.close())

// Los errores esperados se registran en consola: se capturan para revisar que nunca lleven secretos.
beforeAll(() => {
  for (const level of ['error', 'warn'] as const) vi.spyOn(console, level).mockImplementation((...a: unknown[]) => void logs.push(a.map(String).join(' ')))
})
afterEach(() => {
  for (const line of logs) expect(line).not.toContain(SECRET)
  logs = []
})

let n = 0
/** Persona ficticia nueva en el central falso. */
function persona(extra: Partial<FakeUser> = {}): FakeUser {
  n++
  return central.addUser({
    username: `persona${n}@alcaldia.test`,
    password: `clave-${n}`,
    sub: crypto.randomUUID(),
    fullName: `Nombre${n} Apellido Segundo`,
    email: `Persona${n}@Alcaldia.test`,
    ...extra,
  })
}

const login = (u: Pick<FakeUser, 'username' | 'password'>) => request(app).post('/api/auth/login').send({ username: u.username, password: u.password })
const userBySub = async (sub: string) => (await db.select().from(users).where(eq(users.identitySub, sub)))[0]

/** Entra y devuelve un agente con la cookie, y el id de su cuenta. */
async function entrar(u: FakeUser) {
  const agent = request.agent(app)
  const r = await agent.post('/api/auth/login').send({ username: u.username, password: u.password })
  expect(r.status).toBe(200)
  return { agent, userId: r.body.id as number }
}
const sessionOf = async (userId: number) => (await db.select().from(sessions).where(eq(sessions.userId, userId)))[0]
/** Simula que pasó la hora del access token. */
const expireAccessToken = (userId: number) => db.update(sessions).set({ accessExpiresAt: new Date(Date.now() - 1000) }).where(eq(sessions.userId, userId))
const count = (path: string, grant?: string) => central.requests.filter((r) => r.path === path && (!grant || r.form.grant_type === grant)).length

describe('login con Identity Central (Mitad A)', () => {
  it('entra: crea la cuenta local por sub, pone la cookie y no expone tokens ni el secret', async () => {
    // Usuario con forma de cédula (ficticia): viaja como identity_number en el token.
    const p = persona({ username: '0-000-0001' })
    const r = await login(p)
    expect(r.status).toBe(200)
    expect(r.body).toEqual({ id: expect.any(Number), email: p.email!.toLowerCase(), emailVerified: false, firstName: `Nombre${n}`, lastName: 'Apellido Segundo', roles: ['funcionario'], departmentId: null, tourSeenAt: null })
    expect(String(r.headers['set-cookie'])).toMatch(/mupa_sesion=[\w-]+;.*HttpOnly/i)

    const text = JSON.stringify(r.body) + String(r.headers['set-cookie'])
    expect(text).not.toContain(SECRET)
    expect(text).not.toMatch(/eyJ/) // ningún JWT

    const row = await userBySub(p.sub)
    expect(row.id).toBe(r.body.id)
    expect(row.passwordHash).toBeNull()
    // email_verified llega como el string "false": se guarda como booleano (§7.2).
    expect(row.emailVerified).toBe(false)
    // Este usuario no tiene forma de cédula: no se guarda en ningún lado.
    expect(JSON.stringify(row)).not.toContain(p.username)
  })

  it('pide el token con grant password, los scopes configurados y el client_id', async () => {
    const p = persona()
    await login(p)
    const req = central.requests.at(-1)!
    expect(req.path).toBe('/token')
    expect(req.form).toMatchObject({ grant_type: 'password', username: p.username, scope: 'openid profile email offline_access roles', client_id: 'intranet_prueba' })
  })

  it('guarda el refresh token cifrado (no el token tal cual) y cuándo vence el access token', async () => {
    const p = persona()
    const r = await login(p)
    const [s] = await db.select().from(sessions).where(eq(sessions.userId, r.body.id))
    const issued = [...central.refreshTokens.keys()].at(-1)!
    expect(s.refreshToken).toBeTruthy()
    expect(s.refreshToken).not.toContain(issued.slice(0, 40))
    expect(s.accessExpiresAt!.getTime()).toBeGreaterThan(Date.now() + 3_500_000)
  })

  it('el mismo sub es la misma cuenta aunque cambie el correo (§7.8)', async () => {
    const p = persona()
    const primera = await login(p)
    p.email = `nuevo${n}@alcaldia.test`
    const segunda = await login(p)
    expect(segunda.body.id).toBe(primera.body.id)
    expect(segunda.body.email).toBe(p.email)
    expect((await db.select().from(users).where(eq(users.identitySub, p.sub))).length).toBe(1)
  })

  it('autoriza con app_role, no con role; role puede venir como lista (§7.3)', async () => {
    const admin = persona({ appRole: 'Admin', role: 'User' })
    expect((await login(admin)).body.roles).toEqual(['admin'])

    const superAdminGlobal = persona({ appRole: 'User', role: ['SuperAdmin', 'Admin'] })
    const r = await login(superAdminGlobal)
    expect(r.status).toBe(200)
    expect(r.body.roles).toEqual(['funcionario'])

    expect((await login(persona({ appRole: ['Gestor Solicitudes', 'Comunicación'] }))).body.roles).toEqual(['gestorSolicitudes', 'comunicacion'])
    // El antiguo "Editor de aplicaciones" ya no existe: no da permisos.
    expect((await login(persona({ appRole: 'EditorApps' }))).body.roles).toEqual(['funcionario'])
    expect((await login(persona({ appRole: 'RolQueNoExiste' }))).body.roles).toEqual(['funcionario'])
  })

  it('una cuenta local (LOCAL_LOGIN_ENABLED) sigue entrando con su clave, sin pasar por el central', async () => {
    await createUser('local@prueba.test', ['funcionario'], 'Local')
    const antes = central.requests.length
    const r = await request(app).post('/api/auth/login').send({ username: 'local@prueba.test', password: PASSWORD })
    expect(r.status).toBe(200)
    expect(central.requests.length).toBe(antes)
  })
})

describe('errores del login (§6)', () => {
  it('contraseña mala o usuario inexistente (401 del central) → 401 INVALID_CREDENTIALS, igual en los dos casos', async () => {
    const p = persona()
    const mala = await login({ username: p.username, password: 'mala' })
    const nadie = await login({ username: 'no-existe@alcaldia.test', password: 'x' })
    expect(mala.status).toBe(401)
    expect(mala.body.error).toBe('INVALID_CREDENTIALS')
    expect(nadie.body).toEqual(mala.body)
  })

  it('también con el formato que documenta la guía (400 invalid_grant)', async () => {
    central.failNext({ status: 400, body: JSON.stringify({ error: 'invalid_grant', error_description: 'The username/password couple is invalid.' }) })
    const r = await login(persona())
    expect(r.status).toBe(401)
    expect(r.body.error).toBe('INVALID_CREDENTIALS')
  })

  it('sin rol en la aplicación → 403 APP_ACCESS_DENIED (contraseña correcta)', async () => {
    const r = await login(persona({ access: false }))
    expect(r.status).toBe(403)
    expect(r.body.error).toBe('APP_ACCESS_DENIED')
  })

  it('client_id o secret mal → 500 genérico (es configuración, no la persona)', async () => {
    central.failNext({ status: 400, body: JSON.stringify({ error: 'invalid_client', error_description: 'The specified client credentials are invalid.' }) })
    const r = await login(persona())
    expect(r.status).toBe(500)
    expect(r.body).toEqual({ error: 'INTERNAL_ERROR', message: expect.any(String) })
    expect(logs.join('\n')).toMatch(/invalid_client/)
  })

  it('scope no registrado → 500', async () => {
    central.failNext({ status: 400, body: JSON.stringify({ error: 'invalid_scope' }) })
    expect((await login(persona())).status).toBe(500)
  })

  it('error interno del central → 502', async () => {
    central.failNext({ status: 500, body: 'boom', contentType: 'text/plain' })
    const r = await login(persona())
    expect(r.status).toBe(502)
    expect(r.body.error).toBe('IDENTITY_ERROR')
  })

  it('un 200 con HTML (el front de Angular detrás del proxy) NO es un éxito → 502 (§7.6)', async () => {
    central.failNext({ status: 200, body: '<!doctype html><app-root></app-root>', contentType: 'text/html' })
    const r = await login(persona())
    expect(r.status).toBe(502)
    expect(logs.join('\n')).toMatch(/sin JSON/)
  })

  it('central inalcanzable → 503', async () => {
    central.failNext('drop')
    const r = await login(persona())
    expect(r.status).toBe(503)
    expect(r.body.error).toBe('IDENTITY_UNAVAILABLE')
  })

  it('un token emitido con otro issuer (config desalineada) → 500, con la pista en el log', async () => {
    central.state.issuer = 'http://otro-servidor.test/'
    try {
      const r = await login(persona())
      expect(r.status).toBe(500)
      expect(logs.join('\n')).toMatch(/JWT_ISSUER/)
    } finally {
      central.state.issuer = central.issuer
    }
  })

  it('valida el cuerpo antes de llamar al central', async () => {
    const antes = central.requests.length
    const r = await request(app).post('/api/auth/login').send({})
    expect(r.status).toBe(400)
    expect(r.body.fields.map((f: { field: string }) => f.field)).toEqual(expect.arrayContaining(['username', 'password']))
    expect(central.requests.length).toBe(antes)
  })
})

describe('renovar la sesión (POST /api/auth/refresh)', () => {
  it('pide un token nuevo SIN scope, guarda el refresh token NUEVO y fusiona el perfil (§7.1)', async () => {
    const p = persona()
    const { agent, userId } = await entrar(p)
    const rtLogin = central.lastRefreshTokenFor(p.username)!
    const antes = await sessionOf(userId)

    const r = await agent.post('/api/auth/refresh')
    expect(r.status).toBe(200)
    // El token del refresh no trae email ni full_name: la cuenta los conserva.
    expect(r.body).toMatchObject({ id: userId, email: p.email!.toLowerCase(), lastName: 'Apellido Segundo' })

    const req = central.requests.at(-1)!
    expect(req.form).toMatchObject({ grant_type: 'refresh_token', refresh_token: rtLogin, client_id: 'intranet_prueba' })
    expect(req.form).not.toHaveProperty('scope')

    const despues = await sessionOf(userId)
    expect(despues.refreshToken).not.toBe(antes.refreshToken)
    const rtNuevo = central.lastRefreshTokenFor(p.username)!
    expect(rtNuevo).not.toBe(rtLogin)
    // La siguiente renovación usa el token nuevo, no el del login.
    await agent.post('/api/auth/refresh')
    expect(central.requests.at(-1)!.form.refresh_token).toBe(rtNuevo)
  })

  it('toma los roles del app_role del token nuevo', async () => {
    const p = persona({ appRole: 'User' })
    const { agent } = await entrar(p)
    p.appRole = 'Admin'
    expect((await agent.post('/api/auth/refresh')).body.roles).toEqual(['admin'])
    expect((await agent.get('/api/auth/session')).body.roles).toEqual(['admin'])
  })

  it('si el token nuevo no trae app_role, conserva los roles que tenía (no baja a funcionario)', async () => {
    const p = persona({ appRole: 'Admin' })
    const { agent } = await entrar(p)
    p.omitAppRoleOnRefresh = true
    expect((await agent.post('/api/auth/refresh')).body.roles).toEqual(['admin'])
    expect((await agent.get('/api/auth/session')).body.roles).toEqual(['admin'])
  })

  it('sin sesión → 401', async () => {
    const r = await request(app).post('/api/auth/refresh')
    expect(r.status).toBe(401)
    expect(r.body.error).toBe('AUTHENTICATION_REQUIRED')
  })

  it('refresh token revocado o vencido → 401 SESSION_EXPIRED y la sesión se cierra', async () => {
    const p = persona()
    const { agent } = await entrar(p)
    central.refreshTokens.get(central.lastRefreshTokenFor(p.username)!)!.revoked = true
    const r = await agent.post('/api/auth/refresh')
    expect(r.status).toBe(401)
    expect(r.body.error).toBe('SESSION_EXPIRED')
    expect((await agent.get('/api/auth/session')).body).toBeNull()
  })

  it('si le quitaron el acceso a la app → 403 y la sesión se cierra', async () => {
    const p = persona()
    const { agent } = await entrar(p)
    p.access = false
    expect((await agent.post('/api/auth/refresh')).status).toBe(403)
    expect((await agent.get('/api/auth/session')).body).toBeNull()
  })

  it('central caído → 503, pero la sesión sigue (se puede reintentar)', async () => {
    const p = persona()
    const { agent } = await entrar(p)
    central.failNext('drop')
    expect((await agent.post('/api/auth/refresh')).status).toBe(503)
    expect((await agent.post('/api/auth/refresh')).status).toBe(200)
  })

  it('una sesión local no tiene nada que renovar: devuelve la cuenta sin llamar al central', async () => {
    await createUser('local-refresh@prueba.test', ['funcionario'])
    const agent = request.agent(app)
    await agent.post('/api/auth/login').send({ username: 'local-refresh@prueba.test', password: PASSWORD })
    const antes = central.requests.length
    const r = await agent.post('/api/auth/refresh')
    expect(r.status).toBe(200)
    expect(r.body.email).toBe('local-refresh@prueba.test')
    expect(central.requests.length).toBe(antes)
  })
})

describe('renovación automática al vencer el access token', () => {
  it('la siguiente petición renueva sola, una sola vez aunque lleguen varias a la vez', async () => {
    const p = persona()
    const { agent, userId } = await entrar(p)
    await expireAccessToken(userId)
    const antes = count('/token', 'refresh_token')

    const rs = await Promise.all([agent.get('/api/auth/session'), agent.get('/api/auth/session'), agent.get('/api/applications'), agent.get('/api/home/layout')])
    expect(rs.map((r) => r.status)).toEqual([200, 200, 200, 200])
    expect(rs[0].body.id).toBe(userId)
    expect(rs[1].body.id).toBe(userId)
    expect(count('/token', 'refresh_token') - antes).toBe(1)
    expect((await sessionOf(userId)).accessExpiresAt!.getTime()).toBeGreaterThan(Date.now() + 3_500_000)
  })

  it('si el central ya no la acepta, la persona queda sin sesión', async () => {
    const p = persona()
    const { agent, userId } = await entrar(p)
    central.refreshTokens.get(central.lastRefreshTokenFor(p.username)!)!.revoked = true
    await expireAccessToken(userId)
    expect((await agent.get('/api/auth/session')).body).toBeNull()
    expect(await sessionOf(userId)).toBeUndefined()
  })

  it('si el central no responde, la petición va sin sesión, pero la sesión se conserva y vuelve sola', async () => {
    const p = persona()
    const { agent, userId } = await entrar(p)
    await expireAccessToken(userId)
    central.failNext('drop')
    expect((await agent.get('/api/auth/session')).body).toBeNull()
    expect((await agent.get('/api/auth/session')).body.id).toBe(userId)
  })
})

describe('salir (POST /api/auth/logout)', () => {
  it('revoca el refresh token vigente en el central, borra la sesión y la cookie', async () => {
    const p = persona()
    const { agent, userId } = await entrar(p)
    await agent.post('/api/auth/refresh') // rota: se debe revocar el NUEVO
    const rt = central.lastRefreshTokenFor(p.username)!

    const r = await agent.post('/api/auth/logout')
    expect(r.status).toBe(204)
    expect(String(r.headers['set-cookie'])).toMatch(/mupa_sesion=;/)
    expect(central.requests.at(-1)).toMatchObject({ path: '/revocation', form: { token: rt, token_type_hint: 'refresh_token', client_id: 'intranet_prueba' } })
    expect(central.refreshTokens.get(rt)!.revoked).toBe(true)
    expect(await sessionOf(userId)).toBeUndefined()
  })

  it('un 4xx del central al revocar también es una salida exitosa (§7.4)', async () => {
    const { agent, userId } = await entrar(persona())
    central.failNext({ status: 400, body: JSON.stringify({ error: 'invalid_token' }) })
    expect((await agent.post('/api/auth/logout')).status).toBe(204)
    expect(await sessionOf(userId)).toBeUndefined()
  })

  it('con el central caído la sesión local igual se cierra (el refresh token se borra con ella)', async () => {
    const { agent, userId } = await entrar(persona())
    central.failNext('drop')
    expect((await agent.post('/api/auth/logout')).status).toBe(204)
    expect(await sessionOf(userId)).toBeUndefined()
    expect(logs.join('\n')).toMatch(/No se pudo revocar/)
  })
})

describe('Authorization: Bearer (Mitad B, §5)', () => {
  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` })
  const claims = (sub: string, extra: Record<string, unknown> = {}) => ({ iss: central.issuer, sub, client_id: 'intranet_prueba', app_id: 'intranet_prueba', app_role: 'User', name: 'Bearer Prueba', ...extra })

  it('un token recién emitido abre el endpoint y crea la cuenta la primera vez que se ve el sub (§7.7)', async () => {
    const p = persona()
    const r = await request(app).get('/api/auth/session').set(bearer(await central.accessTokenFor(p)))
    expect(r.status).toBe(200)
    expect(r.body).toMatchObject({ email: p.email!.toLowerCase(), firstName: `Nombre${n}`, roles: ['funcionario'] })
    expect((await userBySub(p.sub)).id).toBe(r.body.id)
  })

  it('un endpoint protegido usa la cuenta del sub (nunca un id del cuerpo)', async () => {
    const p = persona()
    const token = await central.accessTokenFor(p)
    const layout = { v: 1, items: [{ id: 'accesos', uid: 'a1', ancho: 'media' }] }
    expect((await request(app).put('/api/home/layout').set(bearer(token)).send({ layout })).status).toBe(200)
    const r = await request(app).get('/api/home/layout').set(bearer(token))
    expect(r.body.personal).toEqual(layout)
    // Sin token, el mismo endpoint pide sesión.
    expect((await request(app).put('/api/home/layout').send({ layout })).status).toBe(401)
  })

  it('el token del refresh (sin email ni full_name) no borra datos de la cuenta (§7.1)', async () => {
    const p = persona()
    await login(p)
    const r = await request(app).get('/api/auth/session').set(bearer(await central.accessTokenFor(p, true)))
    expect(r.body).toMatchObject({ email: p.email!.toLowerCase(), lastName: 'Apellido Segundo' })
  })

  it('autoriza con app_role: role ["SuperAdmin","Admin"] con app_role User no es admin (§7.3)', async () => {
    const sub = crypto.randomUUID()
    const globalAdmin = await central.sign(claims(sub, { role: ['SuperAdmin', 'Admin'], app_role: 'User' }))
    expect((await request(app).put('/api/home/default-layout').set(bearer(globalAdmin)).send({ layout: null })).status).toBe(403)
    const appAdmin = await central.sign(claims(sub, { app_role: 'Admin' }))
    expect((await request(app).put('/api/home/default-layout').set(bearer(appAdmin)).send({ layout: null })).status).toBe(200)
  })

  it('no valida aud: el access token no lo trae, y si lo trajera tampoco importa', async () => {
    const token = await central.sign(claims(crypto.randomUUID(), { aud: 'cualquier-cosa' }))
    expect((await request(app).get('/api/auth/session').set(bearer(token))).status).toBe(200)
  })

  it('token vencido → 401 TOKEN_EXPIRED', async () => {
    const token = await central.sign(claims(crypto.randomUUID()), {}, undefined, Math.floor(Date.now() / 1000) - 120)
    const r = await request(app).get('/api/auth/session').set(bearer(token))
    expect(r.status).toBe(401)
    expect(r.body.error).toBe('TOKEN_EXPIRED')
  })

  it.each([
    ['firma alterada', async () => { const [h, p, s] = (await central.sign(claims(crypto.randomUUID()))).split('.'); return `${h}.${p}.${s.slice(0, -6)}AAAAAA` }],
    ['firmado con otra clave (mismo kid)', async () => central.sign(claims(crypto.randomUUID()), {}, await central.otherKey())],
    ['issuer sin la barra final (§7.5)', async () => central.sign(claims(crypto.randomUUID(), { iss: central.issuer.slice(0, -1) }))],
    ['alg "none"', async () => { const [, p] = (await central.sign(claims(crypto.randomUUID()))).split('.'); return `${Buffer.from('{"alg":"none","typ":"at+jwt"}').toString('base64url')}.${p}.` }],
    ['HS256 (confusión de algoritmo)', async () => {
      const { SignJWT } = await import('jose')
      return new SignJWT(claims(crypto.randomUUID())).setProtectedHeader({ alg: 'HS256', typ: 'at+jwt', kid: central.kid }).setExpirationTime('1h').sign(new TextEncoder().encode('x'.repeat(32)))
    }],
    ['un id_token (typ JWT) no es un access token', async () => central.sign(claims(crypto.randomUUID()), { typ: 'JWT' })],
    ['sin sub', async () => central.sign({ iss: central.issuer, client_id: 'intranet_prueba' })],
    ['kid desconocido', async () => central.sign(claims(crypto.randomUUID()), { kid: 'otra' })],
    ['basura', async () => 'no-es-un-jwt'],
    ['vacío', async () => ''],
  ])('%s → 401', async (_caso, makeToken) => {
    const r = await request(app).get('/api/auth/session').set('Authorization', `Bearer ${await makeToken()}`.trim())
    expect(r.status).toBe(401)
    expect(['INVALID_TOKEN', 'TOKEN_EXPIRED']).toContain(r.body.error)
  })

  it('token de una app fuera de ALLOWED_CLIENT_IDS → 403 CLIENT_NOT_ALLOWED (§5 paso 7)', async () => {
    const token = await central.sign(claims(crypto.randomUUID(), { client_id: 'estacionamientos', app_id: 'estacionamientos', app_role: 'Admin' }))
    const r = await request(app).get('/api/auth/session').set(bearer(token))
    expect(r.status).toBe(403)
    expect(r.body.error).toBe('CLIENT_NOT_ALLOWED')
  })

  it('token de OTRA app permitida: identifica, pero su app_role (rol en esa app) no da permisos aquí', async () => {
    const p = persona({ appRole: 'User' })
    await login(p)
    const token = await central.sign(claims(p.sub, { client_id: 'otra_app_permitida', app_id: 'otra_app_permitida', app_role: 'Admin' }))
    const r = await request(app).get('/api/auth/session').set(bearer(token))
    expect(r.status).toBe(200)
    expect(r.body.roles).toEqual(['funcionario'])
    expect((await request(app).put('/api/home/default-layout').set(bearer(token)).send({ layout: null })).status).toBe(403)
    // Y no cambia los roles guardados de la cuenta.
    expect((await userBySub(p.sub)).roles).toEqual(['funcionario'])
  })

  it('el JWKS se cachea: muchas peticiones no lo vuelven a descargar', async () => {
    const token = await central.sign(claims(crypto.randomUUID()))
    await request(app).get('/api/auth/session').set(bearer(token))
    const antes = central.state.jwksRequests
    for (let i = 0; i < 5; i++) expect((await request(app).get('/api/auth/session').set(bearer(token))).status).toBe(200)
    expect(central.state.jwksRequests).toBe(antes)
  })

  it('login, refresh y logout no pasan por el middleware: un Bearer inválido no los bloquea (§1)', async () => {
    const p = persona()
    const r = await request(app).post('/api/auth/login').set('Authorization', 'Bearer basura').send({ username: p.username, password: p.password })
    expect(r.status).toBe(200)
    expect((await request(app).post('/api/auth/logout').set('Authorization', 'Bearer basura')).status).toBe(204)
  })

  it('otros esquemas (Basic) se ignoran: sigue contando la cookie', async () => {
    const { agent, userId } = await entrar(persona())
    const r = await agent.get('/api/auth/session').set('Authorization', 'Basic dXN1YXJpbzpjbGF2ZQ==')
    expect(r.body.id).toBe(userId)
  })
})

// Cédulas ficticias con el formato real (8-000-0NNN).
let cedulas = 0
// El departamento es obligatorio al registrarse: todos los registros de prueba llevan este, salvo que digan otro.
let departamentoBase = 0
beforeAll(async () => {
  departamentoBase = (await db.insert(departments).values({ name: 'Departamento base del registro' }).returning())[0].id
})
function registro(extra: Record<string, unknown> = {}) {
  cedulas++
  return {
    identityNumber: `8-000-${String(cedulas).padStart(4, '0')}`,
    firstName: 'Juan Carlos',
    lastName: 'Pérez Gómez',
    password: 'Clave-de-registro-1',
    email: `registro${cedulas}@pty.gob.pa`,
    departmentId: departamentoBase,
    ...extra,
  }
}
const registrar = (body: Record<string, unknown>, agent = request.agent(app)) => agent.post('/api/auth/register').send(body)

describe('registro (POST /api/auth/register)', () => {
  it('crea la cuenta en el central, deja la sesión iniciada y guarda lo autodeclarado y la cédula (para la ficha de administración)', async () => {
    const [depto] = await db.insert(departments).values({ name: 'Departamento de prueba' }).returning()
    const datos = registro({ phone: '506-1234', mobile: '+50760000000', jobTitle: 'Analista', departmentId: depto.id })
    const agent = request.agent(app)
    const r = await registrar(datos, agent)
    expect(r.status).toBe(201)
    expect(r.body).toEqual({
      id: expect.any(Number),
      email: datos.email,
      emailVerified: false,
      firstName: 'Juan Carlos',
      lastName: 'Pérez Gómez',
      roles: ['funcionario'],
      departmentId: depto.id,
      tourSeenAt: null,
    })
    expect(String(r.headers['set-cookie'])).toMatch(/mupa_sesion=[\w-]+;.*HttpOnly/i)
    expect((await agent.get('/api/auth/session')).body.id).toBe(r.body.id)

    const alta = central.requests.find((x) => x.path === '/auth/register' && x.form.identityNumber === datos.identityNumber)!
    expect(alta.form).toMatchObject({
      identityNumber: datos.identityNumber,
      fullName: 'Juan Carlos Pérez Gómez',
      email: datos.email,
      password: datos.password,
      confirmPassword: datos.password,
      phoneNumber: '+50760000000',
      applicationId: 'intranet_prueba',
    })
    // Entra con la cédula (grant password), como cualquier persona del central.
    expect(central.requests.at(-1)!.form).toMatchObject({ grant_type: 'password', username: datos.identityNumber })

    const row = (await db.select().from(users).where(eq(users.id, r.body.id)))[0]
    expect(row).toMatchObject({ phone: '506-1234', jobTitle: 'Analista', passwordHash: null })
    // La cédula queda en su columna (solo la ve administración) y en ningún otro campo.
    expect(row.cedula).toBe(datos.identityNumber)
    expect(JSON.stringify({ ...row, cedula: null })).not.toContain(datos.identityNumber)
    // /api/auth/me no la devuelve.
    expect(JSON.stringify(r.body)).not.toContain(datos.identityNumber)
  })

  it('al volver a entrar no parte el nombre de otra forma ("Juan" + "Carlos Pérez Gómez")', async () => {
    const datos = registro()
    const r = await registrar(datos)
    const otra = await login({ username: datos.identityNumber, password: datos.password })
    expect(otra.status).toBe(200)
    expect(otra.body).toMatchObject({ id: r.body.id, firstName: 'Juan Carlos', lastName: 'Pérez Gómez' })
  })

  it('valida todos los campos antes de llamar al central', async () => {
    const antes = central.requests.length
    const r = await registrar({ identityNumber: '123', password: 'corta', email: 'no-es-correo' })
    expect(r.status).toBe(400)
    expect(r.body.error).toBe('VALIDATION_ERROR')
    expect(r.body.fields.map((f: { field: string }) => f.field).sort()).toEqual(['email', 'identityNumber', 'password'])
    expect(central.requests.length).toBe(antes)
  })

  it('solo acepta correos institucionales: con uno personal no llama al central', async () => {
    const antes = central.requests.length
    for (const email of ['carlos@outlook.com', 'alguien@gmail.com', 'otro@pty.gob.pa.example.com']) {
      const r = await registrar(registro({ email }))
      expect(r.status).toBe(400)
      expect(r.body.fields).toEqual([{ field: 'email', message: 'Usa tu correo institucional (@pty.gob.pa).' }])
    }
    expect(central.requests.length).toBe(antes)
    expect((await registrar(registro({ email: `Mayuscula${cedulas}@PTY.GOB.PA` }))).status).toBe(201)
  })

  it('un campo opcional vacío cuenta como no escrito; si el central exige el correo, el error vuelve en el campo email', async () => {
    const r = await registrar(registro({ email: '', phone: '', jobTitle: '' }))
    expect(r.status).toBe(400)
    expect(r.body).toMatchObject({ error: 'VALIDATION_ERROR', fields: [{ field: 'email', message: 'El email es requerido.' }] })
  })

  it('cuando el central deje el correo opcional, el registro sin correo funciona sin cambiar nada', async () => {
    central.state.emailRequired = false
    try {
      const r = await registrar(registro({ email: undefined }))
      expect(r.status).toBe(201)
      expect(r.body.email).toBeNull()
    } finally {
      central.state.emailRequired = true
    }
  })

  it('cédula o correo ya registrados: 409 con un mensaje claro', async () => {
    const datos = registro()
    expect((await registrar(datos)).status).toBe(201)
    const r = await registrar({ ...datos, email: 'otro@pty.gob.pa' })
    expect(r.status).toBe(409)
    expect(r.body.error).toBe('ALREADY_REGISTERED')
  })

  it('el departamento no se pide al registrarse: sin él la cuenta se crea (RH Link lo da al entrar, o la intranet lo pide después)', async () => {
    const r = await registrar({ ...registro(), departmentId: undefined })
    expect(r.status).toBe(201)
    expect(r.body.departmentId).toBeNull()
  })

  it('un departamento que no existe se rechaza antes de crear la cuenta en el central', async () => {
    const antes = central.requests.length
    const r = await registrar(registro({ departmentId: 999_999 }))
    expect(r.status).toBe(400)
    expect(r.body.error).toBe('DEPARTMENT_NOT_FOUND')
    expect(central.requests.length).toBe(antes)
  })

  it('central caído → 503; error interno del central → 502', async () => {
    central.failNext('drop')
    expect((await registrar(registro())).body.error).toBe('IDENTITY_UNAVAILABLE')
    central.failNext({ status: 500, body: '{}' })
    const r = await registrar(registro())
    expect(r.status).toBe(502)
    expect(r.body.error).toBe('IDENTITY_ERROR')
  })
})

describe('confirmar el correo (POST /api/me/email/code y /verify)', () => {
  it('manda el código al correo de la sesión (nunca al del body) y lo confirma', async () => {
    const p = persona()
    const { agent, userId } = await entrar(p)
    const pedido = await agent.post('/api/me/email/code').send({ email: 'tercero@otro.test' })
    expect(pedido.status).toBe(200)
    expect(pedido.body).toEqual({ maskedEmail: expect.stringContaining('***@'), expiresInMinutes: 10 })
    expect(central.codeFor('tercero@otro.test')).toBeUndefined()
    const code = central.codeFor(p.email!)!
    expect(code).toBeDefined()

    const r = await agent.post('/api/me/email/verify').send({ code })
    expect(r.status).toBe(200)
    expect(r.body).toMatchObject({ id: userId, emailVerified: true })
    expect((await db.select().from(users).where(eq(users.id, userId)))[0].emailVerified).toBe(true)

    const otra = await agent.post('/api/me/email/code')
    expect(otra.status).toBe(409)
    expect(otra.body.error).toBe('EMAIL_ALREADY_VERIFIED')
  })

  it('un código equivocado no confirma el correo', async () => {
    const { agent, userId } = await entrar(persona())
    await agent.post('/api/me/email/code')
    const r = await agent.post('/api/me/email/verify').send({ code: '000000' })
    expect(r.status).toBe(400)
    expect(r.body.error).toBe('INVALID_EMAIL_CODE')
    expect((await db.select().from(users).where(eq(users.id, userId)))[0].emailVerified).toBe(false)
  })

  it('pide sesión; las cuentas de prueba locales no confirman correo', async () => {
    expect((await request(app).post('/api/me/email/code')).status).toBe(401)
    await createUser('local-correo@prueba.test', ['funcionario'])
    const r = await (await loginAs('local-correo@prueba.test')).post('/api/me/email/code')
    expect(r.status).toBe(409)
    expect(r.body.error).toBe('EMAIL_VERIFICATION_UNAVAILABLE')
  })

  it('máximo 3 códigos cada 10 minutos por persona', async () => {
    const { agent } = await entrar(persona())
    for (let i = 0; i < 3; i++) expect((await agent.post('/api/me/email/code')).status).toBe(200)
    const r = await agent.post('/api/me/email/code')
    expect(r.status).toBe(429)
    expect(r.body.error).toBe('RATE_LIMITED')
  })
})

describe('borrar una cuenta (administración) le quita el acceso en Identity Central', () => {
  it('con la cuenta de servicio: revoca el acceso a la intranet, vacía la cuenta y no la deja volver', async () => {
    central.addUser({ username: 'servicio@alcaldia.test', password: 'clave-del-servicio', sub: crypto.randomUUID(), fullName: 'Servicio API' })
    await createUser('admin-borrar-ic@prueba.test', ['admin'])
    const admin = await loginAs('admin-borrar-ic@prueba.test')
    const p = persona()
    const { userId } = await entrar(p)

    const r = await admin.delete(`/api/users/${userId}`)
    expect(r.status).toBe(204)
    expect(central.revokedAccess).toContainEqual({ userId: p.sub, applicationId: process.env.IDENTITY_CLIENT_ID })
    expect(await userBySub(p.sub)).toMatchObject({ firstName: 'Cuenta eliminada', email: null })

    const otra = await login(p)
    expect(otra.status).toBe(403)
    expect(otra.body.error).toBe('ACCOUNT_SUSPENDED')
    expect(await userBySub(p.sub)).toMatchObject({ firstName: 'Cuenta eliminada', email: null })
  })

  it('si el central rechaza la operación no se borra nada aquí', async () => {
    const admin = await loginAs('admin-borrar-ic@prueba.test')
    const p = persona()
    const { userId } = await entrar(p)
    central.users.delete('servicio@alcaldia.test')
    const r = await admin.delete(`/api/users/${userId}`)
    expect(r.status).toBe(502)
    expect(r.body.error).toBe('IDENTITY_ADMIN_FAILED')
    expect(await userBySub(p.sub)).toMatchObject({ email: p.email!.toLowerCase() })
  })
})

// Al final: el límite es por IP y todas las pruebas salen de la misma.
describe('límite de registros', () => {
  it('después de 20 registros por hora desde la misma red responde 429', async () => {
    let status = 0
    for (let i = 0; i < 25 && status !== 429; i++) status = (await registrar(registro({ departmentId: 999_999 }))).status
    expect(status).toBe(429)
  })
})


describe('reiniciar perfil de Identity Central', () => {
  it('solo administración; no permite reiniciar su cuenta, cuentas locales o ids inexistentes', async () => {
    const local = await createUser('reset-local@prueba.test', ['admin'])
    const admin = await loginAs('reset-local@prueba.test')
    const p = persona()
    const { agent, userId } = await entrar(p)
    expect((await request(app).post(`/api/users/${userId}/reset`)).status).toBe(401)
    expect((await agent.post(`/api/users/${userId}/reset`)).status).toBe(403)
    expect((await admin.post(`/api/users/${local.id}/reset`)).body.error).toBe('CANNOT_MODIFY_SELF')
    const otro = await createUser('reset-otro-local@prueba.test', ['funcionario'])
    expect((await admin.post(`/api/users/${otro.id}/reset`)).body.error).toBe('IDENTITY_PROFILE_REQUIRED')
    expect((await admin.post('/api/users/999999/reset')).status).toBe(404)
  })

  it('no reinicia una cuenta suspendida (se perdería la suspensión)', async () => {
    await createUser('reset-susp@prueba.test', ['admin'])
    const admin = await loginAs('reset-susp@prueba.test')
    const { userId } = await entrar(persona())
    expect((await admin.post(`/api/users/${userId}/suspend`)).status).toBe(200)
    const r = await admin.post(`/api/users/${userId}/reset`)
    expect(r.status).toBe(409)
    expect(r.body.error).toBe('ACCOUNT_SUSPENDED')
    expect((await admin.get('/api/users')).body.find((u: { id: number }) => u.id === userId).suspendedAt).toBeTruthy()
  })

  it('elimina el perfil y sus datos; permite entrar con la misma cédula sin revocar acceso central', async () => {
    await createUser('reset-admin@prueba.test', ['admin'])
    const admin = await loginAs('reset-admin@prueba.test')
    const p = persona({ username: '0-000-0099' })
    const { agent, userId } = await entrar(p)
    const { FORM_PRUEBA, RESPUESTAS_BIEN } = await import('../solicitudes-fixture.ts')
    const { requests, homeLayouts } = await import('../../src/database/schema/index.ts')
    const slug = (await admin.post('/api/forms').send(FORM_PRUEBA)).body.slug
    expect((await agent.post('/api/requests').send({ form: slug, respuestas: RESPUESTAS_BIEN })).status).toBe(201)
    expect((await db.select().from(requests).where(eq(requests.userId, userId))).length).toBe(1)
    await db.insert(homeLayouts).values({ userId, layout: [{ id: 'buscador', ancho: 'media' }] })
    const llamadas = central.requests.length
    expect((await admin.post(`/api/users/${userId}/reset`)).status).toBe(204)
    expect(central.requests.length).toBe(llamadas)
    expect(await userBySub(p.sub)).toBeUndefined()
    expect(await sessionOf(userId)).toBeUndefined()
    expect(await db.select().from(requests).where(eq(requests.userId, userId))).toEqual([])
    expect(await db.select().from(homeLayouts).where(eq(homeLayouts.userId, userId))).toEqual([])
    expect((await agent.get('/api/auth/session')).body).toBeNull()
    const nuevo = await entrar(p)
    expect(nuevo.userId).not.toBe(userId)
    expect((await userBySub(p.sub)).deletedAt).toBeNull()
  })
})
