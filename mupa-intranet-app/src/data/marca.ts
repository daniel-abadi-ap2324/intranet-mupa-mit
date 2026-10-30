/**
 * Identidad visual de la Alcaldía de Panamá: el paquete que entregó la Dirección de Comunicación
 * (carpeta ALCALDIA_ELEMENTOS, 5-oct-2026). Los archivos están en public/marca/ por categoría; los datos
 * (paleta, nombres, textos) salen del Manual de marca, de la Guía rápida de uso del logotipo y de
 * «Códigos de color». NADA se inventa: lo que el paquete no trae va como `null` y se ve «Pendiente de
 * Comunicación» (ver FALTA_DE_COMUNICACION). La página es paginas/Comunicacion.tsx.
 */

export const BASE_MARCA = '/marca'

// ---------- Logos ----------

export type Orientacion = 'horizontal' | 'vertical'

/** Las cuatro tintas oficiales del logo y el fondo de cada versión «blanco sobre …». */
const TINTAS = [
  { id: 'bright', nombre: 'Azul brillante', hex: '#0046EF', claro: 'azul-bright', color: 'azul-bright' },
  { id: 'institucional', nombre: 'Azul institucional', hex: '#083AC5', claro: 'azul', color: 'azul' },
  { id: 'navy', nombre: 'Azul navy', hex: '#0E225D', claro: 'azul-navy', color: 'azul-navy' },
  { id: 'gris', nombre: 'Gris', hex: '#21252B', claro: 'gris', color: 'gris' },
] as const

export type LogoVariante = {
  /** Nombre del archivo, sin extensión (igual en SVG, PNG y PDF). */
  archivo: string
  orientacion: Orientacion
  /** 'claro': el logo de color sobre blanco (para fondos claros). 'color': el logo blanco sobre su fondo de color (viene con el fondo). */
  fondo: 'claro' | 'color'
  nombre: string
  hex: string
  /** Formatos que existen en el paquete. */
  formatos: { svg: boolean; png: boolean; pdf: boolean }
}

/** Del paquete: falta el PDF de «azul sobre blanco horizontal» (en su carpeta PDF venía un .svg). */
const SIN_PDF = new Set(['logo-azul-sobre-blanco-horizontal'])

export const LOGOS: LogoVariante[] = (['claro', 'color'] as const).flatMap((fondo) =>
  (['horizontal', 'vertical'] as const).flatMap((orientacion) =>
    TINTAS.map((t) => {
      const archivo = fondo === 'claro' ? `logo-${t.claro}-sobre-blanco-${orientacion}` : `logo-blanco-sobre-${t.color}-${orientacion}`
      return {
        archivo,
        orientacion,
        fondo,
        nombre: fondo === 'claro' ? `${t.nombre} sobre blanco` : `Blanco sobre ${t.nombre.toLowerCase()}`,
        hex: t.hex,
        formatos: { svg: true, png: true, pdf: !SIN_PDF.has(archivo) },
      }
    }),
  ),
)

// «Blanco sobre azul institucional» horizontal existe; los demás combos de la guía también (16 en total).

export const rutaLogo = (archivo: string, formato: 'svg' | 'png' | 'pdf') => `${BASE_MARCA}/logos/${formato}/${archivo}.${formato}`

// ---------- Paleta ----------

export type ColorMarca = {
  hex: string
  nombre: string
  /** CMYK solo donde el paquete lo trae («Códigos de color»); el resto no muestra la fila (no se inventa). */
  cmyk: [number, number, number, number] | null
  /** Uno de los colores del logo (los de «Códigos de color»). */
  principal?: boolean
}

export const AZULES: ColorMarca[] = [
  { hex: '#EDF7FF', nombre: 'Azul 50', cmyk: null },
  { hex: '#D6EAFF', nombre: 'Azul 100', cmyk: null },
  { hex: '#B5DCFF', nombre: 'Azul 200', cmyk: null },
  { hex: '#83C8FF', nombre: 'Azul 300', cmyk: null },
  { hex: '#48A9FF', nombre: 'Azul 400', cmyk: null },
  { hex: '#0660FF', nombre: 'Azul 500', cmyk: null },
  { hex: '#0046EF', nombre: 'Azul brillante', cmyk: null, principal: true },
  { hex: '#083AC5', nombre: 'Azul institucional', cmyk: [95, 76, 0, 0], principal: true },
  { hex: '#0D369B', nombre: 'Azul 800', cmyk: null },
  { hex: '#0E225D', nombre: 'Azul navy', cmyk: [100, 91, 36, 27], principal: true },
]

export const GRISES: ColorMarca[] = [
  { hex: '#F4F6F7', nombre: 'Gris 50', cmyk: null },
  { hex: '#D9D9D9', nombre: 'Gris 100', cmyk: null },
  { hex: '#CAD2D7', nombre: 'Gris 200', cmyk: null },
  { hex: '#A4B1BC', nombre: 'Gris 300', cmyk: null },
  { hex: '#627485', nombre: 'Gris 400', cmyk: null },
  { hex: '#4F5B6B', nombre: 'Gris 500', cmyk: null },
  { hex: '#363B43', nombre: 'Gris 600', cmyk: null },
  { hex: '#21252B', nombre: 'Gris', cmyk: [82, 69, 55, 70], principal: true },
]

export const BLANCO: ColorMarca = { hex: '#FFFFFF', nombre: 'Blanco', cmyk: null, principal: true }

/** Para imprenta (Manual de marca, «Imprenta»). */
export const IMPRENTA = { nombre: 'Pantone Reflex Blue C', hex: '#002489' }

export function rgbDeHex(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

// ---------- Tipografías ----------

export type Tipografia = {
  nombre: string
  uso: string
  pesos: string
  /** Nota de licencia tal como se sabe de los archivos del paquete. */
  licencia: string
  /** null: no se puede redistribuir en esta copia (se pide a la Dirección de Comunicación). */
  descarga: { archivo: string; formato: string } | null
  /** Para ver la fuente en su tarjeta. */
  familia: string
}

export const TIPOGRAFIAS: Tipografia[] = [
  {
    nombre: 'Noka',
    uso: 'Titulares (headlines): estilo audaz y llamativo para la información más importante. En esta copia no se incluye (tiene licencia): los títulos usan Montserrat.',
    pesos: 'Bold · Extra Bold',
    licencia: 'Diseño de Blackletra.',
    descarga: null,
    familia: 'Noka',
  },
  {
    nombre: 'Prometo',
    uso: 'Tipografía principal del logo; también para los nombres de ministerios y direcciones y los textos cortos.',
    pesos: 'Medium · Bold · Extra Bold',
    licencia: 'Diseño de Dalton Maag. Tiene licencia: no se incluye en esta copia.',
    descarga: null,
    familia: 'Prometo',
  },
  {
    nombre: 'Montserrat',
    uso: 'Textos cortos y párrafos. Su diseño limpio y moderno asegura una lectura fácil. Es la de los textos y, en esta copia, también la de los títulos.',
    pesos: 'Regular · Medium · Bold',
    licencia: 'Libre: SIL Open Font License 1.1.',
    descarga: { archivo: `${BASE_MARCA}/tipografias/Montserrat.zip`, formato: 'ZIP · 18 variantes y la licencia' },
    familia: 'Montserrat',
  },
]

// ---------- Texturas, manual y guía ----------

export const TEXTURAS = {
  // `mini`: miniatura WebP para la rejilla (scripts/generar-miniaturas-web.py); `src` es la vista previa original.
  vistas: [1, 2, 3].map((n) => ({ n, src: `${BASE_MARCA}/texturas/vista-previa-${n}.png`, mini: `${BASE_MARCA}/miniaturas/texturas/vista-previa-${n}.webp` })),
  pdf: `${BASE_MARCA}/texturas/texturas.pdf`,
  editable: `${BASE_MARCA}/texturas/texturas-editable.ai`,
  /** Manual de marca: «Las tramas … se pueden utilizar cuando se hable específicamente de los pilares». */
  pilares: [
    { t: 'Ciudad', d: 'Calles · Edificios · Turismo' },
    { t: 'Naturaleza', d: 'Área verde · Limpieza · Plazas · Parques · Bienestar animal' },
    { t: 'Progreso', d: 'Área verde · Limpieza · Economía · Finanzas · Ejecutivo · Comunidad' },
  ],
}

export const MANUAL = { archivo: `${BASE_MARCA}/manual/manual-de-marca.pdf`, tam: '34 MB' }
export const GUIA_PDF = { archivo: `${BASE_MARCA}/manual/guia-rapida-uso-del-logo.pdf`, tam: '6 MB' }

// ---------- Plantillas ----------

export const FIRMA = { t: 'Firma digital', d: 'Archivo editable de Adobe Illustrator (.ai): solo se descarga, no tiene vista previa.', archivo: `${BASE_MARCA}/plantillas/firma/firma-digital-editable.ai`, formato: 'AI · 1,7 MB' }

export const VIDEOLLAMADA = {
  png: { archivo: `${BASE_MARCA}/plantillas/videollamada/fondo-videollamada-1.png`, mini: `${BASE_MARCA}/miniaturas/videollamada/fondo-videollamada-1.webp`, formato: 'PNG' },
  editable: { archivo: `${BASE_MARCA}/plantillas/wallpapers/wallpapers-editable.ai`, formato: 'AI · 3,4 MB' },
}

export const WALLPAPERS = Array.from({ length: 12 }, (_, i) => {
  const nn = String(i + 1).padStart(2, '0')
  return { n: i + 1, src: `${BASE_MARCA}/plantillas/wallpapers/wallpaper-${nn}.png`, mini: `${BASE_MARCA}/miniaturas/wallpapers/wallpaper-${nn}.webp` }
})

// ---------- Redes sociales oficiales ----------

export type Red = { red: 'Instagram' | 'Facebook' | 'TikTok' | 'YouTube'; h: string }
export type CuentaRedes = { cuenta: string; redes: Red[] }

/** Enlaces entregados por Comunicación (5-oct-2026). El YouTube de I★PTY está pendiente: no se muestra. */
export const REDES_OFICIALES: CuentaRedes[] = [
  {
    cuenta: 'Alcaldía de Panamá',
    redes: [
      { red: 'Instagram', h: 'https://www.instagram.com/alcaldiapanama/' },
      { red: 'Facebook', h: 'https://www.facebook.com/municipio.depanama/' },
      { red: 'TikTok', h: 'https://www.tiktok.com/@alcaldiapanama' },
      { red: 'YouTube', h: 'https://www.youtube.com/@panamadealcaldia' },
    ],
  },
  {
    cuenta: 'I★PTY',
    redes: [
      { red: 'Instagram', h: 'https://www.instagram.com/istarpty/' },
      { red: 'Facebook', h: 'https://www.facebook.com/p/I-STAR-PTY-61561149276309/' },
      { red: 'TikTok', h: 'https://www.tiktok.com/@istarpty' },
    ],
  },
  { cuenta: 'Casa de la Municipalidad', redes: [{ red: 'Instagram', h: 'https://www.instagram.com/casadelamunicipalidad/' }] },
  { cuenta: 'Policía Municipal', redes: [{ red: 'Instagram', h: 'https://www.instagram.com/policiamunicipal_pty' }] },
  { cuenta: 'Cochinos PTY', redes: [{ red: 'Instagram', h: 'https://www.instagram.com/cochinospty_/' }] },
]

// ---------- Lo que falta (se muestra en la página como «Pendiente de Comunicación» y se lista en el informe) ----------

export const FALTA_DE_COMUNICACION = [
  'CMYK de los demás colores de la paleta (solo vienen el azul institucional, el navy y el gris) y confirmar el código del azul brillante.',
  'Medida mínima del logo (la guía solo la muestra con ejemplos) y su zona de respeto.',
  'La versión a color del escudo (sale en el manual, no en los archivos) y el PDF del logo azul sobre blanco horizontal.',
  'Un escudo solo (para el ícono de la pestaña) y los archivos del logo I★PTY, además de su YouTube.',
  'La firma en otro formato además del .ai, y la plantilla de presentación.',
] as const
