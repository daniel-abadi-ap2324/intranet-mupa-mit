import { beforeAll, describe, expect, it } from 'vitest'

import { anonymous, createApplication, createUser, loginAs } from './helpers.ts'

type Agente = Awaited<ReturnType<typeof loginAs>>
let admin: Agente
let ana: { id: number }
let beto: { id: number }

beforeAll(async () => {
  await createUser('admin@prueba.test', ['admin'])
  ana = await createUser('ana@prueba.test', ['funcionario'], 'Ana')
  beto = await createUser('beto@prueba.test', ['funcionario'], 'Beto')
  await createUser('comu@prueba.test', ['comunicacion'])
  await createUser('gestor@prueba.test', ['gestorSolicitudes'])
  admin = await loginAs('admin@prueba.test')
})

const crearDepartamento = async (name: string) => {
  const r = await admin.post('/api/departments').send({ name })
  expect(r.status).toBe(201)
  return r.body as { id: number; name: string }
}

describe('quién gestiona departamentos y personas', () => {
  it('sin sesión 401; cualquier rol que no sea admin 403', async () => {
    expect((await anonymous().get('/api/departments')).status).toBe(401)
    expect((await anonymous().get('/api/users')).status).toBe(401)
    for (const quien of ['ana@prueba.test', 'comu@prueba.test', 'gestor@prueba.test']) {
      const agente = await loginAs(quien)
      expect((await agente.get('/api/departments')).status, quien).toBe(403)
      expect((await agente.post('/api/departments').send({ name: 'X' })).status, quien).toBe(403)
      expect((await agente.get('/api/users')).status, quien).toBe(403)
      expect((await agente.patch(`/api/users/${ana.id}`).send({ departmentId: null })).status, quien).toBe(403)
    }
  })
})

describe('departamentos', () => {
  it('la lista para elegir (registro) es pública y solo trae id y nombre, por nombre', async () => {
    const b = await crearDepartamento('Zeta opciones')
    const a = await crearDepartamento('Alfa opciones')
    const r = await anonymous().get('/api/departments/options')
    expect(r.status).toBe(200)
    const nuestros = r.body.filter((d: { name: string }) => d.name.endsWith(' opciones'))
    expect(nuestros).toEqual([
      { id: a.id, name: 'Alfa opciones' },
      { id: b.id, name: 'Zeta opciones' },
    ])
  })

  it('crea, renombra y no repite nombres', async () => {
    const d = await crearDepartamento('Tecnología')
    expect(d).toMatchObject({ name: 'Tecnología', users: 0, applications: 0 })
    expect((await admin.post('/api/departments').send({ name: 'Tecnología' })).body.error).toBe('DEPARTMENT_NAME_TAKEN')
    expect((await admin.post('/api/departments').send({ name: '  ' })).status).toBe(400)
    const r = await admin.patch(`/api/departments/${d.id}`).send({ name: 'Tecnología e Innovación' })
    expect(r.body.name).toBe('Tecnología e Innovación')
    expect((await admin.patch('/api/departments/99999').send({ name: 'Otro' })).status).toBe(404)
  })

  it('no se borra uno con personas o aplicaciones; vacío sí', async () => {
    const d = await crearDepartamento('Tesorería')
    expect((await admin.patch(`/api/users/${beto.id}`).send({ departmentId: d.id })).status).toBe(200)
    const conPersona = await admin.delete(`/api/departments/${d.id}`)
    expect(conPersona.status).toBe(409)
    expect(conPersona.body.error).toBe('DEPARTMENT_IN_USE')

    await admin.patch(`/api/users/${beto.id}`).send({ departmentId: null })
    await createApplication({ name: 'App de Tesorería', url: 'https://tesoreria.ejemplo.gob.pa' })
    const app = (await admin.get('/api/applications')).body.find((a: { name: string }) => a.name === 'App de Tesorería')
    await admin.patch(`/api/applications/${app.id}`).send({ departmentIds: [d.id] })
    expect((await admin.delete(`/api/departments/${d.id}`)).status).toBe(409)

    await admin.patch(`/api/applications/${app.id}`).send({ departmentIds: [] })
    expect((await admin.delete(`/api/departments/${d.id}`)).status).toBe(204)
    expect((await admin.delete(`/api/departments/${d.id}`)).status).toBe(404)
  })
})

describe('personas', () => {
  it('lista con su departamento y filtra por departamento, sin departamento y búsqueda', async () => {
    const d = await crearDepartamento('Legal y Justicia')
    const r = await admin.patch(`/api/users/${ana.id}`).send({ departmentId: d.id })
    expect(r.body).toMatchObject({ id: ana.id, departmentId: d.id, departmentName: 'Legal y Justicia', source: 'local' })

    const delDepto = (await admin.get(`/api/users?department=${d.id}`)).body
    expect(delDepto.map((u: { firstName: string }) => u.firstName)).toEqual(['Ana'])
    const sin = (await admin.get('/api/users?withoutDepartment=true')).body
    expect(sin.some((u: { id: number }) => u.id === ana.id)).toBe(false)
    expect(sin.some((u: { id: number }) => u.id === beto.id)).toBe(true)
    expect((await admin.get('/api/users?q=bet')).body.map((u: { firstName: string }) => u.firstName)).toEqual(['Beto'])
    // Un % en la búsqueda es texto, no comodín.
    expect((await admin.get('/api/users?q=%25')).body).toEqual([])
  })

  it('la sesión trae el departamento y el último ingreso queda registrado', async () => {
    const sesion = (await (await loginAs('ana@prueba.test')).get('/api/auth/session')).body
    expect(sesion.departmentId).toEqual(expect.any(Number))
    const lista = (await admin.get('/api/users?q=ana@')).body
    expect(lista[0].lastLoginAt).not.toBeNull()
  })

  it('un departamento que no existe da 400; una persona que no existe, 404; solo se cambia el departamento', async () => {
    expect((await admin.patch(`/api/users/${ana.id}`).send({ departmentId: 99999 })).body.error).toBe('DEPARTMENT_NOT_FOUND')
    expect((await admin.patch('/api/users/99999').send({ departmentId: null })).status).toBe(404)
    expect((await admin.patch(`/api/users/${ana.id}`).send({ roles: ['admin'] })).status).toBe(400)
  })
})
