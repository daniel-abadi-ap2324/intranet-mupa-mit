import { eq, sql } from 'drizzle-orm'
import { beforeAll, describe, expect, it } from 'vitest'

import { db } from '../src/config/database.ts'
import { requests } from '../src/database/schema/index.ts'
import { anonymous, createUser, loginAs } from './helpers.ts'
import { FORM_PRUEBA, RESPUESTAS_BIEN } from './solicitudes-fixture.ts'

type Agente = Awaited<ReturnType<typeof loginAs>>
let gestor: Agente
let comu: Agente
let ana: Agente

beforeAll(async () => {
  await createUser('admin@prueba.test', ['admin'], 'Ada')
  await createUser('gestor@prueba.test', ['gestorSolicitudes'], 'Gina')
  await createUser('comu@prueba.test', ['comunicacion'], 'Coco')
  await createUser('ana@prueba.test', ['funcionario'], 'Ana')
  gestor = await loginAs('gestor@prueba.test')
  comu = await loginAs('comu@prueba.test')
  ana = await loginAs('ana@prueba.test')
  await gestor.post('/api/forms').send(FORM_PRUEBA)
  await gestor.post('/api/forms').send({ ...FORM_PRUEBA, title: 'Constancia de trabajo', area: 'Recursos Humanos', destination: 'RRHH' })
})

const enviar = (form: string) => ana.post('/api/requests').send({ form, respuestas: RESPUESTAS_BIEN })

describe('GET /api/gestion/panel', () => {
  it('sin sesión 401; una persona sin rol de gestión 403', async () => {
    expect((await anonymous().get('/api/gestion/panel')).status).toBe(401)
    expect((await ana.get('/api/gestion/panel')).status).toBe(403)
  })

  it('cada gestor ve todas las áreas (por ahora todos ven todo)', async () => {
    for (const quien of ['admin@prueba.test', 'gestor@prueba.test', 'comu@prueba.test']) {
      const r = await (await loginAs(quien)).get('/api/gestion/panel')
      expect(r.status).toBe(200)
      expect(Object.keys(r.body)).toEqual(expect.arrayContaining(['requests', 'communication', 'administration', 'activity']))
      expect(r.body.requests.daily).toHaveLength(r.body.periodDays)
    }
  })

  it('cuenta las solicitudes, separa RRHH, mide la primera respuesta y las atrasadas', async () => {
    const equipo = (await enviar('solicitud-de-equipo')).body
    const constancia = (await enviar('constancia-de-trabajo')).body
    // Comunicación también atiende (hoy todos los gestores responden).
    expect((await comu.post(`/api/requests/${equipo.id}/messages`).send({ body: 'La estamos revisando.' })).status).toBe(201)
    expect((await comu.patch(`/api/requests/${equipo.id}`).send({ status: 'resuelta' })).status).toBe(200)
    // La de RRHH llegó hace 5 días y nadie la movió: atrasada.
    await db.update(requests).set({ createdAt: sql`now() - interval '5 days'` }).where(eq(requests.id, constancia.id))

    const p = (await gestor.get('/api/gestion/panel')).body
    expect(p.requests.byStatus).toEqual({ recibida: 1, en_revision: 0, resuelta: 1, rechazada: 0 })
    expect(p.requests).toMatchObject({ open: 1, overdue: 1, received: 2, resolved: 1 })
    expect(p.requests.firstResponseHours).toBeGreaterThanOrEqual(0)
    expect(p.requests.overdueList).toEqual([expect.objectContaining({ id: constancia.id, ownerName: 'Ana' })])
    expect(p.requests.byArea).toEqual(
      expect.arrayContaining([
        { area: 'Recursos Humanos', total: 1, open: 1, rrhh: true },
        { area: 'Tecnología', total: 1, open: 0, rrhh: false },
      ]),
    )
    expect(p.requests.daily.reduce((s: number, d: { n: number }) => s + d.n, 0)).toBe(2)
    expect(p.activity[0]).toMatchObject({ kind: 'solicitud', action: 'estado', status: 'resuelta', who: 'Coco', requestId: equipo.id })

    // La bandeja filtra por área.
    const rrhh = (await gestor.get('/api/requests/manage?area=rrhh')).body
    expect(rrhh.map((r: { id: number }) => r.id)).toEqual([constancia.id])
    // Y trae solo las atrasadas, con el mismo criterio de la cifra.
    const atrasadas = (await gestor.get('/api/requests/manage?overdue=true')).body
    expect(atrasadas.map((r: { id: number }) => r.id)).toEqual([constancia.id])
    expect((await gestor.get('/api/requests/manage?overdue=false')).body).toHaveLength(2)
    expect((await gestor.get('/api/requests/manage?overdue=si')).status).toBe(400)
  })

  it('comunicación: anuncios por estado, los que vencen pronto, y administración: usuarios', async () => {
    const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Panama' }).format(new Date())
    await comu.post('/api/announcements').send({ title: 'Vence pronto', status: 'publicado', publishUntil: hoy })
    await comu.post('/api/announcements').send({ title: 'En borrador' })
    const p = (await comu.get('/api/gestion/panel')).body
    expect(p.communication.announcements).toMatchObject({ vigente: 1, borrador: 1, expiring: [expect.objectContaining({ title: 'Vence pronto' })] })
    expect(p.administration.users).toMatchObject({ total: 4, withoutDepartment: 4 })
    expect(p.activity.some((a: { kind: string; title: string }) => a.kind === 'anuncio' && a.title === 'Vence pronto')).toBe(true)
  })
})
