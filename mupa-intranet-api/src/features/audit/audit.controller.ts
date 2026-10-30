import type { Request, Response } from 'express'
import { z } from 'zod'

import { auditService, type AuditService } from './audit.service.ts'
import { auditEventResponseDto } from './dtos/audit-event-response.dto.ts'
import type { ListAuditDto } from './dtos/list-audit.dto.ts'

export class AuditController {
  private readonly service: AuditService

  constructor(service: AuditService) {
    this.service = service
  }

  list = async (req: Request, res: Response) => {
    const { type, subject, limit } = req.query as unknown as ListAuditDto
    const [subjectType, subjectId] = subject ? subject.split(':') : []
    const rows = await this.service.list({ type, subjectType, subjectId: subjectId ? Number(subjectId) : undefined, limit })
    res.status(200).json(z.array(auditEventResponseDto).parse(rows))
  }
}

export const auditController = new AuditController(auditService)
