import type { Request, Response } from 'express'
import { z } from 'zod'

import type { CreateRequestDto } from './dtos/create-request.dto.ts'
import type { CreateMessageDto, ListRequestsDto, RequestParamsDto, UpdateRequestStatusDto } from './dtos/manage-request.dto.ts'
import { managedRequestResponseDto, myRequestResponseDto, requestDetailResponseDto } from './dtos/request-response.dto.ts'
import { requestsService, type RequestsService } from './requests.service.ts'

export class RequestsController {
  private readonly service: RequestsService

  constructor(service: RequestsService) {
    this.service = service
  }

  submit = async (req: Request, res: Response) => {
    const created = await this.service.submit(req.user!, req.body as CreateRequestDto)
    res.status(201).json(myRequestResponseDto.parse(created))
  }

  mine = async (req: Request, res: Response) => {
    res.status(200).json(z.array(myRequestResponseDto).parse(await this.service.mine(req.user!)))
  }

  detail = async (req: Request, res: Response) => {
    const { id } = req.params as unknown as RequestParamsDto
    res.status(200).json(requestDetailResponseDto.parse(await this.service.detail(req.user!, id)))
  }

  list = async (req: Request, res: Response) => {
    res.status(200).json(z.array(managedRequestResponseDto).parse(await this.service.list(req.query as unknown as ListRequestsDto)))
  }

  setStatus = async (req: Request, res: Response) => {
    const { id } = req.params as unknown as RequestParamsDto
    const { status } = req.body as UpdateRequestStatusDto
    res.status(200).json(requestDetailResponseDto.parse(await this.service.setStatus(req.user!, id, status)))
  }

  reply = async (req: Request, res: Response) => {
    const { id } = req.params as unknown as RequestParamsDto
    const { body } = req.body as CreateMessageDto
    res.status(201).json(requestDetailResponseDto.parse(await this.service.reply(req.user!, id, body)))
  }
}

export const requestsController = new RequestsController(requestsService)
