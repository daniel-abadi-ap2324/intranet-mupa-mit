import type { NextFunction, Request, Response } from 'express'

import { env } from '../../config/env.ts'
import { DomainError } from '../../shared/errors/domain-error.ts'

import { GUEST_COOKIE, guestCookieOptions, readGuestToken } from '../../shared/middlewares/authenticate-or-guest.middleware.ts'
import { readSessionToken } from '../auth/auth.cookie.ts'
import type { ConnectRrhhDto } from './dtos/connect-rrhh.dto.ts'
import type {
  AccreditCompDto,
  CandidatesQueryDto,
  CompRequestParamsDto,
  MonthQueryDto,
  PayslipDetailQueryDto,
  PayslipsQueryDto,
  UseCompDto,
  YearParamsDto,
} from './dtos/rrhh-query.dto.ts'
import {
  attendanceResponseDto,
  compCandidatesResponseDto,
  compCreatedResponseDto,
  compResponseDto,
  payslipDetailResponseDto,
  payslipsResponseDto,
  payslipYearResponseDto,
  recordResponseDto,
  rrhhStatusResponseDto,
} from './dtos/rrhh-response.dto.ts'
import { rrhhService, type RrhhService, type Who } from './rrhh.service.ts'

/**
 * Cookie de sesión de quien pide. Con Bearer (otra app) no hay sesión de la intranet
 * donde atar la conexión: aunque viniera también una cookie, no se usa.
 */
const sessionOf = (req: Request) => (req.headers.authorization ? undefined : readSessionToken(req))

/** Quién pide: la sesión de la intranet, o la cookie de invitado si no hay sesión. */
const whoOf = (req: Request): Who => ({
  userId: req.user?.id,
  sessionToken: sessionOf(req),
  guestToken: req.user || req.headers.authorization ? undefined : (req.guestToken ?? readGuestToken(req)),
})

export class RrhhController {
  private readonly service: RrhhService
  private readonly inMaintenance: boolean

  constructor(service: RrhhService, inMaintenance: boolean) {
    this.service = service
    this.inMaintenance = inMaintenance
  }

  /** En mantenimiento: la conexión dice que RRHH Express no está disponible y todo lo demás responde 503. */
  maintenance = (req: Request, res: Response, next: NextFunction) => {
    if (!this.inMaintenance) return next()
    if (req.method === 'GET' && req.path === '/conexion') {
      const status = { available: false, connected: false, knownCedula: false, guest: false, name: null, expiresAt: null, maintenance: true }
      return res.status(200).json(rrhhStatusResponseDto.parse(status))
    }
    throw new DomainError('RRHH Express está en mantenimiento', 503, 'RRHH_EN_MANTENIMIENTO')
  }

  status = async (req: Request, res: Response) => {
    res.status(200).json(rrhhStatusResponseDto.parse(await this.service.status(whoOf(req))))
  }

  connect = async (req: Request, res: Response) => {
    const { status, guestToken } = await this.service.connect(whoOf(req), req.body as ConnectRrhhDto, req.ip)
    // Cookie nueva de invitado; si ahora hay sesión no hace falta ninguna.
    if (guestToken) res.cookie(GUEST_COOKIE, guestToken, guestCookieOptions())
    res.status(200).json(rrhhStatusResponseDto.parse(status))
  }

  disconnect = async (req: Request, res: Response) => {
    await this.service.disconnect(whoOf(req))
    res.clearCookie(GUEST_COOKIE, guestCookieOptions())
    res.status(204).end()
  }

  attendance = async (req: Request, res: Response) => {
    const q = req.query as unknown as MonthQueryDto
    res.status(200).json(attendanceResponseDto.parse(await this.service.attendance(whoOf(req), q)))
  }

  payslips = async (req: Request, res: Response) => {
    const { page } = req.query as unknown as PayslipsQueryDto
    res.status(200).json(payslipsResponseDto.parse(await this.service.payslips(whoOf(req), page)))
  }

  payslipYear = async (req: Request, res: Response) => {
    const { year } = req.params as unknown as YearParamsDto
    res.status(200).json(payslipYearResponseDto.parse(await this.service.payslipYear(whoOf(req), year)))
  }

  payslipDetail = async (req: Request, res: Response) => {
    const { payroll } = req.query as unknown as PayslipDetailQueryDto
    res.status(200).json(payslipDetailResponseDto.parse(await this.service.payslipDetail(whoOf(req), payroll)))
  }

  record = async (req: Request, res: Response) => {
    res.status(200).json(recordResponseDto.parse(await this.service.record(whoOf(req))))
  }

  compensatory = async (req: Request, res: Response) => {
    res.status(200).json(compResponseDto.parse(await this.service.compensatory(whoOf(req))))
  }

  compCandidates = async (req: Request, res: Response) => {
    const q = req.query as unknown as CandidatesQueryDto
    res.status(200).json(compCandidatesResponseDto.parse(await this.service.compCandidates(whoOf(req), q)))
  }

  accreditComp = async (req: Request, res: Response) => {
    res.status(201).json(compCreatedResponseDto.parse(await this.service.accreditComp(whoOf(req), req.body as AccreditCompDto)))
  }

  useComp = async (req: Request, res: Response) => {
    res.status(201).json(compCreatedResponseDto.parse(await this.service.useComp(whoOf(req), req.body as UseCompDto)))
  }

  cancelComp = async (req: Request, res: Response) => {
    const { id } = req.params as unknown as CompRequestParamsDto
    await this.service.cancelComp(whoOf(req), id)
    res.status(204).end()
  }
}

export const rrhhController = new RrhhController(rrhhService, env.rrhhMaintenance)
