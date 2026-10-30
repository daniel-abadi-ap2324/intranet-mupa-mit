/// <reference types="vite/client" />
/**
 * Edición de la intranet. "publicacion" es la versión publicada: sin las funciones
 * que todavía nadie alimenta (Comunicación y el Gestor de Solicitudes aún no las
 * usan). "completa" es todo (desarrollo y pruebas). El código de lo apagado queda
 * intacto: se reactiva sacándolo de APAGADAS_EN_PUBLICACION.
 *
 * Se elige al compilar (VITE_EDICION); la imagen de Docker usa "publicacion". Tiene
 * que coincidir con EDICION de la API, que en esa edición no monta sus rutas.
 */
export type Funcion = 'anuncios' | 'noticias' | 'boletines' | 'videos' | 'gestionInicio' | 'formularios' | 'bandeja' | 'solicitudes' | 'proximamente' | 'recursosHumanos'

export const EDICION: 'completa' | 'publicacion' = import.meta.env.VITE_EDICION === 'publicacion' ? 'publicacion' : 'completa'

// Los boletines sí van: la intranet actual los publica y sus PDF ya están en el sitio. Las noticias también
// (decisión de Daniel, 27-oct-2026): llegan solas de mupa.gob.pa con la sincronización.
// Copia para la VM (rama vm/publicacion): se apaga también todo lo que se llena y se guarda DENTRO de la intranet
// (formularios internos, su constructor, el envío de solicitudes, la bandeja de gestión, la campana y los avisos en vivo)
// y los «Trámites» de Recursos Humanos sin sistema. Lo que abre otra página o sistema externo se queda.
// `proximamente`: las filas «Próximamente» / «Pendiente de…» (sin enlace ni contenido) de Recursos Humanos, Documentos e Identidad visual.
// `solicitudes` es solo «Mis solicitudes»: citas de la Clínica, códigos de llamada y tickets de la Mesa de Ayuda (sistemas reales).
// `recursosHumanos`: la página de Recursos Humanos (29-oct-2026, decisión de Daniel: se avisó que en RRHH Express se veían
// datos de otras personas). Se quita hasta revisarlo; la API además tiene RRHH_MANTENIMIENTO.
// Cómo reactivar cada cosa: sacarla de APAGADAS_EN_PUBLICACION.
const APAGADAS_EN_PUBLICACION: Funcion[] = ['anuncios', 'videos', 'gestionInicio', 'formularios', 'bandeja', 'proximamente', 'recursosHumanos']

const APAGADAS = new Set<Funcion>(EDICION === 'publicacion' ? APAGADAS_EN_PUBLICACION : [])

export const activa = (f: Funcion) => !APAGADAS.has(f)

/** Rutas de cada función (y todo lo que cuelga de ellas). */
const RUTAS: Record<Funcion, string[]> = {
  anuncios: ['/gestion/anuncios'],
  noticias: ['/noticias', '/gestion/noticias'],
  boletines: ['/boletines', '/gestion/boletines'],
  videos: ['/videos', '/gestion/videos'],
  gestionInicio: ['/gestion/inicio'],
  // `/mis-solicitudes/*` (con su número) es el detalle de una solicitud interna; la lista «Mis solicitudes» sigue.
  formularios: ['/formularios', '/gestion/formularios', '/mis-solicitudes/*'],
  bandeja: ['/gestion/solicitudes'],
  proximamente: [],
  solicitudes: [],
  recursosHumanos: ['/recursos-humanos'],
}

const RUTAS_APAGADAS = [...APAGADAS].flatMap((f) => RUTAS[f])

/** ¿Se puede enlazar a esta dirección? Las externas y los PDF siempre; las internas, si su función está activa. */
export function rutaVisible(h: string | null | undefined): boolean {
  if (!h || !h.startsWith('/') || h.startsWith('//')) return true
  const ruta = h.split(/[?#]/)[0].replace(/\/+$/, '') || '/'
  return !RUTAS_APAGADAS.some((r) => (r.endsWith('/*') ? ruta.startsWith(r.slice(0, -1)) : ruta === r || ruta.startsWith(r + '/')))
}
