import { DomainError } from '../../shared/errors/domain-error.ts'
import type { State } from './announcements.constants.ts'
import { announcementsRepository, type AnnouncementsRepository, type AnnouncementWithEditor } from './announcements.repository.ts'
import type { CreateAnnouncementDto } from './dtos/create-announcement.dto.ts'
import type { UpdateAnnouncementDto } from './dtos/update-announcement.dto.ts'

/** Quien publica o edita (ya pasó por requireRole). */
type Editor = { id: number }

export type ManagedAnnouncement = AnnouncementWithEditor & { state: State; updatedByName: string | null }

const NOT_FOUND = () => new DomainError('El anuncio no existe.', 404, 'ANNOUNCEMENT_NOT_FOUND')

/** Hoy en Panamá, "AAAA-MM-DD" (el servidor puede estar en UTC: a las 8 p.m. de Panamá ya es mañana en UTC). */
export function todayInPanama(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Panama' }).format(new Date())
}

export class AnnouncementsService {
  private readonly repository: AnnouncementsRepository
  private readonly today: () => string

  constructor(repository: AnnouncementsRepository, today: () => string = todayInPanama) {
    this.repository = repository
    this.today = today
  }

  /** Los que se ven hoy en el Inicio. */
  async listActive(): Promise<AnnouncementWithEditor[]> {
    return this.repository.findMany({ activeOn: this.today() })
  }

  /** Todos, con su estado, para el panel de Comunicación. */
  async listAll(): Promise<ManagedAnnouncement[]> {
    const today = this.today()
    return (await this.repository.findMany({})).map((row) => this.managed(row, today))
  }

  async create(editor: Editor, data: CreateAnnouncementDto): Promise<ManagedAnnouncement> {
    const publishFrom = data.publishFrom ?? this.today()
    this.assertDates(publishFrom, data.publishUntil ?? null)
    const created = await this.repository.create({ ...data, publishFrom, createdBy: editor.id, updatedBy: editor.id })
    return this.managed(created, this.today())
  }

  async update(editor: Editor, id: number, data: UpdateAnnouncementDto): Promise<ManagedAnnouncement> {
    const current = await this.repository.findById(id)
    if (!current) throw NOT_FOUND()
    this.assertDates(data.publishFrom ?? current.publishFrom, data.publishUntil === undefined ? current.publishUntil : data.publishUntil)
    const updated = await this.repository.update(id, { ...data, updatedBy: editor.id })
    return this.managed(updated, this.today())
  }

  async delete(id: number): Promise<void> {
    if (!(await this.repository.findById(id))) throw NOT_FOUND()
    await this.repository.delete(id)
  }

  /** Las fechas son "AAAA-MM-DD": se comparan como texto. */
  private assertDates(from: string, until: string | null): void {
    if (until && until < from) {
      throw new DomainError('La fecha final no puede ser anterior a la de inicio.', 400, 'INVALID_DATES')
    }
  }

  private managed(row: AnnouncementWithEditor, today: string): ManagedAnnouncement {
    const name = [row.editorFirstName, row.editorLastName].filter(Boolean).join(' ')
    return { ...row, state: this.stateOf(row, today), updatedByName: name || null }
  }

  private stateOf(row: AnnouncementWithEditor, today: string): State {
    if (row.status === 'borrador' || row.status === 'retirado') return row.status
    if (row.publishFrom > today) return 'programado'
    if (row.publishUntil && row.publishUntil < today) return 'vencido'
    return 'vigente'
  }
}

export const announcementsService = new AnnouncementsService(announcementsRepository)
