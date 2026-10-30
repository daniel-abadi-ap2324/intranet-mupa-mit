/** Boletines: descripción corta, palabras clave y buscador (?q=), sacados del texto de su PDF. */
import { eq } from 'drizzle-orm'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { db } from '../src/config/database.ts'
import { bulletins } from '../src/database/schema/index.ts'
import { bulletinService } from '../src/features/bulletins/bulletins.service.ts'
import { dateWords, describePdf, normalizeSearch } from '../src/shared/services/pdf-text.service.ts'
import { anonymous, createUser, loginAs } from './helpers.ts'
import { boletinDePrueba, boletinDeTeatro, textPdf } from './pdf-fixtures.ts'

let comu: Awaited<ReturnType<typeof loginAs>>

beforeAll(async () => {
  await createUser('comu-bus@prueba.test', ['comunicacion'], 'Carla')
  await createUser('func-bus@prueba.test', ['funcionario'])
  comu = await loginAs('comu-bus@prueba.test')
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
})

beforeEach(async () => {
  await db.delete(bulletins)
})

const subir = async (pdf: Buffer, nombre = 'boletin.pdf') => {
  const r = await comu.post('/api/files').set('Content-Type', 'application/octet-stream').set('X-File-Name', encodeURIComponent(nombre)).send(pdf)
  expect(r.status).toBe(201)
  return r.body.url as string
}
const crear = async (date: string, pdfUrl: string | null = null) => {
  const r = await comu.post('/api/bulletins').send({ date, pdfUrl })
  expect(r.status).toBe(201)
  return r.body as { id: number; summary: string | null; keywords: string[] }
}
const buscar = async (q: string) => (await anonymous().get('/api/bulletins').query({ q })).body as { id: number; date: string }[]

describe('describePdf', () => {
  it('saca los titulares (letra grande) y deja fuera la cabecera y el número de página', async () => {
    const info = (await describePdf(boletinDePrueba()))!
    expect(info.summary).toBe('Nuevo programa de reciclaje en los barrios · Mercados municipales con horario extendido')
  })

  it('palabras clave: las que más pesan, sin las que no distinguen un boletín de otro', async () => {
    const info = (await describePdf(boletinDePrueba()))!
    expect(info.keywords).toContain('reciclaje')
    expect(info.keywords).toContain('mercados')
    // «Alcaldía», meses, artículos y números no son palabras clave.
    expect(info.keywords).not.toContain('alcaldia')
    expect(info.keywords.length).toBeLessThanOrEqual(8)
  })

  it('el texto para buscar va sin tildes ni mayúsculas', async () => {
    const info = (await describePdf(boletinDePrueba()))!
    expect(info.searchText).toBe(normalizeSearch(info.searchText))
    expect(info.searchText).toContain('reciclaje')
  })

  it('un PDF sin texto, o roto, no da descripción', async () => {
    expect(await describePdf(textPdf([[{ size: 12, text: 'x' }]]))).toBeNull()
    await expect(describePdf(Buffer.from('%PDF-1.4\nno es un PDF de verdad\n'))).rejects.toThrow()
  })
})

describe('guardar un boletín', () => {
  it('con PDF subido: se describe solo y se ve en la lista', async () => {
    const b = await crear('2026-09-30', await subir(boletinDePrueba()))
    expect(b.summary).toContain('Nuevo programa de reciclaje')
    expect(b.keywords).toContain('reciclaje')
    const publico = (await anonymous().get('/api/bulletins')).body[0]
    expect(publico).toMatchObject({ summary: b.summary, keywords: b.keywords })
  })

  it('sin PDF: sin descripción, pero se encuentra por su fecha', async () => {
    const b = await crear('2026-03-05')
    expect(b).toMatchObject({ summary: null, keywords: [] })
    expect((await buscar('marzo')).map((x) => x.id)).toEqual([b.id])
  })

  it('un PDF que no se puede leer no impide guardar el boletín', async () => {
    const roto = await subir(Buffer.from('%PDF-1.4\nesto no se puede leer como PDF\n'), 'roto.pdf')
    const b = await crear('2026-04-01', roto)
    expect(b.summary).toBeNull()
  })

  it('al cambiar el PDF se vuelve a describir; al cambiar la fecha se busca por la nueva', async () => {
    const otro = boletinDeTeatro()
    const b = await crear('2026-09-30', await subir(boletinDePrueba()))
    const urlOtro = await subir(otro, 'otro.pdf')
    expect((await comu.patch(`/api/bulletins/${b.id}`).send({ pdfUrl: urlOtro })).body.summary).toBe('Festival de teatro en el casco antiguo')
    expect(await buscar('reciclaje')).toEqual([])
    expect((await buscar('teatro')).map((x) => x.id)).toEqual([b.id])

    await comu.patch(`/api/bulletins/${b.id}`).send({ date: '2026-12-02' })
    expect(await buscar('septiembre')).toEqual([])
    expect((await buscar('diciembre')).map((x) => x.id)).toEqual([b.id])
  })
})

describe('buscador (?q=)', () => {
  let a: number
  let b: number
  beforeEach(async () => {
    a = (await crear('2026-09-30', await subir(boletinDePrueba()))).id
    const otro = boletinDeTeatro()
    b = (await crear('2026-10-15', await subir(otro, 'otro.pdf'))).id
  })

  it('encuentra por palabras del titular, del texto y las palabras clave, sin importar tildes ni mayúsculas', async () => {
    expect((await buscar('RECICLAJE')).map((x) => x.id)).toEqual([a])
    expect((await buscar('mercados horario')).map((x) => x.id)).toEqual([a])
    expect((await buscar('Teatro')).map((x) => x.id)).toEqual([b])
    expect((await buscar('música')).map((x) => x.id)).toEqual([b])
  })

  it('encuentra por fecha: mes, día y año, o la fecha completa', async () => {
    expect((await buscar('septiembre')).map((x) => x.id)).toEqual([a])
    expect((await buscar('15 de octubre')).map((x) => x.id)).toEqual([b])
    expect((await buscar('2026-09-30')).map((x) => x.id)).toEqual([a])
    expect((await buscar('2026')).map((x) => x.id)).toEqual([b, a])
  })

  it('todas las palabras tienen que estar (en cualquier orden); sin coincidencias, lista vacía', async () => {
    expect((await buscar('reciclaje teatro')).map((x) => x.id)).toEqual([])
    expect((await buscar('programa reciclaje')).map((x) => x.id)).toEqual([a])
    expect(await buscar('zzzzz')).toEqual([])
  })

  it('sin q o vacío trae todos; % y _ no son comodines', async () => {
    expect(((await anonymous().get('/api/bulletins')).body as unknown[]).length).toBe(2)
    expect(((await anonymous().get('/api/bulletins').query({ q: '   ' })).body as unknown[]).length).toBe(2)
    expect(await buscar('%')).toEqual([])
    expect(await buscar('_')).toEqual([])
    expect(await buscar('\\')).toEqual([])
  })

  it('los ocultos no salen para quien lee, pero Comunicación los ve en su panel', async () => {
    await comu.patch(`/api/bulletins/${a}`).send({ published: false })
    expect(await buscar('reciclaje')).toEqual([])
    expect((await comu.get('/api/bulletins/manage')).body.map((x: { id: number }) => x.id)).toContain(a)
  })

  it('una búsqueda larguísima se rechaza (400)', async () => {
    expect((await anonymous().get('/api/bulletins').query({ q: 'a'.repeat(101) })).status).toBe(400)
  })
})

describe('describeMissing (al arrancar la API)', () => {
  it('completa los que no tienen descripción ni texto para buscar', async () => {
    const url = await subir(boletinDePrueba())
    const [fila] = await db.insert(bulletins).values({ date: '2026-02-10', pdfUrl: url }).returning()
    const [sinPdf] = await db.insert(bulletins).values({ date: '2026-02-11' }).returning()
    expect(fila.searchText).toBeNull()

    expect(await bulletinService.describeMissing()).toBe(2)
    const [conTexto] = await db.select().from(bulletins).where(eq(bulletins.id, fila.id))
    expect(conTexto.summary).toContain('Nuevo programa de reciclaje')
    expect(conTexto.searchText).toContain(dateWords('2026-02-10'))
    const [soloFecha] = await db.select().from(bulletins).where(eq(bulletins.id, sinPdf.id))
    expect(soloFecha).toMatchObject({ summary: null, searchText: dateWords('2026-02-11') })
    // Ya completos: no se repite.
    expect(await bulletinService.describeMissing()).toBe(0)
  })
})
