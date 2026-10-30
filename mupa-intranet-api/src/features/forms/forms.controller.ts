import type { Request, Response } from 'express'
import { z } from 'zod'

import type { CreateFormDto } from './dtos/create-form.dto.ts'
import type { FormIdParamsDto, FormSlugParamsDto } from './dtos/form-params.dto.ts'
import { formResponseDto, managedFormResponseDto } from './dtos/form-response.dto.ts'
import type { UpdateFormDto } from './dtos/update-form.dto.ts'
import { formsService, type FormsService } from './forms.service.ts'

export class FormsController {
  private readonly service: FormsService

  constructor(service: FormsService) {
    this.service = service
  }

  listPublished = async (_req: Request, res: Response) => {
    res.status(200).json(z.array(formResponseDto).parse(await this.service.listPublished()))
  }

  getPublished = async (req: Request, res: Response) => {
    const { slug } = req.params as unknown as FormSlugParamsDto
    res.status(200).json(formResponseDto.parse(await this.service.getPublished(slug)))
  }

  listAll = async (_req: Request, res: Response) => {
    res.status(200).json(z.array(managedFormResponseDto).parse(await this.service.listAll()))
  }

  create = async (req: Request, res: Response) => {
    res.status(201).json(managedFormResponseDto.parse(await this.service.create(req.user!, req.body as CreateFormDto)))
  }

  update = async (req: Request, res: Response) => {
    const { id } = req.params as unknown as FormIdParamsDto
    res.status(200).json(managedFormResponseDto.parse(await this.service.update(req.user!, id, req.body as UpdateFormDto)))
  }

  delete = async (req: Request, res: Response) => {
    const { id } = req.params as unknown as FormIdParamsDto
    await this.service.delete(id)
    res.status(204).end()
  }
}

export const formsController = new FormsController(formsService)
