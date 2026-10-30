import { readFile } from 'node:fs/promises'

import type { NewBulletinRow } from '../../database/schema/index.ts'
import { DomainError } from '../../shared/errors/domain-error.ts'
import { dateWords, describePdf, normalizeSearch } from '../../shared/services/pdf-text.service.ts'
import { filesService, type FilesService } from '../files/files.service.ts'
import type { CreateBulletinDto } from './dtos/create-bulletin.dto.ts'
import type { UpdateBulletinDto } from './dtos/update-bulletin.dto.ts'
import { bulletinRepository, type BulletinsRepository, type BulletinWithEditor } from './bulletins.repository.ts'

export type ManagedBulletin = BulletinWithEditor & { updatedByName: string | null }

const NOT_FOUND = () => new DomainError('El boletín no existe.', 404, 'BULLETIN_NOT_FOUND')

/** Lo que se busca: cada palabra tiene que estar en el boletín (en cualquier orden), sin importar tildes ni mayúsculas. */
export function searchTerms(q: string): string[] {
  return normalizeSearch(q).split(' ').filter(Boolean).slice(0, 8)
}

/** Id del archivo de un PDF subido a la intranet (/api/files/ID/nombre.pdf); null si es de otro lado. */
const uploadedFileId = (pdfUrl: string | null) => {
  const m = pdfUrl ? /^\/api\/files\/(\d+)\//.exec(pdfUrl) : null
  return m ? Number(m[1]) : null
}

/** Boletines "Alcaldía al día": los publica Comunicación (o administración) desde su panel. */
export class BulletinsService {
  private readonly repository: BulletinsRepository
  private readonly files: FilesService

  constructor(repository: BulletinsRepository, files: FilesService) {
    this.repository = repository
    this.files = files
  }

  /** Publicados. Con `q`, solo los que traen todas esas palabras (en su descripción, palabras clave, texto o fecha). */
  listPublished(q?: string): Promise<BulletinWithEditor[]> {
    return this.repository.findMany({ publishedOnly: true, terms: q ? searchTerms(q) : [] })
  }

  async listAll(): Promise<ManagedBulletin[]> {
    return (await this.repository.findMany({ publishedOnly: false, terms: [] })).map((row) => this.managed(row))
  }

  async create(viewer: { id: number }, data: CreateBulletinDto): Promise<ManagedBulletin> {
    const created = await this.repository.create({ ...(data as Parameters<BulletinsRepository['create']>[0]), createdBy: viewer.id, updatedBy: viewer.id })
    return this.managed(await this.describe(created))
  }

  /** Para la sincronización con mupa.gob.pa: sin cuenta que lo edite (created_by / updated_by quedan null). */
  async importFromSource(data: NewBulletinRow & { sourceId: string }): Promise<void> {
    const created = await this.repository.create({ ...data, createdBy: null, updatedBy: null })
    await this.describe(created)
  }

  findSourceIds(sourceIds: string[]): Promise<Set<string>> {
    return this.repository.findSourceIds(sourceIds)
  }

  existsOnDate(date: string): Promise<boolean> {
    return this.repository.existsByDate(date)
  }

  async update(viewer: { id: number }, id: number, data: UpdateBulletinDto): Promise<ManagedBulletin> {
    const before = await this.repository.findById(id)
    if (!before) throw NOT_FOUND()
    const updated = await this.repository.update(id, { ...(data as Parameters<BulletinsRepository['update']>[1]), updatedBy: viewer.id })
    // Si cambió el PDF o la fecha, la descripción y el texto para buscar se vuelven a sacar.
    const changed = updated.pdfUrl !== before.pdfUrl || updated.date !== before.date
    return this.managed(changed ? await this.describe(updated, { fresh: updated.pdfUrl !== before.pdfUrl }) : updated)
  }

  async delete(id: number): Promise<void> {
    if (!(await this.repository.findById(id))) throw NOT_FOUND()
    await this.repository.delete(id)
  }

  /**
   * Los que no tienen todavía su descripción o su texto para buscar (cargados antes de que existiera, o subidos a mano):
   * se completan leyendo su PDF. Se llama al arrancar la API. Devuelve cuántos se completaron.
   */
  async describeMissing(): Promise<number> {
    let done = 0
    for (const row of await this.repository.findWithoutSearchText()) {
      const completed = await this.describe(row)
      if (completed.searchText) done++
    }
    return done
  }

  /**
   * Saca del PDF la descripción corta, las palabras clave y el texto para buscar, y los guarda. Un fallo nunca impide guardar el boletín:
   * sin PDF legible queda solo con su fecha para buscar. `fresh`: el PDF cambió, así que lo anterior ya no vale.
   */
  private async describe(row: BulletinWithEditor, options: { fresh?: boolean } = {}): Promise<BulletinWithEditor> {
    const fileId = uploadedFileId(row.pdfUrl)
    let info = null
    if (fileId) {
      try {
        const { path } = await this.files.get(fileId)
        info = await describePdf(await readFile(path))
      } catch (e) {
        console.error('[boletines] no se pudo leer el PDF del boletín', row.id, e instanceof Error ? e.message : e)
      }
    }
    // Un PDF que no está en esta intranet (/sitio/…) no se puede leer desde aquí: se conserva lo que ya tenía.
    if (!info && !options.fresh && row.searchText && !fileId) return row
    return this.repository.update(row.id, {
      summary: info?.summary ?? null,
      keywords: info?.keywords.length ? info.keywords.join(',') : null,
      searchText: normalizeSearch([dateWords(row.date), info?.searchText ?? ''].join(' ')),
    })
  }

  private managed(row: BulletinWithEditor): ManagedBulletin {
    const name = [row.editorFirstName, row.editorLastName].filter(Boolean).join(' ')
    return { ...row, updatedByName: name || null }
  }
}

export const bulletinService = new BulletinsService(bulletinRepository, filesService)
