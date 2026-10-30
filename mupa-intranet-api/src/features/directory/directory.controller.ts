import type { Request, Response } from 'express'

import { directoryComparisonDto, directoryResponseDto } from './dtos/directory-response.dto.ts'
import { directoryService, type DirectoryService } from './directory.service.ts'

export class DirectoryController {
  private readonly service: DirectoryService

  constructor(service: DirectoryService) {
    this.service = service
  }

  list = async (_req: Request, res: Response) => {
    res.status(200).json(directoryResponseDto.parse(await this.service.view()))
  }

  comparison = async (_req: Request, res: Response) => {
    res.status(200).json(directoryComparisonDto.parse(await this.service.comparison()))
  }
}

export const directoryController = new DirectoryController(directoryService)
