import type { Request, Response } from 'express'

import { readSessionToken } from '../auth/auth.cookie.ts'
import { glpiTicketsResponseDto } from './dtos/glpi-tickets.dto.ts'
import { glpiTicketsService, type GlpiTicketsService } from './glpi.service.ts'

export class GlpiController {
  private readonly service: GlpiTicketsService

  constructor(service: GlpiTicketsService) {
    this.service = service
  }

  getMyTickets = async (req: Request, res: Response) => {
    // Con Bearer (otra app) no se usa la cookie: la cédula vive en la sesión de la intranet.
    const token = req.headers.authorization ? undefined : readSessionToken(req)
    res.status(200).json(glpiTicketsResponseDto.parse(await this.service.myTickets(token)))
  }
}

export const glpiController = new GlpiController(glpiTicketsService)
