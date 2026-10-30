import type { Request, Response } from 'express'

import { summaryResponseDto } from './dtos/summary-response.dto.ts'
import { summaryService, type SummaryService } from './summary.service.ts'

export class SummaryController {
  private readonly service: SummaryService

  constructor(service: SummaryService) {
    this.service = service
  }

  get = async (req: Request, res: Response) => {
    res.status(200).json(summaryResponseDto.parse(await this.service.forViewer(req.user!)))
  }
}

export const summaryController = new SummaryController(summaryService)
