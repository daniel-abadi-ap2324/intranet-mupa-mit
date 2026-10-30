import fs from 'node:fs'
import path from 'node:path'

import { env } from '../../config/env.ts'
import { normalizeSearch } from '../../shared/services/pdf-text.service.ts'
import { directoryRepository, type DirectoryRepository } from './directory.repository.ts'
import { UCM_BAD_CREDENTIALS, UcmError, UcmService, type UcmExtension } from './ucm.service.ts'

/** Una persona u oficina del directorio telefónico (lo que ya publicaba /directorio: nada más). */
export type DirectoryEntry = {
  nombre: string
  apellido: string
  direccion: string
  unidad?: string
  ext: string
  ubicacion: string
  /** Un equipo (bocina, sala, parada…), no una persona ni una oficina: no sale en la lista, solo al buscarlo. */
  soloBusqueda?: boolean
}

export type DirectoryView = {
  personas: DirectoryEntry[]
  /** Última sincronización buena con la central; null = no hay copia (se muestran los datos fijos). */
  actualizadoEn: Date | null
  /** central = solo las extensiones que existen en la central; fija = el directorio fijo completo. */
  fuente: 'central' | 'fija'
}

/** Con menos de esta parte del directorio fijo en la central, la copia no se usa para ocultar a nadie. */
const MIN_COVERAGE = 0.5

/**
 * El directorio fijo: el mismo JSON que usa la web (mupa-intranet-app/src/data). En la imagen de Docker
 * se copia a /app/data; en desarrollo se lee del proyecto de la web. DIRECTORIO_JSON lo cambia.
 */
export function loadFixedDirectory(): DirectoryEntry[] {
  const file = [process.env.DIRECTORIO_JSON, path.resolve('data/directorio-personas.json'), path.resolve('../mupa-intranet-app/src/data/directorio-personas.json')].find(
    (p): p is string => Boolean(p) && fs.existsSync(p!),
  )
  if (!file) {
    console.warn('[directorio] no se encontró el directorio fijo')
    return []
  }
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as DirectoryEntry[]
  } catch {
    console.warn('[directorio] el directorio fijo no se pudo leer')
    return []
  }
}

const words = (s: string) => normalizeSearch(s).split(/[^a-z0-9ñ]+/).filter((w) => w.length >= 3)

/** Las mismas palabras de un nombre: «Recepción» ≈ «Recepcion DITI» (al menos una en común). */
export function sameName(a: string, b: string): boolean {
  const wa = new Set(words(a))
  return words(b).some((w) => wa.has(w))
}

/**
 * La misma persona del directorio fijo: su primer nombre y su primer apellido están en el nombre de la central
 * («Ana Pérez» ≈ «ANA MARIA PEREZ GOMEZ», pero no ≈ «LUIS PEREZ»). Una oficina (sin apellido), con una palabra en común.
 */
export function samePerson(e: DirectoryEntry, central: string): boolean {
  if (!e.apellido.trim()) return sameName(e.nombre, central)
  const wc = new Set(words(central))
  const [nombre] = words(e.nombre)
  const [apellido] = words(e.apellido)
  return Boolean(nombre && apellido && wc.has(nombre) && wc.has(apellido))
}

// Equipos de la central que no son personas ni oficinas («Bocina 1», «Magna 3», «Parada Utp2», «Empleo3.1», «4875»).
// Una oficina con número («Juzgado Ejecutor 1») o un CAC («Cac Magnacorp», «Cac Crystal Plaza Vehiculos») sí sale en la lista.
const EQUIPO = /^\d+$|\b(bocina|magna|parada|grupo tx|veh[ií]culo|cocina)\b|\bempleo ?\d/i
// Extensiones libres o de quien está de vacaciones: no se publican (como en el directorio fijo).
const NO_PUBLICAR = /^(disponible|vacaciones)$/i

export const esEquipo = (name: string) => EQUIPO.test(name)

// Palabras que van en minúscula dentro de un nombre («María de los Ángeles»).
const MINUSCULAS = new Set(['de', 'del', 'la', 'las', 'los', 'y', 'e', 'da', 'van', 'von'])

/** La central guarda los nombres en MAYÚSCULAS: «MARIA DE LOS ANGELES PEREZ» → «Maria de los Angeles Perez». */
export function capitalize(name: string): string {
  if (name !== name.toUpperCase()) return name.trim()
  return name
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((w, i) => (i > 0 && MINUSCULAS.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ')
}

const fullName = (e: DirectoryEntry) => [e.nombre, e.apellido].filter(Boolean).join(' ')

/**
 * Lo que se publica (decisión de Daniel, 27-oct-2026): lo que dice la central. Cada extensión de la central con
 * nombre sale con ese nombre; la central no sabe la dirección ni la ubicación, así que se toman del directorio fijo
 * para esa misma extensión (vacías si la extensión es nueva). Si la persona es la misma del directorio fijo, se deja
 * esa fila (con sus tildes y su nombre y apellido bien separados). Sin copia, o si la copia cubre menos de la mitad
 * del directorio (una respuesta incompleta de la central), se muestra el directorio fijo.
 */
export function merge(fixed: DirectoryEntry[], copy: { ext: string; name: string }[], updatedAt: Date | null): DirectoryView {
  if (!copy.length || !updatedAt) return { personas: fixed, actualizadoEn: null, fuente: 'fija' }
  const central = new Set(copy.map((c) => c.ext))
  const exts = new Set(fixed.map((e) => e.ext))
  const covered = [...exts].filter((e) => central.has(e)).length
  if (!exts.size || covered / exts.size < MIN_COVERAGE) return { personas: fixed, actualizadoEn: updatedAt, fuente: 'fija' }
  const byExt = new Map<string, DirectoryEntry[]>()
  for (const e of fixed) byExt.set(e.ext, [...(byExt.get(e.ext) ?? []), e])
  const personas = copy
    .filter((c) => c.name.trim() && !NO_PUBLICAR.test(c.name.trim()))
    .map((c): DirectoryEntry => {
      const es = byExt.get(c.ext) ?? []
      const same = es.find((e) => samePerson(e, c.name))
      if (same) return same
      const base = es[0]
      const nombreCompleto = capitalize(c.name)
      // Un equipo va entero en el nombre (sin partirlo en nombre y apellido).
      const [nombre, ...resto] = esEquipo(nombreCompleto) ? [nombreCompleto] : nombreCompleto.split(' ')
      return {
        nombre,
        apellido: resto.join(' '),
        direccion: base?.direccion ?? '',
        ...(base?.unidad ? { unidad: base.unidad } : {}),
        ext: c.ext,
        ubicacion: base?.ubicacion ?? '',
        ...(esEquipo(nombreCompleto) ? { soloBusqueda: true } : {}),
      }
    })
  return { personas, actualizadoEn: updatedAt, fuente: 'central' }
}

/** Central contra directorio fijo: qué cambió respecto de lo que publicaba la intranet vieja (solo administración). */
export function compare(fixed: DirectoryEntry[], copy: UcmExtension[]) {
  const central = new Map(copy.map((c) => [c.ext, c.name]))
  const byExt = new Map<string, DirectoryEntry[]>()
  for (const e of fixed) byExt.set(e.ext, [...(byExt.get(e.ext) ?? []), e])
  return {
    soloEnCentral: copy.filter((c) => !byExt.has(c.ext)).map((c) => ({ ext: c.ext, nombre: c.name })),
    soloEnDirectorio: fixed.filter((e) => !central.has(e.ext)).map((e) => ({ ext: e.ext, nombre: fullName(e), direccion: e.direccion })),
    nombreDistinto: [...byExt]
      .filter(([ext, es]) => central.has(ext) && central.get(ext) && !es.some((e) => samePerson(e, central.get(ext)!)))
      .map(([ext, es]) => ({ ext, directorio: es.map(fullName).join(' / '), central: central.get(ext)!, direccion: es[0].direccion })),
  }
}

/**
 * El Directorio con la central telefónica: sincroniza al arrancar y cada UCM_SYNC_MINUTOS, guarda la última
 * copia buena en la base y las visitas leen esa copia (nunca llaman a la central). Si una pasada falla o
 * llega vacía, la copia anterior se queda. Si la central rechaza el usuario o la contraseña, no se reintenta
 * hasta reiniciar la API: cada intento fallido acerca el bloqueo de la cuenta.
 */
export class DirectoryService {
  private readonly repository: DirectoryRepository
  private readonly ucm: UcmService | null
  private readonly syncMinutes: number
  private readonly fixed: () => DirectoryEntry[]
  private fixedCache: DirectoryEntry[] | null = null
  private cached: DirectoryEntry[] | null = null
  private timer: NodeJS.Timeout | null = null
  private running = false
  private blocked = false

  constructor(repository: DirectoryRepository, ucm: UcmService | null, syncMinutes: number, fixed: () => DirectoryEntry[] = loadFixedDirectory) {
    this.repository = repository
    this.ucm = ucm
    this.syncMinutes = syncMinutes
    this.fixed = fixed
  }

  private fixedEntries(): DirectoryEntry[] {
    this.fixedCache ??= this.fixed()
    return this.fixedCache
  }

  /** Lo que muestra /directorio: la última copia guardada mezclada con el directorio fijo. */
  async view(): Promise<DirectoryView> {
    const [copy, state] = await Promise.all([this.repository.findMany(), this.repository.findState()])
    const v = merge(this.fixedEntries(), copy, state?.lastOkAt ?? null)
    this.cached = v.personas
    return v
  }

  /** Para el asistente (sin esperar a la base): lo último que se leyó, o el directorio fijo. */
  people(): DirectoryEntry[] {
    return this.cached ?? this.fixedEntries()
  }

  async comparison() {
    const [copy, state] = await Promise.all([this.repository.findMany(), this.repository.findState()])
    const fixed = this.fixedEntries()
    const view = merge(fixed, copy, state?.lastOkAt ?? null)
    return {
      estado: {
        configurada: Boolean(this.ucm),
        sincronizacionAutomatica: Boolean(this.ucm) && this.syncMinutes > 0 && !this.blocked,
        cadaMinutos: this.syncMinutes,
        ultimaBuena: state?.lastOkAt ?? null,
        ultimoIntento: state?.lastAttemptAt ?? null,
        error: state?.lastError ?? null,
        extensionesEnCentral: copy.length,
        fuente: view.fuente,
      },
      ...(copy.length ? compare(fixed, copy) : { soloEnCentral: [], soloEnDirectorio: [], nombreDistinto: [] }),
    }
  }

  /** Una pasada: trae las extensiones y, si llegaron, reemplaza la copia. Devuelve cuántas guardó (0 = falló). */
  async sync(): Promise<number> {
    if (!this.ucm || this.running || this.blocked) return 0
    this.running = true
    const at = new Date()
    try {
      const list = await this.ucm.listExtensions()
      // Una extensión, una fila: si la central repite una, queda la primera.
      const unique = [...new Map(list.map((e) => [e.ext, e])).values()]
      if (!unique.length) {
        await this.repository.saveFailure('La central no devolvió extensiones: se conserva la copia anterior.', at)
        return 0
      }
      await this.repository.replaceAll(unique, at)
      await this.view()
      console.log(`[directorio] copia de la central actualizada: ${unique.length} extensiones`)
      return unique.length
    } catch (e) {
      const bad = e instanceof UcmError && e.status === UCM_BAD_CREDENTIALS
      if (bad) {
        this.blocked = true
        this.stop()
      }
      const msg = bad
        ? 'La central rechazó el usuario o la contraseña de la API: no se reintenta hasta reiniciar la API (revisa UCM_USER y UCM_PASSWORD).'
        : `${e instanceof UcmError ? e.message : 'Error inesperado'}: se conserva la copia anterior.`
      console.error('[directorio]', msg)
      await this.repository.saveFailure(msg, at).catch(() => undefined)
      return 0
    } finally {
      this.running = false
    }
  }

  /** Al arrancar: lee la copia guardada y, con la central configurada (y UCM_SYNC_MINUTOS > 0), sincroniza y programa las pasadas. */
  start(): void {
    void this.view().catch(() => undefined)
    if (!this.ucm || this.syncMinutes <= 0 || this.timer) return
    const run = () => void this.sync()
    const first = setTimeout(async () => {
      await this.sync()
      // Con el usuario o la contraseña rechazados no se programa nada más (o la cuenta se bloquea).
      if (this.blocked || this.timer !== first) return
      this.timer = setInterval(run, this.syncMinutes * 60_000)
      this.timer.unref()
    }, 5_000)
    first.unref()
    this.timer = first
  }

  stop(): void {
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
  }
}

export const directoryService = new DirectoryService(directoryRepository, env.ucm ? new UcmService(env.ucm) : null, env.ucm?.syncMinutes ?? 0)
