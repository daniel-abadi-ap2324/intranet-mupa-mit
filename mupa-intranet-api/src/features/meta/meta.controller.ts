import type { Request, Response } from 'express'

import type { ContentQueryDto } from './dtos/content-query.dto.ts'
import { metaService, type MetaService } from './meta.service.ts'

export class MetaController {
  private readonly service: MetaService

  constructor(service: MetaService) {
    this.service = service
  }

  content = async (req: Request, res: Response) => {
    const { q, limit } = req.query as unknown as ContentQueryDto
    res.status(200).json({ items: await this.service.content(q, limit) })
  }

  site = async (req: Request, res: Response) => {
    const { q } = req.query as unknown as ContentQueryDto
    res.status(200).json(await this.service.site(q))
  }

  catalog = (_req: Request, res: Response) => {
    res.status(200).json(this.service.catalog())
  }
}

export const metaController = new MetaController(metaService)
