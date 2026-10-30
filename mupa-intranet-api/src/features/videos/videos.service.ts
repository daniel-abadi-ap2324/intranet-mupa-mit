import { DomainError } from '../../shared/errors/domain-error.ts'
import type { CreateVideoDto } from './dtos/create-video.dto.ts'
import type { UpdateVideoDto } from './dtos/update-video.dto.ts'
import { videoRepository, type VideosRepository, type VideoWithEditor } from './videos.repository.ts'

export type ManagedVideo = VideoWithEditor & { updatedByName: string | null }

const NOT_FOUND = () => new DomainError('El video no existe.', 404, 'VIDEO_NOT_FOUND')

/** Videos: los publica Comunicación (o administración) desde su panel. */
export class VideosService {
  private readonly repository: VideosRepository

  constructor(repository: VideosRepository) {
    this.repository = repository
  }

  listPublished(): Promise<VideoWithEditor[]> {
    return this.repository.findMany({ publishedOnly: true })
  }

  async listAll(): Promise<ManagedVideo[]> {
    return (await this.repository.findMany({ publishedOnly: false })).map((row) => this.managed(row))
  }

  async create(viewer: { id: number }, data: CreateVideoDto): Promise<ManagedVideo> {
    const created = await this.repository.create({ ...(data as Parameters<VideosRepository['create']>[0]), createdBy: viewer.id, updatedBy: viewer.id })
    return this.managed(created)
  }

  async update(viewer: { id: number }, id: number, data: UpdateVideoDto): Promise<ManagedVideo> {
    if (!(await this.repository.findById(id))) throw NOT_FOUND()
    const updated = await this.repository.update(id, { ...(data as Parameters<VideosRepository['update']>[1]), updatedBy: viewer.id })
    return this.managed(updated)
  }

  async delete(id: number): Promise<void> {
    if (!(await this.repository.findById(id))) throw NOT_FOUND()
    await this.repository.delete(id)
  }

  private managed(row: VideoWithEditor): ManagedVideo {
    const name = [row.editorFirstName, row.editorLastName].filter(Boolean).join(' ')
    return { ...row, updatedByName: name || null }
  }
}

export const videoService = new VideosService(videoRepository)
