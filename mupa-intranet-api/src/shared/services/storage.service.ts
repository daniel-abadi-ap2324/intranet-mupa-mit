import { randomBytes } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'

import { env } from '../../config/env.ts'

/**
 * Guarda y ubica archivos en disco (UPLOADS_DIR). El nombre en disco lo genera
 * este servicio (nunca el que manda el navegador), así que no hay forma de
 * escribir fuera de la carpeta.
 */
export class StorageService {
  private readonly dir: string

  constructor(dir: string) {
    this.dir = path.resolve(dir)
  }

  /** Guarda el contenido y devuelve el nombre con el que quedó. */
  async save(content: Buffer, extension: string): Promise<string> {
    await fs.mkdir(this.dir, { recursive: true })
    const name = randomBytes(16).toString('hex') + '.' + extension
    await fs.writeFile(path.join(this.dir, name), content, { flag: 'wx' })
    return name
  }

  /** Ruta absoluta de un archivo guardado. */
  pathOf(storedName: string): string {
    return path.join(this.dir, path.basename(storedName))
  }

  async exists(storedName: string): Promise<boolean> {
    return fs
      .access(this.pathOf(storedName))
      .then(() => true)
      .catch(() => false)
  }
}

export const storageService = new StorageService(env.UPLOADS_DIR)
