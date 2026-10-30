import type { NewFormRow } from '../../database/schema/index.ts'
import { DomainError } from '../../shared/errors/domain-error.ts'
import type { CreateFormDto } from './dtos/create-form.dto.ts'
import type { FormField, FormSection } from './dtos/form-definition.dto.ts'
import type { UpdateFormDto } from './dtos/update-form.dto.ts'
import { formsRepository, type FormsRepository, type FormWithEditor } from './forms.repository.ts'

export type ManagedForm = FormWithEditor & { updatedByName: string | null; requests: number }

const NOT_FOUND = () => new DomainError('El formulario no existe.', 404, 'FORM_NOT_FOUND')

/** "Carta de trabajo" → "carta-de-trabajo" */
function slugify(text: string): string {
  const s = text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
  return s || 'formulario'
}

/** Todos los campos, también los de dentro de casillas y listas. */
function allFields(sections: FormSection[]): FormField[] {
  const out: FormField[] = []
  const walk = (fields: FormField[]) => {
    for (const f of fields) {
      out.push(f)
      for (const it of f.items ?? []) walk(it.sub ?? [])
      walk(f.fields ?? [])
    }
  }
  for (const s of sections) walk(s.fields)
  return out
}

/** Formularios de solicitud: los arma el Gestor de Solicitudes. */
export class FormsService {
  private readonly repository: FormsRepository

  constructor(repository: FormsRepository) {
    this.repository = repository
  }

  listPublished(): Promise<FormWithEditor[]> {
    return this.repository.findMany({ publishedOnly: true })
  }

  async listAll(): Promise<ManagedForm[]> {
    const rows = await this.repository.findMany({ publishedOnly: false })
    return Promise.all(rows.map((row) => this.managed(row)))
  }

  async getPublished(slug: string): Promise<FormWithEditor> {
    const row = await this.repository.findBySlug(slug)
    if (!row || !row.published) throw NOT_FOUND()
    return row
  }

  /** Para otras features (solicitudes): el formulario tal como está hoy, por slug. */
  async findBySlug(slug: string): Promise<FormWithEditor | undefined> {
    return this.repository.findBySlug(slug)
  }

  async create(viewer: { id: number }, data: CreateFormDto): Promise<ManagedForm> {
    const sections = data.sections as FormSection[]
    this.assertConditions(sections)
    this.assertCanAccept(data.accepting ?? false, data.pendingDefinition ?? false)
    if (data.accepting) this.assertNoCedula(sections)
    const number = data.number ?? (await this.repository.maxNumber()) + 1
    if (await this.repository.existsNumber(number)) throw this.numberTaken(number)
    const created = await this.repository.create({
      ...(data as Omit<NewFormRow, 'slug' | 'number'>),
      number,
      slug: await this.uniqueSlug(data.title),
      createdBy: viewer.id,
      updatedBy: viewer.id,
    })
    return this.managed(created)
  }

  async update(viewer: { id: number }, id: number, data: UpdateFormDto): Promise<ManagedForm> {
    const current = await this.repository.findById(id)
    if (!current) throw NOT_FOUND()
    const sections = (data.sections ?? current.sections) as FormSection[]
    if (data.sections) this.assertConditions(sections)
    this.assertCanAccept(data.accepting ?? current.accepting, data.pendingDefinition ?? current.pendingDefinition)
    if (data.accepting ?? current.accepting) this.assertNoCedula(sections)
    if (data.number !== undefined && (await this.repository.existsNumber(data.number, id))) throw this.numberTaken(data.number)
    const updated = await this.repository.update(id, { ...(data as Partial<NewFormRow>), updatedBy: viewer.id })
    return this.managed(updated)
  }

  async delete(id: number): Promise<void> {
    if (!(await this.repository.findById(id))) throw NOT_FOUND()
    if (await this.repository.countRequests(id)) {
      throw new DomainError('Este formulario ya tiene solicitudes. Ocúltalo en lugar de borrarlo.', 409, 'FORM_HAS_REQUESTS')
    }
    await this.repository.delete(id)
  }

  /** Una sección condicional depende de una opción única (con esa clave y esa opción) de una sección anterior. */
  private assertConditions(sections: FormSection[]): void {
    sections.forEach((s, i) => {
      if (!s.show) return
      const radio = allFields(sections.slice(0, i)).find((f) => f.t === 'radio' && f.k === s.show!.k)
      if (!radio || !radio.opts?.includes(s.show.v)) {
        throw new DomainError(
          `La sección «${s.title}» depende de una respuesta que no existe: tiene que ser una opción de una pregunta de opción única de una sección anterior.`,
          400,
          'INVALID_FORM_CONDITION',
        )
      }
    })
  }

  /** Regla del proyecto: la intranet no guarda cédulas. */
  private assertNoCedula(sections: FormSection[]): void {
    if (allFields(sections).some((f) => f.t === 'cedula')) {
      throw new DomainError(
        'Este formulario pide cédula y la intranet no guarda cédulas. Quita esos campos (o cámbialos por otro dato) antes de recibir solicitudes.',
        409,
        'FORM_HAS_CEDULA',
      )
    }
  }

  /** Un formulario «a definir con RRHH» no recibe solicitudes hasta que se le quite la marca. */
  private assertCanAccept(accepting: boolean, pendingDefinition: boolean): void {
    if (accepting && pendingDefinition) {
      throw new DomainError(
        'Este formulario está «a definir con RRHH» y todavía no puede recibir solicitudes. Quita esa marca cuando RRHH defina su alcance.',
        409,
        'FORM_PENDING_DEFINITION',
      )
    }
  }

  private numberTaken(number: number): DomainError {
    return new DomainError(`Ya existe un formulario con el número ${number}.`, 409, 'FORM_NUMBER_TAKEN')
  }

  private async uniqueSlug(title: string): Promise<string> {
    const base = slugify(title)
    let slug = base
    for (let n = 2; await this.repository.existsSlug(slug); n++) slug = `${base}-${n}`
    return slug
  }

  private async managed(row: FormWithEditor): Promise<ManagedForm> {
    const name = [row.editorFirstName, row.editorLastName].filter(Boolean).join(' ')
    return { ...row, updatedByName: name || null, requests: await this.repository.countRequests(row.id) }
  }
}

export const formsService = new FormsService(formsRepository)
