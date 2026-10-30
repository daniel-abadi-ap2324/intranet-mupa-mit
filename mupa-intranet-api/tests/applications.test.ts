import fs from 'node:fs'
import path from 'node:path'

import { inArray, sql } from 'drizzle-orm'
import { beforeAll, describe, expect, it } from 'vitest'

import { db } from '../src/config/database.ts'
import { applications } from '../src/database/schema/index.ts'
import { anonymous, createApplication, createTag, createUser, loginAs } from './helpers.ts'

let salud: { id: number }
let interno: { id: number }

beforeAll(async () => {
  // El catálogo solo lo edita administración.
  await createUser('editora@prueba.test', ['admin'])
  await createUser('ana@prueba.test', ['funcionario'])
  await createUser('comu@prueba.test', ['comunicacion'])
  await createUser('gestor@prueba.test', ['gestorSolicitudes'])
  salud = await createTag('Salud')
  interno = await createTag('Uso interno', true)
  await createApplication({ name: 'Publica', url: 'https://publica.ejemplo.gob.pa', featured: true, note: 'nota secreta' }, [salud.id, interno.id])
  await createApplication({ name: 'Panel con sesion', url: 'https://panel.ejemplo.gob.pa', access: 'sesion' })
  await createApplication({ name: 'Solo red interna', url: 'https://interna.ejemplo.gob.pa', access: 'red-interna' })
  await createApplication({ name: 'Borrador', url: 'https://borrador.ejemplo.gob.pa', published: false })
})

const nombres = (body: { name: string }[]) => body.map((a) => a.name).sort()

describe('GET /api/applications', () => {
  it('sin sesión: solo publicadas y sin los paneles de "sesion"', async () => {
    const r = await anonymous().get('/api/applications')
    expect(r.status).toBe(200)
    expect(nombres(r.body)).toEqual(['Publica', 'Solo red interna'])
  })

  it('con sesión: también los paneles, nunca borradores ni la nota interna', async () => {
    const r = await (await loginAs('ana@prueba.test')).get('/api/applications')
    expect(nombres(r.body)).toEqual(['Panel con sesion', 'Publica', 'Solo red interna'])
    const publica = r.body.find((a: { name: string }) => a.name === 'Publica')
    expect(publica.note).toBeUndefined()
    expect(publica.tags.map((t: { name: string }) => t.name)).toEqual(['Salud', 'Uso interno'])
    expect(publica.tags.find((t: { name: string }) => t.name === 'Uso interno').audience).toBe(true)
  })

  it('las de "solo red interna" no entregan su dirección fuera del catálogo', async () => {
    const r = await anonymous().get('/api/applications')
    expect(r.body.find((a: { name: string }) => a.name === 'Solo red interna').url).toBeNull()
    const e = await (await loginAs('editora@prueba.test')).get('/api/applications')
    expect(e.body.find((a: { name: string }) => a.name === 'Solo red interna').url).toBe('https://interna.ejemplo.gob.pa')
  })

  it('borradores: solo para quien edita el catálogo', async () => {
    const ana = await (await loginAs('ana@prueba.test')).get('/api/applications?includeDrafts=true')
    expect(ana.status).toBe(403)
    const e = await (await loginAs('editora@prueba.test')).get('/api/applications?includeDrafts=true')
    expect(nombres(e.body)).toContain('Borrador')
    expect(e.body.find((a: { name: string }) => a.name === 'Publica').note).toBe('nota secreta')
  })

  it('un borrador no existe para quien no edita', async () => {
    const lista = (await (await loginAs('editora@prueba.test')).get('/api/applications?includeDrafts=true')).body
    const borrador = lista.find((a: { name: string }) => a.name === 'Borrador')
    const r = await anonymous().get(`/api/applications/${borrador.id}`)
    expect(r.status).toBe(404)
    expect(r.body.error).toBe('APPLICATION_NOT_FOUND')
  })
})

describe('crear, cambiar y borrar', () => {
  const nueva = { name: 'Portal de Prüebas', description: 'Sistema ficticio.', area: 'Operaciones', url: 'https://portal-pruebas.ejemplo.gob.pa' }

  it('sin sesión 401; funcionario, comunicación y gestor de solicitudes 403', async () => {
    expect((await (await loginAs('gestor@prueba.test')).post('/api/applications').send(nueva)).status).toBe(403)
    expect((await anonymous().post('/api/applications').send(nueva)).status).toBe(401)
    expect((await (await loginAs('ana@prueba.test')).post('/api/applications').send(nueva)).status).toBe(403)
    expect((await (await loginAs('comu@prueba.test')).post('/api/applications').send(nueva)).status).toBe(403)
  })

  it('una IP o un nombre interno se rechazan si la aplicación no es «Solo red interna»', async () => {
    const editora = await loginAs('editora@prueba.test')
    const ip = await editora.post('/api/applications').send({ ...nueva, url: 'http://192.0.2.10/app' })
    expect(ip.status).toBe(400)
    expect(ip.body.error).toBe('INTERNAL_LINK_NOT_ALLOWED')
    const interno = await editora.post('/api/applications').send({ ...nueva, url: 'http://servidor-rrhh/', area: 'Otra', name: '' })
    expect(interno.status).toBe(400)
    // Los campos mal escritos siguen saliendo; la dirección interna se valida aparte, en el servicio.
    expect(interno.body.fields.map((f: { field: string }) => f.field).sort()).toEqual(['area', 'name'])
    for (const url of ['/\\ejemplo.com', 'ftp://srv.mupa.gob.pa/x']) {
      const r = await editora.post('/api/applications').send({ ...nueva, url })
      expect(r.status, url).toBe(400)
      expect(r.body.fields[0].field).toBe('url')
    }
    // Un nombre .local también es interno: sin «Solo red interna», no.
    const local = await editora.post('/api/applications').send({ ...nueva, url: 'https://srv.mupa.local/x' })
    expect(local.body.error).toBe('INTERNAL_LINK_NOT_ALLOWED')
  })

  it('«Solo red interna» sí puede llevar una IP o un nombre interno; cambiarle el estado no deja la dirección', async () => {
    const editora = await loginAs('editora@prueba.test')
    const r = await editora.post('/api/applications').send({ ...nueva, name: 'Sistema de red interna', url: 'http://192.0.2.10/app', status: 'solo-red-interna' })
    expect(r.status).toBe(201)
    expect(r.body).toMatchObject({ url: 'http://192.0.2.10/app', status: 'solo-red-interna' })
    // Todas las personas reciben el enlace (acceso «todos»): la etiqueta avisa que solo abre dentro de la Alcaldía.
    expect((await anonymous().get('/api/applications/' + r.body.id)).body.url).toBe('http://192.0.2.10/app')
    // Volverla «publicado» con esa dirección interna se rechaza.
    const mal = await editora.patch('/api/applications/' + r.body.id).send({ status: 'publicado' })
    expect(mal.status).toBe(400)
    expect(mal.body.error).toBe('INTERNAL_LINK_NOT_ALLOWED')
    expect((await editora.patch('/api/applications/' + r.body.id).send({ status: 'publicado', url: 'https://sistema.ejemplo.gob.pa' })).status).toBe(200)
    expect((await editora.delete('/api/applications/' + r.body.id)).status).toBe(204)
  })

  it('acepta http con dominio (hay sistemas que todavía no tienen https)', async () => {
    const editora = await loginAs('editora@prueba.test')
    const r = await editora.post('/api/applications').send({ ...nueva, name: 'Sistema sin cifrado', url: 'http://sin-cifrado.ejemplo.gob.pa' })
    expect(r.status).toBe(201)
    expect((await editora.delete(`/api/applications/${r.body.id}`)).status).toBe(204)
  })

  it('crea con slug generado y etiquetas; una etiqueta inexistente o una URL repetida fallan', async () => {
    const editora = await loginAs('editora@prueba.test')
    const r = await editora.post('/api/applications').send({ ...nueva, tagIds: [salud.id] })
    expect(r.status).toBe(201)
    expect(r.body).toMatchObject({ slug: 'portal-de-pruebas', published: true, access: 'todos', tags: [{ name: 'Salud' }] })

    const repetida = await editora.post('/api/applications').send({ ...nueva, name: 'Otra' })
    expect(repetida.status).toBe(409)
    expect(repetida.body.error).toBe('URL_ALREADY_USED')

    const etiqueta = await editora.post('/api/applications').send({ ...nueva, url: 'https://otra.ejemplo.gob.pa', tagIds: [9999] })
    expect(etiqueta.status).toBe(400)
    expect(etiqueta.body.error).toBe('TAG_NOT_FOUND')

    // Mismo nombre, otra URL: el slug no se repite.
    const gemela = await editora.post('/api/applications').send({ ...nueva, url: 'https://gemela.ejemplo.gob.pa' })
    expect(gemela.body.slug).toBe('portal-de-pruebas-2')

    // Aparece en el catálogo público.
    expect(nombres((await anonymous().get('/api/applications')).body)).toContain('Portal de Prüebas')
  })

  it('cambia campos y reemplaza etiquetas; borra', async () => {
    const editora = await loginAs('editora@prueba.test')
    const { body: creada } = await editora.post('/api/applications').send({ ...nueva, name: 'Cambiable', url: 'https://cambiable.ejemplo.gob.pa', tagIds: [salud.id] })

    const vacio = await editora.patch(`/api/applications/${creada.id}`).send({})
    expect(vacio.status).toBe(400)

    const r = await editora.patch(`/api/applications/${creada.id}`).send({ description: 'Nueva descripción', tagIds: [interno.id], url: null })
    expect(r.status).toBe(200)
    expect(r.body).toMatchObject({ description: 'Nueva descripción', url: null, slug: 'cambiable', tags: [{ name: 'Uso interno' }] })

    expect((await editora.delete(`/api/applications/${creada.id}`)).status).toBe(204)
    expect((await editora.get(`/api/applications/${creada.id}`)).status).toBe(404)
    expect((await editora.delete(`/api/applications/${creada.id}`)).status).toBe(404)
  })

  it('un id que no es número es un error de validación', async () => {
    const r = await anonymous().get('/api/applications/abc')
    expect(r.status).toBe(400)
    expect(r.body.fields[0].field).toBe('id')
  })
})

describe('GET /api/tags', () => {
  it('lista las etiquetas ordenadas', async () => {
    const r = await anonymous().get('/api/tags')
    expect(r.body.map((t: { name: string }) => t.name)).toEqual(['Salud', 'Uso interno'])
  })
})

describe('aplicaciones por departamento', () => {
  it('una app restringida solo la ven sus departamentos (y administración); sin sesión nunca', async () => {
    const admin = await loginAs('editora@prueba.test')
    const rrhh = (await admin.post('/api/departments').send({ name: 'Recursos Humanos' })).body
    const ti = (await admin.post('/api/departments').send({ name: 'Tecnología' })).body
    const personaRrhh = await createUser('rrhh@prueba.test', ['funcionario'])
    const personaTi = await createUser('ti@prueba.test', ['funcionario'])
    await admin.patch(`/api/users/${personaRrhh.id}`).send({ departmentId: rrhh.id })
    await admin.patch(`/api/users/${personaTi.id}`).send({ departmentId: ti.id })

    const creada = await admin
      .post('/api/applications')
      .send({ name: 'Planilla RRHH', description: 'Solo para RRHH.', area: 'Personal', url: 'https://planilla.ejemplo.gob.pa', departmentIds: [rrhh.id, rrhh.id] })
    expect(creada.status).toBe(201)
    expect(creada.body.departments).toEqual([{ id: rrhh.id, name: 'Recursos Humanos' }])

    const ve = async (agente: ReturnType<typeof anonymous> | Awaited<ReturnType<typeof loginAs>>) =>
      (await agente.get('/api/applications')).body.some((a: { name: string }) => a.name === 'Planilla RRHH')
    expect(await ve(await loginAs('rrhh@prueba.test'))).toBe(true)
    expect(await ve(await loginAs('ti@prueba.test'))).toBe(false)
    expect(await ve(await loginAs('ana@prueba.test'))).toBe(false)
    expect(await ve(anonymous())).toBe(false)
    expect(await ve(admin)).toBe(true)

    // Tampoco por id, y quien no edita el catálogo no ve a qué departamentos está restringida.
    expect((await (await loginAs('ti@prueba.test')).get(`/api/applications/${creada.body.id}`)).status).toBe(404)
    const vista = await (await loginAs('rrhh@prueba.test')).get(`/api/applications/${creada.body.id}`)
    expect(vista.status).toBe(200)
    expect(vista.body.departments).toBeUndefined()

    // Las apps sin departamentos siguen visibles para todos.
    expect((await (await loginAs('ti@prueba.test')).get('/api/applications')).body.some((a: { name: string }) => a.name === 'Publica')).toBe(true)
  })

  it('administración ve lo que ve un departamento; nadie más puede usar ese filtro', async () => {
    const admin = await loginAs('editora@prueba.test')
    const deps = (await admin.get('/api/departments')).body as { id: number; name: string }[]
    const ti = deps.find((d) => d.name === 'Tecnología')!
    const rrhh = deps.find((d) => d.name === 'Recursos Humanos')!
    const nombresDe = async (id: number) => ((await admin.get(`/api/applications?department=${id}`)).body as { name: string }[]).map((a) => a.name)
    expect(await nombresDe(rrhh.id)).toContain('Planilla RRHH')
    expect(await nombresDe(ti.id)).not.toContain('Planilla RRHH')
    expect(await nombresDe(ti.id)).toContain('Panel con sesion')
    expect((await (await loginAs('ana@prueba.test')).get(`/api/applications?department=${ti.id}`)).status).toBe(403)
  })

  it('un departamento que no existe da 400', async () => {
    const admin = await loginAs('editora@prueba.test')
    const r = await admin.post('/api/applications').send({ name: 'Con depto falso', description: 'x', area: 'Soporte', departmentIds: [99999] })
    expect(r.status).toBe(400)
    expect(r.body.error).toBe('DEPARTMENT_NOT_FOUND')
  })

  it('la descripción puede ir vacía (si no se sabe para qué sirve, mejor nada que inventarla)', async () => {
    const admin = await loginAs('editora@prueba.test')
    const r = await admin.post('/api/applications').send({ name: 'Sin descripción', description: '  ', area: 'Soporte' })
    expect(r.status).toBe(201)
    expect(r.body.description).toBe('')
  })
})

describe('PUT /api/applications/departments (clasificación en lote)', () => {
  it('cambia varias aplicaciones a la vez, valida todo antes de tocar nada y queda en la auditoría', async () => {
    const admin = await loginAs('editora@prueba.test')
    const d1 = (await admin.post('/api/departments').send({ name: 'Lote Uno' })).body
    const d2 = (await admin.post('/api/departments').send({ name: 'Lote Dos' })).body
    const a = await createApplication({ name: 'Lote A', url: 'https://lote-a.ejemplo.gob.pa' })
    const b = await createApplication({ name: 'Lote B', url: 'https://lote-b.ejemplo.gob.pa' })

    const r = await admin.put('/api/applications/departments').send([
      { applicationId: a.id, departmentIds: [d1.id, d1.id] },
      { applicationId: b.id, departmentIds: [d1.id, d2.id] },
    ])
    expect(r.status).toBe(200)
    expect(r.body).toEqual({ updated: 2 })
    const deps = async (id: number) => ((await admin.get(`/api/applications/${id}`)).body.departments as { id: number }[]).map((d) => d.id).sort()
    expect(await deps(a.id)).toEqual([d1.id])
    expect(await deps(b.id)).toEqual([d1.id, d2.id].sort())

    // Lista vacía = vuelve a verla todo el mundo.
    expect((await admin.put('/api/applications/departments').send([{ applicationId: b.id, departmentIds: [] }])).status).toBe(200)
    expect(await deps(b.id)).toEqual([])

    // Todo o nada: un departamento que no existe no deja cambiar ni la primera.
    const mal = await admin.put('/api/applications/departments').send([
      { applicationId: b.id, departmentIds: [d2.id] },
      { applicationId: a.id, departmentIds: [999999] },
    ])
    expect(mal.status).toBe(400)
    expect(mal.body.error).toBe('DEPARTMENT_NOT_FOUND')
    expect(await deps(b.id)).toEqual([])
    expect((await admin.put('/api/applications/departments').send([{ applicationId: 999999, departmentIds: [] }])).body.error).toBe('APPLICATION_NOT_FOUND')

    let filas: { type: string; payload: unknown }[] = []
    for (let i = 0; i < 50 && !filas.some((f) => f.type === 'aplicacion.visibilidad_cambiada'); i++) {
      filas = (await admin.get('/api/audit/events').query({ type: 'aplicacion.visibilidad_cambiada' })).body
      if (!filas.length) await new Promise((res) => setTimeout(res, 20))
    }
    expect(filas.some((f) => f.type === 'aplicacion.visibilidad_cambiada')).toBe(true)
  })

  it('valida el cuerpo y solo lo usa administración', async () => {
    const admin = await loginAs('editora@prueba.test')
    expect((await admin.put('/api/applications/departments').send([])).status).toBe(400)
    expect((await admin.put('/api/applications/departments').send([{ applicationId: 1, departmentIds: [] }, { applicationId: 1, departmentIds: [] }])).status).toBe(400)
    const ana = await loginAs('ana@prueba.test')
    expect((await ana.put('/api/applications/departments').send([{ applicationId: 1, departmentIds: [] }])).status).toBe(403)
    expect((await anonymous().put('/api/applications/departments').send([])).status).toBe(401)
  })
})

describe('migración 0015: accesos rápidos por defecto y Soporte ISTMO', () => {
  it('destaca WIFI y código de llamadas, saca el ACH (con su PDF local) y lleva ISTMO a su página', async () => {
    const ach = 'https://intranet.mupa.gob.pa/wp-content/uploads/2023/01/Afiliacion_a_Pagos_por_ACH_Funcionarios.pdf'
    await createApplication({ name: 'ACH', slug: 'ach', url: ach, external: true, featured: true })
    await createApplication({ name: 'Códigos de llamadas', slug: 'cdr', url: 'https://cdr.mupa.gob.pa/pinrequests/create' })
    await createApplication({ name: 'WIFI', slug: 'wifi', url: 'http://wifi.mupa.gob.pa:9001/solicitud' })
    await createApplication({ name: 'ISTMO', slug: 'istmo', url: 'https://caudnc.mef.gob.pa', external: true, featured: true })

    const archivo = path.join(import.meta.dirname, '../src/database/migrations/0015_accesos-rapidos-e-istmo.sql')
    for (const sentencia of fs.readFileSync(archivo, 'utf8').split('--> statement-breakpoint')) await db.execute(sql.raw(sentencia))

    const filas = await db.select().from(applications).where(inArray(applications.slug, ['ach', 'cdr', 'wifi', 'istmo']))
    const por = Object.fromEntries(filas.map((a) => [a.slug, a]))
    expect(por.cdr.featured && por.wifi.featured).toBe(true)
    expect(por.ach).toMatchObject({ featured: false, external: false, url: '/sitio/2023/01/Afiliacion_a_Pagos_por_ACH_Funcionarios.pdf' })
    expect(por.istmo).toMatchObject({ featured: true, external: false, url: '/sap-istmo' })
  })
})
