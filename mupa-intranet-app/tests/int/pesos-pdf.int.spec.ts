/**
 * Todo PDF de más de 2 MB que la intranet enlaza dice cuánto pesa («PDF · 3,1 MB»), y el
 * peso escrito coincide con el del archivo (en MB decimales, con una décima de margen).
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { DOCUMENTOS } from '@/data/documentos'
import { DOCUMENTOS_INSTITUCIONALES, MANUALES } from '@/data/manuales'
import { GUIA_PDF, MANUAL } from '@/data/marca'

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const bytes = (ruta: string) => fs.statSync(path.join(RAIZ, 'public', ruta.replace(/^\//, ''))).size

const enlaces: { h: string; texto: string }[] = [
  ...DOCUMENTOS.filter((d) => d.h).map((d) => ({ h: d.h as string, texto: d.meta })),
  ...[...MANUALES, ...DOCUMENTOS_INSTITUCIONALES].map((d) => ({ h: d.h, texto: d.meta })),
  { h: MANUAL.archivo, texto: MANUAL.tam },
  { h: GUIA_PDF.archivo, texto: GUIA_PDF.tam },
].filter((e) => /\.pdf$/i.test(e.h) && fs.existsSync(path.join(RAIZ, 'public', e.h.replace(/^\//, ''))))

describe('peso de los PDF grandes', () => {
  it('los PDF de más de 2 MB llevan su peso, y es el verdadero', () => {
    const grandes = enlaces.filter((e) => bytes(e.h) > 2_000_000)
    expect(grandes.length).toBeGreaterThan(0)
    for (const e of grandes) {
      const m = e.texto.match(/(\d+(?:,\d)?) MB/)
      expect(m, `${e.h}: falta el peso en «${e.texto}»`).not.toBeNull()
      const escrito = Number((m as RegExpMatchArray)[1].replace(',', '.'))
      expect(Math.abs(escrito - bytes(e.h) / 1_000_000), `${e.h}: dice ${escrito} MB`).toBeLessThanOrEqual(0.5)
    }
  })
})
