import request from 'supertest'
import { beforeAll, describe, expect, it } from 'vitest'

import { app } from '../src/app.ts'
import { anonymous, createUser, loginAs, PASSWORD } from './helpers.ts'

// Cuentas locales (LOCAL_LOGIN_ENABLED, sin Identity Central). Identity Central: tests/identity.

beforeAll(async () => {
  await createUser('ana@prueba.test', ['funcionario'], 'Ana')
  await createUser('bloqueo@prueba.test', ['funcionario'])
})

describe('POST /api/auth/login', () => {
  it('entra, pone una cookie HttpOnly y devuelve la cuenta sin datos internos', async () => {
    const r = await anonymous().post('/api/auth/login').send({ username: 'ANA@prueba.test', password: PASSWORD })
    expect(r.status).toBe(200)
    expect(r.body).toEqual({ id: expect.any(Number), email: 'ana@prueba.test', emailVerified: null, firstName: 'Ana', lastName: null, roles: ['funcionario'], departmentId: null, tourSeenAt: null })
    const cookie = String(r.headers['set-cookie'])
    expect(cookie).toMatch(/mupa_sesion=[\w-]+/)
    expect(cookie).toMatch(/HttpOnly/i)
    expect(cookie).toMatch(/SameSite=Lax/i)
  })

  it('con la clave equivocada responde 401 INVALID_CREDENTIALS', async () => {
    const r = await anonymous().post('/api/auth/login').send({ username: 'ana@prueba.test', password: 'mala' })
    expect(r.status).toBe(401)
    expect(r.body).toEqual({ error: 'INVALID_CREDENTIALS', message: expect.any(String) })
  })

  it('un usuario sin cuenta responde igual que una clave equivocada', async () => {
    const r = await anonymous().post('/api/auth/login').send({ username: 'nadie@prueba.test', password: 'x' })
    expect(r.status).toBe(401)
    expect(r.body.error).toBe('INVALID_CREDENTIALS')
  })

  it('valida el cuerpo y devuelve TODOS los campos inválidos', async () => {
    const r = await anonymous().post('/api/auth/login').send({ username: '   ', extra: 1 })
    expect(r.status).toBe(400)
    expect(r.body.error).toBe('VALIDATION_ERROR')
    const campos = r.body.fields.map((f: { field: string }) => f.field)
    expect(campos).toEqual(expect.arrayContaining(['username', 'password']))
    expect(r.body.fields.length).toBeGreaterThanOrEqual(3)
  })

  it('bloquea la cuenta 10 minutos después de 5 intentos fallidos', async () => {
    for (let i = 0; i < 5; i++) {
      expect((await anonymous().post('/api/auth/login').send({ username: 'bloqueo@prueba.test', password: 'mala' })).status).toBe(401)
    }
    const r = await anonymous().post('/api/auth/login').send({ username: 'bloqueo@prueba.test', password: PASSWORD })
    expect(r.status).toBe(429)
    expect(r.body.error).toBe('ACCOUNT_LOCKED')
  })
})

describe('sesión', () => {
  it('sin sesión /api/auth/session devuelve null', async () => {
    const r = await anonymous().get('/api/auth/session')
    expect(r.status).toBe(200)
    expect(r.body).toBeNull()
  })

  it('con sesión devuelve la cuenta; al salir la cookie deja de servir', async () => {
    const agent = await loginAs('ana@prueba.test')
    expect((await agent.get('/api/auth/session')).body.email).toBe('ana@prueba.test')

    const cookie = (await request(app).post('/api/auth/login').send({ username: 'ana@prueba.test', password: PASSWORD })).headers['set-cookie']
    const salir = await request(app).post('/api/auth/logout').set('Cookie', cookie)
    expect(salir.status).toBe(204)
    expect(String(salir.headers['set-cookie'])).toMatch(/mupa_sesion=;/)
    // La misma cookie, ya cerrada, no abre sesión.
    expect((await request(app).get('/api/auth/session').set('Cookie', cookie)).body).toBeNull()
  })

  it('una cookie inventada no abre sesión', async () => {
    const r = await request(app).get('/api/auth/session').set('Cookie', 'mupa_sesion=inventada')
    expect(r.body).toBeNull()
  })
})
