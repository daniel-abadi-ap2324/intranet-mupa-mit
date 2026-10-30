import { describe, expect, it } from 'vitest'

import { BLOQUES, disenoPorDefecto, limpiarDiseno, MAX_BLOQUES, mismosBloques, type Diseno } from '@/lib/bloques'
import { destinoSeguro, revisarUrl } from '@/lib/url'

describe('revisarUrl', () => {
  it('acepta https, páginas de la intranet y vacío', () => {
    for (const u of ['https://sistema.ejemplo.gob.pa/login', '/aplicaciones', '', null]) expect(revisarUrl(u).error).toBe('')
  })

  it('rechaza direcciones IP (v4 y v6)', () => {
    for (const u of ['http://192.0.2.10/app', 'https://198.51.100.1', 'http://[::1]/x']) expect(revisarUrl(u).error).toMatch(/IP/)
  })

  it('rechaza nombres internos, otros protocolos y texto suelto', () => {
    expect(revisarUrl('http://servidor-rrhh/').error).toMatch(/nombre interno/)
    expect(revisarUrl('https://localhost:3000').error).toMatch(/nombre interno/)
    expect(revisarUrl('javascript:alert(1)').error).not.toBe('')
    expect(revisarUrl('ftp://archivos.ejemplo.gob.pa').error).toMatch(/http/)
    expect(revisarUrl('sistema.ejemplo.gob.pa').error).toMatch(/https:\/\//)
    expect(revisarUrl('//otro.sitio.com').error).not.toBe('')
    expect(revisarUrl('https://srv.mupa.local/x').error).toMatch(/nombre interno/)
    expect(revisarUrl('https://localhost./x').error).toMatch(/nombre interno/)
  })

  it('rechaza barras invertidas: el navegador lee "/\\otro-sitio" como "//otro-sitio"', () => {
    for (const u of ['/\\ejemplo.com', '/\\192.0.2.10/app', 'https:\\\\ejemplo.com']) expect(revisarUrl(u).error, u).toMatch(/barras invertidas/)
  })

  it('con soloHttps (anuncios) http es un error, no un aviso', () => {
    expect(revisarUrl('http://sistema.ejemplo.gob.pa', { soloHttps: true }).error).toMatch(/https/)
    expect(revisarUrl('https://sistema.ejemplo.gob.pa', { soloHttps: true }).error).toBe('')
  })

  it('avisa (sin rechazar) cuando la dirección usa http', () => {
    const r = revisarUrl('http://sistema.ejemplo.gob.pa')
    expect(r.error).toBe('')
    expect(r.aviso).toMatch(/http/)
  })
})

describe('mismosBloques ("Guardar para todos" vuelve al de fábrica solo si coincide del todo)', () => {
  it('un cambio de tamaño cuenta, aunque el orden sea el mismo', () => {
    const fabrica = disenoPorDefecto()
    expect(mismosBloques(disenoPorDefecto(), fabrica)).toBe(true)
    const otroAncho: Diseno = { ...fabrica, items: fabrica.items.map((it, i) => (i === 0 ? { ...it, ancho: it.ancho === 'completa' ? 'tercio' : 'completa' } : it)) }
    expect(mismosBloques(otroAncho, fabrica)).toBe(false)
  })
})

describe('limpiarDiseno', () => {
  it('descarta lo que no es un diseño', () => {
    expect(limpiarDiseno(null)).toBeNull()
    expect(limpiarDiseno({ items: 'x' })).toBeNull()
  })

  it('quita bloques desconocidos, repetidos y tamaños inválidos', () => {
    const d = limpiarDiseno({
      // "saludo" ya no existe (pasó al encabezado fijo): un diseño guardado con él sigue sirviendo.
      items: [{ id: 'anuncios', ancho: 'enorme' }, { id: 'anuncios' }, { id: '<script>' }, { id: 'saludo' }, { id: 'noticias', ancho: 'tercio' }],
    })!
    expect(d.items.map((i) => i.id)).toEqual(['anuncios', 'noticias'])
    expect(d.items[0].ancho).toBe(BLOQUES.anuncios.ancho)
    expect(d.items[1].ancho).toBe('tercio')
  })

  it(`no guarda más de ${MAX_BLOQUES} bloques`, () => {
    const d = limpiarDiseno({ items: Array.from({ length: 50 }, () => ({ id: 'apps-filtro' })) })!
    expect(d.items).toHaveLength(MAX_BLOQUES)
    expect(new Set(d.items.map((i) => i.uid)).size).toBe(MAX_BLOQUES)
  })

  it('en "Mis enlaces" solo deja enlaces http/https y limpia el texto', () => {
    const d = limpiarDiseno({
      items: [{ id: 'mis-enlaces', uid: 'mis-enlaces-abc', cfg: { titulo: '<b>Míos</b>', links: [{ t: 'Bueno', h: 'https://ejemplo.gob.pa' }, { t: 'Malo', h: 'javascript:alert(1)' }] } }],
    })!
    const cfg = d.items[0].cfg as { titulo: string; links: { t: string; h: string }[] }
    expect(cfg.titulo).toBe('bMíos/b')
    expect(cfg.links).toEqual([{ t: 'Bueno', h: 'https://ejemplo.gob.pa/' }])
  })

  it('el diseño por defecto usa solo bloques conocidos, va por franjas y llena cada fila', () => {
    const d = disenoPorDefecto()
    for (const it of d.items) expect(BLOQUES[it.id]).toBeDefined()
    expect(d.items.map((x) => x.id)).toEqual(['accesos', 'directorio', 'mesa', 'solicitudes', 'noticias', 'boletines', 'clinica', 'frecuentes', 'marca'])
    const columnas = { tercio: 4, media: 6, 'dos-tercios': 8, completa: 12 }
    // Cada fila se llena: la suma acumulada nunca se pasa de 12 sin cerrar justo en 12.
    let fila = 0
    for (const x of d.items) {
      fila += columnas[x.ancho]
      expect(fila, x.id).toBeLessThanOrEqual(12)
      if (fila === 12) fila = 0
    }
    expect(fila).toBe(0)
  })

  it('Anuncios hoy no funciona: no va por defecto, se puede agregar y está marcado; Mis solicitudes volvió', () => {
    const ids = disenoPorDefecto().items.map((x) => x.id)
    expect(ids).not.toContain('anuncios')
    expect(ids).toContain('solicitudes')
    expect(BLOQUES.anuncios.pausa).toBe(true)
    expect(BLOQUES.solicitudes.pausa).toBeUndefined()
    // Un diseño que lo trae sigue siendo válido (la persona lo agregó).
    expect(limpiarDiseno({ items: [{ id: 'anuncios' }, { id: 'solicitudes' }] })!.items.map((x) => x.id)).toEqual(['anuncios', 'solicitudes'])
  })

  it('los bloques quitados (videos, indicadores, reglamentos y beneficios) desaparecen de un diseño guardado', () => {
    for (const id of ['videos', 'indicadores', 'documentos', 'beneficios']) expect(BLOQUES[id], id).toBeUndefined()
    const d = limpiarDiseno({ items: [{ id: 'videos' }, { id: 'accesos' }, { id: 'beneficios' }, { id: 'indicadores' }, { id: 'documentos' }] })!
    expect(d.items.map((x) => x.id)).toEqual(['accesos'])
  })
})

describe('"Elegir qué mostrar" (cfg.ocultos)', () => {
  it('solo en los bloques con listas largas; se limpia y sin nada oculto no deja configuración', () => {
    expect(['formularios', 'frecuentes', 'enlaces', 'clinica'].filter((id) => BLOQUES[id]).every((id) => BLOQUES[id].elegible)).toBe(true)
    const d = limpiarDiseno({
      items: [
        { id: 'frecuentes', cfg: { ocultos: ['/sitio/ach.pdf', '/sitio/ach.pdf', '<b>x</b>', '', 7] } },
        { id: 'clinica', cfg: { ocultos: [] } },
        { id: 'directorio', cfg: { ocultos: ['/x'] } },
      ],
    })!
    expect(d.items[0].cfg).toEqual({ ocultos: ['/sitio/ach.pdf', 'bx/b', '7'] })
    expect(d.items[1]).not.toHaveProperty('cfg')
    // Un bloque que no es elegible no guarda configuración.
    expect(d.items[2]).not.toHaveProperty('cfg')
    const muchos = limpiarDiseno({ items: [{ id: 'enlaces', cfg: { ocultos: Array.from({ length: 60 }, (_, i) => 'h' + i) } }] })!
    expect((muchos.items[0].cfg as { ocultos: string[] }).ocultos).toHaveLength(40)
  })
})

describe('destinoSeguro (a dónde volver después de iniciar sesión)', () => {
  it('acepta páginas de la intranet', () => {
    expect(destinoSeguro('/mis-solicitudes')).toBe('/mis-solicitudes')
    expect(destinoSeguro('/formularios/carta-de-trabajo?x=1')).toBe('/formularios/carta-de-trabajo?x=1')
  })

  it('cualquier otra cosa vuelve al Inicio', () => {
    for (const v of [undefined, null, 42, '', 'https://otro.sitio', '//otro.sitio', '/\\otro.sitio', 'javascript:alert(1)', '/entrar', '/entrar?x=1']) expect(destinoSeguro(v)).toBe('/')
  })
})
