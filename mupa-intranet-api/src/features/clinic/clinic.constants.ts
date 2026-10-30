import type { ClinicCatalog } from '../../shared/services/clinic-catalog.service.ts'

/** El catálogo leído de la Clínica se reutiliza durante 1 hora. */
export const CACHE_TTL_MS = 60 * 60 * 1000

/** Si la Clínica no respondió, no se vuelve a intentar hasta dentro de 5 minutos. */
export const RETRY_AFTER_MS = 5 * 60 * 1000

/** Cuándo se copió el respaldo de abajo del sistema de citas. */
export const FALLBACK_DATE = '2026-09-28T12:00:00-05:00'

/**
 * Copia de respaldo del catálogo público de clinica.mupa.gob.pa, tal como estaba
 * en FALLBACK_DATE. Se muestra solo si el sistema de citas no responde.
 */
export const FALLBACK_CATALOG: ClinicCatalog = {
  services: [
    { id: 1, name: 'Atención médica', description: 'Cita médica regular' },
    { id: 2, name: 'Lectura de resultados', description: 'Solo en Medicina General' },
  ],
  specialties: [
    { id: 2, name: 'Fonoaudiologia', description: 'Especialidad encargada de diagnosticos del habla y audio' },
    { id: 1, name: 'Medicina general', description: 'Especialidad encargada de diagnostica general de los pacientes' },
    { id: 3, name: 'Odontologia', description: 'Especialidad encargada de tratamiento bucal' },
    { id: 5, name: 'Psicologia clinica', description: 'Especialidad encargada de la evaluación, diagnóstico, tratamiento e investigación de los trastornos psicológicos y mentales' },
    { id: 6, name: 'Psicologia general', description: 'Especialidad encargado orientacion salud mental' },
  ],
  closedWeekdays: [0, 6],
  bookingWindow: { minDays: 1, maxDays: 90 },
}
