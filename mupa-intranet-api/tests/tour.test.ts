import { beforeAll, describe, expect, it } from 'vitest'

import { anonymous, createUser, loginAs } from './helpers.ts'

beforeAll(async () => {
  await createUser('nueva@prueba.test', ['funcionario'], 'Nueva')
})

describe('recorrido para usuarios nuevos (PUT /api/me/tour)', () => {
  it('sin sesión es 401', async () => {
    const r = await anonymous().put('/api/me/tour')
    expect(r.status).toBe(401)
    expect(r.body.error).toBe('AUTHENTICATION_REQUIRED')
  })

  it('la cuenta empieza sin verlo; al marcarlo queda la fecha y no cambia después', async () => {
    const nueva = await loginAs('nueva@prueba.test')
    expect((await nueva.get('/api/auth/session')).body.tourSeenAt).toBeNull()

    expect((await nueva.put('/api/me/tour')).status).toBe(204)
    const visto = (await nueva.get('/api/auth/session')).body.tourSeenAt
    expect(new Date(visto).getTime()).not.toBeNaN()

    expect((await nueva.put('/api/me/tour')).status).toBe(204)
    expect((await nueva.get('/api/auth/session')).body.tourSeenAt).toBe(visto)
  })
})

describe('GET /api/assistant/status', () => {
  it('sin servidor de inferencia (LLM_URL) el asistente está apagado', async () => {
    const r = await anonymous().get('/api/assistant/status')
    expect(r.status).toBe(200)
    expect(r.body).toEqual({ available: false })
  })
})
