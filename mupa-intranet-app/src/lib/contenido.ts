/**
 * Boletines, noticias y videos: los publica Comunicación desde /gestion/… y
 * vienen de la API (/api/bulletins, /api/news, /api/videos).
 */

/** "Alcaldía al día". pdf null = no hay PDF (no se pudo migrar). portada: la página 1 del PDF (solo los traídos de mupa.gob.pa). */
export type Boletin = {
  id: number
  fecha: string
  pdf: string | null
  flipbook: string | null
  portada: string | null
  nota: string
  /** Descripción corta: los titulares del boletín, sacados de su PDF. Null si no se pudo. */
  resumen: string | null
  /** Palabras clave, de la más a la menos importante. */
  palabras: string[]
}

export type TipoNoticia = 'noticia' | 'tip'
/** meta: el resumen (en las antiguas, "Imagen" o "Carrusel de 5 imágenes"). */
export type Noticia = {
  id: number
  fecha: string
  t: string
  tipo: TipoNoticia
  meta: string | null
  /** A dónde lleva: su página de lectura (/noticias/ID) si tiene texto; si no, su enlace. */
  h: string | null
  img: string | null
  /** El enlace original (p. ej. la noticia en mupa.gob.pa). */
  fuente?: string | null
}
/** Una noticia para leerla: además, su texto (párrafos separados por una línea en blanco). */
export type NoticiaLectura = Noticia & { cuerpo: string }

export type CategoriaVideo = 'instructivo' | 'canal' | 'otro'
export type Video = { id: number; t: string; h: string; meta: string; categoria: CategoriaVideo; fecha: string | null }

/** Lo que ve Comunicación en su panel: además, si está publicado y quién lo editó. */
type Edicion = { publicado: boolean; editado: string; editadoPor: string | null }
export type BoletinGestion = Boletin & Edicion
export type NoticiaGestion = Noticia & Edicion
export type VideoGestion = Video & Edicion

export const TIPOS_NOTICIA: { v: TipoNoticia; t: string }[] = [
  { v: 'noticia', t: 'Noticia' },
  { v: 'tip', t: 'Consejo (tip)' },
]

export const CATEGORIAS_VIDEO: { v: CategoriaVideo; t: string }[] = [
  { v: 'instructivo', t: 'Instructivo' },
  { v: 'canal', t: 'Canal de YouTube' },
  { v: 'otro', t: 'Otro' },
]

/** Canal oficial de YouTube de la Alcaldía. */
export const CANAL_YOUTUBE = 'https://www.youtube.com/@municipiodepanama/videos'
