import type { Router } from 'express'
import { z, type ZodType } from 'zod'

import { env } from '../../config/env.ts'
import { listMounts } from '../../shared/route-registry.ts'
import { assistantService, type AssistantService } from '../assistant/assistant.service.ts'
import { knowledgeFacts, knowledgePages } from '../assistant/assistant.knowledge.ts'
import type { ContentItem } from '../assistant/content-search.service.ts'
import { ENDPOINT_DOCS } from './endpoint-docs.ts'

type JsonSchema = Record<string, unknown>

export type CatalogEndpoint = {
  /** "GET /api/news": método y ruta, únicos. */
  id: string
  method: string
  path: string
  area: string | null
  /** Qué hace; null si falta su descripción en endpoint-docs.ts (una prueba lo impide). */
  summary: string | null
  /** 'roles': solo ciertos roles; 'session': cualquiera con sesión; 'open': no pide nada por sí mismo (ver `access`). */
  accessLevel: 'open' | 'session' | 'roles'
  roles: string[]
  /** Quién puede usarlo, dicho para personas. */
  access: string
  /** La página de la intranet donde la persona usa esto. */
  page: string | null
  keywords: string[]
  /** Lo que recibe, como JSON Schema (solo lo que el endpoint valida). */
  request: { params?: JsonSchema; query?: JsonSchema; body?: JsonSchema }
}

export type Catalog = {
  version: 1
  generatedAt: string
  edition: 'completa' | 'publicacion'
  endpoints: CatalogEndpoint[]
  pages: { path: string; title: string; about: string }[]
  facts: string[]
}

type Handler = { requiredRoles?: readonly string[]; requiresSession?: boolean; validates?: { params?: ZodType; query?: ZodType; body?: ZodType } }
type RouteLayer = { route?: { path: string; methods: Record<string, boolean>; stack: { handle: Handler }[] } }

const ACCESS_TEXT = { open: 'Cualquiera', session: 'Cualquier persona con sesión' }

/** Un DTO de Zod como JSON Schema, sin el adorno; null si no se puede representar. */
function schemaOf(schema: ZodType | undefined): JsonSchema | undefined {
  if (!schema) return undefined
  try {
    const { $schema: _omit, ...rest } = z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' }) as JsonSchema
    return rest
  } catch {
    return undefined
  }
}

/** Los endpoints de un router, con lo que se averigua solo de sus middlewares (roles, DTO). */
function endpointsOf(prefix: string, router: Router): CatalogEndpoint[] {
  const found: CatalogEndpoint[] = []
  for (const layer of (router as unknown as { stack: RouteLayer[] }).stack) {
    if (!layer.route) continue
    const handlers = layer.route.stack.map((l) => l.handle)
    const roles = [...new Set(handlers.flatMap((h) => [...(h.requiredRoles ?? [])]))]
    const session = handlers.some((h) => h.requiresSession)
    const validates = handlers.map((h) => h.validates).find(Boolean)
    const path = prefix + (layer.route.path === '/' ? '' : layer.route.path)
    for (const method of Object.keys(layer.route.methods).map((m) => m.toUpperCase())) {
      const id = `${method} ${path}`
      const doc = ENDPOINT_DOCS[id]
      const accessLevel = roles.length ? 'roles' : session ? 'session' : 'open'
      found.push({
        id,
        method,
        path,
        area: doc?.area ?? null,
        summary: doc?.summary ?? null,
        accessLevel,
        roles,
        access: doc?.access ?? (roles.length ? `Roles: ${roles.join(', ')}` : ACCESS_TEXT[accessLevel as 'open' | 'session']),
        page: doc?.page ?? null,
        keywords: doc?.keywords ?? [],
        request: { params: schemaOf(validates?.params), query: schemaOf(validates?.query), body: schemaOf(validates?.body) },
      })
    }
  }
  return found
}

/**
 * Describe la API: sus endpoints (los que de verdad están montados en esta edición, con su descripción), las páginas de
 * la intranet y los datos confirmados. Lo lee el servidor MCP para que el asistente sepa qué hay y adónde mandar a la persona.
 */
export class MetaService {
  private readonly assistant: AssistantService

  constructor(assistant: AssistantService) {
    this.assistant = assistant
  }

  /** Boletines, noticias y formularios publicados que coinciden con una pregunta (la herramienta search_content del MCP). */
  content(q: string, limit: number): Promise<ContentItem[]> {
    return this.assistant.searchContent(q, limit)
  }

  /** Personas del directorio y textos de mupa.gob.pa que coinciden con una pregunta (la herramienta search_mupa_site del MCP). */
  site(q: string) {
    return this.assistant.searchSite(q)
  }

  catalog(): Catalog {
    return {
      version: 1,
      generatedAt: new Date().toISOString(),
      edition: env.EDICION,
      endpoints: listMounts().flatMap((m) => endpointsOf(m.path, m.router)),
      pages: knowledgePages().map(({ path, title, about }) => ({ path, title, about })),
      facts: [...knowledgeFacts()],
    }
  }
}

export const metaService = new MetaService(assistantService)
