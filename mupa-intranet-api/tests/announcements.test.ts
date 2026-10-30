import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import { anonymous, createUser, loginAs } from './helpers.ts'

/** Días relativos a hoy en Panamá, "AAAA-MM-DD" (lo mismo que usa el servicio). */
const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Panama' }).format(new Date())
function dia(delta: number): string {
  const [y, m, d] = hoy.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + delta)).toISOString().slice(0, 10)
}

type Agente = Awaited<ReturnType<typeof loginAs>>
let comu: Agente

beforeAll(async () => {
  await createUser('comu@prueba.test', ['comunicacion'], 'Carla')
  await createUser('admin@prueba.test', ['admin'])
  await createUser('gestor@prueba.test', ['gestorSolicitudes'])
  await createUser('ana@prueba.test', ['funcionario'])
  comu = await loginAs('comu@prueba.test')
})

const crear = async (datos: Record<string, unknown>) => {
  const r = await comu.post('/api/announcements').send(datos)
  expect(r.status).toBe(201)
  return r.body
}

describe('quién puede gestionar anuncios', () => {
  const nuevo = { title: 'Aviso de prueba', status: 'publicado' }

  it('sin sesión 401; funcionario y gestor de solicitudes 403', async () => {
    expect((await anonymous().post('/api/announcements').send(nuevo)).status).toBe(401)
    for (const quien of ['ana@prueba.test', 'gestor@prueba.test']) {
      const agente = await loginAs(quien)
      const r = await agente.post('/api/announcements').send(nuevo)
      expect(r.status).toBe(403)
      expect(r.body.error).toBe('FORBIDDEN')
      expect((await agente.get('/api/announcements/manage')).status).toBe(403)
    }
    expect((await anonymous().get('/api/announcements/manage')).status).toBe(401)
  })

  it('Comunicación y administración sí', async () => {
    const r = await crear({ ...nuevo, title: 'De Comunicación' })
    expect(r).toMatchObject({ title: 'De Comunicación', level: 'normal', status: 'publicado', state: 'vigente', publishFrom: hoy, publishUntil: null, updatedByName: 'Carla' })
    const admin = await loginAs('admin@prueba.test')
    expect((await admin.post('/api/announcements').send({ ...nuevo, title: 'De administración' })).status).toBe(201)
  })
})

describe('qué se ve en el Inicio', () => {
  it('solo los publicados y dentro de sus fechas, urgentes primero', async () => {
    await crear({ title: 'Vigente normal', status: 'publicado', publishFrom: dia(-3) })
    await crear({ title: 'Vigente urgente', status: 'publicado', level: 'urgente', publishUntil: hoy })
    await crear({ title: 'Borrador', status: 'borrador' })
    await crear({ title: 'Retirado', status: 'retirado' })
    await crear({ title: 'Programado', status: 'publicado', publishFrom: dia(1) })
    await crear({ title: 'Vencido', status: 'publicado', publishFrom: dia(-10), publishUntil: dia(-1) })

    const r = await anonymous().get('/api/announcements')
    expect(r.status).toBe(200)
    const titulos = r.body.map((a: { title: string }) => a.title)
    expect(titulos).toContain('Vigente normal')
    expect(titulos[0]).toBe('Vigente urgente')
    for (const oculto of ['Borrador', 'Retirado', 'Programado', 'Vencido']) expect(titulos).not.toContain(oculto)
    // Al Inicio no llegan el estado interno ni quién lo editó.
    expect(Object.keys(r.body[0]).sort()).toEqual(['body', 'id', 'level', 'link', 'publishFrom', 'publishUntil', 'title'])

    const panel = (await comu.get('/api/announcements/manage')).body as { title: string; state: string }[]
    const estado = (t: string) => panel.find((a) => a.title === t)?.state
    expect([estado('Borrador'), estado('Retirado'), estado('Programado'), estado('Vencido'), estado('Vigente normal')]).toEqual([
      'borrador',
      'retirado',
      'programado',
      'vencido',
      'vigente',
    ])
  })
})

describe('el día se cuenta en hora de Panamá', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('a las 8:30 p.m. del 27 en Panamá (ya 28 en UTC) sigue siendo 27', async () => {
    const a = await crear({ title: 'Solo el 27', status: 'publicado', publishFrom: '2026-09-27', publishUntil: '2026-09-27' })
    const b = await crear({ title: 'Desde el 28', status: 'publicado', publishFrom: '2026-09-28' })
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-09-28T01:30:00Z'))
    const ids = (await anonymous().get('/api/announcements')).body.map((x: { id: number }) => x.id)
    expect(ids).toContain(a.id)
    expect(ids).not.toContain(b.id)
    const gestion = (await comu.get('/api/announcements/manage')).body
    expect(gestion.find((x: { id: number }) => x.id === b.id).state).toBe('programado')
  })
})

describe('validación', () => {
  it('devuelve todos los campos inválidos', async () => {
    const r = await comu.post('/api/announcements').send({ title: '  ', level: 'altísimo', link: 'javascript:alert(1)', publishFrom: '27/09/2026' })
    expect(r.status).toBe(400)
    expect(r.body.error).toBe('VALIDATION_ERROR')
    expect(r.body.fields.map((f: { field: string }) => f.field).sort()).toEqual(['level', 'link', 'publishFrom', 'title'])
  })

  it('no acepta IPs, nombres internos ni campos desconocidos', async () => {
    for (const link of ['http://10.0.0.1/app', 'http://servidor/app']) {
      const r = await comu.post('/api/announcements').send({ title: 'Con enlace', link })
      expect(r.status).toBe(400)
      expect(r.body.fields[0].field).toBe('link')
    }
    expect((await comu.post('/api/announcements').send({ title: 'x', html: '<b>x</b>' })).status).toBe(400)
  })

  it('el enlace es https o una página de la intranet; nunca "/\\" (el navegador lo lee como "//"), http ni .local', async () => {
    for (const link of ['/\\ejemplo.com', '/\\192.0.2.10/app', 'http://sistema.ejemplo.gob.pa', 'https://srv.mupa.local/x', 'https://localhost./x']) {
      const r = await comu.post('/api/announcements').send({ title: 'Con enlace', link })
      expect(r.status, link).toBe(400)
      expect(r.body.fields[0].field).toBe('link')
    }
    expect((await crear({ title: 'Enlace bueno', link: 'https://sistema.ejemplo.gob.pa' })).link).toBe('https://sistema.ejemplo.gob.pa')
    expect((await crear({ title: 'Página interna', link: '/formularios' })).link).toBe('/formularios')
  })

  it('al editar tampoco se aceptan campos desconocidos', async () => {
    const a = await crear({ title: 'Para editar' })
    expect((await comu.patch(`/api/announcements/${a.id}`).send({ html: '<b>x</b>' })).status).toBe(400)
  })

  it('la fecha final no puede ser anterior a la de inicio', async () => {
    const r = await comu.post('/api/announcements').send({ title: 'Fechas al revés', publishFrom: dia(5), publishUntil: dia(1) })
    expect(r.status).toBe(400)
    expect(r.body.error).toBe('INVALID_DATES')

    const a = await crear({ title: 'Para editar fechas', publishFrom: dia(2) })
    expect((await comu.patch(`/api/announcements/${a.id}`).send({ publishUntil: dia(1) })).body.error).toBe('INVALID_DATES')
  })

  it('un texto vacío en el detalle o el enlace queda en null', async () => {
    const a = await crear({ title: 'Sin detalle', body: '  ', link: '' })
    expect(a).toMatchObject({ body: null, link: null })
  })
})

describe('editar, retirar y eliminar', () => {
  it('retirar lo saca del Inicio; eliminarlo lo borra', async () => {
    const a = await crear({ title: 'Mantenimiento del correo', body: 'Sábado de 8 a 10 p.m.', link: '/mesa-servicios', status: 'publicado' })
    const enInicio = async () => (await anonymous().get('/api/announcements')).body.some((x: { id: number }) => x.id === a.id)
    expect(await enInicio()).toBe(true)

    const admin = await loginAs('admin@prueba.test')
    const retirado = await admin.patch(`/api/announcements/${a.id}`).send({ status: 'retirado' })
    expect(retirado.status).toBe(200)
    expect(retirado.body).toMatchObject({ status: 'retirado', state: 'retirado', title: 'Mantenimiento del correo', updatedByName: 'Prueba' })
    expect(await enInicio()).toBe(false)

    expect((await comu.delete(`/api/announcements/${a.id}`)).status).toBe(204)
    expect((await comu.delete(`/api/announcements/${a.id}`)).status).toBe(404)
    expect((await comu.patch(`/api/announcements/${a.id}`).send({ title: 'x' })).body.error).toBe('ANNOUNCEMENT_NOT_FOUND')
  })

  it('un PATCH vacío es 400', async () => {
    const a = await crear({ title: 'Otro' })
    expect((await comu.patch(`/api/announcements/${a.id}`).send({})).status).toBe(400)
  })
})
