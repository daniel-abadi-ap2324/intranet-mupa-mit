import type { Request, Response } from 'express'

import { DURACION_MAX_MS, LATIDO_MS } from './notifications.constants.ts'
import { notificacionesResponseDto } from './dtos/notificacion.dto.ts'
import { notificationsService, type Cliente, type NotificationsService } from './notifications.service.ts'

export class NotificationsController {
  private readonly service: NotificationsService

  constructor(service: NotificationsService) {
    this.service = service
  }

  /** GET /: las solicitudes nuevas sin atender, para la campana. */
  list = async (_req: Request, res: Response) => {
    res.status(200).json(notificacionesResponseDto.parse(await this.service.pendientes()))
  }

  /** GET /stream: Server-Sent Events. Queda abierto hasta DURACION_MAX_MS o hasta que el navegador lo cierre. */
  stream = (req: Request, res: Response) => {
    const user = req.user!
    const cliente: Cliente = {
      userId: user.id,
      roles: user.roles,
      enviar: (evento, datos) => res.write(`event: ${evento}\ndata: ${JSON.stringify(datos)}\n\n`),
      cerrar: () => res.end(),
    }
    // Primero se registra: si pasa del límite, sale un 429 en JSON (y EventSource no reintenta).
    this.service.conectar(cliente)

    res.status(200).set({
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      // nginx: que no guarde la respuesta en su buffer (cada aviso tiene que salir al momento).
      'X-Accel-Buffering': 'no',
    })
    res.flushHeaders()
    res.write('retry: 5000\n\n')

    const latido = setInterval(() => res.write(': ping\n\n'), LATIDO_MS)
    const limite = setTimeout(() => res.end(), DURACION_MAX_MS)
    res.on('close', () => {
      clearInterval(latido)
      clearTimeout(limite)
      this.service.desconectar(cliente)
    })
  }
}

export const notificationsController = new NotificationsController(notificationsService)
