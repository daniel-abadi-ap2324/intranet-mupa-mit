import type { Request, Response } from 'express'

import { healthService, type HealthService } from './health.service.ts'

export class HealthController {
  private readonly service: HealthService

  constructor(service: HealthService) {
    this.service = service
  }

  check = async (_req: Request, res: Response) => {
    res.status(200).json(await this.service.check())
  }
}

export const healthController = new HealthController(healthService)
