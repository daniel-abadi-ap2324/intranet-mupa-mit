import { callCodeService, type CallCodeService } from '../../shared/services/callcode.service.ts'
import { authService, type AuthService } from '../auth/auth.service.ts'
import type { CallCodeRequestsResponse } from './dtos/call-code-requests.dto.ts'

export class CallCodesService {
  private readonly callCodes: CallCodeService | null
  private readonly auth: AuthService

  constructor(callCodes: CallCodeService | null = callCodeService, auth: AuthService = authService) {
    this.callCodes = callCodes
    this.auth = auth
  }

  /**
   * Las solicitudes de código de llamada de quien tiene la sesión. La cédula sale SIEMPRE de la sesión (cifrada con su
   * cookie), nunca de lo que mande el navegador; solo lectura. Con Bearer (otra app) no hay sesión de la intranet donde
   * esté la cédula: se responde que no se conoce.
   */
  async myRequests(sessionToken: string | undefined): Promise<CallCodeRequestsResponse> {
    if (!this.callCodes) return { available: false, knownCedula: false, total: 0, requests: [] }
    const cedula = sessionToken ? await this.auth.findSessionCedula(sessionToken) : undefined
    if (!cedula) return { available: true, knownCedula: false, total: 0, requests: [] }
    const requests = await this.callCodes.requests(cedula)
    return { available: true, knownCedula: true, total: requests.length, requests }
  }
}

export const callCodesService = new CallCodesService()
