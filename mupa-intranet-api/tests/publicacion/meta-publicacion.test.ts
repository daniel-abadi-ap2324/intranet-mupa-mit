/** En la edición publicación el catálogo solo trae lo que de verdad existe (nada de anuncios, formularios ni solicitudes internas; las noticias sí). */
import { describe, expect, it } from 'vitest'

import { anonymous } from '../helpers.ts'

describe('catálogo en la edición publicación', () => {
  it('no describe endpoints ni páginas que en esta edición no existen', async () => {
    const c = (await anonymous().get('/api/meta/catalog').set('X-Internal-Key', process.env.MCP_INTERNAL_KEY!)).body
    expect(c.edition).toBe('publicacion')
    const paths: string[] = c.endpoints.map((e: { path: string }) => e.path)
    expect(paths).toContain('/api/news')
    expect(paths.some((p) => p.startsWith('/api/announcements'))).toBe(false)
    for (const apagado of ['/api/forms', '/api/requests', '/api/notifications']) expect(paths.some((p) => p.startsWith(apagado)), apagado).toBe(false)
    expect(paths).toContain('/api/glpi/tickets')
    expect(paths).toContain('/api/bulletins')
    expect(c.pages.map((p: { path: string }) => p.path)).toContain('/noticias')
    expect(c.pages.map((p: { path: string }) => p.path)).not.toContain('/formularios')
    expect(c.pages.map((p: { path: string }) => p.path)).toContain('/boletines')
    expect(c.pages.map((p: { path: string }) => p.path)).toContain('/mis-solicitudes')
  })
})
