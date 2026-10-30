import { beforeAll, describe, expect, it } from 'vitest'

import { db } from '../src/config/database.ts'
import { departments } from '../src/database/schema/index.ts'
import { anonymous, createUser, loginAs } from './helpers.ts'

let deptoId = 0
let otroId = 0

beforeAll(async () => {
  const [a, b] = await db.insert(departments).values([{ name: 'Departamento A' }, { name: 'Departamento B' }]).returning()
  deptoId = a.id
  otroId = b.id
  await createUser('sin-depto@prueba.test', ['funcionario'], 'Sin')
})

describe('elegir el propio departamento (PUT /api/me/department)', () => {
  it('sin sesión es 401', async () => {
    expect((await anonymous().put('/api/me/department').send({ departmentId: deptoId })).status).toBe(401)
  })

  it('el departamento es obligatorio y tiene que existir', async () => {
    const a = await loginAs('sin-depto@prueba.test')
    expect((await a.put('/api/me/department').send({})).status).toBe(400)
    expect((await a.put('/api/me/department').send({ departmentId: null })).status).toBe(400)
    const r = await a.put('/api/me/department').send({ departmentId: 999_999 })
    expect(r.status).toBe(400)
    expect((await a.get('/api/auth/session')).body.departmentId).toBeNull()
  })

  it('quien no tiene departamento lo elige; después ya no lo cambia por su cuenta', async () => {
    const a = await loginAs('sin-depto@prueba.test')
    const r = await a.put('/api/me/department').send({ departmentId: deptoId })
    expect(r.status).toBe(200)
    expect(r.body.departmentId).toBe(deptoId)
    expect((await a.get('/api/auth/session')).body.departmentId).toBe(deptoId)

    const otra = await a.put('/api/me/department').send({ departmentId: otroId })
    expect(otra.status).toBe(409)
    expect(otra.body.error).toBe('DEPARTMENT_ALREADY_SET')
    expect((await a.get('/api/auth/session')).body.departmentId).toBe(deptoId)
  })
})
