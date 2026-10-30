import { DomainError } from '../../shared/errors/domain-error.ts'
import { ValidationError } from '../../shared/errors/validation-error.ts'
import { hasRole, REQUEST_HANDLERS } from '../../shared/roles.ts'
import { eventBus, type EventBusService } from '../../shared/services/event-bus.service.ts'
import type { FormSection } from '../forms/dtos/form-definition.dto.ts'
import { formsService, type FormsService } from '../forms/forms.service.ts'
import type { ListRequestsDto } from './dtos/manage-request.dto.ts'
import { MAX_REQUESTS_PER_HOUR, OVERDUE_DAYS, type RequestStatus } from './requests.constants.ts'
import { requestsRepository, type MyRequest, type RecentRequestEvent, type RequestsRepository, type RequestStats, type RequestWithOwner } from './requests.repository.ts'
import { reviewAnswers, type Answers } from './requests.validation.ts'

type Viewer = { id: number; roles: string[]; firstName: string; lastName: string | null; email: string | null }

export type ManagedRequest = RequestWithOwner & { ownerName: string }
export type RequestDetail = ManagedRequest & {
  events: { id: number; type: string; status: string | null; body: string | null; authorName: string | null; fromStaff: boolean; createdAt: Date }[]
}

const NOT_FOUND = () => new DomainError('La solicitud no existe.', 404, 'REQUEST_NOT_FOUND')
const nombre = (first: string | null, last: string | null) => [first, last].filter(Boolean).join(' ')

/**
 * Solicitudes: las envía cualquier persona con sesión (si el formulario recibe
 * solicitudes) y las atiende el Gestor de Solicitudes: cambia el estado y responde.
 */
export class RequestsService {
  private readonly repository: RequestsRepository
  private readonly forms: FormsService
  private readonly eventos: EventBusService

  constructor(repository: RequestsRepository, forms: FormsService, eventos: EventBusService) {
    this.repository = repository
    this.forms = forms
    this.eventos = eventos
  }

  async submit(viewer: Viewer, data: { form: string; respuestas: Answers }): Promise<MyRequest> {
    const form = await this.forms.findBySlug(data.form)
    if (!form || !form.published) throw new DomainError('El formulario no existe.', 404, 'FORM_NOT_FOUND')
    if (!form.accepting) {
      throw new DomainError('Este formulario todavía no recibe solicitudes: el envío es de prueba.', 409, 'FORM_NOT_ACCEPTING')
    }
    const hace1h = new Date(Date.now() - 3_600_000)
    if ((await this.repository.countByUserSince(viewer.id, hace1h)) >= MAX_REQUESTS_PER_HOUR) {
      throw new DomainError('Enviaste muchas solicitudes en la última hora. Espera un poco e inténtalo de nuevo.', 429, 'TOO_MANY_REQUESTS')
    }
    const sections = form.sections as FormSection[]
    const review = reviewAnswers(sections, data.respuestas, { nombreCompleto: nombre(viewer.firstName, viewer.lastName), correo: viewer.email ?? undefined })
    if (review.errors.length) throw new ValidationError(review.errors.map((e) => ({ field: 'respuestas.' + e.ruta, message: e.msg })))
    if (!('data' in review)) throw new Error('Revisión sin datos')
    const created = await this.repository.create({
      formId: form.id,
      formTitle: form.title,
      formArea: form.area,
      formSections: sections,
      userId: viewer.id,
      data: review.data,
      summary: review.summary,
    })
    // Ya quedó guardada (la transacción terminó): se avisa a quien escuche (notificaciones, auditoría).
    this.eventos.emit(
      'solicitud.creada',
      { id: created.id, folio: created.folio ?? '', formulario: created.formTitle, area: created.formArea, solicitante: nombre(viewer.firstName, viewer.lastName), fecha: created.createdAt },
      viewer.id,
    )
    return { ...created, unread: false }
  }

  mine(viewer: { id: number }): Promise<MyRequest[]> {
    return this.repository.findByUser(viewer.id)
  }

  countUnread(viewer: { id: number }): Promise<number> {
    return this.repository.countUnreadByUser(viewer.id)
  }

  countNew(): Promise<number> {
    return this.repository.countByStatus('recibida')
  }

  /** Las recibidas que nadie atendió todavía, de la más nueva a la más vieja. */
  async listNew(limit: number): Promise<ManagedRequest[]> {
    return (await this.repository.findMany({ status: 'recibida' })).slice(0, limit).map((r) => this.managed(r))
  }

  /** Cifras para el Centro de Gestión. */
  stats(since: Date, overdueBefore: Date): Promise<RequestStats> {
    return this.repository.stats(since, overdueBefore)
  }

  async listOverdue(overdueBefore: Date, limit: number): Promise<ManagedRequest[]> {
    return (await this.repository.findOverdue(overdueBefore, limit)).map((r) => this.managed(r))
  }

  createdSince(since: Date): Promise<Date[]> {
    return this.repository.createdSince(since)
  }

  recentEvents(limit: number): Promise<RecentRequestEvent[]> {
    return this.repository.findRecentEvents(limit)
  }

  /** La ve la persona que la envió (y queda como leída) o el Gestor. */
  async detail(viewer: Viewer, id: number): Promise<RequestDetail> {
    const row = await this.repository.findById(id)
    const manager = hasRole(viewer, ...REQUEST_HANDLERS)
    if (!row || (row.userId !== viewer.id && !manager)) throw NOT_FOUND()
    if (row.userId === viewer.id) await this.repository.markSeen(id)
    const events = (await this.repository.findEvents(id)).map((e) => ({
      id: e.id,
      type: e.type,
      status: e.status,
      body: e.body,
      authorName: nombre(e.authorFirstName, e.authorLastName) || null,
      fromStaff: e.authorId !== row.userId,
      createdAt: e.createdAt,
    }))
    return { ...this.managed(row), events }
  }

  async list(filter: ListRequestsDto): Promise<ManagedRequest[]> {
    const overdueBefore = filter.overdue ? new Date(Date.now() - OVERDUE_DAYS * 86_400_000) : undefined
    return (await this.repository.findMany({ formSlug: filter.form, status: filter.status, area: filter.area, q: filter.q, overdueBefore })).map((r) => this.managed(r))
  }

  async setStatus(viewer: Viewer, id: number, status: RequestStatus): Promise<RequestDetail> {
    const row = await this.repository.findById(id)
    if (!row) throw NOT_FOUND()
    if (row.status !== status) await this.repository.updateStatus(id, status, viewer.id)
    return this.detail(viewer, id)
  }

  async reply(viewer: Viewer, id: number, body: string): Promise<RequestDetail> {
    if (!(await this.repository.findById(id))) throw NOT_FOUND()
    await this.repository.addMessage(id, viewer.id, body)
    return this.detail(viewer, id)
  }

  private managed(row: RequestWithOwner): ManagedRequest {
    return { ...row, ownerName: nombre(row.ownerFirstName, row.ownerLastName) }
  }
}

export const requestsService = new RequestsService(requestsRepository, formsService, eventBus)
