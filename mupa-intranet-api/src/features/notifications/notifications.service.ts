import { DomainError } from '../../shared/errors/domain-error.ts'
import { hasRole, REQUEST_HANDLERS } from '../../shared/roles.ts'
import { eventBus, type EventBusService, type Sobre } from '../../shared/services/event-bus.service.ts'
import { auditService, type AuditService } from '../audit/audit.service.ts'
import { requestsService, type RequestsService } from '../requests/requests.service.ts'
import { notificacionSolicitudDto, type NotificacionSolicitud } from './dtos/notificacion.dto.ts'
import { MAX_EN_CAMPANA, MAX_POR_PERSONA } from './notifications.constants.ts'

/** Una conexión abierta. La arma el controlador: el servicio no sabe de Express. */
export type Cliente = {
  userId: number
  roles: string[]
  enviar(evento: string, datos: unknown): void
  cerrar(): void
}

/**
 * Notificaciones en vivo: guarda quién está conectado y, cuando el bus avisa de un
 * evento, lo manda a quien le toca. Solo en este proceso (sin historial): quien no
 * estaba conectado lo ve al entrar en los contadores de siempre (/me/summary).
 */
export class NotificationsService {
  private readonly clientes = new Map<number, Set<Cliente>>()
  private readonly audit: AuditService
  private readonly requests: RequestsService

  constructor(eventos: EventBusService, audit: AuditService, requests: RequestsService) {
    this.audit = audit
    this.requests = requests
    eventos.on('solicitud.creada', (sobre) => this.solicitudCreada(sobre))
  }

  /**
   * Para la campana: las solicitudes que llegaron y nadie atendió todavía (estado
   * «recibida»). Dejan de salir cuando alguien les cambia el estado. Mismo formato
   * que el aviso en vivo.
   */
  async pendientes(): Promise<{ total: number; items: NotificacionSolicitud[] }> {
    const [total, lista] = await Promise.all([this.requests.countNew(), this.requests.listNew(MAX_EN_CAMPANA)])
    return {
      total,
      items: lista.map((r) => ({ id: r.id, folio: r.folio ?? '#' + r.id, formulario: r.formTitle, area: r.formArea, solicitante: r.ownerName, fecha: r.createdAt })),
    }
  }

  conectar(cliente: Cliente): void {
    const suyos = this.clientes.get(cliente.userId) ?? new Set<Cliente>()
    if (suyos.size >= MAX_POR_PERSONA) {
      throw new DomainError('Tienes demasiadas pestañas escuchando avisos. Cierra alguna.', 429, 'TOO_MANY_STREAMS')
    }
    suyos.add(cliente)
    this.clientes.set(cliente.userId, suyos)
  }

  desconectar(cliente: Cliente): void {
    const suyos = this.clientes.get(cliente.userId)
    if (!suyos) return
    suyos.delete(cliente)
    if (!suyos.size) this.clientes.delete(cliente.userId)
  }

  /** Apagado del servidor: sin esto, los streams abiertos bloquean `server.close()`. */
  cerrarTodo(): void {
    for (const suyos of this.clientes.values()) for (const cliente of suyos) cliente.cerrar()
    this.clientes.clear()
  }

  /** Llega una solicitud: a quien las atiende (menos a quien la envió). */
  private async solicitudCreada(sobre: Sobre<'solicitud.creada'>): Promise<void> {
    const notificacion = notificacionSolicitudDto.parse(sobre.datos)
    let entregados = 0
    for (const [userId, suyos] of this.clientes) {
      if (userId === sobre.actorId) continue
      let recibio = false
      for (const cliente of suyos) {
        if (!hasRole(cliente, ...REQUEST_HANDLERS)) continue
        cliente.enviar(sobre.tipo, notificacion)
        recibio = true
      }
      if (recibio) entregados++
    }
    await this.audit.registrarEntrega(sobre, entregados)
  }
}

export const notificationsService = new NotificationsService(eventBus, auditService, requestsService)
