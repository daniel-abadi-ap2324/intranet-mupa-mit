import type { Request, Response } from 'express'
import { z } from 'zod'

import type { CreateVideoDto } from './dtos/create-video.dto.ts'
import type { VideoParamsDto } from './dtos/video-params.dto.ts'
import { managedVideoResponseDto, videoResponseDto } from './dtos/video-response.dto.ts'
import type { UpdateVideoDto } from './dtos/update-video.dto.ts'
import { videoService, type VideosService } from './videos.service.ts'

export class VideosController {
  private readonly service: VideosService

  constructor(service: VideosService) {
    this.service = service
  }

  listPublished = async (_req: Request, res: Response) => {
    res.status(200).json(z.array(videoResponseDto).parse(await this.service.listPublished()))
  }

  listAll = async (_req: Request, res: Response) => {
    res.status(200).json(z.array(managedVideoResponseDto).parse(await this.service.listAll()))
  }

  create = async (req: Request, res: Response) => {
    const created = await this.service.create(req.user!, req.body as CreateVideoDto)
    res.status(201).json(managedVideoResponseDto.parse(created))
  }

  update = async (req: Request, res: Response) => {
    const { id } = req.params as unknown as VideoParamsDto
    const updated = await this.service.update(req.user!, id, req.body as UpdateVideoDto)
    res.status(200).json(managedVideoResponseDto.parse(updated))
  }

  delete = async (req: Request, res: Response) => {
    const { id } = req.params as unknown as VideoParamsDto
    await this.service.delete(id)
    res.status(204).end()
  }
}

export const videoController = new VideosController(videoService)
