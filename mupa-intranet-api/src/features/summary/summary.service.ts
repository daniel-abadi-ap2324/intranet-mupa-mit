import { CONTENT_EDITORS, hasRole, REQUEST_MANAGERS } from '../../shared/roles.ts'
import { announcementsService, type AnnouncementsService } from '../announcements/announcements.service.ts'
import { requestsService, type RequestsService } from '../requests/requests.service.ts'
import { usersService, type UsersService } from '../users/users.service.ts'
import type { SummaryResponse } from './dtos/summary-response.dto.ts'

/** Cifras para la franja "Gestión" del Inicio: cada rol ve solo las suyas. */
export class SummaryService {
  private readonly users: UsersService
  private readonly announcements: AnnouncementsService
  private readonly requests: RequestsService

  constructor(users: UsersService, announcements: AnnouncementsService, requests: RequestsService) {
    this.users = users
    this.announcements = announcements
    this.requests = requests
  }

  async forViewer(viewer: { id: number; roles: string[] }): Promise<SummaryResponse> {
    const out: SummaryResponse = { unreadRequests: await this.requests.countUnread(viewer) }
    if (hasRole(viewer, ...REQUEST_MANAGERS)) out.newRequests = await this.requests.countNew()
    if (hasRole(viewer, 'admin')) out.usersWithoutDepartment = await this.users.countWithoutDepartment()
    if (hasRole(viewer, ...CONTENT_EDITORS)) {
      const all = await this.announcements.listAll()
      out.activeAnnouncements = all.filter((a) => a.state === 'vigente').length
      out.draftAnnouncements = all.filter((a) => a.state === 'borrador').length
    }
    return out
  }
}

export const summaryService = new SummaryService(usersService, announcementsService, requestsService)
