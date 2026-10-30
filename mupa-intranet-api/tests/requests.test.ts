import { beforeAll, describe, expect, it } from 'vitest'

import { anonymous, createUser, loginAs } from './helpers.ts'

type Agente = Awaited<ReturnType<typeof loginAs>>
let gestor: Agente
let ana: Agente
let beto: Agente
let formId: number

/** Formulario de prueba: quién pide (del perfil), una opción única y una sección que depende de ella, y casillas. */
const FORM = {
  title: 'Solicitud de equipo',
  area: 'Tecnología',
  destination: 'Mesa de Servicios',
  accepting: true,
  sections: [
    {
      title: 'Quién solicita',
      fields: [
        { k: 'nombre', l: 'Nombre completo', t: 'text', r: true, auto: 'nombreCompleto' },
        { k: 'correo', l: 'Correo', t: 'email', r: true, auto: 'correo' },
      ],
    },
    {
      title: 'Qué necesitas',
      fields: [
        { k: 'tipo', l: 'Tipo', t: 'radio', r: true, opts: ['Equipo', 'Otro'] },
        { l: 'Accesorios', t: 'checks', items: [{ l: 'Mouse' }, { l: 'Teclado' }] },
      ],
    },
    { title: 'Detalle de lo otro', show: { k: 'tipo', v: 'Otro' }, fields: [{ l: 'Cuál', t: 'text', r: true }] },
  ],
}

/** Respuestas válidas (el nombre y el correo los pone el servidor con la sesión). */
type Respuestas = { v: Record<string, string>; c: Record<string, number[]>; i: Record<string, number[]> }
const bien: Respuestas = { v: { s0_nombre: 'Otro nombre', s1_tipo: 'Equipo' }, c: { s1_accesorios: [1] }, i: {} }

beforeAll(async () => {
  await createUser('gestor@prueba.test', ['gestorSolicitudes'], 'Gina')
  await createUser('ana@prueba.test', ['funcionario'], 'Ana')
  await createUser('beto@prueba.test', ['funcionario'], 'Beto')
  gestor = await loginAs('gestor@prueba.test')
  ana = await loginAs('ana@prueba.test')
  beto = await loginAs('beto@prueba.test')
  formId = (await gestor.post('/api/forms').send(FORM)).body.id
})

const enviar = (agente: Agente | ReturnType<typeof anonymous>, respuestas = bien, form = 'solicitud-de-equipo') => agente.post('/api/requests').send({ form, respuestas })

describe('enviar una solicitud', () => {
  it('sin sesión 401; un formulario que no recibe solicitudes 409', async () => {
    expect((await enviar(anonymous())).status).toBe(401)
    const prueba = (await gestor.post('/api/forms').send({ ...FORM, title: 'De prueba', accepting: false })).body
    const r = await enviar(ana, bien, prueba.slug)
    expect(r.status).toBe(409)
    expect(r.body.error).toBe('FORM_NOT_ACCEPTING')
    expect((await enviar(ana, bien, 'no-existe')).status).toBe(404)
  })

  it('el servidor revisa las respuestas con la definición: obligatorios, secciones condicionales, opciones y casillas', async () => {
    const falta = await enviar(ana, { v: {}, c: {}, i: {} })
    expect(falta.status).toBe(400)
    expect(falta.body.fields).toEqual([{ field: 'respuestas.s1_tipo', message: 'Elige una opción en «Tipo».' }])

    // "Otro" abre la sección 3 y su campo pasa a ser obligatorio.
    const otro = await enviar(ana, { ...bien, v: { s1_tipo: 'Otro' } })
    expect(otro.body.fields.map((f: { field: string }) => f.field)).toEqual(['respuestas.s2_cual'])

    expect((await enviar(ana, { ...bien, v: { s1_tipo: 'Inventada' } })).body.fields[0].message).toMatch(/Elige una de las opciones/)
    expect((await enviar(ana, { ...bien, c: { s1_accesorios: [7] } })).body.fields[0].message).toMatch(/Marca solo opciones/)
    expect((await enviar(ana, { ...bien, v: { '<script>': 'x' } } as never)).status).toBe(400)
  })

  it('crea la solicitud con folio; el nombre y el correo salen de la sesión; lo oculto no se guarda', async () => {
    const r = await enviar(ana, { ...bien, v: { ...bien.v, s2_cual: 'no debería guardarse' } })
    expect(r.status).toBe(201)
    expect(r.body).toMatchObject({ formTitle: 'Solicitud de equipo', status: 'recibida', unread: false })
    expect(r.body.folio).toMatch(/^SOL-\d{4}-\d{6}$/)

    const d = (await ana.get(`/api/requests/${r.body.id}`)).body
    expect(d.summary).toEqual([
      { titulo: 'Quién solicita', filas: [{ dt: 'Nombre completo', dd: 'Ana' }, { dt: 'Correo', dd: 'ana@prueba.test' }] },
      { titulo: 'Qué necesitas', filas: [{ dt: 'Tipo', dd: 'Equipo' }, { dt: 'Accesorios', dd: 'Teclado' }] },
    ])
    expect(d.events).toEqual([expect.objectContaining({ type: 'creada', fromStaff: false })])
  })
})

describe('seguimiento', () => {
  it('cada quien ve las suyas; el Gestor ve todas; otra persona no', async () => {
    const r = (await enviar(beto)).body
    expect((await beto.get('/api/requests/mine')).body.map((x: { id: number }) => x.id)).toContain(r.id)
    expect((await ana.get('/api/requests/mine')).body.map((x: { id: number }) => x.id)).not.toContain(r.id)
    expect((await ana.get(`/api/requests/${r.id}`)).status).toBe(404)
    expect((await gestor.get(`/api/requests/${r.id}`)).body).toMatchObject({ ownerName: 'Beto', ownerEmail: 'beto@prueba.test' })
  })

  it('el Gestor cambia el estado y responde: la persona lo ve como nuevo hasta que abre la solicitud', async () => {
    const r = (await enviar(beto)).body
    const nueva = async () => (await beto.get('/api/requests/mine')).body.find((x: { id: number }) => x.id === r.id).unread
    expect(await nueva()).toBe(false)

    const cambio = await gestor.patch(`/api/requests/${r.id}`).send({ status: 'en_revision' })
    expect(cambio.body.status).toBe('en_revision')
    expect(await nueva()).toBe(true)
    expect((await beto.get('/api/me/summary')).body.unreadRequests).toBeGreaterThan(0)

    await beto.get(`/api/requests/${r.id}`)
    expect(await nueva()).toBe(false)

    const respuesta = await gestor.post(`/api/requests/${r.id}/messages`).send({ body: 'Tu equipo llega el lunes.' })
    expect(respuesta.status).toBe(201)
    expect(await nueva()).toBe(true)
    const d = (await beto.get(`/api/requests/${r.id}`)).body
    expect(d.events.map((e: { type: string }) => e.type)).toEqual(['creada', 'estado', 'mensaje'])
    expect(d.events[2]).toMatchObject({ body: 'Tu equipo llega el lunes.', fromStaff: true, authorName: 'Gina' })
    expect((await gestor.post(`/api/requests/${r.id}/messages`).send({ body: '  ' })).status).toBe(400)
  })

  it('solo el Gestor (y administración) ve la bandeja y cambia el estado', async () => {
    const r = (await enviar(ana)).body
    expect((await ana.get('/api/requests/manage')).status).toBe(403)
    expect((await ana.patch(`/api/requests/${r.id}`).send({ status: 'resuelta' })).status).toBe(403)
    expect((await ana.post(`/api/requests/${r.id}/messages`).send({ body: 'x' })).status).toBe(403)
    expect((await gestor.patch(`/api/requests/${r.id}`).send({ status: 'archivada' })).status).toBe(400)
  })

  it('la bandeja filtra por formulario, estado y búsqueda; el resumen del Gestor cuenta las nuevas', async () => {
    const r = (await enviar(ana)).body
    const ids = async (q: string) => (await gestor.get('/api/requests/manage' + q)).body.map((x: { id: number }) => x.id)
    expect(await ids('?status=recibida')).toContain(r.id)
    expect(await ids('?status=resuelta')).not.toContain(r.id)
    expect(await ids('?form=solicitud-de-equipo')).toContain(r.id)
    expect(await ids('?q=' + r.folio)).toEqual([r.id])
    expect(await ids('?q=beto')).not.toContain(r.id)
    expect((await gestor.get('/api/me/summary')).body.newRequests).toBeGreaterThan(0)
  })

  it('un formulario con solicitudes no se borra', async () => {
    const r = await gestor.delete(`/api/forms/${formId}`)
    expect(r.status).toBe(409)
    expect(r.body.error).toBe('FORM_HAS_REQUESTS')
    expect((await gestor.get('/api/forms/manage')).body.find((f: { id: number }) => f.id === formId).requests).toBeGreaterThan(0)
  })

  it(`no más de 10 envíos por persona por hora`, async () => {
    await createUser('rapida@prueba.test', ['funcionario'])
    const rapida = await loginAs('rapida@prueba.test')
    for (let n = 0; n < 10; n++) expect((await enviar(rapida)).status).toBe(201)
    const r = await enviar(rapida)
    expect(r.status).toBe(429)
    expect(r.body.error).toBe('TOO_MANY_REQUESTS')
  })
})
