import { eventBus, type EventBusService, type Sobre } from '../../shared/services/event-bus.service.ts'
import { auditRepository, type AuditFilter, type AuditRepository } from './audit.repository.ts'

/** Sobre qué es cada tipo de evento (para buscar la historia de una solicitud, por ejemplo). */
function sujeto(sobre: Sobre): { subjectType: string | null; subjectId: number | null } {
  switch (sobre.tipo) {
    case 'solicitud.creada':
      return { subjectType: 'request', subjectId: (sobre as Sobre<'solicitud.creada'>).datos.id }
    case 'usuario.ficha_vista':
      return { subjectType: 'user', subjectId: (sobre as Sobre<'usuario.ficha_vista'>).datos.userId }
    default:
      return { subjectType: null, subjectId: null }
  }
}

/**
 * Auditoría de eventos: escucha TODOS los eventos del bus (onAny) y guarda una fila
 * por cada uno. Notificaciones le avisa a cuántas personas entregó cada evento.
 * Si escribir falla, se registra en el log: nunca rompe el envío ni la notificación.
 */
export class AuditService {
  private readonly repository: AuditRepository

  constructor(repository: AuditRepository, eventos: EventBusService) {
    this.repository = repository
    eventos.onAny((sobre) => this.registrar(sobre))
  }

  async registrar(sobre: Sobre): Promise<void> {
    try {
      await this.repository.upsertEvent({ id: sobre.id, type: sobre.tipo, actorId: sobre.actorId, ...sujeto(sobre), payload: sobre.datos, createdAt: sobre.fecha })
    } catch (err) {
      console.error(`No se pudo auditar el evento ${sobre.tipo} (${sobre.id}): ${(err as Error).message}`)
    }
  }

  async registrarEntrega(sobre: Sobre, entregados: number): Promise<void> {
    if (!entregados) return
    try {
      await this.repository.addDeliveries(sobre.id, sobre.tipo, entregados)
    } catch (err) {
      console.error(`No se pudo auditar la entrega del evento ${sobre.tipo} (${sobre.id}): ${(err as Error).message}`)
    }
  }

  list(filter: AuditFilter) {
    return this.repository.findMany(filter)
  }
}

export const auditService = new AuditService(auditRepository, eventBus)
