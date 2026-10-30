/** El Directorio con la copia de la central telefónica (GET /api/directory). */
import type { PersonaDirectorio } from '../data/directorio'

export type DirectorioApi = {
  personas: PersonaDirectorio[]
  /** Última sincronización buena con la central; null = datos fijos. */
  actualizadoEn: string | null
  fuente: 'central' | 'fija'
}

const MIN = 60_000

/** «hace 5 minutos», «hace 2 horas», «hace 3 días» (desde `fecha` hasta `ahora`). */
export function haceCuanto(fecha: string | Date, ahora: Date = new Date()): string {
  const ms = Math.max(0, ahora.getTime() - new Date(fecha).getTime())
  const plural = (n: number, uno: string, varios: string) => `hace ${n} ${n === 1 ? uno : varios}`
  if (ms < MIN) return 'hace menos de un minuto'
  if (ms < 60 * MIN) return plural(Math.floor(ms / MIN), 'minuto', 'minutos')
  if (ms < 24 * 60 * MIN) return plural(Math.floor(ms / (60 * MIN)), 'hora', 'horas')
  return plural(Math.floor(ms / (24 * 60 * MIN)), 'día', 'días')
}
