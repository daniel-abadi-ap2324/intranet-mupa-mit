/**
 * Datos iniciales. Idempotente: solo agrega lo que falta, nunca pisa lo editado.
 *  - Catálogo: 76 aplicaciones y sus etiquetas (inventario del sitio actual y de
 *    DITI; las "Oculto" quedan como borrador). Solo si el catálogo está vacío.
 *  - Departamentos: las direcciones de RRHH (seed-data/departamentos.json, lo genera
 *    scripts/importar-rrhh.mjs). Solo la primera vez.
 *  - Contenido del Inicio (el de la propuesta). Solo si no existe.
 *  - Con demoUsers: cuentas FICTICIAS de prueba (contraseña "password").
 *    Nunca en el servidor real.
 */
import fs from 'node:fs'
import path from 'node:path'

import { inArray, isNotNull, isNull, sql } from 'drizzle-orm'

import { db } from '../config/database.ts'
import { env } from '../config/env.ts'
import { ACCESS_LEVELS, AREAS, STATUSES } from '../features/applications/applications.constants.ts'
import { hashService } from '../shared/services/hash.service.ts'
import { applications, applicationTags, bulletins, departments, forms, homeSettings, news, tags, users, videos } from './schema/index.ts'

const leer = (archivo: string) => JSON.parse(fs.readFileSync(path.join(import.meta.dirname, 'seed-data', archivo), 'utf8'))

type AppJson = {
  id: string
  nombre: string
  descripcion: string
  categoria: string
  etiquetas: string[]
  url?: string
  urlPrototipo?: string
  externo?: boolean
  pdf?: boolean
  acceso?: string
  estado: string
  confirmado?: boolean
  origen?: string
  icono?: string
  palabras?: string
  nota?: string
  favorito?: boolean
}

const AUDIENCIAS = ['Uso interno', 'Ciudadanía', 'Administración']
const ESTADO: Record<string, string> = { Publicado: 'publicado', Pendiente: 'pendiente', 'Solo red interna': 'solo-red-interna', Oculto: 'publicado' }

export const DEMO_USERS = [
  { email: 'admin@ejemplo.test', firstName: 'Admin', lastName: 'Local', roles: ['admin'] },
  { email: 'comunicacion@ejemplo.test', firstName: 'Comunicación', lastName: 'Institucional', roles: ['comunicacion'] },
  { email: 'gestor@ejemplo.test', firstName: 'Gestora', lastName: 'de Solicitudes', roles: ['gestorSolicitudes'] },
  { email: 'prueba1@ejemplo.test', firstName: 'Lucía', lastName: 'Herrera', roles: ['funcionario'] },
  { email: 'prueba2@ejemplo.test', firstName: 'Tomás', lastName: 'Quintero', roles: ['funcionario'] },
  { email: 'sindepto@ejemplo.test', firstName: 'Sara', lastName: 'Sin Departamento', roles: ['funcionario'] },
]
export const DEMO_PASSWORD = 'password'
/** La cuenta de prueba que entra sin departamento (para probar que la intranet se lo pide). */
export const SIN_DEPARTAMENTO = 'sindepto@ejemplo.test'

/** Formularios del sitio actual (seed-data/formularios.json, con los nombres que usaba la web). */
type FormularioJson = { slug: string; id: number; area: 'ti' | 'rrhh'; aDefinir?: boolean; plazo: string | null; title: string; intro: string; notes?: string[]; cambios?: string[]; sections: unknown[] }
const AREA_FORMULARIO = {
  ti: { area: 'Tecnología', destination: 'Mesa de Servicios (ext. 1400)' },
  rrhh: { area: 'Recursos Humanos', destination: 'Recursos Humanos (506-9692, ext. 9171/9172)' },
}

/** Rutas del prototipo (x.html) → rutas de la SPA. */
function ruta(a: AppJson): string | null {
  const p = a.urlPrototipo
  if (p && /^formulario\.html\?f=/.test(p)) return '/formularios/' + p.split('=')[1]
  if (p && /\.html$/.test(p)) return '/' + p.replace('.html', '')
  return a.url || null
}

const valido = <T extends string>(lista: readonly T[], v: string | undefined, porDefecto: T): T => (lista as readonly string[]).includes(v ?? '') ? (v as T) : porDefecto

export async function runSeed(options: { demoUsers: boolean }): Promise<{ applications: number; users: number; departments: number }> {
  let creadas = 0
  let cuentas = 0
  let deps = 0

  // ---------- Departamentos: las direcciones de RRHH, una sola vez (después los maneja administración) ----------
  if (!(await db.select({ id: departments.id }).from(departments).where(isNotNull(departments.rrhhCode)).limit(1)).length) {
    const lista = (leer('departamentos.json') as { departamentos: { codigoRrhh: number; nombre: string }[] }).departamentos
    deps = (
      await db
        .insert(departments)
        .values(lista.map((d) => ({ name: d.nombre, rrhhCode: d.codigoRrhh })))
        // Uno con el mismo nombre que ya existía (y se usa) queda enlazado a RRHH en vez de repetirse.
        .onConflictDoUpdate({ target: departments.name, set: { rrhhCode: sql`excluded.rrhh_code` }, setWhere: isNull(departments.rrhhCode) })
        .returning({ id: departments.id })
    ).length
  }

  // ---------- Catálogo ----------
  const hay = await db.select({ id: applications.id }).from(applications).limit(1)
  if (!hay.length) {
    const lista = (leer('aplicaciones.json') as { aplicaciones: AppJson[] }).aplicaciones
    await db.transaction(async (tx) => {
      const nombres = [...new Set(lista.flatMap((a) => a.etiquetas))]
      await tx
        .insert(tags)
        .values(nombres.map((name) => ({ name, audience: AUDIENCIAS.includes(name) })))
        .onConflictDoNothing()
      // Todas, no solo las recién creadas: si el catálogo se vació pero las etiquetas quedaron, las apps igual las llevan.
      const filas = await tx.select({ id: tags.id, name: tags.name }).from(tags).where(inArray(tags.name, nombres))
      const idEtiqueta = new Map(filas.map((t) => [t.name, t.id]))

      for (const a of lista) {
        const [app] = await tx
          .insert(applications)
          .values({
            slug: a.id,
            name: a.nombre,
            description: a.descripcion.slice(0, 160),
            url: ruta(a),
            area: valido(AREAS, a.categoria, 'Soporte'),
            icon: a.icono || '▦',
            access: valido(ACCESS_LEVELS, a.acceso, 'todos'),
            status: valido(STATUSES, ESTADO[a.estado], 'publicado'),
            external: !!a.externo,
            pdf: !!a.pdf,
            featured: !!a.favorito,
            confirmed: !!a.confirmado,
            keywords: a.palabras || '',
            note: a.nota || '',
            origin: a.origen || 'panel',
            published: a.estado !== 'Oculto',
          })
          .returning({ id: applications.id })
        const ids = a.etiquetas.map((n) => idEtiqueta.get(n)).filter((id): id is number => id !== undefined)
        if (ids.length) await tx.insert(applicationTags).values(ids.map((tagId) => ({ applicationId: app.id, tagId })))
        creadas++
      }
    })
  }

  // ---------- Boletines (solo en una base nueva: después los maneja Comunicación) ----------
  if (!(await db.$count(bulletins))) {
    const lista = (leer('boletines.json') as { boletines: (typeof bulletins.$inferInsert)[] }).boletines
    if (lista.length) await db.insert(bulletins).values(lista)
  }

  // En la edición publicación esas funciones no existen: no se carga su contenido de muestra.
  if (env.EDICION === 'completa') await seedHiddenContent()
  await seedForms()

  // ---------- Contenido del Inicio ----------
  await db.insert(homeSettings).values({ key: 'content', value: leer('contenido-inicio.json') }).onConflictDoNothing()

  // ---------- Cuentas ficticias ----------
  if (options.demoUsers) {
    const passwordHash = await hashService.hash(DEMO_PASSWORD)
    // Entrar exige departamento: las cuentas de prueba ya lo traen, salvo sindepto (queda sin él para probar esa pantalla).
    const [primero] = await db.select({ id: departments.id }).from(departments).orderBy(departments.id).limit(1)
    const r = await db
      .insert(users)
      .values(DEMO_USERS.map((u) => ({ ...u, passwordHash, departmentId: u.email === SIN_DEPARTAMENTO ? null : (primero?.id ?? null) })))
      // El correo es único solo entre las cuentas locales (índice parcial users_local_email_unique).
      .onConflictDoNothing({ target: users.email, where: isNull(users.identitySub) })
      .returning({ id: users.id })
    cuentas = r.length
  }

  return { applications: creadas, users: cuentas, departments: deps }
}

async function seedHiddenContent() {
  // ---------- Noticias y videos (solo en una base nueva: después los maneja Comunicación) ----------
  if (!(await db.$count(news))) {
    // Hoy vacía: no había ninguna vigente en la intranet vieja.
    const lista = (leer('noticias.json') as { noticias: (typeof news.$inferInsert)[] }).noticias
    if (lista.length) await db.insert(news).values(lista.map((n) => ({ ...n, status: 'publicado' })))
  }
  if (!(await db.$count(videos))) {
    const lista = (leer('videos.json') as { videos: (typeof videos.$inferInsert)[] }).videos
    if (lista.length) await db.insert(videos).values(lista)
  }
}

async function seedForms() {
  // ---------- Formularios (solo en una base nueva: después los maneja el Gestor de Solicitudes) ----------
  // Empiezan sin recibir solicitudes: el envío es de prueba hasta que su área los apruebe
  // (los marcados `aDefinir` no pueden recibirlas hasta que RRHH defina su alcance).
  if (!(await db.$count(forms))) {
    const lista = leer('formularios.json') as FormularioJson[]
    await db.insert(forms).values(
      lista.map((f) => ({
        slug: f.slug,
        number: f.id,
        title: f.title,
        area: AREA_FORMULARIO[f.area].area,
        destination: AREA_FORMULARIO[f.area].destination,
        deadline: f.plazo,
        pendingDefinition: f.aDefinir ?? false,
        intro: f.intro,
        notes: f.notes ?? [],
        changes: f.cambios ?? [],
        sections: f.sections,
      })),
    )
  }
}
