import express, { Router } from 'express'

import { validate } from '../../shared/middlewares/validate.middleware.ts'
import { CONTENT_EDITORS } from '../../shared/roles.ts'
import { requireRole } from '../auth/auth.middleware.ts'
import { fileParamsDto } from './dtos/file-params.dto.ts'
import { filesController } from './files.controller.ts'

export const filesRoutes = Router()

/** Tamaño máximo de un archivo (igual que client_max_body_size en nginx). */
export const MAX_FILE_BYTES = 10 * 1024 * 1024

// Subir: Comunicación y administración. El cuerpo es el archivo, sin multipart.
filesRoutes.post('/', requireRole(...CONTENT_EDITORS), express.raw({ type: () => true, limit: MAX_FILE_BYTES }), filesController.upload)

// Ver: cualquiera (son los PDF e imágenes que se publican en la intranet).
filesRoutes.get('/:id{/:name}', validate({ params: fileParamsDto }), filesController.download)
