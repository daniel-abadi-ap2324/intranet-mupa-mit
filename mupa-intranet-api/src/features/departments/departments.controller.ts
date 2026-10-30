import type { Request, Response } from 'express'
import { z } from 'zod'

import { departmentsService, type DepartmentsService } from './departments.service.ts'
import { departmentOptionDto } from './dtos/department-option.dto.ts'
import type { DepartmentParamsDto } from './dtos/department-params.dto.ts'
import { departmentResponseDto } from './dtos/department-response.dto.ts'
import type { SaveDepartmentDto } from './dtos/save-department.dto.ts'

export class DepartmentsController {
  private readonly service: DepartmentsService

  constructor(service: DepartmentsService) {
    this.service = service
  }

  list = async (_req: Request, res: Response) => {
    res.status(200).json(z.array(departmentResponseDto).parse(await this.service.list()))
  }

  options = async (_req: Request, res: Response) => {
    res.status(200).json(z.array(departmentOptionDto).parse(await this.service.options()))
  }

  create = async (req: Request, res: Response) => {
    const { name } = req.body as SaveDepartmentDto
    res.status(201).json(departmentResponseDto.parse(await this.service.create(name)))
  }

  update = async (req: Request, res: Response) => {
    const { id } = req.params as unknown as DepartmentParamsDto
    const { name } = req.body as SaveDepartmentDto
    res.status(200).json(departmentResponseDto.parse(await this.service.rename(id, name)))
  }

  delete = async (req: Request, res: Response) => {
    const { id } = req.params as unknown as DepartmentParamsDto
    await this.service.delete(id)
    res.status(204).end()
  }
}

export const departmentsController = new DepartmentsController(departmentsService)
