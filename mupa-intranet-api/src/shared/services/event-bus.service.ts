import { randomUUID } from 'node:crypto'
import { EventEmitter } from 'node:events'

/**
 * Bus de eventos EN PROCESO (sin Redis ni colas): un feature avisa que algo pasó
 * y otros reaccionan sin conocerse (solicitudes → notificaciones, auditoría).
 * Excepción documentada a "evitar event buses" de CONVENTIONS.md (API): se aprobó para
 * desacoplar features. Si algún día hay varias réplicas de la API, este bus no
 * alcanza: cada réplica solo ve sus propios eventos.
 *
 * - La entrega es en el siguiente tick: quien emite no espera a los listeners.
 * - Un listener que falla se registra en el log y no afecta a los demás.
 */

/** Una solicitud nueva quedó guardada (nunca lleva la cédula ni las respuestas del formulario). */
export type SolicitudCreada = { id: number; folio: string; formulario: string; area: string; solicitante: string; fecha: Date }

/** Administración abrió la ficha de una persona (que trae su cédula). Solo ids: nunca la cédula ni otros datos. */
export type FichaVista = { userId: number }

/** Administración cambió qué departamentos ven qué aplicaciones (en lote). Solo ids. */
export type VisibilidadCambiada = { applicationIds: number[] }

/** Alguien conectó su cuenta de RRHH Express: con su sesión de la intranet o como invitado. Nunca lleva datos de la persona. */
export type RrhhConectado = { tipo: 'sesion' | 'invitado' }

/** Tipo de evento → sus datos. Agregar un evento = agregarlo aquí. */
export type Eventos = {
  'solicitud.creada': SolicitudCreada
  'usuario.ficha_vista': FichaVista
  'aplicacion.visibilidad_cambiada': VisibilidadCambiada
  'rrhh.conectado': RrhhConectado
}
export type TipoEvento = keyof Eventos

/** Lo que recibe cada listener: el evento con su id (para la auditoría), quién lo provocó y cuándo. */
export type Sobre<K extends TipoEvento = TipoEvento> = { id: string; tipo: K; actorId: number | null; fecha: Date; datos: Eventos[K] }

type Listener<K extends TipoEvento> = (sobre: Sobre<K>) => void | Promise<void>
type ListenerCualquiera = (sobre: Sobre) => void | Promise<void>

const TODOS = Symbol('todos')

export class EventBusService {
  private readonly emisor = new EventEmitter()

  constructor() {
    // Sin límite de listeners: los registran los features al arrancar (y las pruebas).
    this.emisor.setMaxListeners(0)
  }

  /** Avisa que pasó algo. Devuelve el sobre (con su id) sin esperar a los listeners. */
  emit<K extends TipoEvento>(tipo: K, datos: Eventos[K], actorId: number | null = null): Sobre<K> {
    const sobre: Sobre<K> = { id: randomUUID(), tipo, actorId, fecha: new Date(), datos }
    setImmediate(() => {
      this.emisor.emit(tipo, sobre)
      this.emisor.emit(TODOS, sobre)
    })
    return sobre
  }

  /** Escucha un tipo de evento. Devuelve la función para dejar de escuchar. */
  on<K extends TipoEvento>(tipo: K, listener: Listener<K>): () => void {
    const envuelto = this.aislar(tipo, listener as ListenerCualquiera)
    this.emisor.on(tipo, envuelto)
    return () => this.emisor.off(tipo, envuelto)
  }

  /** Escucha todos los tipos (la auditoría): un evento nuevo queda auditado sin tocar su código. */
  onAny(listener: ListenerCualquiera): () => void {
    const envuelto = this.aislar('*', listener)
    this.emisor.on(TODOS, envuelto)
    return () => this.emisor.off(TODOS, envuelto)
  }

  /** Un listener que lanza (o cuya promesa falla) no rompe a los demás ni a quien emitió. */
  private aislar(nombre: string, listener: ListenerCualquiera) {
    return (sobre: Sobre) => {
      try {
        Promise.resolve(listener(sobre)).catch((err) => console.error(`Falló un listener de "${nombre}" (${sobre.tipo}): ${(err as Error).message}`))
      } catch (err) {
        console.error(`Falló un listener de "${nombre}" (${sobre.tipo}): ${(err as Error).message}`)
      }
    }
  }
}

export const eventBus = new EventBusService()
