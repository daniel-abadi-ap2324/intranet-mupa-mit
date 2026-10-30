import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import { eventBus, EventBusService, type Sobre } from '../src/shared/services/event-bus.service.ts'
import { createUser, loginAs } from './helpers.ts'
import { FORM_PRUEBA, RESPUESTAS_BIEN } from './solicitudes-fixture.ts'

const datos = { id: 1, folio: 'SOL-2026-000001', formulario: 'Carta', area: 'RRHH', solicitante: 'Ana', fecha: new Date() }
const tick = () => new Promise((r) => setImmediate(r))

afterEach(() => vi.restoreAllMocks())

describe('EventBusService', () => {
  it('entrega a todos los que escuchan, en el siguiente tick, con un sobre identificado', async () => {
    const bus = new EventBusService()
    const a: Sobre[] = []
    const b: Sobre[] = []
    bus.on('solicitud.creada', (s) => void a.push(s))
    bus.onAny((s) => void b.push(s))

    const sobre = bus.emit('solicitud.creada', datos, 7)
    expect(a).toHaveLength(0) // no dentro del emit: quien emite no espera
    await tick()
    expect(a).toEqual([sobre])
    expect(b).toEqual([sobre])
    expect(sobre).toMatchObject({ tipo: 'solicitud.creada', actorId: 7, datos })
    expect(sobre.id).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('dejar de escuchar funciona', async () => {
    const bus = new EventBusService()
    const recibidos: Sobre[] = []
    const salir = bus.on('solicitud.creada', (s) => void recibidos.push(s))
    salir()
    bus.emit('solicitud.creada', datos)
    await tick()
    expect(recibidos).toHaveLength(0)
  })

  it('un listener que falla (o cuya promesa falla) no rompe a los demás', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const bus = new EventBusService()
    const recibidos: Sobre[] = []
    bus.on('solicitud.creada', () => {
      throw new Error('falla')
    })
    bus.on('solicitud.creada', async () => {
      throw new Error('falla async')
    })
    bus.on('solicitud.creada', (s) => void recibidos.push(s))
    expect(() => bus.emit('solicitud.creada', datos)).not.toThrow()
    await tick()
    await tick()
    expect(recibidos).toHaveLength(1)
    expect(error).toHaveBeenCalledTimes(2)
  })
})

describe('enviar una solicitud emite "solicitud.creada"', () => {
  beforeAll(async () => {
    await createUser('gestor-bus@prueba.test', ['gestorSolicitudes'], 'Gina')
    await createUser('ana-bus@prueba.test', ['funcionario'], 'Ana')
  })

  it('con el folio, el formulario y quién la envió; un envío de prueba no emite', async () => {
    const gestor = await loginAs('gestor-bus@prueba.test')
    const ana = await loginAs('ana-bus@prueba.test')
    const slug = (await gestor.post('/api/forms').send(FORM_PRUEBA)).body.slug
    const prueba = (await gestor.post('/api/forms').send({ ...FORM_PRUEBA, title: 'Solo de prueba', accepting: false })).body.slug

    const recibidos: Sobre<'solicitud.creada'>[] = []
    const salir = eventBus.on('solicitud.creada', (s) => void recibidos.push(s))
    try {
      expect((await ana.post('/api/requests').send({ form: prueba, respuestas: RESPUESTAS_BIEN })).status).toBe(409)
      const r = await ana.post('/api/requests').send({ form: slug, respuestas: RESPUESTAS_BIEN })
      expect(r.status).toBe(201)
      await tick()
      expect(recibidos).toHaveLength(1)
      expect(recibidos[0].datos).toMatchObject({ id: r.body.id, folio: r.body.folio, formulario: 'Solicitud de equipo', area: 'Tecnología', solicitante: 'Ana' })
      // Nunca las respuestas del formulario.
      expect(JSON.stringify(recibidos[0].datos)).not.toContain('Equipo')
      expect(recibidos[0].actorId).toEqual(expect.any(Number))
    } finally {
      salir()
    }
  })
})
