import { beforeAll, describe, expect, it } from 'vitest'

import { anonymous, createUser, loginAs } from './helpers.ts'

const diseno = {
  v: 1,
  items: [
    { id: 'saludo', uid: 'saludo', ancho: 'completa' },
    { id: 'mis-enlaces', uid: 'mis-enlaces-abc123', ancho: 'tercio', cfg: { titulo: 'Míos', links: [{ t: 'Portal', h: 'https://ejemplo.gob.pa/' }] } },
    { id: 'apps-filtro', uid: 'apps-filtro-x1y2z3', ancho: 'media', cfg: { tipo: 'area', valor: 'Trámites', cantidad: 6 } },
  ],
}

beforeAll(async () => {
  await createUser('admin@prueba.test', ['admin'])
  await createUser('ana@prueba.test', ['funcionario'])
  await createUser('beto@prueba.test', ['funcionario'])
})

describe('diseño propio', () => {
  it('sin sesión no hay diseño propio ni se puede guardar', async () => {
    expect((await anonymous().get('/api/home/layout')).body).toEqual({ personal: null, default: null })
    const r = await anonymous().put('/api/home/layout').send({ layout: diseno })
    expect(r.status).toBe(401)
    expect(r.body.error).toBe('AUTHENTICATION_REQUIRED')
  })

  it('cada persona guarda el suyo y no ve el de otra', async () => {
    const ana = await loginAs('ana@prueba.test')
    const r = await ana.put('/api/home/layout').send({ layout: diseno })
    expect(r.status).toBe(200)
    expect(r.body.layout).toEqual(diseno)
    expect((await ana.get('/api/home/layout')).body.personal).toEqual(diseno)
    expect((await (await loginAs('beto@prueba.test')).get('/api/home/layout')).body.personal).toBeNull()

    // null = volver al de todos.
    await ana.put('/api/home/layout').send({ layout: null })
    expect((await ana.get('/api/home/layout')).body.personal).toBeNull()
  })

  it('rechaza diseños inválidos con todos los campos (enlaces javascript:, HTML, bloques repetidos, más de 30)', async () => {
    const ana = await loginAs('ana@prueba.test')
    const malo = {
      v: 1,
      items: [
        { id: 'saludo', uid: 'saludo', ancho: 'gigante' },
        { id: 'saludo', uid: 'saludo', ancho: 'media' },
        { id: 'mis-enlaces', uid: 'mis-enlaces-1', ancho: 'tercio', cfg: { titulo: '<b>x</b>', links: [{ t: 'x', h: 'javascript:alert(1)' }] } },
      ],
    }
    const r = await ana.put('/api/home/layout').send({ layout: malo })
    expect(r.status).toBe(400)
    const campos = r.body.fields.map((f: { field: string }) => f.field)
    expect(campos).toEqual(['layout.items.0.ancho', 'layout.items.2.cfg.titulo', 'layout.items.2.cfg.links.0.h'])

    // Los bloques repetidos se revisan cuando cada bloque ya es válido (regla entre campos).
    const repetido = { v: 1, items: [diseno.items[0], diseno.items[0]] }
    const d = await ana.put('/api/home/layout').send({ layout: repetido })
    expect(d.body.fields).toEqual([{ field: 'layout.items.1.uid', message: 'Bloque repetido' }])

    const largo = { v: 1, items: Array.from({ length: 31 }, (_, i) => ({ id: 'apps-filtro', uid: `apps-filtro-${i}x`, ancho: 'tercio' })) }
    expect((await ana.put('/api/home/layout').send({ layout: largo })).status).toBe(400)
  })

  it('guarda lo que la persona ocultó de un bloque ("Elegir qué mostrar"), con límites', async () => {
    const ana = await loginAs('ana@prueba.test')
    const con = (ocultos: unknown) => ({ v: 1, items: [{ id: 'frecuentes', uid: 'frecuentes', ancho: 'tercio', cfg: { ocultos } }] })
    const ok = await ana.put('/api/home/layout').send({ layout: con(['/sitio/ach.pdf', 'http://wifi.ejemplo.gob.pa']) })
    expect(ok.status).toBe(200)
    expect((await ana.get('/api/home/layout')).body.personal.items[0].cfg).toEqual({ ocultos: ['/sitio/ach.pdf', 'http://wifi.ejemplo.gob.pa'] })
    expect((await ana.put('/api/home/layout').send({ layout: con(['<script>']) })).status).toBe(400)
    expect((await ana.put('/api/home/layout').send({ layout: con(Array.from({ length: 41 }, (_, i) => '/x' + i)) })).status).toBe(400)
    expect((await ana.put('/api/home/layout').send({ layout: null })).status).toBe(200)
  })
})

describe('tamaño del buscador', () => {
  it('se guarda con el diseño y solo acepta los tamaños conocidos', async () => {
    const ana = await loginAs('ana@prueba.test')
    const con = (buscador: unknown) => ({ ...diseno, buscador })
    expect((await ana.put('/api/home/layout').send({ layout: con('dos-tercios') })).status).toBe(200)
    expect((await ana.get('/api/home/layout')).body.personal.buscador).toBe('dos-tercios')
    const malo = await ana.put('/api/home/layout').send({ layout: con('gigante') })
    expect(malo.status).toBe(400)
    expect(malo.body.fields.map((f: { field: string }) => f.field)).toEqual(['layout.buscador'])
    await ana.put('/api/home/layout').send({ layout: null })
  })
})

describe('diseño por defecto', () => {
  it('solo administración lo cambia, y lo ven quienes no personalizaron', async () => {
    expect((await (await loginAs('ana@prueba.test')).put('/api/home/default-layout').send({ layout: diseno })).status).toBe(403)
    const admin = await loginAs('admin@prueba.test')
    expect((await admin.put('/api/home/default-layout').send({ layout: diseno })).status).toBe(200)
    expect((await anonymous().get('/api/home/layout')).body.default).toEqual(diseno)
    await admin.put('/api/home/default-layout').send({ layout: null })
    expect((await anonymous().get('/api/home/layout')).body.default).toBeNull()
  })
})

describe('contenido', () => {
  it('sin contenido cargado devuelve un objeto vacío', async () => {
    const r = await anonymous().get('/api/home/content')
    expect(r.status).toBe(200)
    expect(r.body).toEqual({})
  })
})
