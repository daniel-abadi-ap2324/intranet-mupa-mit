/**
 * Menú de la intranet, 2 niveles: las 6 pestañas del rediseño y la Clínica Municipal,
 * que es un destino propio aunque en la Alcaldía dependa de RRHH. El soporte técnico
 * (Mesa de Servicios, sus formularios y Soporte ISTMO) se abre desde Aplicaciones.
 */
import type { NombreIcono } from '../components/gestion/Iconos'
import { activa, rutaVisible } from './edicion'
import { ATIENDEN_SOLICITUDES, GESTORES } from './gestion'
import { tieneRol, type Rol } from './roles'

// Los PDF ya están migrados a local (public/sitio/), como las imágenes.
const UP = '/sitio/'
/**
 * Sistema de citas de la Clínica Municipal (externo; desde sep-2026 en clinica.mupa.gob.pa):
 * ahí se pide cita y se solicitan medicamentos crónicos.
 */
export const URL_CITAS = 'https://clinica.mupa.gob.pa/formulario'
/** Instructivo del sistema de citas de la Clínica (PDF copiado del sitio anterior). */
export const INSTRUCTIVO_CLINICA = UP + '2023/03/Instructivo-del-sistema-de-clinica-del-Municipio-de-Panama-vf3.pdf'

export type ItemMenu = {
  id: string
  t: string
  h: string
  g?: string
  k?: string
  ext?: boolean
  pdf?: boolean
  kind?: string
  aside?: boolean
  tag?: string
  title?: string
  /** Contador junto al nombre (boletines nuevos). */
  badge?: 'boletines'
  children?: ItemMenu[]
}

/** Sin lo que esta edición apaga (lib/edicion.ts): ni el ítem ni sus hijos. */
function visibles<T extends ItemMenu>(items: T[]): T[] {
  return items.filter((it) => rutaVisible(it.h)).map((it) => (it.children ? { ...it, children: visibles(it.children) } : it))
}

export const MENU: ItemMenu[] = visibles([
  { id: 'inicio', g: '▦', t: 'Inicio', h: '/', k: 'portada home' },
  { id: 'asistente', g: '✦', t: 'Asistente', h: '/asistente', k: 'asistente ayuda preguntar chat ia inteligencia artificial buscar donde' },
  { id: 'aplicaciones', g: '▧', t: 'Aplicaciones', h: '/aplicaciones', k: 'sistemas servicios lanzadera catalogo' },
  { id: 'directorio', g: '◉', t: 'Directorio', h: '/directorio', k: 'extension extensiones telefono telefonos personas unidades organigrama contactos central telefonica' },
  {
    id: 'documentos', g: '▤', t: 'Documentos', h: '/documentos', badge: activa('boletines') ? 'boletines' : undefined, k: 'pdf manuales reglamentos' + (activa('boletines') ? ' boletines videos' : ''),
    children: [
      { id: 'manuales', t: 'Manuales', h: '/manuales', k: 'digeca' },
      { id: 'boletines', t: 'Boletines · Alcaldía al día', h: '/boletines', badge: 'boletines', k: 'boletin informativo diario' },
      { id: 'videos', t: 'Videos', h: '/videos', k: 'instructivos youtube usuario de maquina' },
      { id: 'reglamento', t: 'Reglamento Interno', h: UP + '2020/06/Reglamento-Interno-de-Personal-Decreto-024-2019.pdf', ext: true, pdf: true, k: 'decreto 024-2019 personal' },
      { id: 'etica', t: 'Código de Ética', h: UP + '2023/01/CODIGO-DE-ETICA01.pdf', ext: true, pdf: true },
    ],
  },
  { id: 'noticias', g: '◫', t: 'Noticias', h: '/noticias', k: 'comunicados institucional' },
  { id: 'marca', g: '✎', t: 'Identidad visual', h: '/comunicacion', k: 'identidad visual comunicacion marca logo logos colores paleta tipografias plantillas firma correo fondos videollamada wallpapers redes sociales manual de marca guia del logo' },
  {
    id: 'rrhh', g: '▣', t: 'Recursos Humanos', h: '/recursos-humanos', k: 'rrhh rrhh express talento planilla nomina vacaciones tramites personal carta de trabajo certificacion laboral permiso comprobante de pago comprobantes talonario marcacion marcaciones tiempo compensatorio expediente',
  },
  {
    id: 'clinica', g: '✚', t: 'Clínica Municipal', h: '/clinica', kind: 'Clínica', k: 'salud medico medicina doctor odontologia psicologia cita recetas',
    children: [
      { id: 'cita', t: 'Agendar cita médica', h: URL_CITAS, ext: true, kind: 'Clínica', k: 'clinica doctor medico' },
      { id: 'recetas', t: 'Solicitar recetas', h: '/clinica-recetas', kind: 'Clínica', k: 'clinica cronicos medicamentos' },
      { id: 'medicamentos', t: 'Medicamentos', h: '/clinica-medicamentos', kind: 'Clínica', k: 'clinica farmacia listado' },
      { id: 'instructivo-clinica', t: 'Instructivo del sistema de la Clínica', h: INSTRUCTIVO_CLINICA, ext: true, pdf: true, kind: 'Clínica', k: 'clinica manual guia citas' },
    ],
  },
])

export const PIE_MENU: ItemMenu[] = [
  { id: 'config', g: '⚙', t: 'Configuración', h: '/configuracion' },
]

/**
 * Pantallas de gestión: solo las ve quien tiene uno de esos roles (no entran al
 * buscador de todos). El menú lateral solo lleva el Centro de Gestión; las demás
 * se abren desde su barra «Paneles de gestión». El backend es el que protege.
 */
// Un grupo sin pantallas en esta edición no se muestra (gestionDe filtra los vacíos).
export const GRUPOS_GESTION = ['General', 'Contenido', 'Solicitudes', 'Administración'] as const
export type GrupoGestion = (typeof GRUPOS_GESTION)[number]
export type ItemGestion = ItemMenu & { roles: Rol[]; grupo: GrupoGestion; d: string; icono: NombreIcono }

export const MENU_GESTION: ItemGestion[] = visibles([
  { id: 'gestion-centro', icono: 'panel', g: '◧', t: 'Centro de Gestión', h: '/gestion', roles: GESTORES, grupo: 'General', d: activa('bandeja') ? 'Cifras de todas las áreas y la bandeja para responder' : 'Cifras de las áreas a tu cargo', k: 'panel kpi indicadores resumen' },
  { id: 'gestion-anuncios', icono: 'megafono', g: '◔', t: 'Anuncios', h: '/gestion/anuncios', roles: ['admin', 'comunicacion'], grupo: 'Contenido', d: 'Publicar, editar y retirar los anuncios del Inicio' },
  { id: 'gestion-noticias', icono: 'noticia', g: '◫', t: 'Noticias', h: '/gestion/noticias', roles: ['admin', 'comunicacion'], grupo: 'Contenido', d: 'Noticias y consejos de la intranet' },
  { id: 'gestion-boletines', icono: 'documento', g: '▤', t: 'Boletines', h: '/gestion/boletines', roles: ['admin', 'comunicacion'], grupo: 'Contenido', d: 'Boletines «Alcaldía al día» con su PDF' },
  { id: 'gestion-videos', icono: 'video', g: '▶', t: 'Videos', h: '/gestion/videos', roles: ['admin', 'comunicacion'], grupo: 'Contenido', d: 'Instructivos y videos del canal' },
  { id: 'gestion-inicio', icono: 'inicio', g: '▦', t: 'Contenido del Inicio', h: '/gestion/inicio', roles: ['admin', 'comunicacion'], grupo: 'Contenido', d: 'Enlaces, trámites frecuentes y campañas' },
  { id: 'gestion-marca', icono: 'documento', g: '✎', t: 'Página de marca', h: '/comunicacion', roles: ['admin', 'comunicacion'], grupo: 'Contenido', d: 'Ver Identidad visual: logos, paleta, plantillas y guías' },
  { id: 'gestion-solicitudes', icono: 'bandeja', g: '▥', t: 'Solicitudes', h: '/gestion/solicitudes', roles: ATIENDEN_SOLICITUDES, grupo: 'Solicitudes', d: 'Atender las solicitudes: estado y respuestas' },
  { id: 'gestion-formularios', icono: 'formulario', g: '▤', t: 'Formularios', h: '/gestion/formularios', roles: ['admin', 'gestorSolicitudes'], grupo: 'Solicitudes', d: 'Crear y editar formularios; prender el envío real' },
  { id: 'gestion-usuarios', icono: 'personas', g: '◍', t: 'Usuarios', h: '/gestion/usuarios', roles: ['admin'], grupo: 'Administración', d: 'Personas y su departamento' },
  { id: 'gestion-departamentos', icono: 'edificio', g: '▤', t: 'Departamentos', h: '/gestion/departamentos', roles: ['admin'], grupo: 'Administración', d: 'Direcciones de la Alcaldía' },
  { id: 'gestion-aplicaciones', icono: 'apps', g: '▧', t: 'Catálogo de aplicaciones', h: '/gestion/aplicaciones', roles: ['admin'], grupo: 'Administración', d: 'Aplicaciones y qué departamentos las ven' },
])

/** Pantallas de gestión de esta persona, por grupo (vacío si no tiene rol de gestión). */
export function gestionDe(user: { roles?: string[] | null } | null | undefined): { grupo: GrupoGestion; items: ItemGestion[] }[] {
  return GRUPOS_GESTION.map((grupo) => ({ grupo, items: MENU_GESTION.filter((it) => it.grupo === grupo && tieneRol(user, ...it.roles)) })).filter((g) => g.items.length)
}

/** Solo con la sesión iniciada: va en el menú principal, después de los destinos. */
export const MENU_SESION: ItemMenu[] = visibles([{ id: 'mis-solicitudes', g: '▥', t: 'Mis solicitudes', h: '/mis-solicitudes', k: 'solicitudes tickets estado folio' }])

/** Barra inferior (<768px): 4 destinos + "Más". */
export const INFERIOR = ['inicio', 'aplicaciones', 'directorio', 'documentos']

/** Páginas fuera del menú que se abren desde Aplicaciones (el soporte técnico). */
const DE_APLICACIONES = ['/mesa-servicios', '/sap-istmo', '/formularios']

/**
 * Id del ítem del menú que corresponde a la página actual (uno solo): primero
 * el que coincide exacto (/formularios/carta-de-trabajo → "Carta de trabajo"); si
 * no, el de la ruta más larga que la contiene; si no, Aplicaciones para el soporte.
 */
export function idActual(ruta: string): string | null {
  const r = ruta.replace(/\/+$/, '') || '/'
  const items = [...MENU.flatMap((m) => [m, ...(m.children || [])]), ...MENU_SESION, ...PIE_MENU, ...MENU_GESTION].filter((it) => it.h.startsWith('/'))
  const exacto = items.find((it) => it.h === r)
  if (exacto) return exacto.id
  let mejor: ItemMenu | null = null
  for (const it of items) if (it.h !== '/' && r.startsWith(it.h + '/') && (!mejor || it.h.length > mejor.h.length)) mejor = it
  if (mejor) return mejor.id
  return DE_APLICACIONES.some((h) => r === h || r.startsWith(h + '/')) ? 'aplicaciones' : null
}

/** ¿El ítem (o, en un grupo, alguno de sus hijos) es la página actual? */
export function contieneActual(it: ItemMenu, actual: string | null): boolean {
  return !!actual && (it.id === actual || !!it.children?.some((c) => c.id === actual))
}
