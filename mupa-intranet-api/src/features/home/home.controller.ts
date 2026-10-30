import type { Request, Response } from 'express'

import { homeContentResponseDto, homeLayoutResponseDto, homeLayoutsResponseDto } from './dtos/home-layouts-response.dto.ts'
import type { HomeSection } from './dtos/home-sections.dto.ts'
import type { UpdateHomeLayoutDto } from './dtos/update-home-layout.dto.ts'
import { homeService, type HomeService } from './home.service.ts'

export class HomeController {
  private readonly service: HomeService

  constructor(service: HomeService) {
    this.service = service
  }

  getContent = async (_req: Request, res: Response) => {
    res.status(200).json(homeContentResponseDto.parse(await this.service.getContent()))
  }

  /** El cuerpo es { value }, ya validado con el DTO de esa sección. */
  saveSection = (section: HomeSection) => async (req: Request, res: Response) => {
    const { value } = req.body as { value: unknown }
    res.status(200).json(homeContentResponseDto.parse(await this.service.saveSection(section, value)))
  }

  getLayouts = async (req: Request, res: Response) => {
    res.status(200).json(homeLayoutsResponseDto.parse(await this.service.getLayouts(req.user?.id)))
  }

  savePersonalLayout = async (req: Request, res: Response) => {
    const { layout } = req.body as UpdateHomeLayoutDto
    const saved = await this.service.savePersonalLayout(req.user!.id, layout)
    res.status(200).json(homeLayoutResponseDto.parse({ layout: saved }))
  }

  saveDefaultLayout = async (req: Request, res: Response) => {
    const { layout } = req.body as UpdateHomeLayoutDto
    const saved = await this.service.saveDefaultLayout(layout)
    res.status(200).json(homeLayoutResponseDto.parse({ layout: saved }))
  }
}

export const homeController = new HomeController(homeService)
