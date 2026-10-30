import type { Request, Response } from 'express'
import { z } from 'zod'

import { applicationsService, type ApplicationsService } from './applications.service.ts'
import type { ApplicationParamsDto } from './dtos/application-params.dto.ts'
import { applicationResponseDto } from './dtos/application-response.dto.ts'
import type { CreateApplicationDto } from './dtos/create-application.dto.ts'
import type { ListApplicationsDto } from './dtos/list-applications.dto.ts'
import { visibilityResponseDto, type SetVisibilityDto } from './dtos/set-visibility.dto.ts'
import type { UpdateApplicationDto } from './dtos/update-application.dto.ts'

export class ApplicationsController {
  private readonly service: ApplicationsService

  constructor(service: ApplicationsService) {
    this.service = service
  }

  list = async (req: Request, res: Response) => {
    const query = req.query as unknown as ListApplicationsDto
    const apps = await this.service.list(req.user, { includeDrafts: query.includeDrafts, department: query.department })
    res.status(200).json(z.array(applicationResponseDto).parse(apps))
  }

  getById = async (req: Request, res: Response) => {
    const { id } = req.params as unknown as ApplicationParamsDto
    res.status(200).json(applicationResponseDto.parse(await this.service.getById(req.user, id)))
  }

  create = async (req: Request, res: Response) => {
    const app = await this.service.create(req.body as CreateApplicationDto)
    res.status(201).json(applicationResponseDto.parse(app))
  }

  update = async (req: Request, res: Response) => {
    const { id } = req.params as unknown as ApplicationParamsDto
    const app = await this.service.update(id, req.body as UpdateApplicationDto)
    res.status(200).json(applicationResponseDto.parse(app))
  }

  setVisibility = async (req: Request, res: Response) => {
    const updated = await this.service.setVisibility(req.body as SetVisibilityDto, req.user!.id)
    res.status(200).json(visibilityResponseDto.parse({ updated }))
  }

  delete = async (req: Request, res: Response) => {
    const { id } = req.params as unknown as ApplicationParamsDto
    await this.service.delete(id)
    res.status(204).end()
  }
}

export const applicationsController = new ApplicationsController(applicationsService)
