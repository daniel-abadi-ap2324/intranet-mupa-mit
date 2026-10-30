/** Entrar: tras muchos intentos seguidos desde la misma IP, 429 con Retry-After (freno a adivinar contraseñas). */
import { describe, expect, it } from 'vitest'

import { anonymous } from './helpers.ts'

describe('POST /api/auth/login: límite de intentos', () => {
  it('el intento 101 en 10 minutos es 429 con Retry-After', async () => {
    for (let i = 0; i < 100; i++) expect((await anonymous().post('/api/auth/login').send({ username: 'nadie@prueba.test', password: 'mala' })).status).toBe(401)
    const r = await anonymous().post('/api/auth/login').send({ username: 'nadie@prueba.test', password: 'mala' })
    expect(r.status).toBe(429)
    expect(r.body.error).toBe('RATE_LIMITED')
    expect(Number(r.headers['retry-after'])).toBeGreaterThan(0)
  }, 120_000)
})
