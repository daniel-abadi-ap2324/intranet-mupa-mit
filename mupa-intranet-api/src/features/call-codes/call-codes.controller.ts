import type { Request, Response } from 'express'

import { readSessionToken } from '../auth/auth.cookie.ts'
import { callCodesService, type CallCodesService } from './call-codes.service.ts'
import { callCodeRequestsResponseDto } from './dtos/call-code-requests.dto.ts'

export class CallCodesController {
  private readonly service: CallCodesService

  constructor(service: CallCodesService) {
    this.service = service
  }

  getMyRequests = async (req: Request, res: Response) => {
    // Con Bearer (otra app) no se usa la cookie: la cédula vive en la sesión de la intranet.
    const token = req.headers.authorization ? undefined : readSessionToken(req)
    res.status(200).json(callCodeRequestsResponseDto.parse(await this.service.myRequests(token)))
  }
}

export const callCodesController = new CallCodesController(callCodesService)
