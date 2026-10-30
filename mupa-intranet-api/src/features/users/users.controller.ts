import type { Request, Response } from 'express'
import { z } from 'zod'

import type { ChooseDepartmentDto } from './dtos/choose-department.dto.ts'
import { emailCodeResponseDto } from './dtos/email-code-response.dto.ts'
import type { ListUsersDto } from './dtos/list-users.dto.ts'
import { managedUserResponseDto } from './dtos/managed-user-response.dto.ts'
import type { UpdateUserDto } from './dtos/update-user.dto.ts'
import type { UserParamsDto } from './dtos/user-params.dto.ts'
import { userDetailResponseDto } from './dtos/user-detail-response.dto.ts'
import { userResponseDto } from './dtos/user-response.dto.ts'
import type { VerifyEmailDto } from './dtos/verify-email.dto.ts'
import type { UserWithDepartment } from './users.repository.ts'
import { usersService, type UsersService } from './users.service.ts'

const managed = (u: UserWithDepartment) => managedUserResponseDto.parse({ ...u, source: u.identitySub ? 'identity' : 'local' })

export class UsersController {
  private readonly service: UsersService

  constructor(service: UsersService) {
    this.service = service
  }

  list = async (req: Request, res: Response) => {
    const { department, withoutDepartment, q } = req.query as unknown as ListUsersDto
    const list = await this.service.list({ departmentId: department, withoutDepartment, q })
    res.status(200).json(z.array(managedUserResponseDto).parse(list.map(managed)))
  }

  /** La ficha completa de una persona (administración). */
  detail = async (req: Request, res: Response) => {
    const { id } = req.params as unknown as UserParamsDto
    const user = await this.service.detail(req.user!.id, id)
    res.status(200).json(userDetailResponseDto.parse({ ...user, source: user.identitySub ? 'identity' : 'local' }))
  }

  /** La persona con sesión vio o saltó el recorrido. */
  markTourSeen = async (req: Request, res: Response) => {
    await this.service.markTourSeen(req.user!.id)
    res.status(204).end()
  }

  /** La persona sin departamento elige el suyo. */
  chooseDepartment = async (req: Request, res: Response) => {
    const { departmentId } = req.body as ChooseDepartmentDto
    res.status(200).json(userResponseDto.parse(await this.service.chooseOwnDepartment(req.user!.id, departmentId)))
  }

  requestEmailCode = async (req: Request, res: Response) => {
    res.status(200).json(emailCodeResponseDto.parse(await this.service.requestEmailCode(req.user!.id)))
  }

  verifyEmail = async (req: Request, res: Response) => {
    const { code } = req.body as VerifyEmailDto
    res.status(200).json(userResponseDto.parse(await this.service.verifyEmail(req.user!.id, code)))
  }

  update = async (req: Request, res: Response) => {
    const { id } = req.params as unknown as UserParamsDto
    const { departmentId } = req.body as UpdateUserDto
    res.status(200).json(managed(await this.service.setDepartment(id, departmentId)))
  }

  suspend = async (req: Request, res: Response) => {
    const { id } = req.params as unknown as UserParamsDto
    res.status(200).json(managed(await this.service.suspend(req.user!.id, id)))
  }

  reactivate = async (req: Request, res: Response) => {
    const { id } = req.params as unknown as UserParamsDto
    res.status(200).json(managed(await this.service.reactivate(id)))
  }

  reset = async (req: Request, res: Response) => {
    const { id } = req.params as unknown as UserParamsDto
    await this.service.reset(req.user!.id, id)
    res.status(204).end()
  }

  remove = async (req: Request, res: Response) => {
    const { id } = req.params as unknown as UserParamsDto
    await this.service.remove(req.user!.id, id)
    res.status(204).end()
  }
}

export const usersController = new UsersController(usersService)
