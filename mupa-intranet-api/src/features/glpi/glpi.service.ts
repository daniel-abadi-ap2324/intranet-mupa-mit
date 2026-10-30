import { glpiService, type GlpiService } from '../../shared/services/glpi.service.ts'
import { authService, type AuthService } from '../auth/auth.service.ts'
import type { GlpiTicketsResponse } from './dtos/glpi-tickets.dto.ts'

export class GlpiTicketsService {
  private readonly glpi: GlpiService | null
  private readonly auth: AuthService

  constructor(glpi: GlpiService | null = glpiService, auth: AuthService = authService) {
    this.glpi = glpi
    this.auth = auth
  }

  /**
   * Los tickets de la Mesa de Ayuda de quien tiene la sesión. La cédula sale SIEMPRE de la sesión (cifrada con su cookie),
   * nunca de lo que mande el navegador; solo lectura. Con Bearer (otra app) no hay sesión de la intranet donde esté la
   * cédula: se responde que no se conoce.
   */
  async myTickets(sessionToken: string | undefined): Promise<GlpiTicketsResponse> {
    if (!this.glpi) return { available: false, knownCedula: false, userFound: false, total: 0, tickets: [] }
    const cedula = sessionToken ? await this.auth.findSessionCedula(sessionToken) : undefined
    if (!cedula) return { available: true, knownCedula: false, userFound: false, total: 0, tickets: [] }
    const { userFound, tickets } = await this.glpi.ticketsByCedula(cedula)
    return { available: true, knownCedula: true, userFound, total: tickets.length, tickets }
  }
}

export const glpiTicketsService = new GlpiTicketsService()
