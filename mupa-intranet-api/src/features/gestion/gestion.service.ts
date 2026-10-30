import { env } from '../../config/env.ts'
import { veArea } from '../../shared/roles.ts'
import { announcementsService, todayInPanama, type AnnouncementsService } from '../announcements/announcements.service.ts'
import { applicationsService, type ApplicationsService } from '../applications/applications.service.ts'
import { bulletinService, type BulletinsService } from '../bulletins/bulletins.service.ts'
import { departmentsService, type DepartmentsService } from '../departments/departments.service.ts'
import { newsService, type NewsService } from '../news/news.service.ts'
import { OVERDUE_DAYS, RRHH_AREA_NAMES } from '../requests/requests.constants.ts'
import { requestsService, type RequestsService } from '../requests/requests.service.ts'
import { usersService, type UsersService } from '../users/users.service.ts'
import { videoService, type VideosService } from '../videos/videos.service.ts'
import type { Actividad, PanelResponse } from './dtos/panel-response.dto.ts'

const DIA = 86_400_000
/** "Últimos 30 días". */
export const PERIODO_DIAS = 30
/** Una solicitud abierta sin movimiento en 3 días está atrasada (el mismo criterio que el filtro de la bandeja). */
export const ATRASO_DIAS = OVERDUE_DAYS
/** Anuncios vigentes que vencen en los próximos 7 días. */
const POR_VENCER_DIAS = 7
const ACTIVIDAD = 12

type Viewer = { id: number; roles: string[] }
type Servicios = {
  requests: RequestsService
  announcements: AnnouncementsService
  news: NewsService
  bulletins: BulletinsService
  videos: VideosService
  users: UsersService
  applications: ApplicationsService
  departments: DepartmentsService
}

const nombre = (first: string | null, last: string | null) => [first, last].filter(Boolean).join(' ') || null
const esRrhh = (area: string) => RRHH_AREA_NAMES.includes(area.toLowerCase())
/** "AAAA-MM-DD" de ese instante en Panamá. */
const diaPanama = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Panama' }).format(d)
const sumarDias = (ymd: string, dias: number) => new Date(Date.parse(ymd + 'T12:00:00Z') + dias * DIA).toISOString().slice(0, 10)

/**
 * Centro de Gestión: junta en una sola respuesta las cifras de solicitudes,
 * contenido y administración (cada una de su propio servicio) y lo último que pasó.
 */
export class GestionService {
  private readonly s: Servicios
  private readonly completa: boolean
  /** ¿Hay solicitudes internas (formularios de la intranet) y bandeja para atenderlas? Apagadas en la edición publicación. */
  private readonly bandeja: boolean
  private readonly now: () => Date

  constructor(servicios: Servicios, completa = env.EDICION === 'completa', now: () => Date = () => new Date(), bandeja = env.EDICION === 'completa') {
    this.s = servicios
    this.completa = completa
    this.bandeja = bandeja
    this.now = now
  }

  async panel(viewer: Viewer): Promise<PanelResponse> {
    const now = this.now()
    const since = new Date(now.getTime() - PERIODO_DIAS * DIA)
    const actividad: Actividad[] = []
    const out: PanelResponse = { generatedAt: now, periodDays: PERIODO_DIAS, overdueDays: ATRASO_DIAS, activity: [] }

    if (this.bandeja && (veArea(viewer, 'solicitudes') || veArea(viewer, 'rrhh'))) {
      out.requests = await this.solicitudes(now, since)
      for (const e of await this.s.requests.recentEvents(ACTIVIDAD)) {
        actividad.push({ kind: 'solicitud', action: e.type, title: `${e.folio ?? ''} · ${e.formTitle}`, status: e.status, who: nombre(e.authorFirstName, e.authorLastName), at: e.createdAt, requestId: e.requestId })
      }
    }
    if (veArea(viewer, 'comunicacion')) out.communication = await this.comunicacion(since, actividad)
    if (veArea(viewer, 'administracion')) {
      const [users, applications, departments] = await Promise.all([this.s.users.stats(since), this.s.applications.counts(), this.s.departments.list()])
      out.administration = { users, applications, departments: departments.length }
    }
    out.activity = actividad.sort((a, b) => b.at.getTime() - a.at.getTime()).slice(0, ACTIVIDAD)
    return out
  }

  private async solicitudes(now: Date, since: Date): Promise<NonNullable<PanelResponse['requests']>> {
    const overdueBefore = new Date(now.getTime() - ATRASO_DIAS * DIA)
    const [stats, llegadas, atrasadas] = await Promise.all([
      this.s.requests.stats(since, overdueBefore),
      this.s.requests.createdSince(since),
      this.s.requests.listOverdue(overdueBefore, 6),
    ])
    const porEstado = (st: string) => stats.byStatus.find((r) => r.status === st)?.n ?? 0

    // Serie por día (de Panamá): los 30 días, también los que no llegó nada.
    const hoy = diaPanama(now)
    const conteo = new Map<string, number>()
    for (const d of llegadas) conteo.set(diaPanama(d), (conteo.get(diaPanama(d)) ?? 0) + 1)
    const daily = Array.from({ length: PERIODO_DIAS }, (_, i) => {
      const date = sumarDias(hoy, i - PERIODO_DIAS + 1)
      return { date, n: conteo.get(date) ?? 0 }
    })

    const areas = new Map<string, { area: string; total: number; open: number; rrhh: boolean }>()
    for (const f of stats.byForm) {
      const a = areas.get(f.area) ?? { area: f.area, total: 0, open: 0, rrhh: esRrhh(f.area) }
      a.total += f.total
      a.open += f.open
      areas.set(f.area, a)
    }

    return {
      byStatus: { recibida: porEstado('recibida'), en_revision: porEstado('en_revision'), resuelta: porEstado('resuelta'), rechazada: porEstado('rechazada') },
      open: porEstado('recibida') + porEstado('en_revision'),
      overdue: stats.overdue,
      firstResponseHours: stats.firstResponseHours === null ? null : Math.round(stats.firstResponseHours * 10) / 10,
      received: llegadas.length,
      resolved: stats.resolvedSince,
      daily,
      byArea: [...areas.values()].sort((a, b) => b.open - a.open || b.total - a.total),
      byForm: stats.byForm.map((f) => ({ ...f, rrhh: esRrhh(f.area) })).sort((a, b) => b.open - a.open || b.total - a.total),
      overdueList: atrasadas.map((r) => ({ id: r.id, folio: r.folio ?? '', formTitle: r.formTitle, ownerName: r.ownerName, status: r.status, createdAt: r.createdAt })),
    }
  }

  private async comunicacion(since: Date, actividad: Actividad[]): Promise<NonNullable<PanelResponse['communication']>> {
    const editado = (kind: Actividad['kind'], title: string, who: string | null, at: Date) => {
      if (at >= since) actividad.push({ kind, action: 'editado', title, status: null, who, at, requestId: null })
    }
    const boletines = await this.s.bulletins.listAll()
    for (const b of boletines) editado('boletin', `Boletín del ${b.date}`, b.updatedByName, b.updatedAt)
    const out: NonNullable<PanelResponse['communication']> = {
      bulletins: { published: boletines.filter((b) => b.published).length, total: boletines.length, latest: boletines.find((b) => b.published)?.date ?? null },
    }
    // Las noticias van en las dos ediciones (llegan solas de mupa.gob.pa).
    const noticias = await this.s.news.listAll()
    const desde = diaPanama(since)
    out.news = {
      published: noticias.filter((n) => n.status === 'publicado').length,
      drafts: noticias.filter((n) => n.status !== 'publicado').length,
      recent: noticias.filter((n) => n.status === 'publicado' && n.date >= desde).length,
    }
    for (const n of noticias) editado('noticia', n.title, n.updatedByName, n.updatedAt)
    if (!this.completa) return out

    const [anuncios, videos] = await Promise.all([this.s.announcements.listAll(), this.s.videos.listAll()])
    const hoy = todayInPanama()
    const limite = sumarDias(hoy, POR_VENCER_DIAS)
    const cuantos = (st: string) => anuncios.filter((a) => a.state === st).length
    out.announcements = {
      vigente: cuantos('vigente'),
      programado: cuantos('programado'),
      vencido: cuantos('vencido'),
      borrador: cuantos('borrador'),
      retirado: cuantos('retirado'),
      expiring: anuncios
        .filter((a) => a.state === 'vigente' && a.publishUntil && a.publishUntil <= limite)
        .sort((a, b) => a.publishUntil!.localeCompare(b.publishUntil!))
        .map((a) => ({ id: a.id, title: a.title, publishUntil: a.publishUntil! })),
    }
    out.videos = { published: videos.filter((v) => v.published).length, total: videos.length }
    for (const a of anuncios) editado('anuncio', a.title, a.updatedByName, a.updatedAt)
    for (const v of videos) editado('video', v.title, v.updatedByName, v.updatedAt)
    return out
  }
}

export const gestionService = new GestionService({
  requests: requestsService,
  announcements: announcementsService,
  news: newsService,
  bulletins: bulletinService,
  videos: videoService,
  users: usersService,
  applications: applicationsService,
  departments: departmentsService,
})
