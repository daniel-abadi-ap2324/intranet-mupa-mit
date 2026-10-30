import fs from 'node:fs'
import path from 'node:path'

import { eq, sql } from 'drizzle-orm'
import { beforeAll, describe, expect, it } from 'vitest'

import { db } from '../src/config/database.ts'
import { applications, forms } from '../src/database/schema/index.ts'
import { runSeed } from '../src/database/seeder.ts'
import { anonymous, createApplication, createUser, loginAs } from './helpers.ts'

type Agente = Awaited<ReturnType<typeof loginAs>>
let gestor: Agente

beforeAll(async () => {
  await runSeed({ demoUsers: false })
  await createUser('gestor@prueba.test', ['gestorSolicitudes'], 'Gina')
  await createUser('ana@prueba.test', ['funcionario'])
  await createUser('comu@prueba.test', ['comunicacion'])
  gestor = await loginAs('gestor@prueba.test')
})

const simple = {
  title: 'Solicitud de prueba',
  area: 'Tecnología',
  destination: 'Mesa de Servicios',
  sections: [
    {
      title: 'Qué necesitas',
      fields: [
        { k: 'tipo', l: 'Tipo', t: 'radio', r: true, opts: ['Equipo', 'Otro'] },
        { l: 'Detalle', t: 'textarea' },
      ],
    },
    { title: 'Solo si es otro', show: { k: 'tipo', v: 'Otro' }, fields: [{ l: 'Cuál', t: 'text', r: true }] },
  ],
}

describe('formularios', () => {
  it('los 7 del sitio actual se ven (código de llamadas va por su propio sistema), sin recibir solicitudes, y cumplen las reglas del constructor', async () => {
    const lista = (await anonymous().get('/api/forms')).body as { slug: string; accepting: boolean; area: string }[]
    expect(lista).toHaveLength(7)
    // RRHH maneja sus trámites como siempre (5-oct-2026): la carta de trabajo y la certificación ya no son formularios.
    expect(lista.map((f) => f.slug)).not.toContain('carta-de-trabajo')
    expect(lista.map((f) => f.slug)).not.toContain('certificacion')
    expect(lista.map((f) => f.slug)).not.toContain('codigo-de-llamadas')
    expect(lista.every((f) => !f.accepting)).toBe(true)
    expect(new Set(lista.map((f) => f.area))).toEqual(new Set(['Tecnología']))
    // Guardar sus secciones tal cual pasa la misma validación que un formulario nuevo.
    const todos = (await gestor.get('/api/forms/manage')).body as { id: number; slug: string; sections: unknown[] }[]
    for (const f of todos) expect((await gestor.patch(`/api/forms/${f.id}`).send({ sections: f.sections })).status, f.slug).toBe(200)
  })

  it('un formulario «a definir» no recibe solicitudes hasta quitarle la marca', async () => {
    const aDefinir = {
      ...simple,
      title: 'Constancia a definir',
      area: 'Recursos Humanos',
      pendingDefinition: true,
      sections: [{ title: 'Quién', fields: [{ l: 'Cédula', t: 'cedula', r: true }] }],
    }
    const creado = await gestor.post('/api/forms').send(aDefinir)
    expect(creado.status).toBe(201)
    const id = creado.body.id as number
    const slug = creado.body.slug as string
    expect(creado.body).toMatchObject({ pendingDefinition: true, accepting: false })
    expect((await anonymous().get(`/api/forms/${slug}`)).body).toMatchObject({ pendingDefinition: true, accepting: false })

    const r = await gestor.patch(`/api/forms/${id}`).send({ accepting: true })
    expect(r.status).toBe(409)
    expect(r.body.error).toBe('FORM_PENDING_DEFINITION')
    // Marcar y prender en el mismo cambio tampoco pasa.
    expect((await gestor.patch(`/api/forms/${id}`).send({ accepting: true, pendingDefinition: true })).body.error).toBe('FORM_PENDING_DEFINITION')

    // Sin la marca sigue valiendo la regla de las cédulas: este formulario la pide, así que aún no recibe solicitudes.
    expect((await gestor.patch(`/api/forms/${id}`).send({ pendingDefinition: false })).body.pendingDefinition).toBe(false)
    expect((await gestor.patch(`/api/forms/${id}`).send({ accepting: true })).body.error).toBe('FORM_HAS_CEDULA')
    expect((await gestor.delete(`/api/forms/${id}`)).status).toBe(204)
  })

  it('permisos: leer es público; el panel y los cambios son del Gestor (y administración)', async () => {
    expect((await anonymous().get('/api/forms/manage')).status).toBe(401)
    for (const quien of ['ana@prueba.test', 'comu@prueba.test']) {
      const a = await loginAs(quien)
      expect((await a.get('/api/forms/manage')).status, quien).toBe(403)
      expect((await a.post('/api/forms').send(simple)).status, quien).toBe(403)
    }
  })

  it('crea con slug y el siguiente número; se despublica y se borra', async () => {
    const r = await gestor.post('/api/forms').send(simple)
    expect(r.status).toBe(201)
    expect(r.body).toMatchObject({ slug: 'solicitud-de-prueba', number: 22, accepting: false, published: true, updatedByName: 'Gina' })
    expect((await anonymous().get('/api/forms/solicitud-de-prueba')).status).toBe(200)
    await gestor.patch(`/api/forms/${r.body.id}`).send({ published: false })
    expect((await anonymous().get('/api/forms/solicitud-de-prueba')).status).toBe(404)
    expect((await gestor.post('/api/forms').send({ ...simple, number: 22 })).body.error).toBe('FORM_NUMBER_TAKEN')
    expect((await gestor.delete(`/api/forms/${r.body.id}`)).status).toBe(204)
  })

  it('valida la definición: opciones, casillas, listas, claves y condiciones', async () => {
    const con = (fields: unknown[]) => ({ ...simple, sections: [{ title: 'S', fields }] })
    const r = await gestor.post('/api/forms').send(con([{ l: 'Elige', t: 'radio', opts: ['Solo una'] }, { l: 'Marca', t: 'checks' }, { l: 'Lista', t: 'repeat' }, { k: 'Mal Clave', l: 'x', t: 'text' }]))
    expect(r.status).toBe(400)
    expect(r.body.fields.map((f: { field: string }) => f.field).sort()).toEqual(['sections.0.fields.0.opts', 'sections.0.fields.1.items', 'sections.0.fields.2.fields', 'sections.0.fields.3.k'])
    expect((await gestor.post('/api/forms').send({ ...simple, sections: [] })).status).toBe(400)
    expect((await gestor.post('/api/forms').send({ ...simple, sections: [{ title: 'S', fields: [{ l: 'x', t: 'html' }] }] })).status).toBe(400)

    const condicionMala = { ...simple, sections: [simple.sections[0], { ...simple.sections[1], show: { k: 'tipo', v: 'No existe' } }] }
    expect((await gestor.post('/api/forms').send(condicionMala)).body.error).toBe('INVALID_FORM_CONDITION')
  })

  it('no recibe solicitudes si pide cédula (la intranet no guarda cédulas)', async () => {
    const conCedula = { ...simple, title: 'Con cédula', sections: [{ title: 'S', fields: [{ l: 'Cédula', t: 'cedula' }] }] }
    const r = await gestor.post('/api/forms').send({ ...conCedula, accepting: true })
    expect(r.status).toBe(409)
    expect(r.body.error).toBe('FORM_HAS_CEDULA')
    const creado = (await gestor.post('/api/forms').send(conCedula)).body
    expect((await gestor.patch(`/api/forms/${creado.id}`).send({ accepting: true })).body.error).toBe('FORM_HAS_CEDULA')
    const sinCedula = await gestor.patch(`/api/forms/${creado.id}`).send({ accepting: true, sections: simple.sections })
    expect(sinCedula.status).toBe(200)
    expect(sinCedula.body.accepting).toBe(true)
  })
})

describe('migración 0014: código de llamadas por su propio sistema', () => {
  it('quita el formulario de las bases ya cargadas y pasa el enlace del sistema a https', async () => {
    await db.insert(forms).values({ slug: 'codigo-de-llamadas', number: 911, title: 'Solicitud para Código de Llamadas', area: 'Tecnología', sections: [], accepting: true })
    await createApplication({ name: 'Código de llamadas', slug: 'codigo-llamadas-mig', url: 'http://cdr.mupa.gob.pa/pinrequests' })

    const archivo = path.join(import.meta.dirname, '../src/database/migrations/0014_codigo-llamadas-sistema-propio.sql')
    for (const sentencia of fs.readFileSync(archivo, 'utf8').split('--> statement-breakpoint')) await db.execute(sql.raw(sentencia))

    expect(await db.select().from(forms).where(eq(forms.slug, 'codigo-de-llamadas'))).toEqual([])
    const [app] = await db.select().from(applications).where(eq(applications.slug, 'codigo-llamadas-mig'))
    expect(app.url).toBe('https://cdr.mupa.gob.pa/pinrequests')
  })
})
