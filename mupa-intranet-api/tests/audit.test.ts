import { randomUUID } from 'node:crypto'

import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import { auditRepository } from '../src/features/audit/audit.repository.ts'
import { auditService } from '../src/features/audit/audit.service.ts'
import type { Sobre } from '../src/shared/services/event-bus.service.ts'
import { anonymous, createUser, loginAs } from './helpers.ts'
import { FORM_PRUEBA, RESPUESTAS_BIEN } from './solicitudes-fixture.ts'

type Agente = Awaited<ReturnType<typeof loginAs>>
let admin: Agente
let gestor: Agente
let ana: Agente
let slug: string
let prueba: string

/** La auditoría se escribe después de responder (siguiente tick): se espera a que aparezca. */
async function esperarAuditoria(subject: string) {
  for (let i = 0; i < 50; i++) {
    const r = await admin.get('/api/audit/events').query({ subject })
    if (r.body.length) return r.body
    await new Promise((res) => setTimeout(res, 20))
  }
  return []
}

beforeAll(async () => {
  await createUser('admin-aud@prueba.test', ['admin'], 'Ada')
  await createUser('gestor-aud@prueba.test', ['gestorSolicitudes'], 'Gina')
  await createUser('ana-aud@prueba.test', ['funcionario'], 'Ana')
  admin = await loginAs('admin-aud@prueba.test')
  gestor = await loginAs('gestor-aud@prueba.test')
  ana = await loginAs('ana-aud@prueba.test')
  slug = (await gestor.post('/api/forms').send(FORM_PRUEBA)).body.slug
  prueba = (await gestor.post('/api/forms').send({ ...FORM_PRUEBA, title: 'Auditoría de prueba', accepting: false })).body.slug
})

afterEach(() => vi.restoreAllMocks())

describe('auditoría de eventos', () => {
  it('cada solicitud enviada deja una fila: tipo, quién, sobre qué y el evento, sin las respuestas', async () => {
    const r = await ana.post('/api/requests').send({ form: slug, respuestas: RESPUESTAS_BIEN })
    expect(r.status).toBe(201)
    const [fila] = await esperarAuditoria('request:' + r.body.id)
    expect(fila).toMatchObject({ type: 'solicitud.creada', actorId: expect.any(Number), subjectType: 'request', subjectId: r.body.id, deliveredCount: 0 })
    expect(fila.payload).toMatchObject({ folio: r.body.folio, formulario: 'Solicitud de equipo', solicitante: 'Ana' })
    expect(JSON.stringify(fila.payload)).not.toContain('Otro nombre')
  })

  it('un envío de prueba (409) no deja fila', async () => {
    const antes = (await admin.get('/api/audit/events')).body.length
    expect((await ana.post('/api/requests').send({ form: prueba, respuestas: RESPUESTAS_BIEN })).status).toBe(409)
    await new Promise((res) => setTimeout(res, 100))
    expect((await admin.get('/api/audit/events')).body.length).toBe(antes)
  })

  it('solo administración la consulta; filtra por tipo y por solicitud', async () => {
    expect((await anonymous().get('/api/audit/events')).status).toBe(401)
    expect((await gestor.get('/api/audit/events')).status).toBe(403)
    expect((await ana.get('/api/audit/events')).status).toBe(403)
    const todos = (await admin.get('/api/audit/events').query({ type: 'solicitud.creada' })).body
    expect(todos.length).toBeGreaterThan(0)
    expect(todos.every((e: { type: string }) => e.type === 'solicitud.creada')).toBe(true)
    expect((await admin.get('/api/audit/events').query({ type: 'otro.tipo' })).body).toEqual([])
    expect((await admin.get('/api/audit/events').query({ subject: 'mal' })).status).toBe(400)
  })

  it('la entrega y el evento se guardan en cualquier orden', async () => {
    const sobre: Sobre = {
      id: randomUUID(),
      tipo: 'solicitud.creada',
      actorId: null,
      fecha: new Date(),
      datos: { id: 999_999, folio: 'SOL-X', formulario: 'X', area: 'X', solicitante: 'X', fecha: new Date() },
    }
    await auditService.registrarEntrega(sobre, 2) // llega antes que el evento
    await auditService.registrar(sobre)
    await auditService.registrarEntrega(sobre, 1)
    const [fila] = (await admin.get('/api/audit/events').query({ subject: 'request:999999' })).body
    expect(fila).toMatchObject({ id: sobre.id, type: 'solicitud.creada', subjectId: 999_999, deliveredCount: 3 })
  })

  it('si escribir la auditoría falla, la solicitud igual se envía', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    vi.spyOn(auditRepository, 'upsertEvent').mockRejectedValue(new Error('base caída'))
    const r = await ana.post('/api/requests').send({ form: slug, respuestas: RESPUESTAS_BIEN })
    expect(r.status).toBe(201)
    await new Promise((res) => setTimeout(res, 50))
    expect(error).toHaveBeenCalledWith(expect.stringContaining('No se pudo auditar'))
  })
})
