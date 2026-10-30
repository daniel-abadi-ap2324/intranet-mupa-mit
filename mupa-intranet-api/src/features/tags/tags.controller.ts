import type { Request, Response } from 'express'
import { z } from 'zod'

import { tagResponseDto } from './dtos/tag-response.dto.ts'
import { tagsService, type TagsService } from './tags.service.ts'

export class TagsController {
  private readonly service: TagsService

  constructor(service: TagsService) {
    this.service = service
  }

  list = async (_req: Request, res: Response) => {
    res.status(200).json(z.array(tagResponseDto).parse(await this.service.list()))
  }
}

export const tagsController = new TagsController(tagsService)
