import fs from 'node:fs'
import path from 'node:path'

import { eq, sql } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'

import { db } from '../src/config/database.ts'
import { applications, homeSettings } from '../src/database/schema/index.ts'
import { CACHE_TTL_MS, FALLBACK_CATALOG, RETRY_AFTER_MS } from '../src/features/clinic/clinic.constants.ts'
import { ClinicService } from '../src/features/clinic/clinic.service.ts'
import type { ClinicCatalog, ClinicCatalogService } from '../src/shared/services/clinic-catalog.service.ts'
import { anonymous, createApplication } from './helpers.ts'

const catalogo: ClinicCatalog = {
  services: [{ id: 1, name: 'Atención médica', description: 'Cita médica regular' }],
  specialties: [{ id: 1, name: 'Medicina general', description: null }],
  closedWeekdays: [0, 6],
  bookingWindow: { minDays: 1, maxDays: 60 },
}

/** Una Clínica falsa: responde el catálogo o falla, y cuenta cuántas veces la consultaron. */
function clinicaFalsa(respuestas: (ClinicCatalog | Error)[]) {
  let llamadas = 0
  const cliente = {
    fetchCatalog: async () => {
      const r = respuestas[Math.min(llamadas++, respuestas.length - 1)]
      if (r instanceof Error) throw r
      return r
    },
  } as unknown as ClinicCatalogService
  return { cliente, llamadas: () => llamadas }
}

describe('ClinicService: catálogo de la Clínica con copia en memoria', () => {
  it('lee la Clínica una vez y reutiliza la copia durante una hora', async () => {
    let ahora = 1_000_000
    const falsa = clinicaFalsa([catalogo])
    const servicio = new ClinicService(falsa.cliente, () => ahora)

    const primera = await servicio.getInfo()
    expect(primera).toMatchObject({ ...catalogo, source: 'clinic' })
    await servicio.getInfo()
    expect(falsa.llamadas()).toBe(1)

    ahora += CACHE_TTL_MS + 1
    await servicio.getInfo()
    expect(falsa.llamadas()).toBe(2)
  })

  it('si nunca respondió, muestra la copia de respaldo y espera antes de reintentar', async () => {
    let ahora = 1_000_000
    const falsa = clinicaFalsa([new Error('sin red'), catalogo])
    const servicio = new ClinicService(falsa.cliente, () => ahora)

    expect(await servicio.getInfo()).toMatchObject({ ...FALLBACK_CATALOG, source: 'fallback' })
    await servicio.getInfo()
    expect(falsa.llamadas()).toBe(1)

    ahora += RETRY_AFTER_MS + 1
    expect(await servicio.getInfo()).toMatchObject({ source: 'clinic', bookingWindow: { maxDays: 60 } })
  })

  it('si deja de responder, sigue mostrando la última copia buena', async () => {
    let ahora = 1_000_000
    const falsa = clinicaFalsa([catalogo, new Error('caída')])
    const servicio = new ClinicService(falsa.cliente, () => ahora)
    const leida = (await servicio.getInfo()).updatedAt

    ahora += CACHE_TTL_MS + 1
    const r = await servicio.getInfo()
    expect(r).toMatchObject({ source: 'clinic', specialties: catalogo.specialties })
    expect(r.updatedAt).toEqual(leida)
  })

  it('varias consultas juntas esperan una sola lectura', async () => {
    const falsa = clinicaFalsa([catalogo])
    const servicio = new ClinicService(falsa.cliente)
    await Promise.all([servicio.getInfo(), servicio.getInfo(), servicio.getInfo()])
    expect(falsa.llamadas()).toBe(1)
  })
})

describe('GET /api/clinic', () => {
  it('es público y, sin conexión con la Clínica, responde la copia de respaldo', async () => {
    const r = await anonymous().get('/api/clinic')
    expect(r.status).toBe(200)
    expect(r.body).toMatchObject({ source: 'fallback', closedWeekdays: [0, 6], bookingWindow: { minDays: 1, maxDays: 90 } })
    expect(r.body.specialties.map((s: { name: string }) => s.name)).toContain('Odontologia')
  })
})

describe('migración 0008: enlace nuevo de citas', () => {
  it('corrige la dirección vieja en el catálogo y en el contenido del Inicio', async () => {
    const vieja = 'https://apps.mupa.gob.pa/app/clinica/'
    await createApplication({ name: 'Agendar cita médica', url: vieja })
    await db.insert(homeSettings).values({ key: 'content', value: { clinica: { items: [{ t: 'Agendar cita médica', h: vieja }] } } }).onConflictDoNothing()

    const archivo = path.join(import.meta.dirname, '../src/database/migrations/0008_enlace-citas-clinica.sql')
    for (const sentencia of fs.readFileSync(archivo, 'utf8').split('--> statement-breakpoint')) await db.execute(sql.raw(sentencia))

    const [app] = await db.select().from(applications).where(eq(applications.slug, 'agendar-cita-m-dica'))
    expect(app.url).toBe('https://clinica.mupa.gob.pa/formulario')
    const [contenido] = await db.select().from(homeSettings).where(eq(homeSettings.key, 'content'))
    expect(JSON.stringify(contenido.value)).not.toContain(vieja)
    expect(JSON.stringify(contenido.value)).toContain('https://clinica.mupa.gob.pa/formulario')
  })
})

describe('migración 0009: sin el instructivo del sistema viejo', () => {
  it('lo quita del bloque de la Clínica del Inicio y limpia la descripción de "apps"', async () => {
    const pdf = '/sitio/2023/03/Instructivo-del-sistema-de-clinica-del-Municipio-de-Panama-vf3.pdf'
    const items = [
      { t: 'Agendar cita médica', h: 'https://clinica.mupa.gob.pa/formulario' },
      { t: 'Instructivo del sistema de clínica', h: pdf },
    ]
    await db
      .insert(homeSettings)
      .values({ key: 'content', value: { intro: 'Hola', clinica: { intro: 'Clínica', items } } })
      .onConflictDoUpdate({ target: homeSettings.key, set: { value: { intro: 'Hola', clinica: { intro: 'Clínica', items } } } })
    await createApplication({ name: 'apps', slug: 'apps', description: 'Plataforma que aloja otras aplicaciones; la cita médica vive en apps.mupa.gob.pa/app/clinica/.' })

    const archivo = path.join(import.meta.dirname, '../src/database/migrations/0009_quita-instructivo-clinica.sql')
    for (const sentencia of fs.readFileSync(archivo, 'utf8').split('--> statement-breakpoint')) await db.execute(sql.raw(sentencia))

    const [contenido] = await db.select().from(homeSettings).where(eq(homeSettings.key, 'content'))
    expect(contenido.value).toEqual({ intro: 'Hola', clinica: { intro: 'Clínica', items: [items[0]] } })
    const [apps] = await db.select().from(applications).where(eq(applications.slug, 'apps'))
    expect(apps.description).toBe('Plataforma que aloja otras aplicaciones.')
  })
})
