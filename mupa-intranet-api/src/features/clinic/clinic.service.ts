import { clinicAppointmentsService, type ClinicAppointmentsService } from '../../shared/services/clinic-appointments.service.ts'
import { clinicCatalogService, type ClinicCatalog, type ClinicCatalogService } from '../../shared/services/clinic-catalog.service.ts'
import { authService, type AuthService } from '../auth/auth.service.ts'
import type { AppointmentsQueryDto, AppointmentsResponse } from './dtos/appointments.dto.ts'
import { CACHE_TTL_MS, FALLBACK_CATALOG, FALLBACK_DATE, RETRY_AFTER_MS } from './clinic.constants.ts'

/**
 * Lo que la intranet muestra de la Clínica. `source`: 'clinic' si viene del
 * sistema de citas (aunque sea la última copia buena), 'fallback' si nunca se
 * pudo leer y es la copia de respaldo. `updatedAt`: cuándo se leyó.
 */
export type ClinicInfo = ClinicCatalog & { source: 'clinic' | 'fallback'; updatedAt: Date }

export class ClinicService {
  private readonly catalog: ClinicCatalogService
  private readonly now: () => number
  private cached: { data: ClinicCatalog; fetchedAt: number } | null = null
  private lastFailureAt = 0
  // Una sola consulta a la vez: si llegan varias personas juntas, esperan la misma.
  private pending: Promise<void> | null = null

  private readonly appointments: ClinicAppointmentsService | null
  private readonly auth: AuthService

  constructor(catalog: ClinicCatalogService, now: () => number = Date.now, appointments: ClinicAppointmentsService | null = null, auth: AuthService = authService) {
    this.catalog = catalog
    this.appointments = appointments
    this.auth = auth
    this.now = now
  }

  /**
   * Las citas de quien tiene la sesión (historial de la Clínica por su cédula). La cédula sale SIEMPRE de la
   * sesión (cifrada con su cookie), nunca de lo que mande el navegador; solo lectura. Con Bearer (otra app) no
   * hay sesión de la intranet donde esté la cédula: se responde que no se conoce.
   */
  async myAppointments(sessionToken: string | undefined, range: AppointmentsQueryDto): Promise<AppointmentsResponse> {
    const none = { patientFound: false, total: 0, appointments: [] }
    if (!this.appointments) return { available: false, knownCedula: false, ...none }
    const cedula = sessionToken ? await this.auth.findSessionCedula(sessionToken) : undefined
    if (!cedula) return { available: true, knownCedula: false, ...none }
    return { available: true, knownCedula: true, ...(await this.appointments.history(cedula, range)) }
  }

  async getInfo(): Promise<ClinicInfo> {
    const t = this.now()
    const fresh = this.cached && t - this.cached.fetchedAt < CACHE_TTL_MS
    const waitingToRetry = t - this.lastFailureAt < RETRY_AFTER_MS
    if (!fresh && !waitingToRetry) await (this.pending ??= this.refresh().finally(() => (this.pending = null)))

    if (this.cached) return { ...this.cached.data, source: 'clinic', updatedAt: new Date(this.cached.fetchedAt) }
    return { ...FALLBACK_CATALOG, source: 'fallback', updatedAt: new Date(FALLBACK_DATE) }
  }

  private async refresh(): Promise<void> {
    try {
      this.cached = { data: await this.catalog.fetchCatalog(), fetchedAt: this.now() }
    } catch (err) {
      this.lastFailureAt = this.now()
      console.error(`No se pudo leer el catálogo de la Clínica: ${(err as Error).message}`)
    }
  }
}

export const clinicService = new ClinicService(clinicCatalogService, Date.now, clinicAppointmentsService)
