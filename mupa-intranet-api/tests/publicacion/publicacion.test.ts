/**
 * Edición publicación (EDICION=publicacion): lo que todavía nadie alimenta no existe,
 * y lo que se publica funciona igual.
 */
import { beforeAll, describe, expect, it } from 'vitest'

import { db } from '../../src/config/database.ts'
import { bulletins, forms, news, videos } from '../../src/database/schema/index.ts'
import { runSeed } from '../../src/database/seeder.ts'
import { anonymous, createUser, loginAs } from '../helpers.ts'

beforeAll(async () => {
  await runSeed({ demoUsers: false })
})

describe('edición publicación', () => {
  it('las rutas de anuncios, videos, formularios internos y solicitudes internas no existen (404), ni con sesión; las noticias sí', async () => {
    await createUser('admin-pub@prueba.test', ['admin'])
    const admin = await loginAs('admin-pub@prueba.test')
    // Edición publicación: lo que se llena y se guarda dentro de la intranet está apagado.
    for (const ruta of ['/api/announcements', '/api/videos', '/api/forms', '/api/forms/manage', '/api/requests/mine', '/api/requests/manage', '/api/notifications']) {
      expect((await anonymous().get(ruta)).status, ruta).toBe(404)
      expect((await admin.get(ruta)).status, ruta).toBe(404)
    }
    expect((await admin.post('/api/announcements').send({})).status).toBe(404)
    expect((await admin.post('/api/requests').send({})).status).toBe(404)
    // Las noticias van en las dos ediciones (llegan solas de mupa.gob.pa).
    expect((await anonymous().get('/api/news')).status).toBe(200)
    // Lo que sí queda con sistemas reales: citas de la Clínica, códigos de llamada y tickets de GLPI (sin su sistema, «no disponible»).
    expect((await admin.get('/api/clinic/appointments')).status).toBe(200)
    expect((await admin.get('/api/call-codes/requests')).status).toBe(200)
    expect((await admin.get('/api/glpi/tickets')).status).toBe(200)
  })

  it('lo publicado sigue funcionando: sesión, catálogo, Inicio, departamentos, asistente y administración', async () => {
    expect((await anonymous().get('/api/auth/session')).status).toBe(200)
    expect((await anonymous().get('/api/applications')).status).toBe(200)
    expect((await anonymous().get('/api/home/content')).status).toBe(200)
    expect((await anonymous().get('/api/departments/options')).body).toHaveLength(62)
    expect((await anonymous().get('/api/assistant/status')).status).toBe(200)
    // Boletines, como en la intranet actual: los 34 con su PDF.
    expect((await anonymous().get('/api/bulletins')).body).toHaveLength(34)
    const admin = await loginAs('admin-pub@prueba.test')
    for (const ruta of ['/api/users', '/api/departments', '/api/applications?includeDrafts=true', '/api/me/summary']) {
      expect((await admin.get(ruta)).status, ruta).toBe(200)
    }
    // RRHH Express va en las dos ediciones (aquí sin RH Link configurado: no disponible).
    expect((await anonymous().get('/api/rrhh/conexion')).body.available).toBe(false)
    expect((await anonymous().get('/api/rrhh/marcaciones?year=2026&month=9')).status).toBe(401)
    expect((await admin.get('/api/rrhh/conexion')).body).toEqual({ available: false, connected: false, knownCedula: false, guest: false, name: null, expiresAt: null })
  })

  it('el Centro de Gestión solo trae lo que está encendido: boletines, noticias y administración (sin solicitudes)', async () => {
    const admin = await loginAs('admin-pub@prueba.test')
    const p = (await admin.get('/api/gestion/panel')).body
    expect(p.requests).toBeUndefined()
    expect(Object.keys(p.communication).sort()).toEqual(['bulletins', 'news'])
    expect(p.communication.bulletins.published).toBe(34)
    expect(p.administration.departments).toBe(62)
    expect(p.activity.every((a: { kind: string }) => ['boletin', 'noticia'].includes(a.kind))).toBe(true)
  })

  it('el seed no carga contenido de muestra de lo que no existe', async () => {
    for (const tabla of [news, videos]) expect(await db.$count(tabla)).toBe(0)
    // Los datos no se tocan: los formularios se siguen cargando aunque en esta edición no se vean.
    expect(await db.$count(forms)).toBe(7)
    expect(await db.$count(bulletins)).toBe(34)
  })
})
