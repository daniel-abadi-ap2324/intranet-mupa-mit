import type { Request, Response } from 'express'
import { z } from 'zod'

import type { BulletinQueryDto } from './dtos/bulletin-query.dto.ts'
import type { CreateBulletinDto } from './dtos/create-bulletin.dto.ts'
import type { BulletinParamsDto } from './dtos/bulletin-params.dto.ts'
import { managedBulletinResponseDto, bulletinResponseDto } from './dtos/bulletin-response.dto.ts'
import type { UpdateBulletinDto } from './dtos/update-bulletin.dto.ts'
import { bulletinService, type BulletinsService } from './bulletins.service.ts'

/** En la base las palabras clave van en un solo texto (separadas por coma); en la respuesta, como lista. */
const withKeywordList = <T extends { keywords: string | null }>(row: T) => ({ ...row, keywords: row.keywords ? row.keywords.split(',') : [] })

export class BulletinsController {
  private readonly service: BulletinsService

  constructor(service: BulletinsService) {
    this.service = service
  }

  listPublished = async (req: Request, res: Response) => {
    const { q } = req.query as BulletinQueryDto
    res.status(200).json(z.array(bulletinResponseDto).parse((await this.service.listPublished(q)).map(withKeywordList)))
  }

  listAll = async (_req: Request, res: Response) => {
    res.status(200).json(z.array(managedBulletinResponseDto).parse((await this.service.listAll()).map(withKeywordList)))
  }

  create = async (req: Request, res: Response) => {
    const created = await this.service.create(req.user!, req.body as CreateBulletinDto)
    res.status(201).json(managedBulletinResponseDto.parse(withKeywordList(created)))
  }

  update = async (req: Request, res: Response) => {
    const { id } = req.params as unknown as BulletinParamsDto
    const updated = await this.service.update(req.user!, id, req.body as UpdateBulletinDto)
    res.status(200).json(managedBulletinResponseDto.parse(withKeywordList(updated)))
  }

  delete = async (req: Request, res: Response) => {
    const { id } = req.params as unknown as BulletinParamsDto
    await this.service.delete(id)
    res.status(204).end()
  }
}

export const bulletinController = new BulletinsController(bulletinService)
