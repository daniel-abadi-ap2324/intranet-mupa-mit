import { homeLayoutDto, type HomeLayout } from './dtos/home-layout.dto.ts'
import type { HomeSection } from './dtos/home-sections.dto.ts'
import { homeRepository, type HomeRepository } from './home.repository.ts'

export class HomeService {
  private readonly repository: HomeRepository

  constructor(repository: HomeRepository) {
    this.repository = repository
  }

  /** Contenido del Inicio; vacío si todavía no se cargó. */
  async getContent(): Promise<Record<string, unknown>> {
    const value = await this.repository.findSetting('content')
    return value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
  }

  /** Reemplaza una sección del contenido (Comunicación); el resto queda igual. */
  async saveSection(section: HomeSection, value: unknown): Promise<Record<string, unknown>> {
    const content = { ...(await this.getContent()), [section]: value }
    await this.repository.saveSetting('content', content)
    return content
  }

  /** Diseño propio (si hay sesión y lo personalizó) y el de todos. */
  async getLayouts(userId: number | undefined): Promise<{ personal: HomeLayout | null; default: HomeLayout | null }> {
    const [personal, fallback] = await Promise.all([
      userId ? this.repository.findLayoutByUserId(userId) : null,
      this.repository.findSetting('default_layout'),
    ])
    return { personal: this.readable(personal), default: this.readable(fallback) }
  }

  /** null = la persona vuelve al diseño de todos. */
  async savePersonalLayout(userId: number, layout: HomeLayout | null): Promise<HomeLayout | null> {
    if (layout) await this.repository.saveLayout(userId, layout)
    else await this.repository.deleteLayout(userId)
    return layout
  }

  /** Solo administración (lo exige la ruta). null = volver al diseño de la propuesta. */
  async saveDefaultLayout(layout: HomeLayout | null): Promise<HomeLayout | null> {
    if (layout) await this.repository.saveSetting('default_layout', layout)
    else await this.repository.deleteSetting('default_layout')
    return layout
  }

  /** Un diseño guardado que ya no cumple las reglas actuales se ignora (se usa el de todos). */
  private readable(value: unknown): HomeLayout | null {
    const r = homeLayoutDto.safeParse(value)
    return r.success ? r.data : null
  }
}

export const homeService = new HomeService(homeRepository)
