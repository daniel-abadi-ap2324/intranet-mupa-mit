import type { TagRow } from '../../database/schema/index.ts'
import { DomainError } from '../../shared/errors/domain-error.ts'
import { tagsRepository, type TagsRepository } from './tags.repository.ts'

export class TagsService {
  private readonly repository: TagsRepository

  constructor(repository: TagsRepository) {
    this.repository = repository
  }

  list(): Promise<TagRow[]> {
    return this.repository.findMany()
  }

  /** Falla si alguna de las etiquetas no existe (la lista es cerrada para evitar duplicados). */
  async assertExist(ids: number[]): Promise<void> {
    const unique = [...new Set(ids)]
    const found = new Set((await this.repository.findByIds(unique)).map((t) => t.id))
    const missing = unique.filter((id) => !found.has(id))
    if (missing.length) throw new DomainError(`No existen las etiquetas: ${missing.join(', ')}.`, 400, 'TAG_NOT_FOUND')
  }
}

export const tagsService = new TagsService(tagsRepository)
