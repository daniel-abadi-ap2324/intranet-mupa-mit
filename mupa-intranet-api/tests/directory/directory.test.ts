/**
 * Directorio con la central telefónica (Grandstream UCM), contra una central simulada por http:
 * nunca se llama a la central real.
 */
import crypto from 'node:crypto'
import http from 'node:http'
import type { AddressInfo } from 'node:net'

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { db } from '../../src/config/database.ts'
import type { UcmConfig } from '../../src/config/env.ts'
import { directoryExtensions, directorySync } from '../../src/database/schema/index.ts'
import { directoryRepository } from '../../src/features/directory/directory.repository.ts'
import { capitalize, compare, DirectoryService, merge, sameName, samePerson, type DirectoryEntry } from '../../src/features/directory/directory.service.ts'
import { UcmError, UcmService } from '../../src/features/directory/ucm.service.ts'
import { anonymous, createUser, loginAs } from '../helpers.ts'

const persona = (nombre: string, apellido: string, ext: string, direccion = 'Tecnología e Innovación'): DirectoryEntry => ({ nombre, apellido, direccion, ext, ubicacion: '' })

const FIJO = [persona('Ana', 'Pérez', '1001'), persona('Luis', 'Gómez', '1002'), persona('Recepción', '', '1003', 'Despacho'), persona('Marta', 'Ruiz', '1004')]

/** Una central de mentira: challenge, login con MD5, listAccount por páginas y logout. Devuelve campos que hay que descartar. */
function fakeUcm() {
  const state = {
    password: 'clave-api',
    accounts: [] as Record<string, unknown>[],
    pageSize: 2,
    loginStatus: 0,
    actions: [] as string[],
  }
  const server = http.createServer((req, res) => {
    let body = ''
    req.on('data', (c) => (body += c))
    req.on('end', () => {
      const { request: r } = JSON.parse(body) as { request: Record<string, string | number> }
      state.actions.push(String(r.action))
      const send = (status: number, response: Record<string, unknown> = {}) => res.end(JSON.stringify({ status, response }))
      if (r.action === 'challenge') return send(0, { challenge: 'abc123' })
      if (r.action === 'login') {
        if (state.loginStatus) return send(state.loginStatus, { remain_num: 3 })
        const ok = r.token === crypto.createHash('md5').update('abc123' + state.password).digest('hex')
        return ok ? send(0, { cookie: 'sid-1' }) : send(-37, { remain_num: 2 })
      }
      if (r.cookie !== 'sid-1') return send(-6)
      if (r.action === 'logout') return send(0)
      if (r.action === 'listAccount') {
        const page = Number(r.page)
        const total = Math.max(1, Math.ceil(state.accounts.length / state.pageSize))
        return send(0, { account: state.accounts.slice((page - 1) * state.pageSize, page * state.pageSize), total_page: total, page, total_item: state.accounts.length })
      }
      send(-1)
    })
  })
  return { server, state }
}

const cuenta = (extension: string, fullname: string) => ({ extension, fullname, account_type: 'SIP', addr: '10.0.0.9', email_to_user: 'x@y.test', status: 'Idle', secret: 'sip-secreto', mac: 'AA:BB' })

let central: ReturnType<typeof fakeUcm>
let config: UcmConfig

beforeAll(async () => {
  central = fakeUcm()
  await new Promise<void>((r) => central.server.listen(0, '127.0.0.1', r))
  config = { url: `http://127.0.0.1:${(central.server.address() as AddressInfo).port}`, user: 'api', password: 'clave-api', syncMinutes: 60, tlsVerify: true, timeoutMs: 2_000 }
  await createUser('admin-dir@prueba.test', ['admin'])
  await createUser('ana-dir@prueba.test', ['funcionario'])
})
afterAll(() => new Promise<void>((r) => central.server.close(() => r())))
beforeEach(async () => {
  await db.delete(directoryExtensions)
  await db.delete(directorySync)
  central.state.accounts = [cuenta('1001', 'Ana Pérez'), cuenta('1002', 'Luis Gómez'), cuenta('1003', 'Recepcion Despacho'), cuenta('1004', 'Pedro Castillo'), cuenta('2001', 'Persona Nueva')]
  central.state.loginStatus = 0
  central.state.actions = []
})

const service = (cfg: UcmConfig | null = config) => new DirectoryService(directoryRepository, cfg ? new UcmService(cfg) : null, cfg?.syncMinutes ?? 0, () => FIJO)

describe('cliente de la central', () => {
  it('entra con MD5(challenge + contraseña), recorre todas las páginas, sale, y solo toma extensión y nombre', async () => {
    const list = await new UcmService(config).listExtensions()
    expect(list).toEqual([
      { ext: '1001', name: 'Ana Pérez' },
      { ext: '1002', name: 'Luis Gómez' },
      { ext: '1003', name: 'Recepcion Despacho' },
      { ext: '1004', name: 'Pedro Castillo' },
      { ext: '2001', name: 'Persona Nueva' },
    ])
    expect(central.state.actions).toEqual(['challenge', 'login', 'listAccount', 'listAccount', 'listAccount', 'logout'])
    // Solo lectura: ninguna acción que cambie la central.
    expect(central.state.actions.every((a) => ['challenge', 'login', 'listAccount', 'logout'].includes(a))).toBe(true)
  })

  it('con la contraseña equivocada falla con el estado -37 y un mensaje sin la dirección ni el usuario', async () => {
    const err = await new UcmService({ ...config, password: 'otra' }).listExtensions().catch((e: unknown) => e)
    expect(err).toBeInstanceOf(UcmError)
    expect((err as UcmError).status).toBe(-37)
    expect((err as UcmError).message).not.toContain('127.0.0.1')
    expect((err as UcmError).message).not.toContain('api')
  })
})

describe('sincronización', () => {
  it('guarda solo extensión y nombre, y la visita muestra lo que dice la central (con la dirección del directorio fijo)', async () => {
    const s = service()
    expect(await s.sync()).toBe(5)
    const filas = await db.select().from(directoryExtensions)
    expect(Object.keys(filas[0]).sort()).toEqual(['ext', 'name', 'seenAt'])
    expect(JSON.stringify(filas)).not.toMatch(/10\.0\.0\.9|sip-secreto|x@y\.test|AA:BB/)

    const v = await s.view()
    expect(v.fuente).toBe('central')
    expect(v.actualizadoEn).toBeInstanceOf(Date)
    // 1002 tiene a Luis Gómez en la central y en el directorio: queda la fila del directorio.
    expect(v.personas.map((p) => [p.ext, p.nombre, p.apellido, p.direccion])).toEqual([
      ['1001', 'Ana', 'Pérez', 'Tecnología e Innovación'],
      ['1002', 'Luis', 'Gómez', 'Tecnología e Innovación'],
      ['1003', 'Recepción', '', 'Despacho'],
      // La extensión cambió de dueño: el nombre de la central, la dirección de la extensión.
      ['1004', 'Pedro', 'Castillo', 'Tecnología e Innovación'],
      // Nueva en la central: sin dirección (la central no la sabe).
      ['2001', 'Persona', 'Nueva', ''],
    ])
  })

  it('si una pasada falla o llega vacía, conserva la última copia buena', async () => {
    const s = service()
    await s.sync()
    const antes = await s.view()
    central.state.accounts = []
    expect(await s.sync()).toBe(0)
    central.state.loginStatus = -8
    expect(await s.sync()).toBe(0)
    const despues = await s.view()
    expect(despues.personas).toEqual(antes.personas)
    expect(despues.actualizadoEn).toEqual(antes.actualizadoEn)
    expect((await directoryRepository.findState())?.lastError).toContain('se conserva la copia anterior')
  })

  it('si la central rechaza el usuario o la contraseña, no vuelve a intentarlo (cada intento acerca el bloqueo)', async () => {
    const s = service({ ...config, password: 'otra' })
    expect(await s.sync()).toBe(0)
    const logins = central.state.actions.filter((a) => a === 'login').length
    expect(await s.sync()).toBe(0)
    expect(central.state.actions.filter((a) => a === 'login').length).toBe(logins)
    expect((await s.comparison()).estado).toMatchObject({ sincronizacionAutomatica: false, error: expect.stringContaining('rechazó el usuario o la contraseña') })
  })

  it('sin copia (o sin central configurada) se muestran los datos fijos', async () => {
    const v = await service(null).view()
    expect(v).toEqual({ personas: FIJO, actualizadoEn: null, fuente: 'fija' })
    expect(await service(null).sync()).toBe(0)
  })
})

describe('mezcla y comparación', () => {
  it('si la copia cubre menos de la mitad del directorio, no oculta a nadie', () => {
    const v = merge(FIJO, [{ ext: '1001', name: 'Ana Pérez' }], new Date())
    expect(v.personas).toEqual(FIJO)
    expect(v.fuente).toBe('fija')
  })

  it('compara: nuevas en la central, las que ya no están y los nombres distintos', () => {
    const r = compare(FIJO, [
      { ext: '1001', name: 'ANA PEREZ' },
      { ext: '1003', name: 'Recepcion Despacho' },
      { ext: '1004', name: 'Pedro Castillo' },
      { ext: '2001', name: 'Persona Nueva' },
    ])
    expect(r.soloEnCentral).toEqual([{ ext: '2001', nombre: 'Persona Nueva' }])
    expect(r.soloEnDirectorio).toEqual([{ ext: '1002', nombre: 'Luis Gómez', direccion: 'Tecnología e Innovación' }])
    expect(r.nombreDistinto).toEqual([{ ext: '1004', directorio: 'Marta Ruiz', central: 'Pedro Castillo', direccion: 'Tecnología e Innovación' }])
    expect(sameName('Recepción', 'RECEPCION DITI')).toBe(true)
    expect(samePerson(persona('Ana', 'Pérez', '1'), 'ANA MARIA PEREZ GOMEZ')).toBe(true)
    expect(samePerson(persona('Ana', 'Pérez', '1'), 'LUIS PEREZ')).toBe(false)
  })

  it('los nombres en MAYÚSCULAS de la central se escriben como nombres; la central sin nombre no se publica', () => {
    expect(capitalize('MARIA DE LOS ANGELES PEREZ')).toBe('Maria de los Angeles Perez')
    expect(capitalize('Ana Pérez')).toBe('Ana Pérez')
    const v = merge(FIJO, [...FIJO.map((e) => ({ ext: e.ext, name: '' })), { ext: '1001', name: 'JOSE DEL CARMEN RIOS' }], new Date())
    expect(v.personas).toEqual([{ nombre: 'Jose', apellido: 'del Carmen Rios', direccion: 'Tecnología e Innovación', ext: '1001', ubicacion: '' }])
  })

  it('los equipos (bocinas, paradas…) salen enteros y marcados para buscarlos; «Disponible» no se publica', () => {
    const copia = [...FIJO.map((e) => ({ ext: e.ext, name: '' })), { ext: '3001', name: 'BOCINA 1' }, { ext: '3002', name: 'Disponible' }, { ext: '3003', name: 'JUZGADO EJECUTOR 1' }]
    expect(merge(FIJO, copia, new Date()).personas.map((p) => [p.ext, p.nombre, p.apellido, p.soloBusqueda ?? false])).toEqual([
      ['3001', 'Bocina 1', '', true],
      ['3003', 'Juzgado', 'Ejecutor 1', false],
    ])
  })
})

describe('GET /api/directory', () => {
  it('cualquiera lo lee (sin la central configurada: los datos fijos, sin fecha)', async () => {
    const r = await anonymous().get('/api/directory')
    expect(r.status).toBe(200)
    expect(r.body.fuente).toBe('fija')
    expect(r.body.actualizadoEn).toBeNull()
    expect(r.body.personas.length).toBeGreaterThan(100)
    expect(Object.keys(r.body.personas[0]).sort()).toEqual(['apellido', 'direccion', 'ext', 'nombre', 'ubicacion'])
  })

  it('la comparación es solo de administración', async () => {
    expect((await anonymous().get('/api/directory/comparison')).status).toBe(401)
    expect((await (await loginAs('ana-dir@prueba.test')).get('/api/directory/comparison')).status).toBe(403)
    const r = await (await loginAs('admin-dir@prueba.test')).get('/api/directory/comparison')
    expect(r.status).toBe(200)
    expect(r.body.estado).toMatchObject({ configurada: false, extensionesEnCentral: 0, fuente: 'fija' })
  })
})
