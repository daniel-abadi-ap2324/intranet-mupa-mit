/** Identidad visual: los datos de data/marca.ts y los archivos de public/marca/ tienen que coincidir, y no se publica lo que no se puede. */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { AZULES, BLANCO, FIRMA, GRISES, GUIA_PDF, LOGOS, MANUAL, REDES_OFICIALES, rgbDeHex, rutaLogo, TEXTURAS, TIPOGRAFIAS, VIDEOLLAMADA, WALLPAPERS } from '@/data/marca'
import { REDES } from '@/components/shell/Pie'

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const publico = (ruta: string) => path.join(RAIZ, 'public', ruta.replace(/^\//, ''))
const existe = (ruta: string) => fs.existsSync(publico(ruta))

describe('logos', () => {
  it('son 16 versiones: 4 colores × horizontal y vertical × fondo claro o de color', () => {
    expect(LOGOS).toHaveLength(16)
    expect(new Set(LOGOS.map((l) => l.archivo)).size).toBe(16)
    expect(LOGOS.filter((l) => l.orientacion === 'horizontal')).toHaveLength(8)
  })

  it('cada versión existe en SVG y PNG; el PDF solo falta donde el paquete no lo trajo (y se dice)', () => {
    for (const l of LOGOS) {
      expect(existe(rutaLogo(l.archivo, 'svg')), l.archivo + ' svg').toBe(true)
      expect(existe(rutaLogo(l.archivo, 'png')), l.archivo + ' png').toBe(true)
      expect(existe(rutaLogo(l.archivo, 'pdf')), l.archivo + ' pdf').toBe(l.formatos.pdf)
    }
    expect(LOGOS.filter((l) => !l.formatos.pdf).map((l) => l.archivo)).toEqual(['logo-azul-sobre-blanco-horizontal'])
  })
})

describe('paleta', () => {
  const todos = [...AZULES, ...GRISES, BLANCO]

  it('los códigos HEX son válidos y no se repiten; el RGB sale del HEX', () => {
    for (const c of todos) expect(c.hex, c.nombre).toMatch(/^#[0-9A-F]{6}$/)
    expect(new Set(todos.map((c) => c.hex)).size).toBe(todos.length)
    expect(rgbDeHex('#083AC5')).toEqual([8, 58, 197])
    expect(rgbDeHex('#0E225D')).toEqual([14, 34, 93])
    expect(rgbDeHex('#21252B')).toEqual([33, 37, 43])
    expect(rgbDeHex('#FFFFFF')).toEqual([255, 255, 255])
  })

  it('el CMYK solo está donde lo entregó Comunicación (no se inventa)', () => {
    expect(todos.filter((c) => c.cmyk).map((c) => [c.hex, c.cmyk])).toEqual([
      ['#083AC5', [95, 76, 0, 0]],
      ['#0E225D', [100, 91, 36, 27]],
      ['#21252B', [82, 69, 55, 70]],
    ])
  })

  it('el azul brillante es #0046EF (el manual; «Códigos de color» repite #083AC5 por error)', () => {
    expect(AZULES.find((c) => c.nombre === 'Azul brillante')?.hex).toBe('#0046EF')
  })
})

describe('tipografías', () => {
  it('Noka y Prometo no se incluyen en esta copia (licencia); Montserrat se ofrece para descargar y su archivo existe', () => {
    expect(TIPOGRAFIAS.map((t) => t.nombre)).toEqual(['Noka', 'Prometo', 'Montserrat'])
    expect(TIPOGRAFIAS.filter((t) => !t.descarga).map((t) => t.nombre)).toEqual(['Noka', 'Prometo'])
    for (const t of TIPOGRAFIAS) if (t.descarga) expect(existe(t.descarga.archivo), t.nombre).toBe(true)
  })

  it('el sitio las sirve desde sí mismo (woff2 en public/fonts) y el CSS pide solo archivos que existen', () => {
    for (const f of ['Montserrat-400', 'Montserrat-500', 'Montserrat-600', 'Montserrat-700', 'Montserrat-800'])
      expect(fs.existsSync(path.join(RAIZ, 'public/fonts', f + '.woff2')), f).toBe(true)
    const css = fs.readFileSync(path.join(RAIZ, 'src/styles/fonts.css'), 'utf8')
    for (const m of css.matchAll(/url\("(\/fonts\/[^"]+)"\)/g)) expect(existe(m[1]), m[1]).toBe(true)
    // Nada de CDN: la CSP de nginx solo deja fuentes del propio sitio.
    expect(css).not.toMatch(/https?:[/][/]/)
  })

  it('sin Noka ni Prometo, los titulares y la marca usan Montserrat', () => {
    const tokens = fs.readFileSync(path.join(RAIZ, 'src/styles/tokens.css'), 'utf8')
    expect(tokens).toMatch(/--font-display:\s*"Montserrat"/)
    expect(tokens).toMatch(/--font-brand:\s*"Montserrat"/)
    expect(fs.readFileSync(path.join(RAIZ, 'src/styles/fonts.css'), 'utf8')).not.toMatch(/font-family:\s*"(Noka|Prometo)"/)
  })
})

describe('archivos de texturas, manual y plantillas', () => {
  it('todos existen donde dice la página', () => {
    const rutas = [TEXTURAS.pdf, TEXTURAS.editable, ...TEXTURAS.vistas.map((v) => v.src), MANUAL.archivo, GUIA_PDF.archivo, FIRMA.archivo, VIDEOLLAMADA.png.archivo, VIDEOLLAMADA.editable.archivo, ...WALLPAPERS.map((w) => w.src), ...TEXTURAS.vistas.map((v) => v.mini), VIDEOLLAMADA.png.mini, ...WALLPAPERS.map((w) => w.mini)]
    expect(WALLPAPERS).toHaveLength(12)
    for (const r of rutas) expect(existe(r), r).toBe(true)
  })
})

describe('redes sociales oficiales', () => {
  const todas = REDES_OFICIALES.flatMap((c) => c.redes.map((r) => ({ cuenta: c.cuenta, ...r })))

  it('son exactamente las que entregó Comunicación, todas https', () => {
    expect(todas.map((r) => r.h)).toEqual([
      'https://www.instagram.com/alcaldiapanama/',
      'https://www.facebook.com/municipio.depanama/',
      'https://www.tiktok.com/@alcaldiapanama',
      'https://www.youtube.com/@panamadealcaldia',
      'https://www.instagram.com/istarpty/',
      'https://www.facebook.com/p/I-STAR-PTY-61561149276309/',
      'https://www.tiktok.com/@istarpty',
      'https://www.instagram.com/casadelamunicipalidad/',
      'https://www.instagram.com/policiamunicipal_pty',
      'https://www.instagram.com/cochinospty_/',
    ])
  })

  it('el YouTube de I★PTY está pendiente: no se muestra', () => {
    expect(todas.find((r) => r.cuenta === 'I★PTY' && r.red === 'YouTube')).toBeUndefined()
  })

  it('el pie usa los enlaces nuevos de la Alcaldía (Facebook y YouTube cambiaron)', () => {
    const pie = Object.fromEntries(REDES)
    expect(pie.Facebook).toBe('https://www.facebook.com/municipio.depanama/')
    expect(pie.YouTube).toBe('https://www.youtube.com/@panamadealcaldia')
    expect(pie.Instagram).toBe('https://www.instagram.com/alcaldiapanama/')
    expect(pie.TikTok).toBe('https://www.tiktok.com/@alcaldiapanama')
    expect(Object.values(pie).join(' ')).not.toMatch(/panamaalcaldia\b.*facebook|municipiodepanama/)
  })
})

describe('reglas de contenido', () => {
  it('la página de identidad visual no menciona formulario de apoyo ni lleva comunicación escrita ni preguntas frecuentes', () => {
    const fuentes = ['src/paginas/Comunicacion.tsx', 'src/paginas/GuiaLogo.tsx', 'src/data/marca.ts', 'src/data/comunicacion.ts', 'src/components/marca/Logos.tsx', 'src/components/marca/Paleta.tsx', 'src/components/marca/Resto.tsx']
      .map((f) => fs.readFileSync(path.join(RAIZ, f), 'utf8'))
      .join('\n')
      // Los comentarios que explican la regla no cuentan.
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '')
    expect(fuentes).not.toMatch(/Solicitar apoyo|formulario de (apoyo|solicitud)|\/formularios/i)
    expect(fuentes).not.toMatch(/Preguntas frecuentes|Comunicación escrita/i)
  })

  it('sin IPs internas en los datos de marca', () => {
    const datos = fs.readFileSync(path.join(RAIZ, 'src/data/marca.ts'), 'utf8')
    expect(datos).not.toMatch(/\b(10|172\.(1[6-9]|2\d|3[01])|192\.168)\.\d+\.\d+/)
  })
})
