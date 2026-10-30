import type { Request, Response } from 'express'

import { syncStatusDto } from './dtos/sync-result.dto.ts'
import { wordpressSyncService, type WordpressSyncService } from './wordpress-sync.service.ts'

export class WordpressSyncController {
  private readonly service: WordpressSyncService

  constructor(service: WordpressSyncService) {
    this.service = service
  }

  status = (_req: Request, res: Response) => {
    res.status(200).json(syncStatusDto.parse(this.service.status()))
  }

  /** 202: la pasada sigue en segundo plano; el estado dice cuándo termina (`running: false`). */
  run = (_req: Request, res: Response) => {
    res.status(202).json(syncStatusDto.parse(this.service.trigger()))
  }
}

export const wordpressSyncController = new WordpressSyncController(wordpressSyncService)
