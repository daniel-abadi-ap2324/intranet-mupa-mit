import type { Request, Response } from 'express'

import { userResponseDto } from '../users/dtos/user-response.dto.ts'
import { readSessionToken, SESSION_COOKIE, sessionCookieOptions } from './auth.cookie.ts'
import { authService, type AuthService } from './auth.service.ts'
import type { LoginDto } from './dtos/login.dto.ts'

export class AuthController {
  private readonly service: AuthService

  constructor(service: AuthService) {
    this.service = service
  }

  login = async (req: Request, res: Response) => {
    const { username, password } = req.body as LoginDto
    const { user, token, expiresAt } = await this.service.login(username, password)
    res.cookie(SESSION_COOKIE, token, sessionCookieOptions(expiresAt))
    res.status(200).json(userResponseDto.parse(user))
  }

  /** Renueva la sesión contra Identity Central y devuelve la cuenta con los datos al día. */
  refresh = async (req: Request, res: Response) => {
    const user = await this.service.refresh(readSessionToken(req))
    res.status(200).json(userResponseDto.parse(user))
  }

  logout = async (req: Request, res: Response) => {
    const token = readSessionToken(req)
    if (token) await this.service.logout(token)
    res.clearCookie(SESSION_COOKIE, sessionCookieOptions())
    res.status(204).end()
  }

  /** La persona con la sesión iniciada, o null (sin sesión no es un error: el sitio se ve igual). */
  session = (req: Request, res: Response) => {
    res.status(200).json(req.user ?? null)
  }
}

export const authController = new AuthController(authService)
