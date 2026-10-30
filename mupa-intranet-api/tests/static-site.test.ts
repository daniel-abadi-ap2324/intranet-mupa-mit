/**
 * La web servida por la API (la imagen de Docker pone la SPA compilada en PUBLIC_DIR): archivos en la raíz, la SPA
 * para las rutas sin extensión, /api intacta y las cabeceras de seguridad que antes ponía nginx.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import request from 'supertest'
import { afterAll, describe, expect, it } from 'vitest'

import { createApp } from '../src/app.ts'

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mupa-public-'))
fs.mkdirSync(path.join(dir, 'assets'))
fs.mkdirSync(path.join(dir, 'sitio'))
fs.writeFileSync(path.join(dir, 'index.html'), '<!doctype html><title>SPA</title><div id="root"></div>')
fs.writeFileSync(path.join(dir, 'assets', 'app-abc123.js'), 'console.log(1)')
fs.writeFileSync(path.join(dir, 'sitio', 'boletin.pdf'), '%PDF-1.4 prueba')
fs.writeFileSync(path.join(dir, 'aviso.wav'), 'RIFF')
fs.writeFileSync(path.join(dir, '.env'), 'SECRETO=1')
afterAll(() => fs.rmSync(dir, { recursive: true, force: true }))

const app = createApp({ publicDir: dir })

describe('la web servida por la API', () => {
  it('la raíz y cualquier ruta de la SPA devuelven index.html, sin caché y con las cabeceras de seguridad', async () => {
    for (const ruta of ['/', '/mis-solicitudes', '/gestion/usuarios', '/no-existe']) {
      const r = await request(app).get(ruta)
      expect(r.status).toBe(200)
      expect(r.text).toContain('<title>SPA</title>')
      expect(r.headers['cache-control']).toBe('no-cache')
      expect(r.headers['content-security-policy']).toContain("frame-ancestors 'none'")
      expect(r.headers['x-frame-options']).toBe('DENY')
      expect(r.headers['x-content-type-options']).toBe('nosniff')
    }
  })

  it('los archivos con hash de Vite van con caché de un año; los demás, de un día', async () => {
    const js = await request(app).get('/assets/app-abc123.js')
    expect(js.status).toBe(200)
    expect(js.headers['cache-control']).toBe('public, max-age=31536000, immutable')
    const wav = await request(app).get('/aviso.wav')
    expect(wav.headers['content-type']).toMatch(/^audio\/(x-)?wav/)
    expect(wav.headers['cache-control']).toBe('public, max-age=86400')
  })

  it('el texto (JS, CSS, SVG) se sirve comprimido si el navegador lo acepta, con su caché; lo demás, tal cual', async () => {
    const grande = 'console.log("hola mundo");\n'.repeat(400)
    fs.writeFileSync(path.join(dir, 'assets', 'grande-def456.js'), grande)
    for (const [codificacion, esperado] of [['br', 'br'], ['gzip', 'gzip']] as const) {
      const r = await request(app).get('/assets/grande-def456.js').set('Accept-Encoding', codificacion)
      expect(r.status).toBe(200)
      expect(r.headers['content-encoding']).toBe(esperado)
      expect(r.headers['content-type']).toMatch(/^text\/javascript/)
      expect(r.headers.vary).toContain('Accept-Encoding')
      expect(r.headers['cache-control']).toBe('public, max-age=31536000, immutable')
      expect(r.text).toBe(grande)
      const otra = await request(app).get('/assets/grande-def456.js').set('Accept-Encoding', codificacion).set('If-None-Match', String(r.headers.etag))
      expect(otra.status).toBe(304)
    }
    // Sin Accept-Encoding, o un archivo que no es texto, sale como siempre.
    const plano = await request(app).get('/assets/grande-def456.js').set('Accept-Encoding', 'identity')
    expect(plano.headers['content-encoding']).toBeUndefined()
    expect(plano.text).toBe(grande)
    const wav = await request(app).get('/aviso.wav').set('Accept-Encoding', 'br, gzip')
    expect(wav.headers['content-encoding']).toBeUndefined()
    // Nunca fuera de la carpeta del sitio.
    expect((await request(app).get('/assets/..%2f..%2fsecreto.js').set('Accept-Encoding', 'gzip')).status).toBe(404)
  })

  it('los PDF de /sitio/ se pueden enmarcar dentro de la propia intranet', async () => {
    const r = await request(app).get('/sitio/boletin.pdf')
    expect(r.status).toBe(200)
    expect(r.headers['content-security-policy']).toBe("frame-ancestors 'self'")
    expect(r.headers['x-frame-options']).toBe('SAMEORIGIN')
  })

  it('un archivo que no existe es 404 (no la SPA), y nunca se sirven archivos ocultos', async () => {
    expect((await request(app).get('/falta.png')).status).toBe(404)
    expect((await request(app).get('/assets/viejo-123.js')).status).toBe(404)
    const oculto = await request(app).get('/.env')
    expect(oculto.status).toBe(404)
    expect(oculto.text).not.toContain('SECRETO')
  })

  it('/api sigue igual: su 404 es JSON, no la SPA, y también lleva las cabeceras de seguridad', async () => {
    const r = await request(app).get('/api/no-existe')
    expect(r.status).toBe(404)
    expect(r.body.error).toBe('ROUTE_NOT_FOUND')
    expect(r.headers['x-frame-options']).toBe('DENY')
    expect((await request(app).get('/api/health')).status).toBe(200)
  })

  it('solo GET y HEAD reciben la SPA', async () => {
    expect((await request(app).post('/mis-solicitudes')).status).toBe(404)
    expect((await request(app).head('/mis-solicitudes')).status).toBe(200)
  })

  it('sin carpeta de la web (desarrollo y pruebas) solo responde /api', async () => {
    const sinWeb = createApp({ publicDir: undefined })
    expect((await request(sinWeb).get('/')).status).toBe(404)
    expect((await request(sinWeb).get('/api/health')).status).toBe(200)
  })
})
