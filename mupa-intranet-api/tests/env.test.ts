import { describe, expect, it } from 'vitest'

import { envSchema } from '../src/config/env.ts'

const produccion = { NODE_ENV: 'production', DATABASE_URL: 'postgres://intranet:clave@db:5432/intranet' }
const identity = {
  IDENTITY_URL: 'https://identity.ejemplo.gob.pa/central',
  IDENTITY_CLIENT_ID: 'intranet_ejemplo',
  IDENTITY_CLIENT_SECRET: 'secreto-de-prueba',
  JWT_ISSUER: 'https://identity.ejemplo.gob.pa/',
  JWT_JWKS_URI: 'https://identity.ejemplo.gob.pa/.well-known/jwks',
  ALLOWED_CLIENT_IDS: 'intranet_ejemplo',
}

const fallas = (vars: Record<string, string>) => {
  const r = envSchema.safeParse(vars)
  return r.success ? [] : r.error.issues.map((i) => i.path.join('.'))
}

describe('configuración de producción', () => {
  it('arranca con lo mínimo y con Identity Central por https', () => {
    expect(fallas(produccion)).toEqual([])
    expect(fallas({ ...produccion, ...identity })).toEqual([])
  })

  it('no permite las cuentas de prueba (contraseña "password")', () => {
    expect(fallas({ ...produccion, LOCAL_LOGIN_ENABLED: 'true' })).toEqual(['LOCAL_LOGIN_ENABLED'])
    expect(fallas({ ...produccion, SEED_DEMO_USERS: 'true' })).toEqual(['SEED_DEMO_USERS'])
  })

  it('exige https para hablar con Identity Central y bajar sus llaves', () => {
    const http = { ...identity, IDENTITY_URL: 'http://identity.ejemplo.gob.pa', JWT_ISSUER: 'http://identity.ejemplo.gob.pa/', JWT_JWKS_URI: 'http://identity.ejemplo.gob.pa/jwks' }
    expect(fallas({ ...produccion, ...http }).sort()).toEqual(['IDENTITY_URL', 'JWT_ISSUER', 'JWT_JWKS_URI'])
  })

  it('en desarrollo (también Docker local con NODE_ENV=development) sí se permiten', () => {
    const local = { ...produccion, NODE_ENV: 'development', LOCAL_LOGIN_ENABLED: 'true', SEED_DEMO_USERS: 'true', ...identity, IDENTITY_URL: 'http://identity.ejemplo.gob.pa' }
    expect(fallas(local)).toEqual([])
  })
})
