/**
 * Centro de Gestión (/gestion): quién entra, sus áreas y lo que trae la API
 * (GET /api/gestion/panel). Igual que en la API (shared/roles.ts): por ahora
 * TODOS_VEN_TODO, cualquier gestor ve y atiende todo. Para separar las áreas se
 * pone en false aquí y en la API y, cuando Identity Central tenga el rol de RRHH,
 * se agrega a ROLES (lib/roles.ts) y a "rrhh".
 */
import { activa, type Funcion } from './edicion'
import { tieneRol, type Rol } from './roles'

export const GESTORES: Rol[] = ['admin', 'comunicacion', 'gestorSolicitudes']
export const TODOS_VEN_TODO = true

export type AreaGestion = 'resumen' | 'solicitudes' | 'rrhh' | 'comunicacion' | 'administracion'

/** Las pestañas, en orden. `funcion`: la función de la edición de la que depende (si está apagada, no aparece). */
export const AREAS_GESTION: { v: AreaGestion; t: string; roles: Rol[]; funcion?: Funcion }[] = [
  { v: 'resumen', t: 'Resumen', roles: GESTORES },
  { v: 'solicitudes', t: 'Solicitudes', roles: ['admin', 'gestorSolicitudes'], funcion: 'bandeja' },
  { v: 'rrhh', t: 'Recursos Humanos', roles: ['admin', 'gestorSolicitudes'], funcion: 'bandeja' },
  { v: 'comunicacion', t: 'Comunicación', roles: ['admin', 'comunicacion'] },
  { v: 'administracion', t: 'Administración', roles: ['admin'] },
]

/** ¿Esta persona ve esa área? (y la edición la tiene encendida). */
export function veArea(user: { roles?: string[] | null } | null | undefined, area: AreaGestion): boolean {
  const a = AREAS_GESTION.find((x) => x.v === area)
  if (!a || (a.funcion && !activa(a.funcion))) return false
  return tieneRol(user, ...(TODOS_VEN_TODO ? GESTORES : a.roles))
}

/** Quién atiende solicitudes (la bandeja, el estado y las respuestas). */
export const ATIENDEN_SOLICITUDES: Rol[] = TODOS_VEN_TODO ? GESTORES : ['admin', 'gestorSolicitudes']

type Contador = { total: number; open: number }

export type PanelGestion = {
  generatedAt: string
  periodDays: number
  overdueDays: number
  requests?: {
    byStatus: { recibida: number; en_revision: number; resuelta: number; rechazada: number }
    open: number
    overdue: number
    firstResponseHours: number | null
    received: number
    resolved: number
    daily: { date: string; n: number }[]
    byArea: (Contador & { area: string; rrhh: boolean })[]
    byForm: (Contador & { area: string; form: string; rrhh: boolean })[]
    overdueList: { id: number; folio: string; formTitle: string; ownerName: string; status: string; createdAt: string }[]
  }
  communication?: {
    announcements?: { vigente: number; programado: number; vencido: number; borrador: number; retirado: number; expiring: { id: number; title: string; publishUntil: string }[] }
    news?: { published: number; drafts: number; recent: number }
    videos?: { published: number; total: number }
    bulletins: { published: number; total: number; latest: string | null }
  }
  administration?: {
    users: { total: number; active: number; created: number; withoutDepartment: number; unverifiedEmail: number }
    applications: { published: number; drafts: number }
    departments: number
  }
  activity: { kind: 'solicitud' | 'anuncio' | 'noticia' | 'boletin' | 'video'; action: string; title: string; status: string | null; who: string | null; at: string; requestId: number | null }[]
}

/** "3,5 h", "2 d" o "—". */
export function duracion(horas: number | null | undefined): string {
  if (horas === null || horas === undefined) return '—'
  if (horas < 1) return Math.max(1, Math.round(horas * 60)) + ' min'
  if (horas < 48) return horas.toLocaleString('es-PA', { maximumFractionDigits: 1 }) + ' h'
  return Math.round(horas / 24) + ' d'
}

/** Respuestas rápidas del Gestor: textos genéricos que se completan antes de enviar. `estado`: el que sugiere. */
export const RESPUESTAS_RAPIDAS: { t: string; texto: string; estado?: 'en_revision' | 'resuelta' | 'rechazada' }[] = [
  { t: 'En revisión', texto: 'Recibimos tu solicitud y ya la estamos revisando. Te avisaremos por aquí cuando esté lista.', estado: 'en_revision' },
  { t: 'Lista', texto: 'Tu solicitud ya está atendida. Si necesitas algo más, envía una nueva solicitud.', estado: 'resuelta' },
  { t: 'Falta información', texto: 'Para continuar necesitamos que nos indiques: ' },
  { t: 'No procede', texto: 'No podemos atender esta solicitud porque ', estado: 'rechazada' },
]

/** La bandeja del Centro de Gestión, con esa solicitud abierta. */
export const enBandeja = (id?: number) => '/gestion?area=solicitudes' + (id ? '&id=' + id : '')

/** Pide que se vuelvan a cargar las cifras y las listas de solicitudes (campana, Inicio, bandejas). */
export const avisarCambioSolicitudes = () => window.dispatchEvent(new Event('mupa:solicitudes'))
