import { createCanvas } from '@napi-rs/canvas'
// La versión "legacy" es la que corre en Node (la normal usa APIs del navegador).
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'

/** Ancho de la portada en píxeles: de sobra para la miniatura y liviana (~150 KB). */
const COVER_WIDTH = 360

/** Dibuja la primera página de un PDF y la devuelve como PNG. Lanza un Error si el PDF no se puede leer. */
export async function renderPdfCover(pdf: Buffer): Promise<Buffer> {
  const task = getDocument({ data: new Uint8Array(pdf), disableFontFace: true, verbosity: 0 })
  try {
    const doc = await task.promise
    const page = await doc.getPage(1)
    const viewport = page.getViewport({ scale: COVER_WIDTH / page.getViewport({ scale: 1 }).width })
    const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height))
    // Fondo blanco: sin él, las páginas sin fondo salen transparentes (negro en algunos visores).
    const context = canvas.getContext('2d')
    context.fillStyle = '#fff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    // El tipo de pdfjs pide un canvas del navegador (DOM); el de @napi-rs/canvas funciona igual en Node.
    await page.render({ canvasContext: context as never, viewport, canvas: canvas as never }).promise
    return canvas.toBuffer('image/png')
  } finally {
    await task.destroy()
  }
}
