/**
 * RRHH Express en mantenimiento (RRHH_MANTENIMIENTO=true): la conexión dice que no está disponible
 * y ninguna ruta conecta ni entrega datos, con sesión o sin ella.
 */
import request from 'supertest'
import { describe, expect, it } from 'vitest'

import { app } from '../../src/app.ts'
import { createUser, loginAs } from '../helpers.ts'

describe('RRHH Express en mantenimiento', () => {
  it('la conexión dice que no está disponible y que está en mantenimiento', async () => {
    const res = await request(app).get('/api/rrhh/conexion')
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ available: false, connected: false, maintenance: true })
  })

  it('no deja conectar, ni con cédula y número de cargo', async () => {
    const res = await request(app).post('/api/rrhh/conexion').send({ cedula: '8-888-8888', password: '1234' })
    expect(res.status).toBe(503)
    expect(res.body.error).toBe('RRHH_EN_MANTENIMIENTO')
  })

  it('con sesión tampoco entrega datos', async () => {
    const user = await createUser('rrhh-mant@ejemplo.test', ['funcionario'])
    const agent = await loginAs(user.email!)
    for (const ruta of ['/api/rrhh/comprobantes', '/api/rrhh/comprobantes/resumen/2026', '/api/rrhh/expediente', '/api/rrhh/marcaciones?year=2026&month=10', '/api/rrhh/compensatorio']) {
      const res = await agent.get(ruta)
      expect(res.status, ruta).toBe(503)
    }
  })
})
