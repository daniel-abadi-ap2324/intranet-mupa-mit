import { beforeAll, describe, expect, it } from 'vitest'

import { anonymous, createUser, loginAs, PASSWORD } from './helpers.ts'
import { FORM_PRUEBA, RESPUESTAS_BIEN } from './solicitudes-fixture.ts'

type Agente = Awaited<ReturnType<typeof loginAs>>
let admin: Agente
let adminId: number
let ana: { id: number }
let beto: { id: number }

beforeAll(async () => {
  adminId = (await createUser('admin-susp@prueba.test', ['admin'])).id
  ana = await createUser('ana-susp@prueba.test', ['funcionario'], 'Ana')
  beto = await createUser('beto-susp@prueba.test', ['funcionario'], 'Beto')
  await createUser('otro-susp@prueba.test', ['funcionario'])
  admin = await loginAs('admin-susp@prueba.test')
})

describe('suspender, reactivar y borrar cuentas', () => {
  it('solo administración', async () => {
    expect((await anonymous().post(`/api/users/${ana.id}/suspend`)).status).toBe(401)
    const otro = await loginAs('otro-susp@prueba.test')
    expect((await otro.post(`/api/users/${ana.id}/suspend`)).status).toBe(403)
    expect((await otro.delete(`/api/users/${ana.id}`)).status).toBe(403)
  })

  it('suspender cierra sus sesiones, impide entrar y se puede revertir', async () => {
    const sesion = await loginAs('ana-susp@prueba.test')
    expect((await sesion.get('/api/auth/session')).body).toMatchObject({ id: ana.id })
    const r = await admin.post(`/api/users/${ana.id}/suspend`)
    expect(r.status).toBe(200)
    expect(r.body.suspendedAt).toBeTruthy()
    expect((await sesion.get('/api/auth/session')).body).toBeNull()
    const intento = await anonymous().post('/api/auth/login').send({ username: 'ana-susp@prueba.test', password: PASSWORD })
    expect(intento.status).toBe(403)
    expect(intento.body.error).toBe('ACCOUNT_SUSPENDED')
    expect((await admin.get('/api/users')).body.find((u: { id: number }) => u.id === ana.id).suspendedAt).toBeTruthy()

    const back = await admin.post(`/api/users/${ana.id}/reactivate`)
    expect(back.body.suspendedAt).toBeNull()
    await loginAs('ana-susp@prueba.test')
  })

  it('no puede hacerlo con su propia cuenta ni con una que no existe', async () => {
    expect((await admin.post(`/api/users/${adminId}/suspend`)).body.error).toBe('CANNOT_MODIFY_SELF')
    expect((await admin.delete(`/api/users/${adminId}`)).body.error).toBe('CANNOT_MODIFY_SELF')
    expect((await admin.post('/api/users/999999/suspend')).status).toBe(404)
    expect((await admin.post('/api/users/999999/reactivate')).status).toBe(404)
    expect((await admin.delete('/api/users/999999')).status).toBe(404)
  })

  it('borra una cuenta sin solicitudes', async () => {
    expect((await admin.delete(`/api/users/${beto.id}`)).status).toBe(204)
    expect((await admin.get('/api/users')).body.some((u: { id: number }) => u.id === beto.id)).toBe(false)
  })

  it('borra una cuenta aunque ya haya hecho solicitudes, y se van con ella', async () => {
    const carla = await createUser('carla-susp@prueba.test', ['funcionario'], 'Carla')
    const slug = (await admin.post('/api/forms').send(FORM_PRUEBA)).body.slug
    const sesion = await loginAs('carla-susp@prueba.test')
    expect((await sesion.post('/api/requests').send({ form: slug, respuestas: RESPUESTAS_BIEN })).status).toBe(201)
    expect((await admin.delete(`/api/users/${carla.id}`)).status).toBe(204)
    expect((await admin.get('/api/users')).body.some((u: { id: number }) => u.id === carla.id)).toBe(false)
  })

  it('borrar una cuenta de Identity Central la vacía y la deja bloqueada: no reaparece ni se recrea', async () => {
    const { db } = await import('../src/config/database.ts')
    const { users } = await import('../src/database/schema/index.ts')
    const [dana] = await db.insert(users).values({ identitySub: 'sub-dana-borrar', email: 'dana@prueba.test', firstName: 'Dana', roles: ['funcionario'] }).returning()
    expect((await admin.delete(`/api/users/${dana.id}`)).status).toBe(204)
    expect((await admin.get('/api/users')).body.some((u: { id: number }) => u.id === dana.id)).toBe(false)
    expect((await admin.post(`/api/users/${dana.id}/reactivate`)).status).toBe(404)
    const { eq } = await import('drizzle-orm')
    const [fila] = await db.select().from(users).where(eq(users.id, dana.id))
    expect(fila).toMatchObject({ email: null, firstName: 'Cuenta eliminada', identitySub: 'sub-dana-borrar' })
    expect(fila.suspendedAt && fila.deletedAt).toBeTruthy()
  })
})
