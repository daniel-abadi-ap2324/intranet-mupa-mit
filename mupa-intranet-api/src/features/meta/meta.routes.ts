import { Router } from 'express'

import { validate } from '../../shared/middlewares/validate.middleware.ts'
import { contentQueryDto } from './dtos/content-query.dto.ts'
import { requireInternalKey } from './internal-key.middleware.ts'
import { metaController } from './meta.controller.ts'

export const metaRoutes = Router()

// Solo el servidor MCP (con la llave interna): no es para personas.
metaRoutes.get('/catalog', requireInternalKey, metaController.catalog)
// Contenido concreto (boletines, noticias, formularios) que coincide con una pregunta: la herramienta search_content del MCP.
metaRoutes.get('/content', requireInternalKey, validate({ query: contentQueryDto }), metaController.content)
// Personas del directorio y textos de mupa.gob.pa (alcalde, directores, noticias) para una pregunta: la herramienta search_mupa_site del MCP.
metaRoutes.get('/site-search', requireInternalKey, validate({ query: contentQueryDto }), metaController.site)
