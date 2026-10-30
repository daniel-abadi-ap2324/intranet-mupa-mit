import type { Request, Response } from 'express'

import { panelResponseDto } from './dtos/panel-response.dto.ts'
import { gestionService, type GestionService } from './gestion.service.ts'

export class GestionController {
  private readonly service: GestionService

  constructor(service: GestionService) {
    this.service = service
  }

  panel = async (req: Request, res: Response) => {
    res.status(200).json(panelResponseDto.parse(await this.service.panel(req.user!)))
  }
}

export const gestionController = new GestionController(gestionService)
