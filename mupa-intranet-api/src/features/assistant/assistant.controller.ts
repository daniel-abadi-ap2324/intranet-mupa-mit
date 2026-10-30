import type { Request, Response } from 'express'

import { assistantService, type AssistantService } from './assistant.service.ts'
import type { AskAssistantDto } from './dtos/ask-assistant.dto.ts'
import { assistantResponseDto } from './dtos/assistant-response.dto.ts'
import { assistantStatusResponseDto } from './dtos/assistant-status-response.dto.ts'

export class AssistantController {
  private readonly service: AssistantService

  constructor(service: AssistantService) {
    this.service = service
  }

  status = (_req: Request, res: Response) => {
    res.status(200).json(assistantStatusResponseDto.parse({ available: this.service.isAvailable() }))
  }

  ask = async (req: Request, res: Response) => {
    const { question } = req.body as AskAssistantDto
    res.status(200).json(assistantResponseDto.parse(await this.service.ask(req.user, question)))
  }
}

export const assistantController = new AssistantController(assistantService)
