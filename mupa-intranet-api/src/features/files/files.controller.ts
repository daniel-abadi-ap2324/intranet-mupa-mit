import type { Request, Response } from 'express'

import { FILE_FRAME_HEADERS } from '../../shared/middlewares/security-headers.middleware.ts'
import type { FileParamsDto } from './dtos/file-params.dto.ts'
import { fileResponseDto } from './dtos/file-response.dto.ts'
import { filesService, type FilesService } from './files.service.ts'

export class FilesController {
  private readonly service: FilesService

  constructor(service: FilesService) {
    this.service = service
  }

  /** El cuerpo es el archivo tal cual; el nombre original llega en X-File-Name (codificado). */
  upload = async (req: Request, res: Response) => {
    const content = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0)
    let name = 'archivo'
    try {
      name = decodeURIComponent(String(req.get('x-file-name') ?? 'archivo'))
    } catch {
      /* nombre mal codificado: se usa el genérico */
    }
    const stored = await this.service.upload(req.user!, content, name)
    res.status(201).json(fileResponseDto.parse(stored))
  }

  download = async (req: Request, res: Response) => {
    const { id } = req.params as unknown as FileParamsDto
    const { file, path } = await this.service.get(id)
    // Los archivos no cambian (cada subida es uno nuevo): se pueden guardar en caché.
    // setHeader y no res.set: Express le agregaría "; charset=utf-8" a un PDF.
    res.setHeader('Content-Type', file.mimeType)
    res.set({
      'Content-Disposition': `inline; filename="${file.originalName}"`,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'public, max-age=86400',
      // Se muestran dentro de la intranet (el lector de boletines los pone en un <iframe>).
      ...FILE_FRAME_HEADERS,
    })
    res.sendFile(path)
  }
}

export const filesController = new FilesController(filesService)
