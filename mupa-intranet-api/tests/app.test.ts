import { describe, expect, it } from 'vitest'

import { db } from '../src/config/database.ts'
import { runSeed } from '../src/database/seeder.ts'
import { applications, applicationTags, users } from '../src/database/schema/index.ts'
import { anonymous } from './helpers.ts'

describe('errores y salud', () => {
  it('/api/health responde ok (con la base)', async () => {
    const r = await anonymous().get('/api/health')
    expect(r.status).toBe(200)
    expect(r.body).toEqual({ status: 'ok' })
    expect(r.headers['cache-control']).toBe('no-store')
    expect(r.headers['x-powered-by']).toBeUndefined()
  })

  it('una ruta que no existe es 404 ROUTE_NOT_FOUND', async () => {
    const r = await anonymous().get('/api/no-existe')
    expect(r.status).toBe(404)
    expect(r.body).toEqual({ error: 'ROUTE_NOT_FOUND', message: expect.any(String) })
  })

  it('sin LLM_URL el asistente responde 503 ASSISTANT_UNAVAILABLE (el resto funciona igual)', async () => {
    const r = await anonymous().post('/api/assistant/ask').send({ question: '¿dónde pido vacaciones?' })
    expect(r.status).toBe(503)
    expect(r.body).toEqual({ error: 'ASSISTANT_UNAVAILABLE', message: expect.any(String) })
  })

  it('un cuerpo que no es JSON válido es 400 INVALID_JSON (sin detalles internos)', async () => {
    const r = await anonymous().post('/api/auth/login').set('Content-Type', 'application/json').send('{"email": ')
    expect(r.status).toBe(400)
    expect(r.body).toEqual({ error: 'INVALID_JSON', message: expect.any(String) })
  })
})

describe('datos iniciales (seed)', () => {
  it('carga el catálogo, el contenido y las cuentas de prueba, y es idempotente', async () => {
    const primero = await runSeed({ demoUsers: true })
    // 62 direcciones de RRHH (seed-data/departamentos.json).
    expect(primero).toEqual({ applications: 75, users: 6, departments: 62 })
    expect(await runSeed({ demoUsers: true })).toEqual({ applications: 0, users: 0, departments: 0 })

    expect(await db.$count(applications)).toBe(75)
    expect(await db.$count(users)).toBe(6)
    const publicas = (await anonymous().get('/api/applications')).body
    expect(publicas.length).toBeGreaterThan(30)
    expect(publicas.every((a: { access: string }) => a.access !== 'sesion')).toBe(true)
    // Revisado el 2026-09-29: lo publicado está confirmado y lleva a algún lado; lo demás quedó en borrador.
    expect(publicas.every((a: { confirmed: boolean; url: string | null }) => a.confirmed && a.url)).toBe(true)
    // Los anuncios ya no vienen de ejemplo: los publica Comunicación (/api/announcements).
    const contenido = Object.keys((await anonymous().get('/api/home/content')).body)
    expect(contenido).toContain('enlaces')
    // Anuncios, noticias y videos ya no van en el contenido: tienen su propia API.
    for (const k of ['anuncios', 'noticias', 'videos']) expect(contenido).not.toContain(k)
    const boletines = (await anonymous().get('/api/bulletins')).body as { date: string; pdfUrl: string | null; note: string }[]
    expect(boletines).toHaveLength(34)
    // Del más nuevo al más viejo; cada PDF está copiado en /sitio/ y ninguno enlaza a la intranet vieja.
    expect(boletines.map((b) => b.date)).toEqual(boletines.map((b) => b.date).sort().reverse())
    expect(boletines.every((b) => b.pdfUrl?.startsWith('/sitio/'))).toBe(true)
    expect(JSON.stringify(boletines)).not.toContain('intranet.mupa.gob.pa')
    // No había ninguna noticia vigente; los videos son los instructivos (copiados) y uno de mupa.gob.pa.
    expect((await anonymous().get('/api/news')).body).toHaveLength(0)
    const vids = (await anonymous().get('/api/videos')).body as { url: string }[]
    expect(vids).toHaveLength(4)
    expect(JSON.stringify(vids)).not.toMatch(/intranet\.mupa\.gob\.pa|youtube/)
    expect((await anonymous().get('/api/announcements')).body).toEqual([])
  })

  it('si el catálogo se vació pero las etiquetas quedaron, vuelve a cargar las apps con sus etiquetas', async () => {
    const antes = await db.$count(applicationTags)
    await db.delete(applications)
    expect(await db.$count(applicationTags)).toBe(0)
    expect((await runSeed({ demoUsers: false })).applications).toBe(75)
    expect(await db.$count(applicationTags)).toBe(antes)
  })
})
