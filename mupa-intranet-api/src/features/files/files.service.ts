import type { FileRow } from '../../database/schema/index.ts'
import { DomainError } from '../../shared/errors/domain-error.ts'
import { storageService, type StorageService } from '../../shared/services/storage.service.ts'
import { filesRepository, type FilesRepository } from './files.repository.ts'

/** Tipos aceptados, reconocidos por sus primeros bytes (no por la extensión ni por lo que diga el navegador). */
const TYPES: { mime: string; ext: string; test: (b: Buffer) => boolean }[] = [
  { mime: 'application/pdf', ext: 'pdf', test: (b) => b.subarray(0, 5).toString('latin1') === '%PDF-' },
  { mime: 'image/png', ext: 'png', test: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { mime: 'image/jpeg', ext: 'jpg', test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { mime: 'image/webp', ext: 'webp', test: (b) => b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP' },
]

export type StoredFile = FileRow & { url: string }

/** "Boletín 5 de agosto.pdf" → "Boletin-5-de-agosto.pdf" (para la dirección pública). */
function cleanName(name: string, ext: string): string {
  const base = name
    .replace(/\.[^.]*$/, '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
  return (base || 'archivo') + '.' + ext
}

export class FilesService {
  private readonly repository: FilesRepository
  private readonly storage: StorageService

  constructor(repository: FilesRepository, storage: StorageService) {
    this.repository = repository
    this.storage = storage
  }

  /** viewer = null cuando lo sube la sincronización con mupa.gob.pa (sin cuenta de por medio). */
  async upload(viewer: { id: number } | null, content: Buffer, name: string): Promise<StoredFile> {
    if (!content.length) throw new DomainError('El archivo está vacío.', 400, 'FILE_EMPTY')
    const type = TYPES.find((t) => t.test(content))
    if (!type) throw new DomainError('Solo se aceptan PDF e imágenes (JPG, PNG o WebP).', 400, 'FILE_TYPE_NOT_ALLOWED')
    const storedName = await this.storage.save(content, type.ext)
    const row = await this.repository.create({
      storedName,
      originalName: cleanName(name, type.ext),
      mimeType: type.mime,
      size: content.length,
      createdBy: viewer?.id ?? null,
    })
    return this.withUrl(row)
  }

  /** Para descargar: el registro y dónde está en disco. */
  async get(id: number): Promise<{ file: FileRow; path: string }> {
    const file = await this.repository.findById(id)
    if (!file || !(await this.storage.exists(file.storedName))) throw new DomainError('El archivo no existe.', 404, 'FILE_NOT_FOUND')
    return { file, path: this.storage.pathOf(file.storedName) }
  }

  private withUrl(row: FileRow): StoredFile {
    return { ...row, url: `/api/files/${row.id}/${row.originalName}` }
  }
}

export const filesService = new FilesService(filesRepository, storageService)
