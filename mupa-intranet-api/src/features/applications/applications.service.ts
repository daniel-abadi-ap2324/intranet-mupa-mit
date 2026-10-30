import { DomainError } from '../../shared/errors/domain-error.ts'
import { isInternalAddress } from '../../shared/dtos/url.dto.ts'
import { CATALOG_EDITORS, hasRole } from '../../shared/roles.ts'
import { eventBus, type EventBusService } from '../../shared/services/event-bus.service.ts'
import { departmentsService, type DepartmentsService } from '../departments/departments.service.ts'
import { tagsService, type TagsService } from '../tags/tags.service.ts'
import { applicationsRepository, type ApplicationsRepository, type ApplicationWithTags } from './applications.repository.ts'
import type { CreateApplicationDto } from './dtos/create-application.dto.ts'
import type { SetVisibilityDto } from './dtos/set-visibility.dto.ts'
import type { UpdateApplicationDto } from './dtos/update-application.dto.ts'

/** Quien mira: null = sin sesión. */
type Viewer = { roles: string[]; departmentId?: number | null } | null | undefined

/** Lo que ve cada quien: sin la dirección de "solo red interna", la nota interna ni los departamentos si no edita el catálogo. */
export type VisibleApplication = Omit<ApplicationWithTags, 'note' | 'departments'> & { note?: string; departments?: ApplicationWithTags['departments'] }

const NOT_FOUND = () => new DomainError('La aplicación no existe.', 404, 'APPLICATION_NOT_FOUND')

/** "Agendar cita médica" → "agendar-cita-medica" */
function slugify(text: string): string {
  const s = text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
  return s || 'aplicacion'
}

export class ApplicationsService {
  private readonly repository: ApplicationsRepository
  private readonly tags: TagsService
  private readonly departments: DepartmentsService
  private readonly eventos: EventBusService | null

  constructor(repository: ApplicationsRepository, tags: TagsService, departments: DepartmentsService, eventos: EventBusService | null = null) {
    this.eventos = eventos
    this.repository = repository
    this.tags = tags
    this.departments = departments
  }

  /**
   * Catálogo que puede ver esta persona:
   *  - sin sesión: solo publicadas y sin las de acceso "sesion" (paneles de administración);
   *  - con sesión: todas las publicadas;
   *  - en los dos casos, una app restringida a departamentos solo la ve quien es de uno de ellos;
   *  - quien edita el catálogo lo ve todo, puede pedir los borradores y ver lo que ve un departamento.
   */
  async list(viewer: Viewer, options: { includeDrafts: boolean; department?: number }): Promise<VisibleApplication[]> {
    const editor = hasRole(viewer, ...CATALOG_EDITORS)
    if ((options.includeDrafts || options.department) && !editor) {
      throw new DomainError('Solo quien edita el catálogo puede usar ese filtro.', 403, 'FORBIDDEN')
    }
    const visibleToDepartment = editor ? options.department : (viewer?.departmentId ?? null)
    const rows = await this.repository.findMany({
      publishedOnly: !options.includeDrafts,
      excludeAccess: viewer ? undefined : 'sesion',
      visibleToDepartment,
    })
    return rows.map((row) => this.visibleTo(row, editor))
  }

  async getById(viewer: Viewer, id: number): Promise<VisibleApplication> {
    const editor = hasRole(viewer, ...CATALOG_EDITORS)
    const row = await this.repository.findById(id)
    // Un borrador, un panel "de sesión" sin sesión o una app de otro departamento no existe para quien no puede verla.
    const otherDepartment = row?.departments.length && !row.departments.some((d) => d.id === viewer?.departmentId)
    if (!row || (!editor && (!row.published || (!viewer && row.access === 'sesion') || otherDepartment))) throw NOT_FOUND()
    return this.visibleTo(row, editor)
  }

  async create(data: CreateApplicationDto): Promise<VisibleApplication> {
    const { tagIds = [], departmentIds = [], ...fields } = data
    this.assertInternalLinkAllowed(fields.url, fields.status)
    if (fields.url) await this.assertUrlAvailable(fields.url)
    await this.tags.assertExist(tagIds)
    await this.departments.assertExist(departmentIds)
    const slug = await this.uniqueSlug(fields.name)
    const created = await this.repository.create({ ...fields, slug }, tagIds, [...new Set(departmentIds)])
    return this.visibleTo(created, true)
  }

  async update(id: number, data: UpdateApplicationDto): Promise<VisibleApplication> {
    const current = await this.repository.findById(id)
    if (!current) throw NOT_FOUND()
    const { tagIds, departmentIds, ...fields } = data
    if (fields.url !== undefined || fields.status !== undefined) this.assertInternalLinkAllowed(fields.url !== undefined ? fields.url : current.url, fields.status ?? current.status)
    if (fields.url && fields.url !== current.url) await this.assertUrlAvailable(fields.url, id)
    if (tagIds) await this.tags.assertExist(tagIds)
    if (departmentIds) await this.departments.assertExist(departmentIds)
    const updated = await this.repository.update(id, fields, tagIds, departmentIds && [...new Set(departmentIds)])
    return this.visibleTo(updated, true)
  }

  /** Cambia de una vez qué departamentos ven cada aplicación (todo o nada) y lo deja en la auditoría. Devuelve cuántas cambió. */
  async setVisibility(items: SetVisibilityDto, actorId: number): Promise<number> {
    const applicationIds = items.map((i) => i.applicationId)
    if ((await this.repository.countExisting(applicationIds)) !== applicationIds.length) throw NOT_FOUND()
    const normalized = items.map((i) => ({ applicationId: i.applicationId, departmentIds: [...new Set(i.departmentIds)] }))
    await this.departments.assertExist(normalized.flatMap((i) => i.departmentIds))
    await this.repository.replaceDepartments(normalized)
    this.eventos?.emit('aplicacion.visibilidad_cambiada', { applicationIds }, actorId)
    return normalized.length
  }

  /** Para el Centro de Gestión. */
  counts(): Promise<{ published: number; drafts: number }> {
    return this.repository.countByPublished()
  }

  async delete(id: number): Promise<void> {
    if (!(await this.repository.findById(id))) throw NOT_FOUND()
    await this.repository.delete(id)
  }

  private visibleTo(row: ApplicationWithTags, editor: boolean): VisibleApplication {
    const { note, departments, ...rest } = row
    return {
      ...rest,
      url: row.access === 'red-interna' && !editor ? null : row.url,
      ...(editor ? { note, departments } : {}),
    }
  }

  /** Una IP o un nombre interno solo va en las aplicaciones marcadas «Solo red interna». */
  private assertInternalLinkAllowed(url: string | null | undefined, status: string | undefined): void {
    if (url && isInternalAddress(url) && status !== 'solo-red-interna') {
      throw new DomainError('Una dirección interna (IP o sin dominio) solo se acepta en las aplicaciones marcadas «Solo red interna».', 400, 'INTERNAL_LINK_NOT_ALLOWED')
    }
  }

  private async assertUrlAvailable(url: string, exceptId?: number): Promise<void> {
    const other = await this.repository.findByUrl(url)
    if (other && other.id !== exceptId) {
      throw new DomainError(`Ya existe «${other.name}» con esta dirección.`, 409, 'URL_ALREADY_USED')
    }
  }

  private async uniqueSlug(name: string): Promise<string> {
    const base = slugify(name)
    let slug = base
    for (let n = 2; await this.repository.existsBySlug(slug); n++) slug = `${base}-${n}`
    return slug
  }
}

export const applicationsService = new ApplicationsService(applicationsRepository, tagsService, departmentsService, eventBus)
