import type { Request, Response } from 'express'

import { readSessionToken } from '../auth/auth.cookie.ts'
import { clinicService, type ClinicService } from './clinic.service.ts'
import { appointmentsResponseDto, type AppointmentsQueryDto } from './dtos/appointments.dto.ts'
import { clinicResponseDto } from './dtos/clinic-response.dto.ts'

export class ClinicController {
  private readonly service: ClinicService

  constructor(service: ClinicService) {
    this.service = service
  }

  getInfo = async (_req: Request, res: Response) => {
    res.status(200).json(clinicResponseDto.parse(await this.service.getInfo()))
  }

  getMyAppointments = async (req: Request, res: Response) => {
    // Con Bearer (otra app) no se usa la cookie: la cédula vive en la sesión de la intranet.
    const token = req.headers.authorization ? undefined : readSessionToken(req)
    res.status(200).json(appointmentsResponseDto.parse(await this.service.myAppointments(token, req.query as unknown as AppointmentsQueryDto)))
  }
}

export const clinicController = new ClinicController(clinicService)
