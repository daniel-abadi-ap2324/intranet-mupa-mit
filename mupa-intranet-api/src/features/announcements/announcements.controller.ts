import type { Request, Response } from 'express'
import { z } from 'zod'

import { announcementsService, type AnnouncementsService } from './announcements.service.ts'
import type { AnnouncementParamsDto } from './dtos/announcement-params.dto.ts'
import { announcementResponseDto, managedAnnouncementResponseDto } from './dtos/announcement-response.dto.ts'
import type { CreateAnnouncementDto } from './dtos/create-announcement.dto.ts'
import type { UpdateAnnouncementDto } from './dtos/update-announcement.dto.ts'

export class AnnouncementsController {
  private readonly service: AnnouncementsService

  constructor(service: AnnouncementsService) {
    this.service = service
  }

  listActive = async (_req: Request, res: Response) => {
    res.status(200).json(z.array(announcementResponseDto).parse(await this.service.listActive()))
  }

  listAll = async (_req: Request, res: Response) => {
    res.status(200).json(z.array(managedAnnouncementResponseDto).parse(await this.service.listAll()))
  }

  create = async (req: Request, res: Response) => {
    const created = await this.service.create(req.user!, req.body as CreateAnnouncementDto)
    res.status(201).json(managedAnnouncementResponseDto.parse(created))
  }

  update = async (req: Request, res: Response) => {
    const { id } = req.params as unknown as AnnouncementParamsDto
    const updated = await this.service.update(req.user!, id, req.body as UpdateAnnouncementDto)
    res.status(200).json(managedAnnouncementResponseDto.parse(updated))
  }

  delete = async (req: Request, res: Response) => {
    const { id } = req.params as unknown as AnnouncementParamsDto
    await this.service.delete(id)
    res.status(204).end()
  }
}

export const announcementsController = new AnnouncementsController(announcementsService)
