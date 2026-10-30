import type { NewNewsRow } from '../../database/schema/index.ts'
import { DomainError } from '../../shared/errors/domain-error.ts'
import type { CreateNewsDto } from './dtos/create-news.dto.ts'
import type { UpdateNewsDto } from './dtos/update-news.dto.ts'
import { newsRepository, type NewsRepository, type NewsWithEditor } from './news.repository.ts'

export type ManagedNews = NewsWithEditor & { updatedByName: string | null }

const NOT_FOUND = () => new DomainError('La noticia no existe.', 404, 'NEWS_NOT_FOUND')

/** Noticias y consejos: los publica Comunicación (o administración) desde su panel. */
export class NewsService {
  private readonly repository: NewsRepository

  constructor(repository: NewsRepository) {
    this.repository = repository
  }

  listPublished(): Promise<NewsWithEditor[]> {
    return this.repository.findMany({ publishedOnly: true })
  }

  async listAll(): Promise<ManagedNews[]> {
    return (await this.repository.findMany({ publishedOnly: false })).map((row) => this.managed(row))
  }

  async create(viewer: { id: number }, data: CreateNewsDto): Promise<ManagedNews> {
    const created = await this.repository.create({ ...(data as Parameters<NewsRepository['create']>[0]), createdBy: viewer.id, updatedBy: viewer.id })
    return this.managed(created)
  }

  /** Para la sincronización con mupa.gob.pa: sin cuenta que la edite (created_by / updated_by quedan null). */
  async importFromSource(data: NewNewsRow & { sourceId: string }): Promise<void> {
    await this.repository.create({ ...data, createdBy: null, updatedBy: null })
  }

  findBySourceIds(sourceIds: string[]): Promise<Map<string, { id: number; hasBody: boolean }>> {
    return this.repository.findBySourceIds(sourceIds)
  }

  /** Para la sincronización: pone el texto a una noticia ya importada que no lo tenía. No toca nada más. */
  async fillBody(id: number, body: string): Promise<void> {
    await this.repository.update(id, { body })
  }

  /** Una noticia PUBLICADA con su texto, para leerla en la intranet. Las ocultas o borradores no existen para quien lee. */
  async getPublished(id: number): Promise<NewsWithEditor> {
    const row = await this.repository.findById(id)
    if (!row || row.status !== 'publicado') throw NOT_FOUND()
    return row
  }

  async update(viewer: { id: number }, id: number, data: UpdateNewsDto): Promise<ManagedNews> {
    if (!(await this.repository.findById(id))) throw NOT_FOUND()
    const updated = await this.repository.update(id, { ...(data as Parameters<NewsRepository['update']>[1]), updatedBy: viewer.id })
    return this.managed(updated)
  }

  async delete(id: number): Promise<void> {
    if (!(await this.repository.findById(id))) throw NOT_FOUND()
    await this.repository.delete(id)
  }

  private managed(row: NewsWithEditor): ManagedNews {
    const name = [row.editorFirstName, row.editorLastName].filter(Boolean).join(' ')
    return { ...row, updatedByName: name || null }
  }
}

export const newsService = new NewsService(newsRepository)
