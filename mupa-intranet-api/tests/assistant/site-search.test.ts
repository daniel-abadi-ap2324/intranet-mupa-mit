/** Buscadores nuevos del asistente: el directorio telefónico y mupa.gob.pa (con un sitio simulado, sin red). */
import { describe, expect, it } from 'vitest'

import { DirectorySearchService } from '../../src/features/assistant/directory-search.service.ts'
import { SiteSearchService } from '../../src/features/assistant/site-search.service.ts'

const persona = (nombre: string, apellido: string, direccion: string, ext: string) => ({ nombre, apellido, direccion, ext, ubicacion: '' })

describe('directorio', () => {
  const dir = new DirectorySearchService([
    persona('Marta', 'Ejemplar', 'Auditoría Interna', '2206'),
    persona('Ana', 'Ejemplar', 'Tesorería', '3100'),
    persona('Luis', 'Pérez', 'Tecnología e Innovación', '1657'),
    persona('Recepción', '', '', '4300'),
  ])

  it('encuentra a una persona por nombre y apellido sin traer a las del mismo apellido', () => {
    expect(dir.search('¿cuál es la extensión de Marta Ejemplar?').map((p) => p.ext)).toEqual(['2206'])
  })

  it('encuentra por dirección y no inventa nada si no hay coincidencias', () => {
    expect(dir.search('quién está en tecnología').map((p) => p.nombre)).toEqual(['Luis'])
    expect(dir.search('capital de Francia')).toEqual([])
  })
})

/** Un mupa.gob.pa de mentira: páginas (una con cédulas, otra que es un formulario) y la búsqueda de noticias. */
function fakeSite(calls: string[] = []) {
  const json = (data: unknown) => new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } })
  return (async (url: string | URL) => {
    const u = String(url)
    calls.push(u)
    if (u.includes('/wp/v2/pages'))
      return json([
        { title: { rendered: 'Alcalde' }, link: 'https://mupa.test/alcalde/', content: { rendered: '<p>Alcalde del Distrito de Panamá Mayer Mizrachi Matalon, nacido en Panamá, es el actual alcalde del distrito.</p>' } },
        { title: { rendered: 'Operadores' }, link: 'https://mupa.test/operadores/', content: { rendered: '<p>Conoce a nuestros operadores de campo: Pedro Ejemplo 8-999-0001 y otros más del equipo municipal.</p>' } },
        { title: { rendered: 'Formulario' }, link: 'https://mupa.test/form/', content: { rendered: '<script>var formDisplay=1;</script> alcalde alcalde alcalde formulario de postulación' } },
      ])
    if (u.includes('/wp/v2/search')) return json(u.includes('alcalde') ? [{ id: 7 }] : [])
    if (u.includes('/wp/v2/posts')) return json([{ title: { rendered: 'Alcalde inaugura cancha' }, link: 'https://mupa.test/n7/', date: '2026-10-20T10:00:00', content: { rendered: '<p>El alcalde entregó la cancha.</p>' } }])
    return new Response('no', { status: 404 })
  }) as typeof fetch
}

describe('mupa.gob.pa', () => {
  it('trae la página que responde y la noticia de la búsqueda, sin formularios', async () => {
    const site = new SiteSearchService('https://mupa.test', fakeSite())
    const found = await site.search('¿quién es el alcalde?')
    expect(found.map((p) => [p.kind, p.title])).toEqual([
      ['pagina', 'Alcalde'],
      ['noticia', 'Alcalde inaugura cancha'],
    ])
    expect(found[0].text).toContain('Mayer Mizrachi')
    expect(found[1].date).toBe('2026-10-20')
  })

  it('nunca repite una cédula que esté en una página pública', async () => {
    const site = new SiteSearchService('https://mupa.test', fakeSite())
    const [op] = await site.search('operadores de campo')
    expect(op.title).toBe('Operadores')
    expect(op.text).not.toContain('8-999-0001')
    expect(op.text).toContain('[dato personal]')
  })

  it('guarda las páginas en memoria y, si el sitio no responde, contesta sin él', async () => {
    const calls: string[] = []
    const site = new SiteSearchService('https://mupa.test', fakeSite(calls))
    await site.search('alcalde')
    await site.search('alcalde de panamá')
    expect(calls.filter((u) => u.includes('/wp/v2/pages'))).toHaveLength(1)
    const caido = new SiteSearchService('https://mupa.test', (async () => {
      throw new Error('sin red')
    }) as typeof fetch)
    expect(await caido.search('alcalde')).toEqual([])
    expect(await new SiteSearchService(null).search('alcalde')).toEqual([])
  })
})
