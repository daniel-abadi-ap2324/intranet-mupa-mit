/**
 * Único lugar donde la SPA habla con el backend (mupa-intranet-api). Todo va
 * bajo /api, mismo origen: en producción nginx lo reenvía al backend; en
 * desarrollo lo reenvía Vite (API_URL, por defecto http://localhost:3000).
 * El contrato de cada ruta está en ../mupa-intranet-api/README.md.
 */
import type { Anuncio, AnuncioGestion, DatosAnuncio } from './lib/anuncios'
import { ESTADO_TEXTO, type App } from './lib/catalogo'
import { rutaVisible } from './lib/edicion'
import type { InfoClinica, MisCitas } from './lib/clinica'
import type { MisCodigos } from './lib/codigosLlamada'
import type { DirectorioApi } from './lib/directorio'
import type { MisTickets } from './lib/glpi'
import type { Boletin, BoletinGestion, CategoriaVideo, Noticia, NoticiaGestion, NoticiaLectura, TipoNoticia, Video, VideoGestion } from './lib/contenido'
import type { Estado, Formulario, Seccion } from './lib/formularios'
import type { PanelGestion } from './lib/gestion'
import type {
  Bolsa,
  Compensatorio,
  Comprobante,
  ConexionRrhh,
  DetalleComprobante,
  DiaReclamable,
  Expediente,
  MarcacionesMes,
  PaginaComprobantes,
  ResumenAnual,
} from './lib/rrhh'
import type { EstadoSolicitud, SolicitudDetalle, SolicitudGestion, SolicitudMia } from './lib/solicitudes'
import { esExterna } from './lib/url'

export type Usuario = {
  id: number
  corto: string
  nombre: string
  correo: string
  /** null = no se sabe (cuentas de prueba): no se le pide confirmar. */
  correoVerificado: boolean | null
  iniciales: string
  roles: string[]
  /** Lo asigna administración; null = sin departamento. */
  departamentoId: number | null
  /** Ya vio (o saltó) el recorrido para usuarios nuevos. */
  recorridoVisto: boolean
}

// email puede ser null: cuentas de Identity Central sin correo.
type UsuarioApi = {
  id: number
  email: string | null
  emailVerified?: boolean | null
  firstName: string
  lastName: string | null
  roles: string[]
  departmentId: number | null
  tourSeenAt?: string | null
}

/** Lo que pide /registro. La cédula va a Identity Central; la intranet no la guarda. */
export type DatosRegistro = {
  cedula: string
  nombre: string
  apellido: string
  clave: string
  correo: string
  celular: string
  telefono: string
  cargo: string
}
/** Campo del backend → campo del formulario de registro (para mostrar cada error en su lugar). */
export const CAMPOS_REGISTRO: Record<string, keyof DatosRegistro> = {
  identityNumber: 'cedula',
  firstName: 'nombre',
  lastName: 'apellido',
  password: 'clave',
  email: 'correo',
  mobile: 'celular',
  phone: 'telefono',
  jobTitle: 'cargo',
}

type AplicacionApi = {
  id: number
  slug: string
  name: string
  description: string
  url: string | null
  area: string
  icon: string
  tags: { id: number; name: string; audience: boolean }[]
  access: string
  status: string
  external: boolean
  pdf: boolean
  featured: boolean
  confirmed: boolean
  keywords: string
  origin: string
  published: boolean
  /** Solo para administración. */
  note?: string
  departments?: { id: number; name: string }[]
}

/** Contenido editable del Inicio (noticias, enlaces…; los anuncios van aparte). Lo arma bloques.tsx. */
export type ContenidoInicio = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

// Anuncio tal como lo devuelve el backend (GET /announcements; /manage agrega el estado y la última edición).
type AnuncioApi = { id: number; title: string; body: string | null; level: string; link: string | null; publishFrom: string; publishUntil: string | null }
type AnuncioGestionApi = AnuncioApi & { status: string; state: string; updatedAt: string; updatedByName: string | null }

// Boletines, noticias y videos tal como los devuelve el backend (/manage agrega la edición).
type EdicionApi = { published?: boolean; status?: string; updatedAt: string; updatedByName: string | null }
type BoletinApi = { id: number; date: string; pdfUrl: string | null; flipbookUrl: string | null; coverUrl: string | null; note: string; summary: string | null; keywords: string[] }
type NoticiaApi = { id: number; title: string; summary: string | null; type: string; date: string; link: string | null; imageUrl: string | null; hasBody?: boolean }
type VideoApi = { id: number; title: string; url: string; category: string; description: string; date: string | null }
/** Una pasada de la sincronización con mupa.gob.pa (lo que devuelve /wordpress-sync). */
export type SeccionSincronizacion = { nuevos: number; omitidos: number; avisos: string[]; errores: string[] }
export type ResultadoSincronizacion = { startedAt: string; finishedAt: string; noticias: SeccionSincronizacion | null; boletines: SeccionSincronizacion }
export type EstadoSincronizacion = { enabled: boolean; running: boolean; intervalMinutes: number; windowDays: number; last: ResultadoSincronizacion | null }
/** Lo que se envía al crear o editar (nombres del backend). */
export type DatosBoletin = { date?: string; pdfUrl?: string | null; flipbookUrl?: string | null; note?: string; published?: boolean }
export type DatosNoticia = { title?: string; summary?: string | null; type?: TipoNoticia; date?: string; link?: string | null; imageUrl?: string | null; status?: 'borrador' | 'publicado' }
export type DatosVideo = { title?: string; url?: string; category?: CategoriaVideo; description?: string; date?: string | null; published?: boolean }
/** Un archivo subido: `url` es la dirección para usar en un boletín o una noticia. */
export type ArchivoSubido = { id: number; url: string; originalName: string; mimeType: string; size: number }
export type SeccionInicio = 'intro' | 'frecuentes' | 'campanas' | 'enlaces'

// Solicitudes tal como las devuelve el backend.
type SolicitudApi = { id: number; folio: string; formTitle: string; formArea: string; status: string; createdAt: string; updatedAt: string }
type SolicitudMiaApi = SolicitudApi & { unread: boolean }
type SolicitudGestionApi = SolicitudApi & { ownerName: string; ownerEmail: string | null; ownerDepartment: string | null }
type SolicitudDetalleApi = SolicitudGestionApi & {
  summary: SolicitudDetalle['resumen']
  events: { id: number; type: string; status: string | null; body: string | null; authorName: string | null; fromStaff: boolean; createdAt: string }[]
}

// Formularios tal como los devuelve el backend (/manage agrega id, publicado y la edición).
type FormularioApi = { slug: string; number: number; title: string; area: string; destination: string; deadline: string | null; intro: string; notes: string[]; changes: string[]; sections: Seccion[]; accepting: boolean; pendingDefinition: boolean }
type FormularioGestionApi = FormularioApi & { id: number; published: boolean; updatedAt: string; updatedByName: string | null; requests: number }
export type FormularioGestion = Formulario & { dbId: number; publicado: boolean; editado: string; editadoPor: string | null; requests: number }
/** Lo que se envía al crear o editar un formulario (nombres del backend). */
export type DatosFormulario = Partial<Omit<FormularioApi, 'slug'>> & { published?: boolean }

// ---------- Administración (tal como las devuelve el backend) ----------
export type AppGestion = AplicacionApi
/** Cifras de la franja de gestión del Inicio (solo vienen las de los roles de la persona). */
export type Resumen = { usersWithoutDepartment?: number; activeAnnouncements?: number; draftAnnouncements?: number; newRequests?: number; unreadRequests?: number }
/** Aviso en vivo de una solicitud nueva (llega por /api/notifications/stream). */
export type NotificacionSolicitud = { id: number; folio: string; formulario: string; area: string; solicitante: string; fecha: string }
export type Etiqueta = { id: number; name: string; audience: boolean }
export type Departamento = { id: number; name: string; users: number; applications: number }
export type PersonaGestion = {
  id: number
  email: string | null
  firstName: string
  lastName: string | null
  roles: string[]
  departmentId: number | null
  departmentName: string | null
  /** identity = login de la Alcaldía; local = cuenta ficticia de prueba. */
  source: 'identity' | 'local'
  lastLoginAt: string | null
  /** Cuándo se suspendió; null = activa. */
  suspendedAt: string | null
  createdAt: string
}
/** Lo que dice RH Link de la cédula de la persona (se consulta al abrir la ficha; no se guarda). */
export type RrhhFicha =
  | { status: 'unconfigured' | 'no-cedula' | 'not-found' | 'error' }
  | { status: 'found'; active: boolean; fullName: string | null; locationCode: number | null; locationDepartment: string | null }
/** La ficha completa de una persona (solo administración): todo menos la contraseña. */
export type FichaPersona = PersonaGestion & {
  emailVerified: boolean | null
  cedula: string | null
  identitySub: string | null
  phone: string | null
  jobTitle: string | null
  tourSeenAt: string | null
  failedLoginAttempts: number
  lockedUntil: string | null
  updatedAt: string
  activeSessions: number
  requests: number
  openRequests: number
  rrhh: RrhhFicha
}
/** Un contenido concreto al que lleva el asistente. */
export type ItemAsistente = { kind: 'boletin' | 'noticia' | 'formulario'; title: string; path: string; meta: string | null }
/** Lo que se envía al crear o editar una aplicación (mismos nombres que el backend). */
export type DatosApp = Partial<Omit<AplicacionApi, 'id' | 'slug' | 'tags' | 'departments' | 'origin'>> & { tagIds?: number[]; departmentIds?: number[] }

/** Campo inválido según el backend (errores 400 VALIDATION_ERROR). */
export type CampoInvalido = { field: string; message: string }

/** Error del backend: { error: CODIGO, message, fields? } */
export class ErrorApi extends Error {
  estado: number
  codigo: string
  campos: CampoInvalido[]
  constructor(estado: number, codigo: string, mensaje: string, campos: CampoInvalido[] = []) {
    super(mensaje)
    this.estado = estado
    this.codigo = codigo
    this.campos = campos
  }
}

const SESION_PERDIDA = new Set(['AUTHENTICATION_REQUIRED', 'SESSION_EXPIRED'])
let alPerder: (() => void) | null = null

/** Lo registra ProveedorDatos: si cualquier llamada responde que la sesión ya no vale, la web deja de mostrarse con sesión. */
export function alPerderSesion(fn: (() => void) | null) {
  alPerder = fn
}

async function pedir<T>(ruta: string, opciones: { metodo?: string; datos?: unknown; archivo?: File } = {}): Promise<T> {
  const { archivo } = opciones
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (archivo) Object.assign(headers, { 'Content-Type': 'application/octet-stream', 'X-File-Name': encodeURIComponent(archivo.name) })
  else if (opciones.datos !== undefined) headers['Content-Type'] = 'application/json'
  const r = await fetch('/api' + ruta, {
    method: opciones.metodo || 'GET',
    credentials: 'include',
    headers,
    body: archivo ?? (opciones.datos === undefined ? undefined : JSON.stringify(opciones.datos)),
  })
  if (!r.ok) {
    const e = (await r.json().catch(() => null)) as { error?: string; message?: string; fields?: CampoInvalido[] } | null
    // Sin JSON (un 502 de nginx, un corte): un mensaje para la persona, nunca "POST /api/…: HTTP 502".
    const error = new ErrorApi(r.status, e?.error || 'HTTP_' + r.status, e?.message || 'No se pudo conectar con la intranet. Inténtalo de nuevo en unos minutos.', Array.isArray(e?.fields) ? e.fields : [])
    // Las rutas /auth/ son para entrar y salir: su 401 no significa que la sesión se perdió a medio uso.
    if (r.status === 401 && SESION_PERDIDA.has(error.codigo) && !ruta.startsWith('/auth/')) alPerder?.()
    throw error
  }
  return (r.status === 204 ? null : await r.json()) as T
}

function aUsuario(u: UsuarioApi): Usuario {
  const nombre = [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email || 'Usuario'
  const iniciales = (nombre.split(/\s+/).map((p) => p[0]).join('').slice(0, 2) || 'U').toUpperCase()
  return {
    id: u.id,
    corto: u.firstName || nombre,
    nombre,
    correo: u.email ?? '',
    correoVerificado: u.emailVerified ?? null,
    iniciales,
    roles: u.roles,
    departamentoId: u.departmentId ?? null,
    recorridoVisto: !!u.tourSeenAt,
  }
}

function aApp(a: AplicacionApi): App {
  const o: App = {
    id: a.slug,
    name: a.name,
    desc: a.description,
    cat: a.area,
    g: a.icon || '▦',
    h: a.url,
    tags: a.tags.map((t) => t.name),
    k: [a.keywords, a.area].filter(Boolean).join(' '),
    confirmado: a.confirmed,
    origen: a.origin || undefined,
  }
  if (a.external && a.url && esExterna(a.url)) o.ext = true
  if (a.pdf) o.pdf = true
  if (a.status && ESTADO_TEXTO[a.status]) o.status = ESTADO_TEXTO[a.status]
  if (a.access === 'sesion') o.acceso = 'sesion'
  if (a.featured) o.destacada = true
  return o
}

function aAnuncio(a: AnuncioApi): Anuncio {
  return { id: a.id, titulo: a.title, detalle: a.body, nivel: a.level as Anuncio['nivel'], enlace: a.link, desde: a.publishFrom, hasta: a.publishUntil }
}

const aBoletin = (b: BoletinApi): Boletin => ({ id: b.id, fecha: b.date, pdf: b.pdfUrl, flipbook: b.flipbookUrl, portada: b.coverUrl, nota: b.note, resumen: b.summary, palabras: b.keywords })
const aNoticia = (n: NoticiaApi): Noticia => ({ id: n.id, fecha: n.date, t: n.title, tipo: n.type as TipoNoticia, meta: n.summary, h: n.hasBody ? '/noticias/' + n.id : n.link, fuente: n.link, img: n.imageUrl })
const aVideo = (v: VideoApi): Video => ({ id: v.id, t: v.title, h: v.url, meta: v.description, categoria: v.category as CategoriaVideo, fecha: v.date })
const aFormulario = (f: FormularioApi): Formulario => ({
  slug: f.slug,
  id: f.number,
  area: f.area,
  destino: f.destination,
  plazo: f.deadline,
  title: f.title,
  intro: f.intro,
  notes: f.notes,
  cambios: f.changes,
  sections: f.sections,
  recibe: f.accepting,
  aDefinir: f.pendingDefinition,
})
const aFormularioGestion = (f: FormularioGestionApi): FormularioGestion => ({ ...aFormulario(f), dbId: f.id, publicado: f.published, editado: f.updatedAt, editadoPor: f.updatedByName, requests: f.requests })
const aSolicitud = (x: SolicitudApi) => ({ id: x.id, folio: x.folio, formulario: x.formTitle, area: x.formArea, estado: x.status as EstadoSolicitud, creada: x.createdAt, actualizada: x.updatedAt })
const aSolicitudGestion = (x: SolicitudGestionApi): SolicitudGestion => ({ ...aSolicitud(x), persona: x.ownerName, correo: x.ownerEmail, departamento: x.ownerDepartment })
const aSolicitudDetalle = (x: SolicitudDetalleApi): SolicitudDetalle => ({
  ...aSolicitudGestion(x),
  resumen: x.summary,
  eventos: x.events.map((e) => ({ id: e.id, tipo: e.type as SolicitudDetalle['eventos'][number]['tipo'], estado: e.status, texto: e.body, autor: e.authorName, delGestor: e.fromStaff, fecha: e.createdAt })),
})
const edicion = (e: EdicionApi) => ({ publicado: e.published ?? e.status === 'publicado', editado: e.updatedAt, editadoPor: e.updatedByName })

function aAnuncioGestion(a: AnuncioGestionApi): AnuncioGestion {
  return { ...aAnuncio(a), publicacion: a.status as AnuncioGestion['publicacion'], estado: a.state as AnuncioGestion['estado'], editado: a.updatedAt, editadoPor: a.updatedByName }
}

/** Solo se mandan los campos que llegan (en un PATCH, lo que cambia). */
function anuncioApi(d: Partial<DatosAnuncio>) {
  const o: Record<string, unknown> = {}
  if (d.titulo !== undefined) o.title = d.titulo
  if (d.detalle !== undefined) o.body = d.detalle
  if (d.nivel !== undefined) o.level = d.nivel
  if (d.enlace !== undefined) o.link = d.enlace
  if (d.desde !== undefined) o.publishFrom = d.desde
  if (d.hasta !== undefined) o.publishUntil = d.hasta
  if (d.publicacion !== undefined) o.status = d.publicacion
  return o
}

type ClinicaApi = {
  services: { id: number; name: string; description: string | null }[]
  specialties: { id: number; name: string; description: string | null }[]
  closedWeekdays: number[]
  bookingWindow: { minDays: number; maxDays: number }
  source: 'clinic' | 'fallback'
  updatedAt: string
}

export const api = {
  /** Persona con la sesión iniciada, o null. */
  async sesion(): Promise<Usuario | null> {
    const u = await pedir<UsuarioApi | null>('/auth/session')
    return u ? aUsuario(u) : null
  },

  /** Usuario de Identity Central (o, en desarrollo, el correo de una cuenta ficticia). El backend guarda los tokens: aquí solo llega la cuenta. */
  async entrar(usuario: string, clave: string): Promise<Usuario> {
    return aUsuario(await pedir<UsuarioApi>('/auth/login', { metodo: 'POST', datos: { username: usuario, password: clave } }))
  },

  async salir(): Promise<void> {
    await pedir('/auth/logout', { metodo: 'POST' })
  },

  /** Crea la cuenta en Identity Central y deja la sesión iniciada. Los opcionales vacíos no se mandan. */
  async registrar(d: DatosRegistro): Promise<Usuario> {
    const texto = (v: string) => v.trim() || undefined
    const datos = {
      identityNumber: d.cedula.trim(),
      // Sin nombre: la API lo toma de Recursos Humanos.
      firstName: texto(d.nombre),
      lastName: texto(d.apellido),
      password: d.clave,
      email: texto(d.correo),
      mobile: texto(d.celular),
      phone: texto(d.telefono),
      jobTitle: texto(d.cargo),
    }
    return aUsuario(await pedir<UsuarioApi>('/auth/register', { metodo: 'POST', datos }))
  },

  /** Departamentos para elegir el propio al registrarse (solo id y nombre). */
  async opcionesDepartamento(): Promise<{ id: number; nombre: string }[]> {
    const lista = await pedir<{ id: number; name: string }[]>('/departments/options')
    return lista.map((d) => ({ id: d.id, nombre: d.name }))
  },

  /** La persona sin departamento elige el suyo (obligatorio al entrar; después solo administración lo cambia). */
  async elegirDepartamento(departamentoId: number): Promise<void> {
    await pedir('/me/department', { metodo: 'PUT', datos: { departmentId: departamentoId } })
  },

  /** Identity Central manda un código al correo de la cuenta. */
  async pedirCodigoCorreo(): Promise<{ correoOculto: string | null; minutos: number | null }> {
    const r = await pedir<{ maskedEmail: string | null; expiresInMinutes: number | null }>('/me/email/code', { metodo: 'POST' })
    return { correoOculto: r.maskedEmail, minutos: r.expiresInMinutes }
  },

  async verificarCorreo(codigo: string): Promise<Usuario> {
    return aUsuario(await pedir<UsuarioApi>('/me/email/verify', { metodo: 'POST', datos: { code: codigo.trim() } }))
  },

  /** Catálogo publicado que esta persona puede ver (el backend filtra por permisos) y los favoritos por defecto. */
  async catalogo(): Promise<{ apps: App[]; favoritos: string[] }> {
    // Sin las que llevan a una página que esta edición apaga (p. ej. /formularios/carta-de-trabajo).
    const lista = (await pedir<AplicacionApi[]>('/applications')).filter((a) => rutaVisible(a.url))
    return { apps: lista.map(aApp), favoritos: lista.filter((a) => a.featured).map((a) => a.slug) }
  },

  contenidoInicio(): Promise<ContenidoInicio> {
    return pedir<ContenidoInicio>('/home/content')
  },

  /** Diseño propio (null sin sesión o si no personalizó) y el de todos (null = el de la propuesta). */
  disenosInicio(): Promise<{ personal: unknown; default: unknown }> {
    return pedir('/home/layout')
  },

  /** Guarda el diseño del Inicio en la cuenta (null = volver al de todos). El backend lo valida. */
  async guardarInicio(diseno: unknown): Promise<void> {
    await pedir('/home/layout', { metodo: 'PUT', datos: { layout: diseno } })
  },

  /** Solo administración: diseño por defecto para todos. */
  async guardarInicioDefecto(diseno: unknown): Promise<void> {
    await pedir('/home/default-layout', { metodo: 'PUT', datos: { layout: diseno } })
  },

  /** Anuncios vigentes hoy, urgentes primero (el bloque del Inicio). */
  async anuncios(): Promise<Anuncio[]> {
    return (await pedir<AnuncioApi[]>('/announcements')).map(aAnuncio)
  },

  /** Panel de Comunicación: todos los anuncios, con su estado. Solo admin y comunicacion. */
  async anunciosGestion(): Promise<AnuncioGestion[]> {
    return (await pedir<AnuncioGestionApi[]>('/announcements/manage')).map(aAnuncioGestion)
  },

  async crearAnuncio(datos: DatosAnuncio): Promise<AnuncioGestion> {
    return aAnuncioGestion(await pedir<AnuncioGestionApi>('/announcements', { metodo: 'POST', datos: anuncioApi(datos) }))
  },

  async editarAnuncio(id: number, cambios: Partial<DatosAnuncio>): Promise<AnuncioGestion> {
    return aAnuncioGestion(await pedir<AnuncioGestionApi>('/announcements/' + id, { metodo: 'PATCH', datos: anuncioApi(cambios) }))
  },

  async borrarAnuncio(id: number): Promise<void> {
    await pedir('/announcements/' + id, { metodo: 'DELETE' })
  },

  // ---------- Boletines, noticias y videos ----------
  /** Publicados, del más nuevo al más viejo. */
  /** Con `q`, solo los que traen todas esas palabras (en su descripción, palabras clave, texto o fecha). */
  async boletines(q?: string): Promise<Boletin[]> {
    return (await pedir<BoletinApi[]>('/bulletins' + (q?.trim() ? '?q=' + encodeURIComponent(q.trim()) : ''))).map(aBoletin)
  },

  async boletinesGestion(): Promise<BoletinGestion[]> {
    return (await pedir<(BoletinApi & EdicionApi)[]>('/bulletins/manage')).map((b) => ({ ...aBoletin(b), ...edicion(b) }))
  },

  async guardarBoletin(id: number | null, datos: DatosBoletin): Promise<BoletinGestion> {
    const b = await pedir<BoletinApi & EdicionApi>('/bulletins' + (id ? '/' + id : ''), { metodo: id ? 'PATCH' : 'POST', datos })
    return { ...aBoletin(b), ...edicion(b) }
  },

  /** Si la sincronización con mupa.gob.pa está encendida y cómo le fue la última vez. */
  estadoSincronizacion(): Promise<EstadoSincronizacion> {
    return pedir<EstadoSincronizacion>('/wordpress-sync/status')
  },

  /** Arranca ya la sincronización (sigue en segundo plano): se pregunta `estadoSincronizacion()` hasta que `running` sea false. */
  sincronizar(): Promise<EstadoSincronizacion> {
    return pedir<EstadoSincronizacion>('/wordpress-sync/run', { metodo: 'POST' })
  },

  async borrarBoletin(id: number): Promise<void> {
    await pedir('/bulletins/' + id, { metodo: 'DELETE' })
  },

  /** Publicadas, de la más nueva a la más vieja. */
  async noticias(): Promise<Noticia[]> {
    return (await pedir<NoticiaApi[]>('/news')).map(aNoticia)
  },

  /** Una publicada con su texto, para leerla en la intranet (404 si no existe o no tiene texto). */
  async noticia(id: number): Promise<NoticiaLectura> {
    const n = await pedir<NoticiaApi & { body: string }>('/news/' + id)
    return { ...aNoticia(n), cuerpo: n.body }
  },

  async noticiasGestion(): Promise<NoticiaGestion[]> {
    return (await pedir<(NoticiaApi & EdicionApi)[]>('/news/manage')).map((n) => ({ ...aNoticia(n), ...edicion(n) }))
  },

  async guardarNoticia(id: number | null, datos: DatosNoticia): Promise<NoticiaGestion> {
    const n = await pedir<NoticiaApi & EdicionApi>('/news' + (id ? '/' + id : ''), { metodo: id ? 'PATCH' : 'POST', datos })
    return { ...aNoticia(n), ...edicion(n) }
  },

  async borrarNoticia(id: number): Promise<void> {
    await pedir('/news/' + id, { metodo: 'DELETE' })
  },

  /** Publicados: primero los instructivos, luego los del canal y los demás. */
  async videos(): Promise<Video[]> {
    return (await pedir<VideoApi[]>('/videos')).map(aVideo)
  },

  async videosGestion(): Promise<VideoGestion[]> {
    return (await pedir<(VideoApi & EdicionApi)[]>('/videos/manage')).map((v) => ({ ...aVideo(v), ...edicion(v) }))
  },

  async guardarVideo(id: number | null, datos: DatosVideo): Promise<VideoGestion> {
    const v = await pedir<VideoApi & EdicionApi>('/videos' + (id ? '/' + id : ''), { metodo: id ? 'PATCH' : 'POST', datos })
    return { ...aVideo(v), ...edicion(v) }
  },

  async borrarVideo(id: number): Promise<void> {
    await pedir('/videos/' + id, { metodo: 'DELETE' })
  },

  // ---------- Formularios ----------
  /** Los publicados, por área y número. */
  async formularios(): Promise<Formulario[]> {
    return (await pedir<FormularioApi[]>('/forms')).map(aFormulario)
  },

  async formulariosGestion(): Promise<FormularioGestion[]> {
    return (await pedir<FormularioGestionApi[]>('/forms/manage')).map(aFormularioGestion)
  },

  async guardarFormulario(id: number | null, datos: DatosFormulario): Promise<FormularioGestion> {
    return aFormularioGestion(await pedir<FormularioGestionApi>('/forms' + (id ? '/' + id : ''), { metodo: id ? 'PATCH' : 'POST', datos }))
  },

  async borrarFormulario(id: number): Promise<void> {
    await pedir('/forms/' + id, { metodo: 'DELETE' })
  },

  // ---------- Solicitudes ----------
  /** Envía una solicitud (el formulario tiene que recibir solicitudes). El backend revisa las respuestas. */
  async enviarSolicitud(formulario: string, estado: Estado): Promise<SolicitudMia> {
    const r = await pedir<SolicitudMiaApi>('/requests', { metodo: 'POST', datos: { form: formulario, respuestas: { v: estado.v, c: estado.c, i: estado.i } } })
    return { ...aSolicitud(r), sinLeer: r.unread }
  },

  async misSolicitudes(): Promise<SolicitudMia[]> {
    return (await pedir<SolicitudMiaApi[]>('/requests/mine')).map((r) => ({ ...aSolicitud(r), sinLeer: r.unread }))
  },

  /** Detalle (la persona que la envió o el Gestor). Si la abre quien la envió, queda leída. */
  async solicitud(id: number): Promise<SolicitudDetalle> {
    return aSolicitudDetalle(await pedir<SolicitudDetalleApi>('/requests/' + id))
  },

  async solicitudesGestion(f: { formulario?: string; estado?: string; area?: 'rrhh'; q?: string; atrasadas?: boolean } = {}): Promise<SolicitudGestion[]> {
    const p = new URLSearchParams()
    if (f.formulario) p.set('form', f.formulario)
    if (f.estado) p.set('status', f.estado)
    if (f.area) p.set('area', f.area)
    if (f.atrasadas) p.set('overdue', 'true')
    if (f.q?.trim()) p.set('q', f.q.trim())
    const q = p.toString()
    return (await pedir<SolicitudGestionApi[]>('/requests/manage' + (q ? '?' + q : ''))).map(aSolicitudGestion)
  },

  async cambiarEstadoSolicitud(id: number, estado: EstadoSolicitud): Promise<SolicitudDetalle> {
    return aSolicitudDetalle(await pedir<SolicitudDetalleApi>('/requests/' + id, { metodo: 'PATCH', datos: { status: estado } }))
  },

  async responderSolicitud(id: number, texto: string): Promise<SolicitudDetalle> {
    return aSolicitudDetalle(await pedir<SolicitudDetalleApi>('/requests/' + id + '/messages', { metodo: 'POST', datos: { body: texto } }))
  },

  /** Sube un PDF o una imagen (hasta 10 MB). El backend comprueba el tipo por el contenido. */
  subirArchivo(archivo: File): Promise<ArchivoSubido> {
    return pedir('/files', { metodo: 'POST', archivo })
  },

  /** Comunicación: reemplaza una sección del contenido del Inicio. */
  async guardarSeccion(seccion: SeccionInicio, valor: unknown): Promise<ContenidoInicio> {
    return pedir('/home/content/' + seccion, { metodo: 'PUT', datos: { value: valor } })
  },

  /** Centro de Gestión: las cifras de cada área y lo último que pasó. */
  panelGestion(): Promise<PanelGestion> {
    return pedir('/gestion/panel')
  },

  /** Cifras de los paneles de gestión de esta persona (solo las de sus roles). */
  resumen(): Promise<Resumen> {
    return pedir('/me/summary')
  },

  /**
   * Avisos en vivo (Server-Sent Events) de las solicitudes nuevas, para quien las atiende.
   * El navegador reconecta solo si se corta; si el servidor responde 401, 403 o 429,
   * EventSource queda cerrado y no insiste. Devuelve la función para dejar de escuchar.
   */
  /** Solicitudes nuevas sin atender (campana de admin y Gestor). */
  async notificaciones(): Promise<{ total: number; items: NotificacionSolicitud[] }> {
    return pedir('/notifications')
  },

  escucharNotificaciones(alLlegar: (n: NotificacionSolicitud) => void): () => void {
    const fuente = new EventSource('/api/notifications/stream')
    fuente.addEventListener('solicitud.creada', (e) => {
      try {
        alLlegar(JSON.parse((e as MessageEvent<string>).data))
      } catch {
        // Un mensaje que no se entiende no rompe la página.
      }
    })
    return () => fuente.close()
  },

  // ---------- Administración: departamentos, personas y catálogo ----------
  departamentos(): Promise<Departamento[]> {
    return pedir('/departments')
  },

  crearDepartamento(nombre: string): Promise<Departamento> {
    return pedir('/departments', { metodo: 'POST', datos: { name: nombre } })
  },

  renombrarDepartamento(id: number, nombre: string): Promise<Departamento> {
    return pedir('/departments/' + id, { metodo: 'PATCH', datos: { name: nombre } })
  },

  async borrarDepartamento(id: number): Promise<void> {
    await pedir('/departments/' + id, { metodo: 'DELETE' })
  },

  personas(f: { departamento?: number; sinDepartamento?: boolean; q?: string } = {}): Promise<PersonaGestion[]> {
    const p = new URLSearchParams()
    if (f.departamento) p.set('department', String(f.departamento))
    if (f.sinDepartamento) p.set('withoutDepartment', 'true')
    if (f.q?.trim()) p.set('q', f.q.trim())
    const q = p.toString()
    return pedir('/users' + (q ? '?' + q : ''))
  },

  fichaPersona(id: number): Promise<FichaPersona> {
    return pedir('/users/' + id)
  },

  asignarDepartamento(personaId: number, departamentoId: number | null): Promise<PersonaGestion> {
    return pedir('/users/' + personaId, { metodo: 'PATCH', datos: { departmentId: departamentoId } })
  },

  suspenderPersona(id: number): Promise<PersonaGestion> {
    return pedir('/users/' + id + '/suspend', { metodo: 'POST' })
  },

  reactivarPersona(id: number): Promise<PersonaGestion> {
    return pedir('/users/' + id + '/reactivate', { metodo: 'POST' })
  },

  async reiniciarPersona(id: number): Promise<void> {
    await pedir('/users/' + id + '/reset', { metodo: 'POST' })
  },

  async borrarPersona(id: number): Promise<void> {
    await pedir('/users/' + id, { metodo: 'DELETE' })
  },

  /** Todo el catálogo, borradores incluidos; con departamento, solo lo que ve una persona de ese departamento. */
  appsGestion(departamento?: number): Promise<AppGestion[]> {
    return pedir('/applications?includeDrafts=true' + (departamento ? '&department=' + departamento : ''))
  },

  crearApp(datos: DatosApp): Promise<AppGestion> {
    return pedir('/applications', { metodo: 'POST', datos })
  },

  editarApp(id: number, datos: DatosApp): Promise<AppGestion> {
    return pedir('/applications/' + id, { metodo: 'PATCH', datos })
  },

  /** Clasifica en lote qué departamentos ven cada aplicación (lista vacía = todas las personas). Todo o nada. */
  visibilidadApps(items: { applicationId: number; departmentIds: number[] }[]): Promise<{ updated: number }> {
    return pedir('/applications/departments', { metodo: 'PUT', datos: items })
  },

  async borrarApp(id: number): Promise<void> {
    await pedir('/applications/' + id, { metodo: 'DELETE' })
  },

  etiquetas(): Promise<Etiqueta[]> {
    return pedir('/tags')
  },

  /** Especialidades, días y anticipación, leídos del sistema de citas de la Clínica (o su copia de respaldo). */
  async clinica(): Promise<InfoClinica> {
    const c = await pedir<ClinicaApi>('/clinic')
    const item = (x: { id: number; name: string; description: string | null }) => ({ id: x.id, nombre: x.name, descripcion: x.description })
    return {
      servicios: c.services.map(item),
      especialidades: c.specialties.map(item),
      diasCerrados: c.closedWeekdays,
      anticipacion: { minDias: c.bookingWindow.minDays, maxDias: c.bookingWindow.maxDays },
      fuente: c.source === 'clinic' ? 'clinica' : 'respaldo',
      actualizado: c.updatedAt,
    }
  },

  /** Las citas de la persona con sesión en la Clínica (por la cédula con la que entró). */
  async misCitas(): Promise<MisCitas> {
    const c = await pedir<{
      available: boolean
      knownCedula: boolean
      patientFound: boolean
      total: number
      appointments: { id: string; date: string; time: string | null; type: string | null; specialty: string | null; doctor: string | null; status: string; attended: boolean; cancelled: boolean }[]
    }>('/clinic/appointments')
    return {
      disponible: c.available,
      cedulaConocida: c.knownCedula,
      esPaciente: c.patientFound,
      total: c.total,
      citas: c.appointments.map((x) => ({ id: x.id, fecha: x.date, hora: x.time, tipo: x.type, especialidad: x.specialty, medico: x.doctor, estado: x.status, atendida: x.attended, cancelada: x.cancelled })),
    }
  },

  /** Las solicitudes de código de llamada de la persona con sesión (por la cédula con la que entró; solo consulta, nunca el código). */
  async misCodigosLlamada(): Promise<MisCodigos> {
    const c = await pedir<{
      available: boolean
      knownCedula: boolean
      total: number
      requests: { number: number; statusId: number; status: string; createdAt: string; updatedAt: string; location: string | null; lineType: string | null; extension: string | null; rejectionReason: string | null; history: { action: string; date: string }[] }[]
    }>('/call-codes/requests')
    return {
      disponible: c.available,
      cedulaConocida: c.knownCedula,
      total: c.total,
      solicitudes: c.requests.map((x) => ({
        numero: x.number,
        estadoId: x.statusId,
        estado: x.status,
        creada: x.createdAt,
        actualizada: x.updatedAt,
        ubicacion: x.location,
        linea: x.lineType,
        extension: x.extension,
        motivoRechazo: x.rejectionReason,
        historial: x.history.map((h) => ({ accion: h.action, fecha: h.date })),
      })),
    }
  },

  /** El directorio telefónico: la última copia de la central guardada en la intranet (o los datos fijos). */
  async directorio(): Promise<DirectorioApi> {
    return pedir<DirectorioApi>('/directory')
  },

  /** Los tickets de la Mesa de Ayuda (GLPI) de la persona con sesión (por su cédula en «Teléfono» de su usuario de GLPI; solo consulta). */
  async misTicketsGlpi(): Promise<MisTickets> {
    const c = await pedir<{
      available: boolean
      knownCedula: boolean
      userFound: boolean
      total: number
      tickets: { id: number; title: string; status: number; openedAt: string; updatedAt: string }[]
    }>('/glpi/tickets')
    return {
      disponible: c.available,
      cedulaConocida: c.knownCedula,
      usuarioEncontrado: c.userFound,
      total: c.total,
      tickets: c.tickets.map((x) => ({ numero: x.id, titulo: x.title, estadoId: x.status, abierto: x.openedAt, actualizado: x.updatedAt })),
    }
  },

  /** Si el asistente está prendido (hay servidor de inferencia). Ante cualquier error: apagado. */
  async estadoAsistente(): Promise<boolean> {
    return (await pedir<{ available: boolean }>('/assistant/status').catch(() => ({ available: false }))).available
  },

  /** La persona con sesión vio o saltó el recorrido para usuarios nuevos. */
  async marcarRecorrido(): Promise<void> {
    await pedir('/me/tour', { metodo: 'PUT' })
  },

  /**
   * Asistente de búsqueda: respuesta corta y los slugs de las aplicaciones que sirven
   * (el backend ya los filtró contra el catálogo de esta persona). Solo lectura.
   */
  /** `items`: contenido concreto (un boletín, una noticia, un formulario) con su ruta; puede faltar en una API vieja. */
  preguntarAsistente(pregunta: string): Promise<{ answer: string; applications: string[]; pages: { path: string; title: string }[]; items?: ItemAsistente[] }> {
    return pedir('/assistant/ask', { metodo: 'POST', datos: { question: pregunta } })
  },

  // ---------- RRHH Express (los datos de la propia persona, con su cuenta conectada) ----------

  /** Si RRHH Express está disponible y si esta sesión lo tiene conectado. Ante un error: no disponible. */
  async rrhhConexion(): Promise<ConexionRrhh> {
    const c = await pedir<ConexionRrhhApi>('/rrhh/conexion').catch(() => null)
    return aConexion(c ?? { available: false, connected: false, knownCedula: false, guest: false, name: null, expiresAt: null })
  },

  /**
   * El número de cargo y, si la sesión no conoce la cédula
   * o no hay sesión, la cédula. La intranet no los guarda.
   */
  async rrhhConectar(clave: string, cedula?: string): Promise<ConexionRrhh> {
    return aConexion(await pedir<ConexionRrhhApi>('/rrhh/conexion', { metodo: 'POST', datos: cedula ? { cedula, password: clave } : { password: clave } }))
  },

  async rrhhDesconectar(): Promise<void> {
    await pedir('/rrhh/conexion', { metodo: 'DELETE' })
  },

  async rrhhMarcaciones(anio: number, mes: number): Promise<MarcacionesMes> {
    const r = await pedir<MarcacionesApi>(`/rrhh/marcaciones?year=${anio}&month=${mes}`)
    return {
      anio: r.year,
      mes: r.month,
      horario: r.schedule,
      resumen: { presentes: r.summary.present, tardanzas: r.summary.late, ausencias: r.summary.absent, libres: r.summary.daysOff },
      dias: r.days.map((d) => ({
        fecha: d.date,
        estado: d.status,
        entrada: d.firstPunch,
        salida: d.lastPunch,
        horas: d.hoursWorked,
        horasRegulares: d.regularHours,
        tardanza: d.late,
        entradaAntes: d.earlyArrival,
        salidaAnticipada: d.earlyLeave,
        sobretiempo: d.overtime,
        feriado: d.holiday,
        excepcion: d.exception,
        ausencia: d.absenceType,
      })),
    }
  },

  async rrhhComprobantes(pagina = 1): Promise<PaginaComprobantes> {
    const r = await pedir<{ page: number; pages: number; total: number; items: ComprobanteApi[] }>(`/rrhh/comprobantes?page=${pagina}`)
    return { pagina: r.page, paginas: r.pages, total: r.total, items: r.items.map(aComprobante) }
  },

  async rrhhResumenAnual(anio: number): Promise<ResumenAnual> {
    const r = await pedir<{ year: number; totals: { gross: number; deductions: number; net: number }; items: ComprobanteApi[] }>(`/rrhh/comprobantes/resumen/${anio}`)
    return { anio: r.year, totales: { bruto: r.totals.gross, descuentos: r.totals.deductions, neto: r.totals.net }, items: r.items.map(aComprobante) }
  },

  async rrhhDetalle(planilla: number): Promise<DetalleComprobante> {
    const r = await pedir<{ payroll: number; lines: { code: string; type: string | null; amount: number; balance: number }[] }>(`/rrhh/comprobantes/detalle?payroll=${planilla}`)
    return { planilla: r.payroll, lineas: r.lines.map((l) => ({ codigo: l.code, tipo: l.type, monto: l.amount, saldo: l.balance })) }
  },

  async rrhhExpediente(): Promise<Expediente> {
    const r = await pedir<ExpedienteApi>('/rrhh/expediente')
    const j = r.job
    const p = r.personal
    return {
      laboral: { nombre: j.name, cargo: j.jobTitle, direccion: j.department, posicion: j.positionNumber, planilla: j.payrollType, inicio: j.startDate, fin: j.endDate, estado: j.status, salarioMensual: j.monthlySalary },
      personal: {
        nacimiento: p.birthDate,
        sexo: p.sex,
        estadoCivil: p.maritalStatus,
        seguroSocial: p.socialSecurity,
        telefono: p.phone,
        celular: p.mobile,
        correo: p.email,
        provincia: p.province,
        distrito: p.district,
        corregimiento: p.township,
        barriada: p.neighborhood,
        edificio: p.building,
        casa: p.house,
        contactoEmergencia: p.emergencyContact,
        telefonoEmergencia: p.emergencyPhone,
        funcion: p.role,
        area: p.area,
      },
      formacion: r.education.map((e) => ({ institucion: e.institution, titulo: e.title, comentario: e.comment, fecha: e.date })),
      evaluaciones: r.evaluations.map((e) => ({ fecha: e.date, promedio: e.average, categoria: e.category, comentarios: e.comments })),
      sanciones: r.sanctions.map((s) => ({ fecha: s.date, sancion: s.sanction, comentario: s.comment, remunerable: s.paid })),
      dependientes: r.dependents.map((d) => ({ nombre: d.name, parentesco: d.relationship, nacimiento: d.birthDate, cedula: d.idNumber, principal: d.primary })),
    }
  },

  async rrhhCompensatorio(): Promise<Compensatorio> {
    const r = await pedir<CompensatorioApi>('/rrhh/compensatorio')
    const bolsa = (b: CompensatorioApi['balances']['before']) => ({ disponible: b.available, pendiente: b.pending, usado: b.used, vencido: b.expired })
    return {
      jornadaMin: r.workdayMinutes,
      totalDisponible: r.totalAvailable,
      bolsas: { ANTES: bolsa(r.balances.before), DESPUES: bolsa(r.balances.after) },
      vencimientos: r.expiring.map((v) => ({ bolsa: v.type, fecha: v.date, minutos: v.minutes, diasRestantes: v.daysLeft })),
      solicitudes: r.requests.map((s) => ({
        id: s.id,
        clase: s.kind,
        bolsa: s.type,
        unidad: s.unit,
        minutos: s.minutes,
        dias: s.days,
        fechaTrabajada: s.workedDate,
        desde: s.from,
        hasta: s.to,
        motivo: s.reason,
        estado: s.status,
        motivoRechazo: s.rejectionReason,
        creada: s.createdAt,
      })),
    }
  },

  async rrhhReclamables(desde?: string, hasta?: string): Promise<DiaReclamable[]> {
    const q = new URLSearchParams()
    if (desde) q.set('from', desde)
    if (hasta) q.set('to', hasta)
    const r = await pedir<{ date: string; type: string; minutes: number }[]>('/rrhh/compensatorio/candidatos' + (q.size ? '?' + q : ''))
    return r.map((x) => ({ fecha: x.date, bolsa: x.type, minutos: x.minutes }))
  },

  /** Pedir que se acredite un día trabajado de más. Devuelve el mensaje de RRHH. */
  async rrhhAcreditar(datos: { bolsa: Bolsa; fecha: string; motivo?: string }): Promise<string | null> {
    const r = await pedir<{ message: string | null }>('/rrhh/compensatorio/acreditacion', { metodo: 'POST', datos: { type: datos.bolsa, workedDate: datos.fecha, reason: datos.motivo || undefined } })
    return r.message
  },

  /** Pedir usar tiempo compensatorio (horas o días). */
  async rrhhUsar(datos: { bolsa: Bolsa; unidad: 'HORAS' | 'DIAS'; cantidad: number; desde: string; hasta?: string; motivo?: string }): Promise<string | null> {
    const r = await pedir<{ message: string | null }>('/rrhh/compensatorio/uso', {
      metodo: 'POST',
      datos: { type: datos.bolsa, unit: datos.unidad, amount: datos.cantidad, from: datos.desde, to: datos.hasta || undefined, reason: datos.motivo || undefined },
    })
    return r.message
  },

  async rrhhCancelar(id: number): Promise<void> {
    await pedir(`/rrhh/compensatorio/solicitudes/${id}/cancelar`, { metodo: 'PATCH' })
  },
}

// ---------- RRHH Express: formato de la API ----------

type ConexionRrhhApi = { available: boolean; connected: boolean; knownCedula: boolean; guest: boolean; name: string | null; expiresAt: string | null; maintenance?: boolean }
const aConexion = (c: ConexionRrhhApi): ConexionRrhh => ({
  disponible: c.available,
  conectada: c.connected,
  cedulaConocida: c.knownCedula,
  invitado: c.guest,
  nombre: c.name,
  vence: c.expiresAt,
  mantenimiento: c.maintenance === true,
})

type MarcacionesApi = {
  year: number
  month: number
  schedule: string | null
  summary: { present: number; late: number; absent: number; daysOff: number }
  days: {
    date: string
    status: string | null
    firstPunch: string | null
    lastPunch: string | null
    hoursWorked: string | null
    regularHours: string | null
    late: string | null
    earlyArrival: string | null
    earlyLeave: string | null
    overtime: string | null
    holiday: string | null
    exception: string | null
    absenceType: string | null
  }[]
}

type ComprobanteApi = {
  payroll: number
  voucher: number | null
  date: string | null
  period: { year: number | null; month: number | null; half: number | null }
  jobTitle: string | null
  daysPaid: number | null
  gross: number
  deductions: { socialSecurity: number; educationInsurance: number; incomeTax: number; complementaryFund: number; asemup: number; other: number; total: number }
  net: number
  paymentMethod: string | null
  bank: string | null
  accountType: string | null
  account: string | null
}

function aComprobante(c: ComprobanteApi): Comprobante {
  const d = c.deductions
  return {
    planilla: c.payroll,
    cheque: c.voucher,
    fecha: c.date,
    periodo: { anio: c.period.year, mes: c.period.month, quincena: c.period.half },
    cargo: c.jobTitle,
    diasPagados: c.daysPaid,
    bruto: c.gross,
    descuentos: { seguroSocial: d.socialSecurity, seguroEducativo: d.educationInsurance, impuestoRenta: d.incomeTax, fondoComplementario: d.complementaryFund, asemup: d.asemup, otros: d.other, total: d.total },
    neto: c.net,
    formaPago: c.paymentMethod,
    banco: c.bank,
    tipoCuenta: c.accountType,
    cuenta: c.account,
  }
}

type Txt = string | null
type ExpedienteApi = {
  job: { name: Txt; jobTitle: Txt; department: Txt; positionNumber: number | null; payrollType: Txt; startDate: Txt; endDate: Txt; status: Txt; monthlySalary: number | null }
  personal: {
    birthDate: Txt
    sex: Txt
    maritalStatus: Txt
    socialSecurity: Txt
    phone: Txt
    mobile: Txt
    email: Txt
    province: Txt
    district: Txt
    township: Txt
    neighborhood: Txt
    building: Txt
    house: Txt
    emergencyContact: Txt
    emergencyPhone: Txt
    role: Txt
    area: Txt
  }
  education: { institution: Txt; title: Txt; comment: Txt; date: Txt }[]
  evaluations: { date: Txt; average: number | null; category: Txt; comments: Txt }[]
  sanctions: { date: Txt; sanction: Txt; comment: Txt; paid: boolean }[]
  dependents: { name: string; relationship: Txt; birthDate: Txt; idNumber: Txt; primary: boolean }[]
}

type CompensatorioApi = {
  workdayMinutes: number | null
  totalAvailable: number
  balances: Record<'before' | 'after', { available: number; pending: number; used: number; expired: number }>
  expiring: { type: Txt; date: Txt; minutes: number; daysLeft: number | null }[]
  requests: {
    id: number
    kind: Txt
    type: Txt
    unit: Txt
    minutes: number | null
    days: number | null
    workedDate: Txt
    from: Txt
    to: Txt
    reason: Txt
    status: Txt
    rejectionReason: Txt
    createdAt: Txt
  }[]
}
