import type { Request, Response } from 'express'
import { z } from 'zod'

import { DomainError } from '../../shared/errors/domain-error.ts'
import type { CreateNewsDto } from './dtos/create-news.dto.ts'
import type { NewsParamsDto } from './dtos/news-params.dto.ts'
import { managedNewsResponseDto, newsDetailResponseDto, newsResponseDto } from './dtos/news-response.dto.ts'
import type { UpdateNewsDto } from './dtos/update-news.dto.ts'
import { newsService, type NewsService } from './news.service.ts'

/** El texto no viaja en las listas: solo si lo hay. */
const withHasBody = <T extends { body: string | null }>(row: T) => ({ ...row, hasBody: Boolean(row.body) })

export class NewsController {
  private readonly service: NewsService

  constructor(service: NewsService) {
    this.service = service
  }

  listPublished = async (_req: Request, res: Response) => {
    const rows = await this.service.listPublished()
    res.status(200).json(z.array(newsResponseDto).parse(rows.map(withHasBody)))
  }

  /** Una publicada con su texto. 404 si no existe o no está publicada, o si no tiene texto (esa se lee en su enlace). */
  getOne = async (req: Request, res: Response) => {
    const { id } = req.params as unknown as NewsParamsDto
    const row = await this.service.getPublished(id)
    if (!row.body) throw new DomainError('La noticia no tiene texto para leer aquí.', 404, 'NEWS_WITHOUT_BODY')
    res.status(200).json(newsDetailResponseDto.parse({ ...withHasBody(row), body: row.body }))
  }

  listAll = async (_req: Request, res: Response) => {
    res.status(200).json(z.array(managedNewsResponseDto).parse((await this.service.listAll()).map(withHasBody)))
  }

  create = async (req: Request, res: Response) => {
    const created = await this.service.create(req.user!, req.body as CreateNewsDto)
    res.status(201).json(managedNewsResponseDto.parse(withHasBody(created)))
  }

  update = async (req: Request, res: Response) => {
    const { id } = req.params as unknown as NewsParamsDto
    const updated = await this.service.update(req.user!, id, req.body as UpdateNewsDto)
    res.status(200).json(managedNewsResponseDto.parse(withHasBody(updated)))
  }

  delete = async (req: Request, res: Response) => {
    const { id } = req.params as unknown as NewsParamsDto
    await this.service.delete(id)
    res.status(204).end()
  }
}

export const newsController = new NewsController(newsService)
