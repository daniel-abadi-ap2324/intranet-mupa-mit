import type { Request, Response } from 'express'

import { SESSION_COOKIE, sessionCookieOptions } from '../auth/auth.cookie.ts'
import { userResponseDto } from '../users/dtos/user-response.dto.ts'
import type { RegisterDto } from './dtos/register.dto.ts'
import { registrationService, type RegistrationService } from './registration.service.ts'

export class RegistrationController {
  private readonly service: RegistrationService

  constructor(service: RegistrationService) {
    this.service = service
  }

  register = async (req: Request, res: Response) => {
    const { user, token, expiresAt } = await this.service.register(req.body as RegisterDto)
    res.cookie(SESSION_COOKIE, token, sessionCookieOptions(expiresAt))
    res.status(201).json(userResponseDto.parse(user))
  }
}

export const registrationController = new RegistrationController(registrationService)
